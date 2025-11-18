# Product Requirements Document (PRD) - MuShee

## 1. Product Overview

MuShee is a web-based application designed for musicians to centralize, manage, and access their sheet music library. The Minimum Viable Product (MVP) focuses on providing a streamlined solution for users to upload their sheet music in MusicXML format, view it through an integrated renderer, and discover new pieces through AI-powered recommendations. The core objective is to reduce the friction musicians face when managing a disorganized collection of sheet music, making practice and performance preparation more efficient and enjoyable.

## 2. User Problem

Musicians often accumulate sheet music in various formats—physical books, scattered PDF files, images, and bookmarks. This collection is disorganized, hard to access on the go, and static. Finding a specific piece quickly, especially for practice or performance, can be a major source of friction. MuShee aims to solve this by providing a single, organized, and accessible digital library for all their sheet music.

## 3. Functional Requirements

The MVP will deliver the following core functionalities:

- FR-1: User Account Management
  - Account creation and login are optional and only required to create and manage a personal library.
  - Users must be able to create an account using an email address and password.
  - Users must be able to log in to access their personal library.
  - The system must securely store user credentials and associate them with their song library.

- FR-2: Song Library Management
  - Users can upload songs in the MusicXML format to their personal library.
  - The user's library is displayed as a list of tiles, showing the "Composer - Title" parsed from the MusicXML file.
  - Users can permanently delete songs from their library.

- FR-3: Pre-loaded Content Library
  - The application includes a pre-loaded library of public domain songs accessible to all users without requiring login.
  - Users can browse this library and view sheet music.
  - Authenticated users can add songs from the public library to their personal collection.

- FR-4: Sheet Music Rendering
  - When a user selects a song from their library, the system renders the MusicXML file into readable sheet music.
  - The rendering will be handled by an open-source library integrated into the application.
  - The interface will be clean and focused on readability.

- FR-5: AI-Powered Song Suggestions
  - A "Find Similar Music" call-to-action is available in the user's song list view.
  - When triggered, the application sends the user's song list (titles/artists) to an external AI API.
  - The API returns a list of similar songs, which are displayed to the user in a pop-up modal.
  - The system should display a loading indicator while fetching suggestions and handle potential API errors gracefully.

- FR-6: User Feedback System
  - Users can rate the quality of the rendered sheet music using a thumbs up/down system.
  - Users can rate the relevance of the AI-generated song suggestions using a thumbs up/down system.
  - This feedback is collected for statistical analysis of feature performance.

- FR-7: New User Onboarding
  - First-time users who log in with an empty library will be greeted with a 3-step introductory modal.
  - The modal will explain how to (1) upload songs, (2) browse the free library, and (3) use AI suggestions.

## 4. Product Boundaries

The following features and functionalities are explicitly out of scope for the MVP release:

- Support for multiple sheet music formats (e.g., PDF, MIDI, Musicnotes). Only MusicXML is supported.
- Sheet music editing or annotation capabilities.
- Storing or filtering songs by additional properties like genre, difficulty, or key.
- Social features, such as sharing songs or libraries with other users.
- Native mobile applications for iOS or Android. The MVP is a web-only application.
- Social login options (e.g., Google, Facebook). Authentication is limited to email and password.
- Anonymous users can browse the public library and view sheet music, but cannot upload songs or save them to a personal library.

## 5. User Stories

### Account Management

- ID: US-001
- Title: New User Registration
- Description: As a new user, I want to create an account using my email and a password so that I can have a personal space to store my music.
- Acceptance Criteria:
  - The registration form must include fields for email and password.
  - The system validates that the email is in a correct format.
  - The system validates that the password meets minimum security requirements (e.g., length).
  - Upon successful registration, the user is automatically logged in and gains access to his (initially empty) library.
  - If the email is already registered, an appropriate error message is displayed.

- ID: US-002
- Title: User Login
- Description: As a returning user, I want to log in with my email and password to access my saved song library.
- Acceptance Criteria:
  - The login form must include fields for email and password.
  - Upon successful authentication, the user is redirected to their song library page.
  - If the credentials are incorrect, a clear error message is displayed.

- ID: US-003
- Title: User Logout
- Description: As a logged-in user, I want to log out of my account to ensure my session is securely ended.
- Acceptance Criteria:
  - A "Logout" button is available within the application's main navigation.
  - Clicking "Logout" ends the user's session and redirects them to the login page.

### Onboarding

- ID: US-004
- Title: New User Onboarding
- Description: As a new user who just created an account, I want to see a brief introduction to the main features so I can quickly understand how to use the application.
- Acceptance Criteria:
  - When a user with an empty personal library accesses the application for the first time after registration, a 3-step introductory modal appears.
  - The modal highlights: (1) how to upload a song, (2) how to browse the pre-loaded library, and (3) how to get AI suggestions.
  - Each step is displayed on separate card of modal.
  - The user can close the modal at any time.

### Library Management

- ID: US-005
- Title: View Empty Library
- Description: As a new user, I want to see a clear message or prompt in my library when I have no songs yet, guiding me on what to do next.
- Acceptance Criteria:
  - When the song list is empty, a message is displayed inviting the user to upload a MusicXML file or browse the public domain library.
  - The "Find Similar Music" tile is not displayed when the library is empty.

- ID: US-006
- Title: Upload a Song
- Description: As a user, I want to upload a MusicXML file from my device to add it to my song library.
- Acceptance Criteria:
  - There is a clear "Upload Song" button or interface element.
  - Clicking the button opens a file selector, filtered to accept only `.musicxml` or `.xml` files.
  - Upon successful upload, the new song appears as a tile in my library, displaying its composer and title.
  - The page updates to show the new song without requiring a full page reload.

- ID: US-007
- Title: Handle Invalid File Upload
- Description: As a user, I want to be notified if I try to upload a file that is not in the supported MusicXML format.
- Acceptance Criteria:
  - If a user attempts to upload a file with an incorrect format, the system rejects the file.
  - A user-friendly error message is displayed, stating that only MusicXML files are supported.

- ID: US-008
- Title: View Song List
- Description: As a user with songs in my library, I want to see them displayed in a clear and scannable list.
- Acceptance Criteria:
  - Songs are displayed as individual tiles in a grid or list format.
  - Each tile clearly shows the "Composer - Title" information extracted from the MusicXML file.

- ID: US-009
- Title: Delete a Song
- Description: As a user, I want to be able to remove a song from my library that I no longer need.
- Acceptance Criteria:
  - Each song tile has a visible "trash" icon.
  - Clicking the delete icon prompts the user with a confirmation modal (e.g., "Are you sure you want to delete this song?").
  - Upon confirmation, the song is permanently removed from the user's library and the view is updated.

### Pre-loaded Content

- ID: US-010
- Title: Browse Pre-loaded Library
- Description: As a user, I want to browse a collection of pre-loaded public domain songs to discover new music.
- Acceptance Criteria:
  - A "Browse Library" or "Discover" section is accessible from the main interface.
  - This section displays a list of available public domain songs, similar to the personal library view.
  - Each song in this library has an "Add to my library" button (visible only to authenticated users).

- ID: US-011
- Title: Add Song from Pre-loaded Library
- Description: As an authenticated user, I want to add a song from the public domain library to my personal library with a single click.
- Acceptance Criteria:
  - Clicking the "Add to my library" button copies the selected song to the user's personal library.
  - If user is not authenticated, they are prompted to log in or register.
  - The user receives a confirmation message (e.g., "Song added successfully!").
  - The newly added song appears in the user's main song list.

### Core Features

- ID: US-012
- Title: View Sheet Music
- Description: As a user, I want to click on a song to view its full sheet music.
- Acceptance Criteria:
  - Clicking on a song tile opens a dedicated viewer page or modal.
  - The viewer correctly renders the MusicXML file into clean, readable sheet music.
  - This feature is available for both authenticated users (personal library) and anonymous users (public library).

- ID: US-013
- Title: Get AI Song Suggestions
- Description: As an authenticated user with songs in my personal library, I want to get suggestions for similar music to discover new pieces to play.
- Acceptance Criteria:
  - A "Find Similar Music" tile is present in the song list view (when the personal library is not empty).
  - Clicking this tile triggers a call to the external AI API.
  - A loading indicator is displayed while the API call is in progress. The response time should be under 3 seconds.
  - The suggestions are displayed in a pop-up modal, listing the suggested song titles and artists.
  - Each suggestion has its own thumbs up/down feedback icons.

- ID: US-014
- Title: Handle AI Suggestion API Error
- Description: As a user, I want to see a helpful message if the AI suggestion feature fails to load results.
- Acceptance Criteria:
  - If the AI API returns an error or times out, the loading indicator is replaced with an error message.
  - The message should be user-friendly (e.g., "Sorry, we couldn't fetch suggestions at this time. Please try again later.").

### Feedback

- ID: US-015
- Title: Rate Sheet Music Rendering
- Description: As a authenticated user viewing a piece of sheet music, I want to provide feedback on the rendering quality using a thumbs up/down system.
- Acceptance Criteria:
  - The sheet music viewer displays a "thumb up" and a "thumb down" icons.
  - Clicking an icon records the user's vote (one vote per user per song rendering).
  - The system provides visual feedback that the vote has been registered (e.g. the icon becomes highlighted).

- ID: US-016
- Title: Rate AI Suggestion
- Description: As a authenticated user viewing AI suggestions, I want to rate the relevance of each suggestion with a thumbs up or down.
- Acceptance Criteria:
  - Each song suggestion in the results pop-up has a "thumb up" and a "thumb down" icons next to it.
  - Clicking an icon records the user's vote for that specific suggestion.
  - The system provides visual feedback that the vote has been registered (e.g. the icon becomes highlighted).

## 6. Success Metrics

The success of the MVP will be measured by the following user feedback metrics. For the MVP, these metrics are intended for data collection to inform future development and are not tied to immediate product iterations.

- Metric 1: Sheet Music Rendering Quality
  - Target: 95% of all user ratings on rendered sheet music are "thumbs up."
  - This metric indicates the reliability and quality of the chosen rendering library and our implementation.

- Metric 2: AI Suggestion Relevance
  - Target: 75% of all user ratings on AI-powered song suggestions are "thumbs up."
  - This metric measures the effectiveness of the external AI service and our prompting strategy in providing valuable recommendations to users.

- Unresolved: A primary business or engagement metric (e.g., user retention, weekly active users) has not been defined for the MVP but should be considered for future releases to measure overall product-market fit.
