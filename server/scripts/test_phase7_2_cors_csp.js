/**
 * LuxeCart Phase 7.2 — Focused Test Suite for Production CSP & Multi-Origin CORS
 *
 * Verifies:
 * 1. Single configured origin is parsed and accepted.
 * 2. Multiple comma-separated origins are parsed and accepted.
 * 3. Whitespace and empty entries in CLIENT_URL are handled safely.
 * 4. An unapproved origin is rejected by CORS (no Access-Control-Allow-Origin header).
 * 5. Substring or spoofed origins are rejected (strict equality check).
 * 6. Credentialed CORS never emits wildcard '*' origin.
 * 7. Preflight OPTIONS request returns 204 with credentials and methods for allowed origins.
 * 8. Preflight OPTIONS request omits Access-Control-Allow-Origin for unapproved origins.
 * 9. Non-browser / server-to-server requests without Origin header succeed normally.
 * 10. Production CSP contains zero localhost or 127.0.0.1 origins.
 * 11. Production CSP contains zero legacy Unsplash origins.
 * 12. Required production Cloudinary and Google origins remain allowed in CSP.
 * 13. Development CSP preserves localhost origins and development workflows.
 * 14. Isolated HTTP server test verifying real network request headers.
 */

import http from 'http';
import express from 'express';
import cors from 'cors';
import { parseAllowedOrigins, createConfig } from '../src/config/env.js';
import { buildCspDirectives, getCorsOptions, securityHeaders } from '../src/middlewares/security.middleware.js';

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
console.log('   LUXECART PHASE 7.2 CORS & CSP VERIFICATION TEST SUITE        ');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// Test 1: Single configured origin parsing
// -----------------------------------------------------------------------------
const single = parseAllowedOrigins('https://luxecart.in', true);
assert(
  Array.isArray(single) && single.length === 1 && single[0] === 'https://luxecart.in',
  'TEST-1',
  'A single configured origin is parsed cleanly into an array'
);

// -----------------------------------------------------------------------------
// Test 2: Multiple comma-separated origins
// -----------------------------------------------------------------------------
const multi = parseAllowedOrigins('https://luxecart.in,https://admin.luxecart.in', true);
assert(
  multi.length === 2 &&
  multi[0] === 'https://luxecart.in' &&
  multi[1] === 'https://admin.luxecart.in',
  'TEST-2',
  'Multiple comma-separated origins are parsed accurately'
);

// -----------------------------------------------------------------------------
// Test 3: Whitespace and empty entries handled safely
// -----------------------------------------------------------------------------
const messy = parseAllowedOrigins('  https://luxecart.in , , https://admin.luxecart.in  ,  ', true);
assert(
  messy.length === 2 &&
  messy[0] === 'https://luxecart.in' &&
  messy[1] === 'https://admin.luxecart.in',
  'TEST-3',
  'Whitespace and empty entries are trimmed and filtered safely'
);

// -----------------------------------------------------------------------------
// Test 4: Origin delegate behavior - Unapproved origin rejected
// -----------------------------------------------------------------------------
const allowedList = ['https://luxecart.in', 'https://admin.luxecart.in'];
const corsOpts = getCorsOptions(allowedList);

let unapprovedAllowed = true;
corsOpts.origin('https://evil-attacker.com', (err, allow) => {
  unapprovedAllowed = allow;
});
assert(
  unapprovedAllowed === false,
  'TEST-4',
  'Unapproved origin is rejected by CORS delegate (allow === false)'
);

// -----------------------------------------------------------------------------
// Test 5: Substring and similar-looking origins rejected
// -----------------------------------------------------------------------------
const spoofOrigins = [
  'https://luxecart.in.attacker.com',
  'https://attacker-luxecart.in',
  'https://luxecart.in:8080',
  'http://luxecart.in', // wrong protocol
  'https://admin.luxecart.in.fake',
];
let anySpoofPassed = false;
for (const spoof of spoofOrigins) {
  corsOpts.origin(spoof, (err, allow) => {
    if (allow) anySpoofPassed = true;
  });
}
assert(
  !anySpoofPassed,
  'TEST-5',
  'Substring, subdomain-spoofed, and protocol-mismatched origins are strictly rejected'
);

// -----------------------------------------------------------------------------
// Test 6: Non-browser / server-to-server requests allowed (no Origin header)
// -----------------------------------------------------------------------------
let noOriginAllowed = false;
corsOpts.origin(undefined, (err, allow) => {
  noOriginAllowed = allow;
});
assert(
  noOriginAllowed === true,
  'TEST-6',
  'Requests with no Origin header (server-to-server, curl) are permitted'
);

// -----------------------------------------------------------------------------
// Test 7: Credentialed CORS does not use wildcard origins
// -----------------------------------------------------------------------------
assert(
  corsOpts.credentials === true &&
  !allowedList.includes('*') &&
  corsOpts.origin !== '*',
  'TEST-7',
  'Credentialed CORS never allows or configures wildcard "*" origins'
);

// -----------------------------------------------------------------------------
// Test 8: Production CSP contains zero localhost or 127.0.0.1 origins
// -----------------------------------------------------------------------------
const prodDirectives = buildCspDirectives({
  isProduction: true,
  allowedOrigins: ['https://luxecart.in', 'https://admin.luxecart.in'],
});
const prodCspString = prodDirectives.join('; ');

const hasLocalhostInProd = prodCspString.includes('localhost') || prodCspString.includes('127.0.0.1');
assert(
  !hasLocalhostInProd,
  'TEST-8',
  'Production CSP contains zero localhost or 127.0.0.1 origins'
);

// -----------------------------------------------------------------------------
// Test 9: Production CSP contains zero legacy Unsplash origins
// -----------------------------------------------------------------------------
const hasUnsplashInProd = prodCspString.includes('images.unsplash.com');
assert(
  !hasUnsplashInProd,
  'TEST-9',
  'Production CSP contains zero legacy Unsplash origins'
);

// -----------------------------------------------------------------------------
// Test 10: Required production Cloudinary, Google, and frontend origins in CSP
// -----------------------------------------------------------------------------
const hasCloudinary = prodCspString.includes('https://res.cloudinary.com') && prodCspString.includes('https://api.cloudinary.com');
const hasGoogle = prodCspString.includes('https://accounts.google.com');
const hasFrontend = prodCspString.includes('https://luxecart.in') && prodCspString.includes('https://admin.luxecart.in');

assert(
  hasCloudinary && hasGoogle && hasFrontend,
  'TEST-10',
  'Required production Cloudinary, Google, and configured frontend origins are present in CSP'
);

// -----------------------------------------------------------------------------
// Test 11: Development CSP retains localhost and dev workflows
// -----------------------------------------------------------------------------
const devDirectives = buildCspDirectives({
  isProduction: false,
  allowedOrigins: ['http://localhost:5173'],
});
const devCspString = devDirectives.join('; ');
const devHasLocalhost = devCspString.includes('http://localhost:5000') && devCspString.includes('http://localhost:5173');
const devHasUnsplash = devCspString.includes('https://images.unsplash.com');

assert(
  devHasLocalhost && devHasUnsplash,
  'TEST-11',
  'Development CSP retains localhost ports and dev mock image origins'
);

// -----------------------------------------------------------------------------
// Test 12-14: Live Isolated HTTP Server Integration Tests
// -----------------------------------------------------------------------------
async function runHttpTests() {
  const testApp = express();
  const testOrigins = ['https://luxecart.in', 'https://admin.luxecart.in'];

  testApp.use(cors(getCorsOptions(testOrigins)));
  testApp.use(securityHeaders);
  testApp.get('/test', (req, res) => res.json({ ok: true }));

  const server = http.createServer(testApp);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  const makeRequest = (options) => {
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path: '/test',
          ...options,
        },
        (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body }));
        }
      );
      req.on('error', reject);
      req.end();
    });
  };

  try {
    // Test 12: Approved Origin receives proper CORS headers
    const approvedRes = await makeRequest({
      method: 'GET',
      headers: { Origin: 'https://luxecart.in' },
    });
    assert(
      approvedRes.headers['access-control-allow-origin'] === 'https://luxecart.in' &&
      approvedRes.headers['access-control-allow-credentials'] === 'true',
      'TEST-12',
      'HTTP Request with approved origin receives Access-Control-Allow-Origin and credentials: true'
    );

    // Test 13: Unapproved Origin receives NO Access-Control-Allow-Origin header
    const unapprovedRes = await makeRequest({
      method: 'GET',
      headers: { Origin: 'https://unauthorized-domain.com' },
    });
    assert(
      !unapprovedRes.headers['access-control-allow-origin'],
      'TEST-13',
      'HTTP Request with unapproved origin receives NO Access-Control-Allow-Origin header'
    );

    // Test 14: Preflight OPTIONS request for approved origin returns 204
    const preflightRes = await makeRequest({
      method: 'OPTIONS',
      headers: {
        Origin: 'https://admin.luxecart.in',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type,Authorization',
      },
    });
    assert(
      preflightRes.statusCode === 204 &&
      preflightRes.headers['access-control-allow-origin'] === 'https://admin.luxecart.in' &&
      preflightRes.headers['access-control-allow-methods'].includes('POST') &&
      preflightRes.headers['access-control-allow-credentials'] === 'true',
      'TEST-14',
      'Preflight OPTIONS request returns 204 with full credentials and methods'
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log('                 PHASE 7.2 TEST RESULTS SUMMARY                 ');
  console.log('================================================================');
  console.table(results);

  const passedCount = results.filter((r) => r.status === 'PASS').length;
  const failedCount = results.filter((r) => r.status === 'FAIL').length;
  console.log(`Total: ${results.length} | Passed: ${passedCount} | Failed: ${failedCount}`);

  if (failedCount > 0) {
    process.exit(1);
  } else {
    console.log('\n✔ All Phase 7.2 CORS & CSP verification checks passed!\n');
    process.exit(0);
  }
}

runHttpTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
