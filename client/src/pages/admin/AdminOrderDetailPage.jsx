import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import { adminOrderApi } from '../../features/admin/orders/api/adminOrderApi';
import { getStatusConfig } from '../../features/orders/constants/orderStatus';
import {
  ArrowLeft,
  User,
  MapPin,
  Package,
  Banknote,
  ShieldCheck,
  Calendar,
  RefreshCw,
  AlertTriangle,
  Info,
  Clock,
  CheckCircle2,
  Truck,
  XCircle,
  AlertCircle,
  FileText,
} from 'lucide-react';

export default function AdminOrderDetailPage() {
  const { orderNumber } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Status Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState(null);

  const fetchOrder = () => {
    if (!orderNumber) return;
    setLoading(true);
    setError(null);

    adminOrderApi
      .getAdminOrder(orderNumber)
      .then((res) => {
        setOrder(res?.data?.order || null);
      })
      .catch((err) => {
        setError(err.message || 'Order not found');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchOrder();
  }, [orderNumber]);

  const handleOpenStatusModal = (status) => {
    setTargetStatus(status);
    setStatusNote('');
    setUpdateError(null);
    setModalOpen(true);
  };

  const handleConfirmStatusUpdate = async () => {
    if (!targetStatus) return;
    setUpdating(true);
    setUpdateError(null);

    try {
      const res = await adminOrderApi.updateOrderStatus(orderNumber, {
        status: targetStatus,
        note: statusNote.trim() || undefined,
      });

      if (res?.data?.order) {
        setOrder(res.data.order);
      }
      setModalOpen(false);
    } catch (err) {
      setUpdateError(err.message || 'Failed to update order status');
    } finally {
      setUpdating(false);
    }
  };

  const formattedDate = order?.createdAt
    ? new Date(order.createdAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  const statusConfig = getStatusConfig(order?.status);

  const grandTotalRupees = ((order?.pricing?.grandTotal || 0) / 100).toLocaleString('en-IN');
  const subtotalRupees = ((order?.pricing?.subtotal || 0) / 100).toLocaleString('en-IN');
  const totalMrpRupees = ((order?.pricing?.totalMrp || 0) / 100).toLocaleString('en-IN');
  const totalSavingsRupees = ((order?.pricing?.totalSavings || 0) / 100).toLocaleString('en-IN');

  const isTerminal = order?.status === 'DELIVERED' || order?.status === 'CANCELLED';

  return (
    <AdminLayout>
      {/* Breadcrumb & Navigation */}
      <div className="space-y-4 border-b border-[#E7DED5] pb-6">
        <div className="flex items-center gap-2 text-xs text-[#6F6963]">
          <Link to="/admin" className="hover:text-[#2A211B]">
            Dashboard
          </Link>
          <span>/</span>
          <Link to="/admin/orders" className="hover:text-[#2A211B]">
            Orders & Fulfillment
          </Link>
          <span>/</span>
          <span className="text-[#2A211B] font-semibold">#{orderNumber}</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#2A211B]">
                Order #{orderNumber}
              </h1>
              {order && (
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${statusConfig.colorClass}`}
                >
                  {statusConfig.badgeText}
                </span>
              )}
            </div>
            {order && (
              <p className="text-xs text-[#6F6963]">
                Placed on {formattedDate} · Order ID: {order._id}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchOrder}
              className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white border border-[#E7DED5] text-[#2A211B] hover:bg-[#F7F3EE] text-xs font-semibold transition-colors cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <Link
              to="/admin/orders"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-[#E7DED5] text-[#2A211B] hover:bg-[#F7F3EE] text-xs font-semibold transition-colors shadow-xs self-start sm:self-auto"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Orders</span>
            </Link>
          </div>
        </div>
      </div>

      {loading && !order ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-8 h-8 text-[#9A6A45] animate-spin" />
          <p className="text-xs text-[#6F6963]">Retrieving order record from database...</p>
        </div>
      ) : error || !order ? (
        <div className="bg-white border border-[#E7DED5] rounded-3xl p-10 text-center space-y-4 max-w-md mx-auto shadow-xs">
          <div className="w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h2 className="text-base font-serif font-bold text-[#2A211B]">Order Not Found</h2>
          <p className="text-xs text-[#6F6963]">
            {error || 'The requested order number does not exist in the database.'}
          </p>
          <Link
            to="/admin/orders"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#2A211B] text-white hover:bg-[#9A6A45] text-xs font-semibold transition-colors"
          >
            <span>Return to Orders List</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in">
          {/* Status Management Action Bar (Phase 7C) */}
          <div className="bg-white border border-[#E7DED5] rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E7DED5] pb-4">
              <div>
                <h2 className="text-sm font-serif font-bold text-[#2A211B]">
                  Fulfillment Status Management
                </h2>
                <p className="text-xs text-[#6F6963]">
                  Authoritative order state machine controls with atomic audit logging.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-[#6F6963]">Current State:</span>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusConfig.colorClass}`}
                >
                  {statusConfig.badgeText}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              {order.status === 'PLACED' && (
                <>
                  <button
                    onClick={() => handleOpenStatusModal('CONFIRMED')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm Order</span>
                  </button>
                  <button
                    onClick={() => handleOpenStatusModal('CANCELLED')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-red-300 text-red-600 hover:bg-red-50 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Cancel Order</span>
                  </button>
                </>
              )}

              {order.status === 'CONFIRMED' && (
                <>
                  <button
                    onClick={() => handleOpenStatusModal('PROCESSING')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                  >
                    <Package className="w-4 h-4" />
                    <span>Start Processing / Packaging</span>
                  </button>
                  <button
                    onClick={() => handleOpenStatusModal('CANCELLED')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-red-300 text-red-600 hover:bg-red-50 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Cancel Order</span>
                  </button>
                </>
              )}

              {order.status === 'PROCESSING' && (
                <>
                  <button
                    onClick={() => handleOpenStatusModal('SHIPPED')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 text-white hover:bg-purple-700 text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                  >
                    <Truck className="w-4 h-4" />
                    <span>Mark as Dispatched & Shipped</span>
                  </button>
                  <button
                    onClick={() => handleOpenStatusModal('CANCELLED')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-red-300 text-red-600 hover:bg-red-50 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Cancel Order</span>
                  </button>
                </>
              )}

              {order.status === 'SHIPPED' && (
                <button
                  onClick={() => handleOpenStatusModal('DELIVERED')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Mark as Delivered & Collected (COD Paid)</span>
                </button>
              )}

              {order.status === 'DELIVERED' && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Order is successfully fulfilled and delivered. Payment marked as Paid. (Terminal State)</span>
                </div>
              )}

              {order.status === 'CANCELLED' && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <span>Order has been cancelled. Catalog inventory was atomically restored. (Terminal State)</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Customer Details, Ordered Items & Address (7 Cols) */}
            <div className="lg:col-span-7 space-y-6">
              {/* Customer Profile Card */}
              <div className="bg-white border border-[#E7DED5] rounded-3xl p-6 space-y-4 shadow-xs">
                <div className="flex items-center gap-2 border-b border-[#E7DED5] pb-3">
                  <User className="w-4 h-4 text-[#9A6A45]" />
                  <h2 className="text-sm font-serif font-bold text-[#2A211B]">Customer Profile</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-[#6F6963] block text-[10px] uppercase font-semibold">
                      Full Name
                    </span>
                    <span className="font-bold text-[#2A211B] text-sm">
                      {order.customer?.name || 'Customer'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[#6F6963] block text-[10px] uppercase font-semibold">
                      Email Address
                    </span>
                    <span className="font-mono text-[#2A211B]">{order.customer?.email}</span>
                  </div>

                  <div>
                    <span className="text-[#6F6963] block text-[10px] uppercase font-semibold">
                      Phone Number
                    </span>
                    <span className="font-mono text-[#2A211B]">
                      {order.customer?.phone ? `+91 ${order.customer.phone}` : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status History Audit Trail Timeline (Phase 7C) */}
              <div className="bg-white border border-[#E7DED5] rounded-3xl p-6 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-[#E7DED5] pb-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#9A6A45]" />
                    <h2 className="text-sm font-serif font-bold text-[#2A211B]">
                      Status History & Audit Trail
                    </h2>
                  </div>
                  <span className="text-[11px] text-[#6F6963]">
                    {order.statusHistory?.length || 1} recorded event(s)
                  </span>
                </div>

                <div className="space-y-4 relative before:absolute before:left-3.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-[#E7DED5]">
                  {(order.statusHistory && order.statusHistory.length > 0
                    ? order.statusHistory
                    : [
                        {
                          status: order.status || 'PLACED',
                          changedAt: order.createdAt,
                          note: 'Initial order placement',
                        },
                      ]
                  ).map((event, idx) => {
                    const eventConfig = getStatusConfig(event.status);
                    const eventDate = event.changedAt
                      ? new Date(event.changedAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'N/A';

                    return (
                      <div key={event._id || idx} className="flex items-start gap-4 relative z-10">
                        <div className="w-7 h-7 rounded-full bg-white border-2 border-[#9A6A45] flex items-center justify-center shrink-0">
                          <div className="w-2 h-2 rounded-full bg-[#9A6A45]" />
                        </div>

                        <div className="flex-1 bg-[#F7F3EE]/60 border border-[#E7DED5] rounded-2xl p-3.5 text-xs space-y-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${eventConfig.colorClass}`}
                            >
                              {eventConfig.badgeText}
                            </span>
                            <span className="text-[11px] text-[#6F6963] font-mono">{eventDate}</span>
                          </div>

                          {event.note && (
                            <p className="text-[#2A211B] pt-1 italic text-[11px]">
                              "{event.note}"
                            </p>
                          )}

                          {event.changedBy && (
                            <p className="text-[10px] text-[#9A6A45] font-semibold pt-0.5">
                              Action by: {event.changedBy?.name || 'Store Administrator'}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Ordered Items Snapshot Card */}
              <div className="bg-white border border-[#E7DED5] rounded-3xl p-6 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-[#E7DED5] pb-3">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-[#9A6A45]" />
                    <h2 className="text-sm font-serif font-bold text-[#2A211B]">
                      Ordered Items Snapshot ({order.items?.length || 0})
                    </h2>
                  </div>
                  <span className="text-xs text-[#6F6963]">
                    {order.pricing?.totalUnits || 0} total units
                  </span>
                </div>

                <div className="divide-y divide-[#E7DED5]">
                  {(order.items || []).map((item) => (
                    <div
                      key={item._id || item.variantId}
                      className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-14 h-16 rounded-xl bg-[#F7F3EE] border border-[#E7DED5] overflow-hidden shrink-0 flex items-center justify-center">
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="w-4 h-4 text-[#9A6A45]" />
                          )}
                        </div>

                        <div className="space-y-0.5">
                          <p className="text-[10px] uppercase font-bold text-[#9A6A45] tracking-wider">
                            {item.brand}
                          </p>
                          <h3 className="text-xs font-bold text-[#2A211B]">{item.name}</h3>
                          <p className="text-[11px] font-mono text-[#6F6963]">SKU: {item.sku}</p>

                          <div className="flex items-center gap-3 text-[11px] text-[#6F6963] pt-0.5">
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
                            <span>Qty: <strong>{item.quantity}</strong></span>
                          </div>
                        </div>
                      </div>

                      <div className="text-left sm:text-right">
                        <span className="text-xs font-bold text-[#2A211B] block">
                          ₹{((item.lineSubtotal || 0) / 100).toLocaleString('en-IN')}
                        </span>
                        <span className="text-[10px] text-[#6F6963]">
                          ₹{((item.unitPrice || 0) / 100).toLocaleString('en-IN')} × {item.quantity}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Delivery Address Snapshot Card */}
              <div className="bg-white border border-[#E7DED5] rounded-3xl p-6 space-y-3 shadow-xs">
                <div className="flex items-center gap-2 border-b border-[#E7DED5] pb-3">
                  <MapPin className="w-4 h-4 text-[#9A6A45]" />
                  <h2 className="text-sm font-serif font-bold text-[#2A211B]">
                    Delivery Destination Snapshot
                  </h2>
                </div>

                <div className="text-xs text-[#2A211B] space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{order.shippingAddress?.fullName}</span>
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
                    <span className="font-mono font-bold">{order.shippingAddress?.postalCode}</span>
                  </p>
                  <p className="text-[#6F6963]">{order.shippingAddress?.country}</p>
                </div>
              </div>
            </div>

            {/* Right Column: Payment & Price Summary (5 Cols) */}
            <div className="lg:col-span-5 space-y-6">
              {/* Payment Card */}
              <div className="bg-white border border-[#E7DED5] rounded-3xl p-6 space-y-4 shadow-xs">
                <div className="flex items-center gap-2 border-b border-[#E7DED5] pb-3">
                  <Banknote className="w-4 h-4 text-[#9A6A45]" />
                  <h2 className="text-sm font-serif font-bold text-[#2A211B]">Payment Information</h2>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-[#6F6963]">Payment Method</span>
                    <span className="font-semibold text-[#2A211B]">Cash on Delivery (COD)</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-[#6F6963]">Collection Status</span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        order.payment?.status === 'PAID'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {order.payment?.status === 'PAID' ? 'Collected / Paid' : 'Pending Delivery Handover'}
                    </span>
                  </div>

                  <div className="p-3 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-[11px] text-[#6F6963]">
                    {order.payment?.status === 'PAID'
                      ? 'Full payment collected upon customer delivery.'
                      : 'Delivery courier will collect exact cash amount or UPI upon customer parcel handover.'}
                  </div>
                </div>
              </div>

              {/* Financial Summary Card */}
              <div className="bg-white border border-[#E7DED5] rounded-3xl p-6 space-y-6 shadow-xs">
                <h2 className="text-base font-serif font-bold text-[#2A211B] border-b border-[#E7DED5] pb-3">
                  Financial Breakdown
                </h2>

                <div className="space-y-3 text-xs text-[#6F6963]">
                  <div className="flex justify-between">
                    <span>Total MRP</span>
                    <span className="font-semibold text-[#2A211B]">₹{totalMrpRupees}</span>
                  </div>

                  {order.pricing?.totalSavings > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Bag Savings</span>
                      <span className="font-semibold">- ₹{totalSavingsRupees}</span>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="font-semibold text-[#2A211B]">₹{subtotalRupees}</span>
                  </div>

                  <div className="flex justify-between">
                    <span>Delivery Fee</span>
                    <span className="font-semibold text-emerald-700 uppercase">FREE</span>
                  </div>

                  <div className="flex justify-between">
                    <span>Estimated Tax</span>
                    <span className="font-semibold text-[#2A211B]">₹0</span>
                  </div>

                  <div className="border-t border-[#E7DED5] pt-3 flex justify-between text-sm font-bold text-[#2A211B]">
                    <span>Grand Total</span>
                    <span>₹{grandTotalRupees}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#E7DED5] text-[11px] text-[#6F6963] space-y-1.5">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#9A6A45]" />
                    <span>LuxeCart Authoritative Financial Snapshot</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Transition Confirmation Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white border border-[#E7DED5] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 animate-in fade-in zoom-in-95">
            <div className="space-y-2">
              <h3 className="text-lg font-serif font-bold text-[#2A211B]">
                Confirm Order Status Change
              </h3>
              <p className="text-xs text-[#6F6963]">
                Transition order <strong className="text-[#2A211B]">#{orderNumber}</strong> from{' '}
                <strong className="text-blue-700">{order?.status}</strong> to{' '}
                <strong className="text-emerald-700">{targetStatus}</strong>.
              </p>
            </div>

            {targetStatus === 'CANCELLED' && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  <strong>Warning:</strong> Cancelling this order will atomically restore all{' '}
                  <strong>{order?.pricing?.totalUnits || 0} unit(s)</strong> back into catalog inventory.
                  This action cannot be undone.
                </p>
              </div>
            )}

            {targetStatus === 'DELIVERED' && (
              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl text-blue-900 text-xs flex items-start gap-2.5">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p>
                  Marking as delivered will automatically update Cash on Delivery collection status to{' '}
                  <strong>PAID</strong>.
                </p>
              </div>
            )}

            {updateError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
                {updateError}
              </div>
            )}

            {/* Optional Note Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#2A211B] flex items-center justify-between">
                <span>Transition Audit Note (Optional)</span>
                <span className="text-[10px] text-[#6F6963]">{statusNote.length}/500</span>
              </label>
              <textarea
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value.slice(0, 500))}
                placeholder="e.g. Dispatched with BlueDart AWB #987654321..."
                rows={3}
                className="w-full p-3 rounded-xl bg-[#F7F3EE] border border-[#E7DED5] text-xs text-[#2A211B] placeholder-[#6F6963] focus:outline-hidden focus:border-[#9A6A45] focus:bg-white resize-none"
              />
            </div>

            {/* Modal Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#E7DED5]">
              <button
                onClick={() => setModalOpen(false)}
                disabled={updating}
                className="px-4 py-2.5 rounded-xl bg-[#F7F3EE] text-[#6F6963] hover:bg-[#E7DED5] text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmStatusUpdate}
                disabled={updating}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs ${
                  targetStatus === 'CANCELLED'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-[#2A211B] hover:bg-[#9A6A45]'
                }`}
              >
                {updating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Committing Transition...</span>
                  </>
                ) : (
                  <span>Confirm Status Update</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
