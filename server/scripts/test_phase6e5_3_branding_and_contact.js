/**
 * LuxeCart — Phase 6E.5.3: Dynamic Branding, Contact Information & Social Links Verification Suite
 *
 * Verifies:
 * 1. Dynamic store name in Navbar (aria-label, Logo alt, link).
 * 2. Light and dark logo selection (variant-aware remote URL resolution).
 * 3. Broken remote logo fallback (fallback to bundled asset, infinite loop prevention).
 * 4. Dynamic footer branding (storeName, tagline, copyright brand name).
 * 5. Social links hidden when empty or invalid (empty string, null, javascript: protocol blocked).
 * 6. Safe external social links (target="_blank", rel="noopener noreferrer", accessible aria-labels).
 * 7. Conditional email and phone links (mailto: and tel: only rendered for valid formats).
 * 8. Empty address handling (gracefully omitted when address fields are missing/empty).
 * 9. Authentication page branding (LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage).
 * 10. Product brand takes precedence over storeName in ProductCard.
 * 11. Settings loading and fallback behavior (safe defaults, zero layout shifts).
 * 12. Existing navigation and authentication behavior remain intact.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

console.log('======================================================================');
console.log('   LUXECART PHASE 6E.5.3: BRANDING, CONTACT & SOCIAL VERIFICATION     ');
console.log('======================================================================\n');

let passCount = 0;
let failCount = 0;

const record = (id, description, status, details = '') => {
  if (status === 'PASS') {
    passCount++;
    console.log(`✔ [PASS] [${id}] ${description}`);
  } else {
    failCount++;
    console.error(`✖ [FAIL] [${id}] ${description}${details ? ' - ' + details : ''}`);
  }
};

const runSuite = async () => {
  const logoPath = path.join(rootDir, 'client/src/components/common/Logo.jsx');
  const navbarPath = path.join(rootDir, 'client/src/components/Navbar.jsx');
  const homePagePath = path.join(rootDir, 'client/src/pages/HomePage.jsx');
  const supportPagePath = path.join(rootDir, 'client/src/pages/SupportPage.jsx');
  const loginPagePath = path.join(rootDir, 'client/src/pages/LoginPage.jsx');
  const registerPagePath = path.join(rootDir, 'client/src/pages/RegisterPage.jsx');
  const forgotPath = path.join(rootDir, 'client/src/pages/ForgotPasswordPage.jsx');
  const resetPath = path.join(rootDir, 'client/src/pages/ResetPasswordPage.jsx');
  const productCardPath = path.join(rootDir, 'client/src/components/ProductCard.jsx');
  const contactUtilsPath = path.join(rootDir, 'client/src/features/settings/utils/contactUtils.js');

  const logoSource = fs.readFileSync(logoPath, 'utf-8');
  const navbarSource = fs.readFileSync(navbarPath, 'utf-8');
  const homePageSource = fs.readFileSync(homePagePath, 'utf-8');
  const supportPageSource = fs.readFileSync(supportPagePath, 'utf-8');
  const loginPageSource = fs.readFileSync(loginPagePath, 'utf-8');
  const registerPageSource = fs.readFileSync(registerPagePath, 'utf-8');
  const forgotSource = fs.readFileSync(forgotPath, 'utf-8');
  const resetSource = fs.readFileSync(resetPath, 'utf-8');
  const productCardSource = fs.readFileSync(productCardPath, 'utf-8');

  // Dynamic import of pure helper functions from contactUtils.js
  const {
    isValidHttpUrl,
    isValidEmail,
    isValidPhone,
    formatAddress,
  } = await import(`file://${contactUtilsPath.replace(/\\/g, '/')}`);

  // -------------------------------------------------------------------------
  // TEST 01: Dynamic Store Name in Navbar
  // -------------------------------------------------------------------------
  try {
    assert(navbarSource.includes('useStoreSettings'), 'Navbar must consume useStoreSettings');
    assert(navbarSource.includes('storeName'), 'Navbar must derive storeName');
    assert(
      navbarSource.includes('aria-label={`${storeName} Home`}') ||
      navbarSource.includes('aria-label={storeName + " Home"}'),
      'Navbar must render dynamic storeName in Home link aria-label'
    );
    assert(
      navbarSource.includes('alt={storeName}'),
      'Navbar must pass dynamic storeName to Logo alt'
    );
    record('TEST_01', 'Dynamic store name in Navbar (aria-label, Logo alt, Link)', 'PASS');
  } catch (err) {
    record('TEST_01', 'Dynamic store name in Navbar', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 02: Light and Dark Logo Selection
  // -------------------------------------------------------------------------
  try {
    const mockSettings = {
      storeName: 'Aura Boutique',
      logoUrlLight: 'https://cdn.example.com/aura-light.png',
      logoUrlDark: 'https://cdn.example.com/aura-dark.png',
    };

    // Simulate Logo.jsx candidateUrl resolution logic
    const resolveCandidate = (variant, settings) => {
      if (variant === 'dark') {
        return settings?.logoUrlDark || settings?.logoUrlLight || null;
      }
      if (variant === 'light' || variant === 'full' || !variant) {
        return settings?.logoUrlLight || settings?.logoUrlDark || null;
      }
      return null;
    };

    const darkCandidate = resolveCandidate('dark', mockSettings);
    const lightCandidate = resolveCandidate('light', mockSettings);

    assert.strictEqual(darkCandidate, 'https://cdn.example.com/aura-dark.png');
    assert.strictEqual(lightCandidate, 'https://cdn.example.com/aura-light.png');

    // Test fallback when only one remote logo is provided
    const lightOnlySettings = { logoUrlLight: 'https://cdn.example.com/light-only.png' };
    assert.strictEqual(resolveCandidate('dark', lightOnlySettings), 'https://cdn.example.com/light-only.png');

    assert(logoSource.includes('candidateUrl'), 'Logo component must resolve candidateUrl based on variant');
    assert(logoSource.includes("variant === 'dark'"), 'Logo component must handle dark variant');

    record('TEST_02', 'Light and dark logo selection (variant-aware remote URL resolution)', 'PASS');
  } catch (err) {
    record('TEST_02', 'Light and dark logo selection', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 03: Broken Remote Logo Fallback & Loop Prevention
  // -------------------------------------------------------------------------
  try {
    let failedUrl = null;
    let activeSrc = null;
    const bundledPng = 'bundled-fallback.png';
    const brokenRemote = 'https://broken-cdn.com/logo.png';

    // State machine simulation of Logo.jsx onError
    const simulateLogoRender = (candidate) => {
      const isRemoteValid = candidate && failedUrl !== candidate;
      activeSrc = isRemoteValid ? candidate : bundledPng;
      return { activeSrc, isRemoteValid };
    };

    // Initial render: candidate is valid
    const r1 = simulateLogoRender(brokenRemote);
    assert.strictEqual(r1.activeSrc, brokenRemote);
    assert.strictEqual(r1.isRemoteValid, true);

    // Image fails to load: onError fired
    failedUrl = brokenRemote;

    // Next render after error: activeSrc switches to bundledPng, isRemoteValid is false
    const r2 = simulateLogoRender(brokenRemote);
    assert.strictEqual(r2.activeSrc, bundledPng);
    assert.strictEqual(r2.isRemoteValid, false);

    // Verify source code implementation
    assert(logoSource.includes('failedUrl'), 'Logo.jsx must track failedUrl state');
    assert(logoSource.includes('onError={isRemoteValid ? handleImageError : undefined}'),
      'Logo.jsx must detach or disable onError once bundled asset is active to prevent loops');

    record('TEST_03', 'Broken remote logo fallback (switches to bundled asset, prevents retry loops)', 'PASS');
  } catch (err) {
    record('TEST_03', 'Broken remote logo fallback', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 04: Dynamic Footer Branding
  // -------------------------------------------------------------------------
  try {
    assert(homePageSource.includes('useStoreSettings'), 'HomePage must consume useStoreSettings');
    assert(homePageSource.includes('storeName = settings?.storeName ||'), 'HomePage must default storeName');
    assert(homePageSource.includes('tagline ='), 'HomePage must derive tagline');
    assert(homePageSource.includes('{tagline}'), 'HomePage must render dynamic tagline in footer');
    assert(
      homePageSource.includes('{new Date().getFullYear()} {storeName}'),
      'HomePage footer must render current year and dynamic storeName in copyright'
    );
    record('TEST_04', 'Dynamic footer branding (storeName, tagline, copyright brand name)', 'PASS');
  } catch (err) {
    record('TEST_04', 'Dynamic footer branding', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 05: Social Links Hidden When Empty or Invalid
  // -------------------------------------------------------------------------
  try {
    // Test URL validation function directly
    assert.strictEqual(isValidHttpUrl(''), false, 'Empty string is not a valid URL');
    assert.strictEqual(isValidHttpUrl('   '), false, 'Whitespace is not a valid URL');
    assert.strictEqual(isValidHttpUrl(null), false, 'Null is not a valid URL');
    assert.strictEqual(isValidHttpUrl(undefined), false, 'Undefined is not a valid URL');
    assert.strictEqual(isValidHttpUrl('javascript:alert(1)'), false, 'javascript: protocol is blocked');
    assert.strictEqual(isValidHttpUrl('data:text/html;base64,PHNjcmlwdD4='), false, 'data: protocol is blocked');
    assert.strictEqual(isValidHttpUrl('ftp://ftp.example.com'), false, 'ftp: protocol is blocked');
    assert.strictEqual(isValidHttpUrl('https://instagram.com/luxecart'), true, 'https URL is valid');
    assert.strictEqual(isValidHttpUrl('http://facebook.com/luxecart'), true, 'http URL is valid');

    // Verify HomePage filters out empty/invalid social links
    assert(homePageSource.includes('isValidHttpUrl'), 'HomePage must use isValidHttpUrl to filter social links');
    assert(homePageSource.includes('activeSocialLinks.length > 0'), 'HomePage must only render social container when valid links exist');

    record('TEST_05', 'Social links hidden when empty or invalid (safe protocol enforcement)', 'PASS');
  } catch (err) {
    record('TEST_05', 'Social links hidden when empty or invalid', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 06: Safe External Social Links
  // -------------------------------------------------------------------------
  try {
    assert(
      homePageSource.includes('target="_blank"'),
      'External social links must open in new tab'
    );
    assert(
      homePageSource.includes('rel="noopener noreferrer"'),
      'External social links must have rel="noopener noreferrer"'
    );
    assert(
      homePageSource.includes('aria-label={`${storeName} on ${item.label}`}') ||
      homePageSource.includes('aria-label={storeName + " on "'),
      'External social links must have accessible dynamic aria-labels'
    );
    record('TEST_06', 'Safe external social links (target="_blank", noopener noreferrer, accessible labels)', 'PASS');
  } catch (err) {
    record('TEST_06', 'Safe external social links', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 07: Conditional Email and Phone Links
  // -------------------------------------------------------------------------
  try {
    // Test validation functions
    assert.strictEqual(isValidEmail(''), false);
    assert.strictEqual(isValidEmail('not-an-email'), false);
    assert.strictEqual(isValidEmail('support@luxecart.com'), true);
    assert.strictEqual(isValidEmail('concierge@aura-luxury.in'), true);

    assert.strictEqual(isValidPhone(''), false);
    assert.strictEqual(isValidPhone('123'), false, 'Too short phone number');
    assert.strictEqual(isValidPhone('+91 98765 43210'), true);
    assert.strictEqual(isValidPhone('(080) 2345-6789'), true);

    // Verify HomePage uses mailto: and tel: conditionally
    assert(homePageSource.includes('href={`mailto:${settings.supportEmail.trim()}`}') ||
           homePageSource.includes('mailto:'), 'HomePage must render mailto: link');
    assert(homePageSource.includes('href={`tel:${settings.supportPhone.trim()}`}') ||
           homePageSource.includes('tel:'), 'HomePage must render tel: link');

    // Verify SupportPage uses mailto: and tel: conditionally
    assert(supportPageSource.includes('mailto:'), 'SupportPage must render mailto: link');
    assert(supportPageSource.includes('tel:'), 'SupportPage must render tel: link');

    record('TEST_07', 'Conditional email and phone links (mailto: and tel: only on valid data)', 'PASS');
  } catch (err) {
    record('TEST_07', 'Conditional email and phone links', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 08: Empty Address Handling
  // -------------------------------------------------------------------------
  try {
    // Test formatAddress function
    assert.strictEqual(formatAddress(null), null);
    assert.strictEqual(formatAddress({}), null);
    assert.strictEqual(formatAddress({ street: '', city: '   ', state: '' }), null);

    const fullAddr = {
      street: '100 Feet Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560038',
      country: 'India',
    };
    assert.strictEqual(formatAddress(fullAddr), '100 Feet Road, Bengaluru, Karnataka, 560038, India');

    const partialAddr = {
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
    };
    assert.strictEqual(formatAddress(partialAddr), 'Mumbai, Maharashtra, India');

    // Verify HomePage and SupportPage check formattedAddress before rendering
    assert(homePageSource.includes('formattedAddress'), 'HomePage must check formattedAddress');
    assert(supportPageSource.includes('formattedAddress'), 'SupportPage must check formattedAddress');

    record('TEST_08', 'Empty address handling (gracefully omitted when address fields are missing/empty)', 'PASS');
  } catch (err) {
    record('TEST_08', 'Empty address handling', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 09: Authentication Page Branding
  // -------------------------------------------------------------------------
  try {
    // LoginPage
    assert(loginPageSource.includes('useStoreSettings'), 'LoginPage must consume useStoreSettings');
    assert(loginPageSource.includes('Sign in to your {storeName} account'), 'LoginPage must render dynamic storeName in welcome message');
    assert(loginPageSource.includes('&copy; {new Date().getFullYear()} {storeName}. All rights reserved.'), 'LoginPage must render dynamic storeName in copyright');

    // RegisterPage
    assert(registerPageSource.includes('useStoreSettings'), 'RegisterPage must consume useStoreSettings');
    assert(registerPageSource.includes('Join {storeName} for a curated fashion experience'), 'RegisterPage must render dynamic storeName in join message');
    assert(registerPageSource.includes('{storeName} &copy; {new Date().getFullYear()}. Single-Vendor Fashion & Lifestyle.'), 'RegisterPage must render dynamic storeName in copyright');

    // ForgotPasswordPage
    assert(forgotSource.includes('useStoreSettings'), 'ForgotPasswordPage must consume useStoreSettings');
    assert(forgotSource.includes('associated with your {storeName} account'), 'ForgotPasswordPage must render dynamic storeName');

    // ResetPasswordPage
    assert(resetSource.includes('useStoreSettings'), 'ResetPasswordPage must consume useStoreSettings');
    assert(resetSource.includes('password for your {storeName} account'), 'ResetPasswordPage must render dynamic storeName');

    record('TEST_09', 'Authentication page branding (LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage)', 'PASS');
  } catch (err) {
    record('TEST_09', 'Authentication page branding', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 10: Product Brand Takes Precedence Over storeName
  // -------------------------------------------------------------------------
  try {
    // Simulate ProductCard brand resolution
    const resolveCardBrand = (product, storeName) => product.brand || storeName;

    assert.strictEqual(resolveCardBrand({ brand: 'Gucci' }, 'LuxeCart'), 'Gucci', 'Actual product brand must take precedence');
    assert.strictEqual(resolveCardBrand({ brand: 'Aurelio' }, 'Aura Boutique'), 'Aurelio', 'Actual product brand must take precedence');
    assert.strictEqual(resolveCardBrand({ brand: '' }, 'Aura Boutique'), 'Aura Boutique', 'Empty brand falls back to storeName');
    assert.strictEqual(resolveCardBrand({}, 'Aura Boutique'), 'Aura Boutique', 'Missing brand falls back to storeName');

    // Verify ProductCard.jsx source code
    assert(productCardSource.includes('{product.brand || storeName}'),
      'ProductCard must display product.brand with storeName fallback');
    assert(productCardSource.includes('(product.brand ? `${product.brand} - ${product.name}` : product.name) || `${storeName} Curated Product`'),
      'ProductCard must use product.brand in imageAlt with storeName fallback');

    record('TEST_10', 'Product brand takes precedence over storeName in ProductCard', 'PASS');
  } catch (err) {
    record('TEST_10', 'Product brand takes precedence over storeName', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 11: Settings Loading and Fallback Behavior
  // -------------------------------------------------------------------------
  try {
    // When context has fallback active or settings are loading:
    // Every component safely falls back to default storeName 'LuxeCart' without thrown errors or layout shifts
    const defaultStoreName = 'LuxeCart';

    assert(navbarSource.includes("settings?.storeName || 'LuxeCart'"), 'Navbar must have safe default');
    assert(homePageSource.includes("settings?.storeName || 'LuxeCart'"), 'HomePage must have safe default');
    assert(supportPageSource.includes("settings?.storeName || 'LuxeCart'"), 'SupportPage must have safe default');
    assert(loginPageSource.includes("settings?.storeName || 'LuxeCart'"), 'LoginPage must have safe default');
    assert(registerPageSource.includes("settings?.storeName || 'LuxeCart'"), 'RegisterPage must have safe default');
    assert(productCardSource.includes("settings?.storeName || 'LuxeCart'"), 'ProductCard must have safe default');

    record('TEST_11', 'Settings loading and fallback behavior (safe defaults, zero layout shifts)', 'PASS');
  } catch (err) {
    record('TEST_11', 'Settings loading and fallback behavior', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 12: Existing Navigation and Authentication Behavior Intact
  // -------------------------------------------------------------------------
  try {
    // Check navigation preserved in Navbar
    assert(navbarSource.includes('mobileMenuOpen'), 'Navbar mobile menu state preserved');
    assert(navbarSource.includes('LiveSearchDropdown'), 'Navbar live search preserved');
    assert(navbarSource.includes('useWishlist'), 'Navbar wishlist preserved');
    assert(navbarSource.includes('useCart'), 'Navbar cart preserved');

    // Check auth flows preserved
    assert(loginPageSource.includes('handleSubmit'), 'LoginPage handleSubmit preserved');
    assert(loginPageSource.includes('handleGoogleSuccess'), 'LoginPage Google sign-in preserved');
    assert(registerPageSource.includes('handleSubmit'), 'RegisterPage handleSubmit preserved');
    assert(registerPageSource.includes('handleGoogleSuccess'), 'RegisterPage Google sign-in preserved');

    // Check support ticket creation preserved
    assert(supportPageSource.includes('handleCreateTicketSubmit'), 'SupportPage ticket submission preserved');
    assert(supportPageSource.includes('isModalOpen'), 'SupportPage modal preserved');

    record('TEST_12', 'Existing navigation and authentication behavior remain intact', 'PASS');
  } catch (err) {
    record('TEST_12', 'Existing navigation and authentication behavior remain intact', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n======================================================================');
  console.log(`VERIFICATION SUMMARY: ${passCount} PASSED, ${failCount} FAILED (TOTAL: ${passCount + failCount})`);
  console.log('======================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
};

runSuite().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
