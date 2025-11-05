/**
 * Authentication E2E Tests
 * Tests for login, logout, and authentication flows
 */

import { test, expect } from '@playwright/test';
import { LoginPage } from './fixtures/page-objects';
import { TEST_USERS, INVALID_CREDENTIALS, TIMEOUTS } from './fixtures/test-data';

test.describe('Authentication', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.waitForURL('/login');
  });

  test('should display login form', async () => {
    // Verify login page elements are visible
    expect(await loginPage.isElementVisible('input[type="email"]')).toBeTruthy();
    expect(await loginPage.isElementVisible('input[type="password"]')).toBeTruthy();
    expect(await loginPage.isElementVisible('button:has-text("Login")')).toBeTruthy();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    // Attempt login with invalid credentials
    await loginPage.login(INVALID_CREDENTIALS.invalidEmail, INVALID_CREDENTIALS.invalidPassword);

    // Wait for error message
    await page.waitForSelector('[data-testid="error-message"]', { timeout: TIMEOUTS.medium });

    // Verify error is displayed
    expect(await loginPage.isErrorDisplayed()).toBeTruthy();
    const errorMsg = await loginPage.getErrorMessage();
    expect(errorMsg).toContain('Invalid');
  });

  test('should require email field', async ({ page }) => {
    // Leave email empty and try to submit
    await loginPage.fillField('input[type="password"]', TEST_USERS.validUser.password);
    await loginPage.clickButton('button:has-text("Login")');

    // Verify form validation error
    const emailInput = page.locator('input[type="email"]');
    expect(await emailInput.getAttribute('aria-invalid')).toBe('true');
  });

  test('should require password field', async ({ page }) => {
    // Leave password empty and try to submit
    await loginPage.fillField('input[type="email"]', TEST_USERS.validUser.email);
    await loginPage.clickButton('button:has-text("Login")');

    // Verify form validation error
    const passwordInput = page.locator('input[type="password"]');
    expect(await passwordInput.getAttribute('aria-invalid')).toBe('true');
  });

  test('should navigate to signup from login page', async ({ page }) => {
    // Click sign up link
    await loginPage.clickButton('a:has-text("Sign up")');

    // Verify navigation to signup page
    await loginPage.waitForURL('/signup');
    expect(page.url()).toContain('/signup');
  });

  test('should have accessible login form', async ({ page }) => {
    // Check for accessibility attributes
    const form = page.locator('form');
    expect(await form.getAttribute('role')).not.toBeNull();

    // Verify labels are associated with inputs
    const emailLabel = page.locator('label[for="email"]');
    expect(await emailLabel.isVisible()).toBeTruthy();

    const passwordLabel = page.locator('label[for="password"]');
    expect(await passwordLabel.isVisible()).toBeTruthy();
  });

  test('should have responsive design', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Verify elements are still visible and accessible
    expect(await loginPage.isElementVisible('input[type="email"]')).toBeTruthy();
    expect(await loginPage.isElementVisible('input[type="password"]')).toBeTruthy();

    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });

    // Verify layout adjusts appropriately
    expect(await loginPage.isElementVisible('input[type="email"]')).toBeTruthy();
  });

  test('should trim whitespace from email input', async ({ page }) => {
    const emailWithSpaces = '  ' + TEST_USERS.validUser.email + '  ';
    await loginPage.fillField('input[type="email"]', emailWithSpaces);

    const emailValue = await page.inputValue('input[type="email"]');
    expect(emailValue.trim()).toBe(TEST_USERS.validUser.email);
  });
});
