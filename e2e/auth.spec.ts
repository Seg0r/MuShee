/**
 * Authentication E2E Tests
 * Tests for login, logout, and authentication flows
 */

import { test, expect } from '@playwright/test';
import { MainPage, LoginDialog } from './fixtures/page-objects';
import { TEST_USERS, INVALID_CREDENTIALS } from './fixtures/test-data';

test.describe('Authentication', () => {
  let mainPage: MainPage;
  let loginDialog: LoginDialog;

  test.beforeEach(async ({ page }) => {
    mainPage = new MainPage(page);
    loginDialog = new LoginDialog(page);
  });

  test.describe('Login Page Authentication', () => {
    test('should login via login page', async () => {
      // 1. Navigate directly to login page
      await loginDialog.page.goto('/login');

      // 2. Wait for login page to load
      await loginDialog.waitForDialog();

      // 3. Fill login data and submit, waiting for API response
      await loginDialog.fillEmail(TEST_USERS.validUser.email);
      await loginDialog.fillPassword(TEST_USERS.validUser.password);
      await loginDialog.submitLoginAndWait();

      // 4. Verify login success - should navigate to library after API response
      await mainPage.waitForURL(/\/app\/library/);
    });

    test('should show error for invalid credentials on login page', async () => {
      // 1. Navigate directly to login page
      await loginDialog.page.goto('/login');

      // 2. Wait for login page to load
      await loginDialog.waitForDialog();

      // 3. Fill invalid login data
      await loginDialog.fillEmail(INVALID_CREDENTIALS.invalidEmail);
      await loginDialog.fillPassword(INVALID_CREDENTIALS.invalidPassword);

      // 4. Submit login and wait for API response (expects 401/400)
      await loginDialog.submitLoginAndWait();

      // 5. Wait for error message to appear
      await loginDialog.waitForErrorMessage();

      // Verify error is displayed
      expect(await loginDialog.isErrorDisplayed()).toBeTruthy();
      const errorMsg = await loginDialog.getErrorMessage();
      expect(errorMsg).toContain('Invalid');
    });

    test('should require email field on login page', async () => {
      // 1. Navigate directly to login page
      await loginDialog.page.goto('/login');

      // 2. Wait for login page to load
      await loginDialog.waitForDialog();

      // 3. Leave email empty, fill password only
      await loginDialog.fillPassword(TEST_USERS.validUser.password);

      // 4. Verify form validation - submit button should be disabled when email is empty
      expect(await loginDialog.isSubmitButtonEnabled()).toBeFalsy();
    });

    test('should require password field on login page', async () => {
      // 1. Navigate directly to login page
      await loginDialog.page.goto('/login');

      // 2. Wait for login page to load
      await loginDialog.waitForDialog();

      // 3. Leave password empty, fill email only
      await loginDialog.fillEmail(TEST_USERS.validUser.email);

      // 4. Verify form validation - submit button should be disabled when password is empty
      expect(await loginDialog.isSubmitButtonEnabled()).toBeFalsy();
    });
  });
});
