import React, { useState, useEffect, useCallback, useRef } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import AdminCustomerTable from '../../features/admin/customers/components/AdminCustomerTable';
import CustomerStatusModal from '../../features/admin/customers/components/CustomerStatusModal';
import { adminCustomerApi } from '../../features/admin/customers/api/adminCustomerApi';
import {
  Users,
  Search,
  RefreshCw,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  X,
  IndianRupee,
  ShoppingBag,
} from 'lucide-react';

const STATUS_TABS = [
  { id: 'ALL', label: 'All Customers' },
  { id: 'ACTIVE', label: 'Active' },
  { id: 'SUSPENDED', label: 'Suspended' },
];

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 20 });
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Status Modal State
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedCustomerForModal, setSelectedCustomerForModal] = useState(null);

  // Ref to track latest request sequence to avoid race conditions / stale updates
  const latestRequestIdRef = useRef(0);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset to page 1 whenever filters change
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedStatus, debouncedSearch, sortBy, sortOrder]);

  const fetchCustomers = useCallback(async (page = 1) => {
    const requestId = ++latestRequestIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const res = await adminCustomerApi.getCustomers({
        page,
        limit: 20,
        status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
        search: debouncedSearch.trim() || undefined,
        sortBy,
        sortOrder,
      });

      // Ignore out-of-order response
      if (requestId !== latestRequestIdRef.current) return;

      const customerList = res?.data?.customers || [];
      const paginationData = res?.data?.pagination || { page: 1, pages: 1, total: 0, limit: 20 };

      setCustomers(customerList);
      setPagination(paginationData);
    } catch (err) {
      if (requestId !== latestRequestIdRef.current) return;
      setError(err.message || 'Failed to load customers directory.');
    } finally {
      if (requestId === latestRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [selectedStatus, debouncedSearch, sortBy, sortOrder]);

  useEffect(() => {
    fetchCustomers(currentPage);
  }, [fetchCustomers, currentPage]);

  const handleOpenStatusModal = (customer) => {
    setSelectedCustomerForModal(customer);
    setStatusModalOpen(true);
  };

  const handleStatusUpdated = (updatedCustomer) => {
    setCustomers((prev) =>
      prev.map((c) => (c.id === updatedCustomer.id ? { ...c, status: updatedCustomer.status } : c))
    );
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setSelectedStatus('ALL');
    setSortBy('createdAt');
    setSortOrder('desc');
  };

  // Derive quick summary stats from the current page
  const activeCount = customers.filter((c) => c.status === 'ACTIVE').length;
  const suspendedCount = customers.filter((c) => c.status === 'SUSPENDED').length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#2A211B] flex items-center gap-2.5">
              <Users className="w-6 h-6 text-[#9A6A45]" />
              <span>Customer Management</span>
            </h1>
            <p className="text-xs text-[#6F6963] mt-1">
              Search and view customer profiles, monitor order frequency, and regulate account standing.
            </p>
          </div>

          <button
            type="button"
            onClick={() => fetchCustomers(currentPage)}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#E7DED5] text-xs font-semibold text-[#2A211B] hover:bg-[#F7F3EE] transition-colors self-start sm:self-auto cursor-pointer shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Search, Filter & Sort Controls */}
        <div className="bg-white border border-[#E7DED5] rounded-3xl p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1 max-w-lg">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6F6963]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search customers by name, email, or phone..."
                aria-label="Search customers"
                className="w-full pl-10 pr-9 py-2.5 rounded-2xl bg-[#F7F3EE] border border-[#E7DED5] text-xs text-[#2A211B] placeholder-[#6F6963] focus:outline-hidden focus:border-[#9A6A45] focus:bg-white transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6F6963] hover:text-[#2A211B] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Sorting Dropdown */}
            <div className="flex items-center gap-3">
              <label htmlFor="customer-sort-select" className="text-xs font-medium text-[#6F6963] shrink-0">
                Sort By:
              </label>
              <select
                id="customer-sort-select"
                value={`${sortBy}:${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split(':');
                  setSortBy(field);
                  setSortOrder(order);
                }}
                className="px-3 py-2 rounded-xl bg-[#F7F3EE] border border-[#E7DED5] text-xs font-medium text-[#2A211B] focus:outline-hidden focus:border-[#9A6A45] cursor-pointer"
              >
                <option value="createdAt:desc">Newest Registered</option>
                <option value="createdAt:asc">Oldest Registered</option>
                <option value="name:asc">Name (A – Z)</option>
                <option value="name:desc">Name (Z – A)</option>
                <option value="email:asc">Email (A – Z)</option>
              </select>
            </div>
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-2 border-t border-[#E7DED5] pt-3 overflow-x-auto no-scrollbar">
            {STATUS_TABS.map((tab) => {
              const isActive = selectedStatus === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedStatus(tab.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#2A211B] text-[#FAF7F2] shadow-xs'
                      : 'bg-[#F7F3EE] text-[#6F6963] hover:bg-[#E7DED5]/60 hover:text-[#2A211B]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-xs font-bold text-red-900">Failed to load customer directory</div>
              <div className="text-xs text-red-700 mt-0.5">{error}</div>
            </div>
            <button
              type="button"
              onClick={() => fetchCustomers(currentPage)}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Customer Table */}
        <AdminCustomerTable
          customers={customers}
          loading={loading}
          onOpenStatusModal={handleOpenStatusModal}
        />

        {/* Empty State */}
        {!loading && !error && customers.length === 0 && (
          <div className="bg-white border border-[#E7DED5] rounded-3xl p-12 text-center shadow-xs space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#F7F3EE] text-[#9A6A45] flex items-center justify-center mx-auto">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-[#2A211B]">No customers found</h3>
            <p className="text-xs text-[#6F6963] max-w-sm mx-auto">
              {debouncedSearch || selectedStatus !== 'ALL'
                ? 'No customer accounts matched your current search filters. Try clearing or broadening your search.'
                : 'No customer accounts are registered in the store yet.'}
            </p>
            {(debouncedSearch || selectedStatus !== 'ALL') && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2A211B] text-[#FAF7F2] hover:bg-[#9A6A45] text-xs font-semibold transition-colors cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>
        )}

        {/* Pagination Bar */}
        {!loading && pagination.total > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white border border-[#E7DED5] rounded-2xl px-5 py-3.5 shadow-xs text-xs text-[#6F6963]">
            <div>
              Showing{' '}
              <span className="font-semibold text-[#2A211B]">
                {(currentPage - 1) * pagination.limit + 1}
              </span>{' '}
              to{' '}
              <span className="font-semibold text-[#2A211B]">
                {Math.min(currentPage * pagination.limit, pagination.total)}
              </span>{' '}
              of <span className="font-semibold text-[#2A211B]">{pagination.total}</span> customers
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage <= 1 || loading}
                aria-label="Previous page"
                className="p-1.5 rounded-lg border border-[#E7DED5] text-[#2A211B] hover:bg-[#F7F3EE] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-3 font-medium text-[#2A211B]">
                Page {currentPage} of {pagination.pages || 1}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(p + 1, pagination.pages))}
                disabled={currentPage >= pagination.pages || loading}
                aria-label="Next page"
                className="p-1.5 rounded-lg border border-[#E7DED5] text-[#2A211B] hover:bg-[#F7F3EE] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Customer Status Update Modal */}
      <CustomerStatusModal
        isOpen={statusModalOpen}
        onClose={() => {
          setStatusModalOpen(false);
          setSelectedCustomerForModal(null);
        }}
        customer={selectedCustomerForModal}
        onStatusUpdated={handleStatusUpdated}
      />
    </AdminLayout>
  );
}
