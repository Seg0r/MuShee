import { Injectable, inject } from '@angular/core';
import type { ProfileDto, UpdateProfileCommand, UpdateProfileResponseDto } from '../../types';
import { SupabaseService } from './supabase.service';

/**
 * Service for managing user profile operations.
 * Provides high-level profile management functionality with proper error handling.
 */
@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  private readonly supabaseService = inject(SupabaseService);

  /**
   * Retrieves the current authenticated user's profile.
   * Automatically creates a profile if one doesn't exist.
   *
   * @returns The user's profile data
   * @throws Error if profile retrieval or creation fails
   */
  async getCurrentUserProfile(): Promise<ProfileDto> {
    try {
      console.log('Getting current user profile');
      const {
        data: { user },
        error: authError,
      } = await this.supabaseService.client.auth.getUser();

      if (authError || !user) {
        console.error('Authentication failed:', authError);
        throw new Error('Authentication required');
      }

      console.log('User authenticated:', user.id);
      const profile = await this.supabaseService.getUserProfile(user.id);

      if (profile) {
        console.log('Profile found for user:', user.id);
        return profile;
      }

      console.log('Profile not found, creating new profile for user:', user.id);
      const newProfile = await this.supabaseService.createUserProfile(user.id);
      console.log('New profile created for user:', user.id);

      return newProfile;
    } catch (error) {
      console.error('Failed to get current user profile:', error);
      throw error;
    }
  }

  /**
   * Updates the current authenticated user's profile.
   * Validates authentication and input before performing the update.
   *
   * @param updates - The profile updates to apply
   * @returns The updated profile data
   * @throws Error if authentication fails, validation fails, or update fails
   */
  async updateCurrentUserProfile(updates: UpdateProfileCommand): Promise<UpdateProfileResponseDto> {
    try {
      console.log('Updating user profile:', updates);
      const {
        data: { user },
        error: authError,
      } = await this.supabaseService.client.auth.getUser();

      if (authError || !user) {
        console.error('Authentication failed during profile update:', authError);
        throw new Error('Authentication required');
      }

      console.log('User authenticated for update:', user.id);
      this.validateUpdateCommand(updates);
      console.log('Profile update validated');

      const updatedProfile = await this.supabaseService.updateUserProfile(user.id, updates);
      console.log('Profile updated successfully for user:', user.id);

      return updatedProfile;
    } catch (error) {
      console.error('Failed to update user profile:', error);
      throw error;
    }
  }

  /**
   * Validates the profile update command.
   * Ensures all required fields are present and have correct types.
   *
   * @param updates - The update command to validate
   * @throws Error if validation fails
   */
  private validateUpdateCommand(updates: UpdateProfileCommand): void {
    // Validate has_completed_onboarding field if provided
    if (updates.has_completed_onboarding !== undefined) {
      if (typeof updates.has_completed_onboarding !== 'boolean') {
        throw new Error('has_completed_onboarding must be a boolean');
      }
    }
  }
}
