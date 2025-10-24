# API Endpoint Implementation Plan: Get User's Song Library

## 1. Endpoint Overview

This endpoint retrieves all songs in the authenticated user's personal library with support for pagination, sorting, and flexible display options. The endpoint serves as the primary interface for users to view and manage their collected sheet music, combining song metadata with library-specific information like addition timestamps. It provides efficient browsing capabilities for potentially large personal collections.

**Primary responsibilities:**

- Retrieve paginated list of user's personal song library
- Combine song metadata with library association data
- Support flexible sorting options for user organization
- Provide consistent pagination for large collections
- Ensure users can only access their own library entries

## 2. Request Details

- **HTTP Method**: `GET`
- **URL Structure**: `/api/user-songs`
- **Authentication**: Required (JWT via Supabase Auth)
- **Query Parameters**: Multiple optional parameters for pagination and sorting

### Parameters

#### Query Parameters:

- `page` (integer, optional, default: 1): Page number for pagination
- `limit` (integer, optional, default: 50, max: 100): Number of items per page
- `sort` (string, optional, default: "created_at"): Sort field (title, composer, created_at)
- `order` (string, optional, default: "desc"): Sort order (asc, desc)

#### Request Body Structure

No request body for GET operations.

## 3. Used Types

### From `src/types.ts`:

#### Response Types

```typescript
export interface UserLibraryListResponseDto {
  data: UserLibraryItemDto[];
  pagination: PaginationDto;
}

export interface UserLibraryItemDto {
  song_id: UserSongRow['song_id'];
  song_details: SongDetailsDto;
  added_at: UserSongRow['created_at'];
}

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
Tables<'user_songs'>; // For querying user library associations
Tables<'songs'>; // For joining with song metadata
```

## 4. Response Details

### Success Response

#### 200 OK

```json
{
  "data": [
    {
      "song_id": "550e8400-e29b-41d4-a716-446655440000",
      "song_details": {
        "composer": "Ludwig van Beethoven",
        "title": "Moonlight Sonata"
      },
      "added_at": "2025-10-22T10:40:00.000Z"
    },
    {
      "song_id": "550e8400-e29b-41d4-a716-446655440001",
      "song_details": {
        "composer": "Frédéric Chopin",
        "title": "Nocturne Op. 9 No. 2"
      },
      "added_at": "2025-10-20T14:15:00.000Z"
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
    "message": "An unexpected error occurred while retrieving library"
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
│ Execute JOIN  │ Return 400        │
│ Query for     │ Bad Request       │
│ User Library  │                   │
│               │                   │
│ Apply Sorting │                   │
│ & Pagination  │                   │
│               │                   │
│ Calculate     │                   │
│ Pagination    │                   │
│ Metadata      │                   │
│               │                   │
│ Return Song   │                   │
│ List (200)    │                   │
└───────────────┴───────────────────┘
    ↓
Return UserLibraryListResponseDto
```

### Detailed Step-by-Step Flow

1. **Request Initiation**
   - Angular component/service initiates user library retrieval
   - Calls `UserLibraryService.getUserLibrary(queryParams)`
   - Service validates and prepares query parameters

2. **Authentication Check**
   - Use `supabase.auth.getUser()` to get authenticated user
   - Supabase SDK automatically handles JWT token validation
   - Extract user ID from auth context
   - Handle authentication errors if user is not authenticated

3. **Parameter Validation**
   - Validate `page`: Must be positive integer ≥ 1
   - Validate `limit`: Must be positive integer, max 100
   - Validate `sort`: Must be one of allowed fields (title, composer, created_at)
   - Validate `order`: Must be "asc" or "desc"
   - Return 400 for any invalid parameters

4. **Library Query Construction**
   - Build JOIN query between `user_songs` and `songs` tables
   - Filter by authenticated user ID (`user_songs.user_id`)
   - Apply sorting based on selected field and order
   - Apply pagination with OFFSET and LIMIT

5. **Execute Main Query**
   - Run paginated JOIN query to get library data
   - Select required fields from both tables
   - Apply all filters, sorting, and pagination

6. **Calculate Pagination Metadata**
   - Execute separate COUNT query on `user_songs` for user
   - Calculate total_pages = ceil(total_items / limit)
   - Build pagination object with all required fields

7. **Response Construction**
   - Transform database results to `UserLibraryItemDto[]`
   - Build complete `UserLibraryListResponseDto`
   - Return JSON response with 200 OK status

## 6. Security Considerations

### Authentication & Authorization

1. **JWT Token Validation**
   - Mandatory authentication for all library access requests
   - Validate token integrity and prevent unauthorized access
   - Extract user identity for library filtering

2. **Row-Level Security (RLS)**
   - Database policies restrict access to user's own library entries
   - RLS policy: `auth.uid() = user_id` for user_songs table
   - Automatic enforcement prevents cross-user library access

### Input Validation

1. **Query Parameter Validation**
   - Strict validation of all pagination parameters
   - Prevent SQL injection through parameterized queries
   - Validate sort fields against allowed list
   - Sanitize all input parameters

2. **Parameter Constraints**
   - Enforce maximum page sizes to prevent performance issues
   - Validate parameter types and ranges
   - Default to safe values for optional parameters

### Data Privacy

1. **Library Isolation**
   - Users can only view their own library entries
   - No access to other users' song collections
   - Automatic filtering by authenticated user ID

2. **Performance Limits**
   - Pagination prevents large result sets
   - Reasonable limits on page sizes
   - Efficient database queries with proper indexing

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
| Database JOIN error    | 500       | INTERNAL_ERROR     | Handle Supabase query failures         |
| Count query error      | 500       | INTERNAL_ERROR     | Handle pagination calculation failures |

### Error Handling Pattern

Implement structured error handling for library operations:

1. **Authentication Errors**: Detect token issues and return 401
2. **Validation Errors**: Check parameter constraints and return 400
3. **Database Errors**: Handle Supabase operation failures with 500
4. **Query Errors**: Separate handling for main query vs count query failures

### Logging Strategy

1. **Error Logging**
   - Log parameter validation failures
   - Log database query errors with user context
   - Include query parameters in error logs

2. **Audit Logging**
   - Log library access patterns for analytics
   - Track sorting preferences and pagination usage
   - Monitor library size and access frequency

## 8. Implementation Steps

### Phase 1: Infrastructure Setup

1. **Extend Supabase Service**
   - File: `src/app/services/supabase.service.ts`
   - Add user library methods:
     - `getUserLibrary(userId: string, params: LibraryQueryParams): Promise<{ data: UserSongWithMetadata[], total: number }>`

2. **Create User Library Service**
   - File: `src/app/services/user-library.service.ts`
   - Methods:
     - `getUserLibrary(queryParams: LibraryQueryParams): Promise<UserLibraryListResponseDto>`

3. **Add Parameter Validation**
   - Create validation utilities for library query parameters
   - Add sort field validation for library-specific fields
   - Implement pagination parameter validation

### Phase 2: Direct Supabase SDK Implementation

4. **Implement User Library Retrieval in Angular Component/Service**
   - Use Supabase client directly from Angular service
   - Call `supabase.auth.getUser()` to get authenticated user
   - Query using `supabase.from('user_songs')` with proper JOIN

5. **Implement Query Logic**
   - Build JOIN query using Supabase SDK between user_songs and songs
   - Apply user filtering and sorting via RLS and query params
   - Implement pagination with proper count queries

6. **Handle Data Transformation**
   - Transform database JOIN results to DTO format in service
   - Ensure proper field mapping and data types
   - Handle null values and missing data gracefully

### Phase 3: Error Handling & Testing

7. **Implement Comprehensive Error Handling**
   - Add error handling for all operation stages
   - Map errors to appropriate HTTP responses
   - Ensure consistent error response format

8. **Add Logging**
   - Implement parameter validation logging
   - Log basic flow to console
   - Configure appropriate log levels
