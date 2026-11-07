import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import api from '../../../services/api.js';
import { DEFAULT_PUBLIC_SETTINGS } from './defaultSettings.js';

export { DEFAULT_PUBLIC_SETTINGS };

export const StoreSettingsContext = createContext(null);

/**
 * Global Store Settings Provider
 * Fetches public store settings once on mount and exposes shared state to all customer-facing components.
 */
export function StoreSettingsProvider({ children, initialSettings = null }) {
  const [settings, setSettings] = useState(() => initialSettings || DEFAULT_PUBLIC_SETTINGS);
  const [loading, setLoading] = useState(() => !initialSettings);
  const [error, setError] = useState(null);
  const [isFallback, setIsFallback] = useState(() => !initialSettings);

  const isMountedRef = useRef(true);
  const inFlightPromiseRef = useRef(null);

  /**
   * Performs the public settings fetch with envelope unwrapping and safe fallback.
   */
  const fetchSettings = useCallback(async () => {
    // If a request is already in-flight, return the existing promise to prevent duplicate concurrent calls
    if (inFlightPromiseRef.current) {
      return inFlightPromiseRef.current;
    }

    setLoading(true);

    const promise = (async () => {
      try {
        const res = await api.get('/settings/public');
        // Unpack payload from envelope (api interceptor returns res.data, which contains { success, data })
        const payload = res?.data || res;

        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
          throw new Error('Malformed store settings response received from server');
        }

        if (isMountedRef.current) {
          setSettings(payload);
          setError(null);
          setIsFallback(false);
        }
        return { success: true, settings: payload };
      } catch (err) {
        const errMsg = err.message || 'Unable to retrieve current store settings';
        if (isMountedRef.current) {
          // Keep safe branded defaults active, but flag as fallback
          setError(errMsg);
          setIsFallback(true);
        }
        return { success: false, error: errMsg, settings: DEFAULT_PUBLIC_SETTINGS };
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
        inFlightPromiseRef.current = null;
      }
    })();

    inFlightPromiseRef.current = promise;
    return promise;
  }, []);

  // Initial fetch on mount with unmount cleanup
  useEffect(() => {
    isMountedRef.current = true;

    // Only initiate fetch if initial settings were not pre-seeded (e.g. during testing or SSR)
    if (!initialSettings) {
      fetchSettings();
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [fetchSettings, initialSettings]);

  // Explicit refetch action exposed to consumers
  const refetch = useCallback(() => {
    return fetchSettings();
  }, [fetchSettings]);

  const value = useMemo(
    () => ({
      settings,
      loading,
      error,
      isFallback,
      refetch,
    }),
    [settings, loading, error, isFallback, refetch]
  );

  return <StoreSettingsContext.Provider value={value}>{children}</StoreSettingsContext.Provider>;
}

/**
 * Hook to consume public Store Settings.
 * Throws a helpful Error if called outside a StoreSettingsProvider.
 */
export function useStoreSettings() {
  const context = useContext(StoreSettingsContext);
  if (!context) {
    throw new Error('useStoreSettings must be used within a StoreSettingsProvider');
  }
  return context;
}
