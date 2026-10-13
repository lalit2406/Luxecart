import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { config } from '../src/config/env.js';
import { connectDB, disconnectDB } from '../src/config/database.js';

import Category from '../src/modules/categories/category.model.js';
import Product from '../src/modules/products/product.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const mongoUri = process.env.MONGODB_URI || config.mongoUri || 'mongodb://localhost:27017/luxecart';

/**
 * Child Categories definitions required for the initial 12 launch products
 */
const CHILD_CATEGORIES = [
  // MEN > Apparel
  {
    name: 'Apparel',
    slug: 'mens-apparel',
    parentSlug: 'men',
    description: 'Men’s tailoring, casual wear, and wardrobe essentials.',
    displayOrder: 1,
  },
  // MEN > Apparel > Subcategories
  {
    name: 'T-Shirts',
    slug: 'mens-t-shirts',
    parentSlug: 'mens-apparel',
    description: 'Premium heavyweight cotton, oversized, and essential t-shirts.',
    displayOrder: 1,
  },
  {
    name: 'Shirts',
    slug: 'mens-shirts',
    parentSlug: 'mens-apparel',
    description: 'Smart casual Oxford shirts, relaxed linen blends, and formal shirts.',
    displayOrder: 2,
  },
  {
    name: 'Jeans',
    slug: 'mens-jeans',
    parentSlug: 'mens-apparel',
    description: 'Straight-fit denim, comfort stretch, and modern washes.',
    displayOrder: 3,
  },

  // WOMEN > Apparel
  {
    name: 'Apparel',
    slug: 'womens-apparel',
    parentSlug: 'women',
    description: 'Women’s dresses, evening wear, tops, ethnic sets, and trousers.',
    displayOrder: 1,
  },
  // WOMEN > Apparel > Subcategories
  {
    name: 'Dresses',
    slug: 'womens-dresses',
    parentSlug: 'womens-apparel',
    description: 'Fluid satin midi dresses, evening gowns, and occasion wear.',
    displayOrder: 1,
  },
  {
    name: 'Tops',
    slug: 'womens-tops',
    parentSlug: 'womens-apparel',
    description: 'Ribbed knit tops, blouses, and everyday essentials.',
    displayOrder: 2,
  },
  {
    name: 'Kurta Sets',
    slug: 'womens-kurta-sets',
    parentSlug: 'womens-apparel',
    description: 'Contemporary ethnic kurta sets and celebratory ensembles.',
    displayOrder: 3,
  },
  {
    name: 'Trousers',
    slug: 'womens-trousers',
    parentSlug: 'womens-apparel',
    description: 'Tailored wide-leg trousers, office essentials, and contemporary pants.',
    displayOrder: 4,
  },

  // FOOTWEAR
  {
    name: 'Sneakers',
    slug: 'sneakers',
    parentSlug: 'footwear',
    description: 'Retro runner sneakers, lifestyle trainers, and urban street footwear.',
    displayOrder: 1,
  },
  {
    name: 'Loafers',
    slug: 'loafers',
    parentSlug: 'footwear',
    description: 'Minimal faux leather loafers, driver shoes, and office slip-ons.',
    displayOrder: 2,
  },

  // BEAUTY > Skincare > Face Serum
  {
    name: 'Skincare',
    slug: 'skincare',
    parentSlug: 'beauty',
    description: 'Facial serums, hydration treatments, and daily skincare rituals.',
    displayOrder: 1,
  },
  {
    name: 'Face Serum',
    slug: 'face-serum',
    parentSlug: 'skincare',
    description: 'Brightening vitamin C serums and daily antioxidant facial solutions.',
    displayOrder: 1,
  },

  // ACCESSORIES > Bags > Shoulder Bags
  {
    name: 'Bags',
    slug: 'bags',
    parentSlug: 'accessories',
    description: 'Handcrafted handbags, structured totes, and everyday carriers.',
    displayOrder: 1,
  },
  {
    name: 'Shoulder Bags',
    slug: 'shoulder-bags',
    parentSlug: 'bags',
    description: 'Structured vegan leather shoulder bags and evening carryalls.',
    displayOrder: 1,
  },
];

/**
 * 12 Premium Launch Products Raw Definitions
 */
const PRODUCTS_DATA = [
  // PRODUCT 01
  {
    name: 'Aurelio Essential Oversized T-Shirt',
    slug: 'aurelio-essential-oversized-t-shirt',
    brand: 'Aurelio',
    categorySlug: 'mens-t-shirts',
    gender: 'MEN',
    shortDescription: 'Heavyweight cotton oversized tee with dropped shoulders and a relaxed streetwear silhouette.',
    description: 'A heavyweight cotton oversized T-shirt designed with a relaxed silhouette, dropped shoulders and a clean minimal finish. The versatile shape works equally well with denim, trousers or relaxed shorts.',
    tags: ['oversized', 'cotton', 'streetwear', 'casual', 'everyday'],
    specifications: [
      { name: 'Material', value: 'Heavyweight cotton (240 GSM)' },
      { name: 'Fit', value: 'Oversized Relaxed' },
      { name: 'Neckline', value: 'Ribbed Crew Neck' },
      { name: 'Sleeve', value: 'Half Sleeve' },
      { name: 'Country of Origin', value: 'India' },
    ],
    price: 899,
    mrp: 1499,
    colors: [
      { code: 'BLK', name: 'Jet Black', hex: '#0A0A0A' },
      { code: 'WHT', name: 'Off White', hex: '#FAF9F6' },
      { code: 'GRY', name: 'Stone Grey', hex: '#878787' },
    ],
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    skuGenerator: (col, sz) => `AUR-TEE-001-${col}-${sz}`,
    baseStock: 18,
  },

  // PRODUCT 02
  {
    name: 'Northline Oxford Casual Shirt',
    slug: 'northline-oxford-casual-shirt',
    brand: 'Northline',
    categorySlug: 'mens-shirts',
    gender: 'MEN',
    shortDescription: 'Refined Oxford cotton shirt featuring a structured button-down collar and relaxed contemporary cut.',
    description: 'A refined Oxford shirt combining a structured collar, breathable cotton construction and a relaxed contemporary fit. Designed for effortless weekday and weekend dressing.',
    tags: ['oxford', 'shirt', 'smart casual', 'cotton', 'formal casual'],
    specifications: [
      { name: 'Material', value: '100% Cotton Oxford Weave' },
      { name: 'Fit', value: 'Relaxed Tailored' },
      { name: 'Collar', value: 'Button-Down Collar' },
      { name: 'Sleeve', value: 'Full Sleeve with Barrel Cuffs' },
      { name: 'Country of Origin', value: 'India' },
    ],
    price: 1499,
    mrp: 2499,
    colors: [
      { code: 'WHT', name: 'Cloud White', hex: '#F8F9FA' },
      { code: 'BLU', name: 'Sky Blue', hex: '#87CEEB' },
    ],
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    skuGenerator: (col, sz) => `NOR-SHT-001-${col}-${sz}`,
    baseStock: 16,
  },

  // PRODUCT 03
  {
    name: 'Veyron Relaxed Linen Shirt',
    slug: 'veyron-relaxed-linen-shirt',
    brand: 'Veyron',
    categorySlug: 'mens-shirts',
    gender: 'MEN',
    shortDescription: 'Lightweight breathable linen-cotton shirt with a relaxed resort silhouette and textured weave.',
    description: 'A lightweight linen-blend shirt with a relaxed silhouette and understated texture. Designed for warm-weather dressing and effortless layering.',
    tags: ['linen', 'summer', 'resort', 'relaxed', 'premium'],
    specifications: [
      { name: 'Material', value: '55% Linen, 45% Organic Cotton' },
      { name: 'Fit', value: 'Relaxed Resort' },
      { name: 'Collar', value: 'Cuban Resort Collar' },
      { name: 'Sleeve', value: 'Full Sleeve' },
      { name: 'Country of Origin', value: 'India' },
    ],
    price: 1699,
    mrp: 2799,
    colors: [
      { code: 'SND', name: 'Sand', hex: '#C2B280' },
      { code: 'OLV', name: 'Olive', hex: '#556B2F' },
    ],
    sizes: ['S', 'M', 'L', 'XL'],
    skuGenerator: (col, sz) => `VEY-LIN-001-${col}-${sz}`,
    baseStock: 14,
  },

  // PRODUCT 04
  {
    name: 'Urban Form Straight Fit Denim',
    slug: 'urban-form-straight-fit-denim',
    brand: 'Urban Form',
    categorySlug: 'mens-jeans',
    gender: 'MEN',
    shortDescription: 'Comfort-stretch straight-fit jeans with a classic mid-rise and versatile wash.',
    description: 'Straight-fit denim with a clean leg profile, subtle wash and comfortable stretch construction. Built as an everyday wardrobe essential.',
    tags: ['denim', 'jeans', 'straight fit', 'casual', 'everyday'],
    specifications: [
      { name: 'Material', value: '98% Cotton Denim, 2% Elastane' },
      { name: 'Fit', value: 'Straight Fit' },
      { name: 'Rise', value: 'Mid Rise' },
      { name: 'Closure', value: 'Zip Fly with Shank Button' },
      { name: 'Country of Origin', value: 'India' },
    ],
    price: 1899,
    mrp: 2999,
    colors: [
      { code: 'IND', name: 'Dark Indigo', hex: '#1A2B4C' },
      { code: 'BLU', name: 'Washed Blue', hex: '#5B7C99' },
    ],
    sizes: ['28', '30', '32', '34', '36', '38'],
    skuGenerator: (col, sz) => `UFM-DNM-001-${col}-${sz}`,
    baseStock: 15,
  },

  // PRODUCT 05
  {
    name: 'Élané Satin Midi Dress',
    slug: 'elane-satin-midi-dress',
    brand: 'Élané',
    categorySlug: 'womens-dresses',
    gender: 'WOMEN',
    shortDescription: 'Fluid satin midi dress featuring a subtle luster, bias-cut drape, and elegant neckline.',
    description: 'A fluid satin midi dress designed with a flattering silhouette and subtle sheen. The minimal design transitions easily from evening dinners to special occasions.',
    tags: ['dress', 'satin', 'evening', 'occasion', 'elegant'],
    specifications: [
      { name: 'Material', value: 'Heavy Liquid Satin Polyester' },
      { name: 'Fit', value: 'Bias-Cut Regular' },
      { name: 'Length', value: 'Midi (Below Knee)' },
      { name: 'Lining', value: 'Soft Tone-on-Tone Lining' },
      { name: 'Country of Origin', value: 'India' },
    ],
    price: 2099,
    mrp: 3499,
    colors: [
      { code: 'BLK', name: 'Midnight Black', hex: '#111111' },
      { code: 'WIN', name: 'Deep Wine', hex: '#4A1525' },
      { code: 'CHP', name: 'Champagne', hex: '#F7E7CE' },
    ],
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    skuGenerator: (col, sz) => `ELA-DRS-001-${col}-${sz}`,
    baseStock: 15,
  },

  // PRODUCT 06
  {
    name: 'Miraé Ribbed Knit Top',
    slug: 'mirae-ribbed-knit-top',
    brand: 'Miraé',
    categorySlug: 'womens-tops',
    gender: 'WOMEN',
    shortDescription: 'Soft stretch ribbed knit top tailored with a clean fitted profile and versatile crew neckline.',
    description: 'A soft ribbed knit top with a clean fitted silhouette and versatile neckline. Designed to pair effortlessly with denim, tailored trousers and skirts.',
    tags: ['ribbed', 'knit', 'top', 'minimal', 'casual'],
    specifications: [
      { name: 'Material', value: '80% Viscose, 20% Nylon Ribbed Knit' },
      { name: 'Fit', value: 'Fitted' },
      { name: 'Neckline', value: 'Jewel Crew Neck' },
      { name: 'Sleeve', value: 'Elbow Length' },
      { name: 'Country of Origin', value: 'India' },
    ],
    price: 899,
    mrp: 1499,
    colors: [
      { code: 'CRM', name: 'Cream', hex: '#FFFDD0' },
      { code: 'MCH', name: 'Mocha', hex: '#493829' },
      { code: 'BLK', name: 'Black', hex: '#000000' },
    ],
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    skuGenerator: (col, sz) => `MIR-TOP-001-${col}-${sz}`,
    baseStock: 20,
  },

  // PRODUCT 07
  {
    name: 'Nivara Printed Kurta Set',
    slug: 'nivara-printed-kurta-set',
    brand: 'Nivara',
    categorySlug: 'womens-kurta-sets',
    gender: 'WOMEN',
    shortDescription: 'Contemporary botanical print kurta set with matching straight trousers and delicate border accents.',
    description: 'A contemporary printed kurta set combining an easy silhouette with subtle botanical detailing. Designed for festive gatherings, casual celebrations and everyday ethnic dressing.',
    tags: ['kurta', 'ethnic', 'indian wear', 'printed', 'festive'],
    specifications: [
      { name: 'Material', value: 'Fine Cotton Silk Blend' },
      { name: 'Fit', value: 'Regular Comfort' },
      { name: 'Set Includes', value: 'Straight Kurta and Cropped Trousers' },
      { name: 'Work / Print', value: 'Subtle Botanical Block Print' },
      { name: 'Country of Origin', value: 'India' },
    ],
    price: 1799,
    mrp: 2999,
    colors: [
      { code: 'GRN', name: 'Sage Green', hex: '#9CAF88' },
      { code: 'PNK', name: 'Rose Pink', hex: '#C97A8E' },
    ],
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    skuGenerator: (col, sz) => `NIV-KUR-001-${col}-${sz}`,
    baseStock: 14,
  },

  // PRODUCT 08
  {
    name: 'Velora Wide-Leg Trousers',
    slug: 'velora-wide-leg-trousers',
    brand: 'Velora',
    categorySlug: 'womens-trousers',
    gender: 'WOMEN',
    shortDescription: 'Tailored high-rise wide-leg trousers crafted with a fluid poly-viscose drape.',
    description: 'High-rise wide-leg trousers with a fluid drape and clean tailored finish. Designed for polished everyday styling with shirts, tops and structured outerwear.',
    tags: ['trousers', 'wide leg', 'tailored', 'office', 'contemporary'],
    specifications: [
      { name: 'Material', value: 'Poly-viscose blend with stretch' },
      { name: 'Fit', value: 'Wide Leg' },
      { name: 'Rise', value: 'High Rise' },
      { name: 'Pockets', value: 'Side Slant Pockets' },
      { name: 'Country of Origin', value: 'India' },
    ],
    price: 1499,
    mrp: 2499,
    colors: [
      { code: 'BGE', name: 'Warm Beige', hex: '#D8BC9D' },
      { code: 'CHR', name: 'Charcoal', hex: '#36454F' },
    ],
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    skuGenerator: (col, sz) => `VEL-TRS-001-${col}-${sz}`,
    baseStock: 16,
  },

  // PRODUCT 09
  {
    name: 'Vanta Retro Runner Sneakers',
    slug: 'vanta-retro-runner-sneakers',
    brand: 'Vanta',
    categorySlug: 'sneakers',
    gender: 'UNISEX',
    shortDescription: 'Retro runner sneakers featuring layered tonal paneling and cushioned EVA sole.',
    description: 'A retro-inspired everyday sneaker featuring layered panels, a cushioned footbed and a clean contemporary profile. Designed for casual city wear.',
    tags: ['sneakers', 'runners', 'streetwear', 'casual', 'lifestyle'],
    specifications: [
      { name: 'Upper Material', value: 'Synthetic Suede, Vegan Leather & Breathable Mesh' },
      { name: 'Sole', value: 'Lightweight Cushioned EVA with Rubber Grip' },
      { name: 'Closure', value: 'Lace-Up' },
      { name: 'Toe Shape', value: 'Round Toe' },
      { name: 'Country of Origin', value: 'India' },
    ],
    price: 2499,
    mrp: 3999,
    colors: [
      { code: 'WHT', name: 'White', hex: '#FFFFFF' },
      { code: 'BLK', name: 'Black', hex: '#000000' },
    ],
    sizes: ['6', '7', '8', '9', '10', '11'],
    skuGenerator: (col, sz) => `VAN-RUN-001-${col}-${sz}`,
    baseStock: 12,
  },

  // PRODUCT 10
  {
    name: 'Stride Minimal Leather Loafers',
    slug: 'stride-minimal-leather-loafers',
    brand: 'Stride',
    categorySlug: 'loafers',
    gender: 'WOMEN',
    shortDescription: 'Sleek minimal loafers crafted with premium faux leather and understated metal trim.',
    description: 'A clean-profile loafer designed with a softly structured upper and understated metal detailing. Ideal for office styling and elevated everyday outfits.',
    tags: ['loafers', 'footwear', 'office', 'minimal', 'premium'],
    specifications: [
      { name: 'Upper Material', value: 'Premium Synthetic Leather' },
      { name: 'Insole', value: 'Padded Foam Comfort Cushioning' },
      { name: 'Outsole', value: 'Non-Slip Flexible TPR' },
      { name: 'Heel Height', value: '2 cm Low Block Heel' },
      { name: 'Country of Origin', value: 'India' },
    ],
    price: 2299,
    mrp: 3799,
    colors: [
      { code: 'BLK', name: 'Classic Black', hex: '#1A1A1A' },
      { code: 'TAN', name: 'Warm Tan', hex: '#B5651D' },
    ],
    sizes: ['4', '5', '6', '7', '8'],
    skuGenerator: (col, sz) => `STR-LOA-001-${col}-${sz}`,
    baseStock: 12,
  },

  // PRODUCT 11
  {
    name: 'Nivelle Vitamin C Brightening Serum',
    slug: 'nivelle-vitamin-c-brightening-serum',
    brand: 'Nivelle',
    categorySlug: 'face-serum',
    gender: 'UNISEX',
    shortDescription: 'Lightweight daily facial serum crafted for a radiant, balanced complexion.',
    description: 'A lightweight daily facial serum formulated around a brightening skincare routine. The fast-absorbing texture is designed to layer comfortably under moisturizer and sunscreen.',
    tags: ['serum', 'skincare', 'vitamin c', 'face care', 'beauty'],
    specifications: [
      { name: 'Key Formulation', value: '10% Ethyl Ascorbic Acid, Ferulic Acid & Hyaluronic Acid' },
      { name: 'Form', value: 'Non-Greasy Liquid Dropper Serum' },
      { name: 'Volume', value: '30 ml / 1.0 fl. oz.' },
      { name: 'Skin Compatibility', value: 'Suitable for All Skin Types' },
      { name: 'Country of Origin', value: 'India' },
    ],
    price: 699,
    mrp: 999,
    colors: [],
    sizes: ['30 ml'],
    skuGenerator: () => `NIV-SRM-001-30ML`,
    baseStock: 30,
    singleVariant: true,
  },

  // PRODUCT 12
  {
    name: 'Aurelia Structured Shoulder Bag',
    slug: 'aurelia-structured-shoulder-bag',
    brand: 'Aurelia',
    categorySlug: 'shoulder-bags',
    gender: 'WOMEN',
    shortDescription: 'Structured vegan leather shoulder bag with sleek rectangular geometry and refined gold hardware.',
    description: 'A structured shoulder bag with a clean rectangular silhouette, polished hardware and enough interior space for everyday essentials. Designed to transition from workdays to evening plans.',
    tags: ['handbag', 'shoulder bag', 'accessory', 'premium', 'everyday'],
    specifications: [
      { name: 'Material', value: 'Premium Smooth Vegan Leather' },
      { name: 'Hardware', value: 'Brushed Light-Gold Tone Metal' },
      { name: 'Closure', value: 'Secure Top Zip with Flap Magnet' },
      { name: 'Dimensions', value: '26 cm (W) x 15 cm (H) x 7 cm (D)' },
      { name: 'Strap', value: 'Adjustable Shoulder Strap (48 cm drop)' },
      { name: 'Country of Origin', value: 'India' },
    ],
    price: 2299,
    mrp: 3999,
    colors: [
      { code: 'BLK', name: 'Onyx Black', hex: '#0F0F0F' },
      { code: 'TAN', name: 'Caramel Tan', hex: '#A75D28' },
    ],
    sizes: ['One Size'],
    skuGenerator: (col) => `AUR-BAG-001-${col}`,
    baseStock: 20,
    onePerColor: true,
  },
];

export async function seedRealCatalog() {
  console.log('\n================================================================');
  console.log('  LuxeCart — REAL LAUNCH CATALOG INITIALIZATION (PHASE 1)');
  console.log('================================================================\n');

  await connectDB(mongoUri);
  const dbName = mongoose.connection.db.databaseName;
  console.log(`Connected Database: ${dbName}\n`);

  // -------------------------------------------------------------
  // STEP 1: RESOLVE & CREATE CHILD CATEGORY HIERARCHY
  // -------------------------------------------------------------
  console.log('--- RESOLVING CATEGORY HIERARCHY ---');
  const categoryMap = new Map();

  // Load existing root categories
  const allExistingCategories = await Category.find({}).lean();
  for (const c of allExistingCategories) {
    categoryMap.set(c.slug, c);
  }

  // Create child categories sequentially to ensure parent ancestors are resolved
  for (const childDef of CHILD_CATEGORIES) {
    let catDoc = await Category.findOne({ slug: childDef.slug });
    const parentCat = categoryMap.get(childDef.parentSlug) || (await Category.findOne({ slug: childDef.parentSlug }).lean());

    if (!parentCat) {
      throw new Error(`Parent category '${childDef.parentSlug}' not found for child '${childDef.slug}'.`);
    }

    const ancestors = [
      ...(parentCat.ancestors || []),
      {
        _id: parentCat._id,
        name: parentCat.name,
        slug: parentCat.slug,
      },
    ];

    const level = (parentCat.level || 0) + 1;

    if (!catDoc) {
      catDoc = await Category.create({
        name: childDef.name,
        slug: childDef.slug,
        description: childDef.description,
        parentId: parentCat._id,
        ancestors,
        level,
        displayOrder: childDef.displayOrder,
        isActive: true,
        isFeatured: false,
      });
      console.log(`✔ Created child category: "${catDoc.name}" (${catDoc.slug}, Level: ${level})`);
    } else {
      catDoc.name = childDef.name;
      catDoc.description = childDef.description;
      catDoc.parentId = parentCat._id;
      catDoc.ancestors = ancestors;
      catDoc.level = level;
      catDoc.isActive = true;
      await catDoc.save();
      console.log(`✔ Updated category: "${catDoc.name}" (${catDoc.slug}, Level: ${level})`);
    }

    categoryMap.set(catDoc.slug, catDoc);
  }

  // -------------------------------------------------------------
  // STEP 2: BUILD & INSERT THE 12 LAUNCH PRODUCTS
  // -------------------------------------------------------------
  console.log('\n--- SEEDING 12 PREMIUM LAUNCH PRODUCTS (STATUS: DRAFT) ---');

  const createdProducts = [];
  const globalSkuSet = new Set();

  for (const pDef of PRODUCTS_DATA) {
    const leafCategory = categoryMap.get(pDef.categorySlug) || (await Category.findOne({ slug: pDef.categorySlug }));
    if (!leafCategory) {
      throw new Error(`Category with slug '${pDef.categorySlug}' not found for product '${pDef.name}'.`);
    }

    const categoryTree = [
      ...(leafCategory.ancestors || []).map((a) => a._id),
      leafCategory._id,
    ];

    // Generate variants
    const variants = [];

    if (pDef.singleVariant) {
      // Single variant (e.g. 30 ml Face Serum)
      const sku = pDef.skuGenerator().toUpperCase();
      if (globalSkuSet.has(sku)) {
        throw new Error(`Duplicate global SKU detected: ${sku}`);
      }
      globalSkuSet.add(sku);

      variants.push({
        sku,
        attributes: {
          color: { name: '', hex: '' },
          size: pDef.sizes[0] || 'Standard',
          custom: {},
        },
        price: pDef.price,
        mrp: pDef.mrp,
        inventory: {
          stock: pDef.baseStock,
          reserved: 0,
          lowStockThreshold: 5,
        },
        weightInGrams: 100,
        dimensionsInCm: { length: 5, width: 5, height: 12 },
        images: [],
        isActive: true,
      });
    } else if (pDef.onePerColor) {
      // One variant per color (e.g. Bag with one standard size per color)
      for (const col of pDef.colors) {
        const sku = pDef.skuGenerator(col.code).toUpperCase();
        if (globalSkuSet.has(sku)) {
          throw new Error(`Duplicate global SKU detected: ${sku}`);
        }
        globalSkuSet.add(sku);

        variants.push({
          sku,
          attributes: {
            color: { name: col.name, hex: col.hex },
            size: pDef.sizes[0] || 'One Size',
            custom: {},
          },
          price: pDef.price,
          mrp: pDef.mrp,
          inventory: {
            stock: pDef.baseStock,
            reserved: 0,
            lowStockThreshold: 5,
          },
          weightInGrams: 450,
          dimensionsInCm: { length: 26, width: 7, height: 15 },
          images: [],
          isActive: true,
        });
      }
    } else {
      // Color x Size matrix
      for (const col of pDef.colors) {
        for (const sz of pDef.sizes) {
          const sku = pDef.skuGenerator(col.code, sz).toUpperCase();
          if (globalSkuSet.has(sku)) {
            throw new Error(`Duplicate global SKU detected: ${sku}`);
          }
          globalSkuSet.add(sku);

          // Realistic variation in stock around baseStock
          const stock = Math.max(10, Math.min(25, pDef.baseStock + ((sku.length % 5) - 2)));

          variants.push({
            sku,
            attributes: {
              color: { name: col.name, hex: col.hex },
              size: sz,
              custom: {},
            },
            price: pDef.price,
            mrp: pDef.mrp,
            inventory: {
              stock,
              reserved: 0,
              lowStockThreshold: 5,
            },
            weightInGrams: 280,
            dimensionsInCm: { length: 30, width: 25, height: 3 },
            images: [],
            isActive: true,
          });
        }
      }
    }

    // Upsert or create product document
    let productDoc = await Product.findOne({ slug: pDef.slug });

    if (!productDoc) {
      productDoc = new Product({
        name: pDef.name,
        slug: pDef.slug,
        brand: pDef.brand,
        description: pDef.description,
        shortDescription: pDef.shortDescription,
        category: leafCategory._id,
        categoryTree,
        gender: pDef.gender,
        images: [], // Left empty per instruction for dedicated AI generation phase
        specifications: pDef.specifications,
        variants,
        status: 'DRAFT', // Kept in DRAFT per instruction
        isFeatured: false,
        isNewArrival: true,
        isBestseller: false,
        tags: pDef.tags,
      });
    } else {
      productDoc.name = pDef.name;
      productDoc.brand = pDef.brand;
      productDoc.description = pDef.description;
      productDoc.shortDescription = pDef.shortDescription;
      productDoc.category = leafCategory._id;
      productDoc.categoryTree = categoryTree;
      productDoc.gender = pDef.gender;
      productDoc.specifications = pDef.specifications;
      productDoc.variants = variants;
      productDoc.status = 'DRAFT';
      productDoc.tags = pDef.tags;
      productDoc.images = [];
    }

    await productDoc.save();
    createdProducts.push(productDoc);

    console.log(
      `✔ [${createdProducts.length}/12] Created: "${productDoc.name}" | Brand: ${productDoc.brand} | Status: ${productDoc.status} | Variants: ${productDoc.variants.length} | Price: ₹${productDoc.priceSummary.minPrice} (MRP: ₹${productDoc.priceSummary.minMrp})`
    );
  }

  // -------------------------------------------------------------
  // STEP 3: AUDIT & SUMMARY REPORT
  // -------------------------------------------------------------
  const totalProducts = await Product.countDocuments();
  const draftProducts = await Product.countDocuments({ status: 'DRAFT' });
  const activeProducts = await Product.countDocuments({ status: 'ACTIVE' });
  const totalCategories = await Category.countDocuments();
  const rootCategories = await Category.countDocuments({ level: 0 });
  const childCategories = await Category.countDocuments({ level: { $gt: 0 } });

  console.log('\n================================================================');
  console.log('        REAL LAUNCH CATALOG INITIALIZATION SUMMARY');
  console.log('================================================================');
  console.log(`Total Products:         ${totalProducts} (Target: 12)`);
  console.log(`Draft Products:         ${draftProducts} (Target: 12)`);
  console.log(`Active Products:        ${activeProducts} (Target: 0)`);
  console.log(`Total Variants Created: ${globalSkuSet.size}`);
  console.log(`Total Categories:       ${totalCategories} (${rootCategories} Root + ${childCategories} Child)`);
  console.log(`Products without Media: ${createdProducts.filter((p) => p.images.length === 0).length} / 12`);
  console.log('================================================================\n');

  return {
    productsCreated: createdProducts.length,
    variantCount: globalSkuSet.size,
    totalCategories,
    productIds: createdProducts.map((p) => ({ id: p._id.toString(), name: p.name, brand: p.brand, slug: p.slug })),
  };
}

// Run directly when called via node
if (process.argv[1] && process.argv[1].endsWith('seedRealCatalog.js')) {
  seedRealCatalog()
    .then(async () => {
      await disconnectDB();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('❌ Real Catalog Seed Failed:', err);
      await disconnectDB();
      process.exit(1);
    });
}
