import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Product from '../src/modules/products/product.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

/**
 * Fast, bounded URL check with strict socket-level timeout
 */
function checkUrlBounded(url, timeoutMs = 4000) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const client = parsed.protocol === 'https:' ? https : http;
      let finished = false;

      const req = client.request(
        url,
        {
          method: 'HEAD',
          headers: { 'User-Agent': 'LuxeCart-Audit/1.0' },
        },
        (res) => {
          if (!finished) {
            finished = true;
            resolve({
              url,
              statusCode: res.statusCode,
              reachable: res.statusCode >= 200 && res.statusCode < 400,
            });
          }
        }
      );

      req.setTimeout(timeoutMs, () => {
        if (!finished) {
          finished = true;
          req.destroy(new Error('SOCKET_TIMEOUT'));
          resolve({ url, statusCode: 408, reachable: false, error: 'TIMEOUT' });
        }
      });

      req.on('error', (err) => {
        if (!finished) {
          finished = true;
          resolve({ url, statusCode: null, reachable: false, error: err.message });
        }
      });

      req.end();
    } catch (err) {
      resolve({ url, statusCode: null, reachable: false, error: err.message });
    }
  });
}

/**
 * Concurrency worker pool with global time ceiling
 */
async function verifyUrlsWithPool(urls, concurrency = 8, globalDeadlineMs = 25000) {
  const results = new Map();
  const startTime = Date.now();
  let currentIndex = 0;
  let activeWorkers = 0;
  let deadlineExceeded = false;
  let completedCount = 0;

  return new Promise((resolve) => {
    const deadlineTimer = setTimeout(() => {
      deadlineExceeded = true;
      console.log(`[NETWORK STAGE] Global deadline of ${globalDeadlineMs / 1000}s reached. Aborting remaining checks.`);
    }, globalDeadlineMs);

    function checkFinished() {
      if (currentIndex >= urls.length && activeWorkers === 0) {
        clearTimeout(deadlineTimer);
        resolve(results);
      }
    }

    function launchNext() {
      if (deadlineExceeded) {
        while (currentIndex < urls.length) {
          const u = urls[currentIndex++];
          if (!results.has(u)) {
            results.set(u, { url: u, statusCode: null, reachable: 'UNKNOWN', error: 'DEADLINE_EXCEEDED' });
          }
        }
        checkFinished();
        return;
      }

      while (activeWorkers < concurrency && currentIndex < urls.length) {
        const u = urls[currentIndex++];
        activeWorkers++;

        checkUrlBounded(u, 4000)
          .then((res) => {
            results.set(u, res);
          })
          .catch((err) => {
            results.set(u, { url: u, statusCode: null, reachable: false, error: err.message });
          })
          .finally(() => {
            activeWorkers--;
            completedCount++;
            if (completedCount % 10 === 0 || completedCount === urls.length) {
              console.log(`[NETWORK STAGE] Checked ${completedCount}/${urls.length} URLs...`);
            }
            if (currentIndex < urls.length && !deadlineExceeded) {
              launchNext();
            } else {
              checkFinished();
            }
          });
      }
      checkFinished();
    }

    launchNext();
  });
}

async function runAudit() {
  console.log('================================================================');
  console.log('LUXECART LAUNCH CATALOG READ-ONLY AUDIT (BOUNDED & RESILIENT)');
  console.log('================================================================\n');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB.\n');

  const products = await Product.find({}).sort({ createdAt: 1 }).lean();

  // -------------------------------------------------------------
  // STAGE 1: COMPLETE DATABASE-ONLY AUDIT
  // -------------------------------------------------------------
  console.log('================================================================');
  console.log('STAGE 1: DATABASE METADATA & INTEGRITY AUDIT (12 PRODUCTS)');
  console.log('================================================================\n');

  const globalSkus = new Map();
  const globalDuplicateSkus = [];
  const dbAuditResults = [];
  const allStoredProductUrls = new Set();
  const allStoredVariantUrls = new Set();

  for (const p of products) {
    const issues = [];
    const warnings = [];

    // Basic metadata
    const variantCount = p.variants?.length || 0;
    const activeVariants = (p.variants || []).filter((v) => v.isActive);
    const totalStock = p.priceSummary?.totalStock ?? 0;
    const minPrice = p.priceSummary?.minPrice ?? 0;
    const maxPrice = p.priceSummary?.maxPrice ?? 0;
    const minMrp = p.priceSummary?.minMrp ?? 0;
    const maxMrp = p.priceSummary?.maxMrp ?? 0;

    // Active status rules
    if (p.status === 'ACTIVE' && variantCount === 0) {
      issues.push('CRITICAL: Product is ACTIVE but has 0 variants.');
    }
    if (p.status === 'ACTIVE' && activeVariants.length === 0) {
      issues.push('CRITICAL: Product is ACTIVE but has 0 active variants.');
    }
    if (p.status === 'ACTIVE' && (p.images?.length || 0) === 0) {
      issues.push('CRITICAL: Product is ACTIVE but has 0 images.');
    }

    // Media metadata
    const images = p.images || [];
    const imageCount = images.length;
    const primaryImages = images.filter((img) => img.isPrimary);
    const primaryImg = primaryImages[0] || null;

    if (imageCount > 0 && primaryImages.length === 0) {
      issues.push('No primary image designated.');
    }
    if (primaryImages.length > 1) {
      warnings.push(`Multiple primary images designated (${primaryImages.length}).`);
    }

    images.forEach((img, i) => {
      if (!img.url) issues.push(`Image #${i + 1} has empty URL.`);
      else allStoredProductUrls.add(img.url);
      if (!img.alt || img.alt.trim() === '') warnings.push(`Image #${i + 1} has blank alt text.`);
      if (!img.url?.includes('cloudinary.com')) warnings.push(`Image #${i + 1} is not hosted on Cloudinary.`);
    });

    // Variants verification
    let sumVariantStock = 0;
    const pSkus = new Set();
    const pColors = new Set();
    const pSizes = new Set();
    let variantOrphanUrlsCount = 0;
    const prodUrlSet = new Set(images.map((img) => img.url).filter(Boolean));

    (p.variants || []).forEach((v, idx) => {
      sumVariantStock += v.inventory?.stock ?? 0;

      // SKU validation
      if (!v.sku) {
        issues.push(`Variant #${idx + 1} missing SKU.`);
      } else {
        if (pSkus.has(v.sku)) issues.push(`Duplicate SKU inside product: ${v.sku}`);
        pSkus.add(v.sku);

        if (globalSkus.has(v.sku)) {
          globalDuplicateSkus.push({ sku: v.sku, products: [globalSkus.get(v.sku), p.name] });
        } else {
          globalSkus.set(v.sku, p.name);
        }
      }

      // Price & stock
      if (!v.price || v.price <= 0) issues.push(`Variant ${v.sku}: Invalid price (${v.price})`);
      if (!v.mrp || v.mrp <= 0) issues.push(`Variant ${v.sku}: Invalid MRP (${v.mrp})`);
      if (v.price > v.mrp) issues.push(`Variant ${v.sku}: Selling price (₹${v.price}) > MRP (₹${v.mrp})`);
      if (v.inventory?.stock < 0) issues.push(`Variant ${v.sku}: Negative inventory (${v.inventory?.stock})`);

      // Attributes
      if (v.attributes?.color?.name) pColors.add(v.attributes.color.name);
      if (v.attributes?.size) pSizes.add(v.attributes.size);

      // Variant images
      (v.images || []).forEach((u) => {
        if (u) {
          allStoredVariantUrls.add(u);
          if (!prodUrlSet.has(u)) variantOrphanUrlsCount++;
        }
      });
    });

    if (sumVariantStock !== totalStock) {
      issues.push(`totalStock mismatch: priceSummary has ${totalStock}, sum of variants is ${sumVariantStock}.`);
    }

    if (variantOrphanUrlsCount > 0) {
      warnings.push(`Variants contain ${variantOrphanUrlsCount} image URLs not present in product.images (stale test references).`);
    }

    // Color distribution
    const imagesByColor = {};
    images.forEach((img) => {
      const c = img.color || 'Unassigned';
      imagesByColor[c] = (imagesByColor[c] || 0) + 1;
    });

    // Specific product audits
    if (p.slug === 'vanta-retro-runner-sneakers') {
      const whiteV = (p.variants || []).filter((v) => v.attributes?.color?.name === 'White');
      const blackV = (p.variants || []).filter((v) => v.attributes?.color?.name === 'Black');
      const blackStock = blackV.reduce((a, b) => a + (b.inventory?.stock || 0), 0);
      if (whiteV.length !== 6) issues.push(`Vanta White variants expected 6, found ${whiteV.length}`);
      if (blackV.length !== 6) issues.push(`Vanta Black variants expected 6, found ${blackV.length}`);
      if (blackStock !== 0) issues.push(`Vanta Black inventory expected 0, found ${blackStock}`);
    }

    if (p.slug === 'stride-minimal-leather-loafers') {
      const blackV = (p.variants || []).filter((v) => v.attributes?.color?.name === 'Classic Black');
      const tanV = (p.variants || []).filter((v) => v.attributes?.color?.name === 'Warm Tan');
      if (blackV.length === 0 || tanV.length === 0) issues.push('Stride Loafers missing Classic Black or Warm Tan variants.');
    }

    if (p.slug === 'nivelle-vitamin-c-brightening-serum') {
      if (imageCount !== 3) warnings.push(`Nivelle Serum expected 3 images, found ${imageCount}`);
      if (!primaryImg) issues.push('Nivelle Serum missing primary image.');
    }

    if (p.slug === 'aurelia-structured-shoulder-bag') {
      const onyxV = (p.variants || []).filter((v) => v.attributes?.color?.name === 'Onyx Black');
      const caramelV = (p.variants || []).filter((v) => v.attributes?.color?.name === 'Caramel Tan');
      if (onyxV.length === 0 || caramelV.length === 0) issues.push('Aurelia Bag missing Onyx Black or Caramel Tan variants.');
      if ((imagesByColor['Caramel Tan'] || 0) !== 3) warnings.push(`Aurelia Bag expected 3 Caramel Tan images, found ${imagesByColor['Caramel Tan'] || 0}`);
      if ((imagesByColor['Onyx Black'] || 0) !== 3) warnings.push(`Aurelia Bag expected 3 Onyx Black images, found ${imagesByColor['Onyx Black'] || 0}`);
    }

    dbAuditResults.push({
      id: p._id.toString(),
      name: p.name,
      slug: p.slug,
      status: p.status,
      variantCount,
      activeVariantCount: activeVariants.length,
      totalStock,
      price: minPrice === maxPrice ? `₹${minPrice}` : `₹${minPrice} - ₹${maxPrice}`,
      mrp: minMrp === maxMrp ? `₹${minMrp}` : `₹${minMrp} - ₹${maxMrp}`,
      imageCount,
      primaryImage: primaryImg
        ? {
            url: primaryImg.url,
            color: primaryImg.color || 'Unassigned',
            alt: primaryImg.alt,
          }
        : null,
      imagesByColor,
      colors: Array.from(pColors),
      sizes: Array.from(pSizes),
      issues,
      warnings,
    });
  }

  // Print Stage 1 Table
  console.log('Product Metadata Overview:');
  console.table(
    dbAuditResults.map((r) => ({
      Product: r.name,
      Status: r.status,
      Variants: r.variantCount,
      Stock: r.totalStock,
      Price: r.price,
      MRP: r.mrp,
      Images: r.imageCount,
      PrimaryColor: r.primaryImage?.color || 'None',
      Issues: r.issues.length,
      Warnings: r.warnings.length,
    }))
  );

  console.log(`\nGlobal SKU Count: ${globalSkus.size} unique SKUs across ${products.length} products.`);
  if (globalDuplicateSkus.length > 0) {
    console.error('CRITICAL: Duplicate SKUs detected:', globalDuplicateSkus);
  } else {
    console.log('✔ Global SKU Uniqueness: 100% PASS (0 duplicates).\n');
  }

  // -------------------------------------------------------------
  // STAGE 2: BOUNDED NETWORK URL REACHABILITY AUDIT
  // -------------------------------------------------------------
  console.log('================================================================');
  console.log('STAGE 2: BOUNDED CLOUDINARY REACHABILITY AUDIT (HEAD CHECKS)');
  console.log('================================================================\n');

  const uniqueUrlsToCheck = Array.from(allStoredProductUrls);
  console.log(`Checking ${uniqueUrlsToCheck.length} unique product-level image URLs...`);
  console.log(`Configuration: concurrency=8, socketTimeout=4s, globalDeadline=25s.\n`);

  const netStart = Date.now();
  const urlCheckResults = await verifyUrlsWithPool(uniqueUrlsToCheck, 8, 25000);
  const netDurationSec = ((Date.now() - netStart) / 1000).toFixed(1);

  console.log(`\nNetwork reachability stage finished in ${netDurationSec}s.`);

  let reachableCount = 0;
  let brokenCount = 0;
  let unknownCount = 0;
  const brokenUrls = [];
  const unknownUrls = [];

  for (const [url, res] of urlCheckResults.entries()) {
    if (res.reachable === true) {
      reachableCount++;
    } else if (res.reachable === false) {
      brokenCount++;
      brokenUrls.push({ url, status: res.statusCode, error: res.error });
    } else {
      unknownCount++;
      unknownUrls.push(url);
    }
  }

  console.log(`\nReachability Summary for ${uniqueUrlsToCheck.length} Stored URLs:`);
  console.log(` - Verified 200 OK: ${reachableCount}`);
  console.log(` - Broken / HTTP Error: ${brokenCount}`);
  console.log(` - Unknown / Timed Out: ${unknownCount}`);

  if (brokenUrls.length > 0) {
    console.error('Broken URLs:', brokenUrls);
  }

  // Output full structured audit data
  const finalOutput = {
    summary: {
      totalProducts: products.length,
      activeProducts: products.filter((p) => p.status === 'ACTIVE').length,
      draftProducts: products.filter((p) => p.status === 'DRAFT').length,
      totalVariants: Array.from(globalSkus.keys()).length,
      globalSkuDuplicates: globalDuplicateSkus.length,
      totalStoredProductImages: uniqueUrlsToCheck.length,
      verifiedReachableImages: reachableCount,
      brokenImages: brokenCount,
      unknownImages: unknownCount,
      networkStageDurationSeconds: netDurationSec,
    },
    products: dbAuditResults,
  };

  await mongoose.disconnect();
  return finalOutput;
}

runAudit()
  .then((data) => {
    console.log('\n--- AUDIT COMPLETE ---');
  })
  .catch((err) => {
    console.error('Audit crashed:', err);
    process.exit(1);
  });
