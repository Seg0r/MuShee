import { Injectable, inject } from '@angular/core';
import { SupabaseService, CreateSongDto } from './supabase.service';
import { MusicxmlParserService } from './musicxml-parser.service';
import { FileUtilsService } from './file-utils.service';
import { ConflictError } from '../models/errors';
import type { UploadSongResponseDto } from '../../types';

/**
 * Service that orchestrates the entire song upload process.
 * Implements the complete upload workflow as specified in the implementation plan.
 */
@Injectable({
  providedIn: 'root',
})
export class SongUploadService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly musicxmlParser = inject(MusicxmlParserService);
  private readonly fileUtils = inject(FileUtilsService);

  /**
   * Uploads a MusicXML file following the complete workflow from the implementation plan.
   *
   * @param file - The MusicXML file to upload
   * @param userId - The authenticated user's ID
   * @returns Upload response with song details and metadata
   * @throws ValidationError for invalid files or data
   * @throws ConflictError if song already exists in user's library
   */
  async uploadSong(file: File, userId: string): Promise<UploadSongResponseDto> {
    // Step 1: Initial validation
    this.fileUtils.validateFile(file);

    // Step 2: Read file content
    const fileBuffer = await this.fileUtils.readFileAsArrayBuffer(file);

    // Step 3: Calculate MD5 hash
    const fileHash = this.fileUtils.calculateMD5Hash(fileBuffer);

    // Step 4: Check for duplicates (the complex LEFT JOIN query)
    const duplicateCheck = await this.supabaseService.checkSongDuplicateStatus(fileHash, userId);

    if (duplicateCheck.song && duplicateCheck.userHasSong) {
      // Song exists and user already has it - return 409 Conflict
      throw new ConflictError('This song is already in your library', 'SONG_ALREADY_IN_LIBRARY');
    }

    if (duplicateCheck.song && !duplicateCheck.userHasSong) {
      // Song exists but user doesn't have it - add to library
      const userSong = await this.supabaseService.addSongToUserLibrary(
        userId,
        duplicateCheck.song.id
      );
      return {
        id: duplicateCheck.song.id,
        song_details: {
          title: duplicateCheck.song.title || '',
          composer: duplicateCheck.song.composer || '',
        },
        file_hash: duplicateCheck.song.file_hash,
        created_at: duplicateCheck.song.created_at,
        added_to_library_at: userSong.created_at,
        is_duplicate: true,
      };
    }

    // Step 5: Parse MusicXML metadata
    const metadata = await this.musicxmlParser.parseMusicXML(fileBuffer);

    // Step 6: Upload file to storage
    await this.supabaseService.uploadMusicXMLFile(fileHash, fileBuffer);

    // Step 7: Create song record
    const createSongData: CreateSongDto = {
      title: metadata.title,
      composer: metadata.composer,
      file_hash: fileHash,
      uploader_id: userId,
    };

    const song = await this.supabaseService.createSong(createSongData);

    // Step 8: Add to user's library
    const userSong = await this.supabaseService.addSongToUserLibrary(userId, song.id);

    // Step 9: Return success response
    return {
      id: song.id,
      song_details: {
        title: song.title || '',
        composer: song.composer || '',
      },
      file_hash: song.file_hash,
      created_at: song.created_at,
      added_to_library_at: userSong.created_at,
    };
  }
}
