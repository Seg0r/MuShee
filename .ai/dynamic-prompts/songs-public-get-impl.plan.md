# API Endpoint Implementation Plan: Browse Public Domain Songs

## 1. Endpoint Overview

This endpoint provides paginated access to the pre-loaded public domain song catalog, enabling users to browse and discover available sheet music. The endpoint supports flexible filtering and sorting options to help users find songs by composer, title, or chronological order. It serves as the primary discovery mechanism for users to explore the public song library before adding songs to their personal collection.

**Primary responsibilities:**

- Retrieve paginated list of public domain songs from database
- Support flexible sorting and filtering options
- Implement efficient pagination for large song catalogs
- Provide consistent song metadata for browsing interfaces
- Handle search queries across title and composer fields

## 2. Request Details

- **HTTP Method**: `GET`
- **URL Structure**: `/api/songs/public`
- **Authentication**: Required (JWT via Supabase Auth)
- **Query Parameters**: Multiple optional parameters for pagination and filtering

### Parameters

#### Query Parameters:

- `page` (integer, optional, default: 1): Page number for pagination
- `limit` (integer, optional, default: 50, max: 100): Number of items per page
- `sort` (string, optional, default: "title"): Sort field (title, composer, created_at)
- `order` (string, optional, default: "asc"): Sort order (asc, desc)
- `search` (string, optional): Search query for title or composer fields

#### Request Body Structure

No request body for GET operations.

## 3. Used Types

### From `src/types.ts`:

#### Response Types

```typescript
export interface PublicSongsListResponseDto {
  data: PublicSongListItemDto[];
  pagination: PaginationDto;
}

export type PublicSongListItemDto = Pick<SongRow, 'id' | 'created_at'> & {
  song_details: SongDetailsDto;
};

export type SongDetailsDto = Pick<SongRow, 'title' | 'composer'>;

export interface PaginationDto {
  page: number;
  limit: number;
  total_items: number;
  total_pages: number;
}
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
// - INVALID_PARAMETERS
// - INTERNAL_ERROR
```

### Database Types (from generated types)

```typescript
Tables<'songs'>; // For querying public domain songs
```

## 4. Response Details

### Success Response

#### 200 OK

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "song_details": {
        "composer": "Wolfgang Amadeus Mozart",
        "title": "Eine kleine Nachtmusik"
      },
      "created_at": "2025-09-01T00:00:00.000Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "song_details": {
        "composer": "Johann Sebastian Bach",
        "title": "Air on the G String"
      },
      "created_at": "2025-09-01T00:00:00.000Z"
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

### Error Responses

#### 400 Bad Request

```json
{
  "error": {
    "code": "INVALID_PARAMETERS",
    "message": "Invalid pagination parameters"
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

#### 500 Internal Server Error

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred while retrieving songs"
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
Extract Query Parameters
    ↓
Validate Parameters
    ↓
┌─────────────────┴─────────────────┐
│ Parameters Valid?                 │
├───────────────┬───────────────────┤
│ YES           │ NO                │
│               │                   │
│ Build Query   │ Return 400        │
│ Filters       │ Bad Request       │
│               │                   │
│ Execute       │                   │
│ Paginated     │                   │
│ Query         │                   │
│               │                   │
│ Calculate     │                   │
│ Pagination    │                   │
│ Metadata      │                   │
│               │                   │
│ Return Song   │                   │
│ List (200)    │                   │
└───────────────┴───────────────────┘
    ↓
Return PublicSongsListResponseDto
```

### Detailed Step-by-Step Flow

1. **Request Reception**
   - API route receives GET request to `/api/songs/public`
   - Extract query parameters from URL

2. **Authentication Check**
   - Extract JWT token from `Authorization: Bearer <token>` header
   - Validate token with Supabase Auth service
   - Extract user ID (required for RLS but not used in query)
   - Return 401 if authentication fails

3. **Parameter Validation**
   - Validate `page`: Must be positive integer ≥ 1
   - Validate `limit`: Must be positive integer, max 100
   - Validate `sort`: Must be one of allowed fields (title, composer, created_at)
   - Validate `order`: Must be "asc" or "desc"
   - Validate `search`: Optional string, no specific format requirements
   - Return 400 for any invalid parameters

4. **Query Construction**
   - Filter for public domain songs (`uploader_id IS NULL`)
   - Apply search filter if provided (ILIKE on title and composer)
   - Apply sorting based on sort field and order
   - Apply pagination with OFFSET and LIMIT

5. **Execute Main Query**
   - Run paginated query to get song data
   - Select required fields: id, title, composer, created_at
   - Apply all filters, sorting, and pagination

6. **Calculate Pagination Metadata**
   - Execute separate COUNT query to get total items
   - Calculate total_pages = ceil(total_items / limit)
   - Build pagination object with all required fields

7. **Response Construction**
   - Transform database results to `PublicSongListItemDto[]`
   - Build complete `PublicSongsListResponseDto`
   - Return JSON response with 200 OK status

## 6. Security Considerations

### Authentication & Authorization

1. **JWT Token Validation**
   - Require authentication for all public song browsing
   - Validate token integrity and prevent anonymous access
   - Maintain consistent authentication pattern across endpoints

2. **Row-Level Security (RLS)**
   - Database policies ensure proper access to public songs
   - RLS automatically filters for `uploader_id IS NULL`
   - Prevent access to user-uploaded private songs

### Input Validation

1. **Query Parameter Validation**
   - Strict validation of all pagination parameters
   - Prevent SQL injection through parameterized queries
   - Validate sort fields against allowed list
   - Sanitize search input to prevent injection attacks

2. **Parameter Constraints**
   - Enforce maximum page sizes to prevent performance issues
   - Limit search string lengths if necessary
   - Validate parameter types and ranges

### Performance Security

1. **Query Limits**
   - Enforce maximum limit of 100 items per page
   - Prevent excessive data retrieval attacks
   - Implement reasonable default pagination values

2. **Search Security**
   - Use parameterized queries for search operations
   - Limit search complexity to prevent DoS attacks
   - Consider rate limiting for search-heavy usage

## 7. Error Handling

### Error Scenarios

| Scenario               | HTTP Code | Error Code         | Handling Strategy                      |
| ---------------------- | --------- | ------------------ | -------------------------------------- |
| Missing authentication | 401       | UNAUTHORIZED       | Check Authorization header             |
| Invalid/expired token  | 401       | UNAUTHORIZED       | Validate with Supabase Auth            |
| Invalid page number    | 400       | INVALID_PARAMETERS | Validate page ≥ 1                      |
| Invalid limit value    | 400       | INVALID_PARAMETERS | Validate 1 ≤ limit ≤ 100               |
| Invalid sort field     | 400       | INVALID_PARAMETERS | Check against allowed sort fields      |
| Invalid sort order     | 400       | INVALID_PARAMETERS | Validate asc/desc only                 |
| Database query error   | 500       | INTERNAL_ERROR     | Handle Supabase client failures        |
| Count query error      | 500       | INTERNAL_ERROR     | Handle pagination calculation failures |

### Error Handling Pattern

Implement comprehensive validation and error handling:

1. **Authentication Errors**: Detect token issues and return 401
2. **Validation Errors**: Check all parameter constraints and return 400
3. **Database Errors**: Handle Supabase operation failures with 500
4. **Query Errors**: Separate handling for main query vs count query failures

### Logging Strategy

1. **Error Logging**
   - Log parameter validation failures for debugging
   - Log database query errors with context
   - Include user ID and query parameters in logs

2. **Audit Logging**
   - Log search queries for analytics
   - Track popular sorting and filtering patterns
   - Monitor pagination usage patterns

## 8. Implementation Steps

### Phase 1: Infrastructure Setup

1. **Extend Supabase Service**
   - File: `src/app/services/supabase.service.ts`
   - Add public songs methods:
     - `getPublicSongs(params: PublicSongsQueryParams): Promise<{ data: SongRow[], total: number }>`

2. **Create Song Service**
   - File: `src/app/services/song.service.ts`
   - Add public songs browsing method:
     - `getPublicSongsList(queryParams: PublicSongsQueryParams): Promise<PublicSongsListResponseDto>`

3. **Add Parameter Validation**
   - Create validation utilities for pagination parameters
   - Add sort field validation against allowed fields
   - Implement search query sanitization

### Phase 2: API Route Implementation

4. **Create API Route Handler**
   - File: `src/app/api/songs/public/route.ts` (or appropriate Angular routing structure)
   - Implement GET handler with authentication
   - Add query parameter extraction and validation

5. **Implement Parameter Validation**
   - Validate all query parameters against constraints
   - Return detailed error messages for invalid parameters
   - Handle type conversion and default values

6. **Implement Query Logic**
   - Build database query with proper filtering and sorting
   - Execute paginated query with count for metadata
   - Handle search functionality across title and composer

### Phase 3: Error Handling & Testing

7. **Implement Comprehensive Error Handling**
   - Add error handling for all operation stages
   - Map errors to appropriate HTTP responses
   - Ensure consistent error response format

8. **Add Logging**
   - Implement parameter validation logging
   - Log basic flow to console
   - Configure appropriate log levels
