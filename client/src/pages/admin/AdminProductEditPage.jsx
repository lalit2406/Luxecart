import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import ProductMediaManager from '../../components/admin/ProductMediaManager';
import { adminProductApi } from '../../features/admin/api/adminProductApi';
import { adminCategoryApi } from '../../features/admin/api/adminCategoryApi';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Edit2,
  X,
  Archive,
  Eye,
  Check,
} from 'lucide-react';

export default function AdminProductEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [product, setProduct] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(location.state?.message || null);

  // Variant Modal State
  const [variantModalOpen, setVariantModalOpen] = useState(false);
  const [editingVariantId, setEditingVariantId] = useState(null);
  const [variantForm, setVariantForm] = useState({
    sku: '',
    attributes: { color: { name: 'Black', hex: '#000000' }, size: 'M' },
    price: '',
    mrp: '',
    inventory: { stock: 10, lowStockThreshold: 3 },
    isActive: true,
  });
  const [variantError, setVariantError] = useState(null);

  // General Form State
  const [generalForm, setGeneralForm] = useState({
    name: '',
    brand: '',
    category: '',
    gender: 'UNISEX',
    shortDescription: '',
    description: '',
    tags: '',
    specifications: [],
    model3d: {
      enabled: false,
      url: '',
      format: 'GLB',
      posterUrl: '',
    },
  });

  const loadProduct = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [prodRes, catRes] = await Promise.all([
        adminProductApi.getProductById(id),
        adminCategoryApi.getCategories(),
      ]);
      const p = prodRes?.data?.product;
      setProduct(p);
      const catList = catRes?.data?.categories || catRes?.data || [];
      setCategories(Array.isArray(catList) ? catList : []);

      if (p) {
        setGeneralForm({
          name: p.name || '',
          brand: p.brand || '',
          category: p.category?._id || p.category || '',
          gender: p.gender || 'UNISEX',
          shortDescription: p.shortDescription || '',
          description: p.description || '',
          tags: Array.isArray(p.tags) ? p.tags.join(', ') : '',
          specifications: p.specifications || [],
          model3d: {
            enabled: Boolean(p.model3d?.enabled),
            url: p.model3d?.url || '',
            format: p.model3d?.format || 'GLB',
            posterUrl: p.model3d?.posterUrl || '',
          },
        });
      }
    } catch (err) {
      setError(err.message || 'Failed to load product');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

  // General Details Save
  const handleSaveGeneral = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        name: generalForm.name.trim(),
        brand: generalForm.brand.trim(),
        category: generalForm.category,
        gender: generalForm.gender,
        shortDescription: generalForm.shortDescription.trim(),
        description: generalForm.description.trim(),
        tags: generalForm.tags ? generalForm.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        specifications: generalForm.specifications.filter((s) => s.name?.trim() && s.value?.trim()),
        model3d: generalForm.model3d?.enabled
          ? {
              enabled: true,
              url: generalForm.model3d.url?.trim() || null,
              format: generalForm.model3d.format || 'GLB',
              posterUrl: generalForm.model3d.posterUrl?.trim() || null,
            }
          : { enabled: false, url: null, format: null, posterUrl: null },
      };

      const res = await adminProductApi.updateProduct(id, payload);
      setProduct(res?.data?.product);
      setSuccess('Product details updated successfully.');
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(err.message || 'Failed to update product');
    } finally {
      setSaving(false);
    }
  };

  // Status Change (DRAFT -> ACTIVE -> ARCHIVED)
  const handleStatusChange = async (newStatus) => {
    setError(null);
    setSuccess(null);
    try {
      const res = await adminProductApi.updateProductStatus(id, newStatus);
      setProduct(res?.data?.product);
      setSuccess(`Product status successfully transitioned to ${newStatus}.`);
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(err.message || `Failed to update status to ${newStatus}`);
    }
  };

  // Open Variant Modal for Add / Edit
  const openVariantModal = (v = null) => {
    setVariantError(null);
    if (v) {
      setEditingVariantId(v._id || v.id);
      setVariantForm({
        sku: v.sku || '',
        attributes: {
          color: {
            name: v.attributes?.color?.name || 'Default',
            hex: v.attributes?.color?.hex || '#000000',
          },
          size: v.attributes?.size || 'Free Size',
        },
        price: v.price || '',
        mrp: v.mrp || '',
        inventory: {
          stock: v.inventory?.stock ?? 0,
          lowStockThreshold: v.inventory?.lowStockThreshold ?? 3,
        },
        isActive: v.isActive !== false,
      });
    } else {
      setEditingVariantId(null);
      setVariantForm({
        sku: `${product?.brand ? product.brand.substring(0, 3).toUpperCase() : 'LUX'}-${Date.now().toString().slice(-4)}`,
        attributes: { color: { name: 'Black', hex: '#000000' }, size: 'M' },
        price: product?.priceSummary?.minPrice || '',
        mrp: product?.priceSummary?.minMrp || '',
        inventory: { stock: 10, lowStockThreshold: 3 },
        isActive: true,
      });
    }
    setVariantModalOpen(true);
  };

  // Save Variant (Create / Update)
  const handleSaveVariant = async (e) => {
    e.preventDefault();
    setVariantError(null);

    const payload = {
      sku: variantForm.sku.trim().toUpperCase(),
      attributes: {
        color: {
          name: variantForm.attributes?.color?.name || 'Default',
          hex: variantForm.attributes?.color?.hex || '#000000',
        },
        size: variantForm.attributes?.size || 'Free Size',
      },
      price: Number(variantForm.price),
      mrp: Number(variantForm.mrp) || Number(variantForm.price),
      inventory: {
        stock: Number(variantForm.inventory?.stock) || 0,
        lowStockThreshold: Number(variantForm.inventory?.lowStockThreshold) || 3,
      },
      isActive: variantForm.isActive,
    };

    try {
      if (editingVariantId) {
        const res = await adminProductApi.updateVariant(id, editingVariantId, payload);
        setProduct(res?.data?.product);
        setSuccess('Variant updated successfully.');
      } else {
        const res = await adminProductApi.addVariant(id, payload);
        setProduct(res?.data?.product);
        setSuccess('Variant added successfully.');
      }
      setVariantModalOpen(false);
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setVariantError(err.message || 'Failed to save variant');
    }
  };

  // Delete Variant
  const handleDeleteVariant = async (variantId) => {
    if (!window.confirm('Are you sure you want to delete this variant? This action cannot be undone.')) {
      return;
    }

    try {
      const res = await adminProductApi.deleteVariant(id, variantId);
      setProduct(res?.data?.product);
      setSuccess('Variant removed successfully.');
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(err.message || 'Failed to delete variant');
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="py-24 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-8 h-8 text-[#9A6A45] animate-spin" />
          <p className="text-xs text-[#6F6963]">Loading product manager...</p>
        </div>
      </AdminLayout>
    );
  }

  if (!product) {
    return (
      <AdminLayout>
        <div className="p-8 bg-white border border-[#E7DED5] rounded-3xl text-center space-y-4">
          <p className="text-sm font-bold text-red-600">Product not found.</p>
          <Link to="/admin/products" className="text-xs font-semibold text-[#9A6A45]">
            ← Return to Products
          </Link>
        </div>
      </AdminLayout>
    );
  }

  const statusBadgeColor =
    product.status === 'ACTIVE'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
      : product.status === 'DRAFT'
      ? 'bg-amber-50 text-amber-700 border-amber-300'
      : 'bg-gray-100 text-gray-700 border-gray-300';

  return (
    <AdminLayout>
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E7DED5] pb-6">
        <div className="flex items-center gap-3">
          <Link
            to="/admin/products"
            className="p-2 rounded-xl border border-[#E7DED5] bg-white text-[#2A211B] hover:bg-[#F7F3EE] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-serif font-bold text-[#2A211B]">
                {product.name}
              </h1>
              <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${statusBadgeColor}`}>
                {product.status}
              </span>
            </div>
            <p className="text-xs text-[#6F6963] mt-0.5">
              Brand: <span className="font-semibold text-[#2A211B]">{product.brand}</span> • Slug: <span className="font-mono text-[#6F6963]">{product.slug}</span>
            </p>
          </div>
        </div>

        {/* Lifecycle Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {product.status === 'DRAFT' && (
            <button
              onClick={() => handleStatusChange('ACTIVE')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 text-white hover:bg-emerald-800 text-xs font-semibold shadow-xs cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Publish to Storefront</span>
            </button>
          )}

          {product.status === 'ACTIVE' && (
            <>
              <a
                href={`/products/${product.slug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#E7DED5] text-[#2A211B] hover:bg-[#F7F3EE] text-xs font-semibold"
              >
                <Eye className="w-4 h-4 text-[#9A6A45]" />
                <span>View Live</span>
              </a>
              <button
                onClick={() => handleStatusChange('ARCHIVED')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-300 text-amber-800 hover:bg-amber-100 text-xs font-semibold cursor-pointer"
              >
                <Archive className="w-4 h-4" />
                <span>Archive</span>
              </button>
            </>
          )}

          {product.status === 'ARCHIVED' && (
            <button
              onClick={() => handleStatusChange('DRAFT')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2A211B] text-white hover:bg-[#9A6A45] text-xs font-semibold cursor-pointer"
            >
              <span>Restore to Draft</span>
            </button>
          )}
        </div>
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

      {/* Section 1: General Product Details */}
      <form onSubmit={handleSaveGeneral} className="bg-white border border-[#E7DED5] rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="flex items-center justify-between border-b border-[#E7DED5] pb-3">
          <h2 className="text-base font-serif font-bold text-[#2A211B]">
            1. General Product Details
          </h2>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2A211B] text-white hover:bg-[#9A6A45] text-xs font-semibold disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Updating...' : 'Save General Details'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          <div className="sm:col-span-2 space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[#6F6963]">
              Product Title *
            </label>
            <input
              type="text"
              required
              value={generalForm.name}
              onChange={(e) => setGeneralForm((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full px-4 py-2.5 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-xs text-[#2A211B] focus:outline-none focus:border-[#2A211B]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[#6F6963]">
              Brand *
            </label>
            <input
              type="text"
              required
              value={generalForm.brand}
              onChange={(e) => setGeneralForm((prev) => ({ ...prev, brand: e.target.value }))}
              className="w-full px-4 py-2.5 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-xs text-[#2A211B] focus:outline-none focus:border-[#2A211B]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[#6F6963]">
              Category *
            </label>
            <select
              required
              value={generalForm.category}
              onChange={(e) => setGeneralForm((prev) => ({ ...prev, category: e.target.value }))}
              className="w-full px-4 py-2.5 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-xs text-[#2A211B] focus:outline-none focus:border-[#2A211B]"
            >
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[#6F6963]">
              Department / Gender
            </label>
            <select
              value={generalForm.gender}
              onChange={(e) => setGeneralForm((prev) => ({ ...prev, gender: e.target.value }))}
              className="w-full px-4 py-2.5 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-xs text-[#2A211B] focus:outline-none focus:border-[#2A211B]"
            >
              <option value="UNISEX">UNISEX</option>
              <option value="MEN">MEN</option>
              <option value="WOMEN">WOMEN</option>
              <option value="KIDS">KIDS</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[#6F6963]">
              Tags (Comma Separated)
            </label>
            <input
              type="text"
              value={generalForm.tags}
              onChange={(e) => setGeneralForm((prev) => ({ ...prev, tags: e.target.value }))}
              className="w-full px-4 py-2.5 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-xs text-[#2A211B] focus:outline-none focus:border-[#2A211B]"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-[#6F6963]">
            Short Description
          </label>
          <input
            type="text"
            value={generalForm.shortDescription}
            onChange={(e) => setGeneralForm((prev) => ({ ...prev, shortDescription: e.target.value }))}
            className="w-full px-4 py-2.5 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-xs text-[#2A211B] focus:outline-none focus:border-[#2A211B]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-[#6F6963]">
            Full Description
          </label>
          <textarea
            rows={4}
            value={generalForm.description}
            onChange={(e) => setGeneralForm((prev) => ({ ...prev, description: e.target.value }))}
            className="w-full px-4 py-2.5 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-xs text-[#2A211B] focus:outline-none focus:border-[#2A211B]"
          />
        </div>

        {/* 3D Interactive Model Settings */}
        <div className="border-t border-[#E7DED5] pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-serif font-bold text-[#2A211B]">
                3D Interactive Model (Optional)
              </h3>
              <p className="text-[11px] text-[#6F6963]">
                Configure WebGL 3D model asset (.glb / .gltf) for customer interactive inspection.
              </p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#2A211B]">
              <input
                type="checkbox"
                checked={generalForm.model3d?.enabled || false}
                onChange={(e) =>
                  setGeneralForm((prev) => ({
                    ...prev,
                    model3d: {
                      ...prev.model3d,
                      enabled: e.target.checked,
                    },
                  }))
                }
                className="w-4 h-4 rounded border-[#E7DED5] text-[#9A6A45] focus:ring-[#9A6A45]"
              />
              <span>Enable 3D Viewer</span>
            </label>
          </div>

          {generalForm.model3d?.enabled && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#6F6963]">
                  3D Model URL (.glb / .gltf)
                </label>
                <input
                  type="url"
                  placeholder="https://models.luxecart.com/products/model.glb"
                  value={generalForm.model3d?.url || ''}
                  onChange={(e) =>
                    setGeneralForm((prev) => ({
                      ...prev,
                      model3d: { ...prev.model3d, url: e.target.value },
                    }))
                  }
                  className="w-full px-4 py-2.5 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-xs text-[#2A211B] focus:outline-none focus:border-[#2A211B]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#6F6963]">
                  Model Format
                </label>
                <select
                  value={generalForm.model3d?.format || 'GLB'}
                  onChange={(e) =>
                    setGeneralForm((prev) => ({
                      ...prev,
                      model3d: { ...prev.model3d, format: e.target.value },
                    }))
                  }
                  className="w-full px-4 py-2.5 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-xs text-[#2A211B] focus:outline-none focus:border-[#2A211B]"
                >
                  <option value="GLB">GLB (Binary glTF - Recommended)</option>
                  <option value="GLTF">glTF (JSON Container)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#6F6963]">
                  Poster / Fallback Image URL
                </label>
                <input
                  type="url"
                  placeholder="https://images.luxecart.com/poster.jpg"
                  value={generalForm.model3d?.posterUrl || ''}
                  onChange={(e) =>
                    setGeneralForm((prev) => ({
                      ...prev,
                      model3d: { ...prev.model3d, posterUrl: e.target.value },
                    }))
                  }
                  className="w-full px-4 py-2.5 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-xs text-[#2A211B] focus:outline-none focus:border-[#2A211B]"
                />
              </div>
            </div>
          )}
        </div>
      </form>

      {/* Section 2: Media Management */}
      <div className="bg-white border border-[#E7DED5] rounded-3xl p-6 sm:p-8 shadow-xs">
        <ProductMediaManager
          productId={product._id || product.id}
          images={product.images || []}
          variants={product.variants || []}
          onUpdate={(updatedProd) => setProduct(updatedProd)}
        />
      </div>

      {/* Section 3: Variant Matrix & Inventory */}
      <div className="bg-white border border-[#E7DED5] rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E7DED5] pb-4">
          <div>
            <h2 className="text-base font-serif font-bold text-[#2A211B]">
              3. Variant Matrix & Warehouse Stock ({product.variants?.length || 0})
            </h2>
            <p className="text-xs text-[#6F6963]">
              Manage sizes, color swatches, individual SKUs, selling prices, and inventory balances.
            </p>
          </div>

          <button
            onClick={() => openVariantModal(null)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2A211B] text-white hover:bg-[#9A6A45] text-xs font-semibold cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Variant</span>
          </button>
        </div>

        {/* Variants Table */}
        {product.variants?.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#6F6963]">
            No variants created. Add at least one active variant to publish this product.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#E7DED5] text-[#6F6963] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="pb-3 pr-4">SKU</th>
                  <th className="pb-3 px-4">Color</th>
                  <th className="pb-3 px-4">Size</th>
                  <th className="pb-3 px-4">Price</th>
                  <th className="pb-3 px-4">MRP</th>
                  <th className="pb-3 px-4">Stock</th>
                  <th className="pb-3 px-4">Reserved</th>
                  <th className="pb-3 px-4">Status</th>
                  <th className="pb-3 pl-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7DED5]/60 text-[#2A211B]">
                {product.variants.map((v) => {
                  const stock = v.inventory?.stock ?? 0;
                  const reserved = v.inventory?.reserved ?? 0;
                  const threshold = v.inventory?.lowStockThreshold ?? 5;
                  const isLow = stock > 0 && stock <= threshold;
                  const isOos = stock === 0;

                  return (
                    <tr key={v._id} className="hover:bg-[#F7F3EE]/50 transition-colors">
                      <td className="py-3.5 pr-4 font-mono font-bold text-[#2A211B]">
                        {v.sku}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0"
                            style={{ backgroundColor: v.attributes?.color?.hex || '#000' }}
                          />
                          <span>{v.attributes?.color?.name || 'Default'}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-semibold">
                        {v.attributes?.size || 'Free Size'}
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold">
                        ₹{v.price.toLocaleString('en-IN')}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-[#6F6963]">
                        ₹{(v.mrp || v.price).toLocaleString('en-IN')}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`font-semibold ${isOos ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-emerald-700'}`}>
                          {stock} units {isLow && '(Low)'} {isOos && '(OOS)'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-[#6F6963]">
                        {reserved}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                          v.isActive !== false ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-600 border-gray-200'
                        }`}>
                          {v.isActive !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      <td className="py-3.5 pl-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openVariantModal(v)}
                            className="p-1.5 text-[#6F6963] hover:text-[#2A211B] rounded-lg hover:bg-gray-100 transition-colors"
                            title="Edit Variant"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteVariant(v._id)}
                            className="p-1.5 text-[#6F6963] hover:text-red-700 rounded-lg hover:bg-red-50 transition-colors"
                            title="Delete Variant"
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

      {/* Variant Create / Edit Modal */}
      {variantModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#E7DED5] rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-lg space-y-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#E7DED5] pb-3">
              <h3 className="text-base font-serif font-bold text-[#2A211B]">
                {editingVariantId ? 'Edit Variant' : 'Add New Variant'}
              </h3>
              <button
                onClick={() => setVariantModalOpen(false)}
                className="text-[#6F6963] hover:text-[#2A211B]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {variantError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
                {variantError}
              </div>
            )}

            <form onSubmit={handleSaveVariant} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold uppercase tracking-wider text-[#6F6963]">
                  SKU (Stock Keeping Unit) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. LUX-CSH-BLK-M"
                  value={variantForm.sku}
                  onChange={(e) => setVariantForm((prev) => ({ ...prev, sku: e.target.value.toUpperCase() }))}
                  className="w-full px-3 py-2 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-[#2A211B] font-mono font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold uppercase tracking-wider text-[#6F6963]">
                    Color Name & Hex
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={variantForm.attributes.color.hex}
                      onChange={(e) =>
                        setVariantForm((prev) => ({
                          ...prev,
                          attributes: {
                            ...prev.attributes,
                            color: { ...prev.attributes.color, hex: e.target.value },
                          },
                        }))
                      }
                      className="w-8 h-8 rounded-lg border border-[#E7DED5] cursor-pointer bg-white p-0.5"
                    />
                    <input
                      type="text"
                      placeholder="Color Name"
                      value={variantForm.attributes.color.name}
                      onChange={(e) =>
                        setVariantForm((prev) => ({
                          ...prev,
                          attributes: {
                            ...prev.attributes,
                            color: { ...prev.attributes.color, name: e.target.value },
                          },
                        }))
                      }
                      className="w-full px-3 py-2 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-[#2A211B]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold uppercase tracking-wider text-[#6F6963]">
                    Size
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. S, M, L, XL, 40"
                    value={variantForm.attributes.size}
                    onChange={(e) =>
                      setVariantForm((prev) => ({
                        ...prev,
                        attributes: { ...prev.attributes, size: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-[#2A211B]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold uppercase tracking-wider text-[#6F6963]">
                    Selling Price (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={variantForm.price}
                    onChange={(e) => setVariantForm((prev) => ({ ...prev, price: e.target.value }))}
                    className="w-full px-3 py-2 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-[#2A211B] font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold uppercase tracking-wider text-[#6F6963]">
                    MRP (₹)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={variantForm.mrp}
                    onChange={(e) => setVariantForm((prev) => ({ ...prev, mrp: e.target.value }))}
                    className="w-full px-3 py-2 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-[#2A211B] font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold uppercase tracking-wider text-[#6F6963]">
                    Warehouse Stock
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={variantForm.inventory.stock}
                    onChange={(e) =>
                      setVariantForm((prev) => ({
                        ...prev,
                        inventory: { ...prev.inventory, stock: Number(e.target.value) },
                      }))
                    }
                    className="w-full px-3 py-2 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-[#2A211B] font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold uppercase tracking-wider text-[#6F6963]">
                    Low Stock Alert Threshold
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={variantForm.inventory.lowStockThreshold}
                    onChange={(e) =>
                      setVariantForm((prev) => ({
                        ...prev,
                        inventory: { ...prev.inventory, lowStockThreshold: Number(e.target.value) },
                      }))
                    }
                    className="w-full px-3 py-2 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-[#2A211B] font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="variantActive"
                  checked={variantForm.isActive}
                  onChange={(e) => setVariantForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                  className="rounded text-[#9A6A45] focus:ring-[#9A6A45]"
                />
                <label htmlFor="variantActive" className="text-xs text-[#2A211B] font-semibold cursor-pointer">
                  Active (Sellable on storefront)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-[#E7DED5]">
                <button
                  type="button"
                  onClick={() => setVariantModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#E7DED5] bg-white text-[#2A211B] hover:bg-[#F7F3EE]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#2A211B] text-white hover:bg-[#9A6A45] transition-colors font-semibold shadow-xs cursor-pointer"
                >
                  {editingVariantId ? 'Update Variant' : 'Add Variant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
