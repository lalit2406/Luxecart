import React, { useState, useEffect, useCallback } from 'react';
import logisticsApi from '../api/logisticsApi';
import {
  maskPhone,
  maskEmail,
  getMilestoneConfig,
} from '../constants/trackingUtils';
import {
  Truck,
  Package,
  Copy,
  Check,
  MapPin,
  Clock,
  AlertTriangle,
  RefreshCw,
  MessageSquare,
  Mail,
  X,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

export { maskPhone, maskEmail, getMilestoneConfig };

export default function CustomerTrackingCard({ order }) {
  const orderNumber = order?.orderNumber;

  const [shipment, setShipment] = useState(null);
  const [hasShipment, setHasShipment] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Copy Feedback
  const [copied, setCopied] = useState(false);

  // Notification Feed Modal
  const [notifModalOpen, setNotifModalOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);

  // Fetch Tracking Data
  const fetchTracking = useCallback(async () => {
    if (!orderNumber) return;
    setLoading(true);
    setError(null);

    try {
      const res = await logisticsApi.getOrderTracking(orderNumber);
      if (res?.data?.hasShipment && res?.data?.shipment) {
        setHasShipment(true);
        setShipment(res.data.shipment);
      } else {
        setHasShipment(false);
        setShipment(null);
      }
    } catch (err) {
      // 403 Forbidden or network error
      if (err.statusCode === 403) {
        setError('You do not have permission to view tracking for this order.');
      } else {
        setError(err.message || 'Unable to retrieve tracking details at this moment.');
      }
      setHasShipment(false);
      setShipment(null);
    } finally {
      setLoading(false);
    }
  }, [orderNumber]);

  useEffect(() => {
    fetchTracking();
  }, [fetchTracking]);

  // Handle Copy AWB
  const handleCopyAwb = () => {
    if (!shipment?.awbNumber) return;
    navigator.clipboard.writeText(shipment.awbNumber).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  // Open Notification Feed Modal
  const handleOpenNotifications = async () => {
    setNotifLoading(true);
    setNotifModalOpen(true);
    try {
      const res = await logisticsApi.getOrderNotifications(orderNumber);
      setNotifications(res?.data?.notifications || []);
    } catch (err) {
      console.error('Failed to load notifications:', err);
      setNotifications([]);
    } finally {
      setNotifLoading(false);
    }
  };

  // Keyboard accessibility for modal (Escape key listener)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && notifModalOpen) {
        setNotifModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [notifModalOpen]);

  const milestoneConfig = shipment ? getMilestoneConfig(shipment.currentMilestone) : null;

  return (
    <div className="bg-white border border-[#E7DED5] rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
      {/* Card Header with Demo Simulation Pill */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E7DED5] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700 shrink-0">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-serif font-bold text-[#2A211B]">
                Doorstep Tracking & Dispatch
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200 text-[10px] font-bold uppercase tracking-wider">
                Demo Simulation
              </span>
            </div>
            <p className="text-xs text-[#6F6963]">
              Simulated courier journey from fulfillment center to your delivery address
            </p>
          </div>
        </div>

        <button
          onClick={fetchTracking}
          disabled={loading}
          className="p-2 rounded-xl border border-[#E7DED5] bg-white text-[#6F6963] hover:text-[#2A211B] hover:bg-[#F7F3EE] transition-colors cursor-pointer"
          title="Refresh Tracking Status"
          aria-label="Refresh tracking data"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* STATE 1: LOADING */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-3 text-xs text-[#6F6963]">
          <RefreshCw className="w-6 h-6 text-[#9A6A45] animate-spin" />
          <span>Synchronizing shipment tracking data...</span>
        </div>
      ) : error ? (
        /* STATE 2: ERROR */
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-800 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Unable to Load Tracking</p>
              <p className="text-red-700">{error}</p>
            </div>
          </div>
          <button
            onClick={fetchTracking}
            className="px-3 py-1.5 rounded-lg bg-white border border-red-300 text-red-700 hover:bg-red-50 font-semibold cursor-pointer shrink-0"
          >
            Retry
          </button>
        </div>
      ) : !hasShipment || !shipment ? (
        /* STATE 3: EMPTY STATE (NOT DISPATCHED YET) */
        <div className="bg-[#FAF7F2] border border-[#E7DED5] rounded-2xl p-6 sm:p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-[#F7F3EE] border border-[#E7DED5] flex items-center justify-center mx-auto text-[#9A6A45]">
            <Package className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-serif font-bold text-[#2A211B]">
              Fulfillment Preparation in Progress
            </h3>
            <p className="text-xs text-[#6F6963] max-w-md mx-auto">
              Your luxury order is being carefully packaged and prepared for courier dispatch at our Ballabhgarh fulfillment facility. Tracking information and courier assignment will appear here once dispatched.
            </p>
          </div>
          <div className="pt-2 text-[11px] text-[#6F6963] flex items-center justify-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#9A6A45]" />
            <span>Estimated delivery within 7 business days after order confirmation.</span>
          </div>
        </div>
      ) : (
        /* STATE 4: ACTIVE SHIPMENT TRACKING */
        <div className="space-y-6">
          {/* Carrier & AWB Banner */}
          <div className="bg-[#FAF7F2] border border-[#E7DED5] rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E7DED5]/80 pb-3">
              <div>
                <span className="text-[10px] text-[#6F6963] uppercase font-semibold block">
                  Delivery Partner
                </span>
                <span className="text-sm font-bold text-[#2A211B]">
                  {shipment.carrier?.name}
                </span>
                <span className="text-xs text-[#6F6963] block">
                  {shipment.carrier?.serviceType}
                </span>
              </div>

              {/* Mock AWB with Copy to Clipboard */}
              <div className="sm:text-right space-y-1">
                <span className="text-[10px] text-[#6F6963] uppercase font-semibold block">
                  Mock Tracking ID (AWB)
                </span>
                <div className="inline-flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-purple-200 shadow-2xs">
                  <span className="font-mono text-xs font-bold text-purple-700">
                    {shipment.awbNumber}
                  </span>
                  <button
                    onClick={handleCopyAwb}
                    className="p-1 rounded-md text-[#6F6963] hover:text-purple-700 hover:bg-purple-50 transition-colors cursor-pointer"
                    title="Copy AWB to clipboard"
                    aria-label="Copy tracking ID"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                {copied && (
                  <span className="text-[10px] text-emerald-700 font-semibold block animate-in fade-in">
                    Copied to clipboard!
                  </span>
                )}
              </div>
            </div>

            {/* Current Status Pill & Key Order Facts */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[#6F6963]">Current Shipment Status:</span>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${milestoneConfig?.colorClass}`}
                >
                  <span className={`w-2 h-2 rounded-full ${milestoneConfig?.dotClass}`} />
                  {milestoneConfig?.badge}
                </span>
              </div>

              {/* View Demo Notifications Trigger */}
              <button
                onClick={handleOpenNotifications}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white border border-[#E7DED5] text-[#2A211B] hover:bg-[#F7F3EE] hover:border-[#9A6A45] font-semibold text-xs transition-colors cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5 text-purple-600" />
                <span>View Demo Notifications</span>
              </button>
            </div>
          </div>

          {/* Chronological Checkpoints Log */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#E7DED5] pb-2">
              <h3 className="text-xs font-serif font-bold text-[#2A211B] flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#9A6A45]" />
                <span>Transit Scans & Milestones ({shipment.checkpoints?.length || 0})</span>
              </h3>
              <span className="text-[10px] text-[#6F6963]">Ballabhgarh Hub $\to$ Destination</span>
            </div>

            <div className="space-y-3 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#E7DED5]">
              {shipment.checkpoints?.map((checkpoint, idx) => {
                const isLatest = idx === shipment.checkpoints.length - 1;
                const dateFormatted = checkpoint.timestamp
                  ? new Date(checkpoint.timestamp).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'N/A';

                return (
                  <div key={idx} className="flex items-start gap-3.5 relative z-10">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 border-2 ${
                        isLatest
                          ? 'bg-purple-600 border-purple-600 text-white'
                          : 'bg-white border-[#E7DED5] text-[#6F6963]'
                      }`}
                    >
                      {isLatest ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-[#E7DED5]" />
                      )}
                    </div>

                    <div
                      className={`flex-1 rounded-2xl p-3.5 border text-xs space-y-1 transition-all ${
                        isLatest
                          ? 'bg-purple-50/40 border-purple-200'
                          : 'bg-[#FAF7F2] border-[#E7DED5]'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span className={`font-bold ${isLatest ? 'text-purple-900' : 'text-[#2A211B]'}`}>
                          {checkpoint.title}
                        </span>
                        <span className="text-[10px] font-mono text-[#6F6963]">
                          {dateFormatted}
                        </span>
                      </div>

                      <p className="text-[11px] text-[#6F6963] flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-[#9A6A45] shrink-0" />
                        <span>{checkpoint.location}</span>
                      </p>

                      <p className="text-[11px] text-[#2A211B] pt-0.5">
                        {checkpoint.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Customer Advisory Notice */}
          <div className="p-3.5 bg-[#FAF7F2] border border-[#E7DED5] rounded-2xl text-[11px] text-[#6F6963] flex items-start gap-2.5">
            <HelpCircle className="w-4 h-4 text-[#9A6A45] shrink-0 mt-0.5" />
            <p>
              <strong>Notice:</strong> This tracking console is a high-fidelity logistics simulation for demonstration purposes. It demonstrates carrier handovers, barcode tracking, and doorstep updates without executing live courier dispatches.
            </p>
          </div>
        </div>
      )}

      {/* ACCESSIBLE MODAL: SIMULATED NOTIFICATION HISTORY */}
      {notifModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="simulated-notif-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
        >
          <div className="bg-white border border-[#E7DED5] rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-4 animate-in zoom-in-95 max-h-[85vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#E7DED5] pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 id="simulated-notif-title" className="text-base font-serif font-bold text-[#2A211B]">
                    Simulated Notification History
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider">
                    Demo Simulation — Not Sent
                  </span>
                </div>
                <p className="text-xs text-[#6F6963] mt-0.5">
                  Internal preview of mock SMS and Email messages generated for this order
                </p>
              </div>
              <button
                onClick={() => setNotifModalOpen(false)}
                className="p-1.5 rounded-xl text-[#6F6963] hover:text-[#2A211B] hover:bg-[#F7F3EE] transition-colors cursor-pointer"
                aria-label="Close notification preview modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Notification Stream with Contact Masking */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {notifLoading ? (
                <div className="py-12 text-center text-xs text-[#6F6963]">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#9A6A45] mb-2" />
                  <span>Loading communications log...</span>
                </div>
              ) : notifications.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#6F6963]">
                  No simulated notifications have been triggered for this order yet.
                </div>
              ) : (
                notifications.map((msg, idx) => {
                  const isSms = msg.channel === 'SMS';
                  const maskedRecipient = isSms ? maskPhone(msg.recipient) : maskEmail(msg.recipient);
                  const formattedTime = msg.sentAt
                    ? new Date(msg.sentAt).toLocaleTimeString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'N/A';

                  return (
                    <div
                      key={idx}
                      className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#E7DED5] space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          {isSms ? (
                            <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                          ) : (
                            <Mail className="w-3.5 h-3.5 text-purple-600" />
                          )}
                          <span className="font-bold text-[#2A211B]">
                            {isSms ? 'SMS Preview' : 'Email Preview'}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] font-bold">
                            DEMO — NOT SENT
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-[#6F6963]">
                          {formattedTime}
                        </span>
                      </div>

                      <div className="text-[11px] text-[#6F6963]">
                        Masked Recipient: <span className="font-mono text-[#2A211B] font-semibold">{maskedRecipient}</span>
                      </div>

                      {msg.subject && (
                        <div className="text-[11px] font-semibold text-[#2A211B]">
                          Subject: {msg.subject}
                        </div>
                      )}

                      <div className="p-3 rounded-xl bg-white border border-[#E7DED5] text-[#2A211B] text-[11px] font-sans leading-relaxed">
                        {msg.message}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-2 border-t border-[#E7DED5] flex items-center justify-between text-[11px] text-[#6F6963]">
              <span>Customer contact details are masked for privacy.</span>
              <button
                onClick={() => setNotifModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#F7F3EE] text-[#6F6963] hover:bg-[#E7DED5] font-semibold cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
