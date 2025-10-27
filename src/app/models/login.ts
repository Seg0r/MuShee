/**
 * Login View Types and Interfaces
 * Defines all TypeScript types and interfaces for the login authentication flow
 */

/**
 * Represents the login form input data structure.
 * Contains the email address and password entered by the user.
 */
export interface LoginFormData {
  email: string;
  password: string;
}

/**
 * Represents authentication errors with additional metadata.
 * Extends error structure with field targeting and timestamp for tracking.
 */
export interface AuthError {
  code: string;
  message: string;
  field?: 'email' | 'password' | 'general';
  timestamp: Date;
}

/**
 * Represents the current state of the login form.
 * Used to manage UI state including loading indicators, error displays, and validation feedback.
 */
export interface FormState {
  isLoading: boolean;
  error: AuthError | null;
  isSubmitted: boolean;
  isDirty: boolean;
}

/**
 * Result of checking if user has an existing authenticated session.
 * Used to determine if immediate redirect is needed on component initialization.
 */
export interface SessionCheckResult {
  isAuthenticated: boolean;
  user: { id: string; email?: string } | null;
  profile: { id: string; updated_at: string; has_completed_onboarding: boolean } | null;
}

/**
 * Mapped error response for user display.
 * Maps Supabase error codes to user-friendly messages.
 */
export interface MappedAuthError {
  code: string;
  userMessage: string;
  field?: 'email' | 'password' | 'general';
}
