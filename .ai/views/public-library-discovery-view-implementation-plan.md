# View Implementation Plan: Public Library Discovery View

## 1. Overview

The Public Library Discovery View enables users to browse a collection of pre-loaded public domain songs and add them to their personal library. This view is accessible to both authenticated and unauthenticated users, with anonymous users able to browse but prompted to sign in when attempting to add songs to their library. The view implements infinite scroll pagination for browsing, optimistic UI patterns for add operations, and integrates with the shared song card component for consistent presentation.

## 2. View Routing

- **Route Path**: `/discover`
- **Access Level**: Public (unauthenticated and authenticated users)
- **Lazy Loading**: Yes, loaded as a feature module
- **Route Guard**: None required (public access)

## 3. Component Structure

```
DiscoverComponent (main view container)
├── LoadingSkeletonComponent (displayed during initial data fetch)
├── SongCardComponent[] (reusable card component with add-to-library action)
│   └── [actions] content projection slot
├── "Back to top" FAB (infinite scroll navigation)
└── Toast notification system (success/error feedback)
```

### High-Level Architecture

The discover view follows a signal-based reactive architecture with the following data flow:

1. **Initialization**: Component loads public songs on init using pagination parameters
2. **State Management**: Uses signals for songs list, loading states, and pagination
3. **Computed Signals**: Derives button states based on user's library status
4. **User Interactions**: Add-to-library actions trigger optimistic UI updates and API calls
5. **Infinite Scroll**: Triggered at 50-item bottom threshold, appends new songs to existing list

## 4. Component Details

### DiscoverComponent

- **Component Description**: Main view component managing public song browsing experience with infinite scroll pagination. Handles authentication state (authenticated/unauthenticated), library data fetching, song addition, and error handling.

- **Main Elements**:
  - Material toolbar (simplified for unauthenticated users or full shell for authenticated)
  - Song grid container with CSS grid layout
  - LoadingSkeletonComponent during initial load (50 skeletons)
  - SongCardComponent array rendered via @for loop with track by song id
  - "Back to top" FAB button (appears when scrolled >300px down)
  - Infinite scroll container with scroll event listener
  - Toast notification area for success/error messages

- **Handled Interactions**:
  - Load initial public songs page (page 1, limit 50)
  - Scroll to bottom threshold (50 items from bottom) → load next page
  - Click "Add to Library" button → add song to user's library (authenticated only)
  - Click "Back to top" FAB → smooth scroll to top
  - For unauthenticated users clicking add button → navigate to login
  - For authenticated users, check song-in-library status before enabling button

- **Handled Validation**:
  - API query parameters validation: page (positive integer), limit (1-100), sort (valid field), order (asc/desc)
  - Authentication validation (automatic via Supabase)
  - Song ID validation (UUID format, existence check via API)
  - Duplicate prevention: computed signal checks if song already in user's library before enabling add button
  - Error response validation: Standardized error format with error code and user-friendly message
  - Network error handling with retry capability
  - Timeout handling for add-to-library operations

- **Types**:
  - `PublicSongsListResponseDto`: Response from getPublicSongsList endpoint
  - `PublicSongListItemDto`: Individual song in public catalog
  - `PaginationDto`: Pagination metadata (page, limit, total_items, total_pages)
  - `AddUserSongResponseDto`: Response from addSongToLibrary endpoint
  - `UserLibraryListResponseDto`: User's library (fetched for checking song membership)
  - Component view model: `DiscoverViewState` (custom type for local component state)

- **Props**:
  - No @Input properties (singleton view component)
  - Receives authentication state from AuthService (injected)
  - Receives user library data from UserLibraryService (injected)

### SongCardComponent (Reusable, Used in Both Library and Discover Views)

- **Component Description**: Reusable card component displaying song metadata ("Composer - Title") with content projection slot for context-specific actions. Used in both library (delete action) and discover (add-to-library action) views.

- **Main Elements**:
  - Card container with hover state
  - Song title display (truncated to 2 lines if needed)
  - Composer display (secondary text)
  - [actions] content projection slot for action buttons (delete icon or add button)
  - Click handler for navigation to sheet music viewer (excluding action button area)

- **Handled Interactions**:
  - Click on card body → navigate to `/song/:songId` (sheet music viewer)
  - Enter key on focused card → navigate to sheet music viewer
  - Action button clicks are handled by parent component (add-to-library, delete)

- **Handled Validation**:
  - Song ID validation for navigation (UUID format)
  - Prevent navigation if clicking on action button area
  - Accessibility: proper focus management for keyboard navigation

- **Types**:
  - `PublicSongListItemDto` or `UserLibraryItemDto` (input song object)
  - Input type: `song` (Song object with id, song_details, created_at/added_at)

- **Props**:
  - `song: PublicSongListItemDto | UserLibraryItemDto` (required) - song data to display
  - Content projection: `[actions]` slot for action buttons

### LoadingSkeletonComponent

- **Component Description**: Skeleton loader mimicking song card dimensions for loading state indication during data fetch. Displays animated shimmer effect.

- **Main Elements**:
  - Grid of skeleton cards matching SongCardComponent dimensions
  - Animated shimmer animation using CSS keyframes
  - Responsive layout matching parent grid

- **Handled Interactions**: None (purely visual feedback component)

- **Types**: None (pure presentation component)

- **Props**:
  - `count: number` (optional, default: 50) - number of skeleton cards to display

## 5. Types

### DiscoverViewState (Component View Model)

Local state management type for the DiscoverComponent:

```typescript
interface DiscoverViewState {
  // Current page of public songs
  currentPage: number;

  // Total pages available
  totalPages: number;

  // All loaded songs (accumulated across pages)
  songs: PublicSongListItemDto[];

  // Songs from user's library (for availability checking)
  userLibrarySongIds: Set<string>;

  // Loading states
  isInitialLoading: boolean;
  isPaginationLoading: boolean;

  // Error state
  error: {
    message: string;
    code: string;
  } | null;

  // Scroll position for "back to top" button visibility
  scrollPosition: number;

  // Map of song IDs to add-to-library loading states
  addingToLibraryStates: Map<string, boolean>;
}
```

### AddToLibraryState (Optimistic UI State)

State for tracking add-to-library operation per song:

```typescript
interface AddToLibraryState {
  songId: string;
  isLoading: boolean;
  isInLibrary: boolean;
  error: string | null;
}
```

### DiscoverComponentInputs

Component inputs (for potential future use in shared view scenarios):

```typescript
interface DiscoverComponentInputs {
  // Query parameters for initial load
  initialPage?: number;
  initialLimit?: number;
  initialSort?: 'title' | 'composer' | 'created_at';
  initialOrder?: 'asc' | 'desc';
}
```

## 6. State Management

The DiscoverComponent uses Angular 19 signal-based reactive state management:

```typescript
// Core data signals
private readonly publicSongs = signal<PublicSongListItemDto[]>([]);
private readonly userLibrarySongs = signal<UserLibraryItemDto[]>([]);
private readonly paginationState = signal({ page: 1, totalPages: 1 });

// Loading/UI state signals
private readonly isInitialLoading = signal(true);
private readonly isPaginationLoading = signal(false);
private readonly scrollPosition = signal(0);
private readonly addingToLibraryMap = signal<Map<string, boolean>>(new Map());

// Error state signal
private readonly error = signal<string | null>(null);

// Computed signals for derived state
readonly visibleSongs = computed(() => this.publicSongs());
readonly userLibrarySongIds = computed(() => new Set(this.userLibrarySongs().map(s => s.song_id)));
readonly isBackToTopVisible = computed(() => this.scrollPosition() > 300);
readonly isSongInLibrary = (songId: string) => this.userLibrarySongIds().has(songId);
readonly isAddingToLibrary = (songId: string) => this.addingToLibraryMap().get(songId) ?? false;
readonly shouldShowLoadMore = computed(() => {
  const page = this.paginationState().page;
  const total = this.paginationState().totalPages;
  return page < total && !this.isPaginationLoading();
});
```

**Why signals instead of state management library?**

1. **Simplicity**: Signals provide built-in reactivity without external dependencies
2. **Performance**: Computed signals track dependencies and update efficiently
3. **UI Architecture**: Per the PRD, static data pattern with fresh fetches on navigation means minimal shared state
4. **Angular 19 Modern Pattern**: Aligns with current Angular best practices

**State Flow**:

1. **Initialization** → Load first page of public songs, load user's library, initialize pagination state
2. **Scroll Event** → Update scroll position signal, check threshold for pagination load
3. **Pagination** → When threshold reached, increment page, fetch next batch, append to songs signal
4. **Add to Library** → Update song-specific loading state, call API, update user library signal, update computed song-in-library check
5. **Error Recovery** → Set error signal, display toast, allow retry

## 7. API Integration

### Primary API Call: Get Public Songs List

**Service Method**: `SongService.getPublicSongsList(queryParams)`

**Request Structure**:

```typescript
interface PublicSongsQueryParams {
  page?: number; // Default: 1
  limit?: number; // Default: 50, max: 100
  sort?: 'title' | 'composer' | 'created_at'; // Default: 'title'
  order?: 'asc' | 'desc'; // Default: 'asc'
  search?: string; // Optional search term
}
```

**Response Structure**:

```typescript
interface PublicSongsListResponseDto {
  data: PublicSongListItemDto[]; // Array of songs
  pagination: {
    page: number;
    limit: number;
    total_items: number;
    total_pages: number;
  };
}
```

**Implementation Details**:

- Called on component initialization with `{ page: 1, limit: 50 }`
- Called again when infinite scroll threshold reached with incremented page
- No client-side caching; fresh fetch on each pagination
- Optional search parameter reserved for future enhancement

### Secondary API Call: Add Song to Library

**Service Method**: `UserLibraryService.addSongToLibrary(command)`

**Request Structure**:

```typescript
interface AddUserSongCommand {
  song_id: string; // UUID of song to add
}
```

**Response Structure**:

```typescript
interface AddUserSongResponseDto {
  user_id: string;
  song_id: string;
  created_at: string;
  song_details: {
    title: string;
    composer: string;
  };
}
```

**Error Handling**:

- `ConflictError` (409): Song already in user's library
- `NotFoundError` (404): Song not found or not accessible
- `AuthenticationError` (401): User not authenticated
- `ValidationError` (400): Invalid request payload
- Generic error with retry option

**Implementation Details**:

- Called when user clicks "Add to Library" button
- Optimistic UI: immediately disable button, show loading state
- On success: update user library signal, update computed song-in-library check
- On failure: revert to enabled state, show error toast with option to retry
- For unauthenticated users: redirect to login instead of API call

### Tertiary API Call: Get User's Library (for checking song membership)

**Service Method**: `UserLibraryService.getUserLibrary(params)`

**Called**: On component initialization to populate user library song IDs for button state determination

**Response**: `UserLibraryListResponseDto` with paginated list

## 8. User Interactions

### Interaction 1: Load Page

**Trigger**: Component initialization

**Flow**:

1. Component initializes
2. Set `isInitialLoading = true`
3. Fetch public songs (page 1, limit 50)
4. Fetch user's library songs (only if authenticated)
5. Display LoadingSkeletonComponent during fetch
6. On success: populate `publicSongs` and `userLibrarySongs` signals
7. On error: display error message with retry button
8. Set `isInitialLoading = false`

**Expected Outcome**: Grid of 50 song cards displayed with add-to-library buttons

### Interaction 2: Infinite Scroll

**Trigger**: User scrolls to 50 items from bottom

**Flow**:

1. Scroll event detected
2. Calculate scroll position and check if threshold reached
3. If reached and `shouldShowLoadMore = true`:
   - Set `isPaginationLoading = true`
   - Display loading indicator at bottom
   - Fetch next page (`currentPage + 1`)
   - Append new songs to existing `publicSongs` signal
4. Set `isPaginationLoading = false`

**Expected Outcome**: New songs appended to grid, no page refresh

### Interaction 3: Add Song to Library (Authenticated User)

**Trigger**: User clicks "Add to Library" button on song card

**Flow**:

1. Button state changes to loading
2. Update `addingToLibraryMap` for this song ID to `true`
3. Call `UserLibraryService.addSongToLibrary({ song_id })`
4. On success:
   - Add song to `userLibrarySongs` signal
   - Toast notification: "Song added successfully!"
   - Button becomes disabled with "Already in library" state
   - Update computed `isSongInLibrary` check
5. On error:
   - Show error toast with error message
   - Button reverts to enabled state
   - Offer retry option

**Expected Outcome**: Song appears in user's library, button disabled

### Interaction 4: Add Song to Library (Unauthenticated User)

**Trigger**: Unauthenticated user clicks "Add to Library" button

**Flow**:

1. Button displays "Sign in to add" state
2. User clicks button
3. Check `isAuthenticated()` signal
4. If not authenticated: Navigate to `/login`
5. After successful login: Return to `/discover` (via route guard or programmatic redirect)

**Expected Outcome**: User redirected to login

### Interaction 5: Back to Top Navigation

**Trigger**: User clicks "Back to top" FAB (visible when `scrollPosition > 300`)

**Flow**:

1. Smooth scroll animation to top of page
2. Focus management: set focus to first song card

**Expected Outcome**: Page scrolled to top, songs grid visible

### Interaction 6: Navigate to Sheet Music Viewer

**Trigger**: User clicks on song card body (not action button)

**Flow**:

1. Extract song ID from card data
2. Validate song ID (UUID format)
3. Navigate to `/song/:songId`
4. AuthGuard (on viewer route) checks access permissions

**Expected Outcome**: User navigated to sheet music viewer for the song

## 9. Conditions and Validation

### Condition 1: Song Card Add Button State

**Variables**: `isSongInLibrary` (computed from user library), `isAuthenticated()`, `isAddingToLibrary` (per-song)

**States**:

1. **Unauthenticated**: Button text = "Sign in to add", color = primary, aria-label = "Sign in to add to library"
2. **Authenticated, not in library, not loading**: Button text = "Add to Library", color = primary, clickable
3. **Authenticated, not in library, loading**: Button text = "Adding...", color = primary, disabled, spinner icon
4. **Authenticated, in library**: Button text = "Already in library", color = disabled, disabled, aria-label = "Already in your library"

**Validation Points**:

- Check `userLibrarySongIds` computed signal before rendering
- Disable button if `isAddingToLibrary` is true for this song ID
- Update button state immediately on API response (optimistic UI)

### Condition 2: Initial Loading State

**Variables**: `isInitialLoading` signal

**Conditions**:

- **True**: Display 50 LoadingSkeletonComponent cards
- **False**: Display SongCardComponent grid

**Validation Points**:

- Set to true on component init
- Set to false when both public songs and (if authenticated) user library fetch complete

### Condition 3: Pagination Load Trigger

**Variables**: `scrollPosition` signal, `shouldShowLoadMore` computed signal

**Conditions**:

- Trigger load when: `scrollPosition > (documentHeight - 50 * cardHeight)` AND `currentPage < totalPages` AND not already loading
- Display loading indicator at bottom when `isPaginationLoading = true`

**Validation Points**:

- Prevent duplicate loads: check `isPaginationLoading` before triggering
- Respect API limit: `limit` parameter max 100

### Condition 4: Back to Top FAB Visibility

**Variables**: `scrollPosition` signal, `isBackToTopVisible` computed signal

**Conditions**:

- **Visible**: When `scrollPosition > 300`
- **Hidden**: When `scrollPosition <= 300`

**Validation Points**:

- Smooth scroll implementation: use `window.scrollTo({ top: 0, behavior: 'smooth' })`

### Condition 5: Error Display

**Variables**: `error` signal

**Conditions**:

- **No Error**: Normal UI display
- **Error**: Toast notification with error message and optional retry button

**Validation Points**:

- Error codes: map API error codes to user-friendly messages
- Network errors: Display "Network error. Please check your connection."
- Generic errors: Display "Something went wrong. Please try again."

## 10. Error Handling

### Error Scenario 1: Initial Load Failure

**Trigger**: Public songs fetch fails on init

**Handling**:

1. Catch error from API
2. Set `error` signal with user-friendly message
3. Display error message in toast notification
4. Provide retry button
5. Log error to console with details

**User Experience**: Error toast with retry option, allowing user to retry fetch

### Error Scenario 2: Add to Library - Song Already in Library

**Trigger**: API returns 409 Conflict error

**Handling**:

1. Catch ConflictError from UserLibraryService
2. Display toast: "This song is already in your library"
3. Update user library signal to reflect current state
4. Button automatically disabled via computed signal

**User Experience**: Toast notification, button state updates automatically

### Error Scenario 3: Add to Library - Unauthenticated

**Trigger**: User not authenticated when adding song

**Handling**:

1. Check `isAuthenticated()` before API call
2. Redirect to `/login` instead of making API call
3. Set return URL so user returns to discover after login

**User Experience**: Automatic redirect to login

### Error Scenario 4: Network Error During Add

**Trigger**: Network failure during add-to-library operation

**Handling**:

1. Catch network error
2. Display toast: "Network error. Please check your connection and try again."
3. Revert button to enabled state
4. Log error details

**User Experience**: Error toast, button remains available for retry

### Error Scenario 5: Pagination Load Failure

**Trigger**: Fetch next page fails

**Handling**:

1. Catch error from API
2. Display toast with error message
3. Do not increment page
4. "Back to top" FAB visible for alternative navigation
5. Allow retry by scrolling to bottom again

**User Experience**: Error toast, can scroll back to bottom to retry or navigate back to top

### Error Scenario 6: Invalid Query Parameters

**Trigger**: Invalid pagination parameters passed to API

**Handling**:

1. Validate parameters client-side before API call
2. Set valid defaults if invalid values provided
3. If API rejects: catch ValidationError and display user-friendly message

**User Experience**: Automatic fallback to valid parameters, no user action needed

## 11. Implementation Steps

### Step 1: Create Component File Structure

1. Create `src/app/components/discover/discover.component.ts`
2. Create `src/app/components/discover/discover.component.html`
3. Create `src/app/components/discover/discover.component.scss`

### Step 2: Define Component Class and Signals

1. Create component class with `@Component` decorator
2. Set `standalone: true` and `changeDetection: OnPush`
3. Define core signals: `publicSongs`, `userLibrarySongs`, `paginationState`, `isInitialLoading`, `isPaginationLoading`, `scrollPosition`, `addingToLibraryMap`, `error`
4. Define computed signals: `userLibrarySongIds`, `isSongInLibrary`, `isBackToTopVisible`, `shouldShowLoadMore`

### Step 3: Implement Initialization Logic

1. Inject `SongService`, `UserLibraryService`, `AuthService`, `Router`, `MatSnackBar`
2. Implement `ngOnInit()` to:
   - Set `isInitialLoading = true`
   - Call `SongService.getPublicSongsList({ page: 1, limit: 50 })`
   - If authenticated: Call `UserLibraryService.getUserLibrary({ limit: 1000 })` to get all user songs
   - Update signals with response data
   - Set `isInitialLoading = false`
   - Handle errors with toast notifications

### Step 4: Implement Infinite Scroll

1. Add scroll event listener via `@HostListener` or template event binding
2. Calculate scroll position and check threshold
3. When threshold reached:
   - Check `shouldShowLoadMore` computed signal
   - Set `isPaginationLoading = true`
   - Call `SongService.getPublicSongsList({ page: currentPage + 1, limit: 50 })`
   - Append new songs to `publicSongs` signal
   - Update pagination state
   - Set `isPaginationLoading = false`

### Step 5: Implement Add to Library Functionality

1. Create method `addSongToLibrary(songId: string)`:
   - Check `isAuthenticated()` - if false, navigate to login
   - If authenticated:
     - Set loading state for this song: `addingToLibraryMap.update(...)`
     - Call `UserLibraryService.addSongToLibrary({ song_id: songId })`
     - On success:
       - Add song to `userLibrarySongs` signal
       - Show success toast
       - Computed signal automatically disables button
     - On error:
       - Handle specific error codes (409 Conflict, 401 Unauthorized, 404 Not Found)
       - Show error toast with message
       - Revert loading state
       - Clear error state signal

### Step 6: Implement Back to Top Button

1. Add computed signal `isBackToTopVisible` to track when to show FAB
2. Create method `scrollToTop()`:
   - Use `window.scrollTo({ top: 0, behavior: 'smooth' })`
   - Set focus to first song card
3. Add FAB button to template, conditionally visible based on signal

### Step 7: Create Template

1. Create main container with `main` tag for accessibility
2. Add loading state:
   - `@if (isInitialLoading(); else loadedContent)` with LoadingSkeletonComponent
3. Add error state:
   - Display error toast using MatSnackBar (injected service)
4. Add songs grid:
   - `@for (song of visibleSongs(); track song.id)` with SongCardComponent
   - Pass song data and content projection for add-to-library action
5. Add infinite scroll container:
   - Scrollable div with scroll event listener
   - Loading indicator at bottom when `isPaginationLoading`
6. Add back-to-top FAB:
   - `@if (isBackToTopVisible())` with MatFab button
   - Click handler calls `scrollToTop()`

### Step 8: Add SCSS Styling

1. Create responsive grid layout:
   - Desktop: 4 columns
   - Tablet: 3 columns (>600px)
   - Mobile: 2 columns (<600px)
2. Style song card containers
3. Style loading indicators and skeleton loaders
4. Style FAB button positioning
5. Add smooth scroll behavior
6. Apply Material theme system variables

### Step 9: Integrate with Routing

1. Add route to `app.routes.ts`:
   - Path: `/discover`
   - Component: DiscoverComponent
   - No guard (public access)
   - Lazy load if using feature module pattern

### Step 10: Update AppShellComponent

1. Add "Discover" navigation item to sidebar
2. Link to `/discover` route
3. Add active route highlighting for discover view

### Step 11: Create Integration Tests

1. Test component initialization (load public songs)
2. Test authenticated vs unauthenticated state
3. Test add-to-library functionality
4. Test infinite scroll pagination
5. Test error scenarios and retry logic
6. Test navigation to sheet music viewer
7. Test back-to-top FAB behavior

### Step 12: Accessibility Review

1. Add ARIA labels to all buttons
2. Ensure keyboard navigation works (Tab, Enter, Space)
3. Test with screen reader (NVDA or JAWS)
4. Verify focus management
5. Ensure color contrast meets WCAG AA
6. Add skip navigation link

---

**Implementation Notes**:

- Follow Angular 19 best practices (signals, OnPush change detection, functional guards)
- Use Material Design components for UI consistency
- Implement comprehensive error handling with user-friendly messages
- Use proper TypeScript types throughout (no `any` types)
- Add console logging for debugging (development mode)
- Test edge cases (empty list, single page, network errors)
- Ensure mobile responsiveness for all screen sizes
- Implement loading states for all async operations
- Use optimistic UI patterns for add-to-library to improve perceived performance
