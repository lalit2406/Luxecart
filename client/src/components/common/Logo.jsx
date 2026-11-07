import React, { useState, useEffect } from 'react';
import logoLightPng from '../../assets/branding/logo-light.png';
import logoDarkPng from '../../assets/branding/logo-dark.png';
import logoIconDarkPng from '../../assets/branding/logo-icon-dark.png';
import logoIconLightPng from '../../assets/branding/logo-icon-light.png';
import { useStoreSettings } from '../../features/settings/context/useStoreSettings';

/**
 * LuxeCart Adaptive Logo Component
 * Provides contrast-aware variants:
 * - 'light': Full logo for light backgrounds (Black/Charcoal + Gold)
 * - 'dark': Full logo for dark backgrounds (Ivory/White + Gold)
 * - 'icon': Crowned LC Monogram for collapsed sidebar and compact dark surfaces (Ivory + Gold)
 * - 'icon-light': Crowned LC Monogram for light compact surfaces (Black + Gold)
 * 
 * Supports dynamic store settings (logoUrlLight, logoUrlDark, storeName)
 * with robust fallback to bundled assets and infinite loop prevention.
 * 
 * @param {'light' | 'dark' | 'icon' | 'icon-light'} [props.variant='light']
 * @param {string} [props.className='']
 * @param {string} [props.alt]
 * @param {boolean} [props.priority=false]
 */
export default function Logo({
  variant = 'light',
  className = '',
  alt,
  priority = false,
  ...props
}) {
  let settings = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const context = useStoreSettings();
    settings = context?.settings;
  } catch {
    settings = null;
  }

  const storeName = settings?.storeName || 'LuxeCart';
  const computedAlt = alt && alt !== 'LuxeCart' ? alt : storeName;

  let bundledSrc = logoLightPng;
  let defaultClass = 'h-8 sm:h-9 w-auto object-contain';

  switch (variant) {
    case 'dark':
      bundledSrc = logoDarkPng;
      defaultClass = 'h-7 sm:h-8 w-auto object-contain';
      break;
    case 'icon':
    case 'icon-dark':
    case 'mark':
      bundledSrc = logoIconDarkPng;
      defaultClass = 'h-9 w-9 object-contain';
      break;
    case 'icon-light':
      bundledSrc = logoIconLightPng;
      defaultClass = 'h-9 w-9 object-contain';
      break;
    case 'light':
    case 'full':
    default:
      bundledSrc = logoLightPng;
      defaultClass = 'h-8 sm:h-9 w-auto object-contain';
      break;
  }

  // Determine candidate remote logo URL based on variant
  const candidateUrl =
    variant === 'dark'
      ? (settings?.logoUrlDark || settings?.logoUrlLight || null)
      : (variant === 'light' || variant === 'full' || !variant)
        ? (settings?.logoUrlLight || settings?.logoUrlDark || null)
        : null;

  // Track failed remote URLs to prevent retry loops
  const [failedUrl, setFailedUrl] = useState(null);

  useEffect(() => {
    // Reset failed state if candidate URL changes
    setFailedUrl(null);
  }, [candidateUrl]);

  const isRemoteValid = candidateUrl && failedUrl !== candidateUrl;
  const activeSrc = isRemoteValid ? candidateUrl : bundledSrc;

  const handleImageError = () => {
    if (candidateUrl) {
      setFailedUrl(candidateUrl);
    }
  };

  return (
    <img
      src={activeSrc}
      alt={computedAlt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      onError={isRemoteValid ? handleImageError : undefined}
      className={`${defaultClass} ${className}`.trim()}
      {...props}
    />
  );
}
