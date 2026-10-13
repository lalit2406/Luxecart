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

function checkUrl(url) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const client = parsed.protocol === 'https:' ? https : http;
      const req = client.request(
        url,
        { method: 'HEAD', timeout: 5000 },
        (res) => {
          resolve({
            url,
            statusCode: res.statusCode,
            ok: res.statusCode >= 200 && res.statusCode < 400,
          });
        }
      );
      req.on('error', (err) => {
        resolve({ url, statusCode: null, ok: false, error: err.message });
      });
      req.on('timeout', () => {
        req.destroy();
        resolve({ url, statusCode: 408, ok: false, error: 'Timeout' });
      });
      req.end();
    } catch (e) {
      resolve({ url, statusCode: null, ok: false, error: e.message });
    }
  });
}

async function auditCatalog() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB. Running read-only audit...\n');

  const products = await Product.find({}).sort({ createdAt: 1 }).lean();
  console.log(`Found ${products.length} products in database.\n`);

  const auditReport = [];
  const allGlobalSkus = new Map();
  const globalDuplicateSkus = [];
  const allImageUrlsToCheck = new Set();

  // First pass: collect all images to check URLs in parallel
  for (const p of products) {
    (p.images || []).forEach((img) => {
      if (img.url) allImageUrlsToCheck.add(img.url);
    });
    (p.variants || []).forEach((v) => {
      (v.images || []).forEach((u) => {
        if (u) allImageUrlsToCheck.add(u);
      });
    });
  }

  console.log(`Checking ${allImageUrlsToCheck.size} unique image URLs via HTTP HEAD...`);
  const urlCheckResults = new Map();
  const urlArray = Array.from(allImageUrlsToCheck);
  // Check in batches of 10
  for (let i = 0; i < urlArray.length; i += 10) {
    const chunk = urlArray.slice(i, i + 10);
    const results = await Promise.all(chunk.map((u) => checkUrl(u)));
    results.forEach((r) => urlCheckResults.set(r.url, r));
  }
  console.log('All URL checks completed.\n');

  for (const p of products) {
    const issues = [];
    const warnings = [];

    // 1. Status & Variants check
    const variantCount = p.variants?.length || 0;
    const activeVariants = (p.variants || []).filter((v) => v.isActive);
    const totalStock = p.priceSummary?.totalStock || 0;
    const minPrice = p.priceSummary?.minPrice || 0;
    const maxPrice = p.priceSummary?.maxPrice || 0;
    const minMrp = p.priceSummary?.minMrp || 0;
    const maxMrp = p.priceSummary?.maxMrp || 0;

    if (p.status === 'ACTIVE' && variantCount === 0) {
      issues.push('CRITICAL: Product is ACTIVE but has 0 variants.');
    }
    if (p.status === 'ACTIVE' && activeVariants.length === 0) {
      issues.push('CRITICAL: Product is ACTIVE but has 0 active variants.');
    }

    // 2. Images check
    const images = p.images || [];
    const imageCount = images.length;
    const primaryImages = images.filter((img) => img.isPrimary);
    let primaryImage = primaryImages[0] || null;

    if (p.status === 'ACTIVE' && imageCount === 0) {
      issues.push('CRITICAL: Product is ACTIVE but has 0 images.');
    }
    if (imageCount > 0 && primaryImages.length === 0) {
      issues.push('No image marked as isPrimary.');
    }
    if (primaryImages.length > 1) {
      warnings.push(`Multiple images marked as primary (${primaryImages.length}). Exactly 1 required for ACTIVE.`);
    }

    // Image attributes check
    const mediaIds = new Set();
    const mediaUrls = new Set();
    images.forEach((img, idx) => {
      if (!img.url) issues.push(`Image #${idx + 1} missing URL`);
      if (!img.alt || img.alt.trim() === '') warnings.push(`Image #${idx + 1} (${img.url}) has empty alt text.`);
      if (img.publicId && mediaIds.has(img.publicId)) warnings.push(`Duplicate publicId: ${img.publicId}`);
      if (img.publicId) mediaIds.add(img.publicId);
      if (mediaUrls.has(img.url)) warnings.push(`Duplicate image URL in product.images: ${img.url}`);
      mediaUrls.add(img.url);

      const urlRes = urlCheckResults.get(img.url);
      if (!urlRes || !urlRes.ok) {
        issues.push(`Broken image URL (${urlRes?.statusCode || urlRes?.error}): ${img.url}`);
      } else if (!img.url.includes('cloudinary.com')) {
        warnings.push(`Image URL is not hosted on Cloudinary: ${img.url}`);
      }
    });

    // 3. Variant integrity
    const pSkuSet = new Set();
    let calculatedStock = 0;
    const colorsPresentInVariants = new Set();
    const sizesPresentInVariants = new Set();

    (p.variants || []).forEach((v, idx) => {
      calculatedStock += v.inventory?.stock || 0;

      // SKU check
      if (!v.sku) {
        issues.push(`Variant #${idx + 1} has missing SKU.`);
      } else {
        if (pSkuSet.has(v.sku)) {
          issues.push(`Duplicate in-product SKU: ${v.sku}`);
        }
        pSkuSet.add(v.sku);

        if (allGlobalSkus.has(v.sku)) {
          globalDuplicateSkus.push({ sku: v.sku, products: [allGlobalSkus.get(v.sku), p.name] });
        } else {
          allGlobalSkus.set(v.sku, p.name);
        }
      }

      // Price check
      if (!v.price || v.price <= 0) issues.push(`Variant ${v.sku}: Invalid price (${v.price})`);
      if (!v.mrp || v.mrp <= 0) issues.push(`Variant ${v.sku}: Invalid MRP (${v.mrp})`);
      if (v.price > v.mrp) issues.push(`Variant ${v.sku}: Price (₹${v.price}) > MRP (₹${v.mrp})`);

      // Inventory check
      if (v.inventory?.stock < 0) issues.push(`Variant ${v.sku}: Negative stock (${v.inventory?.stock})`);

      // Attributes
      const col = v.attributes?.color?.name;
      const hex = v.attributes?.color?.hex;
      const sz = v.attributes?.size;
      if (col) colorsPresentInVariants.add(col);
      if (sz) sizesPresentInVariants.add(sz);

      // Variant images check
      (v.images || []).forEach((vUrl) => {
        const urlRes = urlCheckResults.get(vUrl);
        if (!urlRes || !urlRes.ok) {
          issues.push(`Variant ${v.sku} has broken image URL (${urlRes?.statusCode || urlRes?.error}): ${vUrl}`);
        }
      });
    });

    if (calculatedStock !== totalStock) {
      issues.push(`PriceSummary totalStock (${totalStock}) mismatch with sum of variant stock (${calculatedStock})`);
    }

    // 4. Colorway tagging consistency
    const imagesByColor = {};
    images.forEach((img) => {
      const c = img.color || 'Unassigned';
      imagesByColor[c] = (imagesByColor[c] || 0) + 1;
    });

    // Check specific requirements
    if (p.slug === 'vanta-retro-runner-sneakers') {
      const whiteV = (p.variants || []).filter((v) => v.attributes?.color?.name === 'White');
      const blackV = (p.variants || []).filter((v) => v.attributes?.color?.name === 'Black');
      const blackStock = blackV.reduce((s, v) => s + (v.inventory?.stock || 0), 0);
      if (whiteV.length !== 6) issues.push(`Vanta White variants expected 6, got ${whiteV.length}`);
      if (blackV.length !== 6) issues.push(`Vanta Black variants expected 6, got ${blackV.length}`);
      if (blackStock !== 0) issues.push(`Vanta Black inventory expected 0, got ${blackStock}`);
    }

    if (p.slug === 'stride-minimal-leather-loafers') {
      const blackV = (p.variants || []).filter((v) => v.attributes?.color?.name === 'Classic Black');
      const tanV = (p.variants || []).filter((v) => v.attributes?.color?.name === 'Warm Tan');
      if (blackV.length === 0 || tanV.length === 0) {
        warnings.push(`Stride Loafers missing Classic Black or Warm Tan variants (found colors: ${Array.from(colorsPresentInVariants).join(', ')})`);
      }
    }

    if (p.slug === 'nivelle-vitamin-c-brightening-serum') {
      if (imageCount !== 3) warnings.push(`Nivelle Serum expected 3 images, got ${imageCount}`);
    }

    if (p.slug === 'aurelia-structured-shoulder-bag') {
      const onyxV = (p.variants || []).filter((v) => v.attributes?.color?.name === 'Onyx Black');
      const caramelV = (p.variants || []).filter((v) => v.attributes?.color?.name === 'Caramel Tan');
      if (onyxV.length === 0 || caramelV.length === 0) {
        warnings.push(`Aurelia Bag missing Onyx Black or Caramel Tan variants (found colors: ${Array.from(colorsPresentInVariants).join(', ')})`);
      }
    }

    auditReport.push({
      id: p._id.toString(),
      name: p.name,
      slug: p.slug,
      status: p.status,
      variantCount,
      totalStock,
      price: minPrice === maxPrice ? `₹${minPrice}` : `₹${minPrice} - ₹${maxPrice}`,
      mrp: minMrp === maxMrp ? `₹${minMrp}` : `₹${minMrp} - ₹${maxMrp}`,
      imageCount,
      primaryImageUrl: primaryImage?.url || null,
      primaryImageAlt: primaryImage?.alt || null,
      primaryImageColor: primaryImage?.color || null,
      imagesByColor,
      colors: Array.from(colorsPresentInVariants),
      sizes: Array.from(sizesPresentInVariants),
      issues,
      warnings,
    });
  }

  console.log('--- AUDIT RESULTS SUMMARY ---');
  console.log(JSON.stringify(auditReport, null, 2));

  if (globalDuplicateSkus.length > 0) {
    console.error('\nGLOBAL DUPLICATE SKUS DETECTED:', globalDuplicateSkus);
  } else {
    console.log(`\nGlobal SKU uniqueness: PASS (${allGlobalSkus.size} unique SKUs, 0 duplicates)`);
  }

  await mongoose.disconnect();
}

auditCatalog().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
