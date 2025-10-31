import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

/**
 * Root redirect component that checks authentication status
 * and redirects users to the appropriate starting page.
 *
 * - Authenticated users: /app/library
 * - Unauthenticated users: /login
 * - 404 fallback: /login (safe default)
 */
@Component({
  selector: 'app-root-redirect',
  standalone: true,
  template: '', // No template needed, just redirects
  styleUrls: ['./root-redirect.component.scss'],
})
export class RootRedirectComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  ngOnInit(): void {
    this.performRedirect();
  }

  /**
   * Checks authentication status and performs appropriate redirect
   */
  private async performRedirect(): Promise<void> {
    try {
      // Check if user is authenticated
      const isAuthenticated = await this.checkAuthenticationStatus();

      if (isAuthenticated) {
        // Authenticated users go to their library
        console.log('Authenticated user detected, redirecting to /app/library');
        await this.router.navigate(['/app/library']);
      } else {
        // Unauthenticated users go to login
        console.log('No authenticated user, redirecting to /login');
        await this.router.navigate(['/login']);
      }
    } catch (error) {
      // On error, default to login page (safe fallback)
      console.error('Error checking authentication status, redirecting to /login:', error);
      await this.router.navigate(['/login']);
    }
  }

  /**
   * Checks if the user has an active authenticated session
   */
  private async checkAuthenticationStatus(): Promise<boolean> {
    try {
      // Use AuthService to check authentication status
      // Wait for initial session check to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check the authentication signal
      return this.authService.isAuthenticated();
    } catch (error) {
      console.error('Error checking authentication status:', error);
      return false;
    }
  }
}
