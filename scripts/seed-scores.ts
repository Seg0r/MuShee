#!/usr/bin/env tsx

/**
 * Seed script for preloading public domain MusicXML scores into the database.
 *
 * This script:
 * 1. Reads MXL files from src/assets/scores/
 * 2. Parses MusicXML metadata (composer, title) using xml2js
 * 3. Calculates MD5 hash for deduplication
 * 4. Uploads files to Supabase Storage (/public-domain/{hash}.mxl)
 * 5. Creates database records with uploader_id = NULL (public domain)
 *
 * Usage: npm run seed:scores
 *
 * Environment Variables Required:
 * - SUPABASE_URL: Supabase project URL
 * - SUPABASE_ANON_KEY: Supabase anonymous key
 * - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key (for admin operations)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { parseStringPromise } from 'xml2js';
import { createHash } from 'crypto';
import { readFileSync, readdirSync } from 'fs';
import { join, extname } from 'path';
import { Readable } from 'stream';
import { config as dotenvConfig } from 'dotenv';
import { Entry, fromBuffer as yauzlFromBuffer, ZipFile } from 'yauzl';
import type { Database } from '../src/db/database.types.js';

// Load environment variables from .env file
dotenvConfig();

// Type for xml2js parsed creator element
interface ParsedCreator {
  $?: { type?: string };
  _: string;
}

// =============================================================================
// Configuration
// =============================================================================

const SCORES_DIR = 'src/assets/scores';
const STORAGE_BUCKET = 'musicxml-files';
const STORAGE_PREFIX = 'public-domain';

// =============================================================================
// Types
// =============================================================================

interface MusicXMLMetadata {
  title: string;
  composer: string;
}

interface SeedResult {
  success: boolean;
  fileName: string;
  songId?: string;
  error?: string;
}

// =============================================================================
// Supabase Client Setup
// =============================================================================

/**
 * Creates a Supabase client with service role key for admin operations.
 * This allows bypassing RLS policies during seeding.
 */
function createSupabaseClient(): SupabaseClient<Database> {
  const supabaseUrl = process.env['SUPABASE_URL'];
  const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing required environment variables. Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.'
    );
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// =============================================================================
// File Processing
// =============================================================================

/**
 * Gets all .mxl files from the scores directory.
 */
function getScoreFiles(): string[] {
  try {
    const files = readdirSync(SCORES_DIR);
    return files.filter(file => extname(file).toLowerCase() === '.mxl');
  } catch (error) {
    throw new Error(
      `Failed to read scores directory: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Reads a file and returns its content as ArrayBuffer.
 */
function readFileAsArrayBuffer(filePath: string): ArrayBuffer {
  try {
    const buffer = readFileSync(filePath);
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  } catch (error) {
    throw new Error(
      `Failed to read file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Calculates MD5 hash of file content for deduplication.
 */
function calculateFileHash(fileBuffer: ArrayBuffer): string {
  const hash = createHash('md5');
  const uint8Array = new Uint8Array(fileBuffer);
  hash.update(uint8Array);
  return hash.digest('hex');
}

/**
 * Extracts XML content from MXL (compressed MusicXML) files.
 * MXL files are ZIP archives containing score.xml and META-INF/container.xml.
 */
async function extractXMLFromMXL(mxlBuffer: ArrayBuffer): Promise<string> {
  return new Promise((resolve, reject) => {
    yauzlFromBuffer(
      Buffer.from(mxlBuffer),
      { lazyEntries: true },
      (err: Error | null, zipfile: ZipFile) => {
        if (err) {
          reject(new Error(`Failed to open MXL file: ${err.message}`));
          return;
        }

        if (!zipfile) {
          reject(new Error('Failed to open MXL file: zipfile is null'));
          return;
        }

        let scoreXmlContent = '';

        zipfile.readEntry();
        zipfile.on('entry', (entry: Entry) => {
          if (entry.fileName === 'score.xml') {
            zipfile.openReadStream(entry, (err: Error | null, readStream: Readable) => {
              if (err) {
                reject(new Error(`Failed to read score.xml: ${err.message}`));
                return;
              }

              if (!readStream) {
                reject(new Error('Failed to open read stream for score.xml'));
                return;
              }

              const chunks: Buffer[] = [];
              readStream.on('data', (chunk: Buffer) => {
                chunks.push(chunk);
              });

              readStream.on('end', () => {
                scoreXmlContent = Buffer.concat(chunks).toString('utf8');
                zipfile.readEntry(); // Continue to next entry
              });

              readStream.on('error', (err: Error) => {
                reject(new Error(`Error reading score.xml: ${err.message}`));
              });
            });
          } else {
            zipfile.readEntry(); // Skip other entries
          }
        });

        zipfile.on('end', () => {
          if (scoreXmlContent) {
            resolve(scoreXmlContent);
          } else {
            reject(new Error('score.xml not found in MXL file'));
          }
        });

        zipfile.on('error', (err: Error) => {
          reject(new Error(`ZIP file error: ${err.message}`));
        });
      }
    );
  });
}

/**
 * Parses MusicXML content to extract metadata (title and composer).
 * Uses xml2js for direct XML parsing without requiring DOM or rendering.
 */
async function parseMusicXMLMetadata(xmlContent: string): Promise<MusicXMLMetadata> {
  try {
    const parsed = await parseStringPromise(xmlContent, {
      explicitArray: false,
      ignoreAttrs: true,
      normalize: true,
      normalizeTags: false,
      trim: true,
    });

    let title = '';
    let composer = '';

    // Extract title from various possible locations in MusicXML
    if (parsed?.['score-partwise']?.['work']?.['work-title']) {
      title = parsed['score-partwise']['work']['work-title'];
    } else if (parsed?.['score-partwise']?.['movement-title']) {
      title = parsed['score-partwise']['movement-title'];
    } else if (parsed?.['score-timewise']?.['work']?.['work-title']) {
      title = parsed['score-timewise']['work']['work-title'];
    } else if (parsed?.['score-timewise']?.['movement-title']) {
      title = parsed['score-timewise']['movement-title'];
    }

    // Extract composer from identification section
    const identification =
      parsed?.['score-partwise']?.['identification'] ||
      parsed?.['score-timewise']?.['identification'];

    if (identification?.['creator']) {
      // Handle both single creator and array of creators
      const creators = Array.isArray(identification.creator)
        ? identification.creator
        : [identification.creator];

      const composerCreator = creators.find(
        (creator: ParsedCreator) =>
          creator?.$?.type === 'composer' || creator?.['$']?.type === 'composer'
      );

      if (composerCreator && typeof composerCreator === 'string') {
        composer = composerCreator;
      } else if (composerCreator && typeof composerCreator === 'object' && composerCreator._) {
        composer = composerCreator._;
      }
    }

    // Clean and truncate metadata (following database constraints)
    title = cleanAndTruncate(title, 200);
    composer = cleanAndTruncate(composer, 200);

    return { title, composer };
  } catch (error) {
    console.warn(
      `XML parsing failed, returning empty metadata: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    return { title: '', composer: '' };
  }
}

/**
 * Cleans and truncates a string value for metadata storage.
 */
function cleanAndTruncate(value: string, maxLength: number): string {
  if (!value) return '';

  // Trim whitespace and normalize internal spaces
  const cleaned = value.trim().replace(/\s+/g, ' ');

  // Truncate if too long
  return cleaned.length > maxLength ? cleaned.substring(0, maxLength) : cleaned;
}

// =============================================================================
// Database Operations
// =============================================================================

/**
 * Checks if a song with the given hash already exists in the database.
 */
async function checkSongExists(
  supabase: SupabaseClient<Database>,
  fileHash: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('songs')
      .select('id')
      .eq('file_hash', fileHash)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return !!data;
  } catch (error) {
    console.error(`Error checking if song exists for hash ${fileHash}:`, error);
    throw error;
  }
}

/**
 * Creates a new song record in the database.
 */
async function createSongRecord(
  supabase: SupabaseClient<Database>,
  metadata: MusicXMLMetadata,
  fileHash: string
): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('songs')
      .insert({
        title: metadata.title,
        composer: metadata.composer,
        file_hash: fileHash,
        uploader_id: null, // Public domain
      })
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    return data.id;
  } catch (error) {
    console.error('Error creating song record:', error);
    throw error;
  }
}

/**
 * Uploads a file to Supabase Storage.
 */
async function uploadToStorage(
  supabase: SupabaseClient<Database>,
  fileHash: string,
  fileBuffer: ArrayBuffer
): Promise<void> {
  try {
    const fileName = `${STORAGE_PREFIX}/${fileHash}.mxl`;
    const file = new File([fileBuffer], fileName, { type: 'application/vnd.recordare.musicxml' });

    const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(fileName, file, {
      contentType: 'application/vnd.recordare.musicxml',
      upsert: false, // Don't overwrite existing files
    });

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error(`Error uploading file ${fileHash} to storage:`, error);
    throw error;
  }
}

// =============================================================================
// Main Processing
// =============================================================================

/**
 * Processes a single score file: parse, hash, check duplicates, upload, and create record.
 */
async function processScoreFile(
  supabase: SupabaseClient<Database>,
  fileName: string
): Promise<SeedResult> {
  const filePath = join(SCORES_DIR, fileName);

  try {
    console.log(`\n📄 Processing: ${fileName}`);

    // Read file content
    const fileBuffer = readFileAsArrayBuffer(filePath);

    // Calculate hash for deduplication
    const fileHash = calculateFileHash(fileBuffer);
    console.log(`   Hash: ${fileHash}`);

    // Check if song already exists
    const exists = await checkSongExists(supabase, fileHash);
    if (exists) {
      console.log(`   ⚠️  Skipping: Song already exists in database`);
      return { success: true, fileName }; // Not an error, just already seeded
    }

    // Extract XML content from MXL file
    console.log(`   📦 Extracting XML from MXL file...`);
    const xmlContent = await extractXMLFromMXL(fileBuffer);

    // Parse metadata
    const metadata = await parseMusicXMLMetadata(xmlContent);
    console.log(`   Title: "${metadata.title}"`);
    console.log(`   Composer: "${metadata.composer}"`);

    // Upload to storage
    console.log(`   📤 Uploading to storage...`);
    await uploadToStorage(supabase, fileHash, fileBuffer);

    // Create database record
    console.log(`   💾 Creating database record...`);
    const songId = await createSongRecord(supabase, metadata, fileHash);

    console.log(`   ✅ Successfully seeded: ${songId}`);
    return { success: true, fileName, songId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`   ❌ Failed to process ${fileName}: ${errorMessage}`);
    return { success: false, fileName, error: errorMessage };
  }
}

// =============================================================================
// Main Execution
// =============================================================================

async function main() {
  console.log('🎵 MuShee Public Domain Scores Seeding Script');
  console.log('==============================================\n');

  try {
    // Initialize Supabase client
    console.log('🔗 Connecting to Supabase...');
    const supabase = createSupabaseClient();
    console.log('✅ Connected successfully\n');

    // Ensure storage bucket exists
    console.log('📦 Checking/creating storage bucket...');
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      const bucketExists = buckets?.some(bucket => bucket.name === STORAGE_BUCKET);

      if (!bucketExists) {
        console.log(`   Creating bucket '${STORAGE_BUCKET}'...`);
        const { error: createError } = await supabase.storage.createBucket(STORAGE_BUCKET, {
          public: true,
          allowedMimeTypes: ['application/vnd.recordare.musicxml'],
          fileSizeLimit: 52428800, // 50MB
        });

        if (createError) {
          throw new Error(`Failed to create bucket: ${createError.message}`);
        }
        console.log('   ✅ Bucket created successfully');
      } else {
        console.log('   ✅ Bucket already exists');
      }
    } catch (error) {
      console.error('   ❌ Failed to check/create bucket:', error);
      throw error;
    }
    console.log('');

    // Get all score files
    const scoreFiles = getScoreFiles();
    console.log(`📂 Found ${scoreFiles.length} score files in ${SCORES_DIR}/`);
    console.log(`   Files: ${scoreFiles.join(', ')}\n`);

    if (scoreFiles.length === 0) {
      console.log('⚠️  No .mxl files found. Please add score files to src/assets/scores/');
      process.exit(0);
    }

    // Process each file
    const results: SeedResult[] = [];
    for (const fileName of scoreFiles) {
      const result = await processScoreFile(supabase, fileName);
      results.push(result);
    }

    // Summary
    console.log('\n==============================================');
    console.log('📊 Seeding Summary');

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(`✅ Successful: ${successful.length}`);
    console.log(`❌ Failed: ${failed.length}`);

    if (successful.length > 0) {
      console.log('\n🎵 Successfully seeded songs:');
      successful.forEach(result => {
        if (result.songId) {
          console.log(`   • ${result.fileName} → ${result.songId}`);
        }
      });
    }

    if (failed.length > 0) {
      console.log('\n❌ Failed to seed:');
      failed.forEach(result => {
        console.log(`   • ${result.fileName}: ${result.error}`);
      });
    }

    // Exit with appropriate code
    if (failed.length > 0) {
      console.log('\n⚠️  Seeding completed with errors. Check the output above.');
      process.exit(1);
    } else {
      console.log('\n🎉 All scores seeded successfully!');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n💥 Fatal error during seeding:', error);
    process.exit(1);
  }
}

// Run the script
main();
