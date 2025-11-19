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
}

export interface SongCollectionHeaderConfig {
  title?: string;
  subtitle?: string;
  controls?: SongCollectionHeaderControl[];
}

interface SongCollectionHeaderControlBase {
  id?: string;
  label: string;
}

export interface SongCollectionHeaderSelectControl extends SongCollectionHeaderControlBase {
  type: 'select';
  value?: string;
  placeholder?: string;
  options: SongCollectionHeaderSelectOption[];
  onValueChange: (value: string) => void;
}

export interface SongCollectionHeaderSearchControl extends SongCollectionHeaderControlBase {
  type: 'search';
  value?: string;
  placeholder?: string;
  onValueChange: (value: string) => void;
}

export type SongCollectionHeaderControl =
  | SongCollectionHeaderSelectControl
  | SongCollectionHeaderSearchControl;

export interface SongCollectionHeaderSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}
