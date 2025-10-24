# API Endpoint Implementation Plan: Get Song Details and MusicXML File Access

## 1. Endpoint Overview

This endpoint retrieves detailed information about a specific song and provides secure access to the MusicXML file for rendering. The endpoint serves as the primary mechanism for displaying song metadata and enabling sheet music rendering in the frontend application. It combines song metadata retrieval with secure file access through signed URLs, ensuring users can only access songs they have permission to view (either their own uploads or public domain songs in their library).

**Primary responsibilities:**

- Retrieve song metadata from the database with access control
- Generate secure signed URLs for MusicXML file download
- Validate user permissions for song access
- Handle both user-uploaded and public domain songs
- Provide consistent song information for rendering

## 2. Request Details

- **HTTP Method**: `GET`
- **URL Structure**: `/api/songs/:songId`
- **Authentication**: Required (JWT via Supabase Auth)
- **Query Parameters**: None

### Parameters

#### Path Parameters:

- `songId` (string, required): UUID of the song to retrieve

#### Request Body Structure

No request body for GET operations.

## 3. Used Types

### From `src/types.ts`:

#### Response Types

```typescript
export interface SongAccessDto {
  id: SongRow['id'];
  song_details: SongDetailsDto;
  file_hash: SongRow['file_hash'];
  created_at: SongRow['created_at'];
  musicxml_url: string;
}

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
// - FORBIDDEN
// - SONG_NOT_FOUND
// - INTERNAL_ERROR
```

### Database Types (from generated types)

```typescript
Tables<'songs'>; // For querying song data
Tables<'user_songs'>; // For checking user library access
```

## 4. Response Details

### Success Response

#### 200 OK

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "song_details": {
    "composer": "Ludwig van Beethoven",
    "title": "Moonlight Sonata"
  },
  "file_hash": "5d41402abc4b2a76b9719d911017c592",
  "created_at": "2025-10-15T08:20:00.000Z",
  "musicxml_url": "https://supabase-storage-url/signed-url-with-expiry"
}
```

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

#### 403 Forbidden

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have access to this song"
  }
}
```

#### 404 Not Found

```json
{
  "error": {
    "code": "SONG_NOT_FOUND",
    "message": "Song not found"
  }
}
```

#### 500 Internal Server Error

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred while retrieving song"
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
Query Song with Access Check
    ↓
┌─────────────────┴─────────────────┐
│ Song Exists & User Has Access?    │
├───────────────┬───────────────────┤
│ YES           │ NO                │
│               │                   │
│ Generate      │ Check if song     │
│ Signed URL    │ exists at all     │
│               │                   │
│ Return Song   │ ┌─────┴─────┐     │
│ Data + URL    │ │ YES       │     │
│ (200 OK)      │ │           │     │
│               │ │ 403       │     │
│               │ │ Forbidden │     │
│               │ │           │     │
│               │ │ NO        │     │
│               │ │           │     │
│               │ │ 404 Not   │     │
│               │ │ Found     │     │
│               │ └───────────┘     │
└───────────────┴───────────────────┘
    ↓
Return SongAccessDto
```

### Detailed Step-by-Step Flow

1. **Request Initiation**
   - Angular component/service initiates song retrieval
   - Calls `SongService.getSongDetails(songId)`
   - Service validates UUID format of songId

2. **Authentication Check**
   - Use `supabase.auth.getUser()` to get authenticated user
   - Supabase SDK automatically handles JWT token validation
   - Extract user ID from auth context
   - Handle authentication errors if user is not authenticated

3. **Song Access Verification**
   - Perform complex query to check song existence and user access
   - Query joins `songs` and `user_songs` tables
   - Check conditions:
     - Song exists in `songs` table
     - User has song in their library (`user_songs` table) OR
     - Song is public domain (`uploader_id IS NULL`)

4. **Access Control Logic**
   - **Song doesn't exist**: Return 404 SONG_NOT_FOUND
   - **Song exists but user has no access**: Return 403 FORBIDDEN
   - **Song exists and user has access**: Proceed to URL generation

5. **Signed URL Generation**
   - Generate signed URL for MusicXML file in Supabase Storage
   - Use song's `file_hash` as filename with `.musicxml` extension
   - Set appropriate expiration time (1 hour recommended)
   - Include proper content type and download headers

6. **Response Construction**
   - Build `SongAccessDto` with song metadata and signed URL
   - Return JSON response with 200 OK status
   - Ensure all data is properly formatted

## 6. Security Considerations

### Authentication & Authorization

1. **JWT Token Validation**
   - Mandatory authentication for all song access requests
   - Validate token integrity and prevent unauthorized access
   - Extract user identity for access control decisions

2. **Row-Level Security (RLS)**
   - Database policies control song access based on ownership
   - RLS policy allows access to:
     - Public songs (`uploader_id IS NULL`)
     - Songs in user's personal library
   - Automatic enforcement prevents unauthorized song access

### Access Control

1. **Song Ownership Verification**
   - Complex query ensures proper access control
   - Check both direct ownership and public domain status
   - Prevent access to private songs not in user's library

2. **File Access Security**
   - Signed URLs provide temporary, secure file access
   - URLs expire automatically to prevent long-term access
   - No direct storage bucket access allowed

### Input Validation

1. **Path Parameter Validation**
   - Validate `songId` is valid UUID format
   - Reject malformed or invalid song identifiers
   - Prevent injection attacks through parameter validation

## 7. Error Handling

### Error Scenarios

| Scenario                   | HTTP Code | Error Code      | Handling Strategy                       |
| -------------------------- | --------- | --------------- | --------------------------------------- |
| Missing authentication     | 401       | UNAUTHORIZED    | Check Authorization header              |
| Invalid/expired token      | 401       | UNAUTHORIZED    | Validate with Supabase Auth             |
| Invalid songId format      | 400       | INVALID_REQUEST | Validate UUID format                    |
| Song not found             | 404       | SONG_NOT_FOUND  | Query returns no matching song          |
| No access permission       | 403       | FORBIDDEN       | User not in library and song not public |
| Signed URL generation fail | 500       | INTERNAL_ERROR  | Handle Supabase Storage errors          |
| Database query error       | 500       | INTERNAL_ERROR  | Handle Supabase client failures         |

### Error Handling Pattern

Implement structured error handling for different failure scenarios:

1. **Authentication Errors**: Detect token issues and return 401
2. **Validation Errors**: Check parameter formats and return 400
3. **Authorization Errors**: Handle access control failures with 403
4. **Not Found Errors**: Detect missing songs and return 404
5. **Service Errors**: Handle storage and database failures with 500

### Logging Strategy

1. **Error Logging**
   - Log access control violations (403 errors) for security monitoring
   - Log storage URL generation failures
   - Include user ID and song ID in error logs

2. **Audit Logging**
   - Log successful song access for analytics
   - Track which songs are accessed most frequently
   - Monitor signed URL generation patterns

## 8. Implementation Steps

### Phase 1: Infrastructure Setup

1. **Extend Supabase Service**
   - File: `src/app/services/supabase.service.ts`
   - Add song access methods:
     - `getSongWithAccessCheck(songId: string, userId: string): Promise<SongRow & { hasAccess: boolean } | null>`
     - `generateMusicXMLSignedUrl(fileHash: string): Promise<string>`

2. **Create Song Service**
   - File: `src/app/services/song.service.ts`
   - Methods:
     - `getSongDetails(songId: string): Promise<SongAccessDto>`
     - Handle access control and URL generation

3. **Add UUID Validation**
   - Add utility function for UUID format validation
   - Include in request validation pipeline

### Phase 2: Direct Supabase SDK Implementation

4. **Implement Song Retrieval in Angular Component/Service**
   - Use Supabase client directly from Angular service
   - Call `supabase.auth.getUser()` to get authenticated user
   - Query using `supabase.from('songs')` with access control

5. **Implement Access Control Logic**
   - Query database with proper RLS policies via Supabase SDK
   - Handle different access scenarios (public vs private songs)
   - Handle errors appropriately

6. **Implement Signed URL Generation**
   - Generate signed URLs using `supabase.storage.from().createSignedUrl()`
   - Configure appropriate expiration and access controls
   - Handle storage service errors gracefully

### Phase 3: Error Handling & Testing

7. **Implement Comprehensive Error Handling**
   - Add error handling for all operation stages
   - Map errors to appropriate HTTP responses
   - Ensure consistent error response format

8. **Add Logging**
   - Log basic flow to console
   - Configure appropriate log levels
