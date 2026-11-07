/**
 * LuxeCart Phase UI-3.3C Test Suite: Modal Accessibility Improvements
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('================================================================');
console.log('   LUXECART PHASE UI-3.3C MODAL ACCESSIBILITY TEST SUITE        ');
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
  const checkoutPath = path.resolve(__dirname, '../../client/src/pages/CheckoutPage.jsx');
  const checkoutCode = fs.readFileSync(checkoutPath, 'utf8');

  const addressesPath = path.resolve(__dirname, '../../client/src/pages/AddressesPage.jsx');
  const addressesCode = fs.readFileSync(addressesPath, 'utf8');

  const supportPath = path.resolve(__dirname, '../../client/src/pages/SupportPage.jsx');
  const supportCode = fs.readFileSync(supportPath, 'utf8');

  const navbarPath = path.resolve(__dirname, '../../client/src/components/Navbar.jsx');
  const navbarCode = fs.readFileSync(navbarPath, 'utf8');

  const reviewModalPath = path.resolve(__dirname, '../../client/src/components/reviews/ReviewFormModal.jsx');
  const reviewModalCode = fs.readFileSync(reviewModalPath, 'utf8');

  // --------------------------------------------------------------------------
  // TEST 1: Checkout Address Selection Modal Accessibility
  // --------------------------------------------------------------------------
  await runTest('MODAL-01', 'CheckoutPage address modal provides dialog semantics and accessible title', () => {
    assert.match(checkoutCode, /role="dialog"/, 'Must specify role="dialog"');
    assert.match(checkoutCode, /aria-modal="true"/, 'Must specify aria-modal="true"');
    assert.match(checkoutCode, /aria-labelledby="address-selection-modal-title"/, 'Must specify aria-labelledby');
    assert.match(checkoutCode, /id="address-selection-modal-title"/, 'Heading must match aria-labelledby ID');
  });

  await runTest('MODAL-02', 'CheckoutPage address modal implements focus trap, Escape dismiss, and focus restoration', () => {
    assert.match(checkoutCode, /addressModalRef\s*=\s*useRef\(null\)/, 'Must declare addressModalRef');
    assert.match(checkoutCode, /document\.body\.style\.overflow\s*=\s*['"]hidden['"]/, 'Must prevent background scroll');
    assert.match(checkoutCode, /e\.key\s*===\s*['"]Escape['"][\s\S]*?setAddressModalOpen\(false\)/, 'Must handle Escape key dismissal');
    assert.match(checkoutCode, /e\.key\s*===\s*['"]Tab['"][\s\S]*?addressModalRef\.current/, 'Must trap keyboard Tab focus');
    assert.match(checkoutCode, /prevActiveElementRef\.current\.focus\(\)/, 'Must restore focus on unmount');
    assert.match(checkoutCode, /e\.target\s*===\s*e\.currentTarget[\s\S]*?setAddressModalOpen\(false\)/, 'Backdrop click must safely dismiss modal');
  });

  await runTest('MODAL-03', 'CheckoutPage address cards are keyboard-interactive controls', () => {
    assert.match(checkoutCode, /role="button"[\s\S]*?tabIndex=\{0\}[\s\S]*?onKeyDown=/, 'Address cards must have role="button", tabIndex=0, and onKeyDown');
    assert.match(checkoutCode, /e\.key\s*===\s*['"]Enter['"]\s*\|\|\s*e\.key\s*===\s*['"]\s['"]/, 'Address cards must support Enter and Space');
  });

  // --------------------------------------------------------------------------
  // TEST 2: AddressesPage Add/Edit Modal Accessibility
  // --------------------------------------------------------------------------
  await runTest('MODAL-04', 'AddressesPage Add/Edit modal provides dialog semantics and initial focus on name input', () => {
    assert.match(addressesCode, /role="dialog"[\s\S]*?aria-labelledby="address-form-modal-title"/, 'Must declare role="dialog" and aria-labelledby');
    assert.match(addressesCode, /id="address-form-modal-title"/, 'Title heading must match aria-labelledby');
    assert.match(addressesCode, /fullNameInputRef[\s\S]*?ref=\{fullNameInputRef\}/, 'Must bind ref to full name input for initial focus');
  });

  await runTest('MODAL-05', 'AddressesPage Add/Edit modal implements focus trap, safe Escape dismiss, and backdrop protection', () => {
    assert.match(addressesCode, /e\.key\s*===\s*['"]Escape['"][\s\S]*?!submitting[\s\S]*?handleCloseModal\(\)/, 'Must support Escape dismissal only when not submitting');
    assert.match(addressesCode, /e\.target\s*===\s*e\.currentTarget\s*&&\s*!submitting[\s\S]*?handleCloseModal\(\)/, 'Backdrop click must not close modal while submitting');
    assert.match(addressesCode, /e\.key\s*===\s*['"]Tab['"][\s\S]*?editModalRef\.current/, 'Must trap Tab focus inside editModalRef');
  });

  // --------------------------------------------------------------------------
  // TEST 3: AddressesPage Delete Confirmation Modal Accessibility
  // --------------------------------------------------------------------------
  await runTest('MODAL-06', 'AddressesPage Delete modal provides dialog semantics and initial focus on Cancel button', () => {
    assert.match(addressesCode, /role="dialog"[\s\S]*?aria-labelledby="delete-address-modal-title"/, 'Delete modal must declare role="dialog"');
    assert.match(addressesCode, /id="delete-address-modal-title"/, 'Delete modal title must match aria-labelledby');
    assert.match(addressesCode, /cancelDeleteBtnRef[\s\S]*?ref=\{cancelDeleteBtnRef\}/, 'Cancel button must receive initial focus');
  });

  await runTest('MODAL-07', 'AddressesPage Delete modal protects in-progress deletion against Escape and backdrop dismissal', () => {
    assert.match(addressesCode, /e\.key\s*===\s*['"]Escape['"][\s\S]*?!deleting[\s\S]*?setDeleteModalOpen\(false\)/, 'Must ignore Escape while deleting');
    assert.match(addressesCode, /e\.target\s*===\s*e\.currentTarget\s*&&\s*!deleting[\s\S]*?setDeleteModalOpen\(false\)/, 'Must ignore backdrop click while deleting');
    assert.match(addressesCode, /e\.key\s*===\s*['"]Tab['"][\s\S]*?deleteModalRef\.current/, 'Must trap Tab focus inside deleteModalRef');
  });

  // --------------------------------------------------------------------------
  // TEST 4: SupportPage Create Ticket Modal Accessibility
  // --------------------------------------------------------------------------
  await runTest('MODAL-08', 'SupportPage ticket modal provides dialog semantics, focus trap, and safe Escape dismiss', () => {
    assert.match(supportCode, /role="dialog"/, 'Support modal must specify role="dialog"');
    assert.match(supportCode, /aria-modal="true"/, 'Support modal must specify aria-modal="true"');
    assert.match(supportCode, /aria-labelledby="create-ticket-modal-title"/, 'Support modal must specify aria-labelledby');
    assert.match(supportCode, /subjectInputRef[\s\S]*?ref=\{subjectInputRef\}/, 'Subject input must receive initial focus');
    assert.match(supportCode, /e\.key\s*===\s*['"]Escape['"][\s\S]*?!submitting[\s\S]*?setIsModalOpen\(false\)/, 'Must support Escape dismissal only when not submitting');
    assert.match(supportCode, /e\.target\s*===\s*e\.currentTarget\s*&&\s*!submitting[\s\S]*?setIsModalOpen\(false\)/, 'Must ignore backdrop clicks while submitting');
    assert.match(supportCode, /e\.key\s*===\s*['"]Tab['"][\s\S]*?ticketModalRef\.current/, 'Must trap Tab focus inside ticketModalRef');
    assert.match(supportCode, /document\.body\.style\.overflow\s*=\s*['"]hidden['"]/, 'Must prevent background scroll');
  });

  // --------------------------------------------------------------------------
  // TEST 5: Regressions for Navbar & ReviewFormModal
  // --------------------------------------------------------------------------
  await runTest('REG-01', 'Navbar preserves accessible mobile drawer semantics and focus trap', () => {
    assert.match(navbarCode, /role="dialog"/, 'Navbar mobile drawer must have role="dialog"');
    assert.match(navbarCode, /aria-modal="true"/, 'Navbar mobile drawer must have aria-modal="true"');
    assert.match(navbarCode, /e\.key\s*===\s*['"]Escape['"][\s\S]*?setMobileMenuOpen\(false\)/, 'Navbar must support Escape key');
    assert.match(navbarCode, /menuButtonRef\.current\?\.focus\(\)/, 'Navbar must restore focus to hamburger trigger');
  });

  await runTest('REG-02', 'ReviewFormModal preserves accessible review dialog semantics and focus trap', () => {
    assert.match(reviewModalCode, /role="dialog"/, 'ReviewFormModal must have role="dialog"');
    assert.match(reviewModalCode, /aria-modal="true"/, 'ReviewFormModal must have aria-modal="true"');
    assert.match(reviewModalCode, /aria-labelledby="review-modal-title"/, 'ReviewFormModal must have aria-labelledby');
    assert.match(reviewModalCode, /e\.key\s*===\s*['"]Escape['"][\s\S]*?!loading[\s\S]*?onClose\(\)/, 'ReviewFormModal must ignore Escape while loading');
  });

  console.log('\n================================================================');
  console.log('   PHASE UI-3.3C TEST RESULTS SUMMARY                           ');
  console.log('================================================================');
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log(`TOTAL: ${results.length} | PASS: ${passed} | FAIL: ${failed}`);
  if (failed > 0) {
    process.exit(1);
  }
}

runSuite();
