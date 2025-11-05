/**
 * Common test helper utilities for unit tests.
 * These helpers provide utilities for DOM manipulation, async operations, and data creation.
 */

import { ComponentFixture } from '@angular/core/testing';

/**
 * Gets an element from the fixture's native element
 */
export function getElement<T extends Element>(
  fixture: ComponentFixture<unknown>,
  selector: string
): T | null {
  return fixture.nativeElement.querySelector(selector);
}

/**
 * Gets all elements matching a selector
 */
export function getElements<T extends Element>(
  fixture: ComponentFixture<unknown>,
  selector: string
): T[] {
  return Array.from(fixture.nativeElement.querySelectorAll(selector));
}

/**
 * Gets the text content of an element
 */
export function getText(fixture: ComponentFixture<unknown>, selector: string): string {
  const el = getElement(fixture, selector);
  return el ? el.textContent?.trim() || '' : '';
}

/**
 * Clicks an element
 */
export function clickElement(fixture: ComponentFixture<unknown>, selector: string): void {
  const el = getElement<HTMLElement>(fixture, selector);
  if (el) {
    el.click();
    fixture.detectChanges();
  }
}

/**
 * Sets input value and triggers input event
 */
export function setInputValue(
  fixture: ComponentFixture<unknown>,
  selector: string,
  value: string
): void {
  const input = getElement<HTMLInputElement>(fixture, selector);
  if (input) {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();
  }
}

/**
 * Checks if an element has a CSS class
 */
export function hasClass(
  fixture: ComponentFixture<unknown>,
  selector: string,
  className: string
): boolean {
  const el = getElement<HTMLElement>(fixture, selector);
  return el ? el.classList.contains(className) : false;
}

/**
 * Gets an attribute value from an element
 */
export function getAttribute(
  fixture: ComponentFixture<unknown>,
  selector: string,
  attr: string
): string | null {
  const el = getElement<HTMLElement>(fixture, selector);
  return el ? el.getAttribute(attr) : null;
}

/**
 * Checks if an element is disabled
 */
export function isDisabled(fixture: ComponentFixture<unknown>, selector: string): boolean {
  const el = getElement<HTMLButtonElement | HTMLInputElement>(fixture, selector);
  return el ? el.disabled : false;
}

/**
 * Checks if an element is visible (not hidden)
 */
export function isVisible(fixture: ComponentFixture<unknown>, selector: string): boolean {
  const el = getElement<HTMLElement>(fixture, selector);
  if (!el) return false;
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
}

/**
 * Waits for an async operation to complete (for testing async code)
 */
export async function waitForAsync(ms = 100): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Creates mock test data for a song
 */
export function createMockSong(overrides?: Record<string, unknown>) {
  return {
    id: 'test-song-1',
    title: 'Test Song',
    composer: 'Test Composer',
    uploadedAt: new Date(),
    fileUrl: 'https://example.com/test.mxl',
    ...overrides,
  };
}

/**
 * Creates mock test data for a user profile
 */
export function createMockProfile(overrides?: Record<string, unknown>) {
  return {
    id: 'test-user-1',
    email: 'test@example.com',
    displayName: 'Test User',
    createdAt: new Date(),
    ...overrides,
  };
}

/**
 * Simulates keyboard events
 */
export function simulateKeyboardEvent(
  fixture: ComponentFixture<unknown>,
  selector: string,
  key: string,
  eventType: 'keydown' | 'keyup' | 'keypress' = 'keydown'
): void {
  const el = getElement<HTMLElement>(fixture, selector);
  if (el) {
    el.dispatchEvent(
      new KeyboardEvent(eventType, {
        key,
        bubbles: true,
        cancelable: true,
      })
    );
    fixture.detectChanges();
  }
}

/**
 * Triggers a form submission
 */
export function submitForm(fixture: ComponentFixture<unknown>, selector: string): void {
  const form = getElement<HTMLFormElement>(fixture, selector);
  if (form) {
    form.dispatchEvent(new Event('submit', { bubbles: true }));
    fixture.detectChanges();
  }
}
