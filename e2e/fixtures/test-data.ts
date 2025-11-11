/**
 * Test data and fixtures for E2E tests
 */

/**
 * Test user accounts
 */
export const TEST_USERS = {
  validUser: {
    email: 'test@example.com',
    password: 'TestPassword123!',
  },
  anotherUser: {
    email: 'another@example.com',
    password: 'AnotherPassword123!',
  },
  newRegistrationUser: {
    email: 'newuser@example.com',
    password: 'NewUserPassword123!',
  },
};

/**
 * Invalid credentials for testing error handling
 */
export const INVALID_CREDENTIALS = {
  invalidEmail: 'invalid@example.com',
  invalidPassword: 'WrongPassword123!',
  emptyEmail: '',
  emptyPassword: '',
  malformedEmail: 'not-an-email',
};

/**
 * Registration test data
 */
export const REGISTRATION_DATA = {
  weakPasswords: {
    tooShort: 'Short1!',
    noUppercase: 'weakpassword123!',
    noLowercase: 'WEAKPASSWORD123!',
    noNumber: 'WeakPassword!',
    noSpecialChar: 'WeakPassword123',
  },
  invalidEmails: {
    missingAt: 'invalidemail.com',
    missingDomain: 'invalid@',
    spaces: 'invalid @example.com',
    specialChars: 'invalid+test@example.com',
  },
};

/**
 * Test songs/sheet music files
 */
export const TEST_SONGS = {
  simpleSong: {
    title: 'Simple Test Song',
    composer: 'Test Composer',
    fileName: 'simple-test-song.mxl',
  },
  complexSong: {
    title: 'Complex Test Song',
    composer: 'Another Composer',
    fileName: 'complex-test-song.mxl',
  },
};

/**
 * UI test selectors (use data-testid attributes)
 */
export const SELECTORS = {
  // Navigation
  homeLink: 'a[href="/"]',
  libraryLink: 'a[href="/library"]',
  discoverLink: 'a[href="/discover"]',
  profileButton: 'button[aria-label="Profile"]',
  logoutButton: 'button:has-text("Logout")',

  // Forms
  emailInput: 'input[type="email"]',
  passwordInput: 'input[type="password"]',
  submitButton: 'button[type="submit"]',
  loginButton: 'button:has-text("Login")',

  // Messages
  errorMessage: '[data-testid="error-message"]',
  successMessage: '[data-testid="success-message"]',
  loadingSpinner: '[data-testid="loading-spinner"]',

  // Library
  songTile: '[data-testid="song-tile"]',
  uploadButton: 'button:has-text("Upload")',
  emptyState: '[data-testid="empty-state"]',

  // Sheet Music Viewer
  sheetViewer: '[data-testid="sheet-music-viewer"]',
  playButton: 'button:has-text("Play")',
  pauseButton: 'button:has-text("Pause")',

  // Discover
  suggestedTile: '[data-testid="suggested-song-tile"]',
};

/**
 * API endpoints for testing
 */
export const API_ENDPOINTS = {
  auth: '/auth',
  songs: '/songs',
  library: '/library',
  suggestions: '/suggestions',
  feedback: '/feedback',
};

/**
 * Timeout values (in milliseconds)
 */
export const TIMEOUTS = {
  short: 1000,
  medium: 5000,
  long: 10000,
  navigation: 8000,
};

/**
 * Base URLs
 */
export const BASE_URLS = {
  dev: 'http://localhost:4200',
  staging: process.env['STAGING_URL'] || 'https://staging.example.com',
  production: process.env['PRODUCTION_URL'] || 'https://example.com',
};

/**
 * Get current base URL based on environment
 */
export function getBaseUrl(env: 'dev' | 'staging' | 'production' = 'dev'): string {
  return BASE_URLS[env];
}
