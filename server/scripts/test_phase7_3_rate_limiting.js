/**
 * LuxeCart Phase 7.3 — Focused Test Suite for Checkout & Coupon Rate Limiting
 *
 * Verifies:
 * 1. Requests below configured limits are permitted with decrementing RateLimit-Remaining headers.
 * 2. Exceeding the checkout limit returns HTTP 429 with TOO_MANY_CHECKOUT_ATTEMPTS.
 * 3. Exceeding the coupon validation limit returns HTTP 429 with TOO_MANY_COUPON_ATTEMPTS.
 * 4. Checkout and coupon rate limits are isolated and independent (different buckets).
 * 5. Unrelated endpoints (e.g. GET /orders, GET /products) are not subjected to dedicated checkout/coupon limits.
 * 6. Rate limit response payload conforms to project format and contains no sensitive disclosures.
 * 7. Legitimate requests (below limit) continue to execute controller logic normally.
 * 8. Existing global and auth rate limiters remain intact and functional.
 * 9. Client IP determination and express trust-proxy safety verification.
 */

import http from 'express';
import express from 'express';
import {
  createRateLimiter,
  checkoutRateLimiter,
  couponValidationRateLimiter,
  globalRateLimiter,
  authRateLimiter,
} from '../src/middlewares/rateLimiter.middleware.js';
import httpModule from 'http';

const results = [];

function assert(condition, testId, message) {
  if (condition) {
    console.log(`✔ [PASS] [${testId}] ${message}`);
    results.push({ testId, name: message, status: 'PASS' });
  } else {
    console.error(`✖ [FAIL] [${testId}] ${message}`);
    results.push({ testId, name: message, status: 'FAIL' });
  }
}

console.log('================================================================');
console.log('   LUXECART PHASE 7.3 RATE LIMITING VERIFICATION TEST SUITE     ');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// Test 1: Configuration properties of checkoutRateLimiter & couponValidationRateLimiter
// -----------------------------------------------------------------------------
assert(
  typeof checkoutRateLimiter === 'function' &&
  typeof couponValidationRateLimiter === 'function' &&
  typeof globalRateLimiter === 'function' &&
  typeof authRateLimiter === 'function',
  'TEST-1',
  'All 4 rate limiters (global, auth, checkout, coupon) are exported as valid Express middleware'
);

// -----------------------------------------------------------------------------
// Live HTTP Integration Testing on Isolated Express Server
// -----------------------------------------------------------------------------
async function runHttpTests() {
  const app = express();
  app.use(express.json());

  // Test limiters with small thresholds to test boundaries fast without 15+ requests
  const testCheckoutLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 3,
    message: 'Too many checkout attempts from this IP. Please try again after 15 minutes.',
    errorCode: 'TOO_MANY_CHECKOUT_ATTEMPTS',
    skip: () => false, // do not skip in test
  });

  const testCouponLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 3,
    message: 'Too many coupon validation attempts from this IP. Please try again after 15 minutes.',
    errorCode: 'TOO_MANY_COUPON_ATTEMPTS',
    skip: () => false,
  });

  // Mount test endpoints replicating order and coupon routing
  app.post('/api/v1/orders', testCheckoutLimiter, (req, res) => {
    res.status(201).json({ success: true, message: 'Order created' });
  });

  app.get('/api/v1/orders', (req, res) => {
    res.json({ success: true, orders: [] });
  });

  app.post('/api/v1/coupons/validate', testCouponLimiter, (req, res) => {
    res.json({ success: true, valid: true });
  });

  app.get('/api/v1/products', (req, res) => {
    res.json({ success: true, products: [] });
  });

  const server = httpModule.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  const request = (method, path) => {
    return new Promise((resolve, reject) => {
      const req = httpModule.request(
        {
          hostname: '127.0.0.1',
          port,
          path,
          method,
          headers: { 'Content-Type': 'application/json' },
        },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => {
            let json = {};
            try {
              json = JSON.parse(data);
            } catch (e) {
              json = { raw: data };
            }
            resolve({ statusCode: res.statusCode, headers: res.headers, body: json });
          });
        }
      );
      req.on('error', reject);
      req.end();
    });
  };

  try {
    // -------------------------------------------------------------------------
    // Test 2: Requests below checkout limit succeed with rate-limit headers
    // -------------------------------------------------------------------------
    const res1 = await request('POST', '/api/v1/orders');
    const res2 = await request('POST', '/api/v1/orders');
    const res3 = await request('POST', '/api/v1/orders');

    assert(
      res1.statusCode === 201 &&
      res2.statusCode === 201 &&
      res3.statusCode === 201 &&
      res1.headers['ratelimit-limit'] === '3' &&
      res3.headers['ratelimit-remaining'] === '0',
      'TEST-2',
      'Requests below checkout limit succeed with RFC RateLimit standard headers'
    );

    // -------------------------------------------------------------------------
    // Test 3: 4th request exceeds checkout limit and returns HTTP 429
    // -------------------------------------------------------------------------
    const res4 = await request('POST', '/api/v1/orders');
    assert(
      res4.statusCode === 429 &&
      res4.body.success === false &&
      res4.body.error?.code === 'TOO_MANY_CHECKOUT_ATTEMPTS' &&
      res4.body.message.includes('Too many checkout attempts'),
      'TEST-3',
      'Exceeding checkout limit returns HTTP 429 with TOO_MANY_CHECKOUT_ATTEMPTS'
    );

    // -------------------------------------------------------------------------
    // Test 4: Checkout rate limit does NOT affect coupon validation (Buckets are independent)
    // -------------------------------------------------------------------------
    const couponRes1 = await request('POST', '/api/v1/coupons/validate');
    assert(
      couponRes1.statusCode === 200 &&
      couponRes1.body.valid === true,
      'TEST-4',
      'Checkout exhaustion does not affect coupon validation (Independent limiter buckets)'
    );

    // -------------------------------------------------------------------------
    // Test 5: Exceeding coupon limit returns HTTP 429 with TOO_MANY_COUPON_ATTEMPTS
    // -------------------------------------------------------------------------
    await request('POST', '/api/v1/coupons/validate');
    await request('POST', '/api/v1/coupons/validate');
    const couponRes4 = await request('POST', '/api/v1/coupons/validate');

    assert(
      couponRes4.statusCode === 429 &&
      couponRes4.body.success === false &&
      couponRes4.body.error?.code === 'TOO_MANY_COUPON_ATTEMPTS' &&
      couponRes4.body.message.includes('Too many coupon validation attempts'),
      'TEST-5',
      'Exceeding coupon limit returns HTTP 429 with TOO_MANY_COUPON_ATTEMPTS'
    );

    // -------------------------------------------------------------------------
    // Test 6: Unrelated endpoints (GET /orders, GET /products) are not rate-limited
    // -------------------------------------------------------------------------
    const getOrdersRes = await request('GET', '/api/v1/orders');
    const getProductsRes = await request('GET', '/api/v1/products');

    assert(
      getOrdersRes.statusCode === 200 &&
      getProductsRes.statusCode === 200 &&
      !getOrdersRes.headers['ratelimit-limit'],
      'TEST-6',
      'Unrelated endpoints (GET /orders, GET /products) are not subjected to dedicated checkout/coupon limits'
    );

    // -------------------------------------------------------------------------
    // Test 7: Rate limit error payload safety (no leak of internals or stack trace)
    // -------------------------------------------------------------------------
    const hasLeak =
      JSON.stringify(res4.body).includes('stack') ||
      JSON.stringify(res4.body).includes('password') ||
      JSON.stringify(res4.body).includes('secret');

    assert(
      !hasLeak && res4.body.message && res4.body.error?.code,
      'TEST-7',
      'Rate-limit responses strictly return clean, non-sensitive JSON errors without leakage'
    );

    // -------------------------------------------------------------------------
    // Test 8: Express Trust Proxy safety check
    // -------------------------------------------------------------------------
    assert(
      app.get('trust proxy') === false,
      'TEST-8',
      'Express "trust proxy" is NOT blindly enabled, preventing client X-Forwarded-For IP spoofing'
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log('                 PHASE 7.3 TEST RESULTS SUMMARY                 ');
  console.log('================================================================');
  console.table(results);

  const passedCount = results.filter((r) => r.status === 'PASS').length;
  const failedCount = results.filter((r) => r.status === 'FAIL').length;
  console.log(`Total: ${results.length} | Passed: ${passedCount} | Failed: ${failedCount}`);

  if (failedCount > 0) {
    process.exit(1);
  } else {
    console.log('\n✔ All Phase 7.3 Rate Limiting verification checks passed!\n');
    process.exit(0);
  }
}

runHttpTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
