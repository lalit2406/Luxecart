/**
 * Helper to mask customer phone numbers for privacy
 * e.g., +91 9876543210 -> +91 98*** **210
 * @param {string} phone
 * @returns {string}
 */
export const maskPhone = (phone) => {
  if (!phone) return 'N/A';
  const str = String(phone).trim();
  if (str.length < 7) return '***-***';
  return str.slice(0, 5) + '***' + str.slice(-3);
};

/**
 * Helper to mask customer email addresses for privacy
 * e.g., customer@example.com -> c***r@example.com
 * @param {string} email
 * @returns {string}
 */
export const maskEmail = (email) => {
  if (!email || !email.includes('@')) return '***@***.***';
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
};

/**
 * Milestone badge and color styling helper
 * @param {string} milestone
 * @returns {{ badge: string, colorClass: string, dotClass: string }}
 */
export const getMilestoneConfig = (milestone) => {
  switch (milestone) {
    case 'MANIFESTED':
      return {
        badge: 'Shipment Manifested & Packed',
        colorClass: 'bg-amber-50 text-amber-800 border-amber-200',
        dotClass: 'bg-amber-500',
      };
    case 'PICKED_UP':
      return {
        badge: 'Picked Up by Courier',
        colorClass: 'bg-blue-50 text-blue-800 border-blue-200',
        dotClass: 'bg-blue-500',
      };
    case 'IN_TRANSIT':
      return {
        badge: 'In Transit via Sorting Hub',
        colorClass: 'bg-indigo-50 text-indigo-800 border-indigo-200',
        dotClass: 'bg-indigo-500',
      };
    case 'OUT_FOR_DELIVERY':
      return {
        badge: 'Out for Doorstep Delivery',
        colorClass: 'bg-purple-50 text-purple-800 border-purple-200',
        dotClass: 'bg-purple-600',
      };
    case 'DELIVERED':
      return {
        badge: 'Delivered & COD Collected',
        colorClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        dotClass: 'bg-emerald-600',
      };
    case 'DELIVERY_ATTEMPT_FAILED':
      return {
        badge: 'Delivery Attempt Failed (Rescheduling)',
        colorClass: 'bg-amber-50 text-amber-900 border-amber-300',
        dotClass: 'bg-amber-600',
      };
    case 'RTO_INITIATED':
      return {
        badge: 'Return to Origin Initiated',
        colorClass: 'bg-rose-50 text-rose-800 border-rose-200',
        dotClass: 'bg-rose-600',
      };
    case 'RTO_DELIVERED':
      return {
        badge: 'Returned to Warehouse Origin',
        colorClass: 'bg-gray-100 text-gray-800 border-gray-300',
        dotClass: 'bg-gray-600',
      };
    default:
      return {
        badge: milestone || 'Processing Order',
        colorClass: 'bg-[#F7F3EE] text-[#2A211B] border-[#E7DED5]',
        dotClass: 'bg-[#9A6A45]',
      };
  }
};
