import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { config } from '../src/config/env.js';
import { connectDB, disconnectDB } from '../src/config/database.js';
import User from '../src/modules/users/user.model.js';
import Product from '../src/modules/products/product.model.js';
import Category from '../src/modules/categories/category.model.js';
import { hashPassword } from '../src/utils/token.js';
import { validateProductInput } from '../src/validators/product.validator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });
const mongoUri = process.env.MONGODB_URI || config.mongoUri || 'mongodb://localhost:27017/luxecart';

const BASE_URL = `http://localhost:${config.port}/api/v1`;

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`✔ [PASS] Test ${totalTests}: ${message}`);
    passedTests++;
  } else {
    console.error(`❌ [FAIL] Test ${totalTests}: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.cookie ? { Cookie: options.cookie } : {}),
    ...options.headers,
  };

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  let body = {};
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }

  return {
    status: response.status,
    headers: response.headers,
    body,
  };
}

async function runPhase15Step3MasterVerification() {
  console.log('\n================================================================');
  console.log('  LuxeCart Phase 15 Step 3: Final Verification & Hardening Audit');
  console.log('================================================================\n');

  await connectDB(mongoUri);

  const timestamp = Date.now();
  const rand = Math.random().toString(36).substring(2, 7);
  const rawPassword = 'MasterPassword123!';
  const hashedPassword = await hashPassword(rawPassword);

  const adminEmail = `p15_s3_admin_${timestamp}_${rand}@luxecart.test`;
  const customerEmail = `p15_s3_cust_${timestamp}_${rand}@luxecart.test`;

  const adminUser = await User.create({
    name: 'Phase 15 Lead Admin',
    email: adminEmail,
    passwordHash: hashedPassword,
    role: 'ADMIN',
    isActive: true,
  });

  const customerUser = await User.create({
    name: 'Phase 15 Customer',
    email: customerEmail,
    passwordHash: hashedPassword,
    role: 'CUSTOMER',
    isActive: true,
  });

  const adminLoginRes = await request('/auth/login', {
    method: 'POST',
    body: { email: adminEmail, password: rawPassword },
  });
  const custLoginRes = await request('/auth/login', {
    method: 'POST',
    body: { email: customerEmail, password: rawPassword },
  });

  const adminCookie = adminLoginRes.headers.get('set-cookie');
  const customerCookie = custLoginRes.headers.get('set-cookie');

  let testCategory = await Category.findOne();
  if (!testCategory) {
    testCategory = await Category.create({
      name: `Haute Horlogerie ${rand}`,
      slug: `haute-horlogerie-${rand}`,
      isActive: true,
    });
  }

  let normalProduct = null;
  let product3D = null;

  try {
    // -------------------------------------------------------------
    // SECTION 1: Package Dependencies & Bundle Code Splitting
    // -------------------------------------------------------------
    const clientPkgPath = path.resolve(__dirname, '../../client/package.json');
    const clientPkg = JSON.parse(fs.readFileSync(clientPkgPath, 'utf8'));
    assert(clientPkg.dependencies?.three !== undefined, 'three package dependency is declared');
    assert(clientPkg.dependencies?.['@react-three/fiber'] !== undefined, '@react-three/fiber dependency is declared');
    assert(clientPkg.dependencies?.['@react-three/drei'] !== undefined, '@react-three/drei dependency is declared');

    const viteConfigPath = path.resolve(__dirname, '../../client/vite.config.js');
    const viteConfigContent = fs.readFileSync(viteConfigPath, 'utf8');
    assert(viteConfigContent.includes('three-vendor'), 'vite.config.js defines isolated three-vendor manualChunk');

    // -------------------------------------------------------------
    // SECTION 2: 3D Source Code Invariants & Non-Blocking Imports
    // -------------------------------------------------------------
    const heroSectionPath = path.resolve(__dirname, '../../client/src/components/home/HeroBannerSection.jsx');
    const heroSectionContent = fs.readFileSync(heroSectionPath, 'utf8');
    assert(
      heroSectionContent.includes("lazy(() => import('./three/LuxuryHeroCanvas'))"),
      'HeroBannerSection lazy loads LuxuryHeroCanvas'
    );

    const pdpPath = path.resolve(__dirname, '../../client/src/pages/ProductDetailPage.jsx');
    const pdpContent = fs.readFileSync(pdpPath, 'utf8');
    assert(
      pdpContent.includes("lazy(() => import('../components/product/three/Product3DViewer'))"),
      'ProductDetailPage lazy loads Product3DViewer'
    );
    assert(
      pdpContent.includes('product?.model3d?.enabled && product?.model3d?.url'),
      'ProductDetailPage exposes 3D tab only when enabled AND model URL exists'
    );

    const heroCanvasPath = path.resolve(__dirname, '../../client/src/components/home/three/LuxuryHeroCanvas.jsx');
    const heroCanvasContent = fs.readFileSync(heroCanvasPath, 'utf8');
    assert(heroCanvasContent.includes('usePrefersReducedMotion'), 'LuxuryHeroCanvas implements usePrefersReducedMotion');
    assert(heroCanvasContent.includes('touch-pan-y'), 'LuxuryHeroCanvas implements scoped touch-pan-y');
    assert(heroCanvasContent.includes('OrbitControls'), 'LuxuryHeroCanvas implements OrbitControls');

    const productViewerPath = path.resolve(__dirname, '../../client/src/components/product/three/Product3DViewer.jsx');
    const productViewerContent = fs.readFileSync(productViewerPath, 'utf8');
    assert(productViewerContent.includes('useGLTF'), 'Product3DViewer uses Drei useGLTF loader');
    assert(productViewerContent.includes('isWebGLSupported'), 'Product3DViewer checks WebGL support');
    assert(productViewerContent.includes('RotateCcw'), 'Product3DViewer provides camera reset control');
    assert(productViewerContent.includes('touch-pan-y'), 'Product3DViewer implements scoped touch-pan-y');
    assert(productViewerContent.includes('THREE.TOUCH.ROTATE'), 'Product3DViewer configures touch gesture rotation');

    const errorBoundaryPath = path.resolve(__dirname, '../../client/src/components/home/three/ThreeErrorBoundary.jsx');
    assert(fs.existsSync(errorBoundaryPath), 'ThreeErrorBoundary component exists');

    // -------------------------------------------------------------
    // SECTION 3: 3D Metadata Validation & Protocol Security
    // -------------------------------------------------------------
    const validModelInput = {
      name: 'Diamond Masterpiece 3D',
      brand: 'LuxeCart Rare',
      category: testCategory._id.toString(),
      description: 'Handcrafted diamond encrusted timepiece with 3D digital twin.',
      model3d: {
        enabled: true,
        url: 'https://cdn.luxecart.com/models/masterpiece.glb',
        format: 'GLB',
        posterUrl: 'https://cdn.luxecart.com/posters/masterpiece.jpg',
      },
    };
    const validVal = validateProductInput(validModelInput, false);
    assert(validVal.isValid, 'Product validator accepts valid HTTPS 3D model metadata');
    assert(validVal.sanitized.model3d?.enabled === true, 'Sanitized model3d.enabled is preserved');
    assert(validVal.sanitized.model3d?.format === 'GLB', 'Sanitized model3d.format is GLB');

    const jsInjectionInput = {
      ...validModelInput,
      model3d: {
        enabled: true,
        url: 'javascript:alert(document.cookie)',
        format: 'GLB',
      },
    };
    const jsVal = validateProductInput(jsInjectionInput, false);
    assert(!jsVal.isValid, 'Product validator rejects javascript: execution protocol');

    const dataUriInput = {
      ...validModelInput,
      model3d: {
        enabled: true,
        url: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
        format: 'GLB',
      },
    };
    const dataVal = validateProductInput(dataUriInput, false);
    assert(!dataVal.isValid, 'Product validator rejects data: URI protocol');

    const invalidFormatInput = {
      ...validModelInput,
      model3d: {
        enabled: true,
        url: 'https://cdn.luxecart.com/model.fbx',
        format: 'FBX',
      },
    };
    const formatVal = validateProductInput(invalidFormatInput, false);
    assert(!formatVal.isValid, 'Product validator rejects non-GLB/GLTF formats (FBX)');

    // -------------------------------------------------------------
    // SECTION 4: Database Persistence & API Output Safety
    // -------------------------------------------------------------
    normalProduct = await Product.create({
      name: `Vintage Leather Bag ${rand}`,
      slug: `vintage-leather-bag-${rand}`,
      brand: 'LuxeCart Heritage',
      description: 'Full-grain Italian calfskin briefcase.',
      category: testCategory._id,
      categoryTree: [testCategory._id],
      status: 'ACTIVE',
      images: [{ url: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa', isPrimary: true }],
      variants: [
        {
          sku: `BAG-${rand}`.toUpperCase(),
          price: 1800000,
          mrp: 2100000,
          inventory: { stock: 8 },
        },
      ],
      priceSummary: { minPrice: 1800000, maxPrice: 1800000, hasStock: true, totalStock: 8 },
    });
    assert(normalProduct._id !== undefined, 'Normal product persisted without 3D requirements');
    assert(normalProduct.model3d?.enabled === false, 'Normal product model3d defaults to disabled');

    product3D = await Product.create({
      name: `Celestial Chrono 3D ${rand}`,
      slug: `celestial-chrono-3d-${rand}`,
      brand: 'LuxeCart Horology',
      description: 'Astronomical celestial complication with 3D model.',
      category: testCategory._id,
      categoryTree: [testCategory._id],
      status: 'ACTIVE',
      images: [{ url: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d', isPrimary: true }],
      model3d: {
        enabled: true,
        url: 'https://models.luxecart.com/celestial.glb',
        format: 'GLB',
        posterUrl: 'https://images.luxecart.com/celestial-poster.jpg',
      },
      variants: [
        {
          sku: `CEL-${rand}`.toUpperCase(),
          price: 35000000,
          mrp: 38000000,
          inventory: { stock: 3 },
        },
      ],
      priceSummary: { minPrice: 35000000, maxPrice: 35000000, hasStock: true, totalStock: 3 },
    });
    assert(product3D._id !== undefined, '3D product model persisted successfully');

    // Public Product API Query
    const pub3dRes = await request(`/products/${product3D.slug}`);
    assert(pub3dRes.status === 200, 'Public GET /products/:slug returns 200 OK for 3D product');
    assert(pub3dRes.body.data?.product?.model3d?.enabled === true, 'Public API returns model3d.enabled = true');
    assert(pub3dRes.body.data?.product?.model3d?.url === 'https://models.luxecart.com/celestial.glb', 'Public API returns model3d.url');
    assert(pub3dRes.body.data?.product?.model3d?.format === 'GLB', 'Public API returns model3d.format = GLB');
    assert(pub3dRes.body.data?.product?.searchKeywords === undefined, 'Public API does not leak internal keywords');

    const pubNormRes = await request(`/products/${normalProduct.slug}`);
    assert(pubNormRes.status === 200, 'Public GET /products/:slug returns 200 OK for normal product');
    assert(pubNormRes.body.data?.product?.model3d?.enabled === false, 'Public API returns model3d.enabled = false for normal product');

    // Customer vs Admin Authorization
    const custEditRes = await request(`/admin/products/${product3D._id}`, {
      method: 'PATCH',
      cookie: customerCookie,
      body: { name: 'Unauthorized Modify' },
    });
    assert(custEditRes.status === 403, 'Customer cannot modify product via admin API (403)');

    const adminEditRes = await request(`/admin/products/${product3D._id}`, {
      method: 'PATCH',
      cookie: adminCookie,
      body: {
        name: `Celestial Chrono 3D v2 ${rand}`,
        brand: 'LuxeCart Horology',
        category: testCategory._id.toString(),
        description: 'Updated celestial complication.',
        model3d: {
          enabled: true,
          url: 'https://models.luxecart.com/celestial-v2.glb',
          format: 'GLB',
          posterUrl: 'https://images.luxecart.com/poster-v2.jpg',
        },
      },
    });
    assert(adminEditRes.status === 200, 'Admin can update 3D model metadata via admin API (200)');
    assert(
      adminEditRes.body.data?.product?.model3d?.url === 'https://models.luxecart.com/celestial-v2.glb',
      'Admin updated 3D model URL successfully'
    );

    // -------------------------------------------------------------
    // SECTION 5: Comprehensive Commerce & Admin Regression
    // -------------------------------------------------------------
    const prodRes = await request('/products');
    assert(prodRes.status === 200, 'Public GET /products regression PASS');

    const catRes = await request('/categories');
    assert(catRes.status === 200, 'Public GET /categories regression PASS');

    const cartRes = await request('/cart', { cookie: customerCookie });
    assert(cartRes.status === 200, 'Customer GET /cart regression PASS');

    const wishlistRes = await request('/wishlist', { cookie: customerCookie });
    assert(wishlistRes.status === 200, 'Customer GET /wishlist regression PASS');

    const ordersRes = await request('/orders', { cookie: customerCookie });
    assert(ordersRes.status === 200, 'Customer GET /orders regression PASS');

    const adminProdRes = await request('/admin/products', { cookie: adminCookie });
    assert(adminProdRes.status === 200, 'Admin GET /admin/products regression PASS');

    const adminOrdersRes = await request('/admin/orders', { cookie: adminCookie });
    assert(adminOrdersRes.status === 200, 'Admin GET /admin/orders regression PASS');

    const adminReturnsRes = await request('/admin/returns', { cookie: adminCookie });
    assert(adminReturnsRes.status === 200, 'Admin GET /admin/returns regression PASS');

    const adminContentRes = await request('/admin/content', { cookie: adminCookie });
    assert(adminContentRes.status === 200, 'Admin GET /admin/content regression PASS');

    const adminAnalyticsRes = await request('/admin/analytics/summary', { cookie: adminCookie });
    assert(adminAnalyticsRes.status === 200, 'Admin GET /admin/analytics/summary regression PASS');

  } finally {
    if (normalProduct) await Product.deleteOne({ _id: normalProduct._id });
    if (product3D) await Product.deleteOne({ _id: product3D._id });
    await User.deleteMany({ _id: { $in: [adminUser._id, customerUser._id] } });
    console.log('\n✔ Test fixtures cleaned up successfully.');
  }

  await disconnectDB();

  console.log('\n================================================================');
  console.log(`  ALL PHASE 15 STEP 3 VERIFICATION CHECKS PASSED: ${passedTests}/${totalTests}`);
  console.log('================================================================\n');
}

runPhase15Step3MasterVerification().catch(async (err) => {
  console.error('\n❌ Phase 15 Step 3 Verification failed:', err);
  await disconnectDB().catch(() => {});
  process.exit(1);
});
