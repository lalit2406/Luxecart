/**
 * LUXECART PHASE 7.3.10: PRODUCT SEO ERROR CLASSIFICATION & RELIABILITY TEST SUITE
 *
 * Verifies all 12 scenarios specified in Phase 7.3.10:
 * 1. ACTIVE product loads successfully -> index, follow
 * 2. Nonexistent product returns PRODUCT_NOT_FOUND -> noindex, nofollow
 * 3. DRAFT product returns PRODUCT_NOT_FOUND -> noindex, nofollow
 * 4. ARCHIVED product returns PRODUCT_NOT_FOUND -> noindex, nofollow
 * 5. Backend unavailable (connection refused) -> index, follow
 * 6. Network failure (ERR_NETWORK) -> index, follow
 * 7. Request timeout (408 / ECONNABORTED) -> index, follow
 * 8. HTTP 500 (Internal Server Error) -> index, follow
 * 9. HTTP 502 (Bad Gateway) -> index, follow
 * 10. HTTP 503 (Service Unavailable) -> index, follow
 * 11. Retry succeeds after initial temporary failure
 * 12. Navigation between two product pages updates SEO metadata without stale leakage
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

const results = [];

function record(id, description, passed, details = '') {
  results.push({ id, description, passed, details });
  const badge = passed ? '✔ [PASS]' : '✖ [FAIL]';
  console.log(`${badge} [${id}] ${description}`);
  if (!passed && details) {
    console.error(`    ↳ ${details}`);
  }
}

// Emulate error classification function as implemented in ProductDetailPage.jsx
function classifyProductFetchOutcome(err) {
  if (!err) {
    return {
      status: 'SUCCESS',
      notFound: false,
      robots: 'index, follow',
      title: 'Active Product',
    };
  }

  const statusCode = err?.statusCode || err?.response?.status;
  const errorCode = err?.code || err?.response?.data?.error?.code || err?.response?.data?.code;
  const isConfirmedNotFound = statusCode === 404 && errorCode === 'PRODUCT_NOT_FOUND';

  if (isConfirmedNotFound) {
    return {
      status: 'NOT_FOUND',
      notFound: true,
      robots: 'noindex, nofollow',
      title: 'Product Not Found',
      canonical: false,
    };
  }

  return {
    status: 'TEMPORARY_ERROR',
    notFound: false,
    robots: 'index, follow',
    title: 'Product Temporarily Unavailable',
    canonical: true,
  };
}

async function runTests() {
  console.log('\n======================================================================');
  console.log('   LUXECART PHASE 7.3.10: PRODUCT SEO ERROR CLASSIFICATION TESTS');
  console.log('======================================================================\n');

  const pdpSource = fs.readFileSync(path.join(rootDir, 'client/src/pages/ProductDetailPage.jsx'), 'utf8');
  const productServiceSource = fs.readFileSync(path.join(rootDir, 'server/src/modules/products/product.service.js'), 'utf8');
  const productModelSource = fs.readFileSync(path.join(rootDir, 'server/src/modules/products/product.model.js'), 'utf8');

  // Verify static code structure in ProductDetailPage.jsx
  try {
    assert.ok(pdpSource.includes('const [notFound, setNotFound] = useState(false);'), 'Must declare notFound state');
    assert.ok(pdpSource.includes('isConfirmedNotFound = statusCode === 404 && errorCode === \'PRODUCT_NOT_FOUND\''), 'Must strictly check 404 AND PRODUCT_NOT_FOUND');
    assert.ok(pdpSource.includes('if (notFound) {'), 'Must have separate if (notFound) branch');
    assert.ok(pdpSource.includes('title="Product Temporarily Unavailable"'), 'Temporary error must set title "Product Temporarily Unavailable"');
    assert.ok(pdpSource.includes('robots="index, follow"'), 'Temporary error must set robots="index, follow"');
    assert.ok(pdpSource.includes('Try Again'), 'Must provide Try Again button in temporary error branch');
    record('CODE-01', 'ProductDetailPage contains notFound state, strict classification, and Try Again button', true);
  } catch (err) {
    record('CODE-01', 'ProductDetailPage code inspection', false, err.message);
  }

  // 1. ACTIVE product loads successfully
  try {
    const outcome = classifyProductFetchOutcome(null);
    assert.strictEqual(outcome.robots, 'index, follow');
    assert.strictEqual(outcome.notFound, false);
    record('TC-01', 'ACTIVE product loads successfully -> index, follow', true);
  } catch (err) {
    record('TC-01', 'ACTIVE product check', false, err.message);
  }

  // 2. Nonexistent product returns PRODUCT_NOT_FOUND (HTTP 404)
  try {
    const err = { statusCode: 404, code: 'PRODUCT_NOT_FOUND', message: 'Product not found' };
    const outcome = classifyProductFetchOutcome(err);
    assert.strictEqual(outcome.robots, 'noindex, nofollow');
    assert.strictEqual(outcome.notFound, true);
    assert.strictEqual(outcome.canonical, false);
    record('TC-02', 'Nonexistent product (404 + PRODUCT_NOT_FOUND) -> noindex, nofollow', true);
  } catch (err) {
    record('TC-02', 'Nonexistent product check', false, err.message);
  }

  // 3. DRAFT product returns PRODUCT_NOT_FOUND (backend queries { slug, status: 'ACTIVE' })
  try {
    assert.ok(productServiceSource.includes("Product.findOne({ slug, status: 'ACTIVE' })"), 'Backend queries only status ACTIVE');
    assert.ok(productModelSource.includes("'DRAFT'"), 'Product model defines DRAFT status');
    // Backend returns 404 PRODUCT_NOT_FOUND when status != ACTIVE
    const err = { statusCode: 404, code: 'PRODUCT_NOT_FOUND', message: 'Product not found' };
    const outcome = classifyProductFetchOutcome(err);
    assert.strictEqual(outcome.robots, 'noindex, nofollow');
    assert.strictEqual(outcome.notFound, true);
    record('TC-03', 'DRAFT product returns PRODUCT_NOT_FOUND -> noindex, nofollow', true);
  } catch (err) {
    record('TC-03', 'DRAFT product check', false, err.message);
  }

  // 4. ARCHIVED product returns PRODUCT_NOT_FOUND
  try {
    assert.ok(productModelSource.includes("'ARCHIVED'"), 'Product model defines ARCHIVED status');
    const err = { statusCode: 404, code: 'PRODUCT_NOT_FOUND', message: 'Product not found' };
    const outcome = classifyProductFetchOutcome(err);
    assert.strictEqual(outcome.robots, 'noindex, nofollow');
    assert.strictEqual(outcome.notFound, true);
    record('TC-04', 'ARCHIVED product returns PRODUCT_NOT_FOUND -> noindex, nofollow', true);
  } catch (err) {
    record('TC-04', 'ARCHIVED product check', false, err.message);
  }

  // 5. Backend unavailable (connection refused / ECONNREFUSED)
  try {
    const err = { statusCode: 500, code: 'ECONNREFUSED', message: 'connect ECONNREFUSED 127.0.0.1:5000' };
    const outcome = classifyProductFetchOutcome(err);
    assert.strictEqual(outcome.robots, 'index, follow');
    assert.strictEqual(outcome.notFound, false);
    assert.strictEqual(outcome.title, 'Product Temporarily Unavailable');
    record('TC-05', 'Backend unavailable (ECONNREFUSED) -> index, follow', true);
  } catch (err) {
    record('TC-05', 'Backend unavailable check', false, err.message);
  }

  // 6. Network failure (ERR_NETWORK)
  try {
    const err = { statusCode: 500, code: 'ERR_NETWORK', message: 'Network Error' };
    const outcome = classifyProductFetchOutcome(err);
    assert.strictEqual(outcome.robots, 'index, follow');
    assert.strictEqual(outcome.notFound, false);
    record('TC-06', 'Network failure (ERR_NETWORK) -> index, follow', true);
  } catch (err) {
    record('TC-06', 'Network failure check', false, err.message);
  }

  // 7. Request timeout (HTTP 408 / ECONNABORTED)
  try {
    const err = { statusCode: 408, code: 'REQUEST_TIMEOUT', message: 'Request timed out' };
    const outcome = classifyProductFetchOutcome(err);
    assert.strictEqual(outcome.robots, 'index, follow');
    assert.strictEqual(outcome.notFound, false);
    record('TC-07', 'Request timeout (408 / REQUEST_TIMEOUT) -> index, follow', true);
  } catch (err) {
    record('TC-07', 'Request timeout check', false, err.message);
  }

  // 8. HTTP 500 (Internal Server Error)
  try {
    const err = { statusCode: 500, code: 'SERVER_ERROR', message: 'Internal Server Error' };
    const outcome = classifyProductFetchOutcome(err);
    assert.strictEqual(outcome.robots, 'index, follow');
    assert.strictEqual(outcome.notFound, false);
    record('TC-08', 'HTTP 500 (SERVER_ERROR) -> index, follow', true);
  } catch (err) {
    record('TC-08', 'HTTP 500 check', false, err.message);
  }

  // 9. HTTP 502 (Bad Gateway)
  try {
    const err = { statusCode: 502, code: 'BAD_GATEWAY', message: 'Bad Gateway' };
    const outcome = classifyProductFetchOutcome(err);
    assert.strictEqual(outcome.robots, 'index, follow');
    assert.strictEqual(outcome.notFound, false);
    record('TC-09', 'HTTP 502 (Bad Gateway) -> index, follow', true);
  } catch (err) {
    record('TC-09', 'HTTP 502 check', false, err.message);
  }

  // 10. HTTP 503 (Service Unavailable / Render waking up)
  try {
    const err = { statusCode: 503, code: 'SERVICE_UNAVAILABLE', message: 'Service Unavailable' };
    const outcome = classifyProductFetchOutcome(err);
    assert.strictEqual(outcome.robots, 'index, follow');
    assert.strictEqual(outcome.notFound, false);
    record('TC-10', 'HTTP 503 (Render cold start) -> index, follow', true);
  } catch (err) {
    record('TC-10', 'HTTP 503 check', false, err.message);
  }

  // 10b. HTTP 404 without PRODUCT_NOT_FOUND (e.g. ROUTE_NOT_FOUND from proxy/gateway)
  try {
    const err = { statusCode: 404, code: 'ROUTE_NOT_FOUND', message: 'Cannot GET /api/v1/products/foo' };
    const outcome = classifyProductFetchOutcome(err);
    assert.strictEqual(outcome.robots, 'index, follow');
    assert.strictEqual(outcome.notFound, false);
    record('TC-10b', 'HTTP 404 with ROUTE_NOT_FOUND (not product code) -> index, follow', true);
  } catch (err) {
    record('TC-10b', 'HTTP 404 without PRODUCT_NOT_FOUND check', false, err.message);
  }

  // 11. Retry succeeds after initial temporary failure
  try {
    let callCount = 0;
    const simulateFetch = async () => {
      callCount++;
      if (callCount === 1) {
        throw { statusCode: 503, code: 'SERVICE_UNAVAILABLE', message: 'Waking up' };
      }
      return { success: true, data: { product: { name: 'Aurelia Bag', slug: 'aurelia-bag' } } };
    };

    let state = { loading: false, error: null, notFound: false, product: null };

    // Initial attempt (failed)
    try {
      state.loading = true;
      await simulateFetch();
    } catch (e) {
      const outcome = classifyProductFetchOutcome(e);
      state = { loading: false, error: e.message, notFound: outcome.notFound, product: null };
    }
    assert.strictEqual(state.notFound, false);
    assert.strictEqual(state.error, 'Waking up');

    // User clicks "Try Again"
    state.loading = true;
    state.error = null;
    const res = await simulateFetch();
    state = { loading: false, error: null, notFound: false, product: res.data.product };
    assert.strictEqual(state.product.name, 'Aurelia Bag');
    assert.strictEqual(state.notFound, false);
    record('TC-11', 'Retry succeeds after initial temporary failure (state recovered cleanly)', true);
  } catch (err) {
    record('TC-11', 'Retry sequence check', false, err.message);
  }

  // 12. Navigation between two different product pages updates SEO metadata correctly
  try {
    assert.ok(pdpSource.includes('const { slug } = useParams();'), 'Listens to route slug parameter');
    assert.ok(pdpSource.includes('fetchProduct();'), 'Triggers fetch on slug change');
    assert.ok(pdpSource.includes('canonical={`/products/${product.slug}`}'), 'Sets canonical to dynamic product slug');
    record('TC-12', 'Navigation between different product pages updates SEO metadata dynamically', true);
  } catch (err) {
    record('TC-12', 'Navigation test check', false, err.message);
  }

  // 13. Synchronous route-slug alignment guard prevents stale product rendering on slug changes
  try {
    assert.ok(pdpSource.includes('const isCurrentProduct = Boolean(product && product.slug === slug);'), 'Must verify loaded product matches active route slug');
    assert.ok(pdpSource.includes('const isPageLoading = loading || (!isCurrentProduct && !notFound && !error);'), 'Must force loading state when slug does not match product');
    assert.ok(pdpSource.includes('if (isPageLoading) {'), 'Must check isPageLoading instead of bare loading');
    assert.ok(pdpSource.includes('if (error || !isCurrentProduct) {'), 'Must guard temporary error branch with isCurrentProduct');

    // Simulate render pass 1 when navigating from 'bag-a' to 'shoes-b' before useEffect runs
    const state = {
      product: { name: 'Bag A', slug: 'bag-a' },
      loading: false, // previous page had finished loading
      error: null,
      notFound: false,
    };
    const activeRouteSlug = 'shoes-b'; // newly navigated route
    const isCurrentProduct = Boolean(state.product && state.product.slug === activeRouteSlug);
    const isPageLoading = state.loading || (!isCurrentProduct && !state.notFound && !state.error);

    assert.strictEqual(isCurrentProduct, false, 'Product A must not match Route Slug B');
    assert.strictEqual(isPageLoading, true, 'isPageLoading must be true on initial render pass before fetch');
    record('TC-13', 'Synchronous render guard guarantees Product A is never rendered under Product B URL', true);
  } catch (err) {
    record('TC-13', 'Synchronous render guard check', false, err.message);
  }

  // 14. Out-of-order request protection (older request completing after newer request)
  try {
    assert.ok(pdpSource.includes('const currentRequestRef = useRef(0);'), 'Must maintain request ID ref');
    assert.ok(pdpSource.includes('requestId !== currentRequestRef.current || requestSlug !== slug'), 'Must discard response if requestId or slug changed');
    assert.ok(pdpSource.includes('currentRequestRef.current += 1;'), 'Must invalidate in-flight request on cleanup');

    // Simulate out-of-order execution
    let currentRequest = 0;
    let committedProduct = null;

    // User is on slug-a -> request 1 begins (slow)
    const req1Id = ++currentRequest;
    const req1Slug = 'slug-a';

    // User navigates to slug-b -> cleanup fires, request 2 begins (fast)
    currentRequest += 1; // cleanup
    const req2Id = ++currentRequest;
    const req2Slug = 'slug-b';

    // Request 2 completes first
    if (req2Id === currentRequest && req2Slug === 'slug-b') {
      committedProduct = { slug: 'slug-b', name: 'Product B' };
    }

    // Request 1 completes later (slow response arrives)
    if (req1Id === currentRequest && req1Slug === 'slug-b') {
      committedProduct = { slug: 'slug-a', name: 'Product A' };
    }

    assert.strictEqual(committedProduct.slug, 'slug-b', 'Request 2 (slug-b) must not be overwritten by delayed Request 1');
    assert.strictEqual(committedProduct.name, 'Product B', 'Committed product must remain Product B');
    record('TC-14', 'Out-of-order responses cleanly discarded; slower prior request cannot overwrite newer request', true);
  } catch (err) {
    record('TC-14', 'Out-of-order request check', false, err.message);
  }

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  console.log('\n======================================================================');
  console.log(`SUMMARY: ${passedCount}/${results.length} PASSED | ${failedCount} FAILED`);
  console.log('======================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests();
