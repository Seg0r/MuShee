import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';

import { SongService } from '../../services/song.service';
import { UserLibraryService } from '../../services/user-library.service';
import { AuthService } from '../../services/auth.service';
import { ErrorHandlingService } from '../../services/error-handling.service';

import type { UserLibraryItemDto } from '@/types';
import { SongCollectionComponent } from '../song-collection/song-collection.component';
import type { SongCollectionConfig } from '../song-collection/song-collection.types';
import { SongTileData } from '../song-tile/song-tile.component';
import {
  OnboardingDialogComponent,
  type OnboardingDialogData,
} from '../onboarding-dialog/onboarding-dialog.component';

const pageSongLimit = 50;

@Component({
  selector: 'app-discover',
  standalone: true,
  imports: [CommonModule, SongCollectionComponent],
  templateUrl: './discover.component.html',
  styleUrl: './discover.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiscoverComponent implements OnInit {
  private readonly songService = inject(SongService);
  private readonly userLibraryService = inject(UserLibraryService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly errorHandlingService = inject(ErrorHandlingService);
  private readonly dialog = inject(MatDialog);

  private readonly userLibrarySongs = signal<UserLibraryItemDto[]>([]);
  private readonly addingToLibraryMap = signal<Map<string, boolean>>(new Map());

  readonly userLibrarySongIds = computed(
    () => new Set(this.userLibrarySongs().map(song => song.song_id))
  );
  readonly isAuthenticated = computed(() => this.authService.isAuthenticated());

  readonly discoverCollectionConfig: SongCollectionConfig = {
    fetchPage: (page, limit) =>
      this.songService.getPublicSongsList({
        page,
        limit,
      }),
    limit: pageSongLimit,
    isUserLibrary: false,
    isSongInLibrary: songId => this.userLibrarySongIds().has(songId),
    isAuthenticated: () => this.authService.isAuthenticated(),
    loadingSkeletonConfig: { count: 50 },
    header: { title: 'Discover' },
  };

  ngOnInit(): void {
    this.loadUserLibrary();
    this.checkAndShowOnboarding();
  }

  isSongInLibrary(songId: string): boolean {
    return this.userLibrarySongIds().has(songId);
  }

  isAddingToLibrary(songId: string): boolean {
    return this.addingToLibraryMap().get(songId) ?? false;
  }

  getSongButtonState(songId: string): string {
    if (!this.authService.isAuthenticated()) {
      return 'sign-in';
    }
    if (this.isAddingToLibrary(songId)) {
      return 'loading';
    }
    if (this.isSongInLibrary(songId)) {
      return 'already-added';
    }
    return 'add';
  }

  getSongButtonText(songId: string): string {
    const state = this.getSongButtonState(songId);
    const buttonTexts: Record<string, string> = {
      'sign-in': 'Sign in to add',
      loading: 'Adding...',
      'already-added': 'Already in library',
      add: 'Add to Library',
    };
    return buttonTexts[state] || 'Add to Library';
  }

  async onAddToLibrary(song: SongTileData): Promise<void> {
    if (!('id' in song)) {
      console.error('Invalid song data for onAddToLibrary', song);
      return;
    }
    const songId = song.id;
    if (!this.authService.isAuthenticated()) {
      await this.router.navigate(['/login']);
      return;
    }

    if (this.isAddingToLibrary(songId)) {
      return;
    }

    this.addingToLibraryMap.update(map => {
      map.set(songId, true);
      return new Map(map);
    });

    try {
      const response = await this.userLibraryService.addSongToLibrary({ song_id: songId });
      this.userLibrarySongs.update(songs => [
        ...songs,
        {
          song_id: response.song_id,
          song_details: response.song_details,
          added_at: response.created_at,
        },
      ]);

      this.showSuccessToast('Song added to your library!');
    } catch (error) {
      console.error('Error adding song to library:', error);
      const appError = this.errorHandlingService.mapGenericError(error);
      this.showErrorToast(appError.message);
    } finally {
      this.addingToLibraryMap.update(map => {
        map.delete(songId);
        return new Map(map);
      });
    }
  }

  async onSongCardClick(song: SongTileData): Promise<void> {
    if (!('id' in song)) {
      console.error('Invalid song data for onSongCardClick', song);
      return;
    }
    await this.router.navigate(['/song', song.id]);
  }

  private async loadUserLibrary(): Promise<void> {
    if (!this.authService.isAuthenticated()) {
      this.userLibrarySongs.set([]);
      return;
    }

    try {
      const response = await this.userLibraryService.getUserLibrary({
        page: 1,
        limit: pageSongLimit,
      });
      this.userLibrarySongs.set(response.data);
    } catch (error) {
      console.warn('Failed to load user library:', error);
    }
  }

  private checkAndShowOnboarding(): void {
    if (this.authService.isAuthenticated()) {
      return;
    }

    try {
      const hasSeenOnboarding = localStorage.getItem('mushee-anonymous-onboarding-seen') === 'true';
      if (!hasSeenOnboarding) {
        setTimeout(() => {
          this.openOnboardingDialog();
        }, 500);
      }
    } catch (error) {
      console.warn('Failed to check onboarding state:', error);
      setTimeout(() => {
        this.openOnboardingDialog();
      }, 500);
    }
  }

  openOnboardingDialog(): void {
    const dialogRef = this.dialog.open<OnboardingDialogComponent, OnboardingDialogData>(
      OnboardingDialogComponent,
      {
        width: '600px',
        maxWidth: '90vw',
        disableClose: false,
        data: { mode: 'anonymous' },
        panelClass: 'glass-dialog-container',
      }
    );

    dialogRef.afterClosed().subscribe(result => {
      if (result?.navigateTo) {
        this.router.navigate([result.navigateTo]);
      }
    });
  }

  private showSuccessToast(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      horizontalPosition: 'end',
      verticalPosition: 'bottom',
      panelClass: ['success-toast'],
    });
  }

  private showErrorToast(message: string, action?: string): void {
    this.snackBar.open(message, action || 'Close', {
      duration: 5000,
      horizontalPosition: 'end',
      verticalPosition: 'bottom',
      panelClass: ['error-toast'],
    });
  }
}
