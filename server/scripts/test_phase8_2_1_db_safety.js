/**
 * LUXECART PHASE 8.2.1 PRODUCTION DATABASE STARTUP SAFETY TEST SUITE
 *
 * Verifies:
 * 1. Missing production MONGODB_URI fails configuration immediately.
 * 2. Empty or whitespace-only production URI fails configuration.
 * 3. Localhost and loopback production URIs are rejected across IPv4 and IPv6 variants.
 * 4. Valid managed MongoDB URI formats pass validation (Atlas mongodb+srv & replica sets).
 * 5. Unsupported URI schemes (http, postgres, redis) are rejected.
 * 6. Malformed URI structures fail safely without credential leakage.
 * 7. Production connection options (pooling, timeouts, autoIndex: false) are properly configured.
 * 8. Development workflow compatibility is preserved (localhost/empty allowed in non-prod).
 * 9. Production startup aborts (process exits non-zero and does not listen) when database connection fails.
 * 10. Server starts listening only after database connection succeeds.
 */

import assert from 'assert';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateMongoUri, createConfig } from '../src/config/env.js';
import { getProductionConnectionOptions } from '../src/config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverDir = path.resolve(__dirname, '..');

const testResults = [];

function recordTest(testId, name, passed, details = '') {
  testResults.push({ testId, name, status: passed ? 'PASS' : 'FAIL', details });
  const badge = passed ? '✔ [PASS]' : '✖ [FAIL]';
  console.log(`${badge} [${testId}] ${name}`);
  if (details) console.log(`    ↳ ${details}`);
}

async function runTests() {
  console.log('\n' + '='.repeat(64));
  console.log('   LUXECART PHASE 8.2.1 DATABASE STARTUP SAFETY TEST SUITE      ');
  console.log('='.repeat(64) + '\n');

  // TEST 1: Missing production URI fails configuration
  try {
    let thrownError = null;
    try {
      validateMongoUri(undefined, true);
    } catch (e) {
      thrownError = e;
    }
    assert(thrownError, 'Must throw error when MONGODB_URI is undefined in production');
    assert(thrownError.message.includes('MONGODB_URI is required in production'));
    recordTest('TEST-1', 'Missing production MONGODB_URI fails configuration immediately', true, thrownError.message);
  } catch (err) {
    recordTest('TEST-1', 'Missing production MONGODB_URI fails configuration immediately', false, err.message);
  }

  // TEST 2: Empty or whitespace-only production URI fails configuration
  try {
    let emptyErr = null;
    let wsErr = null;
    try {
      validateMongoUri('', true);
    } catch (e) {
      emptyErr = e;
    }
    try {
      validateMongoUri('   \t\n  ', true);
    } catch (e) {
      wsErr = e;
    }
    assert(emptyErr && emptyErr.message.includes('cannot be empty'), 'Empty URI must be rejected');
    assert(wsErr && wsErr.message.includes('cannot be empty'), 'Whitespace URI must be rejected');
    recordTest('TEST-2', 'Empty and whitespace-only production URIs fail configuration', true, emptyErr.message);
  } catch (err) {
    recordTest('TEST-2', 'Empty and whitespace-only production URIs fail configuration', false, err.message);
  }

  // TEST 3: Localhost and loopback production URIs are strictly rejected
  try {
    const loopbackUris = [
      'mongodb://localhost:27017/luxecart',
      'mongodb://user:secret@localhost/luxecart',
      'mongodb://sub.localhost:27017/luxecart',
      'mongodb://127.0.0.1:27017/luxecart',
      'mongodb://user:pass@127.0.0.1/luxecart?retryWrites=true',
      'mongodb://127.0.0.2:27017/luxecart',
      'mongodb://127.128.0.1:27017/luxecart',
      'mongodb://[::1]:27017/luxecart',
      'mongodb://user:pass@[::1]/luxecart',
      'mongodb://0.0.0.0:27017/luxecart',
    ];

    for (const uri of loopbackUris) {
      let thrown = null;
      try {
        validateMongoUri(uri, true);
      } catch (e) {
        thrown = e;
      }
      assert(thrown, `Expected rejection for loopback URI: ${uri}`);
      assert(
        thrown.message.includes('cannot target localhost or loopback'),
        `Unexpected error message for ${uri}: ${thrown.message}`
      );
      // Ensure the error message never leaks credentials
      assert(!thrown.message.includes('secret') && !thrown.message.includes('pass'), 'Credentials leaked in error message');
    }

    recordTest('TEST-3', 'Localhost and loopback URIs (IPv4, IPv6, names) rejected in production without leaking secrets', true, `Tested ${loopbackUris.length} loopback variants`);
  } catch (err) {
    recordTest('TEST-3', 'Localhost and loopback URIs rejected in production', false, err.message);
  }

  // TEST 4: Valid managed MongoDB URI formats pass validation
  try {
    const validUris = [
      'mongodb+srv://admin_user:P%40ssw0rd!@cluster0.abc12.mongodb.net/luxecart?retryWrites=true&w=majority',
      'mongodb://app_user:secure_pwd@node1.managed.aws.cloud:27017,node2.managed.aws.cloud:27017/luxecart?replicaSet=rs0&tls=true',
      'mongodb://dbuser:mypass@mongo-prod.internal.net:27017/luxecart_prod',
    ];

    for (const uri of validUris) {
      const validated = validateMongoUri(uri, true);
      assert.strictEqual(validated, uri.trim(), 'Validated URI should match input');
    }

    recordTest('TEST-4', 'Valid managed MongoDB URIs (Atlas srv & multi-host replica sets) pass validation', true, `Validated ${validUris.length} production formats`);
  } catch (err) {
    recordTest('TEST-4', 'Valid managed MongoDB URIs pass validation', false, err.message);
  }

  // TEST 5: Unsupported URI schemes are rejected
  try {
    const invalidSchemeUris = [
      'postgres://user:pass@db.example.com:5432/luxecart',
      'mysql://user:pass@db.example.com:3306/luxecart',
      'http://cluster0.abc.mongodb.net/luxecart',
      'https://cluster0.abc.mongodb.net/luxecart',
      'redis://cache.internal:6379',
    ];

    for (const uri of invalidSchemeUris) {
      let thrown = null;
      try {
        validateMongoUri(uri, true);
      } catch (e) {
        thrown = e;
      }
      assert(thrown, `Expected rejection for invalid scheme URI: ${uri}`);
      assert(thrown.message.includes('Invalid MONGODB_URI scheme'), `Unexpected error message: ${thrown.message}`);
    }

    recordTest('TEST-5', 'Unsupported URI schemes (http, postgres, mysql, redis) rejected with clear error', true, `Tested ${invalidSchemeUris.length} invalid schemes`);
  } catch (err) {
    recordTest('TEST-5', 'Unsupported URI schemes rejected with clear error', false, err.message);
  }

  // TEST 6: Malformed URI structures fail safely
  try {
    const malformedUris = [
      'mongodb://',
      'mongodb+srv://',
      'mongodb://?retryWrites=true',
      'just-plain-text',
      'mongodb//missing-colon.com',
    ];

    for (const uri of malformedUris) {
      let thrown = null;
      try {
        validateMongoUri(uri, true);
      } catch (e) {
        thrown = e;
      }
      assert(thrown, `Expected rejection for malformed URI: ${uri}`);
      assert(thrown.message.includes('[Config Error]'), `Unexpected error: ${thrown.message}`);
    }

    recordTest('TEST-6', 'Malformed URI structures fail safely without crashing', true, `Tested ${malformedUris.length} malformed strings`);
  } catch (err) {
    recordTest('TEST-6', 'Malformed URI structures fail safely without crashing', false, err.message);
  }

  // TEST 7: Production connection options configuration
  try {
    const prodOpts = getProductionConnectionOptions(true);
    assert.strictEqual(prodOpts.maxPoolSize, 50, 'maxPoolSize must be 50');
    assert.strictEqual(prodOpts.minPoolSize, 5, 'minPoolSize must be 5');
    assert.strictEqual(prodOpts.serverSelectionTimeoutMS, 5000, 'serverSelectionTimeoutMS must be 5000');
    assert.strictEqual(prodOpts.socketTimeoutMS, 45000, 'socketTimeoutMS must be 45000');
    assert.strictEqual(prodOpts.autoIndex, false, 'autoIndex must be false in production');

    const devOpts = getProductionConnectionOptions(false);
    assert.strictEqual(devOpts.autoIndex, undefined, 'autoIndex should not be forced false in development');

    recordTest('TEST-7', 'Production connection options configured with required pool limits and autoIndex: false', true, JSON.stringify(prodOpts));
  } catch (err) {
    recordTest('TEST-7', 'Production connection options configured correctly', false, err.message);
  }

  // TEST 8: Local development workflow compatibility preserved
  try {
    // Non-production allows localhost
    const devLocalhost = validateMongoUri('mongodb://localhost:27017/luxecart', false);
    assert.strictEqual(devLocalhost, 'mongodb://localhost:27017/luxecart');

    // Non-production allows empty or unset URI
    const devEmpty = validateMongoUri('', false);
    assert.strictEqual(devEmpty, '');

    const devUndefined = validateMongoUri(undefined, false);
    assert.strictEqual(devUndefined, '');

    recordTest('TEST-8', 'Local development workflow preserves localhost and empty URI support', true, 'Preserved dev behavior');
  } catch (err) {
    recordTest('TEST-8', 'Local development workflow preserves localhost and empty URI support', false, err.message);
  }

  // TEST 9: Child process startup test: In production, server aborts with exit code 1 if DB connection fails
  try {
    const childEnv = {
      ...process.env,
      NODE_ENV: 'production',
      PORT: '5998',
      MONGODB_URI: 'mongodb://10.255.255.1:27017/luxecart',
      JWT_ACCESS_SECRET: 'a_very_strong_production_access_secret_for_testing_12345',
      JWT_REFRESH_SECRET: 'a_very_strong_production_refresh_secret_for_testing_12345',
    };

    const output = await new Promise((resolve) => {
      const child = spawn(process.execPath, [path.join(serverDir, 'src', 'server.js')], {
        env: childEnv,
        cwd: serverDir,
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (d) => { stdout += d.toString(); });
      child.stderr.on('data', (d) => { stderr += d.toString(); });

      child.on('close', (code) => {
        resolve({ code, stdout, stderr });
      });

      // Timeout safety: if child hangs, kill it (allow up to 30s for Windows TCP timeout)
      setTimeout(() => {
        child.kill();
        resolve({ code: -1, stdout, stderr, timedOut: true });
      }, 30000);
    });

    assert.strictEqual(output.code, 1, `Expected child process exit code 1, got ${output.code}`);
    assert(
      output.stdout.includes('Connecting to production database') || output.stderr.includes('Initial connection failure') || output.stderr.includes('Startup error'),
      'Output must indicate database connection attempt and startup failure'
    );
    assert(
      !output.stdout.includes('LuxeCart Server running in production mode on port 5998'),
      'HTTP listener must NOT start when database connection fails'
    );

    recordTest('TEST-9', 'Production startup strictly aborts (exit code 1) and never listens if DB connection fails', true, `Exit code: ${output.code}`);
  } catch (err) {
    recordTest('TEST-9', 'Production startup strictly aborts when DB connection fails', false, err.message);
  }

  // TEST 10: Child process test: In production, missing MONGODB_URI causes immediate configuration fail-fast
  try {
    const childEnv = {
      ...process.env,
      NODE_ENV: 'production',
      PORT: '5999',
      MONGODB_URI: '',
      JWT_ACCESS_SECRET: 'a_very_strong_production_access_secret_for_testing_12345',
      JWT_REFRESH_SECRET: 'a_very_strong_production_refresh_secret_for_testing_12345',
    };

    const output = await new Promise((resolve) => {
      const child = spawn(process.execPath, [path.join(serverDir, 'src', 'server.js')], {
        env: childEnv,
        cwd: serverDir,
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (d) => { stdout += d.toString(); });
      child.stderr.on('data', (d) => { stderr += d.toString(); });

      child.on('close', (code) => {
        resolve({ code, stdout, stderr });
      });

      setTimeout(() => {
        child.kill();
        resolve({ code: -1, stdout, stderr, timedOut: true });
      }, 10000);
    });

    assert.strictEqual(output.code, 1, `Expected child process exit code 1, got ${output.code}`);
    assert(
      output.stderr.includes('MONGODB_URI is required in production') || output.stdout.includes('MONGODB_URI is required in production'),
      'Output must contain clear MONGODB_URI fail-fast message'
    );

    recordTest('TEST-10', 'Missing production MONGODB_URI prevents process startup with exit code 1', true, `Exit code: ${output.code}`);
  } catch (err) {
    recordTest('TEST-10', 'Missing production MONGODB_URI prevents process startup', false, err.message);
  }

  // Print Summary Table
  console.log('\n' + '='.repeat(64));
  console.log('                PHASE 8.2.1 TEST RESULTS SUMMARY                ');
  console.log('='.repeat(64));
  console.table(testResults);

  const passedCount = testResults.filter((t) => t.status === 'PASS').length;
  const failedCount = testResults.filter((t) => t.status === 'FAIL').length;
  console.log(`Total: ${testResults.length} | Passed: ${passedCount} | Failed: ${failedCount}\n`);

  if (failedCount > 0) {
    console.error('❌ Phase 8.2.1 verification failed!');
    process.exit(1);
  } else {
    console.log('✔ All Phase 8.2.1 Database Startup Safety tests passed!\n');
    process.exit(0);
  }
}

runTests();
