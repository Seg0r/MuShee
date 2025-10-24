import { Injectable } from '@angular/core';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import type { Database } from '../../db/database.types';
import type { ProfileDto } from '../../types';

/**
 * Service for managing Supabase client and database operations.
 * Provides centralized access to Supabase functionality with proper typing.
 */
@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  /**
   * Supabase client instance with proper Database typing.
   * Access the client through this property for all database operations.
   */
  readonly client: SupabaseClient<Database>;

  constructor() {
    // Initialize Supabase client with environment variables
    const supabaseUrl = 'YOUR_SUPABASE_URL'; // TODO: Replace with environment variable
    const supabaseKey = 'YOUR_SUPABASE_ANON_KEY'; // TODO: Replace with environment variable

    this.client = createClient<Database>(supabaseUrl, supabaseKey);
  }

  /**
   * Retrieves a user profile by user ID.
   * Returns null if profile does not exist.
   *
   * @param userId - The UUID of the user
   * @returns Promise resolving to ProfileDto or null
   */
  async getUserProfile(userId: string): Promise<ProfileDto | null> {
    try {
      console.log('Querying profiles table for user:', userId);

      const { data, error } = await this.client
        .from('profiles')
        .select('id, updated_at, has_completed_onboarding')
        .eq('id', userId)
        .single();

      if (error) {
        // Profile not found returns null, other errors should be handled by caller
        if (error.code === 'PGRST116') {
          console.log('Profile not found for user:', userId);
          return null;
        }

        console.error('Database error retrieving profile for user:', userId, error);
        throw error;
      }

      console.log('Profile retrieved successfully for user:', userId);
      return data as ProfileDto;
    } catch (error) {
      console.error('Unexpected error in getUserProfile:', error);
      throw error;
    }
  }

  /**
   * Creates a new user profile with default values.
   *
   * @param userId - The UUID of the user
   * @returns Promise resolving to the created ProfileDto
   */
  async createUserProfile(userId: string): Promise<ProfileDto> {
    try {
      console.log('Creating new profile for user:', userId);

      const { data, error } = await this.client
        .from('profiles')
        .insert({
          id: userId,
          has_completed_onboarding: false,
        })
        .select('id, updated_at, has_completed_onboarding')
        .single();

      if (error) {
        console.error('Database error creating profile for user:', userId, error);
        throw error;
      }

      console.log('Profile created successfully for user:', userId);
      return data as ProfileDto;
    } catch (error) {
      console.error('Unexpected error in createUserProfile:', error);
      throw error;
    }
  }
}
