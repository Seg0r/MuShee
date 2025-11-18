# UI Architecture for MuShee

## 1. UI Structure Overview

MuShee's user interface is built using Angular 19 with Angular Material components, organized around a shell layout with persistent navigation. The application uses a signal-based reactive architecture without global state management, fetching fresh data from Supabase on each view navigation. The interface emphasizes simplicity, clarity, and accessibility while providing musicians with efficient tools to manage their sheet music library.

### Core Architectural Principles

- **Signal-Based Reactivity**: Angular 19 signals exclusively for state management, no RxJS-based state stores
- **Static Data Pattern**: Fetch fresh library data on each view navigation without client-side caching
- **Component Reusability**: Shared components with content projection for different contexts
- **Modal-First Interactions**: Complex actions (upload, delete, AI suggestions) presented in dialog modals
- **Responsive Design**: Angular Material breakpoints with adaptive navigation (sidebar on desktop, drawer on mobile)
- **Direct API Integration**: Supabase SDK for database operations, Edge Functions for external AI integration

### Technology Stack

- **Framework**: Angular 19 with TypeScript 5
- **UI Components**: Angular Material (Material 3 design)
- **Sheet Music Rendering**: OpenSheetMusicDisplay
- **Backend**: Supabase (Auth, Database, Storage, Edge Functions)
- **State Management**: Angular signals only
- **Routing**: Lazy-loaded feature modules with functional route guards

### Shell Layout Structure

The application uses a persistent shell layout built with Angular Material's `mat-sidenav`:

- **Toolbar** (top bar):
  - Application logo/name (left)
  - User avatar with dropdown menu (right)
  - Help/Tour menu item (right)
- **Navigation Sidebar** (authenticated users only):
  - Desktop (>960px): Persistent sidebar
  - Tablet/Mobile (<600px): Collapsible drawer
  - Navigation items:
    - My Library (/library)
    - Discover (/discover)

- **Unauthenticated Navigation** (for /discover access):
  - Simplified toolbar with login/register prompts
  - Song cards show "Sign in to add" instead of active add button

- **Main Content Area**:
  - Router outlet for view components
  - Scrollable content with infinite scroll support

---

## 2. View List

### 2.1 Login View

- **View Path**: `/login`
- **Access**: Public (unauthenticated users only)
- **Main Purpose**: Authenticate returning users with email and password credentials

#### Key Information to Display

- Email input field with validation
- Password input field
- Login button
- Link to registration view
- Error messages for authentication failures
- Loading state during authentication

#### Key View Components

- Authentication form with Angular Material form fields
- Error message display area
- "Create Account" link navigating to `/register`
- Loading spinner overlay during API call

#### UX Considerations

- Form validation on blur for individual fields
- Complete form validation on submit
- Clear, actionable error messages for invalid credentials
- Auto-focus on email field on page load
- "Enter" key submits form

#### Accessibility Considerations

- Proper form labels and ARIA attributes
- Error messages announced to screen readers
- Keyboard navigation support
- Focus management for error states

#### Security Considerations

- Password field with masked input
- No credential storage in component state
- Secure token handling via Supabase SDK
- Automatic redirect to library if already authenticated

---

### 2.2 Registration View

- **View Path**: `/register`
- **Access**: Public (unauthenticated users only)
- **Main Purpose**: Create new user accounts with email and password

#### Key Information to Display

- Email input field with format validation
- Password input field with strength requirements
- Password requirements message (minimum length)
- Create Account button
- Link to login view
- Error messages for validation failures
- Loading state during registration

#### Key View Components

- Registration form with Angular Material form fields
- Password strength indicator
- Error message display area
- "Already have an account? Login" link
- Loading spinner overlay during API call

#### UX Considerations

- Real-time validation feedback on blur
- Clear password requirements displayed upfront
- Success message before redirect
- Auto-login after successful registration
- Redirect to `/library` with onboarding trigger

#### Accessibility Considerations

- Form field labels and error messages
- Password requirements announced to assistive technologies
- Keyboard-accessible form controls
- Focus management for validation errors

#### Security Considerations

- Client-side validation for email format and password strength
- Server-side validation via Supabase Auth
- No plain-text password display
- Secure registration flow with automatic authentication

---

### 2.3 User Library View

- **View Path**: `/app/library`
- **Access**: Protected (authenticated users only)
- **Main Purpose**: Display and manage the user's personal sheet music collection

#### Key Information to Display

**Empty State** (no songs in library):

- Message: "Your library is empty"
- Call-to-action prompts:
  - "Upload a song to get started"
  - "Browse the public domain library"

**Populated State** (songs present):

- Grid of song cards displaying "Composer - Title"
- Each card includes delete icon
- Infinite scroll with loading indicator
- "Back to top" button when scrolled down
- Total count not displayed (per decision #19)

#### Key View Components

- `SongCardComponent` (shared) with delete action button via content projection
- Upload FAB (floating action button, bottom-right)
- "Find Similar Music" FAB (visible only when library not empty, positioned near upload FAB)
- Skeleton loaders during initial data fetch
- Empty state component with CTAs
- Delete confirmation dialog (triggered by delete icon)
- Onboarding dialog (auto-triggered for new users with `has_completed_onboarding = false`)

#### UX Considerations

- Immediate visual feedback for all actions
- Optimistic UI patterns for non-critical operations
- Skeleton loaders maintain layout during load
- Infinite scroll loads next page 50 items from bottom
- Smooth scroll animation for "Back to top"
- FAB buttons remain accessible during scroll
- Library data refreshes after upload or delete operations

#### Accessibility Considerations

- Song cards keyboard navigable
- Delete icons have descriptive ARIA labels ("Delete [Composer - Title]")
- FAB buttons have text labels or ARIA labels
- Loading states announced to screen readers
- Empty state message readable by assistive technologies

#### Security Considerations

- Row Level Security enforces user can only see own library
- Delete operations require confirmation
- No sensitive data exposed in UI
- Authentication status checked before data fetch

---

### 2.4 Public Library Discovery View

- **View Path**: `/app/discover`
- **Access**: Public (anonymous and authenticated users)
- **Main Purpose**: Browse pre-loaded public domain songs and add to personal library (authenticated users only)

#### Key Information to Display

- Grid of public domain song cards displaying "Composer - Title"
- Each card includes "Add to Library" button
- Button state indicates if song already in user's library (disabled if present)
- Infinite scroll with loading indicator
- "Back to top" button when scrolled down
- Search and filter controls (placeholder for future enhancement)

#### Key View Components

- `SongCardComponent` (shared) with "Add to Library" action button via content projection
- Infinite scroll container with pagination
- Skeleton loaders during initial data fetch
- Toast notifications for successful additions
- "Back to top" FAB when scrolled

#### UX Considerations

- Add to Library button disabled with visual indication if song already in library
- Computed signal checks existing library songs for optimistic UI
- Toast notification confirms successful addition
- No page refresh needed after adding song
- Button state updates immediately after action
- Smooth infinite scroll experience
- 50 items per page load

#### Accessibility Considerations

- Song cards keyboard navigable
- Add button states clearly communicated
- For unauthenticated users: Clicking "Add to Library" prompts login/registration
- Disabled button includes ARIA label explaining why ("Already in library" or "Sign in to add")
- Toast notifications announced to screen readers
- Loading states communicated to assistive technologies

#### Security Considerations

- Row Level Security allows all users (authenticated and anonymous) to access public songs
- Unauthenticated users cannot perform "Add to library" (redirected to login)
- Add to library operation validates song exists and user doesn't already have it
- No ability to modify or delete public domain songs
- Authorization checked on every add operation

---

### 2.5 Sheet Music Viewer

- **View Path**: `/song/:songId`
- **Access**: Public for public domain songs, Protected for personal library songs
  - Authenticated users: Can view songs from personal library
  - Unauthenticated users: Can view public domain songs
- **Main Purpose**: Display rendered sheet music in full-screen with zoom controls and collect rendering quality feedback
- **Layout**: Full-screen view (no shell navigation), maximizes canvas visibility

#### Key Information to Display

- Song metadata: Composer and Title (header)
- Rendered sheet music (OpenSheetMusicDisplay canvas)
- Current zoom level indication
- Loading state during initial render
- Error state if rendering fails

#### Key View Components

- Back button (top-left, returns to previous view)
- Song title and composer display (top, centered or left-aligned)
- OpenSheetMusicDisplay canvas (main content area, full-width)
- Zoom controls:
  - Zoom in button (+)
  - Zoom out button (-)
  - Current zoom level display
- Feedback FAB group (bottom-right, always visible):
  - Thumbs up button
  - Thumbs down button
  - Visual states: unrated, thumbs up selected, thumbs down selected
  - Allows toggling (change rating) or removal
- Loading spinner during rendering
- Error message display with retry if applicable

#### UX Considerations

- Back button navigation preserves previous route context
- Zoom controls provide immediate visual feedback
- Zoom increments/decrements by reasonable steps
- Feedback FABs fixed position, always accessible
- Visual feedback on rating selection (icon highlight)
- Users can change their rating by clicking opposite thumb (authenticated only)
- Unauthenticated users see prompts to sign in for rating
- Automatic fresh signed URL fetch if expired (no user action required)
- Clean, distraction-free reading experience
- Keyboard shortcuts for zoom (future enhancement)

#### Accessibility Considerations

- Back button clearly labeled
- Zoom controls keyboard accessible
- Current zoom level announced to screen readers
- Feedback buttons have descriptive labels
- Sheet music canvas has appropriate ARIA role
- Loading and error states announced

#### Security Considerations

- Authorization check:
  - Authenticated users: Must have song in their library
  - Unauthenticated users: Can access public domain songs only
- Signed URLs with 1-hour expiration
- Automatic renewal of expired URLs without exposing storage paths
- No direct file access from client
- Row Level Security enforces access control

---

## 3. User Journey Map

### 3.1 Primary User Journey: New User First Session

**Step 1: Initial Authentication**

- User lands on `/login` (or redirected if accessing protected route)
- Clicks "Create Account" link
- Navigates to `/register`

**Step 2: Account Creation**

- Enters email address
- Enters password (validation feedback on blur)
- Clicks "Create Account"
- Loading state displays
- API creates account via Supabase Auth
- User automatically authenticated
- Redirects to `/app/library`

**Step 3: Onboarding Experience**

- Library view loads (empty state)
- System checks `has_completed_onboarding = false`
- Onboarding dialog automatically appears
- User sees 3-step horizontal stepper:
  - **Step 1**: "Upload Your Music" - Explains MusicXML upload feature
  - **Step 2**: "Browse Public Library" - Explains discovery feature
  - **Step 3**: "Get AI Recommendations" - Explains AI suggestion feature
- User can navigate between steps or close dialog at any time
- On close or completion, API updates profile: `has_completed_onboarding = true`
- User now sees empty library state with CTAs

**Step 4: First Song Upload**

- User clicks Upload FAB (bottom-right)
- Upload dialog opens with file selector and drag-drop zone
- User selects MusicXML file (.xml or .musicxml)
- Clicks "Upload" button
- Loading state displays (no progress bar)
- API processes upload (duplicate check, parse metadata, store file)
- Success message displays with song details
- Dialog closes
- Library view refreshes automatically
- New song card appears in grid

**Step 5: Viewing Sheet Music**

- User clicks on newly uploaded song card
- Navigates to `/song/:songId`
- Loading spinner displays while fetching song details and signed URL
- OpenSheetMusicDisplay renders sheet music
- User interacts with zoom controls (+/-)
- Reviews rendered notation

**Step 6: Providing Rendering Feedback**

- User clicks thumbs up FAB (bottom-right)
- Icon becomes highlighted
- API records feedback asynchronously
- User can change rating by clicking thumbs down
- Previous rating replaced with new rating

**Step 7: Returning to Library**

- User clicks back button
- Returns to `/app/library`
- Sees their song in the library

**Step 8: Discovering Public Domain Songs**

- User clicks "Discover" in navigation sidebar
- Navigates to `/app/discover`
- Public library view loads with skeleton loaders
- Song grid appears with public domain collection
- User scrolls through available songs (infinite scroll)
- Finds interesting piece

**Step 9: Adding Public Domain Song**

- User clicks "Add to Library" button on song card
- Button shows loading state briefly
- API adds song to user's library
- Toast notification: "Song added successfully!"
- Button becomes disabled with "Already in Library" state
- No page refresh needed

**Step 10: Getting AI Recommendations**

- User navigates back to `/app/library`
- Now has multiple songs in library
- "Find Similar Music" FAB is visible (wasn't visible when library was empty)
- User clicks "Find Similar Music" FAB
- AI Suggestions dialog opens with loading spinner

**Step 11: Reviewing AI Suggestions**

- Client-side 3-second timeout enforced
- Edge Function calls OpenRouter.ai API
- Dialog displays scrollable list of suggestions:
  - Each suggestion shows: "Composer - Title"
  - Each has thumbs up/down icons
- User reviews suggestions
- Rates relevant suggestions with thumbs up
- Rates irrelevant suggestions with thumbs down
- Leaves some unrated

**Step 12: Submitting Feedback and Closing**

- User clicks close button on dialog
- API call batches all ratings (PATCH /api/feedback/ai-suggestions/:feedbackId)
- Dialog closes with smooth animation
- User returns to library view

**Step 13: Deleting a Song**

- User hovers over song card
- Delete icon becomes visible/accessible
- Clicks delete icon
- Confirmation dialog appears:
  - Message: "Are you sure you want to delete this song?"
  - Shows "Composer - Title"
  - Cancel and Delete buttons
- User clicks "Delete" (red button)
- Dialog closes
- API deletes song from user's library
- Library view refreshes
- Song card removed from grid
- Toast notification: "Song deleted"

**Step 14: Logging Out**

- User clicks avatar in top-right toolbar
- Dropdown menu appears
- User clicks "Logout"
- Logout confirmation dialog appears:
  - Message: "Are you sure you want to log out?"
  - Cancel and Logout buttons
- User confirms
- Session terminated via Supabase Auth
- Redirects to `/login`

### 3.2 Secondary User Journey: Returning User Session

**Quick Access Flow**:

1. User navigates to application URL
2. `AuthService` initialized via `provideAppInitializer` checks for existing session
3. If authenticated, redirects to `/app/library`
4. If not, redirects to `/login`
5. User logs in with stored credentials (browser autofill)
6. Redirects to `/app/library`
7. Library loads with existing songs
8. User clicks song to view sheet music
9. Navigates between library and discover views seamlessly

### 3.3 Tertiary User Journey: Anonymous User Browsing Public Library

**Discovery Without Authentication**:

1. User lands on application or navigates directly to `/app/discover`
2. `AuthService` checks session - user is not authenticated
3. Discover view loads with shell sidebar showing only Discover link
4. Public domain song grid displays with infinite scroll
5. User can view sheet music by clicking on song cards
6. User wants to add song to library
7. User clicks "Sign in to add" button (or "Add to Library" which prompts)
8. Directed to login/register page
9. User creates account or logs in
10. Redirected back to `/app/discover` or `/app/library` (depending on implementation)

**View Sheet Music as Anonymous**:

1. Unauthenticated user clicks on song in `/app/discover`
2. Navigates to `/song/:songId` for that public song
3. Sheet music renders with zoom controls (full-screen, no shell)
4. Feedback FABs present but clicking prompts "Sign in to rate"
5. User can view unrated or navigate back

### 3.4 Error Recovery Flows

**Upload Error Flow**:

1. User selects invalid file format
2. Error message displays in upload dialog: "Only MusicXML files (.xml, .musicxml) are supported"
3. User can select different file without closing dialog
4. Retry upload with valid file

**AI Suggestions Timeout Flow**:

1. User clicks "Find Similar Music"
2. Dialog opens with loading spinner
3. 3 seconds pass without response
4. Timeout error displays: "The request took too long. Please try again."
5. Retry button available
6. User clicks retry or closes dialog

**Expired Signed URL Flow**:

1. User navigates to sheet music viewer
2. Signed URL has expired (>1 hour old)
3. Component automatically detects expired URL
4. Fetches fresh signed URL from API
5. Re-renders sheet music without user intervention
6. User unaware of the issue (seamless experience)

**Network Error Flow**:

1. Any API call fails due to network issue
2. Global error handling service intercepts error
3. Toast notification displays: "Network error. Please check your connection."
4. User can retry action when connection restored
5. For critical views, display error state with retry button

---

## 4. Layout and Navigation Structure

### 4.1 Shell Layout (AppShellComponent)

The application uses a **unified, persistent shell layout** that remains consistent across all main views (library, discover, sheet music viewer). The shell adapts based on authentication state but is always present for these routes:

```
+------------------------------------------------------------------+
||  Toolbar                                                         |
||  [MuShee Logo]                          [Help] [User Avatar ▼]   |
||                                         (or Login/Register)       |
+------------------------------------------------------------------+
||        |                                                         |
|| Side-  |  Main Content Area                                     |
|| bar    |  (Router Outlet)                                       |
||        |                                                         |
|| My     |  [View-specific content]                               |
|| Library|  - Library View (/app/library)                         |
||        |  - Discover View (/app/discover)                       |
|| Dis-   |                                                         |
|| cover  |                                                         |
||        |                                                         |
+------------------------------------------------------------------+
```

**Responsive Behavior**:

- **Desktop (>960px)**:
  - Sidebar persistent and always visible
  - Main content adjusts width with sidebar open
  - Toolbar spans full width
- **Tablet (600-960px)**:
  - Sidebar collapses to drawer (overlay mode)
  - Hamburger menu icon in toolbar to toggle drawer
  - Main content full-width when drawer closed
- **Mobile (<600px)**:
  - Sidebar drawer mode (overlay)
  - Hamburger menu icon in toolbar
  - Single column layout for content
  - FAB buttons positioned for thumb access

**Authentication-Based Adaptations**:

- **Authenticated Users**:
  - Sidebar shows both "My Library" and "Discover" navigation items
  - Toolbar shows user avatar with dropdown menu (Help, Logout)
  - Full access to all features and action buttons
- **Unauthenticated Users** (browsing public content):
  - Sidebar shows only "Discover" navigation item
  - "My Library" hidden (guarded by AuthGuard)
  - Toolbar shows "Login" and "Register" buttons instead of user avatar
  - Action buttons show "Sign in" prompts instead of active functionality

### 4.2 Navigation Patterns

#### Primary Navigation (Sidebar/Drawer)

- **My Library** (`/app/library`): User's personal song collection
- **Discover** (`/app/discover`): Browse public domain songs

**Active Route Indication**:

- Current route highlighted in sidebar
- Active route uses primary color with background tint
- Icon and text both highlighted

#### Secondary Navigation (Toolbar)

- **Help/Tour**: Opens onboarding dialog (re-accessible)
- **User Avatar Dropdown**:
  - Display name or email
  - Logout option (triggers confirmation)

#### Contextual Navigation

- **Back Button**: Sheet music viewer includes back button to return to previous view
- **Breadcrumbs**: Not used (flat navigation structure)
- **Tabs**: Not used in MVP

### 4.3 Routing Configuration

**Route Structure**:

```
/ (root)
  ├── login (public, no shell)
  ├── register (public, no shell)
  ├── song/:songId (full-screen viewer, no shell)
  └── app (shell layout wrapper)
      ├── library (protected by AuthGuard)
      └── discover (public route, accessible to all)
```

**Route Guards**:

- **AuthGuard**: Protects `/app/library` and enforces authorization on `/song/:songId` for personal songs
  - Redirects unauthenticated users to `/login`
  - Implements functional guard pattern
  - Checks `AuthService.isAuthenticated` signal
  - For song viewer: checks user has access to the specific song or song is public domain
- **PublicOnlyGuard**: Protects `/login`, `/register`
  - Redirects authenticated users to `/app/library`
  - Prevents authenticated users from accessing auth pages

**Default Routes**:

- `/` → Redirects to `/app/library` (if authenticated) or `/login` (if not)
- Wildcard `**` → Redirects to `/app/library` or `/login` (404 handling)

**Navigation Behaviors**:

- Navigation preserves query parameters where relevant
- Back button in viewer respects browser history and returns to previous view (library or discover)
- Programmatic navigation after successful auth/registration
- Deep linking supported (auth guard redirects if needed)
- Unauthenticated users accessing `/app/discover` see the shell with limited sidebar and no user menu
- Song viewer (/song/:songId) operates in full-screen mode for maximum readability

### 4.4 Modal Navigation

Modals overlay the current view without changing the route:

- **Onboarding Dialog**: Auto-triggered or accessed via Help/Tour
- **Upload Dialog**: Triggered by Upload FAB in library view
- **AI Suggestions Dialog**: Triggered by "Find Similar Music" FAB
- **Delete Confirmation**: Triggered by delete icon on song card
- **Logout Confirmation**: Triggered by logout menu item

**Modal Behaviors**:

- ESC key closes dismissible modals
- Click outside modal closes (except for confirmations)
- Focus trapped within modal while open
- Focus returns to trigger element on close
- Backdrop dims background content

---

## 5. Key Components

### 5.1 Shared Components

#### SongCardComponent

**Purpose**: Reusable card component displaying song information across different contexts

**Props/Inputs**:

- `song`: Song object with `id`, `song_details.composer`, `song_details.title`
- `showActions`: Boolean to control action button visibility

**Content Projection**:

- `[actions]` slot: Projects context-specific action buttons (delete icon, add button)

**Usage Contexts**:

- User library: Shows delete icon
- Public library: Shows "Add to Library" button with disabled state if already added

**Features**:

- Click anywhere on card (except action buttons) navigates to sheet music viewer
- Hover state provides visual feedback
- Responsive sizing based on grid layout
- Keyboard accessible (Enter key navigates)
- Displays "Composer - Title" format consistently

---

#### EmptyStateComponent

**Purpose**: Generic empty state display with customizable message and actions

**Props/Inputs**:

- `message`: String for primary message
- `iconName`: Optional Material icon name
- `showActions`: Boolean to show/hide action buttons

**Content Projection**:

- `[actions]` slot: Projects context-specific CTAs

**Usage Contexts**:

- Empty user library
- No search results (future enhancement)
- Error states with recovery actions

---

#### LoadingSkeletonComponent

**Purpose**: Skeleton loader for song cards during data fetch

**Features**:

- Mimics song card dimensions and layout
- Animated shimmer effect
- Configurable count (number of skeleton cards to display)
- Maintains grid layout consistency

---

#### ConfirmDialogComponent

**Purpose**: Reusable confirmation dialog for destructive or significant actions

**Props/Inputs**:

- `title`: Dialog title
- `message`: Confirmation message
- `confirmText`: Confirmation button label
- `cancelText`: Cancel button label
- `confirmColor`: Color for confirm button (primary, warn, accent)

**Usage Contexts**:

- Delete song confirmation
- Logout confirmation
- Future confirmations as needed

---

### 5.2 Feature Components

#### LibraryComponent

**Purpose**: Display and manage user's personal song library

**Features**:

- Fetches user songs on initialization
- Displays empty state or song grid
- Infinite scroll with pagination
- Upload FAB (always visible)
- "Find Similar Music" FAB (conditional: visible only if library not empty)
- Triggers onboarding dialog for new users
- Handles delete operations with confirmation

**Data Flow**:

- Fetches fresh data from `LibraryService.getUserSongs()` on init
- No local state caching
- Re-fetches after mutations (upload, delete)

---

#### DiscoverComponent

**Purpose**: Browse and add public domain songs to user library

**Features**:

- Fetches public songs on initialization
- Displays song grid with infinite scroll
- "Add to Library" button on each card
- Computed signal checks if song already in user's library
- Optimistic UI: disables button immediately after click
- Toast notification on successful addition

**Data Flow**:

- Fetches public songs from `PublicLibraryService.getPublicSongs()` on init
- Fetches user's library to compute song existence
- No re-fetch needed after add operation (optimistic UI handles state)

---

#### SheetMusicViewerComponent

**Purpose**: Render and display sheet music with zoom controls and feedback

**Features**:

- Fetches song details and signed URL
- Initializes OpenSheetMusicDisplay
- Renders MusicXML on canvas
- Zoom controls with defined increments
- Feedback FABs for rendering quality
- Back button navigation
- Automatic signed URL refresh on expiration
- Error handling for rendering failures

**Data Flow**:

- Fetches song data from `SongService.getSong(songId)` on init
- Manages rendering state locally (zoom level, feedback state)
- Submits feedback via `FeedbackService.submitRenderingFeedback()`

---

#### UploadDialogComponent

**Purpose**: Handle song file upload with validation and feedback

**Features**:

- File selector button
- Drag-and-drop zone with visual feedback
- File type validation (,xml, .musicxml)
- File size validation (max 10MB)
- Upload button (disabled until valid file selected)
- Loading state during upload
- Success message with song details
- Error handling with user-friendly messages
- Retry capability on error

**Data Flow**:

- Component manages file selection locally
- Calls `LibraryService.uploadSong(file)` on submit
- Emits success event to parent (LibraryComponent)
- Parent refreshes library view on success

---

#### AiSuggestionsDialogComponent

**Purpose**: Display AI-generated song suggestions with feedback collection

**Features**:

- Loading spinner during API call (initial state)
- Client-side 3-second timeout using RxJS `timeout` operator
- Scrollable list of suggestions
- Thumbs up/down icons for each suggestion
- Track rating state for each suggestion
- Close button
- Batch submit feedback on close
- Error handling for timeout and API failures
- Retry option on error

**Props/Inputs**:

- `userSongs`: Array of user's songs to send to AI API

**Data Flow**:

- Calls `AiSuggestionsService.getSuggestions(userSongs)` on init
- Manages suggestion rating state locally
- Submits all ratings via `FeedbackService.submitAiSuggestionFeedback(feedbackId, ratings)` on close

---

#### OnboardingDialogComponent

**Purpose**: Guide new users through app features with 3-step stepper

**Features**:

- `MatStepper` in horizontal mode
- 3 steps with descriptive content:
  - Step 1: Upload Your Music (explain MusicXML upload)
  - Step 2: Browse Public Library (explain discovery)
  - Step 3: Get AI Recommendations (explain AI suggestions)
- Next/Back navigation buttons
- "Get Started" button on final step
- Close icon (top-right) for early dismissal
- Updates user profile on completion or close

**Data Flow**:

- Displayed when `user.has_completed_onboarding = false`
- Calls `ProfileService.updateProfile({ has_completed_onboarding: true })` on close
- Can be re-triggered via Help/Tour menu (doesn't update profile flag again)

---

#### AuthFormComponent (Login/Register)

**Purpose**: Handle user authentication forms with validation

**Features**:

- Email and password input fields
- Form validation with Angular Material error messages
- On-blur validation for individual fields
- On-submit validation for complete form
- Loading state during authentication
- Error message display
- Navigation link to opposite form (login ↔ register)

**Data Flow**:

- Calls `AuthService.login(email, password)` or `AuthService.register(email, password)`
- Redirects to `/library` on success
- Displays error messages on failure

---

### 5.3 Layout Components

#### AppShellComponent

**Purpose**: Provide persistent shell layout with navigation for authenticated views

**Features**:

- `mat-sidenav` container
- Persistent sidebar (desktop) / drawer (mobile)
- Toolbar with logo, Help/Tour, and user avatar
- Navigation menu items
- User dropdown menu
- Router outlet for view components
- Responsive behavior based on viewport size

---

### 5.4 Service Components (Non-Visual)

#### AuthService

**Purpose**: Manage authentication state with signals

**Signals**:

- `user = signal<User | null>(null)`: Current user object
- `isAuthenticated = computed(() => !!this.user())`: Authentication status
- `isLoading = signal(true)`: Initial session check loading state

**Methods**:

- `login(email, password)`: Authenticate user
- `register(email, password)`: Create new account
- `logout()`: End session
- `checkSession()`: Verify existing session (called via `provideAppInitializer`)

---

#### LibraryService

**Purpose**: Manage user song library operations

**Methods**:

- `getUserSongs(page, limit)`: Fetch paginated user library
- `uploadSong(file)`: Upload MusicXML file
- `deleteSong(songId)`: Remove song from library
- `checkSongInLibrary(songId)`: Check if song exists in user's library (for optimistic UI)

---

#### PublicLibraryService

**Purpose**: Manage public domain song operations

**Methods**:

- `getPublicSongs(page, limit)`: Fetch paginated public songs
- `addToLibrary(songId)`: Add public song to user's library

---

#### SongService

**Purpose**: Manage individual song operations

**Methods**:

- `getSong(songId)`: Fetch song details and signed URL
- `refreshSignedUrl(songId)`: Fetch fresh signed URL for expired URLs

---

#### AiSuggestionsService

**Purpose**: Call AI suggestions Edge Function with timeout

**Methods**:

- `getSuggestions(songs)`: Call AI API with user's songs, enforce 3-second timeout

---

#### FeedbackService

**Purpose**: Submit user feedback

**Methods**:

- `submitRenderingFeedback(songId, rating)`: Submit thumbs up/down for rendering
- `submitAiSuggestionFeedback(feedbackId, suggestions)`: Batch submit AI suggestion ratings

---

#### ProfileService

**Purpose**: Manage user profile operations

**Methods**:

- `getProfile()`: Fetch current user profile
- `updateProfile(data)`: Update profile fields (e.g., `has_completed_onboarding`)

---

#### ErrorHandlingService

**Purpose**: Global error interception and user-friendly error display

**Features**:

- HTTP error interceptor
- Toast notification system using Angular Material Snackbar
- Error message mapping (API error codes → user-friendly messages)
- Network error detection
- Timeout error handling

**Error Messages**:

- Authentication: "Invalid email or password"
- Network: "Network error. Please check your connection."
- AI Timeout: "The request took too long. Please try again."
- AI Service: "Sorry, we couldn't fetch suggestions at this time. Please try again later."
- Upload Format: "Only MusicXML files (.xml, .musicxml) are supported"
- File Size: "File size exceeds maximum allowed size of 10MB"
- Generic: "Something went wrong. Please try again."

---

## 6. Accessibility Considerations

### Keyboard Navigation

- All interactive elements accessible via Tab key
- Logical tab order throughout application
- Skip navigation link for screen readers
- Modal focus trapping with Esc to close
- Arrow key navigation in lists (future enhancement)

### Screen Reader Support

- Semantic HTML elements (`<nav>`, `<main>`, `<article>`)
- ARIA labels on icon-only buttons
- ARIA live regions for dynamic content (toast notifications, loading states)
- Form field error messages associated with inputs
- Loading states announced ("Loading songs...", "Uploading file...")

### Visual Accessibility

- High contrast ratios meeting WCAG AA standards
- Focus indicators on all interactive elements
- Color not used as sole indicator (icons + text for states)
- Sufficient button/touch target sizes (min 44x44px)
- Zoom support up to 200% without breaking layout

### Error Handling

- Clear, descriptive error messages
- Errors announced to screen readers
- Visual and programmatic association of errors with fields
- Error recovery options provided

---

## 7. Security Considerations

### Authentication & Authorization

- JWT-based authentication via Supabase Auth
- Session tokens stored securely by Supabase SDK
- Automatic token refresh handled by SDK
- Route guards protect all authenticated views
- Row Level Security enforces authorization at database level

### Data Protection

- No sensitive data stored in component state
- Passwords never stored or displayed in plain text
- User can only access songs in their library or public songs
- File uploads validated for type and size
- MusicXML files parsed safely

### Network Security

- All API calls over HTTPS
- Signed URLs with time-based expiration (1 hour)
- CORS configured for specific domains (development and production)
- No exposure of storage paths or database structure

### Input Validation

- Client-side validation for all user inputs
- Server-side validation via API/database constraints
- File type restrictions enforced
- SQL injection prevented via Supabase's parameterized queries
- XSS prevention via Angular's built-in sanitization

---

## 8. Performance Considerations

### Data Loading

- Lazy loading for feature modules
- Skeleton loaders during initial data fetch
- Infinite scroll pagination (50 items per page)
- Fresh data fetching on navigation (no stale cached data)

### Rendering Optimization

- OnPush change detection for list components (future optimization)
- Virtual scrolling for large lists (future optimization)
- Image/icon lazy loading
- Minimal re-renders via signals

### Network Optimization

- Signed URLs cached until expiration
- Minimal API calls (no polling, fetch on-demand)
- Edge Functions for server-side operations requiring API keys
- Client-side timeout enforcement (3 seconds for AI)

### Bundle Size

- Lazy-loaded routes reduce initial bundle
- Angular Material tree-shaking
- No large external dependencies beyond OSMD

---

## 9. Edge Cases and Error States

### Authentication Edge Cases

- **Session expiration**: Auto-redirect to login with message
- **Concurrent sessions**: Supabase handles token invalidation
- **Registration with existing email**: Clear error message displayed
- **Logout during operation**: Cancel pending requests, clean up state

### Data Loading Edge Cases

- **Empty library**: Display empty state with CTAs
- **No public songs** (unlikely): Display message
- **End of paginated list**: Stop infinite scroll, show "No more songs"
- **Network error during pagination**: Display error, allow retry without losing loaded items
- **Concurrent modifications**: Refresh data on navigation to ensure consistency

### Upload Edge Cases

- **Invalid file format**: Error message in dialog, allow file reselection
- **File too large (>10MB)**: Error message with size limit
- **Corrupted MusicXML**: Error message suggesting file validation
- **Duplicate song**: API handles gracefully, adds to library without re-uploading
- **Upload interruption**: Error message with retry option
- **Concurrent uploads**: Not prevented, handled sequentially by API

### Rendering Edge Cases

- **Invalid MusicXML structure**: Error state in viewer with message
- **Rendering failure**: Error message with option to return to library
- **Signed URL expired**: Automatically fetch fresh URL and re-render
- **Large/complex score**: Loading indicator until render complete
- **Missing fonts**: OSMD handles with fallback fonts

### AI Suggestions Edge Cases

- **Empty library**: FAB hidden, no trigger available
- **API timeout (>3s)**: Timeout message, retry option
- **API rate limit**: Service unavailable message
- **No suggestions returned**: Display message "No suggestions available"
- **Malformed response**: Error handling with generic message

### Feedback Edge Cases

- **Multiple rapid ratings**: Debounce or handle latest rating only
- **Rating before rendering complete**: Disable feedback until rendered
- **Network error during feedback submission**: Silent retry or display error
- **Changing rating**: Allow toggle or removal of rating

### Navigation Edge Cases

- **Direct URL access to song not in library**: 403 error, redirect to library with message
- **Back button from viewer after deletion**: Handle gracefully (song no longer exists)
- **Browser refresh during operation**: Operation cancelled, state reloaded from API
- **Deep linking**: Route guards redirect if authentication required

---

## 10. User Story to UI Mapping

### Authentication User Stories

**US-001: New User Registration**

- **UI Elements**: Registration View with email/password form, validation messages
- **Flow**: User enters credentials → validates on blur and submit → creates account → auto-login → redirect to library

**US-002: User Login**

- **UI Elements**: Login View with email/password form, error display
- **Flow**: User enters credentials → authenticates → redirects to library

**US-003: User Logout**

- **UI Elements**: Logout menu item in avatar dropdown, confirmation dialog
- **Flow**: User clicks logout → confirmation modal → confirms → session ends → redirects to login

---

### Onboarding User Story

**US-004: New User Onboarding**

- **UI Elements**: Onboarding Dialog with MatStepper (3 steps), close icon, navigation buttons
- **Flow**: New user logs in → library empty and `has_completed_onboarding = false` → modal auto-appears → user navigates through steps → closes or completes → profile updated

---

### Library Management User Stories

**US-005: View Empty Library**

- **UI Elements**: Empty state component with message and CTAs
- **Flow**: User with no songs sees: "Your library is empty" + upload and discover CTAs
- **Special**: "Find Similar Music" FAB not displayed when empty

**US-006: Upload a Song**

- **UI Elements**: Upload FAB, Upload Dialog with file selector and drag-drop, success message
- **Flow**: User clicks FAB → dialog opens → selects MusicXML file → uploads → success message with song details → library refreshes → new song appears

**US-007: Handle Invalid File Upload**

- **UI Elements**: Error message in Upload Dialog, retry option
- **Flow**: User selects invalid file → system validates → error displays: "Only MusicXML files (.xml, .musicxml) are supported" → user can select different file

**US-008: View Song List**

- **UI Elements**: Song grid with SongCard components, infinite scroll
- **Flow**: User navigates to library → songs load → displays as tiles showing "Composer - Title"

**US-009: Delete a Song**

- **UI Elements**: Delete icon on song card, confirmation dialog with song details
- **Flow**: User clicks delete → confirmation shows "Composer - Title" → user confirms → song deleted → library refreshes → toast notification

---

### Pre-loaded Content User Stories

**US-010: Browse Pre-loaded Library**

- **UI Elements**: Discover navigation item, public song grid with infinite scroll
- **Flow**: User clicks "Discover" → navigates to `/app/discover` → public songs display as tiles

**US-011: Add Song from Pre-loaded Library**

- **UI Elements**: "Add to Library" button on each public song card, button disabled state, toast notification
- **Flow**: User clicks "Add to Library" → API adds song → toast: "Song added successfully!" → button disables → song appears in user's library

---

### Core Features User Stories

**US-012: View Sheet Music**

- **UI Elements**: Sheet Music Viewer with OSMD canvas, zoom controls, back button
- **Flow**: User clicks song card → navigates to `/song/:songId` → sheet music renders → user views and zooms

**US-013: Get AI Song Suggestions**

- **UI Elements**: "Find Similar Music" FAB, AI Suggestions Dialog with loading spinner and suggestion list
- **Flow**: User clicks FAB (visible only when library not empty) → dialog opens → loading (3s timeout) → suggestions display → user rates them → closes → feedback submitted

**US-014: Handle AI Suggestion API Error**

- **UI Elements**: Error message in AI Dialog, retry option
- **Flow**: API fails or times out → loading indicator replaced with message: "Sorry, we couldn't fetch suggestions at this time. Please try again later." → retry or close options

---

### Feedback User Stories

**US-015: Rate Sheet Music Rendering**

- **UI Elements**: Thumbs up/down FAB group in viewer (bottom-right, always visible)
- **Flow**: User views sheet music → clicks thumbs up or down → icon highlights → feedback recorded → user can change rating by clicking opposite thumb

**US-016: Rate AI Suggestion**

- **UI Elements**: Thumbs up/down icons next to each suggestion in AI Dialog
- **Flow**: User reviews suggestions → clicks thumbs up or down on each → icons highlight → closes dialog → all ratings submitted in batch

---

## 11. Component Hierarchy

```
AppComponent
├── Router Outlet
    ├── AppShellComponent (unified layout for all main views)
    │   ├── Toolbar
    │   │   ├── Logo
    │   │   ├── Help/Tour Menu Item
    │   │   └── User Menu (conditional based on auth)
    │   │       ├── User Avatar Dropdown (authenticated)
    │   │       │   └── Logout Menu Item (triggers LogoutConfirmDialog)
    │   │       └── Login/Register Buttons (unauthenticated)
    │   ├── Sidenav Container
    │   │   ├── Sidenav (drawer for mobile)
    │   │   │   ├── My Library NavLink (authenticated only, guarded)
    │   │   │   └── Discover NavLink (always visible)
    │   │   └── Main Content (Router Outlet)
    │   │       ├── LibraryComponent (protected by AuthGuard)
    │   │       │   ├── EmptyStateComponent (if no songs)
    │   │       │   ├── SongCardComponent[] (with delete action)
    │   │       │   ├── LoadingSkeletonComponent[] (during load)
    │   │       │   ├── Upload FAB
    │   │       │   └── Find Similar Music FAB (if songs exist)
    │   │       │
    │   │       └── DiscoverComponent (public route)
    │   │           ├── SongCardComponent[] (action varies by auth state)
    │   │           │   ├── "Add to Library" button (authenticated)
    │   │           │   └── "Sign in to add" prompt (unauthenticated)
    │   │           └── LoadingSkeletonComponent[] (during load)
    │   │
    │   ├── OnboardingDialogComponent (conditional, authenticated only)
    │   │   └── MatStepper (3 steps)
    │   ├── UploadDialogComponent (triggered by FAB, authenticated only)
    │   │   ├── File Selector
    │   │   ├── Drag-Drop Zone
    │   │   └── Upload Button
    │   ├── AiSuggestionsDialogComponent (triggered by FAB, authenticated only)
    │   │   ├── Loading Spinner
    │   │   ├── Suggestion List
    │   │   │   └── Suggestion Item[] (with thumbs icons)
    │   │   └── Close Button
    │   ├── ConfirmDialogComponent (delete song)
    │   │   ├── Message with song details
    │   │   └── Cancel/Delete Buttons
    │   └── ConfirmDialogComponent (logout)
    │       ├── Logout message
    │       └── Cancel/Logout Buttons
    │
    ├── SheetMusicViewerComponent (full-screen route, no shell)
    │   ├── Back Button (top-left, returns to previous view)
    │   ├── Song Title Display (header)
    │   ├── OSMD Canvas (full-screen, maximized visibility)
    │   ├── Zoom Controls
    │   └── Feedback FAB Group (bottom-right)
    │       ├── Thumbs up/down (authenticated users)
    │       └── "Sign in to rate" prompts (unauthenticated users)
    │
    ├── LoginComponent (public route, no shell)
    │   └── AuthFormComponent
    │
    └── RegisterComponent (public route, no shell)
        └── AuthFormComponent
```

---

## 12. Requirements to UI Elements Explicit Mapping

### FR-1: User Account Management

| Requirement                        | UI Element                    | Location                |
| ---------------------------------- | ----------------------------- | ----------------------- |
| Create account with email/password | Registration form             | Registration View       |
| Login with credentials             | Login form                    | Login View              |
| Secure credential storage          | Supabase Auth (no UI element) | Backend                 |
| Associate library with user        | Automatic via auth state      | All authenticated views |

### FR-2: Song Library Management

| Requirement                              | UI Element                        | Location                    |
| ---------------------------------------- | --------------------------------- | --------------------------- |
| Upload MusicXML files                    | Upload FAB + Upload Dialog        | Library View                |
| Display as tiles with "Composer - Title" | SongCard component                | Library View, Discover View |
| Delete songs                             | Delete icon + Confirmation Dialog | Library View                |

### FR-3: Pre-loaded Content Library

| Requirement                                     | UI Element                                 | Location                      |
| ----------------------------------------------- | ------------------------------------------ | ----------------------------- |
| Browse public domain songs (unauthenticated)    | Song grid with infinite scroll (public)    | Discover View (public access) |
| View sheet music (unauthenticated)              | Sheet Music Viewer (public access)         | /song/:songId (public access) |
| Add song to personal collection (authenticated) | "Add to Library" button / "Sign in" prompt | Discover View (authenticated) |

### FR-4: Sheet Music Rendering

| Requirement               | UI Element                | Location               |
| ------------------------- | ------------------------- | ---------------------- |
| Select song to view       | Clickable song card       | Library/Discover Views |
| Render MusicXML           | OSMD canvas               | Sheet Music Viewer     |
| Clean, readable interface | Zoom controls, minimal UI | Sheet Music Viewer     |

### FR-5: AI-Powered Song Suggestions

| Requirement                  | UI Element             | Location              |
| ---------------------------- | ---------------------- | --------------------- |
| "Find Similar Music" CTA     | FAB button             | Library View          |
| Send song list to AI         | Automatic on FAB click | Background            |
| Display suggestions in modal | AI Suggestions Dialog  | Overlay               |
| Loading indicator            | Spinner in dialog      | AI Suggestions Dialog |
| Error handling               | Error message + retry  | AI Suggestions Dialog |

### FR-6: User Feedback System

| Requirement            | UI Element                          | Location              |
| ---------------------- | ----------------------------------- | --------------------- |
| Rate rendering quality | Thumbs up/down FAB group            | Sheet Music Viewer    |
| Rate AI suggestions    | Thumbs up/down icons per suggestion | AI Suggestions Dialog |
| Collect for analysis   | Background API calls                | Backend               |

### FR-7: New User Onboarding

| Requirement               | UI Element                        | Location                      |
| ------------------------- | --------------------------------- | ----------------------------- |
| 3-step introductory modal | Onboarding Dialog with MatStepper | Auto-triggered on first login |
| Explain upload            | Step 1 content                    | Onboarding Dialog             |
| Explain browse library    | Step 2 content                    | Onboarding Dialog             |
| Explain AI suggestions    | Step 3 content                    | Onboarding Dialog             |
| Re-accessible             | Help/Tour menu item               | Toolbar                       |

---

## 13. User Pain Points and UI Solutions

| User Pain Point                                       | UI Solution                                                         | Implementation                                                                 |
| ----------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Disorganized sheet music collection**               | Clean, scannable library grid with clear "Composer - Title" display | SongCard components in grid layout with consistent formatting                  |
| **Difficulty finding specific pieces**                | Infinite scroll for easy browsing, future search/filter             | Infinite scroll with 50 items per page, search placeholder                     |
| **No access to music on the go**                      | Responsive web application accessible from any device               | Responsive breakpoints, mobile-first design, PWA-ready architecture            |
| **Discovering new music to play**                     | AI-powered recommendations + public domain library                  | "Find Similar Music" FAB, Discover view with one-click add                     |
| **Uncertainty about app features (first-time users)** | 3-step onboarding modal explaining core features                    | Onboarding Dialog with MatStepper, re-accessible via Help/Tour                 |
| **Slow or unresponsive UI**                           | Loading indicators, skeleton loaders, optimistic UI                 | Skeleton loaders during fetch, spinners for actions, immediate visual feedback |
| **Fear of accidentally deleting songs**               | Confirmation dialog with song details before deletion               | Delete Confirmation Dialog showing "Composer - Title" with clear Cancel option |
| **Poor sheet music readability**                      | Zoom controls and high-quality rendering                            | Zoom +/- buttons, OSMD library for reliable rendering                          |
| **Not knowing if AI suggestions are good**            | Feedback system to rate suggestions                                 | Thumbs up/down on each suggestion, visible in dialog                           |
| **Long AI response times**                            | Loading indicator and timeout handling                              | Spinner with 3-second timeout, clear error messages                            |
| **Losing track of uploaded files**                    | Automatic parsing and display of metadata                           | MusicXML metadata extraction, consistent "Composer - Title" format             |
| **Duplicate uploads**                                 | Backend deduplication with user-friendly messaging                  | API checks file hash, adds to library if exists, no error                      |

---

This comprehensive UI architecture provides a solid foundation for MuShee's development, ensuring all PRD requirements are addressed with thoughtful user experience design, accessibility considerations, and robust error handling. The architecture leverages Angular 19's signals for reactive state management while maintaining simplicity through direct Supabase integration and a static data pattern that prioritizes data freshness over client-side caching.
