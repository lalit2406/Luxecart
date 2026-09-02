import React from 'react';
import logoLightPng from '../../assets/branding/logo-light.png';
import logoDarkPng from '../../assets/branding/logo-dark.png';
import logoIconDarkPng from '../../assets/branding/logo-icon-dark.png';
import logoIconLightPng from '../../assets/branding/logo-icon-light.png';

/**
 * LuxeCart Adaptive Logo Component
 * Provides contrast-aware variants:
 * - 'light': Full logo for light backgrounds (Black/Charcoal + Gold)
 * - 'dark': Full logo for dark backgrounds (Ivory/White + Gold)
 * - 'icon': Crowned LC Monogram for collapsed sidebar and compact dark surfaces (Ivory + Gold)
 * - 'icon-light': Crowned LC Monogram for light compact surfaces (Black + Gold)
 * 
 * @param {'light' | 'dark' | 'icon' | 'icon-light'} [props.variant='light']
 * @param {string} [props.className='']
 * @param {string} [props.alt='LuxeCart']
 * @param {boolean} [props.priority=false]
 */
export default function Logo({
  variant = 'light',
  className = '',
  alt = 'LuxeCart',
  priority = false,
  ...props
}) {
  let src = logoLightPng;
  let defaultClass = 'h-8 sm:h-9 w-auto object-contain';

  switch (variant) {
    case 'dark':
      src = logoDarkPng;
      defaultClass = 'h-7 sm:h-8 w-auto object-contain';
      break;
    case 'icon':
    case 'icon-dark':
    case 'mark':
      src = logoIconDarkPng;
      defaultClass = 'h-9 w-9 object-contain';
      break;
    case 'icon-light':
      src = logoIconLightPng;
      defaultClass = 'h-9 w-9 object-contain';
      break;
    case 'light':
    case 'full':
    default:
      src = logoLightPng;
      defaultClass = 'h-8 sm:h-9 w-auto object-contain';
      break;
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      className={`${defaultClass} ${className}`.trim()}
      {...props}
    />
  );
}
