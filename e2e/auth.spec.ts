/**
 * Authentication E2E Tests
 * Tests for login, logout, and authentication flows
 */

import { test, expect } from '@playwright/test';
import { MainPage, LoginDialog, RegistrationPage } from './fixtures/page-objects';
import { TEST_USERS, INVALID_CREDENTIALS, REGISTRATION_DATA } from './fixtures/test-data';

test.describe('Authentication', () => {
  let mainPage: MainPage;
  let loginDialog: LoginDialog;
  let registrationPage: RegistrationPage;

  test.beforeEach(async ({ page }) => {
    mainPage = new MainPage(page);
    loginDialog = new LoginDialog(page);
    registrationPage = new RegistrationPage(page);
  });

  test.describe('Login Page Authentication', () => {
    // Serial execution ensures the account exists before login test runs
    // This creates the account first, then tests login with it
    test.describe.serial('Login Flow', () => {
      test('should create account for login test', async () => {
        // 1. Navigate directly to registration page
        await registrationPage.page.goto('/register');

        // 2. Wait for registration page to load
        await registrationPage.waitForPage();

        // 3. Create the account that will be used for login testing
        await registrationPage.fillRegistrationForm(
          TEST_USERS.validUser.email,
          TEST_USERS.validUser.password
        );

        // 4. Submit registration and wait for API response
        await registrationPage.submitRegistrationAndWait();

        // 5. Verify successful registration - should navigate to library after API response
        await mainPage.waitForURL(/\/app\/library/);
      });

      test('should login via login page', async () => {
        // This test depends on the previous test creating the account
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

  test.describe('Account Registration', () => {
    test('should navigate to registration page from login page', async () => {
      // 1. Navigate directly to login page
      await loginDialog.page.goto('/login');

      // 2. Wait for login page to load
      await loginDialog.waitForDialog();

      // 3. Click "Create one" link
      await loginDialog.clickCreateAccountLink();

      // 4. Verify navigation to registration page
      await registrationPage.waitForPage();
      expect(await registrationPage.isPageVisible()).toBeTruthy();

      // 5. Verify URL changed to registration page
      await mainPage.waitForURL(/\/register/);
    });

    // Serial execution ensures tests run in order
    // This allows the "existing email" test to depend on the "create account" test
    test.describe.serial('Account Creation and Validation', () => {
      test('should successfully create account', async () => {
        // 1. Navigate directly to registration page
        await registrationPage.page.goto('/register');

        // 2. Wait for registration page to load
        await registrationPage.waitForPage();

        // 3. Fill registration form with valid data
        await registrationPage.fillRegistrationForm(
          TEST_USERS.newRegistrationUser.email,
          TEST_USERS.newRegistrationUser.password
        );

        // 4. Submit registration and wait for API response
        await registrationPage.submitRegistrationAndWait();

        // 5. Verify successful registration - should navigate to library after API response
        await mainPage.waitForURL(/\/app\/library/);
      });

      test('should show error for existing email during registration', async () => {
        // This test depends on the previous test creating an account
        // It uses the same email to verify duplicate registration is rejected

        // 1. Navigate directly to registration page
        await registrationPage.page.goto('/register');

        // 2. Wait for registration page to load
        await registrationPage.waitForPage();

        // 3. Fill registration form with the same email from the previous test
        // This ensures the account exists (created by the previous test)
        await registrationPage.fillRegistrationForm(
          TEST_USERS.newRegistrationUser.email,
          TEST_USERS.newRegistrationUser.password
        );

        // 4. Submit registration and wait for API response (expects 409 conflict)
        await registrationPage.submitRegistrationAndWait();

        // 5. Wait for error message to appear
        await registrationPage.waitForErrorMessage();

        // 6. Verify error is displayed
        expect(await registrationPage.isErrorDisplayed()).toBeTruthy();
        const errorMsg = await registrationPage.getErrorMessage();
        expect(errorMsg).toContain('already');
      });
    });

    test('should require valid email format during registration', async () => {
      // 1. Navigate directly to registration page
      await registrationPage.page.goto('/register');

      // 2. Wait for registration page to load
      await registrationPage.waitForPage();

      // 3. Fill form with invalid email but valid password
      await registrationPage.fillRegistrationForm(
        REGISTRATION_DATA.invalidEmails.missingAt,
        TEST_USERS.newRegistrationUser.password
      );

      // 4. Verify form validation - submit button should be disabled when email is invalid
      expect(await registrationPage.isSubmitButtonEnabled()).toBeFalsy();
    });

    test('should require password meeting strength requirements', async () => {
      // 1. Navigate directly to registration page
      await registrationPage.page.goto('/register');

      // 2. Wait for registration page to load
      await registrationPage.waitForPage();

      // 3. Fill form with valid email but weak password (too short)
      await registrationPage.fillRegistrationForm(
        TEST_USERS.newRegistrationUser.email,
        REGISTRATION_DATA.weakPasswords.tooShort
      );

      // 4. Verify form validation - submit button should be disabled when password doesn't meet requirements
      expect(await registrationPage.isSubmitButtonEnabled()).toBeFalsy();
    });

    test('should require email field during registration', async () => {
      // 1. Navigate directly to registration page
      await registrationPage.page.goto('/register');

      // 2. Wait for registration page to load
      await registrationPage.waitForPage();

      // 3. Leave email empty, fill only password
      await registrationPage.fillPassword(TEST_USERS.newRegistrationUser.password);

      // 4. Verify form validation - submit button should be disabled when email is empty
      expect(await registrationPage.isSubmitButtonEnabled()).toBeFalsy();
    });

    test('should require password field during registration', async () => {
      // 1. Navigate directly to registration page
      await registrationPage.page.goto('/register');

      // 2. Wait for registration page to load
      await registrationPage.waitForPage();

      // 3. Leave password empty, fill only email
      await registrationPage.fillEmail(TEST_USERS.newRegistrationUser.email);

      // 4. Verify form validation - submit button should be disabled when password is empty
      expect(await registrationPage.isSubmitButtonEnabled()).toBeFalsy();
    });
  });
});
