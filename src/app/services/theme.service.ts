import { Injectable, effect, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';

/**
 * Service to manage theme (light/dark mode) state.
 * Persists preference to localStorage for persistent user choice.
 */
@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly DARK_MODE_KEY = 'mushee-dark-mode';

  /**
   * Signal representing whether dark mode is enabled
   */
  readonly isDarkMode = signal<boolean>(this.getInitialDarkModeState());

  constructor() {
    // Apply theme changes whenever the signal updates
    effect(() => {
      this.applyTheme(this.isDarkMode());
    });
  }

  /**
   * Toggle dark mode on/off
   */
  toggleDarkMode(): void {
    this.isDarkMode.update(current => !current);
  }

  /**
   * Set dark mode to a specific state
   */
  setDarkMode(isDark: boolean): void {
    this.isDarkMode.set(isDark);
  }

  /**
   * Get the initial dark mode state from localStorage or system preference
   */
  private getInitialDarkModeState(): boolean {
    // Check localStorage first
    const stored = localStorage.getItem(this.DARK_MODE_KEY);
    if (stored !== null) {
      return stored === 'true';
    }

    // Fall back to system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  /**
   * Apply theme to document by adding/removing 'dark' class
   */
  private applyTheme(isDark: boolean): void {
    const htmlElement = this.document.documentElement;

    if (isDark) {
      htmlElement.classList.add('dark');
    } else {
      htmlElement.classList.remove('dark');
    }

    // Persist to localStorage
    localStorage.setItem(this.DARK_MODE_KEY, String(isDark));
  }
}
