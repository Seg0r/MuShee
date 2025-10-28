import { Routes } from '@angular/router';
import { publicOnlyGuard } from './guards/public-only.guard';

export const routes: Routes = [
  // Root redirect - routes to login if not authenticated
  {
    path: '',
    redirectTo: '/login',
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

  // Protected routes will be added here
  // {
  //   path: 'library',
  //   loadComponent: () => import('./components/library/library.component').then(m => m.LibraryComponent),
  //   canActivate: [authGuard],
  //   data: { title: 'My Library - MuShee' }
  // }

  // Wildcard route for 404 handling
  {
    path: '**',
    redirectTo: '/login',
  },
];
