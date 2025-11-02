import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { aiServiceTimeout, TimeoutError } from '../../utils/timeout';
import type { SongReferenceDto, GenerateAiSuggestionsResponseDto } from '../../types';

/**
 * Service for handling AI-powered song suggestions.
 * Manages communication with the AI suggestions Edge Function.
 */
@Injectable({
  providedIn: 'root',
})
export class AiService {
  private readonly supabaseService = inject(SupabaseService);

  /**
   * Generates AI-powered song suggestions based on user's library.
   * Calls the Supabase Edge Function with a 3-second timeout as per PRD requirements.
   *
   * @param songs - Array of song references for AI analysis
   * @returns Promise resolving to array of AI-suggested songs
   * @throws Error with appropriate error codes for different failure scenarios
   */
  async generateSuggestions(songs: SongReferenceDto[]): Promise<GenerateAiSuggestionsResponseDto> {
    try {
      console.log('Generating AI suggestions for', songs.length, 'songs');

      // Validate input - at least one song required
      if (!songs || songs.length === 0) {
        throw new Error('INVALID_REQUEST');
      }

      // Prepare the request payload
      const requestBody = { songs };

      // Call Supabase Edge Function with 3-second timeout (PRD requirement)
      const { data, error } = await aiServiceTimeout(
        this.supabaseService.client.functions.invoke('ai-suggestions', {
          body: JSON.stringify(requestBody),
          headers: {
            'Content-Type': 'application/json',
          },
        })
      );

      if (error) {
        console.error('Edge Function invocation error:', error);

        // Handle timeout errors specifically
        if (error instanceof TimeoutError) {
          throw new Error('REQUEST_TIMEOUT');
        }

        // Handle different error types based on the error message/code
        if (error.message?.includes('503') || error.message?.includes('service unavailable')) {
          throw new Error('AI_SERVICE_UNAVAILABLE');
        }

        if (error.message?.includes('401') || error.message?.includes('unauthorized')) {
          throw new Error('UNAUTHORIZED');
        }

        if (error.message?.includes('400') || error.message?.includes('invalid')) {
          throw new Error('INVALID_REQUEST');
        }

        // Default to service unavailable for unknown errors
        throw new Error('AI_SERVICE_UNAVAILABLE');
      }

      if (!data) {
        console.error('No data returned from AI suggestions Edge Function');
        throw new Error('AI_SERVICE_UNAVAILABLE');
      }

      // Validate response structure
      if (!data.suggestions || !Array.isArray(data.suggestions) || !data.feedback_id) {
        console.error('Invalid response structure from AI suggestions:', data);
        throw new Error('AI_SERVICE_UNAVAILABLE');
      }

      console.log('AI suggestions generated successfully:', {
        suggestionCount: data.suggestions.length,
        feedbackId: data.feedback_id,
      });

      return data as GenerateAiSuggestionsResponseDto;
    } catch (error) {
      console.error('Unexpected error in generateSuggestions:', error);

      // Re-throw with appropriate error code if it's already formatted
      if (
        error instanceof Error &&
        ['INVALID_REQUEST', 'UNAUTHORIZED', 'REQUEST_TIMEOUT', 'AI_SERVICE_UNAVAILABLE'].includes(
          error.message
        )
      ) {
        throw error;
      }

      // Default to internal error for unexpected issues
      throw new Error('INTERNAL_ERROR');
    }
  }
}
