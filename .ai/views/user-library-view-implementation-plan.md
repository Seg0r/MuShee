# View Implementation Plan: User Library View

## 1. Overview

The User Library View is the primary authenticated view where users manage and interact with their personal sheet music collection. It displays a responsive grid of uploaded MusicXML songs, enables file uploads, handles song deletion with confirmation, triggers AI-powered music recommendations, and manages onboarding for new users. The view uses Angular 19 signals for reactive state management, Supabase SDK for backend operations, and Angular Material components for a polished Material 3 design.

The view implements lazy-loaded pagination with infinite scroll, optimistic UI patterns for mutations, and comprehensive error handling with user-friendly feedback. Integration with modal dialogs (upload, delete confirmation, AI suggestions, onboarding) keeps the interface clean while providing complex functionality without page navigation.

## 2. View Routing

**Route Path:** `/library`

**Route Guard:** `AuthGuard` (functional guard checking `AuthService.isAuthenticated`)

**Access Level:** Protected - authenticated users only

**Lazy Loading:** Route configured with `loadComponent()` for efficient bundle splitting

**Query Parameters:** None (pagination state managed internally in component)

**Deep Linking:** Supported - accessing `/library` directly from URL redirects through auth guard if needed

## 3. Component Structure

### Component Hierarchy

```
AppShellComponent (authenticated layout wrapper)
│
└── LibraryComponent (main view component)
    │
    ├── LoadingSkeletonComponent[] (during initial data fetch)
    │
    ├── EmptyStateComponent (conditional: when library is empty)
    │   └── [actions slot]
    │       ├── Upload Song Button
    │       └── Browse Public Library Button
    │
    ├── SongCardComponent[] (array: each song in library)
    │   ├── Song tile displaying "Composer - Title"
    │   ├── Click handler to navigate to sheet music viewer
    │   └── [actions slot]
    │       └── Delete Icon Button
    │
    ├── Upload FAB (Floating Action Button)
    │   └── Triggers UploadDialogComponent
    │
    ├── Find Similar Music FAB (conditional: visible when library not empty)
    │   └── Triggers AiSuggestionsDialogComponent
    │
    ├── UploadDialogComponent (modal)
    │   ├── File input selector
    │   ├── Drag-and-drop zone
    │   ├── File validation feedback
    │   └── Upload button with loading state
    │
    ├── ConfirmDialogComponent (delete confirmation modal)
    │   ├── Song details display (Composer - Title)
    │   ├── Confirmation message
    │   ├── Cancel button
    │   └── Delete button (warn color)
    │
    ├── AiSuggestionsDialogComponent (modal)
    │   ├── Loading spinner (with 3s timeout)
    │   ├── Suggestions scrollable list
    │   └── Thumbs up/down feedback per suggestion
    │
    └── OnboardingDialogComponent (modal, auto-triggered for new users)
        └── MatStepper (horizontal, 3 steps)
            ├── Step 1: Upload Your Music
            ├── Step 2: Browse Public Library
            └── Step 3: Get AI Recommendations
```

## 4. Component Details

### LibraryComponent (Main View)

**Component Description:**
The primary view component that orchestrates the entire user library management experience. Responsible for:

- Fetching and displaying user's personal song collection
- Managing pagination and infinite scroll
- Coordinating modal dialogs (upload, delete, AI suggestions)
- Auto-triggering onboarding for new users
- Handling authentication and data freshness
- Managing reactive state with signals

**Main Elements:**

- Header with toolbar (handled by AppShell)
- Loading skeleton grid (during initial fetch)
- Empty state with CTAs (conditionally displayed)
- Responsive grid of SongCard components
- Upload FAB (always visible, bottom-right)
- Find Similar Music FAB (conditionally visible when library not empty)
- Infinite scroll trigger near bottom of list
- Material Snackbar for toast notifications (via error/success handler)

**Handled Interactions:**

1. Page initialization: fetch library data, check onboarding status
2. Infinite scroll: load next page when user scrolls near bottom
3. Upload trigger: open UploadDialogComponent from FAB
4. Song card click: navigate to sheet music viewer with songId
5. Delete trigger: open ConfirmDialogComponent, then delete on confirmation
6. AI suggestions trigger: open AiSuggestionsDialogComponent from FAB
7. Retry failed loads: refresh library data
8. Back from modals: refresh library if mutations occurred

**Handled Validation:**

- Authentication verification on init (guard ensures logged-in)
- Library empty state detection (items.length === 0 && !loading())
- Pagination bounds checking (page >= 1, limit 1-100, calculated totalPages)
- Song access verification (retrieved via RLS policies, no explicit validation needed)
- Onboarding flag validation (boolean, null-safe with default false)

**Types:**

- `UserLibraryListResponseDto` - API response format
- `UserLibraryItemDto` - individual song item in library
- `SongDetailsDto` - composed metadata (title, composer)
- `UploadSongResponseDto` - successful upload response
- `ProfileDto` - user profile with onboarding flag
- `GenerateAiSuggestionsResponseDto` - AI suggestions response

**Props (component inputs):**

- None (standalone component, receives authentication via AuthService)

---

### SongCardComponent (Shared)

**Component Description:**
Reusable card component for displaying song information in tile format. Used in:

- User Library view (with delete action)
- Public Library Discovery view (with add-to-library action)
- Future search results or recommendations

**Main Elements:**

- Song tile container with Material Card elevation
- Composer display (primary text)
- Title display (secondary text)
- "Composer - Title" formatted display (following MusicXML metadata)
- Hover state with shadow elevation change
- Content projection slot for action buttons (top-right corner)
- Click handler (entire card clickable except action buttons)

**Handled Interactions:**

1. Click on card (not on action buttons): navigate to sheet music viewer
2. Hover state (desktop): enhance elevation, highlight
3. Action button click: prevent card click, delegate to parent

**Handled Validation:**

- Song details not null/undefined (fallback to empty strings if missing)
- Composer and title length reasonable (already truncated to 200 chars by API)

**Types:**

- `UserLibraryItemDto` - input data structure
- `SongDetailsDto` - destructured title/composer

**Props:**

```typescript
@Input({ required: true }) song: UserLibraryItemDto;
@Output() cardClick = new EventEmitter<UserLibraryItemDto>();
```

---

### EmptyStateComponent (Shared)

**Component Description:**
Reusable empty state display component shown when user has no songs in library. Provides clear messaging and actionable CTAs.

**Main Elements:**

- Centered container with Material styling
- Large icon (music_note or queue_music from Material Icons)
- Primary message: "Your library is empty"
- Secondary message: "Upload your own music or browse our public domain collection to get started"
- Content projection for action buttons
- Responsive spacing and sizing

**Handled Interactions:**

1. Button click: parent component handles navigation or dialog opening

**Handled Validation:**

- Message text displays correctly (no validation needed)

**Types:**

- Content projection receives action buttons

**Props:**

```typescript
@Input() message: string = 'Your library is empty';
@Input() iconName: string = 'queue_music';
```

---

### UploadDialogComponent (Feature-Specific)

**Component Description:**
Modal dialog for uploading MusicXML files with validation, error handling, and success feedback. Handles:

- File selection via button click
- Drag-and-drop upload zone
- File format/size validation
- Real-time validation feedback
- Loading state during upload
- Success message display
- Error message with retry capability

**Main Elements:**

- Dialog container with Material Dialog
- "Upload Song" title
- File input element (hidden, triggered by button)
- Drag-drop zone (visual feedback area)
- Selected file display with name and size
- Error message area (red text, material error styling)
- Upload button (disabled until valid file selected)
- Cancel button
- Loading spinner overlay during upload

**Handled Interactions:**

1. Click file input button: open native file selector
2. Select file from dialog: validate and display
3. Drag file over drop zone: highlight zone (visual feedback)
4. Drop file on zone: validate and display (alternative to file dialog)
5. Click Upload button: start upload with loading state
6. Upload succeeds: show success message, close dialog after brief delay
7. Upload fails: display error message, keep dialog open for retry
8. Click Cancel: close dialog without action

**Handled Validation:**

- File presence: must have file selected before upload enabled
- File extension: .xml or .musicxml only (validated by `FileUtilsService.validateFileExtension()`)
- File size: max 10MB (validated by `FileUtilsService.validateFileSize()`)
- MIME type: application/xml or text/xml (validated by `FileUtilsService.validateMimeType()`)
- MusicXML validity: parsed and validated by `MusicXMLParserService.validateMusicXML()`
- Duplicate detection: hash-based comparison by API
- Real-time feedback: show validation errors as user selects file

**Types:**

- `UploadSongCommand` - request format (file: File | Blob)
- `UploadSongResponseDto` - response format
- `ValidationError` - custom error type from models/errors.ts

**Props:**

```typescript
@Output() uploadSuccess = new EventEmitter<UploadSongResponseDto>();
@Output() uploadError = new EventEmitter<{ code: string; message: string }>();
```

---

### ConfirmDialogComponent (Shared)

**Component Description:**
Reusable confirmation dialog for destructive actions (delete song, logout). Displays message with affected item details and clear confirmation/cancellation options.

**Main Elements:**

- Dialog container with Material Dialog
- Title text (e.g., "Delete Song?")
- Message body with song details
- Song name display in bold or highlighted
- Cancel button (neutral, filled style)
- Action button (destructive, warn color for delete)
- Keyboard support (Esc to cancel, Enter to confirm)

**Handled Interactions:**

1. Display modal with message and item details
2. User clicks Cancel: close dialog, no action
3. User clicks Confirm: emit confirmation event, close dialog
4. User presses Esc: close dialog (if dismissible)

**Handled Validation:**

- Title and message required (non-empty)
- Action button color specified (primary, warn, accent)
- Song details formatted correctly for display

**Types:**

- `UserLibraryItemDto` or generic data passed as input

**Props:**

```typescript
@Input({ required: true }) title: string;
@Input({ required: true }) message: string;
@Input({ required: true }) itemDetails: string; // "Composer - Title"
@Input() confirmText: string = 'Delete';
@Input() cancelText: string = 'Cancel';
@Input() confirmColor: 'primary' | 'accent' | 'warn' = 'warn';
@Output() confirmed = new EventEmitter<void>();
@Output() cancelled = new EventEmitter<void>();
```

---

### AiSuggestionsDialogComponent (Feature-Specific)

**Component Description:**
Modal dialog for displaying AI-generated song recommendations with user feedback collection. Handles:

- Calling AI suggestions Edge Function with timeout
- Displaying loading state during API call
- Showing suggestions in scrollable list
- Collecting thumbs up/down ratings per suggestion
- Batching feedback submission on close
- Error handling with retry capability

**Main Elements:**

- Dialog container with Material Dialog
- Title: "Recommended for You"
- Loading spinner (visible during initial fetch)
- Error message area (if API fails or timeout)
- Scrollable suggestions list (Material list or cards)
- Each suggestion item:
  - Composer name
  - Title
  - Thumbs up icon button (toggleable)
  - Thumbs down icon button (toggleable)
  - Visual feedback (highlight when selected)
- Close button (triggers feedback submission)
- Retry button (if error state)

**Handled Interactions:**

1. Dialog opens: immediately fetch suggestions with 3s timeout
2. Loading state: show spinner, disable interaction
3. Suggestions loaded: display in scrollable list
4. Click thumbs up: toggle rating to 1, unselect thumbs down
5. Click thumbs down: toggle rating to -1, unselect thumbs up
6. Click already-selected thumb: toggle off (deselect rating)
7. Close dialog: submit batch feedback with all ratings (1, -1, null)
8. API timeout/error: show error message with retry button
9. Retry: fetch suggestions again

**Handled Validation:**

- Empty song list check: prevent API call if user has no songs (handled by FAB visibility)
- Suggestions response format validation
- Rating values: 1, -1, or null only
- Feedback ID validation: must match original request

**Types:**

- `GenerateAiSuggestionsResponseDto` - suggestions + feedback_id
- `UpdateAiSuggestionFeedbackCommand` - feedback submission format
- `AiSuggestionFeedbackSuggestionDto` - individual suggestion with rating

**Props:**

```typescript
@Input({ required: true }) userSongs: SongReferenceDto[];
@Output() suggestionsLoaded = new EventEmitter<GenerateAiSuggestionsResponseDto>();
@Output() suggestionsError = new EventEmitter<{ code: string; message: string }>();
@Output() closed = new EventEmitter<void>();
```

---

### OnboardingDialogComponent (Feature-Specific)

**Component Description:**
Modal dialog for new user onboarding, displaying 3-step introduction to key features. Auto-triggered for users with `has_completed_onboarding = false`. Can also be manually triggered via Help/Tour menu.

**Main Elements:**

- Dialog container with Material Dialog
- MatStepper in horizontal mode with 3 steps:
  - **Step 1: Upload Your Music**
    - Icon: cloud_upload
    - Description: Explains how to upload MusicXML files
    - CTA: "Upload a Song" (links to upload FAB)
  - **Step 2: Browse Public Library**
    - Icon: library_music
    - Description: Explains public domain song discovery
    - CTA: "Browse Library" (links to Discover view)
  - **Step 3: Get AI Recommendations**
    - Icon: smart_toy or lightbulb
    - Description: Explains AI-powered suggestions feature
    - CTA: "Find Similar Music" (explains how)
- Navigation buttons:
  - Back button (disabled on step 1)
  - Next button (disabled on step 3)
  - "Get Started" button on final step
- Close icon (top-right, dismissible anytime)

**Handled Interactions:**

1. Dialog auto-opens: component checks `has_completed_onboarding` on init
2. Step navigation: click Next/Back to move between steps
3. Complete onboarding: click "Get Started" on final step
4. Close dialog: click close icon or outside (if dismissible)
5. Update profile: call `ProfileService.updateProfile()` to mark complete

**Handled Validation:**

- Step index validation (0-2)
- Profile update: boolean conversion for has_completed_onboarding
- One-time trigger: only auto-show if flag is false

**Types:**

- `ProfileDto` - for profile data
- `UpdateProfileCommand` - for profile update

**Props:**
None (auto-triggered based on auth state)

---

### LoadingSkeletonComponent (Shared)

**Component Description:**
Reusable skeleton loader component that mimics the shape and size of SongCard components during initial data fetch. Provides visual continuity and prevents layout shift.

**Main Elements:**

- Grid of placeholder cards (default 8, configurable)
- Each skeleton card:
  - Same dimensions as SongCard
  - Placeholder text (gray shimmer animation)
  - Simulates "Composer - Title" layout
  - Animated loading shimmer effect using CSS

**Handled Interactions:**

- No user interactions (purely visual loading indicator)

**Handled Validation:**

- Count parameter validation (positive integer, reasonable max)

**Types:**
None

**Props:**

```typescript
@Input() count: number = 8;
@Input() rows: number = 2;
@Input() cols: number = 4;
```

---

## 5. Types

### State Management Types

**LibraryViewState** (Internal component state - managed via signals):

```typescript
interface LibraryViewState {
  // Data
  songs: UserLibraryItemDto[];

  // Loading states
  initialLoading: boolean;
  paginationLoading: boolean;

  // Error states
  error: string | null;
  errorCode: ErrorCode | null;

  // Pagination
  currentPage: number;
  pageSize: number;
  totalItems: number;
  hasMoreItems: boolean;

  // UI states
  selectedSongForDelete: UserLibraryItemDto | null;
  showDeleteDialog: boolean;
  showUploadDialog: boolean;
  showAiDialog: boolean;

  // User profile
  hasCompletedOnboarding: boolean;
  showOnboardingDialog: boolean;
}
```

### Input/Output DTOs (From API)

**UserLibraryListResponseDto** (GET /api/user-songs response):

```typescript
interface UserLibraryListResponseDto {
  data: UserLibraryItemDto[];
  pagination: PaginationDto;
}
```

**UserLibraryItemDto** (Individual library item):

```typescript
interface UserLibraryItemDto {
  song_id: string; // UUID
  song_details: SongDetailsDto;
  added_at: string; // ISO 8601 timestamp
}
```

**SongDetailsDto** (Shared across endpoints):

```typescript
type SongDetailsDto = {
  title: string;
  composer: string;
};
```

**PaginationDto** (Shared pagination metadata):

```typescript
interface PaginationDto {
  page: number;
  limit: number;
  total_items: number;
  total_pages: number;
}
```

**UploadSongResponseDto** (POST /api/songs response):

```typescript
interface UploadSongResponseDto {
  id: string; // UUID
  song_details: SongDetailsDto;
  file_hash: string;
  created_at: string; // ISO 8601
  added_to_library_at: string; // ISO 8601
  is_duplicate?: boolean;
}
```

**ProfileDto** (User profile):

```typescript
type ProfileDto = {
  id: string; // UUID
  updated_at: string; // ISO 8601
  has_completed_onboarding: boolean;
};
```

**GenerateAiSuggestionsResponseDto** (AI suggestions response):

```typescript
interface GenerateAiSuggestionsResponseDto {
  suggestions: AiSuggestionItemDto[];
  feedback_id: string; // UUID
}
```

**AiSuggestionItemDto** (Individual suggestion):

```typescript
interface AiSuggestionItemDto {
  song_details: SongDetailsDto;
}
```

### Query Parameter Types

**LibraryQueryParams** (GET /api/user-songs query params):

```typescript
interface LibraryQueryParams {
  page?: number; // default: 1
  limit?: number; // default: 50, max: 100
  sort?: 'title' | 'composer' | 'created_at' | 'added_at'; // default: created_at
  order?: 'asc' | 'desc'; // default: desc
}
```

### Error Types

**ErrorCode** (API error codes):

```typescript
type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INVALID_REQUEST'
  | 'CONFLICT'
  | 'INVALID_FILE_FORMAT'
  | 'FILE_TOO_LARGE'
  | 'SONG_ALREADY_IN_LIBRARY'
  | 'SONG_NOT_FOUND'
  | 'AI_SERVICE_UNAVAILABLE'
  | 'REQUEST_TIMEOUT'
  | 'INTERNAL_ERROR';
```

**Custom Error Classes** (from models/errors.ts):

```typescript
class ValidationError extends Error {
  constructor(
    message: string,
    public code: ErrorCode = 'INVALID_REQUEST'
  ) {}
}

class NotFoundError extends Error {
  constructor(
    message: string,
    public code: ErrorCode = 'NOT_FOUND'
  ) {}
}

class ConflictError extends Error {
  constructor(
    message: string,
    public code: ErrorCode = 'CONFLICT'
  ) {}
}

class AuthenticationError extends Error {
  constructor(
    message: string,
    public code: ErrorCode = 'UNAUTHORIZED'
  ) {}
}
```

## 6. State Management

### Signal-Based State Architecture

The User Library View uses Angular 19 signals exclusively for reactive state management. No NgRx, no RxJS subjects—signals provide fine-grained reactivity with automatic cleanup.

**Component State Signals:**

```typescript
export class LibraryComponent {
  // Data signals
  private songs = signal<UserLibraryItemDto[]>([]);
  private currentPage = signal<number>(1);
  private pageSize = signal<number>(50);
  private totalItems = signal<number>(0);

  // Loading signals
  private initialLoading = signal<boolean>(true);
  private paginationLoading = signal<boolean>(false);
  private uploadLoading = signal<boolean>(false);

  // Error signals
  private error = signal<string | null>(null);
  private errorCode = signal<ErrorCode | null>(null);

  // UI state signals
  private selectedSongForDelete = signal<UserLibraryItemDto | null>(null);
  private showOnboardingDialog = signal<boolean>(false);

  // Profile signals
  private userProfile = signal<ProfileDto | null>(null);

  // Computed signals (derived state)
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
}
```

**State Update Patterns:**

1. **Initialize on component load:**

   ```typescript
   ngOnInit() {
     this.loadInitialLibrary();
     this.checkOnboardingStatus();
   }

   private loadInitialLibrary() {
     this.initialLoading.set(true);
     this.userLibraryService
       .getUserLibrary({ page: 1, limit: 50 })
       .then(response => {
         this.songs.set(response.data);
         this.totalItems.set(response.pagination.total_items);
         this.currentPage.set(1);
         this.error.set(null);
       })
       .catch(err => {
         this.error.set(err.message);
         this.errorCode.set(err.code);
       })
       .finally(() => this.initialLoading.set(false));
   }
   ```

2. **Append paginated results (infinite scroll):**

   ```typescript
   private loadNextPage() {
     if (this.paginationLoading() || !this.hasMoreItems()) return;

     this.paginationLoading.set(true);
     const nextPage = this.currentPage() + 1;

     this.userLibraryService
       .getUserLibrary({ page: nextPage, limit: 50 })
       .then(response => {
         this.songs.update(existing => [...existing, ...response.data]);
         this.currentPage.set(nextPage);
         this.error.set(null);
       })
       .catch(err => {
         this.error.set(err.message);
         this.errorCode.set(err.code);
       })
       .finally(() => this.paginationLoading.set(false));
   }
   ```

3. **Handle mutations (upload, delete):**
   ```typescript
   private async handleSongDeleted(songId: string) {
     // Optimistic UI: remove immediately
     this.songs.update(existing =>
       existing.filter(item => item.song_id !== songId)
     );
     this.totalItems.update(count => count - 1);

     try {
       // Verify deletion with API
       await this.userLibraryService.removeSongFromLibrary(songId);
       this.showSuccessNotification('Song deleted');
     } catch (error) {
       // Rollback on error
       this.loadInitialLibrary();
       this.showErrorNotification('Failed to delete song');
     }
   }
   ```

**Effect-Based Side Effects:**

```typescript
export class LibraryComponent implements OnInit, OnDestroy {
  private destroyRef = inject(DestroyRef);

  ngOnInit() {
    // Auto-refresh library when navigating back to view
    effect(
      () => {
        if (this.router.url === '/library') {
          this.loadInitialLibrary();
        }
      },
      { injector: this.injector }
    );

    // Auto-trigger onboarding for new users
    effect(
      () => {
        if (this.isEmpty() && !this.userProfile()?.has_completed_onboarding) {
          this.showOnboardingDialog.set(true);
        }
      },
      { injector: this.injector }
    );

    // Cleanup on destroy
    this.destroyRef.onDestroy(() => {
      this.songs.set([]);
      this.error.set(null);
    });
  }
}
```

**No Observable Subscriptions:**

- All async operations use Promises with `.then()` / `.catch()`
- Component avoids `async` pipe and explicit subscriptions
- `takeUntilDestroyed()` not needed without RxJS subjects
- Memory management handled by Angular's signal cleanup

## 7. API Integration

### Service Calls and Data Flow

**Initial Load (Component Initialization):**

1. **Get User Profile** (to check onboarding status):

   ```typescript
   async checkOnboardingStatus() {
     const profile = await this.profileService.getProfile();
     this.userProfile.set(profile);

     if (!profile.has_completed_onboarding && this.isEmpty()) {
       this.showOnboardingDialog.set(true);
     }
   }
   ```

   **Request:** GET `/api/profiles/me` (no body)

   **Response:** `ProfileDto`

   ```json
   {
     "id": "uuid",
     "updated_at": "2025-10-22T10:30:00Z",
     "has_completed_onboarding": false
   }
   ```

2. **Fetch User Library** (paginated):

   ```typescript
   async loadInitialLibrary() {
     const response = await this.userLibraryService.getUserLibrary({
       page: 1,
       limit: 50,
       sort: 'created_at',
       order: 'desc'
     });
     this.songs.set(response.data);
     this.totalItems.set(response.pagination.total_items);
   }
   ```

   **Request:** GET `/api/user-songs?page=1&limit=50&sort=created_at&order=desc`

   **Response:** `UserLibraryListResponseDto`

   ```json
   {
     "data": [
       {
         "song_id": "uuid",
         "song_details": { "title": "Moonlight Sonata", "composer": "Beethoven" },
         "added_at": "2025-10-22T10:40:00Z"
       }
     ],
     "pagination": {
       "page": 1,
       "limit": 50,
       "total_items": 42,
       "total_pages": 1
     }
   }
   ```

**Upload Song Flow:**

```typescript
async handleUploadClick() {
  // User selects file in UploadDialogComponent
  // Component validates and calls SongService.uploadSong(command)

  const response = await this.songService.uploadSong({
    file: selectedFile
  });

  // On success, refresh library
  this.songs.update(existing => [response, ...existing]);
  this.totalItems.update(count => count + 1);
  this.showSuccessNotification('Song uploaded successfully');
  this.closeUploadDialog();
}
```

**Request:** POST `/api/songs` (multipart/form-data)

```
Content-Type: multipart/form-data
Body: file=<MusicXML file>
```

**Response:** `UploadSongResponseDto`

```json
{
  "id": "new-uuid",
  "song_details": { "title": "New Song", "composer": "Composer" },
  "file_hash": "abc123def456...",
  "created_at": "2025-10-22T10:45:00Z",
  "added_to_library_at": "2025-10-22T10:45:00Z"
}
```

**Delete Song Flow:**

```typescript
async handleDeleteConfirm(songId: string) {
  this.songs.update(existing =>
    existing.filter(item => item.song_id !== songId)
  );
  this.totalItems.update(count => count - 1);

  try {
    await this.userLibraryService.removeSongFromLibrary(songId);
    this.showSuccessNotification('Song deleted');
  } catch (error) {
    // Rollback
    this.loadInitialLibrary();
    this.showErrorNotification('Failed to delete song');
  }

  this.closeDeleteDialog();
}
```

**Request:** DELETE `/api/user-songs/{songId}`

**Response:** 204 No Content

**Get AI Suggestions Flow:**

```typescript
async handleFindSimilarMusic() {
  const suggestions = await this.aiSuggestionsService.getSuggestions(
    this.songs().map(item => ({ song_details: item.song_details }))
  );

  this.openAiSuggestionsDialog(suggestions);
}
```

**Request:** POST `/api/ai/suggestions` (via Edge Function)

```json
{
  "songs": [{ "song_details": { "composer": "Beethoven", "title": "Moonlight Sonata" } }]
}
```

**Response:** `GenerateAiSuggestionsResponseDto`

```json
{
  "suggestions": [{ "song_details": { "composer": "Schubert", "title": "Impromptu" } }],
  "feedback_id": "uuid"
}
```

**AI Suggestion Feedback Flow:**

```typescript
async submitAiSuggestionFeedback(feedbackId: string, ratings: AiSuggestionFeedbackSuggestionDto[]) {
  await this.feedbackService.submitAiSuggestionFeedback({
    feedbackId,
    suggestions: ratings
  });
}
```

**Request:** PATCH `/api/feedback/ai-suggestions/{feedbackId}`

```json
{
  "suggestions": [
    { "title": "Impromptu", "composer": "Schubert", "user_rating": 1 },
    { "title": "Nocturne", "composer": "Chopin", "user_rating": -1 }
  ]
}
```

**Response:** 200 OK

```json
{
  "id": "uuid",
  "rating_score": 0,
  "updated_at": "2025-10-22T11:20:00Z"
}
```

**Update Onboarding Status:**

```typescript
async handleOnboardingComplete() {
  await this.profileService.updateProfile({
    has_completed_onboarding: true
  });
  this.userProfile.update(profile =>
    profile ? { ...profile, has_completed_onboarding: true } : null
  );
  this.showOnboardingDialog.set(false);
}
```

**Request:** PATCH `/api/profiles/me`

```json
{
  "has_completed_onboarding": true
}
```

**Response:** `ProfileDto`

## 8. User Interactions

### Detailed User Interaction Flows

**Interaction 1: Initial Page Load (New User)**

**User Action:** Navigate to `/library` for first time
**System Flow:**

1. Route guard checks `AuthService.isAuthenticated` signal
2. Guard allows navigation (user logged in)
3. LibraryComponent initializes
4. `ngOnInit()` called:
   - Set `initialLoading = true`
   - Call `checkOnboardingStatus()` → GET `/api/profiles/me`
   - Call `loadInitialLibrary()` → GET `/api/user-songs?page=1&limit=50`
5. Profile indicates `has_completed_onboarding = false` and songs are empty
6. `isEmpty` computed signal becomes true
7. LibraryComponent displays:
   - LoadingSkeletonComponent (fade out as data loads)
   - OnboardingDialogComponent auto-opens
   - Empty state displayed underneath
   - Upload FAB visible
   - Find Similar Music FAB hidden (no songs)
8. User sees onboarding modal

**Expected UI State:**

- Onboarding dialog visible with step 1
- Library view empty state behind modal
- Both FABs visible (can click through if modal dismissed)

---

**Interaction 2: Upload Song**

**User Action:** Click Upload FAB → Select MusicXML file → Click Upload

**System Flow:**

1. Click Upload FAB → open UploadDialogComponent
2. Dialog appears modally over library view
3. User clicks file input or drags file to drop zone
4. File selected (browser file dialog or drop event)
5. UploadDialogComponent validates:
   - File extension (.xml or .musicxml)
   - File size (<10MB)
   - MIME type (application/xml)
6. Validation passes → Upload button enabled
7. User clicks Upload → Loading state
8. SongService.uploadSong() called:
   - Read file as ArrayBuffer
   - Calculate MD5 hash
   - Validate MusicXML structure
   - Parse metadata (composer, title)
   - Check for duplicates
   - Upload to Supabase Storage OR reuse existing song
   - Create/update database records
9. Request completes (201 Created or 200 OK)
10. UploadDialogComponent displays success message
11. Dialog closes automatically after 1-2 seconds
12. LibraryComponent refreshes:
    - New song added to top of songs array
    - Total items incremented
    - isEmpty computed signal updates to false
    - Find Similar Music FAB now visible
13. Success toast: "Song uploaded successfully"

**Expected UI State:**

- Upload dialog closed
- New song card appears in grid
- Song "Composer - Title" correctly extracted from MusicXML
- FABs updated based on new library state

---

**Interaction 3: Infinite Scroll - Load Next Page**

**User Action:** Scroll to bottom of song grid

**System Flow:**

1. User scrolls to within ~500px of bottom
2. Scroll event listener detects trigger condition
3. Check `hasMoreItems()` computed signal
4. If true AND `paginationLoading() === false`:
   - Set `paginationLoading = true`
   - Calculate nextPage = currentPage + 1
   - Call `getUserLibrary({ page: nextPage, limit: 50, ... })`
5. API returns next batch of 50 songs
6. Append to songs array via `songs.update(existing => [...existing, ...newSongs])`
7. Update currentPage signal
8. Set `paginationLoading = false`
9. Grid automatically updates with new songs (no page reload)

**Expected UI State:**

- Smooth scrolling without jump
- New songs appear at bottom of list
- No duplicate entries
- Can continue scrolling until `hasMoreItems() === false`

---

**Interaction 4: Delete Song with Confirmation**

**User Action:** Hover over song card → Click delete icon → Confirm deletion

**System Flow:**

1. User hovers over SongCardComponent on desktop
   - Delete icon becomes visible in top-right
2. User clicks delete icon
3. SongCardComponent emits delete event to LibraryComponent
4. LibraryComponent:
   - Sets `selectedSongForDelete = songItem`
   - Opens ConfirmDialogComponent modally
5. Dialog displays:
   - Title: "Delete Song?"
   - Message: "Are you sure you want to delete this song?"
   - Song details: "[Composer] - [Title]"
   - Cancel button, Delete button (red/warn)
6. User clicks Delete button
7. ConfirmDialogComponent emits confirmed event
8. LibraryComponent optimistically updates state:
   - `songs.update()` to filter out deleted song
   - `totalItems.update()` to decrement
   - Close dialog
9. Call `removeSongFromLibrary(songId)` → DELETE `/api/user-songs/{songId}`
10. API returns 204 No Content
11. Success toast: "Song deleted"
12. If API fails (error caught):
    - Show error toast
    - Refresh library from API to sync state

**Expected UI State:**

- Song card removed from grid
- Grid reflows smoothly
- Total items count updated
- No song card visible after deletion
- If last song deleted and library now empty → show empty state

---

**Interaction 5: Get AI Recommendations**

**User Action:** Click "Find Similar Music" FAB → View suggestions → Rate and close

**System Flow:**

1. Find Similar Music FAB visible (songs.length > 0)
2. User clicks FAB
3. AiSuggestionsDialogComponent opens modally
4. Dialog shows loading spinner
5. Call `AiSuggestionsService.getSuggestions()`:
   - Send user's library songs to AI Edge Function
   - Enforce 3-second timeout via RxJS `timeout()` operator
   - Edge Function calls OpenRouter.ai API
6. API response received within 3s:
   - Suggestions array with 3-5 recommendations
   - Feedback ID for tracking ratings
7. Dialog displays:
   - List of suggestions (composer, title)
   - Thumbs up/down icons for each
   - Close button
8. User clicks thumbs up on suggestion:
   - Icon highlights
   - Local state updated to rating: 1
   - Thumbs down unselected
9. User clicks thumbs down on another:
   - Icon highlights
   - Local state updated to rating: -1
10. User closes dialog:
    - AiSuggestionsDialogComponent emits closed event
    - Call `submitAiSuggestionFeedback()` with ratings
    - PATCH `/api/feedback/ai-suggestions/{feedbackId}`
    - Batch all ratings (1, -1, null) in single request
11. Feedback submitted successfully
12. Dialog closes
13. Return to library view (no navigation change)

**Expected UI State:**

- AI dialog closed
- Library view refreshed with original songs
- No page reload, smooth transition
- User can click Find Similar Music again anytime

---

**Interaction 6: Complete Onboarding**

**User Action:** Navigate through 3-step stepper → Click "Get Started"

**System Flow:**

1. OnboardingDialogComponent displayed modally
2. Step 1 content: "Upload Your Music"
   - Icon: cloud_upload
   - Description text
   - "Upload a Song" button (visual CTA)
3. User clicks Next → advance to Step 2
4. Step 2 content: "Browse Public Library"
   - Icon: library_music
   - Description text
   - "Browse Library" button (visual CTA, no navigation yet)
5. User clicks Next → advance to Step 3
6. Step 3 content: "Get AI Recommendations"
   - Icon: smart_toy
   - Description text
   - "Find Similar Music" button (visual CTA, disabled if empty library)
   - "Get Started" button (primary action)
7. User clicks "Get Started":
   - Call `ProfileService.updateProfile({ has_completed_onboarding: true })`
   - PATCH `/api/profiles/me`
8. Profile updated successfully
9. Dialog closes automatically
10. `has_completed_onboarding` signal updated
11. Library view displays normally

**Expected UI State:**

- Onboarding dialog closed
- Empty state or song grid visible
- FABs accessible for user to interact with
- Onboarding won't auto-trigger again

---

## 9. Conditions and Validation

### API-Level Conditions

**Authentication (All Endpoints):**

- **Condition:** User must have valid JWT token in Authorization header
- **Verification:** AuthGuard checks `AuthService.isAuthenticated` before route access
- **Interface Impact:** If not authenticated, redirect to `/login` immediately (guard responsibility)
- **Error Handling:** 401 Unauthorized response → auto-redirect to login

**Authorization (List Endpoints):**

- **Condition:** User can only retrieve their own songs (RLS policy: `auth.uid() = user_id`)
- **Verification:** Database RLS policy enforces automatically
- **Interface Impact:** Library displays only current user's songs
- **Error Handling:** 403 Forbidden → display error, prompt re-login

**Pagination Parameters (GET /api/user-songs):**

- **Condition:** page >= 1, 1 <= limit <= 100, sort in allowed fields, order in {asc, desc}
- **Verification:** UserLibraryService validates before API call
- **Interface Impact:**
  - Component maintains page signal within valid range
  - Limit always 50 (hardcoded for consistency)
  - Sort options controlled by component (no user input)
- **Error Handling:** ValidationError thrown if invalid → caught in try/catch → display error

**File Format Validation (POST /api/songs):**

- **Condition:** File must be .xml or .musicxml extension
- **Verification:**
  - Client-side: `FileUtilsService.validateFileExtension()` checks name
  - Server-side: API validates MIME type and content
- **Interface Impact:**
  - File input accepts only .xml, .musicxml types
  - Upload button disabled until valid file selected
  - Error message shown if invalid format
- **Error Handling:** INVALID_FILE_FORMAT error → displayed in upload dialog

**File Size Validation (POST /api/songs):**

- **Condition:** File size < 10MB (10,485,760 bytes)
- **Verification:**
  - Client-side: `FileUtilsService.validateFileSize()`
  - Server-side: 413 Payload Too Large response
- **Interface Impact:**
  - File size shown in upload dialog
  - Upload button disabled if > 10MB
  - Error message with size limit displayed
- **Error Handling:** FILE_TOO_LARGE error → user informed of size limit

**MusicXML Validity (POST /api/songs):**

- **Condition:** File must contain valid XML structure with MusicXML elements
- **Verification:**
  - Client-side: `MusicXMLParserService.validateMusicXML()`
  - Server-side: Full XML parsing and validation
- **Interface Impact:**
  - Error shown if XML is malformed
  - User prompted to validate file externally
- **Error Handling:** INVALID_MUSICXML error → dialog displays error message

**Duplicate Song Detection (POST /api/songs):**

- **Condition:** MD5 hash of file compared to existing songs
- **Verification:**
  - Client-side: Calculate hash but not checked locally
  - Server-side: Query by file_hash, check if user already has song
- **Interface Impact:**
  - If duplicate and already in library: CONFLICT error, user notified
  - If duplicate but not in library: song added silently (handled as "add existing")
  - No duplicate appears in grid
- **Error Handling:** SONG_ALREADY_IN_LIBRARY error → show error, no song added

**Empty Library for AI Suggestions (POST /api/ai/suggestions):**

- **Condition:** User must have at least 1 song to generate suggestions
- **Verification:**
  - Client-side: `showFindSimilarFab = computed(() => songs.length > 0)`
  - Server-side: API rejects empty songs array with INVALID_REQUEST
- **Interface Impact:**
  - FAB hidden when songs.length === 0
  - User must upload or add song before suggestions available
- **Error Handling:** FAB hidden prevents user from triggering error condition

**Onboarding Status Check (GET /api/profiles/me):**

- **Condition:** `has_completed_onboarding` is boolean (never null)
- **Verification:** Database default: false, always boolean
- **Interface Impact:**
  - If false and isEmpty(): show onboarding dialog
  - If true: skip dialog
  - Dialog updates flag to true on completion
- **Error Handling:** 404 Not Found → create profile on demand, show onboarding

**Rating Values (POST/PATCH feedback endpoints):**

- **Condition:** Rating must be 1 (thumbs up), -1 (thumbs down), or null (unrated)
- **Verification:**
  - Client-side: Component controls buttons (1, -1, null only)
  - Server-side: Zod validation or similar
- **Interface Impact:**
  - Only 2 buttons per item (thumbs up, thumbs down)
  - One selected at a time (toggle behavior)
  - Can deselect by clicking selected button again
- **Error Handling:** INVALID_RATING → error logged, feedback not submitted

### Interface-Level Conditions

**Empty State Display:**

- **Condition:** `isEmpty = computed(() => songs.length === 0 && !initialLoading())`
- **Expected Behavior:**
  - Shows EmptyStateComponent with CTAs
  - Hides song grid
  - Hides Find Similar Music FAB
  - Upload FAB still visible
  - Onboarding dialog may appear on top

**Infinite Scroll Trigger:**

- **Condition:** `hasMoreItems = computed(() => currentPage() * pageSize() < totalItems())`
- **Expected Behavior:**
  - Load next page only if hasMoreItems === true
  - Append results to existing songs
  - Stop scrolling trigger when hasMoreItems === false
  - Show "No more songs" message (optional UX enhancement)

**Find Similar Music FAB Visibility:**

- **Condition:** `showFindSimilarFab = computed(() => songs.length > 0)`
- **Expected Behavior:**
  - FAB hidden when library empty
  - FAB visible when 1+ songs exist
  - FAB clickable and functional

**Upload Dialog Submission:**

- **Condition:** Upload button enabled only when file valid
- **Expected Behavior:**
  - Button disabled by default
  - Button enabled after valid file selected
  - Button loading state during upload
  - Button re-enabled if upload fails (retry available)

**Delete Confirmation Display:**

- **Condition:** Dialog shows when delete icon clicked
- **Expected Behavior:**
  - Modal appears on top of grid
  - Song details displayed: "[Composer] - [Title]"
  - Cancel/Delete buttons clearly visible
  - Delete button has warn color (red)

---

## 10. Error Handling

### Error Scenarios and Recovery Strategies

**Scenario 1: Network Error During Initial Library Load**

**Condition:** GET `/api/user-songs` fails (network timeout, 500 error, etc.)

**Detection:**

```typescript
this.userLibraryService.getUserLibrary({...})
  .catch(error => {
    this.error.set(error.message);
    this.errorCode.set(error.code);
  });
```

**User Feedback:**

- Display error message banner: "Failed to load your library. Please check your connection."
- Show retry button
- Keep any previously loaded data (if exists)

**Recovery:**

- User clicks retry button → call loadInitialLibrary() again
- Exponential backoff retry (optional: 3 retries with 2s, 4s, 8s delays)

**Code Example:**

```typescript
handleRetryLoadLibrary() {
  this.error.set(null);
  this.initialLoading.set(true);
  this.loadInitialLibrary();
}
```

---

**Scenario 2: Upload File Format Invalid**

**Condition:** User selects .pdf, .doc, or other non-MusicXML file

**Detection:**

```typescript
private validateUploadFile(file: File | Blob): void {
  if (!this.fileUtilsService.validateFileExtension(file.name)) {
    throw new ValidationError(
      'Only MusicXML files (.xml, .musicxml) are supported',
      'INVALID_FILE_FORMAT'
    );
  }
}
```

**User Feedback:**

- Error message in upload dialog: "Only MusicXML files (.xml, .musicxml) are supported"
- Red error styling
- Highlight file input
- Upload button remains disabled

**Recovery:**

- User selects correct file format
- Dialog remains open, user can retry without closing
- No need for full dialog reset

**Code Example:**

```typescript
handleFileSelected(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  try {
    this.validateUploadFile(file);
    this.selectedFile.set(file);
    this.uploadError.set(null);
  } catch (error) {
    this.uploadError.set((error as ValidationError).message);
    this.selectedFile.set(null);
  }
}
```

---

**Scenario 3: Upload File Exceeds Size Limit**

**Condition:** User selects file > 10MB

**Detection:**

```typescript
private validateUploadFile(file: File | Blob): void {
  if (!this.fileUtilsService.validateFileSize(file.size)) {
    const maxSizeMB = Math.round(10); // max file size in MB
    throw new ValidationError(
      `File size exceeds maximum allowed size of ${maxSizeMB}MB`,
      'FILE_TOO_LARGE'
    );
  }
}
```

**User Feedback:**

- Error message: "File size exceeds maximum allowed size of 10MB"
- Show selected file size for reference
- Red error styling

**Recovery:**

- User compresses file or selects smaller file
- Dialog stays open for retry

---

**Scenario 4: Upload Success but Song Already in Library**

**Condition:** User uploads duplicate song (same MD5 hash, already in their library)

**Detection:**

```typescript
const duplicateCheck = await this.supabaseService.checkSongByHashWithLibraryStatus(
  fileHash,
  user.id
);

if (duplicateCheck.isInLibrary) {
  throw new ConflictError('This song is already in your library', 'SONG_ALREADY_IN_LIBRARY');
}
```

**User Feedback:**

- Error message in dialog: "This song is already in your library"
- Friendly tone (not blocking)
- Close/OK button

**Recovery:**

- User acknowledges and closes dialog
- No song added to library (correct behavior)
- Library view unchanged

**Code Example:**

```typescript
handleUploadError(error: any) {
  if (error.code === 'SONG_ALREADY_IN_LIBRARY') {
    this.uploadError.set('This song is already in your library');
  } else if (error.code === 'INVALID_FILE_FORMAT') {
    this.uploadError.set('Only MusicXML files are supported');
  } else {
    this.uploadError.set('Upload failed. Please try again.');
  }
}
```

---

**Scenario 5: AI Suggestions Timeout (> 3 seconds)**

**Condition:** OpenRouter.ai API call exceeds 3-second limit

**Detection:**

```typescript
this.aiSuggestionsService
  .getSuggestions(userSongs)
  .timeout(3000) // RxJS timeout operator
  .catch(error => {
    if (error.code === 'REQUEST_TIMEOUT') {
      throw new TimeoutError('Request took too long...');
    }
    throw error;
  });
```

**User Feedback:**

- Loading spinner changes to error state
- Error message: "The request took too long. Please try again."
- Retry button visible

**Recovery:**

- User clicks retry → re-fetch suggestions
- Or user closes dialog to cancel operation

**Code Example:**

```typescript
handleAiError(error: any) {
  if (error.code === 'REQUEST_TIMEOUT') {
    this.aiError.set('The request took too long. Please try again.');
  } else if (error.code === 'AI_SERVICE_UNAVAILABLE') {
    this.aiError.set('Unable to fetch suggestions. Please try again later.');
  }
}

retryAiSuggestions() {
  this.aiError.set(null);
  this.aiLoading.set(true);
  this.fetchSuggestions(); // Re-call API
}
```

---

**Scenario 6: Delete Song - Song No Longer in Library**

**Condition:** Between user clicking delete and confirmation, song removed by another session

**Detection:**

```typescript
try {
  await this.userLibraryService.removeSongFromLibrary(songId);
} catch (error) {
  if (error.code === 'SONG_NOT_IN_LIBRARY') {
    // Song already removed
  }
}
```

**User Feedback:**

- Error toast: "This song is no longer in your library"
- Library refreshed automatically

**Recovery:**

- No further action needed
- UI syncs with backend state
- Song already removed from grid (optimistic UI)

---

**Scenario 7: Authentication Expired During Operation**

**Condition:** JWT token expires mid-operation (rare, but possible)

**Detection:**

```typescript
try {
  await this.userLibraryService.removeSongFromLibrary(songId);
} catch (error) {
  if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
    // Session expired
  }
}
```

**User Feedback:**

- Auto-redirect to `/login` by auth guard
- Toast: "Your session has expired. Please log in again."

**Recovery:**

- User logs in again
- Redirects back to `/library`
- Fresh session established

---

**Scenario 8: Profile Not Found on Onboarding Check**

**Condition:** GET `/api/profiles/me` returns 404 (user profile not created)

**Detection:**

```typescript
try {
  const profile = await this.profileService.getProfile();
} catch (error) {
  if (error.code === 'PROFILE_NOT_FOUND') {
    // Handle gracefully
  }
}
```

**User Feedback:**

- Silent error handling (user doesn't need to know)
- Assume `has_completed_onboarding = false`
- Show onboarding dialog

**Recovery:**

- Backend creates profile on first update
- User completes onboarding
- Profile created with flag set to true

---

### Global Error Handling

**HTTP Error Interceptor:**

Configured in Angular to catch all HTTP errors and provide consistent handling:

```typescript
// In error.interceptor.ts
intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
  return next.handle(req).pipe(
    catchError(error => {
      const message = this.mapErrorToUserMessage(error);
      this.errorHandlingService.showError(message);
      return throwError(() => error);
    })
  );
}

private mapErrorToUserMessage(error: any): string {
  switch (error.status) {
    case 400:
      return error.error?.error?.message || 'Invalid request';
    case 401:
      return 'Your session has expired. Please log in again.';
    case 403:
      return 'You do not have permission to perform this action.';
    case 404:
      return 'The requested resource was not found.';
    case 409:
      return error.error?.error?.message || 'This action conflicts with existing data.';
    case 500:
      return 'Server error. Please try again later.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}
```

**Toast Notifications:**

Use Angular Material Snackbar for non-blocking error feedback:

```typescript
// In component
private showErrorNotification(message: string) {
  this.snackBar.open(message, 'Dismiss', {
    duration: 5000,
    panelClass: ['error-snackbar'],
    horizontalPosition: 'end',
    verticalPosition: 'bottom',
  });
}

private showSuccessNotification(message: string) {
  this.snackBar.open(message, 'Close', {
    duration: 3000,
    panelClass: ['success-snackbar'],
    horizontalPosition: 'end',
    verticalPosition: 'bottom',
  });
}
```

---

## 11. Implementation Steps

### Phase 1: Setup and Core Components

**Step 1:** Create standalone component structure

```
src/app/components/
├── library/
│   ├── library.component.ts (main component)
│   ├── library.component.html
│   ├── library.component.scss
│   └── library.component.spec.ts
├── song-card/
│   ├── song-card.component.ts
│   ├── song-card.component.html
│   └── song-card.component.scss
├── empty-state/ (shared)
│   ├── empty-state.component.ts
│   ├── empty-state.component.html
│   └── empty-state.component.scss
└── loading-skeleton/ (shared)
    ├── loading-skeleton.component.ts
    ├── loading-skeleton.component.html
    └── loading-skeleton.component.scss
```

**Step 2:** Implement LibraryComponent shell

- Set up routing in app.routes.ts with AuthGuard
- Create standalone component with OnInit, OnDestroy
- Inject dependencies: UserLibraryService, SongService, ProfileService, Router
- Define signal state variables (songs, loading, error, pagination)
- Define computed signals (isEmpty, hasMoreItems, etc.)
- Implement ngOnInit to fetch initial data

**Step 3:** Implement SongCardComponent

- Create input signals for song data
- Create output events for card click and delete
- Implement click handler with Router navigation
- Add content projection for actions slot
- Apply Material Card styling

**Step 4:** Implement EmptyStateComponent

- Create reusable empty state display
- Add content projection for action buttons
- Design with Material icon and text
- Make fully responsive

**Step 5:** Implement LoadingSkeletonComponent

- Create skeleton grid layout
- Add CSS shimmer animation
- Make dimensions match SongCard

### Phase 2: Dialog Components

**Step 6:** Implement UploadDialogComponent

- Create Material Dialog wrapper
- Add file input element (hidden)
- Implement drag-and-drop zone
- Add file validation logic
- Create upload flow with loading state
- Handle success and error states

**Step 7:** Implement ConfirmDialogComponent

- Create reusable confirmation dialog
- Add title, message, and item details display
- Implement confirm/cancel buttons
- Add keyboard support (Esc, Enter)

**Step 8:** Implement OnboardingDialogComponent

- Create MatStepper with 3 horizontal steps
- Add content for each step (upload, browse, AI)
- Implement next/back/finish navigation
- Update profile on completion
- Add close icon for dismissal

**Step 9:** Implement AiSuggestionsDialogComponent

- Create AI suggestions modal
- Implement loading spinner with timeout
- Add suggestions list with thumbs icons
- Track rating state locally
- Implement batch feedback submission

### Phase 3: State Management and Data Flow

**Step 10:** Implement library data fetching

- Create signals for data, pagination, loading, error
- Implement loadInitialLibrary() method
- Implement loadNextPage() for infinite scroll
- Add error handling and retry logic
- Create computed signals for UI state

**Step 11:** Implement mutation handlers

- Create handleSongDeleted() with optimistic UI
- Create handleSongUploaded() with library refresh
- Add rollback logic on errors
- Implement success/error notifications

**Step 12:** Implement infinite scroll

- Add scroll event listener
- Detect scroll-to-bottom trigger
- Call loadNextPage() when appropriate
- Prevent duplicate requests during loading

**Step 13:** Implement onboarding check

- Call ProfileService.getProfile() on init
- Check has_completed_onboarding flag
- Show OnboardingDialogComponent conditionally
- Update profile on completion

### Phase 4: Integration and Polish

**Step 14:** Wire up all dialogs and interactions

- Connect Upload FAB to UploadDialogComponent
- Connect delete actions to ConfirmDialogComponent
- Connect Find Similar Music FAB to AiSuggestionsDialogComponent
- Ensure dialogs emit events properly
- Test dialog open/close flows

**Step 15:** Implement error handling

- Add HTTP error interceptor
- Map API errors to user messages
- Implement error recovery flows
- Add logging for debugging
- Test all error scenarios

**Step 16:** Add responsive design

- Implement responsive grid layout (CSS Grid, @media queries)
- Test on desktop, tablet, mobile viewports
- Ensure FABs accessible on all sizes
- Test infinite scroll on mobile
- Test dialog responsiveness

**Step 17:** Accessibility improvements

- Add ARIA labels to interactive elements
- Ensure keyboard navigation (Tab, Enter, Esc)
- Add focus indicators
- Test with screen readers
- Verify color contrast ratios (WCAG AA)

**Step 18:** Performance optimization

- Implement trackBy for ngFor loops
- Use OnPush change detection
- Lazy load heavy components if needed
- Test bundle size
- Profile performance with DevTools

**Step 19:** Testing

- Write unit tests for component logic
- Write integration tests for service calls
- Test error scenarios
- Test accessibility
- Create E2E tests for user flows

**Step 20:** Documentation and deployment

- Add code comments and JSDoc
- Update implementation notes in codebase
- Prepare for code review
- Deploy to staging for QA
- Gather feedback and iterate
