import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

import type { UserLibraryItemDto } from '@/types';

@Component({
  selector: 'app-song-card',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatButtonModule],
  templateUrl: './song-card.component.html',
  styleUrl: './song-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'song-card-host',
  },
})
export class SongCardComponent {
  // ============================================================================
  // Input Signals
  // ============================================================================

  /**
   * The song data to display in the card
   */
  readonly song = input.required<UserLibraryItemDto>();

  // ============================================================================
  // Output Signals
  // ============================================================================

  /**
   * Emitted when the card is clicked (excluding action buttons)
   */
  readonly cardClick = output<UserLibraryItemDto>();

  /**
   * Emitted when delete button is clicked
   */
  readonly deleteClick = output<UserLibraryItemDto>();

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

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * Handle card click - emit cardClick event with song data
   */
  onCardClick(): void {
    this.cardClick.emit(this.song());
  }

  /**
   * Handle delete button click - stop propagation and emit deleteClick event
   * @param event - Mouse event to prevent card click
   */
  onDeleteClick(event: Event): void {
    event.stopPropagation();
    this.deleteClick.emit(this.song());
  }
}
