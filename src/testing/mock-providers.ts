/**
 * Mock providers and common test utilities for unit tests.
 * Use these in your TestBed.configureTestingModule() to set up common mocks.
 *
 * Example usage:
 * await TestBed.configureTestingModule({
 *   imports: [MyComponent],
 *   providers: [getMockProviders()],
 * }).compileComponents();
 */

import { Provider } from '@angular/core';
import { AuthService } from '@/app/services/auth.service';
import { SongService } from '@/app/services/song.service';
import { SupabaseService } from '@/app/services/supabase.service';
import { UserLibraryService } from '@/app/services/user-library.service';
import { ProfileService } from '@/app/services/profile.service';
import { FeedbackService } from '@/app/services/feedback.service';
import { ThemeService } from '@/app/services/theme.service';
import { ErrorHandlingService } from '@/app/services/error-handling.service';

/**
 * Creates mock service providers for common services.
 * Usage: TestBed.configureTestingModule({ providers: [...getMockProviders()] })
 */
export function getMockProviders(): Provider[] {
  return [
    { provide: AuthService, useValue: jasmine.createSpyObj('AuthService', []) },
    { provide: SongService, useValue: jasmine.createSpyObj('SongService', []) },
    { provide: SupabaseService, useValue: jasmine.createSpyObj('SupabaseService', []) },
    { provide: UserLibraryService, useValue: jasmine.createSpyObj('UserLibraryService', []) },
    { provide: ProfileService, useValue: jasmine.createSpyObj('ProfileService', []) },
    { provide: FeedbackService, useValue: jasmine.createSpyObj('FeedbackService', []) },
    { provide: ThemeService, useValue: jasmine.createSpyObj('ThemeService', []) },
    { provide: ErrorHandlingService, useValue: jasmine.createSpyObj('ErrorHandlingService', []) },
  ];
}

/**
 * Creates a mock AuthService with default spy methods
 */
export function createMockAuthService(): jasmine.SpyObj<AuthService> {
  return jasmine.createSpyObj('AuthService', [
    'initializeSession',
    'login',
    'logout',
    'signup',
    'resetPassword',
  ]);
}

/**
 * Creates a mock SongService with default spy methods
 */
export function createMockSongService(): jasmine.SpyObj<SongService> {
  return jasmine.createSpyObj('SongService', [
    'getPublicSongsList',
    'uploadSong',
    'getSongDetails',
  ]);
}

/**
 * Creates a mock SupabaseService with default spy methods
 */
export function createMockSupabaseService(): jasmine.SpyObj<SupabaseService> {
  return jasmine.createSpyObj('SupabaseService', ['getClient']);
}

/**
 * Creates a mock UserLibraryService with default spy methods
 */
export function createMockUserLibraryService(): jasmine.SpyObj<UserLibraryService> {
  return jasmine.createSpyObj('UserLibraryService', [
    'getUserLibrary',
    'addSongToLibrary',
    'removeSongFromLibrary',
  ]);
}

/**
 * Creates a mock ProfileService with default spy methods
 */
export function createMockProfileService(): jasmine.SpyObj<ProfileService> {
  return jasmine.createSpyObj('ProfileService', ['getProfile', 'updateProfile']);
}

/**
 * Creates a mock FeedbackService with default spy methods
 */
export function createMockFeedbackService(): jasmine.SpyObj<FeedbackService> {
  return jasmine.createSpyObj('FeedbackService', [
    'submitRenderingFeedback',
    'submitAiSuggestionFeedback',
  ]);
}

/**
 * Creates a mock ThemeService with default spy methods
 */
export function createMockThemeService(): jasmine.SpyObj<ThemeService> {
  return jasmine.createSpyObj('ThemeService', ['toggleTheme', 'setTheme']);
}

/**
 * Creates a mock ErrorHandlingService with default spy methods
 */
export function createMockErrorHandlingService(): jasmine.SpyObj<ErrorHandlingService> {
  return jasmine.createSpyObj('ErrorHandlingService', ['handleError', 'handleHttpError']);
}
