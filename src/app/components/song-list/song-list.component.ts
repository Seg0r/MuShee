import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SongTileComponent, SongTileConfig, SongTileData } from '../song-tile/song-tile.component';

@Component({
  selector: 'app-song-list',
  standalone: true,
  imports: [CommonModule, SongTileComponent],
  templateUrl: './song-list.component.html',
  styleUrls: ['./song-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SongListComponent {
  readonly songs = input.required<SongTileData[]>();
  readonly isUserLibrary = input<boolean>(false);

  readonly tileClick = output<SongTileData>();
  readonly addToLibrary = output<SongTileData>();
  readonly deleteClick = output<SongTileData>();

  // Internal method to compute SongTileConfig
  internalGetSongTileConfig(): SongTileConfig {
    if (this.isUserLibrary()) {
      return {
        showFooter: true, // User library shows added dates
        action: 'delete', // User library shows delete action
        isLoading: false, // No loading state for delete operations in this view
      };
    } else {
      // For public songs, we need to know if it's in the user's library and if it's loading
      // This information will need to be passed down from the parent (DiscoverComponent)
      // For now, we'll assume default values for public songs.
      // The DiscoverComponent will need to provide a more specific config if these are dynamic.
      return {
        showFooter: false, // Public library doesn't show added dates
        action: 'add', // Public library shows add action
        isLoading: false,
        isInLibrary: false,
      };
    }
  }

  onTileClick(song: SongTileData): void {
    this.tileClick.emit(song);
  }

  onAddToLibrary(song: SongTileData): void {
    this.addToLibrary.emit(song);
  }

  onDeleteClick(song: SongTileData): void {
    this.deleteClick.emit(song);
  }

  trackByFn(_index: number, song: SongTileData): string {
    return 'id' in song ? song.id : song.song_id;
  }
}
