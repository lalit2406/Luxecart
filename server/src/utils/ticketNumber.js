import crypto from 'crypto';
import SupportTicket from '../modules/support/supportTicket.model.js';

/**
 * Generate collision-safe human-readable ticket number (e.g. TKT-20260830-A1B2C3)
 * @returns {Promise<string>}
 */
export const generateTicketNumber = async () => {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');

  let ticketNumber;
  let exists = true;
  let attempts = 0;

  while (exists && attempts < 10) {
    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
    ticketNumber = `TKT-${dateStr}-${randomHex}`;

    const existing = await SupportTicket.findOne({ ticketNumber }).select('_id').lean();
    if (!existing) {
      exists = false;
    }
    attempts++;
  }

  if (exists) {
    const nanoSuffix = Date.now().toString().slice(-6);
    ticketNumber = `TKT-${dateStr}-${nanoSuffix}`;
  }

  return ticketNumber;
};
