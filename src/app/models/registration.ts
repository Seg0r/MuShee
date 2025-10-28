/**
 * Registration View Types and Interfaces
 * Defines all TypeScript types and interfaces for the registration authentication flow
 */

/**
 * Represents the registration form input data structure.
 * Contains the email address and password entered by the user.
 */
export interface RegistrationFormData {
  email: string;
  password: string;
}

/**
 * Represents password validation state with individual requirement checks.
 * Computed in real-time as user types password.
 */
export interface PasswordValidationState {
  minLength: boolean; // password.length >= 8
  hasUppercase: boolean; // matches /[A-Z]/
  hasLowercase: boolean; // matches /[a-z]/
  hasNumber: boolean; // matches /[0-9]/
  isValid: boolean; // all above are true
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
 * Represents the current state of the registration form.
 * Used to manage UI state including loading indicators, error displays, and validation feedback.
 */
export interface FormState {
  isLoading: boolean;
  error: AuthError | null;
  isSubmitted: boolean;
  isDirty: boolean;
}
