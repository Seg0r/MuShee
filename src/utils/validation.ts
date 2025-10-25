/**
 * Validation utilities for common data types and formats.
 * Provides reusable validation functions used across the application.
 */

/**
 * Regular expression for validating UUID v4 format.
 * Matches the standard UUID format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 * where x is any hexadecimal digit and y is one of 8, 9, A, or B.
 */
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates whether a string is a valid UUID v4.
 * UUIDs are used throughout the application for identifying entities.
 *
 * @param value - The string to validate as a UUID
 * @returns true if the string is a valid UUID v4, false otherwise
 *
 * @example
 * ```typescript
 * isValidUUID('550e8400-e29b-41d4-a716-446655440000'); // true
 * isValidUUID('not-a-uuid'); // false
 * isValidUUID(''); // false
 * ```
 */
export function isValidUUID(value: string | undefined | null): value is string {
  if (!value || typeof value !== 'string') {
    return false;
  }

  return UUID_V4_REGEX.test(value);
}

/**
 * Validates whether a string is a valid UUID v4 and throws an error if not.
 * Useful for input validation in service methods.
 *
 * @param value - The string to validate as a UUID
 * @param fieldName - The name of the field being validated (for error messages)
 * @throws Error if the value is not a valid UUID
 *
 * @example
 * ```typescript
 * validateUUID('550e8400-e29b-41d4-a716-446655440000', 'songId'); // no error
 * validateUUID('invalid', 'songId'); // throws Error: songId must be a valid UUID
 * ```
 */
export function validateUUID(value: string | undefined | null, fieldName = 'value'): void {
  if (!isValidUUID(value)) {
    throw new Error(`${fieldName} must be a valid UUID`);
  }
}
