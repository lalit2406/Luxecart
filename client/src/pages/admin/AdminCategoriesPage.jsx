import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import { adminCategoryApi } from '../../features/admin/api/adminCategoryApi';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  Check,
  RefreshCw,
  X,
  ChevronRight,
  FolderTree,
} from 'lucide-react';

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    parentId: '',
    description: '',
  });
  const [formError, setFormError] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminCategoryApi.getCategories();
      const categoryList = res?.data?.categories || res?.data || [];
      setCategories(Array.isArray(categoryList) ? categoryList : []);
    } catch (err) {
      setError(err.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // Open Modal
  const openModal = (cat = null, parentId = '') => {
    setFormError(null);
    if (cat) {
      setEditingCategoryId(cat._id);
      setCategoryForm({
        name: cat.name || '',
        parentId: cat.parentId || '',
        description: cat.description || '',
      });
    } else {
      setEditingCategoryId(null);
      setCategoryForm({
        name: '',
        parentId: parentId || '',
        description: '',
      });
    }
    setModalOpen(true);
  };

  // Submit Category Form
  const handleSaveCategory = async (e) => {
    e.preventDefault();
    setFormError(null);
    setFormSubmitting(true);

    const payload = {
      name: categoryForm.name.trim(),
      parentId: categoryForm.parentId || null,
      description: categoryForm.description.trim(),
    };

    try {
      if (editingCategoryId) {
        await adminCategoryApi.updateCategory(editingCategoryId, payload);
        setSuccess('Category updated successfully.');
      } else {
        await adminCategoryApi.createCategory(payload);
        setSuccess('Category created successfully.');
      }
      setModalOpen(false);
      await loadCategories();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setFormError(err.message || 'Failed to save category');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Archive / Delete Category
  const handleDeleteCategory = async (cat) => {
    if (!window.confirm(`Archive category "${cat.name}"? This action cannot be undone if child categories exist.`)) {
      return;
    }

    try {
      await adminCategoryApi.archiveCategory(cat._id);
      setSuccess(`Category "${cat.name}" archived successfully.`);
      await loadCategories();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(err.message || 'Failed to archive category');
    }
  };

  // Build tree hierarchy for rendering
  const rootCategories = categories.filter((c) => !c.parentId);

  const renderCategoryNode = (cat, depth = 0) => {
    const children = categories.filter((c) => c.parentId === cat._id);

    return (
      <div key={cat._id} className="space-y-2">
        <div className={`flex items-center justify-between p-3.5 bg-white border border-[#E7DED5] rounded-2xl hover:border-[#2A211B] transition-all shadow-xs ${
          depth > 0 ? 'ml-6 sm:ml-10 border-l-4 border-l-[#9A6A45]' : ''
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#F7F3EE] flex items-center justify-center text-[#9A6A45]">
              <FolderTree className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs text-[#2A211B]">{cat.name}</span>
                <span className="text-[10px] text-[#6F6963] font-mono bg-[#F7F3EE] px-2 py-0.5 rounded border border-[#E7DED5]">
                  /{cat.slug}
                </span>
                <span className="text-[10px] text-[#6F6963] font-mono">
                  Level {depth}
                </span>
              </div>
              {cat.description && (
                <p className="text-[11px] text-[#6F6963] line-clamp-1 mt-0.5">{cat.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {depth < 3 && (
              <button
                onClick={() => openModal(null, cat._id)}
                className="px-2.5 py-1 rounded-lg bg-[#F7F3EE] hover:bg-[#2A211B] text-[#2A211B] hover:text-white text-[11px] font-semibold transition-colors flex items-center gap-1 border border-[#E7DED5]"
                title="Add Subcategory"
              >
                <Plus className="w-3 h-3" />
                <span className="hidden sm:inline">Add Child</span>
              </button>
            )}

            <button
              onClick={() => openModal(cat)}
              className="p-1.5 text-[#6F6963] hover:text-[#2A211B] rounded-lg hover:bg-[#F7F3EE] transition-colors"
              title="Edit Category"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => handleDeleteCategory(cat)}
              className="p-1.5 text-[#6F6963] hover:text-red-700 rounded-lg hover:bg-red-50 transition-colors"
              title="Archive Category"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Render Children Recursively */}
        {children.length > 0 && (
          <div className="space-y-2">
            {children.map((child) => renderCategoryNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <AdminLayout>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E7DED5] pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#2A211B]">
            Category Architecture
          </h1>
          <p className="text-xs text-[#6F6963] mt-1">
            Manage multi-tier fashion categories, departments, and navigational taxonomies (Max Depth 3).
          </p>
        </div>

        <button
          onClick={() => openModal(null, '')}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2A211B] text-white hover:bg-[#9A6A45] transition-colors text-xs font-semibold shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Root Category</span>
        </button>
      </div>

      {/* Global Alerts */}
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Categories Hierarchy View */}
      <div className="bg-white border border-[#E7DED5] rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
        <h2 className="text-base font-serif font-bold text-[#2A211B] border-b border-[#E7DED5] pb-3">
          Category Hierarchy ({categories.length} Total)
        </h2>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 text-[#9A6A45] animate-spin" />
            <p className="text-xs text-[#6F6963]">Loading category tree...</p>
          </div>
        ) : categories.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <Layers className="w-10 h-10 text-[#9A6A45] mx-auto opacity-60" />
            <h3 className="text-sm font-bold text-[#2A211B]">No Categories Created</h3>
            <p className="text-xs text-[#6F6963]">
              Create root departments such as Clothing, Footwear, or Accessories to begin structuring your catalog.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {rootCategories.map((root) => renderCategoryNode(root, 0))}
          </div>
        )}
      </div>

      {/* Modal: Create / Edit Category */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#E7DED5] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-lg space-y-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#E7DED5] pb-3">
              <h3 className="text-base font-serif font-bold text-[#2A211B]">
                {editingCategoryId ? 'Edit Category' : 'Create Category'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-[#6F6963] hover:text-[#2A211B]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveCategory} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold uppercase tracking-wider text-[#6F6963]">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Formal Shirts"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-[#2A211B] focus:outline-none focus:border-[#2A211B]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold uppercase tracking-wider text-[#6F6963]">
                  Parent Category (Optional)
                </label>
                <select
                  value={categoryForm.parentId}
                  onChange={(e) => setCategoryForm((prev) => ({ ...prev, parentId: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-[#2A211B] focus:outline-none focus:border-[#2A211B]"
                >
                  <option value="">None (Top-Level Root Category)</option>
                  {categories
                    .filter((c) => c._id !== editingCategoryId)
                    .map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.ancestors?.length ? `${c.ancestors.map((a) => a.name).join(' > ')} > ` : ''}
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold uppercase tracking-wider text-[#6F6963]">
                  Description (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Brief description for merchandising and SEO..."
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-[#2A211B] focus:outline-none focus:border-[#2A211B]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-[#E7DED5]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#E7DED5] bg-white text-[#2A211B] hover:bg-[#F7F3EE]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 rounded-xl bg-[#2A211B] text-white hover:bg-[#9A6A45] transition-colors font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {formSubmitting ? 'Saving...' : editingCategoryId ? 'Update Category' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
