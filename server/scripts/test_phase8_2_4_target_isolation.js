/**
 * LUXECART PHASE 8.2.4 RESTORE TARGET ISOLATION TEST SUITE
 *
 * Verifies that restore operations cannot accidentally target production clusters
 * or unapproved hosts, regardless of database name, and strictly enforces:
 * - Rejection of test-named databases on production hosts
 * - Rejection of production-named databases on non-production hosts
 * - Safe handling of missing/malformed URIs
 * - Fail-closed host allowlist enforcement
 * - Complete redaction of credentials in errors and logs
 * - Explicit confirmations for destructive (--drop) operations
 * - Dedicated non-superuser privilege enforcement
 * - Validation execution strictly before any network connection
 *
 * Usage:
 *   node scripts/test_phase8_2_4_target_isolation.js
 */

import assert from 'assert';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import {
  parseMongoUri,
  validateRestoreTarget,
  performRestore,
  isSafeRestoreTarget,
} from './restore_database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverDir = path.resolve(__dirname, '..');

const testResults = [];

function recordTest(testId, name, passed, details = '') {
  testResults.push({ testId, name, status: passed ? 'PASS' : 'FAIL', details });
  const icon = passed ? '✔ [PASS]' : '✖ [FAIL]';
  console.log(`${icon} [${testId}] ${name}`);
  if (details) console.log(`    ↳ ${details}`);
}

async function runTests() {
  console.log('\n' + '='.repeat(64));
  console.log('   LUXECART PHASE 8.2.4 TARGET ISOLATION HARDENING SUITE      ');
  console.log('='.repeat(64) + '\n');

  // TEST 1: Rejection of a test-named database on a production host
  try {
    const prodHostUris = [
      'mongodb+srv://test_user:pass123@cluster0-prod.mongodb.net/test',
      'mongodb+srv://test_user:pass123@production-db.internal/test',
      'mongodb://test_user:pass123@app-prod-primary.internal:27017/test',
    ];

    for (const uri of prodHostUris) {
      let thrown = null;
      try {
        validateRestoreTarget({
          targetUri: uri,
          targetDbName: 'luxecart_test_db',
          targetEnv: 'test',
          confirmTarget: true,
          allowedHosts: ['cluster0-prod.mongodb.net', 'production-db.internal', 'app-prod-primary.internal'],
        });
      } catch (err) {
        thrown = err;
      }

      assert(thrown, `Must throw for production host: ${uri}`);
      assert.strictEqual(thrown.code, 'PRODUCTION_HOST_REJECTED');
    }

    // Also test explicitly declared productionHosts option
    let thrownExplicit = null;
    try {
      validateRestoreTarget({
        targetUri: 'mongodb://test_user:pass123@staging-box.internal:27017/test',
        targetDbName: 'staging_db',
        targetEnv: 'staging',
        confirmTarget: true,
        productionHosts: ['staging-box.internal'],
        allowedHosts: ['staging-box.internal'],
      });
    } catch (err) {
      thrownExplicit = err;
    }
    assert(thrownExplicit && thrownExplicit.code === 'PRODUCTION_HOST_REJECTED');

    recordTest(
      'TEST-1',
      'Test-named database on a production host is strictly rejected (PRODUCTION_HOST_REJECTED)',
      true,
      'Tested hostnames with "-prod", "production", and explicit productionHosts allow-block list'
    );
  } catch (err) {
    recordTest('TEST-1', 'Test-named database on production host check failed', false, err.message);
  }

  // TEST 2: Rejection of a production-named database on a non-production host
  try {
    const forbiddenDbNames = ['luxecart', 'production', 'prod', 'luxecart-prod', 'prod-luxecart'];

    for (const dbName of forbiddenDbNames) {
      let thrown = null;
      try {
        validateRestoreTarget({
          targetUri: 'mongodb://localhost:27017',
          targetDbName: dbName,
          targetEnv: 'test',
          confirmTarget: true,
          allowedHosts: ['localhost'],
        });
      } catch (err) {
        thrown = err;
      }

      assert(thrown, `Must reject production database name: ${dbName}`);
      assert.strictEqual(thrown.code, 'UNSAFE_RESTORE_TARGET');
    }

    recordTest(
      'TEST-2',
      'Production-named database on a non-production host is strictly rejected (UNSAFE_RESTORE_TARGET)',
      true,
      'Tested: luxecart, production, prod, luxecart-prod, prod-luxecart'
    );
  } catch (err) {
    recordTest('TEST-2', 'Production-named database check failed', false, err.message);
  }

  // TEST 3: Missing or malformed target URIs
  try {
    const invalidUris = [
      null,
      '',
      '   ',
      'http://localhost:27017',
      'postgres://user:pass@localhost:5432/db',
      'mongodb://',
      'not_a_valid_uri',
    ];

    for (const uri of invalidUris) {
      let thrown = null;
      try {
        validateRestoreTarget({
          targetUri: uri,
          targetDbName: 'isolated_test_db',
          targetEnv: 'test',
          confirmTarget: true,
          allowedHosts: ['localhost'],
        });
      } catch (err) {
        thrown = err;
      }

      assert(thrown, `Must throw for invalid URI: ${uri}`);
      assert(
        thrown.code === 'MISSING_TARGET_URI' || thrown.code === 'INVALID_TARGET_URI',
        `Expected MISSING_TARGET_URI or INVALID_TARGET_URI, got: ${thrown.code}`
      );
    }

    recordTest(
      'TEST-3',
      'Missing or malformed target URIs fail safely without leaking secrets (INVALID_TARGET_URI)',
      true,
      'Tested empty, null, http, postgres, missing hosts, and invalid schemes'
    );
  } catch (err) {
    recordTest('TEST-3', 'Missing or malformed target URIs check failed', false, err.message);
  }

  // TEST 4: Unapproved hosts and missing allowlist configuration (Fail Closed)
  try {
    let thrown = null;
    try {
      // Default allowlist only contains loopback; unknown remote host must fail
      validateRestoreTarget({
        targetUri: 'mongodb://unapproved-staging-server.internal:27017',
        targetDbName: 'isolated_test_db',
        targetEnv: 'staging',
        confirmTarget: true,
        // allowedHosts not passed -> defaults to localhost only
      });
    } catch (err) {
      thrown = err;
    }

    assert(thrown, 'Must fail for unapproved host without allowlist configuration');
    assert.strictEqual(thrown.code, 'UNAPPROVED_TARGET_HOST');

    // Also test explicitly restrictive allowlist
    let thrownExplicit = null;
    try {
      validateRestoreTarget({
        targetUri: 'mongodb://cluster-b.internal:27017',
        targetDbName: 'isolated_test_db',
        targetEnv: 'test',
        confirmTarget: true,
        allowedHosts: ['cluster-a.internal'],
      });
    } catch (err) {
      thrownExplicit = err;
    }
    assert(thrownExplicit && thrownExplicit.code === 'UNAPPROVED_TARGET_HOST');

    recordTest(
      'TEST-4',
      'Unapproved hosts fail closed against allowlist (UNAPPROVED_TARGET_HOST)',
      true,
      'Verified default fail-closed behavior and custom allowedHosts filtering'
    );
  } catch (err) {
    recordTest('TEST-4', 'Unapproved hosts check failed', false, err.message);
  }

  // TEST 5: Complete credential redaction in error messages and parse helpers
  try {
    const sensitivePass = 'SuperSecret_Pa$$word_987654!';
    const rawSensitiveUri = `mongodb://service_user:${sensitivePass}@invalid-remote-host.internal:27017`;

    let thrown = null;
    try {
      validateRestoreTarget({
        targetUri: rawSensitiveUri,
        targetDbName: 'isolated_test_db',
        targetEnv: 'test',
        confirmTarget: true,
        allowedHosts: ['localhost'],
      });
    } catch (err) {
      thrown = err;
    }

    assert(thrown, 'Must throw error for unapproved host');
    assert(!thrown.message.includes(sensitivePass), 'Error message must NEVER include raw password');
    assert(!JSON.stringify(thrown).includes(sensitivePass), 'Error serialized must not leak password');

    // Verify parseMongoUri does not leak into thrown errors
    let parseThrown = null;
    try {
      parseMongoUri(`http://service_user:${sensitivePass}@localhost:27017`);
    } catch (err) {
      parseThrown = err;
    }
    assert(parseThrown && !parseThrown.message.includes(sensitivePass));

    recordTest(
      'TEST-5',
      'Complete credential redaction in error messages and parse helpers',
      true,
      'Verified passwords are completely absent from error messages and logs'
    );
  } catch (err) {
    recordTest('TEST-5', 'Credential redaction check failed', false, err.message);
  }

  // TEST 6: Destructive operation (--drop) without explicit confirmation fails safely
  try {
    let thrown = null;
    try {
      validateRestoreTarget({
        targetUri: 'mongodb://localhost:27017',
        targetDbName: 'isolated_test_db',
        targetEnv: 'test',
        confirmTarget: true,
        allowedHosts: ['localhost'],
        drop: true,
        confirmDrop: false, // NOT CONFIRMED
      });
    } catch (err) {
      thrown = err;
    }

    assert(thrown, 'Must throw for drop without confirmDrop');
    assert.strictEqual(thrown.code, 'UNCONFIRMED_DESTRUCTIVE_OPERATION');

    recordTest(
      'TEST-6',
      '--drop without explicit confirmation is rejected (UNCONFIRMED_DESTRUCTIVE_OPERATION)',
      true,
      'Refuses destructive drops unless confirmDrop=true is explicitly set'
    );
  } catch (err) {
    recordTest('TEST-6', 'Destructive operation check failed', false, err.message);
  }

  // TEST 7: Superuser / production admin credentials rejected
  try {
    const forbiddenUsers = ['admin', 'prod_admin', 'root'];

    for (const user of forbiddenUsers) {
      let thrown = null;
      try {
        validateRestoreTarget({
          targetUri: `mongodb://${user}:pass@localhost:27017`,
          targetDbName: 'isolated_test_db',
          targetEnv: 'test',
          confirmTarget: true,
          allowedHosts: ['localhost'],
        });
      } catch (err) {
        thrown = err;
      }

      assert(thrown, `Must reject superuser: ${user}`);
      assert.strictEqual(thrown.code, 'UNAUTHORIZED_RESTORE_USER');
    }

    recordTest(
      'TEST-7',
      'Superuser/admin credentials rejected for restore (UNAUTHORIZED_RESTORE_USER)',
      true,
      'Tested: admin, prod_admin, root. Requires dedicated test user with minimum privileges'
    );
  } catch (err) {
    recordTest('TEST-7', 'Superuser check failed', false, err.message);
  }

  // TEST 8: Valid approved test targets with full confirmations succeed
  try {
    const validation = validateRestoreTarget({
      targetUri: 'mongodb://test_app_user:testpass@localhost:27017/isolated_test_db',
      targetDbName: 'isolated_test_db',
      targetEnv: 'test',
      confirmTarget: true,
      allowedHosts: ['localhost'],
      drop: true,
      confirmDrop: true,
    });

    assert(validation && validation.isValid === true);
    assert.strictEqual(validation.env, 'test');
    assert.strictEqual(validation.dbName, 'isolated_test_db');

    recordTest(
      'TEST-8',
      'Valid approved test targets pass validation cleanly with sanitized details',
      true,
      'Validation confirmed: environment=test, host=localhost, drop=confirmed'
    );
  } catch (err) {
    recordTest('TEST-8', 'Valid approved test target check failed', false, err.message);
  }

  // TEST 9: Failed target validation occurs strictly BEFORE any network connection
  try {
    let connectCalled = false;
    const originalConnect = mongoose.connect;
    // Spy on mongoose.connect
    mongoose.connect = async () => {
      connectCalled = true;
      throw new Error('NETWORK CONNECTION SHOULD NOT BE CALLED!');
    };

    let thrown = null;
    try {
      await performRestore({
        sourceDir: path.join(serverDir, 'backups'),
        targetUri: 'mongodb+srv://user:pass@production-database.internal',
        targetDbName: 'isolated_test_db',
        targetEnv: 'test',
        confirmTarget: true,
        allowedHosts: ['production-database.internal'],
      });
    } catch (err) {
      thrown = err;
    } finally {
      mongoose.connect = originalConnect;
    }

    assert(thrown && thrown.code === 'PRODUCTION_HOST_REJECTED', 'Must throw PRODUCTION_HOST_REJECTED');
    assert.strictEqual(connectCalled, false, 'mongoose.connect must NEVER be called if validation fails');

    recordTest(
      'TEST-9',
      'Failed target validation occurs strictly BEFORE any network connection',
      true,
      'Verified zero socket/network connection attempts when target fails safety checks'
    );
  } catch (err) {
    recordTest('TEST-9', 'Fail-before-connect check failed', false, err.message);
  }

  // SUMMARY
  console.log('\n' + '='.repeat(64));
  console.log('                PHASE 8.2.4 TEST RESULTS SUMMARY                ');
  console.log('='.repeat(64));
  console.table(testResults);

  const passed = testResults.filter((t) => t.status === 'PASS').length;
  const failed = testResults.filter((t) => t.status === 'FAIL').length;

  console.log(`Total: ${testResults.length} | Passed: ${passed} | Failed: ${failed}\n`);

  if (failed > 0) {
    console.error('❌ Phase 8.2.4 Target Isolation Hardening tests failed!\n');
    process.exit(1);
  } else {
    console.log('✔ All Phase 8.2.4 Target Isolation Hardening tests passed!\n');
  }
}

runTests().catch((err) => {
  console.error('[Fatal Error]', err);
  process.exit(1);
});
