import { Injectable, inject } from '@angular/core';
import { SupabaseService, PublicSongsQueryParams } from './supabase.service';
import {
  AuthenticationError,
  ValidationError,
  NotFoundError,
  ForbiddenError,
} from '../models/errors';
import type { PublicSongsListResponseDto, PaginationDto, SongAccessDto } from '../../types';

/**
 * Service for managing song-related operations.
 * Handles business logic for song browsing, validation, and data transformation.
 */
@Injectable({
  providedIn: 'root',
})
export class SongService {
  private readonly supabaseService = inject(SupabaseService);

  /**
   * Retrieves paginated list of public domain songs with validation and error handling.
   * Performs authentication check, parameter validation, and response formatting.
   *
   * @param queryParams - Query parameters for pagination, sorting, and search
   * @returns Promise resolving to PublicSongsListResponseDto
   * @throws AuthenticationError if user is not authenticated
   * @throws ValidationError if parameters are invalid
   */
  async getPublicSongsList(
    queryParams: PublicSongsQueryParams
  ): Promise<PublicSongsListResponseDto> {
    try {
      console.log('Processing public songs list request with params:', queryParams);

      // Validate authentication
      const {
        data: { user },
        error: authError,
      } = await this.supabaseService.client.auth.getUser();
      if (authError || !user) {
        console.warn('Public songs list request failed: Authentication required', { authError });
        throw new AuthenticationError('Authentication required');
      }

      // Validate parameters
      this.validatePublicSongsParams(queryParams);

      // Execute query
      const { data, total } = await this.supabaseService.getPublicSongs(queryParams);

      // Calculate pagination metadata
      const page = Math.max(1, queryParams.page || 1);
      const limit = Math.min(100, Math.max(1, queryParams.limit || 50));
      const totalPages = Math.ceil(total / limit);

      const pagination: PaginationDto = {
        page,
        limit,
        total_items: total,
        total_pages: totalPages,
      };

      console.log(`Returning ${data.length} songs with pagination:`, pagination);

      return {
        data,
        pagination,
      };
    } catch (error) {
      // Re-throw known application errors
      if (error instanceof AuthenticationError || error instanceof ValidationError) {
        throw error;
      }

      // Log unexpected errors
      console.error('Unexpected error in getPublicSongsList:', error);

      // Wrap unexpected errors as internal errors
      throw error; // Let caller handle generic error mapping
    }
  }

  /**
   * Validates query parameters for public songs retrieval.
   * Throws ValidationError if validation fails.
   *
   * @param params - Parameters to validate
   * @throws ValidationError if parameters are invalid
   */
  private validatePublicSongsParams(params: PublicSongsQueryParams): void {
    // Validate page
    if (params.page !== undefined && (!Number.isInteger(params.page) || params.page < 1)) {
      throw new ValidationError('Page must be a positive integer', 'INVALID_PARAMETERS');
    }

    // Validate limit
    if (
      params.limit !== undefined &&
      (!Number.isInteger(params.limit) || params.limit < 1 || params.limit > 100)
    ) {
      throw new ValidationError('Limit must be an integer between 1 and 100', 'INVALID_PARAMETERS');
    }

    // Validate sort field
    const allowedSortFields = ['title', 'composer', 'created_at'];
    if (params.sort !== undefined && !allowedSortFields.includes(params.sort)) {
      throw new ValidationError(
        `Sort field must be one of: ${allowedSortFields.join(', ')}`,
        'INVALID_PARAMETERS'
      );
    }

    // Validate order
    if (params.order !== undefined && params.order !== 'asc' && params.order !== 'desc') {
      throw new ValidationError('Order must be either "asc" or "desc"', 'INVALID_PARAMETERS');
    }

    // Validate search (optional string, no specific constraints)
    if (params.search !== undefined && typeof params.search !== 'string') {
      throw new ValidationError('Search must be a string', 'INVALID_PARAMETERS');
    }

    // Validation passed
  }

  /**
   * Validates that a string is a valid UUID format.
   * Uses regex pattern to match standard UUID v4 format.
   *
   * @param uuid - String to validate as UUID
   * @returns True if valid UUID, false otherwise
   */
  private isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * Retrieves detailed information about a specific song and generates a secure access URL for the MusicXML file.
   * Performs comprehensive validation, authentication, and access control checks.
   *
   * @param songId - UUID of the song to retrieve
   * @returns Promise resolving to SongAccessDto with song metadata and signed URL
   * @throws AuthenticationError if user is not authenticated
   * @throws ValidationError if songId is invalid
   * @throws NotFoundError if song doesn't exist
   * @throws ForbiddenError if user doesn't have access to the song
   */
  async getSongDetails(songId: string): Promise<SongAccessDto> {
    try {
      console.log('Processing song details request for songId:', songId);

      // Validate songId format
      if (!this.isValidUUID(songId)) {
        console.warn('Invalid songId format:', songId);
        throw new ValidationError('Invalid song ID format', 'INVALID_PARAMETERS');
      }

      // Validate authentication
      const {
        data: { user },
        error: authError,
      } = await this.supabaseService.client.auth.getUser();
      if (authError || !user) {
        console.warn('Song details request failed: Authentication required', { authError });
        throw new AuthenticationError('Authentication required');
      }

      // Check song access and retrieve song data
      const songWithAccess = await this.supabaseService.getSongWithAccessCheck(songId, user.id);

      if (!songWithAccess) {
        // Determine if song doesn't exist or access is denied
        // Check if song exists at all
        const { data: songExists } = await this.supabaseService.client
          .from('songs')
          .select('id')
          .eq('id', songId)
          .single();

        if (!songExists) {
          console.log('Song not found:', songId);
          throw new NotFoundError('Song not found', 'SONG_NOT_FOUND');
        } else {
          console.log('Access denied for song:', { songId, userId: user.id });
          throw new ForbiddenError('You do not have access to this song');
        }
      }

      // Generate signed URL for MusicXML file
      const musicxmlUrl = await this.supabaseService.generateMusicXMLSignedUrl(
        songWithAccess.file_hash
      );

      // Build response DTO
      const songAccessDto: SongAccessDto = {
        id: songWithAccess.id,
        song_details: {
          title: songWithAccess.title || '',
          composer: songWithAccess.composer || '',
        },
        file_hash: songWithAccess.file_hash,
        created_at: songWithAccess.created_at,
        musicxml_url: musicxmlUrl,
      };

      console.log('Song details retrieved successfully:', { songId, userId: user.id });
      return songAccessDto;
    } catch (error) {
      // Re-throw known application errors
      if (
        error instanceof AuthenticationError ||
        error instanceof ValidationError ||
        error instanceof NotFoundError ||
        error instanceof ForbiddenError
      ) {
        throw error;
      }

      // Log unexpected errors
      console.error('Unexpected error in getSongDetails:', { songId }, error);

      // Wrap unexpected errors as internal errors (this would typically be handled by a global error handler)
      throw error;
    }
  }
}
