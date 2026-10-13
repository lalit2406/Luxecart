import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Product from '../src/modules/products/product.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const TARGET_SLUGS = ['mirae-ribbed-knit-top', 'vanta-retro-runner-sneakers'];

async function runCleanup() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('ERROR: MONGODB_URI not found in environment.');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB successfully.\n');

  try {
    const backupDir = path.resolve(__dirname, '../backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // 1. Fetch targeted products
    const products = await Product.find({ slug: { $in: TARGET_SLUGS } });
    if (products.length !== TARGET_SLUGS.length) {
      console.warn(`WARNING: Found ${products.length} products matching target slugs (expected ${TARGET_SLUGS.length}).`);
    }

    // 2. Backup existing state before any modifications
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `products_backup_before_stale_images_cleanup_${timestamp}.json`);
    const backupData = products.map((p) => p.toObject());
    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf-8');
    console.log(`[BACKUP] Saved snapshot of ${products.length} products to:`);
    console.log(`         ${backupPath}\n`);

    let totalStaleRemovedAcrossCatalog = 0;
    let totalValidRetainedAcrossCatalog = 0;

    // 3. Process each product
    for (const product of products) {
      console.log(`========================================================================`);
      console.log(`Product: ${product.name} (${product.slug}) [ID: ${product._id}]`);
      console.log(`Status:  ${product.status}`);
      console.log(`========================================================================`);

      const productImages = product.images || [];
      const validProductUrls = new Set(productImages.map((img) => img.url).filter(Boolean));
      console.log(`Valid product.images count: ${validProductUrls.size}`);

      let productStaleRemoved = 0;
      let productValidRetained = 0;
      let productModified = false;

      (product.variants || []).forEach((v, idx) => {
        const initialImages = v.images || [];
        const validImages = initialImages.filter((u) => validProductUrls.has(u));
        const staleImages = initialImages.filter((u) => !validProductUrls.has(u));

        const colorName = v.attributes?.color?.name || 'Unassigned';
        const sizeName = v.attributes?.size || 'N/A';

        if (staleImages.length > 0) {
          productModified = true;
          productStaleRemoved += staleImages.length;
          v.images = validImages;
          console.log(
            `  Variant #${idx + 1} (${v.sku}) [${colorName} / ${sizeName}]: ` +
            `Removed ${staleImages.length} stale reference(s), Retained ${validImages.length} valid reference(s)`
          );
          staleImages.forEach((staleUrl) => {
            console.log(`    - STALE REMOVED: ${staleUrl}`);
          });
        } else {
          console.log(
            `  Variant #${idx + 1} (${v.sku}) [${colorName} / ${sizeName}]: ` +
            `Clean (0 stale, ${validImages.length} valid retained)`
          );
        }

        productValidRetained += validImages.length;
      });

      if (productModified) {
        // Mark modified and save
        product.markModified('variants');
        await product.save();
        console.log(`\n>> [SAVED] Successfully updated ${product.name} in MongoDB.`);
      } else {
        console.log(`\n>> [IDEMPOTENT] No stale references found. No database write needed.`);
      }

      console.log(`Summary for ${product.name}:`);
      console.log(`  Stale references removed: ${productStaleRemoved}`);
      console.log(`  Valid references retained: ${productValidRetained}\n`);

      totalStaleRemovedAcrossCatalog += productStaleRemoved;
      totalValidRetainedAcrossCatalog += productValidRetained;
    }

    console.log(`========================================================================`);
    console.log(`OVERALL CLEANUP SUMMARY:`);
    console.log(`  Total stale references removed: ${totalStaleRemovedAcrossCatalog}`);
    console.log(`  Total valid references retained: ${totalValidRetainedAcrossCatalog}`);
    console.log(`========================================================================\n`);

  } catch (err) {
    console.error('ERROR during cleanup:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB disconnected.');
  }
}

runCleanup();
