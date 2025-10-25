import { Injectable } from '@angular/core';
import { OpenSheetMusicDisplay, IOSMDOptions } from 'opensheetmusicdisplay';

/**
 * Metadata extracted from a parsed MusicXML file.
 * Contains the essential information needed for song cataloging.
 */
export interface MusicXMLMetadata {
  title: string;
  composer: string;
}

/**
 * Service for parsing MusicXML files using OpenSheetMusicDisplay.
 * Handles metadata extraction, validation, and error handling for MusicXML content.
 */
@Injectable({
  providedIn: 'root',
})
export class MusicXMLParserService {
  /**
   * Parses MusicXML file content and extracts metadata (title and composer).
   * Uses OpenSheetMusicDisplay to load and parse the score, then extracts metadata.
   * Implements timeout protection for large/complex files.
   *
   * @param fileBuffer - The MusicXML file content as ArrayBuffer
   * @returns Promise resolving to extracted metadata
   * @throws Error if parsing fails or times out
   */
  async parseMusicXML(fileBuffer: ArrayBuffer): Promise<MusicXMLMetadata> {
    try {
      console.log('Starting MusicXML parsing with OSMD');

      // Create OSMD instance with minimal rendering options for faster parsing
      const osmd = new OpenSheetMusicDisplay('osmd-container', {
        autoResize: false,
        drawingParameters: 'compact', // Faster rendering, minimal visual output
        drawTitle: false, // Skip title rendering for parsing
        drawComposer: false, // Skip composer rendering for parsing
        drawCredits: false, // Skip credits rendering for parsing
        drawPartNames: false, // Skip part names for parsing
        drawMeasureNumbers: false, // Skip measure numbers for parsing
        drawFingerings: false, // Skip fingerings for parsing
        drawLyrics: false, // Skip lyrics for parsing
      } as IOSMDOptions);

      // Convert ArrayBuffer to string for OSMD
      const decoder = new TextDecoder('utf-8');
      const xmlString = decoder.decode(fileBuffer);

      // Set up timeout for parsing operation (5 seconds as per plan)
      const parsePromise = this.performParsing(osmd, xmlString);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('MusicXML parsing timeout')), 5000);
      });

      // Race between parsing and timeout
      const score = await Promise.race([parsePromise, timeoutPromise]);

      // Extract metadata from parsed score
      const metadata = this.extractMetadata(score);

      console.log('MusicXML parsing completed successfully');
      return metadata;
    } catch (error) {
      console.error('MusicXML parsing failed:', error);

      // Re-throw with more specific error message
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          throw new Error('MusicXML parsing timed out. File may be too complex or corrupted.');
        }
        throw new Error(`Failed to parse MusicXML: ${error.message}`);
      }

      throw new Error('Failed to parse MusicXML: Unknown error occurred');
    }
  }

  /**
   * Validates whether the provided file buffer contains valid MusicXML content.
   * Performs basic validation without full parsing to check if the file is processable.
   *
   * @param fileBuffer - The file content to validate
   * @returns Promise resolving to true if valid MusicXML, false otherwise
   */
  async validateMusicXML(fileBuffer: ArrayBuffer): Promise<boolean> {
    try {
      // Basic validation: check if it's valid XML and contains MusicXML root elements
      const decoder = new TextDecoder('utf-8');
      const xmlString = decoder.decode(fileBuffer);

      // Quick checks for XML validity and MusicXML structure
      if (!xmlString.trim().startsWith('<?xml') && !xmlString.trim().startsWith('<')) {
        console.log('File does not appear to be XML');
        return false;
      }

      // Check for basic MusicXML structure (score-partwise or score-timewise)
      const hasMusicXMLStructure =
        xmlString.includes('<score-partwise') ||
        xmlString.includes('<score-timewise') ||
        xmlString.includes('<opus') ||
        xmlString.includes('<work>');

      if (!hasMusicXMLStructure) {
        console.log('File does not contain MusicXML structure');
        return false;
      }

      // Try a quick parse to ensure XML is well-formed
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlString, 'text/xml');

      // Check for parser errors
      const parserError = doc.querySelector('parsererror');
      if (parserError) {
        console.log('XML parsing error:', parserError.textContent);
        return false;
      }

      console.log('Basic MusicXML validation passed');
      return true;
    } catch (error) {
      console.error('MusicXML validation failed:', error);
      return false;
    }
  }

  /**
   * Performs the actual OSMD parsing operation.
   * Separated for timeout handling.
   *
   * @private
   * @param osmd - The OSMD instance to use for parsing
   * @param xmlString - The XML string to parse
   * @returns Promise resolving to the parsed score
   */
  private async performParsing(osmd: OpenSheetMusicDisplay, xmlString: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      try {
        // Load the MusicXML string
        osmd
          .load(xmlString)
          .then(() => {
            // Get the parsed sheet (score)
            const sheet = osmd.Sheet;
            if (!sheet) {
              reject(new Error('No sheet data found in MusicXML'));
              return;
            }

            resolve(sheet);
          })
          .catch((error: unknown) => {
            const errorMessage = error instanceof Error ? error.message : 'Unknown parsing error';
            reject(new Error(`OSMD parsing error: ${errorMessage}`));
          });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Extracts metadata from the parsed OSMD score object.
   * Tries multiple sources for title and composer information.
   *
   * @private
   * @param sheet - The parsed OSMD sheet object
   * @returns Extracted metadata with fallback values
   */
  private extractMetadata(sheet: unknown): MusicXMLMetadata {
    let title = '';
    let composer = '';

    try {
      const sheetObj = sheet as Record<string, unknown>;

      // Extract title - try multiple sources
      if (sheetObj['Title'] && typeof sheetObj['Title'] === 'string') {
        title = sheetObj['Title'];
      } else if (
        sheetObj['MusicParts'] &&
        Array.isArray(sheetObj['MusicParts']) &&
        sheetObj['MusicParts'].length > 0
      ) {
        // Try to get title from first music part
        const firstPart = sheetObj['MusicParts'][0] as Record<string, unknown>;
        if (firstPart['Title'] && typeof firstPart['Title'] === 'string') {
          title = firstPart['Title'];
        }
      }

      // Extract composer - try multiple sources
      if (sheetObj['Composer'] && typeof sheetObj['Composer'] === 'string') {
        composer = sheetObj['Composer'];
      } else if (
        sheetObj['Credits'] &&
        Array.isArray(sheetObj['Credits']) &&
        sheetObj['Credits'].length > 0
      ) {
        // Look for composer in credits
        for (const credit of sheetObj['Credits']) {
          const creditObj = credit as Record<string, unknown>;
          if (
            creditObj['CreditType'] === 'composer' &&
            creditObj['CreditWords'] &&
            typeof creditObj['CreditWords'] === 'string'
          ) {
            composer = creditObj['CreditWords'];
            break;
          }
        }
      }

      // Fallback: try to extract from work-title and creator elements if available
      // This would require additional XML parsing if OSMD doesn't extract these
      if (!title || !composer) {
        // Additional metadata extraction could be added here if needed
        console.log('Using fallback metadata extraction');
      }

      // Clean and truncate metadata
      title = this.cleanAndTruncate(title, 200);
      composer = this.cleanAndTruncate(composer, 200);

      console.log('Extracted metadata:', { title, composer });
      return { title, composer };
    } catch (error) {
      console.warn('Error extracting metadata from parsed score:', error);
      // Return empty metadata rather than failing completely
      return { title: '', composer: '' };
    }
  }

  /**
   * Cleans and truncates a string value for metadata storage.
   * Removes extra whitespace and limits length.
   *
   * @private
   * @param value - The string value to clean
   * @param maxLength - Maximum allowed length
   * @returns Cleaned and truncated string
   */
  private cleanAndTruncate(value: string, maxLength: number): string {
    if (!value) return '';

    // Trim whitespace and normalize internal spaces
    const cleaned = value.trim().replace(/\s+/g, ' ');

    // Truncate if too long
    return cleaned.length > maxLength ? cleaned.substring(0, maxLength) : cleaned;
  }
}
