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
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinner } from '@angular/material/progress-spinner';

import { LoadingSkeletonComponent } from '../loading-skeleton/loading-skeleton.component';
import { SongListComponent } from '../song-list/song-list.component';
import {
  SongCollectionConfig,
  SongCollectionHeaderSearchControl,
  SongCollectionSortDirection,
  SongCollectionSortingConfig,
  SongCollectionSortingOption,
  SongCollectionSortingState,
  SongCollectionViewState,
} from './song-collection.types';
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
    MatChipsModule,
    MatFormFieldModule,
    MatIcon,
    MatInputModule,
    MatMenuModule,
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
  readonly headerConfig = computed(() => this.config().header ?? null);
  readonly headerTitle = computed(() => this.headerConfig()?.title ?? 'Songs');
  readonly headerSubtitle = computed(() => this.headerConfig()?.subtitle ?? null);
  readonly headerControls = computed(() => this.headerConfig()?.controls ?? []);
  readonly headerInfoButton = computed(() => this.headerConfig()?.infoButton ?? null);
  readonly sortingConfig = computed<SongCollectionSortingConfig | null>(
    () => this.config().sorting ?? null
  );
  readonly sortingOptions = computed(() => this.sortingConfig()?.options ?? []);
  readonly hasSortingOptions = computed(() => this.sortingOptions().length > 0);
  readonly sortingLabel = computed(() => this.sortingConfig()?.label ?? 'Sort songs');
  private readonly sortingMenuOpen = signal(false);
  readonly isSortingMenuOpen = this.sortingMenuOpen.asReadonly();
  private readonly activeSortStates = signal<SongCollectionSortingState[]>([]);
  readonly sortingChips = computed(() => this.computeSortingChipOrder());

  ngOnInit(): void {
    this.initializeCollection();
    this.setupScrollListener();
    this.emitViewState();
    this.initializeSortingEffect();
  }

  private initializeCollection(): void {
    this.loadPage(this.config().initialPage ?? 1, false);
  }

  private computeSortingChipOrder(): SongCollectionSortingOption[] {
    const options = this.sortingOptions();
    if (!options.length) {
      return [];
    }

    const active = this.activeSortStates();
    const activeKeys = new Set(active.map(state => state.key));
    const orderedActive = active
      .map(state => options.find(option => option.key === state.key))
      .filter((option): option is SongCollectionSortingOption => Boolean(option));

    const inactive = options.filter(option => !activeKeys.has(option.key));
    return [...orderedActive, ...inactive];
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

  private initializeSortingEffect(): void {
    effect(
      () => {
        const initialState = this.sortingConfig()?.initialState ?? [];
        this.activeSortStates.set(initialState);
      },
      { injector: this.injector }
    );
  }

  onSortingMenuOpened(): void {
    this.sortingMenuOpen.set(true);
  }

  onSortingMenuClosed(): void {
    this.sortingMenuOpen.set(false);
  }

  handleSortingChipClick(option: SongCollectionSortingOption): void {
    if (option.disabled) {
      return;
    }

    const current = this.activeSortStates();
    const existingIndex = current.findIndex(state => state.key === option.key);
    let next: SongCollectionSortingState[];

    if (existingIndex === -1) {
      const direction: SongCollectionSortDirection = option.initialDirection ?? 'asc';
      next = [...current, { key: option.key, direction }];
    } else {
      const existing = current[existingIndex];
      if (existing.direction === 'asc') {
        next = current.map((state, index) =>
          index === existingIndex ? { key: option.key, direction: 'desc' } : state
        );
      } else {
        next = current.filter((_, index) => index !== existingIndex);
      }
    }

    this.activeSortStates.set(next);
    this.emitSortingChange(next);
  }

  isSortingChipActive(option: SongCollectionSortingOption): boolean {
    return Boolean(this.getSortState(option.key));
  }

  getSortingDirectionIcon(option: SongCollectionSortingOption): string | null {
    const state = this.getSortState(option.key);
    if (!state) {
      return null;
    }
    return state.direction === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  private emitSortingChange(active: SongCollectionSortingState[]): void {
    const sorting = this.sortingConfig();
    if (!sorting) {
      return;
    }
    sorting.onChange(active);
  }

  private getSortState(key: string): SongCollectionSortingState | undefined {
    return this.activeSortStates().find(state => state.key === key);
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

  handleHeaderSearchInput(control: SongCollectionHeaderSearchControl, event: Event): void {
    const input = event.target as HTMLInputElement | null;
    control.onValueChange(input?.value ?? '');
  }

  resolveIsAuthenticated(): boolean {
    const isAuthenticated = this.config().isAuthenticated;
    if (typeof isAuthenticated === 'function') {
      return isAuthenticated();
    }
    return Boolean(isAuthenticated);
  }

  onHeaderInfoButtonClick(): void {
    const infoButton = this.headerInfoButton();
    infoButton?.onClick();
  }
}
