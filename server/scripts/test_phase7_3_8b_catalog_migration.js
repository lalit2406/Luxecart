/**
 * LUXECART PHASE 7.3.8B: SAFE CATALOG MIGRATION SCRIPT TEST SUITE
 *
 * Isolated in-memory / mocked-connection tests for `migrate_catalog_to_staging.js`.
 * INVARIANT: ZERO LIVE CONNECTIONS TO MONGODB ATLAS OR CLOUDINARY.
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import {
  migrateCatalogToStaging,
  validateMigrationInputs,
  sanitizeLogMessage,
  REQUIRED_SOURCE_DB,
  REQUIRED_TARGET_DB,
  REQUIRED_ROOT_CATEGORY_SLUGS,
  REQUIRED_CHILD_CATEGORY_SLUGS,
  CURATED_PRODUCT_SLUGS,
} from './migrate_catalog_to_staging.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testResults = [];

function recordTest(testId, name, passed, details = '') {
  testResults.push({ testId, name, status: passed ? 'PASS' : 'FAIL', details });
  const badge = passed ? '✔ [PASS]' : '✖ [FAIL]';
  console.log(`${badge} [${testId}] ${name}`);
  if (!passed && details) {
    console.log(`    ↳ ${details}`);
  }
}

/**
 * Creates a full, valid source dataset (6 roots + 15 curated children + 12 active products)
 * plus optional extra category/non-curated records.
 */
function buildSourceFixtureData() {
  const oid = () => new mongoose.Types.ObjectId();

  const rootDefs = [
    { name: 'MEN', slug: 'men' },
    { name: 'WOMEN', slug: 'women' },
    { name: 'FOOTWEAR', slug: 'footwear' },
    { name: 'BEAUTY', slug: 'beauty' },
    { name: 'ACCESSORIES', slug: 'accessories' },
    { name: 'LIFESTYLE', slug: 'lifestyle' },
  ];

  const categories = [];
  const catBySlug = {};

  rootDefs.forEach((r, idx) => {
    const doc = {
      _id: oid(),
      name: r.name,
      slug: r.slug,
      description: `${r.name} root category`,
      parentId: null,
      ancestors: [],
      level: 0,
      displayOrder: idx + 1,
      isActive: true,
      isFeatured: true,
    };
    categories.push(doc);
    catBySlug[doc.slug] = doc;
  });

  const childDefs = [
    { name: 'Apparel', slug: 'mens-apparel', parentSlug: 'men', level: 1 },
    { name: 'T-Shirts', slug: 'mens-t-shirts', parentSlug: 'mens-apparel', level: 2 },
    { name: 'Shirts', slug: 'mens-shirts', parentSlug: 'mens-apparel', level: 2 },
    { name: 'Jeans', slug: 'mens-jeans', parentSlug: 'mens-apparel', level: 2 },
    { name: 'Apparel', slug: 'womens-apparel', parentSlug: 'women', level: 1 },
    { name: 'Dresses', slug: 'womens-dresses', parentSlug: 'womens-apparel', level: 2 },
    { name: 'Tops', slug: 'womens-tops', parentSlug: 'womens-apparel', level: 2 },
    { name: 'Kurta Sets', slug: 'womens-kurta-sets', parentSlug: 'womens-apparel', level: 2 },
    { name: 'Trousers', slug: 'womens-trousers', parentSlug: 'womens-apparel', level: 2 },
    { name: 'Sneakers', slug: 'sneakers', parentSlug: 'footwear', level: 1 },
    { name: 'Loafers', slug: 'loafers', parentSlug: 'footwear', level: 1 },
    { name: 'Skincare', slug: 'skincare', parentSlug: 'beauty', level: 1 },
    { name: 'Face Serum', slug: 'face-serum', parentSlug: 'skincare', level: 2 },
    { name: 'Bags', slug: 'bags', parentSlug: 'accessories', level: 1 },
    { name: 'Shoulder Bags', slug: 'shoulder-bags', parentSlug: 'bags', level: 2 },
  ];

  childDefs.forEach((c, idx) => {
    const parent = catBySlug[c.parentSlug];
    const doc = {
      _id: oid(),
      name: c.name,
      slug: c.slug,
      description: `${c.name} category`,
      parentId: parent._id,
      ancestors: [
        ...(parent.ancestors || []),
        { _id: parent._id, name: parent.name, slug: parent.slug },
      ],
      level: c.level,
      displayOrder: idx + 1,
      isActive: true,
      isFeatured: false,
    };
    categories.push(doc);
    catBySlug[doc.slug] = doc;
  });

  const slugToCategory = {
    'aurelio-essential-oversized-t-shirt': 'mens-t-shirts',
    'northline-oxford-casual-shirt': 'mens-shirts',
    'veyron-relaxed-linen-shirt': 'mens-shirts',
    'urban-form-straight-fit-denim': 'mens-jeans',
    'elane-satin-midi-dress': 'womens-dresses',
    'mirae-ribbed-knit-top': 'womens-tops',
    'nivara-printed-kurta-set': 'womens-kurta-sets',
    'velora-wide-leg-trousers': 'womens-trousers',
    'vanta-retro-runner-sneakers': 'sneakers',
    'stride-minimal-leather-loafers': 'loafers',
    'nivelle-vitamin-c-brightening-serum': 'face-serum',
    'aurelia-structured-shoulder-bag': 'shoulder-bags',
  };

  const products = CURATED_PRODUCT_SLUGS.map((slug, idx) => {
    const cat = catBySlug[slugToCategory[slug]];
    return {
      _id: oid(),
      name: `Curated Product ${idx + 1}`,
      slug,
      brand: `Brand ${idx + 1}`,
      description: `Detailed luxury description for ${slug}`,
      shortDescription: `Short summary for ${slug}`,
      category: cat._id,
      // Intentionally simulate drifted single-element categoryTree on half of products
      categoryTree: idx % 2 === 0 ? [cat._id] : [...cat.ancestors.map((a) => a._id), cat._id],
      gender: idx < 4 ? 'MEN' : idx < 8 ? 'WOMEN' : 'UNISEX',
      images: [
        {
          url: `https://res.cloudinary.com/luxecart-india/image/upload/v1791520958/luxecart/products/${slug}/front.jpg`,
          publicId: `luxecart/products/${slug}/front`,
          width: 1024,
          height: 1536,
          format: 'jpg',
          bytes: 88000,
          alt: `${slug} front`,
          isPrimary: true,
          displayOrder: 0,
          color: 'Midnight Black',
        },
        {
          url: `https://res.cloudinary.com/luxecart-india/image/upload/v1791520959/luxecart/products/${slug}/side.jpg`,
          publicId: `luxecart/products/${slug}/side`,
          width: 1024,
          height: 1536,
          format: 'jpg',
          bytes: 82000,
          alt: `${slug} side`,
          isPrimary: false,
          displayOrder: 1,
          color: 'Midnight Black',
        },
      ],
      specifications: [{ name: 'Material', value: 'Fine Cotton' }],
      variants: [
        {
          sku: `LUX-CUR-${String(idx + 1).padStart(3, '0')}-M`,
          attributes: { color: { name: 'Midnight Black', hex: '#111111' }, size: 'M', custom: {} },
          price: 1499 + idx * 100,
          mrp: 2499 + idx * 100,
          inventory: { stock: 15, reserved: 4, lowStockThreshold: 5 },
          weightInGrams: 300,
          dimensionsInCm: { length: 30, width: 25, height: 3 },
          images: [`https://res.cloudinary.com/luxecart-india/image/upload/v1791520958/luxecart/products/${slug}/front.jpg`],
          isActive: true,
        },
      ],
      status: 'ACTIVE',
      isFeatured: idx < 4,
      isNewArrival: true,
      isBestseller: idx % 3 === 0,
      tags: ['luxury', 'curated'],
      ratings: { average: 4.8, count: 19 },
    };
  });

  return { categories, products, catBySlug };
}

/**
 * Creates isolated in-memory Mongoose-like model & connection harness.
 * Source connection strictly blocks any write operation.
 * Target connection blocks any delete/drop operation and tracks all accessed model names.
 */
function createInMemoryHarness({
  sourceDbName = REQUIRED_SOURCE_DB,
  targetDbName = REQUIRED_TARGET_DB,
  sourceCategories = [],
  sourceProducts = [],
  initialTargetCategories = [],
  initialTargetProducts = [],
  extraCollections = { users: [{ _id: 'u1', email: 'private@test.com' }], orders: [{ _id: 'o1' }] },
} = {}) {
  const accessedModels = { source: [], target: [] };
  const targetWrites = { categoryUpserts: 0, productUpserts: 0 };

  const clone = (v) => JSON.parse(JSON.stringify(v));

  // Revive ObjectIds cleanly for comparison while keeping realistic doc structures
  const makeQueryChain = (rowsPromise) => {
    const chain = {
      _fields: null,
      select(fields) {
        this._fields = fields;
        return this;
      },
      lean() {
        return rowsPromise;
      },
      then(resolve, reject) {
        return rowsPromise.then(resolve, reject);
      },
    };
    return chain;
  };

  const matchFilter = (doc, query = {}) => {
    if (!query || Object.keys(query).length === 0) return true;
    for (const [k, cond] of Object.entries(query)) {
      const val = doc[k];
      if (cond && typeof cond === 'object' && Array.isArray(cond.$in)) {
        if (!cond.$in.includes(val)) return false;
      } else if (val !== cond) {
        return false;
      }
    }
    return true;
  };

  const makeReadOnlySourceModel = (docs) => ({
    find(query = {}) {
      return makeQueryChain(Promise.resolve(docs.filter((d) => matchFilter(d, query)).map(clone)));
    },
    updateOne() {
      throw new Error('SECURITY VIOLATION: Attempted write on read-only source connection!');
    },
    insertMany() {
      throw new Error('SECURITY VIOLATION: Attempted insert on read-only source connection!');
    },
    deleteMany() {
      throw new Error('SECURITY VIOLATION: Attempted delete on read-only source connection!');
    },
  });

  const targetStore = {
    categories: clone(initialTargetCategories),
    products: clone(initialTargetProducts),
    ...clone(extraCollections),
  };

  const makeTargetModel = (collectionName, counterKey) => ({
    find(query = {}) {
      return makeQueryChain(
        Promise.resolve(targetStore[collectionName].filter((d) => matchFilter(d, query)).map(clone))
      );
    },
    async updateOne(filter, update, opts = {}) {
      targetWrites[counterKey]++;
      const list = targetStore[collectionName];
      const existingIdx = list.findIndex((d) => matchFilter(d, filter));
      if (existingIdx >= 0) {
        list[existingIdx] = {
          ...list[existingIdx],
          ...clone(update.$set || {}),
        };
        return { matchedCount: 1, modifiedCount: 1, upsertedCount: 0 };
      }
      if (opts.upsert) {
        const newDoc = {
          _id: update.$setOnInsert?._id || new mongoose.Types.ObjectId().toString(),
          ...clone(update.$set || {}),
        };
        list.push(newDoc);
        return { matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
      }
      return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
    },
    deleteMany() {
      throw new Error('PROHIBITED: deleteMany must never be called!');
    },
    deleteOne() {
      throw new Error('PROHIBITED: deleteOne must never be called!');
    },
    collection: {
      drop() {
        throw new Error('PROHIBITED: dropCollection must never be called!');
      },
    },
  });

  const SourceCategory = makeReadOnlySourceModel(sourceCategories);
  const SourceProduct = makeReadOnlySourceModel(sourceProducts);
  const TargetCategory = makeTargetModel('categories', 'categoryUpserts');
  const TargetProduct = makeTargetModel('products', 'productUpserts');

  const sourceConn = {
    db: { databaseName: sourceDbName },
    model(name) {
      accessedModels.source.push(name);
      if (name === 'Category') return SourceCategory;
      if (name === 'Product') return SourceProduct;
      throw new Error(`PROHIBITED_COLLECTION_ACCESS on source: ${name}`);
    },
  };

  const targetConn = {
    db: { databaseName: targetDbName },
    model(name) {
      accessedModels.target.push(name);
      if (name === 'Category') return TargetCategory;
      if (name === 'Product') return TargetProduct;
      throw new Error(`PROHIBITED_COLLECTION_ACCESS on target: ${name}`);
    },
  };

  return {
    injectedConnections: { sourceConn, targetConn },
    targetStore,
    targetWrites,
    accessedModels,
  };
}

async function runTests() {
  console.log('\n================================================================');
  console.log('   LUXECART PHASE 7.3.8B: SAFE CATALOG MIGRATION TEST SUITE');
  console.log('   (Isolated In-Memory Harness — Zero Live Atlas / Cloudinary)');
  console.log('================================================================\n');

  const validSourceUri = 'mongodb+srv://ro_user:TestPass123!@cluster.mongodb.net/test?retryWrites=true&w=majority';
  const validTargetUri = 'mongodb+srv://migrator_user:StgPass456!@cluster.mongodb.net/luxecart_staging?retryWrites=true&w=majority';

  // ---------------------------------------------------------------------------
  // 1. Source/Target Database Validation & Missing Confirmation Flags
  // ---------------------------------------------------------------------------
  console.log('--- 1. Confirmation Flags & URI Database Name Validation ---');

  try {
    validateMigrationInputs({
      sourceUri: validSourceUri,
      targetUri: validTargetUri,
      confirmSource: null,
      confirmTarget: 'luxecart_staging',
    });
    recordTest('MIG-01', 'Rejects missing --confirm-source flag', false, 'Did not throw');
  } catch (err) {
    recordTest('MIG-01', 'Rejects missing --confirm-source flag', err.code === 'SOURCE_CONFIRMATION_REQUIRED');
  }

  try {
    validateMigrationInputs({
      sourceUri: validSourceUri,
      targetUri: validTargetUri,
      confirmSource: 'test',
      confirmTarget: null,
    });
    recordTest('MIG-02', 'Rejects missing --confirm-target flag', false, 'Did not throw');
  } catch (err) {
    recordTest('MIG-02', 'Rejects missing --confirm-target flag', err.code === 'TARGET_CONFIRMATION_REQUIRED');
  }

  try {
    validateMigrationInputs({
      sourceUri: validSourceUri,
      targetUri: validTargetUri,
      confirmSource: 'staging',
      confirmTarget: 'luxecart_staging',
    });
    recordTest('MIG-03', 'Rejects mismatched --confirm-source', false, 'Did not throw');
  } catch (err) {
    recordTest('MIG-03', 'Rejects mismatched --confirm-source', err.code === 'SOURCE_CONFIRMATION_MISMATCH');
  }

  try {
    validateMigrationInputs({
      sourceUri: 'mongodb+srv://user:pass@cluster.mongodb.net/luxecart_staging',
      targetUri: validTargetUri,
      confirmSource: 'test',
      confirmTarget: 'luxecart_staging',
    });
    recordTest('MIG-04', 'Rejects source URI not targeting "test"', false, 'Did not throw');
  } catch (err) {
    recordTest('MIG-04', 'Rejects source URI not targeting "test"', err.code === 'INVALID_SOURCE_DATABASE');
  }

  for (const forbiddenTarget of ['test', 'luxecart', 'production', '']) {
    try {
      validateMigrationInputs({
        sourceUri: validSourceUri,
        targetUri: `mongodb+srv://user:pass@cluster.mongodb.net/${forbiddenTarget}`,
        confirmSource: 'test',
        confirmTarget: 'luxecart_staging',
      });
      recordTest(`MIG-05-${forbiddenTarget || 'empty'}`, `Rejects forbidden target DB "${forbiddenTarget || '(none)'}"`, false);
    } catch (err) {
      recordTest(
        `MIG-05-${forbiddenTarget || 'empty'}`,
        `Rejects forbidden target DB "${forbiddenTarget || '(none)'}"`,
        err.code === 'INVALID_TARGET_DATABASE'
      );
    }
  }

  // Runtime DB mismatch check even if URI looked fine
  try {
    const fixture = buildSourceFixtureData();
    const harness = createInMemoryHarness({
      sourceDbName: 'test',
      targetDbName: 'luxecart', // Wrong runtime DB!
      sourceCategories: fixture.categories,
      sourceProducts: fixture.products,
    });
    await migrateCatalogToStaging({
      sourceUri: validSourceUri,
      targetUri: validTargetUri,
      confirmSource: 'test',
      confirmTarget: 'luxecart_staging',
      apply: true,
      injectedConnections: harness.injectedConnections,
    });
    recordTest('MIG-06', 'Rejects mismatched runtime connected DB before queries/writes', false);
  } catch (err) {
    recordTest('MIG-06', 'Rejects mismatched runtime connected DB before queries/writes', err.code === 'TARGET_DB_RUNTIME_MISMATCH');
  }

  // ---------------------------------------------------------------------------
  // 2. Dry-Run Writes Zero Records
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. Dry-Run Behavior ---');
  {
    const fixture = buildSourceFixtureData();
    const harness = createInMemoryHarness({
      sourceCategories: fixture.categories,
      sourceProducts: fixture.products,
    });

    const summary = await migrateCatalogToStaging({
      sourceUri: validSourceUri,
      targetUri: validTargetUri,
      confirmSource: 'test',
      confirmTarget: 'luxecart_staging',
      // apply omitted -> defaults to dry-run
      injectedConnections: harness.injectedConnections,
    });

    const passed =
      summary.dryRun === true &&
      summary.apply === false &&
      summary.categoriesPlanned === 21 &&
      summary.productsPlanned === 12 &&
      summary.categoriesUpserted === 0 &&
      summary.productsUpserted === 0 &&
      harness.targetWrites.categoryUpserts === 0 &&
      harness.targetWrites.productUpserts === 0 &&
      harness.targetStore.categories.length === 0 &&
      harness.targetStore.products.length === 0;

    recordTest('MIG-07', 'Dry-run validates 21 categories & 12 products and writes 0 records', passed);
  }

  // ---------------------------------------------------------------------------
  // 3. Exactly 12 Product Slugs Required & Non-Curated Excluded
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Exact 12-Product Scope Enforcement ---');
  {
    const fixture = buildSourceFixtureData();
    const incompleteProducts = fixture.products.slice(0, 11);
    const harness = createInMemoryHarness({
      sourceCategories: fixture.categories,
      sourceProducts: incompleteProducts,
    });

    try {
      await migrateCatalogToStaging({
        sourceUri: validSourceUri,
        targetUri: validTargetUri,
        confirmSource: 'test',
        confirmTarget: 'luxecart_staging',
        apply: true,
        injectedConnections: harness.injectedConnections,
      });
      recordTest('MIG-08', 'Fails closed when fewer than 12 curated slugs exist in source', false);
    } catch (err) {
      recordTest(
        'MIG-08',
        'Fails closed when fewer than 12 curated slugs exist in source',
        err.code === 'INCOMPLETE_SOURCE_CATALOG' && harness.targetWrites.productUpserts === 0
      );
    }
  }

  {
    const fixture = buildSourceFixtureData();
    const extraNonCuratedProduct = {
      ...fixture.products[0],
      _id: new mongoose.Types.ObjectId(),
      slug: 'random-unwanted-test-fixture',
      variants: [{ ...fixture.products[0].variants[0], sku: 'RANDOM-TEST-999' }],
    };
    const harness = createInMemoryHarness({
      sourceCategories: fixture.categories,
      sourceProducts: [...fixture.products, extraNonCuratedProduct],
    });

    const summary = await migrateCatalogToStaging({
      sourceUri: validSourceUri,
      targetUri: validTargetUri,
      confirmSource: 'test',
      confirmTarget: 'luxecart_staging',
      apply: true,
      injectedConnections: harness.injectedConnections,
    });

    const passed =
      summary.productsUpserted === 12 &&
      harness.targetStore.products.length === 12 &&
      !harness.targetStore.products.some((p) => p.slug === 'random-unwanted-test-fixture');

    recordTest('MIG-09', 'Ignores non-curated extra products and migrates strictly the 12 curated slugs', passed);
  }

  // ---------------------------------------------------------------------------
  // 4. Category Hierarchy Reconstruction & Product Reference Remapping
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. Category Hierarchy Reconstruction & Product Reference Remapping ---');
  {
    const fixture = buildSourceFixtureData();
    // Simulate pre-existing destination categories in luxecart_staging with DIFFERENT ObjectIds
    const destMenId = new mongoose.Types.ObjectId();
    const destMensApparelId = new mongoose.Types.ObjectId();
    const destMensTeesId = new mongoose.Types.ObjectId();

    // Also include an additional active subcategory referenced by a curated product
    const extraParent = fixture.catBySlug['womens-apparel'];
    const extraCatId = new mongoose.Types.ObjectId();
    const extraCat = {
      _id: extraCatId,
      name: 'Couture Capsule',
      slug: 'couture-capsule',
      parentId: extraParent._id,
      ancestors: [
        ...extraParent.ancestors,
        { _id: extraParent._id, name: extraParent.name, slug: extraParent.slug },
      ],
      level: 2,
      displayOrder: 5,
      isActive: true,
    };
    fixture.categories.push(extraCat);
    const dressProd = fixture.products.find((p) => p.slug === 'elane-satin-midi-dress');
    dressProd.categoryTree = [...dressProd.categoryTree, extraCatId];

    const harness = createInMemoryHarness({
      sourceCategories: fixture.categories,
      sourceProducts: fixture.products,
      initialTargetCategories: [
        { _id: destMenId, name: 'MEN', slug: 'men', parentId: null, ancestors: [], level: 0, isActive: true },
        { _id: destMensApparelId, name: 'Apparel', slug: 'mens-apparel', parentId: destMenId, ancestors: [], level: 1, isActive: true },
        { _id: destMensTeesId, name: 'T-Shirts', slug: 'mens-t-shirts', parentId: destMensApparelId, ancestors: [], level: 2, isActive: true },
      ],
    });

    const summary = await migrateCatalogToStaging({
      sourceUri: validSourceUri,
      targetUri: validTargetUri,
      confirmSource: 'test',
      confirmTarget: 'luxecart_staging',
      apply: true,
      injectedConnections: harness.injectedConnections,
    });

    const destTees = harness.targetStore.categories.find((c) => c.slug === 'mens-t-shirts');
    const destAurelio = harness.targetStore.products.find((p) => p.slug === 'aurelio-essential-oversized-t-shirt');
    const destCouture = harness.targetStore.categories.find((c) => c.slug === 'couture-capsule');

    const treeIds = (destAurelio.categoryTree || []).map((id) => id.toString());
    const passed =
      summary.categoriesUpserted === 22 && // 21 curated + 1 extra referenced active category
      Boolean(destCouture) &&
      destTees.parentId.toString() === destMensApparelId.toString() &&
      destTees.ancestors.length === 2 &&
      destTees.ancestors[0]._id.toString() === destMenId.toString() &&
      destTees.ancestors[1]._id.toString() === destMensApparelId.toString() &&
      destAurelio.category.toString() === destMensTeesId.toString() &&
      treeIds.length === 3 &&
      treeIds[0] === destMenId.toString() &&
      treeIds[1] === destMensApparelId.toString() &&
      treeIds[2] === destMensTeesId.toString() &&
      destAurelio.variants[0].inventory.reserved === 0 &&
      destAurelio.variants[0].inventory.stock === 15 &&
      destAurelio.ratings.average === 0 &&
      destAurelio.ratings.count === 0;

    recordTest('MIG-10', 'Rebuilds category parentId/ancestors & remaps product category/categoryTree to dest IDs', passed);
  }

  // ---------------------------------------------------------------------------
  // 5. Idempotent Upserts & Preservation of Non-Catalog Data
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. Idempotency & Data Protection ---');
  {
    const fixture = buildSourceFixtureData();
    const harness = createInMemoryHarness({
      sourceCategories: fixture.categories,
      sourceProducts: fixture.products,
      extraCollections: {
        users: [{ _id: 'stg-admin-1', email: 'admin@staging.luxecart.com', role: 'ADMIN' }],
        orders: [{ _id: 'stg-ord-1', orderNumber: 'LC-STG-001' }],
      },
    });

    const firstRun = await migrateCatalogToStaging({
      sourceUri: validSourceUri,
      targetUri: validTargetUri,
      confirmSource: 'test',
      confirmTarget: 'luxecart_staging',
      apply: true,
      injectedConnections: harness.injectedConnections,
    });

    const secondRun = await migrateCatalogToStaging({
      sourceUri: validSourceUri,
      targetUri: validTargetUri,
      confirmSource: 'test',
      confirmTarget: 'luxecart_staging',
      apply: true,
      injectedConnections: harness.injectedConnections,
    });

    const onlyCatalogAccessed =
      harness.accessedModels.source.every((m) => m === 'Category' || m === 'Product') &&
      harness.accessedModels.target.every((m) => m === 'Category' || m === 'Product');

    const passed =
      firstRun.categoriesUpserted === 21 &&
      firstRun.productsUpserted === 12 &&
      secondRun.categoryOperations.every((op) => op.action === 'UPDATE') &&
      secondRun.productOperations.every((op) => op.action === 'UPDATE') &&
      harness.targetStore.categories.length === 21 &&
      harness.targetStore.products.length === 12 &&
      harness.targetStore.users.length === 1 &&
      harness.targetStore.orders.length === 1 &&
      onlyCatalogAccessed;

    recordTest('MIG-11', 'Idempotent upserts on re-run & zero writes to prohibited collections', passed);
  }

  // ---------------------------------------------------------------------------
  // 6. Rejection of Invalid / Incomplete Products
  // ---------------------------------------------------------------------------
  console.log('\n--- 6. Invalid / Incomplete Product Rejection ---');
  const invalidCases = [
    {
      id: 'MIG-12A',
      label: 'Rejects DRAFT product',
      mutate: (p) => { p.status = 'DRAFT'; },
      expectedCode: 'INACTIVE_PRODUCT',
    },
    {
      id: 'MIG-12B',
      label: 'Rejects product with 0 images',
      mutate: (p) => { p.images = []; },
      expectedCode: 'MISSING_PRODUCT_IMAGES',
    },
    {
      id: 'MIG-12C',
      label: 'Rejects product with 0 primary images',
      mutate: (p) => { p.images.forEach((i) => { i.isPrimary = false; }); },
      expectedCode: 'INVALID_PRIMARY_IMAGE_COUNT',
    },
    {
      id: 'MIG-12D',
      label: 'Rejects product with 2 primary images',
      mutate: (p) => { p.images.forEach((i) => { i.isPrimary = true; }); },
      expectedCode: 'INVALID_PRIMARY_IMAGE_COUNT',
    },
    {
      id: 'MIG-12E',
      label: 'Rejects product with 0 active variants',
      mutate: (p) => { p.variants.forEach((v) => { v.isActive = false; }); },
      expectedCode: 'MISSING_ACTIVE_VARIANTS',
    },
    {
      id: 'MIG-12F',
      label: 'Rejects product with missing category reference',
      mutate: (p) => { p.category = new mongoose.Types.ObjectId(); },
      expectedCode: 'INVALID_PRODUCT_CATEGORY',
    },
    {
      id: 'MIG-12G',
      label: 'Rejects duplicate SKU across curated products',
      mutate: (p, all) => { p.variants[0].sku = all[0].variants[0].sku; },
      expectedCode: 'DUPLICATE_CURATED_SKU',
    },
  ];

  for (const tc of invalidCases) {
    const fixture = buildSourceFixtureData();
    tc.mutate(fixture.products[1], fixture.products);
    const harness = createInMemoryHarness({
      sourceCategories: fixture.categories,
      sourceProducts: fixture.products,
    });

    try {
      await migrateCatalogToStaging({
        sourceUri: validSourceUri,
        targetUri: validTargetUri,
        confirmSource: 'test',
        confirmTarget: 'luxecart_staging',
        apply: true,
        injectedConnections: harness.injectedConnections,
      });
      recordTest(tc.id, tc.label, false, 'Expected failure but succeeded');
    } catch (err) {
      recordTest(
        tc.id,
        tc.label,
        err.code === tc.expectedCode && harness.targetWrites.categoryUpserts === 0 && harness.targetWrites.productUpserts === 0
      );
    }
  }

  // ---------------------------------------------------------------------------
  // 7. Cloudinary Protection & Sanitized Error Logging
  // ---------------------------------------------------------------------------
  console.log('\n--- 7. Cloudinary Protection & Credential Sanitization ---');
  {
    const scriptText = fs.readFileSync(path.join(__dirname, 'migrate_catalog_to_staging.js'), 'utf8');
    // Strip block & line comments before scanning code for Cloudinary imports/calls
    const codeOnly = scriptText
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    const noCloudinaryImportOrDelete =
      !/import\s+.*cloudinary/i.test(codeOnly) &&
      !/from\s+['"][^'"]*cloudinary[^'"]*['"]/i.test(codeOnly) &&
      !codeOnly.includes('deleteFromCloudinary') &&
      !codeOnly.includes('uploader.destroy') &&
      !codeOnly.includes('cloudinary.uploader');

    recordTest('MIG-13', 'Migration script never imports or invokes Cloudinary deletion APIs', noCloudinaryImportOrDelete);
  }

  {
    const secretUser = 'staging_secret_user';
    const secretPass = 'UltraSecretPass987!';
    const rawUri = `mongodb+srv://${secretUser}:${secretPass}@cluster.mongodb.net/luxecart_staging?retryWrites=true`;
    const noisyMsg = `Connection error for ${rawUri} using credentials ${secretUser}:${secretPass} (${secretPass})`;
    const sanitized = sanitizeLogMessage(noisyMsg, [rawUri]);

    const passed =
      !sanitized.includes(secretUser) &&
      !sanitized.includes(secretPass) &&
      !sanitized.includes(rawUri) &&
      sanitized.includes('[REDACTED');

    recordTest('MIG-14', 'Sanitizes full URIs, usernames, and passwords in error/log messages', passed);
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  const passedCount = testResults.filter((r) => r.status === 'PASS').length;
  const failedCount = testResults.filter((r) => r.status === 'FAIL').length;

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passedCount}/${testResults.length} PASSED | ${failedCount} FAILED`);
  console.log('================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test harness error:', err);
  process.exit(1);
});
