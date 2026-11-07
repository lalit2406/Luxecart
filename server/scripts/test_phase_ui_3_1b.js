/**
 * LuxeCart Phase UI-3.1B Verification Test Suite
 *
 * Verifies:
 * 1. Guest coupon experience & unauthenticated safety
 * 2. Inactive variant filtering, active-only initial selection, and sold-out fallback
 * 3. Mobile navigation positioning, dialog semantics, Escape key handling, and focus containment
 * 4. Review modal dialog semantics, Escape key handling, focus trap, and focus restoration
 * 5. Catalog pagination scroll trigger and launch catalog SEO accuracy
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    Error: ${err.message}`);
  }
}

console.log('\n======================================================');
console.log('LuxeCart Phase UI-3.1B — Automated Verification Suite');
console.log('======================================================\n');

// ---------------------------------------------------------------------
// 1. Task 1: Guest Coupon Experience
// ---------------------------------------------------------------------
console.log('--- 1. Task 1: Guest Coupon Experience ---');

runTest('CartPage checks authentication before coupon API invocation', () => {
  const cartPageCode = fs.readFileSync(path.join(__dirname, '../../client/src/pages/CartPage.jsx'), 'utf8');

  // Verify useAuth is imported and used
  assert(cartPageCode.includes('import { useAuth }'), 'useAuth must be imported in CartPage');
  assert(cartPageCode.includes('const { isAuthenticated } = useAuth()'), 'CartPage must extract isAuthenticated');

  // Verify guard against unauthenticated coupon application
  assert(cartPageCode.includes('if (!isAuthenticated)'), 'CartPage must guard handleApplyCoupon with !isAuthenticated');
  assert(cartPageCode.includes('setGuestAuthRequired(true)'), 'CartPage must flag guestAuthRequired when unauthenticated');

  // Verify 401 error safety handling
  assert(cartPageCode.includes('err?.response?.status === 401'), 'CartPage must catch unexpected 401s and map to guest notice');
});

runTest('CartPage displays non-alarming guest sign-in banner with return location state', () => {
  const cartPageCode = fs.readFileSync(path.join(__dirname, '../../client/src/pages/CartPage.jsx'), 'utf8');

  assert(cartPageCode.includes('Please sign in to apply promotional vouchers.'), 'Must display standard non-alarming message');
  assert(cartPageCode.includes('to="/login"'), 'Must link to login');
  assert(cartPageCode.includes('state={{ from: location }}'), 'Must preserve cart location in route state');
});

// ---------------------------------------------------------------------
// 2. Task 2: Inactive Variant Integrity
// ---------------------------------------------------------------------
console.log('\n--- 2. Task 2: Inactive Variant Integrity ---');

runTest('ProductDetailPage filters active variants and excludes inactive ones (isActive !== false)', () => {
  const pdpCode = fs.readFileSync(path.join(__dirname, '../../client/src/pages/ProductDetailPage.jsx'), 'utf8');

  assert(pdpCode.includes('(v) => v.isActive !== false'), 'Must filter variants where isActive !== false');
  assert(pdpCode.includes('const activeVariants = useMemo(') || pdpCode.includes('const activeVariants = React.useMemo('), 'Must compute activeVariants via useMemo');
  assert(pdpCode.includes('const hasActiveVariants = activeVariants.length > 0'), 'Must track hasActiveVariants flag');
});

runTest('ProductDetailPage complies with React Rules of Hooks (all hooks unconditional before early returns)', () => {
  const pdpCode = fs.readFileSync(path.join(__dirname, '../../client/src/pages/ProductDetailPage.jsx'), 'utf8');

  const loadingReturnIndex = pdpCode.indexOf('if (loading)');
  assert(loadingReturnIndex !== -1, 'Must find if (loading) early return in ProductDetailPage');

  // Find all hook calls in ProductDetailPage component body
  const hookRegex = /\b(use[A-Z][a-zA-Z0-9]*)\s*\(/g;
  let match;
  while ((match = hookRegex.exec(pdpCode)) !== null) {
    const hookName = match[1];
    const hookPos = match.index;
    if (hookPos > loadingReturnIndex) {
      assert.fail(`Hook "${hookName}" at index ${hookPos} was called after "if (loading)" at index ${loadingReturnIndex}, violating React Rules of Hooks.`);
    }
  }
});

runTest('Variant initial selection and color/size handlers only match active variants', () => {
  const pdpCode = fs.readFileSync(path.join(__dirname, '../../client/src/pages/ProductDetailPage.jsx'), 'utf8');

  // Initial variant selection in fetchProduct
  assert(pdpCode.includes('const activeVars = (prod?.variants || []).filter((v) => v.isActive !== false)'), 'fetchProduct must filter active variants');
  assert(pdpCode.includes('const initialVariant = activeVars.find'), 'initialVariant must be selected from activeVars');

  // Color and size selection
  assert(pdpCode.includes('activeVariants.find'), 'handleColorSelect and handleSizeSelect must search activeVariants');
  assert(pdpCode.includes('new Set(activeVariants.map'), 'Available colors and sizes must be generated from activeVariants');
});

runTest('Products with no active variants disable purchase actions and show unavailable state', () => {
  const pdpCode = fs.readFileSync(path.join(__dirname, '../../client/src/pages/ProductDetailPage.jsx'), 'utf8');

  assert(pdpCode.includes('!hasActiveVariants'), 'Must check !hasActiveVariants for unavailable status');
  assert(pdpCode.includes('Currently Unavailable'), 'Must display "Currently Unavailable" when no active variants exist');
  assert(pdpCode.includes('disabled={!hasActiveVariants || isOutOfStock'), 'Add to bag button must be disabled when !hasActiveVariants');
});

// Simulate variant filtering logic
runTest('Simulated variant filter correctly excludes inactive variants and finds first in-stock active', () => {
  const mockVariants = [
    { _id: 'v1', isActive: false, inventory: { stock: 10 }, attributes: { color: { name: 'Black', hex: '#000' }, size: 'M' } },
    { _id: 'v2', isActive: true, inventory: { stock: 0 }, attributes: { color: { name: 'Black', hex: '#000' }, size: 'L' } },
    { _id: 'v3', isActive: true, inventory: { stock: 5 }, attributes: { color: { name: 'Ivory', hex: '#fff' }, size: 'M' } },
    { _id: 'v4', isActive: false, inventory: { stock: 20 }, attributes: { color: { name: 'Gold', hex: '#gold' }, size: 'S' } },
  ];

  const active = mockVariants.filter((v) => v.isActive !== false);
  assert.strictEqual(active.length, 2, 'Should have exactly 2 active variants');
  assert.strictEqual(active[0]._id, 'v2');
  assert.strictEqual(active[1]._id, 'v3');

  const initialVariant = active.find((v) => (v.inventory?.stock || 0) > 0) || active[0];
  assert.strictEqual(initialVariant._id, 'v3', 'Initial variant must skip inactive v1 and out-of-stock v2, selecting active v3');

  const availableColors = Array.from(new Set(active.map((v) => v.attributes?.color?.name)));
  assert.deepStrictEqual(availableColors, ['Black', 'Ivory'], 'Colors must not include Gold from inactive variant');
});

// ---------------------------------------------------------------------
// 3. Task 3: Mobile Navigation Positioning & Accessibility
// ---------------------------------------------------------------------
console.log('\n--- 3. Task 3: Mobile Navigation Positioning & Accessibility ---');

runTest('Navbar eliminates hardcoded pixel offsets and calculates position dynamically', () => {
  const navbarCode = fs.readFileSync(path.join(__dirname, '../../client/src/components/Navbar.jsx'), 'utf8');

  assert(!navbarCode.includes('top-[105px]'), 'Must not contain hardcoded top-[105px]');
  assert(!navbarCode.includes('top-[121px]'), 'Must not contain hardcoded top-[121px]');
  assert(navbarCode.includes('headerRef.current.getBoundingClientRect().bottom'), 'Must dynamically calculate header bottom offset');
  assert(navbarCode.includes('drawerTop !== null ? `${drawerTop}px`'), 'Must apply dynamic drawerTop style');
});

runTest('Navbar implements Escape key handling, focus trap, and focus restoration', () => {
  const navbarCode = fs.readFileSync(path.join(__dirname, '../../client/src/components/Navbar.jsx'), 'utf8');

  assert(navbarCode.includes("e.key === 'Escape'"), 'Must handle Escape key to close mobile drawer');
  assert(navbarCode.includes("e.key === 'Tab'"), 'Must handle Tab key to trap focus inside drawer');
  assert(navbarCode.includes('menuButtonRef.current?.focus()'), 'Must restore focus to menu trigger button on close');
  assert(navbarCode.includes("document.body.style.overflow = 'hidden'"), 'Must lock body scroll while drawer is open');
});

runTest('Navbar contains accessible dialog semantics on trigger and drawer', () => {
  const navbarCode = fs.readFileSync(path.join(__dirname, '../../client/src/components/Navbar.jsx'), 'utf8');

  assert(navbarCode.includes('role="dialog"'), 'Drawer must have role="dialog"');
  assert(navbarCode.includes('aria-modal="true"'), 'Drawer must have aria-modal="true"');
  assert(navbarCode.includes('aria-label="Navigation Menu"'), 'Drawer must have accessible aria-label');
  assert(navbarCode.includes('aria-controls="mobile-navigation-drawer"'), 'Trigger button must have aria-controls');
  assert(navbarCode.includes('aria-expanded={mobileMenuOpen}'), 'Trigger button must reflect aria-expanded');
});

// ---------------------------------------------------------------------
// 4. Task 4: Review Modal Accessibility
// ---------------------------------------------------------------------
console.log('\n--- 4. Task 4: Review Modal Accessibility ---');

runTest('ReviewFormModal contains dialog semantics, focus trap, and Escape key handling', () => {
  const modalCode = fs.readFileSync(path.join(__dirname, '../../client/src/components/reviews/ReviewFormModal.jsx'), 'utf8');

  assert(modalCode.includes('role="dialog"'), 'Modal must have role="dialog"');
  assert(modalCode.includes('aria-modal="true"'), 'Modal must have aria-modal="true"');
  assert(modalCode.includes('aria-labelledby="review-modal-title"'), 'Modal must link title with aria-labelledby');
  assert(modalCode.includes('aria-describedby="review-modal-desc"'), 'Modal must link description with aria-describedby');
  assert(modalCode.includes("e.key === 'Escape'"), 'Modal must close on Escape key');
  assert(modalCode.includes("e.key === 'Tab'"), 'Modal must trap focus inside focusables');
  assert(modalCode.includes('prevActiveElementRef.current') && modalCode.includes('focus()'), 'Must restore focus on close');
  assert(modalCode.includes("document.body.style.overflow = 'hidden'"), 'Must lock body scroll while modal is open');
});

// ---------------------------------------------------------------------
// 5. Task 5: Catalog Polish & SEO
// ---------------------------------------------------------------------
console.log('\n--- 5. Task 5: Catalog Polish & SEO ---');

runTest('ShopPage attaches grid ref and scrolls smoothly on pagination page changes', () => {
  const shopCode = fs.readFileSync(path.join(__dirname, '../../client/src/pages/ShopPage.jsx'), 'utf8');

  assert(shopCode.includes('const gridContainerRef = useRef(null)'), 'Must define gridContainerRef');
  assert(shopCode.includes('const isInitialMount = useRef(true)'), 'Must track initial mount to avoid unwanted scroll on initial load');
  assert(shopCode.includes('gridContainerRef.current.scrollIntoView'), 'Must call scrollIntoView on gridContainerRef');
  assert(shopCode.includes("behavior: 'smooth'"), 'Must use smooth scroll behavior');
  assert(shopCode.includes('ref={gridContainerRef}'), 'Must attach ref to product grid container');
});

runTest('SEO descriptions match LuxeCart launch catalog without stale timepiece/horology references', () => {
  const shopCode = fs.readFileSync(path.join(__dirname, '../../client/src/pages/ShopPage.jsx'), 'utf8');

  assert(!shopCode.toLowerCase().includes('timepiece'), 'ShopPage must not mention timepieces');
  assert(!shopCode.toLowerCase().includes('horology'), 'ShopPage must not mention horology');
  assert(shopCode.includes('artisanal footwear') || shopCode.includes('handcrafted footwear'), 'ShopPage must mention footwear');
});

// ---------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------
console.log('\n------------------------------------------------------');
console.log(`Results: ${passedTests}/${totalTests} tests passed.`);
console.log('------------------------------------------------------\n');

if (passedTests !== totalTests) {
  process.exit(1);
} else {
  process.exit(0);
}
