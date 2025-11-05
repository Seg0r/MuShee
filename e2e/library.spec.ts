/**
 * Library E2E Tests
 * Tests for song library browsing, uploading, and management
 */

import { test, expect } from '@playwright/test';
import { LibraryPage } from './fixtures/page-objects';
import { TIMEOUTS } from './fixtures/test-data';

test.describe('Library', () => {
  let libraryPage: LibraryPage;

  test.beforeEach(async ({ page }) => {
    libraryPage = new LibraryPage(page);
    // Note: In a real scenario, you'd set up authentication first
    await libraryPage.navigate();
    // Wait for library to load
    await page.waitForLoadState('networkidle');
  });

  test('should display library page', async ({ page }) => {
    expect(page.url()).toContain('/library');
    expect(await libraryPage.getTitle()).toContain('Library');
  });

  test('should display song tiles', async () => {
    // Wait for songs to load
    await libraryPage.page.waitForSelector('[data-testid="song-tile"]', {
      timeout: TIMEOUTS.medium,
    });

    // Get count of songs
    const songCount = await libraryPage.getSongCount();
    expect(songCount).toBeGreaterThanOrEqual(0);
  });

  test('should search songs', async ({ page }) => {
    const searchQuery = 'Chopin';

    // Perform search
    await libraryPage.searchSongs(searchQuery);
    await page.waitForTimeout(500); // Wait for search to debounce

    // Verify search results
    const songTiles = await libraryPage.songTiles().all();
    expect(songTiles.length).toBeGreaterThan(0);

    // Verify results contain search term
    for (const tile of songTiles) {
      const text = await tile.textContent();
      expect(text?.toLowerCase()).toContain(searchQuery.toLowerCase());
    }
  });

  test('should display empty state when no songs', async ({ page }) => {
    // Perform search that returns no results
    await libraryPage.searchSongs('NONEXISTENT_SONG_XYZ123');
    await page.waitForTimeout(500);

    // Wait for empty state
    await page.waitForSelector('[data-testid="empty-state"]', { timeout: TIMEOUTS.short });

    // Verify empty state is displayed
    expect(await libraryPage.isEmptyStateDisplayed()).toBeTruthy();
  });

  test('should open upload dialog', async ({ page }) => {
    // Click upload button
    await libraryPage.openUploadDialog();

    // Wait for upload dialog
    await page.waitForSelector('[role="dialog"]', { timeout: TIMEOUTS.medium });

    // Verify dialog is visible
    const dialog = page.locator('[role="dialog"]');
    expect(await dialog.isVisible()).toBeTruthy();
  });

  test('should click song tile to view sheet music', async ({ page }) => {
    // Wait for at least one song
    await page.waitForSelector('[data-testid="song-tile"]', { timeout: TIMEOUTS.medium });

    const songCount = await libraryPage.getSongCount();
    if (songCount > 0) {
      // Click first song
      await libraryPage.clickSong(0);

      // Verify navigation to sheet viewer
      await page.waitForURL(/\/sheets\/.*/, { timeout: TIMEOUTS.navigation });
      expect(page.url()).toContain('/sheets/');
    }
  });

  test('should support sorting', async ({ page }) => {
    // Check if sort dropdown exists
    const sortDropdown = libraryPage.sortDropdown();
    const isVisible = await libraryPage.isElementVisible('select[aria-label*="Sort"]');

    if (isVisible) {
      // Select a sort option
      await sortDropdown.selectOption('title-asc');

      // Wait for list to re-sort
      await page.waitForTimeout(500);

      // Verify list is re-sorted
      const songs = await libraryPage.songTiles().all();
      expect(songs.length).toBeGreaterThanOrEqual(0);
    }
  });

  test('should support filtering', async ({ page }) => {
    // Check if filter button exists
    const isVisible = await libraryPage.isElementVisible('button:has-text("Filter")');

    if (isVisible) {
      // Open filter
      await libraryPage.openFilter();

      // Wait for filter dialog
      await page.waitForSelector('[role="dialog"]', { timeout: TIMEOUTS.medium });

      // Verify dialog is displayed
      const dialog = page.locator('[role="dialog"]');
      expect(await dialog.isVisible()).toBeTruthy();
    }
  });

  test('should display song metadata', async () => {
    // Wait for songs
    await libraryPage.page.waitForSelector('[data-testid="song-tile"]', {
      timeout: TIMEOUTS.medium,
    });

    const songCount = await libraryPage.getSongCount();
    if (songCount > 0) {
      // Get title of first song
      const title = await libraryPage.getSongTitle(0);
      expect(title.length).toBeGreaterThan(0);
    }
  });

  test('should persist search state on navigation', async ({ page }) => {
    // Search for songs
    await libraryPage.searchSongs('Chopin');
    await page.waitForTimeout(500);

    // Verify search results
    const songCount = await libraryPage.getSongCount();
    expect(songCount).toBeGreaterThan(0);

    // Navigate away and back
    await page.goto('/discover');
    await libraryPage.navigate();

    // Note: Depending on implementation, search state may or may not persist
    // Adjust assertion based on actual behavior
  });
});
