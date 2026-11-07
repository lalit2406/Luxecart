import React from 'react';
import { useLocation } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useStoreSettings } from '../../features/settings/context/useStoreSettings';

/**
 * Reusable Global Maintenance Mode Notice Banner
 *
 * Renders an accessible, non-obtrusive announcement banner across customer-facing
 * pages whenever store maintenance mode is active.
 *
 * Excludes admin portal routes (/admin/*) so administrative management remains unimpeded.
 */
export default function MaintenanceNotice() {
  let settings = null;
  try {
    const settingsContext = useStoreSettings();
    settings = settingsContext?.settings;
  } catch {
    settings = null;
  }

  const location = useLocation();

  // Exclude admin portal pages from customer storefront maintenance banner
  if (location.pathname.startsWith('/admin')) {
    return null;
  }

  const isMaintenanceMode = Boolean(settings?.maintenance?.isMaintenanceMode);
  if (!isMaintenanceMode) {
    return null;
  }

  const maintenanceMessage =
    settings?.maintenance?.maintenanceMessage ||
    'The store is currently undergoing scheduled maintenance. Please check back shortly.';

  return (
    <aside
      role="status"
      aria-live="polite"
      aria-label="Store Maintenance Announcement"
      className="bg-[#2A211B] text-[#F7F3EE] border-b border-[#9A6A45]/40 py-2.5 px-4 sm:px-6 relative z-50 text-xs"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 text-center sm:text-left">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <span className="p-1 rounded-full bg-amber-500/20 text-amber-300 shrink-0">
            <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
          </span>
          <p className="leading-snug text-xs truncate-none">
            <strong className="text-amber-200 font-semibold">Store maintenance in progress: </strong>
            <span className="text-[#E7DED5]">{maintenanceMessage}</span>
            <span className="hidden md:inline text-[#A8988B] ml-1.5">
              (Browsing remains available, but some customer actions may be temporarily unavailable.)
            </span>
          </p>
        </div>
        <div className="shrink-0 text-[10px] sm:text-[11px] font-bold text-amber-300 tracking-wider uppercase px-2.5 py-0.5 rounded-full border border-amber-500/40 bg-amber-500/10">
          Maintenance Active
        </div>
      </div>
    </aside>
  );
}
