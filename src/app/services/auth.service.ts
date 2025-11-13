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

  /**
   * Flag to track if initialization is in progress to prevent race conditions
   */
  private isInitializing = false;

  constructor() {
    // Defer initialization with a microtask to avoid race conditions with Navigator LockManager
    // This prevents NavigatorLockAcquireTimeoutError that occurs when multiple initialization calls happen simultaneously
    queueMicrotask(() => {
      this.initializeSession().catch(error => {
        console.error('Fatal error during auth initialization:', error);
        // Ensure loading state is set to false even if initialization fails catastrophically
        this.isLoading.set(false);
      });
    });
  }

  /**
   * Initializes user session on app startup with retry logic.
   * Checks for existing Supabase session and restores user state.
   * Sets isLoading to false once check is complete.
   * Implements exponential backoff retry for transient failures.
   */
  private async initializeSession(): Promise<void> {
    // Prevent concurrent initialization attempts
    if (this.isInitializing) {
      console.log('Auth initialization already in progress, skipping duplicate attempt');
      return;
    }

    this.isInitializing = true;

    try {
      console.log('Initializing authentication session');

      const { user, error } = await this.getSessionWithRetry();

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
      this.isInitializing = false;

      // Subscribe to auth changes for real-time updates
      this.subscribeToAuthChanges();
    }
  }

  /**
   * Attempts to get the current session with exponential backoff retry.
   * Handles NavigatorLockAcquireTimeoutError and other transient failures.
   *
   * @param maxRetries - Maximum number of retry attempts (default: 3)
   * @param delay - Initial delay in ms (default: 100, doubles on each retry)
   * @returns Promise resolving to { user, error } tuple
   */
  private async getSessionWithRetry(
    maxRetries = 3,
    delay = 100
  ): Promise<{ user: User | null; error: unknown | null }> {
    let lastError: unknown = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const { data, error } = await this.supabaseService.client.auth.getUser();

        if (!error) {
          return { user: data.user, error: null };
        }

        // If error is not a lock timeout, return immediately
        const errorStr = String(error).toLowerCase();
        if (!errorStr.includes('lock') && !errorStr.includes('timeout')) {
          return { user: null, error };
        }

        lastError = error;
      } catch (err) {
        lastError = err;
        const errStr = String(err).toLowerCase();

        // If not a lock-related error, rethrow immediately
        if (!errStr.includes('lock') && !errStr.includes('timeout')) {
          throw err;
        }
      }

      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries - 1) {
        const waitTime = delay * Math.pow(2, attempt);
        console.warn(
          `Auth session retrieval failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${waitTime}ms...`
        );
        await this.sleep(waitTime);
      }
    }

    // If all retries failed, log and return error
    console.error('Auth session retrieval failed after all retry attempts:', lastError);
    return { user: null, error: lastError };
  }

  /**
   * Utility function to sleep for a specified duration.
   *
   * @param ms - Duration in milliseconds
   * @returns Promise that resolves after the specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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
