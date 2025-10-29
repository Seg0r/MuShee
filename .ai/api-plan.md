# API Integration Plan - MuShee

## 1. Overview

This document defines the API integration architecture for MuShee, a web-based sheet music library management application. The application uses a hybrid approach: most operations use Supabase SDK directly from the Angular frontend, while external API calls (AI suggestions) use Supabase Edge Functions for secure server-side execution.

### Technology Stack

- **Backend**: Supabase (PostgreSQL + Row Level Security + Storage + Edge Functions)
- **Authentication**: Supabase Auth (handled client-side via Supabase SDK)
- **AI Integration**: OpenRouter.ai (via Supabase Edge Functions)
- **File Storage**: Supabase Storage

### API Design Principles

- Direct Supabase SDK calls for database and authentication operations
- Supabase Edge Functions for external API integrations requiring private keys
- JSON request/response payloads
- JWT-based authentication via Supabase Auth (optional for public content, required for personal library)
- Row Level Security (RLS) enforcement at the database level
- Comprehensive error handling with user-friendly messages

---

## 2. Resources

| Resource                   | Database Table(s)               | Integration Method     | Description                                          |
| -------------------------- | ------------------------------- | ---------------------- | ---------------------------------------------------- |
| **Profiles**               | `public.profiles`               | Direct Supabase SDK    | User profile data extending Supabase auth.users      |
| **Songs**                  | `public.songs`                  | Direct Supabase SDK    | Master catalog of unique music pieces                |
| **User Library**           | `public.user_songs`             | Direct Supabase SDK    | User's personal song collection                      |
| **Rendering Feedback**     | `public.rendering_feedback`     | Direct Supabase SDK    | User ratings on sheet music rendering quality        |
| **AI Suggestion Feedback** | `public.ai_suggestion_feedback` | Direct Supabase SDK    | User ratings on AI-powered suggestions               |
| **AI Suggestions**         | N/A (External API)              | Supabase Edge Function | AI-generated music recommendations via OpenRouter.ai |

---

## 3. Authentication

### Mechanism

Authentication is handled entirely through **Supabase Auth** using the client-side SDK. The Angular application will use Supabase's authentication methods for:

- User registration (email/password) - **optional**, required only for personal library management
- User login (email/password) - **optional**, required only for personal library management
- User logout
- Session management

### Implementation Details

- Authentication is optional for browsing public domain songs and viewing public sheet music
- Authentication is required for creating/managing personal library, uploading songs, and accessing AI suggestions
- Supabase SDK automatically manages JWT tokens, refresh, and session persistence
- Direct database operations use RLS policies with `auth.uid()` for automatic authorization
- Edge Functions receive authenticated context through Supabase client calls
- Unauthenticated users can only access endpoints marked as "Optional" authentication

---

## 4. Endpoints

### 4.1 Profile Management

#### Get Current User Profile

Retrieve the authenticated user's profile information, including onboarding status.

- **HTTP Method**: `GET`
- **URL Path**: `/api/profiles/me`
- **Authentication**: Required
- **Query Parameters**: None

**Response Payload** (200 OK):

```json
{
  "id": "uuid",
  "updated_at": "2025-10-22T10:30:00Z",
  "has_completed_onboarding": false
}
```

**Error Responses**:

- `401 Unauthorized`: User not authenticated

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

- `404 Not Found`: Profile not found

```json
{
  "error": {
    "code": "PROFILE_NOT_FOUND",
    "message": "User profile does not exist"
  }
}
```

---

#### Update Current User Profile

Update the authenticated user's profile data, typically to mark onboarding as complete.

- **HTTP Method**: `PATCH`
- **URL Path**: `/api/profiles/me`
- **Authentication**: Required
- **Query Parameters**: None

**Request Payload**:

```json
{
  "has_completed_onboarding": true
}
```

**Response Payload** (200 OK):

```json
{
  "id": "uuid",
  "updated_at": "2025-10-22T10:35:00Z",
  "has_completed_onboarding": true
}
```

**Error Responses**:

- `401 Unauthorized`: User not authenticated
- `400 Bad Request`: Invalid payload

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "has_completed_onboarding must be a boolean"
  }
}
```

---

### 4.2 Song Management

#### Upload a New Song

Upload a MusicXML file, parse metadata, check for duplicates, and add to the user's library.

- **HTTP Method**: `POST`
- **URL Path**: `/api/songs`
- **Authentication**: Required
- **Content-Type**: `multipart/form-data`

**Request Payload** (multipart/form-data):

- `file`: MusicXML file (.xml or .musicxml)

**Business Logic**:

1. Validate file format (must be .xml or .musicxml)
2. Calculate MD5 hash of file content
3. Check if song with same hash already exists
4. If exists, add existing song to user's library
5. If new, parse MusicXML to extract composer and title (truncate to 200 chars)
6. Upload file to Supabase Storage (filename = file_hash)
7. Create song record in database
8. Add song to user's library (user_songs table)

**Response Payload** (201 Created):

```json
{
  "id": "uuid",
  "song_details": {
    "composer": "Ludwig van Beethoven",
    "title": "Moonlight Sonata"
  },
  "file_hash": "abc123def456...",
  "created_at": "2025-10-22T10:40:00Z",
  "added_to_library_at": "2025-10-22T10:40:00Z"
}
```

**Response Payload** (200 OK) - Duplicate found and added:

```json
{
  "id": "existing-uuid",
  "song_details": {
    "composer": "Ludwig van Beethoven",
    "title": "Moonlight Sonata"
  },
  "file_hash": "abc123def456...",
  "created_at": "2025-10-15T08:20:00Z",
  "added_to_library_at": "2025-10-22T10:40:00Z"
}
```

**Error Responses**:

- `400 Bad Request`: Invalid file format

```json
{
  "error": {
    "code": "INVALID_FILE_FORMAT",
    "message": "Only MusicXML files (.xml, .musicxml) are supported"
  }
}
```

- `400 Bad Request`: Invalid MusicXML content

```json
{
  "error": {
    "code": "INVALID_MUSICXML",
    "message": "Unable to parse MusicXML file. Please ensure the file is valid."
  }
}
```

- `401 Unauthorized`: User not authenticated
- `413 Payload Too Large`: File size exceeds limit

```json
{
  "error": {
    "code": "FILE_TOO_LARGE",
    "message": "File size exceeds maximum allowed size of 10MB"
  }
}
```

- `409 Conflict`: Song already in user's library

```json
{
  "error": {
    "code": "SONG_ALREADY_IN_LIBRARY",
    "message": "This song is already in your library"
  }
}
```

---

#### Get Song Details and MusicXML File Access

Retrieve song metadata and a signed URL to download the MusicXML file for rendering.

- **HTTP Method**: `GET`
- **URL Path**: `/api/songs/:songId`
- **Authentication**: Required
- **Path Parameters**:
  - `songId` (uuid): ID of the song

**Response Payload** (200 OK):

```json
{
  "id": "uuid",
  "song_details": {
    "composer": "Ludwig van Beethoven",
    "title": "Moonlight Sonata"
  },
  "file_hash": "abc123def456...",
  "created_at": "2025-10-15T08:20:00Z",
  "musicxml_url": "https://supabase-storage-url/signed-url-with-expiry"
}
```

**Error Responses**:

- `401 Unauthorized`: User not authenticated
- `403 Forbidden`: User does not have access to this song

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have access to this song"
  }
}
```

- `404 Not Found`: Song does not exist

```json
{
  "error": {
    "code": "SONG_NOT_FOUND",
    "message": "Song not found"
  }
}
```

---

#### Browse Public Domain Songs

Retrieve a paginated list of pre-loaded public domain songs accessible to all users.

- **HTTP Method**: `GET`
- **URL Path**: `/api/songs/public`
- **Authentication**: Optional
- **Query Parameters**:
  - `page` (integer, default: 1): Page number
  - `limit` (integer, default: 50, max: 100): Number of items per page
  - `sort` (string, default: "title"): Sort field (title, composer, created_at)
  - `order` (string, default: "asc"): Sort order (asc, desc)
  - `search` (string, optional): Search in title or composer

**Response Payload** (200 OK):

```json
{
  "data": [
    {
      "id": "uuid",
      "song_details": {
        "composer": "Wolfgang Amadeus Mozart",
        "title": "Eine kleine Nachtmusik"
      },
      "created_at": "2025-09-01T00:00:00Z"
    },
    {
      "id": "uuid-2",
      "song_details": {
        "composer": "Johann Sebastian Bach",
        "title": "Air on the G String"
      },
      "created_at": "2025-09-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total_items": 150,
    "total_pages": 3
  }
}
```

**Error Responses**:

- `400 Bad Request`: Invalid query parameters

```json
{
  "error": {
    "code": "INVALID_PARAMETERS",
    "message": "Invalid pagination parameters"
  }
}
```

---

### 4.3 User Library Management

#### Get User's Song Library

Retrieve all songs in the authenticated user's personal library.

- **HTTP Method**: `GET`
- **URL Path**: `/api/user-songs`
- **Authentication**: Required
- **Query Parameters**:
  - `page` (integer, default: 1): Page number
  - `limit` (integer, default: 50, max: 100): Number of items per page
  - `sort` (string, default: "created_at"): Sort field (title, composer, created_at)
  - `order` (string, default: "desc"): Sort order (asc, desc)

**Response Payload** (200 OK):

```json
{
  "data": [
    {
      "song_id": "uuid",
      "song_details": {
        "composer": "Ludwig van Beethoven",
        "title": "Moonlight Sonata"
      },
      "added_at": "2025-10-22T10:40:00Z"
    },
    {
      "song_id": "uuid",
      "song_details": {
        "composer": "Frédéric Chopin",
        "title": "Nocturne Op. 9 No. 2"
      },
      "added_at": "2025-10-20T14:15:00Z"
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

**Error Responses**:

- `401 Unauthorized`: User not authenticated

---

#### Add Song to User's Library

Add a song (typically from the public domain library) to the user's personal library.

- **HTTP Method**: `POST`
- **URL Path**: `/api/user-songs`
- **Authentication**: Required
- **Description**: Authenticated users can add any public domain song to their personal library. Unauthenticated users must log in or register first.

**Request Payload**:

```json
{
  "song_id": "uuid"
}
```

**Response Payload** (201 Created):

```json
{
  "user_id": "uuid",
  "song_id": "uuid",
  "created_at": "2025-10-22T11:00:00Z",
  "song_details": {
    "composer": "Wolfgang Amadeus Mozart",
    "title": "Eine kleine Nachtmusik"
  }
}
```

**Error Responses**:

- `400 Bad Request`: Invalid request payload
- `401 Unauthorized`: User not authenticated

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required to add songs to your library"
  }
}
```

- `404 Not Found`: Song does not exist or user doesn't have access

```json
{
  "error": {
    "code": "SONG_NOT_FOUND",
    "message": "Song not found or not accessible"
  }
}
```

- `409 Conflict`: Song already in user's library

```json
{
  "error": {
    "code": "SONG_ALREADY_IN_LIBRARY",
    "message": "This song is already in your library"
  }
}
```

---

#### Remove Song from User's Library

Remove a song from the authenticated user's personal library.

- **HTTP Method**: `DELETE`
- **URL Path**: `/api/user-songs/:songId`
- **Authentication**: Required
- **Path Parameters**:
  - `songId` (uuid): ID of the song to remove

**Response Payload** (204 No Content):
No response body

**Error Responses**:

- `401 Unauthorized`: User not authenticated
- `404 Not Found`: Song not in user's library

```json
{
  "error": {
    "code": "SONG_NOT_IN_LIBRARY",
    "message": "Song not found in your library"
  }
}
```

---

### 4.4 AI-Powered Suggestions

#### Get AI Song Suggestions

Generate AI-powered song suggestions based on the user's current library via Supabase Edge Function.

- **Integration Method**: Supabase Edge Function (`ai-suggestions`)
- **Authentication**: Required (handled by Edge Function)
- **Timeout**: 3 seconds (per PRD requirements)

**Request Payload**:

```json
{
  "songs": [
    {
      "song_details": {
        "composer": "Ludwig van Beethoven",
        "title": "Moonlight Sonata"
      }
    },
    {
      "song_details": {
        "composer": "Frédéric Chopin",
        "title": "Nocturne Op. 9 No. 2"
      }
    }
  ]
}
```

**Business Logic**:

1. Send user's song list to OpenRouter.ai API
2. Receive AI-generated suggestions
3. Return suggestions to client
4. Create initial feedback record with null ratings

**Response Payload** (200 OK):

```json
{
  "suggestions": [
    {
      "song_details": {
        "composer": "Franz Schubert",
        "title": "Impromptu in G-flat Major"
      }
    },
    {
      "song_details": {
        "composer": "Claude Debussy",
        "title": "Clair de Lune"
      }
    },
    {
      "song_details": {
        "composer": "Erik Satie",
        "title": "Gymnopédie No. 1"
      }
    }
  ],
  "feedback_id": "uuid"
}
```

**Error Responses**:

- `400 Bad Request`: Invalid request (empty song list)

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "At least one song is required to generate suggestions"
  }
}
```

- `401 Unauthorized`: User not authenticated
- `503 Service Unavailable`: AI API error or timeout

```json
{
  "error": {
    "code": "AI_SERVICE_UNAVAILABLE",
    "message": "Sorry, we couldn't fetch suggestions at this time. Please try again later."
  }
}
```

- `504 Gateway Timeout`: Request exceeded 3-second timeout

```json
{
  "error": {
    "code": "REQUEST_TIMEOUT",
    "message": "The request took too long. Please try again."
  }
}
```

---

### 4.5 Feedback Management

#### Submit Rendering Feedback

Submit user feedback on the quality of sheet music rendering for a specific song.

- **HTTP Method**: `POST`
- **URL Path**: `/api/feedback/rendering`
- **Authentication**: Required

**Request Payload**:

```json
{
  "song_id": "uuid",
  "rating": 1
}
```

**Validation**:

- `rating`: Must be `1` (thumbs up) or `-1` (thumbs down)

**Response Payload** (201 Created):

```json
{
  "id": "uuid",
  "user_id": "uuid",
  "song_id": "uuid",
  "rating": 1,
  "created_at": "2025-10-22T11:15:00Z"
}
```

**Error Responses**:

- `400 Bad Request`: Invalid rating value

```json
{
  "error": {
    "code": "INVALID_RATING",
    "message": "Rating must be 1 (thumbs up) or -1 (thumbs down)"
  }
}
```

- `401 Unauthorized`: User not authenticated
- `404 Not Found`: Song not found

```json
{
  "error": {
    "code": "SONG_NOT_FOUND",
    "message": "Song not found"
  }
}
```

---

#### Submit AI Suggestion Feedback

Submit user ratings for multiple AI-generated song suggestions in a single batch operation. Typically called when the user dismisses the suggestion modal.

- **HTTP Method**: `PATCH`
- **URL Path**: `/api/feedback/ai-suggestions/:feedbackId`
- **Authentication**: Required
- **Path Parameters**:
  - `feedbackId` (uuid): ID of the feedback record created when suggestions were generated

**Request Payload**:

```json
{
  "suggestions": [
    {
      "title": "Piano Sonata No. 14",
      "composer": "Ludwig van Beethoven",
      "user_rating": 1
    },
    {
      "title": "Nocturne Op. 9 No. 2",
      "composer": "Frédéric Chopin",
      "user_rating": -1
    },
    {
      "title": "Clair de Lune",
      "composer": "Claude Debussy",
      "user_rating": null
    }
  ]
}
```

**Validation**:

- `suggestions`: Array of suggestion objects (must match the original suggestions structure)
- Each suggestion object must contain:
  - `title`: The song title (string)
  - `composer`: The composer name (string)
  - `user_rating`: Must be `1` (thumbs up), `-1` (thumbs down), or `null` (unrated)
- The suggestions array must match the original suggestions exactly (same titles, composers, and order)

**Business Logic**:

1. Validate that the received suggestions match the original suggestions stored in the feedback record
2. Update the suggestions JSONB array with the new user_rating values
3. Recalculate and update rating_score (sum of all non-null user ratings)
4. Return the updated feedback record

**Response Payload** (200 OK):

```json
{
  "id": "uuid",
  "rating_score": 0,
  "updated_at": "2025-10-22T11:20:00Z"
}
```

**Error Responses**:

- `400 Bad Request`: Invalid suggestions array or mismatch with original suggestions

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Invalid suggestions format, mismatch with original suggestions, or invalid rating values"
  }
}
```

- `401 Unauthorized`: User not authenticated
- `403 Forbidden`: User doesn't own this feedback record

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You can only rate your own suggestions"
  }
}
```

- `404 Not Found`: Feedback record not found

```json
{
  "error": {
    "code": "FEEDBACK_NOT_FOUND",
    "message": "Feedback record not found"
  }
}
```

---

## 5. Validation and Business Logic

### 5.1 Input Validation Rules

#### Song Upload (`POST /api/songs`)

- **File format**: Must be `.xml` or `.musicxml` extension
- **File size**: Maximum 10MB
- **MusicXML validity**: Must be valid, parseable MusicXML
- **Composer field**: Truncate to 200 characters if longer
- **Title field**: Truncate to 200 characters if longer
- **File hash**: Must be calculated and checked for uniqueness

#### Profile Update (`PATCH /api/profiles/me`)

- **has_completed_onboarding**: Must be boolean, cannot be null

#### Rendering Feedback (`POST /api/feedback/rendering`)

- **rating**: Must be integer `1` or `-1` only
- **song_id**: Must be valid UUID and exist in database

#### AI Suggestion Feedback (`PATCH /api/feedback/ai-suggestions/:feedbackId`)

- **rating**: Must be integer `1` or `-1` only
- **suggestion_index**: Must be non-negative integer within bounds of suggestions array

#### Pagination Parameters (all list endpoints)

- **page**: Must be positive integer, default 1
- **limit**: Must be positive integer, max 100, default 50
- **sort**: Must be from allowed field list for that resource
- **order**: Must be "asc" or "desc"

### 5.2 Business Logic Implementation

#### Duplicate Song Prevention

**Endpoint**: `POST /api/songs`

**Logic**:

1. Calculate MD5 hash of uploaded file content
2. Query `songs` table for existing record with same `file_hash`
3. If exists add to user's library, return 200 OK
4. If not exists:
   - Parse MusicXML for metadata
   - Upload to Supabase Storage
   - Create song record
   - Add to user's library
   - Return 201 Created

#### Onboarding Status Tracking

**Endpoints**: `GET /api/profiles/me`, `PATCH /api/profiles/me`

**Logic**:

- Profile is automatically created when user registers (via database trigger or application logic)
- `has_completed_onboarding` defaults to `false`
- Frontend checks this flag to determine whether to show onboarding modal
- User action triggers `PATCH /api/profiles/me` to set flag to `true`

#### Public vs. Private Songs

**Endpoints**: `GET /api/songs/public`, `GET /api/user-songs`

**Logic**:

- Songs with `uploader_id IS NULL` are public domain songs
- `GET /api/songs/public` filters for `uploader_id IS NULL`
- RLS policies ensure users can only see:
  - Public songs (uploader_id IS NULL)
  - Songs in their personal library (exists in user_songs)

#### AI Suggestion Feedback Aggregation

**Endpoint**: `PATCH /api/feedback/ai-suggestions/:feedbackId`

**Logic**:

1. Locate the suggestion at specified index in the `suggestions` JSONB array
2. Update the `user_rating` field for that suggestion
3. Calculate sum of all `user_rating` values across all suggestions
4. Update `rating_score` field with the calculated sum
5. This allows quick analytics: positive score = more thumbs up than down

#### MusicXML Metadata Parsing

**Endpoint**: `POST /api/songs`

**Logic**:

1. Parse uploaded XML file
2. Extract `<work-title>` or `<movement-title>` for title
3. Extract `<creator type="composer">` for composer
4. Handle missing fields with defaults (e.g., "Unknown")
5. Truncate both fields to 200 characters maximum
6. Store in database

### 5.3 Row Level Security (RLS) Enforcement

All database operations respect Supabase Row Level Security policies:

#### Profiles

- Users can only read/update their own profile (`auth.uid() = id`)

#### Songs

- All users (authenticated and unauthenticated) can view public songs (`uploader_id IS NULL`)
- Authenticated users can view songs in their personal library
- Authenticated users can insert new songs

#### User Songs

- Users can only manage their own library entries (`auth.uid() = user_id`)

#### Feedback Tables

- Users can only insert feedback records with their own user_id
- No read, update, or delete permissions (insert-only for privacy)

### 5.4 Error Handling Standards

All endpoints follow consistent error response format:

```json
{
  "error": {
    "code": "ERROR_CODE_CONSTANT",
    "message": "User-friendly error message"
  }
}
```

**Common Error Codes**:

- `UNAUTHORIZED`: Missing or invalid authentication
- `FORBIDDEN`: Insufficient permissions
- `NOT_FOUND`: Resource doesn't exist
- `INVALID_REQUEST`: Validation failure
- `SERVICE_UNAVAILABLE`: External service failure
- `INTERNAL_ERROR`: Unexpected server error

### 5.5 Performance Considerations

#### Caching Strategy

- Public songs list can be cached client-side (rarely changes)
- User library should be re-fetched after mutations
- Song metadata and signed URLs should have short TTL (1 hour)

#### Rate Limiting

- AI suggestions endpoint: 10 requests per minute per user
- Upload endpoint: 5 requests per minute per user
- All other endpoints: 100 requests per minute per user

#### File Storage

- MusicXML files stored in Supabase Storage with content-addressable naming (file_hash)
- Signed URLs with 1-hour expiration for secure, temporary access
- CDN-backed delivery for optimal performance

#### Database Optimization

- Leverage existing indexes on foreign keys and file_hash
- Pagination on all list endpoints to prevent large result sets
- Use database-level aggregations for analytics queries

---

## 6. API Versioning

The initial release uses unversioned endpoints (implicit v1). Future breaking changes will introduce versioned endpoints:

- Current: `/api/songs`
- Future: `/api/v2/songs`

Non-breaking changes (new optional fields, new endpoints) will be added to existing endpoints.

---

## 7. CORS Configuration

The API must allow requests from the Angular frontend application:

- **Development**: `http://localhost:4200`
- **Production**: Application's production domain (DigitalOcean deployment)

Allowed methods: `GET`, `POST`, `PATCH`, `DELETE`, `OPTIONS`

Allowed headers: `Authorization`, `Content-Type`

---

## 8. Implementation Notes

### Supabase Integration

- Use Supabase client SDK (JavaScript/TypeScript) for database operations
- Leverage Supabase Auth for JWT validation and session management
- Use Supabase Storage SDK for file operations
- RLS policies handle authorization automatically
- Use Supabase Edge Functions for server-side operations requiring private keys

### Direct Client Operations

Most application features use direct Supabase SDK calls from Angular:

- **Profile Management**: `supabase.from('profiles')` queries
- **Song Upload**: Direct database inserts and file uploads to Supabase Storage
- **Library Management**: `user_songs` table operations with RLS
- **Feedback Submission**: Direct inserts to feedback tables

### Server-Side Operations (Edge Functions)

External API integrations requiring private keys use Supabase Edge Functions:

- **AI Suggestions**: `ai-suggestions` Edge Function calls OpenRouter.ai securely
- Private API keys stored in Supabase secrets (not client-side)
- Functions run on Supabase infrastructure with proper security isolation

### AI Integration

- OpenRouter.ai integration via Supabase Edge Functions (server-side)
- Implement timeout (3 seconds) and retry logic in Edge Function
- Error handling for rate limits and service outages
- API keys stored securely in Supabase Edge Function secrets
- Consider prompt engineering for optimal suggestion quality

### File Processing

- Use OSMD or similar library for MusicXML parsing
- Use crypto library for MD5 hash generation
- Stream large file uploads to avoid memory issues
- Validate XML structure before processing
