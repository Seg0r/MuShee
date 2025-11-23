import type { SongTileData } from '../song-tile/song-tile.component';

export interface PaginationResponse<T extends SongTileData = SongTileData> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total_items: number;
    total_pages: number;
  };
}

export interface SongCollectionViewState {
  isEmpty: boolean;
  isLoading: boolean;
  error: string | null;
  page: number;
  totalPages: number;
}

export interface SongCollectionConfig<T extends SongTileData = SongTileData> {
  fetchPage: (page: number, limit: number) => Promise<PaginationResponse<T>>;
  limit?: number;
  initialPage?: number;
  isUserLibrary?: boolean;
  isAuthenticated?: boolean | (() => boolean);
  isSongInLibrary?: (songId: string) => boolean;
  mergeStrategy?: (existing: T[], incoming: T[]) => T[];
  loadingSkeletonConfig?: {
    count?: number;
    rows?: number;
    cols?: number;
  };
  showBackToTop?: boolean;
  header?: SongCollectionHeaderConfig;
  sorting?: SongCollectionSortingConfig;
}

export interface SongCollectionHeaderConfig {
  title?: string;
  subtitle?: string;
  controls?: SongCollectionHeaderSearchControl[];
  infoButton?: SongCollectionHeaderInfoButton;
  hasActiveFilter?: boolean;
}

interface SongCollectionHeaderControlBase {
  id?: string;
  label: string;
}

export interface SongCollectionHeaderSearchControl extends SongCollectionHeaderControlBase {
  value?: string;
  placeholder?: string;
  onValueChange: (value: string) => void;
}

export interface SongCollectionHeaderInfoButton {
  ariaLabel: string;
  onClick: () => void;
}

export type SongCollectionSortDirection = 'asc' | 'desc';

export interface SongCollectionSortingState {
  key: string;
  direction: SongCollectionSortDirection;
}

export interface SongCollectionSortingOption {
  key: string;
  label: string;
  disabled?: boolean;
  /** Direction applied when the option is first activated. Defaults to "asc". */
  initialDirection?: SongCollectionSortDirection;
}

export interface SongCollectionSortingConfig {
  options: SongCollectionSortingOption[];
  onChange: (sorting: SongCollectionSortingState[]) => void;
  /** Accessible label shown for the sorting panel. Defaults to "Sort songs". */
  label?: string;
  /** Optional sort state that should be selected when the control first renders. */
  initialState?: SongCollectionSortingState[];
}
