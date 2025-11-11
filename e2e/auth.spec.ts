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

  test.describe('Dialog-based Login (Main Page)', () => {
    test('should login via dialog from main page', async () => {
      // 1. Open main page
      await mainPage.navigate();

      // 2. Click login button
      await mainPage.clickLoginButton();

      // 3. Wait for dialog to open
      await loginDialog.waitForDialog();

      // 4. Fill login data
      await loginDialog.fillEmail(TEST_USERS.validUser.email);
      await loginDialog.fillPassword(TEST_USERS.validUser.password);

      // 5. Click login
      await loginDialog.submitLogin();

      // Verify login success - should navigate away from main page
      await mainPage.waitForURL(/\/app/);
    });

    test('should show error for invalid credentials in dialog', async () => {
      // 1. Open main page
      await mainPage.navigate();

      // 2. Click login button
      await mainPage.clickLoginButton();

      // 3. Wait for dialog to open
      await loginDialog.waitForDialog();

      // 4. Fill invalid login data
      await loginDialog.fillEmail(INVALID_CREDENTIALS.invalidEmail);
      await loginDialog.fillPassword(INVALID_CREDENTIALS.invalidPassword);

      // 5. Click login
      await loginDialog.submitLogin();

      // Verify error is displayed
      expect(await loginDialog.isErrorDisplayed()).toBeTruthy();
      const errorMsg = await loginDialog.getErrorMessage();
      expect(errorMsg).toContain('Invalid');
    });

    test('should require email field in dialog', async () => {
      // 1. Open main page
      await mainPage.navigate();

      // 2. Click login button
      await mainPage.clickLoginButton();

      // 3. Wait for dialog to open
      await loginDialog.waitForDialog();

      // 4. Leave email empty and try to submit
      await loginDialog.fillPassword(TEST_USERS.validUser.password);
      await loginDialog.submitLogin();

      // Verify form validation - submit button should be disabled
      expect(await loginDialog.isSubmitButtonEnabled()).toBeFalsy();
    });

    test('should require password field in dialog', async () => {
      // 1. Open main page
      await mainPage.navigate();

      // 2. Click login button
      await mainPage.clickLoginButton();

      // 3. Wait for dialog to open
      await loginDialog.waitForDialog();

      // 4. Leave password empty and try to submit
      await loginDialog.fillEmail(TEST_USERS.validUser.email);
      await loginDialog.submitLogin();

      // Verify form validation - submit button should be disabled
      expect(await loginDialog.isSubmitButtonEnabled()).toBeFalsy();
    });
  });
});
