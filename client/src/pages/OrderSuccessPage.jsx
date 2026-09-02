import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { orderApi } from '../features/orders/api/orderApi';
import { useOrder } from '../features/orders/context/OrderContext';
import {
  CheckCircle2,
  Package,
  MapPin,
  Banknote,
  Truck,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  ShoppingBag,
} from 'lucide-react';

export default function OrderSuccessPage() {
  const { orderNumber } = useParams();
  const { currentOrder } = useOrder();
  const [order, setOrder] = useState(
    currentOrder && currentOrder.orderNumber === orderNumber ? currentOrder : null
  );
  const [loading, setLoading] = useState(!order);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!order && orderNumber) {
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
            setError(err.message || 'Failed to load order details');
          }
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });

      return () => {
        isMounted = false;
      };
    }
  }, [orderNumber, order]);

  return (
    <div className="min-h-screen bg-[#F7F3EE] text-[#171513] flex flex-col justify-between">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 w-full flex-1">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 text-[#9A6A45] animate-spin" />
            <p className="text-xs text-[#6F6963]">Retrieving order confirmation snapshot...</p>
          </div>
        ) : error ? (
          <div className="bg-white border border-[#E7DED5] rounded-3xl p-10 text-center space-y-4 max-w-md mx-auto shadow-xs">
            <div className="w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h1 className="text-lg font-serif font-bold text-[#2A211B]">Order Not Found</h1>
            <p className="text-xs text-[#6F6963]">{error}</p>
            <Link
              to="/shop"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#2A211B] text-white hover:bg-[#9A6A45] text-xs font-semibold transition-colors"
            >
              <span>Explore Catalog</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : order ? (
          <div className="space-y-8 animate-in fade-in">
            {/* Celebration Header */}
            <div className="bg-white border border-[#E7DED5] rounded-3xl p-8 sm:p-10 text-center space-y-4 shadow-xs relative overflow-hidden">
              <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div>
                <span className="text-[11px] uppercase font-bold tracking-widest text-[#9A6A45]">
                  Order Confirmed
                </span>
                <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#2A211B] mt-1">
                  Thank You for Your Order
                </h1>
                <p className="text-xs text-[#6F6963] mt-2 max-w-md mx-auto">
                  Your luxury items have been reserved. We are preparing your shipment for express delivery.
                </p>
              </div>

              {/* Order Number & Meta Box */}
              <div className="inline-flex flex-col sm:flex-row items-center gap-3 sm:gap-6 bg-[#F7F3EE] border border-[#E7DED5] px-6 py-3.5 rounded-2xl text-xs">
                <div>
                  <span className="text-[#6F6963]">Order Number: </span>
                  <span className="font-mono font-bold text-[#2A211B] tracking-wider">
                    {order.orderNumber}
                  </span>
                </div>
                <span className="hidden sm:inline text-[#E7DED5]">|</span>
                <div className="flex items-center gap-1.5">
                  <Banknote className="w-4 h-4 text-[#9A6A45]" />
                  <span className="font-semibold text-[#2A211B]">Cash on Delivery</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold uppercase">
                    Pending Handover
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
              {/* Left Column: Delivery Snapshot & Items (7 Cols) */}
              <div className="md:col-span-7 space-y-6">
                {/* Delivery Snapshot */}
                <div className="bg-white border border-[#E7DED5] rounded-3xl p-6 space-y-3 shadow-xs">
                  <div className="flex items-center gap-2 border-b border-[#E7DED5] pb-3">
                    <MapPin className="w-4 h-4 text-[#9A6A45]" />
                    <h2 className="text-sm font-serif font-bold text-[#2A211B]">
                      Delivery Destination Snapshot
                    </h2>
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

                {/* Ordered Items Snapshot */}
                <div className="bg-white border border-[#E7DED5] rounded-3xl p-6 space-y-4 shadow-xs">
                  <div className="flex items-center gap-2 border-b border-[#E7DED5] pb-3">
                    <Package className="w-4 h-4 text-[#9A6A45]" />
                    <h2 className="text-sm font-serif font-bold text-[#2A211B]">
                      Purchased Items Snapshot ({order.items?.length || 0})
                    </h2>
                  </div>

                  <div className="divide-y divide-[#E7DED5]">
                    {(order.items || []).map((item) => (
                      <div key={item._id || item.variantId} className="py-3.5 flex gap-4 items-center">
                        <div className="w-14 h-16 rounded-xl bg-[#F7F3EE] border border-[#E7DED5] overflow-hidden shrink-0">
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] text-[#6F6963]">
                              Luxe
                            </div>
                          )}
                        </div>

                        <div className="flex-1 space-y-0.5">
                          <p className="text-[10px] uppercase font-bold text-[#9A6A45] tracking-wider">
                            {item.brand}
                          </p>
                          <h3 className="text-xs font-bold text-[#2A211B]">{item.name}</h3>
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
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Financial Summary & Actions (5 Cols) */}
              <div className="md:col-span-5 space-y-6">
                <div className="bg-white border border-[#E7DED5] rounded-3xl p-6 space-y-6 shadow-xs">
                  <h2 className="text-base font-serif font-bold text-[#2A211B] border-b border-[#E7DED5] pb-3">
                    Payment Breakdown
                  </h2>

                  <div className="space-y-3 text-xs text-[#6F6963]">
                    <div className="flex justify-between">
                      <span>Total MRP</span>
                      <span className="font-semibold text-[#2A211B]">
                        ₹{((order.pricing?.totalMrp || 0) / 100).toLocaleString('en-IN')}
                      </span>
                    </div>

                    {order.pricing?.totalSavings > 0 && (
                      <div className="flex justify-between text-emerald-700">
                        <span>Bag Savings</span>
                        <span className="font-semibold">
                          - ₹{((order.pricing?.totalSavings || 0) / 100).toLocaleString('en-IN')}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between">
                      <span>Delivery Fee</span>
                      <span className="font-semibold text-emerald-700 uppercase">FREE</span>
                    </div>

                    <div className="flex justify-between">
                      <span>Estimated Tax</span>
                      <span className="font-semibold text-[#2A211B]">₹0</span>
                    </div>

                    <div className="border-t border-[#E7DED5] pt-3 flex justify-between text-sm font-bold text-[#2A211B]">
                      <span>Amount Payable (COD)</span>
                      <span>₹{((order.pricing?.grandTotal || 0) / 100).toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 text-amber-900 text-[11px] space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      <Banknote className="w-3.5 h-3.5 text-amber-700" />
                      <span>Cash on Delivery Notice</span>
                    </p>
                    <p>
                      Please have the exact cash amount or UPI payment app ready when our courier arrives with your parcel.
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    <Link
                      to={`/orders/${order.orderNumber}`}
                      className="w-full py-3.5 rounded-xl bg-[#2A211B] text-white hover:bg-[#9A6A45] text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors shadow-xs"
                    >
                      <Package className="w-4 h-4" />
                      <span>Track Order Progress</span>
                    </Link>

                    <Link
                      to="/orders"
                      className="w-full py-3 rounded-xl border border-[#E7DED5] bg-white hover:bg-[#F7F3EE] text-[#2A211B] text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
                    >
                      <span>View All Orders</span>
                    </Link>

                    <Link
                      to="/shop"
                      className="w-full py-2.5 text-center text-xs text-[#6F6963] hover:text-[#2A211B] font-medium flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <span>Continue Shopping</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  <div className="pt-2 border-t border-[#E7DED5] space-y-2 text-[11px] text-[#6F6963]">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-[#9A6A45]" />
                      <span>Authenticity Guaranteed</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-[#9A6A45]" />
                      <span>Express Insured Shipping</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
