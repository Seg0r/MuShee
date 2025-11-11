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
}

/**
 * Main page object - represents the main application shell
 */
export class MainPage extends BasePage {
  readonly loginButton = () => this.page.locator('[data-testid="login-button"]');

  /**
   * Navigate to main page
   */
  async navigate(): Promise<void> {
    await this.goto('/');
  }

  /**
   * Click login button to open login dialog
   */
  async clickLoginButton(): Promise<void> {
    await this.loginButton().click();
  }

  /**
   * Check if login button is visible
   */
  async isLoginButtonVisible(): Promise<boolean> {
    return this.isElementVisible('[data-testid="login-button"]');
  }
}

/**
 * Login dialog object - represents the login modal/dialog
 */
export class LoginDialog extends BasePage {
  readonly dialogContainer = () => this.page.locator('[data-testid="login-dialog"]');
  readonly emailInput = () => this.page.locator('[data-testid="email-input"]');
  readonly passwordInput = () => this.page.locator('[data-testid="password-input"]');
  readonly loginSubmitButton = () => this.page.locator('[data-testid="login-submit-button"]');
  readonly errorMessage = () => this.page.locator('.error-message');

  /**
   * Wait for login dialog to be visible
   */
  async waitForDialog(): Promise<void> {
    await this.page.waitForSelector('[data-testid="login-dialog"]');
  }

  /**
   * Perform login with email and password and wait for response
   */
  async login(email: string, password: string): Promise<void> {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.submitLoginAndWait();
  }

  /**
   * Fill email input field
   */
  async fillEmail(email: string): Promise<void> {
    await this.emailInput().fill(email);
  }

  /**
   * Fill password input field
   */
  async fillPassword(password: string): Promise<void> {
    await this.passwordInput().fill(password);
  }

  /**
   * Click login submit button without waiting
   */
  async submitLogin(): Promise<void> {
    await this.loginSubmitButton().click();
  }

  /**
   * Click login submit button and wait for API response
   * This handles both successful and failed authentication responses
   */
  async submitLoginAndWait(): Promise<void> {
    // Start listening for the auth API response before clicking
    const responsePromise = this.page.waitForResponse(response => {
      const url = response.url();
      // Wait for auth/login API endpoints (Supabase or custom auth)
      return (
        (url.includes('/auth') || url.includes('supabase') || url.includes('login')) &&
        (response.status() === 200 || response.status() === 401 || response.status() === 400)
      );
    });

    // Click the submit button
    await this.loginSubmitButton().click();

    // Wait for the API response to complete
    await responsePromise;

    // Wait for the page to reach a stable state after the response
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Check if login dialog is visible
   */
  async isDialogVisible(): Promise<boolean> {
    return this.isElementVisible('[data-testid="login-dialog"]');
  }

  /**
   * Check if error message is displayed
   */
  async isErrorDisplayed(): Promise<boolean> {
    return this.isElementVisible('.error-message');
  }

  /**
   * Check if submit button is enabled
   */
  async isSubmitButtonEnabled(): Promise<boolean> {
    return this.isElementEnabled('[data-testid="login-submit-button"]');
  }

  /**
   * Get the error message text
   */
  async getErrorMessage(): Promise<string | null> {
    return this.errorMessage().textContent();
  }

  /**
   * Wait for error message to appear after failed login
   */
  async waitForErrorMessage(): Promise<void> {
    await this.errorMessage().waitFor({ state: 'visible' });
  }
}
