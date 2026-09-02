import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import { adminReviewApi } from '../../features/admin/reviews/api/adminReviewApi';
import RatingStars from '../../components/reviews/RatingStars';
import {
  MessageSquare,
  Search,
  CheckCircle2,
  EyeOff,
  XCircle,
  Trash2,
  RefreshCw,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Check,
} from 'lucide-react';

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState([]);
  const [metrics, setMetrics] = useState({
    totalReviews: 0,
    approved: 0,
    hidden: 0,
    rejected: 0,
    verifiedPurchases: 0,
  });
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 20 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const fetchAdminReviews = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {
        page,
        limit: 20,
        status: statusFilter,
        search: search.trim() || undefined,
      };

      const res = await adminReviewApi.getAdminReviews(params);
      const data = res?.data?.data || res?.data;
      setReviews(data?.reviews || []);
      setPagination(data?.pagination || { page: 1, pages: 1, total: 0, limit: 20 });
      if (data?.metrics) {
        setMetrics(data.metrics);
      }
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => {
    fetchAdminReviews();
  }, [fetchAdminReviews]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleUpdateStatus = async (reviewId, newStatus) => {
    try {
      setActionLoadingId(reviewId);
      await adminReviewApi.updateReviewStatus(reviewId, newStatus);
      showToast(`Review status updated to ${newStatus}`);
      await fetchAdminReviews();
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || 'Failed to update review status');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteReview = async (reviewId) => {
    if (!window.confirm('Are you sure you wish to permanently delete this customer review?')) return;
    try {
      setActionLoadingId(reviewId);
      await adminReviewApi.deleteReview(reviewId);
      showToast('Review permanently deleted');
      await fetchAdminReviews();
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || 'Failed to delete review');
    } finally {
      setActionLoadingId(null);
    }
  };

  const statusColors = {
    APPROVED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    HIDDEN: 'bg-amber-50 text-amber-800 border-amber-200',
    REJECTED: 'bg-red-50 text-red-800 border-red-200',
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-[#2A211B]">
            Customer Review Moderation
          </h1>
          <p className="text-xs text-[#6F6963] mt-0.5">
            Audit, approve, hide, and manage buyer feedback across your catalog.
          </p>
        </div>

        <button
          onClick={fetchAdminReviews}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#E7DED5] text-xs font-semibold text-[#2A211B] hover:bg-[#F7F3EE] transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Toast Feedback */}
      {toastMessage && (
        <div className="p-3.5 rounded-2xl bg-[#2A211B] text-white text-xs flex items-center gap-2 shadow-lg animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E7DED5] rounded-3xl p-5 shadow-xs space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#6F6963]">
            Total Reviews
          </p>
          <p className="text-2xl font-serif font-bold text-[#2A211B]">
            {metrics.totalReviews || 0}
          </p>
        </div>

        <div className="bg-white border border-[#E7DED5] rounded-3xl p-5 shadow-xs space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
            Approved & Live
          </p>
          <p className="text-2xl font-serif font-bold text-emerald-700">
            {metrics.approved || 0}
          </p>
        </div>

        <div className="bg-white border border-[#E7DED5] rounded-3xl p-5 shadow-xs space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
            Hidden
          </p>
          <p className="text-2xl font-serif font-bold text-amber-700">
            {metrics.hidden || 0}
          </p>
        </div>

        <div className="bg-white border border-[#E7DED5] rounded-3xl p-5 shadow-xs space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#9A6A45]">
            Verified Purchases
          </p>
          <p className="text-2xl font-serif font-bold text-[#9A6A45]">
            {metrics.verifiedPurchases || 0}
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-[#E7DED5] rounded-3xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {['ALL', 'APPROVED', 'HIDDEN', 'REJECTED'].map((st) => (
              <button
                key={st}
                onClick={() => {
                  setStatusFilter(st);
                  setPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  statusFilter === st
                    ? 'bg-[#2A211B] text-white'
                    : 'bg-[#F7F3EE] text-[#6F6963] hover:bg-[#E7DED5]'
                }`}
              >
                {st === 'ALL' ? 'All Reviews' : st}
              </button>
            ))}
          </div>

          {/* Search Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              fetchAdminReviews();
            }}
            className="flex items-center gap-2 max-w-md w-full"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#6F6963] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search reviews, customer, comment..."
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-[#E7DED5] bg-[#F7F3EE] text-xs text-[#2A211B] focus:bg-white focus:outline-hidden focus:border-[#9A6A45]"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#2A211B] text-white text-xs font-semibold hover:bg-[#9A6A45] transition-colors cursor-pointer"
            >
              Filter
            </button>
          </form>
        </div>
      </div>

      {/* Reviews Table */}
      <div className="bg-white border border-[#E7DED5] rounded-3xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-8 h-8 text-[#9A6A45] animate-spin" />
            <p className="text-xs text-[#6F6963]">Retrieving review records...</p>
          </div>
        ) : error ? (
          <div className="p-10 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-red-600 mx-auto" />
            <p className="text-xs text-red-600">{error}</p>
            <button
              onClick={fetchAdminReviews}
              className="px-4 py-2 rounded-xl bg-[#2A211B] text-white text-xs font-semibold"
            >
              Retry
            </button>
          </div>
        ) : reviews.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#F7F3EE] text-[#9A6A45] flex items-center justify-center mx-auto">
              <MessageSquare className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-[#2A211B]">No Reviews Found</h3>
            <p className="text-xs text-[#6F6963]">
              There are no reviews matching the current filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F7F3EE] text-[#6F6963] font-bold uppercase tracking-wider border-b border-[#E7DED5]">
                <tr>
                  <th className="py-3.5 px-4 sm:px-6">Customer</th>
                  <th className="py-3.5 px-4 sm:px-6">Product</th>
                  <th className="py-3.5 px-4 sm:px-6">Rating & Feedback</th>
                  <th className="py-3.5 px-4 sm:px-6">Status</th>
                  <th className="py-3.5 px-4 sm:px-6">Date</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Moderation Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7DED5]">
                {reviews.map((rev) => {
                  const isActionLoading = actionLoadingId === rev._id;
                  const formattedDate = rev.createdAt
                    ? new Date(rev.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '';

                  return (
                    <tr key={rev._id} className="hover:bg-[#F7F3EE]/50 transition-colors">
                      {/* Customer */}
                      <td className="py-4 px-4 sm:px-6 align-top">
                        <div className="space-y-0.5">
                          <p className="font-bold text-[#2A211B]">{rev.userId?.name || 'Customer'}</p>
                          <p className="text-[11px] text-[#6F6963]">{rev.userId?.email || 'N/A'}</p>
                          {rev.isVerifiedPurchase && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-semibold pt-0.5">
                              <ShieldCheck className="w-3 h-3" />
                              <span>Verified Buyer</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Product */}
                      <td className="py-4 px-4 sm:px-6 align-top">
                        <div className="flex items-center gap-2.5 max-w-[200px]">
                          {rev.productId?.images?.[0]?.url && (
                            <img
                              src={rev.productId.images[0].url}
                              alt={rev.productId.name}
                              className="w-10 h-12 object-cover rounded-lg border border-[#E7DED5] shrink-0"
                            />
                          )}
                          <div className="space-y-0.5 truncate">
                            <p className="font-semibold text-[#2A211B] truncate" title={rev.productId?.name}>
                              {rev.productId?.name || 'Product'}
                            </p>
                            <p className="text-[10px] text-[#9A6A45] uppercase tracking-wider font-bold">
                              {rev.productId?.brand || ''}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Rating & Content */}
                      <td className="py-4 px-4 sm:px-6 align-top max-w-xs">
                        <div className="space-y-1.5">
                          <RatingStars rating={rev.rating} size="sm" />
                          <h4 className="font-bold text-[#2A211B] text-xs">{rev.title}</h4>
                          <p className="text-[11px] text-[#6F6963] leading-relaxed line-clamp-3">
                            {rev.comment}
                          </p>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 sm:px-6 align-top">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            statusColors[rev.status] || 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {rev.status}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="py-4 px-4 sm:px-6 align-top text-[11px] text-[#6F6963] font-mono whitespace-nowrap">
                        {formattedDate}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 sm:px-6 align-top text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {rev.status !== 'APPROVED' && (
                            <button
                              onClick={() => handleUpdateStatus(rev._id, 'APPROVED')}
                              disabled={isActionLoading}
                              className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer disabled:opacity-50"
                              title="Approve Review"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          )}

                          {rev.status !== 'HIDDEN' && (
                            <button
                              onClick={() => handleUpdateStatus(rev._id, 'HIDDEN')}
                              disabled={isActionLoading}
                              className="p-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors cursor-pointer disabled:opacity-50"
                              title="Hide Review"
                            >
                              <EyeOff className="w-4 h-4" />
                            </button>
                          )}

                          {rev.status !== 'REJECTED' && (
                            <button
                              onClick={() => handleUpdateStatus(rev._id, 'REJECTED')}
                              disabled={isActionLoading}
                              className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors cursor-pointer disabled:opacity-50"
                              title="Reject Review"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            onClick={() => handleDeleteReview(rev._id)}
                            disabled={isActionLoading}
                            className="p-1.5 rounded-lg bg-gray-50 text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
                            title="Delete Review"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between p-4 sm:p-5 border-t border-[#E7DED5] text-xs">
            <span className="text-[#6F6963]">
              Showing Page {pagination.page} of {pagination.pages} ({pagination.total} total reviews)
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[#E7DED5] bg-[#F7F3EE] hover:bg-white disabled:opacity-40 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                disabled={page >= pagination.pages || loading}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[#E7DED5] bg-[#F7F3EE] hover:bg-white disabled:opacity-40 transition-colors cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  </AdminLayout>
);
}
