import { Injectable, inject } from '@angular/core';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { ValidationError } from '../models/errors';
import { FileUtilsService } from './file-utils.service';

/**
 * Metadata extracted from a MusicXML file.
 * Contains the essential information needed for song identification and display.
 */
export interface MusicXMLMetadata {
  /** The work title extracted from <work-title> element */
  title: string;
  /** The composer name extracted from <creator type="composer"> element */
  composer: string;
}

/**
 * Service responsible for parsing MusicXML files and extracting metadata using OpenSheetMusicDisplay.
 * OSMD provides comprehensive MusicXML parsing with built-in security and validation.
 */
@Injectable({
  providedIn: 'root',
})
export class MusicxmlParserService {
  private readonly MAX_TITLE_LENGTH = 200;
  private readonly MAX_COMPOSER_LENGTH = 200;
  private readonly PARSING_TIMEOUT_MS = 5000; // 5 seconds

  private readonly fileUtils = inject(FileUtilsService);

  /**
   * Parses a MusicXML file buffer and extracts metadata using OpenSheetMusicDisplay.
   * OSMD provides comprehensive MusicXML parsing with built-in validation and security.
   *
   * @param fileBuffer - The raw file content as ArrayBuffer
   * @returns Promise resolving to extracted metadata
   * @throws ValidationError if parsing fails or XML is invalid
   */
  async parseMusicXML(fileBuffer: ArrayBuffer): Promise<MusicXMLMetadata> {
    try {
      // Convert buffer to string for OSMD
      const xmlString = new TextDecoder('utf-8').decode(fileBuffer);

      // Create OSMD instance for parsing
      const osmd = new OpenSheetMusicDisplay(document.createElement('div'), {
        autoResize: false,
        backend: 'svg',
        drawFromMeasureNumber: 1,
        drawUpToMeasureNumber: 1, // Only load first measure for metadata extraction
        disableCursor: true,
        followCursor: false,
      });

      // Set up timeout for parsing
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('MusicXML parsing timed out'));
        }, this.PARSING_TIMEOUT_MS);
      });

      // Parse the MusicXML with timeout protection
      await Promise.race([osmd.load(xmlString), timeoutPromise]);

      // Extract metadata from the parsed score
      const metadata = this.extractMetadataFromOSMD(osmd);

      return metadata;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }

      // Handle OSMD parsing errors
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          throw new ValidationError(
            'MusicXML parsing timed out. File may be too complex.',
            'INVALID_MUSICXML'
          );
        }

        // OSMD provides specific error messages for invalid MusicXML
        if (
          error.message.includes('XML') ||
          error.message.includes('MusicXML') ||
          error.message.includes('parse') ||
          error.message.includes('load')
        ) {
          throw new ValidationError(
            `Invalid MusicXML format: ${error.message}`,
            'INVALID_MUSICXML'
          );
        }
      }

      throw new ValidationError(
        'Unable to parse MusicXML file. Please ensure the file is valid.',
        'INVALID_MUSICXML'
      );
    }
  }

  /**
   * Validates whether a file buffer contains valid MusicXML content.
   * Performs basic structural validation without full parsing.
   *
   * @param fileBuffer - The raw file content as ArrayBuffer
   * @returns true if the file appears to be valid MusicXML
   */
  validateMusicXML(fileBuffer: ArrayBuffer): boolean {
    try {
      const xmlString = new TextDecoder('utf-8').decode(fileBuffer);
      return this.isValidMusicXMLString(xmlString);
    } catch {
      return false;
    }
  }

  /**
   * Performs basic validation to check if string contains MusicXML structure.
   *
   * @private
   * @param xmlString - The XML content as string
   * @returns true if string appears to be MusicXML
   */
  private isValidMusicXMLString(xmlString: string): boolean {
    // Check for basic XML structure
    if (!xmlString.trim().startsWith('<?xml') && !xmlString.trim().startsWith('<')) {
      return false;
    }

    // Check for MusicXML-specific elements
    const hasScorePartwise = xmlString.includes('<score-partwise');
    const hasScoreTimewise = xmlString.includes('<score-timewise');
    const hasWorkTitle = xmlString.includes('<work-title>') || xmlString.includes('work-title');
    const hasCreator = xmlString.includes('<creator') || xmlString.includes('creator');

    // Must have either score-partwise or score-timewise root element
    if (!hasScorePartwise && !hasScoreTimewise) {
      return false;
    }

    // Should have at least some metadata elements
    return hasWorkTitle || hasCreator;
  }

  /**
   * Extracts title and composer metadata from OSMD parsed score.
   *
   * @private
   * @param osmd - The OpenSheetMusicDisplay instance with loaded score
   * @returns Extracted metadata with sanitized and truncated values
   */
  private extractMetadataFromOSMD(osmd: OpenSheetMusicDisplay): MusicXMLMetadata {
    // Extract metadata using OSMD's built-in properties
    // OSMD returns Label objects, convert to string
    const title = osmd.Sheet.Title?.text || osmd.Sheet.Title?.toString() || '';
    const composer = osmd.Sheet.Composer?.text || osmd.Sheet.Composer?.toString() || '';

    // Validate that we have at least some metadata
    if (!title && !composer) {
      throw new ValidationError(
        'MusicXML file must contain title or composer information',
        'INVALID_MUSICXML'
      );
    }

    return {
      title: this.fileUtils.sanitizeAndTruncate(title, this.MAX_TITLE_LENGTH),
      composer: this.fileUtils.sanitizeAndTruncate(composer, this.MAX_COMPOSER_LENGTH),
    };
  }
}
