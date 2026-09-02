import React from 'react';
import {
  ORDER_STATUS_CONFIG,
  TIMELINE_STEPS,
  getStatusConfig,
} from '../../features/orders/constants/orderStatus';
import { Check, XCircle, AlertCircle } from 'lucide-react';

export default function OrderTimeline({ status, createdAt, statusHistory = [] }) {
  const currentConfig = getStatusConfig(status);
  const isCancelled = (status || '').toUpperCase() === 'CANCELLED';

  const formattedOrderDate = createdAt
    ? new Date(createdAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  if (isCancelled) {
    return (
      <div className="bg-red-50/70 border border-red-200 rounded-3xl p-6 space-y-3">
        <div className="flex items-center gap-2.5 text-red-700">
          <XCircle className="w-5 h-5" />
          <h3 className="text-sm font-bold">Order Cancelled</h3>
        </div>
        <p className="text-xs text-red-600">
          This order was cancelled. Reserved inventory was restored to the catalog.
        </p>
      </div>
    );
  }

  const currentStepIndex = currentConfig.stepIndex >= 0 ? currentConfig.stepIndex : 0;

  return (
    <div className="bg-white border border-[#E7DED5] rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E7DED5] pb-4">
        <div>
          <h3 className="text-sm font-serif font-bold text-[#2A211B]">
            Order Progress & Tracking
          </h3>
          <p className="text-[11px] text-[#6F6963] mt-0.5">
            Current stage:{' '}
            <span className="font-semibold text-[#2A211B]">{currentConfig.label}</span>
          </p>
        </div>

        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${currentConfig.colorClass}`}
        >
          {currentConfig.badgeText}
        </span>
      </div>

      {/* Visual Step Timeline */}
      <div className="relative pt-2">
        {/* Horizontal Connector Line (Desktop/Tablet) */}
        <div className="hidden sm:block absolute top-[28px] left-[5%] right-[5%] h-0.5 bg-[#E7DED5] -z-0">
          <div
            className="h-full bg-[#9A6A45] transition-all duration-500"
            style={{
              width: `${(currentStepIndex / (TIMELINE_STEPS.length - 1)) * 100}%`,
            }}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-6 sm:gap-2 relative z-10">
          {TIMELINE_STEPS.map((stepKey, idx) => {
            const step = ORDER_STATUS_CONFIG[stepKey];
            const isCompleted = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;
            const isPending = idx > currentStepIndex;
            const StepIcon = step.icon;

            // Find recorded history event timestamp if available
            const historyEvent = (statusHistory || []).find((h) => h.status === stepKey);
            const eventTimestamp = historyEvent?.changedAt
              ? new Date(historyEvent.changedAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : idx === 0 && formattedOrderDate
              ? formattedOrderDate
              : null;

            return (
              <div
                key={stepKey}
                className="flex sm:flex-col items-center sm:text-center gap-4 sm:gap-2 text-left sm:text-center"
              >
                {/* Node Icon */}
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors ${
                    isCompleted
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : isCurrent
                      ? 'bg-[#9A6A45] border-[#9A6A45] text-white ring-4 ring-[#9A6A45]/20'
                      : 'bg-white border-[#E7DED5] text-[#6F6963]'
                  }`}
                  aria-label={`${step.label}: ${
                    isCompleted ? 'Completed' : isCurrent ? 'Current' : 'Upcoming'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <StepIcon className="w-4 h-4" />
                  )}
                </div>

                {/* Text Label */}
                <div className="space-y-0.5">
                  <p
                    className={`text-xs font-bold ${
                      isCurrent
                        ? 'text-[#2A211B]'
                        : isCompleted
                        ? 'text-[#2A211B]'
                        : 'text-[#6F6963]'
                    }`}
                  >
                    {step.badgeText}
                  </p>
                  <p className="text-[10px] text-[#6F6963] hidden md:block max-w-[120px] mx-auto leading-tight">
                    {step.description}
                  </p>
                  {eventTimestamp && (
                    <p className="text-[10px] text-[#9A6A45] font-medium sm:pt-0.5 font-mono">
                      {eventTimestamp}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
