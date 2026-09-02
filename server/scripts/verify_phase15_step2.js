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

async function runPhase15Step2Verification() {
  console.log('\n================================================================');
  console.log('  LuxeCart Phase 15 Step 2: 3D Product Viewer & PDP Verification');
  console.log('================================================================\n');

  await connectDB(mongoUri);

  const timestamp = Date.now();
  const rand = Math.random().toString(36).substring(2, 7);
  const rawPassword = 'SecurePassword123!';
  const hashedPassword = await hashPassword(rawPassword);

  const adminEmail = `p15_admin_${timestamp}_${rand}@luxecart.test`;
  const customerEmail = `p15_cust_${timestamp}_${rand}@luxecart.test`;

  const adminUser = await User.create({
    name: '3D Admin Tester',
    email: adminEmail,
    passwordHash: hashedPassword,
    role: 'ADMIN',
    isActive: true,
  });

  const customerUser = await User.create({
    name: '3D Customer Tester',
    email: customerEmail,
    passwordHash: hashedPassword,
    role: 'CUSTOMER',
    isActive: true,
  });

  // Log in to get genuine session cookies
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
      name: `Luxury Watches ${rand}`,
      slug: `luxury-watches-${rand}`,
      isActive: true,
    });
  }

  let normalProduct = null;
  let productWith3D = null;

  try {
    // -------------------------------------------------------------
    // SECTION 1: Product Validator & 3D Metadata Validation
    // -------------------------------------------------------------
    const valid3dInput = {
      name: 'Chronometer Royal 3D',
      brand: 'Vacheron & Co',
      category: testCategory._id.toString(),
      description: 'An exceptional haute-horlogerie timepiece with full 3D interactive model.',
      model3d: {
        enabled: true,
        url: 'https://assets.luxecart.com/models/chronometer.glb',
        format: 'GLB',
        posterUrl: 'https://assets.luxecart.com/posters/chronometer.jpg',
      },
    };
    const validValidation = validateProductInput(valid3dInput, false);
    assert(validValidation.isValid, 'Validator accepts valid HTTPS 3D model metadata');
    assert(validValidation.sanitized.model3d?.enabled === true, 'Sanitized model3d.enabled is preserved');
    assert(validValidation.sanitized.model3d?.format === 'GLB', 'Sanitized model3d.format is uppercase GLB');

    // Test rejection of insecure javascript: and data: protocols
    const unsafeProtocolInput = {
      ...valid3dInput,
      model3d: {
        enabled: true,
        url: 'javascript:alert(1)',
        format: 'GLB',
      },
    };
    const unsafeValidation = validateProductInput(unsafeProtocolInput, false);
    assert(!unsafeValidation.isValid, 'Validator rejects javascript: protocol in model URL');

    const unsafePosterInput = {
      ...valid3dInput,
      model3d: {
        enabled: true,
        url: 'https://assets.luxecart.com/model.glb',
        posterUrl: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
      },
    };
    const unsafePosterValidation = validateProductInput(unsafePosterInput, false);
    assert(!unsafePosterValidation.isValid, 'Validator rejects data: protocol in poster URL');

    const invalidFormatInput = {
      ...valid3dInput,
      model3d: {
        enabled: true,
        url: 'https://assets.luxecart.com/model.obj',
        format: 'OBJ',
      },
    };
    const invalidFormatValidation = validateProductInput(invalidFormatInput, false);
    assert(!invalidFormatValidation.isValid, 'Validator rejects unsupported 3D format OBJ');

    // -------------------------------------------------------------
    // SECTION 2: Database Persistence & API Integration
    // -------------------------------------------------------------
    // Create a normal product without 3D metadata
    normalProduct = await Product.create({
      name: `Classic Silk Tie ${rand}`,
      slug: `classic-silk-tie-${rand}`,
      brand: 'LuxeCart Heritage',
      description: 'Fine mulberry silk tie woven in Italy.',
      category: testCategory._id,
      categoryTree: [testCategory._id],
      status: 'ACTIVE',
      images: [{ url: 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10', isPrimary: true }],
      variants: [
        {
          sku: `TIE-BLU-${rand}`.toUpperCase(),
          price: 490000,
          mrp: 590000,
          inventory: { stock: 15 },
        },
      ],
      priceSummary: { minPrice: 490000, maxPrice: 490000, hasStock: true, totalStock: 15 },
    });
    assert(normalProduct._id !== undefined, 'Normal product without 3D model persisted successfully');
    assert(normalProduct.model3d?.enabled === false, 'Default product model3d.enabled is false');

    // Create a product WITH 3D model metadata
    productWith3D = await Product.create({
      name: `Haute Chronometer 3D ${rand}`,
      slug: `haute-chronometer-3d-${rand}`,
      brand: 'LuxeHorology',
      description: 'Masterwork timepiece featuring interactive 3D digital twin.',
      category: testCategory._id,
      categoryTree: [testCategory._id],
      status: 'ACTIVE',
      images: [{ url: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9', isPrimary: true }],
      model3d: {
        enabled: true,
        url: 'https://models.luxecart.com/chronometer.glb',
        format: 'GLB',
        posterUrl: 'https://images.luxecart.com/chronometer-poster.jpg',
      },
      variants: [
        {
          sku: `WATCH-3D-${rand}`.toUpperCase(),
          price: 25000000,
          mrp: 28000000,
          inventory: { stock: 5 },
        },
      ],
      priceSummary: { minPrice: 25000000, maxPrice: 25000000, hasStock: true, totalStock: 5 },
    });
    assert(productWith3D._id !== undefined, 'Product with 3D model metadata persisted successfully');

    // Test Public Single Product API
    const pub3dRes = await request(`/products/${productWith3D.slug}`);
    assert(pub3dRes.status === 200, 'Public GET /products/:slug returns 200 for 3D product');
    assert(pub3dRes.body.data?.product?.model3d?.enabled === true, 'Public API returns model3d.enabled = true');
    assert(pub3dRes.body.data?.product?.model3d?.url === 'https://models.luxecart.com/chronometer.glb', 'Public API returns model3d.url');
    assert(pub3dRes.body.data?.product?.model3d?.format === 'GLB', 'Public API returns model3d.format');
    assert(pub3dRes.body.data?.product?.searchKeywords === undefined, 'Public API does not leak internal searchKeywords');

    const pubNormalRes = await request(`/products/${normalProduct.slug}`);
    assert(pubNormalRes.status === 200, 'Public GET /products/:slug returns 200 for normal product');
    assert(pubNormalRes.body.data?.product?.model3d?.enabled === false, 'Public API returns model3d.enabled = false for normal product');

    // -------------------------------------------------------------
    // SECTION 3: Admin Authorization & Product API Guards
    // -------------------------------------------------------------
    const custUpdateRes = await request(`/admin/products/${productWith3D._id}`, {
      method: 'PATCH',
      cookie: customerCookie,
      body: { name: 'Hacked Product' },
    });
    assert(custUpdateRes.status === 403, 'Customer role cannot modify 3D product metadata (403)');

    const adminUpdateRes = await request(`/admin/products/${productWith3D._id}`, {
      method: 'PATCH',
      cookie: adminCookie,
      body: {
        name: `Haute Chronometer Updated ${rand}`,
        brand: 'LuxeHorology',
        category: testCategory._id.toString(),
        description: 'Updated description for 3D timepiece.',
        model3d: {
          enabled: true,
          url: 'https://models.luxecart.com/chronometer-v2.glb',
          format: 'GLB',
          posterUrl: 'https://images.luxecart.com/poster-v2.jpg',
        },
      },
    });
    assert(adminUpdateRes.status === 200, 'Admin can update product 3D metadata');
    assert(
      adminUpdateRes.body.data?.product?.model3d?.url === 'https://models.luxecart.com/chronometer-v2.glb',
      'Admin updated model3d URL successfully'
    );

    // -------------------------------------------------------------
    // SECTION 4: Frontend Source Code Invariants
    // -------------------------------------------------------------
    const viewerPath = path.resolve(__dirname, '../../client/src/components/product/three/Product3DViewer.jsx');
    assert(fs.existsSync(viewerPath), 'Product3DViewer.jsx exists in client components');
    const viewerContent = fs.readFileSync(viewerPath, 'utf8');

    assert(viewerContent.includes('useGLTF'), 'Product3DViewer.jsx uses Drei useGLTF loader');
    assert(viewerContent.includes('OrbitControls'), 'Product3DViewer.jsx implements Drei OrbitControls');
    assert(viewerContent.includes('usePrefersReducedMotion'), 'Product3DViewer.jsx respects reduced motion preferences');
    assert(viewerContent.includes('isWebGLSupported'), 'Product3DViewer.jsx checks WebGL device support');
    assert(viewerContent.includes('RotateCcw'), 'Product3DViewer.jsx provides Reset View button');
    assert(viewerContent.includes('THREE.TOUCH.ROTATE'), 'Product3DViewer.jsx configures touch orbit gesture');

    const pdpPath = path.resolve(__dirname, '../../client/src/pages/ProductDetailPage.jsx');
    const pdpContent = fs.readFileSync(pdpPath, 'utf8');

    assert(
      pdpContent.includes("lazy(() => import('../components/product/three/Product3DViewer'))"),
      'ProductDetailPage.jsx lazy loads Product3DViewer'
    );
    assert(
      pdpContent.includes('product?.model3d?.enabled && product?.model3d?.url'),
      'ProductDetailPage.jsx exposes 3D tab only when 3D model is enabled and URL exists'
    );
    assert(
      pdpContent.includes('ThreeErrorBoundary'),
      'ProductDetailPage.jsx wraps 3D viewer in ThreeErrorBoundary'
    );
    assert(
      pdpContent.includes('galleryMode'),
      'ProductDetailPage.jsx maintains gallery mode switching between 2D Photos and 3D View'
    );

    const adminCreatePath = path.resolve(__dirname, '../../client/src/pages/admin/AdminProductCreatePage.jsx');
    const adminCreateContent = fs.readFileSync(adminCreatePath, 'utf8');
    assert(
      adminCreateContent.includes('3D Interactive Model') && adminCreateContent.includes('model3d'),
      'AdminProductCreatePage.jsx provides 3D model configuration UI'
    );

    const adminEditPath = path.resolve(__dirname, '../../client/src/pages/admin/AdminProductEditPage.jsx');
    const adminEditContent = fs.readFileSync(adminEditPath, 'utf8');
    assert(
      adminEditContent.includes('3D Interactive Model') && adminEditContent.includes('model3d'),
      'AdminProductEditPage.jsx provides 3D model editing controls'
    );

    // -------------------------------------------------------------
    // SECTION 5: Core E-Commerce API Regression
    // -------------------------------------------------------------
    const prodListRes = await request('/products');
    assert(prodListRes.status === 200, 'Public GET /products returns 200 OK');

    const catListRes = await request('/categories');
    assert(catListRes.status === 200, 'Public GET /categories returns 200 OK');

    const cartRes = await request('/cart', { cookie: customerCookie });
    assert(cartRes.status === 200, 'Customer GET /cart returns 200 OK');

    const wishlistRes = await request('/wishlist', { cookie: customerCookie });
    assert(wishlistRes.status === 200, 'Customer GET /wishlist returns 200 OK');

    const ordersRes = await request('/orders', { cookie: customerCookie });
    assert(ordersRes.status === 200, 'Customer GET /orders returns 200 OK');

    const adminProdListRes = await request('/admin/products', { cookie: adminCookie });
    assert(adminProdListRes.status === 200, 'Admin GET /admin/products returns 200 OK');

    const adminOrdersListRes = await request('/admin/orders', { cookie: adminCookie });
    assert(adminOrdersListRes.status === 200, 'Admin GET /admin/orders returns 200 OK');

  } finally {
    // Clean up test fixtures
    if (normalProduct) await Product.deleteOne({ _id: normalProduct._id });
    if (productWith3D) await Product.deleteOne({ _id: productWith3D._id });
    await User.deleteMany({ _id: { $in: [adminUser._id, customerUser._id] } });
    console.log('\n✔ Test fixtures cleaned up successfully.');
  }

  await disconnectDB();

  console.log('\n================================================================');
  console.log(`  ALL PHASE 15 STEP 2 VERIFICATION CHECKS PASSED: ${passedTests}/${totalTests}`);
  console.log('================================================================\n');
}

runPhase15Step2Verification().catch(async (err) => {
  console.error('\n❌ Phase 15 Step 2 Verification failed:', err);
  await disconnectDB().catch(() => {});
  process.exit(1);
});
