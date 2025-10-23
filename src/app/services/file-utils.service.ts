import { Injectable } from '@angular/core';
import { MD5, lib } from 'crypto-js';
import { ValidationError } from '../models/errors';

/**
 * Service providing utility functions for file processing and validation.
 * Handles MD5 hash calculation, file validation, and string manipulation.
 */
@Injectable({
  providedIn: 'root',
})
export class FileUtilsService {
  private readonly MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
  private readonly ALLOWED_EXTENSIONS = ['.xml', '.musicxml'];
  private readonly MAX_STRING_LENGTH = 200;

  /**
   * Calculates the MD5 hash of a file buffer.
   * Uses the entire file content for content-based deduplication.
   *
   * @param fileBuffer - The file content as ArrayBuffer
   * @returns The MD5 hash as a hexadecimal string
   */
  calculateMD5Hash(fileBuffer: ArrayBuffer): string {
    try {
      // Convert ArrayBuffer to WordArray for crypto-js
      const uint8Array = new Uint8Array(fileBuffer);
      const wordArray = this.uint8ArrayToWordArray(uint8Array);

      // Calculate MD5 hash
      const hash = MD5(wordArray);

      return hash.toString();
    } catch {
      throw new ValidationError('Failed to calculate file hash', 'INTERNAL_ERROR');
    }
  }

  /**
   * Validates that a filename has an allowed MusicXML extension.
   *
   * @param filename - The original filename from the upload
   * @returns true if the extension is allowed
   * @throws ValidationError if extension is not allowed
   */
  validateFileExtension(filename: string): boolean {
    const extension = this.getFileExtension(filename);

    if (!this.ALLOWED_EXTENSIONS.includes(extension.toLowerCase())) {
      throw new ValidationError(
        `Only MusicXML files (.xml, .musicxml) are supported. Got: ${extension}`,
        'INVALID_FILE_FORMAT'
      );
    }

    return true;
  }

  /**
   * Validates that a file size is within the allowed limit.
   *
   * @param size - File size in bytes
   * @returns true if size is within limit
   * @throws ValidationError if file is too large
   */
  validateFileSize(size: number): boolean {
    if (size > this.MAX_FILE_SIZE_BYTES) {
      const maxSizeMB = this.MAX_FILE_SIZE_BYTES / (1024 * 1024);
      throw new ValidationError(
        `File size exceeds maximum allowed size of ${maxSizeMB}MB`,
        'FILE_TOO_LARGE'
      );
    }

    return true;
  }

  /**
   * Truncates a string to the maximum allowed length.
   * Used for sanitizing metadata fields before database storage.
   *
   * @param str - The string to truncate
   * @param maxLength - Maximum length (defaults to 200)
   * @returns The truncated string
   */
  truncateString(str: string, maxLength: number = this.MAX_STRING_LENGTH): string {
    if (str.length <= maxLength) {
      return str;
    }

    return str.substring(0, maxLength);
  }

  /**
   * Sanitizes and truncates a string value.
   * Removes excessive whitespace and limits length.
   *
   * @param value - The string value to sanitize
   * @param maxLength - Maximum allowed length
   * @returns Sanitized and truncated string
   */
  sanitizeAndTruncate(value: string, maxLength: number): string {
    return value
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .substring(0, maxLength);
  }

  /**
   * Performs comprehensive file validation including extension and size.
   * Convenience method that combines multiple validations.
   *
   * @param file - The file to validate
   * @throws ValidationError if any validation fails
   */
  validateFile(file: File): void {
    // Validate file extension
    this.validateFileExtension(file.name);

    // Validate file size
    this.validateFileSize(file.size);
  }

  /**
   * Extracts the file extension from a filename.
   *
   * @private
   * @param filename - The filename to process
   * @returns The file extension including the dot (e.g., '.xml')
   */
  private getFileExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf('.');
    if (lastDotIndex === -1) {
      return '';
    }

    return filename.substring(lastDotIndex);
  }

  /**
   * Converts a Uint8Array to a crypto-js WordArray for hashing.
   *
   * @private
   * @param uint8Array - The array to convert
   * @returns crypto-js WordArray
   */
  private uint8ArrayToWordArray(uint8Array: Uint8Array) {
    return lib.WordArray.create(uint8Array);
  }

  /**
   * Reads a File object as an ArrayBuffer.
   *
   * @param file - The file to read
   * @returns Promise resolving to ArrayBuffer
   */
  readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to read file as ArrayBuffer'));
        }
      };

      reader.onerror = () => {
        reject(new Error('Error reading file'));
      };

      reader.readAsArrayBuffer(file);
    });
  }
}
