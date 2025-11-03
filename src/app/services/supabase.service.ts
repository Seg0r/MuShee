import { Injectable } from '@angular/core';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import type { Database, Json } from '../../db/database.types';
import { environment } from '../../environments/environment';
import type {
  ProfileDto,
  UpdateProfileCommand,
  PublicSongListItemDto,
  SongDetailsDto,
  SongReferenceDto,
  AiSuggestionItemDto,
  SubmitRenderingFeedbackCommand,
  AiSuggestionFeedbackSuggestionDto,
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
 * Data transfer object for creating a new song record.
 */
interface CreateSongDto {
  title: string;
  composer: string;
  file_hash: string;
  uploader_id: string;
}

/**
 * Data transfer object for creating AI suggestion feedback records.
 */
interface CreateAiFeedbackDto {
  user_id: string;
  input_songs: SongReferenceDto[];
  suggestions: AiSuggestionItemDto[];
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
    const supabaseUrl = environment.supabase.url;
    const supabaseKey = environment.supabase.anonKey;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        'Missing Supabase environment variables. Please check your environment configuration.'
      );
    }

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
        const { data: userSongData, error: userSongError } = await this.client
          .from('user_songs')
          .select('user_id')
          .eq('song_id', songId)
          .eq('user_id', userId)
          .maybeSingle();

        if (userSongError) {
          console.error(
            'Database error checking user song access:',
            { songId, userId },
            userSongError
          );
          throw userSongError;
        }

        if (userSongData === null) {
          // User doesn't have access
          hasAccess = false;
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
   * Generates the appropriate URL for accessing a MusicXML file based on ownership status.
   * For public domain songs (uploader_id IS NULL), uses a direct public URL.
   * For private songs (user-uploaded), generates a temporary signed URL for secure access.
   *
   * @param fileHash - Hash of the MusicXML file (used as filename)
   * @param isPublic - Whether the song is from the public domain (uploader_id IS NULL)
   * @returns Promise resolving to the appropriate URL (public or signed)
   */
  async generateMusicXMLUrl(fileHash: string, isPublic: boolean): Promise<string> {
    try {
      console.log('Generating MusicXML URL:', { fileHash, isPublic });

      const fileName = `public-domain/${fileHash}.mxl`;

      // For public domain songs, use direct public URL without signing attempt
      if (isPublic) {
        const { data: publicData } = this.client.storage
          .from('musicxml-files')
          .getPublicUrl(fileName);

        if (publicData?.publicUrl) {
          console.log('Public URL generated for file:', fileHash);
          return publicData.publicUrl;
        }

        // Fallback: construct the URL manually
        const supabaseUrl = environment.supabase.url;
        const publicUrl = `${supabaseUrl}/storage/v1/object/public/musicxml-files/${fileName}`;
        console.log('Using constructed public URL:', publicUrl);
        return publicUrl;
      }

      // For private songs, generate a signed URL with time-limited access
      console.log('Generating signed URL for private file:', fileHash);
      const { data, error } = await this.client.storage
        .from('musicxml-files')
        .createSignedUrl(fileName, 3600); // 1 hour expiration

      if (!error && data?.signedUrl) {
        console.log('Signed URL generated successfully for file:', fileHash);
        return data.signedUrl;
      }

      // Fallback: if signed URL creation fails, construct public URL
      console.log('Signed URL generation failed, falling back to public URL for file:', fileHash);
      const supabaseUrl = environment.supabase.url;
      const publicUrl = `${supabaseUrl}/storage/v1/object/public/musicxml-files/${fileName}`;
      return publicUrl;
    } catch (error) {
      console.error('Unexpected error in generateMusicXMLUrl:', error);
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

      const { data, error } = await this.client
        .from('user_songs')
        .select('user_id')
        .eq('song_id', songId)
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Database error checking song in library:', { songId, userId }, error);
        throw error;
      }

      // If data is null, song is not in library
      if (data === null) {
        console.log('Song not found in user library:', { songId, userId });
        return false;
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

  // =============================================================================
  // MusicXML Upload Support Methods
  // =============================================================================

  /**
   * Uploads a MusicXML file to Supabase Storage using the file hash as filename.
   * Files are stored in the 'musicxml-files' bucket with .musicxml extension.
   *
   * @param hash - MD5 hash of the file content (used as filename)
   * @param fileBuffer - The file content as ArrayBuffer
   * @throws Error if upload fails
   */
  async uploadMusicXMLFile(hash: string, fileBuffer: ArrayBuffer): Promise<void> {
    try {
      console.log('Uploading MusicXML file to storage:', hash);

      const fileName = `${hash}.musicxml`;
      const file = new File([fileBuffer], fileName, { type: 'application/xml' });

      const { error } = await this.client.storage.from('musicxml-files').upload(fileName, file, {
        contentType: 'application/xml',
        upsert: false, // Don't overwrite existing files
      });

      if (error) {
        console.error('Storage upload error:', { hash }, error);
        throw error;
      }

      console.log('MusicXML file uploaded successfully:', hash);
    } catch (error) {
      console.error('Unexpected error in uploadMusicXMLFile:', error);
      throw error;
    }
  }

  /**
   * Checks if a MusicXML file exists in Supabase Storage.
   * Used to verify file existence before database operations.
   *
   * @param hash - MD5 hash of the file content (used as filename)
   * @returns Promise resolving to true if file exists, false otherwise
   */
  async checkMusicXMLFileExists(hash: string): Promise<boolean> {
    try {
      console.log('Checking if MusicXML file exists in storage:', hash);

      const fileName = `${hash}.musicxml`;

      const { data, error } = await this.client.storage.from('musicxml-files').list('', {
        limit: 1,
        search: fileName,
      });

      if (error) {
        console.error('Storage check error:', { hash }, error);
        // If we can't check, assume file doesn't exist for safety
        return false;
      }

      const exists = data && data.length > 0 && data[0].name === fileName;
      console.log('MusicXML file existence check:', { hash, exists });

      return exists;
    } catch (error) {
      console.error('Unexpected error in checkMusicXMLFileExists:', error);
      // If we can't check, assume file doesn't exist for safety
      return false;
    }
  }

  /**
   * Finds a song by its file hash to check for duplicates.
   * Returns null if no song with the given hash exists.
   *
   * @param hash - MD5 hash of the file content
   * @returns Promise resolving to song data or null
   */
  async findSongByHash(hash: string): Promise<Tables<'songs'> | null> {
    try {
      console.log('Finding song by hash:', hash);

      const { data, error } = await this.client
        .from('songs')
        .select('id, title, composer, file_hash, uploader_id, created_at')
        .eq('file_hash', hash)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No song found with this hash
          console.log('No song found with hash:', hash);
          return null;
        }
        console.error('Database error finding song by hash:', { hash }, error);
        throw error;
      }

      console.log('Song found by hash:', { hash, songId: data.id });
      return data;
    } catch (error) {
      console.error('Unexpected error in findSongByHash:', error);
      throw error;
    }
  }

  /**
   * Creates a new song record in the database.
   * Used when uploading a new (non-duplicate) MusicXML file.
   *
   * @param data - Song creation data
   * @returns Promise resolving to the created song record
   */
  async createSong(data: CreateSongDto): Promise<Tables<'songs'>> {
    try {
      console.log('Creating new song record:', {
        title: data.title,
        composer: data.composer,
        hash: data.file_hash,
      });

      const { data: song, error } = await this.client
        .from('songs')
        .insert({
          title: data.title,
          composer: data.composer,
          file_hash: data.file_hash,
          uploader_id: data.uploader_id,
        })
        .select('id, title, composer, file_hash, uploader_id, created_at')
        .single();

      if (error) {
        console.error('Database error creating song:', error);
        throw error;
      }

      console.log('Song created successfully:', { songId: song.id, hash: data.file_hash });
      return song;
    } catch (error) {
      console.error('Unexpected error in createSong:', error);
      throw error;
    }
  }

  /**
   * Checks if a song exists in a user's library using a single optimized query.
   * Returns detailed information about the song and library association status.
   *
   * @param hash - MD5 hash of the file content
   * @param userId - UUID of the user to check
   * @returns Promise resolving to object with song data and library status
   */
  async checkSongByHashWithLibraryStatus(
    hash: string,
    userId: string
  ): Promise<{
    song: Tables<'songs'> | null;
    isInLibrary: boolean;
  }> {
    try {
      console.log('Checking song by hash with library status:', { hash, userId });

      // Single query with LEFT JOIN to check both song existence and library status
      const { data, error } = await this.client
        .from('songs')
        .select(
          `
          id,
          title,
          composer,
          file_hash,
          uploader_id,
          created_at,
          user_songs!left(
            user_id
          )
        `
        )
        .eq('file_hash', hash)
        .eq('user_songs.user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No song found with this hash for this user
          console.log('No song found with hash for user:', { hash, userId });
          return { song: null, isInLibrary: false };
        }
        console.error(
          'Database error in checkSongByHashWithLibraryStatus:',
          { hash, userId },
          error
        );
        throw error;
      }

      // Extract song data (without the joined user_songs)
      const { user_songs, ...songData } = data as Record<string, unknown>;
      const song = songData as Tables<'songs'>;

      // Check if user_songs join returned data (indicates song is in library)
      const isInLibrary = user_songs && Array.isArray(user_songs) && user_songs.length > 0;

      console.log('Song check result:', {
        hash,
        userId,
        songId: song.id,
        isInLibrary,
      });

      return { song, isInLibrary: Boolean(isInLibrary) };
    } catch (error) {
      console.error('Unexpected error in checkSongByHashWithLibraryStatus:', error);
      throw error;
    }
  }

  // =============================================================================
  // AI Suggestion Feedback Methods
  // =============================================================================

  /**
   * Creates a new AI suggestion feedback record for tracking user ratings.
   * Stores input songs, AI suggestions, and initializes rating score.
   *
   * @param data - Feedback creation data including user, input songs, and suggestions
   * @returns Promise resolving to the created feedback record
   */
  async createAiSuggestionFeedback(
    data: CreateAiFeedbackDto
  ): Promise<Tables<'ai_suggestion_feedback'>> {
    try {
      console.log('Creating AI suggestion feedback record for user:', data.user_id);

      const { data: feedback, error } = await this.client
        .from('ai_suggestion_feedback')
        .insert({
          user_id: data.user_id,
          input_songs: data.input_songs as unknown as Json,
          suggestions: data.suggestions as unknown as Json,
          rating_score: 0, // Initialize with 0, will be updated when user provides ratings
        })
        .select('id, user_id, input_songs, suggestions, rating_score, created_at, updated_at')
        .single();

      if (error) {
        console.error(
          'Database error creating AI suggestion feedback:',
          { userId: data.user_id },
          error
        );
        throw error;
      }

      console.log('AI suggestion feedback record created successfully:', {
        feedbackId: feedback.id,
        userId: data.user_id,
        suggestionCount: data.suggestions.length,
      });

      return feedback;
    } catch (error) {
      console.error('Unexpected error in createAiSuggestionFeedback:', error);
      throw error;
    }
  }

  /**
   * Updates an existing AI suggestion feedback record with user ratings.
   * Validates that suggestions match the original structure and calculates rating score.
   *
   * @param feedbackId - UUID of the feedback record to update
   * @param userId - UUID of the user updating the feedback (for ownership verification)
   * @param ratings - Array of user ratings matching the original suggestions
   * @returns Promise resolving to the updated feedback record
   */
  async updateAiSuggestionFeedback(
    feedbackId: string,
    userId: string,
    ratings: AiSuggestionFeedbackSuggestionDto[]
  ): Promise<Tables<'ai_suggestion_feedback'>> {
    try {
      console.log('Updating AI suggestion feedback:', {
        feedbackId,
        userId,
        ratingCount: ratings.length,
      });

      // Step 1: Retrieve the existing feedback record
      const { data: existingFeedback, error: fetchError } = await this.client
        .from('ai_suggestion_feedback')
        .select('id, user_id, suggestions')
        .eq('id', feedbackId)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          console.error('AI suggestion feedback record not found:', feedbackId);
          throw new Error('Feedback record not found');
        }
        console.error('Database error retrieving feedback record:', { feedbackId }, fetchError);
        throw fetchError;
      }

      // Step 2: Verify ownership (RLS will also enforce this)
      if (existingFeedback.user_id !== userId) {
        console.error('Access denied: User does not own feedback record:', {
          feedbackId,
          userId,
          ownerId: existingFeedback.user_id,
        });
        throw new Error('Access denied: You can only update your own feedback');
      }

      // Step 3: Validate suggestions match original structure
      const originalSuggestions = existingFeedback.suggestions as unknown as AiSuggestionItemDto[];
      if (!this.validateSuggestionStructure(ratings, originalSuggestions)) {
        console.error('Suggestion structure validation failed:', {
          feedbackId,
          providedCount: ratings.length,
          originalCount: originalSuggestions.length,
        });
        throw new Error('Invalid suggestions format: does not match original suggestions');
      }

      // Step 4: Calculate rating score (sum of non-null ratings)
      const ratingScore = ratings.reduce((sum, rating) => sum + (rating.user_rating || 0), 0);

      // Step 5: Update the feedback record
      const { data: updatedFeedback, error: updateError } = await this.client
        .from('ai_suggestion_feedback')
        .update({
          suggestions: ratings as unknown as Json,
          rating_score: ratingScore,
          updated_at: new Date().toISOString(),
        })
        .eq('id', feedbackId)
        .select('id, user_id, input_songs, suggestions, rating_score, created_at, updated_at')
        .single();

      if (updateError) {
        console.error(
          'Database error updating AI suggestion feedback:',
          { feedbackId, userId },
          updateError
        );
        throw updateError;
      }

      console.log('AI suggestion feedback updated successfully:', {
        feedbackId,
        userId,
        ratingScore,
        ratedCount: ratings.filter(r => r.user_rating !== null).length,
      });

      return updatedFeedback;
    } catch (error) {
      console.error('Unexpected error in updateAiSuggestionFeedback:', error);
      throw error;
    }
  }

  /**
   * Validates that provided ratings match the structure of original suggestions.
   * Checks that titles, composers, and order match exactly.
   *
   * @param ratings - User-provided ratings to validate
   * @param originalSuggestions - Original AI-generated suggestions
   * @returns True if structure matches, false otherwise
   */
  private validateSuggestionStructure(
    ratings: AiSuggestionFeedbackSuggestionDto[],
    originalSuggestions: AiSuggestionItemDto[]
  ): boolean {
    // Check array lengths match
    if (ratings.length !== originalSuggestions.length) {
      return false;
    }

    // Check each suggestion matches title/composer in order
    for (let i = 0; i < ratings.length; i++) {
      const rating = ratings[i];
      const original = originalSuggestions[i];

      if (
        rating.title !== original.song_details.title ||
        rating.composer !== original.song_details.composer
      ) {
        return false;
      }
    }

    return true;
  }

  // =============================================================================
  // Rendering Feedback Methods
  // =============================================================================

  /**
   * Submits rendering quality feedback by creating a new feedback record.
   * Stores user's thumbs up/down rating for a specific song's rendering quality.
   *
   * @param data - Feedback submission data including song_id, rating, and user context
   * @returns Promise resolving to the created feedback record
   */
  async submitRenderingFeedback(
    data: SubmitRenderingFeedbackCommand & { user_id: string }
  ): Promise<Tables<'rendering_feedback'>> {
    try {
      console.log('Submitting rendering feedback:', {
        songId: data.song_id,
        rating: data.rating,
        userId: data.user_id,
      });

      const { data: feedback, error } = await this.client
        .from('rendering_feedback')
        .insert({
          user_id: data.user_id,
          song_id: data.song_id,
          rating: data.rating,
        })
        .select('id, user_id, song_id, rating, created_at')
        .single();

      if (error) {
        console.error(
          'Database error submitting rendering feedback:',
          {
            songId: data.song_id,
            rating: data.rating,
            userId: data.user_id,
          },
          error
        );
        throw error;
      }

      console.log('Rendering feedback submitted successfully:', {
        feedbackId: feedback.id,
        songId: data.song_id,
        rating: data.rating,
        userId: data.user_id,
      });

      return feedback;
    } catch (error) {
      console.error('Unexpected error in submitRenderingFeedback:', error);
      throw error;
    }
  }
}
