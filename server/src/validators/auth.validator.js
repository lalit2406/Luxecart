const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate registration request payload
 * @param {object} data
 * @returns {{ isValid: boolean, errors: string[], sanitized: object }}
 */
export const validateRegisterInput = (data = {}) => {
  const errors = [];
  const { name, email, password, phone } = data || {};

  // Name validation
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    errors.push('Name must be at least 2 characters long');
  } else if (name.trim().length > 100) {
    errors.push('Name cannot exceed 100 characters');
  }

  // Email validation
  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    errors.push('Please provide a valid email address');
  }

  // Password validation
  if (!password || typeof password !== 'string' || password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  // Phone validation (optional)
  let sanitizedPhone = undefined;
  if (phone !== undefined && phone !== null && phone !== '') {
    if (typeof phone !== 'string' || phone.trim().length < 7 || phone.trim().length > 20) {
      errors.push('Please provide a valid phone number (7-20 digits)');
    } else {
      sanitizedPhone = phone.trim();
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      name: typeof name === 'string' ? name.trim() : '',
      email: typeof email === 'string' ? email.trim().toLowerCase() : '',
      password: typeof password === 'string' ? password : '',
      phone: sanitizedPhone,
    },
  };
};

/**
 * Validate login request payload
 * @param {object} data
 * @returns {{ isValid: boolean, errors: string[], sanitized: object }}
 */
export const validateLoginInput = (data = {}) => {
  const errors = [];
  const { email, password } = data || {};

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    errors.push('Please provide a valid email address');
  }

  if (!password || typeof password !== 'string' || password.length === 0) {
    errors.push('Password is required');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      email: typeof email === 'string' ? email.trim().toLowerCase() : '',
      password: typeof password === 'string' ? password : '',
    },
  };
};
