import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

// Extend dayjs with timezone support
dayjs.extend(utc);
dayjs.extend(timezone);

// IST timezone constant
const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Parse free-text time like:
 *  "7", "07", "730", "0730", "7:30", "7.30", "7a", "7am", "7:30p", "19", "1930"
 * Returns a dayjs object (today's date, time set) or null.
 */
export function parseFlexibleTime(input) {
  if (!input) return null;
  let s = String(input).trim().toLowerCase();

  // normalize: remove spaces, allow '.' as ':'
  s = s.replace(/\s+/g, '').replace(/\./g, ':');

  // detect am/pm
  let am = null;
  if (/(am|a)$/.test(s)) { am = true; s = s.replace(/(am|a)$/, ''); }
  if (/(pm|p)$/.test(s)) { am = false; s = s.replace(/(pm|p)$/, ''); }

  let h = null, m = 0;

  if (s.includes(':')) {
    const [hh, mm = '0'] = s.split(':');
    if (!/^\d{1,2}$/.test(hh) || !/^\d{1,2}$/.test(mm)) return null;
    h = +hh; m = +mm;
  } else {
    if (!/^\d{1,4}$/.test(s)) return null;
    if (s.length <= 2) { h = +s; m = 0; }
    else if (s.length === 3) { h = +s.slice(0, 1); m = +s.slice(1); }
    else { h = +s.slice(0, 2); m = +s.slice(2); }
  }

  if (Number.isNaN(h) || Number.isNaN(m) || m < 0 || m > 59) return null;

  // resolve am/pm if present
  if (am !== null) {
    if (am) { // AM
      if (h === 12) h = 0;
      if (h < 0 || h > 11) return null;
    } else { // PM
      if (h >= 1 && h <= 11) h += 12;
      if (h < 12 || h > 23) return null;
    }
  }

  if (h < 0 || h > 23) return null;

  return dayjs().hour(h).minute(m).second(0).millisecond(0);
}

export const nice = (d, twelve = true) =>
  (d && dayjs.isDayjs(d)) ? (twelve ? d.format('hh:mm A') : d.format('HH:mm')) : '';

export const toMin = (hhmmss) => {
  if (!hhmmss) return null;
  const [h, m] = String(hhmmss).split(':').map(n => parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
};

export const fromMin = (min) => {
  if (!min) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
};

/**
 * Format timestamp in IST timezone
 * @param {string|Date|dayjs} ts - Timestamp to format
 * @param {Object} options - Formatting options
 * @returns {string} Formatted date string in IST
 */
export const fmtIST = (ts, options = {}) => {
  if (!ts) return '—';
  
  const defaultOptions = {
    timeZone: IST_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...options
  };
  
  try {
    const date = dayjs.isDayjs(ts) ? ts.toDate() : new Date(ts);
    return date.toLocaleDateString('en-IN', defaultOptions);
  } catch (error) {
    return '—';
  }
};

/**
 * Format date in IST timezone
 * @param {string|Date|dayjs} date - Date to format
 * @param {string} format - Date format (default: 'DD MMM YYYY')
 * @returns {string} Formatted date string
 */
export const fmtDateIST = (date, format = 'DD MMM YYYY') => {
  if (!date) return '—';
  
  try {
    const dayjsDate = dayjs.isDayjs(date) ? date : dayjs(date);
    return dayjsDate.tz(IST_TIMEZONE).format(format);
  } catch (error) {
    return '—';
  }
};

/**
 * Format date and time in IST timezone
 * @param {string|Date|dayjs} date - Date to format
 * @param {string} format - Date format (default: 'DD MMM YYYY, h:mm A')
 * @returns {string} Formatted date and time string
 */
export const fmtDateTimeIST = (date, format = 'DD MMM YYYY, h:mm A') => {
  if (!date) return '—';
  
  try {
    const dayjsDate = dayjs.isDayjs(date) ? date : dayjs(date);
    return dayjsDate.tz(IST_TIMEZONE).format(format);
  } catch (error) {
    return '—';
  }
};

/**
 * Format time in IST timezone
 * @param {string|Date|dayjs} time - Time to format
 * @param {string} format - Time format (default: 'h:mm A')
 * @returns {string} Formatted time string
 */
export const fmtTimeIST = (time, format = 'h:mm A') => {
  if (!time) return '—';
  
  try {
    const dayjsTime = dayjs.isDayjs(time) ? time : dayjs(time);
    return dayjsTime.tz(IST_TIMEZONE).format(format);
  } catch (error) {
    return '—';
  }
};

/**
 * Format relative time in IST (e.g., "2 hours ago", "yesterday")
 * @param {string|Date|dayjs} date - Date to format
 * @returns {string} Relative time string
 */
export const fmtRelativeIST = (date) => {
  if (!date) return '—';
  
  try {
    const dayjsDate = dayjs.isDayjs(date) ? date : dayjs(date);
    const now = dayjs().tz(IST_TIMEZONE);
    const diff = now.diff(dayjsDate.tz(IST_TIMEZONE), 'day');
    
    if (diff === 0) {
      return 'Today';
    } else if (diff === 1) {
      return 'Yesterday';
    } else if (diff === -1) {
      return 'Tomorrow';
    } else if (diff > 1 && diff < 7) {
      return `${diff} days ago`;
    } else if (diff < -1 && diff > -7) {
      return `In ${Math.abs(diff)} days`;
    } else {
      return fmtDateIST(date);
    }
  } catch (error) {
    return '—';
  }
};

/**
 * Get current date in IST
 * @returns {dayjs} Current date in IST timezone
 */
export const nowIST = () => {
  return dayjs().tz(IST_TIMEZONE);
};

/**
 * Convert date to IST timezone
 * @param {string|Date|dayjs} date - Date to convert
 * @returns {dayjs} Date in IST timezone
 */
export const toIST = (date) => {
  if (!date) return null;
  
  try {
    const dayjsDate = dayjs.isDayjs(date) ? date : dayjs(date);
    return dayjsDate.tz(IST_TIMEZONE);
  } catch (error) {
    return null;
  }
};

/**
 * Format date range in IST
 * @param {string|Date|dayjs} startDate - Start date
 * @param {string|Date|dayjs} endDate - End date
 * @param {string} format - Date format (default: 'DD MMM YYYY')
 * @returns {string} Formatted date range string
 */
export const fmtDateRangeIST = (startDate, endDate, format = 'DD MMM YYYY') => {
  if (!startDate || !endDate) return '—';
  
  try {
    const start = fmtDateIST(startDate, format);
    const end = fmtDateIST(endDate, format);
    
    if (start === end) {
      return start;
    }
    
    return `${start} - ${end}`;
  } catch (error) {
    return '—';
  }
};

/**
 * Check if date is today in IST
 * @param {string|Date|dayjs} date - Date to check
 * @returns {boolean} Whether date is today
 */
export const isTodayIST = (date) => {
  if (!date) return false;
  
  try {
    const dayjsDate = dayjs.isDayjs(date) ? date : dayjs(date);
    const today = dayjs().tz(IST_TIMEZONE);
    return dayjsDate.tz(IST_TIMEZONE).isSame(today, 'day');
  } catch (error) {
    return false;
  }
};

/**
 * Check if date is in the past in IST
 * @param {string|Date|dayjs} date - Date to check
 * @returns {boolean} Whether date is in the past
 */
export const isPastIST = (date) => {
  if (!date) return false;
  
  try {
    const dayjsDate = dayjs.isDayjs(date) ? date : dayjs(date);
    const now = dayjs().tz(IST_TIMEZONE);
    return dayjsDate.tz(IST_TIMEZONE).isBefore(now);
  } catch (error) {
    return false;
  }
};

/**
 * Check if date is in the future in IST
 * @param {string|Date|dayjs} date - Date to check
 * @returns {boolean} Whether date is in the future
 */
export const isFutureIST = (date) => {
  if (!date) return false;
  
  try {
    const dayjsDate = dayjs.isDayjs(date) ? date : dayjs(date);
    const now = dayjs().tz(IST_TIMEZONE);
    return dayjsDate.tz(IST_TIMEZONE).isAfter(now);
  } catch (error) {
    return false;
  }
};

// open interval overlap: [aS,aE) intersects [bS,bE)
export const overlap = (aS, aE, bS, bE) => aS < bE && bS < aE;
