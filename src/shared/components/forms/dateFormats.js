import dayjs from 'dayjs';

// Wire format used for all DB columns (date / DATE in Postgres).
export const DATE_WIRE = 'YYYY-MM-DD';

// Display formats. Pick one per surface — do not invent new ones inline.
export const DATE_DISPLAY       = 'DD MMM YYYY';      // 26 Apr 2026
export const DATE_DISPLAY_SHORT = 'DD/MM/YYYY';
export const DATETIME_DISPLAY   = 'DD MMM YYYY, HH:mm';

// dayjs <-> string helpers. All forms should use these instead of inline
// dayjs(x) / x.format('YYYY-MM-DD') so that we have one place to fix
// timezone / null / undefined handling.

export function toDayjs(value) {
  if (value == null || value === '') return null;
  const d = dayjs(value);
  return d.isValid() ? d : null;
}

export function fromDayjs(value, format = DATE_WIRE) {
  if (!value) return null;
  const d = dayjs.isDayjs(value) ? value : dayjs(value);
  return d.isValid() ? d.format(format) : null;
}
