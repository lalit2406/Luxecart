/**
 * LUXECART PHASE 7.3.3E.3: STAGING ADMIN BOOTSTRAP SAFETY GUARDRAILS TEST SUITE
 *
 * Fully isolated in-memory unit tests verifying safety gates, credential validation,
 * database name verification, and existing-account promotion protection in bootstrapAdmin.js.
 *
 * INVARIANT: ZERO LIVE CONNECTIONS TO ATLAS OR PERSISTENT DATABASES.
 */

import assert from 'assert';
import {
  bootstrapAdmin,
  validateAdminCredentials,
  validateTargetMongoUri,
  REQUIRED_TARGET_DB,
  INSECURE_DEFAULT_PASSWORDS,
  INSECURE_DEFAULT_EMAILS,
} from '../src/utils/bootstrapAdmin.js';

const testResults = [];

function recordTest(testId, name, passed, details = '') {
  testResults.push({ testId, name, status: passed ? 'PASS' : 'FAIL', details });
  const badge = passed ? '✔ [PASS]' : '✖ [FAIL]';
  console.log(`${badge} [${testId}] ${name}`);
  if (details) console.log(`    ↳ ${details}`);
}

/**
 * Mock User Model for isolated test execution
 */
class MockUserModel {
  constructor(data) {
    this.name = data.name;
    this.email = data.email;
    this.passwordHash = data.passwordHash;
    this.role = data.role;
    this.status = data.status;
    this._id = 'mock_user_id_' + Math.random().toString(36).substring(2, 9);
    this.saveCallCount = 0;
  }

  async save() {
    this.saveCallCount++;
    return this;
  }

  toSafeObject() {
    return {
      id: this._id,
      name: this.name,
      email: this.email,
      role: this.role,
      status: this.status,
    };
  }

  static findOneCallCount = 0;
  static mockExistingUser = null;

  static async findOne(query) {
    MockUserModel.findOneCallCount++;
    if (MockUserModel.mockExistingUser && MockUserModel.mockExistingUser.email === query.email) {
      return MockUserModel.mockExistingUser;
    }
    return null;
  }

  static reset() {
    MockUserModel.findOneCallCount = 0;
    MockUserModel.mockExistingUser = null;
  }
}

async function runTests() {
  console.log('\n================================================================');
  console.log('   LUXECART PHASE 7.3.3E.3: BOOTSTRAP ADMIN SAFETY GUARDRAIL TESTS');
  console.log('   (Isolated Test Harness — Zero Atlas / Live DB Connections)');
  console.log('================================================================\n');

  const validStagingUri = 'mongodb+srv://staging_user:dummy_pass@cluster.mongodb.net/luxecart_staging?retryWrites=true&w=majority';
  const validName = 'Staging Security Administrator';
  const validEmail = 'staging-admin@luxecart.com';
  const validPassword = 'SecureAdminSecretPassword2026!#';

  // --- SECTION 1: CONFIRM-DB SAFETY GATE TESTS ---
  console.log('--- 1. Database Confirmation Gate Tests ---');

  // Test 1: Missing confirmDb
  try {
    MockUserModel.reset();
    let connectCalled = false;
    await bootstrapAdmin({
      name: validName,
      email: validEmail,
      password: validPassword,
      confirmDb: null,
      mongoUri: validStagingUri,
      UserModel: MockUserModel,
      connectFn: async () => { connectCalled = true; },
    });
    recordTest('TC-CONFIRM-01', 'Rejects missing confirmDb flag', false, 'Should have thrown missing confirmation error');
  } catch (err) {
    const passed = err.message.includes("Missing required database confirmation flag '--confirm-db=luxecart_staging'");
    recordTest('TC-CONFIRM-01', 'Rejects missing confirmDb flag', passed, err.message);
    assert.strictEqual(MockUserModel.findOneCallCount, 0, 'No findOne query must occur');
  }

  // Test 2: Mismatched confirmDb (e.g. test database)
  try {
    MockUserModel.reset();
    await bootstrapAdmin({
      name: validName,
      email: validEmail,
      password: validPassword,
      confirmDb: 'test',
      mongoUri: validStagingUri,
      UserModel: MockUserModel,
    });
    recordTest('TC-CONFIRM-02', 'Rejects wrong confirmDb (confirmDb=test)', false, 'Should have thrown mismatch error');
  } catch (err) {
    const passed = err.message.includes("Database confirmation mismatch! Expected '--confirm-db=luxecart_staging'");
    recordTest('TC-CONFIRM-02', 'Rejects wrong confirmDb (confirmDb=test)', passed, err.message);
    assert.strictEqual(MockUserModel.findOneCallCount, 0);
  }

  // Test 3: Empty string confirmDb
  try {
    MockUserModel.reset();
    await bootstrapAdmin({
      name: validName,
      email: validEmail,
      password: validPassword,
      confirmDb: '   ',
      mongoUri: validStagingUri,
      UserModel: MockUserModel,
    });
    recordTest('TC-CONFIRM-03', 'Rejects empty whitespace confirmDb', false, 'Should have thrown error');
  } catch (err) {
    const passed = err.message.includes('Missing required database confirmation flag');
    recordTest('TC-CONFIRM-03', 'Rejects empty whitespace confirmDb', passed, err.message);
  }

  // --- SECTION 2: CREDENTIAL VALIDATION TESTS ---
  console.log('\n--- 2. Pre-Connection Credential Validation Tests ---');

  // Test 4: Missing ADMIN_NAME
  try {
    validateAdminCredentials({ name: '', email: validEmail, password: validPassword });
    recordTest('TC-CRED-01', 'Rejects empty ADMIN_NAME', false, 'Should have failed');
  } catch (err) {
    const passed = err.message.includes('ADMIN_NAME is required');
    recordTest('TC-CRED-01', 'Rejects empty ADMIN_NAME', passed, err.message);
  }

  // Test 5: ADMIN_NAME too short (< 2 chars)
  try {
    validateAdminCredentials({ name: 'A', email: validEmail, password: validPassword });
    recordTest('TC-CRED-02', 'Rejects ADMIN_NAME with length < 2', false, 'Should have failed');
  } catch (err) {
    const passed = err.message.includes('ADMIN_NAME must be between 2 and 100 characters');
    recordTest('TC-CRED-02', 'Rejects ADMIN_NAME with length < 2', passed, err.message);
  }

  // Test 6: Missing ADMIN_EMAIL
  try {
    validateAdminCredentials({ name: validName, email: '', password: validPassword });
    recordTest('TC-CRED-03', 'Rejects empty ADMIN_EMAIL', false, 'Should have failed');
  } catch (err) {
    const passed = err.message.includes('ADMIN_EMAIL is required');
    recordTest('TC-CRED-03', 'Rejects empty ADMIN_EMAIL', passed, err.message);
  }

  // Test 7: Invalid format ADMIN_EMAIL
  try {
    validateAdminCredentials({ name: validName, email: 'not-an-email', password: validPassword });
    recordTest('TC-CRED-04', 'Rejects malformed ADMIN_EMAIL', false, 'Should have failed');
  } catch (err) {
    const passed = err.message.includes('ADMIN_EMAIL must be a valid email address');
    recordTest('TC-CRED-04', 'Rejects malformed ADMIN_EMAIL', passed, err.message);
  }

  // Test 8: Known placeholder / insecure email
  try {
    validateAdminCredentials({ name: validName, email: 'admin@luxecart.local', password: validPassword });
    recordTest('TC-CRED-05', 'Rejects default placeholder email (admin@luxecart.local)', false, 'Should have failed');
  } catch (err) {
    const passed = err.message.includes('ADMIN_EMAIL cannot use a placeholder or insecure default email');
    recordTest('TC-CRED-05', 'Rejects default placeholder email (admin@luxecart.local)', passed, err.message);
  }

  // Test 9: Missing ADMIN_PASSWORD
  try {
    validateAdminCredentials({ name: validName, email: validEmail, password: '' });
    recordTest('TC-CRED-06', 'Rejects empty ADMIN_PASSWORD', false, 'Should have failed');
  } catch (err) {
    const passed = err.message.includes('ADMIN_PASSWORD is required');
    recordTest('TC-CRED-06', 'Rejects empty ADMIN_PASSWORD', passed, err.message);
  }

  // Test 10: Whitespace-only ADMIN_PASSWORD
  try {
    validateAdminCredentials({ name: validName, email: validEmail, password: '                ' });
    recordTest('TC-CRED-07', 'Rejects whitespace-only ADMIN_PASSWORD', false, 'Should have failed');
  } catch (err) {
    const passed = err.message.includes('ADMIN_PASSWORD cannot be whitespace-only');
    recordTest('TC-CRED-07', 'Rejects whitespace-only ADMIN_PASSWORD', passed, err.message);
  }

  // Test 11: Weak ADMIN_PASSWORD (< 16 chars)
  try {
    validateAdminCredentials({ name: validName, email: validEmail, password: 'ShortPassword1!' });
    recordTest('TC-CRED-08', 'Rejects password shorter than 16 characters', false, 'Should have failed');
  } catch (err) {
    const passed = err.message.includes('ADMIN_PASSWORD must be at least 16 characters long');
    recordTest('TC-CRED-08', 'Rejects password shorter than 16 characters', passed, err.message);
  }

  // Test 12: Known insecure default password
  try {
    validateAdminCredentials({ name: validName, email: validEmail, password: 'Admin@LuxeCart2026' });
    recordTest('TC-CRED-09', 'Rejects known insecure default password (Admin@LuxeCart2026)', false, 'Should have failed');
  } catch (err) {
    const passed = err.message.includes('ADMIN_PASSWORD matches a known insecure default');
    recordTest('TC-CRED-09', 'Rejects known insecure default password (Admin@LuxeCart2026)', passed, err.message);
  }

  // --- SECTION 3: CONNECTION URI & ACTIVE DB VERIFICATION ---
  console.log('\n--- 3. Target URI & Active Database Verification Tests ---');

  // Test 13: URI targeting wrong database
  try {
    validateTargetMongoUri('mongodb+srv://user:pass@cluster.mongodb.net/test?retryWrites=true', 'luxecart_staging');
    recordTest('TC-URI-01', 'Rejects MONGODB_URI targeting /test instead of /luxecart_staging', false, 'Should have failed');
  } catch (err) {
    const passed = err.message.includes("MONGODB_URI does not target the 'luxecart_staging' database");
    recordTest('TC-URI-01', 'Rejects MONGODB_URI targeting /test instead of /luxecart_staging', passed, err.message);
  }

  // Test 14: URI missing database name completely
  try {
    validateTargetMongoUri('mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true', 'luxecart_staging');
    recordTest('TC-URI-02', 'Rejects MONGODB_URI with missing database path', false, 'Should have failed');
  } catch (err) {
    const passed = err.message.includes("MONGODB_URI does not target the 'luxecart_staging' database");
    recordTest('TC-URI-02', 'Rejects MONGODB_URI with missing database path', passed, err.message);
  }

  // Test 15: Connected database mismatch (simulated live connection to 'test')
  try {
    MockUserModel.reset();
    let disconnected = false;
    const mockDb = { databaseName: 'test' };
    await bootstrapAdmin({
      name: validName,
      email: validEmail,
      password: validPassword,
      confirmDb: 'luxecart_staging',
      mongoUri: validStagingUri,
      injectedDb: mockDb,
      UserModel: MockUserModel,
      disconnectFn: async () => { disconnected = true; },
      autoDisconnect: true,
    });
    recordTest('TC-DB-01', 'Aborts immediately if connected database is test', false, 'Should have failed');
  } catch (err) {
    const passed = err.message.includes("Active database mismatch: connected to 'test', but expected 'luxecart_staging'");
    recordTest('TC-DB-01', 'Aborts immediately if connected database is test', passed, err.message);
    assert.strictEqual(MockUserModel.findOneCallCount, 0, 'Must abort before querying User model');
  }

  // --- SECTION 4: SAFE PROVISIONING & PROMOTION TESTS ---
  console.log('\n--- 4. Account Provisioning & Promotion Protection Tests ---');

  // Test 16: Successful creation of NEW admin account on luxecart_staging without second flag
  try {
    MockUserModel.reset();
    let disconnected = false;
    const mockDb = { databaseName: 'luxecart_staging' };

    const result = await bootstrapAdmin({
      name: validName,
      email: validEmail,
      password: validPassword,
      confirmDb: 'luxecart_staging',
      confirmExistingAccountUpdate: false, // Second flag omitted
      mongoUri: validStagingUri,
      injectedDb: mockDb,
      UserModel: MockUserModel,
      disconnectFn: async () => { disconnected = true; },
      autoDisconnect: false,
    });

    const passed =
      result.name === validName &&
      result.email === validEmail &&
      result.role === 'ADMIN' &&
      result.status === 'ACTIVE' &&
      result.passwordHash === undefined && // Stripped by toSafeObject
      MockUserModel.findOneCallCount === 1;

    recordTest('TC-BOOTSTRAP-01', 'Successfully provisions new admin user with only confirmDb flag', passed);
  } catch (err) {
    recordTest('TC-BOOTSTRAP-01', 'Successfully provisions new admin user with only confirmDb flag', false, err.message);
  }

  // Test 17A: Existing account WITHOUT second flag -> ABORTS by default, zero writes
  try {
    MockUserModel.reset();
    const existing = new MockUserModel({
      name: 'Existing Customer',
      email: validEmail,
      passwordHash: 'old_hashed_password',
      role: 'CUSTOMER',
      status: 'ACTIVE',
    });
    MockUserModel.mockExistingUser = existing;

    const mockDb = { databaseName: 'luxecart_staging' };

    await bootstrapAdmin({
      name: validName,
      email: validEmail,
      password: validPassword,
      confirmDb: 'luxecart_staging',
      confirmExistingAccountUpdate: false, // Second flag omitted
      mongoUri: validStagingUri,
      injectedDb: mockDb,
      UserModel: MockUserModel,
      autoDisconnect: false,
    });

    recordTest('TC-BOOTSTRAP-02A', 'Aborts promotion of existing account when second flag is missing (zero writes)', false, 'Should have thrown');
  } catch (err) {
    const existing = MockUserModel.mockExistingUser;
    const passed =
      err.message.includes("To explicitly promote this existing user to ADMIN and reset their password, re-run with '--confirm-existing-account-update'") &&
      existing.role === 'CUSTOMER' &&
      existing.passwordHash === 'old_hashed_password' &&
      existing.saveCallCount === 0;

    recordTest('TC-BOOTSTRAP-02A', 'Aborts promotion of existing account when second flag is missing (zero writes)', passed, err.message);
  }

  // Test 17B: Existing account WITH second flag -> promotion succeeds
  try {
    MockUserModel.reset();
    const existing = new MockUserModel({
      name: 'Existing Customer',
      email: validEmail,
      passwordHash: 'old_hashed_password',
      role: 'CUSTOMER',
      status: 'ACTIVE',
    });
    MockUserModel.mockExistingUser = existing;

    const mockDb = { databaseName: 'luxecart_staging' };

    const result = await bootstrapAdmin({
      name: validName,
      email: validEmail,
      password: validPassword,
      confirmDb: 'luxecart_staging',
      confirmExistingAccountUpdate: true, // Second flag provided
      mongoUri: validStagingUri,
      injectedDb: mockDb,
      UserModel: MockUserModel,
      autoDisconnect: false,
    });

    const passed =
      result.email === validEmail &&
      result.role === 'ADMIN' &&
      existing.role === 'ADMIN' &&
      existing.status === 'ACTIVE' &&
      existing.saveCallCount === 1 &&
      existing.passwordHash !== 'old_hashed_password' &&
      MockUserModel.findOneCallCount === 1;

    recordTest('TC-BOOTSTRAP-02B', 'Successfully promotes existing account when both flags are supplied', passed);
  } catch (err) {
    recordTest('TC-BOOTSTRAP-02B', 'Successfully promotes existing account when both flags are supplied', false, err.message);
  }

  // Test 17C: Promotion with second flag BUT wrong or missing database confirmation -> ABORTS at database gate
  try {
    MockUserModel.reset();
    const existing = new MockUserModel({
      name: 'Existing Customer',
      email: validEmail,
      passwordHash: 'old_hashed_password',
      role: 'CUSTOMER',
      status: 'ACTIVE',
    });
    MockUserModel.mockExistingUser = existing;

    await bootstrapAdmin({
      name: validName,
      email: validEmail,
      password: validPassword,
      confirmDb: 'wrong_db',
      confirmExistingAccountUpdate: true,
      mongoUri: validStagingUri,
      UserModel: MockUserModel,
      autoDisconnect: false,
    });

    recordTest('TC-BOOTSTRAP-02C', 'Both confirmation flags remain mandatory for promotion (rejects wrong confirmDb)', false, 'Should have thrown');
  } catch (err) {
    const existing = MockUserModel.mockExistingUser;
    const passed =
      err.message.includes("Database confirmation mismatch! Expected '--confirm-db=luxecart_staging'") &&
      existing.saveCallCount === 0 &&
      MockUserModel.findOneCallCount === 0;

    recordTest('TC-BOOTSTRAP-02C', 'Both confirmation flags remain mandatory for promotion (rejects wrong confirmDb)', passed, err.message);
  }

  // Test 18: Disconnect called in finally block on connection failure
  let test18Disconnected = false;
  let test18ConnectAttempted = false;
  try {
    MockUserModel.reset();

    await bootstrapAdmin({
      name: validName,
      email: validEmail,
      password: validPassword,
      confirmDb: 'luxecart_staging',
      mongoUri: validStagingUri,
      UserModel: MockUserModel,
      connectFn: async () => {
        test18ConnectAttempted = true;
        return { connection: { db: { databaseName: 'unauthorized_db' } } };
      },
      disconnectFn: async () => {
        test18Disconnected = true;
      },
    });
    recordTest('TC-DISCONN-01', 'Calls disconnect in finally block when database check fails', false, 'Should have thrown');
  } catch (err) {
    const passed = err.message.includes('Active database mismatch') && test18ConnectAttempted && test18Disconnected;
    recordTest('TC-DISCONN-01', 'Calls disconnect in finally block when database check fails', passed, err.message);
  }

  // --- SUMMARY ---
  console.log('\n================================================================');
  console.log('                      TEST RUN SUMMARY                          ');
  console.log('================================================================');
  const total = testResults.length;
  const passedCount = testResults.filter((t) => t.status === 'PASS').length;
  const failedCount = testResults.filter((t) => t.status === 'FAIL').length;
  console.log(`Total Tests Run:  ${total}`);
  console.log(`Passed:           ${passedCount}`);
  console.log(`Failed:           ${failedCount}`);

  if (failedCount > 0) {
    console.error('\n✖ Some test cases failed!');
    process.exit(1);
  } else {
    console.log('\n✔ ALL TESTS PASSED SUCCESSFULLY! Zero live database connections made.\n');
  }
}

runTests().catch((err) => {
  console.error('Test Runner Error:', err);
  process.exit(1);
});
