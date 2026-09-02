import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import { adminReturnApi } from '../../features/admin/returns/api/adminReturnApi';
import {
  ArrowLeft,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  Truck,
  PackageCheck,
  AlertTriangle,
  User,
  ShoppingBag,
  MapPin,
  FileText,
  IndianRupee,
  RefreshCw,
  X,
  CreditCard,
} from 'lucide-react';

const STATUS_CONFIG = {
  REQUESTED: { label: 'Requested', bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' },
  APPROVED: { label: 'Approved', bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
  PICKUP_SCHEDULED: { label: 'Pickup Scheduled', bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-200' },
  RECEIVED: { label: 'Received', bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200' },
  REFUNDED: { label: 'Refunded', bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' },
  REJECTED: { label: 'Rejected', bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-200' },
};

const REASON_LABELS = {
  WRONG_PRODUCT: 'Wrong Product Delivered',
  DAMAGED_PRODUCT: 'Damaged Product',
  DEFECTIVE_PRODUCT: 'Defective / Quality Issue',
  SIZE_FIT_ISSUE: 'Size / Fit Issue',
  NOT_AS_EXPECTED: 'Product Not As Expected',
  OTHER: 'Other Reason',
};

const REFUND_METHOD_LABELS = {
  COD_CASH_REFUND: 'Cash Refund Voucher (COD)',
  BANK_TRANSFER: 'Bank Transfer (NEFT / RTGS / IMPS / UPI)',
  STORE_CREDIT: 'Store Credit / Account Wallet',
};

const formatPrice = (paise) => {
  const rupees = (paise || 0) / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(rupees);
};

export default function AdminReturnDetailPage() {
  const { returnNumber } = useParams();
  const [returnRecord, setReturnRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Action Modal State
  const [actionModal, setActionModal] = useState({
    isOpen: false,
    targetStatus: '', // 'APPROVED' | 'REJECTED' | 'PICKUP_SCHEDULED' | 'RECEIVED' | 'REFUNDED'
    note: '',
    courierName: '',
    trackingNumber: '',
    scheduledDate: '',
    refundMethod: 'BANK_TRANSFER',
    refundReference: '',
    submitting: false,
    error: null,
  });

  // Physical Inspection Map for RECEIVED status: { [returnItemId]: 'ACCEPTED' | 'REJECTED' }
  const [itemInspections, setItemInspections] = useState({});

  const fetchReturnDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminReturnApi.getAdminReturnByNumber(returnNumber);
      if (res?.success && res.data?.return) {
        setReturnRecord(res.data.return);
      } else {
        setError('Return record not found');
      }
    } catch (err) {
      console.error('Failed to load return details:', err);
      setError(err.message || 'Failed to load return details');
    } finally {
      setLoading(false);
    }
  }, [returnNumber]);

  useEffect(() => {
    fetchReturnDetails();
  }, [fetchReturnDetails]);

  const handleOpenActionModal = (targetStatus) => {
    // Tomorrow at 11:00 AM as sensible default
    const tomorrow = new Date(Date.now() + 86400000);
    tomorrow.setHours(11, 0, 0, 0);
    const dateDefault = tomorrow.toISOString().slice(0, 16);

    // Initialize item inspection map with 'ACCEPTED' default
    if (targetStatus === 'RECEIVED') {
      const initialMap = {};
      (returnRecord?.items || []).forEach((item) => {
        const id = item.id || item._id || item.orderItemId;
        initialMap[id] = 'ACCEPTED';
      });
      setItemInspections(initialMap);
    }

    setActionModal({
      isOpen: true,
      targetStatus,
      note: '',
      courierName: returnRecord?.pickupDetails?.courierName || 'Delhivery Express',
      trackingNumber: returnRecord?.pickupDetails?.trackingNumber || `DLV-${Date.now().toString().slice(-8)}`,
      scheduledDate: dateDefault,
      refundMethod: 'BANK_TRANSFER',
      refundReference: `REF-${Date.now().toString().slice(-8)}`,
      submitting: false,
      error: null,
    });
  };

  const handleCloseActionModal = () => {
    if (actionModal.submitting) return;
    setActionModal({
      isOpen: false,
      targetStatus: '',
      note: '',
      courierName: '',
      trackingNumber: '',
      scheduledDate: '',
      refundMethod: 'BANK_TRANSFER',
      refundReference: '',
      submitting: false,
      error: null,
    });
  };

  const handleInspectionChange = (itemId, status) => {
    setItemInspections((prev) => ({
      ...prev,
      [itemId]: status,
    }));
  };

  const handleExecuteStatusTransition = async (e) => {
    e.preventDefault();
    setActionModal((prev) => ({ ...prev, submitting: true, error: null }));

    try {
      const payload = {
        status: actionModal.targetStatus,
        note: actionModal.note || undefined,
      };

      if (actionModal.targetStatus === 'PICKUP_SCHEDULED') {
        payload.pickupDetails = {
          courierName: actionModal.courierName,
          trackingNumber: actionModal.trackingNumber,
          scheduledDate: actionModal.scheduledDate ? new Date(actionModal.scheduledDate).toISOString() : undefined,
        };
      }

      if (actionModal.targetStatus === 'RECEIVED') {
        payload.items = Object.entries(itemInspections).map(([returnItemId, itemStatus]) => ({
          returnItemId,
          itemStatus,
        }));
      }

      if (actionModal.targetStatus === 'REFUNDED') {
        payload.refundDetails = {
          method: actionModal.refundMethod,
          referenceNumber: actionModal.refundReference,
        };
      }

      const res = await adminReturnApi.updateReturnStatus(returnNumber, payload);

      if (res?.success) {
        setActionModal({
          isOpen: false,
          targetStatus: '',
          note: '',
          courierName: '',
          trackingNumber: '',
          scheduledDate: '',
          refundMethod: 'BANK_TRANSFER',
          refundReference: '',
          submitting: false,
          error: null,
        });
        await fetchReturnDetails();
      }
    } catch (err) {
      setActionModal((prev) => ({
        ...prev,
        submitting: false,
        error: err.message || 'Failed to update return status',
      }));
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-16 text-center text-[#705E51]">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-[#9A6A45]" />
          <p className="font-serif text-lg text-[#171513]">Loading return details...</p>
        </div>
      </AdminLayout>
    );
  }

  if (error || !returnRecord) {
    return (
      <AdminLayout>
        <div className="p-8 bg-white rounded-lg border border-rose-200 text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-rose-600 mx-auto" />
          <h2 className="font-serif text-xl font-bold text-rose-900">Return Record Not Found</h2>
          <p className="text-sm text-rose-700">{error || `Return '${returnNumber}' does not exist.`}</p>
          <Link
            to="/admin/returns"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#171513] text-white rounded text-sm hover:bg-[#2A211B] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Returns</span>
          </Link>
        </div>
      </AdminLayout>
    );
  }

  const statusConf = STATUS_CONFIG[returnRecord.status] || {
    label: returnRecord.status,
    bg: 'bg-gray-100',
    text: 'text-gray-800',
    border: 'border-gray-200',
  };

  const acceptedInspectionCount = Object.values(itemInspections).filter((s) => s === 'ACCEPTED').length;
  const rejectedInspectionCount = Object.values(itemInspections).filter((s) => s === 'REJECTED').length;

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-6xl">
        {/* Back Link & Header */}
        <div>
          <Link
            to="/admin/returns"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#705E51] hover:text-[#9A6A45] transition-colors mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Returns Listing</span>
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="font-serif text-2xl md:text-3xl font-bold text-[#171513]">
                  {returnRecord.returnNumber}
                </h1>
                <span
                  className={`inline-flex items-center px-3 py-0.5 rounded-full text-xs font-semibold border ${statusConf.bg} ${statusConf.text} ${statusConf.border}`}
                >
                  {statusConf.label}
                </span>
              </div>
              <p className="text-xs text-[#705E51] mt-1">
                Requested on{' '}
                {new Date(returnRecord.createdAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>

            {/* Contextual Action Buttons */}
            {returnRecord.status === 'REQUESTED' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenActionModal('APPROVED')}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 text-white rounded text-sm font-medium hover:bg-emerald-800 transition-colors shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Approve Return</span>
                </button>
                <button
                  onClick={() => handleOpenActionModal('REJECTED')}
                  className="flex items-center gap-1.5 px-4 py-2 bg-white border border-rose-300 text-rose-700 rounded text-sm font-medium hover:bg-rose-50 transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Reject Return</span>
                </button>
              </div>
            )}
            {returnRecord.status === 'APPROVED' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenActionModal('PICKUP_SCHEDULED')}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-700 text-white rounded text-sm font-medium hover:bg-indigo-800 transition-colors shadow-xs"
                >
                  <Truck className="w-4 h-4" />
                  <span>Schedule Pickup</span>
                </button>
                <button
                  onClick={() => handleOpenActionModal('REJECTED')}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white border border-rose-300 text-rose-700 rounded text-xs font-medium hover:bg-rose-50 transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Reject Return</span>
                </button>
              </div>
            )}
            {returnRecord.status === 'PICKUP_SCHEDULED' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenActionModal('RECEIVED')}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 text-white rounded text-sm font-medium hover:bg-emerald-800 transition-colors shadow-xs"
                >
                  <PackageCheck className="w-4 h-4" />
                  <span>Receive & Restock Return</span>
                </button>
                <button
                  onClick={() => handleOpenActionModal('REJECTED')}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white border border-rose-300 text-rose-700 rounded text-xs font-medium hover:bg-rose-50 transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Reject Return</span>
                </button>
              </div>
            )}
            {returnRecord.status === 'RECEIVED' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenActionModal('REFUNDED')}
                  className="flex items-center gap-1.5 px-4 py-2 bg-purple-700 text-white rounded text-sm font-medium hover:bg-purple-800 transition-colors shadow-xs"
                >
                  <IndianRupee className="w-4 h-4" />
                  <span>Settle Refund ({formatPrice(returnRecord.totalRefundAmount)})</span>
                </button>
              </div>
            )}
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
            <p className="font-semibold text-[#171513] text-sm">{returnRecord.customer?.name}</p>
            <p className="text-xs text-[#705E51]">{returnRecord.customer?.email}</p>
            <p className="text-xs text-[#705E51]">{returnRecord.customer?.phone || 'No phone provided'}</p>
          </div>

          {/* Order Info */}
          <div className="bg-white p-4 rounded-lg border border-[#E7DED5] space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[#705E51] uppercase tracking-wider">
              <ShoppingBag className="w-4 h-4 text-[#9A6A45]" />
              <span>Original Order</span>
            </div>
            <Link
              to={`/admin/orders/${returnRecord.orderNumber}`}
              className="font-semibold text-[#9A6A45] hover:underline text-sm block"
            >
              {returnRecord.orderNumber}
            </Link>
            <p className="text-xs text-[#705E51]">
              Order Status: <span className="font-medium text-[#171513]">{returnRecord.order?.status || 'DELIVERED'}</span>
            </p>
            <p className="text-xs text-[#705E51]">
              Payment: <span className="font-medium text-[#171513]">{returnRecord.order?.payment?.method || 'COD'} ({returnRecord.order?.payment?.status || 'PAID'})</span>
            </p>
          </div>

          {/* Refund Value */}
          <div className="bg-white p-4 rounded-lg border border-[#E7DED5] space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[#705E51] uppercase tracking-wider">
              <IndianRupee className="w-4 h-4 text-[#9A6A45]" />
              <span>Refund Summary</span>
            </div>
            <p className="text-2xl font-bold text-[#171513] font-serif">
              {formatPrice(returnRecord.totalRefundAmount)}
            </p>
            <p className="text-xs text-[#705E51]">
              Total Units: <span className="font-medium text-[#171513]">{returnRecord.totalRequestedUnits} unit{returnRecord.totalRequestedUnits > 1 ? 's' : ''}</span>
            </p>
            <div className="pt-1">
              <span
                className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ${
                  returnRecord.inventoryRestored
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
              >
                {returnRecord.inventoryRestored ? 'Restocked to Inventory' : 'Restock Pending'}
              </span>
            </div>
          </div>
        </div>

        {/* Refund Settled Banner (Terminal State) */}
        {returnRecord.status === 'REFUNDED' && returnRecord.refundDetails && (
          <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-purple-950">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-purple-700" />
              </div>
              <div>
                <h4 className="font-bold text-sm">
                  Refund Completed ({formatPrice(returnRecord.totalRefundAmount)})
                </h4>
                <p className="text-xs text-purple-700">
                  Method: <strong className="font-semibold">{REFUND_METHOD_LABELS[returnRecord.refundDetails.method] || returnRecord.refundDetails.method}</strong>
                  {returnRecord.refundDetails.referenceNumber && (
                    <span> • Ref: <strong className="font-mono">{returnRecord.refundDetails.referenceNumber}</strong></span>
                  )}
                  {returnRecord.refundDetails.refundedAt && (
                    <span> • Settled: {new Date(returnRecord.refundDetails.refundedAt).toLocaleString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}</span>
                  )}
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-purple-200 text-purple-900 rounded text-xs font-semibold uppercase tracking-wider">
              Settlement Complete
            </span>
          </div>
        )}

        {/* Pickup Logistics Banner (If Scheduled) */}
        {returnRecord.pickupDetails?.courierName && (
          <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-indigo-950">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                <Truck className="w-5 h-5 text-indigo-700" />
              </div>
              <div>
                <h4 className="font-bold text-sm">
                  Pickup Handled by {returnRecord.pickupDetails.courierName}
                </h4>
                <p className="text-xs text-indigo-700">
                  Tracking / AWB: <strong className="font-mono">{returnRecord.pickupDetails.trackingNumber || 'Pending'}</strong>
                  {returnRecord.pickupDetails.scheduledDate && (
                    <span> • Date: {new Date(returnRecord.pickupDetails.scheduledDate).toLocaleString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}</span>
                  )}
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-indigo-200 text-indigo-900 rounded text-xs font-semibold uppercase tracking-wider">
              Logistics
            </span>
          </div>
        )}

        {/* Returned Items List */}
        <div className="bg-white rounded-lg border border-[#E7DED5] overflow-hidden">
          <div className="p-4 bg-[#F7F3EE] border-b border-[#E7DED5] flex items-center justify-between">
            <h2 className="font-serif font-bold text-[#171513]">Returned Item Snapshots</h2>
            <span className="text-xs text-[#705E51]">
              {returnRecord.items?.length || 0} item line{returnRecord.items?.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="divide-y divide-[#E7DED5]">
            {returnRecord.items?.map((item) => (
              <div key={item.id || item._id || item.orderItemId} className="p-4 flex flex-col sm:flex-row gap-4 justify-between">
                <div className="flex gap-4">
                  <div className="w-16 h-20 bg-[#F7F3EE] rounded border border-[#E7DED5] overflow-hidden shrink-0 flex items-center justify-center">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <RotateCcw className="w-6 h-6 text-[#705E51] opacity-40" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-[#9A6A45] font-semibold uppercase tracking-wider block">
                      {item.brand}
                    </span>
                    <h3 className="text-sm font-semibold text-[#171513]">{item.name}</h3>
                    <p className="text-xs text-[#705E51]">
                      SKU: <span className="font-mono">{item.sku}</span>
                      {item.size && ` • Size: ${item.size}`}
                      {item.color?.name && ` • Color: ${item.color.name}`}
                    </p>
                    <div className="pt-2 flex items-center gap-2 flex-wrap">
                      <span className="inline-block px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-900 rounded text-xs">
                        Reason: {REASON_LABELS[item.reason] || item.reason}
                      </span>
                      {/* Physical Inspection Badge */}
                      {item.itemStatus === 'RESTOCKED' && (
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Restocked (+{item.requestedQuantity})
                        </span>
                      )}
                      {item.itemStatus === 'ACCEPTED' && (
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                          Accepted
                        </span>
                      )}
                      {item.itemStatus === 'REJECTED' && (
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                          Inspection Rejected
                        </span>
                      )}
                      {item.itemStatus === 'PENDING' && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                          Inspection Pending
                        </span>
                      )}
                    </div>
                    {item.customerNote && (
                      <p className="text-xs text-[#705E51] bg-[#FDFBF7] p-2 rounded border border-[#E7DED5] mt-1 italic">
                        "{item.customerNote}"
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-left sm:text-right space-y-1 shrink-0 pt-2 sm:pt-0">
                  <span className="text-xs text-[#705E51] block">
                    Returning <strong className="text-[#171513]">{item.requestedQuantity}</strong> of {item.purchasedQuantity} purchased
                  </span>
                  <span className="text-xs text-[#705E51] block">
                    Unit Price: {formatPrice(item.unitPrice)}
                  </span>
                  <span className="text-sm font-bold text-[#171513] block">
                    Refund: {formatPrice(item.calculatedRefundAmount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pickup Address & Status History Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Pickup Address Snapshot */}
          <div className="bg-white p-4 rounded-lg border border-[#E7DED5] space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[#705E51] uppercase tracking-wider border-b border-[#E7DED5] pb-2">
              <MapPin className="w-4 h-4 text-[#9A6A45]" />
              <span>Pickup Address Snapshot</span>
            </div>
            <div className="text-xs text-[#171513] space-y-1">
              <p className="font-semibold">{returnRecord.pickupAddress?.fullName}</p>
              <p>{returnRecord.pickupAddress?.phone}</p>
              <p>{returnRecord.pickupAddress?.addressLine1}</p>
              {returnRecord.pickupAddress?.addressLine2 && <p>{returnRecord.pickupAddress?.addressLine2}</p>}
              <p>
                {returnRecord.pickupAddress?.city}, {returnRecord.pickupAddress?.state} - {returnRecord.pickupAddress?.postalCode}
              </p>
              <p>{returnRecord.pickupAddress?.country || 'India'}</p>
            </div>
          </div>

          {/* Status History Audit Timeline */}
          <div className="bg-white p-4 rounded-lg border border-[#E7DED5] space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[#705E51] uppercase tracking-wider border-b border-[#E7DED5] pb-2">
              <Clock className="w-4 h-4 text-[#9A6A45]" />
              <span>Status Audit History</span>
            </div>
            <div className="space-y-3">
              {returnRecord.statusHistory?.map((hist, idx) => {
                const conf = STATUS_CONFIG[hist.status] || {
                  label: hist.status,
                  bg: 'bg-gray-100',
                  text: 'text-gray-800',
                };

                return (
                  <div key={idx} className="flex items-start gap-3 text-xs border-l-2 border-[#E7DED5] pl-3 py-0.5">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded font-semibold ${conf.bg} ${conf.text}`}>
                          {conf.label}
                        </span>
                        <span className="text-[#705E51]">
                          {new Date(hist.changedAt).toLocaleDateString('en-IN', {
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
                          By: <span className="font-medium text-[#171513]">{hist.changedBy.name}</span> ({hist.changedBy.email})
                        </p>
                      )}
                      {hist.note && <p className="text-[#705E51] italic mt-0.5">"{hist.note}"</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Action Confirmation Modal */}
        {actionModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <div className="bg-white rounded-lg border border-[#E7DED5] max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {actionModal.targetStatus === 'APPROVED' && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                  {actionModal.targetStatus === 'PICKUP_SCHEDULED' && <Truck className="w-5 h-5 text-indigo-600" />}
                  {actionModal.targetStatus === 'RECEIVED' && <PackageCheck className="w-5 h-5 text-emerald-600" />}
                  {actionModal.targetStatus === 'REFUNDED' && <IndianRupee className="w-5 h-5 text-purple-600" />}
                  {actionModal.targetStatus === 'REJECTED' && <XCircle className="w-5 h-5 text-rose-600" />}
                  <h3 className="font-serif font-bold text-lg text-[#171513]">
                    {actionModal.targetStatus === 'APPROVED' && 'Approve Return Request'}
                    {actionModal.targetStatus === 'PICKUP_SCHEDULED' && 'Schedule Return Pickup'}
                    {actionModal.targetStatus === 'RECEIVED' && 'Warehouse Physical Receipt & Inspection'}
                    {actionModal.targetStatus === 'REFUNDED' && 'Settle Financial Refund'}
                    {actionModal.targetStatus === 'REJECTED' && 'Reject Return Request'}
                  </h3>
                </div>
                <button
                  onClick={handleCloseActionModal}
                  disabled={actionModal.submitting}
                  className="text-[#705E51] hover:text-[#171513]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {actionModal.targetStatus === 'REFUNDED' && (
                <div className="space-y-2 text-xs text-[#705E51]">
                  <p>
                    Record financial refund settlement for return <strong className="text-[#171513]">{returnNumber}</strong>.
                  </p>
                  <div className="p-3 bg-purple-50 rounded border border-purple-200 text-purple-900 space-y-1">
                    <div className="flex justify-between items-center text-sm font-bold">
                      <span>Total Refund Settlement:</span>
                      <span className="font-serif text-base text-purple-950">{formatPrice(returnRecord.totalRefundAmount)}</span>
                    </div>
                    <p className="text-[11px] text-purple-800">
                      <strong>Notice:</strong> This is a permanent terminal state transition (<strong>RECEIVED → REFUNDED</strong>). No further lifecycle updates will be permitted.
                    </p>
                  </div>
                </div>
              )}

              {actionModal.targetStatus === 'PICKUP_SCHEDULED' && (
                <div className="space-y-2 text-xs text-[#705E51]">
                  <p>
                    Schedule courier logistics to collect return <strong className="text-[#171513]">{returnNumber}</strong>.
                  </p>
                  <div className="p-3 bg-indigo-50 rounded border border-indigo-200 text-[11px] text-indigo-900">
                    <strong>Notice:</strong> This will move the return from <strong>APPROVED</strong> to <strong>PICKUP_SCHEDULED</strong>. No inventory will be restored at this stage.
                  </div>
                </div>
              )}

              {actionModal.targetStatus === 'RECEIVED' && (
                <div className="space-y-2 text-xs text-[#705E51]">
                  <p>
                    Inspect returned items physically and record item disposition for return <strong className="text-[#171513]">{returnNumber}</strong>.
                  </p>
                  <div className="p-3 bg-emerald-50 rounded border border-emerald-200 text-[11px] text-emerald-900">
                    <strong>Notice:</strong> Accepted items will be automatically restocked to their product variant inventory. Rejected items will not be added to stock.
                  </div>
                </div>
              )}

              {(actionModal.targetStatus === 'APPROVED' || actionModal.targetStatus === 'REJECTED') && (
                <div className="space-y-2 text-xs text-[#705E51]">
                  <p>
                    You are about to change return <strong className="text-[#171513]">{returnNumber}</strong> status to{' '}
                    <strong className={actionModal.targetStatus === 'APPROVED' ? 'text-emerald-700' : 'text-rose-700'}>
                      {actionModal.targetStatus}
                    </strong>.
                  </p>
                  <div className="p-3 bg-[#F7F3EE] rounded border border-[#E7DED5] text-[11px] text-[#705E51]">
                    <strong>Notice:</strong> No inventory will be restored during this action. Stock restoration is triggered only upon confirmed physical parcel receipt at the warehouse.
                  </div>
                </div>
              )}

              {actionModal.error && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded">
                  {actionModal.error}
                </div>
              )}

              <form onSubmit={handleExecuteStatusTransition} className="space-y-4">
                {/* REFUNDED Input Controls */}
                {actionModal.targetStatus === 'REFUNDED' && (
                  <div className="space-y-3 p-3 bg-[#FDFBF7] rounded border border-[#E7DED5]">
                    <div>
                      <label className="block text-xs font-semibold text-[#171513] mb-1">
                        Refund Settlement Method *
                      </label>
                      <select
                        value={actionModal.refundMethod}
                        onChange={(e) => setActionModal((prev) => ({ ...prev, refundMethod: e.target.value }))}
                        className="w-full p-2 border border-[#E7DED5] rounded text-xs focus:outline-hidden focus:border-[#9A6A45] bg-white"
                      >
                        <option value="BANK_TRANSFER">Bank Transfer (NEFT / RTGS / IMPS / UPI)</option>
                        <option value="COD_CASH_REFUND">Cash Refund Voucher (COD Orders)</option>
                        <option value="STORE_CREDIT">Store Credit / Account Wallet</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#171513] mb-1">
                        {actionModal.refundMethod === 'BANK_TRANSFER' && 'Bank Transfer Reference / UTR Number *'}
                        {actionModal.refundMethod === 'COD_CASH_REFUND' && 'Cash Refund Voucher / Receipt Number *'}
                        {actionModal.refundMethod === 'STORE_CREDIT' && 'Store Credit Ledger Reference Number *'}
                      </label>
                      <input
                        type="text"
                        required
                        placeholder={
                          actionModal.refundMethod === 'BANK_TRANSFER'
                            ? 'e.g. UTR1234567890 / UPI-REF-9988'
                            : actionModal.refundMethod === 'COD_CASH_REFUND'
                            ? 'e.g. CASH-VOUCHER-5544'
                            : 'e.g. WALLET-CREDIT-7788'
                        }
                        value={actionModal.refundReference}
                        onChange={(e) => setActionModal((prev) => ({ ...prev, refundReference: e.target.value }))}
                        className="w-full p-2 border border-[#E7DED5] rounded text-xs focus:outline-hidden focus:border-[#9A6A45]"
                      />
                    </div>
                  </div>
                )}

                {/* PICKUP_SCHEDULED Input Controls */}
                {actionModal.targetStatus === 'PICKUP_SCHEDULED' && (
                  <div className="space-y-3 p-3 bg-[#FDFBF7] rounded border border-[#E7DED5]">
                    <div>
                      <label className="block text-xs font-semibold text-[#171513] mb-1">
                        Courier Partner Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Delhivery, BlueDart, DTDC, FedEx"
                        value={actionModal.courierName}
                        onChange={(e) => setActionModal((prev) => ({ ...prev, courierName: e.target.value }))}
                        className="w-full p-2 border border-[#E7DED5] rounded text-xs focus:outline-hidden focus:border-[#9A6A45]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#171513] mb-1">
                        Tracking / AWB Number *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. DLV987654321"
                        value={actionModal.trackingNumber}
                        onChange={(e) => setActionModal((prev) => ({ ...prev, trackingNumber: e.target.value }))}
                        className="w-full p-2 border border-[#E7DED5] rounded text-xs focus:outline-hidden focus:border-[#9A6A45]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#171513] mb-1">
                        Scheduled Pickup Date & Time *
                      </label>
                      <input
                        type="datetime-local"
                        required
                        value={actionModal.scheduledDate}
                        onChange={(e) => setActionModal((prev) => ({ ...prev, scheduledDate: e.target.value }))}
                        className="w-full p-2 border border-[#E7DED5] rounded text-xs focus:outline-hidden focus:border-[#9A6A45]"
                      />
                    </div>
                  </div>
                )}

                {/* RECEIVED Input Controls */}
                {actionModal.targetStatus === 'RECEIVED' && (
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-[#171513] uppercase tracking-wider">
                      Item Physical Inspection Results ({returnRecord.items?.length} line items)
                    </label>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {returnRecord.items?.map((item) => {
                        const itemId = item.id || item._id || item.orderItemId;
                        const currentInspection = itemInspections[itemId] || 'ACCEPTED';

                        return (
                          <div
                            key={itemId}
                            className="p-3 bg-[#FDFBF7] border border-[#E7DED5] rounded text-xs space-y-2"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-semibold text-[#171513]">{item.name}</p>
                                <p className="text-[11px] text-[#705E51]">
                                  SKU: <span className="font-mono">{item.sku}</span> • Qty to return: <strong className="text-[#171513]">{item.requestedQuantity}</strong>
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 pt-1 border-t border-[#E7DED5]">
                              <label className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`inspection_${itemId}`}
                                  value="ACCEPTED"
                                  checked={currentInspection === 'ACCEPTED'}
                                  onChange={() => handleInspectionChange(itemId, 'ACCEPTED')}
                                  className="text-emerald-600 focus:ring-emerald-500"
                                />
                                <span className="text-emerald-900 font-medium">Accept & Restock (+{item.requestedQuantity})</span>
                              </label>
                              <label className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`inspection_${itemId}`}
                                  value="REJECTED"
                                  checked={currentInspection === 'REJECTED'}
                                  onChange={() => handleInspectionChange(itemId, 'REJECTED')}
                                  className="text-rose-600 focus:ring-rose-500"
                                />
                                <span className="text-rose-900 font-medium">Reject (No Restock)</span>
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-900 font-medium">
                      Summary: {acceptedInspectionCount} item line{acceptedInspectionCount > 1 ? 's' : ''} will be restocked to inventory. {rejectedInspectionCount} item line{rejectedInspectionCount > 1 ? 's' : ''} will be rejected.
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-[#171513] mb-1">
                    Administrative Note {actionModal.targetStatus === 'REJECTED' ? '(Recommended)' : '(Optional)'}
                  </label>
                  <textarea
                    rows={3}
                    placeholder={
                      actionModal.targetStatus === 'REFUNDED'
                        ? 'e.g. Refund processed to customer bank account.'
                        : actionModal.targetStatus === 'RECEIVED'
                        ? 'e.g. Parcel received and inspected at warehouse.'
                        : actionModal.targetStatus === 'PICKUP_SCHEDULED'
                        ? 'e.g. Pickup scheduled with courier for tomorrow morning.'
                        : actionModal.targetStatus === 'APPROVED'
                        ? 'e.g. Return request verified. Awaiting courier pickup scheduling.'
                        : 'e.g. Return rejected due to policy conditions...'
                    }
                    value={actionModal.note}
                    onChange={(e) => setActionModal((prev) => ({ ...prev, note: e.target.value }))}
                    maxLength={500}
                    className="w-full p-2.5 border border-[#E7DED5] rounded text-xs focus:outline-hidden focus:border-[#9A6A45]"
                  />
                  <span className="text-[10px] text-[#705E51]">{actionModal.note.length}/500</span>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleCloseActionModal}
                    disabled={actionModal.submitting}
                    className="px-4 py-2 border border-[#E7DED5] text-xs font-medium text-[#705E51] rounded hover:bg-[#F7F3EE] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionModal.submitting}
                    className={`px-4 py-2 rounded text-xs font-semibold text-white transition-colors flex items-center gap-1.5 ${
                      actionModal.targetStatus === 'REFUNDED'
                        ? 'bg-purple-700 hover:bg-purple-800'
                        : actionModal.targetStatus === 'RECEIVED'
                        ? 'bg-emerald-700 hover:bg-emerald-800'
                        : actionModal.targetStatus === 'PICKUP_SCHEDULED'
                        ? 'bg-indigo-700 hover:bg-indigo-800'
                        : actionModal.targetStatus === 'APPROVED'
                        ? 'bg-emerald-700 hover:bg-emerald-800'
                        : 'bg-rose-700 hover:bg-rose-800'
                    }`}
                  >
                    {actionModal.submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>
                      {actionModal.targetStatus === 'REFUNDED'
                        ? 'Confirm Refund Settlement'
                        : actionModal.targetStatus === 'RECEIVED'
                        ? 'Confirm Warehouse Receipt & Restock'
                        : actionModal.targetStatus === 'PICKUP_SCHEDULED'
                        ? 'Confirm Schedule Pickup'
                        : actionModal.targetStatus === 'APPROVED'
                        ? 'Confirm Approval'
                        : 'Confirm Rejection'}
                    </span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
