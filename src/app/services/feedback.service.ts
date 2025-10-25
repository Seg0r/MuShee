import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthenticationError, ValidationError, NotFoundError } from '../models/errors';
import type {
  SubmitRenderingFeedbackCommand,
  SubmitRenderingFeedbackResponseDto,
  UpdateAiSuggestionFeedbackCommand,
  UpdateAiSuggestionFeedbackResponseDto,
} from '../../types';

/**
 * Service for managing feedback-related operations.
 * Handles business logic for rendering feedback submission with validation and access control.
 */
@Injectable({
  providedIn: 'root',
})
export class FeedbackService {
  private readonly supabaseService = inject(SupabaseService);

  /**
   * Submits rendering quality feedback for a specific song.
   * Validates user authentication, input parameters, and song access before creating feedback record.
   *
   * @param command - Feedback submission command containing song_id and rating
   * @returns Promise resolving to SubmitRenderingFeedbackResponseDto with created feedback details
   * @throws AuthenticationError if user is not authenticated
   * @throws ValidationError if song_id is invalid UUID or rating is not 1/-1
   * @throws NotFoundError if song doesn't exist or user doesn't have access
   */
  async submitRenderingFeedback(
    command: SubmitRenderingFeedbackCommand
  ): Promise<SubmitRenderingFeedbackResponseDto> {
    try {
      console.log('Processing rendering feedback submission:', {
        songId: command.song_id,
        rating: command.rating,
      });

      // Step 1: Authentication check
      const {
        data: { user },
        error: authError,
      } = await this.supabaseService.client.auth.getUser();
      if (authError || !user) {
        console.warn('Feedback submission failed: Authentication required', { authError });
        throw new AuthenticationError('Authentication required');
      }

      // Step 2: Validate input parameters
      this.validateRenderingFeedbackCommand(command);

      // Step 3: Check song access (verifies song exists and user has access)
      const hasAccess = await this.supabaseService.checkSongAccessible(command.song_id, user.id);
      if (!hasAccess) {
        // Determine specific error type by checking if song exists
        const { data: songExists } = await this.supabaseService.client
          .from('songs')
          .select('id')
          .eq('id', command.song_id)
          .single();

        if (!songExists) {
          console.log('Song not found for feedback:', command.song_id);
          throw new NotFoundError('Song not found', 'SONG_NOT_FOUND');
        } else {
          console.log('Access denied for feedback on song:', {
            songId: command.song_id,
            userId: user.id,
          });
          throw new NotFoundError('Song not found', 'SONG_NOT_FOUND'); // Same error for security
        }
      }

      // Step 4: Submit feedback using SupabaseService
      const feedbackRecord = await this.supabaseService.submitRenderingFeedback({
        ...command,
        user_id: user.id,
      });

      // Step 5: Transform and return response DTO
      const responseDto: SubmitRenderingFeedbackResponseDto = {
        id: feedbackRecord.id,
        user_id: feedbackRecord.user_id,
        song_id: feedbackRecord.song_id,
        rating: feedbackRecord.rating,
        created_at: feedbackRecord.created_at,
      };

      console.log('Rendering feedback submitted successfully:', {
        feedbackId: feedbackRecord.id,
        songId: command.song_id,
        rating: command.rating,
        userId: user.id,
      });

      return responseDto;
    } catch (error) {
      // Re-throw known application errors
      if (
        error instanceof AuthenticationError ||
        error instanceof ValidationError ||
        error instanceof NotFoundError
      ) {
        throw error;
      }

      // Log unexpected errors and wrap as internal error
      console.error(
        'Unexpected error in submitRenderingFeedback:',
        {
          songId: command.song_id,
          rating: command.rating,
        },
        error
      );
      throw error; // Let global error handler convert to appropriate response
    }
  }

  /**
   * Validates the rendering feedback command parameters.
   * Checks song_id format and rating value constraints.
   *
   * @param command - Command to validate
   * @throws ValidationError if validation fails
   */
  private validateRenderingFeedbackCommand(command: SubmitRenderingFeedbackCommand): void {
    // Validate song_id format
    if (!this.isValidUUID(command.song_id)) {
      console.warn('Invalid song_id format in feedback command:', command.song_id);
      throw new ValidationError('Invalid song ID format', 'INVALID_REQUEST');
    }

    // Validate rating value
    if (command.rating !== 1 && command.rating !== -1) {
      console.warn('Invalid rating value in feedback command:', command.rating);
      throw new ValidationError(
        'Rating must be 1 (thumbs up) or -1 (thumbs down)',
        'INVALID_RATING'
      );
    }

    // Validation passed
  }

  /**
   * Updates AI suggestion feedback with user ratings for multiple suggestions.
   * Validates feedback ownership, suggestion structure matching, and calculates aggregate rating score.
   *
   * @param command - Feedback update command containing feedbackId and user ratings
   * @returns Promise resolving to UpdateAiSuggestionFeedbackResponseDto with updated feedback details
   * @throws AuthenticationError if user is not authenticated
   * @throws ValidationError if feedbackId is invalid UUID or suggestions array is malformed
   * @throws NotFoundError if feedback record doesn't exist or user doesn't own it
   */
  async updateAiSuggestionFeedback(
    command: UpdateAiSuggestionFeedbackCommand
  ): Promise<UpdateAiSuggestionFeedbackResponseDto> {
    let userId: string | undefined;

    try {
      console.log('Processing AI suggestion feedback update:', {
        feedbackId: command.feedbackId,
        suggestionCount: command.suggestions.length,
      });

      // Step 1: Authentication check
      const {
        data: { user },
        error: authError,
      } = await this.supabaseService.client.auth.getUser();
      if (authError || !user) {
        console.warn('Feedback update failed: Authentication required', { authError });
        throw new AuthenticationError('Authentication required');
      }

      userId = user.id;

      // Step 2: Validate input parameters
      this.validateUpdateAiSuggestionFeedbackCommand(command);

      // Step 3: Update feedback using SupabaseService
      const updatedFeedbackRecord = await this.supabaseService.updateAiSuggestionFeedback(
        command.feedbackId,
        userId,
        command.suggestions
      );

      // Step 4: Transform and return response DTO
      const responseDto: UpdateAiSuggestionFeedbackResponseDto = {
        id: updatedFeedbackRecord.id,
        rating_score: updatedFeedbackRecord.rating_score,
        updated_at: updatedFeedbackRecord.updated_at,
      };

      console.log('AI suggestion feedback updated successfully:', {
        feedbackId: command.feedbackId,
        ratingScore: updatedFeedbackRecord.rating_score,
        userId,
        ratedCount: command.suggestions.filter(s => s.user_rating !== null).length,
      });

      return responseDto;
    } catch (error) {
      // Re-throw known application errors
      if (
        error instanceof AuthenticationError ||
        error instanceof ValidationError ||
        error instanceof NotFoundError
      ) {
        throw error;
      }

      // Handle Supabase-specific errors
      if (error instanceof Error) {
        if (error.message.includes('Feedback record not found')) {
          console.log('Feedback record not found during update:', command.feedbackId);
          throw new NotFoundError('Feedback record not found', 'FEEDBACK_NOT_FOUND');
        }
        if (error.message.includes('Access denied')) {
          console.log('Access denied for feedback update:', {
            feedbackId: command.feedbackId,
            userId,
          });
          throw new NotFoundError('Feedback record not found', 'FEEDBACK_NOT_FOUND'); // Same error for security
        }
        if (error.message.includes('Invalid suggestions format')) {
          console.warn('Invalid suggestions format in feedback update:', command.feedbackId);
          throw new ValidationError(
            'Invalid suggestions format, mismatch with original suggestions, or invalid rating values',
            'INVALID_REQUEST'
          );
        }
      }

      // Log unexpected errors and wrap as internal error
      console.error(
        'Unexpected error in updateAiSuggestionFeedback:',
        {
          feedbackId: command.feedbackId,
          suggestionCount: command.suggestions.length,
        },
        error
      );
      throw error; // Let global error handler convert to appropriate response
    }
  }

  /**
   * Validates the update AI suggestion feedback command parameters.
   * Checks feedbackId format, suggestions array structure, and individual rating values.
   *
   * @param command - Command to validate
   * @throws ValidationError if validation fails
   */
  private validateUpdateAiSuggestionFeedbackCommand(
    command: UpdateAiSuggestionFeedbackCommand
  ): void {
    // Validate feedbackId format
    if (!this.isValidUUID(command.feedbackId)) {
      console.warn('Invalid feedbackId format in update command:', command.feedbackId);
      throw new ValidationError('Invalid feedback ID format', 'INVALID_REQUEST');
    }

    // Validate suggestions array
    if (!Array.isArray(command.suggestions) || command.suggestions.length === 0) {
      console.warn('Invalid suggestions array in update command:', command.suggestions);
      throw new ValidationError('Suggestions must be a non-empty array', 'INVALID_REQUEST');
    }

    // Validate each suggestion
    for (let i = 0; i < command.suggestions.length; i++) {
      const suggestion = command.suggestions[i];

      // Check required fields
      if (!suggestion.title || typeof suggestion.title !== 'string') {
        console.warn(`Invalid title in suggestion ${i}:`, suggestion.title);
        throw new ValidationError('Each suggestion must have a valid title', 'INVALID_REQUEST');
      }

      if (!suggestion.composer || typeof suggestion.composer !== 'string') {
        console.warn(`Invalid composer in suggestion ${i}:`, suggestion.composer);
        throw new ValidationError('Each suggestion must have a valid composer', 'INVALID_REQUEST');
      }

      // Validate rating value
      if (
        suggestion.user_rating !== null &&
        suggestion.user_rating !== -1 &&
        suggestion.user_rating !== 1
      ) {
        console.warn(`Invalid rating value in suggestion ${i}:`, suggestion.user_rating);
        throw new ValidationError(
          'Rating must be -1 (thumbs down), 1 (thumbs up), or null (unrated)',
          'INVALID_RATING'
        );
      }
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
}
