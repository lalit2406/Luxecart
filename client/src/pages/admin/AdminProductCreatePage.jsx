import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import { adminProductApi } from '../../features/admin/api/adminProductApi';
import { adminCategoryApi } from '../../features/admin/api/adminCategoryApi';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  AlertTriangle,
  Info,
  Layers,
} from 'lucide-react';

export default function AdminProductCreatePage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    brand: 'LuxeCart',
    category: '',
    gender: 'UNISEX',
    shortDescription: '',
    description: '',
    tags: '',
    specifications: [{ name: 'Material', value: '' }],
    images: [{ url: '', alt: '', isPrimary: true }],
    model3d: {
      enabled: false,
      url: '',
      format: 'GLB',
      posterUrl: '',
    },
    variants: [
      {
        sku: '',
        attributes: {
          color: { name: 'Black', hex: '#000000' },
          size: 'M',
        },
        price: '',
        mrp: '',
        inventory: { stock: 10, lowStockThreshold: 3 },
      },
    ],
  });

  useEffect(() => {
    adminCategoryApi.getCategories().then((res) => {
      const categoryList = res?.data?.categories || res?.data || [];
      const safeList = Array.isArray(categoryList) ? categoryList : [];
      setCategories(safeList);
      if (safeList.length > 0) {
        setFormData((prev) => ({ ...prev, category: safeList[0]._id }));
      }
    }).catch(() => {});
  }, []);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSpecChange = (index, key, val) => {
    const updated = [...formData.specifications];
    updated[index][key] = val;
    setFormData((prev) => ({ ...prev, specifications: updated }));
  };

  const addSpec = () => {
    setFormData((prev) => ({
      ...prev,
      specifications: [...prev.specifications, { name: '', value: '' }],
    }));
  };

  const removeSpec = (index) => {
    setFormData((prev) => ({
      ...prev,
      specifications: prev.specifications.filter((_, i) => i !== index),
    }));
  };

  const handleVariantChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      variants: [
        {
          ...prev.variants[0],
          [field]: value,
        },
      ],
    }));
  };

  const handleVariantAttrChange = (subfield, value) => {
    setFormData((prev) => ({
      ...prev,
      variants: [
        {
          ...prev.variants[0],
          attributes: {
            ...prev.variants[0].attributes,
            [subfield]: value,
          },
        },
      ],
    }));
  };

  const handleVariantColorChange = (key, value) => {
    setFormData((prev) => ({
      ...prev,
      variants: [
        {
          ...prev.variants[0],
          attributes: {
            ...prev.variants[0].attributes,
            color: {
              ...prev.variants[0].attributes.color,
              [key]: value,
            },
          },
        },
      ],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Format payload for backend
      const v = formData.variants[0];
      const payload = {
        name: formData.name.trim(),
        brand: formData.brand.trim(),
        category: formData.category,
        gender: formData.gender,
        shortDescription: formData.shortDescription.trim(),
        description: formData.description.trim(),
        status: 'DRAFT', // Default state for new products
        tags: formData.tags ? formData.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        specifications: formData.specifications.filter((s) => s.name.trim() && s.value.trim()),
        images: formData.images.filter((img) => img.url.trim()),
        model3d: formData.model3d?.enabled
          ? {
              enabled: true,
              url: formData.model3d.url?.trim() || null,
              format: formData.model3d.format || 'GLB',
              posterUrl: formData.model3d.posterUrl?.trim() || null,
            }
          : { enabled: false, url: null, format: null, posterUrl: null },
        variants: [
          {
            sku: v.sku.trim().toUpperCase(),
            attributes: {
              color: {
                name: v.attributes?.color?.name || 'Default',
                hex: v.attributes?.color?.hex || '#000000',
              },
              size: v.attributes?.size || 'Free Size',
            },
            price: Number(v.price),
            mrp: Number(v.mrp) || Number(v.price),
            inventory: {
              stock: Number(v.inventory?.stock) || 0,
              lowStockThreshold: Number(v.inventory?.lowStockThreshold) || 3,
            },
          },
        ],
      };

      const res = await adminProductApi.createProduct(payload);
      const createdId = res?.data?.product?._id || res?.data?.product?.id;
      navigate(`/admin/products/${createdId}/edit`, {
        state: { message: 'Product draft created successfully. You can now upload images and manage variants.' },
      });
    } catch (err) {
      setError(err.message || 'Failed to create product draft');
    } finally {
      setLoading(false);
    }
  };

  const variant = formData.variants[0];

  return (
    <AdminLayout>
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-[#E7DED5] pb-6">
        <div className="flex items-center gap-3">
          <Link
            to="/admin/products"
            className="p-2 rounded-xl border border-[#E7DED5] bg-white text-[#2A211B] hover:bg-[#F7F3EE] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-serif font-bold text-[#2A211B]">
              Create New Product
            </h1>
            <p className="text-xs text-[#6F6963] mt-0.5">
              Draft a new fashion or lifestyle product with initial SKU and variant.
            </p>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2A211B] text-white hover:bg-[#9A6A45] transition-colors text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-xs cursor-pointer"
        >
          <Save className="w-4 h-4" />
          <span>{loading ? 'Creating Draft...' : 'Save Draft Product'}</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Section 1: General Product Information */}
        <div className="bg-white border border-[#E7DED5] rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
          <h2 className="text-base font-serif font-bold text-[#2A211B] border-b border-[#E7DED5] pb-3">
            1. Basic Information
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#6F6963]">
                Product Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Oversized French Terry T-Shirt"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
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
                placeholder="e.g. LuxeCart Heritage"
                value={formData.brand}
                onChange={(e) => handleChange('brand', e.target.value)}
                className="w-full px-4 py-2.5 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-xs text-[#2A211B] focus:outline-none focus:border-[#2A211B]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#6F6963]">
                Category *
              </label>
              <select
                required
                value={formData.category}
                onChange={(e) => handleChange('category', e.target.value)}
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
                value={formData.gender}
                onChange={(e) => handleChange('gender', e.target.value)}
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
                placeholder="e.g. summer, linen, luxury, festive"
                value={formData.tags}
                onChange={(e) => handleChange('tags', e.target.value)}
                className="w-full px-4 py-2.5 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-xs text-[#2A211B] focus:outline-none focus:border-[#2A211B]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[#6F6963]">
              Short Teaser Description
            </label>
            <input
              type="text"
              placeholder="A brief summary for catalog listings..."
              value={formData.shortDescription}
              onChange={(e) => handleChange('shortDescription', e.target.value)}
              className="w-full px-4 py-2.5 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-xs text-[#2A211B] focus:outline-none focus:border-[#2A211B]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[#6F6963]">
              Full Description & Craftsmanship Details
            </label>
            <textarea
              rows={4}
              placeholder="Comprehensive product storytelling, fabric provenance, and tailoring details..."
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              className="w-full px-4 py-2.5 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-xs text-[#2A211B] focus:outline-none focus:border-[#2A211B]"
            />
          </div>
        </div>

        {/* Section 2: Initial Variant Specification */}
        <div className="bg-white border border-[#E7DED5] rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-[#E7DED5] pb-3">
            <div>
              <h2 className="text-base font-serif font-bold text-[#2A211B]">
                2. Initial Variant & Inventory
              </h2>
              <p className="text-xs text-[#6F6963]">
                Every product requires at least one variant. You can add more sizes and colors after creating the draft.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#6F6963]">
                SKU (Stock Keeping Unit) *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. LUX-TSH-BLK-M"
                value={variant.sku}
                onChange={(e) => handleVariantChange('sku', e.target.value.toUpperCase())}
                className="w-full px-4 py-2.5 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-xs text-[#2A211B] font-mono uppercase focus:outline-none focus:border-[#2A211B]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#6F6963]">
                Color Name & Swatch
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={variant.attributes?.color?.hex || '#000000'}
                  onChange={(e) => handleVariantColorChange('hex', e.target.value)}
                  className="w-10 h-10 rounded-xl border border-[#E7DED5] cursor-pointer bg-white p-1"
                />
                <input
                  type="text"
                  placeholder="Color (e.g. Onyx Black)"
                  value={variant.attributes?.color?.name}
                  onChange={(e) => handleVariantColorChange('name', e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-xs text-[#2A211B] focus:outline-none focus:border-[#2A211B]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#6F6963]">
                Size
              </label>
              <input
                type="text"
                placeholder="e.g. M, 40, Free Size"
                value={variant.attributes?.size}
                onChange={(e) => handleVariantAttrChange('size', e.target.value)}
                className="w-full px-4 py-2.5 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-xs text-[#2A211B] focus:outline-none focus:border-[#2A211B]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#6F6963]">
                Selling Price (₹) *
              </label>
              <input
                type="number"
                required
                min="1"
                placeholder="e.g. 1999"
                value={variant.price}
                onChange={(e) => handleVariantChange('price', e.target.value)}
                className="w-full px-4 py-2.5 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-xs text-[#2A211B] font-mono focus:outline-none focus:border-[#2A211B]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#6F6963]">
                MRP (₹ Maximum Retail Price)
              </label>
              <input
                type="number"
                min="1"
                placeholder="e.g. 3499"
                value={variant.mrp}
                onChange={(e) => handleVariantChange('mrp', e.target.value)}
                className="w-full px-4 py-2.5 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-xs text-[#2A211B] font-mono focus:outline-none focus:border-[#2A211B]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#6F6963]">
                Initial Stock
              </label>
              <input
                type="number"
                min="0"
                placeholder="e.g. 25"
                value={variant.inventory?.stock}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    variants: [
                      {
                        ...prev.variants[0],
                        inventory: {
                          ...prev.variants[0].inventory,
                          stock: Number(e.target.value),
                        },
                      },
                    ],
                  }))
                }
                className="w-full px-4 py-2.5 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-xs text-[#2A211B] font-mono focus:outline-none focus:border-[#2A211B]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#6F6963]">
                Low Stock Threshold
              </label>
              <input
                type="number"
                min="1"
                placeholder="e.g. 5"
                value={variant.inventory?.lowStockThreshold}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    variants: [
                      {
                        ...prev.variants[0],
                        inventory: {
                          ...prev.variants[0].inventory,
                          lowStockThreshold: Number(e.target.value),
                        },
                      },
                    ],
                  }))
                }
                className="w-full px-4 py-2.5 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-xs text-[#2A211B] font-mono focus:outline-none focus:border-[#2A211B]"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Specifications & Media URL */}
        <div className="bg-white border border-[#E7DED5] rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-[#E7DED5] pb-3">
            <div>
              <h2 className="text-base font-serif font-bold text-[#2A211B]">
                3. Specifications & Image URL
              </h2>
              <p className="text-xs text-[#6F6963]">
                Add key product specifications and initial image URL (Dedicated file upload arrives in Phase 5B).
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#6F6963]">
                Primary Image URL
              </label>
              <input
                type="url"
                placeholder="https://images.unsplash.com/photo-..."
                value={formData.images[0]?.url || ''}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    images: [{ url: e.target.value, alt: prev.name, isPrimary: true }],
                  }))
                }
                className="w-full px-4 py-2.5 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-xs text-[#2A211B] focus:outline-none focus:border-[#2A211B]"
              />
            </div>

            <div className="space-y-3 pt-3">
              <label className="text-xs font-bold uppercase tracking-wider text-[#6F6963]">
                Key Specifications
              </label>
              {formData.specifications.map((spec, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <input
                    type="text"
                    placeholder="Attribute (e.g. Fabric)"
                    value={spec.name}
                    onChange={(e) => handleSpecChange(idx, 'name', e.target.value)}
                    className="w-1/3 px-3.5 py-2 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-xs text-[#2A211B]"
                  />
                  <input
                    type="text"
                    placeholder="Value (e.g. 100% Organic Cotton)"
                    value={spec.value}
                    onChange={(e) => handleSpecChange(idx, 'value', e.target.value)}
                    className="flex-1 px-3.5 py-2 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-xs text-[#2A211B]"
                  />
                  {formData.specifications.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSpec(idx)}
                      className="p-2 text-[#6F6963] hover:text-red-700 rounded-lg hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addSpec}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#9A6A45] hover:text-[#2A211B] pt-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Specification</span>
              </button>
            </div>
          </div>
        </div>

        {/* Section 4: 3D Interactive Model (Phase 15) */}
        <div className="bg-white border border-[#E7DED5] rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-[#E7DED5] pb-3">
            <div>
              <h2 className="text-base font-serif font-bold text-[#2A211B]">
                4. 3D Interactive Model (Optional)
              </h2>
              <p className="text-xs text-[#6F6963]">
                Configure an interactive WebGL 3D asset (.glb / .gltf) for this product showcase.
              </p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#2A211B]">
              <input
                type="checkbox"
                checked={formData.model3d?.enabled || false}
                onChange={(e) =>
                  setFormData((prev) => ({
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

          {formData.model3d?.enabled && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#6F6963]">
                  3D Model URL (.glb / .gltf)
                </label>
                <input
                  type="url"
                  placeholder="https://models.luxecart.com/products/model.glb"
                  value={formData.model3d?.url || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({
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
                  value={formData.model3d?.format || 'GLB'}
                  onChange={(e) =>
                    setFormData((prev) => ({
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
                  value={formData.model3d?.posterUrl || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({
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

        {/* Action Bottom Bar */}
        <div className="flex justify-end gap-3 pt-4">
          <Link
            to="/admin/products"
            className="px-5 py-2.5 rounded-xl border border-[#E7DED5] bg-white text-[#2A211B] hover:bg-[#F7F3EE] text-xs font-semibold"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 rounded-xl bg-[#2A211B] text-white hover:bg-[#9A6A45] transition-colors text-xs font-semibold disabled:opacity-50 shadow-xs cursor-pointer"
          >
            {loading ? 'Saving Draft...' : 'Save Draft Product'}
          </button>
        </div>
      </form>
    </AdminLayout>
  );
}
