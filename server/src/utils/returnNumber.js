import crypto from 'crypto';
import Return from '../modules/returns/return.model.js';

/**
 * Generate collision-safe human-readable return number (e.g. RET-20260830-A1B2C3)
 * @returns {Promise<string>}
 */
export const generateReturnNumber = async () => {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');

  let returnNumber;
  let exists = true;
  let attempts = 0;

  while (exists && attempts < 10) {
    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
    returnNumber = `RET-${dateStr}-${randomHex}`;

    const existing = await Return.findOne({ returnNumber }).select('_id').lean();
    if (!existing) {
      exists = false;
    }
    attempts++;
  }

  if (exists) {
    // High collision fallback with timestamp suffix
    const nanoSuffix = Date.now().toString().slice(-6);
    returnNumber = `RET-${dateStr}-${nanoSuffix}`;
  }

  return returnNumber;
};
