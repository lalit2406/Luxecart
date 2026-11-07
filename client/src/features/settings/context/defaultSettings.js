/**
 * Standard branded fallback configuration used when the public settings API is unreachable.
 * Identified by `isFallback: true` in context consumers.
 */
export const DEFAULT_PUBLIC_SETTINGS = Object.freeze({
  storeName: 'LuxeCart',
  tagline: 'Curated Luxury Fashion & Lifestyle',
  logoUrlLight: '',
  logoUrlDark: '',
  faviconUrl: '',
  supportEmail: 'support@luxecart.com',
  supportPhone: '+91 98765 43210',
  operatingHours: 'Mon - Sat: 10:00 AM - 7:00 PM IST',
  address: {
    street: '100 Feet Road, Indiranagar',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560038',
    country: 'India',
  },
  currency: {
    code: 'INR',
    symbol: '₹',
    name: 'Indian Rupee',
    locale: 'en-IN',
  },
  shipping: {
    standardFeePaise: 20000,
    standardFeeRupees: 200,
    enableFreeShippingThreshold: false,
    freeShippingThresholdPaise: 500000,
    freeShippingThresholdRupees: 5000,
    deliveryEstimateDays: {
      min: 3,
      max: 7,
    },
  },
  payment: {
    isCodEnabled: true,
    maxCodOrderPaise: 10000000,
    maxCodOrderRupees: 100000,
  },
  returns: {
    isReturnsEnabled: true,
    returnWindowDays: 7,
  },
  maintenance: {
    isMaintenanceMode: false,
    maintenanceMessage: 'The store is currently undergoing scheduled maintenance. Please check back shortly.',
  },
  socialLinks: {
    instagram: '',
    facebook: '',
    twitter: '',
    pinterest: '',
  },
  seo: {
    metaTitle: 'LuxeCart — Curated Luxury Fashion & Lifestyle',
    metaDescription: 'Discover premier luxury fashion, accessories, and curated lifestyle collections on LuxeCart.',
    keywords: ['luxury fashion', 'designer wear', 'curated apparel', 'premium lifestyle'],
  },
});
