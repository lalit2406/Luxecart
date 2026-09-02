import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { supportApi } from '../features/support/api/supportApi';
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
  XCircle,
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

export default function SupportTicketDetailPage() {
  const { ticketNumber } = useParams();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Reply message state
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [replyError, setReplyError] = useState(null);

  // Close ticket state
  const [closingTicket, setClosingTicket] = useState(false);

  const fetchTicketDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await supportApi.getTicketByNumber(ticketNumber);
      if (res?.success && res.data?.ticket) {
        setTicket(res.data.ticket);
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

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    setSendingReply(true);
    setReplyError(null);
    try {
      const res = await supportApi.addMessage(ticketNumber, { message: replyText.trim() });
      if (res?.success && res.data?.ticket) {
        setTicket(res.data.ticket);
        setReplyText('');
      }
    } catch (err) {
      console.error('Failed to send reply:', err);
      setReplyError(err.message || 'Failed to post message');
    } finally {
      setSendingReply(false);
    }
  };

  const handleCloseTicket = async () => {
    if (!window.confirm('Are you sure you want to close this support ticket?')) return;

    setClosingTicket(true);
    try {
      const res = await supportApi.closeTicket(ticketNumber, {
        status: 'CLOSED',
        note: 'Customer marked issue as resolved and closed ticket',
      });
      if (res?.success && res.data?.ticket) {
        setTicket(res.data.ticket);
      }
    } catch (err) {
      console.error('Failed to close ticket:', err);
      alert(err.message || 'Failed to close ticket');
    } finally {
      setClosingTicket(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F3EE] text-[#171513] flex flex-col justify-between">
        <Navbar />
        <main className="max-w-4xl mx-auto px-4 py-16 w-full flex-1 text-center text-[#705E51]">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-[#9A6A45]" />
          <p className="font-serif text-lg text-[#171513]">Loading support conversation...</p>
        </main>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="min-h-screen bg-[#F7F3EE] text-[#171513] flex flex-col justify-between">
        <Navbar />
        <main className="max-w-4xl mx-auto px-4 py-16 w-full flex-1">
          <div className="p-8 bg-white rounded-lg border border-rose-200 text-center space-y-4">
            <AlertCircle className="w-10 h-10 text-rose-600 mx-auto" />
            <h2 className="font-serif text-xl font-bold text-rose-900">Support Ticket Not Found</h2>
            <p className="text-sm text-rose-700">{error || `Ticket '${ticketNumber}' does not exist or you are not authorized to view it.`}</p>
            <Link
              to="/support"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#171513] text-white rounded text-xs hover:bg-[#2A211B] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Support Hub</span>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const statusConf = STATUS_CONFIG[ticket.status] || {
    label: ticket.status,
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    border: 'border-gray-200',
  };

  const isClosed = ticket.status === 'CLOSED';

  return (
    <div className="min-h-screen bg-[#F7F3EE] text-[#171513] flex flex-col justify-between">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 w-full flex-1 space-y-6">
        {/* Navigation & Actions */}
        <div className="flex items-center justify-between gap-4">
          <Link
            to="/support"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#705E51] hover:text-[#171513] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to All Tickets</span>
          </Link>

          {!isClosed && (
            <button
              onClick={handleCloseTicket}
              disabled={closingTicket}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-rose-300 text-rose-700 rounded text-xs font-medium hover:bg-rose-50 transition-colors"
            >
              {closingTicket ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 text-rose-600" />}
              <span>Close Ticket</span>
            </button>
          )}
        </div>

        {/* Ticket Header Card */}
        <div className="bg-white p-6 rounded-lg border border-[#E7DED5] space-y-4 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F7F3EE] pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-mono text-sm font-bold text-[#9A6A45] bg-[#F7F3EE] px-2.5 py-0.5 rounded border border-[#E7DED5]">
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
              <h1 className="font-serif font-bold text-xl sm:text-2xl text-[#171513] pt-1">
                {ticket.subject}
              </h1>
            </div>

            <span className="text-xs text-[#705E51] shrink-0">
              Opened on {new Date(ticket.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>

          {/* Reference Meta */}
          <div className="flex items-center gap-4 text-xs text-[#705E51] flex-wrap">
            {ticket.orderNumber && (
              <Link
                to={`/orders/${ticket.orderNumber}`}
                className="inline-flex items-center gap-1.5 bg-[#FDFBF7] px-3 py-1.5 rounded border border-[#E7DED5] hover:border-[#9A6A45] transition-colors"
              >
                <Package className="w-4 h-4 text-[#9A6A45]" />
                <span>Related Order: <strong className="text-[#171513]">{ticket.orderNumber}</strong></span>
              </Link>
            )}

            {ticket.returnNumber && (
              <span className="inline-flex items-center gap-1.5 bg-[#FDFBF7] px-3 py-1.5 rounded border border-[#E7DED5]">
                <RotateCcw className="w-4 h-4 text-[#9A6A45]" />
                <span>Related Return: <strong className="text-[#171513]">{ticket.returnNumber}</strong></span>
              </span>
            )}
          </div>
        </div>

        {/* Action Required Notice (If WAITING_FOR_CUSTOMER) */}
        {ticket.status === 'WAITING_FOR_CUSTOMER' && (
          <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg flex items-center gap-3 text-orange-900 text-xs">
            <AlertCircle className="w-5 h-5 text-orange-600 shrink-0" />
            <p>
              <strong>Our concierge team is waiting for your reply.</strong> Please post a response in the message box below to proceed.
            </p>
          </div>
        )}

        {/* Closed Banner */}
        {isClosed && (
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg flex items-center gap-3 text-gray-700 text-xs">
            <CheckCircle2 className="w-5 h-5 text-gray-500 shrink-0" />
            <p>
              This support ticket is <strong>Closed</strong>. No further replies can be posted. If you need further assistance, please open a new ticket.
            </p>
          </div>
        )}

        {/* Conversation Thread */}
        <div className="space-y-4">
          <h2 className="font-serif font-bold text-base text-[#171513] flex items-center gap-2">
            <span>Conversation Thread</span>
            <span className="text-xs text-[#705E51] font-normal">
              ({ticket.messages?.length || 0} messages)
            </span>
          </h2>

          <div className="space-y-4">
            {ticket.messages?.map((msg, index) => {
              const isAdmin = msg.senderType === 'ADMIN';

              return (
                <div
                  key={msg.id || msg._id || index}
                  className={`p-5 rounded-lg border ${
                    isAdmin
                      ? 'bg-[#FDFBF7] border-[#E7DED5] ml-0 sm:ml-6'
                      : 'bg-white border-[#E7DED5] mr-0 sm:mr-6'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 border-b border-[#F7F3EE] pb-2 mb-3">
                    <div className="flex items-center gap-2">
                      {isAdmin ? (
                        <div className="w-6 h-6 rounded-full bg-[#171513] text-white flex items-center justify-center">
                          <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-[#9A6A45] text-white flex items-center justify-center">
                          <User className="w-3.5 h-3.5" />
                        </div>
                      )}
                      <div>
                        <span className="text-xs font-bold text-[#171513]">
                          {isAdmin ? 'LuxeCart Support Concierge' : 'You (Customer)'}
                        </span>
                      </div>
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

        {/* Reply Box */}
        {!isClosed && (
          <div className="bg-white p-5 rounded-lg border border-[#E7DED5] space-y-3">
            <h3 className="font-serif font-bold text-sm text-[#171513]">
              Post a Reply
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
                placeholder="Type your message to the support concierge..."
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
                  className="px-4 py-2 bg-[#171513] text-white rounded text-xs font-semibold hover:bg-[#2A211B] transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sendingReply ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Send Message</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
