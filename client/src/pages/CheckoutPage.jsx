import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useCart } from '../features/cart/context/CartContext';
import { useAddress } from '../features/addresses/context/AddressContext';
import { useCheckout } from '../features/checkout/context/CheckoutContext';
import { useOrder } from '../features/orders/context/OrderContext';
import CouponInput from '../components/coupons/CouponInput';
import {
  MapPin,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  Truck,
  ShieldCheck,
  CreditCard,
  Banknote,
  Plus,
  Edit2,
  ChevronRight,
  Info,
  Package,
} from 'lucide-react';

export default function CheckoutPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { cart, summary: cartSummary, clearCart } = useCart();
  const { addresses, selectedAddressId, selectAddress, fetchAddresses } = useAddress();
  const { checkoutData, loading, error, warnings, prepareCheckout, clearCheckout } = useCheckout();
  const { placeCodOrder, placingOrder } = useOrder();

  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [submissionError, setSubmissionError] = useState(null);

  // Coupon state
  const [couponCode, setCouponCode] = useState(location.state?.couponCode || '');
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState(null);

  // Initialize or re-prepare checkout whenever cart items, selected address or couponCode changes
  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  useEffect(() => {
    if (cart?.items?.length > 0) {
      prepareCheckout(selectedAddressId, couponCode || undefined).catch(() => {});
    }
  }, [cart, selectedAddressId, couponCode, prepareCheckout]);

  const handleSelectAddress = async (id) => {
    selectAddress(id);
    setAddressModalOpen(false);
    try {
      await prepareCheckout(id, couponCode || undefined);
    } catch (err) {
      // Handled via context
    }
  };

  const handleApplyCoupon = async (code) => {
    try {
      setCouponLoading(true);
      setCouponError(null);
      await prepareCheckout(selectedAddressId, code);
      setCouponCode(code);
    } catch (err) {
      setCouponError(err.message || 'Invalid coupon code');
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = async () => {
    setCouponCode('');
    setCouponError(null);
    try {
      await prepareCheckout(selectedAddressId, undefined);
    } catch (err) {
      // Handled via context
    }
  };

  const handlePlaceOrder = async () => {
    if (!canPlaceOrder || placingOrder) return;
    setSubmissionError(null);

    try {
      const idempotencyKey = `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const created = await placeCodOrder({
        addressId: selectedAddressId,
        idempotencyKey,
        couponCode: checkoutData?.summary?.coupon?.code || undefined,
      });

      // Clear client cart and checkout snapshot
      await clearCart();
      clearCheckout();

      navigate(`/orders/success/${created.orderNumber}`);
    } catch (err) {
      setSubmissionError(err.message || 'Failed to place order. Please review your cart.');
    }
  };

  // If cart is completely empty, prompt customer to visit shop/cart
  if (!loading && (!cart || cart.items.length === 0)) {
    return (
      <div className="min-h-screen bg-[#F7F3EE] text-[#171513] flex flex-col justify-between">
        <Navbar />
        <main className="max-w-3xl mx-auto px-4 py-20 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-white border border-[#E7DED5] flex items-center justify-center mx-auto text-[#9A6A45]">
            <Package className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-serif font-bold text-[#2A211B]">
            Your Shopping Bag is Empty
          </h1>
          <p className="text-xs text-[#6F6963] max-w-sm mx-auto">
            Please add luxury items to your shopping bag before proceeding to checkout review.
          </p>
          <Link
            to="/shop"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#2A211B] text-white hover:bg-[#9A6A45] text-xs font-semibold transition-colors"
          >
            Explore Catalog
          </Link>
        </main>
      </div>
    );
  }

  const summary = checkoutData?.summary || {
    totalMrp: (cartSummary?.totalMrp || 0) * 100,
    totalSavings: (cartSummary?.totalSavings || 0) * 100,
    subtotal: (cartSummary?.subtotal || 0) * 100,
    shipping: 0,
    estimatedTax: 0,
    grandTotal: (cartSummary?.subtotal || 0) * 100,
  };

  const currentAddress = checkoutData?.address || null;
  const canPlaceOrder = checkoutData?.canPlaceOrder && Boolean(currentAddress);

  return (
    <div className="min-h-screen bg-[#F7F3EE] text-[#171513] flex flex-col justify-between">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full flex-1">
        {/* Breadcrumbs & Header */}
        <div className="space-y-4 mb-8">
          <div className="flex items-center gap-2 text-xs text-[#6F6963]">
            <Link to="/" className="hover:text-[#2A211B]">
              Home
            </Link>
            <span>/</span>
            <Link to="/cart" className="hover:text-[#2A211B]">
              Shopping Bag
            </Link>
            <span>/</span>
            <span className="text-[#2A211B] font-semibold">Checkout Review</span>
          </div>

          <div className="flex items-center justify-between border-b border-[#E7DED5] pb-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#2A211B]">
                Checkout Review
              </h1>
              <p className="text-xs text-[#6F6963] mt-1">
                Review your delivery address, live item availability, and order summary.
              </p>
            </div>

            <Link
              to="/cart"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6F6963] hover:text-[#2A211B]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Bag</span>
            </Link>
          </div>
        </div>

        {/* Global Warnings Banner */}
        {warnings && warnings.length > 0 && (
          <div className="p-4 mb-6 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs space-y-1">
            <div className="flex items-center gap-2 font-bold">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Checkout Availability Notice:</span>
            </div>
            <ul className="list-disc list-inside pl-5 space-y-0.5">
              {warnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Submission Error Banner */}
        {submissionError && (
          <div className="p-4 mb-6 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs flex items-center gap-2 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{submissionError}</span>
          </div>
        )}

        {loading && !checkoutData ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 text-[#9A6A45] animate-spin" />
            <p className="text-xs text-[#6F6963]">Revalidating cart and live pricing...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Delivery Address, Items & Payment (8 Cols) */}
            <div className="lg:col-span-8 space-y-6">
              {/* Section 1: Delivery Address */}
              <div className="bg-white border border-[#E7DED5] rounded-3xl p-6 sm:p-7 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-[#E7DED5] pb-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#9A6A45]" />
                    <h2 className="text-sm font-serif font-bold text-[#2A211B]">
                      1. Delivery Address
                    </h2>
                  </div>
                  <button
                    onClick={() => setAddressModalOpen(true)}
                    className="text-xs font-semibold text-[#9A6A45] hover:text-[#2A211B] transition-colors cursor-pointer"
                  >
                    {currentAddress ? 'Change Address' : 'Select Address'}
                  </button>
                </div>

                {currentAddress ? (
                  <div className="text-xs text-[#2A211B] space-y-1 pt-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">{currentAddress.fullName}</span>
                      <span className="px-2 py-0.5 rounded-full bg-[#F7F3EE] border border-[#E7DED5] text-[10px] font-bold uppercase">
                        {currentAddress.addressType}
                      </span>
                      {currentAddress.isDefault && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-bold uppercase">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-[#6F6963]">+91 {currentAddress.phone}</p>
                    <p className="pt-1">
                      {currentAddress.addressLine1}
                      {currentAddress.addressLine2 && `, ${currentAddress.addressLine2}`}
                    </p>
                    {currentAddress.landmark && (
                      <p className="text-[#6F6963] italic">Landmark: {currentAddress.landmark}</p>
                    )}
                    <p className="font-medium">
                      {currentAddress.city}, {currentAddress.state} —{' '}
                      <span className="font-mono font-bold">{currentAddress.postalCode}</span>
                    </p>
                    <p className="text-[#6F6963]">{currentAddress.country}</p>
                  </div>
                ) : (
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-800 flex items-center justify-between">
                    <span>No delivery address selected. Please add or select an address.</span>
                    <button
                      onClick={() => setAddressModalOpen(true)}
                      className="px-3 py-1.5 rounded-xl bg-[#2A211B] text-white text-xs font-semibold"
                    >
                      Add Address
                    </button>
                  </div>
                )}
              </div>

              {/* Section 2: Items Review */}
              <div className="bg-white border border-[#E7DED5] rounded-3xl p-6 sm:p-7 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-[#E7DED5] pb-3">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-[#9A6A45]" />
                    <h2 className="text-sm font-serif font-bold text-[#2A211B]">
                      2. Review Bag Items ({checkoutData?.items?.length || cart?.items?.length || 0})
                    </h2>
                  </div>
                  <Link
                    to="/cart"
                    className="text-xs font-semibold text-[#9A6A45] hover:text-[#2A211B] transition-colors"
                  >
                    Edit Bag
                  </Link>
                </div>

                <div className="divide-y divide-[#E7DED5]">
                  {(checkoutData?.items || []).map((item) => {
                    const hasError = !item.isAvailable;

                    return (
                      <div
                        key={item.cartItemId}
                        className={`py-4 flex gap-4 items-start ${
                          hasError ? 'bg-red-50/50 p-3 rounded-2xl' : ''
                        }`}
                      >
                        {/* Image */}
                        <div className="w-16 h-20 rounded-xl bg-[#F7F3EE] overflow-hidden shrink-0 border border-[#E7DED5]">
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-[#6F6963]">
                              No img
                            </div>
                          )}
                        </div>

                        {/* Item Details */}
                        <div className="flex-1 space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-[10px] uppercase font-bold text-[#9A6A45] tracking-wider">
                                {item.brand}
                              </p>
                              <h3 className="text-xs font-bold text-[#2A211B]">{item.name}</h3>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-bold text-[#2A211B]">
                                ₹{((item.lineSubtotal || 0) / 100).toLocaleString('en-IN')}
                              </p>
                              {item.lineMrp > item.lineSubtotal && (
                                <p className="text-[10px] text-[#6F6963] line-through">
                                  ₹{((item.lineMrp || 0) / 100).toLocaleString('en-IN')}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-[#6F6963]">
                            {item.color?.name && (
                              <span className="flex items-center gap-1">
                                <span
                                  className="w-2.5 h-2.5 rounded-full border border-black/20"
                                  style={{ backgroundColor: item.color.hex || '#000000' }}
                                />
                                {item.color.name}
                              </span>
                            )}
                            {item.size && <span>Size: {item.size}</span>}
                            <span>Qty: {item.quantity}</span>
                          </div>

                          {/* Item Error Badges */}
                          {hasError && (
                            <p className="text-[10px] font-bold text-red-600 pt-0.5">
                              {item.error === 'OUT_OF_STOCK' && 'Item Out of Stock'}
                              {item.error === 'INSUFFICIENT_STOCK' &&
                                `Only ${item.availableStock} Available`}
                              {item.error === 'PRODUCT_NOT_AVAILABLE' && 'Product No Longer Available'}
                              {item.error === 'VARIANT_NOT_AVAILABLE' && 'Variant No Longer Available'}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Section 3: Payment Method */}
              <div className="bg-white border border-[#E7DED5] rounded-3xl p-6 sm:p-7 space-y-4 shadow-xs">
                <div className="flex items-center gap-2 border-b border-[#E7DED5] pb-3">
                  <Banknote className="w-4 h-4 text-[#9A6A45]" />
                  <h2 className="text-sm font-serif font-bold text-[#2A211B]">
                    3. Payment Method
                  </h2>
                </div>

                <div className="space-y-3">
                  {/* Cash on Delivery (Active) */}
                  <label className="flex items-start gap-3 p-4 rounded-2xl border-2 border-[#9A6A45] bg-[#F7F3EE]/50 cursor-pointer transition-all">
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={true}
                      readOnly
                      className="mt-0.5 text-[#9A6A45] focus:ring-[#9A6A45]"
                    />
                    <div className="flex-1 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#2A211B]">Cash on Delivery (COD)</span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          Available
                        </span>
                      </div>
                      <p className="text-[11px] text-[#6F6963]">
                        Pay in cash or via UPI to the delivery courier upon arrival.
                      </p>
                    </div>
                  </label>

                  {/* Online Payment (Disabled Placeholder) */}
                  <div className="flex items-start gap-3 p-4 rounded-2xl border border-[#E7DED5] bg-gray-50/70 opacity-60">
                    <input type="radio" disabled className="mt-0.5 text-gray-400" />
                    <div className="flex-1 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[#6F6963]">
                          Online Payment (UPI, Credit/Debit Cards, Net Banking)
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-bold uppercase">
                          Coming Soon
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500">
                        Secure instant payment gateways will be enabled in upcoming phases.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Price Summary (4 Cols) */}
            <div className="lg:col-span-4 sticky top-24 space-y-4">
              <div className="bg-white border border-[#E7DED5] rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
                <h2 className="text-lg font-serif font-bold text-[#2A211B] border-b border-[#E7DED5] pb-3">
                  Price Details
                </h2>

                {/* Promo Coupon Widget */}
                <div className="space-y-2 border-b border-[#E7DED5] pb-5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#2A211B]">
                    Promotions & Coupons
                  </label>
                  <CouponInput
                    appliedCoupon={summary.coupon}
                    onApplyCoupon={handleApplyCoupon}
                    onRemoveCoupon={handleRemoveCoupon}
                    loading={couponLoading}
                    error={couponError}
                  />
                </div>

                <div className="space-y-3 text-xs text-[#6F6963]">
                  <div className="flex justify-between">
                    <span>Total MRP</span>
                    <span className="font-semibold text-[#2A211B]">
                      ₹{(summary.totalMrp / 100).toLocaleString('en-IN')}
                    </span>
                  </div>

                  {summary.totalSavings > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Bag Savings</span>
                      <span className="font-semibold">
                        - ₹{(summary.totalSavings / 100).toLocaleString('en-IN')}
                      </span>
                    </div>
                  )}

                  {summary.couponDiscount > 0 && (
                    <div className="flex justify-between text-emerald-700 font-semibold animate-in fade-in">
                      <span>Coupon Discount ({summary.coupon?.code})</span>
                      <span>- ₹{(summary.couponDiscount / 100).toLocaleString('en-IN')}</span>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span>Delivery Fee</span>
                    <span className="font-semibold text-emerald-700 uppercase">Free</span>
                  </div>

                  <div className="flex justify-between">
                    <span>Estimated Tax</span>
                    <span className="font-semibold text-[#2A211B]">₹0</span>
                  </div>

                  <div className="border-t border-[#E7DED5] pt-4 flex justify-between text-sm font-bold text-[#2A211B]">
                    <span>Total Amount</span>
                    <span>₹{(summary.grandTotal / 100).toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* Final Action Button */}
                <button
                  onClick={handlePlaceOrder}
                  disabled={!canPlaceOrder || placingOrder}
                  className="w-full py-3.5 rounded-xl bg-[#2A211B] text-white hover:bg-[#9A6A45] disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold uppercase tracking-wider transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-2"
                >
                  {placingOrder ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Placing Order...</span>
                    </>
                  ) : canPlaceOrder ? (
                    <span>Confirm & Place Order (COD)</span>
                  ) : (
                    <span>Resolve Warnings to Order</span>
                  )}
                </button>

                {/* Trust Badges */}
                <div className="pt-2 border-t border-[#E7DED5] space-y-2 text-[11px] text-[#6F6963]">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#9A6A45]" />
                    <span>100% Genuine Luxury Guarantee</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-[#9A6A45]" />
                    <span>Free Pan-India Delivery</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Address Selection Modal */}
      {addressModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-[#E7DED5] rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E7DED5] pb-4">
              <div>
                <h2 className="text-lg font-serif font-bold text-[#2A211B]">
                  Select Delivery Address
                </h2>
                <p className="text-xs text-[#6F6963] mt-0.5">
                  Choose a delivery destination for this checkout review.
                </p>
              </div>
              <button
                onClick={() => setAddressModalOpen(false)}
                className="text-xs font-semibold text-[#6F6963] hover:text-[#2A211B]"
              >
                Close
              </button>
            </div>

            {addresses.length === 0 ? (
              <div className="text-center py-6 space-y-3">
                <p className="text-xs text-[#6F6963]">No addresses found.</p>
                <Link
                  to="/account/addresses"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2A211B] text-white text-xs font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add New Address</span>
                </Link>
              </div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {addresses.map((addr) => {
                  const addrId = addr._id || addr.id;
                  const isSelected = (currentAddress?._id || currentAddress?.id) === addrId;

                  return (
                    <div
                      key={addrId}
                      onClick={() => handleSelectAddress(addrId)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                        isSelected
                          ? 'border-[#9A6A45] bg-[#F7F3EE]/60 ring-2 ring-[#9A6A45]/20'
                          : 'border-[#E7DED5] hover:border-[#2A211B]'
                      }`}
                    >
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#2A211B]">{addr.fullName}</span>
                          <span className="px-2 py-0.5 rounded-full bg-[#F7F3EE] border border-[#E7DED5] text-[10px] font-bold uppercase">
                            {addr.addressType}
                          </span>
                          {addr.isDefault && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-bold uppercase">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-[#6F6963]">+91 {addr.phone}</p>
                        <p className="text-[#2A211B]">
                          {addr.addressLine1}, {addr.city}, {addr.state} - {addr.postalCode}
                        </p>
                      </div>

                      {isSelected && <CheckCircle2 className="w-4 h-4 text-[#9A6A45] shrink-0 mt-1" />}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="pt-4 border-t border-[#E7DED5] flex items-center justify-between">
              <Link
                to="/account/addresses"
                className="text-xs font-semibold text-[#9A6A45] hover:text-[#2A211B] flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Manage / Add Addresses</span>
              </Link>
              <button
                onClick={() => setAddressModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-[#E7DED5] text-xs font-semibold text-[#2A211B]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
