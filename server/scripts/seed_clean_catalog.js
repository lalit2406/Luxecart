import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from '../src/config/env.js';
import { connectDB, disconnectDB } from '../src/config/database.js';
import User from '../src/modules/users/user.model.js';
import Category from '../src/modules/categories/category.model.js';
import Product from '../src/modules/products/product.model.js';
import Coupon from '../src/modules/coupons/coupon.model.js';
import Content from '../src/modules/content/content.model.js';
import Order from '../src/modules/orders/order.model.js';
import Return from '../src/modules/returns/return.model.js';
import Review from '../src/modules/reviews/review.model.js';
import Cart from '../src/modules/cart/cart.model.js';
import Wishlist from '../src/modules/wishlist/wishlist.model.js';
import Address from '../src/modules/addresses/address.model.js';
import SupportTicket from '../src/modules/support/supportTicket.model.js';
import ImportJob from '../src/modules/import/importJob.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const mongoUri = process.env.MONGODB_URI || config.mongoUri || 'mongodb://localhost:27017/luxecart';
const adminPassword = process.env.LUXECART_ADMIN_PASSWORD;

async function seedCleanCatalog() {
  console.log('\n================================================================');
  console.log('  LuxeCart Clean Database Reset & Catalog Seeding Utility');
  console.log('================================================================\n');

  if (!adminPassword || !adminPassword.trim()) {
    console.error('❌ ERROR: LUXECART_ADMIN_PASSWORD is not set in server/.env');
    console.error('Please define LUXECART_ADMIN_PASSWORD in server/.env before running this script.');
    process.exit(1);
  }

  await connectDB(mongoUri);

  const dbName = mongoose.connection.db.databaseName;
  if (dbName !== 'test') {
    console.error(`❌ CRITICAL SAFETY ERROR: Active database is "${dbName}".`);
    console.error('Destructive reset is strictly restricted to the "test" development database.');
    await disconnectDB();
    process.exit(1);
  }

  console.log('WARNING: This will reset the LuxeCart development TEST database.');
  console.log(`Connected Database: ${dbName}\n`);

  // -------------------------------------------------------------
  // PART 1: Purge All Collections (deleteMany without dropping)
  // -------------------------------------------------------------
  console.log('Clearing existing synthetic test fixtures...');
  await Promise.all([
    User.deleteMany({}),
    Category.deleteMany({}),
    Product.deleteMany({}),
    Content.deleteMany({}),
    Coupon.deleteMany({}),
    Order.deleteMany({}),
    Return.deleteMany({}),
    Review.deleteMany({}),
    Cart.deleteMany({}),
    Wishlist.deleteMany({}),
    Address.deleteMany({}),
    SupportTicket.deleteMany({}),
    ImportJob.deleteMany({}),
  ]);
  console.log('✔ All 13 collections reset to 0 documents.\n');

  // -------------------------------------------------------------
  // PART 2: Create Single Administrator Account
  // -------------------------------------------------------------
  console.log('Creating single administrator account...');
  const salt = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash(adminPassword, salt);

  const admin = await User.create({
    name: 'LuxeCart Administrator',
    email: 'admin@luxecart.com',
    passwordHash,
    role: 'ADMIN',
    status: 'ACTIVE',
  });
  console.log(`✔ Administrator created: ${admin.email} (ID: ${admin._id})\n`);

  // -------------------------------------------------------------
  // PART 3: Create 5 Canonical Root Categories
  // -------------------------------------------------------------
  console.log('Creating 5 canonical root categories...');
  const rootCategoriesData = [
    {
      name: 'Apparel',
      slug: 'apparel',
      description: 'Haute couture, artisanal tailoring, and fine ready-to-wear luxury garments.',
      level: 0,
      displayOrder: 1,
      isActive: true,
    },
    {
      name: 'Watches & Horology',
      slug: 'watches-horology',
      description: 'Master timepieces, hand-assembled mechanical movements, and haute horology.',
      level: 0,
      displayOrder: 2,
      isActive: true,
    },
    {
      name: 'Artisanal Leather Goods',
      slug: 'leather-goods',
      description: 'Handcrafted leather luggage, structured briefcases, and bespoke handbags.',
      level: 0,
      displayOrder: 3,
      isActive: true,
    },
    {
      name: 'Fine Jewelry & Accessories',
      slug: 'jewelry-accessories',
      description: 'Precious gemstone creations, fine gold accents, and pure silk accessories.',
      level: 0,
      displayOrder: 4,
      isActive: true,
    },
    {
      name: 'Luxury Footwear',
      slug: 'footwear',
      description: 'Hand-welted Italian leather loafers, dress shoes, and couture footwear.',
      level: 0,
      displayOrder: 5,
      isActive: true,
    },
  ];

  const rootCategories = {};
  for (const catData of rootCategoriesData) {
    const cat = await Category.create(catData);
    rootCategories[cat.slug] = cat;
  }
  console.log('✔ 5 Root categories created.\n');

  // -------------------------------------------------------------
  // PART 4: Create 10 Subcategories
  // -------------------------------------------------------------
  console.log('Creating 10 canonical subcategories...');
  const subcategoriesData = [
    // Apparel
    {
      name: "Men's Ready-to-Wear",
      slug: 'mens-apparel',
      description: 'Tailored suits, cashmere knitwear, and structured jackets for gentlemen.',
      parentId: rootCategories['apparel']._id,
      ancestors: [{ _id: rootCategories['apparel']._id, name: 'Apparel', slug: 'apparel' }],
      level: 1,
      displayOrder: 1,
      isActive: true,
    },
    {
      name: "Women's Haute Couture",
      slug: 'womens-apparel',
      description: 'Hand-embroidered evening dresses, silk blouses, and timeless couture gowns.',
      parentId: rootCategories['apparel']._id,
      ancestors: [{ _id: rootCategories['apparel']._id, name: 'Apparel', slug: 'apparel' }],
      level: 1,
      displayOrder: 2,
      isActive: true,
    },

    // Watches & Horology
    {
      name: 'Mechanical Tourbillons',
      slug: 'mechanical-tourbillons',
      description: 'Gravity-compensating tourbillon calibres with exhibition sapphire casebacks.',
      parentId: rootCategories['watches-horology']._id,
      ancestors: [{ _id: rootCategories['watches-horology']._id, name: 'Watches & Horology', slug: 'watches-horology' }],
      level: 1,
      displayOrder: 1,
      isActive: true,
    },
    {
      name: 'Luxury Chronographs',
      slug: 'luxury-chronographs',
      description: 'Multi-complication flyback chronographs with precious metal cases.',
      parentId: rootCategories['watches-horology']._id,
      ancestors: [{ _id: rootCategories['watches-horology']._id, name: 'Watches & Horology', slug: 'watches-horology' }],
      level: 1,
      displayOrder: 2,
      isActive: true,
    },

    // Artisanal Leather Goods
    {
      name: 'Handcrafted Handbags',
      slug: 'luxury-handbags',
      description: 'Full-grain calfskin and exotic leather handbags finished with custom hardware.',
      parentId: rootCategories['leather-goods']._id,
      ancestors: [{ _id: rootCategories['leather-goods']._id, name: 'Artisanal Leather Goods', slug: 'leather-goods' }],
      level: 1,
      displayOrder: 1,
      isActive: true,
    },
    {
      name: 'Leather Luggage & Wallets',
      slug: 'leather-wallets',
      description: 'Weekend duffles, travel trunks, and hand-stitched leather pocket organizers.',
      parentId: rootCategories['leather-goods']._id,
      ancestors: [{ _id: rootCategories['leather-goods']._id, name: 'Artisanal Leather Goods', slug: 'leather-goods' }],
      level: 1,
      displayOrder: 2,
      isActive: true,
    },

    // Fine Jewelry & Accessories
    {
      name: 'Precious Gemstones',
      slug: 'precious-gemstones',
      description: 'Ethically sourced sapphires, emeralds, and diamonds set in platinum and 18k gold.',
      parentId: rootCategories['jewelry-accessories']._id,
      ancestors: [{ _id: rootCategories['jewelry-accessories']._id, name: 'Fine Jewelry & Accessories', slug: 'jewelry-accessories' }],
      level: 1,
      displayOrder: 1,
      isActive: true,
    },
    {
      name: 'Silk Scarves & Ties',
      slug: 'silk-accessories',
      description: 'Pure Mulberry silk twill scarves and woven jacquard neckties.',
      parentId: rootCategories['jewelry-accessories']._id,
      ancestors: [{ _id: rootCategories['jewelry-accessories']._id, name: 'Fine Jewelry & Accessories', slug: 'jewelry-accessories' }],
      level: 1,
      displayOrder: 2,
      isActive: true,
    },

    // Luxury Footwear
    {
      name: 'Hand-Stitched Loafers',
      slug: 'leather-loafers',
      description: 'Goodyear-welted Belgian loafers and hand-burnished calfskin dress shoes.',
      parentId: rootCategories['footwear']._id,
      ancestors: [{ _id: rootCategories['footwear']._id, name: 'Luxury Footwear', slug: 'footwear' }],
      level: 1,
      displayOrder: 1,
      isActive: true,
    },
    {
      name: 'Designer Heels',
      slug: 'designer-heels',
      description: 'Sculptural stilettos and artisanal pumps handcrafted in Italy.',
      parentId: rootCategories['footwear']._id,
      ancestors: [{ _id: rootCategories['footwear']._id, name: 'Luxury Footwear', slug: 'footwear' }],
      level: 1,
      displayOrder: 2,
      isActive: true,
    },
  ];

  const subcategories = {};
  for (const subData of subcategoriesData) {
    const sub = await Category.create(subData);
    subcategories[sub.slug] = sub;
  }
  console.log('✔ 10 Subcategories created.\n');

  // -------------------------------------------------------------
  // PART 5: Create 12 Curated Luxury Products
  // -------------------------------------------------------------
  console.log('Creating 12 luxury products with full variants and paise pricing...');
  const productsData = [
    // 1. APPAREL - Men's
    {
      name: 'Italian Cashmere Tailored Blazer',
      slug: 'italian-cashmere-tailored-blazer',
      brand: 'LuxeCart Sartoria',
      category: subcategories['mens-apparel']._id,
      categoryTree: [rootCategories['apparel']._id, subcategories['mens-apparel']._id],
      description: 'Hand-tailored in Biella from 100% double-faced Mongolian cashmere. Features horn buttons, cupro lining, and a deconstructed soft shoulder.',
      gender: 'MEN',
      status: 'ACTIVE',
      featured: true,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=1000&q=80',
          alt: 'Italian Cashmere Tailored Blazer Navy',
          isPrimary: true,
          displayOrder: 0,
        },
        {
          url: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=1000&q=80',
          alt: 'Italian Cashmere Tailored Blazer Lifestyle',
          isPrimary: false,
          displayOrder: 1,
        },
      ],
      specifications: [
        { name: 'Material', value: '100% Mongolian Cashmere' },
        { name: 'Origin', value: 'Made in Italy' },
        { name: 'Lining', value: '100% Bemberg Cupro' },
      ],
      tags: ['cashmere', 'blazer', 'tailoring', 'autumn-winter', 'menswear'],
      variants: [
        {
          sku: 'LX-BLZ-NAV-38',
          price: 18500000, // ₹1,85,000
          mrp: 22000000,   // ₹2,20,000
          inventory: { stock: 12, reserved: 0, lowStockThreshold: 3 },
          attributes: { color: { name: 'Midnight Navy', hex: '#1B2A4A' }, size: '38R' },
          isActive: true,
        },
        {
          sku: 'LX-BLZ-NAV-40',
          price: 18500000,
          mrp: 22000000,
          inventory: { stock: 15, reserved: 0, lowStockThreshold: 3 },
          attributes: { color: { name: 'Midnight Navy', hex: '#1B2A4A' }, size: '40R' },
          isActive: true,
        },
        {
          sku: 'LX-BLZ-NAV-42',
          price: 18500000,
          mrp: 22000000,
          inventory: { stock: 8, reserved: 0, lowStockThreshold: 2 },
          attributes: { color: { name: 'Midnight Navy', hex: '#1B2A4A' }, size: '42R' },
          isActive: true,
        },
      ],
    },

    // 2. APPAREL - Women's
    {
      name: 'Florence Silk Evening Shirt',
      slug: 'florence-silk-evening-shirt',
      brand: 'LuxeCart Atelier',
      category: subcategories['womens-apparel']._id,
      categoryTree: [rootCategories['apparel']._id, subcategories['womens-apparel']._id],
      description: 'Lustrous heavyweight Mulberry silk crepe de chine blouse with concealed mother-of-pearl buttons and draped French cuffs.',
      gender: 'WOMEN',
      status: 'ACTIVE',
      featured: true,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1598554747436-c9293d6a588f?auto=format&fit=crop&w=1000&q=80',
          alt: 'Florence Silk Evening Shirt Ivory',
          isPrimary: true,
          displayOrder: 0,
        },
      ],
      specifications: [
        { name: 'Material', value: '100% Mulberry Silk (22 Momme)' },
        { name: 'Buttons', value: 'Australian Mother-of-Pearl' },
        { name: 'Care', value: 'Specialist Dry Clean Only' },
      ],
      tags: ['silk', 'evening', 'couture', 'womenswear'],
      variants: [
        {
          sku: 'LX-SHT-IVR-S',
          price: 6500000, // ₹65,000
          mrp: 7800000,   // ₹78,000
          inventory: { stock: 18, reserved: 0, lowStockThreshold: 4 },
          attributes: { color: { name: 'Champagne Ivory', hex: '#FDFBF7' }, size: 'S' },
          isActive: true,
        },
        {
          sku: 'LX-SHT-IVR-M',
          price: 6500000,
          mrp: 7800000,
          inventory: { stock: 22, reserved: 0, lowStockThreshold: 4 },
          attributes: { color: { name: 'Champagne Ivory', hex: '#FDFBF7' }, size: 'M' },
          isActive: true,
        },
      ],
    },

    // 3. APPAREL - Jacket
    {
      name: 'Heritage Leathercraft Aviator Jacket',
      slug: 'heritage-leathercraft-aviator-jacket',
      brand: 'LuxeCart Sartoria',
      category: subcategories['mens-apparel']._id,
      categoryTree: [rootCategories['apparel']._id, subcategories['mens-apparel']._id],
      description: 'Supple hand-waxed lambskin aviator jacket with plush Spanish shearling collar and heavy-duty antiqued brass hardware.',
      gender: 'UNISEX',
      status: 'ACTIVE',
      featured: false,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=1000&q=80',
          alt: 'Heritage Leathercraft Aviator Jacket Cognac',
          isPrimary: true,
          displayOrder: 0,
        },
      ],
      specifications: [
        { name: 'Shell', value: '100% Full-Grain Lambskin' },
        { name: 'Collar', value: 'Natural Spanish Shearling' },
      ],
      tags: ['leather', 'aviator', 'outerwear', 'jacket'],
      variants: [
        {
          sku: 'LX-JKT-COG-M',
          price: 24000000, // ₹2,40,000
          mrp: 28500000,   // ₹2,85,000
          inventory: { stock: 10, reserved: 0, lowStockThreshold: 2 },
          attributes: { color: { name: 'Cognac Brown', hex: '#8B4513' }, size: 'M' },
          isActive: true,
        },
        {
          sku: 'LX-JKT-COG-L',
          price: 24000000,
          mrp: 28500000,
          inventory: { stock: 12, reserved: 0, lowStockThreshold: 2 },
          attributes: { color: { name: 'Cognac Brown', hex: '#8B4513' }, size: 'L' },
          isActive: true,
        },
      ],
    },

    // 4. WATCHES - Chronograph
    {
      name: 'Royal Heritage Chronograph',
      slug: 'royal-heritage-chronograph',
      brand: 'LuxeCart Geneve',
      category: subcategories['luxury-chronographs']._id,
      categoryTree: [rootCategories['watches-horology']._id, subcategories['luxury-chronographs']._id],
      description: 'Swiss-manufactured automatic column-wheel chronograph in an 18k rose gold case with grand feu enamel dial and hand-stitched alligator strap.',
      gender: 'UNISEX',
      status: 'ACTIVE',
      featured: true,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=1000&q=80',
          alt: 'Royal Heritage Chronograph Rose Gold',
          isPrimary: true,
          displayOrder: 0,
        },
      ],
      specifications: [
        { name: 'Case Material', value: '18k Rose Gold (41mm)' },
        { name: 'Movement', value: 'Calibre LC-890 Column Wheel (72h Reserve)' },
        { name: 'Water Resistance', value: '50m / 5 ATM' },
      ],
      tags: ['horology', 'chronograph', 'rose-gold', 'luxury-watch'],
      variants: [
        {
          sku: 'LX-WAT-RHC-01',
          price: 85000000, // ₹8,50,000
          mrp: 98000000,   // ₹9,80,000
          inventory: { stock: 6, reserved: 0, lowStockThreshold: 2 },
          attributes: { color: { name: 'Rose Gold / Enamel Dial', hex: '#B76E79' }, size: '41mm' },
          isActive: true,
        },
      ],
    },

    // 5. WATCHES - Tourbillon
    {
      name: 'Celestial Flying Tourbillon',
      slug: 'celestial-flying-tourbillon',
      brand: 'LuxeCart Geneve',
      category: subcategories['mechanical-tourbillons']._id,
      categoryTree: [rootCategories['watches-horology']._id, subcategories['mechanical-tourbillons']._id],
      description: 'A masterwork of micro-engineering featuring a single-axis 60-second flying tourbillon cage, aventurine glass night-sky dial, and grade 5 titanium case.',
      gender: 'UNISEX',
      status: 'ACTIVE',
      featured: true,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1000&q=80',
          alt: 'Celestial Flying Tourbillon Titanium',
          isPrimary: true,
          displayOrder: 0,
        },
      ],
      specifications: [
        { name: 'Tourbillon', value: '60-Second Flying Tourbillon' },
        { name: 'Case', value: 'Grade 5 Satin-Polished Titanium (43mm)' },
        { name: 'Dial', value: 'Natural Aventurine Starlight Glass' },
      ],
      tags: ['tourbillon', 'haute-horlogerie', 'titanium', 'aventurine'],
      variants: [
        {
          sku: 'LX-WAT-CFT-01',
          price: 185000000, // ₹18,50,000
          mrp: 210000000,   // ₹21,00,000
          inventory: { stock: 4, reserved: 0, lowStockThreshold: 1 },
          attributes: { color: { name: 'Aventurine Blue / Titanium', hex: '#1E2952' }, size: '43mm' },
          isActive: true,
        },
      ],
    },

    // 6. WATCHES - Platinum Automatic
    {
      name: 'Platinum Regent Automatic',
      slug: 'platinum-regent-automatic',
      brand: 'LuxeCart Geneve',
      category: subcategories['luxury-chronographs']._id,
      categoryTree: [rootCategories['watches-horology']._id, subcategories['luxury-chronographs']._id],
      description: 'Ultra-slim dress watch crafted in 950 solid platinum with guilloché silver dial, blued steel Breguet hands, and micro-rotor movement.',
      gender: 'MEN',
      status: 'ACTIVE',
      featured: false,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1547996160-71dfa6358260?auto=format&fit=crop&w=1000&q=80',
          alt: 'Platinum Regent Automatic Silver Dial',
          isPrimary: true,
          displayOrder: 0,
        },
      ],
      specifications: [
        { name: 'Case', value: 'Solid 950 Platinum (39mm)' },
        { name: 'Thickness', value: '6.8mm Ultra-Thin' },
      ],
      tags: ['platinum', 'dress-watch', 'automatic', 'horology'],
      variants: [
        {
          sku: 'LX-WAT-PRA-01',
          price: 120000000, // ₹12,00,000
          mrp: 140000000,   // ₹14,00,000
          inventory: { stock: 8, reserved: 0, lowStockThreshold: 2 },
          attributes: { color: { name: 'Platinum / Guilloche Silver', hex: '#E5E4E2' }, size: '39mm' },
          isActive: true,
        },
      ],
    },

    // 7. LEATHER GOODS - Handbag
    {
      name: 'Florence Heritage Structured Handbag',
      slug: 'florence-heritage-structured-handbag',
      brand: 'LuxeCart Pelletteria',
      category: subcategories['luxury-handbags']._id,
      categoryTree: [rootCategories['leather-goods']._id, subcategories['luxury-handbags']._id],
      description: 'Iconic structured top-handle handbag in Box Calf leather. Finished with 24k gold-plated turn-lock hardware and signature chevron stitching.',
      gender: 'WOMEN',
      status: 'ACTIVE',
      featured: true,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1000&q=80',
          alt: 'Florence Heritage Structured Handbag Emerald',
          isPrimary: true,
          displayOrder: 0,
        },
      ],
      specifications: [
        { name: 'Leather', value: 'French Box Calfskin' },
        { name: 'Hardware', value: '24k Gold PVD Brass' },
      ],
      tags: ['handbag', 'leather', 'luxury-bag', 'gold-hardware'],
      variants: [
        {
          sku: 'LX-BAG-EMR-01',
          price: 32000000, // ₹3,20,000
          mrp: 38000000,   // ₹3,80,000
          inventory: { stock: 12, reserved: 0, lowStockThreshold: 3 },
          attributes: { color: { name: 'Emerald Forest', hex: '#0B5345' }, size: 'Medium (28cm)' },
          isActive: true,
        },
        {
          sku: 'LX-BAG-NOI-01',
          price: 32000000,
          mrp: 38000000,
          inventory: { stock: 15, reserved: 0, lowStockThreshold: 3 },
          attributes: { color: { name: 'Noir Classic', hex: '#171513' }, size: 'Medium (28cm)' },
          isActive: true,
        },
      ],
    },

    // 8. LEATHER GOODS - Briefcase
    {
      name: 'Venezia Artisanal Leather Briefcase',
      slug: 'venezia-artisanal-leather-briefcase',
      brand: 'LuxeCart Pelletteria',
      category: subcategories['leather-wallets']._id,
      categoryTree: [rootCategories['leather-goods']._id, subcategories['leather-wallets']._id],
      description: 'Vegetable-tanned Tuscan bridle leather attache briefcase. Dual gusset construction with suede lining and combination brass locks.',
      gender: 'UNISEX',
      status: 'ACTIVE',
      featured: false,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1000&q=80',
          alt: 'Venezia Artisanal Leather Briefcase Havana',
          isPrimary: true,
          displayOrder: 0,
        },
      ],
      specifications: [
        { name: 'Leather', value: 'Full-Grain Tuscan Bridle Leather' },
        { name: 'Dimensions', value: '40cm x 30cm x 10cm' },
      ],
      tags: ['briefcase', 'leather-goods', 'business', 'luggage'],
      variants: [
        {
          sku: 'LX-BFC-HAV-01',
          price: 19500000, // ₹1,95,000
          mrp: 23500000,   // ₹2,35,000
          inventory: { stock: 14, reserved: 0, lowStockThreshold: 3 },
          attributes: { color: { name: 'Havana Tan', hex: '#9A6A45' }, size: 'Standard 15"' },
          isActive: true,
        },
      ],
    },

    // 9. JEWELRY - Royal Sapphire Pendant
    {
      name: 'Royal Ceylon Sapphire & Diamond Pendant',
      slug: 'royal-ceylon-sapphire-diamond-pendant',
      brand: 'LuxeCart High Jewelry',
      category: subcategories['precious-gemstones']._id,
      categoryTree: [rootCategories['jewelry-accessories']._id, subcategories['precious-gemstones']._id],
      description: 'Unheated 4.50-carat royal blue Ceylon sapphire surrounded by a halo of micro-pave D-flawless brilliant cut diamonds set in 950 platinum.',
      gender: 'WOMEN',
      status: 'ACTIVE',
      featured: true,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=1000&q=80',
          alt: 'Royal Ceylon Sapphire Diamond Pendant Platinum',
          isPrimary: true,
          displayOrder: 0,
        },
      ],
      specifications: [
        { name: 'Center Stone', value: '4.50ct Natural Ceylon Sapphire (Royal Blue)' },
        { name: 'Accent Diamonds', value: '1.20ct D/VVS1 Round Brilliant Diamonds' },
        { name: 'Metal', value: '950 Solid Platinum' },
      ],
      tags: ['sapphire', 'high-jewelry', 'pendant', 'diamonds', 'platinum'],
      variants: [
        {
          sku: 'LX-JWL-CSP-01',
          price: 145000000, // ₹14,50,000
          mrp: 175000000,   // ₹17,50,000
          inventory: { stock: 5, reserved: 0, lowStockThreshold: 1 },
          attributes: { color: { name: 'Royal Blue / Platinum', hex: '#002366' }, size: '45cm Chain' },
          isActive: true,
        },
      ],
    },

    // 10. JEWELRY - Silk Scarf
    {
      name: 'Imperial Silk Signature Scarf',
      slug: 'imperial-silk-signature-scarf',
      brand: 'LuxeCart Atelier',
      category: subcategories['silk-accessories']._id,
      categoryTree: [rootCategories['jewelry-accessories']._id, subcategories['silk-accessories']._id],
      description: '90cm x 90cm hand-rolled silk twill carré featuring bespoke architectural botanical motifs in rich jewel tones.',
      gender: 'UNISEX',
      status: 'ACTIVE',
      featured: false,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1601924994987-69e26d50dc26?auto=format&fit=crop&w=1000&q=80',
          alt: 'Imperial Silk Signature Scarf Bordeaux',
          isPrimary: true,
          displayOrder: 0,
        },
      ],
      specifications: [
        { name: 'Dimensions', value: '90cm x 90cm' },
        { name: 'Composition', value: '100% Silk Twill (Hand-Rolled Hem)' },
      ],
      tags: ['silk', 'scarf', 'accessories', 'botanical'],
      variants: [
        {
          sku: 'LX-SCF-BOR-90',
          price: 3800000, // ₹38,000
          mrp: 4500000,   // ₹45,000
          inventory: { stock: 25, reserved: 0, lowStockThreshold: 5 },
          attributes: { color: { name: 'Bordeaux Gold', hex: '#58111A' }, size: '90x90cm' },
          isActive: true,
        },
        {
          sku: 'LX-SCF-EME-90',
          price: 3800000,
          mrp: 4500000,
          inventory: { stock: 20, reserved: 0, lowStockThreshold: 5 },
          attributes: { color: { name: 'Emerald Marine', hex: '#0B3B39' }, size: '90x90cm' },
          isActive: true,
        },
      ],
    },

    // 11. FOOTWEAR - Loafer
    {
      name: 'Venezia Hand-Stitched Leather Loafer',
      slug: 'venezia-hand-stitched-leather-loafer',
      brand: 'LuxeCart Calzolaio',
      category: subcategories['leather-loafers']._id,
      categoryTree: [rootCategories['footwear']._id, subcategories['leather-loafers']._id],
      description: 'Handcrafted Goodyear-welted penny loafer made from French museum calfskin with channeled leather soles and brass nail detailing.',
      gender: 'MEN',
      status: 'ACTIVE',
      featured: true,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1614252369475-531eba835eb1?auto=format&fit=crop&w=1000&q=80',
          alt: 'Venezia Hand-Stitched Leather Loafer Oxblood',
          isPrimary: true,
          displayOrder: 0,
        },
      ],
      specifications: [
        { name: 'Upper', value: 'Full-Grain French Museum Calf' },
        { name: 'Construction', value: 'Goodyear Welted with Channeled Sole' },
      ],
      tags: ['shoes', 'loafers', 'footwear', 'handcrafted'],
      variants: [
        {
          sku: 'LX-SHOE-OXB-41',
          price: 9500000, // ₹95,000
          mrp: 11500000,  // ₹1,15,000
          inventory: { stock: 12, reserved: 0, lowStockThreshold: 3 },
          attributes: { color: { name: 'Oxblood Patina', hex: '#4A0E17' }, size: 'EU 41 / UK 7' },
          isActive: true,
        },
        {
          sku: 'LX-SHOE-OXB-42',
          price: 9500000,
          mrp: 11500000,
          inventory: { stock: 16, reserved: 0, lowStockThreshold: 3 },
          attributes: { color: { name: 'Oxblood Patina', hex: '#4A0E17' }, size: 'EU 42 / UK 8' },
          isActive: true,
        },
        {
          sku: 'LX-SHOE-OXB-43',
          price: 9500000,
          mrp: 11500000,
          inventory: { stock: 10, reserved: 0, lowStockThreshold: 2 },
          attributes: { color: { name: 'Oxblood Patina', hex: '#4A0E17' }, size: 'EU 43 / UK 9' },
          isActive: true,
        },
      ],
    },

    // 12. FOOTWEAR - Designer Heels
    {
      name: 'Milano Satin Sculptural Pump',
      slug: 'milano-satin-sculptural-pump',
      brand: 'LuxeCart Calzolaio',
      category: subcategories['designer-heels']._id,
      categoryTree: [rootCategories['footwear']._id, subcategories['designer-heels']._id],
      description: 'Sculptural stiletto pump in Italian silk duchesse satin. Features an ergonomic arch pitch and crystal pavé buckle.',
      gender: 'WOMEN',
      status: 'ACTIVE',
      featured: false,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=1000&q=80',
          alt: 'Milano Satin Sculptural Pump Noir',
          isPrimary: true,
          displayOrder: 0,
        },
      ],
      specifications: [
        { name: 'Upper', value: 'Italian Silk Duchesse Satin' },
        { name: 'Heel Height', value: '95mm (3.7 inches)' },
      ],
      tags: ['heels', 'pumps', 'evening-shoes', 'footwear'],
      variants: [
        {
          sku: 'LX-PMP-NOI-37',
          price: 8800000, // ₹88,000
          mrp: 10500000,  // ₹1,05,000
          inventory: { stock: 10, reserved: 0, lowStockThreshold: 2 },
          attributes: { color: { name: 'Midnight Noir', hex: '#0B0B0B' }, size: 'EU 37' },
          isActive: true,
        },
        {
          sku: 'LX-PMP-NOI-38',
          price: 8800000,
          mrp: 10500000,
          inventory: { stock: 14, reserved: 0, lowStockThreshold: 3 },
          attributes: { color: { name: 'Midnight Noir', hex: '#0B0B0B' }, size: 'EU 38' },
          isActive: true,
        },
      ],
    },
  ];

  for (const pData of productsData) {
    await Product.create(pData);
  }
  console.log('✔ 12 Curated luxury products created.\n');

  // -------------------------------------------------------------
  // PART 6: Create 2 Canonical Promotional Coupons
  // -------------------------------------------------------------
  console.log('Creating 2 canonical promotional coupons...');
  const couponsData = [
    {
      code: 'WELCOME10',
      description: 'Privileged 10% inaugural savings on your luxury purchase.',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      minOrderValue: 2500000, // ₹25,000 in paise
      maxDiscountAmount: 500000, // ₹5,000 max discount
      startDate: new Date(),
      expirationDate: new Date('2028-12-31T23:59:59.999Z'),
      totalUsageLimit: 1000,
      usedCount: 0,
      perUserLimit: 1,
      isActive: true,
    },
    {
      code: 'LUXE25K',
      description: 'Exclusive ₹25,000 festive privilege on high-value orders over ₹2,00,000.',
      discountType: 'FIXED',
      discountValue: 2500000, // ₹25,000 in paise
      minOrderValue: 20000000, // ₹2,00,000 in paise
      startDate: new Date(),
      expirationDate: new Date('2028-12-31T23:59:59.999Z'),
      totalUsageLimit: 500,
      usedCount: 0,
      perUserLimit: 1,
      isActive: true,
    },
  ];

  for (const cData of couponsData) {
    await Coupon.create(cData);
  }
  console.log('✔ 2 Promotional coupons created.\n');

  // -------------------------------------------------------------
  // PART 7: Create 3 Homepage CMS Content Items
  // -------------------------------------------------------------
  console.log('Creating 3 clean homepage CMS content sections...');
  const contentsData = [
    {
      type: 'HERO_BANNER',
      title: 'The Autumn/Winter Haute Collection',
      subtitle: 'Exquisite craftsmanship meets modern luxury.',
      imageUrl: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1600&q=80',
      mobileImageUrl: '',
      ctaText: 'Explore Collection',
      ctaLink: '/shop',
      displayOrder: 0,
      isActive: true,
      startDate: new Date(),
      endDate: new Date('2028-12-31T23:59:59.999Z'),
    },
    {
      type: 'ANNOUNCEMENT_BAR',
      title: 'Complimentary Insured White-Glove Delivery Across India',
      subtitle: 'Guaranteed insured door-to-door transit on all orders.',
      imageUrl: '',
      ctaText: 'Learn More',
      ctaLink: '/support',
      displayOrder: 0,
      isActive: true,
      startDate: new Date(),
      endDate: new Date('2028-12-31T23:59:59.999Z'),
    },
    {
      type: 'PROMO_BANNER',
      title: 'Master Horology Showcase',
      subtitle: 'Explore limited-production hand-assembled timepieces.',
      imageUrl: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1200&q=80',
      mobileImageUrl: '',
      ctaText: 'View Timepieces',
      ctaLink: '/shop?category=watches-horology',
      displayOrder: 1,
      isActive: true,
      startDate: new Date(),
      endDate: new Date('2028-12-31T23:59:59.999Z'),
    },
  ];

  for (const cntData of contentsData) {
    await Content.create(cntData);
  }
  console.log('✔ 3 Homepage CMS items created.\n');

  // -------------------------------------------------------------
  // PART 8: Programmatic Validation of Seeded Dataset
  // -------------------------------------------------------------
  console.log('Running programmatic integrity checks...');
  const userCount = await User.countDocuments();
  const rootCatCount = await Category.countDocuments({ level: 0 });
  const subCatCount = await Category.countDocuments({ level: 1 });
  const totalProducts = await Product.countDocuments();
  const activeProducts = await Product.countDocuments({ status: 'ACTIVE' });
  const couponCount = await Coupon.countDocuments();
  const contentCount = await Content.countDocuments();

  if (userCount !== 1) throw new Error(`Integrity check failed: Expected 1 user, found ${userCount}`);
  if (rootCatCount !== 5) throw new Error(`Integrity check failed: Expected 5 root categories, found ${rootCatCount}`);
  if (subCatCount !== 10) throw new Error(`Integrity check failed: Expected 10 subcategories, found ${subCatCount}`);
  if (totalProducts !== 12) throw new Error(`Integrity check failed: Expected 12 products, found ${totalProducts}`);
  if (activeProducts !== 12) throw new Error(`Integrity check failed: Expected 12 active products, found ${activeProducts}`);
  if (couponCount !== 2) throw new Error(`Integrity check failed: Expected 2 coupons, found ${couponCount}`);
  if (contentCount !== 3) throw new Error(`Integrity check failed: Expected 3 content items, found ${contentCount}`);

  console.log('✔ All programmatic integrity assertions passed!\n');

  await disconnectDB();

  console.log('================================================================');
  console.log('LuxeCart Development Database Seed Complete');
  console.log('----------------------------------------------------------------');
  console.log(`Admin:             1 (${admin.email})`);
  console.log('Customers:         0');
  console.log(`Root Categories:   5`);
  console.log(`Subcategories:     10`);
  console.log(`Products:          12`);
  console.log(`Coupons:           2`);
  console.log(`Homepage Content:  3`);
  console.log(`Orders:            0`);
  console.log(`Returns:           0`);
  console.log(`Reviews:           0`);
  console.log('----------------------------------------------------------------');
  console.log(`Database:          ${dbName}`);
  console.log('Status:            SUCCESS');
  console.log('================================================================\n');
}

seedCleanCatalog().catch(async (err) => {
  console.error('\n❌ Database Seed Failed:', err);
  await disconnectDB().catch(() => {});
  process.exit(1);
});
