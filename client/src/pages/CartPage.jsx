import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useCart } from '../features/cart/context/CartContext';
import { couponApi } from '../features/coupons/api/couponApi';
import CouponInput from '../components/coupons/CouponInput';
import { LUXE_PLACEHOLDER_IMAGE } from '../utils/image';
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
  const navigate = useNavigate();

  // Coupon states
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState(null);

  const handleQuantityChange = async (item, delta) => {
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      await removeItem(item.productId, item.variantId);
    } else {
      await updateQuantity(item.productId, item.variantId, newQty);
    }
  };

  const handleApplyCoupon = async (code) => {
    try {
      setCouponLoading(true);
      setCouponError(null);
      const res = await couponApi.validateCoupon(code);
      const data = res?.data?.data || res?.data;
      setAppliedCoupon({
        code: data.coupon.code,
        discountType: data.coupon.discountType,
        discountValue: data.coupon.discountValue,
        discountAmount: data.discountPaise,
        description: data.coupon.description,
      });
    } catch (err) {
      setCouponError(err?.response?.data?.message || err?.message || 'Invalid coupon code');
      setAppliedCoupon(null);
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponError(null);
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
              onClick={clearCart}
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

                {/* Promo Coupon Widget */}
                <div className="space-y-2 border-b border-[#E7DED5] pb-5">
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
                    <span>Delivery</span>
                    <span className="font-semibold text-emerald-700 uppercase">FREE</span>
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
                    <span>Complimentary Express Delivery Pan-India</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-7xl w-full mx-auto text-center border-t border-[#E7DED5] py-6 px-4">
        <p className="text-xs text-[#6F6963]">
          LuxeCart &copy; 2026. Single-Vendor Fashion & Lifestyle.
        </p>
      </footer>
    </div>
  );
}
