// src/utils/money.js
// Centralized money formatting utilities for INR currency

/**
 * Convert INR amount to paise (smallest currency unit)
 * @param {number} inr - Amount in INR
 * @returns {number} Amount in paise
 */
export const toPaise = (inr) => {
  const n = Number(inr);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 0;
};

/**
 * Convert paise to INR amount
 * @param {number} paise - Amount in paise
 * @returns {number} Amount in INR
 */
export const toINR = (paise) => {
  const n = Number(paise || 0);
  return Number.isFinite(n) ? n / 100 : 0;
};

/**
 * Format paise amount as INR currency string
 * @param {number} paise - Amount in paise
 * @param {Object} options - Formatting options
 * @returns {string} Formatted currency string
 */
export const fmtINR = (paise, options = {}) => {
  const n = toINR(paise);
  
  const defaultOptions = {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options
  };
  
  try {
    return new Intl.NumberFormat('en-IN', defaultOptions).format(n);
  } catch (error) {
    // Fallback formatting
    return `₹${n.toFixed(2)}`;
  }
};

/**
 * Format INR amount as currency string (convenience function)
 * @param {number} inr - Amount in INR
 * @param {Object} options - Formatting options
 * @returns {string} Formatted currency string
 */
export const fmtINRAmount = (inr, options = {}) => {
  return fmtINR(toPaise(inr), options);
};

/**
 * Format paise as compact currency string (e.g., ₹1.2K, ₹1.5L)
 * @param {number} paise - Amount in paise
 * @returns {string} Compact formatted currency string
 */
export const fmtINRCompact = (paise) => {
  const inr = toINR(paise);
  
  if (inr >= 100000) {
    return `₹${(inr / 100000).toFixed(1)}L`;
  } else if (inr >= 1000) {
    return `₹${(inr / 1000).toFixed(1)}K`;
  } else {
    return fmtINR(paise);
  }
};

/**
 * Format paise as range string (e.g., "₹500 - ₹1,000")
 * @param {number} minPaise - Minimum amount in paise
 * @param {number} maxPaise - Maximum amount in paise
 * @returns {string} Range formatted string
 */
export const fmtINRRange = (minPaise, maxPaise) => {
  const minINR = toINR(minPaise);
  const maxINR = toINR(maxPaise);
  
  if (minINR === maxINR) {
    return fmtINR(minPaise);
  }
  
  return `${fmtINR(minPaise)} - ${fmtINR(maxPaise)}`;
};

/**
 * Parse currency string to paise
 * @param {string} currencyString - Currency string (e.g., "₹1,500.00")
 * @returns {number} Amount in paise
 */
export const parseINR = (currencyString) => {
  if (!currencyString) return 0;
  
  // Remove currency symbol and commas
  const cleanString = currencyString.replace(/[₹,]/g, '');
  const amount = parseFloat(cleanString);
  
  return Number.isFinite(amount) ? toPaise(amount) : 0;
};

/**
 * Validate if amount is within reasonable range
 * @param {number} paise - Amount in paise
 * @param {number} minPaise - Minimum allowed amount
 * @param {number} maxPaise - Maximum allowed amount
 * @returns {boolean} Whether amount is valid
 */
export const validateAmount = (paise, minPaise = 0, maxPaise = 10000000) => {
  const n = Number(paise);
  return Number.isFinite(n) && n >= minPaise && n <= maxPaise;
};

/**
 * Calculate percentage of total amount
 * @param {number} amountPaise - Amount in paise
 * @param {number} totalPaise - Total amount in paise
 * @returns {number} Percentage (0-100)
 */
export const calculatePercentage = (amountPaise, totalPaise) => {
  if (!totalPaise || totalPaise === 0) return 0;
  return Math.round((amountPaise / totalPaise) * 100);
};

/**
 * Format percentage with currency context
 * @param {number} amountPaise - Amount in paise
 * @param {number} totalPaise - Total amount in paise
 * @returns {string} Formatted string (e.g., "₹500 (25%)")
 */
export const fmtINRWithPercentage = (amountPaise, totalPaise) => {
  const percentage = calculatePercentage(amountPaise, totalPaise);
  return `${fmtINR(amountPaise)} (${percentage}%)`;
}; 