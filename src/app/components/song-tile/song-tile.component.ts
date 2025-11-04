import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCard, MatCardContent, MatCardFooter } from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinner } from '@angular/material/progress-spinner';

import type { PublicSongListItemDto, UserLibraryItemDto } from '@/types';

/**
 * Union type for song data that can be displayed in the tile
 */
export type SongTileData = PublicSongListItemDto | UserLibraryItemDto;

/**
 * Action types that can be performed on a song tile
 */
export type SongTileAction = 'add' | 'delete' | 'none';

/**
 * Configuration for the song tile component
 */
export interface SongTileConfig {
  showFooter: boolean;
  action: SongTileAction;
  isLoading?: boolean;
  isInLibrary?: boolean;
  isAuthenticated?: boolean;
}

@Component({
  selector: 'app-song-tile',
  standalone: true,
  imports: [
    CommonModule,
    MatCard,
    MatCardContent,
    MatCardFooter,
    MatIcon,
    MatButtonModule,
    MatProgressSpinner,
  ],
  templateUrl: './song-tile.component.html',
  styleUrl: './song-tile.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'song-tile-host',
  },
})
export class SongTileComponent {
  // ============================================================================
  // Input Signals
  // ============================================================================

  /**
   * The song data to display in the tile
   */
  readonly song = input.required<SongTileData>();

  /**
   * Configuration for how the tile should behave and what to display
   */
  readonly config = input.required<SongTileConfig>();

  // ============================================================================
  // Output Signals
  // ============================================================================

  /**
   * Emitted when the tile is clicked (excluding action buttons)
   */
  readonly tileClick = output<SongTileData>();

  /**
   * Emitted when the add to library button is clicked
   */
  readonly addToLibrary = output<SongTileData>();

  /**
   * Emitted when the delete button is clicked
   */
  readonly deleteClick = output<SongTileData>();

  // ============================================================================
  // Computed Signals
  // ============================================================================

  /**
   * Computed display text: "Composer - Title"
   */
  readonly displayText = computed(() => {
    const song = this.song();
    const composer = song.song_details.composer || 'Unknown Composer';
    const title = song.song_details.title || 'Unknown Title';
    return `${composer} - ${title}`;
  });

  /**
   * Computed song ID for routing purposes
   */
  readonly songId = computed(() => {
    const song = this.song();
    return 'song_id' in song ? song.song_id : song.id;
  });

  /**
   * Computed added date for display in footer
   */
  readonly addedDate = computed(() => {
    const song = this.song();
    return 'added_at' in song ? song.added_at : null;
  });

  /**
   * Computed button state and text based on config and loading state
   */
  readonly buttonState = computed(() => {
    const config = this.config();
    const isLoading = config.isLoading ?? false;
    const isAuthenticated = config.isAuthenticated ?? false;

    if (config.action === 'add') {
      if (isLoading) return { text: 'Adding...', disabled: true, showSpinner: true };
      if (!isAuthenticated) return { text: 'Sign in to add', disabled: false, showSpinner: false };
      if (config.isInLibrary)
        return { text: 'Already in library', disabled: true, showSpinner: false };
      return { text: 'Add to Library', disabled: false, showSpinner: false };
    }

    if (config.action === 'delete') {
      return { text: 'Delete', disabled: isLoading, showSpinner: isLoading };
    }

    return null;
  });

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * Handle tile click - emit tileClick event with song data
   */
  onTileClick(): void {
    this.tileClick.emit(this.song());
  }

  /**
   * Handle add to library button click - emit addToLibrary event
   */
  onAddToLibrary(event: Event): void {
    event.stopPropagation();
    if (!this.buttonState()?.disabled) {
      this.addToLibrary.emit(this.song());
    }
  }

  /**
   * Handle delete button click - emit deleteClick event
   */
  onDeleteClick(event: Event): void {
    event.stopPropagation();
    this.deleteClick.emit(this.song());
  }
}
