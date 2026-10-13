import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Product from '../src/modules/products/product.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SIZES = ['6', '7', '8', '9', '10', '11'];
const PRODUCT_SLUG = 'vanta-retro-runner-sneakers';

async function migrateVantaColorways() {
  console.log('====================================================');
  console.log('VANTA RETRO RUNNER SNEAKERS COLORWAY SPLIT MIGRATION');
  console.log('====================================================\n');

  await mongoose.connect(process.env.MONGODB_URI);

  const product = await Product.findOne({ slug: PRODUCT_SLUG });
  if (!product) {
    throw new Error(`Product with slug '${PRODUCT_SLUG}' not found.`);
  }

  console.log(`Product: "${product.name}" (${product._id})`);
  console.log(`Current Variants Count: ${product.variants.length}`);
  console.log(`Current Total Stock: ${product.priceSummary?.totalStock} units`);

  // Check if already migrated
  const whiteVariants = product.variants.filter(
    (v) => v.attributes?.color?.name?.toLowerCase() === 'white'
  );
  const blackVariants = product.variants.filter(
    (v) => v.attributes?.color?.name?.toLowerCase() === 'black'
  );

  if (whiteVariants.length === 6 && blackVariants.length === 6 && product.variants.length === 12) {
    console.log('\n✔ Product already has 12 variants (6 White, 6 Black). Migration has already been applied.');
    await mongoose.disconnect();
    return;
  }

  // Backup current document before mutation
  const backupDir = path.join(__dirname, '../backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `vanta_backup_${Date.now()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(product.toObject(), null, 2));
  console.log(`✔ Verified backup saved to: ${backupPath}\n`);

  // Map existing stock by size from current variants
  const stockBySize = {};
  const existingImagesBySize = {};
  product.variants.forEach((v) => {
    const size = v.attributes?.size;
    if (size) {
      stockBySize[size] = v.inventory?.stock ?? 12;
      existingImagesBySize[size] = v.images || [];
    }
  });

  console.log('Existing stock per size from current White/Black variants:');
  console.log(stockBySize);

  // Collect image URLs from existing product images
  const whiteImageUrls = (product.images || []).map((img) => img.url).filter(Boolean);

  // 1. Construct 6 White variants
  const newWhiteVariants = SIZES.map((size) => {
    const stock = stockBySize[size] !== undefined ? stockBySize[size] : 12;
    return {
      sku: `VAN-RUN-001-WHT-${size}`,
      barcode: null,
      attributes: {
        color: {
          name: 'White',
          hex: '#FFFFFF',
        },
        size,
        custom: {},
      },
      price: product.priceSummary?.minPrice || 2499,
      mrp: product.priceSummary?.minMrp || 3999,
      inventory: {
        stock,
        reserved: 0,
        lowStockThreshold: 5,
      },
      weightInGrams: 280,
      dimensionsInCm: { length: 30, width: 25, height: 3 },
      images: existingImagesBySize[size] && existingImagesBySize[size].length > 0
        ? existingImagesBySize[size]
        : whiteImageUrls,
      isActive: true,
    };
  });

  // 2. Construct 6 Black variants
  // Requirement 8: Initialize to zero and clearly report that it requires confirmation before sale.
  const newBlackVariants = SIZES.map((size) => {
    return {
      sku: `VAN-RUN-001-BLK-${size}`,
      barcode: null,
      attributes: {
        color: {
          name: 'Black',
          hex: '#000000',
        },
        size,
        custom: {},
      },
      price: product.priceSummary?.minPrice || 2499,
      mrp: product.priceSummary?.minMrp || 3999,
      inventory: {
        stock: 0, // Unallocated until physical inventory arrival confirmation
        reserved: 0,
        lowStockThreshold: 5,
      },
      weightInGrams: 280,
      dimensionsInCm: { length: 30, width: 25, height: 3 },
      images: [], // Pending Black colorway photography
      isActive: true,
    };
  });

  const combinedVariants = [...newWhiteVariants, ...newBlackVariants];

  // 3. Update existing product images to be tagged as "White"
  if (product.images && product.images.length > 0) {
    product.images.forEach((img) => {
      img.color = 'White';
      if (img.alt && img.alt.includes('White / Black')) {
        img.alt = img.alt.replace('White / Black', 'White');
      }
    });
  }

  // 4. Assign combined variants to product
  product.variants = combinedVariants;

  await product.save();

  console.log('\n====================================================');
  console.log('MIGRATION COMPLETED SUCCESSFULLY');
  console.log('====================================================');
  console.log(`Product: ${product.name}`);
  console.log(`Total Variants: ${product.variants.length}`);
  console.log(`White Variants: ${newWhiteVariants.length} (Total Stock: ${newWhiteVariants.reduce((a, b) => a + b.inventory.stock, 0)} units)`);
  console.log(`Black Variants: ${newBlackVariants.length} (Total Stock: ${newBlackVariants.reduce((a, b) => a + b.inventory.stock, 0)} units)`);
  console.log(`Catalog Total Stock: ${product.priceSummary?.totalStock} units`);
  console.log(`Price Summary: Min ₹${product.priceSummary?.minPrice} | Max ₹${product.priceSummary?.maxPrice} | MRP ₹${product.priceSummary?.minMrp}`);
  console.log('\nVariants Detail:');
  product.variants.forEach((v) => {
    console.log(` - SKU: ${v.sku.padEnd(20)} | Color: ${v.attributes.color.name.padEnd(7)} (${v.attributes.color.hex}) | Size: ${v.attributes.size.padEnd(3)} | Stock: ${v.inventory.stock} | Images: ${v.images.length}`);
  });

  await mongoose.disconnect();
}

migrateVantaColorways().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
