import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import type { ProfileDto } from '../../types';
import { AuthenticationError, NotFoundError } from '../../app/models/errors';

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
}
