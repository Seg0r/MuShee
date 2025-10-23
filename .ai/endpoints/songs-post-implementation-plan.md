# API Endpoint Implementation Plan: Upload Song

## 1. Endpoint Overview

This endpoint enables authenticated users to upload MusicXML files to the MuShee platform. The endpoint implements intelligent duplicate detection using MD5 file hashing, automatic metadata extraction from MusicXML content, secure file storage in Supabase, and automatic addition to the user's personal library. It handles both new uploads (201 Created) and duplicate scenarios (200 OK) gracefully.

**Primary responsibilities:**

- Accept and validate MusicXML file uploads
- Calculate MD5 hash for content-based deduplication
- Parse composer and title from MusicXML structure
- Store files in Supabase Storage with hash-based naming
- Manage database records in both `songs` and `user_songs` tables
- Provide appropriate responses based on creation vs. duplication

## 2. Request Details

- **HTTP Method**: `POST`
- **URL Structure**: `/api/songs`
- **Authentication**: Required (JWT via Supabase Auth)
- **Content-Type**: `multipart/form-data`

### Parameters

#### Required:

- `file` (FormData field): MusicXML file with `.xml` or `.musicxml` extension
  - Maximum size: 10MB
  - Must be valid MusicXML format
  - Should contain `<work-title>` and `<creator type="composer">` elements

#### Optional:

- None

### Request Body Structure

```
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary...

------WebKitFormBoundary...
Content-Disposition: form-data; name="file"; filename="moonlight_sonata.musicxml"
Content-Type: application/xml

[MusicXML file content]
------WebKitFormBoundary...--
```

## 3. Used Types

### From `src/types.ts`:

#### Request Types

```typescript
export interface UploadSongCommand {
  file: File | Blob;
}
```

#### Response Types

```typescript
export interface UploadSongResponseDto {
  id: SongRow['id'];
  song_details: SongDetailsDto;
  file_hash: SongRow['file_hash'];
  created_at: SongRow['created_at'];
  added_to_library_at: UserSongRow['created_at'];
  is_duplicate?: boolean;
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
// - INVALID_FILE_FORMAT
// - INVALID_MUSICXML
// - FILE_TOO_LARGE
// - SONG_ALREADY_IN_LIBRARY
// - UNAUTHORIZED
// - INTERNAL_ERROR
```

### Database Types (from generated types)

```typescript
TablesInsert<'songs'>; // For creating song records
TablesInsert<'user_songs'>; // For library associations
Tables<'songs'>; // For querying existing songs
```

## 4. Response Details

### Success Responses

#### 201 Created - New Song Uploaded

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "song_details": {
    "composer": "Ludwig van Beethoven",
    "title": "Moonlight Sonata"
  },
  "file_hash": "5d41402abc4b2a76b9719d911017c592",
  "created_at": "2025-10-22T10:40:00.000Z",
  "added_to_library_at": "2025-10-22T10:40:00.000Z"
}
```

#### 200 OK - Duplicate Song Added to Library

```json
{
  "id": "existing-song-uuid",
  "song_details": {
    "composer": "Ludwig van Beethoven",
    "title": "Moonlight Sonata"
  },
  "file_hash": "5d41402abc4b2a76b9719d911017c592",
  "created_at": "2025-10-15T08:20:00.000Z",
  "added_to_library_at": "2025-10-22T10:40:00.000Z",
  "is_duplicate": true
}
```

### Error Responses

#### 400 Bad Request - Invalid File Format

```json
{
  "error": {
    "code": "INVALID_FILE_FORMAT",
    "message": "Only MusicXML files (.xml, .musicxml) are supported"
  }
}
```

#### 400 Bad Request - Invalid MusicXML

```json
{
  "error": {
    "code": "INVALID_MUSICXML",
    "message": "Unable to parse MusicXML file. Please ensure the file is valid."
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

#### 409 Conflict - Already in Library

```json
{
  "error": {
    "code": "SONG_ALREADY_IN_LIBRARY",
    "message": "This song is already in your library"
  }
}
```

#### 413 Payload Too Large

```json
{
  "error": {
    "code": "FILE_TOO_LARGE",
    "message": "File size exceeds maximum allowed size of 10MB"
  }
}
```

#### 500 Internal Server Error

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred while processing your upload"
  }
}
```

## 5. Data Flow

### High-Level Flow

```
User Upload → Angular Component → POST /api/songs
    ↓
Authentication Middleware (verify JWT)
    ↓
File Upload Handler (multipart parsing)
    ↓
Validation Layer (file extension, size, format)
    ↓
MusicXML Parser Service (extract metadata)
    ↓
Hash Calculation (MD5 of file content)
    ↓
Database Check (query songs by file_hash)
    ↓
┌─────────────┴─────────────┐
│ Duplicate Found?          │
├───────────┬───────────────┤
│ YES       │ NO            │
│           │               │
│ Check     │ 1. Upload to  │
│ user_songs│    Supabase   │
│           │    Storage    │
│ If exists:│               │
│ → 409     │ 2. Insert     │
│           │    songs row  │
│ If not:   │               │
│ → Insert  │ 3. Insert     │
│   user_   │    user_songs │
│   songs   │    row        │
│           │               │
│ → 200 OK  │ → 201 Created │
└───────────┴───────────────┘
    ↓
Return Response DTO
```

### Detailed Step-by-Step Flow

1. **Request Reception**
   - Angular HTTP client sends multipart/form-data
   - API route receives request with file field

2. **Authentication**
   - Extract JWT from Authorization header
   - Verify token with Supabase Auth
   - Extract user ID from auth context

3. **File Extraction & Initial Validation**
   - Parse multipart form data
   - Check file presence in request
   - Validate file extension (.xml or .musicxml)
   - Check file size (≤ 10MB)

4. **File Content Processing**
   - Read file buffer into memory
   - Calculate MD5 hash of entire file content
   - Store hash for deduplication check

5. **MusicXML Parsing**
   - Parse XML string using DOMParser or xml2js
   - Extract `<work-title>` element → title
   - Extract `<creator type="composer">` → composer
   - Truncate both fields to 200 characters max
   - Handle missing or malformed elements gracefully

6. **Duplicate Detection**
   - Single query with LEFT JOIN:
     ```sql
     SELECT s.id, s.created_at, us.user_id
     FROM songs s
     LEFT JOIN user_songs us ON s.id = us.song_id AND us.user_id = :userId
     WHERE s.file_hash = :hash
     ```
   - **No rows**: Song doesn't exist → proceed to new song creation
   - **Rows with `us.user_id` populated**: User already has this song → 409 Conflict
   - **Rows with `us.user_id = NULL`**: Song exists but user doesn't have it → add to user's library

7. **Branch: Duplicate Song**
   - If song exists in user's library → 409 Conflict
   - If song exists but not in library:
     - Insert into `user_songs` table
     - Return 200 OK with `is_duplicate: true`

8. **Branch: New Song**
   - Upload file to Supabase Storage:
     - Bucket: `musicxml-files`
     - Path: `{file_hash}.musicxml`
     - Content-Type: `application/xml`
   - Insert into `songs` table:
     - Generate UUID for id
     - Set composer, title, file_hash
     - Set uploader_id to current user ID
   - Insert into `user_songs` table:
     - Link user_id and song_id
   - Return 201 Created

9. **Response Construction**
   - Build `UploadSongResponseDto` with all required fields
   - Set appropriate HTTP status code
   - Return JSON response

## 6. Security Considerations

### Authentication & Authorization

1. **JWT Validation**
   - Verify JWT token on every request
   - Reject unauthenticated requests with 401
   - Extract user context from `auth.uid()`

2. **Row-Level Security (RLS)**
   - Songs table: Users can insert (authenticated role)
   - User_songs table: Users can only manage their own library
   - File access: Enforce storage policies for file retrieval

### Input Validation

1. **File Type Validation**
   - Whitelist only `.xml` and `.musicxml` extensions
   - Validate MIME type (should be `application/xml` or `text/xml`)
   - Use both extension and content-based validation

2. **File Size Limits**
   - Enforce 10MB maximum file size
   - Configure at both API gateway and application level
   - Return 413 Payload Too Large for violations

3. **XML Security**
   - **XXE (XML External Entity) Prevention**:
     - Disable external entity resolution in XML parser
     - Use secure parser configuration (e.g., `{ noent: false, nonet: true }`)
     - Reject files containing `<!DOCTYPE>` or `<!ENTITY>` declarations
   - **Billion Laughs Attack Prevention**:
     - Set maximum entity expansion limits
     - Timeout parsing after reasonable duration (5 seconds)

4. **Data Sanitization**
   - Truncate composer and title to 200 characters
   - Escape special characters before database insertion
   - Use parameterized queries for all database operations

### Storage Security

1. **File Naming**
   - Use MD5 hash as filename (deterministic, no user input)
   - Prevents path traversal attacks
   - Enables automatic deduplication at storage level

2. **Storage Policies**
   - Set bucket policies to restrict direct access
   - Generate signed URLs with expiration for retrieval
   - Ensure uploaded files are not executable

## 7. Error Handling

### Error Scenarios

| Scenario                  | HTTP Code | Error Code              | Handling Strategy                       |
| ------------------------- | --------- | ----------------------- | --------------------------------------- |
| Missing file in request   | 400       | INVALID_REQUEST         | Validate FormData contains 'file' field |
| Invalid file extension    | 400       | INVALID_FILE_FORMAT     | Check extension against whitelist       |
| File too large (>10MB)    | 413       | FILE_TOO_LARGE          | Check Content-Length or file size       |
| Malformed XML             | 400       | INVALID_MUSICXML        | Catch parser exceptions                 |
| Missing metadata elements | 400       | INVALID_MUSICXML        | Validate required XML elements exist    |
| XML parsing timeout       | 400       | INVALID_MUSICXML        | Set parser timeout, handle gracefully   |
| XXE attack attempt        | 400       | INVALID_MUSICXML        | Reject files with suspicious patterns   |
| No authentication token   | 401       | UNAUTHORIZED            | Check Authorization header              |
| Invalid/expired token     | 401       | UNAUTHORIZED            | Validate with Supabase Auth             |
| Song already in library   | 409       | SONG_ALREADY_IN_LIBRARY | Check user_songs before insert          |
| Storage upload failure    | 500       | INTERNAL_ERROR          | Log error, rollback transaction         |
| Database insert failure   | 500       | INTERNAL_ERROR          | Log error, delete uploaded file         |
| Hash collision (unlikely) | 500       | INTERNAL_ERROR          | Log critical error for investigation    |

### Error Handling Pattern

Implement a structured try-catch pattern that handles different error types appropriately:

1. **Validation Phase**: Execute all input validations first (file presence, extension, size). These should throw ValidationError instances that map to 400 Bad Request responses.

2. **Processing Phase**: Read file buffer, calculate MD5 hash, and parse MusicXML metadata. Parsing errors should throw ValidationError with INVALID_MUSICXML code.

3. **Database Operations**: Execute all database queries within a transaction context. Database-related errors should be caught and mapped to appropriate responses.

4. **Error Type Mapping**:
   - `ValidationError` → 400 Bad Request with specific error code
   - `AuthenticationError` → 401 Unauthorized
   - `ConflictError` → 409 Conflict (for songs already in library)
   - Unknown errors → 500 Internal Server Error with generic message

5. **Error Logging**: All unexpected errors (500s) should be logged with full context including user ID, file hash, and operation stage before returning a sanitized error response to the client.

### Logging Strategy

1. **Error Logging**
   - Log all 500 errors with full stack traces
   - Include user ID, file hash, and operation stage
   - Use structured logging (JSON format)

2. **Audit Logging**
   - Log successful uploads (user ID, song ID, timestamp)
   - Log duplicate detections for analytics
   - Track parsing failures for quality metrics

3. **Security Logging**
   - Log authentication failures
   - Log suspicious XML patterns (XXE attempts)
   - Log rate limit violations

### Optimization Strategies

1. **Streaming Processing**
   - Use streams for file reading where possible
   - Calculate hash while reading file (single pass)

2. **Database Optimization**
   - Ensure index exists on `songs.file_hash` (UNIQUE index)
   - Ensure index exists on `user_songs(user_id, song_id)`

3. **Caching**
   - Cache parsed metadata for common public domain songs

4. **Transaction Management**
   - Use database transactions to ensure atomicity across multiple operations
   - Wrap all INSERT operations (songs and user_songs) within a single transaction
   - Use ON CONFLICT clauses to handle race conditions gracefully
   - Ensure proper COMMIT on success and ROLLBACK on errors

5. **Timeout Configuration**
   - Set reasonable timeouts for XML parsing (5 seconds)
   - Set upload timeout to 30 seconds
   - Fail fast on timeout to free resources

## 9. Implementation Steps

### Phase 1: Foundation & Infrastructure

1. **Create MusicXML Parser Service**
   - File: `src/app/services/musicxml-parser.service.ts`
   - Implement secure XML parsing with XXE protection
   - Methods:
     - `parseMusicXML(fileBuffer: ArrayBuffer): Promise<MusicXMLMetadata>`
     - `validateMusicXML(fileBuffer: ArrayBuffer): boolean`
   - Error handling for malformed XML
   - Timeout implementation for large files

2. **Create File Utility Service**
   - File: `src/app/services/file-utils.service.ts`
   - Methods:
     - `calculateMD5Hash(fileBuffer: ArrayBuffer): string`
     - `validateFileExtension(filename: string): boolean`
     - `validateFileSize(size: number): boolean`
     - `truncateString(str: string, maxLength: number): string`

3. **Extend Supabase Service**
   - File: `src/app/services/supabase.service.ts`
   - Add storage methods:
     - `uploadMusicXMLFile(hash: string, file: ArrayBuffer): Promise<void>`
     - `checkFileExists(hash: string): Promise<boolean>`
   - Add song management methods:
     - `findSongByHash(hash: string): Promise<Song | null>`
     - `createSong(data: CreateSongDto): Promise<Song>`
     - `addSongToUserLibrary(userId: string, songId: string): Promise<UserSong>`
     - `checkSongInUserLibrary(userId: string, songId: string): Promise<boolean>`

4. **Create Error Classes**
   - File: `src/app/models/errors.ts`
   - Classes:
     - `ValidationError` (extends Error)
     - `AuthenticationError` (extends Error)
     - `ConflictError` (extends Error)
   - Each with `toDTO()` method returning `ErrorResponseDto`

### Phase 2: API Route Implementation

5. **Create API Route Handler**
   - File: `src/app/api/songs/route.ts` (or appropriate Angular routing structure)
   - Set up multipart/form-data parsing
   - Implement authentication check using Supabase Auth
   - Wire up middleware for file size validation

6. **Implement Request Validation**
   - Validate presence of file in request
   - Validate file extension (.xml, .musicxml)
   - Validate file size (≤ 10MB)
   - Validate MIME type
   - Return appropriate 400 errors with error codes

7. **Implement Core Upload Logic**

   Create the main handler function that orchestrates the entire upload process:
   - **Extract and Validate File**: Parse the multipart request to extract the file field, then run validation checks (extension, size, MIME type)
   - **Read File Content**: Convert the uploaded file into an ArrayBuffer for processing
   - **Calculate Hash**: Use the file utilities service to compute the MD5 hash of the entire file content
   - **Check for Duplicate**: Execute the single LEFT JOIN query against the database to check if the song exists and whether it's already in the user's library (as described in Data Flow section)
   - **Branch Logic**: Based on query results, delegate to duplicate handler or continue with new song creation
   - **Parse Metadata**: Extract composer and title from MusicXML content using the parser service, handling missing elements gracefully
   - **Upload to Storage**: Store the file in Supabase Storage bucket using the hash as the filename with `.musicxml` extension
   - **Create Database Records**: Insert into both `songs` and `user_songs` tables within a transaction to ensure data consistency
   - **Build Response**: Construct the `UploadSongResponseDto` with all required fields and return 201 Created status

8. **Implement Duplicate Handling**

   Create a separate handler function for processing duplicate song scenarios:
   - **Interpret Query Results**: Analyze the results from the LEFT JOIN query executed in step 7. If `user_id` field is populated, the song already exists in the user's library
   - **Handle Conflict Case**: If song is already in user's library, throw a `ConflictError` with error code `SONG_ALREADY_IN_LIBRARY` to return 409 response
   - **Add to Library**: If song exists but not in user's library (user_id is NULL in query result), insert a new record into `user_songs` table to create the association
   - **Build Response**: Construct the `UploadSongResponseDto` using the existing song's data, set `is_duplicate: true` flag, and return 200 OK status with the timestamp from the newly created `user_songs` record as `added_to_library_at`

### Phase 4: Error Handling & Logging

12. **Implement Comprehensive Error Handling**
    - Add try-catch blocks at each operation stage
    - Map exceptions to appropriate HTTP status codes
    - Ensure all errors return `ErrorResponseDto` format
    - Add rollback logic for failed operations (e.g., delete uploaded file if DB insert fails)

13. **Add Logging**
    - Log all successful uploads with metadata
    - Log all errors with context (user ID, hash, stage)
    - Log security events (XXE attempts, auth failures)
    - Configure log levels appropriately (ERROR, WARN, INFO)

---
