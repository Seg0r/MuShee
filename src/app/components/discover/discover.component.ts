import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
  computed,
  viewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatToolbarModule } from '@angular/material/toolbar';

import { LoadingSkeletonComponent } from '../loading-skeleton/loading-skeleton.component';
import { SongListComponent } from '../song-list/song-list.component';

import { SongService } from '../../services/song.service';
import { UserLibraryService } from '../../services/user-library.service';
import { AuthService } from '../../services/auth.service';
import { ErrorHandlingService } from '../../services/error-handling.service';

import type { PublicSongListItemDto, UserLibraryItemDto } from '@/types';
import { SongTileData } from '../song-tile/song-tile.component';

const pageSongLimit = 50;
@Component({
  selector: 'app-discover',
  standalone: true,
  imports: [
    CommonModule,
    LoadingSkeletonComponent,
    SongListComponent,
    MatSnackBarModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatToolbarModule,
  ],
  templateUrl: './discover.component.html',
  styleUrl: './discover.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiscoverComponent implements OnInit {
  // ============================================================================
  // Dependency Injection
  // ============================================================================

  private readonly songService = inject(SongService);
  private readonly userLibraryService = inject(UserLibraryService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly errorHandlingService = inject(ErrorHandlingService);

  // ============================================================================
  // Template References
  // ============================================================================

  readonly scrollContainer = viewChild<ElementRef>('scrollContainer');

  // ============================================================================
  // Core Data Signals
  // ============================================================================

  private readonly publicSongs = signal<PublicSongListItemDto[]>([]);
  private readonly userLibrarySongs = signal<UserLibraryItemDto[]>([]);
  private readonly paginationState = signal({ page: 1, totalPages: 1 });

  // ============================================================================
  // Loading/UI State Signals
  // ============================================================================

  readonly isInitialLoading = signal<boolean>(true);
  readonly isPaginationLoading = signal<boolean>(false);
  private readonly scrollPosition = signal<number>(0);
  private readonly addingToLibraryMap = signal<Map<string, boolean>>(new Map());

  // ============================================================================
  // Error State Signal
  // ============================================================================

  readonly error = signal<{ message: string; code: string } | null>(null);

  // ============================================================================
  // Public Computed Signals for Template
  // ============================================================================

  /**
   * Visible songs for template rendering
   */
  readonly visibleSongs = computed(() => this.publicSongs());

  /**
   * Set of user's library song IDs for quick lookup
   */
  readonly userLibrarySongIds = computed(
    () => new Set(this.userLibrarySongs().map(s => s.song_id))
  );

  /**
   * Check if back-to-top button should be visible
   */
  readonly isBackToTopVisible = computed(() => this.scrollPosition() > 300);

  /**
   * Check if there are more pages to load
   */
  readonly shouldShowLoadMore = computed(() => {
    const page = this.paginationState().page;
    const total = this.paginationState().totalPages;
    return page < total && !this.isPaginationLoading();
  });

  /**
   * Total number of skeleton items to show during initial load
   */
  readonly skeletonCount = computed(() => 50);

  /**
   * Indicates if currently loading
   */
  readonly isLoading = computed(() => this.isInitialLoading() || this.isPaginationLoading());

  /**
   * Public authentication state for template binding
   */
  readonly isAuthenticated = computed(() => this.authService.isAuthenticated());

  // ============================================================================
  // Public Helper Methods for Template
  // ============================================================================

  /**
   * Check if a specific song is in user's library
   */
  isSongInLibrary(songId: string): boolean {
    return this.userLibrarySongIds().has(songId);
  }

  /**
   * Check if currently adding a specific song to library
   */
  isAddingToLibrary(songId: string): boolean {
    return this.addingToLibraryMap().get(songId) ?? false;
  }

  /**
   * Get button state for a song
   */
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

  /**
   * Get button text for a song
   */
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

  /**
   * Get configuration for song tile component
   */

  // ============================================================================
  // Lifecycle Hooks
  // ============================================================================

  ngOnInit(): void {
    this.initializeView();
    this.setupScrollListener();
  }

  // ============================================================================
  // Initialization Methods
  // ============================================================================

  /**
   * Initialize the discover view
   * Loads initial public songs and user library
   */
  private async initializeView(): Promise<void> {
    console.log('Initializing discover view');
    this.isInitialLoading.set(true);

    try {
      // Load public songs (first page)
      const songsResponse = await this.songService.getPublicSongsList({
        page: 1,
        limit: pageSongLimit,
      });

      this.publicSongs.set(songsResponse.data);
      this.paginationState.set({
        page: songsResponse.pagination.page,
        totalPages: songsResponse.pagination.total_pages,
      });

      // Load user library if authenticated
      if (this.authService.isAuthenticated()) {
        try {
          const libraryResponse = await this.userLibraryService.getUserLibrary({
            page: 1,
            limit: pageSongLimit,
          });
          this.userLibrarySongs.set(libraryResponse.data);
        } catch (error) {
          console.warn('Failed to load user library:', error);
          // Non-fatal error - continue without library data
        }
      }

      this.error.set(null);
      console.log('Discover view initialized successfully');
    } catch (error) {
      console.error('Error initializing discover view:', error);
      const appError = this.errorHandlingService.mapGenericError(error);
      this.error.set({
        message: appError.message,
        code: appError.code,
      });
      this.showErrorToast(appError.message, 'Retry');
    } finally {
      this.isInitialLoading.set(false);
    }
  }

  /**
   * Setup scroll listener for infinite scroll and back-to-top button
   */
  private setupScrollListener(): void {
    if (!this.scrollContainer()) {
      console.warn('Scroll container not found');
      return;
    }

    const container = this.scrollContainer()!.nativeElement;
    container.addEventListener('scroll', () => {
      this.scrollPosition.set(container.scrollTop);

      // Check if user scrolled near bottom (50 items from bottom)
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;
      const scrollTop = container.scrollTop;

      // Approximate item height based on card dimensions
      const itemHeight = 200; // Adjust based on actual card height
      const threshold = scrollHeight - clientHeight - itemHeight * 50;

      if (scrollTop > threshold && this.shouldShowLoadMore()) {
        this.loadMoreSongs();
      }
    });
  }

  /**
   * Load the next page of public songs (infinite scroll)
   */
  private async loadMoreSongs(): Promise<void> {
    if (this.isPaginationLoading() || !this.shouldShowLoadMore()) {
      return;
    }

    this.isPaginationLoading.set(true);
    const nextPage = this.paginationState().page + 1;

    try {
      console.log('Loading page:', nextPage);
      const response = await this.songService.getPublicSongsList({
        page: nextPage,
        limit: 50,
      });

      // Append new songs to existing list
      this.publicSongs.update(songs => [...songs, ...response.data]);
      this.paginationState.update(state => ({
        ...state,
        page: response.pagination.page,
        totalPages: response.pagination.total_pages,
      }));

      this.error.set(null);
    } catch (error) {
      console.error('Error loading more songs:', error);
      const appError = this.errorHandlingService.mapGenericError(error);
      this.error.set({
        message: appError.message,
        code: appError.code,
      });
      this.showErrorToast(appError.message);
    } finally {
      this.isPaginationLoading.set(false);
    }
  }

  // ============================================================================
  // Song Card Interaction Methods
  // ============================================================================

  /**
   * Handle add to library button click
   */
  async onAddToLibrary(song: SongTileData): Promise<void> {
    if (!('id' in song)) {
      console.error('Invalid song data for onAddToLibrary', song);
      return;
    }
    const publicSong = song as PublicSongListItemDto;
    const songId = publicSong.id;
    // Check authentication
    if (!this.authService.isAuthenticated()) {
      await this.router.navigate(['/login']);
      return;
    }

    // Prevent duplicate operations
    if (this.isAddingToLibrary(songId)) {
      return;
    }

    // Set loading state
    this.addingToLibraryMap.update(map => {
      map.set(songId, true);
      return new Map(map);
    });

    try {
      const response = await this.userLibraryService.addSongToLibrary({
        song_id: songId,
      });

      // Add to user library
      this.userLibrarySongs.update(songs => [
        ...songs,
        {
          song_id: response.song_id,
          song_details: response.song_details,
          added_at: response.created_at,
        },
      ]);

      this.showSuccessToast('Song added to your library!');
      console.log('Song added successfully:', songId);
    } catch (error) {
      console.error('Error adding song to library:', error);
      const appError = this.errorHandlingService.mapGenericError(error);
      this.showErrorToast(appError.message);
    } finally {
      // Clear loading state
      this.addingToLibraryMap.update(map => {
        map.delete(songId);
        return new Map(map);
      });
    }
  }

  /**
   * Handle song card click (navigate to sheet music viewer)
   */
  async onSongCardClick(song: SongTileData): Promise<void> {
    if (!('id' in song)) {
      console.error('Invalid song data for onSongCardClick', song);
      return;
    }
    await this.router.navigate(['/song', (song as PublicSongListItemDto).id]);
  }

  // ============================================================================
  // UI Action Methods
  // ============================================================================

  /**
   * Scroll to top of the page smoothly
   */
  scrollToTop(): void {
    const container = this.scrollContainer();
    if (container) {
      container.nativeElement.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    }
  }

  /**
   * Retry loading initial data
   */
  async retryInitialize(): Promise<void> {
    this.initializeView();
  }

  // ============================================================================
  // Notification Methods
  // ============================================================================

  /**
   * Show success toast notification
   */
  private showSuccessToast(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      horizontalPosition: 'end',
      verticalPosition: 'bottom',
      panelClass: ['success-toast'],
    });
  }

  /**
   * Show error toast notification
   */
  private showErrorToast(message: string, action?: string): void {
    this.snackBar.open(message, action || 'Close', {
      duration: 5000,
      horizontalPosition: 'end',
      verticalPosition: 'bottom',
      panelClass: ['error-toast'],
    });
  }
}
