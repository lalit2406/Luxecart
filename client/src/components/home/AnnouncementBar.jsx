import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowRight, X } from 'lucide-react';
import { useStoreSettings } from '../../features/settings/context/useStoreSettings';

export const ANNOUNCEMENT_STORAGE_KEY = 'luxecart:announcement:v1:dismissed';

const getInitialVisibility = () => {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return sessionStorage.getItem(ANNOUNCEMENT_STORAGE_KEY) !== 'true';
    }
  } catch (err) {
    // Storage access restricted (e.g. private browsing, third-party cookie/storage block)
    console.warn('[AnnouncementBar] sessionStorage is unavailable:', err);
  }
  return true;
};

export default function AnnouncementBar({ announcements = [] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(getInitialVisibility);

  let settings = null;
  try {
    const settingsContext = useStoreSettings();
    settings = settingsContext?.settings;
  } catch {
    settings = null;
  }

  const standardFee = typeof settings?.shipping?.standardFeeRupees === 'number' && settings.shipping.standardFeeRupees >= 0
    ? settings.shipping.standardFeeRupees
    : 200;
  const minDays = settings?.shipping?.deliveryEstimateDays?.min || 3;
  const maxDays = settings?.shipping?.deliveryEstimateDays?.max || 7;
  const isReturnsEnabled = settings?.returns?.isReturnsEnabled !== false;
  const returnWindowDays = settings?.returns?.returnWindowDays || 7;

  const defaultAnnouncements = [
    {
      title: isReturnsEnabled
        ? `Flat ₹${standardFee} Delivery Across India (${minDays}–${maxDays} Days) • ${returnWindowDays}-Day Return Policy`
        : `Flat ₹${standardFee} Delivery Across India (${minDays}–${maxDays} Days)`,
      ctaText: 'Customer Support',
      ctaLink: '/support',
    },
  ];

  const items = announcements && announcements.length > 0 ? announcements : defaultAnnouncements;

  useEffect(() => {
    if (items.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [items.length]);

  const handleDismiss = () => {
    setIsVisible(false);
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.setItem(ANNOUNCEMENT_STORAGE_KEY, 'true');
      }
    } catch (err) {
      console.warn('[AnnouncementBar] Failed to persist dismissal to sessionStorage:', err);
    }
  };

  if (!isVisible) {
    return null;
  }

  const activeAnnouncement = items[currentIndex] || items[0];

  return (
    <aside aria-label="Store Announcement" className="bg-[#171513] text-[#E7DED5] text-xs font-medium border-b border-[#3D3128] relative z-50">
      <div className="max-w-7xl mx-auto px-4 py-2 sm:py-2.5 flex items-center justify-between gap-4">
        <div className="flex-1 flex items-center justify-center text-center gap-2 sm:gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[#9A6A45] font-semibold tracking-wider text-[11px] uppercase">
            <Sparkles className="w-3 h-3 text-[#9A6A45]" />
            <span>Store Notice</span>
          </span>

          <span className="text-[#F7F3EE] font-normal">{activeAnnouncement.title}</span>

          {activeAnnouncement.ctaText && activeAnnouncement.ctaLink && (
            <Link
              to={activeAnnouncement.ctaLink}
              className="inline-flex items-center gap-1 text-[#9A6A45] hover:text-[#E7DED5] underline underline-offset-2 font-semibold text-[11px] transition-colors ml-1"
            >
              <span>{activeAnnouncement.ctaText}</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>

        {/* Dismiss Button */}
        <button
          onClick={handleDismiss}
          className="p-1 text-[#705E51] hover:text-[#E7DED5] rounded transition-colors shrink-0 cursor-pointer"
          title="Dismiss Announcement"
          aria-label="Dismiss Announcement"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
}
