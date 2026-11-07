import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import OrderTimeline from '../components/orders/OrderTimeline';
import CustomerTrackingCard from '../features/logistics/components/CustomerTrackingCard';
import OrderItemCard from '../components/orders/OrderItemCard';
import OrderPriceSummary from '../components/orders/OrderPriceSummary';
import { orderApi } from '../features/orders/api/orderApi';
import { getStatusConfig } from '../features/orders/constants/orderStatus';
import { useStoreSettings } from '../features/settings/context/useStoreSettings';
import {
  ArrowLeft,
  MapPin,
  Package,
  Calendar,
  RefreshCw,
  AlertTriangle,
  HelpCircle,
  Clock,
  XCircle,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';

export default function OrderDetailPage() {
  const { orderNumber } = useParams();
  const { settings } = useStoreSettings();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const minDeliveryDays = settings?.shipping?.deliveryEstimateDays?.min || 3;
  const maxDeliveryDays = settings?.shipping?.deliveryEstimateDays?.max || 7;

  // Cancellation modal & action state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState(null);
  const [cancelSuccess, setCancelSuccess] = useState(false);

  // Keyboard Escape listener for modal dismiss
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showCancelModal && !cancelling) {
        setShowCancelModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCancelModal, cancelling]);

  useEffect(() => {
    if (orderNumber) {
      let isMounted = true;
      setLoading(true);
      setError(null);

      orderApi
        .getOrderByNumber(orderNumber)
        .then((res) => {
          if (isMounted) {
            setOrder(res?.data?.order || null);
          }
        })
        .catch((err) => {
          if (isMounted) {
            setError(err.message || 'Order not found');
          }
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });

      return () => {
        isMounted = false;
      };
    }
  }, [orderNumber]);

  const formattedDate = order?.createdAt
    ? new Date(order.createdAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

  const statusConfig = getStatusConfig(order?.status);

  // Pre-fulfillment states eligible for customer self-service cancellation
  const isCancellable =
    order &&
    ['PLACED', 'CONFIRMED', 'PROCESSING'].includes((order.status || '').toUpperCase());

  const handleCancelOrder = async () => {
    if (cancelling || !order) return;
    setCancelling(true);
    setCancelError(null);

    try {
      const effectiveReason = customReason.trim() || cancelReason || 'Customer requested cancellation';
      const res = await orderApi.cancelOrder(order.orderNumber, { reason: effectiveReason });

      if (res?.data?.order) {
        setOrder(res.data.order);
      } else {
        const refreshed = await orderApi.getOrderByNumber(order.orderNumber);
        setOrder(refreshed?.data?.order || null);
      }
      setCancelSuccess(true);
      setTimeout(() => {
        setShowCancelModal(false);
        setCancelSuccess(false);
      }, 1200);
    } catch (err) {
      setCancelError(err?.response?.data?.message || err?.message || 'Failed to cancel order');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F3EE] text-[#171513] flex flex-col justify-between">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 w-full flex-1">
        {/* Breadcrumb & Navigation */}
        <div className="space-y-4 mb-8">
          <div className="flex items-center gap-2 text-xs text-[#6F6963]">
            <Link to="/" className="hover:text-[#2A211B]">
              Home
            </Link>
            <span>/</span>
            <Link to="/orders" className="hover:text-[#2A211B]">
              My Orders
            </Link>
            <span>/</span>
            <span className="text-[#2A211B] font-semibold">
              #{orderNumber}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#E7DED5] pb-4 gap-4">
            <div className="space-y-0.5">
              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#2A211B]">
                Order Details
              </h1>
              {order && (
                <p className="text-xs text-[#6F6963]">
                  Placed on {formattedDate} · Order #{order.orderNumber}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              {isCancellable && (
                <button
                  type="button"
                  onClick={() => {
                    setShowCancelModal(true);
                    setCancelError(null);
                    setCancelSuccess(false);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 text-xs font-semibold transition-colors cursor-pointer"
                  title={
                    order.cancellation?.status === 'FAILED_REQUIRES_ATTENTION'
                      ? 'Resume order cancellation'
                      : 'Cancel order before fulfillment'
                  }
                >
                  <XCircle className="w-3.5 h-3.5 text-red-600" />
                  <span>
                    {order.cancellation?.status === 'FAILED_REQUIRES_ATTENTION'
                      ? 'Retry Cancellation'
                      : 'Cancel Order'}
                  </span>
                </button>
              )}

              <Link
                to="/orders"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6F6963] hover:text-[#2A211B]"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to My Orders</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Cancellation Recovery Banner if in FAILED_REQUIRES_ATTENTION */}
        {order?.cancellation?.status === 'FAILED_REQUIRES_ATTENTION' && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-start gap-3 text-xs text-amber-900 shadow-xs animate-in fade-in">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">Cancellation Recovery Pending</p>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                A previous attempt to cancel this order encountered a downstream issue. You can click <strong>Retry Cancellation</strong> above to complete the process.
              </p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 text-[#9A6A45] animate-spin" />
            <p className="text-xs text-[#6F6963]">Retrieving order details...</p>
          </div>
        ) : error || !order ? (
          /* Error / 404 State */
          <div className="bg-white border border-[#E7DED5] rounded-3xl p-10 text-center space-y-4 max-w-md mx-auto shadow-xs">
            <div className="w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h2 className="text-base font-serif font-bold text-[#2A211B]">
              Order Not Found
            </h2>
            <p className="text-xs text-[#6F6963]">
              The requested order does not exist or you do not have permission to view it.
            </p>
            <Link
              to="/orders"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#2A211B] text-white hover:bg-[#9A6A45] text-xs font-semibold transition-colors"
            >
              <span>Return to My Orders</span>
            </Link>
          </div>
        ) : (
          /* Order Content */
          <div className="space-y-8 animate-in fade-in">
            {/* Visual Order Timeline */}
            <OrderTimeline
              status={order.status}
              createdAt={order.createdAt}
              statusHistory={order.statusHistory}
            />

            {/* Customer Doorstep Tracking Card (Demo Simulation) */}
            <CustomerTrackingCard order={order} />

            {/* Two-Column Detail Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
              {/* Left Column: Items & Delivery Snapshot (7 Cols) */}
              <div className="md:col-span-7 space-y-6">
                {/* Items List */}
                <div className="bg-white border border-[#E7DED5] rounded-3xl p-6 sm:p-7 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between border-b border-[#E7DED5] pb-4">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-[#9A6A45]" />
                      <h3 className="text-sm font-serif font-bold text-[#2A211B]">
                        Purchased Items ({order.items?.length || 0})
                      </h3>
                    </div>
                    <span className="text-xs text-[#6F6963]">
                      {order.pricing?.totalUnits || 0} total units
                    </span>
                  </div>

                  <div className="divide-y divide-[#E7DED5]">
                    {(order.items || []).map((item) => (
                      <OrderItemCard
                        key={item._id || item.variantId}
                        item={item}
                      />
                    ))}
                  </div>
                </div>

                {/* Historical Shipping Address Snapshot */}
                <div className="bg-white border border-[#E7DED5] rounded-3xl p-6 sm:p-7 space-y-3 shadow-xs">
                  <div className="flex items-center gap-2 border-b border-[#E7DED5] pb-3">
                    <MapPin className="w-4 h-4 text-[#9A6A45]" />
                    <h3 className="text-sm font-serif font-bold text-[#2A211B]">
                      Delivery Destination Snapshot
                    </h3>
                  </div>

                  <div className="text-xs text-[#2A211B] space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{order.shippingAddress?.fullName}</span>
                      <span className="px-2 py-0.5 rounded-full bg-[#F7F3EE] border border-[#E7DED5] text-[10px] font-bold uppercase">
                        {order.shippingAddress?.addressType}
                      </span>
                    </div>
                    <p className="text-[#6F6963]">+91 {order.shippingAddress?.phone}</p>
                    <p className="pt-0.5">
                      {order.shippingAddress?.addressLine1}
                      {order.shippingAddress?.addressLine2 && `, ${order.shippingAddress?.addressLine2}`}
                    </p>
                    {order.shippingAddress?.landmark && (
                      <p className="text-[#6F6963] italic">
                        Landmark: {order.shippingAddress?.landmark}
                      </p>
                    )}
                    <p className="font-medium">
                      {order.shippingAddress?.city}, {order.shippingAddress?.state} —{' '}
                      <span className="font-mono font-bold">
                        {order.shippingAddress?.postalCode}
                      </span>
                    </p>
                    <p className="text-[#6F6963]">{order.shippingAddress?.country}</p>
                    <div className="pt-2 border-t border-[#E7DED5] flex items-center gap-1.5 text-[11px] text-[#6F6963]">
                      <Clock className="w-3.5 h-3.5 text-[#9A6A45] shrink-0" />
                      <span>
                        {(order.status || '').toUpperCase() === 'DELIVERED'
                          ? 'Package delivered.'
                          : (order.status || '').toUpperCase() === 'CANCELLED'
                          ? 'Delivery cancelled.'
                          : order?.deliveryEstimate
                          ? `Estimated delivery: ${order.deliveryEstimate}`
                          : order?.estimatedDeliveryDate
                          ? `Estimated delivery by ${new Date(order.estimatedDeliveryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
                          : `Estimated delivery in ${minDeliveryDays}–${maxDeliveryDays} days after order confirmation.`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Price Breakdown & Assistance (5 Cols) */}
              <div className="md:col-span-5 space-y-6">
                <OrderPriceSummary pricing={order.pricing} payment={order.payment} />

                {/* Need Assistance Card */}
                <div className="bg-[#F7F3EE] border border-[#E7DED5] rounded-3xl p-5 text-xs text-[#6F6963] space-y-3">
                  <div className="flex items-center gap-2 font-bold text-[#2A211B]">
                    <HelpCircle className="w-4 h-4 text-[#9A6A45]" />
                    <span>Need Assistance with your Order?</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Our concierge support is at your service. For delivery inquiries or assistance, connect directly with our team.
                  </p>
                  <Link
                    to={`/support?orderNumber=${order.orderNumber}`}
                    className="inline-flex items-center justify-center w-full py-2 bg-[#2A211B] hover:bg-[#9A6A45] text-white rounded-xl font-semibold text-xs transition-colors shadow-2xs"
                  >
                    Contact Support
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Cancellation Confirmation Modal */}
        {showCancelModal && order && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-modal-title"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
          >
            <div className="bg-white rounded-3xl border border-[#E7DED5] p-6 sm:p-8 max-w-lg w-full space-y-5 shadow-2xl">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 id="cancel-modal-title" className="text-base font-serif font-bold text-[#2A211B]">
                      Cancel Order #{order.orderNumber}?
                    </h3>
                    <p className="text-xs text-[#6F6963] mt-0.5">
                      This action is permanent and cannot be reversed.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => !cancelling && setShowCancelModal(false)}
                  className="text-[#A8988B] hover:text-[#2A211B] p-1 rounded-lg cursor-pointer transition-colors"
                  aria-label="Close cancellation dialog"
                  disabled={cancelling}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 text-xs text-amber-900 space-y-1.5">
                <p className="font-semibold text-[11px] uppercase tracking-wider text-amber-950">
                  Inventory & Checkout Safeguards
                </p>
                <ul className="list-disc pl-4 space-y-1 text-amber-800 text-[11px] leading-relaxed">
                  <li>All reserved items will be released back to the store inventory.</li>
                  <li>Any promotional coupon used will be reinstated for your account.</li>
                  <li>As a Cash on Delivery order, no payment deduction occurred.</li>
                </ul>
              </div>

              {/* Cancellation Reason Selector */}
              <div className="space-y-2">
                <label htmlFor="cancel-reason-select" className="text-xs font-semibold text-[#2A211B] block">
                  Reason for cancellation (optional):
                </label>
                <select
                  id="cancel-reason-select"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  disabled={cancelling}
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-[#E7DED5] bg-[#F7F3EE] focus:outline-none focus:border-[#9A6A45] cursor-pointer"
                >
                  <option value="">Select a reason</option>
                  <option value="Changed my mind">Changed my mind</option>
                  <option value="Ordered by mistake">Ordered by mistake</option>
                  <option value="Delivery time is too long">Delivery time is too long</option>
                  <option value="Found a better price elsewhere">Found a better price elsewhere</option>
                  <option value="Need to change delivery address">Need to change delivery address</option>
                  <option value="Other">Other</option>
                </select>

                {cancelReason === 'Other' && (
                  <input
                    type="text"
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Please specify your reason..."
                    maxLength={200}
                    disabled={cancelling}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-[#E7DED5] bg-[#F7F3EE] focus:outline-none focus:border-[#9A6A45] mt-2"
                  />
                )}
              </div>

              {cancelError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{cancelError}</span>
                </div>
              )}

              {cancelSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>Order cancelled successfully. Updating order details...</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E7DED5]">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  disabled={cancelling}
                  className="px-4 py-2 rounded-xl border border-[#E7DED5] text-xs font-semibold text-[#6F6963] hover:text-[#2A211B] hover:bg-[#F7F3EE] transition-colors cursor-pointer"
                >
                  Keep Order
                </button>

                <button
                  type="button"
                  onClick={handleCancelOrder}
                  disabled={cancelling || cancelSuccess}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-xs cursor-pointer"
                >
                  {cancelling ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Cancelling...</span>
                    </>
                  ) : (
                    <span>Yes, Cancel Order</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
