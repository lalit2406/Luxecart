import React from 'react';

/**
 * Accessible Skip to Main Content Link
 * Appears when focused via keyboard Tab key, allowing assistive tech users
 * to bypass repetitive navbar elements directly to #main-content.
 */
export default function SkipToContent({ targetId = 'main-content' }) {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2.5 focus:bg-[#171513] focus:text-white focus:font-semibold focus:text-xs focus:rounded-xl focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#9A6A45] focus:ring-offset-2 transition-all"
    >
      Skip to main content
    </a>
  );
}
