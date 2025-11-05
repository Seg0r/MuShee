/**
 * Page Object Models for E2E tests
 * Implements the Page Object Model pattern for maintainable and reusable test code
 */

import { Page } from '@playwright/test';

/**
 * Base page class providing common utilities
 */
export class BasePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Navigate to a specific URL
   */
  async goto(url: string): Promise<void> {
    await this.page.goto(url);
  }

  /**
   * Wait for URL to match pattern
   */
  async waitForURL(urlPattern: string | RegExp): Promise<void> {
    await this.page.waitForURL(urlPattern);
  }

  /**
   * Get page title
   */
  async getTitle(): Promise<string> {
    return this.page.title();
  }

  /**
   * Wait for text to be visible on page
   */
  async waitForText(text: string): Promise<void> {
    await this.page.waitForSelector(`text=${text}`);
  }

  /**
   * Take a screenshot for visual regression testing
   */
  async takeScreenshot(name: string): Promise<Buffer> {
    return this.page.screenshot({ path: `e2e/screenshots/${name}.png` });
  }

  /**
   * Fill form field and verify value
   */
  async fillField(selector: string, value: string): Promise<void> {
    await this.page.fill(selector, value);
    // Verify the field was filled
    const fieldValue = await this.page.inputValue(selector);
    if (fieldValue !== value) {
      throw new Error(`Failed to fill field. Expected "${value}", got "${fieldValue}"`);
    }
  }

  /**
   * Click button and wait for navigation (if applicable)
   */
  async clickButton(selector: string): Promise<void> {
    await this.page.click(selector);
  }

  /**
   * Check if element is visible
   */
  async isElementVisible(selector: string): Promise<boolean> {
    return this.page.isVisible(selector);
  }

  /**
   * Check if element is enabled
   */
  async isElementEnabled(selector: string): Promise<boolean> {
    return this.page.isEnabled(selector);
  }

  /**
   * Get text content of element
   */
  async getElementText(selector: string): Promise<string> {
    return this.page.textContent(selector) || '';
  }
}

/**
 * Login page object
 */
export class LoginPage extends BasePage {
  readonly emailInput = () => this.page.locator('input[type="email"]');
  readonly passwordInput = () => this.page.locator('input[type="password"]');
  readonly loginButton = () => this.page.locator('button:has-text("Login")');
  readonly signupLink = () => this.page.locator('a:has-text("Sign up")');
  readonly errorMessage = () => this.page.locator('.error-message');

  /**
   * Perform login with email and password
   */
  async login(email: string, password: string): Promise<void> {
    await this.fillField('input[type="email"]', email);
    await this.fillField('input[type="password"]', password);
    await this.clickButton('button:has-text("Login")');
  }

  /**
   * Navigate to login page
   */
  async navigate(): Promise<void> {
    await this.goto('/login');
  }

  /**
   * Check if error message is displayed
   */
  async isErrorDisplayed(): Promise<boolean> {
    return this.isElementVisible('.error-message');
  }

  /**
   * Get error message text
   */
  async getErrorMessage(): Promise<string> {
    return this.getElementText('.error-message');
  }
}

/**
 * Library page object
 */
export class LibraryPage extends BasePage {
  readonly uploadButton = () => this.page.locator('button:has-text("Upload")');
  readonly songTiles = () => this.page.locator('[data-testid="song-tile"]');
  readonly searchInput = () => this.page.locator('input[placeholder*="Search"]');
  readonly emptyState = () => this.page.locator('[data-testid="empty-state"]');

  /**
   * Navigate to library page
   */
  async navigate(): Promise<void> {
    await this.goto('/library');
  }

  /**
   * Get number of songs displayed
   */
  async getSongCount(): Promise<number> {
    return (await this.songTiles().all()).length;
  }

  /**
   * Get song title by index
   */
  async getSongTitle(index: number): Promise<string> {
    const tiles = await this.songTiles().all();
    if (index >= tiles.length) {
      throw new Error(`Song index ${index} out of bounds. Total songs: ${tiles.length}`);
    }
    return tiles[index].textContent() || '';
  }

  /**
   * Click song tile by index
   */
  async clickSong(index: number): Promise<void> {
    const tiles = await this.songTiles().all();
    if (index >= tiles.length) {
      throw new Error(`Song index ${index} out of bounds. Total songs: ${tiles.length}`);
    }
    await tiles[index].click();
  }

  /**
   * Open upload dialog
   */
  async openUploadDialog(): Promise<void> {
    await this.clickButton('button:has-text("Upload")');
  }

  /**
   * Check if empty state is displayed
   */
  async isEmptyStateDisplayed(): Promise<boolean> {
    return this.isElementVisible('[data-testid="empty-state"]');
  }

  /**
   * Search for songs
   */
  async searchSongs(query: string): Promise<void> {
    await this.fillField('input[placeholder*="Search"]', query);
  }
}

/**
 * Sheet Music Viewer page object
 */
export class SheetMusicViewerPage extends BasePage {
  readonly sheetContainer = () => this.page.locator('[data-testid="sheet-music-viewer"]');
  readonly playButton = () => this.page.locator('button:has-text("Play")');
  readonly pauseButton = () => this.page.locator('button:has-text("Pause")');
  readonly zoomInButton = () => this.page.locator('button[title*="Zoom in"]');
  readonly zoomOutButton = () => this.page.locator('button[title*="Zoom out"]');
  readonly feedbackButton = () => this.page.locator('button:has-text("Feedback")');

  /**
   * Wait for sheet music to load
   */
  async waitForSheetLoad(): Promise<void> {
    await this.page.waitForSelector('[data-testid="sheet-music-viewer"]');
    // Give it a moment for rendering
    await this.page.waitForTimeout(1000);
  }

  /**
   * Check if sheet music viewer is visible
   */
  async isSheetVisible(): Promise<boolean> {
    return this.isElementVisible('[data-testid="sheet-music-viewer"]');
  }

  /**
   * Play sheet music
   */
  async play(): Promise<void> {
    await this.clickButton('button:has-text("Play")');
  }

  /**
   * Pause sheet music playback
   */
  async pause(): Promise<void> {
    await this.clickButton('button:has-text("Pause")');
  }

  /**
   * Zoom in
   */
  async zoomIn(): Promise<void> {
    await this.clickButton('button[title*="Zoom in"]');
  }

  /**
   * Zoom out
   */
  async zoomOut(): Promise<void> {
    await this.clickButton('button[title*="Zoom out"]');
  }

  /**
   * Open feedback dialog
   */
  async openFeedback(): Promise<void> {
    await this.clickButton('button:has-text("Feedback")');
  }
}

/**
 * Discover page object
 */
export class DiscoverPage extends BasePage {
  readonly suggestedTiles = () => this.page.locator('[data-testid="suggested-song-tile"]');
  readonly filterButton = () => this.page.locator('button:has-text("Filter")');
  readonly sortDropdown = () => this.page.locator('select[aria-label*="Sort"]');

  /**
   * Navigate to discover page
   */
  async navigate(): Promise<void> {
    await this.goto('/discover');
  }

  /**
   * Get number of suggested songs
   */
  async getSuggestedCount(): Promise<number> {
    return (await this.suggestedTiles().all()).length;
  }

  /**
   * Click on a suggested song
   */
  async clickSuggestion(index: number): Promise<void> {
    const tiles = await this.suggestedTiles().all();
    if (index >= tiles.length) {
      throw new Error(
        `Suggestion index ${index} out of bounds. Total suggestions: ${tiles.length}`
      );
    }
    await tiles[index].click();
  }

  /**
   * Open filter dialog
   */
  async openFilter(): Promise<void> {
    await this.clickButton('button:has-text("Filter")');
  }
}
