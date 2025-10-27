import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  inject,
  OnInit,
} from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../services/supabase.service';
import { ProfileService } from '../../services/profile.service';
import { ErrorHandlingService } from '../../services/error-handling.service';
import { AuthFormComponent } from '../auth-form/auth-form.component';
import type { AuthError, LoginFormData } from '../../models/login';

/**
 * Main container component for the login view.
 * Manages authentication flow, session checking, and redirects.
 * Delegates form display to AuthFormComponent (presentational).
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, AuthFormComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent implements OnInit {
  /**
   * Injected services
   */
  private readonly supabaseService = inject(SupabaseService);
  private readonly profileService = inject(ProfileService);
  private readonly errorHandlingService = inject(ErrorHandlingService);
  private readonly router = inject(Router);

  /**
   * State signals
   */
  formLoading = signal<boolean>(false);
  authError = signal<AuthError | null>(null);
  isSessionChecking = signal<boolean>(true);

  /**
   * Computed derived state
   */
  isFormVisible = computed<boolean>(() => !this.isSessionChecking());

  ngOnInit(): void {
    this.checkExistingSession();
  }

  /**
   * Checks if user already has an active session.
   * If authenticated, redirects to library immediately.
   * If not, displays login form.
   */
  private async checkExistingSession(): Promise<void> {
    try {
      this.isSessionChecking.set(true);

      const {
        data: { user },
        error: authError,
      } = await this.supabaseService.client.auth.getUser();

      if (authError || !user) {
        console.log('No active session found, displaying login form');
        this.isSessionChecking.set(false);
        return;
      }

      console.log('Existing session found, redirecting to library');
      // User already authenticated, redirect to library
      await this.router.navigate(['/library']);
    } catch (error) {
      console.error('Error checking existing session:', error);
      // On error, show login form (safe fallback)
      this.isSessionChecking.set(false);
    }
  }

  /**
   * Handles login form submission.
   * Calls Supabase authentication and manages state/navigation.
   *
   * @param formData - Email and password from the form
   */
  async onLoginSubmit(formData: LoginFormData): Promise<void> {
    // Clear previous errors and set loading state
    this.authError.set(null);
    this.formLoading.set(true);

    try {
      // Attempt authentication with Supabase
      const { data, error: signInError } =
        await this.supabaseService.client.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

      if (signInError) {
        // Map Supabase error to user-friendly message using error handling service
        const appError = this.errorHandlingService.mapSupabaseAuthError(signInError);
        this.errorHandlingService.logError(appError, 'LoginComponent.onLoginSubmit');

        // Convert to AuthError for display
        const authError: AuthError = {
          code: appError.code,
          message: appError.message,
          field: 'general',
          timestamp: appError.timestamp,
        };
        this.authError.set(authError);
        console.warn('Login failed:', authError);
        return;
      }

      if (!data?.user || !data?.session) {
        // Unexpected response structure
        const error: AuthError = {
          code: 'INVALID_RESPONSE',
          message: 'Unexpected authentication response. Please try again.',
          field: 'general',
          timestamp: new Date(),
        };
        this.authError.set(error);
        this.errorHandlingService.logError(
          {
            code: error.code,
            message: error.message,
            timestamp: error.timestamp,
          },
          'LoginComponent.onLoginSubmit'
        );
        return;
      }

      // Successful authentication
      console.log('Authentication successful, verifying profile');

      // Verify profile exists (auto-created if configured)
      try {
        await this.profileService.getCurrentUserProfile();
      } catch (profileError) {
        console.error('Profile verification failed:', profileError);
        // Continue anyway, profile will be created via trigger if needed
      }

      // Navigate to library
      console.log('Login complete, redirecting to library');
      await this.router.navigate(['/library']);
    } catch (error) {
      // Handle unexpected errors
      console.error('Unexpected error during login:', error);

      // Map error using error handling service
      let appError = this.errorHandlingService.mapGenericError(error);

      // Try to detect if it's a network error
      if (error instanceof TypeError && String(error).includes('fetch')) {
        appError = this.errorHandlingService.mapNetworkError(error);
      }

      this.errorHandlingService.logError(appError, 'LoginComponent.onLoginSubmit');

      // Convert to AuthError for display
      const authError: AuthError = {
        code: appError.code,
        message: appError.message,
        field: 'general',
        timestamp: appError.timestamp,
      };
      this.authError.set(authError);
    } finally {
      this.formLoading.set(false);
    }
  }
}
