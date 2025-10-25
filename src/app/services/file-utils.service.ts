import { Injectable } from '@angular/core';
import MD5 from 'crypto-js/md5';
import WordArray from 'crypto-js/lib-typedarrays';

/**
 * Service providing utility functions for file processing and validation.
 * Handles common file operations needed for MusicXML upload processing.
 */
@Injectable({
  providedIn: 'root',
})
export class FileUtilsService {
  /**
   * Maximum allowed file size for MusicXML uploads (10MB as per plan).
   */
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

  /**
   * Allowed file extensions for MusicXML files.
   */
  private readonly ALLOWED_EXTENSIONS = ['.xml', '.musicxml'];

  /**
   * Calculates MD5 hash of file content for deduplication.
   * Uses crypto-js MD5 implementation for consistent hashing across platforms.
   *
   * @param fileBuffer - The file content as ArrayBuffer
   * @returns MD5 hash as hexadecimal string
   */
  calculateMD5Hash(fileBuffer: ArrayBuffer): string {
    try {
      console.log('Calculating MD5 hash for file buffer of size:', fileBuffer.byteLength);

      // Convert ArrayBuffer to WordArray for crypto-js
      const wordArray = WordArray.create(fileBuffer);

      // Calculate MD5 hash
      const hash = MD5(wordArray).toString();

      console.log('MD5 hash calculated successfully');
      return hash;
    } catch (error) {
      console.error('Error calculating MD5 hash:', error);
      throw new Error('Failed to calculate file hash');
    }
  }

  /**
   * Validates file extension against allowed MusicXML extensions.
   * Performs case-insensitive comparison.
   *
   * @param filename - The filename to validate
   * @returns true if extension is allowed, false otherwise
   */
  validateFileExtension(filename: string): boolean {
    try {
      if (!filename || typeof filename !== 'string') {
        console.log('Invalid filename provided for extension validation');
        return false;
      }

      // Extract file extension
      const extension = this.getFileExtension(filename);

      // Check if extension is in allowed list (case-insensitive)
      const isValid = this.ALLOWED_EXTENSIONS.includes(extension.toLowerCase());

      console.log(`File extension validation for "${filename}": ${isValid ? 'valid' : 'invalid'}`);
      return isValid;
    } catch (error) {
      console.error('Error validating file extension:', error);
      return false;
    }
  }

  /**
   * Validates file size against maximum allowed size.
   *
   * @param size - File size in bytes
   * @returns true if size is within limits, false otherwise
   */
  validateFileSize(size: number): boolean {
    try {
      if (typeof size !== 'number' || isNaN(size) || size < 0) {
        console.log('Invalid file size provided for validation');
        return false;
      }

      const isValid = size <= this.MAX_FILE_SIZE;
      const sizeMB = (size / (1024 * 1024)).toFixed(2);

      console.log(
        `File size validation for ${sizeMB}MB: ${isValid ? 'valid' : 'invalid'} (max: ${this.MAX_FILE_SIZE / (1024 * 1024)}MB)`
      );
      return isValid;
    } catch (error) {
      console.error('Error validating file size:', error);
      return false;
    }
  }

  /**
   * Truncates a string to a maximum length while preserving word boundaries when possible.
   * Used for sanitizing metadata fields before database storage.
   *
   * @param str - The string to truncate
   * @param maxLength - Maximum allowed length
   * @returns Truncated string
   */
  truncateString(str: string, maxLength: number): string {
    try {
      if (!str || typeof str !== 'string') {
        return '';
      }

      if (str.length <= maxLength) {
        return str;
      }

      // Try to truncate at word boundary if possible
      const truncated = str.substring(0, maxLength);
      const lastSpaceIndex = truncated.lastIndexOf(' ');

      // If there's a space within reasonable distance from the end, truncate there
      if (lastSpaceIndex > maxLength * 0.8) {
        return truncated.substring(0, lastSpaceIndex);
      }

      // Otherwise, hard truncate
      return truncated;
    } catch (error) {
      console.error('Error truncating string:', error);
      return '';
    }
  }

  /**
   * Gets the file extension from a filename.
   * Handles edge cases like files without extensions or hidden files.
   *
   * @private
   * @param filename - The filename to extract extension from
   * @returns File extension including the dot, or empty string if none
   */
  private getFileExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf('.');
    if (lastDotIndex === -1 || lastDotIndex === 0) {
      return '';
    }
    return filename.substring(lastDotIndex);
  }

  /**
   * Validates MIME type for MusicXML files.
   * Accepts common XML and text MIME types that may be used for MusicXML files.
   *
   * @param mimeType - The MIME type to validate
   * @returns true if MIME type is acceptable for MusicXML, false otherwise
   */
  validateMimeType(mimeType: string): boolean {
    try {
      if (!mimeType || typeof mimeType !== 'string') {
        console.log('Invalid MIME type provided for validation');
        return false;
      }

      // Acceptable MIME types for MusicXML files
      const validMimeTypes = [
        'application/xml',
        'text/xml',
        'application/vnd.recordare.musicxml+xml',
        'application/vnd.recordare.musicxml',
      ];

      const isValid = validMimeTypes.includes(mimeType.toLowerCase());
      console.log(`MIME type validation for "${mimeType}": ${isValid ? 'valid' : 'invalid'}`);
      return isValid;
    } catch (error) {
      console.error('Error validating MIME type:', error);
      return false;
    }
  }

  /**
   * Gets the maximum allowed file size in bytes.
   * Useful for client-side validation and error messages.
   *
   * @returns Maximum file size in bytes
   */
  getMaxFileSize(): number {
    return this.MAX_FILE_SIZE;
  }

  /**
   * Gets the list of allowed file extensions.
   * Useful for client-side validation and UI hints.
   *
   * @returns Array of allowed file extensions
   */
  getAllowedExtensions(): string[] {
    return [...this.ALLOWED_EXTENSIONS];
  }
}
