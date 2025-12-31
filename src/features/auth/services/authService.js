/**
 * Auth Service Wrapper
 * Centralized authentication operations using Supabase Auth
 * Handles password reset flow, error normalization, and security best practices
 */

import { supabase } from '@/config/supabaseClient';

/**
 * Error message normalization
 * Maps Supabase errors to user-friendly messages
 */
const normalizeError = (error) => {
  if (!error) return null;

  const errorMessage = error.message || '';
  const errorCode = error.status || '';

  // Network errors
  if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
    return {
      message: 'Network error. Please check your connection and try again.',
      type: 'network',
      retryable: true,
    };
  }

  // Session/token errors
  if (errorCode === 401 || errorMessage.includes('session') || errorMessage.includes('token')) {
    return {
      message: 'This link is invalid or expired. Please request a new password reset.',
      type: 'session_missing',
      retryable: false,
    };
  }

  // OTP/token expiry
  if (errorMessage.includes('expired') || errorMessage.includes('otp_expired')) {
    return {
      message: 'This link has expired. Please request a new password reset.',
      type: 'otp_expired',
      retryable: false,
    };
  }

  // Password validation errors
  if (errorMessage.includes('password') && errorMessage.includes('weak')) {
    return {
      message: 'Password is too weak. Please use a stronger password.',
      type: 'weak_password',
      retryable: true,
    };
  }

  if (errorMessage.includes('minimum')) {
    return {
      message: 'Password must be at least 6 characters long.',
      type: 'weak_password',
      retryable: true,
    };
  }

  // Rate limiting
  if (errorMessage.includes('rate limit') || errorMessage.includes('too many')) {
    return {
      message: 'Too many requests. Please wait a few minutes before trying again.',
      type: 'rate_limit',
      retryable: true,
    };
  }

  // Generic error
  return {
    message: 'An unexpected error occurred. Please try again.',
    type: 'unknown',
    retryable: true,
  };
};

/**
 * Request password reset email
 * @param {string} email - User's email address
 * @param {string} redirectTo - URL to redirect after password reset (defaults to production URL)
 * @returns {Promise<{success: boolean, error: object|null}>}
 */
export const requestPasswordReset = async (email, redirectTo = null) => {
  try {
    // Use production URL if not provided
    const resetUrl = redirectTo || `${window.location.origin}/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: resetUrl,
    });

    if (error) {
      return {
        success: false,
        error: normalizeError(error),
      };
    }

    // Always return success (no user enumeration)
    return {
      success: true,
      error: null,
    };
  } catch (err) {
    return {
      success: false,
      error: normalizeError(err),
    };
  }
};

/**
 * Check if user has a valid session (for reset password page)
 * @returns {Promise<{hasSession: boolean, error: object|null}>}
 */
export const checkResetSession = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      return {
        hasSession: false,
        error: normalizeError(error),
      };
    }

    if (!data.session) {
      return {
        hasSession: false,
        error: {
          message: 'This link is invalid or expired. Please request a new one.',
          type: 'session_missing',
          retryable: false,
        },
      };
    }

    return {
      hasSession: true,
      error: null,
    };
  } catch (err) {
    return {
      hasSession: false,
      error: normalizeError(err),
    };
  }
};

/**
 * Update user password
 * @param {string} newPassword - New password
 * @returns {Promise<{success: boolean, error: object|null}>}
 */
export const updatePassword = async (newPassword) => {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      return {
        success: false,
        error: normalizeError(error),
      };
    }

    return {
      success: true,
      error: null,
    };
  } catch (err) {
    return {
      success: false,
      error: normalizeError(err),
    };
  }
};

/**
 * Sign out user (used after successful password reset)
 * @returns {Promise<{success: boolean, error: object|null}>}
 */
export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      return {
        success: false,
        error: normalizeError(error),
      };
    }

    return {
      success: true,
      error: null,
    };
  } catch (err) {
    return {
      success: false,
      error: normalizeError(err),
    };
  }
};

