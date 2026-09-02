import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import OrderTimeline from '../components/orders/OrderTimeline';
import OrderItemCard from '../components/orders/OrderItemCard';
import OrderPriceSummary from '../components/orders/OrderPriceSummary';
import { orderApi } from '../features/orders/api/orderApi';
import { getStatusConfig } from '../features/orders/constants/orderStatus';
import {
  ArrowLeft,
  MapPin,
  Package,
  Calendar,
  RefreshCw,
  AlertTriangle,
  HelpCircle,
  Clock,
} from 'lucide-react';

export default function OrderDetailPage() {
  const { orderNumber } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

          <div className="flex items-center justify-between border-b border-[#E7DED5] pb-4">
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

            <Link
              to="/orders"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6F6963] hover:text-[#2A211B]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to My Orders</span>
            </Link>
          </div>
        </div>

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
      </main>
    </div>
  );
}
