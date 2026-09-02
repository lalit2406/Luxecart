const INDIAN_PIN_REGEX = /^\d{6}$/;
const INDIAN_PHONE_REGEX = /^[6-9]\d{9}$/;
const ALLOWED_TYPES = ['HOME', 'WORK', 'OTHER'];
const FORBIDDEN_FIELDS = [
  'userId',
  '_id',
  'id',
  'price',
  'stock',
  'reserved',
  'orderId',
  'payment',
  'subtotal',
  'total',
  'discount',
];

/**
 * Normalize phone number by removing spaces, dashes, +91, or leading 0
 * @param {string} rawPhone
 * @returns {string}
 */
export const normalizePhone = (rawPhone) => {
  if (!rawPhone || typeof rawPhone !== 'string') return '';
  let cleaned = rawPhone.replace(/[\s\-()]+/g, '');
  if (cleaned.startsWith('+91')) {
    cleaned = cleaned.substring(3);
  } else if (cleaned.startsWith('91') && cleaned.length === 12) {
    cleaned = cleaned.substring(2);
  } else if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = cleaned.substring(1);
  }
  return cleaned;
};

/**
 * Validate address creation payload
 * @param {object} body
 * @returns {{ isValid: boolean, errors: string[], sanitized: object }}
 */
export const validateCreateAddress = (body = {}) => {
  const errors = [];
  const sanitized = {};

  // Check forbidden injected fields
  for (const field of FORBIDDEN_FIELDS) {
    if (body[field] !== undefined) {
      errors.push(`Field '${field}' is not permitted in address payload`);
    }
  }

  // 1. Full Name
  if (!body.fullName || typeof body.fullName !== 'string') {
    errors.push('Full name is required');
  } else {
    const trimmed = body.fullName.trim();
    if (trimmed.length < 2) {
      errors.push('Full name must be at least 2 characters long');
    } else if (trimmed.length > 100) {
      errors.push('Full name cannot exceed 100 characters');
    } else {
      sanitized.fullName = trimmed;
    }
  }

  // 2. Phone
  if (!body.phone || typeof body.phone !== 'string') {
    errors.push('Phone number is required');
  } else {
    const cleanedPhone = normalizePhone(body.phone);
    if (!INDIAN_PHONE_REGEX.test(cleanedPhone)) {
      errors.push('Please enter a valid 10-digit Indian mobile number (starts with 6, 7, 8, or 9)');
    } else {
      sanitized.phone = cleanedPhone;
    }
  }

  // 3. Address Line 1
  if (!body.addressLine1 || typeof body.addressLine1 !== 'string') {
    errors.push('Address Line 1 is required');
  } else {
    const trimmed = body.addressLine1.trim();
    if (trimmed.length < 3) {
      errors.push('Address Line 1 must be at least 3 characters long');
    } else if (trimmed.length > 200) {
      errors.push('Address Line 1 cannot exceed 200 characters');
    } else {
      sanitized.addressLine1 = trimmed;
    }
  }

  // 4. Address Line 2 (Optional)
  if (body.addressLine2 !== undefined && body.addressLine2 !== null) {
    const trimmed = String(body.addressLine2).trim();
    if (trimmed.length > 200) {
      errors.push('Address Line 2 cannot exceed 200 characters');
    } else {
      sanitized.addressLine2 = trimmed;
    }
  } else {
    sanitized.addressLine2 = '';
  }

  // 5. Landmark (Optional)
  if (body.landmark !== undefined && body.landmark !== null) {
    const trimmed = String(body.landmark).trim();
    if (trimmed.length > 100) {
      errors.push('Landmark cannot exceed 100 characters');
    } else {
      sanitized.landmark = trimmed;
    }
  } else {
    sanitized.landmark = '';
  }

  // 6. City
  if (!body.city || typeof body.city !== 'string') {
    errors.push('City is required');
  } else {
    const trimmed = body.city.trim();
    if (trimmed.length < 2) {
      errors.push('City name must be at least 2 characters long');
    } else if (trimmed.length > 100) {
      errors.push('City name cannot exceed 100 characters');
    } else {
      sanitized.city = trimmed;
    }
  }

  // 7. State
  if (!body.state || typeof body.state !== 'string') {
    errors.push('State is required');
  } else {
    const trimmed = body.state.trim();
    if (trimmed.length < 2) {
      errors.push('State name must be at least 2 characters long');
    } else if (trimmed.length > 100) {
      errors.push('State name cannot exceed 100 characters');
    } else {
      sanitized.state = trimmed;
    }
  }

  // 8. Postal Code (PIN)
  if (!body.postalCode || typeof body.postalCode !== 'string' && typeof body.postalCode !== 'number') {
    errors.push('PIN code is required');
  } else {
    const pinStr = String(body.postalCode).trim();
    if (!INDIAN_PIN_REGEX.test(pinStr)) {
      errors.push('Please enter a valid 6-digit Indian postal PIN code');
    } else {
      sanitized.postalCode = pinStr;
    }
  }

  // 9. Country (India only)
  if (body.country !== undefined && body.country !== null) {
    const countryStr = String(body.country).trim();
    if (countryStr.toLowerCase() !== 'india') {
      errors.push('LuxeCart currently ships to India only');
    } else {
      sanitized.country = 'India';
    }
  } else {
    sanitized.country = 'India';
  }

  // 10. Address Type
  if (body.addressType !== undefined && body.addressType !== null) {
    const typeStr = String(body.addressType).trim().toUpperCase();
    if (!ALLOWED_TYPES.includes(typeStr)) {
      errors.push(`Address type must be one of: ${ALLOWED_TYPES.join(', ')}`);
    } else {
      sanitized.addressType = typeStr;
    }
  } else {
    sanitized.addressType = 'HOME';
  }

  // 11. isDefault
  if (body.isDefault !== undefined) {
    sanitized.isDefault = Boolean(body.isDefault);
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized,
  };
};

/**
 * Validate address update payload
 * @param {object} body
 * @returns {{ isValid: boolean, errors: string[], sanitized: object }}
 */
export const validateUpdateAddress = (body = {}) => {
  const errors = [];
  const sanitized = {};

  // Check forbidden injected fields
  for (const field of FORBIDDEN_FIELDS) {
    if (body[field] !== undefined) {
      errors.push(`Field '${field}' is not permitted in address update payload`);
    }
  }

  // 1. Full Name
  if (body.fullName !== undefined) {
    if (typeof body.fullName !== 'string') {
      errors.push('Full name must be a string');
    } else {
      const trimmed = body.fullName.trim();
      if (trimmed.length < 2) {
        errors.push('Full name must be at least 2 characters long');
      } else if (trimmed.length > 100) {
        errors.push('Full name cannot exceed 100 characters');
      } else {
        sanitized.fullName = trimmed;
      }
    }
  }

  // 2. Phone
  if (body.phone !== undefined) {
    if (typeof body.phone !== 'string') {
      errors.push('Phone must be a string');
    } else {
      const cleanedPhone = normalizePhone(body.phone);
      if (!INDIAN_PHONE_REGEX.test(cleanedPhone)) {
        errors.push('Please enter a valid 10-digit Indian mobile number');
      } else {
        sanitized.phone = cleanedPhone;
      }
    }
  }

  // 3. Address Line 1
  if (body.addressLine1 !== undefined) {
    if (typeof body.addressLine1 !== 'string') {
      errors.push('Address Line 1 must be a string');
    } else {
      const trimmed = body.addressLine1.trim();
      if (trimmed.length < 3) {
        errors.push('Address Line 1 must be at least 3 characters long');
      } else if (trimmed.length > 200) {
        errors.push('Address Line 1 cannot exceed 200 characters');
      } else {
        sanitized.addressLine1 = trimmed;
      }
    }
  }

  // 4. Address Line 2
  if (body.addressLine2 !== undefined) {
    const trimmed = String(body.addressLine2 || '').trim();
    if (trimmed.length > 200) {
      errors.push('Address Line 2 cannot exceed 200 characters');
    } else {
      sanitized.addressLine2 = trimmed;
    }
  }

  // 5. Landmark
  if (body.landmark !== undefined) {
    const trimmed = String(body.landmark || '').trim();
    if (trimmed.length > 100) {
      errors.push('Landmark cannot exceed 100 characters');
    } else {
      sanitized.landmark = trimmed;
    }
  }

  // 6. City
  if (body.city !== undefined) {
    if (typeof body.city !== 'string') {
      errors.push('City must be a string');
    } else {
      const trimmed = body.city.trim();
      if (trimmed.length < 2) {
        errors.push('City name must be at least 2 characters long');
      } else if (trimmed.length > 100) {
        errors.push('City name cannot exceed 100 characters');
      } else {
        sanitized.city = trimmed;
      }
    }
  }

  // 7. State
  if (body.state !== undefined) {
    if (typeof body.state !== 'string') {
      errors.push('State must be a string');
    } else {
      const trimmed = body.state.trim();
      if (trimmed.length < 2) {
        errors.push('State name must be at least 2 characters long');
      } else if (trimmed.length > 100) {
        errors.push('State name cannot exceed 100 characters');
      } else {
        sanitized.state = trimmed;
      }
    }
  }

  // 8. Postal Code
  if (body.postalCode !== undefined) {
    const pinStr = String(body.postalCode).trim();
    if (!INDIAN_PIN_REGEX.test(pinStr)) {
      errors.push('Please enter a valid 6-digit Indian postal PIN code');
    } else {
      sanitized.postalCode = pinStr;
    }
  }

  // 9. Country
  if (body.country !== undefined) {
    const countryStr = String(body.country).trim();
    if (countryStr.toLowerCase() !== 'india') {
      errors.push('LuxeCart currently ships to India only');
    } else {
      sanitized.country = 'India';
    }
  }

  // 10. Address Type
  if (body.addressType !== undefined) {
    const typeStr = String(body.addressType).trim().toUpperCase();
    if (!ALLOWED_TYPES.includes(typeStr)) {
      errors.push(`Address type must be one of: ${ALLOWED_TYPES.join(', ')}`);
    } else {
      sanitized.addressType = typeStr;
    }
  }

  // 11. isDefault
  if (body.isDefault !== undefined) {
    sanitized.isDefault = Boolean(body.isDefault);
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized,
  };
};
