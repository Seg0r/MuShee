import { Injectable, inject } from '@angular/core';
import { AiService } from './ai.service';
import { UserLibraryService } from './user-library.service';
import type { SongReferenceDto, GenerateAiSuggestionsResponseDto } from '../../types';

/**
 * Service for orchestrating AI-powered song suggestion generation.
 * Handles the complete workflow from song collection to suggestion delivery.
 */
@Injectable({
  providedIn: 'root',
})
export class AiSuggestionsService {
  private readonly aiService = inject(AiService);
  private readonly userLibraryService = inject(UserLibraryService);

  /**
   * Generates AI-powered song suggestions for a user.
   * If songs are not provided, retrieves the user's current library.
   * Orchestrates the complete suggestion generation workflow.
   *
   * @param userId - The authenticated user's ID
   * @param songs - Optional array of songs to use for analysis (if not provided, uses user's library)
   * @returns Promise resolving to AI suggestions with feedback tracking ID
   * @throws Error with appropriate error codes for different failure scenarios
   */
  async generateSuggestionsForUser(
    userId: string,
    songs?: SongReferenceDto[]
  ): Promise<GenerateAiSuggestionsResponseDto> {
    try {
      console.log('Generating AI suggestions for user:', userId, {
        providedSongs: songs?.length || 0,
      });

      // Determine which songs to use for AI analysis
      let songsForAnalysis: SongReferenceDto[];

      if (songs && songs.length > 0) {
        // Use provided songs
        console.log('Using provided songs for analysis');
        songsForAnalysis = songs;
      } else {
        // Retrieve user's current library
        console.log('Retrieving user library for analysis');
        const libraryResult = await this.userLibraryService.getUserLibrary({
          page: 1,
          limit: 100, // Reasonable limit for AI analysis
        });

        if (libraryResult.data.length === 0) {
          console.log('User has no songs in library');
          throw new Error('INVALID_REQUEST');
        }

        // Transform library data to SongReferenceDto format
        songsForAnalysis = libraryResult.data.map(item => ({
          song_details: {
            title: item.song_details.title,
            composer: item.song_details.composer,
          },
        }));

        console.log('Retrieved', songsForAnalysis.length, 'songs from user library');
      }

      // Generate AI suggestions using the AI service
      console.log('Calling AI service for suggestions');
      const aiResponse = await this.aiService.generateSuggestions(songsForAnalysis);

      console.log('AI suggestions generated successfully for user:', userId, {
        suggestionCount: aiResponse.suggestions.length,
        feedbackId: aiResponse.feedback_id,
      });

      return aiResponse;
    } catch (error) {
      console.error('Error generating AI suggestions for user:', userId, error);

      // Re-throw with appropriate error codes
      if (error instanceof Error) {
        throw error;
      }

      // Default to internal error for unexpected issues
      throw new Error('INTERNAL_ERROR');
    }
  }
}
