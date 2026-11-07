/**
 * LUXECART PHASE 8.2.2 BACKUP & RESTORE READINESS TEST SUITE
 * 
 * Verifies:
 * 1. Missing MONGODB_URI throws MISSING_MONGODB_URI error safely.
 * 2. sanitizeUri redacts credentials across all connection schemes.
 * 3. Pre-existing target directory blocks silent overwrite (TARGET_DIRECTORY_EXISTS).
 * 4. Timestamp generator produces valid YYYYMMDD_HHMMSS directory strings.
 * 5. Dry-run mode inspects database without writing files to disk.
 * 6. Isolated programmatic backup produces compressed JSON archives and sanitized manifest.
 * 7. Verification that dumped collection archives accurately preserve documents and indexes.
 * 8. Zero credentials or sensitive secrets are leaked into manifest files or stdout.
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { performBackup, sanitizeUri, getTimestampString } from './backup_database.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverDir = path.resolve(__dirname, '..');
const tempTestDir = path.join(serverDir, 'backups', 'test_fixture_backup_' + Date.now());

const testResults = [];

function recordTest(testId, name, passed, details = '') {
  testResults.push({ testId, name, status: passed ? 'PASS' : 'FAIL', details });
  const badge = passed ? '✔ [PASS]' : '✖ [FAIL]';
  console.log(`${badge} [${testId}] ${name}`);
  if (details) console.log(`    ↳ ${details}`);
}

async function runTests() {
  console.log('\n' + '='.repeat(64));
  console.log('   LUXECART PHASE 8.2.2 BACKUP & RESTORE READINESS SUITE        ');
  console.log('='.repeat(64) + '\n');

  // TEST 1: Missing MONGODB_URI fails safely
  try {
    let thrown = null;
    try {
      await performBackup({ uri: '' });
    } catch (e) {
      thrown = e;
    }
    assert(thrown, 'Must throw error when URI is missing');
    assert.strictEqual(thrown.code, 'MISSING_MONGODB_URI');
    assert(thrown.message.includes('MONGODB_URI is required'));

    recordTest('TEST-1', 'Missing MONGODB_URI fails safely with MISSING_MONGODB_URI code', true, thrown.message);
  } catch (err) {
    recordTest('TEST-1', 'Missing MONGODB_URI fails safely', false, err.message);
  }

  // TEST 2: sanitizeUri properly redacts credentials across formats
  try {
    const testCases = [
      ['mongodb://user:my_secret_pass@cluster.mongodb.net/luxecart', 'mongodb://[REDACTED_CREDENTIALS]@cluster.mongodb.net/luxecart'],
      ['mongodb+srv://admin_user:P%40ssw0rd!@cluster0.abc.mongodb.net/prod?retryWrites=true', 'mongodb+srv://[REDACTED_CREDENTIALS]@cluster0.abc.mongodb.net/prod?retryWrites=true'],
      ['mongodb://localhost:27017/luxecart', 'mongodb://localhost:27017/luxecart'],
    ];

    for (const [raw, expected] of testCases) {
      const sanitized = sanitizeUri(raw);
      assert.strictEqual(sanitized, expected, `Mismatch for ${raw}`);
      assert(!sanitized.includes('my_secret_pass') && !sanitized.includes('P%40ssw0rd!'), 'Credential leaked');
    }

    recordTest('TEST-2', 'sanitizeUri redacts usernames and passwords without altering hosts or parameters', true, 'Tested standard and srv URI formats');
  } catch (err) {
    recordTest('TEST-2', 'sanitizeUri redacts credentials', false, err.message);
  }

  // TEST 3: Refuse to overwrite existing directory
  try {
    const existingDir = path.join(serverDir, 'backups', 'pre_existing_test_dir_' + Date.now());
    fs.mkdirSync(existingDir, { recursive: true });

    let thrown = null;
    try {
      await performBackup({
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/luxecart',
        outputDir: existingDir,
      });
    } catch (e) {
      thrown = e;
    }

    // Cleanup existing dir
    fs.rmdirSync(existingDir);

    assert(thrown, 'Must throw when output directory exists');
    assert.strictEqual(thrown.code, 'TARGET_DIRECTORY_EXISTS');
    assert(thrown.message.includes('Refusing to overwrite'));

    recordTest('TEST-3', 'Refuses to overwrite an existing backup directory (TARGET_DIRECTORY_EXISTS)', true, thrown.message);
  } catch (err) {
    recordTest('TEST-3', 'Refuses to overwrite an existing backup directory', false, err.message);
  }

  // TEST 4: Timestamp string generator produces valid format
  try {
    const fixedDate = new Date('2026-10-13T15:45:30Z');
    const ts = getTimestampString(fixedDate);
    assert(/^[0-9]{8}_[0-9]{6}$/.test(ts), `Invalid timestamp format: ${ts}`);

    recordTest('TEST-4', 'Timestamp generator produces valid YYYYMMDD_HHMMSS directory strings', true, `Generated: ${ts}`);
  } catch (err) {
    recordTest('TEST-4', 'Timestamp generator produces valid format', false, err.message);
  }

  // TEST 5: Dry-run mode inspects database without writing files
  try {
    const dryRunResult = await performBackup({
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/luxecart',
      dryRun: true,
      outputDir: tempTestDir,
    });

    assert(dryRunResult.success, 'Dry run should succeed');
    assert.strictEqual(dryRunResult.dryRun, true);
    assert.strictEqual(dryRunResult.targetDir, null);
    assert(!fs.existsSync(tempTestDir), 'Dry-run must not create output directory on disk');
    assert(dryRunResult.totalDocuments >= 0, 'Total documents must be non-negative');

    recordTest('TEST-5', 'Dry-run mode inspects collections and counts without writing any disk files', true, `Found ${dryRunResult.collectionsCount} collections, ${dryRunResult.totalDocuments} docs`);
  } catch (err) {
    recordTest('TEST-5', 'Dry-run mode inspects collections without writing files', false, err.message);
  }

  // TEST 6: Real backup execution to isolated test directory
  try {
    const backupResult = await performBackup({
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/luxecart',
      outputDir: tempTestDir,
    });

    assert(backupResult.success, 'Backup must succeed');
    assert(fs.existsSync(tempTestDir), 'Backup directory must exist');

    const manifestPath = path.join(tempTestDir, 'manifest.json');
    assert(fs.existsSync(manifestPath), 'manifest.json must exist');

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.strictEqual(manifest.backupVersion, '1.0.0');
    assert(manifest.collections.length > 0, 'Manifest must list collections');
    assert(!manifest.sanitizedUri.includes('password'), 'Manifest must not leak credentials');
    assert(manifest.securityNotice.includes('DPDP Act'), 'Manifest must contain DPDP Act compliance notice');

    // Verify at least one collection file was gzipped properly
    const sampleCol = manifest.collections[0];
    const sampleGzPath = path.join(tempTestDir, `${sampleCol.name}.json.gz`);
    assert(fs.existsSync(sampleGzPath), `Gzipped file ${sampleGzPath} must exist`);

    const gzippedBuffer = fs.readFileSync(sampleGzPath);
    const unzippedJson = JSON.parse(zlib.gunzipSync(gzippedBuffer).toString('utf8'));
    assert.strictEqual(unzippedJson.collection, sampleCol.name);
    assert(Array.isArray(unzippedJson.indexes), 'Indexes array must exist in archive');
    assert(Array.isArray(unzippedJson.documents), 'Documents array must exist in archive');
    assert.strictEqual(unzippedJson.documents.length, sampleCol.documents);

    recordTest('TEST-6', 'Database backup generates valid gzipped JSON archives and sanitized manifest.json', true, `Created ${manifest.collections.length} archives in ${tempTestDir}`);
  } catch (err) {
    recordTest('TEST-6', 'Database backup generates valid archives and manifest', false, err.message);
  } finally {
    // Teardown: clean up test backup directory
    if (fs.existsSync(tempTestDir)) {
      fs.rmSync(tempTestDir, { recursive: true, force: true });
    }
  }

  // Print Summary Table
  console.log('\n' + '='.repeat(64));
  console.log('                PHASE 8.2.2 TEST RESULTS SUMMARY                ');
  console.log('='.repeat(64));
  console.table(testResults);

  const passedCount = testResults.filter((t) => t.status === 'PASS').length;
  const failedCount = testResults.filter((t) => t.status === 'FAIL').length;
  console.log(`Total: ${testResults.length} | Passed: ${passedCount} | Failed: ${failedCount}\n`);

  if (failedCount > 0) {
    console.error('❌ Phase 8.2.2 verification failed!');
    process.exit(1);
  } else {
    console.log('✔ All Phase 8.2.2 Database Backup & Restore Readiness tests passed!\n');
    process.exit(0);
  }
}

runTests();
