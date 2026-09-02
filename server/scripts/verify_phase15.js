import dotenv from 'dotenv';
dotenv.config({ path: 'server/.env' });

import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import http from 'http';
import fs from 'fs';
import path from 'path';
import app from '../src/app.js';
import { config } from '../src/config/env.js';
import User from '../src/modules/users/user.model.js';
import Product from '../src/modules/products/product.model.js';
import Category from '../src/modules/categories/category.model.js';
import Content from '../src/modules/content/content.model.js';

let passed = 0;
let total = 0;
let server;
let baseUrl;

function assert(condition, message) {
  total++;
  if (condition) {
    passed++;
    console.log(`✔ [PASS] Test ${total}: ${message}`);
  } else {
    console.error(`❌ [FAIL] Test ${total}: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function request(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const headers = { 'Content-Type': 'application/json' };

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const fetchOptions = {
    method: options.method || 'GET',
    headers,
  };

  if (options.body) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  const res = await fetch(url, fetchOptions);
  let body = {};
  try {
    body = await res.json();
  } catch (e) {
    body = {};
  }
  return { status: res.status, body };
}

let adminUser, customerUser;
let adminToken, customerToken;
let testCategory, standardProduct, productWith3D, heroContent;
let timestamp, randSuffix;

async function setup() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/luxecart';
  await mongoose.connect(mongoUri);

  server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}/api/v1`;
      resolve();
    });
  });

  timestamp = Date.now();
  randSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
  const emailDomain = `@phase15final-${timestamp}-${randSuffix}.com`;

  adminUser = await User.create({
    name: 'Phase 15 Admin',
    email: `p15_admin${emailDomain}`,
    passwordHash: 'dummy_p15_admin_pw',
    role: 'ADMIN',
    isEmailVerified: true,
  });

  customerUser = await User.create({
    name: 'Phase 15 Customer',
    email: `p15_cust${emailDomain}`,
    passwordHash: 'dummy_p15_cust_pw',
    role: 'CUSTOMER',
    isEmailVerified: true,
  });

  adminToken = jwt.sign({ sub: adminUser._id.toString(), role: 'ADMIN' }, config.jwt.accessSecret, { expiresIn: '1h' });
  customerToken = jwt.sign({ sub: customerUser._id.toString(), role: 'CUSTOMER' }, config.jwt.accessSecret, { expiresIn: '1h' });

  testCategory = await Category.create({
    name: `High Horlogerie ${timestamp}`,
    slug: `high-horlogerie-${timestamp}`,
    isActive: true,
  });

  standardProduct = await Product.create({
    name: `Standard Timepiece ${randSuffix}`,
    slug: `std-timepiece-${timestamp}`,
    description: 'Stainless steel classic timepiece.',
    brand: 'LuxeCart Signature',
    category: testCategory._id,
    status: 'ACTIVE',
    variants: [
      {
        sku: `SKU-STD-${timestamp}`,
        price: 35000000,
        mrp: 40000000,
        inventory: { stock: 10, reserved: 0 },
        isActive: true,
      },
    ],
  });

  productWith3D = await Product.create({
    name: `Astronomical Armillary 3D ${randSuffix}`,
    slug: `armillary-3d-${timestamp}`,
    description: '18K Gold celestial armillary tourbillon chronometer with sapphire core.',
    brand: 'LuxeCart Signature',
    category: testCategory._id,
    status: 'ACTIVE',
    variants: [
      {
        sku: `SKU-ARM-${timestamp}`,
        price: 150000000,
        mrp: 180000000,
        inventory: { stock: 2, reserved: 0 },
        isActive: true,
      },
    ],
    model3d: {
      url: 'https://assets.luxecart.com/models/armillary.glb',
      format: 'GLB',
      posterUrl: 'https://assets.luxecart.com/posters/armillary.jpg',
      enabled: true,
    },
  });

  heroContent = await Content.create({
    type: 'HERO_BANNER',
    title: 'Phase 15 Masterpiece Collection',
    subtitle: 'Interactive 3D luxury horlogerie crafted in Geneva.',
    imageUrl: 'https://images.unsplash.com/watch-hero.jpg',
    ctaText: 'Explore Collection',
    ctaLink: `/shop?category=high-horlogerie-${timestamp}`,
    displayOrder: 0,
    isActive: true,
  });
}

async function runTests() {
  console.log('\n================================================================');
  console.log('  LuxeCart Phase 15 Final Verification Suite — Complete 3D Scope');
  console.log('================================================================\n');

  await setup();
  assert(true, 'Test fixtures initialized and catalog seeded');

  // -----------------------------------------------------------------
  // 1. Dependency Verification (3 tests)
  // -----------------------------------------------------------------
  const pkgJsonPath = path.resolve('client', 'package.json');
  const pkgContent = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));

  assert(Boolean(pkgContent.dependencies?.three), 'Three.js runtime installed in client/package.json');
  assert(Boolean(pkgContent.dependencies?.['@react-three/fiber']), '@react-three/fiber installed in client/package.json');
  assert(Boolean(pkgContent.dependencies?.['@react-three/drei']), '@react-three/drei installed in client/package.json');

  // -----------------------------------------------------------------
  // 2. Step 1 Architecture & Utilities (6 tests)
  // -----------------------------------------------------------------
  const webglUtilPath = path.resolve('client', 'src', 'utils', 'webgl.js');
  assert(fs.existsSync(webglUtilPath), 'WebGL capability detector client/src/utils/webgl.js exists');

  const motionHookPath = path.resolve('client', 'src', 'hooks', 'usePrefersReducedMotion.js');
  assert(fs.existsSync(motionHookPath), 'usePrefersReducedMotion hook client/src/hooks/usePrefersReducedMotion.js exists');

  const errBoundaryPath = path.resolve('client', 'src', 'components', 'home', 'three', 'ThreeErrorBoundary.jsx');
  assert(fs.existsSync(errBoundaryPath), 'ThreeErrorBoundary component exists');

  const heroCanvasPath = path.resolve('client', 'src', 'components', 'home', 'three', 'LuxuryHeroCanvas.jsx');
  assert(fs.existsSync(heroCanvasPath), 'LuxuryHeroCanvas component exists');

  const heroCanvasSource = fs.readFileSync(heroCanvasPath, 'utf8');
  assert(heroCanvasSource.includes('dpr={[1, 1.5]}'), 'LuxuryHeroCanvas uses bounded DPR [1, 1.5] for GPU efficiency');
  assert(heroCanvasSource.includes('touches'), 'LuxuryHeroCanvas configures touch isolation for mobile scroll safety');

  // -----------------------------------------------------------------
  // 3. Step 2 Product 3D Viewer & PDP Integration (10 tests)
  // -----------------------------------------------------------------
  const viewerPath = path.resolve('client', 'src', 'components', 'product', 'three', 'Product3DViewer.jsx');
  assert(fs.existsSync(viewerPath), 'Product3DViewer component client/src/components/product/three/Product3DViewer.jsx exists');

  const viewerSource = fs.readFileSync(viewerPath, 'utf8');
  assert(viewerSource.includes('dpr={[1, 1.5]}'), 'Product3DViewer uses bounded DPR [1, 1.5]');
  assert(viewerSource.includes('OrbitControls'), 'Product3DViewer uses OrbitControls');
  assert(viewerSource.includes('minDistance={2.0}'), 'Product3DViewer sets controlled minDistance zoom limit');
  assert(viewerSource.includes('maxDistance={7.0}'), 'Product3DViewer sets controlled maxDistance zoom limit');
  assert(viewerSource.includes('Reset Camera View'), 'Product3DViewer provides accessible Reset View action');
  assert(viewerSource.includes('touches='), 'Product3DViewer configures touch options for mobile scroll safety');

  const pdpPath = path.resolve('client', 'src', 'pages', 'ProductDetailPage.jsx');
  const pdpSource = fs.readFileSync(pdpPath, 'utf8');
  assert(pdpSource.includes('Product3DViewer = lazy'), 'ProductDetailPage dynamically imports Product3DViewer with React.lazy');
  assert(pdpSource.includes('2D Photos'), 'ProductDetailPage includes 2D Photos mode toggle');
  assert(pdpSource.includes('3D View'), 'ProductDetailPage includes 3D View mode toggle');

  // -----------------------------------------------------------------
  // 4. Product 3D Schema & Security Validation (7 tests)
  // -----------------------------------------------------------------
  assert(standardProduct.model3d?.enabled === false, 'Standard product defaults to model3d.enabled: false');
  assert(productWith3D.model3d?.enabled === true, '3D product stores model3d.enabled: true');
  assert(productWith3D.model3d?.format === 'GLB', '3D product stores format as GLB');

  // Insecure URL rejection
  let insecureUrlRejected = false;
  try {
    await Product.create({
      name: `Insecure URL Product ${randSuffix}`,
      slug: `insecure-url-${timestamp}`,
      description: 'Test product.',
      brand: 'Test Brand',
      category: testCategory._id,
      model3d: {
        url: 'javascript:alert("exploit")',
        format: 'GLB',
        enabled: true,
      },
    });
  } catch (err) {
    insecureUrlRejected = true;
  }
  assert(insecureUrlRejected, 'Insecure protocol in model3d.url rejected by schema validation');

  // Insecure poster URL rejection
  let insecurePosterRejected = false;
  try {
    await Product.create({
      name: `Insecure Poster Product ${randSuffix}`,
      slug: `insecure-poster-${timestamp}`,
      description: 'Test product.',
      brand: 'Test Brand',
      category: testCategory._id,
      model3d: {
        url: 'https://assets.luxecart.com/model.glb',
        format: 'GLB',
        posterUrl: 'data:text/html;base64,bad',
        enabled: true,
      },
    });
  } catch (err) {
    insecurePosterRejected = true;
  }
  assert(insecurePosterRejected, 'Insecure scheme in model3d.posterUrl rejected by schema validation');

  // Unsupported format rejection
  let badFormatRejected = false;
  try {
    await Product.create({
      name: `Bad Format Product ${randSuffix}`,
      slug: `bad-format-${timestamp}`,
      description: 'Test product.',
      brand: 'Test Brand',
      category: testCategory._id,
      model3d: {
        url: 'https://assets.luxecart.com/model.obj',
        format: 'OBJ',
        enabled: true,
      },
    });
  } catch (err) {
    badFormatRejected = true;
  }
  assert(badFormatRejected, 'Unsupported format (OBJ) rejected by schema enum');

  // -----------------------------------------------------------------
  // 5. Public API & Storefront Verification (5 tests)
  // -----------------------------------------------------------------
  const pdp3DRes = await request(`/products/${productWith3D.slug}`);
  assert(pdp3DRes.status === 200, 'GET /api/v1/products/:slug returns HTTP 200 for 3D product');
  assert(pdp3DRes.body.data?.product?.model3d?.enabled === true, 'Public PDP response returns model3d.enabled === true');
  assert(pdp3DRes.body.data?.product?.model3d?.url === 'https://assets.luxecart.com/models/armillary.glb', 'Public PDP response returns verified 3D model URL');

  const homeContentRes = await request('/content/homepage');
  assert(homeContentRes.status === 200, 'Public homepage content endpoint returns HTTP 200');
  assert(homeContentRes.body.data?.heroBanners?.length >= 1, 'Public homepage content includes active hero banner');

  // -----------------------------------------------------------------
  // 6. Platform Regression Verifications (10 tests)
  // -----------------------------------------------------------------
  const prodsRes = await request('/products');
  assert(prodsRes.status === 200, 'Public products catalog API regression check passed (200)');

  const catsRes = await request('/categories');
  assert(catsRes.status === 200, 'Public categories API regression check passed (200)');

  const adminProdsRes = await request('/admin/products', { token: adminToken });
  assert(adminProdsRes.status === 200, 'Admin products API regression check passed (200)');

  const adminOrdsRes = await request('/admin/orders', { token: adminToken });
  assert(adminOrdsRes.status === 200, 'Admin orders API regression check passed (200)');

  const adminRetsRes = await request('/admin/returns', { token: adminToken });
  assert(adminRetsRes.status === 200, 'Admin returns API regression check passed (200)');

  const adminSuppRes = await request('/admin/support/tickets', { token: adminToken });
  assert(adminSuppRes.status === 200, 'Admin support tickets API regression check passed (200)');

  const adminAnaRes = await request('/admin/analytics/summary', { token: adminToken });
  assert(adminAnaRes.status === 200, 'Admin analytics summary API regression check passed (200)');

  const adminInvRes = await request('/admin/analytics/inventory-summary', { token: adminToken });
  assert(adminInvRes.status === 200, 'Admin inventory summary API regression check passed (200)');

  const adminContentRes = await request('/admin/content', { token: adminToken });
  assert(adminContentRes.status === 200, 'Admin content management API regression check passed (200)');

  // -----------------------------------------------------------------
  // 7. Vite Bundle & Chunking Architecture (5 tests)
  // -----------------------------------------------------------------
  const viteConfigPath = path.resolve('client', 'vite.config.js');
  const viteConfigSource = fs.readFileSync(viteConfigPath, 'utf8');
  assert(viteConfigSource.includes('three-vendor'), 'Vite configuration isolates Three.js runtime into dedicated three-vendor chunk');

  const heroSectionPath = path.resolve('client', 'src', 'components', 'home', 'HeroBannerSection.jsx');
  const heroSectionSource = fs.readFileSync(heroSectionPath, 'utf8');
  assert(heroSectionSource.includes('LuxuryHeroCanvas = lazy'), 'HeroBannerSection isolates 3D canvas with React.lazy');
  assert(heroSectionSource.includes('ThreeErrorBoundary'), 'HeroBannerSection isolates 3D canvas with ThreeErrorBoundary');

  const motionHookSource = fs.readFileSync(motionHookPath, 'utf8');
  assert(motionHookSource.includes('prefers-reduced-motion: reduce'), 'usePrefersReducedMotion queries prefers-reduced-motion media');
  assert(viewerSource.includes('aria-label'), 'Product3DViewer includes accessible aria-label attributes');

  // Cleanup
  await Content.deleteOne({ _id: heroContent._id });
  await Product.deleteMany({ _id: { $in: [standardProduct._id, productWith3D._id] } });
  await Category.deleteOne({ _id: testCategory._id });
  await User.deleteMany({ _id: { $in: [adminUser._id, customerUser._id] } });

  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();

  console.log('\n================================================================');
  console.log(`  ALL PHASE 15 TESTS PASSED: ${passed}/${total}`);
  console.log('================================================================\n');
}

runTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
