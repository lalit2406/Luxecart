/**
 * LuxeCart Phase 7.1 — Focused Verification Test Suite for Production JWT Configuration
 *
 * Verifies:
 * 1. Valid production secrets allow configuration to load successfully.
 * 2. Missing access secret causes production configuration to fail fast.
 * 3. Missing refresh secret causes production configuration to fail fast.
 * 4. Empty or whitespace access/refresh secret is rejected in production.
 * 5. Known insecure default secrets are rejected in production.
 * 6. Identical access and refresh secrets are rejected in production.
 * 7. Secrets shorter than 32 characters are rejected in production.
 * 8. Local development workflow loads cleanly with existing default fallbacks.
 * 9. Subprocess fail-fast verification: server import halts with exit code 1 when secrets missing in production.
 * 10. Subprocess dev verification: server import succeeds with exit code 0 in development.
 * 11. Security guarantee: error messages never leak secret values.
 */

import { validateJwtSecrets, createConfig, KNOWN_INSECURE_SECRETS } from '../src/config/env.js';
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, '..');

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
console.log('   LUXECART PHASE 7.1 JWT CONFIGURATION TEST SUITE             ');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// Test 1: Valid production secrets allow configuration to load
// -----------------------------------------------------------------------------
try {
  const prodEnv = {
    NODE_ENV: 'production',
    PORT: '5000',
    JWT_ACCESS_SECRET: 'prod_unique_access_secret_0123456789_abcdef',
    JWT_REFRESH_SECRET: 'prod_unique_refresh_secret_9876543210_fedcba',
    MONGODB_URI: 'mongodb+srv://user:pass@cluster0.mongodb.net/luxecart?retryWrites=true&w=majority',
  };

  const config = createConfig(prodEnv);
  assert(
    config.isProduction === true &&
    config.jwt.accessSecret === prodEnv.JWT_ACCESS_SECRET &&
    config.jwt.refreshSecret === prodEnv.JWT_REFRESH_SECRET,
    'TEST-1',
    'Valid production secrets allow configuration to load successfully'
  );
} catch (err) {
  assert(false, 'TEST-1', `Unexpected failure with valid prod secrets: ${err.message}`);
}

// -----------------------------------------------------------------------------
// Test 2: Missing access secret causes production configuration to fail
// -----------------------------------------------------------------------------
try {
  const env = {
    NODE_ENV: 'production',
    JWT_REFRESH_SECRET: 'prod_unique_refresh_secret_9876543210_fedcba',
  };
  validateJwtSecrets(env);
  assert(false, 'TEST-2', 'Should have thrown error for missing JWT_ACCESS_SECRET');
} catch (err) {
  assert(
    err.message.includes('JWT_ACCESS_SECRET is required in production'),
    'TEST-2',
    'Missing access secret causes production configuration to fail fast with clear message'
  );
}

// -----------------------------------------------------------------------------
// Test 3: Missing refresh secret causes production configuration to fail
// -----------------------------------------------------------------------------
try {
  const env = {
    NODE_ENV: 'production',
    JWT_ACCESS_SECRET: 'prod_unique_access_secret_0123456789_abcdef',
  };
  validateJwtSecrets(env);
  assert(false, 'TEST-3', 'Should have thrown error for missing JWT_REFRESH_SECRET');
} catch (err) {
  assert(
    err.message.includes('JWT_REFRESH_SECRET is required in production'),
    'TEST-3',
    'Missing refresh secret causes production configuration to fail fast with clear message'
  );
}

// -----------------------------------------------------------------------------
// Test 4: Empty or whitespace secrets are rejected in production
// -----------------------------------------------------------------------------
try {
  const env = {
    NODE_ENV: 'production',
    JWT_ACCESS_SECRET: '   ',
    JWT_REFRESH_SECRET: 'prod_unique_refresh_secret_9876543210_fedcba',
  };
  validateJwtSecrets(env);
  assert(false, 'TEST-4A', 'Should have rejected empty access secret');
} catch (err) {
  assert(
    err.message.includes('cannot be empty'),
    'TEST-4A',
    'Whitespace-only access secret is rejected in production'
  );
}

try {
  const env = {
    NODE_ENV: 'production',
    JWT_ACCESS_SECRET: 'prod_unique_access_secret_0123456789_abcdef',
    JWT_REFRESH_SECRET: '',
  };
  validateJwtSecrets(env);
  assert(false, 'TEST-4B', 'Should have rejected empty refresh secret');
} catch (err) {
  assert(
    err.message.includes('cannot be empty'),
    'TEST-4B',
    'Empty refresh secret is rejected in production'
  );
}

// -----------------------------------------------------------------------------
// Test 5: Known insecure default secrets are rejected in production
// -----------------------------------------------------------------------------
let allDefaultsRejected = true;
for (const defaultSec of KNOWN_INSECURE_SECRETS) {
  try {
    const env = {
      NODE_ENV: 'production',
      JWT_ACCESS_SECRET: defaultSec,
      JWT_REFRESH_SECRET: 'prod_unique_refresh_secret_9876543210_fedcba',
    };
    validateJwtSecrets(env);
    allDefaultsRejected = false;
  } catch (err) {
    if (!err.message.includes('insecure default secret')) {
      allDefaultsRejected = false;
    }
  }
}
assert(
  allDefaultsRejected,
  'TEST-5',
  'All known insecure default secrets are strictly rejected in production'
);

// -----------------------------------------------------------------------------
// Test 6: Identical access and refresh secrets are rejected in production
// -----------------------------------------------------------------------------
try {
  const sameSecret = 'same_secret_for_both_access_and_refresh_01234567';
  const env = {
    NODE_ENV: 'production',
    JWT_ACCESS_SECRET: sameSecret,
    JWT_REFRESH_SECRET: sameSecret,
  };
  validateJwtSecrets(env);
  assert(false, 'TEST-6', 'Should have rejected identical access and refresh secrets');
} catch (err) {
  assert(
    err.message.includes('must not be identical'),
    'TEST-6',
    'Identical access and refresh secrets are rejected in production'
  );
}

// -----------------------------------------------------------------------------
// Test 7: Secrets shorter than 32 characters are rejected in production
// -----------------------------------------------------------------------------
try {
  const env = {
    NODE_ENV: 'production',
    JWT_ACCESS_SECRET: 'too_short_secret_123',
    JWT_REFRESH_SECRET: 'prod_unique_refresh_secret_9876543210_fedcba',
  };
  validateJwtSecrets(env);
  assert(false, 'TEST-7', 'Should have rejected short secret');
} catch (err) {
  assert(
    err.message.includes('must be at least 32 characters'),
    'TEST-7',
    'Secrets shorter than 32 characters are rejected in production'
  );
}

// -----------------------------------------------------------------------------
// Test 8: Local development workflow loads cleanly with existing default fallbacks
// -----------------------------------------------------------------------------
try {
  const devEnv = {
    NODE_ENV: 'development',
  };
  const devConfig = createConfig(devEnv);
  assert(
    devConfig.isDevelopment === true &&
    devConfig.jwt.accessSecret.length >= 32 &&
    devConfig.jwt.refreshSecret.length >= 32,
    'TEST-8',
    'Local development loads cleanly with existing default fallback secrets'
  );
} catch (err) {
  assert(false, 'TEST-8', `Dev config threw error: ${err.message}`);
}

// -----------------------------------------------------------------------------
// Test 9: Subprocess fail-fast in production mode
// -----------------------------------------------------------------------------
const runSubprocess = (envOverrides) => {
  const child = spawnSync(
    process.execPath,
    ['-e', 'import("./src/config/env.js").then(() => console.log("LOADED")).catch((e) => { console.error(e.message); process.exit(1); })'],
    {
      cwd: serverRoot,
      env: {
        ...process.env,
        ...envOverrides,
      },
      encoding: 'utf8',
    }
  );
  return child;
};

const missingSecretsResult = runSubprocess({
  NODE_ENV: 'production',
  JWT_ACCESS_SECRET: '',
  JWT_REFRESH_SECRET: '',
});

assert(
  missingSecretsResult.status !== 0 &&
  missingSecretsResult.stderr.includes('[Config Error]'),
  'TEST-9',
  'Subprocess halts execution with exit code 1 when secrets are missing in production'
);

// -----------------------------------------------------------------------------
// Test 10: Subprocess succeeds in development mode
// -----------------------------------------------------------------------------
const devSubprocessResult = runSubprocess({
  NODE_ENV: 'development',
});

assert(
  devSubprocessResult.status === 0 &&
  devSubprocessResult.stdout.includes('LOADED'),
  'TEST-10',
  'Subprocess loads successfully with exit code 0 in development mode'
);

// -----------------------------------------------------------------------------
// Test 11: Error messages never leak secret values
// -----------------------------------------------------------------------------
const candidateSecretToHide = 'super_secret_canary_value_that_must_not_leak_012';
let leaked = false;
try {
  validateJwtSecrets({
    NODE_ENV: 'production',
    JWT_ACCESS_SECRET: candidateSecretToHide,
    JWT_REFRESH_SECRET: '',
  });
} catch (err) {
  if (err.message.includes(candidateSecretToHide)) {
    leaked = true;
  }
}
assert(
  !leaked,
  'TEST-11',
  'Error messages strictly reference environment variable names and never interpolate secret values'
);

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log('\n================================================================');
console.log('                 PHASE 7.1 TEST RESULTS SUMMARY                 ');
console.log('================================================================');
console.table(results);

const passedCount = results.filter((r) => r.status === 'PASS').length;
const failedCount = results.filter((r) => r.status === 'FAIL').length;
console.log(`Total: ${results.length} | Passed: ${passedCount} | Failed: ${failedCount}`);

if (failedCount > 0) {
  process.exit(1);
} else {
  console.log('\n✔ All Phase 7.1 JWT configuration verification checks passed!\n');
  process.exit(0);
}
