import { Injectable, inject } from '@angular/core';
import { SupabaseService, PublicSongsQueryParams } from './supabase.service';
import { MusicXMLParserService } from './musicxml-parser.service';
import { FileUtilsService } from './file-utils.service';
import {
  AuthenticationError,
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from '../models/errors';
import type {
  PublicSongsListResponseDto,
  PaginationDto,
  SongAccessDto,
  UploadSongCommand,
  UploadSongResponseDto,
  SongDetailsDto,
} from '../../types';

/**
 * Service for managing song-related operations.
 * Handles business logic for song browsing, validation, and data transformation.
 */
@Injectable({
  providedIn: 'root',
})
export class SongService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly musicXMLParserService = inject(MusicXMLParserService);
  private readonly fileUtilsService = inject(FileUtilsService);

  /**
   * Retrieves paginated list of public domain songs with validation and error handling.
   * Performs parameter validation and response formatting.
   * Authentication is optional for public songs browsing.
   *
   * @param queryParams - Query parameters for pagination, sorting, and search
   * @returns Promise resolving to PublicSongsListResponseDto
   * @throws ValidationError if parameters are invalid
   */
  async getPublicSongsList(
    queryParams: PublicSongsQueryParams
  ): Promise<PublicSongsListResponseDto> {
    try {
      console.log('Processing public songs list request with params:', queryParams);

      // Validate parameters
      this.validatePublicSongsParams(queryParams);

      // Execute query (RLS policies handle access control automatically)
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
      if (error instanceof ValidationError) {
        throw error;
      }

      // Log unexpected errors
      console.error('Unexpected error in getPublicSongsList:', error);

      // Wrap unexpected errors as internal errors
      throw error; // Let caller handle generic error mapping
    }
  }

  /**
   * Uploads a MusicXML file and adds it to the user's library.
   * Implements intelligent duplicate detection, metadata extraction, and secure file storage.
   * Handles both new song uploads (201 Created) and duplicate additions (200 OK).
   *
   * @param command - Upload command containing the MusicXML file
   * @returns Promise resolving to UploadSongResponseDto with song metadata and status
   * @throws AuthenticationError if user is not authenticated
   * @throws ValidationError if file validation fails
   * @throws ConflictError if song already exists in user's library
   */
  async uploadSong(command: UploadSongCommand): Promise<UploadSongResponseDto> {
    try {
      console.log('Processing song upload request');

      // Step 1: Authentication check
      const {
        data: { user },
        error: authError,
      } = await this.supabaseService.client.auth.getUser();
      if (authError || !user) {
        console.warn('Song upload failed: Authentication required', { authError });
        throw new AuthenticationError('Authentication required');
      }

      // Step 2: File validation
      this.validateUploadFile(command.file);

      // Step 3: Read file buffer and calculate hash
      const fileBuffer = await this.readFileAsArrayBuffer(command.file);
      const fileHash = this.fileUtilsService.calculateMD5Hash(fileBuffer);

      console.log('File processed:', { size: command.file.size, hash: fileHash });

      // Step 4: Validate MusicXML format
      const isValidMusicXML = await this.musicXMLParserService.validateMusicXML(fileBuffer);
      if (!isValidMusicXML) {
        console.warn('Invalid MusicXML file provided');
        throw new ValidationError(
          'Invalid MusicXML format. Please ensure the file is valid.',
          'INVALID_MUSICXML'
        );
      }

      // Step 5: Parse metadata
      const metadata = await this.musicXMLParserService.parseMusicXML(fileBuffer);
      console.log('Extracted metadata:', metadata);

      // Step 6: Check for duplicates and handle accordingly
      const duplicateCheck = await this.supabaseService.checkSongByHashWithLibraryStatus(
        fileHash,
        user.id
      );

      if (duplicateCheck.song) {
        // Song exists - handle duplicate logic
        return await this.handleDuplicateSong(
          { ...duplicateCheck.song, isInLibrary: duplicateCheck.isInLibrary },
          user.id,
          metadata
        );
      } else {
        // New song - create it
        return await this.handleNewSong(fileBuffer, fileHash, user.id, metadata);
      }
    } catch (error) {
      // Re-throw known application errors
      if (
        error instanceof AuthenticationError ||
        error instanceof ValidationError ||
        error instanceof ConflictError
      ) {
        throw error;
      }

      // Log unexpected errors and wrap as internal error
      console.error('Unexpected error in uploadSong:', error);
      throw error; // Let global error handler convert to appropriate response
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

      // Get current user (optional - may be null for public access)
      const {
        data: { user },
      } = await this.supabaseService.client.auth.getUser();

      // Try to get song with access check if user is authenticated
      if (user) {
        const songWithAccess = await this.supabaseService.getSongWithAccessCheck(songId, user.id);

        if (songWithAccess) {
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
        }

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
      } else {
        // No user authenticated - try to fetch as public song
        const { data: publicSong, error: fetchError } = await this.supabaseService.client
          .from('songs')
          .select('id, title, composer, file_hash, created_at')
          .eq('id', songId)
          .single();

        if (fetchError || !publicSong) {
          console.log('Public song not found:', { songId, error: fetchError });
          throw new NotFoundError('Song not found', 'SONG_NOT_FOUND');
        }

        // Generate signed URL for MusicXML file
        const musicxmlUrl = await this.supabaseService.generateMusicXMLSignedUrl(
          publicSong.file_hash
        );

        // Build response DTO
        const songAccessDto: SongAccessDto = {
          id: publicSong.id,
          song_details: {
            title: publicSong.title || '',
            composer: publicSong.composer || '',
          },
          file_hash: publicSong.file_hash,
          created_at: publicSong.created_at,
          musicxml_url: musicxmlUrl,
        };

        console.log('Public song details retrieved successfully:', { songId });
        return songAccessDto;
      }
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

  /**
   * Validates the uploaded file for basic requirements.
   * Checks file presence, extension, size, and MIME type.
   *
   * @param file - The file to validate
   * @throws ValidationError if validation fails
   */
  private validateUploadFile(file: File | Blob): void {
    // Check if file exists
    if (!file) {
      throw new ValidationError('No file provided', 'INVALID_REQUEST');
    }

    // Check file extension (only for File objects that have names)
    if (file instanceof File && !this.fileUtilsService.validateFileExtension(file.name)) {
      throw new ValidationError(
        `Only MusicXML files (.xml, .musicxml) are supported. Got: ${file.name}`,
        'INVALID_FILE_FORMAT'
      );
    }

    // Check file size
    if (!this.fileUtilsService.validateFileSize(file.size)) {
      const maxSizeMB = Math.round(this.fileUtilsService.getMaxFileSize() / (1024 * 1024));
      throw new ValidationError(
        `File size exceeds maximum allowed size of ${maxSizeMB}MB`,
        'FILE_TOO_LARGE'
      );
    }

    // Check MIME type (only for File objects)
    if (file instanceof File && !this.fileUtilsService.validateMimeType(file.type)) {
      throw new ValidationError(
        `Invalid file type: ${file.type}. Expected XML content.`,
        'INVALID_FILE_FORMAT'
      );
    }
  }

  /**
   * Reads a File or Blob as ArrayBuffer for processing.
   *
   * @param file - The file to read
   * @returns Promise resolving to ArrayBuffer
   */
  private async readFileAsArrayBuffer(file: File | Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to read file as ArrayBuffer'));
        }
      };
      reader.onerror = () => reject(new Error('File reading failed'));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Handles the case where a song already exists in the system.
   * Checks if the user already has it in their library and either adds it or returns conflict.
   *
   * @param existingSong - The existing song record with library status
   * @param userId - The authenticated user's ID
   * @param metadata - Extracted metadata (for fallback if needed)
   * @returns Promise resolving to UploadSongResponseDto
   */
  private async handleDuplicateSong(
    existingSong: {
      id: string;
      title: string | null;
      composer: string | null;
      file_hash: string;
      created_at: string;
      isInLibrary: boolean;
    },
    userId: string,
    metadata: { title: string; composer: string }
  ): Promise<UploadSongResponseDto> {
    console.log('Handling duplicate song:', { songId: existingSong.id, userId });

    // Check if user already has this song in their library
    if (existingSong.isInLibrary) {
      console.log('Song already in user library - returning conflict');
      throw new ConflictError('This song is already in your library', 'SONG_ALREADY_IN_LIBRARY');
    }

    // Song exists but user doesn't have it - add to library
    console.log('Adding existing song to user library');
    const userSongRecord = await this.supabaseService.addSongToUserLibrary(userId, existingSong.id);

    const songDetails: SongDetailsDto = {
      title: existingSong.title || metadata.title || '',
      composer: existingSong.composer || metadata.composer || '',
    };

    return {
      id: existingSong.id,
      song_details: songDetails,
      file_hash: existingSong.file_hash,
      created_at: existingSong.created_at,
      added_to_library_at: userSongRecord.created_at,
      is_duplicate: true,
    };
  }

  /**
   * Handles the creation of a new song that doesn't exist in the system.
   * Uploads file to storage and creates database records.
   *
   * @param fileBuffer - The file content as ArrayBuffer
   * @param fileHash - MD5 hash of the file
   * @param userId - The authenticated user's ID
   * @param metadata - Extracted metadata
   * @returns Promise resolving to UploadSongResponseDto
   */
  private async handleNewSong(
    fileBuffer: ArrayBuffer,
    fileHash: string,
    userId: string,
    metadata: { title: string; composer: string }
  ): Promise<UploadSongResponseDto> {
    console.log('Handling new song creation:', { userId, hash: fileHash });

    try {
      // Step 1: Upload file to Supabase Storage
      await this.supabaseService.uploadMusicXMLFile(fileHash, fileBuffer);
      console.log('File uploaded to storage successfully');

      // Step 2: Create song record in database
      const songRecord = await this.supabaseService.createSong({
        title: metadata.title,
        composer: metadata.composer,
        file_hash: fileHash,
        uploader_id: userId,
      });
      console.log('Song record created:', songRecord.id);

      // Step 3: Add to user's library (this also creates the user_songs record)
      const userSongRecord = await this.supabaseService.addSongToUserLibrary(userId, songRecord.id);
      console.log('Song added to user library');

      return {
        id: songRecord.id,
        song_details: {
          title: songRecord.title || metadata.title,
          composer: songRecord.composer || metadata.composer,
        },
        file_hash: songRecord.file_hash,
        created_at: songRecord.created_at,
        added_to_library_at: userSongRecord.created_at,
      };
    } catch (error) {
      // If anything fails after file upload, we should clean up the uploaded file
      console.error('Error during new song creation, attempting cleanup:', error);
      try {
        // Note: In a real implementation, you might want to implement a cleanup mechanism
        // For now, we'll just log the error and re-throw
        console.warn('File uploaded but database operations failed - manual cleanup may be needed');
      } catch (cleanupError) {
        console.error('Cleanup also failed:', cleanupError);
      }
      throw error;
    }
  }
}
