import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useAuth } from '../features/auth/hooks/useAuth';
import { useCart } from '../features/cart/context/CartContext';
import { couponApi } from '../features/coupons/api/couponApi';
import CouponInput from '../components/coupons/CouponInput';
import { LUXE_PLACEHOLDER_IMAGE } from '../utils/image';
import { useStoreSettings } from '../features/settings/context/useStoreSettings';
import { getFreeShippingProgress } from '../features/cart/utils/shippingUtils';
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  ShieldCheck,
  Truck,
  RefreshCw,
  AlertTriangle,
  Heart,
} from 'lucide-react';

export default function CartPage() {
  const { items, summary, loading, error, updateQuantity, removeItem, clearCart } = useCart();
  const { isAuthenticated } = useAuth();
  const { settings } = useStoreSettings();
  const freeShipping = getFreeShippingProgress(summary.subtotal, settings?.shipping);
  const minDeliveryDays = settings?.shipping?.deliveryEstimateDays?.min || 3;
  const maxDeliveryDays = settings?.shipping?.deliveryEstimateDays?.max || 7;
  const isReturnsEnabled = settings?.returns?.isReturnsEnabled !== false;
  const returnWindowDays = settings?.returns?.returnWindowDays || 7;
  const navigate = useNavigate();
  const location = useLocation();

  // Coupon states
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState(null);
  const [guestAuthRequired, setGuestAuthRequired] = useState(false);

  // Empty Bag Confirmation Modal state
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const clearModalRef = useRef(null);
  const cancelClearBtnRef = useRef(null);
  const emptyBagTriggerRef = useRef(null);
  const prevActiveElementRef = useRef(null);

  const handleOpenClearModal = () => {
    setClearModalOpen(true);
  };

  const handleCancelClear = () => {
    if (!clearing) {
      setClearModalOpen(false);
    }
  };

  const handleConfirmClear = async () => {
    if (clearing) return;
    setClearing(true);
    try {
      await clearCart();
      setClearModalOpen(false);
    } catch {
      // Handled via context
    } finally {
      setClearing(false);
    }
  };

  // Focus management, focus containment trap, and Escape key handling for Empty Bag Modal
  useEffect(() => {
    if (!clearModalOpen) return;

    prevActiveElementRef.current = document.activeElement;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const timer = setTimeout(() => {
      if (cancelClearBtnRef.current) {
        cancelClearBtnRef.current.focus();
      } else if (clearModalRef.current) {
        const firstFocusable = clearModalRef.current.querySelector(
          'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        firstFocusable?.focus();
      }
    }, 50);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (!clearing) {
          e.preventDefault();
          setClearModalOpen(false);
        }
        return;
      }

      if (e.key === 'Tab' && clearModalRef.current) {
        const focusables = clearModalRef.current.querySelectorAll(
          'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;

        const firstElement = focusables[0];
        const lastElement = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement || !clearModalRef.current.contains(document.activeElement)) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement || !clearModalRef.current.contains(document.activeElement)) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      if (prevActiveElementRef.current && typeof prevActiveElementRef.current.focus === 'function') {
        prevActiveElementRef.current.focus();
      }
    };
  }, [clearModalOpen, clearing]);

  const handleQuantityChange = async (item, delta) => {
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      await removeItem(item.productId, item.variantId);
    } else {
      await updateQuantity(item.productId, item.variantId, newQty);
    }
  };

  const handleApplyCoupon = async (code) => {
    setGuestAuthRequired(false);
    setCouponError(null);

    // Safeguard: Guest checkout attempts must not issue validation requests that fail with 401
    if (!isAuthenticated) {
      setGuestAuthRequired(true);
      return;
    }

    try {
      setCouponLoading(true);
      const res = await couponApi.validateCoupon(code);
      const data = res?.data?.data || res?.data;
      setAppliedCoupon({
        code: data.coupon.code,
        discountType: data.coupon.discountType,
        discountValue: data.coupon.discountValue,
        discountAmount: data.discountPaise,
        description: data.coupon.description,
      });
      setGuestAuthRequired(false);
    } catch (err) {
      if (err?.response?.status === 401) {
        setGuestAuthRequired(true);
        setCouponError(null);
      } else {
        setCouponError(err?.response?.data?.message || err?.message || 'Invalid coupon code');
      }
      setAppliedCoupon(null);
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponError(null);
    setGuestAuthRequired(false);
  };

  const handleProceedToCheckout = () => {
    navigate('/checkout', {
      state: { couponCode: appliedCoupon?.code || undefined },
    });
  };

  const couponDiscountRupees = appliedCoupon ? appliedCoupon.discountAmount / 100 : 0;
  const finalGrandTotal = Math.max(0, summary.grandTotal - couponDiscountRupees);

  return (
    <div className="min-h-screen bg-[#F7F3EE] text-[#171513] flex flex-col justify-between">
      <Navbar />

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 space-y-8">
        {/* Page Title & Header */}
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-[#E7DED5] pb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#2A211B]">
              Shopping Bag
            </h1>
            <p className="text-xs text-[#6F6963] mt-1">
              {summary.totalItems} {summary.totalItems === 1 ? 'curated piece' : 'curated pieces'} selected for your collection
            </p>
          </div>

          {items.length > 0 && (
            <button
              ref={emptyBagTriggerRef}
              onClick={handleOpenClearModal}
              className="text-xs text-[#6F6963] hover:text-red-700 font-medium transition-colors self-start sm:self-auto cursor-pointer"
            >
              Empty Bag
            </button>
          )}
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Empty State */}
        {items.length === 0 && !loading ? (
          <div className="bg-white border border-[#E7DED5] rounded-3xl p-12 text-center max-w-md mx-auto space-y-4 shadow-xs">
            <div className="w-16 h-16 rounded-full bg-[#F7F3EE] flex items-center justify-center mx-auto text-[#9A6A45]">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-serif font-bold text-[#2A211B]">
              Your Bag is Empty
            </h2>
            <p className="text-xs text-[#6F6963] leading-relaxed">
              Explore our luxury collections of fine handcrafted apparel, footwear, and bespoke jewelry.
            </p>
            <Link
              to="/shop"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#2A211B] text-white hover:bg-[#9A6A45] text-xs font-semibold uppercase tracking-wider transition-colors shadow-xs"
            >
              <span>Explore Collection</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : (
          /* Cart Content Layout */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Cart Items List */}
            <div className="lg:col-span-8 space-y-4">
              {items.map((item) => {
                const isUnavailable = !item.isAvailable;
                const hasWarnings = item.warnings && item.warnings.length > 0;

                return (
                  <div
                    key={`${item.productId}-${item.variantId}`}
                    className={`bg-white border rounded-3xl p-4 sm:p-6 transition-all flex flex-col sm:flex-row gap-4 sm:gap-6 shadow-xs ${
                      isUnavailable
                        ? 'border-red-200 bg-red-50/20'
                        : 'border-[#E7DED5] hover:border-[#9A6A45]/40'
                    }`}
                  >
                    {/* Item Image */}
                    <div className="w-20 h-24 sm:w-28 sm:h-36 rounded-2xl bg-[#F7F3EE] border border-[#E7DED5] overflow-hidden shrink-0 relative">
                      <img
                        src={item.image || LUXE_PLACEHOLDER_IMAGE}
                        alt={item.name}
                        className="w-full h-full object-cover object-center"
                      />
                      {item.discountPercent > 0 && (
                        <span className="absolute top-1.5 left-1.5 bg-[#9A6A45] text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                          {item.discountPercent}% OFF
                        </span>
                      )}
                    </div>

                    {/* Item Info & Actions */}
                    <div className="flex-1 flex flex-col justify-between space-y-3">
                      <div className="space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[#9A6A45]">
                              {item.brand || 'LuxeCart'}
                            </p>
                            <h3 className="text-sm sm:text-base font-serif font-bold text-[#2A211B]">
                              <Link
                                to={item.slug ? `/products/${item.slug}` : '#'}
                                className="hover:text-[#9A6A45] transition-colors"
                              >
                                {item.name}
                              </Link>
                            </h3>
                          </div>

                          {/* Delete Item Button */}
                          <button
                            onClick={() => removeItem(item.productId, item.variantId)}
                            className="text-[#6F6963] hover:text-red-600 transition-colors p-1 cursor-pointer"
                            aria-label="Remove item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Selected Variant Attributes */}
                        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-[#6F6963]">
                          {item.selectedAttributes?.color?.name && (
                            <span className="inline-flex items-center gap-1 bg-[#F7F3EE] px-2 py-0.5 rounded border border-[#E7DED5]">
                              <span
                                className="w-2.5 h-2.5 rounded-full border border-black/10"
                                style={{ backgroundColor: item.selectedAttributes.color.hex || '#2A211B' }}
                              />
                              <span>{item.selectedAttributes.color.name}</span>
                            </span>
                          )}

                          {item.selectedAttributes?.size && (
                            <span className="bg-[#F7F3EE] px-2 py-0.5 rounded border border-[#E7DED5] font-medium text-[#2A211B]">
                              Size: {item.selectedAttributes.size}
                            </span>
                          )}

                          {item.sku && item.sku !== 'UNKNOWN' && (
                            <span className="text-[10px] text-[#6F6963] font-mono">
                              SKU: {item.sku}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Warnings / Availability Notice */}
                      {hasWarnings && (
                        <div className="text-[11px] text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>{item.warnings.join(' ')}</span>
                        </div>
                      )}

                      {isUnavailable && (
                        <div className="text-[11px] text-red-700 font-semibold flex items-center gap-1">
                          <span>{item.reason === 'PRODUCT_ARCHIVED' ? 'Product no longer available' : item.reason === 'OUT_OF_STOCK' ? 'Out of stock' : 'Variant unavailable'}</span>
                        </div>
                      )}

                      {/* Pricing & Quantity Controls */}
                      <div className="flex items-center justify-between pt-2 border-t border-[#E7DED5]">
                        <div className="flex items-baseline gap-2">
                          <span className="text-base font-bold text-[#2A211B]">
                            ₹{(item.itemSubtotal || item.price * item.quantity || 0).toLocaleString('en-IN')}
                          </span>
                          {item.mrp > item.price && (
                            <span className="text-xs text-[#6F6963] line-through">
                              ₹{(item.mrp * item.quantity).toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>

                        {/* Quantity Stepper */}
                        <div className="flex items-center gap-2 border border-[#E7DED5] rounded-xl bg-[#F7F3EE] p-1">
                          <button
                            onClick={() => handleQuantityChange(item, -1)}
                            disabled={item.quantity <= 1 || loading}
                            aria-label="Decrease quantity"
                            className="w-6 h-6 rounded-lg bg-white flex items-center justify-center text-[#2A211B] hover:bg-[#E7DED5] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-6 text-center text-xs font-bold text-[#2A211B]">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => handleQuantityChange(item, 1)}
                            disabled={item.quantity >= 10 || loading}
                            aria-label="Increase quantity"
                            className="w-6 h-6 rounded-lg bg-white flex items-center justify-center text-[#2A211B] hover:bg-[#E7DED5] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right Column: Order & Price Summary */}
            <div className="lg:col-span-4 sticky top-24 space-y-4">
              <div className="bg-white border border-[#E7DED5] rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
                <h2 className="text-lg font-serif font-bold text-[#2A211B] border-b border-[#E7DED5] pb-3">
                  Order Summary
                </h2>

                {/* Free Shipping Progress Indicator (rendered strictly when threshold is enabled) */}
                {freeShipping.isEnabled && items.length > 0 && (
                  <div
                    className={`p-3.5 rounded-2xl border flex items-center gap-3 text-xs ${
                      freeShipping.qualifies
                        ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                        : 'bg-amber-50/70 border-amber-200 text-amber-900'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-xl shrink-0 ${
                        freeShipping.qualifies
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      <Truck className="w-4 h-4" />
                    </div>
                    <div className="flex-1 space-y-1.5">
                      {freeShipping.qualifies ? (
                        <p className="font-semibold text-emerald-800">
                          You've unlocked Free Standard Delivery!
                        </p>
                      ) : (
                        <p className="font-medium">
                          Add <span className="font-bold text-[#2A211B]">₹{freeShipping.remainingRupees.toLocaleString('en-IN')}</span> more to qualify for <span className="font-bold text-emerald-800">Free Delivery</span>
                        </p>
                      )}
                      <div
                        className="w-full bg-black/10 rounded-full h-1.5 overflow-hidden"
                        role="progressbar"
                        aria-valuenow={freeShipping.percent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label="Free shipping progress"
                      >
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            freeShipping.qualifies ? 'bg-emerald-600' : 'bg-[#9A6A45]'
                          }`}
                          style={{ width: `${freeShipping.percent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Promo Coupon Widget */}
                <div className="space-y-3 border-b border-[#E7DED5] pb-5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#2A211B]">
                    Promotions & Coupons
                  </label>
                  <CouponInput
                    appliedCoupon={appliedCoupon}
                    onApplyCoupon={handleApplyCoupon}
                    onRemoveCoupon={handleRemoveCoupon}
                    loading={couponLoading}
                    error={couponError}
                    disabled={items.length === 0}
                  />

                  {guestAuthRequired && (
                    <div className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#E7DED5] text-xs text-[#2A211B] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 animate-in fade-in">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#9A6A45] shrink-0" />
                        <span className="text-[#6F6963]">
                          Please sign in to apply promotional vouchers.
                        </span>
                      </div>
                      <Link
                        to="/login"
                        state={{ from: location }}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2A211B] text-white hover:bg-[#9A6A45] text-xs font-semibold uppercase tracking-wider transition-colors shrink-0"
                      >
                        <span>Sign In</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  )}
                </div>

                <div className="space-y-3 text-xs text-[#6F6963]">
                  <div className="flex justify-between">
                    <span>Total MRP</span>
                    <span className="font-semibold text-[#2A211B]">
                      ₹{(summary.totalMrp || summary.subtotal).toLocaleString('en-IN')}
                    </span>
                  </div>

                  {summary.totalSavings > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Bag Savings</span>
                      <span className="font-semibold">
                        - ₹{summary.totalSavings.toLocaleString('en-IN')}
                      </span>
                    </div>
                  )}

                  {appliedCoupon && couponDiscountRupees > 0 && (
                    <div className="flex justify-between text-emerald-700 font-semibold animate-in fade-in">
                      <span>Coupon Discount ({appliedCoupon.code})</span>
                      <span>- ₹{couponDiscountRupees.toLocaleString('en-IN')}</span>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span>Estimated Tax</span>
                    <span className="font-semibold text-[#2A211B]">₹0</span>
                  </div>

                  <div className="flex justify-between">
                    <span>Estimated Delivery Fee</span>
                    <span className="font-semibold text-[#2A211B]">
                      {summary.estimatedShipping > 0 ? (
                        `₹${summary.estimatedShipping.toLocaleString('en-IN')}`
                      ) : items.length > 0 ? (
                        <span className="text-emerald-700 uppercase">Free</span>
                      ) : (
                        '₹0'
                      )}
                    </span>
                  </div>

                  <div className="border-t border-[#E7DED5] pt-3 flex justify-between text-base font-bold text-[#2A211B]">
                    <span>Grand Total</span>
                    <span>₹{finalGrandTotal.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* Checkout CTA */}
                <div className="space-y-2">
                  <button
                    disabled={!summary.canCheckout || items.length === 0}
                    onClick={handleProceedToCheckout}
                    className="w-full py-4 px-6 rounded-2xl bg-[#2A211B] text-white hover:bg-[#9A6A45] transition-colors text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs"
                  >
                    <span>Proceed to Checkout</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  {!summary.canCheckout && items.length > 0 && (
                    <p className="text-[11px] text-red-600 text-center">
                      Please remove unavailable items or reduce over-stock quantities to proceed.
                    </p>
                  )}
                </div>

                {/* Assurance Badges */}
                <div className="pt-4 border-t border-[#E7DED5] space-y-2.5 text-[11px] text-[#6F6963]">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#9A6A45]" />
                    <span>100% Secure Checkout Guarantee</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-[#9A6A45]" />
                    <span>Estimated delivery in {minDeliveryDays}–{maxDeliveryDays} days</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <RefreshCw className={`w-4 h-4 ${isReturnsEnabled ? 'text-[#9A6A45]' : 'text-stone-400'}`} />
                    <span className={isReturnsEnabled ? '' : 'text-stone-400'}>
                      {isReturnsEnabled ? `${returnWindowDays}-Day Return Policy (from delivery)` : 'Returns Currently Unavailable'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Empty Bag Confirmation Modal */}
      {clearModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget && !clearing) {
              setClearModalOpen(false);
            }
          }}
        >
          <div
            ref={clearModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-bag-modal-title"
            aria-describedby="clear-bag-modal-desc"
            className="bg-white border border-[#E7DED5] rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-xl text-center"
          >
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h3 id="clear-bag-modal-title" className="text-base font-serif font-bold text-[#2A211B]">
                Empty Shopping Bag?
              </h3>
              <p id="clear-bag-modal-desc" className="text-xs text-[#6F6963] mt-1 leading-relaxed">
                Are you sure you want to remove all items from your shopping bag? This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                ref={cancelClearBtnRef}
                type="button"
                disabled={clearing}
                onClick={handleCancelClear}
                className="w-1/2 py-2.5 rounded-xl border border-[#E7DED5] bg-white text-[#2A211B] hover:bg-[#F7F3EE] text-xs font-semibold cursor-pointer disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={clearing}
                onClick={handleConfirmClear}
                className="w-1/2 py-2.5 rounded-xl bg-red-600 text-white hover:bg-red-700 text-xs font-semibold disabled:opacity-50 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                {clearing && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{clearing ? 'Emptying...' : 'Empty Bag'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="max-w-7xl w-full mx-auto text-center border-t border-[#E7DED5] py-6 px-4">
        <p className="text-xs text-[#6F6963]">
          LuxeCart &copy; 2026. Single-Vendor Fashion & Lifestyle.
        </p>
      </footer>
    </div>
  );
}
