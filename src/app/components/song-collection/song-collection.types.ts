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
}
