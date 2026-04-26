// Shared AntD Form rule factories. Use these instead of repeating
// `{ required: true, message: '...' }` everywhere — the messages stay
// consistent and we can tune them in one place.

export const required = (label = 'This field') => ({
  required: true,
  message: `${label} is required`,
});

export const email = () => ({
  type: 'email',
  message: 'Enter a valid email',
});

// Loose phone check — 7-15 digits, optional leading +. Strict per-country
// validation belongs in the service layer, not the form.
export const phone = () => ({
  pattern: /^\+?\d{7,15}$/,
  message: 'Enter a valid phone number',
});

export const positiveNumber = (label = 'Value') => ({
  type: 'number',
  min: 0.01,
  message: `${label} must be greater than 0`,
});

export const nonNegativeNumber = (label = 'Value') => ({
  type: 'number',
  min: 0,
  message: `${label} cannot be negative`,
});

export const minLength = (n, label = 'This field') => ({
  min: n,
  message: `${label} must be at least ${n} characters`,
});

export const maxLength = (n, label = 'This field') => ({
  max: n,
  message: `${label} must be at most ${n} characters`,
});
