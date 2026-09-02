import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { cartApi } from '../api/cartApi';
import {
  getGuestCart,
  addGuestCartItem,
  updateGuestCartItem,
  removeGuestCartItem,
  clearGuestCart,
} from '../utils/guestCart';
import { useAuth } from '../../auth/hooks/useAuth';

const CartContext = createContext(null);

const DEFAULT_SUMMARY = {
  itemCount: 0,
  totalUnits: 0,
  subtotal: 0,
  totalMrp: 0,
  totalSavings: 0,
  estimatedTax: 0,
  estimatedShipping: 0,
  grandTotal: 0,
  canCheckout: false,
};

export const CartProvider = ({ children }) => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [cart, setCart] = useState(null);
  const [guestItems, setGuestItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const isMergingRef = useRef(false);

  // Sync state on Auth change
  useEffect(() => {
    if (authLoading) return;

    const handleAuthChange = async () => {
      setError(null);
      if (isAuthenticated) {
        // Unauthenticated -> Authenticated transition: check for guest cart items to merge
        const localGuest = getGuestCart();

        if (localGuest.length > 0 && !isMergingRef.current) {
          isMergingRef.current = true;
          setLoading(true);
          try {
            const res = await cartApi.mergeGuestCart(localGuest);
            if (res?.data?.cart) {
              setCart(res.data.cart);
              // Only clear guest cart after successful merge response
              clearGuestCart();
              setGuestItems([]);
            }
          } catch (err) {
            console.error('Guest cart merge failed:', err);
            // On failure, preserve guest cart in localStorage and load existing user cart
            try {
              const res = await cartApi.getCart();
              if (res?.data) setCart(res.data);
            } catch {
              // Ignore secondary fetch error
            }
          } finally {
            setLoading(false);
            isMergingRef.current = false;
          }
        } else {
          // Normal authenticated cart load
          setLoading(true);
          try {
            const res = await cartApi.getCart();
            if (res?.data) {
              setCart(res.data);
            }
          } catch (err) {
            setError(err.message || 'Failed to load cart');
          } finally {
            setLoading(false);
          }
        }
      } else {
        // Authenticated -> Unauthenticated transition (Logout): clear user cart and load guest cart
        setCart(null);
        setGuestItems(getGuestCart());
      }
    };

    handleAuthChange();
  }, [isAuthenticated, authLoading]);

  // Refresh cart handler
  const refreshCart = useCallback(async () => {
    if (isAuthenticated) {
      try {
        setLoading(true);
        const res = await cartApi.getCart();
        if (res?.data) {
          setCart(res.data);
        }
      } catch (err) {
        setError(err.message || 'Failed to refresh cart');
      } finally {
        setLoading(false);
      }
    } else {
      setGuestItems(getGuestCart());
    }
  }, [isAuthenticated]);

  // Add Item handler (accepts optional display snapshot metadata for guest carts)
  const addItem = async (productId, variantId, quantity = 1, metadata = {}) => {
    setError(null);
    if (isAuthenticated) {
      try {
        setLoading(true);
        const res = await cartApi.addToCart(productId, variantId, quantity);
        if (res?.data) {
          setCart(res.data);
          return { success: true, cart: res.data };
        }
        return { success: false, message: 'Invalid response from server' };
      } catch (err) {
        const msg = err.message || 'Failed to add item to bag';
        setError(msg);
        return { success: false, message: msg };
      } finally {
        setLoading(false);
      }
    } else {
      const updated = addGuestCartItem(productId, variantId, quantity, metadata);
      setGuestItems(updated);
      return { success: true, guestItems: updated };
    }
  };

  // Update Item handler (flexible ID resolution for auth and guest)
  const updateItem = async (itemIdOrVariantId, quantity) => {
    setError(null);
    if (isAuthenticated) {
      try {
        setLoading(true);
        let targetId = itemIdOrVariantId;
        if (cart?.items) {
          const match = cart.items.find(
            (i) => i.itemId === itemIdOrVariantId || i.variantId === itemIdOrVariantId
          );
          if (match?.itemId) targetId = match.itemId;
        }
        const res = await cartApi.updateCartItem(targetId, quantity);
        if (res?.data) {
          setCart(res.data);
          return { success: true, cart: res.data };
        }
        return { success: false, message: 'Invalid response from server' };
      } catch (err) {
        const msg = err.message || 'Failed to update item quantity';
        setError(msg);
        return { success: false, message: msg };
      } finally {
        setLoading(false);
      }
    } else {
      const updated = updateGuestCartItem(itemIdOrVariantId, quantity);
      setGuestItems(updated);
      return { success: true, guestItems: updated };
    }
  };

  // Alias updateQuantity supporting (productId, variantId, qty) or (id, qty)
  const updateQuantity = async (productIdOrItemId, variantIdOrQty, maybeQty) => {
    if (maybeQty !== undefined) {
      return updateItem(variantIdOrQty, maybeQty);
    }
    return updateItem(productIdOrItemId, variantIdOrQty);
  };

  // Remove Item handler (supports both itemId/variantId and (productId, variantId))
  const removeItem = async (itemIdOrVariantId, maybeVariantId) => {
    setError(null);
    const target = maybeVariantId || itemIdOrVariantId;
    if (isAuthenticated) {
      try {
        setLoading(true);
        let targetId = target;
        if (cart?.items) {
          const match = cart.items.find(
            (i) =>
              i.itemId === target ||
              i.variantId === target ||
              (itemIdOrVariantId && maybeVariantId && i.productId === itemIdOrVariantId && i.variantId === maybeVariantId)
          );
          if (match?.itemId) targetId = match.itemId;
        }
        const res = await cartApi.removeCartItem(targetId);
        if (res?.data) {
          setCart(res.data);
          return { success: true, cart: res.data };
        }
        return { success: false, message: 'Invalid response from server' };
      } catch (err) {
        const msg = err.message || 'Failed to remove item from bag';
        setError(msg);
        return { success: false, message: msg };
      } finally {
        setLoading(false);
      }
    } else {
      const updated = removeGuestCartItem(target);
      setGuestItems(updated);
      return { success: true, guestItems: updated };
    }
  };

  // Clear Cart handler
  const clearCart = async () => {
    setError(null);
    if (isAuthenticated) {
      try {
        setLoading(true);
        const res = await cartApi.clearCart();
        if (res?.data) {
          setCart(res.data);
          return { success: true, cart: res.data };
        }
      } catch (err) {
        const msg = err.message || 'Failed to clear cart';
        setError(msg);
        return { success: false, message: msg };
      } finally {
        setLoading(false);
      }
    } else {
      clearGuestCart();
      setGuestItems([]);
      return { success: true };
    }
  };

  // Unified items and summary for UI consumption
  const items = isAuthenticated ? cart?.items || [] : guestItems;

  const calculateGuestSummary = () => {
    const summary = guestItems.reduce(
      (acc, item) => {
        const qty = Number(item.quantity) || 1;
        const price = typeof item.price === 'number' && item.price >= 0 ? item.price : 0;
        const mrp = typeof item.mrp === 'number' && item.mrp >= 0 ? item.mrp : price;
        const isAvail = item.isAvailable !== false;

        acc.itemCount += 1;
        acc.totalUnits += qty;
        if (isAvail) {
          acc.subtotal += price * qty;
          acc.totalMrp += mrp * qty;
        }
        return acc;
      },
      {
        itemCount: 0,
        totalUnits: 0,
        subtotal: 0,
        totalMrp: 0,
        totalSavings: 0,
        estimatedTax: 0,
        estimatedShipping: 0,
        grandTotal: 0,
        canCheckout: guestItems.length > 0,
      }
    );
    summary.totalSavings = Math.max(0, summary.totalMrp - summary.subtotal);
    summary.grandTotal = summary.subtotal;
    return summary;
  };

  const summary = isAuthenticated
    ? cart?.summary || DEFAULT_SUMMARY
    : calculateGuestSummary();

  const itemCount = summary.itemCount;
  const totalUnits = summary.totalUnits;
  const canCheckout = summary.canCheckout;

  return (
    <CartContext.Provider
      value={{
        cart,
        items,
        summary,
        loading,
        error,
        itemCount,
        totalUnits,
        canCheckout,
        addItem,
        updateItem,
        updateQuantity,
        removeItem,
        clearCart,
        refreshCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
