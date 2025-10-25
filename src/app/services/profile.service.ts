import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import type { ProfileDto, UpdateProfileCommand, UpdateProfileResponseDto } from '../../types';
import { AuthenticationError, NotFoundError, ValidationError } from '../../app/models/errors';

/**
 * Configuration for profile service behavior.
 */
export interface ProfileServiceConfig {
  /** Whether to automatically create profiles when they don't exist */
  autoCreateProfiles: boolean;
}

/**
 * Service for managing user profile operations.
 * Handles profile retrieval, authentication checks, and profile creation.
 */
@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  private readonly supabaseService = inject(SupabaseService);

  /**
   * Configuration for profile service behavior.
   * Controls whether profiles are automatically created when not found.
   */
  private config: ProfileServiceConfig = {
    autoCreateProfiles: true, // Enable auto-creation by default for better UX
  };

  /**
   * Updates the profile service configuration.
   * @param config - New configuration to apply
   */
  updateConfig(config: Partial<ProfileServiceConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Validates the structure and content of an UpdateProfileCommand.
   * Ensures all required fields are present and have correct types.
   *
   * @param command - The update command to validate
   * @throws ValidationError if validation fails
   */
  private validateUpdateProfileCommand(command: UpdateProfileCommand): void {
    // Check if has_completed_onboarding is provided and is boolean
    if (
      command.has_completed_onboarding !== undefined &&
      typeof command.has_completed_onboarding !== 'boolean'
    ) {
      throw new ValidationError('has_completed_onboarding must be a boolean');
    }
  }

  /**
   * Retrieves the current authenticated user's profile.
   * Handles authentication validation and profile existence checks.
   * Can automatically create profiles if configured to do so.
   *
   * @returns Promise resolving to the user's ProfileDto
   * @throws AuthenticationError if user is not authenticated
   * @throws NotFoundError if profile does not exist and auto-creation is disabled
   */
  async getCurrentUserProfile(): Promise<ProfileDto> {
    try {
      // Get authenticated user from Supabase Auth
      const {
        data: { user },
        error: authError,
      } = await this.supabaseService.client.auth.getUser();

      if (authError || !user) {
        console.warn('Profile retrieval failed: Authentication required', { authError });
        throw new AuthenticationError('Authentication required');
      }

      console.log('Retrieving profile for user:', user.id);

      // Attempt to retrieve existing profile
      const existingProfile = await this.supabaseService.getUserProfile(user.id);

      if (existingProfile) {
        console.log('Profile found for user:', user.id);
        return existingProfile;
      }

      // Profile doesn't exist - handle based on configuration
      if (this.config.autoCreateProfiles) {
        console.log('Profile not found, auto-creating profile for user:', user.id);
        // Automatically create the profile
        const newProfile = await this.supabaseService.createUserProfile(user.id);
        console.log('Profile created successfully for user:', user.id);
        return newProfile;
      } else {
        console.warn('Profile not found and auto-creation disabled for user:', user.id);
        // Return not found error if auto-creation is disabled
        throw new NotFoundError('User profile does not exist', 'PROFILE_NOT_FOUND');
      }
    } catch (error) {
      // Re-throw known application errors
      if (error instanceof AuthenticationError || error instanceof NotFoundError) {
        throw error;
      }

      // Log unexpected errors
      console.error('Unexpected error in getCurrentUserProfile:', error);

      // Wrap unexpected errors as internal errors
      throw error; // Let caller handle generic error mapping
    }
  }

  /**
   * Updates the current authenticated user's profile with the provided changes.
   * Handles authentication validation, request validation, and profile existence checks.
   *
   * @param updates - The profile fields to update
   * @returns Promise resolving to the updated UpdateProfileResponseDto
   * @throws AuthenticationError if user is not authenticated
   * @throws ValidationError if request payload is invalid
   * @throws NotFoundError if user profile does not exist
   */
  async updateCurrentUserProfile(updates: UpdateProfileCommand): Promise<UpdateProfileResponseDto> {
    try {
      // Validate the update command
      this.validateUpdateProfileCommand(updates);

      // Get authenticated user from Supabase Auth
      const {
        data: { user },
        error: authError,
      } = await this.supabaseService.client.auth.getUser();

      if (authError || !user) {
        console.warn('Profile update failed: Authentication required', { authError });
        throw new AuthenticationError('Authentication required');
      }

      console.log('Updating profile for user:', user.id, 'with updates:', updates);

      // Check if profile exists before attempting update
      const existingProfile = await this.supabaseService.getUserProfile(user.id);
      if (!existingProfile) {
        console.warn('Profile not found for update, user:', user.id);
        throw new NotFoundError('User profile does not exist', 'PROFILE_NOT_FOUND');
      }

      // Perform the profile update
      const updatedProfile = await this.supabaseService.updateUserProfile(user.id, updates);

      console.log('Profile updated successfully for user:', user.id);
      return updatedProfile;
    } catch (error) {
      // Re-throw known application errors
      if (
        error instanceof AuthenticationError ||
        error instanceof NotFoundError ||
        error instanceof ValidationError
      ) {
        throw error;
      }

      // Log unexpected errors
      console.error('Unexpected error in updateCurrentUserProfile:', error);

      // Wrap unexpected errors as internal errors
      throw error; // Let caller handle generic error mapping
    }
  }
}
