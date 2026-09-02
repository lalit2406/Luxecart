import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { supportApi } from '../features/support/api/supportApi';
import {
  LifeBuoy,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Package,
  RotateCcw,
  RefreshCw,
  X,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';

const STATUS_CONFIG = {
  OPEN: { label: 'Open', bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' },
  IN_PROGRESS: { label: 'In Progress', bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
  WAITING_FOR_CUSTOMER: { label: 'Action Required', bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
  RESOLVED: { label: 'Resolved', bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200' },
  CLOSED: { label: 'Closed', bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200' },
};

const CATEGORY_LABELS = {
  ORDER_ISSUE: 'Order & Items Inquiry',
  DELIVERY_ISSUE: 'Delivery / Courier Issue',
  RETURN_ISSUE: 'Return & Exchange Assistance',
  REFUND_ISSUE: 'Refund Settlement Issue',
  PRODUCT_ISSUE: 'Product Quality / Defect Issue',
  PAYMENT_ISSUE: 'Payment / Billing Problem',
  ACCOUNT_ISSUE: 'Account & Security Concern',
  OTHER: 'General Support Inquiry',
};

export default function SupportPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });

  // Modal State for New Ticket
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    subject: '',
    category: 'ORDER_ISSUE',
    orderNumber: searchParams.get('orderNumber') || '',
    returnNumber: searchParams.get('returnNumber') || '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState(null);

  // Automatically open modal if orderNumber or returnNumber in URL params
  useEffect(() => {
    const orderParam = searchParams.get('orderNumber');
    const returnParam = searchParams.get('returnNumber');
    if (orderParam || returnParam) {
      setFormData((prev) => ({
        ...prev,
        orderNumber: orderParam || '',
        returnNumber: returnParam || '',
        category: returnParam ? 'RETURN_ISSUE' : orderParam ? 'ORDER_ISSUE' : prev.category,
      }));
      setIsModalOpen(true);
    }
  }, [searchParams]);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await supportApi.getMyTickets({
        page: pagination.page,
        limit: pagination.limit,
        status: selectedStatus || undefined,
      });

      if (res?.success && res.data) {
        setTickets(res.data.tickets || []);
        if (res.data.pagination) {
          setPagination(res.data.pagination);
        }
      }
    } catch (err) {
      console.error('Failed to fetch support tickets:', err);
      setError(err.message || 'Failed to load support tickets');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, selectedStatus]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleCreateTicketSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setModalError(null);

    try {
      const payload = {
        subject: formData.subject.trim(),
        category: formData.category,
        message: formData.message.trim(),
        orderNumber: formData.orderNumber.trim() || undefined,
        returnNumber: formData.returnNumber.trim() || undefined,
      };

      const res = await supportApi.createTicket(payload);
      if (res?.success) {
        setIsModalOpen(false);
        setFormData({
          subject: '',
          category: 'ORDER_ISSUE',
          orderNumber: '',
          returnNumber: '',
          message: '',
        });
        // Clear search params
        setSearchParams({});
        await fetchTickets();
      }
    } catch (err) {
      console.error('Failed to create ticket:', err);
      setModalError(err.message || 'Failed to create support ticket');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F3EE] text-[#171513] flex flex-col justify-between">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 w-full flex-1">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-[#705E51] mb-6">
          <Link to="/" className="hover:text-[#171513]">
            Home
          </Link>
          <span>/</span>
          <span className="text-[#171513] font-semibold">Customer Support</span>
        </div>

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E7DED5] pb-6 mb-8">
          <div>
            <div className="flex items-center gap-2.5">
              <LifeBuoy className="w-6 h-6 text-[#9A6A45]" />
              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#171513]">
                Customer Support Hub
              </h1>
            </div>
            <p className="text-xs text-[#705E51] mt-1">
              Have an issue with your luxury order, parcel delivery, or return? Create a support ticket and our concierge team will assist you.
            </p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#171513] text-white rounded text-xs font-semibold hover:bg-[#2A211B] transition-colors shadow-xs shrink-0 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Ticket</span>
          </button>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6 border-b border-[#E7DED5]">
          {[
            { value: '', label: 'All Tickets' },
            { value: 'OPEN', label: 'Open' },
            { value: 'IN_PROGRESS', label: 'In Progress' },
            { value: 'WAITING_FOR_CUSTOMER', label: 'Action Required' },
            { value: 'RESOLVED', label: 'Resolved' },
            { value: 'CLOSED', label: 'Closed' },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => {
                setSelectedStatus(tab.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedStatus === tab.value
                  ? 'bg-[#171513] text-white'
                  : 'bg-white text-[#705E51] hover:bg-[#EAE2D8] border border-[#E7DED5]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Section */}
        {loading ? (
          <div className="p-16 text-center text-[#705E51]">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-[#9A6A45]" />
            <p className="font-serif text-lg text-[#171513]">Loading support tickets...</p>
          </div>
        ) : error ? (
          <div className="p-8 bg-white rounded-lg border border-rose-200 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
            <h3 className="font-serif text-lg font-bold text-rose-900">Failed to Load Tickets</h3>
            <p className="text-xs text-rose-700">{error}</p>
            <button
              onClick={fetchTickets}
              className="px-4 py-2 bg-[#171513] text-white rounded text-xs hover:bg-[#2A211B] transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-12 bg-white rounded-lg border border-[#E7DED5] text-center space-y-4">
            <LifeBuoy className="w-12 h-12 text-[#9A6A45] opacity-40 mx-auto" />
            <div>
              <h3 className="font-serif text-lg font-bold text-[#171513]">No Support Tickets Found</h3>
              <p className="text-xs text-[#705E51] mt-1 max-w-md mx-auto">
                {selectedStatus
                  ? `You have no support tickets currently in status '${selectedStatus}'.`
                  : 'You have not submitted any support inquiries yet. If you need assistance with an order or product, create your first ticket.'}
              </p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#9A6A45] text-white rounded text-xs font-semibold hover:bg-[#7D5335] transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Submit Inquire Ticket</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {tickets.map((ticket) => {
              const statusConf = STATUS_CONFIG[ticket.status] || {
                label: ticket.status,
                bg: 'bg-gray-100',
                text: 'text-gray-700',
                border: 'border-gray-200',
              };

              const lastMessage = ticket.messages?.[ticket.messages.length - 1];

              return (
                <Link
                  key={ticket.ticketNumber || ticket.id}
                  to={`/support/tickets/${ticket.ticketNumber}`}
                  className="block bg-white p-5 rounded-lg border border-[#E7DED5] hover:border-[#9A6A45] transition-all shadow-2xs hover:shadow-xs group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F7F3EE] pb-3 mb-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-mono text-xs font-bold text-[#9A6A45] bg-[#F7F3EE] px-2 py-0.5 rounded border border-[#E7DED5]">
                        {ticket.ticketNumber}
                      </span>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${statusConf.bg} ${statusConf.text} ${statusConf.border}`}
                      >
                        {statusConf.label}
                      </span>
                      <span className="text-xs text-[#705E51] font-medium">
                        {CATEGORY_LABELS[ticket.category] || ticket.category}
                      </span>
                    </div>

                    <span className="text-[11px] text-[#705E51] flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>
                        {new Date(ticket.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </span>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-serif font-bold text-base text-[#171513] group-hover:text-[#9A6A45] transition-colors">
                      {ticket.subject}
                    </h3>

                    {lastMessage && (
                      <p className="text-xs text-[#705E51] line-clamp-2 italic">
                        "{lastMessage.message}"
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-[#705E51] pt-2 flex-wrap">
                      {ticket.orderNumber && (
                        <span className="inline-flex items-center gap-1 bg-[#FDFBF7] px-2 py-0.5 rounded border border-[#E7DED5]">
                          <Package className="w-3.5 h-3.5 text-[#9A6A45]" />
                          <span>Order: <strong className="text-[#171513]">{ticket.orderNumber}</strong></span>
                        </span>
                      )}
                      {ticket.returnNumber && (
                        <span className="inline-flex items-center gap-1 bg-[#FDFBF7] px-2 py-0.5 rounded border border-[#E7DED5]">
                          <RotateCcw className="w-3.5 h-3.5 text-[#9A6A45]" />
                          <span>Return: <strong className="text-[#171513]">{ticket.returnNumber}</strong></span>
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 ml-auto text-[#9A6A45] font-semibold group-hover:translate-x-0.5 transition-transform">
                        <span>View Thread ({ticket.messages?.length || 1})</span>
                        <ChevronRight className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Create Ticket Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <div className="bg-white rounded-lg border border-[#E7DED5] max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-[#E7DED5] pb-3">
                <div className="flex items-center gap-2">
                  <LifeBuoy className="w-5 h-5 text-[#9A6A45]" />
                  <h3 className="font-serif font-bold text-lg text-[#171513]">Create Support Ticket</h3>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                  className="text-[#705E51] hover:text-[#171513]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded">
                  {modalError}
                </div>
              )}

              <form onSubmit={handleCreateTicketSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#171513] mb-1">
                    Subject *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Question regarding delivery timing for my order"
                    value={formData.subject}
                    onChange={(e) => setFormData((prev) => ({ ...prev, subject: e.target.value }))}
                    minLength={3}
                    maxLength={200}
                    className="w-full p-2.5 border border-[#E7DED5] rounded text-xs focus:outline-hidden focus:border-[#9A6A45]"
                  />
                  <span className="text-[10px] text-[#705E51]">{formData.subject.length}/200</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#171513] mb-1">
                    Issue Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                    className="w-full p-2.5 border border-[#E7DED5] rounded text-xs focus:outline-hidden focus:border-[#9A6A45] bg-white"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#171513] mb-1">
                      Related Order Number (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. LC-20260830-1234"
                      value={formData.orderNumber}
                      onChange={(e) => setFormData((prev) => ({ ...prev, orderNumber: e.target.value }))}
                      className="w-full p-2 border border-[#E7DED5] rounded text-xs focus:outline-hidden focus:border-[#9A6A45]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#171513] mb-1">
                      Related Return Number (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. RET-20260830-5678"
                      value={formData.returnNumber}
                      onChange={(e) => setFormData((prev) => ({ ...prev, returnNumber: e.target.value }))}
                      className="w-full p-2 border border-[#E7DED5] rounded text-xs focus:outline-hidden focus:border-[#9A6A45]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#171513] mb-1">
                    Detailed Message *
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Describe your inquiry or issue in detail..."
                    value={formData.message}
                    onChange={(e) => setFormData((prev) => ({ ...prev, message: e.target.value }))}
                    minLength={5}
                    maxLength={3000}
                    className="w-full p-2.5 border border-[#E7DED5] rounded text-xs focus:outline-hidden focus:border-[#9A6A45]"
                  />
                  <span className="text-[10px] text-[#705E51]">{formData.message.length}/3000</span>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E7DED5]">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    disabled={submitting}
                    className="px-4 py-2 border border-[#E7DED5] text-xs font-medium text-[#705E51] rounded hover:bg-[#F7F3EE] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-[#171513] text-white rounded text-xs font-semibold hover:bg-[#2A211B] transition-colors flex items-center gap-1.5"
                  >
                    {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>Submit Ticket</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
