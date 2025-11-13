import { Injectable, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from './supabase.service';
import type { User } from '@supabase/supabase-js';

/**
 * Manages user authentication state using Angular signals.
 * Wraps Supabase Auth functionality and provides reactive user state.
 * Singleton service that initializes on app startup.
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly router = inject(Router);

  /**
   * Current authenticated user
   * null when not authenticated, User object when authenticated
   */
  readonly user = signal<User | null>(null);

  /**
   * Loading state during initial session check
   * true until we verify if user is authenticated
   */
  readonly isLoading = signal<boolean>(true);

  /**
   * Computed authentication status
   * Derived from user signal - true if user exists
   */
  readonly isAuthenticated = signal<boolean>(false);

  constructor() {
    this.initializeSession();
  }

  /**
   * Initializes user session on app startup.
   * Checks for existing Supabase session and restores user state.
   * Sets isLoading to false once check is complete.
   */
  private async initializeSession(): Promise<void> {
    try {
      console.log('Initializing authentication session');

      const {
        data: { user },
        error,
      } = await this.supabaseService.client.auth.getUser();

      if (error) {
        console.error('Error checking session:', error);
        this.user.set(null);
        this.isAuthenticated.set(false);
      } else if (user) {
        console.log('Session restored for user:', user.id);
        this.user.set(user);
        this.isAuthenticated.set(true);
      } else {
        console.log('No existing session found');
        this.user.set(null);
        this.isAuthenticated.set(false);
      }
    } catch (error) {
      console.error('Unexpected error during session initialization:', error);
      this.user.set(null);
      this.isAuthenticated.set(false);
    } finally {
      this.isLoading.set(false);
    }

    // Subscribe to auth changes for real-time updates
    this.subscribeToAuthChanges();
  }

  /**
   * Subscribes to Supabase auth state changes
   * Updates user and isAuthenticated signals when auth state changes
   */
  private subscribeToAuthChanges(): void {
    const {
      data: { subscription },
    } = this.supabaseService.client.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event);

      if (session?.user) {
        this.user.set(session.user);
        this.isAuthenticated.set(true);
      } else {
        this.user.set(null);
        this.isAuthenticated.set(false);
      }
    });

    // Cleanup would happen here if needed
    if (subscription) {
      console.log('Auth state change subscription established');
    }
  }

  /**
   * Signs out the current user
   * Clears user state and redirects to public library
   */
  async logout(): Promise<void> {
    try {
      console.log('Logging out user');

      const { error } = await this.supabaseService.client.auth.signOut();

      if (error) {
        console.error('Error during logout:', error);
        throw error;
      }

      this.user.set(null);
      this.isAuthenticated.set(false);

      console.log('Logout successful');
      await this.router.navigate(['/app/discover']);
    } catch (error) {
      console.error('Unexpected error during logout:', error);
      throw error;
    }
  }

  /**
   * Gets the current user's email
   * Returns user email or 'User' if not available
   */
  getUserEmail(): string {
    const currentUser = this.user();
    return currentUser?.email || 'User';
  }
}
