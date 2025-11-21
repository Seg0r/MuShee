import { signal } from '@angular/core';
import type { SongCollectionHeaderSearchControl } from './song-collection.types';

export interface SongCollectionSearchControllerOptions {
  label: string;
  placeholder?: string;
  debounceMs?: number;
  onDebouncedChange?: (term: string) => void;
}

export class SongCollectionSearchController {
  private readonly valueSignal = signal('');
  private readonly debouncedValueSignal = signal('');
  private readonly options: SongCollectionSearchControllerOptions;
  private readonly debounceMs: number;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: SongCollectionSearchControllerOptions) {
    this.options = options;
    this.debounceMs = options.debounceMs ?? 500;
  }

  headerControl(): SongCollectionHeaderSearchControl {
    return {
      label: this.options.label,
      placeholder: this.options.placeholder ?? this.options.label,
      value: this.valueSignal(),
      onValueChange: value => this.handleInput(value),
    };
  }

  searchTerm(): string {
    return this.debouncedValueSignal();
  }

  searchTermSignal = this.debouncedValueSignal.asReadonly();

  destroy(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  private handleInput(value: string): void {
    this.valueSignal.set(value);
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    const trimmedValue = value.trim();
    this.debounceTimer = setTimeout(() => {
      if (trimmedValue === this.debouncedValueSignal()) {
        this.debounceTimer = null;
        return;
      }
      this.debouncedValueSignal.set(trimmedValue);
      this.options.onDebouncedChange?.(trimmedValue);
      this.debounceTimer = null;
    }, this.debounceMs);
  }
}
