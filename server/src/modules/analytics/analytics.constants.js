/**
 * LuxeCart Analytics Constants & Enums
 */

export const ANALYTICS_RANGES = Object.freeze({
  SEVEN_DAYS: '7d',
  THIRTY_DAYS: '30d',
  THIS_YEAR: 'this_year',
  ALL: 'all',
  CUSTOM: 'custom',
});

export const TIME_GRANULARITY = Object.freeze({
  DAY: 'day',
  MONTH: 'month',
  YEAR: 'year',
});

export const NON_REVENUE_ORDER_STATUSES = Object.freeze([
  'CANCELLED',
]);

export const CUSTOMER_SEGMENTS = Object.freeze({
  NEW: 'NEW',
  REPEAT: 'REPEAT',
  HIGH_VALUE: 'HIGH_VALUE',
});

export const HIGH_VALUE_CUSTOMER_THRESHOLD_PAISE = 5000000; // 50,000 INR (5,000,000 paise)

export const ORDER_VALUE_BUCKETS = Object.freeze([
  { label: '₹0–₹2,499', minPaise: 0, maxPaise: 249900 },
  { label: '₹2,500–₹4,999', minPaise: 250000, maxPaise: 499900 },
  { label: '₹5,000–₹9,999', minPaise: 500000, maxPaise: 999900 },
  { label: '₹10,000–₹24,999', minPaise: 1000000, maxPaise: 2499900 },
  { label: '₹25,000–₹49,999', minPaise: 2500000, maxPaise: 4999900 },
  { label: '₹50,000+', minPaise: 5000000, maxPaise: null },
]);

export const INVENTORY_HEALTH_STATUS = Object.freeze({
  ALL: 'ALL',
  HEALTHY: 'HEALTHY',
  LOW_STOCK: 'LOW_STOCK',
  OUT_OF_STOCK: 'OUT_OF_STOCK',
});

export const INVENTORY_RISK_LEVELS = Object.freeze({
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
});
