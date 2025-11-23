import {
  Component,
  ChangeDetectionStrategy,
  OnDestroy,
  OnInit,
  inject,
  signal,
  computed,
  viewChild,
  TemplateRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

import { SongService } from '../../services/song.service';
import { UserLibraryService } from '../../services/user-library.service';
import { AuthService } from '../../services/auth.service';
import { ErrorHandlingService } from '../../services/error-handling.service';

import type { UserLibraryItemDto } from '@/types';
import { SongCollectionComponent } from '../song-collection/song-collection.component';
import type {
  SongCollectionConfig,
  SongCollectionHeaderConfig,
  SongCollectionSortingConfig,
  SongCollectionSortingState,
} from '../song-collection/song-collection.types';
import { SongTileData } from '../song-tile/song-tile.component';
import {
  OnboardingDialogComponent,
  type OnboardingDialogData,
} from '../onboarding-dialog/onboarding-dialog.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import {
  SONG_COLLECTION_DEFAULT_SORTING_LABEL,
  SONG_COLLECTION_DEFAULT_SORTING_OPTIONS,
} from '../song-collection/song-collection-sorting.presets';
import type { PublicSongSortField, PublicSongsQueryParams } from '../../services/supabase.service';
import { SongCollectionSearchController } from '../song-collection/song-collection-search.controller';
import { LicenseInfoDialogComponent } from '../license-info-dialog/license-info-dialog.component';

const pageSongLimit = 50;

@Component({
  selector: 'app-discover',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    SongCollectionComponent,
    EmptyStateComponent,
    MatIcon,
    MatButtonModule,
  ],
  templateUrl: './discover.component.html',
  styleUrl: './discover.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiscoverComponent implements OnInit, OnDestroy {
  private readonly songService = inject(SongService);
  private readonly userLibraryService = inject(UserLibraryService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly errorHandlingService = inject(ErrorHandlingService);
  private readonly dialog = inject(MatDialog);

  readonly songCollectionRef = viewChild<SongCollectionComponent>('songCollection');
  readonly discoverEmptyStateComponent = viewChild<EmptyStateComponent>('discoverEmptyState');
  readonly discoverSearchEmptyStateComponent = viewChild<EmptyStateComponent>(
    'discoverSearchEmptyState'
  );

  private readonly userLibrarySongs = signal<UserLibraryItemDto[]>([]);
  private readonly addingToLibraryMap = signal<Map<string, boolean>>(new Map());
  private readonly sortingState = signal<SongCollectionSortingState[]>([]);
  private readonly searchController = new SongCollectionSearchController({
    label: 'Search songs',
    placeholder: 'Search title, subtitle, or composer',
    debounceMs: 700,
    onDebouncedChange: () => this.refreshCollection(),
  });

  readonly userLibrarySongIds = computed(
    () => new Set(this.userLibrarySongs().map(song => song.song_id))
  );
  readonly isAuthenticated = computed(() => this.authService.isAuthenticated());

  readonly hasActiveSearch = computed(() => Boolean(this.searchController.searchTermSignal()));

  readonly currentEmptyStateTemplate = computed<TemplateRef<void> | null>(() => {
    if (this.hasActiveSearch()) {
      return this.discoverSearchEmptyStateComponent()?.templateRef() ?? null;
    }
    return this.discoverEmptyStateComponent()?.templateRef() ?? null;
  });

  readonly discoverSortingConfig: SongCollectionSortingConfig = {
    options: [...SONG_COLLECTION_DEFAULT_SORTING_OPTIONS],
    label: SONG_COLLECTION_DEFAULT_SORTING_LABEL,
    initialState: [],
    onChange: sorting => this.handleDiscoverSortingChange(sorting),
  };

  readonly discoverHeader = computed<SongCollectionHeaderConfig>(() => ({
    title: 'Discover',
    controls: [this.searchController.headerControl()],
    infoButton: {
      ariaLabel: 'View license and acknowledgement details',
      onClick: () => this.openLicenseInfoDialog(),
    },
  }));

  readonly discoverCollectionConfig = computed<SongCollectionConfig<SongTileData>>(() => ({
    fetchPage: (page, limit) => this.fetchDiscoverPage(page, limit),
    limit: pageSongLimit,
    isUserLibrary: false,
    isSongInLibrary: songId => this.userLibrarySongIds().has(songId),
    isAuthenticated: () => this.authService.isAuthenticated(),
    loadingSkeletonConfig: { count: 50 },
    header: this.discoverHeader(),
    sorting: this.discoverSortingConfig,
  }));

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

  onClearSearch(): void {
    // Clear the search by triggering the input handler with empty value
    this.searchController.headerControl().onValueChange('');
    this.refreshCollection();
  }

  private fetchDiscoverPage(page: number, limit: number) {
    const sortingStates = this.sortingState();
    const params: PublicSongsQueryParams = {
      page,
      limit,
    };

    const trimmedSearch = this.searchController.searchTermSignal();
    if (trimmedSearch) {
      params.search = trimmedSearch;
    }

    if (sortingStates.length) {
      const descriptors = sortingStates.map(state => ({
        field: this.mapSortKey(state.key),
        direction: state.direction,
      }));
      params.sorts = descriptors;

      const [primary] = descriptors;
      params.sort = primary.field;
      params.order = primary.direction;
    }

    return this.songService.getPublicSongsList(params);
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

  openLicenseInfoDialog(): void {
    this.dialog.open(LicenseInfoDialogComponent, {
      width: '480px',
      maxWidth: '90vw',
      panelClass: 'glass-dialog-container',
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

  private handleDiscoverSortingChange(sorting: SongCollectionSortingState[]): void {
    const next = sorting.length ? sorting : [];
    this.sortingState.set(next);
    this.refreshCollection();
  }

  private mapSortKey(key: string): PublicSongSortField {
    switch (key) {
      case 'title':
      case 'composer':
      case 'created_at':
        return key;
      default:
        return 'created_at';
    }
  }

  private refreshCollection(): void {
    this.songCollectionRef()?.retry();
  }

  ngOnDestroy(): void {
    this.searchController.destroy();
  }
}
