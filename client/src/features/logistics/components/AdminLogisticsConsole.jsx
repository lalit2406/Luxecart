import React, { useState, useEffect } from 'react';
import logisticsApi from '../api/logisticsApi';
import {
  Truck,
  Package,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Printer,
  ChevronRight,
  ExternalLink,
  MapPin,
  Clock,
  ShieldAlert,
  ShieldCheck,
  Send,
  Mail,
  MessageSquare,
  X,
  RotateCcw,
} from 'lucide-react';

export default function AdminLogisticsConsole({ order, onOrderUpdated }) {
  const orderNumber = order?.orderNumber;

  // Tracking & Shipment State
  const [shipment, setShipment] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(true);

  // Rate Quotes State
  const [ratesData, setRatesData] = useState(null);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [selectedWeight, setSelectedWeight] = useState('500G');
  const [selectedCarrierId, setSelectedCarrierId] = useState('luxeship_demo');
  const [dispatchNotes, setDispatchNotes] = useState('');

  // Action States
  const [manifesting, setManifesting] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Modals
  const [labelModalOpen, setLabelModalOpen] = useState(false);
  const [exceptionModalOpen, setExceptionModalOpen] = useState(false);
  const [exceptionType, setExceptionType] = useState('ATTEMPT_FAILED');
  const [exceptionReason, setExceptionReason] = useState('');
  const [exceptionLoading, setExceptionLoading] = useState(false);
  const [notifModalOpen, setNotifModalOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);

  // 1. Fetch Tracking Info on Mount or Order change
  const fetchTracking = async () => {
    if (!orderNumber) return;
    setTrackingLoading(true);
    setActionError(null);
    try {
      const res = await logisticsApi.getOrderTracking(orderNumber);
      if (res?.data?.hasShipment && res?.data?.shipment) {
        setShipment(res.data.shipment);
      } else {
        setShipment(null);
      }
    } catch (err) {
      // 404 or missing shipment is normal for newly placed orders
      setShipment(null);
    } finally {
      setTrackingLoading(false);
    }
  };

  // 2. Fetch Rate Quotes
  const fetchRateQuotes = async () => {
    if (!orderNumber) return;
    setRatesLoading(true);
    try {
      const res = await logisticsApi.getRateQuotes(orderNumber);
      setRatesData(res?.data || null);
    } catch (err) {
      console.error('Failed to fetch rate quotes:', err);
    } finally {
      setRatesLoading(false);
    }
  };

  useEffect(() => {
    fetchTracking();
    fetchRateQuotes();
  }, [orderNumber]);

  // 3. Manifest Mock Shipment
  const handleManifestShipment = async () => {
    setManifesting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await logisticsApi.manifestShipment(orderNumber, {
        carrierId: selectedCarrierId,
        weightTier: selectedWeight,
        notes: dispatchNotes.trim() || undefined,
      });

      const newShipment = res?.data?.shipment;
      setShipment(newShipment);
      setActionSuccess(`Mock shipment manifested! AWB: ${newShipment?.awbNumber}`);
      if (onOrderUpdated) onOrderUpdated();
    } catch (err) {
      setActionError(err.message || 'Failed to manifest mock shipment');
    } finally {
      setManifesting(false);
    }
  };

  // 4. Milestone Progression
  const getNextMilestone = (current) => {
    switch (current) {
      case 'MANIFESTED':
        return { next: 'PICKED_UP', label: 'Shipment Picked Up' };
      case 'PICKED_UP':
        return { next: 'IN_TRANSIT', label: 'In Transit via Gateway Hub' };
      case 'IN_TRANSIT':
        return { next: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' };
      case 'OUT_FOR_DELIVERY':
        return { next: 'DELIVERED', label: 'Delivered & COD Collected' };
      case 'DELIVERY_ATTEMPT_FAILED':
        return { next: 'OUT_FOR_DELIVERY', label: 'Re-attempt Doorstep Delivery' };
      case 'RTO_INITIATED':
        return { next: 'RTO_DELIVERED', label: 'Returned to Warehouse Origin' };
      default:
        return null;
    }
  };

  const handleAdvanceMilestone = async () => {
    if (!shipment) return;
    const nextInfo = getNextMilestone(shipment.currentMilestone);
    if (!nextInfo) return;

    setAdvancing(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await logisticsApi.advanceMilestone(orderNumber, {
        nextMilestone: nextInfo.next,
      });
      const updatedShipment = res?.data?.shipment;
      setShipment(updatedShipment);
      setActionSuccess(`Milestone advanced to: ${nextInfo.label}`);
      if (onOrderUpdated) onOrderUpdated();
    } catch (err) {
      setActionError(err.message || 'Failed to advance milestone');
    } finally {
      setAdvancing(false);
    }
  };

  // 5. Simulate Exception
  const handleSimulateException = async () => {
    setExceptionLoading(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await logisticsApi.simulateException(orderNumber, {
        exceptionType,
        reason: exceptionReason.trim() || undefined,
      });
      const updatedShipment = res?.data?.shipment;
      setShipment(updatedShipment);
      setActionSuccess(`Simulated exception recorded: ${exceptionType}`);
      setExceptionModalOpen(false);
      setExceptionReason('');
      if (onOrderUpdated) onOrderUpdated();
    } catch (err) {
      setActionError(err.message || 'Failed to simulate exception');
    } finally {
      setExceptionLoading(false);
    }
  };

  // 6. View Notification Previews
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

  // Keyboard accessibility for modals (Escape key listener)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (labelModalOpen) setLabelModalOpen(false);
        if (exceptionModalOpen) setExceptionModalOpen(false);
        if (notifModalOpen) setNotifModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [labelModalOpen, exceptionModalOpen, notifModalOpen]);

  const nextStep = shipment ? getNextMilestone(shipment.currentMilestone) : null;
  const isTerminalMilestone = shipment?.currentMilestone === 'DELIVERED' || shipment?.currentMilestone === 'RTO_DELIVERED';
  const canDispatch = !shipment && order?.status === 'PROCESSING';
  const isDemo = Boolean(
    order?.isDemo === true ||
    (order?.isDemo !== false && typeof order?.orderNumber === 'string' && (
      order.orderNumber.startsWith('DEMO-') ||
      order.orderNumber.startsWith('TEST-')
    ))
  );

  return (
    <div className="bg-white border border-[#E7DED5] rounded-3xl p-6 space-y-6 shadow-xs">
      {/* Console Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E7DED5] pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700">
            <Truck className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-serif font-bold text-[#2A211B]">
                Logistics & Dispatch Console
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold uppercase tracking-wider">
                Demo Simulation
              </span>
              {isDemo ? (
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold uppercase tracking-wider" title="Demo order: Full simulation with demo lifecycle synchronization active">
                  Demo Order
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold uppercase tracking-wider" title="Non-demo order: Mock logistics runs in isolation without mutating live order status or marking real COD payment as PAID">
                  Isolation Guard Active
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#6F6963]">
              Simulate carrier rate quotes, mock AWB generation, and tracking milestones
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            fetchTracking();
            fetchRateQuotes();
          }}
          disabled={trackingLoading || ratesLoading}
          className="p-2 rounded-xl border border-[#E7DED5] bg-white text-[#6F6963] hover:text-[#2A211B] hover:bg-[#F7F3EE] transition-colors cursor-pointer"
          title="Refresh Logistics Data"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${trackingLoading || ratesLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Global Alerts */}
      {actionError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
          <div className="flex-1">{actionError}</div>
          <button onClick={() => setActionError(null)} className="text-red-500 hover:text-red-700 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
          <div className="flex-1">{actionSuccess}</div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-500 hover:text-emerald-700 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* STATE 1: SHIPMENT ALREADY MANIFESTED (Active Tracking Controls) */}
      {shipment ? (
        <div className="space-y-6">
          {/* Active Dispatch Snapshot Banner */}
          <div className="bg-[#FAF7F2] border border-[#E7DED5] rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E7DED5]/70 pb-3">
              <div>
                <span className="text-[10px] text-[#6F6963] uppercase font-semibold block">
                  Carrier & Service
                </span>
                <span className="text-xs font-bold text-[#2A211B]">
                  {shipment.carrier?.name} · {shipment.carrier?.serviceType}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-[#6F6963] uppercase font-semibold block">
                  Mock Tracking ID (AWB)
                </span>
                <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                  {shipment.awbNumber}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[#6F6963] text-[10px] block">Parcel Tier</span>
                <span className="font-semibold text-[#2A211B]">
                  {shipment.parcel?.weightTier} ({shipment.parcel?.weightGrams}g)
                </span>
              </div>
              <div>
                <span className="text-[#6F6963] text-[10px] block">Customer Delivery Fee</span>
                <span className="font-semibold text-[#2A211B]">Flat ₹200</span>
              </div>
              <div>
                <span className="text-[#6F6963] text-[10px] block">Current Milestone</span>
                <span className="font-bold text-emerald-700">
                  {shipment.currentMilestone}
                </span>
              </div>
              <div>
                <span className="text-[#6F6963] text-[10px] block">COD Due at Doorstep</span>
                <span className="font-semibold text-[#2A211B]">
                  ₹{((order?.pricing?.grandTotal || 0) / 100).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Quick Actions Toolbar */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#E7DED5]/70">
              <button
                onClick={() => setLabelModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#E7DED5] text-[#2A211B] hover:bg-[#F7F3EE] text-xs font-semibold transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-[#9A6A45]" />
                <span>Print Mock Label</span>
              </button>

              <button
                onClick={handleOpenNotifications}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#E7DED5] text-[#2A211B] hover:bg-[#F7F3EE] text-xs font-semibold transition-colors cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                <span>Simulated SMS & Email ({shipment.simulatedNotifications?.length || 0})</span>
              </button>
            </div>
          </div>

          {!isDemo && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-[11px] flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
              <div>
                <strong>Non-Demo Order Protection:</strong> Simulated transit checkpoints and notifications are logged in isolation. Real order status (<strong>{order?.status}</strong>) and COD payment records (<strong>{order?.payment?.status}</strong>) remain strictly protected from demo mutation.
              </div>
            </div>
          )}

          {/* Stepper / Next Milestone Advance Control */}
          <div className="space-y-3">
            <h3 className="text-xs font-serif font-bold text-[#2A211B] flex items-center justify-between">
              <span>Simulated Milestone Progression Controls</span>
              <span className="text-[10px] text-[#6F6963]">Sequential State Machine</span>
            </h3>

            {isTerminalMilestone ? (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Shipment has concluded its simulated lifecycle (
                  <strong className="uppercase">{shipment.currentMilestone}</strong>). No further progression is possible.
                </span>
              </div>
            ) : nextStep ? (
              <div className="p-4 bg-[#F7F3EE] border border-[#E7DED5] rounded-2xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] text-[#6F6963] uppercase font-semibold block">
                      Next Step in Pipeline:
                    </span>
                    <span className="text-xs font-bold text-[#2A211B] flex items-center gap-1.5">
                      <ChevronRight className="w-3.5 h-3.5 text-purple-600" />
                      {nextStep.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleAdvanceMilestone}
                      disabled={advancing}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-700 text-white hover:bg-purple-800 text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                    >
                      {advancing ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Advancing Step...</span>
                        </>
                      ) : (
                        <>
                          <ChevronRight className="w-3.5 h-3.5" />
                          <span>Advance to: {nextStep.label}</span>
                        </>
                      )}
                    </button>

                    {/* Exception trigger triggerable during OUT_FOR_DELIVERY */}
                    {['OUT_FOR_DELIVERY', 'DELIVERY_ATTEMPT_FAILED'].includes(shipment.currentMilestone) && (
                      <button
                        onClick={() => setExceptionModalOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-amber-300 text-amber-800 hover:bg-amber-50 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        <span>Simulate Exception</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Checkpoint Timeline Scans */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-serif font-bold text-[#2A211B]">
                Recorded Scan Checkpoints ({shipment.checkpoints?.length || 0})
              </h3>
              <span className="text-[10px] text-[#6F6963]">Chronological Outbound Scans</span>
            </div>

            <div className="space-y-2.5 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#E7DED5]">
              {shipment.checkpoints?.map((cp, idx) => (
                <div key={idx} className="flex items-start gap-3 relative z-10">
                  <div className="w-6 h-6 rounded-full bg-white border-2 border-purple-600 flex items-center justify-center shrink-0 mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-purple-600" />
                  </div>
                  <div className="flex-1 bg-[#FAF7F2] border border-[#E7DED5] rounded-xl p-3 text-xs space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="font-bold text-[#2A211B]">{cp.title}</span>
                      <span className="text-[10px] text-[#6F6963] font-mono">
                        {cp.timestamp ? new Date(cp.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#6F6963] flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-[#9A6A45]" />
                      {cp.location}
                    </p>
                    <p className="text-[11px] text-[#2A211B] pt-0.5">{cp.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* STATE 2: NOT MANIFESTED YET (Rate Comparison & Dispatch Setup) */
        <div className="space-y-6">
          {/* Rate Comparison Card */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-serif font-bold text-[#2A211B]">
                  Simulated Carrier Rate Comparison
                </h3>
                <p className="text-[10px] text-[#6F6963]">
                  Destination: {order?.shippingAddress?.city}, {order?.shippingAddress?.state} ({order?.shippingAddress?.postalCode})
                </p>
              </div>

              {/* Weight Tier Toggle */}
              <div className="inline-flex rounded-xl bg-[#F7F3EE] p-0.5 border border-[#E7DED5]">
                <button
                  type="button"
                  onClick={() => setSelectedWeight('500G')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    selectedWeight === '500G'
                      ? 'bg-white text-[#2A211B] shadow-xs'
                      : 'text-[#6F6963] hover:text-[#2A211B]'
                  }`}
                >
                  500 g Parcel
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedWeight('1KG')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    selectedWeight === '1KG'
                      ? 'bg-white text-[#2A211B] shadow-xs'
                      : 'text-[#6F6963] hover:text-[#2A211B]'
                  }`}
                >
                  1.0 kg Parcel
                </button>
              </div>
            </div>

            {/* Carrier Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {ratesData?.quotes?.map((q) => {
                const tierData = q.tiers[selectedWeight];
                const isSelected = selectedCarrierId === q.carrierId;

                return (
                  <div
                    key={q.carrierId}
                    onClick={() => setSelectedCarrierId(q.carrierId)}
                    className={`rounded-2xl p-4 border transition-all cursor-pointer space-y-2.5 ${
                      isSelected
                        ? 'bg-purple-50/50 border-purple-500 ring-2 ring-purple-500/20'
                        : 'bg-[#FAF7F2] border-[#E7DED5] hover:border-purple-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-bold text-[#2A211B] block">
                          {q.carrierName}
                        </span>
                        <span className="text-[10px] text-[#6F6963]">
                          {q.serviceType}
                        </span>
                      </div>
                      <input
                        type="radio"
                        name="carrierSelection"
                        checked={isSelected}
                        onChange={() => setSelectedCarrierId(q.carrierId)}
                        className="mt-1 text-purple-600 focus:ring-purple-500 cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1 text-xs border-t border-[#E7DED5]/80 pt-2">
                      <div className="flex justify-between">
                        <span className="text-[#6F6963]">Simulated Cost:</span>
                        <span className="font-semibold text-[#2A211B]">
                          ₹{tierData?.simulatedCarrierCostRupees}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#6F6963]">Customer Fee:</span>
                        <span className="font-semibold text-emerald-700">₹200</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-[#6F6963]">Est. Transit:</span>
                        <span className="font-medium text-[#2A211B]">
                          {q.estimatedTransitTime}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-[10px] text-[#6F6963] italic">
              * DEMO SIMULATION: Rates and transit times are illustrative models. Does not query live courier APIs or charge extra to customer.
            </p>
          </div>

          {/* Dispatch Form Card */}
          <div className="p-4 bg-[#F7F3EE] border border-[#E7DED5] rounded-2xl space-y-3">
            <h3 className="text-xs font-serif font-bold text-[#2A211B]">
              Manifest Order & Generate Demo AWB
            </h3>

            <div className="space-y-2">
              <label className="text-xs text-[#2A211B] font-medium block">
                Dispatch Staging Notes (Optional)
              </label>
              <input
                type="text"
                value={dispatchNotes}
                onChange={(e) => setDispatchNotes(e.target.value)}
                placeholder="e.g. Fragile silk garment packed in protective luxury box"
                className="w-full px-3 py-2 text-xs rounded-xl bg-white border border-[#E7DED5] text-[#2A211B] focus:outline-hidden focus:border-purple-600"
              />
            </div>

            {!canDispatch && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Order is currently in <strong>{order?.status}</strong> status. Only orders in <strong>PROCESSING</strong> status can receive a new manifest. Please use the action buttons above.
                </span>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-[#6F6963]">
                {isDemo ? (
                  <>Demo order status will update to <strong className="text-purple-700">SHIPPED</strong></>
                ) : (
                  <>Non-demo order: mock manifest created with <strong className="text-amber-800">safe isolation</strong> (real order status remains unmutated)</>
                )}
              </span>

              <button
                onClick={handleManifestShipment}
                disabled={manifesting || !canDispatch}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-700 text-white hover:bg-purple-800 disabled:opacity-50 text-xs font-semibold transition-colors cursor-pointer shadow-xs"
              >
                {manifesting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Manifesting Shipment...</span>
                  </>
                ) : (
                  <>
                    <Package className="w-3.5 h-3.5" />
                    <span>Manifest & Dispatch (Demo)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: PRINTABLE MOCK SHIPPING LABEL */}
      {labelModalOpen && shipment && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Printable Mock Shipping Label"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
        >
          <div className="bg-white border-2 border-[#2A211B] rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            {/* Demo Watermark Banner */}
            <div className="bg-amber-100 border border-amber-300 text-amber-900 px-3 py-1.5 rounded-lg text-center text-xs font-bold uppercase tracking-wider">
              DEMO — NOT VALID FOR SHIPPING (SIMULATION)
            </div>

            {/* Label Body */}
            <div className="border-2 border-black rounded-xl p-4 space-y-4 font-mono text-black">
              {/* Top Row: Carrier & Routing */}
              <div className="flex justify-between items-center border-b-2 border-black pb-2">
                <div>
                  <span className="text-lg font-bold block">{shipment.carrier?.name}</span>
                  <span className="text-[10px] uppercase">{shipment.carrier?.serviceType}</span>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black">DEL/NCR</span>
                  <span className="text-[10px] block">STANDARD SURFACE</span>
                </div>
              </div>

              {/* Barcode Graphic Placeholder */}
              <div className="space-y-1 text-center py-2 border-b-2 border-black">
                <div className="h-14 flex items-center justify-center gap-0.5 px-4 overflow-hidden">
                  {Array.from({ length: 48 }).map((_, i) => (
                    <div
                      key={i}
                      className="bg-black h-full"
                      style={{ width: `${(i % 3) + 1.5}px` }}
                    />
                  ))}
                </div>
                <span className="font-bold tracking-widest text-sm block">
                  {shipment.awbNumber}
                </span>
              </div>

              {/* Delivery Address & Sender Address */}
              <div className="grid grid-cols-2 gap-4 border-b-2 border-black pb-3 text-[11px]">
                <div className="space-y-0.5">
                  <span className="font-bold uppercase text-[9px] text-gray-600 block">Deliver To:</span>
                  <p className="font-bold">{order.shippingAddress?.fullName}</p>
                  <p>{order.shippingAddress?.addressLine1}</p>
                  <p>{order.shippingAddress?.city}, {order.shippingAddress?.state}</p>
                  <p className="font-bold text-sm">PIN: {order.shippingAddress?.postalCode}</p>
                  <p>Ph: +91 {order.shippingAddress?.phone}</p>
                </div>

                <div className="space-y-0.5 border-l-2 border-black pl-3">
                  <span className="font-bold uppercase text-[9px] text-gray-600 block">Return / Origin:</span>
                  <p className="font-bold">LuxeCart Warehouse</p>
                  <p>Ballabhgarh Fulfillment Center</p>
                  <p>Faridabad, Haryana 121004</p>
                  <p className="pt-2 font-bold">Wt: {shipment.parcel?.weightGrams}g</p>
                </div>
              </div>

              {/* COD Due Box */}
              <div className="p-3 bg-gray-100 border-2 border-black rounded-lg flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold block">Payment Mode:</span>
                  <span className="text-sm font-black">CASH ON DELIVERY (COD)</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold block">Collect From Customer:</span>
                  <span className="text-xl font-black">
                    ₹{((order?.pricing?.grandTotal || 0) / 100).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Controls */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setLabelModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#F7F3EE] text-[#6F6963] hover:bg-[#E7DED5] text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2A211B] text-white hover:bg-[#9A6A45] text-xs font-semibold cursor-pointer shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Mock Label</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: SIMULATE EXCEPTION (Attempt Failed or RTO) */}
      {exceptionModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="simulate-exception-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
        >
          <div className="bg-white border border-[#E7DED5] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 animate-in zoom-in-95">
            <div className="space-y-1">
              <h3 id="simulate-exception-title" className="text-base font-serif font-bold text-[#2A211B] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Simulate Logistics Exception</span>
              </h3>
              <p className="text-xs text-[#6F6963]">
                Test real-world fulfillment edge cases safely without corrupting order status or stock.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[#2A211B] block mb-1">
                  Exception Type
                </label>
                <select
                  value={exceptionType}
                  onChange={(e) => setExceptionType(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[#F7F3EE] border border-[#E7DED5] text-[#2A211B] focus:outline-hidden focus:border-amber-600"
                >
                  <option value="ATTEMPT_FAILED">Delivery Attempt Failed (Customer Unavailable)</option>
                  <option value="RTO">Return to Origin Initiated (RTO)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#2A211B] block mb-1">
                  Exception Note / Reason
                </label>
                <input
                  type="text"
                  value={exceptionReason}
                  onChange={(e) => setExceptionReason(e.target.value)}
                  placeholder="e.g. Customer requested evening delivery / Door locked"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[#F7F3EE] border border-[#E7DED5] text-[#2A211B] focus:outline-hidden focus:border-amber-600"
                />
              </div>

              {exceptionType === 'RTO' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px]">
                  <strong>Notice:</strong> RTO will record a simulated checkpoint and notification. Parent order status and inventory remain safely locked per invariant safety rules.
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#E7DED5]">
              <button
                onClick={() => setExceptionModalOpen(false)}
                disabled={exceptionLoading}
                className="px-4 py-2 rounded-xl bg-[#F7F3EE] text-[#6F6963] hover:bg-[#E7DED5] text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSimulateException}
                disabled={exceptionLoading}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-600 text-white hover:bg-amber-700 text-xs font-semibold cursor-pointer shadow-xs"
              >
                {exceptionLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Recording Exception...</span>
                  </>
                ) : (
                  <span>Record Exception (Demo)</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: SIMULATED NOTIFICATION PREVIEWS (SMS & EMAIL) */}
      {notifModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="notification-feed-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
        >
          <div className="bg-white border border-[#E7DED5] rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-4 animate-in zoom-in-95 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#E7DED5] pb-3">
              <div>
                <h3 id="notification-feed-title" className="text-base font-serif font-bold text-[#2A211B] flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-purple-600" />
                  <span>Simulated Communication Feed</span>
                </h3>
                <p className="text-[11px] text-[#6F6963]">
                  Internal preview of mock SMS and Email messages triggered during dispatch
                </p>
              </div>
              <button
                onClick={() => setNotifModalOpen(false)}
                className="p-1 rounded-lg text-[#6F6963] hover:text-[#2A211B] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {notifLoading ? (
                <div className="py-8 text-center text-xs text-[#6F6963]">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#9A6A45] mb-2" />
                  <span>Loading communications...</span>
                </div>
              ) : notifications.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#6F6963]">
                  No simulated messages triggered yet.
                </div>
              ) : (
                notifications.map((msg, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#E7DED5] space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {msg.channel === 'SMS' ? (
                          <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                        ) : (
                          <Mail className="w-3.5 h-3.5 text-purple-600" />
                        )}
                        <span className="font-bold text-[#2A211B]">{msg.channel} Preview</span>
                        <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] font-bold">
                          DEMO
                        </span>
                      </div>
                      <span className="text-[10px] text-[#6F6963]">
                        {msg.sentAt ? new Date(msg.sentAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                      </span>
                    </div>

                    <div className="text-[11px] text-[#6F6963]">
                      Recipient: <span className="font-mono text-[#2A211B]">{msg.recipient}</span>
                    </div>

                    {msg.subject && (
                      <div className="text-[11px] font-semibold text-[#2A211B]">
                        Subject: {msg.subject}
                      </div>
                    )}

                    <div className="p-2.5 rounded-xl bg-white border border-[#E7DED5] text-[#2A211B] text-[11px] font-sans">
                      {msg.message}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-[#E7DED5] flex justify-end">
              <button
                onClick={() => setNotifModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#F7F3EE] text-[#6F6963] hover:bg-[#E7DED5] text-xs font-semibold cursor-pointer"
              >
                Close Feed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
