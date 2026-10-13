import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Product from '../src/modules/products/product.model.js';
import productService from '../src/modules/products/product.service.js';
import { validateProductInput } from '../src/validators/product.validator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

function getSnapshot(product) {
  return {
    variantCount: product.variants?.length || 0,
    totalStock: product.priceSummary?.totalStock || 0,
    minPrice: product.priceSummary?.minPrice || 0,
    maxPrice: product.priceSummary?.maxPrice || 0,
    skus: (product.variants || []).map((v) => v.sku).sort(),
    imageCount: product.images?.length || 0,
  };
}

function assertSnapshotsMatch(before, after, testName) {
  if (before.variantCount !== after.variantCount) {
    throw new Error(`[FAIL] ${testName}: Variant count changed from ${before.variantCount} to ${after.variantCount}!`);
  }
  if (before.totalStock !== after.totalStock) {
    throw new Error(`[FAIL] ${testName}: Total stock changed from ${before.totalStock} to ${after.totalStock}!`);
  }
  if (before.minPrice !== after.minPrice) {
    throw new Error(`[FAIL] ${testName}: Min price changed from ${before.minPrice} to ${after.minPrice}!`);
  }
  if (JSON.stringify(before.skus) !== JSON.stringify(after.skus)) {
    throw new Error(`[FAIL] ${testName}: SKUs changed!`);
  }
  console.log(`✔ PASS: ${testName} preserved all ${after.variantCount} variants, ${after.totalStock} units, ₹${after.minPrice}`);
}

async function runTests() {
  console.log('====================================================');
  console.log('LUXECART MEDIA & VARIANT INTEGRITY VERIFICATION SUITE');
  console.log('====================================================\n');

  await mongoose.connect(process.env.MONGODB_URI);

  const testProductId = '6ac6539d1301d7776aa3918b'; // Miraé Ribbed Knit Top
  const product = await Product.findById(testProductId);

  if (!product) {
    throw new Error(`Product ${testProductId} not found.`);
  }

  const initialSnap = getSnapshot(product);
  console.log(`Target Product: "${product.name}"`);
  console.log(`Initial State: ${initialSnap.variantCount} variants, ${initialSnap.totalStock} stock, ${initialSnap.imageCount} images, minPrice: ₹${initialSnap.minPrice}\n`);

  // TEST 1: Partial PATCH without variants
  console.log('[TEST 1] Testing Partial Update without variants payload...');
  const partialBody = {
    shortDescription: product.shortDescription,
    description: product.description,
  };
  const { isValid, errors, sanitized } = validateProductInput(partialBody, false, true);
  if (!isValid) {
    throw new Error(`Validation failed for partial update: ${errors.join(', ')}`);
  }
  if (sanitized.variants !== undefined) {
    throw new Error('sanitized.variants should be undefined for partial update without variants!');
  }

  const updatedProd = await productService.updateProduct(testProductId, sanitized);
  const postPatchSnap = getSnapshot(updatedProd);
  assertSnapshotsMatch(initialSnap, postPatchSnap, 'TEST 1: Partial PATCH');

  // Valid 1x1 PNG bytes
  const validPngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );

  // TEST 2: Single Image Upload via uploadMedia
  console.log('\n[TEST 2] Testing Single Image Upload via uploadMedia...');
  const dummyFile = {
    buffer: validPngBuffer,
    originalname: 'mirae-test-single.png',
    mimetype: 'image/png',
  };

  const prodWith1Img = await productService.uploadMedia(testProductId, [dummyFile], {
    color: 'Cream',
    alt: 'Cream - Test Single View',
  });
  const postSingleSnap = getSnapshot(prodWith1Img);
  assertSnapshotsMatch(initialSnap, postSingleSnap, 'TEST 2: Single Image Upload');
  if (prodWith1Img.images.length !== initialSnap.imageCount + 1) {
    throw new Error(`Expected image count to be ${initialSnap.imageCount + 1}, got ${prodWith1Img.images.length}`);
  }
  const uploadedSingleImg = prodWith1Img.images[prodWith1Img.images.length - 1];

  // TEST 3: 3-Image Colorway Upload
  console.log('\n[TEST 3] Testing 3-Image Colorway Upload...');
  const threeFiles = [
    { buffer: validPngBuffer, originalname: 'mirae-test-1.png', mimetype: 'image/png' },
    { buffer: validPngBuffer, originalname: 'mirae-test-2.png', mimetype: 'image/png' },
    { buffer: validPngBuffer, originalname: 'mirae-test-3.png', mimetype: 'image/png' },
  ];
  const prodWith3Img = await productService.uploadMedia(testProductId, threeFiles, {
    color: 'Mocha',
    alts: ['Mocha - Angle 1', 'Mocha - Angle 2', 'Mocha - Angle 3'],
  });
  const post3Snap = getSnapshot(prodWith3Img);
  assertSnapshotsMatch(initialSnap, post3Snap, 'TEST 3: 3-Image Upload');

  // TEST 4: Primary Image Selection
  console.log('\n[TEST 4] Testing Set Primary Image...');
  const targetMediaId = uploadedSingleImg._id.toString();
  const prodWithPrimary = await productService.setPrimaryMedia(testProductId, targetMediaId);
  const postPrimarySnap = getSnapshot(prodWithPrimary);
  assertSnapshotsMatch(initialSnap, postPrimarySnap, 'TEST 4: Set Primary Media');
  const primaryImg = prodWithPrimary.images.find((img) => img._id.toString() === targetMediaId);
  if (!primaryImg?.isPrimary) {
    throw new Error('Target image was not marked as primary!');
  }
  console.log('✔ PASS: Primary image correctly marked as isPrimary: true');

  // TEST 5: Reorder Gallery
  console.log('\n[TEST 5] Testing Reorder Media Gallery...');
  const reversedOrders = prodWithPrimary.images.map((img, idx) => ({
    mediaId: img._id.toString(),
    displayOrder: prodWithPrimary.images.length - 1 - idx,
  }));
  const prodReordered = await productService.reorderMedia(testProductId, reversedOrders);
  const postReorderSnap = getSnapshot(prodReordered);
  assertSnapshotsMatch(initialSnap, postReorderSnap, 'TEST 5: Reorder Media');

  // TEST 6: Delete Test Images (clean up test images created in tests 2 and 3)
  console.log('\n[TEST 6] Testing Delete Media (Removing uploaded test images)...');
  const testImagesToDelete = prodReordered.images.filter((img) =>
    img.alt.includes('Test') || img.alt.includes('Angle')
  );

  let currentProd = prodReordered;
  for (const img of testImagesToDelete) {
    currentProd = await productService.deleteMedia(testProductId, img._id.toString());
  }

  // Ensure primary image is set on the first remaining image if needed
  if (!currentProd.images.some((img) => img.isPrimary) && currentProd.images.length > 0) {
    currentProd.images[0].isPrimary = true;
    await currentProd.save();
  }

  const postDeleteSnap = getSnapshot(currentProd);
  assertSnapshotsMatch(initialSnap, postDeleteSnap, 'TEST 6: Delete Media');
  if (postDeleteSnap.imageCount !== initialSnap.imageCount) {
    throw new Error(`Expected image count to return to ${initialSnap.imageCount}, got ${postDeleteSnap.imageCount}`);
  }
  console.log(`✔ PASS: Image count cleanly returned to original ${initialSnap.imageCount}`);

  // TEST 7: 30-image limit enforcement
  console.log('\n[TEST 7] Testing 30-Image Limit Validation...');
  const overflowFiles = Array.from({ length: 25 }, (_, i) => ({
    buffer: Buffer.from(`dummy-${i}`),
    originalname: `overflow-${i}.webp`,
    mimetype: 'image/webp',
  }));
  let limitTriggered = false;
  try {
    await productService.uploadMedia(testProductId, overflowFiles);
  } catch (err) {
    limitTriggered = true;
    if (err.code !== 'MAX_IMAGES_EXCEEDED') {
      throw new Error(`Expected MAX_IMAGES_EXCEEDED, got ${err.code}: ${err.message}`);
    }
    console.log(`✔ PASS: Rejected upload exceeding 30 images with 400 (${err.code})`);
  }
  if (!limitTriggered) {
    throw new Error('Expected 30-image limit to trigger error, but it succeeded.');
  }

  console.log('\n====================================================');
  console.log('ALL 7 MEDIA & VARIANT INTEGRITY TESTS PASSED!');
  console.log('====================================================\n');

  await mongoose.disconnect();
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
