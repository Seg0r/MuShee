import type { ErrorCode, ErrorResponseDto } from '../../types';

/**
 * Base error class for application-specific errors.
 * Provides a standardized way to handle and convert errors to API response format.
 */
export abstract class AppError extends Error {
  abstract readonly code: ErrorCode;
  abstract readonly statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }

  /**
   * Converts the error to a standardized API error response DTO.
   */
  toDTO(): ErrorResponseDto {
    return {
      error: {
        code: this.code,
        message: this.message,
      },
    };
  }
}

/**
 * Error thrown when request validation fails.
 * Maps to HTTP 400 Bad Request responses.
 */
export class ValidationError extends AppError {
  readonly code: ErrorCode = 'INVALID_REQUEST';
  readonly statusCode = 400;

  constructor(message: string, code?: ErrorCode) {
    super(message);
    if (code) {
      // Type assertion needed since we can't dynamically assign to readonly property
      Object.assign(this, { code });
    }
  }
}

/**
 * Error thrown when authentication is required but missing or invalid.
 * Maps to HTTP 401 Unauthorized responses.
 */
export class AuthenticationError extends AppError {
  readonly code: ErrorCode = 'UNAUTHORIZED';
  readonly statusCode = 401;

  constructor(message = 'Authentication required') {
    super(message);
  }
}

/**
 * Error thrown when a resource conflict occurs (e.g., duplicate data).
 * Maps to HTTP 409 Conflict responses.
 */
export class ConflictError extends AppError {
  readonly code: ErrorCode = 'SONG_ALREADY_IN_LIBRARY';
  readonly statusCode = 409;

  constructor(message: string, code?: ErrorCode) {
    super(message);
    if (code) {
      Object.assign(this, { code });
    }
  }
}
