# API Endpoint Implementation Plan: Add Song to User's Library

## 1. Endpoint Overview

This endpoint enables authenticated users to add existing songs (typically from the public domain catalog) to their personal library. The endpoint creates an association between the user and the song in the user_songs table, allowing users to build their personal collection from available public domain music. It includes duplicate prevention to avoid adding the same song multiple times to a user's library.

**Primary responsibilities:**

- Create association between authenticated user and existing song
- Validate that the song exists and is accessible to the user
- Prevent duplicate additions to the same user's library
- Return confirmation of successful library addition
- Handle both public domain and user-accessible private songs

## 2. Request Details

- **HTTP Method**: `POST`
- **URL Structure**: `/api/user-songs`
- **Authentication**: Required (JWT via Supabase Auth)
- **Content-Type**: `application/json`

### Parameters

#### Optional:

- None (operation applies to current authenticated user)

#### Request Body Structure

```json
{
  "song_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

## 3. Used Types

### From `src/types.ts`:

#### Request Types

```typescript
export type AddUserSongCommand = Pick<TablesInsert<'user_songs'>, 'song_id'>;
```

#### Response Types

```typescript
export type AddUserSongResponseDto = Pick<UserSongRow, 'user_id' | 'song_id' | 'created_at'> & {
  song_details: SongDetailsDto;
};

export type SongDetailsDto = Pick<SongRow, 'title' | 'composer'>;
```

#### Error Types

```typescript
export interface ErrorResponseDto {
  error: {
    code: ErrorCode;
    message: string;
  };
}

// Relevant error codes:
// - UNAUTHORIZED
// - INVALID_REQUEST
// - SONG_NOT_FOUND
// - SONG_ALREADY_IN_LIBRARY
// - INTERNAL_ERROR
```

### Database Types (from generated types)

```typescript
TablesInsert<'user_songs'>; // For creating library associations
Tables<'songs'>; // For validating song existence
Tables<'user_songs'>; // For checking existing associations
```

## 4. Response Details

### Success Response

#### 201 Created

```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440001",
  "song_id": "550e8400-e29b-41d4-a716-446655440000",
  "created_at": "2025-10-22T11:00:00.000Z",
  "song_details": {
    "composer": "Wolfgang Amadeus Mozart",
    "title": "Eine kleine Nachtmusik"
  }
}
```

### Error Responses

#### 400 Bad Request

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "song_id is required and must be a valid UUID"
  }
}
```

#### 401 Unauthorized

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

#### 404 Not Found

```json
{
  "error": {
    "code": "SONG_NOT_FOUND",
    "message": "Song not found or not accessible"
  }
}
```

#### 409 Conflict

```json
{
  "error": {
    "code": "SONG_ALREADY_IN_LIBRARY",
    "message": "This song is already in your library"
  }
}
```

#### 500 Internal Server Error

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred while adding song to library"
  }
}
```

## 5. Data Flow

### High-Level Flow

```
Client Request → Authentication Middleware
    ↓
JWT Token Validation (Supabase Auth)
    ↓
Extract User ID + Request Body
    ↓
Validate Request Payload
    ↓
┌─────────────────┴─────────────────┐
│ Payload Valid?                   │
├───────────────┬───────────────────┤
│ YES           │ NO                │
│               │                   │
│ Check Song    │ Return 400        │
│ Existence &   │ Bad Request       │
│ Accessibility │                   │
│               │                   │
│ Song Exists   │                   │
│ & Accessible? ├───────────────────┤
│ ┌─────┴─────┐ │                   │
│ │ YES       │ │                   │
│ │           │ │                   │
│ │ Check if  │ │                   │
│ │ Already in │ │                   │
│ │ Library    │ │                   │
│ │           │ │                   │
│ │ ┌─────┴─────┐ │                   │
│ │ │ YES       │ │                   │
│ │ │           │ │                   │
│ │ │ 409       │ │                   │
│ │ │ Conflict  │ │                   │
│ │ │           │ │                   │
│ │ │ NO        │ │                   │
│ │ │           │ │                   │
│ │ │ Create    │ │                   │
│ │ │ Library   │ │                   │
│ │ │ Entry     │ │                   │
│ │ │ (201)     │ │                   │
│ │ └───────────┘ │                   │
│ └─────────────┴───────────────────┘
│               │
│ NO            │
│               │
│ 404 Not Found │
└───────────────┴───────────────────┘
    ↓
Return AddUserSongResponseDto
```

### Detailed Step-by-Step Flow

1. **Request Reception**
   - API route receives POST request to `/api/user-songs`
   - Parse JSON request body for song_id

2. **Authentication Check**
   - Extract JWT token from `Authorization: Bearer <token>` header
   - Validate token with Supabase Auth service
   - Extract user ID from authenticated token context
   - Return 401 if authentication fails

3. **Request Validation**
   - Validate request body is valid JSON
   - Check that `song_id` is present and is valid UUID format
   - Return 400 for validation failures

4. **Song Existence and Access Check**
   - Query database to verify song exists
   - Check if user has access (public song or in their library)
   - Return 404 if song doesn't exist or isn't accessible

5. **Duplicate Library Check**
   - Query `user_songs` table for existing association
   - Check if authenticated user already has this song
   - Return 409 if song is already in user's library

6. **Create Library Association**
   - Insert new record into `user_songs` table
   - Link user_id and song_id with current timestamp
   - Handle potential race conditions with database constraints

7. **Retrieve Complete Data**
   - Query song metadata for response
   - Combine library association with song details
   - Ensure all required fields are populated

8. **Response Construction**
   - Build `AddUserSongResponseDto` with all required data
   - Return JSON response with 201 Created status
   - Include song details and association metadata

## 6. Security Considerations

### Authentication & Authorization

1. **JWT Token Validation**
   - Mandatory authentication for all library modification requests
   - Validate token integrity and prevent unauthorized additions
   - Extract user identity for library association

2. **Row-Level Security (RLS)**
   - Database policies control access to song addition
   - RLS ensures users can only add accessible songs
   - Automatic enforcement prevents unauthorized song access

### Input Validation

1. **Request Body Validation**
   - Validate Content-Type is `application/json`
   - Ensure request body contains required `song_id` field
   - Validate UUID format for song_id parameter
   - Prevent injection attacks through proper validation

2. **Song Access Validation**
   - Verify song exists in database
   - Check user has permission to access the song
   - Prevent adding inaccessible songs to library

### Data Integrity

1. **Duplicate Prevention**
   - Check for existing user-song associations
   - Use database constraints to prevent race conditions
   - Return appropriate conflict errors

2. **Atomic Operations**
   - Use database transactions for consistency
   - Ensure validation and insertion happen atomically
   - Rollback on any failure to maintain data integrity

## 7. Error Handling

### Error Scenarios

| Scenario                | HTTP Code | Error Code              | Handling Strategy                  |
| ----------------------- | --------- | ----------------------- | ---------------------------------- |
| Missing authentication  | 401       | UNAUTHORIZED            | Check Authorization header         |
| Invalid/expired token   | 401       | UNAUTHORIZED            | Validate with Supabase Auth        |
| Invalid JSON body       | 400       | INVALID_REQUEST         | Parse JSON and catch syntax errors |
| Missing song_id         | 400       | INVALID_REQUEST         | Validate required fields           |
| Invalid song_id format  | 400       | INVALID_REQUEST         | Validate UUID format               |
| Song not found          | 404       | SONG_NOT_FOUND          | Query returns no song              |
| No access to song       | 404       | SONG_NOT_FOUND          | User cannot access private song    |
| Song already in library | 409       | SONG_ALREADY_IN_LIBRARY | Existing user_songs record found   |
| Database insert error   | 500       | INTERNAL_ERROR          | Handle Supabase insert failures    |

### Error Handling Pattern

Implement comprehensive error handling with proper error classification:

1. **Authentication Errors**: Detect Supabase Auth failures and return 401
2. **Validation Errors**: Check request format and field validation, return 400
3. **Not Found Errors**: Handle missing or inaccessible songs with 404
4. **Conflict Errors**: Detect existing library associations and return 409
5. **Database Errors**: Catch Supabase operation failures and return 500

### Logging Strategy

1. **Error Logging**
   - Log validation failures with request details
   - Log access control violations for security monitoring
   - Include user ID and song ID in error logs

2. **Audit Logging**
   - Log successful song additions to library
   - Track library growth and popular songs
   - Monitor addition frequency and patterns

## 8. Implementation Steps

### Phase 1: Infrastructure Setup

1. **Extend Supabase Service**
   - File: `src/app/services/supabase.service.ts`
   - Add library management methods:
     - `checkSongAccessible(songId: string, userId: string): Promise<boolean>`
     - `addSongToUserLibrary(userId: string, songId: string): Promise<UserSongRow>`

2. **Create User Library Service**
   - File: `src/app/services/user-library.service.ts`
   - Add song addition method:
     - `addSongToLibrary(songId: string): Promise<AddUserSongResponseDto>`
   - Include validation and access control

3. **Add UUID Validation**
   - Implement UUID format validation utility
   - Add to request validation pipeline

### Phase 2: API Route Implementation

4. **Create API Route Handler**
   - File: `src/app/api/user-songs/route.ts` (or appropriate Angular routing structure)
   - Implement POST handler with authentication
   - Add request body parsing and validation

5. **Implement Request Validation**
   - Validate JSON request body structure
   - Check song_id presence and UUID format
   - Return appropriate 400 errors for invalid requests

6. **Implement Access Control Logic**
   - Check song existence and user accessibility
   - Prevent adding inaccessible songs
   - Handle different song types (public vs private)

### Phase 3: Error Handling & Testing

7. **Implement Comprehensive Error Handling**
   - Add error handling for all operation stages
   - Map errors to appropriate HTTP responses
   - Ensure consistent error response format

8. **Add Logging**
   - Implement security logging for access control
   - Add audit logging for library additions
   - Configure appropriate log levels

9. **Add Unit Tests**
   - Test successful song addition
   - Test validation error scenarios
   - Test access control (404 responses)
   - Test duplicate prevention (409 responses)
