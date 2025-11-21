import { Injectable, inject } from '@angular/core';
import { SupabaseService, type LibraryQueryParams } from './supabase.service';
import type {
  AddUserSongCommand,
  AddUserSongResponseDto,
  UserLibraryListResponseDto,
  UserLibraryItemDto,
} from '../../types';
import {
  AuthenticationError,
  NotFoundError,
  ValidationError,
  ConflictError,
} from '../../app/models/errors';
import { validateUUID } from '../../utils/validation';

/**
 * Service for managing user library operations.
 * Handles retrieving and managing user's personal song library with proper validation and error handling.
 */
@Injectable({
  providedIn: 'root',
})
export class UserLibraryService {
  private readonly supabaseService = inject(SupabaseService);

  /**
   * Validates the structure and content of an AddUserSongCommand.
   * Performs comprehensive validation including presence, format, and sanitization.
   *
   * @param command - The add song command to validate
   * @throws ValidationError if validation fails with specific error details
   */
  private validateAddUserSongCommand(command: AddUserSongCommand): void {
    // Validate command object structure
    if (!command || typeof command !== 'object') {
      throw new ValidationError('Request body must be a valid JSON object');
    }

    // Validate song_id presence and type
    if (!('song_id' in command)) {
      throw new ValidationError('song_id field is required');
    }

    if (command.song_id === null || command.song_id === undefined) {
      throw new ValidationError('song_id cannot be null or undefined');
    }

    if (typeof command.song_id !== 'string') {
      throw new ValidationError('song_id must be a string');
    }

    // Trim whitespace and validate emptiness
    const trimmedSongId = command.song_id.trim();
    if (trimmedSongId === '') {
      throw new ValidationError('song_id cannot be empty');
    }

    // Validate UUID format using utility function
    try {
      validateUUID(trimmedSongId, 'song_id');
    } catch (error) {
      throw new ValidationError((error as Error).message);
    }

    // Check for unexpected additional properties (strict validation)
    const allowedProperties = ['song_id'];
    const commandKeys = Object.keys(command);
    const extraProperties = commandKeys.filter(key => !allowedProperties.includes(key));

    if (extraProperties.length > 0) {
      throw new ValidationError(`Unexpected properties in request: ${extraProperties.join(', ')}`);
    }
  }

  /**
   * Validates the structure and content of LibraryQueryParams.
   * Performs comprehensive validation including presence, format, and range validation.
   *
   * @param params - The query parameters to validate
   * @throws ValidationError if validation fails with specific error details
   */
  private validateLibraryQueryParams(params: LibraryQueryParams): void {
    // Validate params object structure
    if (!params || typeof params !== 'object') {
      throw new ValidationError('Query parameters must be a valid object');
    }

    // Validate page parameter
    if (params.page !== undefined) {
      if (typeof params.page !== 'number' || !Number.isInteger(params.page)) {
        throw new ValidationError('page must be an integer');
      }
      if (params.page < 1) {
        throw new ValidationError('page must be greater than or equal to 1');
      }
    }

    // Validate limit parameter
    if (params.limit !== undefined) {
      if (typeof params.limit !== 'number' || !Number.isInteger(params.limit)) {
        throw new ValidationError('limit must be an integer');
      }
      if (params.limit < 1) {
        throw new ValidationError('limit must be greater than or equal to 1');
      }
      if (params.limit > 100) {
        throw new ValidationError('limit must not exceed 100');
      }
    }

    const allowedSortFields = ['title', 'composer', 'created_at', 'added_at'] as const;

    // Validate sort parameter
    if (params.sort !== undefined) {
      if (typeof params.sort !== 'string') {
        throw new ValidationError('sort must be a string');
      }
      if (!allowedSortFields.includes(params.sort as (typeof allowedSortFields)[number])) {
        throw new ValidationError(`sort must be one of: ${allowedSortFields.join(', ')}`);
      }
    }

    // Validate order parameter
    if (params.order !== undefined) {
      if (typeof params.order !== 'string') {
        throw new ValidationError('order must be a string');
      }
      if (params.order !== 'asc' && params.order !== 'desc') {
        throw new ValidationError('order must be either "asc" or "desc"');
      }
    }

    if (params.sorts !== undefined) {
      if (!Array.isArray(params.sorts)) {
        throw new ValidationError('sorts must be an array of sort descriptors');
      }

      params.sorts.forEach((descriptor, index) => {
        if (!descriptor || typeof descriptor !== 'object') {
          throw new ValidationError(`sorts[${index}] must be a valid sort descriptor`);
        }

        const { field, direction } = descriptor;

        if (typeof field !== 'string') {
          throw new ValidationError(`sorts[${index}].field must be a string`);
        }

        if (!allowedSortFields.includes(field as (typeof allowedSortFields)[number])) {
          throw new ValidationError(
            `sorts[${index}].field must be one of: ${allowedSortFields.join(', ')}`
          );
        }

        if (typeof direction !== 'string') {
          throw new ValidationError(`sorts[${index}].direction must be a string`);
        }

        if (direction !== 'asc' && direction !== 'desc') {
          throw new ValidationError(`sorts[${index}].direction must be either "asc" or "desc"`);
        }
      });
    }

    // Check for unexpected additional properties (strict validation)
    if (params.search !== undefined) {
      if (typeof params.search !== 'string') {
        throw new ValidationError('search must be a string');
      }
      params.search = params.search.trim();
    }

    const allowedProperties = ['page', 'limit', 'sort', 'order', 'sorts', 'search'];
    const paramKeys = Object.keys(params);
    const extraProperties = paramKeys.filter(key => !allowedProperties.includes(key));

    if (extraProperties.length > 0) {
      throw new ValidationError(`Unexpected query parameters: ${extraProperties.join(', ')}`);
    }
  }

  /**
   * Performs comprehensive access control checks for song operations.
   * Verifies song existence, user permissions, and library status.
   *
   * @param songId - The UUID of the song to check
   * @param userId - The UUID of the authenticated user
   * @throws NotFoundError if song doesn't exist or isn't accessible
   * @throws ConflictError if song is already in user's library
   */
  private async performAccessControlChecks(songId: string, userId: string): Promise<void> {
    console.log('Performing access control checks:', { songId, userId });

    // Step 1: Verify song exists in the database
    const songWithAccess = await this.supabaseService.getSongWithAccessCheck(songId, userId);
    if (!songWithAccess) {
      console.warn('Song not found or access denied:', { songId, userId });
      throw new NotFoundError('Song not found or not accessible', 'SONG_NOT_FOUND');
    }

    // Step 2: Verify user has permission to access this song
    // Note: getSongWithAccessCheck already handles access control based on:
    // - Public domain songs (uploader_id IS NULL) - accessible to everyone
    // - Private songs - only accessible if user owns them (in user_songs table)
    if (!songWithAccess.hasAccess) {
      console.warn('Access denied to song:', { songId, userId });
      throw new NotFoundError('Song not found or not accessible', 'SONG_NOT_FOUND');
    }

    // Step 3: Check for duplicate library entries
    const alreadyInLibrary = await this.supabaseService.isSongInUserLibrary(songId, userId);
    if (alreadyInLibrary) {
      console.warn('Duplicate prevention: Song already in user library:', { songId, userId });
      throw new ConflictError('This song is already in your library', 'SONG_ALREADY_IN_LIBRARY');
    }

    console.log('Access control checks passed:', { songId, userId });
  }

  /**
   * Adds a song to the authenticated user's personal library.
   * Performs comprehensive validation including authentication, song existence,
   * access permissions, and duplicate prevention.
   *
   * @param command - The command containing the song_id to add
   * @returns Promise resolving to AddUserSongResponseDto with library association details
   * @throws AuthenticationError if user is not authenticated
   * @throws ValidationError if request payload is invalid
   * @throws NotFoundError if song doesn't exist or isn't accessible
   * @throws ConflictError if song is already in user's library
   */
  async addSongToLibrary(command: AddUserSongCommand): Promise<AddUserSongResponseDto> {
    try {
      // Step 1: Comprehensive request validation
      this.validateAddUserSongCommand(command);
      const songId = command.song_id.trim(); // Use trimmed, validated song_id

      // Step 2: Authentication validation
      const {
        data: { user },
        error: authError,
      } = await this.supabaseService.client.auth.getUser();

      if (authError) {
        console.warn('Authentication error during add to library:', { authError });
        throw new AuthenticationError('Authentication failed');
      }

      if (!user) {
        console.warn('Add to library failed: No authenticated user');
        throw new AuthenticationError('Authentication required');
      }

      // Validate user ID format (additional security check)
      try {
        validateUUID(user.id, 'user_id');
      } catch (validationError) {
        console.error('Invalid user ID format:', { userId: user.id, error: validationError });
        throw new AuthenticationError('Invalid user session');
      }

      const userId = user.id;

      console.log('Processing add to library request:', { userId, songId });

      // Step 3: Comprehensive access control checks
      await this.performAccessControlChecks(songId, userId);

      // Step 4: Add song to user's library (atomic operation)
      console.log('Creating library association:', { userId, songId });
      const libraryEntry = await this.supabaseService.addSongToUserLibrary(userId, songId);

      // Step 5: Retrieve song details for response (double-check existence)
      const songDetails = await this.supabaseService.getSongDetails(songId);
      if (!songDetails) {
        // Critical error - rollback might be needed, but database constraints should prevent this
        console.error('Critical error: Song details missing after library addition:', { songId });
        throw new Error('Failed to retrieve song details after library addition');
      }

      // Step 6: Construct and validate response
      const response: AddUserSongResponseDto = {
        user_id: libraryEntry.user_id,
        song_id: libraryEntry.song_id,
        created_at: libraryEntry.created_at,
        song_details: songDetails,
      };

      // Final validation of response structure
      if (
        !response.user_id ||
        !response.song_id ||
        !response.created_at ||
        !response.song_details
      ) {
        console.error('Invalid response structure:', response);
        throw new Error('Failed to construct valid response');
      }

      console.log('Song successfully added to library:', { userId, songId });
      return response;
    } catch (error) {
      // Re-throw known application errors with proper typing
      if (
        error instanceof AuthenticationError ||
        error instanceof NotFoundError ||
        error instanceof ValidationError ||
        error instanceof ConflictError
      ) {
        throw error;
      }

      // Log unexpected errors with context
      console.error('Unexpected error in addSongToLibrary:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        command,
      });

      // Wrap unexpected errors as generic errors (caller should handle generic error mapping)
      throw error;
    }
  }

  /**
   * Retrieves the authenticated user's personal song library.
   * Performs comprehensive validation, authentication, and data transformation.
   *
   * @param params - Query parameters for pagination and sorting
   * @returns Promise resolving to UserLibraryListResponseDto with paginated library data
   * @throws AuthenticationError if user is not authenticated
   * @throws ValidationError if query parameters are invalid
   */
  async getUserLibrary(params: LibraryQueryParams): Promise<UserLibraryListResponseDto> {
    try {
      // Step 1: Comprehensive parameter validation
      this.validateLibraryQueryParams(params);

      // Step 2: Authentication validation
      const {
        data: { user },
        error: authError,
      } = await this.supabaseService.client.auth.getUser();

      if (authError) {
        console.warn('Authentication error during library retrieval:', { authError });
        throw new AuthenticationError('Authentication failed');
      }

      if (!user) {
        console.warn('Library retrieval failed: No authenticated user');
        throw new AuthenticationError('Authentication required');
      }

      // Validate user ID format (additional security check)
      try {
        validateUUID(user.id, 'user_id');
      } catch (validationError) {
        console.error('Invalid user ID format:', { userId: user.id, error: validationError });
        throw new AuthenticationError('Invalid user session');
      }

      const userId = user.id;
      console.log('Processing library retrieval request:', { userId, params });

      // Step 3: Retrieve user library data
      console.log('Fetching user library data:', { userId, params });
      const { data: libraryData, total } = await this.supabaseService.getUserLibrary(
        userId,
        params
      );

      // Step 4: Transform data to DTO format
      const transformedData: UserLibraryItemDto[] = libraryData.map(item => ({
        song_id: item.song_id,
        song_details: item.song_details,
        added_at: item.created_at,
      }));

      // Step 5: Calculate pagination metadata
      const page = params.page || 1;
      const limit = params.limit || 50;
      const totalPages = Math.ceil(total / limit);

      const pagination = {
        page,
        limit,
        total_items: total,
        total_pages: totalPages,
      };

      // Step 6: Construct and validate response
      const response: UserLibraryListResponseDto = {
        data: transformedData,
        pagination,
      };

      console.log('User library retrieved successfully:', {
        userId,
        itemCount: transformedData.length,
        totalItems: total,
        pagination,
      });

      return response;
    } catch (error) {
      // Re-throw known application errors with proper typing
      if (error instanceof AuthenticationError || error instanceof ValidationError) {
        throw error;
      }

      // Log unexpected errors with context
      console.error('Unexpected error in getUserLibrary:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        params,
      });

      // Wrap unexpected errors as generic errors (caller should handle generic error mapping)
      throw error;
    }
  }

  /**
   * Removes a song from the authenticated user's personal library.
   * Performs comprehensive validation including authentication, song existence in library,
   * and access permissions before performing the deletion.
   *
   * @param songId - The UUID of the song to remove from the user's library
   * @throws AuthenticationError if user is not authenticated
   * @throws ValidationError if songId parameter is invalid
   * @throws NotFoundError if song is not found in user's library
   */
  async removeSongFromLibrary(songId: string): Promise<void> {
    try {
      // Step 1: Comprehensive parameter validation
      try {
        validateUUID(songId, 'songId');
      } catch (validationError) {
        console.warn('Invalid songId format:', { songId, error: validationError });
        throw new ValidationError((validationError as Error).message);
      }

      console.log('Processing remove from library request:', { songId });

      // Step 2: Authentication validation
      const {
        data: { user },
        error: authError,
      } = await this.supabaseService.client.auth.getUser();

      if (authError) {
        console.warn('Authentication error during remove from library:', { authError });
        throw new AuthenticationError('Authentication failed');
      }

      if (!user) {
        console.warn('Remove from library failed: No authenticated user');
        throw new AuthenticationError('Authentication required');
      }

      // Validate user ID format (additional security check)
      try {
        validateUUID(user.id, 'user_id');
      } catch (validationError) {
        console.error('Invalid user ID format:', { userId: user.id, error: validationError });
        throw new AuthenticationError('Invalid user session');
      }

      const userId = user.id;

      // Step 3: Verify song exists in user's library before deletion
      console.log('Checking if song exists in user library:', { songId, userId });
      const isInLibrary = await this.supabaseService.isSongInUserLibrary(songId, userId);

      if (!isInLibrary) {
        console.warn('Song not found in user library:', { songId, userId });
        throw new NotFoundError('Song not found in your library', 'SONG_NOT_IN_LIBRARY');
      }

      // Step 4: Remove song from user's library
      console.log('Removing song from user library:', { songId, userId });
      await this.supabaseService.removeSongFromUserLibrary(userId, songId);

      console.log('Song successfully removed from library:', { songId, userId });
    } catch (error) {
      // Re-throw known application errors with proper typing
      if (
        error instanceof AuthenticationError ||
        error instanceof NotFoundError ||
        error instanceof ValidationError
      ) {
        throw error;
      }

      // Log unexpected errors with context
      console.error('Unexpected error in removeSongFromLibrary:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        songId,
      });

      // Wrap unexpected errors as generic errors (caller should handle generic error mapping)
      throw error;
    }
  }
}
