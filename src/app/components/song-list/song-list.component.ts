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
  readonly isSongInLibrary = input<(songId: string) => boolean>(() => false);

  readonly tileClick = output<SongTileData>();
  readonly addToLibrary = output<SongTileData>();
  readonly deleteClick = output<SongTileData>();

  // Internal method to compute SongTileConfig
  internalGetSongTileConfig(song: SongTileData): SongTileConfig {
    if (this.isUserLibrary()) {
      return {
        showFooter: true, // User library shows added dates
        action: 'delete', // User library shows delete action
        isLoading: false, // No loading state for delete operations in this view
      };
    } else {
      return {
        showFooter: false, // Public library doesn't show added dates
        action: 'add', // Public library shows add action
        isLoading: false,
        isInLibrary: this.isSongInLibrary()('id' in song ? song.id : song.song_id),
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
