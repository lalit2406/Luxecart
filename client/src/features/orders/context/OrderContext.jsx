import React, { createContext, useContext, useState, useCallback } from 'react';
import { orderApi } from '../api/orderApi';
import { useAuth } from '../../auth/hooks/useAuth';

const OrderContext = createContext(null);

export function OrderProvider({ children }) {
  const { user } = useAuth();
  const [placingOrder, setPlacingOrder] = useState(false);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [error, setError] = useState(null);

  const placeCodOrder = useCallback(
    async ({ addressId, idempotencyKey } = {}) => {
      if (!user) {
        throw new Error('Authentication required to place an order');
      }

      setPlacingOrder(true);
      setError(null);

      try {
        const res = await orderApi.placeCodOrder({ addressId, idempotencyKey });
        const created = res?.data?.order;
        setCurrentOrder(created);
        return created;
      } catch (err) {
        const errMsg = err.message || 'Failed to place order';
        setError(errMsg);
        throw err;
      } finally {
        setPlacingOrder(false);
      }
    },
    [user]
  );

  const clearCurrentOrder = useCallback(() => {
    setCurrentOrder(null);
    setError(null);
  }, []);

  const value = {
    placingOrder,
    currentOrder,
    error,
    placeCodOrder,
    clearCurrentOrder,
  };

  return <OrderContext.Provider value={value}>{children}</OrderContext.Provider>;
}

export function useOrder() {
  const context = useContext(OrderContext);
  if (!context) {
    throw new Error('useOrder must be used within an OrderProvider');
  }
  return context;
}
