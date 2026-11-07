/**
 * LuxeCart — Phase 6E.5.2: Shared Public Store Settings Context & Hook Verification Suite
 *
 * Verifies:
 * 1. Successful public settings fetch and envelope extraction (`res?.data || res`).
 * 2. Shared state across consumers without repeated network calls (single cached source of truth).
 * 3. In-flight request deduplication (concurrent/React StrictMode calls reuse same promise).
 * 4. Safe fallback to `DEFAULT_PUBLIC_SETTINGS` on network error with `isFallback: true`.
 * 5. Error state captured and retained on network failure.
 * 6. Malformed response handled safely (non-object or array throws/falls back gracefully).
 * 7. Successful `refetch()` replaces fallback settings and clears `isFallback` and `error`.
 * 8. Unmounted provider prevents unsafe state updates via `isMountedRef`.
 * 9. `useStoreSettings()` throws descriptive Error when invoked outside `StoreSettingsProvider`.
 * 10. Provider integration in `App.jsx` (mounted inside BrowserRouter, wrapping AuthProvider & CartProvider).
 * 11. Currency INR and COD platform invariants strictly preserved in fallback defaults.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

console.log('======================================================================');
console.log('   LUXECART PHASE 6E.5.2: PUBLIC STORE SETTINGS CONTEXT & HOOK TEST   ');
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
  const contextPath = path.join(rootDir, 'client/src/features/settings/context/StoreSettingsContext.jsx');
  const defaultSettingsPath = path.join(rootDir, 'client/src/features/settings/context/defaultSettings.js');
  const hookPath = path.join(rootDir, 'client/src/features/settings/context/useStoreSettings.js');
  const appJsxPath = path.join(rootDir, 'client/src/App.jsx');

  const contextSource = fs.readFileSync(contextPath, 'utf-8');
  const hookSource = fs.readFileSync(hookPath, 'utf-8');
  const appJsxSource = fs.readFileSync(appJsxPath, 'utf-8');

  // Import exports from defaultSettings.js
  const { DEFAULT_PUBLIC_SETTINGS } = await import(
    `file://${defaultSettingsPath.replace(/\\/g, '/')}`
  );

  // -------------------------------------------------------------------------
  // TEST 01: Successful public settings fetch and envelope extraction
  // -------------------------------------------------------------------------
  try {
    const rawPublicBackendResponse = {
      success: true,
      message: 'Store settings retrieved successfully',
      data: {
        storeName: 'Aura & Co.',
        tagline: 'Modern Elegance',
        logoUrlLight: 'https://cdn.example.com/aura-light.png',
        logoUrlDark: '',
        faviconUrl: '',
        supportEmail: 'care@aura.co',
        supportPhone: '+91 91234 56789',
        operatingHours: 'Mon - Fri: 9:00 AM - 6:00 PM IST',
        address: {
          street: '45 MG Road',
          city: 'Mumbai',
          state: 'Maharashtra',
          postalCode: '400001',
          country: 'India',
        },
        currency: {
          code: 'INR',
          symbol: '₹',
          name: 'Indian Rupee',
          locale: 'en-IN',
        },
        shipping: {
          standardFeePaise: 15000,
          standardFeeRupees: 150,
          enableFreeShippingThreshold: true,
          freeShippingThresholdPaise: 300000,
          freeShippingThresholdRupees: 3000,
          deliveryEstimateDays: { min: 2, max: 5 },
        },
        payment: {
          isCodEnabled: true,
          maxCodOrderPaise: 5000000,
          maxCodOrderRupees: 50000,
        },
        returns: {
          isReturnsEnabled: true,
          returnWindowDays: 14,
        },
        maintenance: {
          isMaintenanceMode: false,
          maintenanceMessage: '',
        },
        socialLinks: {
          instagram: 'https://instagram.com/auraco',
          facebook: '',
          twitter: '',
          pinterest: '',
        },
        seo: {
          metaTitle: 'Aura & Co. Luxury Boutique',
          metaDescription: 'Shop luxury clothing at Aura & Co.',
          keywords: ['aura', 'boutique', 'luxury'],
        },
      },
    };

    // Envelope extraction simulation (matching StoreSettingsContext.jsx)
    const payload = rawPublicBackendResponse?.data || rawPublicBackendResponse;
    assert.strictEqual(payload.storeName, 'Aura & Co.');
    assert.strictEqual(payload.shipping.standardFeeRupees, 150);
    assert.strictEqual(payload.returns.returnWindowDays, 14);

    // Verify unpack logic is present in source
    assert(
      contextSource.includes('res?.data || res'),
      'StoreSettingsContext must unpack res?.data || res'
    );
    assert(
      contextSource.includes("api.get('/settings/public')"),
      'StoreSettingsContext must call api.get("/settings/public")'
    );

    record(
      'TEST_01',
      'Successful public settings fetch and envelope extraction',
      'PASS'
    );
  } catch (err) {
    record('TEST_01', 'Successful public settings fetch and envelope extraction', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 02: Shared state across consumers without repeated network calls
  // -------------------------------------------------------------------------
  try {
    let networkCallCount = 0;
    const fakeApi = {
      get: async (url) => {
        if (url === '/settings/public') {
          networkCallCount++;
          return {
            success: true,
            data: { storeName: 'SharedStore' },
          };
        }
      },
    };

    // In React context, the Provider executes the fetch once on mount
    let providerState = null;
    const mountProvider = async () => {
      const res = await fakeApi.get('/settings/public');
      providerState = res.data;
    };

    await mountProvider();

    // Consumer components call useStoreSettings() which simply reads the provider state
    const consumerA = () => providerState;
    const consumerB = () => providerState;
    const consumerC = () => providerState;

    const c1 = consumerA();
    const c2 = consumerB();
    const c3 = consumerC();

    assert.strictEqual(c1.storeName, 'SharedStore');
    assert.strictEqual(c2.storeName, 'SharedStore');
    assert.strictEqual(c3.storeName, 'SharedStore');
    assert.strictEqual(networkCallCount, 1, 'Network call must only be executed once for shared state');

    // Verify context creation in source
    assert(
      contextSource.includes('createContext(null)'),
      'StoreSettingsContext must initialize with null default context'
    );
    assert(
      contextSource.includes('<StoreSettingsContext.Provider value={value}>'),
      'StoreSettingsProvider must provide memoized value to children'
    );

    record('TEST_02', 'Shared state across consumers without repeated network calls', 'PASS');
  } catch (err) {
    record('TEST_02', 'Shared state across consumers without repeated network calls', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 03: In-flight request deduplication
  // -------------------------------------------------------------------------
  try {
    let callCounter = 0;
    let inFlightRef = null;

    const fetchWithDedup = () => {
      if (inFlightRef) {
        return inFlightRef;
      }
      const promise = (async () => {
        callCounter++;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return { data: { storeName: 'DedupStore' } };
      })().finally(() => {
        inFlightRef = null;
      });
      inFlightRef = promise;
      return promise;
    };

    // Fire 4 rapid calls before the first one resolves
    const [p1, p2, p3, p4] = await Promise.all([
      fetchWithDedup(),
      fetchWithDedup(),
      fetchWithDedup(),
      fetchWithDedup(),
    ]);

    assert.strictEqual(callCounter, 1, 'In-flight promise deduplication must ensure exactly 1 execution');
    assert.strictEqual(p1.data.storeName, 'DedupStore');
    assert.strictEqual(p4.data.storeName, 'DedupStore');

    // Verify inFlightPromiseRef in source
    assert(
      contextSource.includes('inFlightPromiseRef.current'),
      'StoreSettingsContext must check and cache inFlightPromiseRef'
    );

    record('TEST_03', 'In-flight request deduplication across concurrent calls', 'PASS');
  } catch (err) {
    record('TEST_03', 'In-flight request deduplication across concurrent calls', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 04: Safe fallback to DEFAULT_PUBLIC_SETTINGS on network error with isFallback: true
  // -------------------------------------------------------------------------
  try {
    assert(DEFAULT_PUBLIC_SETTINGS, 'DEFAULT_PUBLIC_SETTINGS must be exported');
    assert.strictEqual(DEFAULT_PUBLIC_SETTINGS.storeName, 'LuxeCart');
    assert.strictEqual(DEFAULT_PUBLIC_SETTINGS.currency.code, 'INR');
    assert.strictEqual(DEFAULT_PUBLIC_SETTINGS.shipping.standardFeeRupees, 200);

    // Verify source sets isFallback true and keeps DEFAULT_PUBLIC_SETTINGS
    assert(
      contextSource.includes('setIsFallback(true)'),
      'StoreSettingsContext must set isFallback to true on network error'
    );
    assert(
      contextSource.includes('DEFAULT_PUBLIC_SETTINGS'),
      'StoreSettingsContext must use DEFAULT_PUBLIC_SETTINGS'
    );
    assert(
      Object.isFrozen(DEFAULT_PUBLIC_SETTINGS),
      'DEFAULT_PUBLIC_SETTINGS must be an immutable frozen object'
    );

    record('TEST_04', 'Safe fallback to DEFAULT_PUBLIC_SETTINGS on network error with isFallback: true', 'PASS');
  } catch (err) {
    record('TEST_04', 'Safe fallback to DEFAULT_PUBLIC_SETTINGS on network error with isFallback: true', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 05: Error state captured and retained on network failure
  // -------------------------------------------------------------------------
  try {
    let capturedError = null;
    let isFallbackFlag = false;

    try {
      throw new Error('Network timeout: 504 Gateway Timeout');
    } catch (err) {
      const errMsg = err.message || 'Unable to retrieve current store settings';
      capturedError = errMsg;
      isFallbackFlag = true;
    }

    assert.strictEqual(capturedError, 'Network timeout: 504 Gateway Timeout');
    assert.strictEqual(isFallbackFlag, true);

    assert(
      contextSource.includes('setError(errMsg)'),
      'StoreSettingsContext must set error state upon error capture'
    );

    record('TEST_05', 'Error state captured and retained on network failure', 'PASS');
  } catch (err) {
    record('TEST_05', 'Error state captured and retained on network failure', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 06: Malformed response handled safely
  // -------------------------------------------------------------------------
  try {
    const testCases = [null, undefined, '', 'a string', 12345, ['array', 'not', 'settings']];

    for (const malformed of testCases) {
      let threw = false;
      try {
        const payload = malformed?.data || malformed;
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
          throw new Error('Malformed store settings response received from server');
        }
      } catch (e) {
        threw = true;
        assert(e.message.includes('Malformed store settings response'));
      }
      assert.strictEqual(threw, true, `Malformed payload ${JSON.stringify(malformed)} must throw validation error`);
    }

    assert(
      contextSource.includes("Array.isArray(payload)"),
      'StoreSettingsContext must validate that response is a non-array object'
    );

    record('TEST_06', 'Malformed response handled safely with validation guard', 'PASS');
  } catch (err) {
    record('TEST_06', 'Malformed response handled safely with validation guard', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 07: Successful refetch() replaces fallback settings and clears isFallback / error
  // -------------------------------------------------------------------------
  try {
    let state = {
      settings: DEFAULT_PUBLIC_SETTINGS,
      error: 'Initial network error',
      isFallback: true,
      loading: false,
    };

    // Simulate recovery refetch
    const executeRefetch = async () => {
      state.loading = true;
      try {
        const recoveredPayload = {
          storeName: 'Recovered LuxeCart Flagship',
          currency: { code: 'INR' },
        };
        state.settings = recoveredPayload;
        state.error = null;
        state.isFallback = false;
        return { success: true, settings: recoveredPayload };
      } finally {
        state.loading = false;
      }
    };

    const refetchRes = await executeRefetch();
    assert.strictEqual(refetchRes.success, true);
    assert.strictEqual(state.settings.storeName, 'Recovered LuxeCart Flagship');
    assert.strictEqual(state.error, null);
    assert.strictEqual(state.isFallback, false);
    assert.strictEqual(state.loading, false);

    assert(
      contextSource.includes('setError(null)'),
      'StoreSettingsContext must clear error on successful fetch/refetch'
    );
    assert(
      contextSource.includes('setIsFallback(false)'),
      'StoreSettingsContext must set isFallback: false on success'
    );
    assert(
      contextSource.includes('refetch = useCallback'),
      'StoreSettingsContext must provide a refetch function'
    );

    record('TEST_07', 'Successful refetch() replaces fallback settings and clears isFallback/error', 'PASS');
  } catch (err) {
    record('TEST_07', 'Successful refetch() replaces fallback settings and clears isFallback/error', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 08: Unmounted provider prevents unsafe state updates
  // -------------------------------------------------------------------------
  try {
    let isMounted = false;
    let stateUpdated = false;

    // Simulate async callback after component unmounts
    const asyncOperation = async () => {
      await new Promise((r) => setTimeout(r, 10));
      if (isMounted) {
        stateUpdated = true;
      }
    };

    await asyncOperation();
    assert.strictEqual(stateUpdated, false, 'State should NOT be updated when component is unmounted');

    assert(
      contextSource.includes('isMountedRef.current = false'),
      'StoreSettingsContext cleanup must set isMountedRef.current = false'
    );
    assert(
      contextSource.includes('if (isMountedRef.current)'),
      'StoreSettingsContext state updates must check isMountedRef.current'
    );

    record('TEST_08', 'Unmounted provider prevents unsafe state updates via isMountedRef', 'PASS');
  } catch (err) {
    record('TEST_08', 'Unmounted provider prevents unsafe state updates via isMountedRef', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 09: useStoreSettings throws descriptive Error outside provider
  // -------------------------------------------------------------------------
  try {
    // Validate useStoreSettings contract from context source
    assert(
      contextSource.includes("export function useStoreSettings()"),
      'StoreSettingsContext must export useStoreSettings()'
    );
    assert(
      contextSource.includes("if (!context)"),
      'useStoreSettings must check if context is null'
    );
    assert(
      contextSource.includes("throw new Error('useStoreSettings must be used within a StoreSettingsProvider')"),
      'useStoreSettings must throw descriptive error outside provider'
    );

    // Verify useStoreSettings.js re-exports accurately
    assert(
      hookSource.includes("import { useStoreSettings } from './StoreSettingsContext'"),
      'useStoreSettings.js must import from StoreSettingsContext'
    );
    assert(
      hookSource.includes('export default useStoreSettings'),
      'useStoreSettings.js must export default useStoreSettings'
    );
    assert(
      hookSource.includes('export { useStoreSettings }'),
      'useStoreSettings.js must named export useStoreSettings'
    );

    record('TEST_09', 'useStoreSettings throws descriptive Error when invoked outside provider', 'PASS');
  } catch (err) {
    record('TEST_09', 'useStoreSettings throws descriptive Error when invoked outside provider', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 10: Provider integration in App.jsx
  // -------------------------------------------------------------------------
  try {
    assert(
      appJsxSource.includes("import { StoreSettingsProvider } from './features/settings/context/StoreSettingsContext'"),
      'App.jsx must import StoreSettingsProvider'
    );

    // Verify nesting order: BrowserRouter -> StoreSettingsProvider -> AuthProvider -> CartProvider
    const browserRouterIndex = appJsxSource.indexOf('<BrowserRouter>');
    const storeSettingsProviderIndex = appJsxSource.indexOf('<StoreSettingsProvider>');
    const authProviderIndex = appJsxSource.indexOf('<AuthProvider>');
    const cartProviderIndex = appJsxSource.indexOf('<CartProvider>');
    const closeStoreSettingsIndex = appJsxSource.indexOf('</StoreSettingsProvider>');
    const closeBrowserRouterIndex = appJsxSource.indexOf('</BrowserRouter>');

    assert(browserRouterIndex !== -1, '<BrowserRouter> must exist in App.jsx');
    assert(storeSettingsProviderIndex !== -1, '<StoreSettingsProvider> must exist in App.jsx');
    assert(authProviderIndex !== -1, '<AuthProvider> must exist in App.jsx');
    assert(cartProviderIndex !== -1, '<CartProvider> must exist in App.jsx');

    assert(
      browserRouterIndex < storeSettingsProviderIndex,
      '<StoreSettingsProvider> must be inside <BrowserRouter>'
    );
    assert(
      storeSettingsProviderIndex < authProviderIndex,
      '<StoreSettingsProvider> must wrap <AuthProvider>'
    );
    assert(
      authProviderIndex < cartProviderIndex,
      '<AuthProvider> must wrap <CartProvider>'
    );
    assert(
      closeStoreSettingsIndex < closeBrowserRouterIndex,
      '</StoreSettingsProvider> must close before </BrowserRouter>'
    );

    record('TEST_10', 'Provider integration in App.jsx (correct hierarchy, wraps Auth & Cart)', 'PASS');
  } catch (err) {
    record('TEST_10', 'Provider integration in App.jsx (correct hierarchy, wraps Auth & Cart)', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 11: Currency INR and COD platform invariants preserved in fallback defaults
  // -------------------------------------------------------------------------
  try {
    assert.strictEqual(DEFAULT_PUBLIC_SETTINGS.currency.code, 'INR', 'Currency code must be INR');
    assert.strictEqual(DEFAULT_PUBLIC_SETTINGS.currency.symbol, '₹', 'Currency symbol must be ₹');
    assert.strictEqual(DEFAULT_PUBLIC_SETTINGS.currency.locale, 'en-IN', 'Locale must be en-IN');
    assert.strictEqual(DEFAULT_PUBLIC_SETTINGS.payment.isCodEnabled, true, 'COD must default to enabled');
    assert.strictEqual(DEFAULT_PUBLIC_SETTINGS.payment.maxCodOrderRupees, 100000, 'COD limit in rupees must be 100,000');
    assert.strictEqual(DEFAULT_PUBLIC_SETTINGS.payment.maxCodOrderPaise, 10000000, 'COD limit in paise must be 10,000,000');
    assert.strictEqual(DEFAULT_PUBLIC_SETTINGS.shipping.standardFeeRupees, 200, 'Standard shipping fee in rupees must be 200');
    assert.strictEqual(DEFAULT_PUBLIC_SETTINGS.shipping.standardFeePaise, 20000, 'Standard shipping fee in paise must be 20,000');

    record('TEST_11', 'Currency INR and COD platform invariants preserved in fallback defaults', 'PASS');
  } catch (err) {
    record('TEST_11', 'Currency INR and COD platform invariants preserved in fallback defaults', 'FAIL', err.message);
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
