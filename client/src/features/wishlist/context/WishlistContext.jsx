import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { wishlistApi } from '../api/wishlistApi';
import { useAuth } from '../../auth/hooks/useAuth';
import { useCart } from '../../cart/context/CartContext';

const WishlistContext = createContext(null);

export const WishlistProvider = ({ children }) => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { refreshCart } = useCart();
  const [wishlist, setWishlist] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Sync wishlist on Auth change
  useEffect(() => {
    if (authLoading) return;

    const loadWishlist = async () => {
      setError(null);
      if (isAuthenticated) {
        setLoading(true);
        try {
          const res = await wishlistApi.getWishlist();
          if (res?.data) {
            setWishlist(res.data);
          }
        } catch (err) {
          setError(err.message || 'Failed to load wishlist');
        } finally {
          setLoading(false);
        }
      } else {
        setWishlist(null);
      }
    };

    loadWishlist();
  }, [isAuthenticated, authLoading]);

  // Refresh Wishlist
  const refreshWishlist = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setLoading(true);
      const res = await wishlistApi.getWishlist();
      if (res?.data) {
        setWishlist(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to refresh wishlist');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Add Item to Wishlist (with optimistic update)
  const addItem = async (productId, preferredVariantId = null) => {
    if (!isAuthenticated) {
      return { success: false, requireAuth: true, message: 'Please log in to save items to your wishlist' };
    }

    setError(null);
    try {
      setLoading(true);
      const res = await wishlistApi.addToWishlist(productId, preferredVariantId);
      if (res?.data) {
        setWishlist(res.data);
        return { success: true, wishlist: res.data };
      }
      return { success: false, message: 'Invalid response from server' };
    } catch (err) {
      const msg = err.message || 'Failed to add item to wishlist';
      setError(msg);
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  };

  // Remove Item from Wishlist (with optimistic rollback on error)
  const removeItem = async (productId) => {
    if (!isAuthenticated) return { success: false };

    setError(null);
    const previousWishlist = wishlist;

    // Optimistic state update
    if (wishlist?.items) {
      setWishlist({
        ...wishlist,
        items: wishlist.items.filter((i) => i.productId !== productId),
        totalItems: Math.max((wishlist.totalItems || 1) - 1, 0),
      });
    }

    try {
      const res = await wishlistApi.removeFromWishlist(productId);
      if (res?.data) {
        setWishlist(res.data);
        return { success: true, wishlist: res.data };
      }
      return { success: true };
    } catch (err) {
      // Rollback on server error
      setWishlist(previousWishlist);
      const msg = err.message || 'Failed to remove item from wishlist';
      setError(msg);
      return { success: false, message: msg };
    }
  };

  // Clear Wishlist
  const clearWishlist = async () => {
    if (!isAuthenticated) return { success: false };

    setError(null);
    try {
      setLoading(true);
      const res = await wishlistApi.clearWishlist();
      if (res?.data) {
        setWishlist(res.data);
        return { success: true, wishlist: res.data };
      }
    } catch (err) {
      const msg = err.message || 'Failed to clear wishlist';
      setError(msg);
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  };

  // Move item to cart
  const moveToCart = async (productId, variantId, quantity = 1) => {
    if (!isAuthenticated) {
      return { success: false, requireAuth: true, message: 'Please log in to move items to your bag' };
    }

    setError(null);
    try {
      setLoading(true);
      const res = await wishlistApi.moveWishlistItemToCart(productId, variantId, quantity);
      if (res?.data) {
        if (res.data.wishlist) setWishlist(res.data.wishlist);
        await refreshCart();
        return { success: true, data: res.data };
      }
      return { success: false, message: 'Invalid response from server' };
    } catch (err) {
      const msg = err.message || 'Failed to move item to bag';
      setError(msg);
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  };

  // Helper to check if a product is wishlisted
  const isWishlisted = (productId) => {
    if (!isAuthenticated || !wishlist?.items || !productId) return false;
    return wishlist.items.some((i) => i.productId === productId.toString());
  };

  const items = wishlist?.items || [];
  const itemCount = wishlist?.totalItems || items.length;

  return (
    <WishlistContext.Provider
      value={{
        wishlist,
        items,
        loading,
        error,
        itemCount,
        isWishlisted,
        addItem,
        removeItem,
        clearWishlist,
        moveToCart,
        refreshWishlist,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
};
