import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { config } from '../src/config/env.js';
import { connectDB, disconnectDB } from '../src/config/database.js';

import Product from '../src/modules/products/product.model.js';
import Category from '../src/modules/categories/category.model.js';
import ImportJob from '../src/modules/import/importJob.model.js';
import Review from '../src/modules/reviews/review.model.js';
import Cart from '../src/modules/cart/cart.model.js';
import Wishlist from '../src/modules/wishlist/wishlist.model.js';
import User from '../src/modules/users/user.model.js';
import Coupon from '../src/modules/coupons/coupon.model.js';
import Content from '../src/modules/content/content.model.js';
import Order from '../src/modules/orders/order.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const mongoUri = process.env.MONGODB_URI || config.mongoUri || 'mongodb://localhost:27017/luxecart';

/**
 * Clean Minimum Canonical Category Hierarchy
 * Prepares LuxeCart for the upcoming real product catalog.
 */
const CANONICAL_ROOT_CATEGORIES = [
  {
    name: 'MEN',
    slug: 'men',
    description: 'Artisanal tailoring, luxury menswear, and refined formal attire.',
    level: 0,
    parentId: null,
    ancestors: [],
    displayOrder: 1,
    isActive: true,
    isFeatured: true,
  },
  {
    name: 'WOMEN',
    slug: 'women',
    description: 'Haute couture, evening wear, and contemporary womenswear.',
    level: 0,
    parentId: null,
    ancestors: [],
    displayOrder: 2,
    isActive: true,
    isFeatured: true,
  },
  {
    name: 'FOOTWEAR',
    slug: 'footwear',
    description: 'Handcrafted leather shoes, artisanal boots, and designer footwear.',
    level: 0,
    parentId: null,
    ancestors: [],
    displayOrder: 3,
    isActive: true,
    isFeatured: true,
  },
  {
    name: 'BEAUTY',
    slug: 'beauty',
    description: 'Luxury fragrances, skincare rituals, and grooming essentials.',
    level: 0,
    parentId: null,
    ancestors: [],
    displayOrder: 4,
    isActive: true,
    isFeatured: true,
  },
  {
    name: 'ACCESSORIES',
    slug: 'accessories',
    description: 'Fine jewelry, master horology, leather goods, and artisanal eyewear.',
    level: 0,
    parentId: null,
    ancestors: [],
    displayOrder: 5,
    isActive: true,
    isFeatured: true,
  },
  {
    name: 'LIFESTYLE',
    slug: 'lifestyle',
    description: 'Luxury home accents, travel cases, and curated lifestyle essentials.',
    level: 0,
    parentId: null,
    ancestors: [],
    displayOrder: 6,
    isActive: true,
    isFeatured: true,
  },
];

export async function resetCatalog() {
  console.log('\n================================================================');
  console.log('       LuxeCart — CLEAN CATALOG RESET UTILITY');
  console.log('================================================================\n');

  await connectDB(mongoUri);
  const dbName = mongoose.connection.db.databaseName;
  console.log(`Connected Database: ${dbName}`);

  // -------------------------------------------------------------
  // STEP 1: AUDIT CURRENT COUNTS BEFORE DELETION
  // -------------------------------------------------------------
  const existingProducts = await Product.find({}).lean();
  const existingCategories = await Category.find({}).lean();
  const existingImportJobs = await ImportJob.countDocuments();
  const existingReviews = await Review.countDocuments();
  const existingUsers = await User.countDocuments();
  const existingCoupons = await Coupon.countDocuments();
  const existingOrders = await Order.countDocuments();
  const existingContents = await Content.countDocuments();

  let totalVariants = 0;
  let totalProductImages = 0;
  for (const p of existingProducts) {
    totalVariants += p.variants ? p.variants.length : 0;
    totalProductImages += p.images ? p.images.length : 0;
  }

  console.log('\n--- CURRENT DATA AUDIT BEFORE RESET ---');
  console.log(`  Products:               ${existingProducts.length}`);
  console.log(`  Embedded Variants:      ${totalVariants}`);
  console.log(`  Product Media/Images:   ${totalProductImages}`);
  console.log(`  Categories:             ${existingCategories.length}`);
  console.log(`  Import Jobs:            ${existingImportJobs}`);
  console.log(`  Product Reviews:        ${existingReviews}`);
  console.log(`  Protected Users:        ${existingUsers} (MUST BE PRESERVED)`);
  console.log(`  Protected Coupons:      ${existingCoupons} (MUST BE PRESERVED)`);
  console.log(`  Protected Orders:       ${existingOrders} (MUST BE PRESERVED)`);
  console.log(`  Protected CMS Contents: ${existingContents} (MUST BE PRESERVED)`);

  // -------------------------------------------------------------
  // STEP 2: REMOVE OLD RANDOM/DEMO CATALOG DATA ONLY
  // -------------------------------------------------------------
  console.log('\n--- EXECUTING SAFE CATALOG RESET ---');

  // A. Delete Products
  const prodDeleteResult = await Product.deleteMany({});
  console.log(`✔ Products deleted: ${prodDeleteResult.deletedCount}`);

  // B. Delete Old/Demo Categories
  const catDeleteResult = await Category.deleteMany({});
  console.log(`✔ Old Categories deleted: ${catDeleteResult.deletedCount}`);

  // C. Delete Old Import Jobs
  const importDeleteResult = await ImportJob.deleteMany({});
  console.log(`✔ Import Jobs deleted: ${importDeleteResult.deletedCount}`);

  // D. Delete Old Reviews (if any)
  const reviewDeleteResult = await Review.deleteMany({});
  console.log(`✔ Old Reviews deleted: ${reviewDeleteResult.deletedCount}`);

  // E. Clean dependent Cart and Wishlist items (preserve cart & wishlist structures)
  await Cart.updateMany({}, { $set: { items: [] } });
  await Wishlist.updateMany({}, { $set: { products: [] } });
  console.log('✔ Active Carts & Wishlists cleared of obsolete demo product references');

  // -------------------------------------------------------------
  // STEP 3: SEED MINIMAL CLEAN CANONICAL CATEGORIES
  // -------------------------------------------------------------
  console.log('\n--- SEEDING CLEAN CANONICAL CATEGORIES ---');
  const createdCategories = await Category.insertMany(CANONICAL_ROOT_CATEGORIES);
  for (const c of createdCategories) {
    console.log(`✔ Created Category: ${c.name} (Slug: ${c.slug}, ID: ${c._id})`);
  }

  // -------------------------------------------------------------
  // STEP 4: VERIFY FINAL DATABASE COUNTS
  // -------------------------------------------------------------
  const finalProductCount = await Product.countDocuments();
  const finalCategoryCount = await Category.countDocuments();
  const finalImportJobCount = await ImportJob.countDocuments();
  const finalReviewCount = await Review.countDocuments();
  const finalUserCount = await User.countDocuments();
  const finalCouponCount = await Coupon.countDocuments();
  const finalOrderCount = await Order.countDocuments();
  const finalContentCount = await Content.countDocuments();

  console.log('\n--- FINAL DATABASE STATE AFTER RESET ---');
  console.log(`  Products:               ${finalProductCount} (TARGET: 0)`);
  console.log(`  Product Variants:       0 (TARGET: 0)`);
  console.log(`  Categories:             ${finalCategoryCount} (Clean Canonical Hierarchy: MEN, WOMEN, FOOTWEAR, BEAUTY, ACCESSORIES, LIFESTYLE)`);
  console.log(`  Import Jobs:            ${finalImportJobCount} (TARGET: 0)`);
  console.log(`  Reviews:                ${finalReviewCount} (TARGET: 0)`);
  console.log(`  Preserved Users:        ${finalUserCount}`);
  console.log(`  Preserved Coupons:      ${finalCouponCount}`);
  console.log(`  Preserved Orders:       ${finalOrderCount}`);
  console.log(`  Preserved CMS Contents: ${finalContentCount}`);
  console.log('\n================================================================');
  console.log('  LuxeCart catalog has been reset cleanly and is ready for real products!');
  console.log('================================================================\n');

  return {
    before: {
      products: existingProducts.length,
      variants: totalVariants,
      categories: existingCategories.length,
      images: totalProductImages,
      importJobs: existingImportJobs,
    },
    deleted: {
      products: prodDeleteResult.deletedCount,
      categories: catDeleteResult.deletedCount,
      importJobs: importDeleteResult.deletedCount,
      reviews: reviewDeleteResult.deletedCount,
    },
    after: {
      products: finalProductCount,
      categories: finalCategoryCount,
      importJobs: finalImportJobCount,
      users: finalUserCount,
      coupons: finalCouponCount,
    },
  };
}

// Run directly when called via node
if (process.argv[1] && process.argv[1].endsWith('resetCatalog.js')) {
  resetCatalog()
    .then(async () => {
      await disconnectDB();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('❌ Reset Catalog Failed:', err);
      await disconnectDB();
      process.exit(1);
    });
}
