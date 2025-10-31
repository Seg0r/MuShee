import { Routes } from '@angular/router';
import { publicOnlyGuard, authGuard } from './guards/public-only.guard';

export const routes: Routes = [
  // Root redirect - checks auth status and redirects accordingly
  {
    path: '',
    loadComponent: () =>
      import('./components/root-redirect/root-redirect.component').then(
        m => m.RootRedirectComponent
      ),
    pathMatch: 'full',
  },

  // Public auth routes (no shell layout)
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

  // Full-screen sheet music viewer (no shell layout)
  {
    path: 'song/:songId',
    loadComponent: () =>
      import('./components/sheet-music-viewer/sheet-music-viewer.component').then(
        m => m.SheetMusicViewerComponent
      ),
    data: { title: 'Sheet Music - MuShee' },
  },

  // Shell layout wrapper routes
  {
    path: 'app',
    loadComponent: () =>
      import('./components/app-shell/app-shell.component').then(m => m.AppShellComponent),
    children: [
      // Protected library route
      {
        path: 'library',
        loadComponent: () =>
          import('./components/library/library.component').then(m => m.LibraryComponent),
        canActivate: [authGuard],
        data: { title: 'My Library - MuShee' },
      },

      // Public discover route (accessible to all users)
      {
        path: 'discover',
        loadComponent: () =>
          import('./components/discover/discover.component').then(m => m.DiscoverComponent),
        data: { title: 'Discover - MuShee' },
      },
    ],
  },

  // Wildcard route for 404 handling
  {
    path: '**',
    loadComponent: () =>
      import('./components/root-redirect/root-redirect.component').then(
        m => m.RootRedirectComponent
      ),
  },
];
