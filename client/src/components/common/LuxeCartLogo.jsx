import React from 'react';
import Logo from './Logo';

/**
 * LuxeCartLogo compatibility wrapper
 */
export default function LuxeCartLogo({ variant = 'full', ...props }) {
  const mappedVariant = variant === 'mark' ? 'icon' : variant === 'full' ? 'light' : variant;
  return <Logo variant={mappedVariant} {...props} />;
}
