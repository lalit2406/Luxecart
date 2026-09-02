import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import AdminOrderTable from '../../components/admin/orders/AdminOrderTable';
import { adminOrderApi } from '../../features/admin/orders/api/adminOrderApi';
import {
  ShoppingBag,
  Search,
  RefreshCw,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Package,
  Truck,
  CheckCircle2,
  XCircle,
  IndianRupee,
  Layers,
} from 'lucide-react';

const STATUS_TABS = [
  { id: 'ALL', label: 'All Orders' },
  { id: 'PLACED', label: 'Placed' },
  { id: 'CONFIRMED', label: 'Confirmed' },
  { id: 'PROCESSING', label: 'Processing' },
  { id: 'SHIPPED', label: 'Shipped' },
  { id: 'DELIVERED', label: 'Delivered' },
  { id: 'CANCELLED', label: 'Cancelled' },
];

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 20 });
  const [metrics, setMetrics] = useState({
    totalOrders: 0,
    placed: 0,
    confirmed: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
    totalRevenuePaise: 0,
  });

  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Debounce search query input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const fetchOrders = useCallback(
    async (page = 1) => {
      setLoading(true);
      setError(null);
      try {
        const res = await adminOrderApi.getAdminOrders({
          page,
          limit: 20,
          status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
          search: debouncedSearch.trim() || undefined,
          sortBy,
          sortOrder,
        });

        setOrders(res?.data?.orders || []);
        setPagination(res?.data?.pagination || { page: 1, pages: 1, total: 0, limit: 20 });
        if (res?.data?.metrics) {
          setMetrics(res.data.metrics);
        }
      } catch (err) {
        setError(err.message || 'Failed to load orders.');
      } finally {
        setLoading(false);
      }
    },
    [selectedStatus, debouncedSearch, sortBy, sortOrder]
  );

  useEffect(() => {
    fetchOrders(1);
  }, [fetchOrders]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.pages) {
      fetchOrders(newPage);
    }
  };

  const revenueRupees = ((metrics.totalRevenuePaise || 0) / 100).toLocaleString('en-IN');

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E7DED5] pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#2A211B]">
            Orders & Fulfillment
          </h1>
          <p className="text-xs text-[#6F6963] mt-1">
            Manage customer orders and fulfillment status across the catalog.
          </p>
        </div>

        <button
          onClick={() => fetchOrders(pagination.page)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-[#E7DED5] text-[#2A211B] hover:bg-[#F7F3EE] text-xs font-semibold transition-colors shadow-xs self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Feed</span>
        </button>
      </div>

      {/* Metrics Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total Orders */}
        <div className="bg-white border border-[#E7DED5] rounded-2xl p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-[#6F6963]">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Orders</span>
            <ShoppingBag className="w-4 h-4 text-[#9A6A45]" />
          </div>
          <p className="text-xl font-serif font-bold text-[#2A211B]">{metrics.totalOrders}</p>
        </div>

        {/* Placed */}
        <div className="bg-white border border-[#E7DED5] rounded-2xl p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-blue-700">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Placed</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-xl font-serif font-bold text-blue-900">{metrics.placed}</p>
        </div>

        {/* Processing */}
        <div className="bg-white border border-[#E7DED5] rounded-2xl p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-indigo-700">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Processing</span>
            <Package className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-xl font-serif font-bold text-indigo-900">{metrics.processing}</p>
        </div>

        {/* Shipped */}
        <div className="bg-white border border-[#E7DED5] rounded-2xl p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-purple-700">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Shipped</span>
            <Truck className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-xl font-serif font-bold text-purple-900">{metrics.shipped}</p>
        </div>

        {/* Delivered */}
        <div className="bg-white border border-[#E7DED5] rounded-2xl p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-emerald-700">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Delivered</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xl font-serif font-bold text-emerald-900">{metrics.delivered}</p>
        </div>

        {/* Net Revenue */}
        <div className="bg-white border border-[#E7DED5] rounded-2xl p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-[#9A6A45]">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Net Sales</span>
            <IndianRupee className="w-4 h-4 text-[#9A6A45]" />
          </div>
          <p className="text-lg font-serif font-bold text-[#2A211B] truncate">₹{revenueRupees}</p>
        </div>
      </div>

      {/* Filter and Search Controls Bar */}
      <div className="bg-white border border-[#E7DED5] rounded-3xl p-4 sm:p-6 shadow-xs space-y-4">
        {/* Top Controls: Search and Sort */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6F6963]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Order #, Customer Name, Email, or Phone..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F7F3EE] border border-[#E7DED5] text-xs text-[#2A211B] placeholder-[#6F6963] focus:outline-hidden focus:border-[#9A6A45] focus:bg-white transition-colors"
            />
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#6F6963] font-medium hidden sm:inline">Sort:</span>
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [sb, so] = e.target.value.split('-');
                setSortBy(sb);
                setSortOrder(so);
              }}
              className="px-3 py-2 rounded-xl bg-[#F7F3EE] border border-[#E7DED5] text-xs text-[#2A211B] font-medium focus:outline-hidden focus:border-[#9A6A45] cursor-pointer"
            >
              <option value="createdAt-desc">Newest First</option>
              <option value="createdAt-asc">Oldest First</option>
              <option value="orderNumber-asc">Order Number (A-Z)</option>
              <option value="orderNumber-desc">Order Number (Z-A)</option>
            </select>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-t border-[#E7DED5] pt-3 scrollbar-none">
          {STATUS_TABS.map((tab) => {
            const isSelected = selectedStatus === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedStatus(tab.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#2A211B] text-white shadow-xs'
                    : 'bg-[#F7F3EE] text-[#6F6963] hover:bg-[#E7DED5] hover:text-[#2A211B]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Orders Table Area */}
      {loading ? (
        <div className="bg-white border border-[#E7DED5] rounded-3xl p-12 text-center space-y-3 shadow-xs animate-pulse">
          <RefreshCw className="w-8 h-8 text-[#9A6A45] animate-spin mx-auto" />
          <p className="text-xs text-[#6F6963]">Retrieving order records from database...</p>
        </div>
      ) : error ? (
        <div className="bg-white border border-red-200 rounded-3xl p-10 text-center space-y-4 max-w-md mx-auto shadow-xs">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-serif font-bold text-[#2A211B]">Failed to Load Orders</h3>
          <p className="text-xs text-[#6F6963]">{error}</p>
          <button
            onClick={() => fetchOrders(pagination.page)}
            className="px-5 py-2 rounded-xl bg-[#2A211B] text-white hover:bg-[#9A6A45] text-xs font-semibold transition-colors cursor-pointer"
          >
            Try Again
          </button>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white border border-[#E7DED5] rounded-3xl p-16 text-center space-y-4 shadow-xs">
          <div className="w-16 h-16 rounded-full bg-[#F7F3EE] border border-[#E7DED5] text-[#9A6A45] flex items-center justify-center mx-auto">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-serif font-bold text-[#2A211B]">No Orders Found</h3>
          <p className="text-xs text-[#6F6963] max-w-sm mx-auto">
            {searchQuery || selectedStatus !== 'ALL'
              ? 'No customer orders match your active search filters. Try clearing or broadening your search.'
              : 'There are currently no orders in the system.'}
          </p>
          {(searchQuery || selectedStatus !== 'ALL') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedStatus('ALL');
              }}
              className="px-5 py-2 rounded-xl bg-[#2A211B] text-white hover:bg-[#9A6A45] text-xs font-semibold transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <AdminOrderTable orders={orders} />

          {/* Pagination Controls */}
          {pagination.pages > 1 && (
            <div className="bg-white border border-[#E7DED5] rounded-2xl p-4 flex items-center justify-between text-xs text-[#6F6963] shadow-xs">
              <div>
                Showing page <strong className="text-[#2A211B]">{pagination.page}</strong> of{' '}
                <strong className="text-[#2A211B]">{pagination.pages}</strong> ({pagination.total}{' '}
                total matching orders)
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="p-2 rounded-lg border border-[#E7DED5] bg-[#F7F3EE] hover:bg-white text-[#2A211B] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  aria-label="Previous Page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.pages}
                  className="p-2 rounded-lg border border-[#E7DED5] bg-[#F7F3EE] hover:bg-white text-[#2A211B] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  aria-label="Next Page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </AdminLayout>
  );
}
