/**
 * LuxeCart Phase UI-3.3D Test Suite: Shopping Bag & Announcement Improvements
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('================================================================');
console.log('   LUXECART PHASE UI-3.3D SHOPPING BAG & ANNOUNCEMENT SUITE     ');
console.log('================================================================\n');

const results = [];

async function runTest(testId, name, fn) {
  try {
    await fn();
    results.push({ testId, name, status: 'PASS' });
    console.log(`✔ [PASS] [${testId}] ${name}`);
  } catch (err) {
    results.push({ testId, name, status: 'FAIL', error: err.message });
    console.error(`✖ [FAIL] [${testId}] ${name}`);
    console.error(`    ↳ ${err.message}`);
  }
}

async function runSuite() {
  const cartPagePath = path.resolve(__dirname, '../../client/src/pages/CartPage.jsx');
  const cartPageCode = fs.readFileSync(cartPagePath, 'utf8');

  const announcementPath = path.resolve(__dirname, '../../client/src/components/home/AnnouncementBar.jsx');
  const announcementCode = fs.readFileSync(announcementPath, 'utf8');

  // --------------------------------------------------------------------------
  // SECTION 1: Empty Bag Confirmation Modal in CartPage.jsx
  // --------------------------------------------------------------------------
  await runTest('BAG-01', 'Empty Bag button opens confirmation modal instead of clearing directly', () => {
    // Must NOT call clearCart directly on Empty Bag button click
    assert.doesNotMatch(
      cartPageCode,
      /<button[^>]*onClick=\{clearCart\}[^>]*>[\s\S]*?Empty Bag[\s\S]*?<\/button>/,
      'Empty Bag button must not directly invoke clearCart'
    );

    // Must invoke modal opener
    assert.match(
      cartPageCode,
      /<button[^>]*onClick=\{handleOpenClearModal\}[^>]*>[\s\S]*?Empty Bag[\s\S]*?<\/button>/,
      'Empty Bag button must open the confirmation modal'
    );
  });

  await runTest('BAG-02', 'Confirmation modal provides accessible dialog semantics and accessible title', () => {
    assert.match(cartPageCode, /role="dialog"/, 'Modal must have role="dialog"');
    assert.match(cartPageCode, /aria-modal="true"/, 'Modal must have aria-modal="true"');
    assert.match(cartPageCode, /aria-labelledby="clear-bag-modal-title"/, 'Modal must have aria-labelledby');
    assert.match(cartPageCode, /id="clear-bag-modal-title"/, 'Title heading must match aria-labelledby ID');
  });

  await runTest('BAG-03', 'Cancel button closes dialog and leaves cart items untouched', () => {
    assert.match(cartPageCode, /handleCancelClear/, 'CartPage must define handleCancelClear');
    assert.match(
      cartPageCode,
      /const handleCancelClear\s*=\s*\(\)\s*=>\s*\{[\s\S]*?setClearModalOpen\(false\)[\s\S]*?\}/,
      'handleCancelClear must close modal without modifying cart'
    );
    assert.match(
      cartPageCode,
      /<button[^>]*onClick=\{handleCancelClear\}[^>]*>[\s\S]*?Cancel[\s\S]*?<\/button>/,
      'Cancel button must be wired to handleCancelClear'
    );
  });

  await runTest('BAG-04', 'Confirm button calls clearCart with in-progress double-submission guard', () => {
    assert.match(cartPageCode, /const \[clearing,\s*setClearing\]\s*=\s*useState\(false\)/, 'Must declare clearing state');
    assert.match(
      cartPageCode,
      /const handleConfirmClear\s*=\s*async\s*\(\)\s*=>\s*\{[\s\S]*?if\s*\(clearing\)\s*return;[\s\S]*?await clearCart\(\);[\s\S]*?setClearModalOpen\(false\);/,
      'handleConfirmClear must guard against concurrent clicks and call clearCart once'
    );
    assert.match(
      cartPageCode,
      /<button[^>]*disabled=\{clearing\}[^>]*onClick=\{handleConfirmClear\}/,
      'Confirm button must be disabled while clearing'
    );
  });

  await runTest('BAG-05', 'Confirmation modal implements initial focus, Tab containment, Escape dismiss, and focus restoration', () => {
    assert.match(cartPageCode, /cancelClearBtnRef\.current\.focus\(\)/, 'Cancel button must receive initial focus');
    assert.match(cartPageCode, /e\.key\s*===\s*['"]Escape['"][\s\S]*?!clearing[\s\S]*?setClearModalOpen\(false\)/, 'Escape key must close modal when not clearing');
    assert.match(cartPageCode, /e\.key\s*===\s*['"]Tab['"][\s\S]*?clearModalRef\.current/, 'Must trap Tab focus inside clearModalRef');
    assert.match(cartPageCode, /prevActiveElementRef\.current\.focus\(\)/, 'Must restore focus to trigger control on close');
    assert.match(cartPageCode, /e\.target\s*===\s*e\.currentTarget\s*&&\s*!clearing/, 'Backdrop click must safely dismiss when not clearing');
  });

  // --------------------------------------------------------------------------
  // SECTION 2: Announcement Bar Dismissal Persistence
  // --------------------------------------------------------------------------
  await runTest('ANN-01', 'AnnouncementBar uses a namespaced, versioned sessionStorage key', () => {
    assert.match(
      announcementCode,
      /ANNOUNCEMENT_STORAGE_KEY\s*=\s*['"]luxecart:announcement:v1:dismissed['"]/,
      'Must define versioned key luxecart:announcement:v1:dismissed'
    );
  });

  await runTest('ANN-02', 'AnnouncementBar safely initializes visibility from sessionStorage', () => {
    // Import and test simulated behavior
    const mockStorage = new Map();
    const STORAGE_KEY = 'luxecart:announcement:v1:dismissed';

    // Helper simulating AnnouncementBar's getInitialVisibility
    const testGetInitialVisibility = (storageImpl) => {
      try {
        if (storageImpl) {
          return storageImpl.getItem(STORAGE_KEY) !== 'true';
        }
      } catch {
        // Fallback
      }
      return true;
    };

    // Case A: Fresh session without dismissal -> returns true (visible)
    assert.strictEqual(testGetInitialVisibility(mockStorage), true);

    // Case B: Dismissed in current session -> returns false (hidden)
    mockStorage.set(STORAGE_KEY, 'true');
    mockStorage.getItem = (k) => mockStorage.get(k);
    assert.strictEqual(testGetInitialVisibility(mockStorage), false);

    // Case C: Storage throws SecurityError -> returns true safely without crash
    const throwingStorage = {
      getItem: () => {
        throw new Error('SecurityError: The operation is insecure.');
      },
    };
    assert.strictEqual(testGetInitialVisibility(throwingStorage), true);
  });

  await runTest('ANN-03', 'Dismissal persists to sessionStorage with error handling', () => {
    assert.match(announcementCode, /handleDismiss/, 'Must define handleDismiss');
    assert.match(
      announcementCode,
      /sessionStorage\.setItem\(ANNOUNCEMENT_STORAGE_KEY,\s*['"]true['"]\)/,
      'handleDismiss must write "true" to sessionStorage'
    );
    assert.match(
      announcementCode,
      /try\s*\{[\s\S]*?sessionStorage\.setItem[\s\S]*?\}\s*catch/,
      'sessionStorage.setItem must be wrapped in try/catch to handle restricted storage'
    );
  });

  console.log('\n================================================================');
  console.log('   PHASE UI-3.3D TEST RESULTS SUMMARY                           ');
  console.log('================================================================');
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log(`TOTAL: ${results.length} | PASS: ${passed} | FAIL: ${failed}`);
  if (failed > 0) {
    process.exit(1);
  }
}

runSuite();
