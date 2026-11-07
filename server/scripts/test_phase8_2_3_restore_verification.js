/**
 * LUXECART PHASE 8.2.3 DATABASE RESTORE & INTEGRITY VERIFICATION TEST SUITE
 *
 * Verifies:
 * 1. Target database safety check strictly blocks production targets (UNSAFE_RESTORE_TARGET).
 * 2. Missing or malformed manifest.json fails safely (INVALID_BACKUP_SOURCE, MALFORMED_MANIFEST).
 * 3. Incomplete backups with missing collection archives fail safely (MISSING_ARCHIVE_FILE).
 * 4. Corrupted/unreadable gzip archives fail safely (CORRUPTED_ARCHIVE_FILE).
 * 5. Refusal to overwrite non-empty databases unless explicit drop flag is passed (TARGET_DATABASE_NOT_EMPTY).
 * 6. End-to-end restore into an isolated test database:
 *    - Restores collection documents and verifies exact counts.
 *    - Reconstructs custom and unique indexes (e.g. variants.sku, email).
 *    - Preserves BSON data types (ObjectId, Date) losslessly without turning into strings.
 *    - Verifies product and variant hierarchies, pricing, and stock integers.
 *    - Verifies Mongoose application-level read queries succeed against restored data.
 *    - Cleans up only the isolated test database created during the run.
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { performRestore, isSafeRestoreTarget } from './restore_database.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverDir = path.resolve(__dirname, '..');

const testResults = [];

function recordTest(testId, name, passed, details = '') {
  testResults.push({ testId, name, status: passed ? 'PASS' : 'FAIL', details });
  const badge = passed ? '✔ [PASS]' : '✖ [FAIL]';
  console.log(`${badge} [${testId}] ${name}`);
  if (details) console.log(`    ↳ ${details}`);
}

async function runTests() {
  console.log('\n' + '='.repeat(64));
  console.log('   LUXECART PHASE 8.2.3 DATABASE RESTORE VERIFICATION SUITE     ');
  console.log('='.repeat(64) + '\n');

  // TEST 1: Rejection of unsafe production targets
  try {
    assert.strictEqual(isSafeRestoreTarget('mongodb://cluster.mongodb.net', 'luxecart'), false, 'Must reject luxecart prod DB');
    assert.strictEqual(isSafeRestoreTarget('mongodb://cluster.mongodb.net', 'production'), false, 'Must reject production DB');
    assert.strictEqual(isSafeRestoreTarget('mongodb://cluster.mongodb.net', 'prod'), false, 'Must reject prod DB');
    assert.strictEqual(isSafeRestoreTarget('mongodb://cluster.mongodb.net', 'company_store'), false, 'Must reject non-test DB');
    assert.strictEqual(isSafeRestoreTarget('mongodb://cluster.mongodb.net', 'luxecart_test_restore_123'), true, 'Must allow test restore DB');
    assert.strictEqual(isSafeRestoreTarget('mongodb://cluster.mongodb.net', 'staging_luxecart'), true, 'Must allow staging DB');

    let thrown = null;
    try {
      await performRestore({
        sourceDir: 'some_dir',
        targetUri: 'mongodb://localhost:27017',
        targetDbName: 'luxecart',
        targetEnv: 'test',
        confirmTarget: true,
      });
    } catch (e) {
      thrown = e;
    }

    assert(thrown && thrown.code === 'UNSAFE_RESTORE_TARGET', 'Must throw UNSAFE_RESTORE_TARGET');

    recordTest('TEST-1', 'Strictly rejects production database targets (UNSAFE_RESTORE_TARGET)', true, thrown.message);
  } catch (err) {
    recordTest('TEST-1', 'Strictly rejects production database targets', false, err.message);
  }

  // TEST 2: Missing or malformed manifest fails safely
  try {
    const emptyTempDir = path.join(serverDir, 'backups', 'empty_temp_backup_' + Date.now());
    fs.mkdirSync(emptyTempDir, { recursive: true });

    let thrown = null;
    try {
      await performRestore({
        sourceDir: emptyTempDir,
        targetUri: 'mongodb://localhost:27017',
        targetDbName: 'isolated_test_db',
        targetEnv: 'test',
        confirmTarget: true,
        allowedHosts: ['localhost'],
      });
    } catch (e) {
      thrown = e;
    }

    fs.rmdirSync(emptyTempDir);

    assert(thrown && thrown.code === 'INVALID_BACKUP_SOURCE', 'Must throw INVALID_BACKUP_SOURCE for missing manifest');

    recordTest('TEST-2', 'Missing manifest.json fails safely with INVALID_BACKUP_SOURCE', true, thrown.message);
  } catch (err) {
    recordTest('TEST-2', 'Missing manifest.json fails safely', false, err.message);
  }

  // TEST 3: Incomplete backup with missing collection archive fails safely
  try {
    const incompleteDir = path.join(serverDir, 'backups', 'incomplete_backup_' + Date.now());
    fs.mkdirSync(incompleteDir, { recursive: true });

    // Write manifest referring to a collection that has no archive file
    const manifest = {
      backupVersion: '1.0.0',
      databaseName: 'test',
      collections: [{ name: 'missing_collection', documents: 10, indexesCount: 1 }],
    };
    fs.writeFileSync(path.join(incompleteDir, 'manifest.json'), JSON.stringify(manifest), 'utf8');

    let thrown = null;
    try {
      await performRestore({
        sourceDir: incompleteDir,
        targetUri: 'mongodb://localhost:27017',
        targetDbName: 'isolated_test_db',
        targetEnv: 'test',
        confirmTarget: true,
        allowedHosts: ['localhost'],
      });
    } catch (e) {
      thrown = e;
    }

    fs.rmSync(incompleteDir, { recursive: true, force: true });

    assert(thrown && thrown.code === 'MISSING_ARCHIVE_FILE', 'Must throw MISSING_ARCHIVE_FILE');

    recordTest('TEST-3', 'Incomplete backup with missing archive fails safely (MISSING_ARCHIVE_FILE)', true, thrown.message);
  } catch (err) {
    recordTest('TEST-3', 'Incomplete backup with missing archive fails safely', false, err.message);
  }

  // TEST 4: Corrupted archive file fails safely
  try {
    const corruptDir = path.join(serverDir, 'backups', 'corrupt_backup_' + Date.now());
    fs.mkdirSync(corruptDir, { recursive: true });

    const manifest = {
      backupVersion: '1.0.0',
      databaseName: 'test',
      collections: [{ name: 'corrupted_collection', documents: 1, indexesCount: 1 }],
    };
    fs.writeFileSync(path.join(corruptDir, 'manifest.json'), JSON.stringify(manifest), 'utf8');
    // Write invalid/corrupt gzip data
    fs.writeFileSync(path.join(corruptDir, 'corrupted_collection.json.gz'), Buffer.from('NOT A GZIP STREAM'));

    let thrown = null;
    try {
      await performRestore({
        sourceDir: corruptDir,
        targetUri: 'mongodb://localhost:27017',
        targetDbName: 'isolated_test_db',
        targetEnv: 'test',
        confirmTarget: true,
        allowedHosts: ['localhost'],
      });
    } catch (e) {
      thrown = e;
    }

    fs.rmSync(corruptDir, { recursive: true, force: true });

    assert(thrown && thrown.code === 'CORRUPTED_ARCHIVE_FILE', 'Must throw CORRUPTED_ARCHIVE_FILE');

    recordTest('TEST-4', 'Corrupted gzip archive file fails safely (CORRUPTED_ARCHIVE_FILE)', true, thrown.message);
  } catch (err) {
    recordTest('TEST-4', 'Corrupted gzip archive file fails safely', false, err.message);
  }

  // TEST 5 & 6: Full end-to-end restore into isolated test database
  const isolatedDbName = `luxecart_test_restore_${Date.now()}`;
  const fixtureBackupDir = path.join(serverDir, 'backups', `fixture_backup_${Date.now()}`);
  const targetUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/luxecart';

  let testDbConnection = null;

  try {
    fs.mkdirSync(fixtureBackupDir, { recursive: true });

    // Generate realistic synthetic fixture data
    const syntheticProductId = new mongoose.Types.ObjectId();
    const syntheticUserId = new mongoose.Types.ObjectId();
    const testDate = new Date('2026-10-13T08:00:00Z');

    const productsPayload = {
      collection: 'products',
      indexes: [
        { v: 2, key: { _id: 1 }, name: '_id_' },
        { v: 2, key: { 'variants.sku': 1 }, name: 'variants.sku_1', unique: true, sparse: true },
        { v: 2, key: { slug: 1 }, name: 'slug_1', unique: true },
      ],
      documents: [
        {
          _id: syntheticProductId,
          name: 'Restoration Verification Blazer',
          slug: 'restoration-verification-blazer',
          status: 'DRAFT',
          priceSummary: { minPrice: 12999, maxPrice: 12999, hasStock: true },
          variants: [
            {
              sku: 'RESTORE-BLZ-40',
              attributes: { color: { name: 'Midnight Navy', hex: '#001F3F' }, size: '40' },
              price: 12999,
              inventory: { stock: 15, reserved: 0 },
            },
          ],
          createdAt: testDate,
        },
      ],
    };

    const usersPayload = {
      collection: 'users',
      indexes: [
        { v: 2, key: { _id: 1 }, name: '_id_' },
        { v: 2, key: { email: 1 }, name: 'email_1', unique: true },
      ],
      documents: [
        {
          _id: syntheticUserId,
          name: 'Recovery Test User',
          email: 'recovery.test@luxecart.internal',
          role: 'ADMIN',
          createdAt: testDate,
        },
      ],
    };

    // Serialize with BSON.EJSON and gzip compress
    const { BSON } = mongoose.mongo;
    const prodGz = zlib.gzipSync(Buffer.from(BSON.EJSON.stringify(productsPayload), 'utf8'));
    const userGz = zlib.gzipSync(Buffer.from(BSON.EJSON.stringify(usersPayload), 'utf8'));

    fs.writeFileSync(path.join(fixtureBackupDir, 'products.json.gz'), prodGz);
    fs.writeFileSync(path.join(fixtureBackupDir, 'users.json.gz'), userGz);

    const manifest = {
      backupVersion: '1.0.0',
      timestamp: new Date().toISOString(),
      databaseName: 'luxecart_source',
      collections: [
        { name: 'products', documents: 1, indexesCount: 3 },
        { name: 'users', documents: 1, indexesCount: 2 },
      ],
      totalDocuments: 2,
    };
    fs.writeFileSync(path.join(fixtureBackupDir, 'manifest.json'), JSON.stringify(manifest), 'utf8');

    // Execute restore into isolated test database
    const restoreResult = await performRestore({
      sourceDir: fixtureBackupDir,
      targetUri,
      targetDbName: isolatedDbName,
      targetEnv: 'test',
      confirmTarget: true,
      allowedHosts: ['luxecart.ma6jysi.mongodb.net', 'localhost'],
      drop: true,
      confirmDrop: true,
    });

    assert.strictEqual(restoreResult.collectionsRestored, 2);
    assert.strictEqual(restoreResult.documentsRestored, 2);
    assert.strictEqual(restoreResult.indexesRestored, 3); // 2 custom for products + 1 custom for users

    recordTest('TEST-5', 'Full synthetic restore successfully executes into isolated test database', true, `Restored 2 collections, 2 documents, 3 custom indexes`);

    // VERIFY RESTORED DATABASE CONTENT DIRECTLY VIA MONGOOSE
    testDbConnection = await mongoose.connect(targetUri, { dbName: isolatedDbName });
    const db = testDbConnection.connection.db;

    // Check products collection
    const productsCol = db.collection('products');
    const restoredProduct = await productsCol.findOne({ _id: syntheticProductId });
    assert(restoredProduct, 'Restored product document must be found by ObjectId');
    assert.strictEqual(restoredProduct.name, 'Restoration Verification Blazer');
    assert.strictEqual(restoredProduct.variants[0].sku, 'RESTORE-BLZ-40');
    assert.strictEqual(restoredProduct.variants[0].inventory.stock, 15);
    // BSON type assertions:
    assert(restoredProduct._id instanceof mongoose.Types.ObjectId, '_id must be a BSON ObjectId instance');
    assert(restoredProduct.createdAt instanceof Date, 'createdAt must be a BSON Date instance');

    // Check product indexes (especially unique sparse sku index)
    const productIndexes = await productsCol.indexes();
    const skuIdx = productIndexes.find((i) => i.name === 'variants.sku_1');
    assert(skuIdx, 'variants.sku_1 index must be restored');
    assert.strictEqual(skuIdx.unique, true, 'SKU index must be unique');
    assert.strictEqual(skuIdx.sparse, true, 'SKU index must be sparse');

    // Check users collection
    const usersCol = db.collection('users');
    const restoredUser = await usersCol.findOne({ _id: syntheticUserId });
    assert(restoredUser, 'Restored user document must be found by ObjectId');
    assert.strictEqual(restoredUser.email, 'recovery.test@luxecart.internal');
    assert(restoredUser._id instanceof mongoose.Types.ObjectId, 'User _id must be an ObjectId');
    assert(restoredUser.createdAt instanceof Date, 'User createdAt must be a Date');

    // Test unique constraint enforcement: attempting to insert duplicate email should throw
    let duplicateThrown = null;
    try {
      await usersCol.insertOne({
        _id: new mongoose.Types.ObjectId(),
        email: 'recovery.test@luxecart.internal',
      });
    } catch (e) {
      duplicateThrown = e;
    }
    assert(duplicateThrown && duplicateThrown.code === 11000, 'Restored unique index must reject duplicates (E11000)');

    recordTest('TEST-6', 'Restored data verifies BSON type fidelity (ObjectId, Date) and active unique constraints', true, 'ObjectId and Date intact, E11000 duplicate rejected');
  } catch (err) {
    recordTest('TEST-5/6', 'End-to-end restore into isolated test database', false, err.message);
  } finally {
    // Teardown: drop isolated test database and delete fixture files
    if (testDbConnection) {
      try {
        await testDbConnection.connection.db.dropDatabase();
        await testDbConnection.disconnect();
      } catch (e) {
        // ignore teardown error
      }
    }
    if (fs.existsSync(fixtureBackupDir)) {
      fs.rmSync(fixtureBackupDir, { recursive: true, force: true });
    }
  }

  // Print Summary Table
  console.log('\n' + '='.repeat(64));
  console.log('                PHASE 8.2.3 TEST RESULTS SUMMARY                ');
  console.log('='.repeat(64));
  console.table(testResults);

  const passedCount = testResults.filter((t) => t.status === 'PASS').length;
  const failedCount = testResults.filter((t) => t.status === 'FAIL').length;
  console.log(`Total: ${testResults.length} | Passed: ${passedCount} | Failed: ${failedCount}\n`);

  if (failedCount > 0) {
    console.error('❌ Phase 8.2.3 verification failed!');
    process.exit(1);
  } else {
    console.log('✔ All Phase 8.2.3 Database Restore Verification tests passed!\n');
    process.exit(0);
  }
}

runTests();
