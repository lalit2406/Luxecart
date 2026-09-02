import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowRight, X } from 'lucide-react';

export default function AnnouncementBar({ announcements = [] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (announcements.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % announcements.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [announcements.length]);

  if (!isVisible || !announcements || announcements.length === 0) {
    return null;
  }

  const activeAnnouncement = announcements[currentIndex] || announcements[0];

  return (
    <aside aria-label="Store Announcement" className="bg-[#171513] text-[#E7DED5] text-xs font-medium border-b border-[#3D3128] relative z-50">
      <div className="max-w-7xl mx-auto px-4 py-2 sm:py-2.5 flex items-center justify-between gap-4">
        <div className="flex-1 flex items-center justify-center text-center gap-2 sm:gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[#9A6A45] font-semibold tracking-wider text-[11px] uppercase">
            <Sparkles className="w-3 h-3 text-[#9A6A45]" />
            <span>Exclusive</span>
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
          onClick={() => setIsVisible(false)}
          className="p-1 text-[#705E51] hover:text-[#E7DED5] rounded transition-colors shrink-0"
          title="Dismiss Announcement"
          aria-label="Dismiss Announcement"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
}
