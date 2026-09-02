import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import { adminReturnApi } from '../../features/admin/returns/api/adminReturnApi';
import {
  RotateCcw,
  Search,
  RefreshCw,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  PackageCheck,
  IndianRupee,
  Eye,
} from 'lucide-react';

const STATUS_TABS = [
  { id: 'ALL', label: 'All Returns' },
  { id: 'REQUESTED', label: 'Requested' },
  { id: 'APPROVED', label: 'Approved' },
  { id: 'PICKUP_SCHEDULED', label: 'Pickup Scheduled' },
  { id: 'RECEIVED', label: 'Received' },
  { id: 'REFUNDED', label: 'Refunded' },
  { id: 'REJECTED', label: 'Rejected' },
];

const STATUS_CONFIG = {
  REQUESTED: { label: 'Requested', bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' },
  APPROVED: { label: 'Approved', bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
  PICKUP_SCHEDULED: { label: 'Pickup Scheduled', bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-200' },
  RECEIVED: { label: 'Received', bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200' },
  REFUNDED: { label: 'Refunded', bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' },
  REJECTED: { label: 'Rejected', bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-200' },
};

const formatPrice = (paise) => {
  const rupees = (paise || 0) / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(rupees);
};

export default function AdminReturnsPage() {
  const [returns, setReturns] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0, limit: 20 });
  const [metrics, setMetrics] = useState({
    totalReturns: 0,
    requested: 0,
    approved: 0,
    pickupScheduled: 0,
    received: 0,
    refunded: 0,
    rejected: 0,
    totalRequestedUnits: 0,
    totalRefundAmountPaise: 0,
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

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminReturnApi.getAdminReturns({
        page: pagination.page,
        limit: pagination.limit,
        status: selectedStatus === 'ALL' ? undefined : selectedStatus,
        search: debouncedSearch || undefined,
        sortBy,
        sortOrder,
      });

      if (res?.success) {
        setReturns(res.data?.returns || []);
        if (res.data?.pagination) {
          setPagination(res.data.pagination);
        }
        if (res.data?.metrics) {
          setMetrics(res.data.metrics);
        }
      }
    } catch (err) {
      console.error('Failed to load admin returns:', err);
      setError(err.message || 'Failed to load returns');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, selectedStatus, debouncedSearch, sortBy, sortOrder]);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  const handleStatusTabChange = (status) => {
    setSelectedStatus(status);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (newPage) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <RotateCcw className="w-7 h-7 text-[#9A6A45]" />
              <h1 className="font-serif text-2xl md:text-3xl font-bold text-[#171513]">
                Returns & Customer Support
              </h1>
            </div>
            <p className="text-sm text-[#705E51] mt-1">
              Review, approve, or reject customer return requests and monitor the return lifecycle.
            </p>
          </div>
          <button
            onClick={fetchReturns}
            disabled={loading}
            className="self-start sm:self-auto flex items-center gap-2 px-4 py-2 bg-white border border-[#E7DED5] rounded text-sm text-[#705E51] hover:text-[#171513] hover:border-[#9A6A45] transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white p-4 rounded-lg border border-[#E7DED5] shadow-xs">
            <span className="text-xs text-[#705E51] font-medium block">Total Returns</span>
            <span className="text-2xl font-bold text-[#171513] mt-1 block">
              {metrics.totalReturns || 0}
            </span>
          </div>
          <div className="bg-white p-4 rounded-lg border border-amber-200 shadow-xs">
            <span className="text-xs text-amber-700 font-medium flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              Requested
            </span>
            <span className="text-2xl font-bold text-amber-900 mt-1 block">
              {metrics.requested || 0}
            </span>
          </div>
          <div className="bg-white p-4 rounded-lg border border-blue-200 shadow-xs">
            <span className="text-xs text-blue-700 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Approved
            </span>
            <span className="text-2xl font-bold text-blue-900 mt-1 block">
              {metrics.approved || 0}
            </span>
          </div>
          <div className="bg-white p-4 rounded-lg border border-indigo-200 shadow-xs">
            <span className="text-xs text-indigo-700 font-medium flex items-center gap-1">
              <Truck className="w-3.5 h-3.5" />
              In Transit
            </span>
            <span className="text-2xl font-bold text-indigo-900 mt-1 block">
              {metrics.pickupScheduled || 0}
            </span>
          </div>
          <div className="bg-white p-4 rounded-lg border border-emerald-200 shadow-xs">
            <span className="text-xs text-emerald-700 font-medium flex items-center gap-1">
              <PackageCheck className="w-3.5 h-3.5" />
              Received
            </span>
            <span className="text-2xl font-bold text-emerald-900 mt-1 block">
              {metrics.received || 0}
            </span>
          </div>
          <div className="bg-white p-4 rounded-lg border border-purple-200 shadow-xs">
            <span className="text-xs text-purple-700 font-medium flex items-center gap-1">
              <IndianRupee className="w-3.5 h-3.5" />
              Total Refund Value
            </span>
            <span className="text-lg font-bold text-purple-900 mt-1 block">
              {formatPrice(metrics.totalRefundAmountPaise)}
            </span>
          </div>
        </div>

        {/* Search & Status Filters */}
        <div className="bg-white p-4 rounded-lg border border-[#E7DED5] space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#705E51]" />
              <input
                type="text"
                placeholder="Search by Return #, Order #, Customer name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-[#E7DED5] rounded text-sm bg-white text-[#171513] focus:outline-hidden focus:border-[#9A6A45]"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={`${sortBy}:${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split(':');
                  setSortBy(field);
                  setSortOrder(order);
                }}
                className="px-3 py-2 border border-[#E7DED5] rounded text-sm bg-white text-[#171513] focus:outline-hidden focus:border-[#9A6A45]"
              >
                <option value="createdAt:desc">Newest First</option>
                <option value="createdAt:asc">Oldest First</option>
                <option value="totalRefundAmount:desc">Highest Refund</option>
                <option value="totalRefundAmount:asc">Lowest Refund</option>
              </select>
            </div>
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto border-b border-[#E7DED5] pb-px">
            {STATUS_TABS.map((tab) => {
              const count =
                tab.id === 'ALL'
                  ? metrics.totalReturns
                  : tab.id === 'REQUESTED'
                  ? metrics.requested
                  : tab.id === 'APPROVED'
                  ? metrics.approved
                  : tab.id === 'PICKUP_SCHEDULED'
                  ? metrics.pickupScheduled
                  : tab.id === 'RECEIVED'
                  ? metrics.received
                  : tab.id === 'REFUNDED'
                  ? metrics.refunded
                  : tab.id === 'REJECTED'
                  ? metrics.rejected
                  : 0;

              const active = selectedStatus === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => handleStatusTabChange(tab.id)}
                  className={`px-3 py-2 text-xs md:text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-1.5 ${
                    active
                      ? 'border-[#9A6A45] text-[#9A6A45]'
                      : 'border-transparent text-[#705E51] hover:text-[#171513] hover:border-[#E7DED5]'
                  }`}
                >
                  <span>{tab.label}</span>
                  {count > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        active
                          ? 'bg-[#9A6A45] text-white'
                          : 'bg-[#F7F3EE] text-[#705E51]'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Returns Table */}
        <div className="bg-white rounded-lg border border-[#E7DED5] overflow-hidden shadow-xs">
          {loading ? (
            <div className="p-12 text-center text-[#705E51]">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#9A6A45]" />
              <p className="text-sm">Loading returns...</p>
            </div>
          ) : returns.length === 0 ? (
            <div className="p-12 text-center">
              <RotateCcw className="w-8 h-8 text-[#705E51] mx-auto mb-2 opacity-50" />
              <p className="font-serif text-lg text-[#171513] font-bold">No return requests found</p>
              <p className="text-xs text-[#705E51] mt-1">
                {selectedStatus !== 'ALL' || debouncedSearch
                  ? 'Try adjusting your search query or status filter.'
                  : 'No customer has submitted a return request yet.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#F7F3EE] text-xs text-[#705E51] uppercase border-b border-[#E7DED5]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Return / Order #</th>
                    <th className="px-4 py-3 font-semibold">Customer</th>
                    <th className="px-4 py-3 font-semibold">Items / Units</th>
                    <th className="px-4 py-3 font-semibold">Refund Amount</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Requested At</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7DED5]">
                  {returns.map((ret) => {
                    const statusConf = STATUS_CONFIG[ret.status] || {
                      label: ret.status,
                      bg: 'bg-gray-100',
                      text: 'text-gray-800',
                      border: 'border-gray-200',
                    };

                    return (
                      <tr key={ret.id || ret.returnNumber} className="hover:bg-[#FDFBF7] transition-colors">
                        <td className="px-4 py-3">
                          <Link
                            to={`/admin/returns/${ret.returnNumber}`}
                            className="font-medium text-[#9A6A45] hover:underline block"
                          >
                            {ret.returnNumber}
                          </Link>
                          <span className="text-xs text-[#705E51] block">
                            Order: {ret.orderNumber}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-[#171513] block">
                            {ret.customer?.name}
                          </span>
                          <span className="text-xs text-[#705E51] block">
                            {ret.customer?.email || ret.customer?.phone}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[#171513]">
                          {ret.totalRequestedUnits} unit{ret.totalRequestedUnits > 1 ? 's' : ''}
                        </td>
                        <td className="px-4 py-3 font-medium text-[#171513]">
                          {formatPrice(ret.totalRefundAmount)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusConf.bg} ${statusConf.text} ${statusConf.border}`}
                          >
                            {statusConf.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#705E51]">
                          {new Date(ret.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            to={`/admin/returns/${ret.returnNumber}`}
                            className="inline-flex items-center gap-1 text-xs px-3 py-1 bg-white border border-[#E7DED5] rounded text-[#171513] hover:border-[#9A6A45] hover:text-[#9A6A45] transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Review</span>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="p-4 bg-white border-t border-[#E7DED5] flex items-center justify-between text-xs text-[#705E51]">
              <span>
                Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} returns)
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={!pagination.hasPrevPage}
                  className="p-1.5 rounded border border-[#E7DED5] disabled:opacity-40 disabled:cursor-not-allowed hover:border-[#9A6A45] transition-colors"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={!pagination.hasNextPage}
                  className="p-1.5 rounded border border-[#E7DED5] disabled:opacity-40 disabled:cursor-not-allowed hover:border-[#9A6A45] transition-colors"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
