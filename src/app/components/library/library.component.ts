import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  effect,
  DestroyRef,
  Injector,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import type { UserLibraryItemDto, ErrorCode, ProfileDto, UploadSongResponseDto } from '@/types';
import { UserLibraryService } from '@/app/services/user-library.service';
import { ProfileService } from '@/app/services/profile.service';
import { SongCardComponent } from '../song-card/song-card.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../loading-skeleton/loading-skeleton.component';
import { UploadDialogComponent } from '../upload-dialog/upload-dialog.component';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { OnboardingDialogComponent } from '../onboarding-dialog/onboarding-dialog.component';

@Component({
  selector: 'app-library',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    SongCardComponent,
    EmptyStateComponent,
    LoadingSkeletonComponent,
  ],
  templateUrl: './library.component.html',
  styleUrl: './library.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibraryComponent implements OnInit, OnDestroy {
  private readonly userLibraryService = inject(UserLibraryService);
  private readonly profileService = inject(ProfileService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  // ============================================================================
  // Data Signals
  // ============================================================================

  private readonly songs = signal<UserLibraryItemDto[]>([]);
  private readonly currentPage = signal<number>(1);
  private readonly pageSize = signal<number>(50);
  private readonly totalItems = signal<number>(0);

  // ============================================================================
  // Loading Signals
  // ============================================================================

  private readonly initialLoading = signal<boolean>(true);
  private readonly paginationLoading = signal<boolean>(false);

  // ============================================================================
  // Error Signals
  // ============================================================================

  private readonly error = signal<string | null>(null);
  private readonly errorCode = signal<ErrorCode | null>(null);

  // ============================================================================
  // UI State Signals
  // ============================================================================

  private readonly selectedSongForDelete = signal<UserLibraryItemDto | null>(null);

  // ============================================================================
  // Profile Signals
  // ============================================================================

  private readonly userProfile = signal<ProfileDto | null>(null);

  // ============================================================================
  // Computed Signals (Derived State)
  // ============================================================================

  readonly isEmpty = computed(() => this.songs().length === 0 && !this.initialLoading());

  readonly hasMoreItems = computed(() => this.currentPage() * this.pageSize() < this.totalItems());

  readonly showFindSimilarFab = computed(() => this.songs().length > 0);

  readonly totalPages = computed(() => Math.ceil(this.totalItems() / this.pageSize()));

  readonly pagination = computed(() => ({
    page: this.currentPage(),
    limit: this.pageSize(),
    total_items: this.totalItems(),
    total_pages: this.totalPages(),
  }));

  // Public computed signals for template
  readonly visibleSongs = this.songs.asReadonly();
  readonly isLoading = this.initialLoading.asReadonly();
  readonly isPaginationLoading = this.paginationLoading.asReadonly();
  readonly errorMessage = this.error.asReadonly();
  readonly isEmptyState = this.isEmpty;
  readonly canFindSimilar = this.showFindSimilarFab;

  ngOnInit(): void {
    this.loadInitialLibrary();
    this.checkOnboardingStatus();
  }

  ngOnDestroy(): void {
    this.songs.set([]);
    this.error.set(null);
  }

  // ============================================================================
  // Public Methods
  // ============================================================================

  onSongCardClick(song: UserLibraryItemDto): void {
    this.router.navigate(['/songs', song.song_id]);
  }

  onSongDeleteClick(song: UserLibraryItemDto): void {
    this.selectedSongForDelete.set(song);
    this.openDeleteConfirmDialog();
  }

  onUploadClick(): void {
    this.openUploadDialog();
  }

  onFindSimilarClick(): void {
    // TODO: Implement AI suggestions dialog
  }

  onRetryLoadLibrary(): void {
    this.error.set(null);
    this.initialLoading.set(true);
    this.loadInitialLibrary();
  }

  onScroll(event: Event): void {
    const scrollElement = event.target as HTMLElement;
    const scrollPosition = scrollElement.scrollHeight - scrollElement.scrollTop;
    const threshold = 500;

    if (scrollPosition < threshold && !this.paginationLoading() && this.hasMoreItems()) {
      this.loadNextPage();
    }
  }

  // ============================================================================
  // Private Methods - Dialogs
  // ============================================================================

  private openUploadDialog(): void {
    this.dialog
      .open(UploadDialogComponent, {
        width: '500px',
        maxWidth: '90vw',
        disableClose: false,
      })
      .afterClosed()
      .subscribe(result => {
        if (result?.success) {
          const response = result.response as UploadSongResponseDto;
          this.handleUploadSuccess(response);
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
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === true) {
        this.handleDeleteConfirmed();
      }
    });
  }

  private openOnboardingDialog(): void {
    this.dialog
      .open(OnboardingDialogComponent, {
        width: '600px',
        maxWidth: '90vw',
        disableClose: true,
      })
      .afterClosed()
      .subscribe(result => {
        if (result?.success) {
          this.showSuccessNotification('Welcome! Happy listening!');
        }
      });
  }

  // ============================================================================
  // Private Methods - Data Loading
  // ============================================================================

  private loadInitialLibrary(): void {
    this.initialLoading.set(true);
    this.error.set(null);

    this.userLibraryService
      .getUserLibrary({
        page: 1,
        limit: this.pageSize(),
        sort: 'created_at',
        order: 'desc',
      })
      .then(response => {
        this.songs.set(response.data);
        this.totalItems.set(response.pagination.total_items);
        this.currentPage.set(1);
      })
      .catch((err: unknown) => {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load library';
        this.error.set(errorMessage);
        this.errorCode.set('INTERNAL_ERROR');
      })
      .finally(() => {
        this.initialLoading.set(false);
      });
  }

  private loadNextPage(): void {
    if (this.paginationLoading() || !this.hasMoreItems()) return;

    this.paginationLoading.set(true);
    const nextPage = this.currentPage() + 1;

    this.userLibraryService
      .getUserLibrary({
        page: nextPage,
        limit: this.pageSize(),
        sort: 'created_at',
        order: 'desc',
      })
      .then(response => {
        this.songs.update(existing => [...existing, ...response.data]);
        this.currentPage.set(nextPage);
        this.error.set(null);
      })
      .catch((err: unknown) => {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load more songs';
        this.error.set(errorMessage);
        this.errorCode.set('INTERNAL_ERROR');
      })
      .finally(() => {
        this.paginationLoading.set(false);
      });
  }

  private handleUploadSuccess(response: UploadSongResponseDto): void {
    // Convert UploadSongResponseDto to UserLibraryItemDto
    const newSong: UserLibraryItemDto = {
      song_id: response.id,
      song_details: response.song_details,
      added_at: response.added_to_library_at,
    };

    this.songs.update(existing => [newSong, ...existing]);
    this.totalItems.update(count => count + 1);
    this.showSuccessNotification('Song uploaded successfully');
  }

  private handleDeleteConfirmed(): void {
    const song = this.selectedSongForDelete();
    if (!song) return;

    this.handleSongDeleted(song.song_id);
    this.selectedSongForDelete.set(null);
  }

  private handleSongDeleted(songId: string): void {
    // Optimistic UI: remove immediately
    this.songs.update(existing => existing.filter(item => item.song_id !== songId));
    this.totalItems.update(count => Math.max(0, count - 1));

    this.userLibraryService
      .removeSongFromLibrary(songId)
      .then(() => {
        this.showSuccessNotification('Song deleted');
      })
      .catch((error: unknown) => {
        // Rollback on error
        this.loadInitialLibrary();
        const errorMessage = error instanceof Error ? error.message : 'Failed to delete song';
        this.showErrorNotification(errorMessage);
      });
  }

  private checkOnboardingStatus(): void {
    this.profileService
      .getCurrentUserProfile()
      .then((profile: ProfileDto) => {
        this.userProfile.set(profile);

        // Show onboarding if incomplete and library empty
        effect(
          () => {
            if (!profile.has_completed_onboarding && this.isEmpty()) {
              this.openOnboardingDialog();
            }
          },
          { injector: this.injector }
        );
      })
      .catch((error: unknown) => {
        // Silently handle profile not found, assume new user
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
}
