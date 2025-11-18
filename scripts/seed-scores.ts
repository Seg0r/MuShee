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
import {
  extractMetadataFromParsedXML,
  type MusicXMLMetadata,
} from '../src/utils/musicxml-metadata.js';

// Load environment variables from .env file (for local development only)
// In production (GitHub Actions), environment variables are set directly
// dotenv will NOT override existing environment variables by default
dotenvConfig({ override: false });

// =============================================================================
// Configuration
// =============================================================================

const SCORES_DIR = 'src/assets/scores';
const STORAGE_BUCKET = 'musicxml-files';
const STORAGE_PREFIX = 'public-domain';
const CLEAR_DB_FLAGS = new Set(['--clear', '--clear-db']);

function shouldClearPublicDomainData(): boolean {
  return process.argv.some(arg => CLEAR_DB_FLAGS.has(arg));
}

// =============================================================================
// Types
// =============================================================================

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

  if (!supabaseUrl) {
    throw new Error('Missing required environment variables. Please ensure SUPABASE_URL is set.');
  }

  if (!serviceRoleKey) {
    throw new Error(
      'Missing required environment variables. Please ensure SUPABASE_SERVICE_ROLE_KEY is set.'
    );
  }

  // Create client with service role key
  // The service role key bypasses RLS when no user session is active
  // IMPORTANT: Do not call auth.signIn() or set any user context - this would
  // cause RLS policies to be enforced even with the service role key
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      schema: 'public',
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
    const scoreFiles: string[] = [];

    function walkDirectory(currentDir: string, relativePath = '') {
      const entries = readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = join(currentDir, entry.name);
        const entryRelativePath = relativePath ? join(relativePath, entry.name) : entry.name;

        if (entry.isDirectory()) {
          walkDirectory(entryPath, entryRelativePath);
          continue;
        }

        if (entry.isFile() && extname(entry.name).toLowerCase() === '.mxl') {
          scoreFiles.push(entryRelativePath);
        }
      }
    }

    walkDirectory(SCORES_DIR);
    return scoreFiles;
  } catch (error) {
    throw new Error(
      `Failed to read scores directory ${SCORES_DIR}: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
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
 * Uses shared utility for consistent extraction logic with the browser service.
 */
async function parseMusicXMLMetadata(xmlContent: string): Promise<MusicXMLMetadata> {
  try {
    const parsed = await parseStringPromise(xmlContent, {
      explicitArray: false,
      ignoreAttrs: false,
      normalize: true,
      normalizeTags: false,
      trim: true,
    });

    // Use shared utility for consistent extraction logic
    return extractMetadataFromParsedXML(parsed);
  } catch (error) {
    console.warn(
      `XML parsing failed, returning empty metadata: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    return { title: '', composer: '' };
  }
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
        subtitle: metadata.subtitle ?? null,
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

async function listPublicDomainStorageFiles(supabase: SupabaseClient<Database>): Promise<string[]> {
  const files: string[] = [];
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).list(STORAGE_PREFIX, {
      limit: pageSize,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });

    if (error) {
      throw error;
    }

    if (!data?.length) {
      break;
    }

    files.push(
      ...data.map(entry =>
        entry.name.startsWith(`${STORAGE_PREFIX}/`) ? entry.name : `${STORAGE_PREFIX}/${entry.name}`
      )
    );

    if (data.length < pageSize) {
      break;
    }

    offset += data.length;
  }

  return files;
}

async function clearPublicDomainData(supabase: SupabaseClient<Database>): Promise<void> {
  try {
    console.log('🧹 Clearing public-domain songs and storage objects...');

    const { error: deleteError } = await supabase.from('songs').delete().is('uploader_id', null);

    if (deleteError) {
      throw deleteError;
    }

    const storageFiles = await listPublicDomainStorageFiles(supabase);
    if (storageFiles.length === 0) {
      console.log('   ℹ️  No storage files to remove for public-domain assets.');
      return;
    }

    const { error: removeError } = await supabase.storage.from(STORAGE_BUCKET).remove(storageFiles);
    if (removeError) {
      throw removeError;
    }

    console.log(`   🧹 Removed ${storageFiles.length} storage file(s).`);
  } catch (error) {
    console.error('Failed to clear public domain data:', error);
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
    console.log(`📄 Processing: ${fileName}`);

    // Read file content
    const fileBuffer = readFileAsArrayBuffer(filePath);

    // Calculate hash for deduplication
    const fileHash = calculateFileHash(fileBuffer);

    // Check if song already exists
    const exists = await checkSongExists(supabase, fileHash);
    if (exists) {
      console.log(`   ⚠️  Already exists, skipping`);
      return { success: true, fileName };
    }

    // Extract XML content from MXL file
    const xmlContent = await extractXMLFromMXL(fileBuffer);

    // Parse metadata
    const metadata = await parseMusicXMLMetadata(xmlContent);

    if (!metadata.title || !metadata.composer) {
      console.warn(
        `   ⚠️  Missing required metadata (title/composer) for ${fileName}, skipping. Parsed metadata: ${JSON.stringify(
          metadata
        )}`
      );
      return {
        success: false,
        fileName,
        error: 'Missing title or composer metadata',
      };
    }

    // Upload to storage and create database record
    await uploadToStorage(supabase, fileHash, fileBuffer);
    const songId = await createSongRecord(supabase, metadata, fileHash);

    const subtitleInfo = metadata.subtitle ? ` (subtitle: "${metadata.subtitle}")` : '';
    console.log(`   ✅ Seeded: "${metadata.title}" by ${metadata.composer}${subtitleInfo}`);
    return { success: true, fileName, songId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`   ❌ Failed: ${errorMessage}`);
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
    const supabase = createSupabaseClient();
    console.log('✅ Connected to Supabase');

    if (shouldClearPublicDomainData()) {
      console.log(
        '⚠️  --clear-db flag detected; clearing public-domain songs and storage before seeding.'
      );
      await clearPublicDomainData(supabase);
    }

    // Note: Storage bucket and policies should be created via SQL migrations:
    // - 20251111000000_create_storage_bucket.sql (creates the bucket)
    // - 20251111000001_add_service_role_storage_policies.sql (adds service role policies)
    // The service role key bypasses RLS, so we can proceed directly with operations
    console.log('✅ Using service role key for storage operations');

    // Get all score files
    const scoreFiles = getScoreFiles();
    console.log(`📂 Found ${scoreFiles.length} score files`);

    if (scoreFiles.length === 0) {
      console.log('⚠️  No .mxl files found in src/assets/scores/');
      process.exit(0);
    }

    console.log(''); // Add spacing before processing

    // Process each file
    const results: SeedResult[] = [];
    for (const fileName of scoreFiles) {
      const result = await processScoreFile(supabase, fileName);
      results.push(result);
    }

    // Summary
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(`\n📊 Summary: ${successful.length} successful, ${failed.length} failed`);

    if (failed.length > 0) {
      console.log('\n❌ Failed files:');
      failed.forEach(result => {
        console.log(`   • ${result.fileName}: ${result.error}`);
      });
      process.exit(1);
    }

    console.log('🎉 All scores seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Fatal error during seeding:', error);
    process.exit(1);
  }
}

// Run the script
main();
