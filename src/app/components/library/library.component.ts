import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  viewChild,
  Injector,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

import type { UserLibraryItemDto, ProfileDto } from '@/types';
import { UserLibraryService } from '@/app/services/user-library.service';
import type {
  LibraryQueryParams,
  LibrarySortDescriptor,
  LibrarySortField,
} from '@/app/services/supabase.service';
import { ProfileService } from '@/app/services/profile.service';
import { AiSuggestionsService } from '@/app/services/ai-suggestions.service';
import { AuthService } from '@/app/services/auth.service';

import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { UploadDialogComponent } from '../upload-dialog/upload-dialog.component';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import {
  OnboardingDialogComponent,
  type OnboardingDialogData,
} from '../onboarding-dialog/onboarding-dialog.component';
import { SuggestionsDialogComponent } from '../suggestions-dialog/suggestions-dialog.component';
import { SongTileData } from '../song-tile/song-tile.component';
import { SongCollectionComponent } from '../song-collection/song-collection.component';
import {
  SongCollectionConfig,
  SongCollectionSortingConfig,
  SongCollectionSortingState,
  SongCollectionViewState,
} from '../song-collection/song-collection.types';
import {
  SONG_COLLECTION_DEFAULT_SORTING_LABEL,
  SONG_COLLECTION_DEFAULT_SORTING_OPTIONS,
} from '../song-collection/song-collection-sorting.presets';
import { SongCollectionSearchController } from '../song-collection/song-collection-search.controller';

@Component({
  selector: 'app-library',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIcon,
    SongCollectionComponent,
    EmptyStateComponent,
  ],
  templateUrl: './library.component.html',
  styleUrl: './library.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibraryComponent implements OnInit, OnDestroy {
  private readonly userLibraryService = inject(UserLibraryService);
  private readonly profileService = inject(ProfileService);
  private readonly aiSuggestionsService = inject(AiSuggestionsService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly injector = inject(Injector);

  readonly songCollectionRef = viewChild<SongCollectionComponent>('songCollection');

  private readonly suggestionsLoading = signal(false);
  private readonly selectedSongForDelete = signal<UserLibraryItemDto | null>(null);
  private readonly userProfile = signal<ProfileDto | null>(null);
  private readonly collectionStateSignal = signal<SongCollectionViewState>({
    isEmpty: false,
    isLoading: true,
    error: null,
    page: 0,
    totalPages: 0,
  });

  readonly collectionState = this.collectionStateSignal.asReadonly();

  private readonly sortingState = signal<SongCollectionSortingState[]>([]);
  private readonly searchController = new SongCollectionSearchController({
    label: 'Search library',
    placeholder: 'Search title, subtitle, or composer',
    debounceMs: 700,
    onDebouncedChange: () => this.refreshCollection(),
  });

  readonly librarySortingConfig: SongCollectionSortingConfig = {
    options: [...SONG_COLLECTION_DEFAULT_SORTING_OPTIONS],
    label: SONG_COLLECTION_DEFAULT_SORTING_LABEL,
    initialState: [],
    onChange: sorting => this.handleLibrarySortingChange(sorting),
  };

  readonly canFindSimilar = computed(
    () =>
      !this.collectionState().isLoading &&
      !this.collectionState().isEmpty &&
      !this.suggestionsLoading()
  );

  readonly libraryCollectionConfig = computed<SongCollectionConfig<SongTileData>>(() => ({
    fetchPage: (page, limit) => this.fetchLibraryPage(page, limit),
    limit: 50,
    isUserLibrary: true,
    mergeStrategy: (existing, incoming) => [...existing, ...incoming],
    loadingSkeletonConfig: { count: 8, rows: 2, cols: 4 },
    showBackToTop: true,
    header: {
      title: 'My Library',
      controls: [this.searchController.headerControl()],
    },
    sorting: this.librarySortingConfig,
  }));

  ngOnInit(): void {
    this.checkOnboardingStatus();
  }

  ngOnDestroy(): void {
    this.searchController.destroy();
  }

  onCollectionStateChange(state: SongCollectionViewState): void {
    this.collectionStateSignal.set(state);
  }

  onSongCardClick(song: SongTileData): void {
    if (!('song_id' in song)) {
      console.error('Invalid song data for onSongCardClick', song);
      return;
    }
    this.router.navigate(['/song', song.song_id]);
  }

  onSongDeleteClick(song: SongTileData): void {
    if (!('song_id' in song)) {
      console.error('Invalid song data for onSongDeleteClick', song);
      return;
    }
    this.selectedSongForDelete.set(song as UserLibraryItemDto);
    this.openDeleteConfirmDialog();
  }

  onUploadClick(): void {
    this.openUploadDialog();
  }

  async onFindSimilarClick(): Promise<void> {
    const userId = this.authService.user()?.id;
    if (!userId) {
      this.showErrorNotification('You must be logged in to use this feature.');
      return;
    }

    const dialogRef = this.dialog.open(SuggestionsDialogComponent, {
      width: this.getResponsiveDialogWidth(),
      height: this.getResponsiveDialogHeight(),
      data: { isLoading: true, suggestions: null, error: null },
      panelClass: 'glass-dialog-container',
    });

    this.suggestionsLoading.set(true);
    try {
      const suggestions = await this.aiSuggestionsService.generateSuggestionsForUser(userId);
      dialogRef.componentInstance.isLoading.set(false);
      dialogRef.componentInstance.suggestions.set(suggestions);
    } catch (error) {
      console.error('Error getting AI suggestions:', error);
      const errorMessage = 'Could not generate suggestions at this time.';
      dialogRef.componentInstance.isLoading.set(false);
      dialogRef.componentInstance.error.set(errorMessage);
    } finally {
      this.suggestionsLoading.set(false);
    }
  }

  private openUploadDialog(): void {
    this.dialog
      .open(UploadDialogComponent, {
        width: '500px',
        maxWidth: '90vw',
        disableClose: false,
        panelClass: 'glass-dialog-container',
      })
      .afterClosed()
      .subscribe(result => {
        if (result?.success) {
          this.handleUploadSuccess();
        }
      });
  }

  private openDeleteConfirmDialog(): void {
    const song = this.selectedSongForDelete();
    if (!song) return;

    const displayText = `${song.song_details.composer || 'Unknown'} - ${song.song_details.title || 'Unknown'}`;

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      maxWidth: '90vw',
      data: {
        title: 'Delete Song?',
        message: 'Are you sure you want to delete this song from your library?',
        itemDetails: displayText,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        confirmColor: 'warn',
      },
      panelClass: 'glass-dialog-container',
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === true) {
        this.handleDeleteConfirmed();
      }
    });
  }

  private openOnboardingDialog(): void {
    const dialogRef = this.dialog.open<OnboardingDialogComponent, OnboardingDialogData>(
      OnboardingDialogComponent,
      {
        width: '600px',
        maxWidth: '90vw',
        disableClose: true,
        data: { mode: 'authenticated' },
        panelClass: 'glass-dialog-container',
      }
    );

    dialogRef.afterClosed().subscribe(result => {
      if (result?.navigateTo) {
        this.router.navigate([result.navigateTo]);
      }
    });
  }

  private handleUploadSuccess(): void {
    this.refreshCollection();
    this.showSuccessNotification('Song uploaded successfully');
  }

  private handleDeleteConfirmed(): void {
    const song = this.selectedSongForDelete();
    if (!song) return;

    this.handleSongDeleted(song.song_id);
    this.selectedSongForDelete.set(null);
  }

  private handleSongDeleted(songId: string): void {
    this.userLibraryService
      .removeSongFromLibrary(songId)
      .then(() => {
        this.showSuccessNotification('Song deleted');
        this.refreshCollection();
      })
      .catch((error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : 'Failed to delete song';
        this.showErrorNotification(errorMessage);
      });
  }

  private refreshCollection(): void {
    this.songCollectionRef()?.retry();
  }

  private checkOnboardingStatus(): void {
    this.profileService
      .getCurrentUserProfile()
      .then((profile: ProfileDto) => {
        this.userProfile.set(profile);

        effect(
          () => {
            if (!profile.has_completed_onboarding && this.collectionState().isEmpty) {
              this.openOnboardingDialog();
            }
          },
          { injector: this.injector }
        );
      })
      .catch((error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : 'Failed to load profile';
        console.error(errorMessage);
        this.userProfile.set({
          id: '',
          updated_at: new Date().toISOString(),
          has_completed_onboarding: false,
        });
      });
  }

  private showSuccessNotification(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: ['success-snackbar'],
      horizontalPosition: 'end',
      verticalPosition: 'bottom',
    });
  }

  private showErrorNotification(message: string): void {
    this.snackBar.open(message, 'Dismiss', {
      duration: 5000,
      panelClass: ['error-snackbar'],
      horizontalPosition: 'end',
      verticalPosition: 'bottom',
    });
  }

  private fetchLibraryPage(page: number, limit: number) {
    const sortingStates = this.sortingState();
    const params: LibraryQueryParams = {
      page,
      limit,
    };

    const searchTerm = this.searchController.searchTerm();
    if (searchTerm) {
      params.search = searchTerm;
    }

    if (sortingStates.length) {
      const sortDescriptors: LibrarySortDescriptor[] = sortingStates.map(state => ({
        field: this.mapSortKey(state.key),
        direction: state.direction,
      }));
      params.sorts = sortDescriptors;

      // Provide primary sort fallback for services that rely on single-field params.
      const [primary] = sortDescriptors;
      params.sort = primary.field;
      params.order = primary.direction;
    }

    return this.userLibraryService.getUserLibrary(params);
  }

  private handleLibrarySortingChange(sorting: SongCollectionSortingState[]): void {
    const next = sorting.length ? sorting : [];
    this.sortingState.set(next);
    this.refreshCollection();
  }

  private mapSortKey(key: string): LibrarySortField {
    switch (key) {
      case 'title':
      case 'composer':
      case 'added_at':
      case 'created_at':
        return key;
      default:
        return 'created_at';
    }
  }

  private getResponsiveDialogWidth(): string {
    const width = window.innerWidth;
    if (width < 768) {
      return '90vw';
    }
    return '67vw';
  }

  private getResponsiveDialogHeight(): string {
    const height = window.innerHeight;
    if (height < 768) {
      return '90vh';
    }
    return '67vh';
  }
}
