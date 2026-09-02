import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import { adminSupportApi } from '../../features/admin/support/api/adminSupportApi';
import {
  ArrowLeft,
  LifeBuoy,
  Send,
  CheckCircle2,
  Clock,
  AlertCircle,
  Package,
  RotateCcw,
  RefreshCw,
  User,
  ShieldCheck,
  UserCheck,
  Flag,
  FileText,
  XCircle,
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

const ALLOWED_ADMIN_TRANSITIONS = {
  OPEN: ['IN_PROGRESS', 'CLOSED'],
  IN_PROGRESS: ['WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED'],
  WAITING_FOR_CUSTOMER: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  RESOLVED: ['CLOSED'],
  CLOSED: [],
};

export default function AdminSupportTicketDetailPage() {
  const { ticketNumber } = useParams();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Status Update State
  const [statusNote, setStatusNote] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState(null);

  // Priority Update State
  const [selectedPriority, setSelectedPriority] = useState('');
  const [updatingPriority, setUpdatingPriority] = useState(false);

  // Reply State
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [replyError, setReplyError] = useState(null);

  const fetchTicketDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminSupportApi.getAdminTicketByNumber(ticketNumber);
      if (res?.success && res.data?.ticket) {
        setTicket(res.data.ticket);
        setSelectedPriority(res.data.ticket.priority);
      } else {
        setError('Support ticket not found');
      }
    } catch (err) {
      console.error('Failed to load support ticket:', err);
      setError(err.message || 'Failed to load support ticket');
    } finally {
      setLoading(false);
    }
  }, [ticketNumber]);

  useEffect(() => {
    fetchTicketDetails();
  }, [fetchTicketDetails]);

  const handleStatusChange = async (targetStatus) => {
    setUpdatingStatus(true);
    setStatusError(null);
    try {
      const res = await adminSupportApi.updateTicketStatus(ticketNumber, {
        status: targetStatus,
        note: statusNote.trim() || undefined,
      });
      if (res?.success && res.data?.ticket) {
        setTicket(res.data.ticket);
        setStatusNote('');
      }
    } catch (err) {
      console.error('Failed to update status:', err);
      setStatusError(err.message || 'Failed to update ticket status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handlePriorityChange = async (e) => {
    const newPriority = e.target.value;
    setSelectedPriority(newPriority);
    setUpdatingPriority(true);
    try {
      const res = await adminSupportApi.updateTicketPriority(ticketNumber, {
        priority: newPriority,
      });
      if (res?.success && res.data?.ticket) {
        setTicket(res.data.ticket);
      }
    } catch (err) {
      console.error('Failed to update priority:', err);
      alert(err.message || 'Failed to update priority');
      setSelectedPriority(ticket?.priority || 'NORMAL');
    } finally {
      setUpdatingPriority(false);
    }
  };

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    setSendingReply(true);
    setReplyError(null);
    try {
      const res = await adminSupportApi.addAdminMessage(ticketNumber, {
        message: replyText.trim(),
      });
      if (res?.success && res.data?.ticket) {
        setTicket(res.data.ticket);
        setReplyText('');
      }
    } catch (err) {
      console.error('Failed to post reply:', err);
      setReplyError(err.message || 'Failed to post message');
    } finally {
      setSendingReply(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-16 text-center text-[#705E51]">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-[#9A6A45]" />
          <p className="font-serif text-lg text-[#171513]">Loading support ticket...</p>
        </div>
      </AdminLayout>
    );
  }

  if (error || !ticket) {
    return (
      <AdminLayout>
        <div className="p-8 bg-white rounded-lg border border-rose-200 text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-rose-600 mx-auto" />
          <h2 className="font-serif text-xl font-bold text-rose-900">Support Ticket Not Found</h2>
          <p className="text-sm text-rose-700">{error || `Ticket '${ticketNumber}' does not exist.`}</p>
          <Link
            to="/admin/support"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#171513] text-white rounded text-sm hover:bg-[#2A211B] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Support List</span>
          </Link>
        </div>
      </AdminLayout>
    );
  }

  const statusConf = STATUS_CONFIG[ticket.status] || {
    label: ticket.status,
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    border: 'border-gray-200',
  };

  const isClosed = ticket.status === 'CLOSED';
  const allowedTransitions = ALLOWED_ADMIN_TRANSITIONS[ticket.status] || [];

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-6xl">
        {/* Navigation & Header */}
        <div>
          <Link
            to="/admin/support"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#705E51] hover:text-[#171513] transition-colors mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Support Tickets Listing</span>
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-mono text-base font-bold text-[#171513] bg-white px-2.5 py-0.5 rounded border border-[#E7DED5]">
                  {ticket.ticketNumber}
                </span>
                <span
                  className={`inline-flex items-center px-3 py-0.5 rounded-full text-xs font-semibold border ${statusConf.bg} ${statusConf.text} ${statusConf.border}`}
                >
                  {statusConf.label}
                </span>
                <span className="text-xs text-[#705E51] font-medium">
                  {CATEGORY_LABELS[ticket.category] || ticket.category}
                </span>
              </div>
              <h1 className="font-serif text-2xl font-bold text-[#171513] mt-1">
                {ticket.subject}
              </h1>
            </div>

            <span className="text-xs text-[#705E51]">
              Created on {new Date(ticket.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        </div>

        {/* Overview Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Customer Info */}
          <div className="bg-white p-4 rounded-lg border border-[#E7DED5] space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[#705E51] uppercase tracking-wider">
              <User className="w-4 h-4 text-[#9A6A45]" />
              <span>Customer Information</span>
            </div>
            <p className="font-semibold text-[#171513] text-sm">{ticket.userId?.name || 'Unknown'}</p>
            <p className="text-xs text-[#705E51]">{ticket.userId?.email}</p>
            <p className="text-xs text-[#705E51]">{ticket.userId?.phone || 'No phone provided'}</p>
          </div>

          {/* Related Order / Return */}
          <div className="bg-white p-4 rounded-lg border border-[#E7DED5] space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[#705E51] uppercase tracking-wider">
              <Package className="w-4 h-4 text-[#9A6A45]" />
              <span>Linked References</span>
            </div>
            {ticket.orderNumber ? (
              <p className="text-xs">
                Order:{' '}
                <Link
                  to={`/admin/orders/${ticket.orderNumber}`}
                  className="font-semibold text-[#9A6A45] hover:underline"
                >
                  #{ticket.orderNumber}
                </Link>
              </p>
            ) : (
              <p className="text-xs text-gray-400 italic">No order linked</p>
            )}

            {ticket.returnNumber ? (
              <p className="text-xs">
                Return:{' '}
                <Link
                  to={`/admin/returns/${ticket.returnNumber}`}
                  className="font-semibold text-[#9A6A45] hover:underline"
                >
                  #{ticket.returnNumber}
                </Link>
              </p>
            ) : (
              <p className="text-xs text-gray-400 italic">No return linked</p>
            )}
          </div>

          {/* Assignment & Priority */}
          <div className="bg-white p-4 rounded-lg border border-[#E7DED5] space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[#705E51] uppercase tracking-wider">
              <Flag className="w-4 h-4 text-[#9A6A45]" />
              <span>Priority & Assignment</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#705E51]">Priority:</span>
              <select
                value={selectedPriority}
                onChange={handlePriorityChange}
                disabled={updatingPriority || isClosed}
                className="p-1 border border-[#E7DED5] rounded text-xs bg-white focus:outline-hidden focus:border-[#9A6A45]"
              >
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
            <div className="text-xs text-[#705E51]">
              Assigned To:{' '}
              <strong className="text-[#171513]">
                {ticket.assignedTo ? ticket.assignedTo.name : 'Unassigned'}
              </strong>
            </div>
          </div>
        </div>

        {/* Status Transition Controls */}
        {!isClosed && allowedTransitions.length > 0 && (
          <div className="bg-[#FDFBF7] p-4 rounded-lg border border-[#E7DED5] space-y-3">
            <h3 className="font-serif font-bold text-sm text-[#171513]">
              Administrative Status Transition
            </h3>

            {statusError && (
              <div className="p-2 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded">
                {statusError}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <input
                type="text"
                placeholder="Optional transition note for audit history..."
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                maxLength={500}
                className="w-full sm:flex-1 p-2 border border-[#E7DED5] rounded text-xs focus:outline-hidden focus:border-[#9A6A45] bg-white"
              />

              <div className="flex items-center gap-2 shrink-0">
                {allowedTransitions.map((statusKey) => {
                  const conf = STATUS_CONFIG[statusKey] || { label: statusKey };
                  return (
                    <button
                      key={statusKey}
                      onClick={() => handleStatusChange(statusKey)}
                      disabled={updatingStatus}
                      className="px-3 py-2 bg-[#171513] text-white rounded text-xs font-semibold hover:bg-[#2A211B] transition-colors shadow-2xs"
                    >
                      {updatingStatus ? 'Updating...' : `Move to ${conf.label}`}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Conversation Thread */}
        <div className="space-y-4">
          <h2 className="font-serif font-bold text-base text-[#171513]">
            Conversation History ({ticket.messages?.length || 0} messages)
          </h2>

          <div className="space-y-4">
            {ticket.messages?.map((msg, index) => {
              const isAdmin = msg.senderType === 'ADMIN';

              return (
                <div
                  key={msg.id || msg._id || index}
                  className={`p-4 rounded-lg border ${
                    isAdmin
                      ? 'bg-amber-50/50 border-amber-200 ml-0 sm:ml-6'
                      : 'bg-white border-[#E7DED5] mr-0 sm:mr-6'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 border-b border-[#E7DED5]/60 pb-2 mb-2">
                    <div className="flex items-center gap-2">
                      {isAdmin ? (
                        <div className="w-5 h-5 rounded-full bg-[#171513] text-white flex items-center justify-center">
                          <ShieldCheck className="w-3 h-3 text-amber-400" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-[#9A6A45] text-white flex items-center justify-center">
                          <User className="w-3 h-3" />
                        </div>
                      )}
                      <span className="text-xs font-bold text-[#171513]">
                        {isAdmin ? `Admin (${msg.senderId?.name || 'Support Agent'})` : `${ticket.userId?.name || 'Customer'}`}
                      </span>
                    </div>

                    <span className="text-[11px] text-[#705E51]">
                      {new Date(msg.createdAt).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <p className="text-xs text-[#171513] whitespace-pre-wrap leading-relaxed">
                    {msg.message}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Admin Reply Box */}
        {!isClosed && (
          <div className="bg-white p-5 rounded-lg border border-[#E7DED5] space-y-3">
            <h3 className="font-serif font-bold text-sm text-[#171513]">
              Post Official Support Response
            </h3>

            {replyError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded">
                {replyError}
              </div>
            )}

            <form onSubmit={handleSendReply} className="space-y-3">
              <textarea
                rows={3}
                required
                placeholder="Type response to customer..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                maxLength={3000}
                className="w-full p-3 border border-[#E7DED5] rounded text-xs focus:outline-hidden focus:border-[#9A6A45]"
              />

              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#705E51]">{replyText.length}/3000</span>
                <button
                  type="submit"
                  disabled={sendingReply || !replyText.trim()}
                  className="px-4 py-2 bg-[#171513] text-white rounded text-xs font-semibold hover:bg-[#2A211B] transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {sendingReply ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Send Response</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Audit Status History */}
        <div className="bg-white p-4 rounded-lg border border-[#E7DED5] space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-[#705E51] uppercase tracking-wider border-b border-[#E7DED5] pb-2">
            <Clock className="w-4 h-4 text-[#9A6A45]" />
            <span>Status Transition Audit History</span>
          </div>

          <div className="space-y-2">
            {ticket.statusHistory?.map((hist, index) => {
              const conf = STATUS_CONFIG[hist.status] || { label: hist.status };
              return (
                <div key={index} className="flex items-start gap-3 text-xs border-l-2 border-[#E7DED5] pl-3 py-1">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded font-semibold ${conf.bg} ${conf.text}`}>
                        {conf.label}
                      </span>
                      <span className="text-[#705E51]">
                        {new Date(hist.changedAt).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    {hist.changedBy && (
                      <p className="text-[11px] text-[#705E51]">
                        By: <strong className="text-[#171513]">{hist.changedBy.name || hist.changedBy}</strong>
                      </p>
                    )}
                    {hist.note && <p className="text-[#705E51] italic">"{hist.note}"</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
