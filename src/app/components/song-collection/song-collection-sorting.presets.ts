import { SongCollectionSortingOption } from './song-collection.types';

export const SONG_COLLECTION_DEFAULT_SORTING_OPTIONS: readonly SongCollectionSortingOption[] =
  Object.freeze([
    { key: 'title', label: 'Title', initialDirection: 'asc' },
    { key: 'composer', label: 'Composer', initialDirection: 'asc' },
  ]);

export const SONG_COLLECTION_DEFAULT_SORTING_LABEL = 'Sort most recent songs first';
