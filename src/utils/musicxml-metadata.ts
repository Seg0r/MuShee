/**
 * Shared utility for MusicXML metadata extraction.
 * Used by both the seed script and the MusicXMLParserService.
 */

/**
 * Metadata extracted from a MusicXML file.
 */
export interface MusicXMLMetadata {
  title: string;
  composer: string;
  subtitle?: string;
}

/**
 * Type for xml2js parsed creator element (used in seed script).
 */
export interface ParsedCreator {
  $?: { type?: string };
  _: string;
}

/**
 * Cleans and truncates a string value for metadata storage.
 * Removes extra whitespace and limits length to database constraints.
 *
 * @param value - The string value to clean
 * @param maxLength - Maximum allowed length
 * @returns Cleaned and truncated string
 */
export function cleanAndTruncate(value: string, maxLength: number): string {
  if (!value) return '';

  // Trim whitespace and normalize internal spaces
  const cleaned = value.trim().replace(/\s+/g, ' ');

  // Truncate if too long
  return cleaned.length > maxLength ? cleaned.substring(0, maxLength) : cleaned;
}

/**
 * Extracts MusicXML metadata from xml2js parsed object.
 * Used by the seed script for server-side processing.
 *
 * @param parsed - The xml2js parsed MusicXML object
 * @returns Extracted metadata
 */
export function extractMetadataFromParsedXML(parsed: unknown): MusicXMLMetadata {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj = parsed as any;
  let title = '';
  let composer = '';

  const sections = [obj?.['score-partwise'], obj?.['score-timewise']].filter(Boolean) as Record<
    string,
    unknown
  >[];
  const movementSection = sections.find(
    section => section['movement-number'] || section['movement-title']
  );

  const movementNumber = normalizeXmlText(movementSection?.['movement-number']);
  const movementTitleValue = normalizeXmlText(movementSection?.['movement-title']);

  // Extract title from various possible locations in MusicXML
  if (obj?.['score-partwise']?.['work']?.['work-title']) {
    title = obj['score-partwise']['work']['work-title'];
  } else if (obj?.['score-partwise']?.['movement-title']) {
    title = obj['score-partwise']['movement-title'];
  } else if (obj?.['score-timewise']?.['work']?.['work-title']) {
    title = obj['score-timewise']['work']['work-title'];
  } else if (obj?.['score-timewise']?.['movement-title']) {
    title = obj['score-timewise']['movement-title'];
  }

  // Extract composer from identification section
  const identification =
    obj?.['score-partwise']?.['identification'] || obj?.['score-timewise']?.['identification'];

  if (identification && typeof identification === 'object' && 'creator' in identification) {
    const creatorData = (identification as Record<string, unknown>)['creator'];
    // Handle both single creator and array of creators
    const creators = Array.isArray(creatorData) ? creatorData : [creatorData];

    const composerCreator = (creators as ParsedCreator[]).find(
      (creator: ParsedCreator) =>
        creator?.$?.type === 'composer' || creator?.['$']?.type === 'composer'
    );

    if (composerCreator && typeof composerCreator === 'string') {
      composer = composerCreator;
    } else if (composerCreator && typeof composerCreator === 'object' && composerCreator._) {
      composer = composerCreator._;
    }
  }

  // Clean and truncate metadata
  title = cleanAndTruncate(title, 200);
  composer = cleanAndTruncate(composer, 200);

  const subtitleRaw = [movementNumber, movementTitleValue].filter(Boolean).join(' ');
  const subtitleClean = cleanAndTruncate(subtitleRaw, 200);

  const metadata: MusicXMLMetadata = {
    title,
    composer,
  };

  if (subtitleClean) {
    metadata.subtitle = subtitleClean;
  }

  return metadata;
}

/**
 * Normalizes text extracted from xml2js parsing.
 */
function normalizeXmlText(value: unknown): string {
  if (!value) return '';

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'object') {
    if ('_' in value && typeof value._ === 'string') {
      return value._;
    }

    if ('#text' in value && typeof value['#text'] === 'string') {
      return value['#text'];
    }
  }

  return '';
}
