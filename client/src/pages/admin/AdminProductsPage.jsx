import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import { adminProductApi } from '../../features/admin/api/adminProductApi';
import { adminCategoryApi } from '../../features/admin/api/adminCategoryApi';
import {
  Plus,
  Search,
  Filter,
  RefreshCw,
  Edit,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Package,
  UploadCloud,
} from 'lucide-react';

export default function AdminProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch Categories for dropdown
  useEffect(() => {
    adminCategoryApi.getCategories().then((res) => {
      const categoryList = res?.data?.categories || res?.data || [];
      setCategories(Array.isArray(categoryList) ? categoryList : []);
    }).catch(() => {});
  }, []);

  // Fetch Products
  const loadProducts = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        limit: pagination.limit,
      };
      if (search.trim()) params.search = search.trim();
      if (status) params.status = status;
      if (category) params.category = category;

      const res = await adminProductApi.getProducts(params);
      setProducts(res?.data || []);
      if (res?.meta?.pagination) {
        setPagination(res.meta.pagination);
      }
    } catch (err) {
      setError(err.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [search, status, category, pagination.limit]);

  useEffect(() => {
    loadProducts(1);
  }, [loadProducts]);

  return (
    <AdminLayout>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E7DED5] pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#2A211B]">
            Product Catalog
          </h1>
          <p className="text-xs text-[#6F6963] mt-1">
            Manage single-vendor product variants, SKUs, inventory, and lifecycle states.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/admin/products/import"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-[#E7DED5] text-[#2A211B] hover:bg-[#F7F3EE] transition-colors text-xs font-semibold shadow-xs"
          >
            <UploadCloud className="w-4 h-4 text-[#9A6A45]" />
            <span>Bulk Import</span>
          </Link>
          <Link
            to="/admin/products/new"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#2A211B] text-white hover:bg-[#9A6A45] transition-colors text-xs font-semibold shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Product</span>
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-[#E7DED5] rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-[#6F6963] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by product name, brand, or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-xs text-[#2A211B] placeholder-[#6F6963] focus:outline-none focus:border-[#2A211B]"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full md:w-40 px-3 py-2 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-xs text-[#2A211B] focus:outline-none focus:border-[#2A211B]"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="DRAFT">DRAFT</option>
            <option value="ARCHIVED">ARCHIVED</option>
          </select>

          {/* Category Filter */}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full md:w-48 px-3 py-2 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-xs text-[#2A211B] focus:outline-none focus:border-[#2A211B]"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white border border-[#E7DED5] rounded-3xl p-6 shadow-xs space-y-4">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 text-[#9A6A45] animate-spin" />
            <p className="text-xs text-[#6F6963]">Loading products...</p>
          </div>
        ) : error ? (
          <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs">
            <p className="font-bold">Failed to load catalog</p>
            <p className="mt-1">{error}</p>
          </div>
        ) : products.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <Package className="w-10 h-10 text-[#9A6A45] mx-auto opacity-60" />
            <h3 className="text-sm font-bold text-[#2A211B]">No Products Found</h3>
            <p className="text-xs text-[#6F6963] max-w-sm mx-auto">
              No catalog items match your search or filter criteria. Try adjusting your filters or create a new product.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#E7DED5] text-[#6F6963] uppercase tracking-wider font-semibold">
                <tr>
                  <th scope="col" className="pb-3 pr-4">Product</th>
                  <th scope="col" className="pb-3 px-4">Category</th>
                  <th scope="col" className="pb-3 px-4">Status</th>
                  <th scope="col" className="pb-3 px-4">Price Range</th>
                  <th scope="col" className="pb-3 px-4">Variants</th>
                  <th scope="col" className="pb-3 px-4">Stock</th>
                  <th scope="col" className="pb-3 px-4">Updated</th>
                  <th scope="col" className="pb-3 pl-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7DED5]/60 text-[#2A211B]">
                {products.map((p) => {
                  const statusColor =
                    p.status === 'ACTIVE'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : p.status === 'DRAFT'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-gray-100 text-gray-700 border-gray-200';

                  const minPrice = p.priceSummary?.minPrice || 0;
                  const maxPrice = p.priceSummary?.maxPrice || minPrice;
                  const totalStock = p.priceSummary?.totalStock ?? 0;
                  const thumbnail = p.images?.[0]?.url || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200';
                  const updatedDate = p.updatedAt ? new Date(p.updatedAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : '-';

                  return (
                    <tr key={p.id || p._id} className="hover:bg-[#F7F3EE]/50 transition-colors">
                      <td className="py-3.5 pr-4 flex items-center gap-3">
                        <img
                          src={thumbnail}
                          alt={p.name}
                          className="w-10 h-12 object-cover rounded-lg border border-[#E7DED5] shrink-0"
                        />
                        <div>
                          <p className="font-semibold line-clamp-1">{p.name}</p>
                          <p className="text-[10px] text-[#6F6963] uppercase tracking-wider font-mono">{p.brand}</p>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-[#6F6963]">
                        {p.category?.name || 'Unassigned'}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${statusColor}`}>
                          {p.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-semibold">
                        ₹{minPrice.toLocaleString('en-IN')}{maxPrice > minPrice ? ` - ₹${maxPrice.toLocaleString('en-IN')}` : ''}
                      </td>

                      <td className="py-3.5 px-4 text-[#6F6963] font-medium">
                        {p.variants?.length || 0}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`font-semibold ${totalStock === 0 ? 'text-red-600' : totalStock <= 5 ? 'text-amber-600' : 'text-emerald-700'}`}>
                          {totalStock} units
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-[#6F6963]">
                        {updatedDate}
                      </td>

                      <td className="py-3.5 pl-4 text-right">
                        <Link
                          to={`/admin/products/${p.id || p._id}/edit`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F7F3EE] hover:bg-[#2A211B] text-[#2A211B] hover:text-white font-semibold transition-colors border border-[#E7DED5]"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>Manage</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[#E7DED5] pt-4 text-xs text-[#6F6963]">
            <span>
              Showing Page {pagination.page} of {pagination.totalPages} ({pagination.total} total items)
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => loadProducts(pagination.page - 1)}
                disabled={!pagination.hasPreviousPage || loading}
                className="p-2 rounded-lg border border-[#E7DED5] bg-[#F7F3EE] text-[#2A211B] hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => loadProducts(pagination.page + 1)}
                disabled={!pagination.hasNextPage || loading}
                className="p-2 rounded-lg border border-[#E7DED5] bg-[#F7F3EE] text-[#2A211B] hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
