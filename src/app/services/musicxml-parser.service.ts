import { Injectable } from '@angular/core';
import { OpenSheetMusicDisplay, IOSMDOptions } from 'opensheetmusicdisplay';
import JSZip from 'jszip';
import { cleanAndTruncate } from '../../utils/musicxml-metadata';

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
   * Handles both uncompressed XML and compressed MXL (ZIP) formats.
   * Uses OpenSheetMusicDisplay to load and parse the score, then extracts metadata.
   * Implements timeout protection for large/complex files.
   *
   * @param fileBuffer - The MusicXML file content as ArrayBuffer (XML or MXL/ZIP)
   * @returns Promise resolving to extracted metadata
   * @throws Error if parsing fails, times out, or file format is unsupported
   */
  async parseMusicXML(fileBuffer: ArrayBuffer): Promise<MusicXMLMetadata> {
    try {
      console.log('Starting MusicXML parsing with OSMD');

      // Step 1: Check if file is MXL (ZIP) or XML and extract XML content if needed
      let xmlString = '';
      try {
        // Try to detect if it's a ZIP file (MXL) by checking for ZIP magic number
        const view = new Uint8Array(fileBuffer);
        const isMxl = view[0] === 0x50 && view[1] === 0x4b; // ZIP file magic number (PK)

        if (isMxl) {
          console.log('Detected MXL (compressed) format. Extracting XML...');
          const extractedXml = await this.extractXmlFromMxl(fileBuffer);
          xmlString = extractedXml;
        } else {
          // Standard XML format
          const decoder = new TextDecoder('utf-8');
          xmlString = decoder.decode(fileBuffer);
        }
      } catch (extractError) {
        console.error('Error extracting XML from MXL:', extractError);
        throw new Error('Failed to extract MusicXML from MXL file');
      }

      // Step 2: Create a temporary container for OSMD parsing
      // Use an off-screen div to avoid UI side effects during metadata extraction
      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'absolute';
      tempContainer.style.left = '-9999px';
      tempContainer.style.top = '-9999px';
      tempContainer.style.width = '1px';
      tempContainer.style.height = '1px';
      tempContainer.style.visibility = 'hidden';
      document.body.appendChild(tempContainer);

      // Step 2a: Create OSMD instance with minimal rendering options for faster parsing
      const osmd = new OpenSheetMusicDisplay(tempContainer, {
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

      try {
        // Step 3: Set up timeout for parsing operation (5 seconds as per plan)
        const parsePromise = this.performParsing(osmd, xmlString);
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('MusicXML parsing timeout')), 5000);
        });

        // Step 4: Race between parsing and timeout
        await Promise.race([parsePromise, timeoutPromise]);

        // Step 5: Extract metadata from XML string using proven seed script approach
        const metadata = this.extractMetadataFromXML(xmlString);

        console.log('MusicXML parsing completed successfully');
        return metadata;
      } finally {
        // Always clean up the temporary container
        if (tempContainer.parentNode) {
          tempContainer.parentNode.removeChild(tempContainer);
        }
        osmd.clear();
      }
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
   * Handles both uncompressed XML and compressed MXL (ZIP) formats.
   * Performs basic validation without full parsing to check if the file is processable.
   *
   * @param fileBuffer - The file content to validate (XML or MXL/ZIP)
   * @returns Promise resolving to true if valid MusicXML/MXL, false otherwise
   */
  async validateMusicXML(fileBuffer: ArrayBuffer): Promise<boolean> {
    try {
      // Step 1: Check if file is MXL (ZIP) or XML and extract XML content if needed
      let xmlString = '';

      try {
        // Try to detect if it's a ZIP file (MXL) by checking for ZIP magic number
        const view = new Uint8Array(fileBuffer);
        const isMxl = view[0] === 0x50 && view[1] === 0x4b; // ZIP file magic number (PK)

        if (isMxl) {
          console.log('MXL format detected during validation. Extracting XML...');
          xmlString = await this.extractXmlFromMxl(fileBuffer);
        } else {
          // Standard XML format
          const decoder = new TextDecoder('utf-8');
          xmlString = decoder.decode(fileBuffer);
        }
      } catch (extractError) {
        console.error('Error extracting XML from MXL during validation:', extractError);
        return false;
      }

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
   * Extracts XML content from an MXL (compressed MusicXML) file.
   * MXL files are ZIP archives containing a META-INF/container.xml file that points to the root MusicXML file.
   * This method reads the container.xml to find the main score file and extracts it.
   *
   * @private
   * @param fileBuffer - The MXL file content as ArrayBuffer
   * @returns Promise resolving to the extracted XML string
   * @throws Error if MXL extraction fails
   */
  private async extractXmlFromMxl(fileBuffer: ArrayBuffer): Promise<string> {
    try {
      // We need to use JSZip to handle ZIP extraction
      // For now, we'll implement a simple ZIP reader using native APIs
      const zip = await this.readZipFile(fileBuffer);

      // MXL files have a container.xml in META-INF that points to the main score
      let rootFileName = 'score.xml'; // Default fallback

      // Try to read container.xml to find the actual root file
      if (zip['META-INF/container.xml']) {
        const containerXml = zip['META-INF/container.xml'];
        // Parse container.xml to find rootfile element
        const parser = new DOMParser();
        const containerDoc = parser.parseFromString(containerXml, 'text/xml');
        const rootFileElement = containerDoc.querySelector('rootfile');

        if (rootFileElement && rootFileElement.hasAttribute('full-path')) {
          rootFileName = rootFileElement.getAttribute('full-path') || rootFileName;
          console.log('Found root file from container.xml:', rootFileName);
        }
      }

      // Extract the main MusicXML file
      if (zip[rootFileName]) {
        console.log('Successfully extracted MusicXML from MXL:', rootFileName);
        return zip[rootFileName];
      }

      // If exact root file not found, try to find first .xml file
      const xmlFiles = Object.keys(zip).filter(
        key => key.endsWith('.xml') && !key.includes('META-INF')
      );
      if (xmlFiles.length > 0) {
        console.log('Using first XML file found:', xmlFiles[0]);
        return zip[xmlFiles[0]];
      }

      throw new Error('No MusicXML file found in MXL archive');
    } catch (error) {
      console.error('Failed to extract XML from MXL:', error);
      throw new Error(
        `Failed to extract MusicXML from MXL file: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Reads and parses a ZIP file (MXL) into a key-value map of file contents.
   * Uses JSZip for browser-compatible ZIP extraction.
   *
   * @private
   * @param fileBuffer - The ZIP file content as ArrayBuffer
   * @returns Promise resolving to a map of filename -> file content (as strings)
   * @throws Error if ZIP reading fails
   */
  private async readZipFile(fileBuffer: ArrayBuffer): Promise<Record<string, string>> {
    try {
      const zip = new JSZip();
      const loadedZip = await zip.loadAsync(fileBuffer);

      const result: Record<string, string> = {};

      // Iterate through all files in the ZIP
      for (const [filename, file] of Object.entries(loadedZip.files)) {
        // Skip directories
        if (filename.endsWith('/')) {
          continue;
        }

        try {
          // Extract file content as text
          const content = await file.async('string');
          result[filename] = content;
          console.log(`Extracted file from MXL: ${filename}`);
        } catch (fileError) {
          console.warn(
            `Failed to read ${filename}: ${fileError instanceof Error ? fileError.message : 'Unknown error'}`
          );
          // Continue with other files
        }
      }

      console.log(`Successfully extracted ${Object.keys(result).length} files from MXL`);
      return result;
    } catch (error) {
      throw new Error(
        `Error reading ZIP file: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
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
   * Legacy method for OSMD metadata extraction.
   * OSMD doesn't reliably expose metadata, so we return empty.
   * The actual extraction happens via direct XML parsing instead.
   *
   * @private
   * @returns Empty metadata (actual extraction happens via XML)
   */
  private extractMetadata(): MusicXMLMetadata {
    // OSMD doesn't reliably expose metadata, so we return empty
    // The actual extraction will happen via XML parsing
    return { title: '', composer: '' };
  }

  /**
   * Extracts metadata directly from MusicXML string.
   * Follows the exact same extraction logic as the seed script's extractMetadataFromParsedXML,
   * but adapted for browser DOMParser (which cannot use xml2js Node.js library).
   *
   * @private
   * @param xmlString - The XML content as string
   * @returns Extracted metadata
   */
  private extractMetadataFromXML(xmlString: string): MusicXMLMetadata {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlString, 'text/xml');

      // Check for parser errors
      const parserError = doc.querySelector('parsererror');
      if (parserError) {
        console.warn('XML parsing error:', parserError.textContent);
        return { title: '', composer: '' };
      }

      let title = '';
      let composer = '';

      // Extract title - try work-title first (mirrors seed script logic)
      const workTitleEl = doc.getElementsByTagName('work-title')[0];
      if (workTitleEl?.textContent) {
        title = workTitleEl.textContent;
      }

      // Try movement-title as fallback (mirrors seed script logic)
      if (!title) {
        const movementTitleEl = doc.getElementsByTagName('movement-title')[0];
        if (movementTitleEl?.textContent) {
          title = movementTitleEl.textContent;
        }
      }

      // Extract composer - look for creator with type="composer" (mirrors seed script logic)
      const creatorElements = doc.getElementsByTagName('creator');
      let foundComposer: Element | null = null;

      for (const creator of creatorElements) {
        if (creator.getAttribute('type') === 'composer') {
          foundComposer = creator;
          break;
        }
      }

      // If no typed creator found, use first creator as fallback (mirrors seed script logic)
      if (!foundComposer && creatorElements.length > 0) {
        foundComposer = creatorElements[0];
      }

      if (foundComposer?.textContent) {
        composer = foundComposer.textContent;
      }

      // Clean and truncate metadata using shared utility
      title = cleanAndTruncate(title, 200);
      composer = cleanAndTruncate(composer, 200);

      console.log('XML metadata extraction result:', { title, composer });
      return { title, composer };
    } catch (error) {
      console.warn(
        `XML parsing failed, returning empty metadata: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return { title: '', composer: '' };
    }
  }
}
