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
