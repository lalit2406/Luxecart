import StoreSettings, { SINGLETON_KEY } from './storeSettings.model.js';
import { validateStoreSettingsUpdate } from '../../validators/storeSettings.validator.js';

// Default fallback settings in case the database is temporarily unreachable
const DEFAULT_STORE_SETTINGS = Object.freeze({
  singletonKey: SINGLETON_KEY,
  storeName: 'LuxeCart',
  tagline: 'Curated Luxury Fashion & Lifestyle',
  logoUrlLight: '',
  logoUrlDark: '',
  faviconUrl: '',
  supportEmail: '',
  supportPhone: '',
  operatingHours: '',
  address: {
    street: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
  },
  currency: {
    code: 'INR',
    symbol: '₹',
    name: 'Indian Rupee',
    locale: 'en-IN',
  },
  shipping: {
    standardFeePaise: 20000,
    enableFreeShippingThreshold: false,
    freeShippingThresholdPaise: 500000,
    deliveryEstimateDays: { min: 3, max: 7 },
  },
  payment: {
    isCodEnabled: true,
    maxCodOrderPaise: 10000000,
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

// SEC-06: 30-second bounded in-memory cache TTL.
// NOTE: Process-local in-memory cache is not distributed across multi-instance clusters.
// The 30s TTL guarantees low database load while bounding eventual consistency to 30s.
const CACHE_TTL_MS = 30 * 1000;

/**
 * Recursively flattens a nested object into MongoDB dot-notation keys.
 * Preserves arrays and primitive values intact.
 *
 * @param {object} obj - Validated object
 * @param {string} [prefix=''] - Key prefix
 * @returns {Record<string, any>} Dot-notated key-value map
 */
export function buildDotNotationUpdate(obj, prefix = '') {
  const dotUpdates = {};
  for (const [key, value] of Object.entries(obj)) {
    const fieldPath = prefix ? `${prefix}.${key}` : key;
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.keys(value).length > 0
    ) {
      Object.assign(dotUpdates, buildDotNotationUpdate(value, fieldPath));
    } else if (value !== undefined) {
      dotUpdates[fieldPath] = value;
    }
  }
  return dotUpdates;
}

class StoreSettingsService {
  constructor() {
    this._cachedPublicSettings = null;
    this._cacheExpiresAt = 0;
  }

  /**
   * Invalidates the local in-memory public settings cache.
   * NOTE: In a multi-instance production cluster, broadcast invalidation via Redis pub/sub.
   */
  invalidateCache() {
    this._cachedPublicSettings = null;
    this._cacheExpiresAt = 0;
  }

  /**
   * Retrieves or atomically creates the singleton StoreSettings document.
   * Uses findOneAndUpdate with upsert and $setOnInsert to prevent duplicate key race conditions.
   *
   * @returns {Promise<import('mongoose').Document>}
   */
  async getOrCreateStoreSettings() {
    let settings = await StoreSettings.findOne({ singletonKey: SINGLETON_KEY });
    if (settings) {
      return settings;
    }

    try {
      settings = await StoreSettings.findOneAndUpdate(
        { singletonKey: SINGLETON_KEY },
        { $setOnInsert: { singletonKey: SINGLETON_KEY } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      return settings;
    } catch (err) {
      // SEC-07: Handle MongoDB duplicate-key race condition (E11000)
      if (err.code === 11000) {
        const winningDoc = await StoreSettings.findOne({ singletonKey: SINGLETON_KEY });
        if (winningDoc) {
          return winningDoc;
        }
      }
      // SEC-02: Propagate genuine database failure rather than masking with defaults
      throw err;
    }
  }

  /**
   * Returns a sanitized, public-safe representation of store settings for storefront clients.
   * Cached in memory for 30 seconds.
   *
   * @returns {Promise<object>}
   */
  async getPublicStoreSettings() {
    const now = Date.now();
    if (this._cachedPublicSettings && now < this._cacheExpiresAt) {
      return JSON.parse(JSON.stringify(this._cachedPublicSettings));
    }

    let settingsDoc;
    let isFallback = false;
    try {
      settingsDoc = await this.getOrCreateStoreSettings();
    } catch (err) {
      // SEC-02: Public read-only display uses safe fallback when DB is unreachable,
      // but error fallbacks are NEVER cached in memory
      settingsDoc = DEFAULT_STORE_SETTINGS;
      isFallback = true;
    }

    const doc = settingsDoc.toObject ? settingsDoc.toObject() : settingsDoc;

    const standardFeePaise = doc.shipping?.standardFeePaise ?? 20000;
    const freeShippingThresholdPaise = doc.shipping?.freeShippingThresholdPaise ?? 500000;
    const maxCodOrderPaise = doc.payment?.maxCodOrderPaise ?? 10000000;

    const publicPayload = {
      storeName: doc.storeName || 'LuxeCart',
      tagline: doc.tagline || '',
      logoUrlLight: doc.logoUrlLight || '',
      logoUrlDark: doc.logoUrlDark || '',
      faviconUrl: doc.faviconUrl || '',
      supportEmail: doc.supportEmail || '',
      supportPhone: doc.supportPhone || '',
      operatingHours: doc.operatingHours || '',
      address: {
        street: doc.address?.street || '',
        city: doc.address?.city || '',
        state: doc.address?.state || '',
        postalCode: doc.address?.postalCode || '',
        country: doc.address?.country || '',
      },
      currency: {
        code: 'INR',
        symbol: '₹',
        name: doc.currency?.name || 'Indian Rupee',
        locale: doc.currency?.locale || 'en-IN',
      },
      shipping: {
        standardFeePaise,
        standardFeeRupees: standardFeePaise / 100,
        enableFreeShippingThreshold: Boolean(doc.shipping?.enableFreeShippingThreshold),
        freeShippingThresholdPaise,
        freeShippingThresholdRupees: freeShippingThresholdPaise / 100,
        deliveryEstimateDays: {
          min: doc.shipping?.deliveryEstimateDays?.min ?? 3,
          max: doc.shipping?.deliveryEstimateDays?.max ?? 7,
        },
      },
      payment: {
        isCodEnabled: true, // COD is always enabled
        maxCodOrderPaise,
        maxCodOrderRupees: maxCodOrderPaise / 100,
      },
      returns: {
        isReturnsEnabled: doc.returns?.isReturnsEnabled !== false,
        returnWindowDays: doc.returns?.returnWindowDays ?? 7,
      },
      maintenance: {
        isMaintenanceMode: Boolean(doc.maintenance?.isMaintenanceMode),
        maintenanceMessage:
          doc.maintenance?.maintenanceMessage ||
          'The store is currently undergoing scheduled maintenance. Please check back shortly.',
      },
      socialLinks: {
        instagram: doc.socialLinks?.instagram || '',
        facebook: doc.socialLinks?.facebook || '',
        twitter: doc.socialLinks?.twitter || '',
        pinterest: doc.socialLinks?.pinterest || '',
      },
      seo: {
        metaTitle: doc.seo?.metaTitle || 'LuxeCart — Curated Luxury Fashion & Lifestyle',
        metaDescription:
          doc.seo?.metaDescription ||
          'Discover premier luxury fashion, accessories, and curated lifestyle collections on LuxeCart.',
        keywords: doc.seo?.keywords || ['luxury fashion', 'designer wear', 'curated apparel'],
      },
    };

    // SEC-02 & SEC-06: Only cache authoritative database settings with 30s TTL
    if (!isFallback) {
      this._cachedPublicSettings = publicPayload;
      this._cacheExpiresAt = now + CACHE_TTL_MS;
    }

    return JSON.parse(JSON.stringify(publicPayload));
  }

  /**
   * Retrieves full store settings for admin management.
   * Includes metadata and lastUpdatedBy user details.
   *
   * @returns {Promise<import('mongoose').Document>}
   */
  async getAdminStoreSettings() {
    let settings = await StoreSettings.findOne({ singletonKey: SINGLETON_KEY }).populate(
      'lastUpdatedBy',
      'name email role'
    );

    if (!settings) {
      settings = await this.getOrCreateStoreSettings();
      if (settings.populate) {
        settings = await settings.populate('lastUpdatedBy', 'name email role');
      }
    }

    return settings;
  }

  /**
   * Performs partial updates to store settings with atomic dot-notation, validation, and audit tracking.
   * Atomic dot-notation updates prevent lost updates when concurrent administrators edit different sections.
   *
   * @param {object} rawPayload
   * @param {string|import('mongoose').Types.ObjectId} adminUserId
   * @returns {Promise<import('mongoose').Document>}
   */
  async updateStoreSettings(rawPayload, adminUserId) {
    const validated = validateStoreSettingsUpdate(rawPayload);

    // SEC-05: Convert validated partial updates into atomic MongoDB dot-notation keys
    const dotUpdates = buildDotNotationUpdate(validated);
    dotUpdates.lastUpdatedBy = adminUserId || null;

    const updated = await StoreSettings.findOneAndUpdate(
      { singletonKey: SINGLETON_KEY },
      { $set: dotUpdates },
      {
        new: true,
        runValidators: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    ).populate('lastUpdatedBy', 'name email role');

    // SEC-06: Invalidate public cache so changes take effect immediately
    this.invalidateCache();

    return updated;
  }
}

export const storeSettingsService = new StoreSettingsService();
