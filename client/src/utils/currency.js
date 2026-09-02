/**
 * Format integer paise into Indian Rupee (INR) representation
 * @param {number} [paise=0] - Integer paise value
 * @param {object} [options]
 * @param {boolean} [options.showDecimals=false]
 * @returns {string} - Formatted currency string (e.g. ₹5,000)
 */
export const formatPaiseToINR = (paise = 0, { showDecimals = false } = {}) => {
  if (paise === null || paise === undefined || isNaN(paise)) {
    return '₹0';
  }

  const rupees = paise / 100;
  const hasDecimals = showDecimals || (rupees % 1 !== 0);

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(rupees);
};

/**
 * Format compact integer paise (e.g. ₹1.2L, ₹50K) for high-density charts and badges
 * @param {number} [paise=0]
 * @returns {string}
 */
export const formatCompactPaise = (paise = 0) => {
  if (!paise || isNaN(paise)) return '₹0';
  const rupees = paise / 100;

  if (rupees >= 10000000) {
    return `₹${(rupees / 10000000).toFixed(1)}Cr`;
  }
  if (rupees >= 100000) {
    return `₹${(rupees / 100000).toFixed(1)}L`;
  }
  if (rupees >= 1000) {
    return `₹${(rupees / 1000).toFixed(1)}K`;
  }
  return `₹${rupees.toLocaleString('en-IN')}`;
};
