import { Routes } from '@angular/router';
import { publicOnlyGuard, authGuard } from './guards/public-only.guard';

export const routes: Routes = [
  // Root redirect - routes to discover view (public access)
  {
    path: '',
    redirectTo: '/discover',
    pathMatch: 'full',
  },

  // Public auth routes
  {
    path: 'login',
    loadComponent: () => import('./components/login/login.component').then(m => m.LoginComponent),
    canActivate: [publicOnlyGuard],
    data: { title: 'Login - MuShee' },
  },

  {
    path: 'register',
    loadComponent: () =>
      import('./components/registration/registration.component').then(m => m.RegistrationComponent),
    canActivate: [publicOnlyGuard],
    data: { title: 'Create Account - MuShee' },
  },

  // Public discover route
  {
    path: 'discover',
    loadComponent: () =>
      import('./components/discover/discover.component').then(m => m.DiscoverComponent),
    data: { title: 'Discover - MuShee' },
  },

  // Protected routes
  {
    path: 'library',
    loadComponent: () =>
      import('./components/library/library.component').then(m => m.LibraryComponent),
    canActivate: [authGuard],
    data: { title: 'My Library - MuShee' },
  },

  // Wildcard route for 404 handling
  {
    path: '**',
    redirectTo: '/discover',
  },
];
