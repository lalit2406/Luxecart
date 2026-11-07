import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import CustomerStatusModal from '../../features/admin/customers/components/CustomerStatusModal';
import { getCustomerStatusBadge } from '../../features/admin/customers/components/AdminCustomerTable';
import { getStatusConfig } from '../../features/orders/constants/orderStatus';
import { adminCustomerApi } from '../../features/admin/customers/api/adminCustomerApi';
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Calendar,
  Shield,
  ShoppingBag,
  IndianRupee,
  MapPin,
  Clock,
  ExternalLink,
  AlertTriangle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  History,
  FileText,
  Home,
  Briefcase,
} from 'lucide-react';

export default function AdminCustomerDetailPage() {
  const { id } = useParams();

  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorCode, setErrorCode] = useState(null);

  // Orders pagination
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersPagination, setOrdersPagination] = useState({ page: 1, pages: 1, total: 0, limit: 10 });
  const [ordersPage, setOrdersPage] = useState(1);

  // Status Modal State
  const [statusModalOpen, setStatusModalOpen] = useState(false);

  // Fetch full customer profile
  const fetchCustomerProfile = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setErrorCode(null);

    try {
      const res = await adminCustomerApi.getCustomerById(id);
      setCustomer(res?.data?.customer || null);
    } catch (err) {
      setError(err.message || 'Failed to load customer profile');
      setErrorCode(err.code || (err.statusCode === 403 ? 'CANNOT_MODIFY_ADMIN_ACCOUNT' : 'LOAD_ERROR'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Fetch paginated orders
  const fetchCustomerOrders = useCallback(async (page = 1) => {
    if (!id) return;
    setOrdersLoading(true);

    try {
      const res = await adminCustomerApi.getCustomerOrders(id, { page, limit: 10 });
      setOrders(res?.data?.orders || []);
      setOrdersPagination(res?.data?.pagination || { page: 1, pages: 1, total: 0, limit: 10 });
    } catch (err) {
      // Non-critical, let profile remain visible
      console.error('Failed to load customer order history:', err);
    } finally {
      setOrdersLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCustomerProfile();
  }, [fetchCustomerProfile]);

  useEffect(() => {
    if (customer && customer.role !== 'ADMIN') {
      fetchCustomerOrders(ordersPage);
    }
  }, [customer, ordersPage, fetchCustomerOrders]);

  const handleStatusUpdated = (updatedCustomer) => {
    setCustomer((prev) => ({
      ...prev,
      status: updatedCustomer.status,
      statusHistory: updatedCustomer.statusHistory || prev.statusHistory,
    }));
  };

  // Loading Skeleton
  if (loading) {
    return (
      <AdminLayout>
        <div className="space-y-6 max-w-6xl mx-auto animate-pulse">
          <div className="h-6 w-36 bg-[#E7DED5]/60 rounded-md" />
          <div className="h-44 bg-white border border-[#E7DED5] rounded-3xl p-6" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="h-28 bg-white border border-[#E7DED5] rounded-3xl" />
            <div className="h-28 bg-white border border-[#E7DED5] rounded-3xl" />
            <div className="h-28 bg-white border border-[#E7DED5] rounded-3xl" />
          </div>
          <div className="h-64 bg-white border border-[#E7DED5] rounded-3xl" />
        </div>
      </AdminLayout>
    );
  }

  // Admin Protection Error Card
  if (errorCode === 'CANNOT_MODIFY_ADMIN_ACCOUNT') {
    return (
      <AdminLayout>
        <div className="max-w-2xl mx-auto my-12 bg-white border border-rose-200 rounded-3xl p-8 text-center shadow-xs space-y-4">
          <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-[#2A211B]">Administrator Account Protection</h2>
          <p className="text-xs text-[#6F6963] leading-relaxed max-w-md mx-auto">
            This account belongs to an administrator. To maintain strict security boundaries and role isolation, administrator accounts cannot be viewed, queried, or modified through the customer management module.
          </p>
          <div className="pt-2">
            <Link
              to="/admin/customers"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2A211B] text-[#FAF7F2] text-xs font-semibold hover:bg-[#9A6A45] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Customers Directory</span>
            </Link>
          </div>
        </div>
      </AdminLayout>
    );
  }

  // Generic Error State
  if (error || !customer) {
    return (
      <AdminLayout>
        <div className="max-w-xl mx-auto my-12 bg-white border border-red-200 rounded-3xl p-8 text-center shadow-xs space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-[#2A211B]">Customer Profile Not Found</h2>
          <p className="text-xs text-[#6F6963]">{error || 'The requested customer profile does not exist.'}</p>
          <div className="pt-2 flex items-center justify-center gap-3">
            <Link
              to="/admin/customers"
              className="px-4 py-2 rounded-xl bg-[#F7F3EE] text-[#2A211B] text-xs font-semibold hover:bg-[#E7DED5] transition-colors"
            >
              Back to Directory
            </Link>
            <button
              type="button"
              onClick={fetchCustomerProfile}
              className="px-4 py-2 rounded-xl bg-[#2A211B] text-white text-xs font-semibold hover:bg-[#9A6A45] transition-colors cursor-pointer"
            >
              Try Again
            </button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const statusBadge = getCustomerStatusBadge(customer.status);
  const StatusIcon = statusBadge.icon;

  const initials = (customer.name || 'C')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const joinedDateFormatted = customer.createdAt
    ? new Date(customer.createdAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  const orderSummary = customer.orderSummary || { totalOrders: 0, totalSpentPaise: 0, lastOrderDate: null };
  const lifetimeSpentRupees = ((orderSummary.totalSpentPaise || 0) / 100).toLocaleString('en-IN');
  const lastOrderDateFormatted = orderSummary.lastOrderDate
    ? new Date(orderSummary.lastOrderDate).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  const addresses = customer.addresses || [];
  const statusHistory = customer.statusHistory || [];

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Navigation / Back link */}
        <div className="flex items-center justify-between">
          <Link
            to="/admin/customers"
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#6F6963] hover:text-[#2A211B] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Customers Directory</span>
          </Link>

          <button
            type="button"
            onClick={() => {
              fetchCustomerProfile();
              fetchCustomerOrders(ordersPage);
            }}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#E7DED5] text-xs font-semibold text-[#2A211B] hover:bg-[#F7F3EE] transition-colors cursor-pointer shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Customer Header Profile Card */}
        <div className="bg-white border border-[#E7DED5] rounded-3xl p-6 sm:p-7 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-2xl bg-[#2A211B] text-[#FAF7F2] flex items-center justify-center font-bold text-xl tracking-wider shrink-0 shadow-md">
                {initials}
              </div>

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-xl sm:text-2xl font-bold text-[#2A211B]">
                    {customer.name}
                  </h1>
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${statusBadge.bg} ${statusBadge.text} ${statusBadge.border}`}
                  >
                    <StatusIcon className="w-3.5 h-3.5 shrink-0" />
                    <span>{statusBadge.label}</span>
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#6F6963]">
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-[#9A6A45]" />
                    <span className="text-[#2A211B]">{customer.email}</span>
                  </div>
                  {customer.phone && (
                    <div className="flex items-center gap-1.5 font-mono">
                      <Phone className="w-3.5 h-3.5 text-[#9A6A45]" />
                      <span>{customer.phone.startsWith('+91') ? customer.phone : `+91 ${customer.phone}`}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#9A6A45]" />
                    <span>Member since {joinedDateFormatted}</span>
                  </div>
                </div>

                <div className="text-[11px] text-[#6F6963] font-mono pt-0.5">
                  ID: <span className="text-[#2A211B]">{customer.id}</span>
                </div>
              </div>
            </div>

            {/* Change Status Action */}
            <button
              type="button"
              onClick={() => setStatusModalOpen(true)}
              className="self-start sm:self-center px-4 py-2.5 rounded-xl bg-[#2A211B] text-[#FAF7F2] hover:bg-[#9A6A45] text-xs font-semibold transition-all shadow-xs cursor-pointer inline-flex items-center gap-2"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Change Account Status</span>
            </button>
          </div>
        </div>

        {/* Lifetime Metrics Summary Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {/* Total Orders */}
          <div className="bg-white border border-[#E7DED5] rounded-3xl p-5 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-[#9A6A45] flex items-center justify-center shrink-0">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[#2A211B]">
                {orderSummary.totalOrders}
              </div>
              <div className="text-xs text-[#6F6963] font-medium mt-0.5">
                Lifetime Orders (Excl. Demo)
              </div>
            </div>
          </div>

          {/* Lifetime Spend */}
          <div className="bg-white border border-[#E7DED5] rounded-3xl p-5 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <IndianRupee className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[#2A211B]">
                ₹{lifetimeSpentRupees}
              </div>
              <div className="text-xs text-[#6F6963] font-medium mt-0.5">
                Total Net Purchases
              </div>
            </div>
          </div>

          {/* Last Order Date */}
          <div className="bg-white border border-[#E7DED5] rounded-3xl p-5 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <div className="text-base sm:text-lg font-bold text-[#2A211B] truncate max-w-[200px]">
                {lastOrderDateFormatted || 'No orders yet'}
              </div>
              <div className="text-xs text-[#6F6963] font-medium mt-0.5">
                Most Recent Order
              </div>
            </div>
          </div>
        </div>

        {/* Shipping Addresses Section */}
        <div className="bg-white border border-[#E7DED5] rounded-3xl p-6 sm:p-7 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E7DED5]">
            <h2 className="text-base font-bold text-[#2A211B] flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#9A6A45]" />
              <span>Saved Delivery Addresses</span>
            </h2>
            <span className="text-xs font-semibold text-[#6F6963]">
              {addresses.length} {addresses.length === 1 ? 'Address' : 'Addresses'}
            </span>
          </div>

          {addresses.length === 0 ? (
            <div className="py-6 text-center text-xs text-[#6F6963] italic">
              No delivery addresses saved on this customer profile.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {addresses.map((addr) => {
                const AddressTypeIcon = addr.type === 'WORK' ? Briefcase : Home;
                return (
                  <div
                    key={addr.id}
                    className={`p-4 rounded-2xl border text-xs space-y-2 transition-all ${
                      addr.isDefault
                        ? 'border-[#9A6A45] bg-[#F7F3EE]/50 ring-1 ring-[#9A6A45]/30'
                        : 'border-[#E7DED5] bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#2A211B] flex items-center gap-1.5">
                        <AddressTypeIcon className="w-3.5 h-3.5 text-[#9A6A45]" />
                        <span>{addr.fullName}</span>
                      </span>

                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-md bg-[#E7DED5]/50 text-[#6F6963] text-[10px] font-bold uppercase tracking-wider">
                          {addr.type || 'HOME'}
                        </span>
                        {addr.isDefault && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wider">
                            Default
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-[#2A211B] leading-relaxed">
                      <div>{addr.addressLine1}</div>
                      {addr.addressLine2 && <div>{addr.addressLine2}</div>}
                      {addr.landmark && (
                        <div className="text-[#6F6963] italic">Landmark: {addr.landmark}</div>
                      )}
                      <div>
                        {addr.city}, {addr.state} — <span className="font-mono font-semibold">{addr.postalCode}</span>
                      </div>
                      <div className="text-[11px] text-[#6F6963] mt-1 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-[#9A6A45]" />
                        <span>+91 {addr.phone}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Customer Order History Table */}
        <div className="bg-white border border-[#E7DED5] rounded-3xl p-6 sm:p-7 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E7DED5]">
            <h2 className="text-base font-bold text-[#2A211B] flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-[#9A6A45]" />
              <span>Customer Order History</span>
            </h2>
            <span className="text-xs font-semibold text-[#6F6963]">
              {ordersPagination.total} total {ordersPagination.total === 1 ? 'order' : 'orders'}
            </span>
          </div>

          {ordersLoading ? (
            <div className="space-y-3 py-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-12 bg-[#F7F3EE] rounded-xl animate-pulse" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#6F6963] space-y-1">
              <div className="font-semibold text-[#2A211B]">No orders placed yet</div>
              <p>This customer has not completed any non-demo purchases on LuxeCart.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#2A211B]" aria-label="Customer Order History Table">
                <thead className="bg-[#F7F3EE] border-b border-[#E7DED5] uppercase text-[10px] font-bold tracking-wider text-[#6F6963]">
                  <tr>
                    <th scope="col" className="py-3 px-4">Order Number</th>
                    <th scope="col" className="py-3 px-4">Date</th>
                    <th scope="col" className="py-3 px-4">Items</th>
                    <th scope="col" className="py-3 px-4">Grand Total</th>
                    <th scope="col" className="py-3 px-4">Status</th>
                    <th scope="col" className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7DED5]">
                  {orders.map((ord) => {
                    const statusCfg = getStatusConfig(ord.status);
                    const formattedDate = ord.createdAt
                      ? new Date(ord.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '—';

                    const totalFormatted = ((ord.grandTotalPaise || 0) / 100).toLocaleString('en-IN');

                    return (
                      <tr key={ord.id} className="hover:bg-[#F7F3EE]/50 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-[#2A211B]">
                          <Link
                            to={`/admin/orders/${ord.orderNumber}`}
                            className="hover:text-[#9A6A45] transition-colors"
                          >
                            {ord.orderNumber}
                          </Link>
                        </td>

                        <td className="py-3.5 px-4 text-[#6F6963]">{formattedDate}</td>

                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-[#2A211B]">{ord.itemCount}</span>{' '}
                          <span className="text-[#6F6963]">{ord.itemCount === 1 ? 'item' : 'items'}</span>
                        </td>

                        <td className="py-3.5 px-4 font-semibold text-[#2A211B]">
                          ₹{totalFormatted}
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
                          >
                            <span>{statusCfg.label}</span>
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <Link
                            to={`/admin/orders/${ord.orderNumber}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#E7DED5] text-[#2A211B] hover:bg-[#F7F3EE] hover:border-[#9A6A45] text-xs font-medium transition-colors"
                          >
                            <span>Inspect</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Order Pagination */}
              {ordersPagination.pages > 1 && (
                <div className="flex items-center justify-between pt-4 text-xs text-[#6F6963]">
                  <div>
                    Page <span className="font-semibold text-[#2A211B]">{ordersPage}</span> of{' '}
                    <span className="font-semibold text-[#2A211B]">{ordersPagination.pages}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setOrdersPage((p) => Math.max(p - 1, 1))}
                      disabled={ordersPage <= 1 || ordersLoading}
                      className="p-1 rounded-lg border border-[#E7DED5] text-[#2A211B] hover:bg-[#F7F3EE] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrdersPage((p) => Math.min(p + 1, ordersPagination.pages))}
                      disabled={ordersPage >= ordersPagination.pages || ordersLoading}
                      className="p-1 rounded-lg border border-[#E7DED5] text-[#2A211B] hover:bg-[#F7F3EE] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Status Transition Audit Trail */}
        {statusHistory.length > 0 && (
          <div className="bg-white border border-[#E7DED5] rounded-3xl p-6 sm:p-7 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-[#2A211B] flex items-center gap-2 pb-3 border-b border-[#E7DED5]">
              <History className="w-4 h-4 text-[#9A6A45]" />
              <span>Status Transition Audit Trail</span>
            </h2>

            <div className="space-y-3">
              {statusHistory.map((event, idx) => {
                const eventBadge = getCustomerStatusBadge(event.status);
                const EventIcon = eventBadge.icon;
                const formattedTime = event.changedAt
                  ? new Date(event.changedAt).toLocaleString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '—';

                return (
                  <div
                    key={event.id || idx}
                    className="p-3.5 rounded-2xl bg-[#F7F3EE]/60 border border-[#E7DED5] text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${eventBadge.bg} ${eventBadge.text} ${eventBadge.border}`}
                      >
                        <EventIcon className="w-3 h-3 shrink-0" />
                        <span>{eventBadge.label}</span>
                      </span>

                      {event.note && (
                        <span className="text-[#2A211B] font-medium italic">
                          "{event.note}"
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-[#6F6963] flex items-center gap-3">
                      {event.changedBy && (
                        <span className="font-mono text-[10px] bg-white px-2 py-0.5 rounded-md border border-[#E7DED5]">
                          Admin ID: {event.changedBy}
                        </span>
                      )}
                      <span>{formattedTime}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Customer Status Update Modal */}
      <CustomerStatusModal
        isOpen={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        customer={customer}
        onStatusUpdated={handleStatusUpdated}
      />
    </AdminLayout>
  );
}
