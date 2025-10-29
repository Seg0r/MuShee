import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';

/**
 * Route guard that ensures only unauthenticated users can access public routes.
 * Redirects authenticated users to /library to prevent accessing login/registration pages.
 *
 * Usage in routes:
 * ```typescript
 * {
 *   path: 'login',
 *   loadComponent: () => LoginComponent,
 *   canActivate: [publicOnlyGuard]
 * }
 * ```
 */
export const publicOnlyGuard: CanActivateFn = async (): Promise<boolean> => {
  const supabaseService = inject(SupabaseService);
  const router = inject(Router);

  try {
    // Check if user has an active authenticated session
    const {
      data: { user },
      error: authError,
    } = await supabaseService.client.auth.getUser();

    // If authentication error or no user, allow access to public route
    if (authError || !user) {
      console.log('No authenticated session found, allowing access to public route');
      return true;
    }

    // User is authenticated, redirect to library
    console.log('Authenticated user detected, redirecting to /library');
    await router.navigate(['/library']);
    return false;
  } catch (error) {
    // On error checking auth status, allow access to public route (safe default)
    console.error('Error checking authentication status in publicOnlyGuard:', error);
    return true;
  }
};

/**
 * Route guard that ensures only authenticated users can access protected routes.
 * Redirects unauthenticated users to /login to require authentication.
 *
 * Usage in routes:
 * ```typescript
 * {
 *   path: 'library',
 *   loadComponent: () => LibraryComponent,
 *   canActivate: [authGuard]
 * }
 * ```
 */
export const authGuard: CanActivateFn = async (): Promise<boolean> => {
  const supabaseService = inject(SupabaseService);
  const router = inject(Router);

  try {
    // Check if user has an active authenticated session
    const {
      data: { user },
      error: authError,
    } = await supabaseService.client.auth.getUser();

    // If authentication error or no user, redirect to login
    if (authError || !user) {
      console.log('No authenticated session found, redirecting to /login');
      await router.navigate(['/login']);
      return false;
    }

    // User is authenticated, allow access to protected route
    console.log('Authenticated user detected, allowing access to protected route');
    return true;
  } catch (error) {
    // On error checking auth status, redirect to login (safe default)
    console.error('Error checking authentication status in authGuard:', error);
    await router.navigate(['/login']);
    return false;
  }
};
