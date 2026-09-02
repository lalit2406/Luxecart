import React, { createContext, useContext, useState, useCallback } from 'react';
import { checkoutApi } from '../api/checkoutApi';
import { useAuth } from '../../auth/hooks/useAuth';

const CheckoutContext = createContext(null);

export function CheckoutProvider({ children }) {
  const { user } = useAuth();
  const [checkoutData, setCheckoutData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('CASH_ON_DELIVERY');

  const prepareCheckout = useCallback(
    async (addressId = null, couponCode = null) => {
      if (!user) {
        setCheckoutData(null);
        return null;
      }

      setLoading(true);
      setError(null);
      try {
        const res = await checkoutApi.prepareCheckout(addressId, couponCode);
        const data = res?.data?.checkout;
        setCheckoutData(data);
        setWarnings(data?.warnings || []);
        return data;
      } catch (err) {
        setError(err.message || 'Failed to prepare checkout');
        setCheckoutData(null);
        setWarnings([]);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  const clearCheckout = useCallback(() => {
    setCheckoutData(null);
    setError(null);
    setWarnings([]);
  }, []);

  const value = {
    checkoutData,
    loading,
    error,
    warnings,
    selectedPaymentMethod,
    setSelectedPaymentMethod,
    prepareCheckout,
    clearCheckout,
  };

  return <CheckoutContext.Provider value={value}>{children}</CheckoutContext.Provider>;
}

export function useCheckout() {
  const context = useContext(CheckoutContext);
  if (!context) {
    throw new Error('useCheckout must be used within a CheckoutProvider');
  }
  return context;
}
