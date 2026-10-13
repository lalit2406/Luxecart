import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Product from '../src/modules/products/product.model.js';
import productService from '../src/modules/products/product.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const validPngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

async function runValidation() {
  console.log('====================================================');
  console.log('VALIDATING VANTA RETRO RUNNER SNEAKER COLORWAY SPLIT');
  console.log('====================================================\n');

  await mongoose.connect(process.env.MONGODB_URI);

  const product = await Product.findOne({ slug: 'vanta-retro-runner-sneakers' });
  if (!product) {
    throw new Error('Vanta sneakers not found in database.');
  }

  // VALIDATION 1: Variant Count & Distribution
  console.log('[VAL 1] Verifying Variant Count & Colorway Distribution...');
  if (product.variants.length !== 12) {
    throw new Error(`Expected 12 variants, found ${product.variants.length}`);
  }

  const whiteVariants = product.variants.filter((v) => v.attributes?.color?.name === 'White');
  const blackVariants = product.variants.filter((v) => v.attributes?.color?.name === 'Black');

  if (whiteVariants.length !== 6) {
    throw new Error(`Expected 6 White variants, found ${whiteVariants.length}`);
  }
  if (blackVariants.length !== 6) {
    throw new Error(`Expected 6 Black variants, found ${blackVariants.length}`);
  }
  console.log(`✔ PASS: Exactly 12 variants found (6 White, 6 Black)`);

  // VALIDATION 2: SKU Uniqueness & Patterns
  console.log('\n[VAL 2] Verifying SKU Uniqueness and Formatting...');
  const expectedWhiteSkus = ['6', '7', '8', '9', '10', '11'].map((s) => `VAN-RUN-001-WHT-${s}`);
  const expectedBlackSkus = ['6', '7', '8', '9', '10', '11'].map((s) => `VAN-RUN-001-BLK-${s}`);

  const actualWhiteSkus = whiteVariants.map((v) => v.sku);
  const actualBlackSkus = blackVariants.map((v) => v.sku);

  for (const exp of expectedWhiteSkus) {
    if (!actualWhiteSkus.includes(exp)) throw new Error(`Missing expected White SKU: ${exp}`);
  }
  for (const exp of expectedBlackSkus) {
    if (!actualBlackSkus.includes(exp)) throw new Error(`Missing expected Black SKU: ${exp}`);
  }
  console.log(`✔ PASS: White SKUs verified: ${actualWhiteSkus.join(', ')}`);
  console.log(`✔ PASS: Black SKUs verified: ${actualBlackSkus.join(', ')}`);

  // VALIDATION 3: Inventory Integrity & No Duplication
  console.log('\n[VAL 3] Verifying Inventory Integrity...');
  const whiteStockTotal = whiteVariants.reduce((sum, v) => sum + v.inventory.stock, 0);
  const blackStockTotal = blackVariants.reduce((sum, v) => sum + v.inventory.stock, 0);
  const totalCatalogStock = product.priceSummary.totalStock;

  if (whiteStockTotal !== 74) {
    throw new Error(`Expected White stock to be 74, got ${whiteStockTotal}`);
  }
  if (blackStockTotal !== 0) {
    throw new Error(`Expected Black stock to be 0 (uninventoried), got ${blackStockTotal}`);
  }
  if (totalCatalogStock !== 74) {
    throw new Error(`Expected total catalog stock to be 74, got ${totalCatalogStock}`);
  }
  console.log(`✔ PASS: White stock preserved at exactly 74 units (12, 12, 12, 12, 13, 13)`);
  console.log(`✔ PASS: Black stock safely initialized to 0 units (requires physical stock confirmation)`);
  console.log(`✔ PASS: No inventory duplication occurred (Catalog total: 74 units)`);

  // VALIDATION 4: Distinct Colors for Media Manager & Storefront
  console.log('\n[VAL 4] Verifying Distinct Colors for Media Manager & Storefront...');
  const distinctColors = Array.from(
    new Set(product.variants.map((v) => v.attributes?.color?.name).filter(Boolean))
  );
  if (distinctColors.length !== 2 || !distinctColors.includes('White') || !distinctColors.includes('Black')) {
    throw new Error(`Expected distinct colors ['White', 'Black'], got: ${JSON.stringify(distinctColors)}`);
  }
  console.log(`✔ PASS: Distinct colorways available in Admin Media Manager: ${distinctColors.join(', ')}`);

  // VALIDATION 5: Test Media Upload Assignment for Black and White Independently
  console.log('\n[VAL 5] Testing Independent Colorway Media Assignment...');
  const initialImgCount = product.images.length;

  // Upload test Black image
  const blackTestFile = {
    buffer: validPngBuffer,
    originalname: 'vanta-test-black-front.png',
    mimetype: 'image/png',
  };
  const prodAfterBlackUpload = await productService.uploadMedia(product._id.toString(), [blackTestFile], {
    color: 'Black',
    alt: 'Black - Front View Test',
  });

  const blackUploadedImg = prodAfterBlackUpload.images.find((img) => img.alt === 'Black - Front View Test');
  if (!blackUploadedImg || blackUploadedImg.color !== 'Black') {
    throw new Error('Black test image was not properly tagged with color "Black"!');
  }

  // Check sync to Black variants
  const blackVariantsUpdated = prodAfterBlackUpload.variants.filter((v) => v.attributes?.color?.name === 'Black');
  const allBlackSynced = blackVariantsUpdated.every((v) => v.images.includes(blackUploadedImg.url));
  if (!allBlackSynced) {
    throw new Error('Black test image was not synced to Black variants!');
  }
  console.log('✔ PASS: Black image successfully uploaded and synced to all 6 Black variants.');

  // Clean up test image
  const prodCleaned = await productService.deleteMedia(product._id.toString(), blackUploadedImg._id.toString());
  if (prodCleaned.images.length !== initialImgCount) {
    throw new Error(`Expected image count to return to ${initialImgCount}, got ${prodCleaned.images.length}`);
  }
  console.log('✔ PASS: Test image deleted cleanly, returning gallery to pristine state.');

  // Verify stock & variants remained completely unchanged after media upload/delete
  if (prodCleaned.variants.length !== 12 || prodCleaned.priceSummary.totalStock !== 74) {
    throw new Error('Variants or stock altered during media operation!');
  }
  console.log('✔ PASS: Variant count (12) and total stock (74) completely preserved across media operations.');

  // VALIDATION 6: Global SKU Uniqueness Across Entire Database
  console.log('\n[VAL 6] Verifying Global SKU Uniqueness Across Entire Catalog...');
  const allProducts = await Product.find({}).lean();
  const globalSkus = new Set();
  let duplicateCount = 0;

  for (const p of allProducts) {
    (p.variants || []).forEach((v) => {
      if (globalSkus.has(v.sku)) {
        console.error(`  [DUPLICATE SKU]: ${v.sku}`);
        duplicateCount++;
      }
      globalSkus.add(v.sku);
    });
  }

  if (duplicateCount > 0) {
    throw new Error(`Detected ${duplicateCount} duplicate SKUs across catalog!`);
  }
  console.log(`✔ PASS: Catalog contains ${allProducts.length} products, ${globalSkus.size} total variants, 0 duplicate SKUs.`);

  console.log('\n====================================================');
  console.log('ALL 6 VALIDATION CHECKS PASSED SUCCESSFULLY!');
  console.log('====================================================\n');

  await mongoose.disconnect();
}

runValidation().catch((err) => {
  console.error('Validation failed:', err);
  process.exit(1);
});
