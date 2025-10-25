import { Injectable } from '@angular/core';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import type { Database } from '../../db/database.types';
import type {
  ProfileDto,
  UpdateProfileCommand,
  PublicSongListItemDto,
  SongDetailsDto,
} from '../../types';
import type { Tables } from '../../db/database.types';

/**
 * Query parameters for retrieving public domain songs.
 * Supports pagination, sorting, and search functionality.
 */
export interface PublicSongsQueryParams {
  page?: number;
  limit?: number;
  sort?: 'title' | 'composer' | 'created_at';
  order?: 'asc' | 'desc';
  search?: string;
}

/**
 * Query parameters for retrieving user's personal library.
 * Supports pagination and sorting by library association or song metadata.
 */
export interface LibraryQueryParams {
  page?: number;
  limit?: number;
  sort?: 'title' | 'composer' | 'created_at' | 'added_at';
  order?: 'asc' | 'desc';
}

/**
 * Result of JOIN query between user_songs and songs tables.
 */
interface UserSongWithSongData {
  user_id: string;
  song_id: string;
  created_at: string;
  songs: {
    title: string | null;
    composer: string | null;
  };
}

/**
 * Service for managing Supabase client and database operations.
 * Provides centralized access to Supabase functionality with proper typing.
 */
@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  /**
   * Supabase client instance with proper Database typing.
   * Access the client through this property for all database operations.
   */
  readonly client: SupabaseClient<Database>;

  constructor() {
    // Initialize Supabase client with environment variables
    const supabaseUrl = 'YOUR_SUPABASE_URL'; // TODO: Replace with environment variable
    const supabaseKey = 'YOUR_SUPABASE_ANON_KEY'; // TODO: Replace with environment variable

    this.client = createClient<Database>(supabaseUrl, supabaseKey);
  }

  /**
   * Retrieves a user profile by user ID.
   * Returns null if profile does not exist.
   *
   * @param userId - The UUID of the user
   * @returns Promise resolving to ProfileDto or null
   */
  async getUserProfile(userId: string): Promise<ProfileDto | null> {
    try {
      console.log('Querying profiles table for user:', userId);

      const { data, error } = await this.client
        .from('profiles')
        .select('id, updated_at, has_completed_onboarding')
        .eq('id', userId)
        .single();

      if (error) {
        // Profile not found returns null, other errors should be handled by caller
        if (error.code === 'PGRST116') {
          console.log('Profile not found for user:', userId);
          return null;
        }

        console.error('Database error retrieving profile for user:', userId, error);
        throw error;
      }

      console.log('Profile retrieved successfully for user:', userId);
      return data as ProfileDto;
    } catch (error) {
      console.error('Unexpected error in getUserProfile:', error);
      throw error;
    }
  }

  /**
   * Creates a new user profile with default values.
   *
   * @param userId - The UUID of the user
   * @returns Promise resolving to the created ProfileDto
   */
  async createUserProfile(userId: string): Promise<ProfileDto> {
    try {
      console.log('Creating new profile for user:', userId);

      const { data, error } = await this.client
        .from('profiles')
        .insert({
          id: userId,
          has_completed_onboarding: false,
        })
        .select('id, updated_at, has_completed_onboarding')
        .single();

      if (error) {
        console.error('Database error creating profile for user:', userId, error);
        throw error;
      }

      console.log('Profile created successfully for user:', userId);
      return data as ProfileDto;
    } catch (error) {
      console.error('Unexpected error in createUserProfile:', error);
      throw error;
    }
  }

  /**
   * Updates an existing user profile with the provided changes.
   * Performs atomic update and returns the updated profile data.
   *
   * @param userId - The UUID of the user whose profile to update
   * @param updates - The profile fields to update
   * @returns Promise resolving to the updated ProfileDto
   * @throws Error if profile doesn't exist or update fails
   */
  async updateUserProfile(userId: string, updates: UpdateProfileCommand): Promise<ProfileDto> {
    try {
      console.log('Updating profile for user:', userId, 'with updates:', updates);

      const { data, error } = await this.client
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select('id, updated_at, has_completed_onboarding')
        .single();

      if (error) {
        // Handle specific error cases
        if (error.code === 'PGRST116') {
          console.error('Profile not found for update, user:', userId);
          throw new Error('Profile not found');
        }

        console.error('Database error updating profile for user:', userId, error);
        throw error;
      }

      console.log('Profile updated successfully for user:', userId);
      return data as ProfileDto;
    } catch (error) {
      console.error('Unexpected error in updateUserProfile:', error);
      throw error;
    }
  }

  /**
   * Retrieves paginated list of public domain songs with optional filtering and sorting.
   * Public domain songs are identified by having null uploader_id.
   *
   * @param params - Query parameters for pagination, sorting, and search
   * @returns Promise resolving to object containing song data array and total count
   */
  async getPublicSongs(
    params: PublicSongsQueryParams
  ): Promise<{ data: PublicSongListItemDto[]; total: number }> {
    try {
      console.log('Querying public domain songs with params:', params);

      // Build the base query for public domain songs (uploader_id IS NULL)
      let query = this.client
        .from('songs')
        .select('id, title, composer, created_at', { count: 'exact' })
        .is('uploader_id', null);

      // Apply search filter if provided
      if (params.search) {
        query = query.or(`title.ilike.%${params.search}%,composer.ilike.%${params.search}%`);
      }

      // Apply sorting
      const sortField = params.sort || 'title';
      const sortOrder = params.order === 'desc' ? false : true; // Supabase uses boolean for ascending
      query = query.order(sortField, { ascending: sortOrder });

      // Apply pagination
      const page = Math.max(1, params.page || 1);
      const limit = Math.min(100, Math.max(1, params.limit || 50));
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        console.error('Database error retrieving public songs:', error);
        throw error;
      }

      console.log(`Retrieved ${data?.length || 0} public songs (total: ${count})`);
      return {
        data: (data || []).map(song => ({
          id: song.id,
          created_at: song.created_at,
          song_details: {
            title: song.title || '',
            composer: song.composer || '',
          },
        })),
        total: count || 0,
      };
    } catch (error) {
      console.error('Unexpected error in getPublicSongs:', error);
      throw error;
    }
  }

  /**
   * Retrieves a song with access control verification.
   * First checks if song exists, then verifies user has permission to access it.
   * User has access if they own the song (in user_songs table) or if it's public domain (uploader_id IS NULL).
   *
   * @param songId - UUID of the song to retrieve
   * @param userId - UUID of the authenticated user
   * @returns Promise resolving to song data with access flag, or null if song doesn't exist or access denied
   */
  async getSongWithAccessCheck(
    songId: string,
    userId: string
  ): Promise<(Tables<'songs'> & { hasAccess: boolean }) | null> {
    try {
      console.log('Querying song with access check:', { songId, userId });

      // First, retrieve the song to check if it exists
      const { data: song, error: songError } = await this.client
        .from('songs')
        .select('id, title, composer, file_hash, uploader_id, created_at')
        .eq('id', songId)
        .single();

      if (songError) {
        if (songError.code === 'PGRST116') {
          console.log('Song not found:', songId);
          return null;
        }
        console.error('Database error retrieving song:', { songId }, songError);
        throw songError;
      }

      // Check if user has access to this song
      let hasAccess = false;

      // If song is public domain (uploader_id IS NULL), anyone can access it
      if (song.uploader_id === null) {
        hasAccess = true;
      } else {
        // Check if user has this song in their library
        const { error: userSongError } = await this.client
          .from('user_songs')
          .select('user_id')
          .eq('song_id', songId)
          .eq('user_id', userId)
          .single();

        if (userSongError) {
          // If not found, user doesn't have access
          if (userSongError.code === 'PGRST116') {
            hasAccess = false;
          } else {
            console.error(
              'Database error checking user song access:',
              { songId, userId },
              userSongError
            );
            throw userSongError;
          }
        } else {
          // User has this song in their library
          hasAccess = true;
        }
      }

      if (!hasAccess) {
        console.log('Access denied for song:', { songId, userId });
        return null;
      }

      console.log('Song retrieved successfully with access granted:', { songId, userId });
      return {
        ...song,
        hasAccess: true,
      };
    } catch (error) {
      console.error('Unexpected error in getSongWithAccessCheck:', error);
      throw error;
    }
  }

  /**
   * Generates a signed URL for secure access to a MusicXML file in Supabase Storage.
   * Uses the file hash as filename with .musicxml extension.
   * Signed URLs expire after 1 hour for security.
   *
   * @param fileHash - SHA-256 hash of the MusicXML file (used as filename)
   * @returns Promise resolving to signed URL string
   */
  async generateMusicXMLSignedUrl(fileHash: string): Promise<string> {
    try {
      console.log('Generating signed URL for MusicXML file:', fileHash);

      const fileName = `${fileHash}.musicxml`;

      const { data, error } = await this.client.storage
        .from('musicxml-files') // Assuming this is the bucket name
        .createSignedUrl(fileName, 3600, {
          // 1 hour expiration
          download: fileName,
        });

      if (error) {
        console.error('Storage error generating signed URL:', { fileHash }, error);
        throw error;
      }

      if (!data?.signedUrl) {
        console.error('No signed URL returned from storage:', { fileHash });
        throw new Error('Failed to generate signed URL');
      }

      console.log('Signed URL generated successfully for file:', fileHash);
      return data.signedUrl;
    } catch (error) {
      console.error('Unexpected error in generateMusicXMLSignedUrl:', error);
      throw error;
    }
  }

  /**
   * Checks if a song is accessible by a user for adding to their library.
   * Song is accessible if it exists and is either public domain (uploader_id IS NULL)
   * or the user already has it in their library.
   *
   * @param songId - UUID of the song to check
   * @param userId - UUID of the authenticated user
   * @returns Promise resolving to true if song exists and is accessible, false otherwise
   */
  async checkSongAccessible(songId: string, userId: string): Promise<boolean> {
    try {
      console.log('Checking song accessibility:', { songId, userId });

      const songWithAccess = await this.getSongWithAccessCheck(songId, userId);

      const isAccessible = songWithAccess !== null;
      console.log('Song accessibility check result:', { songId, userId, isAccessible });

      return isAccessible;
    } catch (error) {
      console.error('Unexpected error in checkSongAccessible:', error);
      throw error;
    }
  }

  /**
   * Adds a song to a user's personal library by creating a user_songs association.
   * Assumes the song exists and user has access (should be checked before calling).
   *
   * @param userId - UUID of the authenticated user
   * @param songId - UUID of the song to add to library
   * @returns Promise resolving to the created user-song association record
   */
  async addSongToUserLibrary(userId: string, songId: string): Promise<Tables<'user_songs'>> {
    try {
      console.log('Adding song to user library:', { userId, songId });

      const { data, error } = await this.client
        .from('user_songs')
        .insert({
          user_id: userId,
          song_id: songId,
        })
        .select('user_id, song_id, created_at')
        .single();

      if (error) {
        console.error('Database error adding song to library:', { userId, songId }, error);
        throw error;
      }

      console.log('Song added to user library successfully:', { userId, songId });
      return data;
    } catch (error) {
      console.error('Unexpected error in addSongToUserLibrary:', error);
      throw error;
    }
  }

  /**
   * Checks if a song is already in a user's library to prevent duplicates.
   *
   * @param songId - UUID of the song to check
   * @param userId - UUID of the authenticated user
   * @returns Promise resolving to true if song is already in library, false otherwise
   */
  async isSongInUserLibrary(songId: string, userId: string): Promise<boolean> {
    try {
      console.log('Checking if song is already in user library:', { songId, userId });

      const { error } = await this.client
        .from('user_songs')
        .select('user_id')
        .eq('song_id', songId)
        .eq('user_id', userId)
        .single();

      if (error) {
        // If not found, song is not in library
        if (error.code === 'PGRST116') {
          console.log('Song not found in user library:', { songId, userId });
          return false;
        }
        // Other database errors should be thrown
        console.error('Database error checking song in library:', { songId, userId }, error);
        throw error;
      }

      // Song found in library
      console.log('Song already exists in user library:', { songId, userId });
      return true;
    } catch (error) {
      console.error('Unexpected error in isSongInUserLibrary:', error);
      throw error;
    }
  }

  /**
   * Retrieves song details (title and composer) by song ID.
   * Used for enriching responses with song metadata.
   *
   * @param songId - UUID of the song to retrieve details for
   * @returns Promise resolving to song details or null if song doesn't exist
   */
  async getSongDetails(songId: string): Promise<{ title: string; composer: string } | null> {
    try {
      console.log('Retrieving song details for:', songId);

      const { data, error } = await this.client
        .from('songs')
        .select('title, composer')
        .eq('id', songId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('Song not found for details:', songId);
          return null;
        }
        console.error('Database error retrieving song details:', { songId }, error);
        throw error;
      }

      console.log('Song details retrieved successfully for:', songId);
      return {
        title: data.title || '',
        composer: data.composer || '',
      };
    } catch (error) {
      console.error('Unexpected error in getSongDetails:', error);
      throw error;
    }
  }

  /**
   * Retrieves a user's personal song library with song metadata.
   * Performs a JOIN query between user_songs and songs tables with sorting and pagination.
   *
   * @param userId - UUID of the authenticated user
   * @param params - Query parameters for sorting and pagination
   * @returns Promise resolving to object containing library data array and total count
   */
  async getUserLibrary(
    userId: string,
    params: LibraryQueryParams
  ): Promise<{ data: (Tables<'user_songs'> & { song_details: SongDetailsDto })[]; total: number }> {
    try {
      console.log('Querying user library with params:', { userId, params });

      // Build the JOIN query between user_songs and songs
      let query = this.client
        .from('user_songs')
        .select(
          `
          user_id,
          song_id,
          created_at,
          songs!inner (
            title,
            composer
          )
        `,
          { count: 'exact' }
        )
        .eq('user_id', userId);

      // Apply sorting
      const sortField = params.sort || 'created_at';
      const sortOrder = params.order === 'desc' ? false : true; // Supabase uses boolean for ascending

      // Handle sorting by song metadata fields vs user_songs fields
      if (sortField === 'title' || sortField === 'composer') {
        query = query.order(`songs.${sortField}`, { ascending: sortOrder });
      } else if (sortField === 'added_at') {
        // Map 'added_at' to the created_at field in user_songs
        query = query.order('created_at', { ascending: sortOrder });
      } else {
        // Default to created_at for any other sort field
        query = query.order('created_at', { ascending: sortOrder });
      }

      // Apply pagination
      const page = Math.max(1, params.page || 1);
      const limit = Math.min(100, Math.max(1, params.limit || 50));
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        console.error('Database error retrieving user library:', { userId, params }, error);
        throw error;
      }

      // Transform the data to match expected format
      const transformedData = ((data as UserSongWithSongData[]) || []).map(item => ({
        user_id: item.user_id,
        song_id: item.song_id,
        created_at: item.created_at,
        song_details: {
          title: item.songs?.title || '',
          composer: item.songs?.composer || '',
        },
      }));

      console.log(
        `Retrieved ${transformedData.length} library items (total: ${count}) for user:`,
        userId
      );
      return {
        data: transformedData,
        total: count || 0,
      };
    } catch (error) {
      console.error('Unexpected error in getUserLibrary:', error);
      throw error;
    }
  }

  /**
   * Removes a song from a user's personal library by deleting the user_songs association.
   * Assumes the song exists in the user's library (should be checked before calling).
   * This operation is atomic and only affects the specific user-song association.
   *
   * @param userId - UUID of the authenticated user
   * @param songId - UUID of the song to remove from library
   * @throws Error if the database operation fails
   */
  async removeSongFromUserLibrary(userId: string, songId: string): Promise<void> {
    try {
      console.log('Removing song from user library:', { userId, songId });

      const { error } = await this.client
        .from('user_songs')
        .delete()
        .eq('user_id', userId)
        .eq('song_id', songId);

      if (error) {
        console.error('Database error removing song from library:', { userId, songId }, error);
        throw error;
      }

      console.log('Song removed from user library successfully:', { userId, songId });
    } catch (error) {
      console.error('Unexpected error in removeSongFromUserLibrary:', error);
      throw error;
    }
  }
}
