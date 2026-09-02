import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import { adminSupportApi } from '../../features/admin/support/api/adminSupportApi';
import {
  LifeBuoy,
  Search,
  Filter,
  Clock,
  User,
  Package,
  RotateCcw,
  RefreshCw,
  AlertCircle,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';

const STATUS_CONFIG = {
  OPEN: { label: 'Open', bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' },
  IN_PROGRESS: { label: 'In Progress', bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
  WAITING_FOR_CUSTOMER: { label: 'Waiting on Customer', bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
  RESOLVED: { label: 'Resolved', bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200' },
  CLOSED: { label: 'Closed', bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200' },
};

const PRIORITY_CONFIG = {
  LOW: { label: 'Low', bg: 'bg-gray-100', text: 'text-gray-700' },
  NORMAL: { label: 'Normal', bg: 'bg-blue-50', text: 'text-blue-700' },
  HIGH: { label: 'High', bg: 'bg-amber-100', text: 'text-amber-900' },
  URGENT: { label: 'Urgent', bg: 'bg-rose-100', text: 'text-rose-900' },
};

const CATEGORY_LABELS = {
  ORDER_ISSUE: 'Order Issue',
  DELIVERY_ISSUE: 'Delivery Issue',
  RETURN_ISSUE: 'Return Issue',
  REFUND_ISSUE: 'Refund Issue',
  PRODUCT_ISSUE: 'Product Issue',
  PAYMENT_ISSUE: 'Payment Issue',
  ACCOUNT_ISSUE: 'Account Issue',
  OTHER: 'General',
};

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Query State
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminSupportApi.getAdminTickets({
        page: pagination.page,
        limit: pagination.limit,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        category: categoryFilter || undefined,
        search: searchTerm.trim() || undefined,
      });

      if (res?.success && res.data) {
        setTickets(res.data.tickets || []);
        if (res.data.pagination) {
          setPagination(res.data.pagination);
        }
      }
    } catch (err) {
      console.error('Failed to load admin support tickets:', err);
      setError(err.message || 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, statusFilter, priorityFilter, categoryFilter, searchTerm]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchTickets();
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E7DED5] pb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <LifeBuoy className="w-6 h-6 text-[#9A6A45]" />
              <h1 className="font-serif text-2xl md:text-3xl font-bold text-[#171513]">
                Customer Support Portal
              </h1>
            </div>
            <p className="text-xs text-[#705E51] mt-1">
              Manage inquiries, order escalations, return assistance, and resolution threads.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchTickets}
              className="p-2 border border-[#E7DED5] rounded hover:bg-[#F7F3EE] text-[#705E51] transition-colors"
              title="Refresh tickets"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white p-4 rounded-lg border border-[#E7DED5] space-y-3">
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#705E51]" />
              <input
                type="text"
                placeholder="Search ticket #, customer name, order #, return #, or subject..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-[#E7DED5] rounded text-xs focus:outline-hidden focus:border-[#9A6A45]"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-[#171513] text-white rounded text-xs font-semibold hover:bg-[#2A211B] transition-colors"
            >
              Search
            </button>
          </form>

          <div className="flex items-center gap-3 flex-wrap pt-1 text-xs">
            {/* Status Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-[#705E51] font-semibold">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="p-1.5 border border-[#E7DED5] rounded bg-white text-xs focus:outline-hidden focus:border-[#9A6A45]"
              >
                <option value="">All Statuses</option>
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="WAITING_FOR_CUSTOMER">Waiting on Customer</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>

            {/* Priority Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-[#705E51] font-semibold">Priority:</span>
              <select
                value={priorityFilter}
                onChange={(e) => {
                  setPriorityFilter(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="p-1.5 border border-[#E7DED5] rounded bg-white text-xs focus:outline-hidden focus:border-[#9A6A45]"
              >
                <option value="">All Priorities</option>
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>

            {/* Category Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-[#705E51] font-semibold">Category:</span>
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="p-1.5 border border-[#E7DED5] rounded bg-white text-xs focus:outline-hidden focus:border-[#9A6A45]"
              >
                <option value="">All Categories</option>
                {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {(statusFilter || priorityFilter || categoryFilter || searchTerm) && (
              <button
                onClick={() => {
                  setStatusFilter('');
                  setPriorityFilter('');
                  setCategoryFilter('');
                  setSearchTerm('');
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="text-[#9A6A45] hover:underline font-semibold text-xs ml-auto"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* Tickets Table / List */}
        {loading ? (
          <div className="p-16 text-center text-[#705E51] bg-white rounded-lg border border-[#E7DED5]">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-[#9A6A45]" />
            <p className="font-serif text-lg text-[#171513]">Loading support tickets...</p>
          </div>
        ) : error ? (
          <div className="p-8 bg-white rounded-lg border border-rose-200 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
            <h3 className="font-serif text-lg font-bold text-rose-900">Failed to Load Support Tickets</h3>
            <p className="text-xs text-rose-700">{error}</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-12 bg-white rounded-lg border border-[#E7DED5] text-center space-y-3">
            <LifeBuoy className="w-10 h-10 text-[#9A6A45] opacity-40 mx-auto" />
            <h3 className="font-serif text-base font-bold text-[#171513]">No Support Tickets Match Your Filters</h3>
            <p className="text-xs text-[#705E51]">
              Try adjusting your search criteria or resetting filters.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-[#E7DED5] overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F7F3EE] border-b border-[#E7DED5] text-[#705E51] uppercase font-bold text-[11px] tracking-wider">
                    <th className="p-3.5">Ticket #</th>
                    <th className="p-3.5">Customer</th>
                    <th className="p-3.5">Subject & Category</th>
                    <th className="p-3.5">Priority</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Assigned To</th>
                    <th className="p-3.5">Created</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7DED5]">
                  {tickets.map((ticket) => {
                    const statusConf = STATUS_CONFIG[ticket.status] || {
                      label: ticket.status,
                      bg: 'bg-gray-100',
                      text: 'text-gray-700',
                      border: 'border-gray-200',
                    };
                    const priorityConf = PRIORITY_CONFIG[ticket.priority] || {
                      label: ticket.priority,
                      bg: 'bg-gray-100',
                      text: 'text-gray-700',
                    };

                    return (
                      <tr key={ticket.ticketNumber || ticket.id} className="hover:bg-[#FDFBF7] transition-colors">
                        <td className="p-3.5 font-mono font-bold text-[#171513]">
                          {ticket.ticketNumber}
                        </td>
                        <td className="p-3.5">
                          <p className="font-semibold text-[#171513]">{ticket.userId?.name || 'Customer'}</p>
                          <p className="text-[11px] text-[#705E51]">{ticket.userId?.email}</p>
                        </td>
                        <td className="p-3.5 max-w-xs">
                          <p className="font-medium text-[#171513] truncate" title={ticket.subject}>
                            {ticket.subject}
                          </p>
                          <div className="flex items-center gap-2 pt-0.5">
                            <span className="text-[10px] text-[#705E51] font-semibold bg-[#F7F3EE] px-1.5 py-0.5 rounded border border-[#E7DED5]">
                              {CATEGORY_LABELS[ticket.category] || ticket.category}
                            </span>
                            {ticket.orderNumber && (
                              <span className="text-[10px] text-[#9A6A45] font-mono">
                                #{ticket.orderNumber}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${priorityConf.bg} ${priorityConf.text}`}>
                            {priorityConf.label}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusConf.bg} ${statusConf.text} ${statusConf.border}`}
                          >
                            {statusConf.label}
                          </span>
                        </td>
                        <td className="p-3.5 text-[#705E51]">
                          {ticket.assignedTo ? (
                            <span className="font-medium text-[#171513]">{ticket.assignedTo.name}</span>
                          ) : (
                            <span className="italic text-gray-400">Unassigned</span>
                          )}
                        </td>
                        <td className="p-3.5 text-[#705E51]">
                          {new Date(ticket.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="p-3.5 text-right">
                          <Link
                            to={`/admin/support/tickets/${ticket.ticketNumber}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#171513] text-white rounded text-xs font-medium hover:bg-[#2A211B] transition-colors shadow-2xs"
                          >
                            <span>Manage</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {pagination.pages > 1 && (
              <div className="p-3.5 bg-[#F7F3EE] border-t border-[#E7DED5] flex items-center justify-between text-xs text-[#705E51]">
                <span>
                  Showing page {pagination.page} of {pagination.pages} ({pagination.total} total tickets)
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
                    disabled={pagination.page >= pagination.pages}
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
    </AdminLayout>
  );
}
