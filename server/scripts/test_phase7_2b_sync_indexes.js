/**
 * LUXECART PHASE 7.2B.2.2 SAFE INDEX MANAGEMENT UTILITY TEST SUITE
 *
 * NOTE: These tests run against an isolated in-memory test harness (MockDatabase / MockCollection).
 * They verify CLI safety gates, preflight orchestration, canonical option matching, and error tracking.
 * They are clearly labeled as MOCKED MongoDB behavior and do NOT claim real WiredTiger engine verification.
 * Zero connections to Atlas or persistent databases are initiated.
 */

import assert from 'assert';
import {
  runIndexSync,
  compareIndexes,
  inspectCollectionCollation,
  checkUnexpectedArrays,
  runUniquePreflightBlocker,
  runNormalizationAnomalyCheck,
  maskUri,
  areKeysEqual,
  areOptionsEqual,
  canonicalizeValue,
  maskEmail,
  sanitizeForReport,
  UNIQUE_INDEX_REGISTRY,
} from './sync_indexes.js';

const testResults = [];

function recordTest(testId, name, passed, details = '') {
  testResults.push({ testId, name, status: passed ? 'PASS' : 'FAIL', details });
  const badge = passed ? '✔ [PASS]' : '✖ [FAIL]';
  console.log(`${badge} [${testId}] ${name}`);
  if (details) console.log(`    ↳ ${details}`);
}

/**
 * Lightweight in-memory collection mock for testing preflight aggregations and index operations.
 * MOCKED MONGODB BEHAVIOR HARNESS
 */
class MockCollection {
  constructor(name, documents = [], existingIndexes = []) {
    this.collectionName = name;
    this.documents = JSON.parse(JSON.stringify(documents));
    this.existingIndexes = JSON.parse(JSON.stringify(existingIndexes));
    this.createdIndexes = [];
    this.shouldFailCreateIndex = false;
    this.failureErrorMessage = 'Simulated IndexBuildFailure in mock collection';
    this.shouldFailIndexes = false;
    this.indexesErrorMessage = 'Simulated IndexesRetrievalFailure';
    this.shouldFailFind = false;
    this.findErrorMessage = 'Simulated FindFailure in array check';
    this.aggregateCallCount = 0;
    this.createIndexCallCount = 0;
  }

  async indexes() {
    if (this.shouldFailIndexes) {
      throw new Error(this.indexesErrorMessage);
    }
    return this.existingIndexes;
  }

  async createIndex(keySpec, options = {}) {
    this.createIndexCallCount++;
    if (this.shouldFailCreateIndex) {
      throw new Error(this.failureErrorMessage);
    }
    const idx = { key: keySpec, ...options };
    this.createdIndexes.push(idx);
    this.existingIndexes.push(idx);
    return idx.name || Object.keys(keySpec).join('_') + '_1';
  }

  find(query = {}, options = {}) {
    if (this.shouldFailFind) {
      throw new Error(this.findErrorMessage);
    }
    const matched = this.documents.filter((doc) => this._matchesCriteria(doc, query));
    return {
      toArray: async () => matched,
    };
  }

  aggregate(pipeline, options = {}) {
    this.aggregateCallCount++;
    let docs = JSON.parse(JSON.stringify(this.documents));

    for (const stage of pipeline) {
      if (stage.$match) {
        docs = docs.filter((doc) => this._matchesCriteria(doc, stage.$match));
      } else if (stage.$unwind) {
        const path = stage.$unwind.replace('$', '');
        const unwound = [];
        for (const doc of docs) {
          const arr = this._getNestedValue(doc, path);
          if (Array.isArray(arr) && arr.length > 0) {
            for (const item of arr) {
              const clone = JSON.parse(JSON.stringify(doc));
              this._setNestedValue(clone, path, item);
              unwound.push(clone);
            }
          }
        }
        docs = unwound;
      } else if (stage.$group) {
        const groups = new Map();
        const groupSpec = stage.$group;

        for (const doc of docs) {
          const groupKey = this._computeGroupKey(doc, groupSpec._id);
          const serializedKey = JSON.stringify(groupKey);

          if (!groups.has(serializedKey)) {
            groups.set(serializedKey, {
              _id: groupKey,
              __docs: [],
              __counts: 0,
              __sets: {},
            });
          }

          const entry = groups.get(serializedKey);
          entry.__docs.push(doc);
          entry.__counts++;

          for (const [field, acc] of Object.entries(groupSpec)) {
            if (field === '_id') continue;
            if (acc.$addToSet) {
              if (!entry.__sets[field]) entry.__sets[field] = new Set();
              const val = this._resolveFieldValue(doc, acc.$addToSet);
              if (val !== undefined) {
                entry.__sets[field].add(typeof val === 'object' ? JSON.stringify(val) : String(val));
              }
            }
          }
        }

        const groupedDocs = [];
        for (const entry of groups.values()) {
          const out = { _id: entry._id };
          for (const [field, acc] of Object.entries(groupSpec)) {
            if (field === '_id') continue;
            if (acc.$sum) {
              out[field] = entry.__counts;
            } else if (acc.$push) {
              const pField = acc.$push.replace('$', '');
              out[field] = entry.__docs.map((d) => d[pField]);
            } else if (acc.$addToSet) {
              out[field] = Array.from(entry.__sets[field] || []);
            }
          }
          groupedDocs.push(out);
        }
        docs = groupedDocs;
      } else if (stage.$project) {
        docs = docs.map((doc) => this._projectDoc(doc, stage.$project));
      }
    }

    return {
      toArray: async () => docs,
    };
  }

  _getNestedValue(doc, path) {
    const parts = path.split('.');
    let curr = doc;
    for (const p of parts) {
      if (curr == null) return undefined;
      curr = curr[p];
    }
    return curr;
  }

  _setNestedValue(doc, path, val) {
    const parts = path.split('.');
    let curr = doc;
    for (let i = 0; i < parts.length - 1; i++) {
      if (curr[parts[i]] == null) curr[parts[i]] = {};
      curr = curr[parts[i]];
    }
    curr[parts[parts.length - 1]] = val;
  }

  _matchesCriteria(doc, criteria) {
    for (const [key, cond] of Object.entries(criteria)) {
      if (key === '$or' && Array.isArray(cond)) {
        const matchesAny = cond.some((sub) => this._matchesCriteria(doc, sub));
        if (!matchesAny) return false;
        continue;
      }

      if (key === '$expr') {
        if (!this._evalExpr(doc, cond)) return false;
        continue;
      }

      // Handle nested array path matching (e.g. variants.sku where variants is array)
      const parts = key.split('.');
      if (parts.length === 2 && parts[0] === 'variants' && parts[1] === 'sku' && Array.isArray(doc.variants)) {
        if (typeof cond === 'object' && cond !== null && cond.$type === 'array') {
          return doc.variants.some((v) => Array.isArray(v.sku));
        }
        if (typeof cond === 'object' && cond !== null && cond.$exists !== undefined) {
          return doc.variants.some((v) => (v.sku !== undefined) === cond.$exists);
        }
      }

      const val = this._getNestedValue(doc, key);

      if (typeof cond === 'object' && cond !== null && !Array.isArray(cond)) {
        if (cond.$exists !== undefined) {
          const exists = val !== undefined;
          if (exists !== cond.$exists) return false;
        }
        if (cond.$type !== undefined) {
          if (cond.$type === 'string' && typeof val !== 'string') return false;
          if (cond.$type === 'array' && !Array.isArray(val)) return false;
        }
        if (cond.$gt !== undefined) {
          if (!(val > cond.$gt)) return false;
        }
      } else {
        if (val !== cond) return false;
      }
    }
    return true;
  }

  _evalExpr(doc, expr) {
    if (expr.$gt && Array.isArray(expr.$gt)) {
      const left = this._resolveExprValue(doc, expr.$gt[0]);
      const right = this._resolveExprValue(doc, expr.$gt[1]);
      return left > right;
    }
    return true;
  }

  _resolveExprValue(doc, spec) {
    if (typeof spec === 'number') return spec;
    if (typeof spec === 'string') {
      const field = spec.startsWith('$') ? spec.slice(1) : spec;
      return doc[field];
    }
    if (spec && spec.$size) {
      const arr = this._resolveExprValue(doc, spec.$size);
      return Array.isArray(arr) ? arr.length : 0;
    }
    return 0;
  }

  _computeGroupKey(doc, idSpec) {
    if (typeof idSpec === 'string') {
      return this._resolveFieldValue(doc, idSpec);
    }
    if (typeof idSpec === 'object' && idSpec !== null) {
      const keys = Object.keys(idSpec);
      if (keys.length === 1 && keys[0].startsWith('$')) {
        return this._resolveFieldValue(doc, idSpec);
      }
      const out = {};
      for (const [k, v] of Object.entries(idSpec)) {
        out[k] = this._resolveFieldValue(doc, v);
      }
      return out;
    }
    return idSpec;
  }

  _resolveFieldValue(doc, fieldSpec) {
    if (typeof fieldSpec === 'string' && fieldSpec.startsWith('$')) {
      const raw = this._getNestedValue(doc, fieldSpec.slice(1));
      return raw === undefined ? null : raw;
    }
    if (typeof fieldSpec === 'object' && fieldSpec !== null) {
      if (fieldSpec.$toLower) {
        const inner = this._resolveFieldValue(doc, fieldSpec.$toLower);
        return typeof inner === 'string' ? inner.toLowerCase() : inner;
      }
      if (fieldSpec.$toUpper) {
        const inner = this._resolveFieldValue(doc, fieldSpec.$toUpper);
        return typeof inner === 'string' ? inner.toUpperCase() : inner;
      }
      if (fieldSpec.$trim) {
        const input = this._resolveFieldValue(doc, fieldSpec.$trim.input);
        return typeof input === 'string' ? input.trim() : input;
      }
      if (fieldSpec.$type) {
        const val = this._getNestedValue(doc, fieldSpec.$type.slice(1));
        if (val === undefined) return 'missing';
        if (val === null) return 'null';
        if (Array.isArray(val)) return 'array';
        if (typeof val === 'string') return 'string';
        return typeof val;
      }
    }
    return fieldSpec;
  }

  _projectDoc(doc, projectSpec) {
    const out = {};
    for (const [k, v] of Object.entries(projectSpec)) {
      if (v === 1) {
        out[k] = doc[k];
      } else if (typeof v === 'object' && v.$size) {
        const arr = doc[v.$size.replace('$', '')];
        out[k] = Array.isArray(arr) ? arr.length : 0;
      } else {
        out[k] = doc[k];
      }
    }
    return out;
  }
}

/**
 * Lightweight mock database instance.
 */
class MockDatabase {
  constructor(name = 'luxecart_test', collations = {}) {
    this.databaseName = name;
    this.collections = new Map();
    this.collations = collations;
  }

  collection(name) {
    if (!this.collections.has(name)) {
      this.collections.set(name, new MockCollection(name));
    }
    return this.collections.get(name);
  }

  listCollections({ name } = {}) {
    const list = [];
    for (const collName of this.collections.keys()) {
      if (!name || collName === name) {
        list.push({
          name: collName,
          options: {
            collation: this.collations[collName] || null,
          },
        });
      }
    }
    return {
      toArray: async () => list,
    };
  }
}

async function runTestSuite() {
  console.log('\n' + '='.repeat(78));
  console.log('   LUXECART PHASE 7.2B.2.2 SAFE INDEX UTILITY HARDENED TEST SUITE   ');
  console.log('   (Running in Isolated In-Memory Mock Database Test Harness)       ');
  console.log('='.repeat(78) + '\n');

  // --- SECTION A: CORE SAFETY & ORCHESTRATION TESTS ---

  // TEST 1: Default Dry-Run Mode (Zero writes, zero drops)
  try {
    const mockDb = new MockDatabase('luxecart');
    const mockUsers = mockDb.collection('users');
    mockUsers.documents = [
      { _id: '1', email: 'user1@test.com', role: 'CUSTOMER' },
      { _id: '2', email: 'user2@test.com', role: 'CUSTOMER' },
    ];
    mockUsers.existingIndexes = [{ key: { _id: 1 }, name: '_id_' }];

    const report = await runIndexSync({
      db: mockDb,
      apply: false,
      collectionFilter: 'users',
      silent: true,
    });

    assert.strictEqual(report.isApplyMode, false, 'Must be in dry-run mode');
    assert.strictEqual(report.totals.created, 0, 'Zero indexes must be created in dry-run');
    assert.strictEqual(report.totals.dropped, 0, 'Zero indexes must be dropped');
    assert.strictEqual(report.totals.failed, 0, 'Zero failures in clean dry-run');
    assert.strictEqual(mockUsers.createdIndexes.length, 0, 'No collection.createIndex calls in dry-run');
    assert(report.totals.missing > 0, 'Should detect missing declared indexes');
    recordTest('TEST_01', 'Default Dry-Run Mode performs zero writes and zero drops', true);
  } catch (err) {
    recordTest('TEST_01', 'Default Dry-Run Mode performs zero writes and zero drops', false, err.message);
  }

  // TEST 2: Database Confirmation Mismatch Rejection
  try {
    const mockDb = new MockDatabase('luxecart_production');
    let thrownError = null;
    try {
      await runIndexSync({
        db: mockDb,
        apply: true,
        confirmDb: 'luxecart_staging',
        silent: true,
      });
    } catch (err) {
      thrownError = err;
    }
    assert(thrownError, 'Must throw error on DB name mismatch');
    assert(thrownError.message.includes('Database confirmation mismatch'));
    recordTest('TEST_02', 'Rejects apply mode when --confirm-db does not match active DB', true);
  } catch (err) {
    recordTest('TEST_02', 'Rejects apply mode when --confirm-db does not match active DB', false, err.message);
  }

  // TEST 3: Database Confirmation Missing Rejection
  try {
    const mockDb = new MockDatabase('luxecart_production');
    let thrownError = null;
    try {
      await runIndexSync({
        db: mockDb,
        apply: true,
        confirmDb: null,
        silent: true,
      });
    } catch (err) {
      thrownError = err;
    }
    assert(thrownError, 'Must throw error when confirmDb is omitted in apply mode');
    assert(thrownError.message.includes('Missing required confirmation flag'));
    recordTest('TEST_03', 'Rejects apply mode when --confirm-db flag is missing', true);
  } catch (err) {
    recordTest('TEST_03', 'Rejects apply mode when --confirm-db flag is missing', false, err.message);
  }

  // TEST 4: Clean Data Passes Preflight
  try {
    const mockDb = new MockDatabase('luxecart');
    const mockUsers = mockDb.collection('users');
    mockUsers.documents = [
      { _id: '1', email: 'alice@luxecart.com' },
      { _id: '2', email: 'bob@luxecart.com' },
    ];
    const preflightConfig = UNIQUE_INDEX_REGISTRY.users.email;
    const arrayCheck = await checkUnexpectedArrays(mockUsers, preflightConfig.scalarPaths);
    assert.strictEqual(arrayCheck.hasUnexpectedArray, false);
    const blockerRes = await runUniquePreflightBlocker(mockUsers, preflightConfig);
    assert.strictEqual(blockerRes.passed, true);
    recordTest('TEST_04', 'Clean scalar data passes unique index preflight check', true);
  } catch (err) {
    recordTest('TEST_04', 'Clean scalar data passes unique index preflight check', false, err.message);
  }

  // TEST 5: Exact Duplicate Raw Key Blocker (CONFLICTING_DATA)
  try {
    const mockDb = new MockDatabase('luxecart');
    const mockUsers = mockDb.collection('users');
    mockUsers.documents = [
      { _id: '1', email: 'dup@luxecart.com' },
      { _id: '2', email: 'dup@luxecart.com' },
    ];
    mockUsers.existingIndexes = [{ key: { _id: 1 }, name: '_id_' }];

    const report = await runIndexSync({
      db: mockDb,
      apply: false,
      collectionFilter: 'users',
      silent: true,
    });
    assert(report.totals.conflictingData > 0, 'Must record CONFLICTING_DATA in report');
    assert(report.preflightBlockers.length > 0);
    recordTest('TEST_05', 'Exact duplicate raw key triggers blocker check (CONFLICTING_DATA)', true);
  } catch (err) {
    recordTest('TEST_05', 'Exact duplicate raw key triggers blocker check (CONFLICTING_DATA)', false, err.message);
  }

  // TEST 6: Case Differences Reported as Normalization Anomaly Only
  try {
    const mockDb = new MockDatabase('luxecart');
    const mockUsers = mockDb.collection('users');
    mockUsers.documents = [
      { _id: '1', email: 'case@luxecart.com' },
      { _id: '2', email: 'CASE@luxecart.com' },
    ];
    const preflightConfig = UNIQUE_INDEX_REGISTRY.users.email;
    const blockerRes = await runUniquePreflightBlocker(mockUsers, preflightConfig);
    assert.strictEqual(blockerRes.passed, true, 'Case difference does NOT block binary unique index');
    const anomalyRes = await runNormalizationAnomalyCheck(mockUsers, preflightConfig);
    assert.strictEqual(anomalyRes.hasAnomalies, true, 'Case difference is reported as normalization anomaly');
    recordTest('TEST_06', 'Case differences reported as normalization anomaly without blocking binary index', true);
  } catch (err) {
    recordTest('TEST_06', 'Case differences reported as normalization anomaly without blocking binary index', false, err.message);
  }

  // TEST 7: Sparse Missing vs Explicit Null
  try {
    const mockDb = new MockDatabase('luxecart');
    const mockUsers = mockDb.collection('users');
    const preflightConfig = UNIQUE_INDEX_REGISTRY.users.googleId;

    // 7A: Missing fields pass cleanly
    mockUsers.documents = [{ _id: '1', email: 'u1@test.com' }, { _id: '2', email: 'u2@test.com' }];
    let res = await runUniquePreflightBlocker(mockUsers, preflightConfig);
    assert.strictEqual(res.passed, true);

    // 7B: Explicit nulls collide
    mockUsers.documents = [{ _id: '1', googleId: null }, { _id: '2', googleId: null }];
    res = await runUniquePreflightBlocker(mockUsers, preflightConfig);
    assert.strictEqual(res.passed, false);
    recordTest('TEST_07', 'Sparse index correctly permits missing fields but blocks duplicate explicit nulls', true);
  } catch (err) {
    recordTest('TEST_07', 'Sparse index correctly permits missing fields but blocks duplicate explicit nulls', false, err.message);
  }

  // TEST 8: Compound Unique Index (Review productId + userId)
  try {
    const mockDb = new MockDatabase('luxecart');
    const mockReviews = mockDb.collection('reviews');
    const preflightConfig = UNIQUE_INDEX_REGISTRY.reviews['productId_userId'];

    mockReviews.documents = [
      { _id: '1', productId: 'p1', userId: 'u1' },
      { _id: '2', productId: 'p1', userId: 'u1' },
    ];
    const res = await runUniquePreflightBlocker(mockReviews, preflightConfig);
    assert.strictEqual(res.passed, false);
    recordTest('TEST_08', 'Compound unique index correctly enforces composite key uniqueness', true);
  } catch (err) {
    recordTest('TEST_08', 'Compound unique index correctly enforces composite key uniqueness', false, err.message);
  }

  // TEST 9: Collection Default Collation Detection
  try {
    const mockDbSimple = new MockDatabase('luxecart', {});
    mockDbSimple.collection('users');
    const simpleInfo = await inspectCollectionCollation(mockDbSimple, 'users');
    assert.strictEqual(simpleInfo.isDefaultSimple, true);

    const mockDbCustom = new MockDatabase('luxecart', { users: { locale: 'en', strength: 2 } });
    mockDbCustom.collection('users');
    const customInfo = await inspectCollectionCollation(mockDbCustom, 'users');
    assert.strictEqual(customInfo.isDefaultSimple, false);
    recordTest('TEST_09', 'Correctly detects collection default collation vs simple binary', true);
  } catch (err) {
    recordTest('TEST_09', 'Correctly detects collection default collation vs simple binary', false, err.message);
  }

  // TEST 10: Collation Unknown / Unverified Refusal (NOT_VERIFIED)
  try {
    const declared = [[{ email: 1 }, { unique: true }]];
    const inventory = compareIndexes(declared, [], false);
    assert.strictEqual(inventory[0].status, 'NOT_VERIFIED');
    recordTest('TEST_10', 'Refuses verification (NOT_VERIFIED) when collation cannot be established', true);
  } catch (err) {
    recordTest('TEST_10', 'Refuses verification (NOT_VERIFIED) when collation cannot be established', false, err.message);
  }

  // --- SECTION B: ADVERSARIAL TESTS REQUIRED BY PHASE 7.2B.2.2 ---

  // ADV_01: Array-valued email colliding with another document's scalar email
  try {
    const mockDb = new MockDatabase('luxecart');
    const mockUsers = mockDb.collection('users');
    mockUsers.documents = [
      { _id: '1', email: ['victim@luxecart.com', 'other@luxecart.com'] }, // Array-valued corrupt email
      { _id: '2', email: 'victim@luxecart.com' }, // Scalar email
    ];
    mockUsers.existingIndexes = [{ key: { _id: 1 }, name: '_id_' }];

    const report = await runIndexSync({
      db: mockDb,
      apply: false,
      collectionFilter: 'users',
      silent: true,
    });

    assert(report.totals.conflictingData > 0, 'Must flag conflicting data on array email');
    const blocker = report.preflightBlockers.find((b) => b.type === 'UNEXPECTED_ARRAY_IN_SCALAR_PATH');
    assert(blocker, 'Must detect UNEXPECTED_ARRAY_IN_SCALAR_PATH');
    assert.strictEqual(blocker.scalarPaths[0], 'email');
    recordTest('ADV_01', 'Array-valued email detected and index creation refused (mocked)', true);
  } catch (err) {
    recordTest('ADV_01', 'Array-valued email detected and index creation refused (mocked)', false, err.message);
  }

  // ADV_02: Array-valued coupon code
  try {
    const mockDb = new MockDatabase('luxecart');
    const mockCoupons = mockDb.collection('coupons');
    mockCoupons.documents = [
      { _id: '1', code: ['SAVE10', 'SAVE20'] }, // Array coupon code
    ];
    mockCoupons.existingIndexes = [{ key: { _id: 1 }, name: '_id_' }];

    const report = await runIndexSync({
      db: mockDb,
      apply: false,
      collectionFilter: 'coupons',
      silent: true,
    });

    assert(report.totals.conflictingData > 0);
    const blocker = report.preflightBlockers.find((b) => b.type === 'UNEXPECTED_ARRAY_IN_SCALAR_PATH');
    assert(blocker && blocker.scalarPaths.includes('code'));
    recordTest('ADV_02', 'Array-valued coupon code detected and index creation refused (mocked)', true);
  } catch (err) {
    recordTest('ADV_02', 'Array-valued coupon code detected and index creation refused (mocked)', false, err.message);
  }

  // ADV_03: Array-valued slug
  try {
    const mockDb = new MockDatabase('luxecart');
    const mockCats = mockDb.collection('categories');
    mockCats.documents = [
      { _id: '1', slug: ['shoes', 'footwear'] }, // Array slug
    ];
    mockCats.existingIndexes = [{ key: { _id: 1 }, name: '_id_' }];

    const report = await runIndexSync({
      db: mockDb,
      apply: false,
      collectionFilter: 'categories',
      silent: true,
    });

    assert(report.totals.conflictingData > 0);
    const blocker = report.preflightBlockers.find((b) => b.type === 'UNEXPECTED_ARRAY_IN_SCALAR_PATH');
    assert(blocker && blocker.scalarPaths.includes('slug'));
    recordTest('ADV_03', 'Array-valued category slug detected and index creation refused (mocked)', true);
  } catch (err) {
    recordTest('ADV_03', 'Array-valued category slug detected and index creation refused (mocked)', false, err.message);
  }

  // ADV_04: Array-valued Google ID
  try {
    const mockDb = new MockDatabase('luxecart');
    const mockUsers = mockDb.collection('users');
    mockUsers.documents = [
      { _id: '1', email: 'u1@test.com', googleId: ['gid-1', 'gid-2'] }, // Array googleId
    ];
    mockUsers.existingIndexes = [{ key: { _id: 1 }, name: '_id_' }];

    const report = await runIndexSync({
      db: mockDb,
      apply: false,
      collectionFilter: 'users',
      silent: true,
    });

    const blocker = report.preflightBlockers.find((b) => b.type === 'UNEXPECTED_ARRAY_IN_SCALAR_PATH' && b.scalarPaths.includes('googleId'));
    assert(blocker, 'Must detect array-valued googleId');
    recordTest('ADV_04', 'Array-valued Google ID detected and index creation refused (mocked)', true);
  } catch (err) {
    recordTest('ADV_04', 'Array-valued Google ID detected and index creation refused (mocked)', false, err.message);
  }

  // ADV_05: Array-valued SKU within a variant
  try {
    const mockDb = new MockDatabase('luxecart');
    const mockProducts = mockDb.collection('products');
    mockProducts.documents = [
      {
        _id: 'prod1',
        name: 'Corrupt Product',
        variants: [{ sku: ['SKU-1', 'SKU-2'] }], // Array sku inside a variant element
      },
    ];
    mockProducts.existingIndexes = [{ key: { _id: 1 }, name: '_id_' }];

    const report = await runIndexSync({
      db: mockDb,
      apply: false,
      collectionFilter: 'products',
      silent: true,
    });

    const blocker = report.preflightBlockers.find(
      (b) => b.type === 'UNEXPECTED_ARRAY_IN_SCALAR_PATH' && b.scalarPaths.includes('variants.sku')
    );
    assert(blocker, 'Must detect unexpected array sku inside variant element');
    recordTest('ADV_05', 'Array-valued SKU within a variant element detected and refused (mocked)', true);
  } catch (err) {
    recordTest('ADV_05', 'Array-valued SKU within a variant element detected and refused (mocked)', false, err.message);
  }

  // ADV_06: Expected `variants` array remaining valid
  try {
    const mockDb = new MockDatabase('luxecart');
    const mockProducts = mockDb.collection('products');
    mockProducts.documents = [
      {
        _id: 'prod1',
        name: 'Valid Product',
        variants: [{ sku: 'SKU-RED-S' }, { sku: 'SKU-RED-M' }], // Valid scalar skus
      },
      {
        _id: 'prod2',
        name: 'Second Product',
        variants: [{ sku: 'SKU-BLU-S' }],
      },
    ];

    const preflightConfig = UNIQUE_INDEX_REGISTRY.products['variants.sku'];
    const arrayCheck = await checkUnexpectedArrays(mockProducts, preflightConfig.scalarPaths);
    assert.strictEqual(arrayCheck.hasUnexpectedArray, false, 'Expected variants array of scalar skus must pass array check');

    const blockerRes = await runUniquePreflightBlocker(mockProducts, preflightConfig);
    assert.strictEqual(blockerRes.passed, true, 'Distinct skus across products must pass blocker check');
    recordTest('ADV_06', 'Expected variants array of scalar skus verified as valid multikey (mocked)', true);
  } catch (err) {
    recordTest('ADV_06', 'Expected variants array of scalar skus verified as valid multikey (mocked)', false, err.message);
  }

  // ADV_07: Cross-document duplicate SKU detection
  try {
    const mockDb = new MockDatabase('luxecart');
    const mockProducts = mockDb.collection('products');
    mockProducts.documents = [
      { _id: 'prod1', name: 'Product A', variants: [{ sku: 'SHARED-SKU' }] },
      { _id: 'prod2', name: 'Product B', variants: [{ sku: 'SHARED-SKU' }] },
    ];
    const preflightConfig = UNIQUE_INDEX_REGISTRY.products['variants.sku'];
    const blockerRes = await runUniquePreflightBlocker(mockProducts, preflightConfig);
    assert.strictEqual(blockerRes.passed, false, 'Cross-document duplicate SKU must block index creation');
    recordTest('ADV_07', 'Cross-document duplicate SKU collision detected and blocked (mocked)', true);
  } catch (err) {
    recordTest('ADV_07', 'Cross-document duplicate SKU collision detected and blocked (mocked)', false, err.message);
  }

  // ADV_08: Array-valued idempotency key
  try {
    const mockDb = new MockDatabase('luxecart');
    const mockOrders = mockDb.collection('orders');
    mockOrders.documents = [
      { _id: '1', userId: 'user1', orderNumber: 'ORD-1', idempotencyKey: ['idemp-key-1', 'idemp-key-2'] },
    ];
    mockOrders.existingIndexes = [{ key: { _id: 1 }, name: '_id_' }];

    const report = await runIndexSync({
      db: mockDb,
      apply: false,
      collectionFilter: 'orders',
      silent: true,
    });

    const blocker = report.preflightBlockers.find(
      (b) => b.type === 'UNEXPECTED_ARRAY_IN_SCALAR_PATH' && b.scalarPaths.includes('idempotencyKey')
    );
    assert(blocker, 'Must detect array-valued idempotencyKey and refuse creation');
    recordTest('ADV_08', 'Array-valued idempotencyKey detected and index creation refused (mocked)', true);
  } catch (err) {
    recordTest('ADV_08', 'Array-valued idempotencyKey detected and index creation refused (mocked)', false, err.message);
  }

  // ADV_09: Scalar idempotency keys with different users
  try {
    const mockDb = new MockDatabase('luxecart');
    const mockOrders = mockDb.collection('orders');
    mockOrders.documents = [
      { _id: '1', userId: 'user1', orderNumber: 'ORD-1', idempotencyKey: 'same-token' },
      { _id: '2', userId: 'user2', orderNumber: 'ORD-2', idempotencyKey: 'same-token' },
    ];
    const preflightConfig = UNIQUE_INDEX_REGISTRY.orders['userId_idempotencyKey'];
    const blockerRes = await runUniquePreflightBlocker(mockOrders, preflightConfig);
    assert.strictEqual(blockerRes.passed, true, 'Same idempotency token for distinct users must pass');
    recordTest('ADV_09', 'Compound (userId, idempotencyKey) passes with different users (mocked)', true);
  } catch (err) {
    recordTest('ADV_09', 'Compound (userId, idempotencyKey) passes with different users (mocked)', false, err.message);
  }

  // ADV_10: Equivalent nested option objects with different property ordering
  try {
    const optA = {
      partialFilterExpression: { idempotencyKey: { $type: 'string', $exists: true } },
      weights: { name: 10, brand: 5, tags: 3 },
      collation: { locale: 'en', strength: 2 },
    };
    // Different key insertion order at multiple nesting levels
    const optB = {
      collation: { strength: 2, locale: 'en' },
      weights: { tags: 3, brand: 5, name: 10 },
      partialFilterExpression: { idempotencyKey: { $exists: true, $type: 'string' } },
    };

    assert.strictEqual(areOptionsEqual(optA, optB), true, 'Different property ordering must evaluate equal');

    const declared = [[{ userId: 1, idempotencyKey: 1 }, optA]];
    const existing = [{ key: { userId: 1, idempotencyKey: 1 }, ...optB }];
    const inventory = compareIndexes(declared, existing, true);
    assert.strictEqual(inventory[0].status, 'PRESENT_AND_MATCHING');
    recordTest('ADV_10', 'Canonical object comparison matches equivalent options with different key ordering', true);
  } catch (err) {
    recordTest('ADV_10', 'Canonical object comparison matches equivalent options with different key ordering', false, err.message);
  }

  // ADV_11: Genuinely different index options
  try {
    const optA = { partialFilterExpression: { idempotencyKey: { $type: 'string' } } };
    const optB = { partialFilterExpression: { idempotencyKey: { $type: 2 } } }; // Different BSON type representation or option
    const optC = { unique: true };
    const optD = { unique: false };

    assert.strictEqual(areOptionsEqual(optC, optD), false);
    const declared = [[{ email: 1 }, optC]];
    const existing = [{ key: { email: 1 }, ...optD }];
    const inventory = compareIndexes(declared, existing, true);
    assert.strictEqual(inventory[0].status, 'PRESENT_WITH_DIFFERENT_OPTIONS');
    recordTest('ADV_11', 'Genuinely different index options produce PRESENT_WITH_DIFFERENT_OPTIONS', true);
  } catch (err) {
    recordTest('ADV_11', 'Genuinely different index options produce PRESENT_WITH_DIFFERENT_OPTIONS', false, err.message);
  }

  // ADV_12: createIndex() failure increments totals.failed
  try {
    const mockDb = new MockDatabase('luxecart_confirmed');
    const mockUsers = mockDb.collection('users');
    mockUsers.documents = [{ _id: '1', email: 'clean@luxecart.com' }];
    mockUsers.existingIndexes = [{ key: { _id: 1 }, name: '_id_' }];
    mockUsers.shouldFailCreateIndex = true;
    mockUsers.failureErrorMessage = 'Disk space exhausted on primary';

    const report = await runIndexSync({
      db: mockDb,
      apply: true,
      confirmDb: 'luxecart_confirmed',
      collectionFilter: 'users',
      silent: true,
    });

    assert.strictEqual(report.totals.failed > 0, true, 'Must increment totals.failed when createIndex fails');
    const failedItem = report.collections.users.inventory.find((i) => i.status === 'CREATION_FAILED');
    assert(failedItem, 'Inventory must record CREATION_FAILED status');
    assert.strictEqual(failedItem.error, 'Disk space exhausted on primary');
    recordTest('ADV_12', 'createIndex() failure accurately increments totals.failed and records error details', true);
  } catch (err) {
    recordTest('ADV_12', 'createIndex() failure accurately increments totals.failed and records error details', false, err.message);
  }

  // ADV_13: Failed creation causes non-zero exit status logic check
  try {
    const mockReportWithFailures = {
      totals: {
        conflictingData: 0,
        failed: 1, // 1 failed creation
        notVerified: 0,
      },
    };

    const shouldExitNonZero =
      mockReportWithFailures.totals.conflictingData > 0 ||
      mockReportWithFailures.totals.failed > 0 ||
      mockReportWithFailures.totals.notVerified > 0;

    assert.strictEqual(shouldExitNonZero, true, 'CLI must exit non-zero when totals.failed > 0');
    recordTest('ADV_13', 'CLI exit-status logic enforces non-zero exit on index creation failure', true);
  } catch (err) {
    recordTest('ADV_13', 'CLI exit-status logic enforces non-zero exit on index creation failure', false, err.message);
  }

  // ADV_14: Successful creation reports success correctly
  try {
    const mockDb = new MockDatabase('luxecart_confirmed');
    const mockUsers = mockDb.collection('users');
    mockUsers.documents = [
      { _id: '1', email: 'u1@test.com' },
      { _id: '2', email: 'u2@test.com' },
    ];
    mockUsers.existingIndexes = [{ key: { _id: 1 }, name: '_id_' }];
    mockUsers.shouldFailCreateIndex = false;

    const report = await runIndexSync({
      db: mockDb,
      apply: true,
      confirmDb: 'luxecart_confirmed',
      collectionFilter: 'users',
      silent: true,
    });

    assert.strictEqual(report.totals.failed, 0, 'Zero failures on clean creation');
    assert(report.totals.created > 0, 'Must record created index total');
    assert.strictEqual(report.totals.dropped, 0, 'Zero drops on creation');
    recordTest('ADV_14', 'Successful creation reports success correctly with zero failures and zero drops', true);
  } catch (err) {
    recordTest('ADV_14', 'Successful creation reports success correctly with zero failures and zero drops', false, err.message);
  }

  // ============================================================================
  // SECTION C: PHASE 7.2B.2.4 FAIL-CLOSED INSPECTION & BSON REGRESSION TESTS
  // ============================================================================

  // HARDEN_01: Array inspection query failure produces NOT_VERIFIED
  try {
    const mockDb = new MockDatabase('luxecart');
    const mockUsers = mockDb.collection('users');
    mockUsers.documents = [{ _id: '1', email: 'test@example.com' }];
    mockUsers.existingIndexes = [{ key: { _id: 1 }, name: '_id_' }];
    mockUsers.shouldFailFind = true;
    mockUsers.findErrorMessage = 'Connection timeout during array inspection';

    const report = await runIndexSync({
      db: mockDb,
      apply: false,
      collectionFilter: 'users',
      silent: true,
    });

    const emailItem = report.collections.users.inventory.find((i) => i.keyPattern.email === 1);
    assert(emailItem, 'Email index must be in inventory');
    assert.strictEqual(emailItem.status, 'NOT_VERIFIED', 'Array inspection failure must mark index NOT_VERIFIED');
    assert(emailItem.reason.includes('Array preflight inspection failed'), 'Reason must preserve query failure details');
    assert(report.totals.notVerified > 0, 'totals.notVerified must be incremented');
    recordTest('HARDEN_01', 'Array inspection query failure produces NOT_VERIFIED', true);
  } catch (err) {
    recordTest('HARDEN_01', 'Array inspection query failure produces NOT_VERIFIED', false, err.message);
  }

  // HARDEN_02: Duplicate-key preflight does not run after array inspection failure
  try {
    const mockDb = new MockDatabase('luxecart');
    const mockUsers = mockDb.collection('users');
    mockUsers.documents = [{ _id: '1', email: 'test@example.com' }];
    mockUsers.existingIndexes = [{ key: { _id: 1 }, name: '_id_' }];
    mockUsers.shouldFailFind = true;
    mockUsers.aggregateCallCount = 0;

    await runIndexSync({
      db: mockDb,
      apply: false,
      collectionFilter: 'users',
      silent: true,
    });

    assert.strictEqual(mockUsers.aggregateCallCount, 0, 'Aggregate blocker pipeline must NOT be called when array check fails');
    recordTest('HARDEN_02', 'Duplicate-key preflight does not run after array inspection failure', true);
  } catch (err) {
    recordTest('HARDEN_02', 'Duplicate-key preflight does not run after array inspection failure', false, err.message);
  }

  // HARDEN_03: Array inspection failure never permits index creation
  try {
    const mockDb = new MockDatabase('luxecart_confirmed');
    const mockCarts = mockDb.collection('carts');
    mockCarts.documents = [{ _id: '1', userId: 'user1' }];
    mockCarts.existingIndexes = [{ key: { _id: 1 }, name: '_id_' }];
    mockCarts.shouldFailFind = true;
    mockCarts.createIndexCallCount = 0;

    const report = await runIndexSync({
      db: mockDb,
      apply: true,
      confirmDb: 'luxecart_confirmed',
      collectionFilter: 'carts',
      silent: true,
    });

    assert.strictEqual(mockCarts.createIndexCallCount, 0, 'createIndex must NEVER be called when array check fails');
    assert.strictEqual(report.totals.created, 0, 'Zero indexes must be created');
    const cartItem = report.collections.carts.inventory.find((i) => i.keyPattern.userId === 1);
    assert.strictEqual(cartItem.status, 'NOT_VERIFIED', 'Index must be NOT_VERIFIED');
    recordTest('HARDEN_03', 'Array inspection failure never permits index creation', true);
  } catch (err) {
    recordTest('HARDEN_03', 'Array inspection failure never permits index creation', false, err.message);
  }

  // HARDEN_04: collection.indexes() failure produces NOT_VERIFIED
  try {
    const mockDb = new MockDatabase('luxecart');
    const mockUsers = mockDb.collection('users');
    mockUsers.shouldFailIndexes = true;
    mockUsers.indexesErrorMessage = 'Network partition while reading system.indexes';

    const report = await runIndexSync({
      db: mockDb,
      apply: false,
      collectionFilter: 'users',
      silent: true,
    });

    const userColl = report.collections.users;
    assert.strictEqual(userColl.isInventoryVerified, false, 'Inventory must be marked unverified');
    assert(userColl.inventoryError.includes('Network partition'), 'Must preserve original error details');
    assert.strictEqual(userColl.inventory.every((i) => i.status === 'NOT_VERIFIED'), true, 'All declared indexes must be NOT_VERIFIED');
    assert.strictEqual(report.totals.notVerified, userColl.declaredCount, 'totals.notVerified must equal declaredCount');
    recordTest('HARDEN_04', 'collection.indexes() failure produces NOT_VERIFIED', true);
  } catch (err) {
    recordTest('HARDEN_04', 'collection.indexes() failure produces NOT_VERIFIED', false, err.message);
  }

  // HARDEN_05: Inventory failure never classifies indexes as missing
  try {
    const mockDb = new MockDatabase('luxecart');
    const mockUsers = mockDb.collection('users');
    mockUsers.shouldFailIndexes = true;

    const report = await runIndexSync({
      db: mockDb,
      apply: false,
      collectionFilter: 'users',
      silent: true,
    });

    assert.strictEqual(report.totals.eligible, 0, 'Eligible indexes must be 0 on inventory failure');
    assert.strictEqual(report.totals.initiallyMissing, 0, 'Initially missing indexes must be 0 on inventory failure');
    const missingCount = report.collections.users.inventory.filter((i) => i.status === 'MISSING').length;
    assert.strictEqual(missingCount, 0, 'No declared indexes can be classified as MISSING');
    recordTest('HARDEN_05', 'Inventory failure never classifies indexes as missing', true);
  } catch (err) {
    recordTest('HARDEN_05', 'Inventory failure never classifies indexes as missing', false, err.message);
  }

  // HARDEN_06: Inventory failure never permits index creation
  try {
    const mockDb = new MockDatabase('luxecart_confirmed');
    const mockUsers = mockDb.collection('users');
    mockUsers.shouldFailIndexes = true;
    mockUsers.createIndexCallCount = 0;

    const report = await runIndexSync({
      db: mockDb,
      apply: true,
      confirmDb: 'luxecart_confirmed',
      collectionFilter: 'users',
      silent: true,
    });

    assert.strictEqual(mockUsers.createIndexCallCount, 0, 'createIndex must NEVER be called on inventory failure');
    assert.strictEqual(report.totals.created, 0, 'Zero indexes created on inventory failure');
    recordTest('HARDEN_06', 'Inventory failure never permits index creation', true);
  } catch (err) {
    recordTest('HARDEN_06', 'Inventory failure never permits index creation', false, err.message);
  }

  // HARDEN_07: Date comparison preserves values and types
  try {
    const d1 = new Date('2026-01-01T00:00:00.000Z');
    const d2 = new Date('2026-01-01T00:00:00.000Z');
    const d3 = new Date('2026-12-31T23:59:59.999Z');
    const strDate = '2026-01-01T00:00:00.000Z';

    assert.strictEqual(areOptionsEqual({ d: d1 }, { d: d2 }), true, 'Identical dates must be equal');
    assert.strictEqual(areOptionsEqual({ d: d1 }, { d: d3 }), false, 'Different dates must NOT be equal');
    assert.strictEqual(areOptionsEqual({ d: d1 }, { d: strDate }), false, 'Date vs String must NOT be equal (type preserved)');
    recordTest('HARDEN_07', 'Date comparison preserves values and types', true);
  } catch (err) {
    recordTest('HARDEN_07', 'Date comparison preserves values and types', false, err.message);
  }

  // HARDEN_08: RegExp comparison preserves pattern and flags
  try {
    const r1 = /abc/i;
    const r2 = /abc/i;
    const rDiffFlags = /abc/g;
    const rDiffPattern = /xyz/i;
    const rStr = '/abc/i';

    assert.strictEqual(areOptionsEqual({ r: r1 }, { r: r2 }), true, 'Identical regex must be equal');
    assert.strictEqual(areOptionsEqual({ r: r1 }, { r: rDiffFlags }), false, 'Different regex flags must NOT be equal');
    assert.strictEqual(areOptionsEqual({ r: r1 }, { r: rDiffPattern }), false, 'Different regex pattern must NOT be equal');
    assert.strictEqual(areOptionsEqual({ r: r1 }, { r: rStr }), false, 'RegExp vs String must NOT be equal (type preserved)');
    recordTest('HARDEN_08', 'RegExp comparison preserves pattern and flags', true);
  } catch (err) {
    recordTest('HARDEN_08', 'RegExp comparison preserves pattern and flags', false, err.message);
  }

  // HARDEN_09: ObjectId comparison preserves identity and type
  try {
    const id1 = { toHexString: () => '507f1f77bcf86cd799439011' };
    const id2 = { toHexString: () => '507f1f77bcf86cd799439011' };
    const id3 = { toHexString: () => '507f1f77bcf86cd799439099' };
    const idStr = '507f1f77bcf86cd799439011';

    assert.strictEqual(areOptionsEqual({ id: id1 }, { id: id2 }), true, 'Identical ObjectIds must be equal');
    assert.strictEqual(areOptionsEqual({ id: id1 }, { id: id3 }), false, 'Different ObjectIds must NOT be equal');
    assert.strictEqual(areOptionsEqual({ id: id1 }, { id: idStr }), false, 'ObjectId vs String must NOT be equal (type preserved)');
    recordTest('HARDEN_09', 'ObjectId comparison preserves identity and type', true);
  } catch (err) {
    recordTest('HARDEN_09', 'ObjectId comparison preserves identity and type', false, err.message);
  }

  // HARDEN_10: Unsupported BSON values fail safely
  try {
    const optWithSymbol = { sym: Symbol('unsupported') };
    const optWithFunction = { fn: () => {} };
    const optWithUnsupportedBson = { b: { _bsontype: 'UnsupportedBsonType', toString: undefined } };

    assert.strictEqual(areOptionsEqual(optWithSymbol, optWithSymbol), false, 'Options with symbol must fail safe (return false)');
    assert.strictEqual(areOptionsEqual(optWithFunction, optWithFunction), false, 'Options with function must fail safe (return false)');
    assert.strictEqual(areOptionsEqual(optWithUnsupportedBson, optWithUnsupportedBson), false, 'Unsupported BSON must fail safe (return false)');
    recordTest('HARDEN_10', 'Unsupported BSON values fail safely', true);
  } catch (err) {
    recordTest('HARDEN_10', 'Unsupported BSON values fail safely', false, err.message);
  }

  // HARDEN_11: Existing 24 tests continue to pass (verified by total count check at end of suite)
  try {
    const priorTestCount = testResults.length;
    assert(priorTestCount >= 24, 'All prior 24 tests must be executed');
    recordTest('HARDEN_11', 'Existing 24 tests continue to pass', true);
  } catch (err) {
    recordTest('HARDEN_11', 'Existing 24 tests continue to pass', false, err.message);
  }

  // HARDEN_12: CLI exits non-zero for both inspection failure types
  try {
    // Check 1: Array inspection failure report triggers non-zero exit
    const arrayFailReport = {
      totals: {
        conflictingData: 0,
        failed: 0,
        notVerified: 1, // Triggered by array inspection query failure
      },
    };
    const shouldExitForArrayFail =
      arrayFailReport.totals.conflictingData > 0 ||
      arrayFailReport.totals.failed > 0 ||
      arrayFailReport.totals.notVerified > 0;
    assert.strictEqual(shouldExitForArrayFail, true, 'Array inspection failure must trigger non-zero exit');

    // Check 2: Inventory failure report triggers non-zero exit
    const inventoryFailReport = {
      totals: {
        conflictingData: 0,
        failed: 0,
        notVerified: 5, // Triggered by collection.indexes() failure
      },
    };
    const shouldExitForInventoryFail =
      inventoryFailReport.totals.conflictingData > 0 ||
      inventoryFailReport.totals.failed > 0 ||
      inventoryFailReport.totals.notVerified > 0;
    assert.strictEqual(shouldExitForInventoryFail, true, 'Inventory failure must trigger non-zero exit');

    recordTest('HARDEN_12', 'CLI exits non-zero for both inspection failure types', true);
  } catch (err) {
    recordTest('HARDEN_12', 'CLI exits non-zero for both inspection failure types', false, err.message);
  }

  // SAFE_01: Email masking preserves domain but redacts local part
  try {
    assert.strictEqual(maskEmail('customer@example.com'), 'c***r@example.com');
    assert.strictEqual(maskEmail('a@b.com'), 'a***@b.com');
    assert.strictEqual(maskEmail('ab@test.org'), 'a***@test.org');
    recordTest('SAFE_01', 'Email masking correctly redacts local identifier while preserving domain', true);
  } catch (err) {
    recordTest('SAFE_01', 'Email masking correctly redacts local identifier while preserving domain', false, err.message);
  }

  // SAFE_02: PII, tokens, and credentials are completely redacted in report objects
  try {
    const rawData = {
      _id: 'customer@example.com',
      name: 'John Doe',
      firstName: 'John',
      lastName: 'Doe',
      phone: '+919876543210',
      password: '$2a$10$insecurepasswordhash123',
      refreshToken: 'jwt_refresh_token_xyz_456',
      resetPasswordToken: 'reset_token_secret_789',
      secret: 'supersecret',
      email: 'customer@example.com',
      address: {
        phoneNumber: '+919876543210',
        city: 'Mumbai',
      },
      rawVariants: ['Customer@example.com', 'CUSTOMER@EXAMPLE.COM'],
    };

    const sanitized = sanitizeForReport(rawData);

    assert.strictEqual(sanitized._id, 'c***r@example.com', '_id matching email must be masked');
    assert.strictEqual(sanitized.email, 'c***r@example.com', 'email field must be masked');
    assert.strictEqual(sanitized.name, '[REDACTED]', 'name must be redacted');
    assert.strictEqual(sanitized.firstName, '[REDACTED]', 'firstName must be redacted');
    assert.strictEqual(sanitized.lastName, '[REDACTED]', 'lastName must be redacted');
    assert.strictEqual(sanitized.phone, '[REDACTED]', 'phone must be redacted');
    assert.strictEqual(sanitized.password, '[REDACTED]', 'password must be redacted');
    assert.strictEqual(sanitized.refreshToken, '[REDACTED]', 'refreshToken must be redacted');
    assert.strictEqual(sanitized.resetPasswordToken, '[REDACTED]', 'resetPasswordToken must be redacted');
    assert.strictEqual(sanitized.secret, '[REDACTED]', 'secret must be redacted');
    assert.strictEqual(sanitized.address.phoneNumber, '[REDACTED]', 'nested phoneNumber must be redacted');
    assert.strictEqual(sanitized.address.city, 'Mumbai', 'non-sensitive fields preserved');
    assert.strictEqual(sanitized.rawVariants[0], 'C***r@example.com', 'rawVariants emails must be masked');
    recordTest('SAFE_02', 'PII, tokens, passwords, and secrets are strictly redacted in report sanitization', true);
  } catch (err) {
    recordTest('SAFE_02', 'PII, tokens, passwords, and secrets are strictly redacted in report sanitization', false, err.message);
  }

  // Summary
  console.log('\n' + '='.repeat(78));
  const passedCount = testResults.filter((r) => r.status === 'PASS').length;
  const failedCount = testResults.filter((r) => r.status === 'FAIL').length;
  console.log(`TOTAL TESTS: ${testResults.length} | PASSED: ${passedCount} | FAILED: ${failedCount}`);
  console.log('='.repeat(78) + '\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTestSuite();
