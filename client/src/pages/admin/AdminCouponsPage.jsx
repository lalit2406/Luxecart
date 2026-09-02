import React, { useState, useEffect, useCallback } from 'react';
import {
  Tag,
  Search,
  Filter,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  Percent,
  IndianRupee,
  RefreshCw,
  AlertTriangle,
  X,
  Check,
} from 'lucide-react';
import { adminCouponApi } from '../../features/admin/coupons/api/adminCouponApi';
import AdminLayout from '../../layouts/AdminLayout';

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState([]);
  const [metrics, setMetrics] = useState({
    totalCoupons: 0,
    activeCoupons: 0,
    expiredCoupons: 0,
    totalRedemptions: 0,
  });
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 20 });
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState(null);

  // Form fields
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    discountType: 'PERCENTAGE',
    discountValue: '',
    minOrderValue: '',
    maxDiscountAmount: '',
    startDate: '',
    expirationDate: '',
    totalUsageLimit: '',
    perUserLimit: '1',
    isActive: true,
  });

  const fetchCoupons = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminCouponApi.getCoupons({
        page: pagination.page,
        status: statusFilter,
        search: searchQuery,
      });

      const data = res?.data?.data || res?.data;
      setCoupons(data.coupons || []);
      setMetrics(
        data.metrics || {
          totalCoupons: 0,
          activeCoupons: 0,
          expiredCoupons: 0,
          totalRedemptions: 0,
        }
      );
      setPagination(data.pagination || { page: 1, pages: 1, total: 0, limit: 20 });
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load promotional coupons');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, statusFilter, searchQuery]);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  const handleOpenCreateModal = () => {
    const now = new Date();
    const defaultExp = new Date();
    defaultExp.setDate(now.getDate() + 30);

    setEditingCoupon(null);
    setFormData({
      code: '',
      description: '',
      discountType: 'PERCENTAGE',
      discountValue: '10',
      minOrderValue: '0',
      maxDiscountAmount: '',
      startDate: now.toISOString().slice(0, 16),
      expirationDate: defaultExp.toISOString().slice(0, 16),
      totalUsageLimit: '',
      perUserLimit: '1',
      isActive: true,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleOpenEditModal = (coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      description: coupon.description || '',
      discountType: coupon.discountType,
      discountValue:
        coupon.discountType === 'FIXED' ? (coupon.discountValue / 100).toString() : coupon.discountValue.toString(),
      minOrderValue: coupon.minOrderValue ? (coupon.minOrderValue / 100).toString() : '0',
      maxDiscountAmount: coupon.maxDiscountAmount ? (coupon.maxDiscountAmount / 100).toString() : '',
      startDate: coupon.startDate ? new Date(coupon.startDate).toISOString().slice(0, 16) : '',
      expirationDate: coupon.expirationDate ? new Date(coupon.expirationDate).toISOString().slice(0, 16) : '',
      totalUsageLimit: coupon.totalUsageLimit !== null ? coupon.totalUsageLimit.toString() : '',
      perUserLimit: coupon.perUserLimit ? coupon.perUserLimit.toString() : '1',
      isActive: Boolean(coupon.isActive),
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSaveCoupon = async (e) => {
    e.preventDefault();
    try {
      setFormLoading(true);
      setFormError(null);

      // Construct payload with integer paise for monetary inputs
      const payload = {
        code: formData.code.trim().toUpperCase(),
        description: formData.description.trim(),
        discountType: formData.discountType,
        discountValue:
          formData.discountType === 'FIXED'
            ? Math.round(parseFloat(formData.discountValue || 0) * 100)
            : parseInt(formData.discountValue || 0, 10),
        minOrderValue: Math.round(parseFloat(formData.minOrderValue || 0) * 100),
        maxDiscountAmount:
          formData.maxDiscountAmount && formData.discountType === 'PERCENTAGE'
            ? Math.round(parseFloat(formData.maxDiscountAmount) * 100)
            : null,
        startDate: new Date(formData.startDate).toISOString(),
        expirationDate: new Date(formData.expirationDate).toISOString(),
        totalUsageLimit: formData.totalUsageLimit ? parseInt(formData.totalUsageLimit, 10) : null,
        perUserLimit: formData.perUserLimit ? parseInt(formData.perUserLimit, 10) : 1,
        isActive: Boolean(formData.isActive),
      };

      if (editingCoupon) {
        await adminCouponApi.updateCoupon(editingCoupon._id || editingCoupon.id, payload);
      } else {
        await adminCouponApi.createCoupon(payload);
      }

      setModalOpen(false);
      fetchCoupons();
    } catch (err) {
      setFormError(err?.response?.data?.message || err?.message || 'Failed to save coupon');
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleStatus = async (coupon) => {
    try {
      const couponId = coupon._id || coupon.id;
      await adminCouponApi.toggleCouponStatus(couponId, !coupon.isActive);
      setCoupons((prev) =>
        prev.map((c) => ((c._id || c.id) === couponId ? { ...c, isActive: !c.isActive } : c))
      );
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || 'Failed to toggle coupon status');
    }
  };

  const handleDeleteCoupon = async (coupon) => {
    const couponId = coupon._id || coupon.id;
    if (!window.confirm(`Are you sure you want to delete coupon '${coupon.code}'?`)) {
      return;
    }

    try {
      await adminCouponApi.deleteCoupon(couponId);
      setCoupons((prev) => prev.filter((c) => (c._id || c.id) !== couponId));
      fetchCoupons();
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || 'Failed to delete coupon');
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-8 animate-in fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E7DED5] pb-6">
        <div>
          <h1 className="text-2xl font-serif font-bold text-[#2A211B]">
            Coupons & Promotions
          </h1>
          <p className="text-xs text-[#6F6963] mt-1">
            Create and manage promotional campaigns, discount caps, and customer usage limits.
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2A211B] text-white hover:bg-[#9A6A45] text-xs font-semibold uppercase tracking-wider transition-colors shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create Coupon</span>
        </button>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E7DED5] rounded-2xl p-5 space-y-1 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#6F6963]">
            Total Coupons
          </p>
          <p className="text-2xl font-bold text-[#2A211B]">{metrics.totalCoupons}</p>
        </div>

        <div className="bg-white border border-[#E7DED5] rounded-2xl p-5 space-y-1 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
            Active Campaigns
          </p>
          <p className="text-2xl font-bold text-emerald-800">{metrics.activeCoupons}</p>
        </div>

        <div className="bg-white border border-[#E7DED5] rounded-2xl p-5 space-y-1 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
            Expired Coupons
          </p>
          <p className="text-2xl font-bold text-amber-800">{metrics.expiredCoupons}</p>
        </div>

        <div className="bg-white border border-[#E7DED5] rounded-2xl p-5 space-y-1 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#9A6A45]">
            Total Redemptions
          </p>
          <p className="text-2xl font-bold text-[#2A211B]">{metrics.totalRedemptions}</p>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="bg-white border border-[#E7DED5] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
        {/* Status Tabs */}
        <div className="flex items-center gap-1 bg-[#F7F3EE] p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
          {['ALL', 'ACTIVE', 'INACTIVE', 'EXPIRED'].map((status) => (
            <button
              key={status}
              onClick={() => {
                setStatusFilter(status);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === status
                  ? 'bg-white text-[#2A211B] shadow-xs'
                  : 'text-[#6F6963] hover:text-[#2A211B]'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Search Field */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-[#6F6963] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by code or description..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E7DED5] bg-[#F7F3EE] focus:bg-white focus:outline-hidden focus:border-[#9A6A45] text-xs transition-colors"
          />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Coupons Table */}
      <div className="bg-white border border-[#E7DED5] rounded-3xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 text-[#9A6A45] animate-spin" />
            <p className="text-xs text-[#6F6963]">Loading promotional coupons...</p>
          </div>
        ) : coupons.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <Tag className="w-8 h-8 text-[#6F6963] mx-auto opacity-50" />
            <p className="text-sm font-serif font-bold text-[#2A211B]">No Coupons Found</p>
            <p className="text-xs text-[#6F6963]">
              No promotional campaigns match your selected filter criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F7F3EE] border-b border-[#E7DED5] text-[#6F6963] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-6 py-3.5">Coupon Code</th>
                  <th className="px-6 py-3.5">Discount</th>
                  <th className="px-6 py-3.5">Thresholds</th>
                  <th className="px-6 py-3.5">Usage / Limits</th>
                  <th className="px-6 py-3.5">Validity</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7DED5]">
                {coupons.map((coupon) => {
                  const isExpired = new Date(coupon.expirationDate) < new Date();
                  const isExhausted =
                    coupon.totalUsageLimit !== null && coupon.usedCount >= coupon.totalUsageLimit;

                  return (
                    <tr
                      key={coupon._id || coupon.id}
                      className="hover:bg-[#F7F3EE]/50 transition-colors"
                    >
                      {/* Code & Description */}
                      <td className="px-6 py-4">
                        <div className="font-mono font-bold text-sm text-[#2A211B]">
                          {coupon.code}
                        </div>
                        {coupon.description && (
                          <p className="text-[11px] text-[#6F6963] line-clamp-1 max-w-xs mt-0.5">
                            {coupon.description}
                          </p>
                        )}
                      </td>

                      {/* Discount Value */}
                      <td className="px-6 py-4">
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold text-xs bg-[#F7F3EE] text-[#9A6A45] border border-[#E7DED5]">
                          {coupon.discountType === 'PERCENTAGE' ? (
                            <>
                              <Percent className="w-3 h-3" />
                              <span>{coupon.discountValue}% OFF</span>
                            </>
                          ) : (
                            <>
                              <IndianRupee className="w-3 h-3" />
                              <span>₹{(coupon.discountValue / 100).toLocaleString('en-IN')} OFF</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Minimum Order Value & Max Cap */}
                      <td className="px-6 py-4 space-y-0.5 text-[#6F6963]">
                        <div>
                          Min: <span className="font-semibold text-[#2A211B]">₹{(coupon.minOrderValue / 100).toLocaleString('en-IN')}</span>
                        </div>
                        {coupon.maxDiscountAmount && (
                          <div>
                            Max Cap: <span className="font-semibold text-[#2A211B]">₹{(coupon.maxDiscountAmount / 100).toLocaleString('en-IN')}</span>
                          </div>
                        )}
                      </td>

                      {/* Usage Count & Limits */}
                      <td className="px-6 py-4 space-y-0.5 text-[#6F6963]">
                        <div className="font-semibold text-[#2A211B]">
                          {coupon.usedCount}{' '}
                          <span className="font-normal text-[#6F6963]">
                            / {coupon.totalUsageLimit !== null ? coupon.totalUsageLimit : '∞'} used
                          </span>
                        </div>
                        <div className="text-[10px]">
                          Per User: {coupon.perUserLimit}
                        </div>
                      </td>

                      {/* Dates */}
                      <td className="px-6 py-4 text-[#6F6963] text-[11px] space-y-0.5">
                        <div>
                          Exp: <span className="font-medium text-[#2A211B]">{new Date(coupon.expirationDate).toLocaleDateString('en-IN')}</span>
                        </div>
                        {isExpired && (
                          <span className="inline-block text-[10px] font-bold text-red-600 uppercase">
                            Expired
                          </span>
                        )}
                      </td>

                      {/* Status Toggle */}
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleToggleStatus(coupon)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors cursor-pointer ${
                            coupon.isActive && !isExpired && !isExhausted
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {coupon.isActive && !isExpired && !isExhausted ? (
                            <>
                              <CheckCircle className="w-3 h-3 text-emerald-600" />
                              <span>ACTIVE</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 text-gray-500" />
                              <span>INACTIVE</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => handleOpenEditModal(coupon)}
                            className="p-1.5 rounded-lg border border-[#E7DED5] text-[#6F6963] hover:text-[#2A211B] hover:bg-[#F7F3EE] transition-colors cursor-pointer"
                            title="Edit Coupon"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteCoupon(coupon)}
                            className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:text-red-800 hover:bg-red-50 transition-colors cursor-pointer"
                            title="Delete Coupon"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
      </div>

      {/* Create / Edit Coupon Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-[#E7DED5] rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#E7DED5] pb-4">
              <h2 className="text-lg font-serif font-bold text-[#2A211B]">
                {editingCoupon ? `Edit Coupon: ${editingCoupon.code}` : 'Create New Coupon'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-[#6F6963] hover:text-[#2A211B] p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveCoupon} className="space-y-4 text-xs">
              {/* Code & Description */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-[#2A211B]">Coupon Code *</label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value.toUpperCase() })
                    }
                    placeholder="e.g. SUMMER25"
                    className="w-full px-3 py-2 rounded-xl border border-[#E7DED5] bg-[#F7F3EE] focus:bg-white focus:outline-hidden focus:border-[#9A6A45] font-mono uppercase"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-[#2A211B]">Discount Type *</label>
                  <select
                    value={formData.discountType}
                    onChange={(e) => setFormData({ ...formData, discountType: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#E7DED5] bg-[#F7F3EE] focus:bg-white focus:outline-hidden focus:border-[#9A6A45]"
                  >
                    <option value="PERCENTAGE">Percentage (% Off)</option>
                    <option value="FIXED">Fixed Amount (₹ Off)</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="font-semibold text-[#2A211B]">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g. 25% Off Summer Collection"
                  className="w-full px-3 py-2 rounded-xl border border-[#E7DED5] bg-[#F7F3EE] focus:bg-white focus:outline-hidden focus:border-[#9A6A45]"
                />
              </div>

              {/* Discount Value, Min Order, Max Cap */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-[#2A211B]">
                    {formData.discountType === 'PERCENTAGE' ? 'Discount % *' : 'Discount ₹ *'}
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max={formData.discountType === 'PERCENTAGE' ? '100' : '1000000'}
                    value={formData.discountValue}
                    onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#E7DED5] bg-[#F7F3EE] focus:bg-white focus:outline-hidden focus:border-[#9A6A45]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-[#2A211B]">Min Order (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.minOrderValue}
                    onChange={(e) => setFormData({ ...formData, minOrderValue: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#E7DED5] bg-[#F7F3EE] focus:bg-white focus:outline-hidden focus:border-[#9A6A45]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-[#2A211B]">Max Cap (₹)</label>
                  <input
                    type="number"
                    min="0"
                    disabled={formData.discountType === 'FIXED'}
                    placeholder={formData.discountType === 'FIXED' ? 'N/A' : 'No Cap'}
                    value={formData.maxDiscountAmount}
                    onChange={(e) => setFormData({ ...formData, maxDiscountAmount: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#E7DED5] bg-[#F7F3EE] focus:bg-white focus:outline-hidden focus:border-[#9A6A45] disabled:opacity-40"
                  />
                </div>
              </div>

              {/* Validity Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-[#2A211B]">Start Date *</label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#E7DED5] bg-[#F7F3EE] focus:bg-white focus:outline-hidden focus:border-[#9A6A45]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-[#2A211B]">Expiration Date *</label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.expirationDate}
                    onChange={(e) => setFormData({ ...formData, expirationDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#E7DED5] bg-[#F7F3EE] focus:bg-white focus:outline-hidden focus:border-[#9A6A45]"
                  />
                </div>
              </div>

              {/* Usage Limits */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-[#2A211B]">Total Usage Limit</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Unlimited"
                    value={formData.totalUsageLimit}
                    onChange={(e) => setFormData({ ...formData, totalUsageLimit: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#E7DED5] bg-[#F7F3EE] focus:bg-white focus:outline-hidden focus:border-[#9A6A45]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-[#2A211B]">Per-User Limit *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.perUserLimit}
                    onChange={(e) => setFormData({ ...formData, perUserLimit: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#E7DED5] bg-[#F7F3EE] focus:bg-white focus:outline-hidden focus:border-[#9A6A45]"
                  />
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded border-[#E7DED5] text-[#9A6A45] focus:ring-[#9A6A45]"
                />
                <label htmlFor="isActive" className="font-semibold text-[#2A211B] cursor-pointer">
                  Activate Coupon immediately
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E7DED5]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={formLoading}
                  className="px-4 py-2 rounded-xl border border-[#E7DED5] text-[#6F6963] hover:text-[#2A211B] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-6 py-2 rounded-xl bg-[#2A211B] text-white hover:bg-[#9A6A45] transition-colors font-semibold flex items-center gap-2 cursor-pointer"
                >
                  {formLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editingCoupon ? 'Update Coupon' : 'Create Coupon'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </AdminLayout>
  );
}
