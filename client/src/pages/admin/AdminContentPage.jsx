import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import adminContentApi from '../../features/admin/content/api/adminContentApi';
import api from '../../services/api';
import {
  LayoutTemplate,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Calendar,
  Layers,
  ShoppingBag,
  Image as ImageIcon,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Sparkles,
  Eye,
  X,
  ChevronRight,
} from 'lucide-react';

const CONTENT_TYPES = [
  { label: 'All Content Types', value: '' },
  { label: 'Hero Banners', value: 'HERO_BANNER' },
  { label: 'Promotional Banners', value: 'PROMO_BANNER' },
  { label: 'Featured Collections', value: 'FEATURED_COLLECTION' },
  { label: 'Announcement Bars', value: 'ANNOUNCEMENT_BAR' },
];

export default function AdminContentPage() {
  const [contentList, setContentList] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [selectedType, setSelectedType] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('displayOrder');
  const [sortOrder, setSortOrder] = useState('asc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Delete modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  // Reordering mode state
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [reorderList, setReorderList] = useState([]);
  const [reorderSaving, setReorderSaving] = useState(false);

  // Catalog data for target selection
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);

  // Fetch content list
  const fetchContent = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        type: selectedType || undefined,
        isActive: selectedStatus !== '' ? selectedStatus : undefined,
        search: searchQuery.trim() || undefined,
        sortBy,
        sortOrder,
      };

      const res = await adminContentApi.getContent(params);
      if (res?.success && res.data) {
        setContentList(res.data.content || []);
        if (res.data.pagination) {
          setPagination(res.data.pagination);
        }
      }
    } catch (err) {
      console.error('Failed to load content list:', err);
      setError(err.message || 'Unable to load content items');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, selectedType, selectedStatus, searchQuery, sortBy, sortOrder]);

  // Fetch categories & products for form dropdowns
  const fetchCatalogData = useCallback(async () => {
    try {
      const [catRes, prodRes] = await Promise.all([
        api.get('/categories'),
        api.get('/products', { params: { limit: 50 } }),
      ]);
      if (catRes?.success && catRes.data) {
        setCategories(catRes.data.categories || catRes.data || []);
      }
      if (prodRes?.success && prodRes.data) {
        setProducts(prodRes.data.products || prodRes.data || []);
      }
    } catch (err) {
      console.error('Failed to load catalog data for targeting:', err);
    }
  }, []);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  useEffect(() => {
    fetchCatalogData();
  }, [fetchCatalogData]);

  // Handle toggle active
  const handleToggle = async (item) => {
    setActionLoading(true);
    try {
      const newStatus = !item.isActive;
      await adminContentApi.toggleContent(item._id, newStatus);
      setContentList((prev) =>
        prev.map((c) => (c._id === item._id ? { ...c, isActive: newStatus } : c))
      );
    } catch (err) {
      alert(err.message || 'Failed to toggle content status');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle delete
  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    setActionLoading(true);
    try {
      await adminContentApi.deleteContent(itemToDelete._id);
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
      fetchContent();
    } catch (err) {
      alert(err.message || 'Failed to delete content');
    } finally {
      setActionLoading(false);
    }
  };

  // Enter Reorder Mode
  const startReordering = () => {
    setReorderList([...contentList]);
    setIsReorderMode(true);
  };

  // Move item up in reorder list
  const moveItemUp = (index) => {
    if (index === 0) return;
    setReorderList((prev) => {
      const newList = [...prev];
      const temp = newList[index - 1];
      newList[index - 1] = newList[index];
      newList[index] = temp;
      return newList;
    });
  };

  // Move item down in reorder list
  const moveItemDown = (index) => {
    if (index === reorderList.length - 1) return;
    setReorderList((prev) => {
      const newList = [...prev];
      const temp = newList[index + 1];
      newList[index + 1] = newList[index];
      newList[index] = temp;
      return newList;
    });
  };

  // Save reordered sequence
  const saveReorderedSequence = async () => {
    setReorderSaving(true);
    try {
      const orderedIds = reorderList.map((item) => item._id);
      await adminContentApi.reorderContent(orderedIds, selectedType || null);
      setIsReorderMode(false);
      fetchContent();
    } catch (err) {
      alert(err.message || 'Failed to save reordered sequence');
    } finally {
      setReorderSaving(false);
    }
  };

  // Helper to compute schedule label & badge class
  const getScheduleStatus = (item) => {
    if (!item.isActive) {
      return { label: 'INACTIVE', badgeClass: 'bg-gray-100 text-gray-700 border-gray-300' };
    }

    const now = new Date();
    if (item.startDate && new Date(item.startDate) > now) {
      const dateStr = new Date(item.startDate).toLocaleDateString('en-GB');
      return {
        label: `SCHEDULED (${dateStr})`,
        badgeClass: 'bg-blue-50 text-blue-800 border-blue-300 font-semibold',
      };
    }

    if (item.endDate && new Date(item.endDate) < now) {
      const dateStr = new Date(item.endDate).toLocaleDateString('en-GB');
      return {
        label: `EXPIRED (${dateStr})`,
        badgeClass: 'bg-rose-50 text-rose-800 border-rose-300 font-semibold',
      };
    }

    return {
      label: 'ACTIVE / PUBLISHED',
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold',
    };
  };

  return (
    <AdminLayout>
      <div className="space-y-8 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E7DED5] pb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <LayoutTemplate className="w-6 h-6 text-[#9A6A45]" />
              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#171513]">
                Content & Homepage Management
              </h1>
            </div>
            <p className="text-xs text-[#705E51] mt-1">
              Authoritatively manage hero banners, promotional carousels, announcement bars & featured collections.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {!isReorderMode ? (
              <>
                <button
                  onClick={startReordering}
                  disabled={contentList.length < 2 || loading}
                  className="px-3 py-2 bg-white border border-[#E7DED5] rounded-xl text-xs font-semibold text-[#705E51] hover:text-[#171513] hover:bg-[#F7F3EE] transition-all shadow-2xs disabled:opacity-40"
                >
                  Reorder Sequence
                </button>
                <button
                  onClick={() => {
                    setEditingItem(null);
                    setIsModalOpen(true);
                  }}
                  className="px-4 py-2 bg-[#171513] text-white rounded-xl text-xs font-semibold hover:bg-[#2A211B] transition-all shadow-xs flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Content</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setIsReorderMode(false)}
                  disabled={reorderSaving}
                  className="px-3 py-2 bg-white border border-[#E7DED5] rounded-xl text-xs font-semibold text-[#705E51] hover:bg-[#F7F3EE]"
                >
                  Cancel
                </button>
                <button
                  onClick={saveReorderedSequence}
                  disabled={reorderSaving}
                  className="px-4 py-2 bg-emerald-700 text-white rounded-xl text-xs font-semibold hover:bg-emerald-800 flex items-center gap-1.5 shadow-xs"
                >
                  {reorderSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Save Order</span>
                </button>
              </>
            )}

            <button
              onClick={fetchContent}
              disabled={loading || isReorderMode}
              className="p-2 border border-[#E7DED5] rounded-xl bg-white hover:bg-[#F7F3EE] text-[#705E51] transition-colors shadow-2xs disabled:opacity-40"
              title="Refresh Content"
              aria-label="Refresh content list"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#9A6A45]' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        {!isReorderMode && (
          <div className="bg-white p-4 rounded-xl border border-[#E7DED5] shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-wrap flex-1">
              {/* Type Filter */}
              <select
                value={selectedType}
                onChange={(e) => {
                  setSelectedType(e.target.value);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
                className="px-3 py-1.5 border border-[#E7DED5] rounded-lg text-xs bg-white text-[#171513] focus:outline-hidden focus:border-[#9A6A45]"
              >
                {CONTENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
                className="px-3 py-1.5 border border-[#E7DED5] rounded-lg text-xs bg-white text-[#171513] focus:outline-hidden focus:border-[#9A6A45]"
              >
                <option value="">All Publishing States</option>
                <option value="true">Active Only</option>
                <option value="false">Inactive Only</option>
              </select>

              {/* Sort Selector */}
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
                className="px-3 py-1.5 border border-[#E7DED5] rounded-lg text-xs bg-white text-[#705E51] focus:outline-hidden focus:border-[#9A6A45]"
              >
                <option value="displayOrder">Sort by Display Order</option>
                <option value="createdAt">Sort by Date Created</option>
                <option value="title">Sort by Title</option>
              </select>
            </div>

            {/* Search Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setPagination((p) => ({ ...p, page: 1 }));
                fetchContent();
              }}
              className="flex gap-2"
            >
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#705E51]" />
                <input
                  type="text"
                  placeholder="Search title, subtitle..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-2.5 py-1.5 border border-[#E7DED5] rounded-lg text-xs bg-white focus:outline-hidden focus:border-[#9A6A45] w-56"
                />
              </div>
              <button
                type="submit"
                className="px-3 py-1.5 bg-[#171513] text-white rounded-lg text-xs font-semibold hover:bg-[#2A211B]"
              >
                Search
              </button>
            </form>
          </div>
        )}

        {/* Global Error Banner */}
        {error && (
          <div className="p-4 bg-white rounded-xl border border-rose-200 shadow-xs flex items-center justify-between gap-4 text-rose-900">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <p className="text-xs">{error}</p>
            </div>
            <button
              onClick={fetchContent}
              className="px-3 py-1.5 bg-[#171513] text-white rounded text-xs font-semibold hover:bg-[#2A211B]"
            >
              Retry
            </button>
          </div>
        )}

        {/* Reordering Mode Banner */}
        {isReorderMode && (
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 shadow-xs flex items-center justify-between gap-4 text-amber-900">
            <div className="flex items-center gap-2 text-xs">
              <Sparkles className="w-4 h-4 text-amber-700" />
              <span>
                <strong>Reordering Mode:</strong> Use the Move Up / Move Down controls to adjust the sequential display order, then click Save Order.
              </span>
            </div>
          </div>
        )}

        {/* Main Content Table / Reorder List */}
        <div className="bg-white rounded-xl border border-[#E7DED5] shadow-2xs overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-[#705E51]">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#9A6A45] mb-2" />
              <p className="text-xs">Loading homepage content sections...</p>
            </div>
          ) : (!isReorderMode ? contentList : reorderList).length === 0 ? (
            <div className="py-16 text-center text-[#705E51] space-y-3">
              <LayoutTemplate className="w-10 h-10 text-[#9A6A45] opacity-40 mx-auto" />
              <div>
                <p className="font-serif font-bold text-base text-[#171513]">No Homepage Content Found</p>
                <p className="text-xs text-[#705E51] mt-0.5">
                  {searchQuery || selectedType || selectedStatus !== ''
                    ? 'No items matched the active filters.'
                    : 'Create your first hero banner, promotional card, or announcement bar.'}
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingItem(null);
                  setIsModalOpen(true);
                }}
                className="px-4 py-2 bg-[#171513] text-white rounded-lg text-xs font-semibold hover:bg-[#2A211B] inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Content</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F7F3EE] border-b border-[#E7DED5] text-[#705E51] uppercase font-bold text-[10px] tracking-wider">
                    <th className="p-3 w-12 text-center">Order</th>
                    <th className="p-3">Banner / Preview</th>
                    <th className="p-3">Section Title & Details</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Status & Schedule</th>
                    <th className="p-3">Targeting</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7DED5]">
                  {(!isReorderMode ? contentList : reorderList).map((item, index) => {
                    const { label: statusLabel, badgeClass: statusBadgeClass } = getScheduleStatus(item);

                    return (
                      <tr key={item._id} className="hover:bg-[#FDFBF7] transition-colors">
                        {/* Display Order */}
                        <td className="p-3 text-center">
                          <span className="font-mono font-bold text-xs text-[#9A6A45] bg-[#F7F3EE] px-2 py-1 rounded border border-[#E7DED5]">
                            #{isReorderMode ? index : item.displayOrder}
                          </span>
                        </td>

                        {/* Image Preview */}
                        <td className="p-3 w-28">
                          {item.imageUrl ? (
                            <div className="w-24 h-14 rounded-lg bg-[#F7F3EE] border border-[#E7DED5] overflow-hidden flex items-center justify-center relative group">
                              <img
                                src={item.imageUrl}
                                alt={item.title}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.nextSibling.style.display = 'flex';
                                }}
                              />
                              <div className="hidden w-full h-full bg-[#F7F3EE] items-center justify-center text-[#705E51] text-[10px]">
                                <ImageIcon className="w-4 h-4 opacity-50" />
                              </div>
                            </div>
                          ) : (
                            <div className="w-24 h-14 rounded-lg bg-[#F7F3EE] border border-dashed border-[#E7DED5] flex items-center justify-center text-[#705E51]">
                              <ImageIcon className="w-4 h-4 opacity-40" />
                            </div>
                          )}
                        </td>

                        {/* Title & Subtitle */}
                        <td className="p-3">
                          <p className="font-semibold text-[#171513] text-sm">{item.title}</p>
                          {item.subtitle && (
                            <p className="text-[11px] text-[#705E51] line-clamp-1 mt-0.5">{item.subtitle}</p>
                          )}
                          {item.ctaText && (
                            <div className="flex items-center gap-1 text-[10px] text-[#9A6A45] font-mono mt-1">
                              <span>CTA: &ldquo;{item.ctaText}&rdquo;</span>
                              {item.ctaLink && <span className="text-gray-400">({item.ctaLink})</span>}
                            </div>
                          )}
                        </td>

                        {/* Content Type */}
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded border border-[#E7DED5] bg-[#F7F3EE] text-[10px] font-bold text-[#171513]">
                            {item.type.replace('_', ' ')}
                          </span>
                        </td>

                        {/* Publishing Status & Schedule */}
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded border text-[10px] uppercase tracking-wider ${statusBadgeClass}`}>
                            {statusLabel}
                          </span>
                          {(item.startDate || item.endDate) && (
                            <div className="text-[10px] text-[#705E51] mt-1 space-y-0.5 font-mono">
                              {item.startDate && (
                                <p>Start: {new Date(item.startDate).toLocaleDateString('en-GB')}</p>
                              )}
                              {item.endDate && (
                                <p>End: {new Date(item.endDate).toLocaleDateString('en-GB')}</p>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Targeting */}
                        <td className="p-3 text-[11px] text-[#705E51]">
                          {item.targetCategoryId?.name ? (
                            <div className="flex items-center gap-1 text-[#171513]">
                              <Layers className="w-3 h-3 text-[#9A6A45]" />
                              <span>{item.targetCategoryId.name}</span>
                            </div>
                          ) : item.targetProductIds?.length > 0 ? (
                            <div className="flex items-center gap-1 text-[#171513]">
                              <ShoppingBag className="w-3 h-3 text-[#9A6A45]" />
                              <span>{item.targetProductIds.length} Products</span>
                            </div>
                          ) : (
                            <span className="text-gray-400">General</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="p-3 text-right">
                          {isReorderMode ? (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => moveItemUp(index)}
                                disabled={index === 0}
                                className="p-1.5 rounded border border-[#E7DED5] bg-white hover:bg-[#F7F3EE] disabled:opacity-30 text-[#171513]"
                                title="Move Up"
                                aria-label="Move item up"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => moveItemDown(index)}
                                disabled={index === reorderList.length - 1}
                                className="p-1.5 rounded border border-[#E7DED5] bg-white hover:bg-[#F7F3EE] disabled:opacity-30 text-[#171513]"
                                title="Move Down"
                                aria-label="Move item down"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                              {/* Toggle active button */}
                              <button
                                onClick={() => handleToggle(item)}
                                disabled={actionLoading}
                                className={`p-1.5 rounded border transition-colors ${
                                  item.isActive
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                    : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                                }`}
                                title={item.isActive ? 'Deactivate' : 'Publish'}
                                aria-label="Toggle active status"
                              >
                                {item.isActive ? (
                                  <ToggleRight className="w-4 h-4 text-emerald-700" />
                                ) : (
                                  <ToggleLeft className="w-4 h-4 text-gray-400" />
                                )}
                              </button>

                              {/* Edit button */}
                              <button
                                onClick={() => {
                                  setEditingItem(item);
                                  setIsModalOpen(true);
                                }}
                                className="p-1.5 rounded border border-[#E7DED5] bg-white hover:bg-[#F7F3EE] text-[#705E51] hover:text-[#171513]"
                                title="Edit Content"
                                aria-label="Edit content"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete button */}
                              <button
                                onClick={() => {
                                  setItemToDelete(item);
                                  setIsDeleteModalOpen(true);
                                }}
                                className="p-1.5 rounded border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700"
                                title="Delete Content"
                                aria-label="Delete content"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Pagination */}
              {!isReorderMode && pagination.totalPages > 1 && (
                <div className="p-3 bg-[#F7F3EE] border-t border-[#E7DED5] flex items-center justify-between text-xs text-[#705E51]">
                  <span>
                    Page {pagination.page} of {pagination.totalPages} ({pagination.total} total items)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                      disabled={pagination.page <= 1}
                      className="px-3 py-1 bg-white border border-[#E7DED5] rounded disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                      disabled={pagination.page >= pagination.totalPages}
                      className="px-3 py-1 bg-white border border-[#E7DED5] rounded disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Content Create / Edit Modal Form */}
        {isModalOpen && (
          <ContentFormModal
            item={editingItem}
            categories={categories}
            products={products}
            onClose={() => {
              setIsModalOpen(false);
              setEditingItem(null);
            }}
            onSaved={() => {
              setIsModalOpen(false);
              setEditingItem(null);
              fetchContent();
            }}
          />
        )}

        {/* Delete Confirmation Modal */}
        {isDeleteModalOpen && itemToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-[#E7DED5]">
              <div className="flex items-center gap-3 text-rose-700">
                <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-[#171513]">Delete Content Section?</h3>
                  <p className="text-xs text-[#705E51]">This action is permanent and cannot be undone.</p>
                </div>
              </div>

              <div className="p-3 bg-[#FDFBF7] rounded-lg border border-[#E7DED5] text-xs space-y-1">
                <p className="font-semibold text-[#171513]">{itemToDelete.title}</p>
                <p className="text-[#705E51] font-mono text-[11px]">Type: {itemToDelete.type}</p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setItemToDelete(null);
                  }}
                  disabled={actionLoading}
                  className="px-4 py-2 border border-[#E7DED5] rounded-xl text-xs font-semibold text-[#705E51] hover:bg-[#F7F3EE]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-rose-700 text-white rounded-xl text-xs font-semibold hover:bg-rose-800 flex items-center gap-1.5"
                >
                  {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  <span>Confirm Delete</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

/**
 * Intelligent Create / Edit Form Modal
 */
function ContentFormModal({ item, categories, products, onClose, onSaved }) {
  const isEditing = Boolean(item);

  const [formData, setFormData] = useState({
    type: item?.type || 'HERO_BANNER',
    title: item?.title || '',
    subtitle: item?.subtitle || '',
    imageUrl: item?.imageUrl || '',
    mobileImageUrl: item?.mobileImageUrl || '',
    ctaText: item?.ctaText || '',
    ctaLink: item?.ctaLink || '',
    displayOrder: item?.displayOrder ?? 0,
    isActive: item?.isActive ?? true,
    startDate: item?.startDate ? new Date(item.startDate).toISOString().slice(0, 10) : '',
    endDate: item?.endDate ? new Date(item.endDate).toISOString().slice(0, 10) : '',
    targetCategoryId: item?.targetCategoryId?._id || item?.targetCategoryId || '',
    targetProductIds: item?.targetProductIds ? item.targetProductIds.map((p) => p._id || p) : [],
  });

  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState(null);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFormErrors((prev) => ({ ...prev, [field]: null }));
  };

  const handleProductToggle = (productId) => {
    setFormData((prev) => {
      const exists = prev.targetProductIds.includes(productId);
      return {
        ...prev,
        targetProductIds: exists
          ? prev.targetProductIds.filter((id) => id !== productId)
          : [...prev.targetProductIds, productId],
      };
    });
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.title.trim()) errors.title = 'Title is required';
    if (formData.title.length > 200) errors.title = 'Title cannot exceed 200 characters';
    if (formData.subtitle.length > 500) errors.subtitle = 'Subtitle cannot exceed 500 characters';
    if (formData.ctaText.length > 100) errors.ctaText = 'CTA text cannot exceed 100 characters';
    if (formData.ctaLink.length > 500) errors.ctaLink = 'CTA link cannot exceed 500 characters';
    if (formData.displayOrder < 0) errors.displayOrder = 'Display order cannot be negative';

    if (formData.startDate && formData.endDate) {
      if (new Date(formData.endDate) < new Date(formData.startDate)) {
        errors.endDate = 'End date cannot be before start date';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    setServerError(null);

    try {
      const payload = {
        type: formData.type,
        title: formData.title.trim(),
        subtitle: formData.subtitle.trim() || undefined,
        imageUrl: formData.imageUrl.trim() || undefined,
        mobileImageUrl: formData.mobileImageUrl.trim() || undefined,
        ctaText: formData.ctaText.trim() || undefined,
        ctaLink: formData.ctaLink.trim() || undefined,
        displayOrder: Number(formData.displayOrder) || 0,
        isActive: Boolean(formData.isActive),
        startDate: formData.startDate ? new Date(`${formData.startDate}T00:00:00.000Z`) : null,
        endDate: formData.endDate ? new Date(`${formData.endDate}T23:59:59.999Z`) : null,
        targetCategoryId: formData.targetCategoryId || null,
        targetProductIds: formData.targetProductIds || [],
      };

      if (isEditing) {
        await adminContentApi.updateContent(item._id, payload);
      } else {
        await adminContentApi.createContent(payload);
      }

      onSaved();
    } catch (err) {
      console.error('Failed to save content:', err);
      setServerError(err.message || 'Unable to save content section');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl border border-[#E7DED5] my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#E7DED5] pb-3">
          <div className="flex items-center gap-2">
            <LayoutTemplate className="w-5 h-5 text-[#9A6A45]" />
            <h2 className="font-serif font-bold text-lg text-[#171513]">
              {isEditing ? 'Edit Content Section' : 'Create New Content Section'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#705E51] hover:text-[#171513] hover:bg-[#F7F3EE]"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {serverError && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{serverError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Section Type */}
          <div>
            <label className="block font-bold text-[#171513] uppercase tracking-wider text-[10px] mb-1">
              Content Type *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { type: 'HERO_BANNER', label: 'Hero Banner' },
                { type: 'PROMO_BANNER', label: 'Promo Banner' },
                { type: 'FEATURED_COLLECTION', label: 'Collection' },
                { type: 'ANNOUNCEMENT_BAR', label: 'Announcement' },
              ].map((opt) => {
                const isSelected = formData.type === opt.type;
                return (
                  <button
                    type="button"
                    key={opt.type}
                    onClick={() => handleChange('type', opt.type)}
                    className={`p-2 rounded-lg border text-center font-medium transition-all ${
                      isSelected
                        ? 'bg-[#171513] text-white border-[#171513] shadow-xs'
                        : 'bg-[#FDFBF7] text-[#705E51] border-[#E7DED5] hover:border-[#9A6A45]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block font-semibold text-[#171513] mb-1">
              Title * {formData.type === 'ANNOUNCEMENT_BAR' ? '(Bar Message)' : ''}
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Summer Haute Couture Collection"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              className={`w-full p-2.5 border rounded-lg bg-white focus:outline-hidden focus:border-[#9A6A45] ${
                formErrors.title ? 'border-rose-400 bg-rose-50/20' : 'border-[#E7DED5]'
              }`}
            />
            {formErrors.title && <p className="text-rose-600 text-[11px] mt-0.5">{formErrors.title}</p>}
          </div>

          {/* Subtitle (Hero, Promo, Collection only) */}
          {formData.type !== 'ANNOUNCEMENT_BAR' && (
            <div>
              <label className="block font-semibold text-[#171513] mb-1">Subtitle / Description</label>
              <textarea
                rows={2}
                placeholder="e.g. Explore fine Mongolian cashmere and artisanal outerwear."
                value={formData.subtitle}
                onChange={(e) => handleChange('subtitle', e.target.value)}
                className="w-full p-2.5 border border-[#E7DED5] rounded-lg bg-white focus:outline-hidden focus:border-[#9A6A45]"
              />
            </div>
          )}

          {/* Media URLs (Hero & Promo banners) */}
          {formData.type !== 'ANNOUNCEMENT_BAR' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-[#171513] mb-1">Desktop Image URL</label>
                <input
                  type="text"
                  placeholder="https://images.unsplash.com/..."
                  value={formData.imageUrl}
                  onChange={(e) => handleChange('imageUrl', e.target.value)}
                  className="w-full p-2.5 border border-[#E7DED5] rounded-lg bg-white focus:outline-hidden focus:border-[#9A6A45]"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#171513] mb-1">Mobile Image URL (Optional)</label>
                <input
                  type="text"
                  placeholder="https://images.unsplash.com/..."
                  value={formData.mobileImageUrl}
                  onChange={(e) => handleChange('mobileImageUrl', e.target.value)}
                  className="w-full p-2.5 border border-[#E7DED5] rounded-lg bg-white focus:outline-hidden focus:border-[#9A6A45]"
                />
              </div>
            </div>
          )}

          {/* Image Preview Thumbnail */}
          {formData.imageUrl && (
            <div className="p-2 bg-[#FDFBF7] rounded-lg border border-[#E7DED5] flex items-center gap-3">
              <div className="w-16 h-10 rounded bg-[#E7DED5] overflow-hidden">
                <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
              </div>
              <span className="text-[11px] text-[#705E51]">Live image URL attached</span>
            </div>
          )}

          {/* CTA Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[#171513] mb-1">CTA Button Text</label>
              <input
                type="text"
                placeholder="e.g. Shop Collection"
                value={formData.ctaText}
                onChange={(e) => handleChange('ctaText', e.target.value)}
                className="w-full p-2.5 border border-[#E7DED5] rounded-lg bg-white focus:outline-hidden focus:border-[#9A6A45]"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#171513] mb-1">CTA Destination Link</label>
              <input
                type="text"
                placeholder="e.g. /shop?category=jewelry"
                value={formData.ctaLink}
                onChange={(e) => handleChange('ctaLink', e.target.value)}
                className="w-full p-2.5 border border-[#E7DED5] rounded-lg bg-white focus:outline-hidden focus:border-[#9A6A45]"
              />
            </div>
          </div>

          {/* Schedule Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[#171513] mb-1">Publish Start Date (Optional)</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => handleChange('startDate', e.target.value)}
                className="w-full p-2 border border-[#E7DED5] rounded-lg bg-white focus:outline-hidden focus:border-[#9A6A45]"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#171513] mb-1">Publish End Date (Optional)</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => handleChange('endDate', e.target.value)}
                className={`w-full p-2 border rounded-lg bg-white focus:outline-hidden focus:border-[#9A6A45] ${
                  formErrors.endDate ? 'border-rose-400 bg-rose-50/20' : 'border-[#E7DED5]'
                }`}
              />
              {formErrors.endDate && <p className="text-rose-600 text-[11px] mt-0.5">{formErrors.endDate}</p>}
            </div>
          </div>

          {/* Category Targeting */}
          {formData.type !== 'ANNOUNCEMENT_BAR' && (
            <div>
              <label className="block font-semibold text-[#171513] mb-1">Target Category (Optional)</label>
              <select
                value={formData.targetCategoryId}
                onChange={(e) => handleChange('targetCategoryId', e.target.value)}
                className="w-full p-2.5 border border-[#E7DED5] rounded-lg bg-white text-[#171513] focus:outline-hidden focus:border-[#9A6A45]"
              >
                <option value="">No Target Category (Global)</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Product Multi-Selection (Featured Collections) */}
          {formData.type === 'FEATURED_COLLECTION' && (
            <div>
              <label className="block font-semibold text-[#171513] mb-1">
                Featured Products ({formData.targetProductIds.length} selected)
              </label>
              <div className="max-h-36 overflow-y-auto p-2 bg-[#FDFBF7] rounded-lg border border-[#E7DED5] space-y-1">
                {products.map((p) => {
                  const isChecked = formData.targetProductIds.includes(p._id);
                  return (
                    <label
                      key={p._id}
                      className="flex items-center gap-2 p-1.5 rounded hover:bg-[#F7F3EE] cursor-pointer text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleProductToggle(p._id)}
                        className="rounded text-[#9A6A45] focus:ring-[#9A6A45]"
                      />
                      <span className="font-medium text-[#171513]">{p.name}</span>
                      <span className="text-[#705E51] text-[11px]">({p.brand})</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Order & Active Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#E7DED5]">
            <div>
              <label className="block font-semibold text-[#171513] mb-1">Display Order</label>
              <input
                type="number"
                min="0"
                value={formData.displayOrder}
                onChange={(e) => handleChange('displayOrder', e.target.value)}
                className="w-full p-2 border border-[#E7DED5] rounded-lg bg-white focus:outline-hidden focus:border-[#9A6A45]"
              />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                id="isActiveCheckbox"
                checked={formData.isActive}
                onChange={(e) => handleChange('isActive', e.target.checked)}
                className="w-4 h-4 rounded text-[#9A6A45] focus:ring-[#9A6A45]"
              />
              <label htmlFor="isActiveCheckbox" className="font-semibold text-[#171513] cursor-pointer">
                Publish Immediately (Active)
              </label>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E7DED5]">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 border border-[#E7DED5] rounded-xl text-xs font-semibold text-[#705E51] hover:bg-[#F7F3EE]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-[#171513] text-white rounded-xl text-xs font-semibold hover:bg-[#2A211B] flex items-center gap-1.5 shadow-xs"
            >
              {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              <span>{isEditing ? 'Save Changes' : 'Create Section'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
