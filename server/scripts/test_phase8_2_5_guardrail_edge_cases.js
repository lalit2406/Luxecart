/**
 * LUXECART PHASE 8.2.5 RESTORE GUARDRAIL EDGE-CASE AUDIT TEST SUITE
 *
 * Verifies edge cases in target validation, normalization, and allowlist handling:
 * - Hostname case differences and trailing dots
 * - Explicit ports and SRV port rejection
 * - Multiple hosts in replica sets and empty token detection
 * - IPv4 and IPv6 loopback variants
 * - URL-encoded credentials and encoded superuser detection
 * - Malformed host entries and invalid characters
 * - Allowlist bypass resistance (allowlist cannot disable production safety)
 * - Safe production configuration parsing without silent error swallowing
 * - Credential redaction and destructive drop confirmations
 * - Fail-closed behavior before any network socket creation
 *
 * Strict Rule: Mocks only. Never contacts hosted databases.
 *
 * Usage:
 *   node scripts/test_phase8_2_5_guardrail_edge_cases.js
 */

import assert from 'assert';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import {
  normalizeHost,
  parseMongoUri,
  parseAndValidatePort,
  isLoopbackHost,
  validateRestoreTarget,
  performRestore,
} from './restore_database.js';
import { sanitizeUri } from './backup_database.js';

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

async function runEdgeCaseAudit() {
  console.log('\n' + '='.repeat(64));
  console.log('   LUXECART PHASE 8.2.5 GUARDRAIL EDGE-CASE AUDIT SUITE       ');
  console.log('='.repeat(64) + '\n');

  // --- SECTION 1: HOST PARSING AND NORMALIZATION ---

  // EDGE-1: Hostname case differences
  try {
    const normLower = normalizeHost('staging-cluster.mongodb.net');
    const normUpper = normalizeHost('STAGING-CLUSTER.MONGODB.NET');
    const normMixed = normalizeHost('Staging-Cluster.MongoDB.Net');

    assert.strictEqual(normLower.hostname, 'staging-cluster.mongodb.net');
    assert.strictEqual(normUpper.hostname, 'staging-cluster.mongodb.net');
    assert.strictEqual(normMixed.hostname, 'staging-cluster.mongodb.net');

    recordTest(
      'EDGE-1',
      'Hostname case differences are normalized to lowercase',
      true,
      'Verified STAGING-CLUSTER.MONGODB.NET normalizes to staging-cluster.mongodb.net'
    );
  } catch (err) {
    recordTest('EDGE-1', 'Hostname case normalization failed', false, err.message);
  }

  // EDGE-2: Trailing dots on FQDN hostnames
  try {
    const normDot = normalizeHost('staging-cluster.mongodb.net.');
    const normMultiDot = normalizeHost('staging-cluster.mongodb.net...');

    assert.strictEqual(normDot.hostname, 'staging-cluster.mongodb.net');
    assert.strictEqual(normMultiDot.hostname, 'staging-cluster.mongodb.net');

    recordTest(
      'EDGE-2',
      'Trailing dots in DNS FQDN hostnames are stripped cleanly',
      true,
      'Verified trailing dot stripped from staging-cluster.mongodb.net.'
    );
  } catch (err) {
    recordTest('EDGE-2', 'Trailing dot normalization failed', false, err.message);
  }

  // EDGE-3: Explicit ports on standard MongoDB URIs
  try {
    const parsedValidPort = normalizeHost('localhost:27017');
    assert.strictEqual(parsedValidPort.hostname, 'localhost');
    assert.strictEqual(parsedValidPort.port, 27017);

    // Test port validation errors
    let invalidPortThrown = null;
    try {
      normalizeHost('localhost:abc');
    } catch (e) {
      invalidPortThrown = e;
    }
    assert(invalidPortThrown && invalidPortThrown.code === 'INVALID_TARGET_URI');

    let outOfRangeThrown = null;
    try {
      normalizeHost('localhost:70000');
    } catch (e) {
      outOfRangeThrown = e;
    }
    assert(outOfRangeThrown && outOfRangeThrown.code === 'INVALID_TARGET_URI');

    let zeroPortThrown = null;
    try {
      normalizeHost('localhost:0');
    } catch (e) {
      zeroPortThrown = e;
    }
    assert(zeroPortThrown && zeroPortThrown.code === 'INVALID_TARGET_URI');

    recordTest(
      'EDGE-3',
      'Explicit ports validated within 1..65535; non-integer/out-of-range ports rejected',
      true,
      'Verified 27017 allowed; abc, 0, 70000 rejected'
    );
  } catch (err) {
    recordTest('EDGE-3', 'Port validation failed', false, err.message);
  }

  // EDGE-4: SRV connection string with port definition is strictly rejected
  try {
    let srvPortThrown = null;
    try {
      parseMongoUri('mongodb+srv://cluster.mongodb.net:27017/test');
    } catch (e) {
      srvPortThrown = e;
    }

    assert(srvPortThrown && srvPortThrown.code === 'INVALID_TARGET_URI');
    assert(srvPortThrown.message.includes('SRV URIs must not include a port definition'));

    recordTest(
      'EDGE-4',
      'MongoDB SRV URIs with port definitions are strictly rejected',
      true,
      srvPortThrown.message
    );
  } catch (err) {
    recordTest('EDGE-4', 'SRV port rejection failed', false, err.message);
  }

  // EDGE-5: Multiple hosts in replica-set connection strings
  try {
    const multiHostUri = 'mongodb://user:pass@mongo1.internal:27017,mongo2.internal:27018,mongo3.internal:27019/test';
    const parsed = parseMongoUri(multiHostUri);

    assert.strictEqual(parsed.hosts.length, 3);
    assert.strictEqual(parsed.hosts[0].hostname, 'mongo1.internal');
    assert.strictEqual(parsed.hosts[0].port, 27017);
    assert.strictEqual(parsed.hosts[1].hostname, 'mongo2.internal');
    assert.strictEqual(parsed.hosts[1].port, 27018);
    assert.strictEqual(parsed.hosts[2].hostname, 'mongo3.internal');
    assert.strictEqual(parsed.hosts[2].port, 27019);

    // Validation passes when all 3 hosts are in allowlist
    const validation = validateRestoreTarget({
      targetUri: multiHostUri,
      targetDbName: 'staging_test_db',
      targetEnv: 'staging',
      confirmTarget: true,
      allowedHosts: ['mongo1.internal', 'mongo2.internal', 'mongo3.internal'],
    });
    assert(validation.isValid);

    // Validation fails if even one host in the set is unapproved
    let partialFailThrown = null;
    try {
      validateRestoreTarget({
        targetUri: multiHostUri,
        targetDbName: 'staging_test_db',
        targetEnv: 'staging',
        confirmTarget: true,
        allowedHosts: ['mongo1.internal', 'mongo2.internal'], // mongo3 missing!
      });
    } catch (e) {
      partialFailThrown = e;
    }
    assert(partialFailThrown && partialFailThrown.code === 'UNAPPROVED_TARGET_HOST');

    recordTest(
      'EDGE-5',
      'Multi-host replica sets are fully validated; any unapproved host fails closed',
      true,
      'Validated 3-host replica set; partial allowlist fails closed on unapproved host'
    );
  } catch (err) {
    recordTest('EDGE-5', 'Multi-host validation failed', false, err.message);
  }

  // EDGE-6: Empty host entries in connection strings
  try {
    const invalidMultiHostUris = [
      'mongodb://mongo1:27017,,mongo2:27017/test',
      'mongodb://,mongo1:27017/test',
      'mongodb://mongo1:27017,/test',
      'mongodb+srv://host1.mongodb.net,host2.mongodb.net/test', // Multiple SRV hosts forbidden
    ];

    for (const uri of invalidMultiHostUris) {
      let thrown = null;
      try {
        parseMongoUri(uri);
      } catch (e) {
        thrown = e;
      }
      assert(thrown && thrown.code === 'INVALID_TARGET_URI', `Expected INVALID_TARGET_URI for ${uri}`);
    }

    recordTest(
      'EDGE-6',
      'Empty host tokens and multi-host SRV connection strings are rejected',
      true,
      'Rejected empty tokens (,,) and multiple SRV hosts'
    );
  } catch (err) {
    recordTest('EDGE-6', 'Empty host entry validation failed', false, err.message);
  }

  // EDGE-7: IPv4 loopback forms recognized by default allowlist
  try {
    const ipv4Loopbacks = ['127.0.0.1', '127.0.0.2', '127.255.0.1', '0.0.0.0'];

    for (const ip of ipv4Loopbacks) {
      const norm = normalizeHost(ip);
      assert(norm.isLoopback, `Expected ${ip} to be recognized as loopback`);

      // Default allowlist (no allowedHosts passed) should accept loopback
      const res = validateRestoreTarget({
        targetUri: `mongodb://${ip}:27017`,
        targetDbName: 'isolated_test_db',
        targetEnv: 'test',
        confirmTarget: true,
      });
      assert(res.isValid);
    }

    recordTest(
      'EDGE-7',
      'IPv4 loopback variations (127.0.0.0/8, 0.0.0.0) recognized under default policy',
      true,
      'Tested 127.0.0.1, 127.0.0.2, 127.255.0.1, 0.0.0.0'
    );
  } catch (err) {
    recordTest('EDGE-7', 'IPv4 loopback check failed', false, err.message);
  }

  // EDGE-8: IPv6 loopback forms
  try {
    const ipv6Loopbacks = [
      '::1',
      '[::1]',
      '[::1]:27017',
      '0:0:0:0:0:0:0:1',
      '[0:0:0:0:0:0:0:1]:27017',
    ];

    for (const ip of ipv6Loopbacks) {
      const norm = normalizeHost(ip);
      assert.strictEqual(norm.hostname, '::1', `Normalized hostname of ${ip} must be ::1`);
      assert(norm.isLoopback, `Expected ${ip} to be recognized as loopback`);

      const res = validateRestoreTarget({
        targetUri: `mongodb://${ip}`,
        targetDbName: 'isolated_test_db',
        targetEnv: 'test',
        confirmTarget: true,
      });
      assert(res.isValid);
    }

    recordTest(
      'EDGE-8',
      'IPv6 loopback forms (::1, [::1], 0:0:0:0:0:0:0:1) canonicalize to ::1',
      true,
      'Tested bracketed and unbracketed IPv6 loopbacks with and without ports'
    );
  } catch (err) {
    recordTest('EDGE-8', 'IPv6 loopback check failed', false, err.message);
  }

  // EDGE-9: URL-encoded credentials & URL-encoded superuser rejection
  try {
    // 1. Valid URL-encoded credentials with @ and :
    const encodedUri = 'mongodb://user%40company.com:p%40ss%3Aword%21@localhost:27017/test';
    const parsed = parseMongoUri(encodedUri);
    assert.strictEqual(parsed.username, 'user@company.com');
    assert.strictEqual(parsed.password, 'p@ss:word!');

    // 2. URL-encoded superuser attempts must be caught
    const encodedSuperusers = [
      'mongodb://%61dmin:pass@localhost:27017', // admin
      'mongodb://%72oot:pass@localhost:27017', // root
      'mongodb://%70rod_admin:pass@localhost:27017', // prod_admin
      'mongodb://ADMIN:pass@localhost:27017', // uppercase ADMIN
    ];

    for (const uri of encodedSuperusers) {
      let superThrown = null;
      try {
        validateRestoreTarget({
          targetUri: uri,
          targetDbName: 'isolated_test_db',
          targetEnv: 'test',
          confirmTarget: true,
          allowedHosts: ['localhost'],
        });
      } catch (e) {
        superThrown = e;
      }
      assert(superThrown && superThrown.code === 'UNAUTHORIZED_RESTORE_USER', `Expected UNAUTHORIZED_RESTORE_USER for ${uri}`);
    }

    recordTest(
      'EDGE-9',
      'URL-encoded credentials decoded safely; encoded superusers (%61dmin, %72oot) rejected',
      true,
      'Decoded special characters; blocked %61dmin, %72oot, %70rod_admin, and ADMIN'
    );
  } catch (err) {
    recordTest('EDGE-9', 'URL-encoded credential handling failed', false, err.message);
  }

  // EDGE-10: Malformed host entries & illegal URI characters
  try {
    const malformedHosts = [
      'host with space',
      'host/with/slash',
      'host?with?query',
      'host#with#hash',
      'host@with@at',
      '[::1', // unclosed bracket
      '[::1]invalid', // invalid suffix
      'localhost:port_not_number',
    ];

    for (const host of malformedHosts) {
      let thrown = null;
      try {
        normalizeHost(host);
      } catch (e) {
        thrown = e;
      }
      assert(thrown && thrown.code === 'INVALID_TARGET_URI', `Expected INVALID_TARGET_URI for ${host}`);
    }

    recordTest(
      'EDGE-10',
      'Malformed host entries and illegal characters fail safely with INVALID_TARGET_URI',
      true,
      'Rejected spaces, slashes, unclosed IPv6 brackets, and non-numeric ports'
    );
  } catch (err) {
    recordTest('EDGE-10', 'Malformed host handling failed', false, err.message);
  }

  // --- SECTION 2: ALLOWLIST BYPASS RESISTANCE ---

  // EDGE-11: Operator allowlist cannot bypass production host rejection
  try {
    const prodTargetUris = [
      'mongodb+srv://user:pass@cluster-prod.mongodb.net/test',
      'mongodb://user:pass@app-prod-primary.internal:27017/test',
      'mongodb://user:pass@staging.prod.internal:27017/test',
    ];

    for (const uri of prodTargetUris) {
      let thrown = null;
      try {
        validateRestoreTarget({
          targetUri: uri,
          targetDbName: 'staging_safe_db',
          targetEnv: 'staging',
          confirmTarget: true,
          // Operator maliciously or mistakenly puts production host in allowlist:
          allowedHosts: ['cluster-prod.mongodb.net', 'app-prod-primary.internal', 'staging.prod.internal'],
        });
      } catch (e) {
        thrown = e;
      }
      assert(thrown && thrown.code === 'PRODUCTION_HOST_REJECTED', `Allowlist must not bypass prod rejection for ${uri}`);
    }

    recordTest(
      'EDGE-11',
      'Allowlist cannot bypass production host rejection (Fail Closed)',
      true,
      'Verified PRODUCTION_HOST_REJECTED triggers even when host is listed in allowedHosts'
    );
  } catch (err) {
    recordTest('EDGE-11', 'Allowlist bypass resistance failed', false, err.message);
  }

  // EDGE-12: Operator allowlist cannot bypass missing confirmations or unsafe environment
  try {
    let unconfirmedThrown = null;
    try {
      validateRestoreTarget({
        targetUri: 'mongodb://staging-box.internal:27017',
        targetDbName: 'staging_test_db',
        targetEnv: 'staging',
        confirmTarget: false, // Not confirmed!
        allowedHosts: ['staging-box.internal'],
      });
    } catch (e) {
      unconfirmedThrown = e;
    }
    assert(unconfirmedThrown && unconfirmedThrown.code === 'UNCONFIRMED_TARGET_ENVIRONMENT');

    let prodEnvThrown = null;
    try {
      validateRestoreTarget({
        targetUri: 'mongodb://staging-box.internal:27017',
        targetDbName: 'staging_test_db',
        targetEnv: 'production', // Unsafe env!
        confirmTarget: true,
        allowedHosts: ['staging-box.internal'],
      });
    } catch (e) {
      prodEnvThrown = e;
    }
    assert(prodEnvThrown && prodEnvThrown.code === 'UNSAFE_ENVIRONMENT');

    recordTest(
      'EDGE-12',
      'Allowlist cannot bypass environment validation or operator confirmation',
      true,
      'Verified UNCONFIRMED_TARGET_ENVIRONMENT and UNSAFE_ENVIRONMENT enforced regardless of allowlist'
    );
  } catch (err) {
    recordTest('EDGE-12', 'Environment confirmation check failed', false, err.message);
  }

  // EDGE-13: Operator allowlist cannot bypass production database name check
  try {
    let prodDbThrown = null;
    try {
      validateRestoreTarget({
        targetUri: 'mongodb://localhost:27017',
        targetDbName: 'luxecart', // Production DB name!
        targetEnv: 'test',
        confirmTarget: true,
        allowedHosts: ['localhost'],
      });
    } catch (e) {
      prodDbThrown = e;
    }
    assert(prodDbThrown && prodDbThrown.code === 'UNSAFE_RESTORE_TARGET');

    recordTest(
      'EDGE-13',
      'Allowlist cannot bypass production database name validation',
      true,
      'Verified UNSAFE_RESTORE_TARGET enforced even on approved localhost'
    );
  } catch (err) {
    recordTest('EDGE-13', 'Production DB name check failed', false, err.message);
  }

  // --- SECTION 3: PRODUCTION CONFIGURATION CHECKS ---

  // EDGE-14: Production host matching uses exact normalized identities
  try {
    const prodConfigHost = 'Cluster.Production.MongoDB.Net.';
    const normalizedProd = normalizeHost(prodConfigHost);

    // Matching exact host triggers rejection
    let exactMatchThrown = null;
    try {
      validateRestoreTarget({
        targetUri: 'mongodb+srv://user:pass@cluster.production.mongodb.net/test',
        targetDbName: 'staging_test_db',
        targetEnv: 'staging',
        confirmTarget: true,
        productionHosts: [prodConfigHost],
        allowedHosts: ['cluster.production.mongodb.net'],
      });
    } catch (e) {
      exactMatchThrown = e;
    }
    assert(exactMatchThrown && exactMatchThrown.code === 'PRODUCTION_HOST_REJECTED');

    recordTest(
      'EDGE-14',
      'Production configuration comparisons use parsed and normalized host identities',
      true,
      'Normalized Cluster.Production.MongoDB.Net. matches cluster.production.mongodb.net'
    );
  } catch (err) {
    recordTest('EDGE-14', 'Production configuration normalization check failed', false, err.message);
  }

  // EDGE-15: Malformed production configuration fails closed (no silent swallowing)
  try {
    let malformedConfigThrown = null;
    const oldProdUri = process.env.PROD_MONGODB_URI;
    try {
      process.env.PROD_MONGODB_URI = 'invalid-not-a-mongo-uri';
      validateRestoreTarget({
        targetUri: 'mongodb://localhost:27017',
        targetDbName: 'isolated_test_db',
        targetEnv: 'test',
        confirmTarget: true,
        allowedHosts: ['localhost'],
      });
    } catch (e) {
      malformedConfigThrown = e;
    } finally {
      if (oldProdUri !== undefined) {
        process.env.PROD_MONGODB_URI = oldProdUri;
      } else {
        delete process.env.PROD_MONGODB_URI;
      }
    }

    assert(malformedConfigThrown, 'Malformed production configuration must fail closed');
    assert.strictEqual(malformedConfigThrown.code, 'INVALID_PRODUCTION_CONFIG');

    recordTest(
      'EDGE-15',
      'Malformed production configuration fails closed without silent error suppression',
      true,
      malformedConfigThrown.message
    );
  } catch (err) {
    recordTest('EDGE-15', 'Malformed production configuration check failed', false, err.message);
  }

  // --- SECTION 4: CREDENTIAL & DESTRUCTIVE OPERATION SAFETY ---

  // EDGE-16: sanitizeUri redacts credentials containing @, colons, and special characters
  try {
    const complexSensitiveUris = [
      'mongodb://user:p%40ss%3Aword@host:27017/db',
      'mongodb://user:p@ss@word@host:27017/db',
      'mongodb://admin_user@host:27017/db',
      'mongodb+srv://api_key_user:SuperSecretKey123!@cluster.mongodb.net/test',
    ];

    for (const uri of complexSensitiveUris) {
      const sanitized = sanitizeUri(uri);
      assert(!sanitized.includes('p%40ss%3Aword'), 'Must not leak encoded password');
      assert(!sanitized.includes('p@ss@word'), 'Must not leak multi-at password');
      assert(!sanitized.includes('admin_user'), 'Must not leak plain user authority');
      assert(!sanitized.includes('SuperSecretKey123!'), 'Must not leak plain password');
      assert(sanitized.includes('[REDACTED_CREDENTIALS]@'), `Expected [REDACTED_CREDENTIALS]@ in: ${sanitized}`);
    }

    recordTest(
      'EDGE-16',
      'sanitizeUri completely redacts complex credentials with @, colons, and URL encoding',
      true,
      'Tested multi-at, colon-separated, single-user, and complex SRV credential forms'
    );
  } catch (err) {
    recordTest('EDGE-16', 'Credential sanitization check failed', false, err.message);
  }

  // EDGE-17: Destructive operation (--drop) requires explicit confirmDrop
  try {
    let unconfirmedDropThrown = null;
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
    } catch (e) {
      unconfirmedDropThrown = e;
    }
    assert(unconfirmedDropThrown && unconfirmedDropThrown.code === 'UNCONFIRMED_DESTRUCTIVE_OPERATION');

    // Confirmed drop succeeds validation
    const confirmedDrop = validateRestoreTarget({
      targetUri: 'mongodb://localhost:27017',
      targetDbName: 'isolated_test_db',
      targetEnv: 'test',
      confirmTarget: true,
      allowedHosts: ['localhost'],
      drop: true,
      confirmDrop: true, // CONFIRMED
    });
    assert(confirmedDrop.isValid);

    recordTest(
      'EDGE-17',
      '--drop strictly requires confirmDrop=true; unconfirmed drop fails closed',
      true,
      'Verified UNCONFIRMED_DESTRUCTIVE_OPERATION blocks unconfirmed drops'
    );
  } catch (err) {
    recordTest('EDGE-17', 'Drop confirmation check failed', false, err.message);
  }

  // EDGE-18: Validation occurs strictly BEFORE any network connection
  try {
    let connectionAttempted = false;
    const origConnect = mongoose.connect;
    mongoose.connect = async () => {
      connectionAttempted = true;
      throw new Error('NETWORK SOCKET WAS OPENED!');
    };

    let thrown = null;
    try {
      await performRestore({
        sourceDir: path.join(serverDir, 'backups'),
        targetUri: 'mongodb+srv://admin:pass@cluster-prod.mongodb.net/test',
        targetDbName: 'isolated_test_db',
        targetEnv: 'test',
        confirmTarget: true,
      });
    } catch (e) {
      thrown = e;
    } finally {
      mongoose.connect = origConnect;
    }

    assert(thrown, 'Must throw safety violation');
    assert.strictEqual(connectionAttempted, false, 'mongoose.connect must never be called');

    recordTest(
      'EDGE-18',
      'Target validation fails closed before opening any network sockets',
      true,
      'Asserted zero connection attempts when target fails safety checks'
    );
  } catch (err) {
    recordTest('EDGE-18', 'Fail-before-connect check failed', false, err.message);
  }

  // --- SUMMARY ---
  console.log('\n' + '='.repeat(64));
  console.log('            PHASE 8.2.5 EDGE-CASE AUDIT RESULTS SUMMARY         ');
  console.log('='.repeat(64));
  console.table(testResults);

  const passed = testResults.filter((t) => t.status === 'PASS').length;
  const failed = testResults.filter((t) => t.status === 'FAIL').length;

  console.log(`Total: ${testResults.length} | Passed: ${passed} | Failed: ${failed}\n`);

  if (failed > 0) {
    console.error('❌ Phase 8.2.5 Edge-Case Audit failed!\n');
    process.exit(1);
  } else {
    console.log('✔ All Phase 8.2.5 Edge-Case Audit tests passed!\n');
  }
}

runEdgeCaseAudit().catch((err) => {
  console.error('[Fatal Error]', err);
  process.exit(1);
});
