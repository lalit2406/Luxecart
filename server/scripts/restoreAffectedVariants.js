import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Product from '../src/modules/products/product.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const CANONICAL_CONFIGS = [
  {
    productId: '6ac6539d1301d7776aa3917b',
    name: 'Élané Satin Midi Dress',
    price: 2099,
    mrp: 3499,
    baseStock: 15,
    colors: [
      { code: 'BLK', name: 'Midnight Black', hex: '#111111' },
      { code: 'WIN', name: 'Deep Wine', hex: '#4A1525' },
      { code: 'CHP', name: 'Champagne', hex: '#F7E7CE' },
    ],
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    skuGenerator: (col, sz) => `ELA-DRS-001-${col}-${sz}`,
  },
  {
    productId: '6ac6539d1301d7776aa3918b',
    name: 'Miraé Ribbed Knit Top',
    price: 899,
    mrp: 1499,
    baseStock: 20,
    colors: [
      { code: 'CRM', name: 'Cream', hex: '#FFFDD0' },
      { code: 'MCH', name: 'Mocha', hex: '#493829' },
      { code: 'BLK', name: 'Black', hex: '#000000' },
    ],
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    skuGenerator: (col, sz) => `MIR-TOP-001-${col}-${sz}`,
  },
  {
    productId: '6ac6539e1301d7776aa3919b',
    name: 'Nivara Printed Kurta Set',
    price: 1799,
    mrp: 2999,
    baseStock: 14,
    colors: [
      { code: 'GRN', name: 'Sage Green', hex: '#9CAF88' },
      { code: 'PNK', name: 'Rose Pink', hex: '#C97A8E' },
    ],
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    skuGenerator: (col, sz) => `NIV-KUR-001-${col}-${sz}`,
  },
];

async function restoreVariants() {
  console.log('--- STARTING SAFE VARIANT RESTORATION FOR AFFECTED PRODUCTS ---');
  await mongoose.connect(process.env.MONGODB_URI);

  for (const config of CANONICAL_CONFIGS) {
    const product = await Product.findById(config.productId);
    if (!product) {
      console.warn(`[WARN] Product ${config.name} (${config.productId}) not found in database.`);
      continue;
    }

    // Only restore if variants are missing or 0
    if (product.variants && product.variants.length > 0) {
      console.log(`[SKIP] Product ${product.name} already has ${product.variants.length} variants. Preserving.`);
      continue;
    }

    console.log(`\nRestoring variants for: ${product.name} (${product._id})...`);
    const newVariants = [];

    // Map existing product images by color
    const imagesByColor = {};
    (product.images || []).forEach((img) => {
      if (img.color && img.url) {
        const cLower = img.color.toLowerCase();
        imagesByColor[cLower] = imagesByColor[cLower] || [];
        imagesByColor[cLower].push(img.url);
      }
    });

    for (const col of config.colors) {
      for (const sz of config.sizes) {
        const sku = config.skuGenerator(col.code, sz).toUpperCase();
        const stock = Math.max(10, Math.min(25, config.baseStock + ((sku.length % 5) - 2)));
        const colorImgs = imagesByColor[col.name.toLowerCase()] || [];

        newVariants.push({
          sku,
          attributes: {
            color: { name: col.name, hex: col.hex },
            size: sz,
            custom: {},
          },
          price: config.price,
          mrp: config.mrp,
          inventory: {
            stock,
            reserved: 0,
            lowStockThreshold: 5,
          },
          weightInGrams: 280,
          dimensionsInCm: { length: 30, width: 25, height: 3 },
          images: colorImgs,
          isActive: true,
        });
      }
    }

    product.variants = newVariants;
    await product.save();

    console.log(`✔ Restored ${newVariants.length} variants for ${product.name}.`);
    console.log(`  MinPrice: ₹${product.priceSummary.minPrice}, TotalStock: ${product.priceSummary.totalStock} units, Status: ${product.status}`);
  }

  // Verification step across all 12 products
  console.log('\n--- VERIFYING ALL CATALOG PRODUCTS AFTER RESTORATION ---');
  const allProducts = await Product.find({}).lean();
  const allSkus = new Set();
  let duplicateCount = 0;

  for (const p of allProducts) {
    const vCount = p.variants?.length || 0;
    const stock = p.priceSummary?.totalStock || 0;
    const imgCount = p.images?.length || 0;
    console.log(`[${p.status}] ${p.name}: ${vCount} variants, ${stock} stock units, ${imgCount} images, MinPrice: ₹${p.priceSummary?.minPrice}`);

    (p.variants || []).forEach((v) => {
      if (allSkus.has(v.sku)) {
        console.error(`  [DUPLICATE SKU DETECTED]: ${v.sku}`);
        duplicateCount++;
      }
      allSkus.add(v.sku);
    });
  }

  console.log(`\nCatalog verification complete: ${allProducts.length} products, ${allSkus.size} unique SKUs, ${duplicateCount} duplicates.`);
  await mongoose.disconnect();
}

restoreVariants().catch((err) => {
  console.error('Restoration failed:', err);
  process.exit(1);
});
