import { Injectable } from '@angular/core';

/**
 * Standardized error structure for application-level error handling.
 * Maps various error sources to consistent format.
 */
export interface AppError {
  code: string;
  message: string;
  details?: string;
  originalError?: unknown;
  timestamp: Date;
}

/**
 * Service for centralized error handling across the application.
 * Provides utilities for mapping Supabase errors, network errors, and other exceptions
 * to user-friendly messages.
 */
@Injectable({
  providedIn: 'root',
})
export class ErrorHandlingService {
  /**
   * Maps Supabase authentication errors to user-friendly messages.
   * Handles various error codes and messages returned by Supabase Auth.
   *
   * @param error - Error object from Supabase Auth
   * @returns AppError with user-friendly message
   */
  mapSupabaseAuthError(error: unknown): AppError {
    const errorObj = error as Record<string, unknown>;
    const message = String(errorObj['message'] || '');
    const status = Number(errorObj['status'] || 0);

    let userMessage = 'Something went wrong. Please try again.';
    let code = String(status || 'AUTH_ERROR');

    // Map specific Supabase error messages to user-friendly text
    if (message.includes('Invalid login credentials')) {
      userMessage = 'Invalid email or password';
      code = 'INVALID_CREDENTIALS';
    } else if (message.includes('Email not confirmed')) {
      userMessage = 'Please verify your email before logging in. Check your spam folder if needed.';
      code = 'EMAIL_NOT_CONFIRMED';
    } else if (message.includes('User not found')) {
      userMessage = 'No account found with this email';
      code = 'USER_NOT_FOUND';
    } else if (message.includes('disabled')) {
      userMessage = 'This account has been disabled';
      code = 'ACCOUNT_DISABLED';
    } else if (message.includes('already registered')) {
      userMessage = 'This email is already registered. Please log in instead.';
      code = 'EMAIL_ALREADY_REGISTERED';
    } else if (message.includes('Password should be at least 6 characters')) {
      userMessage = 'Password must be at least 6 characters long';
      code = 'PASSWORD_TOO_SHORT';
    } else if (status === 429) {
      userMessage = 'Too many login attempts. Please try again in a few minutes.';
      code = 'RATE_LIMITED';
    } else if (status === 503) {
      userMessage = 'Service temporarily unavailable. Please try again later.';
      code = 'SERVICE_UNAVAILABLE';
    } else if (status >= 500) {
      userMessage = 'Server error. Please try again later.';
      code = 'SERVER_ERROR';
    }

    return {
      code,
      message: userMessage,
      details: message,
      originalError: error,
      timestamp: new Date(),
    };
  }

  /**
   * Maps network and fetch errors to user-friendly messages.
   * Handles TypeError from fetch failures, connection issues, etc.
   *
   * @param error - Error from network/fetch
   * @returns AppError with user-friendly message
   */
  mapNetworkError(error: unknown): AppError {
    const userMessage = 'Network error. Please check your connection and try again.';
    let details = '';

    if (error instanceof TypeError) {
      if (error.message.includes('fetch')) {
        details = 'Fetch failed - check network connection';
      } else {
        details = error.message;
      }
    } else if (error instanceof Error) {
      details = error.message;
    } else {
      details = String(error);
    }

    return {
      code: 'NETWORK_ERROR',
      message: userMessage,
      details,
      originalError: error,
      timestamp: new Date(),
    };
  }

  /**
   * Maps timeout errors to user-friendly messages.
   * Handles cases where requests exceed time limits.
   *
   * @param error - Timeout error
   * @returns AppError with user-friendly message
   */
  mapTimeoutError(error: unknown): AppError {
    return {
      code: 'REQUEST_TIMEOUT',
      message: 'Request took too long. Please try again.',
      details: 'API request exceeded timeout limit',
      originalError: error,
      timestamp: new Date(),
    };
  }

  /**
   * Generic error mapper that attempts to intelligently map any error type.
   * Tries to extract user-friendly message from various error formats.
   *
   * @param error - Any error object
   * @returns AppError with appropriate message
   */
  mapGenericError(error: unknown): AppError {
    // If it's already an AppError, return as-is
    if (this.isAppError(error)) {
      return error;
    }

    // Try to extract message from various error formats
    let message = 'An unexpected error occurred. Please try again.';
    let details = '';

    if (error instanceof Error) {
      message = error.message || message;
      details = error.stack || '';
    } else if (typeof error === 'object' && error !== null) {
      const errorObj = error as Record<string, unknown>;
      if ('message' in errorObj) {
        message = String(errorObj['message']) || message;
      }
      if ('details' in errorObj) {
        details = String(errorObj['details']) || details;
      }
    } else if (typeof error === 'string') {
      message = error;
    }

    return {
      code: 'INTERNAL_ERROR',
      message,
      details,
      originalError: error,
      timestamp: new Date(),
    };
  }

  /**
   * Logs error to console in development mode.
   * In production, this could be integrated with error tracking service (e.g., Sentry).
   *
   * @param error - AppError to log
   * @param context - Optional context about where error occurred
   */
  logError(error: AppError, context?: string): void {
    const prefix = context ? `[${context}]` : '[AppError]';
    console.error(
      `${prefix} ${error.code}: ${error.message}`,
      error.details || '',
      error.originalError
    );

    // In production, send to error tracking service
    // Example: this.sentryService.captureException(error);
  }

  /**
   * Type guard to check if object is an AppError.
   *
   * @param error - Object to check
   * @returns True if object is an AppError
   */
  private isAppError(error: unknown): error is AppError {
    if (typeof error !== 'object' || error === null) {
      return false;
    }

    const obj = error as Record<string, unknown>;
    return (
      typeof obj['code'] === 'string' &&
      typeof obj['message'] === 'string' &&
      obj['timestamp'] instanceof Date
    );
  }
}
