# API Endpoint Implementation Plan: Remove Song from User's Library

## 1. Endpoint Overview

This endpoint enables authenticated users to remove songs from their personal library. The endpoint deletes the association between the user and the song in the user_songs table, effectively removing the song from their collection while preserving the song record itself. It includes proper validation to ensure users can only remove songs that exist in their own library.

**Primary responsibilities:**

- Remove association between authenticated user and specified song
- Validate that the song exists in the user's library before removal
- Ensure users can only modify their own library entries
- Provide clean deletion with proper error handling
- Handle edge cases like song not being in library

## 2. Request Details

- **HTTP Method**: `DELETE`
- **URL Structure**: `/api/user-songs/:songId`
- **Authentication**: Required (JWT via Supabase Auth)
- **Query Parameters**: None

### Parameters

#### Path Parameters:

- `songId` (string, required): UUID of the song to remove from library

#### Request Body Structure

No request body for DELETE operations.

## 3. Used Types

### From `src/types.ts`:

#### Request Types

```typescript
export interface RemoveUserSongCommand {
  songId: SongRow['id'];
}
```

#### Response Types

No response body for successful deletions (204 No Content).

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
// - SONG_NOT_IN_LIBRARY
// - INTERNAL_ERROR
```

### Database Types (from generated types)

```typescript
Tables<'user_songs'>; // For deleting library associations
```

## 4. Response Details

### Success Response

#### 204 No Content

No response body

### Error Responses

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
    "code": "SONG_NOT_IN_LIBRARY",
    "message": "Song not found in your library"
  }
}
```

#### 500 Internal Server Error

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred while removing song from library"
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
Extract User ID + Song ID
    ↓
Validate Song ID Format
    ↓
┌─────────────────┴─────────────────┐
│ Song ID Valid?                   │
├───────────────┬───────────────────┤
│ YES           │ NO                │
│               │                   │
│ Check Song    │ Return 400        │
│ in User       │ Bad Request       │
│ Library       │                   │
│               │                   │
│ Song in       │                   │
│ Library?      ├───────────────────┤
│ ┌─────┴─────┐ │                   │
│ │ YES       │ │                   │
│ │           │ │                   │
│ │ Delete     │ │                   │
│ │ Library    │ │                   │
│ │ Entry      │ │                   │
│ │            │ │                   │
│ │ Return 204 │ │                   │
│ │ No Content │ │                   │
│ │            │ │                   │
│ │ NO         │ │                   │
│ │            │ │                   │
│ │ 404 Not    │ │                   │
│ │ Found      │ │                   │
│ └───────────┴───────────────────┘ │
└───────────────┴───────────────────┘
```

### Detailed Step-by-Step Flow

1. **Request Initiation**
   - Angular component/service initiates remove from library
   - Calls `UserLibraryService.removeSongFromLibrary(songId)`
   - Service validates songId parameter

2. **Authentication Check**
   - Use `supabase.auth.getUser()` to get authenticated user
   - Supabase SDK automatically handles JWT token validation
   - Extract user ID from auth context
   - Handle authentication errors if user is not authenticated

3. **Parameter Validation**
   - Validate `songId` is present and valid UUID format
   - Return 400 for invalid song ID format

4. **Library Membership Check**
   - Query `user_songs` table for existing association
   - Verify that authenticated user has this song in their library
   - Return 404 if song is not in user's library

5. **Delete Library Association**
   - Execute DELETE query on `user_songs` table
   - Use user_id and song_id for precise targeting
   - Handle potential race conditions gracefully

6. **Response Construction**
   - Return 204 No Content for successful deletion
   - No response body required for successful operations

## 6. Security Considerations

### Authentication & Authorization

1. **JWT Token Validation**
   - Mandatory authentication for all library modification requests
   - Validate token integrity and prevent unauthorized deletions
   - Extract user identity for library access control

2. **Row-Level Security (RLS)**
   - Database policies restrict deletion to user's own library entries
   - RLS policy: `auth.uid() = user_id` for user_songs table
   - Automatic enforcement prevents cross-user library modification

### Input Validation

1. **Path Parameter Validation**
   - Validate `songId` is valid UUID format
   - Reject malformed or invalid song identifiers
   - Prevent injection attacks through parameter validation

2. **Library Ownership Validation**
   - Verify song exists in user's library before deletion
   - Prevent deletion of songs not owned by the user
   - Return appropriate 404 errors for missing associations

### Data Integrity

1. **Safe Deletion**
   - Only delete existing associations
   - Preserve song records and other users' library entries
   - Use precise WHERE clauses to prevent accidental deletions

2. **Atomic Operations**
   - Single DELETE operation for consistency
   - No complex transactions required for single record deletion
   - Database constraints prevent invalid deletions

## 7. Error Handling

### Error Scenarios

| Scenario               | HTTP Code | Error Code          | Handling Strategy                |
| ---------------------- | --------- | ------------------- | -------------------------------- |
| Missing authentication | 401       | UNAUTHORIZED        | Check Authorization header       |
| Invalid/expired token  | 401       | UNAUTHORIZED        | Validate with Supabase Auth      |
| Invalid songId format  | 400       | INVALID_REQUEST     | Validate UUID format             |
| Song not in library    | 404       | SONG_NOT_IN_LIBRARY | Query returns no matching record |
| Database delete error  | 500       | INTERNAL_ERROR      | Handle Supabase delete failures  |

### Error Handling Pattern

Implement structured error handling for library removal operations:

1. **Authentication Errors**: Detect token issues and return 401
2. **Validation Errors**: Check parameter formats and return 400
3. **Not Found Errors**: Handle missing library associations with 404
4. **Database Errors**: Catch Supabase operation failures with 500

### Logging Strategy

1. **Error Logging**
   - Log parameter validation failures
   - Log deletion attempts for non-existent library entries
   - Include user ID and song ID in error logs

2. **Audit Logging**
   - Log successful song removals from library
   - Track library size changes and removal patterns
   - Monitor removal frequency and popular removals

## 8. Implementation Steps

### Phase 1: Infrastructure Setup

1. **Extend Supabase Service**
   - File: `src/app/services/supabase.service.ts`
   - Add library removal methods:
     - `removeSongFromUserLibrary(userId: string, songId: string): Promise<void>`

2. **Create User Library Service**
   - File: `src/app/services/user-library.service.ts`
   - Add song removal method:
     - `removeSongFromLibrary(songId: string): Promise<void>`
   - Include validation and access control

3. **Add UUID Validation**
   - Implement UUID format validation utility
   - Add to path parameter validation

### Phase 2: Direct Supabase SDK Implementation

4. **Implement Remove from Library in Angular Component/Service**
   - Use Supabase client directly from Angular service
   - Call `supabase.auth.getUser()` to get authenticated user
   - Delete using `supabase.from('user_songs').delete()`

5. **Implement Library Check Logic**
   - Query user_songs table via Supabase SDK to verify association
   - Handle case where song is not in user's library
   - Prevent deletion of non-existent associations

6. **Implement Deletion Logic**
   - Execute DELETE with proper WHERE conditions via Supabase SDK
   - RLS policies ensure only user's own entries can be deleted
   - Handle database constraints and errors

### Phase 3: Error Handling & Testing

7. **Implement Comprehensive Error Handling**
   - Add error handling for all operation stages
   - Map errors to appropriate HTTP responses
   - Ensure consistent error response format

8. **Add Logging**
   - Log basic flow to console
   - Configure appropriate log levels
