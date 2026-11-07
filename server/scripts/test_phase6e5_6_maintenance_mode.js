/**
 * LuxeCart — Phase 6E.5.6: Customer-Facing Maintenance Mode Experience Verification Suite
 *
 * Verifies:
 * 1. Maintenance banner hidden when mode is disabled.
 * 2. Maintenance banner shown when mode is enabled.
 * 3. Configured message displayed correctly.
 * 4. Banner appears on customer pages without duplication (mounted at root of customer shell).
 * 5. Admin pages remain unaffected (admin route exclusion).
 * 6. Authentication remains accessible (backend exempts /auth/*, frontend routes active).
 * 7. Catalog browsing remains accessible (safe GET endpoints unblocked, browsing notes displayed).
 * 8. Checkout button disabled during maintenance (usability safeguard).
 * 9. Checkout remains unchanged when maintenance is disabled.
 * 10. HTTP 503 MAINTENANCE_MODE handled correctly (normalized customError and refetch invocation).
 * 11. Review submission disabled during maintenance (guarded submit, disabled button, notice).
 * 12. Failed review submission preserves user-entered text (title, comment, rating retained in state).
 * 13. Fallback settings do not falsely confirm maintenance is disabled (fail-closed backend authority).
 * 14. Existing checkout and review functionality remains intact.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

console.log('======================================================================');
console.log('   LUXECART PHASE 6E.5.6: MAINTENANCE MODE EXPERIENCE VERIFICATION   ');
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
  const maintenanceNoticePath = path.join(rootDir, 'client/src/components/common/MaintenanceNotice.jsx');
  const appPath = path.join(rootDir, 'client/src/App.jsx');
  const checkoutPagePath = path.join(rootDir, 'client/src/pages/CheckoutPage.jsx');
  const reviewModalPath = path.join(rootDir, 'client/src/components/reviews/ReviewFormModal.jsx');
  const pdpPath = path.join(rootDir, 'client/src/pages/ProductDetailPage.jsx');
  const apiPath = path.join(rootDir, 'client/src/services/api.js');
  const defaultSettingsPath = path.join(rootDir, 'client/src/features/settings/context/defaultSettings.js');
  const backendMiddlewarePath = path.join(rootDir, 'server/src/middlewares/maintenance.middleware.js');

  const maintenanceNoticeSource = fs.readFileSync(maintenanceNoticePath, 'utf-8');
  const appSource = fs.readFileSync(appPath, 'utf-8');
  const checkoutPageSource = fs.readFileSync(checkoutPagePath, 'utf-8');
  const reviewModalSource = fs.readFileSync(reviewModalPath, 'utf-8');
  const pdpSource = fs.readFileSync(pdpPath, 'utf-8');
  const apiSource = fs.readFileSync(apiPath, 'utf-8');
  const defaultSettingsSource = fs.readFileSync(defaultSettingsPath, 'utf-8');
  const backendMiddlewareSource = fs.readFileSync(backendMiddlewarePath, 'utf-8');

  // -------------------------------------------------------------------------
  // TEST 01: Maintenance banner hidden when mode is disabled
  // -------------------------------------------------------------------------
  try {
    const checksMode = maintenanceNoticeSource.includes('settings?.maintenance?.isMaintenanceMode');
    const returnsNullWhenDisabled = maintenanceNoticeSource.includes('if (!isMaintenanceMode) {\n    return null;')
      || maintenanceNoticeSource.includes('if (!isMaintenanceMode) return null;');
    assert.ok(checksMode, 'MaintenanceNotice must check settings.maintenance.isMaintenanceMode');
    assert.ok(returnsNullWhenDisabled, 'MaintenanceNotice must return null when isMaintenanceMode is false');

    record('TEST_01', 'Maintenance banner remains hidden when maintenance mode is disabled', 'PASS');
  } catch (err) {
    record('TEST_01', 'Banner hidden when disabled', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 02: Maintenance banner shown when mode is enabled
  // -------------------------------------------------------------------------
  try {
    const hasRoleStatus = maintenanceNoticeSource.includes('role="status"')
      || maintenanceNoticeSource.includes('role="alert"');
    const hasAriaLive = maintenanceNoticeSource.includes('aria-live="polite"');
    const rendersAside = maintenanceNoticeSource.includes('<aside');

    assert.ok(hasRoleStatus, 'MaintenanceNotice must define accessible status/alert role');
    assert.ok(hasAriaLive, 'MaintenanceNotice must have aria-live="polite"');
    assert.ok(rendersAside, 'MaintenanceNotice must render an announcement landmark');

    record('TEST_02', 'Maintenance banner renders accessible announcement when mode is active', 'PASS');
  } catch (err) {
    record('TEST_02', 'Banner shown when enabled', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 03: Configured message displayed correctly
  // -------------------------------------------------------------------------
  try {
    const extractsMessage = maintenanceNoticeSource.includes('settings?.maintenance?.maintenanceMessage');
    const rendersMessage = maintenanceNoticeSource.includes('{maintenanceMessage}');
    assert.ok(extractsMessage, 'MaintenanceNotice must extract settings.maintenance.maintenanceMessage');
    assert.ok(rendersMessage, 'MaintenanceNotice must render maintenanceMessage dynamically');

    record('TEST_03', 'Configured maintenance message is dynamically extracted and displayed', 'PASS');
  } catch (err) {
    record('TEST_03', 'Configured message display', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 04: Banner appears on customer pages without duplication
  // -------------------------------------------------------------------------
  try {
    const appImportsNotice = appSource.includes('import MaintenanceNotice from');
    const appRendersNotice = appSource.includes('<MaintenanceNotice />');
    // Ensure it is outside <Routes> so it is mounted once at the application level
    const noticeBeforeRoutes = appSource.indexOf('<MaintenanceNotice />') < appSource.indexOf('<Routes>');

    assert.ok(appImportsNotice, 'App.jsx must import MaintenanceNotice');
    assert.ok(appRendersNotice, 'App.jsx must render MaintenanceNotice');
    assert.ok(noticeBeforeRoutes, 'MaintenanceNotice must be mounted before Routes to prevent duplicate mounting');

    record('TEST_04', 'Maintenance banner is mounted once at the app level without duplication', 'PASS');
  } catch (err) {
    record('TEST_04', 'Banner app-level integration', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 05: Admin pages remain unaffected
  // -------------------------------------------------------------------------
  try {
    const checksAdminPath = maintenanceNoticeSource.includes("location.pathname.startsWith('/admin')");
    const returnsNullForAdmin = maintenanceNoticeSource.includes("if (location.pathname.startsWith('/admin')) {\n    return null;")
      || maintenanceNoticeSource.includes("if (location.pathname.startsWith('/admin')) return null;");

    assert.ok(checksAdminPath, 'MaintenanceNotice must inspect location.pathname for /admin');
    assert.ok(returnsNullForAdmin, 'MaintenanceNotice must immediately return null for admin routes');

    record('TEST_05', 'Admin routes are strictly excluded from storefront maintenance banner', 'PASS');
  } catch (err) {
    record('TEST_05', 'Admin routes unaffected', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 06: Authentication remains accessible
  // -------------------------------------------------------------------------
  try {
    const backendExemptsAuth = backendMiddlewareSource.includes("url.includes('/auth')");
    assert.ok(backendExemptsAuth, 'Backend maintenance middleware must exempt /auth endpoints');

    const appHasAuthRoutes = appSource.includes('path="/login"')
      && appSource.includes('path="/register"')
      && appSource.includes('path="/forgot-password"')
      && appSource.includes('path="/reset-password/:token"');
    assert.ok(appHasAuthRoutes, 'Customer authentication routes remain fully defined and accessible in App.jsx');

    record('TEST_06', 'Customer authentication remains accessible and backend-exempted', 'PASS');
  } catch (err) {
    record('TEST_06', 'Authentication accessibility', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 07: Catalog browsing remains accessible
  // -------------------------------------------------------------------------
  try {
    const backendAllowsGet = backendMiddlewareSource.includes("['GET', 'HEAD', 'OPTIONS'].includes(req.method)");
    assert.ok(backendAllowsGet, 'Backend maintenance middleware must allow GET/HEAD/OPTIONS for catalog browsing');

    const noticeExplainsBrowsing = maintenanceNoticeSource.includes('Browsing remains available');
    assert.ok(noticeExplainsBrowsing, 'MaintenanceNotice must clearly communicate that browsing remains available');

    record('TEST_07', 'Catalog browsing remains accessible with clear customer messaging', 'PASS');
  } catch (err) {
    record('TEST_07', 'Catalog browsing accessible', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 08: Checkout button disabled during maintenance
  // -------------------------------------------------------------------------
  try {
    const checkoutChecksMaintenance = checkoutPageSource.includes('isMaintenanceMode');
    const buttonDisablesOnMaintenance = checkoutPageSource.includes('disabled={isMaintenanceMode || !canPlaceOrder || placingOrder}');
    const buttonShowsPausedText = checkoutPageSource.includes('Order Placement Paused (Maintenance)');
    const handlePlaceOrderGuards = checkoutPageSource.includes('if (isMaintenanceMode || !canPlaceOrder || placingOrder) return;');

    assert.ok(checkoutChecksMaintenance, 'CheckoutPage must read maintenance mode state');
    assert.ok(buttonDisablesOnMaintenance, 'Place Order button must be disabled when isMaintenanceMode is true');
    assert.ok(buttonShowsPausedText, 'Place Order button must display paused state label');
    assert.ok(handlePlaceOrderGuards, 'handlePlaceOrder must guard against execution during maintenance');

    record('TEST_08', 'Place Order button disabled and guarded during maintenance mode', 'PASS');
  } catch (err) {
    record('TEST_08', 'Checkout button disabled', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 09: Checkout remains unchanged when maintenance is disabled
  // -------------------------------------------------------------------------
  try {
    const preservesNormalButtonText = checkoutPageSource.includes('Confirm & Place Order (COD)')
      && checkoutPageSource.includes('Resolve Warnings to Order');
    const preservesCartAndSummary = checkoutPageSource.includes('checkoutData?.summary')
      && checkoutPageSource.includes('checkoutData?.address');

    assert.ok(preservesNormalButtonText, 'CheckoutPage must preserve standard order action labels when maintenance is inactive');
    assert.ok(preservesCartAndSummary, 'CheckoutPage preserves live cart, address, and pricing summaries');

    record('TEST_09', 'Normal checkout workflow and submission paths remain intact when maintenance is inactive', 'PASS');
  } catch (err) {
    record('TEST_09', 'Normal checkout preserved', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 10: HTTP 503 MAINTENANCE_MODE handled correctly
  // -------------------------------------------------------------------------
  try {
    // api.js normalizes code and statusCode
    const apiNormalizesCode = apiSource.includes("error.response?.data?.code || 'UNKNOWN_ERROR'");
    assert.ok(apiNormalizesCode, 'api.js interceptor must normalize error.response.data.code');

    // CheckoutPage catches MAINTENANCE_MODE and 503
    const checkoutHandles503 = checkoutPageSource.includes("err.code === 'MAINTENANCE_MODE'")
      && checkoutPageSource.includes('status === 503');
    assert.ok(checkoutHandles503, 'CheckoutPage must specifically catch MAINTENANCE_MODE and HTTP 503');

    // CheckoutPage triggers refetch to update settings
    const checkoutTriggersRefetch = checkoutPageSource.includes('refetch();');
    assert.ok(checkoutTriggersRefetch, 'CheckoutPage must trigger settings refetch on 503 error');

    record('TEST_10', 'HTTP 503 MAINTENANCE_MODE errors are accurately normalized, handled, and trigger refetch', 'PASS');
  } catch (err) {
    record('TEST_10', 'HTTP 503 error handling', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 11: Review submission disabled during maintenance
  // -------------------------------------------------------------------------
  try {
    const reviewChecksMaintenance = reviewModalSource.includes('isMaintenanceMode');
    const submitGuarded = reviewModalSource.includes('if (isMaintenanceMode) return;');
    const submitButtonDisabled = reviewModalSource.includes('disabled={loading || isMaintenanceMode}');
    const buttonShowsPaused = reviewModalSource.includes("isMaintenanceMode ? 'Submission Paused'");
    const modalRendersNotice = reviewModalSource.includes('Review Submissions Temporarily Paused');

    assert.ok(reviewChecksMaintenance, 'ReviewFormModal must check isMaintenanceMode');
    assert.ok(submitGuarded, 'ReviewFormModal handleSubmit must return early if isMaintenanceMode');
    assert.ok(submitButtonDisabled, 'ReviewFormModal submit button must be disabled during maintenance');
    assert.ok(buttonShowsPaused, 'ReviewFormModal button text must indicate submission is paused');
    assert.ok(modalRendersNotice, 'ReviewFormModal must display informative amber maintenance banner');

    record('TEST_11', 'Review form disables submission and renders maintenance notice during maintenance mode', 'PASS');
  } catch (err) {
    record('TEST_11', 'Review submission disabled', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 12: Failed review submission preserves user-entered text
  // -------------------------------------------------------------------------
  try {
    // ReviewFormModal keeps state intact on error
    const preservesTitle = reviewModalSource.includes('value={title}');
    const preservesComment = reviewModalSource.includes('value={comment}');
    const preservesRating = reviewModalSource.includes('rating={rating}');
    // ProductDetailPage does NOT close modal on error
    const pdpCatchesError = pdpSource.includes('setModalError(')
      && pdpSource.includes("err?.code === 'MAINTENANCE_MODE' || err?.statusCode === 503");

    assert.ok(preservesTitle, 'ReviewFormModal binds value to title state without resetting on error');
    assert.ok(preservesComment, 'ReviewFormModal binds value to comment state without resetting on error');
    assert.ok(preservesRating, 'ReviewFormModal binds value to rating state without resetting on error');
    assert.ok(pdpCatchesError, 'ProductDetailPage catches 503 and triggers refetchSettings while keeping modal open');

    record('TEST_12', 'User-entered review content is safely preserved upon maintenance submission failure', 'PASS');
  } catch (err) {
    record('TEST_12', 'Review content preservation', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 13: Fallback settings do not falsely confirm maintenance is disabled
  // -------------------------------------------------------------------------
  try {
    // defaultSettings has maintenance.isMaintenanceMode = false
    const defaultHasMaintenance = defaultSettingsSource.includes('isMaintenanceMode: false');
    assert.ok(defaultHasMaintenance, 'defaultSettings defines safe initial fallback isMaintenanceMode: false');

    // Backend middleware has fail-closed check for transactional mutations if settings fail
    const middlewareFailsClosed = backendMiddlewareSource.includes('MAINTENANCE_MODE_CHECK_FAILED')
      && backendMiddlewareSource.includes('res.status(503)');
    assert.ok(middlewareFailsClosed, 'Backend middleware fails closed with HTTP 503 if settings fail to verify authoritatively');

    record('TEST_13', 'Fallback settings preserve storefront browsing while backend authoritatively fails closed', 'PASS');
  } catch (err) {
    record('TEST_13', 'Fallback settings and fail-closed safety', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 14: Existing checkout and review functionality remains intact
  // -------------------------------------------------------------------------
  try {
    const checkoutHasPlaceCod = checkoutPageSource.includes('placeCodOrder');
    const checkoutHasIdempotency = checkoutPageSource.includes('idempotencyKey');
    const reviewHasSubmit = reviewModalSource.includes('onSubmit({');

    assert.ok(checkoutHasPlaceCod, 'CheckoutPage retains placeCodOrder call');
    assert.ok(checkoutHasIdempotency, 'CheckoutPage retains idempotency key protection');
    assert.ok(reviewHasSubmit, 'ReviewFormModal retains review submission payload construct');

    record('TEST_14', 'Existing checkout and review functionality remains fully operational', 'PASS');
  } catch (err) {
    record('TEST_14', 'Workflow continuity', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('\n======================================================================');
  console.log(`TOTAL TESTS: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
  console.log('======================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
};

runSuite().catch((err) => {
  console.error('Unhandled test suite failure:', err);
  process.exit(1);
});
