/**
 * Timeout utilities for handling asynchronous operations with time limits.
 * Provides reusable timeout wrappers for API calls and other async operations.
 */

/**
 * Error thrown when an operation times out.
 */
export class TimeoutError extends Error {
  constructor(message = 'Operation timed out') {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Wraps a Promise with a timeout, rejecting with TimeoutError if the operation
 * doesn't complete within the specified time limit.
 *
 * @param promise - The Promise to wrap with a timeout
 * @param timeoutMs - Timeout in milliseconds
 * @param timeoutMessage - Optional custom message for timeout errors
 * @returns Promise that resolves/rejects with the original promise or TimeoutError
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage?: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    // Set up the timeout
    const timeoutId = setTimeout(() => {
      reject(new TimeoutError(timeoutMessage || `Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    // Handle the original promise
    promise
      .then(result => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

/**
 * Creates a timeout wrapper function with a fixed timeout duration.
 * Useful for creating reusable timeout wrappers for specific operations.
 *
 * @param timeoutMs - Fixed timeout in milliseconds
 * @param timeoutMessage - Optional custom message for timeout errors
 * @returns Function that wraps promises with the specified timeout
 */
export function createTimeoutWrapper(timeoutMs: number, timeoutMessage?: string) {
  return <T>(promise: Promise<T>): Promise<T> => {
    return withTimeout(promise, timeoutMs, timeoutMessage);
  };
}

/**
 * Specific timeout wrapper for AI service calls with the PRD-required 3-second timeout.
 */
export const aiServiceTimeout = createTimeoutWrapper(
  3000,
  'AI service request timed out after 3 seconds'
);

/**
 * Specific timeout wrapper for general API calls (configurable timeout).
 */
export const apiTimeout = (timeoutMs: number) =>
  createTimeoutWrapper(timeoutMs, `API request timed out after ${timeoutMs}ms`);

/**
 * Retries an operation with timeout until success or max retries reached.
 * Each retry uses the same timeout duration.
 *
 * @param operation - Function that returns a Promise to retry
 * @param maxRetries - Maximum number of retry attempts
 * @param timeoutMs - Timeout for each individual attempt
 * @param retryDelayMs - Delay between retries in milliseconds
 * @returns Promise that resolves with operation result or rejects after all retries
 */
export async function retryWithTimeout<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  timeoutMs = 3000,
  retryDelayMs = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await withTimeout(operation(), timeoutMs);
    } catch (error) {
      lastError = error as Error;

      // If this was the last attempt, don't retry
      if (attempt === maxRetries) {
        break;
      }

      // If it was a timeout, wait and retry
      if (error instanceof TimeoutError) {
        console.warn(`Attempt ${attempt + 1} timed out, retrying in ${retryDelayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      } else {
        // For non-timeout errors, fail immediately (don't retry)
        throw error;
      }
    }
  }

  throw lastError!;
}
