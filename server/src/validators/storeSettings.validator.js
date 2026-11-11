const DISALLOWED_ROOT_FIELDS = new Set([
  'singletonKey',
  '_id',
  'createdAt',
  'updatedAt',
  'lastUpdatedBy',
  '__v',
  'password',
  'secret',
  'jwtSecret',
  'token',
  'mongoUri',
  'dbUri',
  'apiKey',
  'role',
  'roles',
  'isAdmin',
]);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates and sanitizes a partial store settings update payload.
 * Throws a formatted Error with statusCode = 400 and code = 'VALIDATION_ERROR' if invalid.
 *
 * @param {object} payload
 * @returns {object} Validated partial settings object
 */
export function validateStoreSettingsUpdate(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    const error = new Error('Request body must be a valid JSON object');
    error.statusCode = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  // Check for disallowed/dangerous root fields
  for (const key of Object.keys(payload)) {
    if (DISALLOWED_ROOT_FIELDS.has(key)) {
      const error = new Error(`Field '${key}' is protected or disallowed and cannot be modified`);
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }
  }

  const validated = {};

  // 1. General store info
  if (payload.storeName !== undefined) {
    if (typeof payload.storeName !== 'string' || !payload.storeName.trim()) {
      const error = new Error('storeName must be a non-empty string');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }
    if (payload.storeName.trim().length > 100) {
      const error = new Error('storeName cannot exceed 100 characters');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }
    validated.storeName = payload.storeName.trim();
  }

  if (payload.tagline !== undefined) {
    if (typeof payload.tagline !== 'string') {
      const error = new Error('tagline must be a string');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }
    if (payload.tagline.length > 250) {
      const error = new Error('tagline cannot exceed 250 characters');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }
    validated.tagline = payload.tagline.trim();
  }

  if (payload.logoUrlLight !== undefined) {
    if (typeof payload.logoUrlLight !== 'string' || payload.logoUrlLight.length > 500) {
      const error = new Error('logoUrlLight must be a string up to 500 characters');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }
    validated.logoUrlLight = payload.logoUrlLight.trim();
  }

  if (payload.logoUrlDark !== undefined) {
    if (typeof payload.logoUrlDark !== 'string' || payload.logoUrlDark.length > 500) {
      const error = new Error('logoUrlDark must be a string up to 500 characters');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }
    validated.logoUrlDark = payload.logoUrlDark.trim();
  }

  if (payload.faviconUrl !== undefined) {
    if (typeof payload.faviconUrl !== 'string' || payload.faviconUrl.length > 500) {
      const error = new Error('faviconUrl must be a string up to 500 characters');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }
    validated.faviconUrl = payload.faviconUrl.trim();
  }

  if (payload.supportEmail !== undefined) {
    if (typeof payload.supportEmail !== 'string') {
      const error = new Error('supportEmail must be a valid email address up to 150 characters');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }
    const trimmedEmail = payload.supportEmail.trim();
    if (trimmedEmail && (!EMAIL_REGEX.test(trimmedEmail) || trimmedEmail.length > 150)) {
      const error = new Error('supportEmail must be a valid email address up to 150 characters');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }
    validated.supportEmail = trimmedEmail.toLowerCase();
  }

  if (payload.supportPhone !== undefined) {
    if (typeof payload.supportPhone !== 'string' || payload.supportPhone.length > 30) {
      const error = new Error('supportPhone must be a string up to 30 characters');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }
    validated.supportPhone = payload.supportPhone.trim();
  }

  if (payload.operatingHours !== undefined) {
    if (typeof payload.operatingHours !== 'string' || payload.operatingHours.length > 100) {
      const error = new Error('operatingHours must be a string up to 100 characters');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }
    validated.operatingHours = payload.operatingHours.trim();
  }

  // 2. Physical Address
  if (payload.address !== undefined) {
    if (!payload.address || typeof payload.address !== 'object' || Array.isArray(payload.address)) {
      const error = new Error('address must be an object');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }
    const addr = {};
    for (const [key, maxLen] of Object.entries({
      street: 200,
      city: 100,
      state: 100,
      postalCode: 20,
      country: 50,
    })) {
      if (payload.address[key] !== undefined) {
        if (typeof payload.address[key] !== 'string' || payload.address[key].length > maxLen) {
          const error = new Error(`address.${key} must be a string up to ${maxLen} characters`);
          error.statusCode = 400;
          error.code = 'VALIDATION_ERROR';
          throw error;
        }
        addr[key] = payload.address[key].trim();
      }
    }
    validated.address = addr;
  }

  // 3. Currency (Immutable INR)
  if (payload.currency !== undefined) {
    if (!payload.currency || typeof payload.currency !== 'object' || Array.isArray(payload.currency)) {
      const error = new Error('currency must be an object');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }
    if (payload.currency.code !== undefined && payload.currency.code !== 'INR') {
      const error = new Error("Currency code is fixed to 'INR' and cannot be modified");
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }
    if (payload.currency.symbol !== undefined && payload.currency.symbol !== '₹') {
      const error = new Error("Currency symbol is fixed to '₹' and cannot be modified");
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }
    const curr = {};
    if (payload.currency.name !== undefined) {
      if (typeof payload.currency.name !== 'string' || payload.currency.name.length > 50) {
        const error = new Error('currency.name must be a string up to 50 characters');
        error.statusCode = 400;
        error.code = 'VALIDATION_ERROR';
        throw error;
      }
      curr.name = payload.currency.name.trim();
    }
    if (payload.currency.locale !== undefined) {
      if (typeof payload.currency.locale !== 'string' || payload.currency.locale.length > 20) {
        const error = new Error('currency.locale must be a string up to 20 characters');
        error.statusCode = 400;
        error.code = 'VALIDATION_ERROR';
        throw error;
      }
      curr.locale = payload.currency.locale.trim();
    }
    if (Object.keys(curr).length > 0) {
      validated.currency = curr;
    }
  }

  // 4. Shipping Settings
  if (payload.shipping !== undefined) {
    if (!payload.shipping || typeof payload.shipping !== 'object' || Array.isArray(payload.shipping)) {
      const error = new Error('shipping must be an object');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }
    const ship = {};

    if (payload.shipping.standardFeePaise !== undefined) {
      const fee = payload.shipping.standardFeePaise;
      if (!Number.isInteger(fee) || fee < 0 || fee > 1000000) {
        const error = new Error('shipping.standardFeePaise must be an integer between 0 and 1,000,000 (paise)');
        error.statusCode = 400;
        error.code = 'VALIDATION_ERROR';
        throw error;
      }
      ship.standardFeePaise = fee;
    }

    if (payload.shipping.enableFreeShippingThreshold !== undefined) {
      if (typeof payload.shipping.enableFreeShippingThreshold !== 'boolean') {
        const error = new Error('shipping.enableFreeShippingThreshold must be a boolean');
        error.statusCode = 400;
        error.code = 'VALIDATION_ERROR';
        throw error;
      }
      ship.enableFreeShippingThreshold = payload.shipping.enableFreeShippingThreshold;
    }

    if (payload.shipping.freeShippingThresholdPaise !== undefined) {
      const threshold = payload.shipping.freeShippingThresholdPaise;
      if (!Number.isInteger(threshold) || threshold < 0 || threshold > 50000000) {
        const error = new Error('shipping.freeShippingThresholdPaise must be an integer between 0 and 50,000,000 (paise)');
        error.statusCode = 400;
        error.code = 'VALIDATION_ERROR';
        throw error;
      }
      ship.freeShippingThresholdPaise = threshold;
    }

    if (payload.shipping.deliveryEstimateDays !== undefined) {
      const est = payload.shipping.deliveryEstimateDays;
      if (!est || typeof est !== 'object' || Array.isArray(est)) {
        const error = new Error('shipping.deliveryEstimateDays must be an object');
        error.statusCode = 400;
        error.code = 'VALIDATION_ERROR';
        throw error;
      }
      const estimate = {};
      if (est.min !== undefined) {
        if (!Number.isInteger(est.min) || est.min < 1 || est.min > 60) {
          const error = new Error('shipping.deliveryEstimateDays.min must be an integer between 1 and 60');
          error.statusCode = 400;
          error.code = 'VALIDATION_ERROR';
          throw error;
        }
        estimate.min = est.min;
      }
      if (est.max !== undefined) {
        if (!Number.isInteger(est.max) || est.max < 1 || est.max > 60) {
          const error = new Error('shipping.deliveryEstimateDays.max must be an integer between 1 and 60');
          error.statusCode = 400;
          error.code = 'VALIDATION_ERROR';
          throw error;
        }
        estimate.max = est.max;
      }
      if (estimate.min !== undefined && estimate.max !== undefined && estimate.min > estimate.max) {
        const error = new Error('shipping.deliveryEstimateDays.min cannot exceed deliveryEstimateDays.max');
        error.statusCode = 400;
        error.code = 'VALIDATION_ERROR';
        throw error;
      }
      ship.deliveryEstimateDays = estimate;
    }

    validated.shipping = ship;
  }

  // 5. Payment Settings
  if (payload.payment !== undefined) {
    if (!payload.payment || typeof payload.payment !== 'object' || Array.isArray(payload.payment)) {
      const error = new Error('payment must be an object');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }
    const pay = {};

    if (payload.payment.isCodEnabled !== undefined) {
      if (payload.payment.isCodEnabled === false) {
        const error = new Error('Cash on Delivery is currently the sole supported payment method and cannot be disabled');
        error.statusCode = 400;
        error.code = 'VALIDATION_ERROR';
        throw error;
      }
      pay.isCodEnabled = true;
    }

    if (payload.payment.maxCodOrderPaise !== undefined) {
      const maxVal = payload.payment.maxCodOrderPaise;
      if (!Number.isInteger(maxVal) || maxVal < 10000 || maxVal > 100000000) {
        const error = new Error('payment.maxCodOrderPaise must be an integer between 10,000 (₹100) and 100,000,000 (₹10,00,000)');
        error.statusCode = 400;
        error.code = 'VALIDATION_ERROR';
        throw error;
      }
      pay.maxCodOrderPaise = maxVal;
    }

    validated.payment = pay;
  }

  // 6. Returns Settings
  if (payload.returns !== undefined) {
    if (!payload.returns || typeof payload.returns !== 'object' || Array.isArray(payload.returns)) {
      const error = new Error('returns must be an object');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }
    const ret = {};

    if (payload.returns.isReturnsEnabled !== undefined) {
      if (typeof payload.returns.isReturnsEnabled !== 'boolean') {
        const error = new Error('returns.isReturnsEnabled must be a boolean');
        error.statusCode = 400;
        error.code = 'VALIDATION_ERROR';
        throw error;
      }
      ret.isReturnsEnabled = payload.returns.isReturnsEnabled;
    }

    if (payload.returns.returnWindowDays !== undefined) {
      const days = payload.returns.returnWindowDays;
      if (!Number.isInteger(days) || days < 0 || days > 90) {
        const error = new Error('returns.returnWindowDays must be an integer between 0 and 90');
        error.statusCode = 400;
        error.code = 'VALIDATION_ERROR';
        throw error;
      }
      ret.returnWindowDays = days;
    }

    validated.returns = ret;
  }

  // 7. Maintenance Mode
  if (payload.maintenance !== undefined) {
    if (!payload.maintenance || typeof payload.maintenance !== 'object' || Array.isArray(payload.maintenance)) {
      const error = new Error('maintenance must be an object');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }
    const maint = {};

    if (payload.maintenance.isMaintenanceMode !== undefined) {
      if (typeof payload.maintenance.isMaintenanceMode !== 'boolean') {
        const error = new Error('maintenance.isMaintenanceMode must be a boolean');
        error.statusCode = 400;
        error.code = 'VALIDATION_ERROR';
        throw error;
      }
      maint.isMaintenanceMode = payload.maintenance.isMaintenanceMode;
    }

    if (payload.maintenance.maintenanceMessage !== undefined) {
      if (typeof payload.maintenance.maintenanceMessage !== 'string' || payload.maintenance.maintenanceMessage.length > 500) {
        const error = new Error('maintenance.maintenanceMessage must be a string up to 500 characters');
        error.statusCode = 400;
        error.code = 'VALIDATION_ERROR';
        throw error;
      }
      maint.maintenanceMessage = payload.maintenance.maintenanceMessage.trim();
    }

    validated.maintenance = maint;
  }

  // 8. Social Links
  if (payload.socialLinks !== undefined) {
    if (!payload.socialLinks || typeof payload.socialLinks !== 'object' || Array.isArray(payload.socialLinks)) {
      const error = new Error('socialLinks must be an object');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }
    const soc = {};
    for (const platform of ['instagram', 'facebook', 'twitter', 'pinterest']) {
      if (payload.socialLinks[platform] !== undefined) {
        if (typeof payload.socialLinks[platform] !== 'string' || payload.socialLinks[platform].length > 300) {
          const error = new Error(`socialLinks.${platform} must be a string up to 300 characters`);
          error.statusCode = 400;
          error.code = 'VALIDATION_ERROR';
          throw error;
        }
        soc[platform] = payload.socialLinks[platform].trim();
      }
    }
    validated.socialLinks = soc;
  }

  // 9. SEO
  if (payload.seo !== undefined) {
    if (!payload.seo || typeof payload.seo !== 'object' || Array.isArray(payload.seo)) {
      const error = new Error('seo must be an object');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }
    const s = {};

    if (payload.seo.metaTitle !== undefined) {
      if (typeof payload.seo.metaTitle !== 'string' || payload.seo.metaTitle.length > 150) {
        const error = new Error('seo.metaTitle must be a string up to 150 characters');
        error.statusCode = 400;
        error.code = 'VALIDATION_ERROR';
        throw error;
      }
      s.metaTitle = payload.seo.metaTitle.trim();
    }

    if (payload.seo.metaDescription !== undefined) {
      if (typeof payload.seo.metaDescription !== 'string' || payload.seo.metaDescription.length > 300) {
        const error = new Error('seo.metaDescription must be a string up to 300 characters');
        error.statusCode = 400;
        error.code = 'VALIDATION_ERROR';
        throw error;
      }
      s.metaDescription = payload.seo.metaDescription.trim();
    }

    if (payload.seo.keywords !== undefined) {
      if (!Array.isArray(payload.seo.keywords)) {
        const error = new Error('seo.keywords must be an array of strings');
        error.statusCode = 400;
        error.code = 'VALIDATION_ERROR';
        throw error;
      }
      if (payload.seo.keywords.length > 30) {
        const error = new Error('seo.keywords cannot exceed 30 items');
        error.statusCode = 400;
        error.code = 'VALIDATION_ERROR';
        throw error;
      }
      s.keywords = payload.seo.keywords
        .filter((k) => typeof k === 'string' && k.trim().length > 0)
        .map((k) => k.trim());
    }

    validated.seo = s;
  }

  return validated;
}
