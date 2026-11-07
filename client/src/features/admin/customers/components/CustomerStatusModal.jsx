import React, { useState, useEffect, useRef } from 'react';
import { adminCustomerApi } from '../api/adminCustomerApi';
import {
  X,
  AlertTriangle,
  Info,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Clock,
} from 'lucide-react';

export default function CustomerStatusModal({
  isOpen,
  onClose,
  customer,
  onStatusUpdated,
}) {
  const [selectedStatus, setSelectedStatus] = useState('ACTIVE');
  const [reason, setReason] = useState('');
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const modalRef = useRef(null);
  const reasonInputRef = useRef(null);

  // Initialize status when modal opens or customer changes
  useEffect(() => {
    if (customer && isOpen) {
      // Default to opposite status to streamline toggle
      const nextStatus = customer.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
      setSelectedStatus(nextStatus);
      setReason('');
      setError(null);
      setSuccessMessage(null);
    }
  }, [customer, isOpen]);

  // Handle ESC key to dismiss modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !updating) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, updating, onClose]);

  // Focus trap / initial focus
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        if (reasonInputRef.current) {
          reasonInputRef.current.focus();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen || !customer) return null;

  const isSuspending = selectedStatus === 'SUSPENDED';
  const isCurrentlySame = customer.status === selectedStatus;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (updating || isCurrentlySame) return;

    setUpdating(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await adminCustomerApi.updateCustomerStatus(customer.id, {
        status: selectedStatus,
        reason: reason.trim() || undefined,
      });

      const updatedCustomer = res?.data?.customer || {
        ...customer,
        status: selectedStatus,
      };

      setSuccessMessage(`Account status successfully updated to ${selectedStatus}.`);

      // Allow visual confirmation before closing
      setTimeout(() => {
        if (onStatusUpdated) {
          onStatusUpdated(updatedCustomer);
        }
        onClose();
      }, 700);
    } catch (err) {
      setError(err.message || 'Failed to update customer account status');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#171513]/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="status-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !updating) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl border border-[#E7DED5] space-y-5 animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E7DED5]">
          <div>
            <h3 id="status-modal-title" className="text-base font-bold text-[#2A211B]">
              Update Account Status
            </h3>
            <p className="text-xs text-[#6F6963] mt-0.5">
              Customer: <span className="font-semibold text-[#2A211B]">{customer.name}</span> ({customer.email})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={updating}
            aria-label="Close dialog"
            className="p-1.5 rounded-full text-[#6F6963] hover:text-[#2A211B] hover:bg-[#F7F3EE] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current vs Target Selector */}
        <div className="space-y-3">
          <label className="text-xs font-semibold text-[#2A211B] block">
            Target Status:
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setSelectedStatus('ACTIVE')}
              disabled={updating}
              className={`p-3 rounded-2xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                selectedStatus === 'ACTIVE'
                  ? 'bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/20'
                  : 'bg-white border-[#E7DED5] hover:bg-[#F7F3EE]/60'
              }`}
            >
              <CheckCircle2
                className={`w-4 h-4 mt-0.5 shrink-0 ${
                  selectedStatus === 'ACTIVE' ? 'text-emerald-700' : 'text-[#6F6963]'
                }`}
              />
              <div>
                <div
                  className={`text-xs font-bold ${
                    selectedStatus === 'ACTIVE' ? 'text-emerald-900' : 'text-[#2A211B]'
                  }`}
                >
                  ACTIVE
                </div>
                <div className="text-[11px] text-[#6F6963] mt-0.5 leading-snug">
                  Unrestricted shopping, checkout, and portal access.
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedStatus('SUSPENDED')}
              disabled={updating}
              className={`p-3 rounded-2xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                selectedStatus === 'SUSPENDED'
                  ? 'bg-rose-50/70 border-rose-500 ring-2 ring-rose-500/20'
                  : 'bg-white border-[#E7DED5] hover:bg-[#F7F3EE]/60'
              }`}
            >
              <XCircle
                className={`w-4 h-4 mt-0.5 shrink-0 ${
                  selectedStatus === 'SUSPENDED' ? 'text-rose-700' : 'text-[#6F6963]'
                }`}
              />
              <div>
                <div
                  className={`text-xs font-bold ${
                    selectedStatus === 'SUSPENDED' ? 'text-rose-900' : 'text-[#2A211B]'
                  }`}
                >
                  SUSPENDED
                </div>
                <div className="text-[11px] text-[#6F6963] mt-0.5 leading-snug">
                  Revokes refresh tokens and blocks subsequent sign-in.
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Security Notification Banner */}
        {isSuspending ? (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-950 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-rose-900">
                Session Revocation Protocol:
              </p>
              <p className="text-[11px] leading-relaxed text-rose-800">
                Suspending this customer atomically purges all stored <strong>refresh tokens</strong>. The customer will be immediately blocked from refreshing their session or signing in again.
              </p>
              <p className="text-[10px] text-rose-700 flex items-center gap-1 font-mono pt-0.5">
                <Clock className="w-3 h-3 text-rose-600" />
                Existing stateless access tokens will expire within their 15-minute maximum window.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-950 text-xs flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-emerald-900">
                Account Reactivation:
              </p>
              <p className="text-[11px] leading-relaxed text-emerald-800">
                Reinstating this account enables login, placing orders, and account profile management immediately.
              </p>
            </div>
          </div>
        )}

        {/* Error Feedback */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs flex items-center gap-2">
            <XCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Feedback */}
        {successMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-700 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Audit Note / Reason Input */}
        <div className="space-y-1.5">
          <label
            htmlFor="customer-status-reason"
            className="text-xs font-semibold text-[#2A211B] flex items-center justify-between"
          >
            <span>Reason / Audit Note (Optional)</span>
            <span className="text-[10px] text-[#6F6963]">{reason.length}/500</span>
          </label>
          <textarea
            id="customer-status-reason"
            ref={reasonInputRef}
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 500))}
            placeholder={
              isSuspending
                ? 'e.g. Account suspended due to excessive chargebacks or suspicious activity...'
                : 'e.g. Account reactivated following customer verification...'
            }
            rows={3}
            disabled={updating}
            className="w-full p-3 rounded-2xl bg-[#F7F3EE] border border-[#E7DED5] text-xs text-[#2A211B] placeholder-[#6F6963] focus:outline-hidden focus:border-[#9A6A45] focus:bg-white resize-none transition-colors"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#E7DED5]">
          <button
            type="button"
            onClick={onClose}
            disabled={updating}
            className="px-4 py-2.5 rounded-xl bg-[#F7F3EE] text-[#6F6963] hover:bg-[#E7DED5] text-xs font-semibold transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={updating || isCurrentlySame}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-xs font-semibold transition-all cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed ${
              isSuspending
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-[#2A211B] hover:bg-[#9A6A45]'
            }`}
          >
            {updating ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Updating Status...</span>
              </>
            ) : isCurrentlySame ? (
              <span>Already {selectedStatus}</span>
            ) : (
              <span>Confirm {selectedStatus === 'SUSPENDED' ? 'Suspension' : 'Reactivation'}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
