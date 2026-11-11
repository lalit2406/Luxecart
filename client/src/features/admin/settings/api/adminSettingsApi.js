import api from '../../../../services/api.js';

/**
 * Pure monetary conversion helpers avoiding floating point drift
 */
export const paiseToRupees = (paise) => {
  if (paise === null || paise === undefined || isNaN(paise)) return 0;
  return Math.round(Number(paise)) / 100;
};

export const rupeesToPaise = (rupees) => {
  if (rupees === null || rupees === undefined || isNaN(rupees)) return 0;
  return Math.round(Number(rupees) * 100);
};

export const formatCurrencyRupees = (rupees, locale = 'en-IN') => {
  const num = Number(rupees) || 0;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(num);
};

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates the local form data before submitting PATCH.
 * Returns an object with errors (empty object if completely valid).
 *
 * @param {object} form - Form data object with Rupee values
 * @returns {Record<string, string>} Mapping of field paths to error strings
 */
export const validateSettingsForm = (form) => {
  const errors = {};

  // Store Name
  if (!form.storeName || !form.storeName.trim()) {
    errors.storeName = 'Store name is required';
  } else if (form.storeName.trim().length > 100) {
    errors.storeName = 'Store name cannot exceed 100 characters';
  }

  // Tagline
  if (form.tagline && form.tagline.length > 250) {
    errors.tagline = 'Tagline cannot exceed 250 characters';
  }

  // URLs
  if (form.logoUrlLight && form.logoUrlLight.length > 500) {
    errors.logoUrlLight = 'Light logo URL cannot exceed 500 characters';
  }
  if (form.logoUrlDark && form.logoUrlDark.length > 500) {
    errors.logoUrlDark = 'Dark logo URL cannot exceed 500 characters';
  }
  if (form.faviconUrl && form.faviconUrl.length > 500) {
    errors.faviconUrl = 'Favicon URL cannot exceed 500 characters';
  }

  // Support Email (optional; validate format & length only when non-empty)
  const trimmedSupportEmail = typeof form.supportEmail === 'string' ? form.supportEmail.trim() : '';
  if (trimmedSupportEmail) {
    if (!EMAIL_REGEX.test(trimmedSupportEmail)) {
      errors.supportEmail = 'Please provide a valid email address';
    } else if (trimmedSupportEmail.length > 150) {
      errors.supportEmail = 'Support email cannot exceed 150 characters';
    }
  }

  // Support Phone
  if (form.supportPhone && form.supportPhone.length > 30) {
    errors.supportPhone = 'Support phone cannot exceed 30 characters';
  }

  // Operating Hours
  if (form.operatingHours && form.operatingHours.length > 100) {
    errors.operatingHours = 'Operating hours cannot exceed 100 characters';
  }

  // Address
  if (form.address?.street && form.address.street.length > 200) {
    errors['address.street'] = 'Street address cannot exceed 200 characters';
  }
  if (form.address?.city && form.address.city.length > 100) {
    errors['address.city'] = 'City cannot exceed 100 characters';
  }
  if (form.address?.state && form.address.state.length > 100) {
    errors['address.state'] = 'State cannot exceed 100 characters';
  }
  if (form.address?.postalCode && form.address.postalCode.length > 20) {
    errors['address.postalCode'] = 'Postal code cannot exceed 20 characters';
  }
  if (form.address?.country && form.address.country.length > 50) {
    errors['address.country'] = 'Country cannot exceed 50 characters';
  }

  // Shipping
  const standardFeeRupees = Number(form.shipping?.standardFeeRupees);
  if (isNaN(standardFeeRupees) || standardFeeRupees < 0) {
    errors['shipping.standardFeeRupees'] = 'Standard shipping fee cannot be negative';
  } else if (standardFeeRupees > 10000) {
    errors['shipping.standardFeeRupees'] = 'Standard shipping fee cannot exceed ₹10,000 (1,000,000 paise)';
  }

  if (form.shipping?.enableFreeShippingThreshold) {
    const freeThresholdRupees = Number(form.shipping?.freeShippingThresholdRupees);
    if (isNaN(freeThresholdRupees) || freeThresholdRupees < 0) {
      errors['shipping.freeShippingThresholdRupees'] = 'Free shipping threshold cannot be negative';
    } else if (freeThresholdRupees > 500000) {
      errors['shipping.freeShippingThresholdRupees'] = 'Free shipping threshold cannot exceed ₹5,00,000 (50,000,000 paise)';
    }
  }

  const deliveryMin = Number(form.shipping?.deliveryEstimateDays?.min);
  const deliveryMax = Number(form.shipping?.deliveryEstimateDays?.max);
  if (isNaN(deliveryMin) || deliveryMin < 1 || deliveryMin > 60) {
    errors['shipping.deliveryEstimateDays.min'] = 'Minimum delivery estimate must be between 1 and 60 days';
  }
  if (isNaN(deliveryMax) || deliveryMax < 1 || deliveryMax > 60) {
    errors['shipping.deliveryEstimateDays.max'] = 'Maximum delivery estimate must be between 1 and 60 days';
  }
  if (!isNaN(deliveryMin) && !isNaN(deliveryMax) && deliveryMin > deliveryMax) {
    errors['shipping.deliveryEstimateDays.min'] = 'Minimum delivery days cannot exceed maximum delivery days';
  }

  // Returns
  const returnWindow = Number(form.returns?.returnWindowDays);
  if (isNaN(returnWindow) || returnWindow < 0 || returnWindow > 90) {
    errors['returns.returnWindowDays'] = 'Return window must be between 0 and 90 days';
  }

  // Payment / COD
  const maxCodRupees = Number(form.payment?.maxCodOrderRupees);
  if (isNaN(maxCodRupees) || maxCodRupees < 100 || maxCodRupees > 1000000) {
    errors['payment.maxCodOrderRupees'] = 'Maximum COD order limit must be between ₹100 and ₹10,00,000 (100,000,000 paise)';
  }

  // Maintenance
  if (form.maintenance?.maintenanceMessage && form.maintenance.maintenanceMessage.length > 500) {
    errors['maintenance.maintenanceMessage'] = 'Maintenance message cannot exceed 500 characters';
  }

  // Social Links
  for (const platform of ['instagram', 'facebook', 'twitter', 'pinterest']) {
    if (form.socialLinks?.[platform] && form.socialLinks[platform].length > 300) {
      errors[`socialLinks.${platform}`] = `${platform} URL cannot exceed 300 characters`;
    }
  }

  // SEO
  if (form.seo?.metaTitle && form.seo.metaTitle.length > 150) {
    errors['seo.metaTitle'] = 'SEO title cannot exceed 150 characters';
  }
  if (form.seo?.metaDescription && form.seo.metaDescription.length > 300) {
    errors['seo.metaDescription'] = 'SEO description cannot exceed 300 characters';
  }

  return errors;
};

/**
 * Transforms form state with Rupee representations into clean backend PATCH schema.
 * Strips disallowed root fields (_id, singletonKey, lastUpdatedBy, createdAt, updatedAt, __v).
 * Converts monetary values into integer paise.
 *
 * @param {object} form - Current form data
 * @returns {object} Clean PATCH payload conforming to storeSettings.validator.js
 */
export const buildSettingsPatchPayload = (form) => {
  const payload = {
    storeName: form.storeName?.trim() || '',
    tagline: form.tagline?.trim() || '',
    logoUrlLight: form.logoUrlLight?.trim() || '',
    logoUrlDark: form.logoUrlDark?.trim() || '',
    faviconUrl: form.faviconUrl?.trim() || '',
    supportEmail: form.supportEmail?.trim().toLowerCase() || '',
    supportPhone: form.supportPhone?.trim() || '',
    operatingHours: form.operatingHours?.trim() || '',
    address: {
      street: form.address?.street?.trim() || '',
      city: form.address?.city?.trim() || '',
      state: form.address?.state?.trim() || '',
      postalCode: form.address?.postalCode?.trim() || '',
      country: form.address?.country?.trim() || '',
    },
    shipping: {
      standardFeePaise: rupeesToPaise(form.shipping?.standardFeeRupees),
      enableFreeShippingThreshold: Boolean(form.shipping?.enableFreeShippingThreshold),
      freeShippingThresholdPaise: rupeesToPaise(form.shipping?.freeShippingThresholdRupees),
      deliveryEstimateDays: {
        min: Number(form.shipping?.deliveryEstimateDays?.min) || 3,
        max: Number(form.shipping?.deliveryEstimateDays?.max) || 7,
      },
    },
    payment: {
      isCodEnabled: true, // Immutable platform invariant
      maxCodOrderPaise: rupeesToPaise(form.payment?.maxCodOrderRupees),
    },
    returns: {
      isReturnsEnabled: Boolean(form.returns?.isReturnsEnabled),
      returnWindowDays: Number(form.returns?.returnWindowDays) || 0,
    },
    maintenance: {
      isMaintenanceMode: Boolean(form.maintenance?.isMaintenanceMode),
      maintenanceMessage: form.maintenance?.maintenanceMessage?.trim() || '',
    },
    socialLinks: {
      instagram: form.socialLinks?.instagram?.trim() || '',
      facebook: form.socialLinks?.facebook?.trim() || '',
      twitter: form.socialLinks?.twitter?.trim() || '',
      pinterest: form.socialLinks?.pinterest?.trim() || '',
    },
    seo: {
      metaTitle: form.seo?.metaTitle?.trim() || '',
      metaDescription: form.seo?.metaDescription?.trim() || '',
      keywords: Array.isArray(form.seo?.keywords)
        ? form.seo.keywords
        : typeof form.seo?.keywords === 'string'
        ? form.seo.keywords
            .split(',')
            .map((k) => k.trim())
            .filter(Boolean)
        : [],
    },
  };

  return payload;
};

/**
 * Maps raw backend StoreSettings response into UI form state with converted Rupee values.
 *
 * @param {object} settings - Backend settings document
 * @returns {object} Form state
 */
export const mapSettingsToForm = (settings = {}) => {
  return {
    storeName: settings.storeName || 'LuxeCart',
    tagline: settings.tagline || '',
    logoUrlLight: settings.logoUrlLight || '',
    logoUrlDark: settings.logoUrlDark || '',
    faviconUrl: settings.faviconUrl || '',
    supportEmail: settings.supportEmail || '',
    supportPhone: settings.supportPhone || '',
    operatingHours: settings.operatingHours || '',
    address: {
      street: settings.address?.street || '',
      city: settings.address?.city || '',
      state: settings.address?.state || '',
      postalCode: settings.address?.postalCode || '',
      country: settings.address?.country || '',
    },
    shipping: {
      standardFeeRupees: paiseToRupees(settings.shipping?.standardFeePaise ?? 20000),
      enableFreeShippingThreshold: Boolean(settings.shipping?.enableFreeShippingThreshold),
      freeShippingThresholdRupees: paiseToRupees(settings.shipping?.freeShippingThresholdPaise ?? 500000),
      deliveryEstimateDays: {
        min: settings.shipping?.deliveryEstimateDays?.min ?? 3,
        max: settings.shipping?.deliveryEstimateDays?.max ?? 7,
      },
    },
    payment: {
      isCodEnabled: true, // Immutable platform invariant
      maxCodOrderRupees: paiseToRupees(settings.payment?.maxCodOrderPaise ?? 10000000),
    },
    returns: {
      isReturnsEnabled: settings.returns?.isReturnsEnabled !== false,
      returnWindowDays: settings.returns?.returnWindowDays ?? 7,
    },
    maintenance: {
      isMaintenanceMode: Boolean(settings.maintenance?.isMaintenanceMode),
      maintenanceMessage:
        settings.maintenance?.maintenanceMessage ||
        'The store is currently undergoing scheduled maintenance. Please check back shortly.',
    },
    socialLinks: {
      instagram: settings.socialLinks?.instagram || '',
      facebook: settings.socialLinks?.facebook || '',
      twitter: settings.socialLinks?.twitter || '',
      pinterest: settings.socialLinks?.pinterest || '',
    },
    seo: {
      metaTitle: settings.seo?.metaTitle || 'LuxeCart — Curated Luxury Fashion & Lifestyle',
      metaDescription:
        settings.seo?.metaDescription ||
        'Discover premier luxury fashion, accessories, and curated lifestyle collections on LuxeCart.',
      keywords: Array.isArray(settings.seo?.keywords)
        ? settings.seo.keywords.join(', ')
        : settings.seo?.keywords || '',
    },
  };
};

/**
 * Admin Store Settings API Client
 */
export const adminSettingsApi = {
  /**
   * Retrieves full store settings for admin view.
   * @returns {Promise<{ success: boolean, message: string, data: object }>}
   */
  getAdminSettings: async () => {
    return api.get('/admin/settings');
  },

  /**
   * Updates store settings through partial atomic dot-notation backend update.
   * @param {object} payload - Validated settings object
   * @returns {Promise<{ success: boolean, message: string, data: object }>}
   */
  updateSettings: async (payload) => {
    return api.patch('/admin/settings', payload);
  },

  /**
   * Retrieves sanitized public store settings (cached).
   * @returns {Promise<{ success: boolean, message: string, data: object }>}
   */
  getPublicSettings: async () => {
    return api.get('/settings/public');
  },
};
