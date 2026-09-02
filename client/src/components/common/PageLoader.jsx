import React from 'react';
import Logo from './Logo';

/**
 * Lightweight, accessible page transition loader for React Suspense
 */
export default function PageLoader() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading page content"
      className="min-h-[70vh] flex flex-col items-center justify-center bg-[#F7F3EE] text-[#171513] p-6 select-none"
    >
      <div className="relative flex items-center justify-center">
        {/* Outer pulsating ring */}
        <div className="w-20 h-20 rounded-full border-2 border-[#9A6A45]/20 animate-ping absolute" />
        
        {/* Spinning indicator ring */}
        <div className="w-16 h-16 rounded-full border-2 border-transparent border-t-[#9A6A45] border-r-[#9A6A45] animate-spin" />
        
        {/* Center luxury mark */}
        <div className="absolute">
          <Logo variant="icon-light" className="w-8 h-8 object-contain" alt="LuxeCart" />
        </div>
      </div>

      <div className="mt-4 text-center space-y-1">
        <p className="font-serif text-sm font-semibold tracking-wider uppercase text-[#2A211B]">
          LuxeCart
        </p>
        <p className="text-xs text-[#705E51] tracking-wide">
          Loading curated experience...
        </p>
      </div>
    </div>
  );
}
