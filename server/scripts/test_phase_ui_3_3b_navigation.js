/**
 * LuxeCart Phase UI-3.3B Test Suite: Navigation Continuity Improvements
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getSafeRedirectPath } from '../../client/src/utils/navigation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('================================================================');
console.log('   LUXECART PHASE UI-3.3B NAVIGATION CONTINUITY TEST SUITE       ');
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
  const wishlistPath = path.resolve(__dirname, '../../client/src/pages/WishlistPage.jsx');
  const wishlistCode = fs.readFileSync(wishlistPath, 'utf8');

  const checkoutPath = path.resolve(__dirname, '../../client/src/pages/CheckoutPage.jsx');
  const checkoutCode = fs.readFileSync(checkoutPath, 'utf8');

  const addressesPath = path.resolve(__dirname, '../../client/src/pages/AddressesPage.jsx');
  const addressesCode = fs.readFileSync(addressesPath, 'utf8');

  const addressContextPath = path.resolve(__dirname, '../../client/src/features/addresses/context/AddressContext.jsx');
  const addressContextCode = fs.readFileSync(addressContextPath, 'utf8');

  // --------------------------------------------------------------------------
  // TEST 1: Guest wishlist login preserves /wishlist as return destination
  // --------------------------------------------------------------------------
  await runTest('NAV-01', 'Guest wishlist login preserves /wishlist location state to login route', () => {
    assert.match(wishlistCode, /useLocation/, 'WishlistPage must import and use useLocation');
    assert.match(wishlistCode, /const\s+location\s*=\s*useLocation\(\)/, 'WishlistPage must initialize location');
    assert.match(
      wishlistCode,
      /<Link[\s\S]*?to="\/login"[\s\S]*?state=\{\{\s*from:\s*location\s*\}\}[\s\S]*?>[\s\S]*?Sign In to Wishlist[\s\S]*?<\/Link>/,
      'Wishlist sign-in link must pass state={{ from: location }}'
    );
  });

  // --------------------------------------------------------------------------
  // TEST 2: Existing safe redirect logic remains effective
  // --------------------------------------------------------------------------
  await runTest('NAV-02', 'getSafeRedirectPath safely resolves /wishlist location object and rejects external URLs', () => {
    // Location object simulation
    const wishlistLocation = { pathname: '/wishlist', search: '', hash: '' };
    assert.strictEqual(getSafeRedirectPath(wishlistLocation), '/wishlist');

    // Return to checkout simulation
    assert.strictEqual(getSafeRedirectPath('/checkout'), '/checkout');
    assert.strictEqual(getSafeRedirectPath({ pathname: '/checkout' }), '/checkout');

    // Open redirect attempts
    assert.strictEqual(getSafeRedirectPath('https://evil-site.com', null), null);
    assert.strictEqual(getSafeRedirectPath('//attacker.com/checkout', null), null);
    assert.strictEqual(getSafeRedirectPath('/\\attacker.com/checkout', null), null);
    assert.strictEqual(getSafeRedirectPath('javascript:alert(1)', null), null);
  });

  // --------------------------------------------------------------------------
  // TEST 3: Entering address management from checkout preserves return context
  // --------------------------------------------------------------------------
  await runTest('NAV-03', 'CheckoutPage passes state={{ returnTo: "/checkout" }} when linking to address management', () => {
    const matches = checkoutCode.match(/to="\/account\/addresses"[\s\S]*?state=\{\{\s*returnTo:\s*['"]\/checkout['"]\s*\}\}/g);
    assert.ok(matches && matches.length >= 2, 'CheckoutPage must pass state={{ returnTo: "/checkout" }} on address links');
  });

  // --------------------------------------------------------------------------
  // TEST 4: The return action appears only when appropriate
  // --------------------------------------------------------------------------
  await runTest('NAV-04', 'AddressesPage validates return destination and conditionally renders Return to Checkout', () => {
    assert.match(addressesCode, /getSafeRedirectPath/, 'AddressesPage must import and use getSafeRedirectPath');
    assert.match(addressesCode, /isFromCheckout/, 'AddressesPage must evaluate isFromCheckout conditionally');
    assert.match(addressesCode, /Return to Checkout/, 'AddressesPage must contain Return to Checkout action text');

    // Simulate validation logic
    const safeDirectVisit = getSafeRedirectPath(undefined, null);
    const isDirectFromCheckout = safeDirectVisit === '/checkout';
    assert.strictEqual(isDirectFromCheckout, false, 'Direct visit must NOT qualify as from checkout');

    const safeCheckoutVisit = getSafeRedirectPath('/checkout', null);
    const isCheckoutFromCheckout = safeCheckoutVisit === '/checkout' || safeCheckoutVisit?.startsWith('/checkout');
    assert.strictEqual(isCheckoutFromCheckout, true, 'Visit with /checkout returnTo MUST qualify as from checkout');

    const safeEvilVisit = getSafeRedirectPath('https://malicious.com', null);
    const isEvilFromCheckout = safeEvilVisit === '/checkout';
    assert.strictEqual(isEvilFromCheckout, false, 'Malicious external target must NOT qualify as from checkout');
  });

  // --------------------------------------------------------------------------
  // TEST 5: A newly saved address remains available on returning to checkout
  // --------------------------------------------------------------------------
  await runTest('NAV-05', 'AddressContext and CheckoutPage preserve newly created/selected address across navigation', () => {
    // Verify AddressContext updates setSelectedAddressId upon addAddress
    assert.match(
      addressContextCode,
      /setSelectedAddressId\(created\._id\s*\|\|\s*created\.id\)/,
      'addAddress in AddressContext must select newly created address'
    );
    // Verify AddressContext preserves previous selection during fetchAddresses
    assert.match(
      addressContextCode,
      /setSelectedAddressId\(\(prev\)[\s\S]*?list\.some[\s\S]*?return prev/,
      'fetchAddresses must preserve existing selection if still present in list'
    );
    // Verify CheckoutPage listens to location.state.selectedAddressId
    assert.match(
      checkoutCode,
      /location\.state\?\.selectedAddressId[\s\S]*?selectAddress\(location\.state\.selectedAddressId\)/,
      'CheckoutPage must select address specified in navigation state'
    );
  });

  // --------------------------------------------------------------------------
  // TEST 6: Normal address-management navigation is unchanged
  // --------------------------------------------------------------------------
  await runTest('NAV-06', 'AddressesPage preserves independent address management when no checkout context is present', () => {
    // Normal visit has no rawReturnTo, so safeReturnPath is null and isFromCheckout is false
    assert.match(addressesCode, /rawReturnTo\s*\?\s*getSafeRedirectPath\(rawReturnTo,\s*null\)\s*:\s*null/);
    assert.match(addressesCode, /\{isFromCheckout\s*&&/);
  });

  console.log('\n================================================================');
  console.log('   PHASE UI-3.3B TEST RESULTS SUMMARY                           ');
  console.log('================================================================');
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log(`TOTAL: ${results.length} | PASS: ${passed} | FAIL: ${failed}`);
  if (failed > 0) {
    process.exit(1);
  }
}

runSuite();
