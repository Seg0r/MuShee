import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  OnInit,
  output,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';

import { LoadingSkeletonComponent } from '../loading-skeleton/loading-skeleton.component';
import { SongListComponent } from '../song-list/song-list.component';
import { SongCollectionConfig, SongCollectionViewState } from './song-collection.types';
import { SongTileData } from '../song-tile/song-tile.component';
import { ErrorHandlingService } from '../../services/error-handling.service';

const defaultLimit = 50;
const defaultSkeletonConfig = { count: 50, rows: undefined, cols: undefined };

@Component({
  selector: 'app-song-collection',
  standalone: true,
  imports: [
    CommonModule,
    LoadingSkeletonComponent,
    SongListComponent,
    MatProgressSpinner,
    MatButtonModule,
    MatIcon,
  ],
  templateUrl: './song-collection.component.html',
  styleUrl: './song-collection.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SongCollectionComponent implements OnInit {
  private readonly injector = inject(Injector);
  private readonly errorHandlingService = inject(ErrorHandlingService);

  readonly config = input.required<SongCollectionConfig>();
  readonly emptyStateTemplate = input<TemplateRef<void> | null>(null);
  readonly showBackToTop = input<boolean>(true);

  readonly tileClick = output<SongTileData>();
  readonly addToLibrary = output<SongTileData>();
  readonly deleteClick = output<SongTileData>();
  readonly viewStateChange = output<SongCollectionViewState>();

  readonly scrollContainer = viewChild<ElementRef>('scrollContainer');

  private readonly songs = signal<SongTileData[]>([]);
  private readonly paginationState = signal({
    page: 0,
    totalPages: 1,
    totalItems: 0,
    limit: defaultLimit,
  });
  readonly isInitialLoading = signal(true);
  readonly isPaginationLoading = signal(false);
  readonly error = signal<string | null>(null);
  private readonly scrollPosition = signal(0);

  readonly visibleSongs = this.songs.asReadonly();
  readonly isLoading = computed(() => this.isInitialLoading() || this.isPaginationLoading());
  readonly shouldShowLoadMore = computed(
    () =>
      this.paginationState().page < this.paginationState().totalPages && !this.isPaginationLoading()
  );
  readonly shouldShowEmptyState = computed(
    () => !this.isLoading() && !this.error() && this.songs().length === 0
  );
  readonly isBackToTopVisible = computed(() => this.scrollPosition() > 300);
  readonly skeletonConfig = computed(
    () => this.config().loadingSkeletonConfig ?? defaultSkeletonConfig
  );
  readonly isUserLibraryView = computed(() => Boolean(this.config().isUserLibrary));
  readonly skeletonCount = computed(() => this.skeletonConfig().count ?? 50);
  readonly skeletonRows = computed(() => this.skeletonConfig().rows ?? 2);
  readonly skeletonCols = computed(() => this.skeletonConfig().cols ?? 4);
  readonly defaultSongInLibrary = () => false;

  ngOnInit(): void {
    this.initializeCollection();
    this.setupScrollListener();
    this.emitViewState();
  }

  private initializeCollection(): void {
    this.loadPage(this.config().initialPage ?? 1, false);
  }

  private async loadPage(page: number, append: boolean): Promise<void> {
    if (!append) {
      this.isInitialLoading.set(true);
      this.error.set(null);
    }

    if (append) {
      this.isPaginationLoading.set(true);
    }

    const limit = this.config().limit ?? defaultLimit;

    try {
      const response = await this.config().fetchPage(page, limit);
      this.paginationState.set({
        page: response.pagination.page,
        totalPages: response.pagination.total_pages,
        totalItems: response.pagination.total_items,
        limit: response.pagination.limit,
      });

      if (append) {
        this.songs.set(this.mergeSongs(this.songs(), response.data));
      } else {
        this.songs.set(response.data);
      }

      this.error.set(null);
    } catch (fetchError) {
      const mappedError = this.errorHandlingService.mapGenericError(fetchError);
      this.error.set(mappedError.message);
    } finally {
      if (!append) {
        this.isInitialLoading.set(false);
      }
      if (append) {
        this.isPaginationLoading.set(false);
      }
    }
  }

  private async loadMore(): Promise<void> {
    if (this.isPaginationLoading() || !this.shouldShowLoadMore()) {
      return;
    }
    const nextPage = this.paginationState().page + 1;
    await this.loadPage(nextPage, true);
  }

  private mergeSongs(existing: SongTileData[], incoming: SongTileData[]): SongTileData[] {
    const mergeStrategy = this.config().mergeStrategy;
    if (mergeStrategy) {
      return mergeStrategy(existing, incoming);
    }
    const seen = new Set(existing.map(song => this.getSongId(song)));
    const merged = [...existing];
    incoming.forEach(song => {
      const id = this.getSongId(song);
      if (!seen.has(id)) {
        merged.push(song);
        seen.add(id);
      }
    });
    return merged;
  }

  private getSongId(song: SongTileData): string {
    return 'id' in song ? song.id : song.song_id;
  }

  private setupScrollListener(): void {
    effect(
      () => {
        const containerRef = this.scrollContainer();
        if (!containerRef) {
          return;
        }

        const container = containerRef.nativeElement as HTMLElement;
        const scrollHandler = () => this.handleScroll(container);
        container.addEventListener('scroll', scrollHandler);

        return () => container.removeEventListener('scroll', scrollHandler);
      },
      { injector: this.injector }
    );
  }

  private handleScroll(container: HTMLElement): void {
    this.scrollPosition.set(container.scrollTop);

    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;
    const scrollTop = container.scrollTop;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
    const loadMoreThreshold = 200;

    if (distanceFromBottom < loadMoreThreshold) {
      this.loadMore();
    }
  }

  private emitViewState(): void {
    effect(
      () => {
        this.viewStateChange.emit({
          isEmpty: this.shouldShowEmptyState(),
          isLoading: this.isLoading(),
          error: this.error(),
          page: this.paginationState().page,
          totalPages: this.paginationState().totalPages,
        });
      },
      { injector: this.injector }
    );
  }

  retry(): void {
    this.loadPage(this.config().initialPage ?? 1, false);
  }

  scrollToTop(): void {
    const containerRef = this.scrollContainer();
    if (containerRef) {
      containerRef.nativeElement.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    }
  }

  resolveIsAuthenticated(): boolean {
    const isAuthenticated = this.config().isAuthenticated;
    if (typeof isAuthenticated === 'function') {
      return isAuthenticated();
    }
    return Boolean(isAuthenticated);
  }
}
