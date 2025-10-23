import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import type { Database, Tables, TablesInsert } from '../../db/database.types';

// Type aliases for better readability
type SongRow = Tables<'songs'>;
type UserSongRow = Tables<'user_songs'>;
type SongInsert = TablesInsert<'songs'>;
type UserSongInsert = TablesInsert<'user_songs'>;

/**
 * DTO for creating a new song record.
 */
export interface CreateSongDto {
  title: string;
  composer: string;
  file_hash: string;
  uploader_id: string;
}

/**
 * DTO for adding a song to user's library.
 */
export interface AddSongToLibraryDto {
  user_id: string;
  song_id: string;
}

// Load environment variables
config();

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private supabase: SupabaseClient<Database>;

  constructor() {
    const supabaseUrl = process.env['SUPABASE_URL'];
    const supabaseAnonKey = process.env['SUPABASE_KEY'];

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables. Please check your .env file.');
    }

    this.supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
  }

  get client(): SupabaseClient<Database> {
    return this.supabase;
  }

  // ============================================================================
  // Storage Methods
  // ============================================================================

  /**
   * Uploads a MusicXML file to Supabase Storage.
   * Uses the MD5 hash as filename for deterministic storage.
   *
   * @param hash - MD5 hash of the file content (used as filename)
   * @param fileBuffer - The file content as ArrayBuffer
   * @throws Error if upload fails
   */
  async uploadMusicXMLFile(hash: string, fileBuffer: ArrayBuffer): Promise<void> {
    const fileName = `${hash}.musicxml`;
    const file = new File([fileBuffer], fileName, { type: 'application/xml' });

    const { error } = await this.supabase.storage.from('musicxml-files').upload(fileName, file, {
      contentType: 'application/xml',
      upsert: false, // Don't overwrite existing files
    });

    if (error) {
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  /**
   * Checks if a MusicXML file exists in Supabase Storage.
   *
   * @param hash - MD5 hash of the file content (used as filename)
   * @returns true if file exists, false otherwise
   */
  async checkFileExists(hash: string): Promise<boolean> {
    const fileName = `${hash}.musicxml`;

    const { data, error } = await this.supabase.storage.from('musicxml-files').list('', {
      search: fileName,
    });

    if (error) {
      // If there's an error checking, assume file doesn't exist for safety
      return false;
    }

    return data?.some(file => file.name === fileName) ?? false;
  }

  // ============================================================================
  // Song Management Methods
  // ============================================================================

  /**
   * Finds a song by its MD5 file hash.
   * Performs a LEFT JOIN to check if the song exists and if the user already has it.
   *
   * @param hash - MD5 hash of the file content
   * @returns Song data with user association info, or null if not found
   */
  async findSongByHash(hash: string): Promise<{
    song: SongRow | null;
    userHasSong: boolean;
  }> {
    const { data, error } = await this.supabase
      .from('songs')
      .select('id, title, composer, file_hash, created_at, uploader_id')
      .eq('file_hash', hash)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      throw new Error(`Failed to query song by hash: ${error.message}`);
    }

    return {
      song: data,
      userHasSong: false, // This will be checked separately with user context
    };
  }

  /**
   * Creates a new song record in the database.
   *
   * @param data - Song creation data
   * @returns The created song record
   * @throws Error if creation fails
   */
  async createSong(data: CreateSongDto): Promise<SongRow> {
    const songData: SongInsert = {
      title: data.title,
      composer: data.composer,
      file_hash: data.file_hash,
      uploader_id: data.uploader_id,
    };

    const { data: song, error } = await this.supabase
      .from('songs')
      .insert(songData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create song: ${error.message}`);
    }

    return song;
  }

  /**
   * Adds a song to a user's personal library.
   *
   * @param userId - The user's ID
   * @param songId - The song's ID
   * @returns The created user-song association record
   * @throws Error if addition fails
   */
  async addSongToUserLibrary(userId: string, songId: string): Promise<UserSongRow> {
    const userSongData: UserSongInsert = {
      user_id: userId,
      song_id: songId,
    };

    const { data: userSong, error } = await this.supabase
      .from('user_songs')
      .insert(userSongData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to add song to library: ${error.message}`);
    }

    return userSong;
  }

  /**
   * Checks if a song is already in a user's library.
   *
   * @param userId - The user's ID
   * @param songId - The song's ID
   * @returns true if the song is in the user's library
   */
  async checkSongInUserLibrary(userId: string, songId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('user_songs')
      .select('user_id')
      .eq('user_id', userId)
      .eq('song_id', songId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      throw new Error(`Failed to check song in library: ${error.message}`);
    }

    return !!data;
  }

  /**
   * Performs the complex duplicate detection query as specified in the implementation plan.
   * Uses LEFT JOIN to check both song existence and user library association in one query.
   *
   * @param hash - MD5 hash of the file content
   * @param userId - The user's ID
   * @returns Query result with song existence and library status
   */
  async checkSongDuplicateStatus(
    hash: string,
    userId: string
  ): Promise<{
    song: SongRow | null;
    userHasSong: boolean;
  }> {
    // Perform LEFT JOIN query as specified in the implementation plan
    const { data, error } = await this.supabase
      .from('songs')
      .select(
        `
        id,
        title,
        composer,
        file_hash,
        created_at,
        uploader_id,
        user_songs!left(user_id)
      `
      )
      .eq('file_hash', hash)
      .eq('user_songs.user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      throw new Error(`Failed to check song duplicate status: ${error.message}`);
    }

    if (!data) {
      // Song doesn't exist at all
      return { song: null, userHasSong: false };
    }

    // Check if user has this song in their library
    const userHasSong = Array.isArray(data.user_songs) && data.user_songs.length > 0;

    // Remove the user_songs relation from the returned song object
    const song = { ...data };
    delete (song as { user_songs?: unknown }).user_songs;

    return {
      song: song as SongRow,
      userHasSong,
    };
  }
}
