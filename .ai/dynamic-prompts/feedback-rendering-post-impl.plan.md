# API Endpoint Implementation Plan: Submit Rendering Feedback

## 1. Endpoint Overview

This endpoint allows authenticated users to submit feedback on the quality of sheet music rendering for a specific song. The endpoint captures thumbs up/down ratings that help improve the rendering system and provides valuable data for analytics on rendering performance. It validates that users have access to the song before accepting feedback and stores ratings in a dedicated feedback table.

**Primary responsibilities:**

- Accept and validate user feedback on rendering quality
- Verify user has access to the rated song
- Store feedback ratings in the database for analysis
- Support thumbs up (+1) and thumbs down (-1) rating system
- Provide confirmation of successful feedback submission
- Handle edge cases and validation failures gracefully

## 2. Request Details

- **HTTP Method**: `POST`
- **URL Structure**: `/api/feedback/rendering`
- **Authentication**: Required (JWT via Supabase Auth)
- **Content-Type**: `application/json`

### Parameters

#### Optional:

- None (operation applies to current authenticated user)

#### Request Body Structure

```json
{
  "song_id": "550e8400-e29b-41d4-a716-446655440000",
  "rating": 1
}
```

## 3. Used Types

### From `src/types.ts`:

#### Request Types

```typescript
export type SubmitRenderingFeedbackCommand = Pick<
  TablesInsert<'rendering_feedback'>,
  'song_id' | 'rating'
>;
```

#### Response Types

```typescript
export type SubmitRenderingFeedbackResponseDto = Pick<
  RenderingFeedbackRow,
  'id' | 'user_id' | 'song_id' | 'rating' | 'created_at'
>;
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
// - INVALID_RATING
// - SONG_NOT_FOUND
// - INTERNAL_ERROR
```

### Database Types (from generated types)

```typescript
TablesInsert<'rendering_feedback'>; // For creating feedback records
Tables<'songs'>; // For validating song existence
Tables<'user_songs'>; // For checking user access
```

## 4. Response Details

### Success Response

#### 201 Created

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440003",
  "user_id": "550e8400-e29b-41d4-a716-446655440001",
  "song_id": "550e8400-e29b-41d4-a716-446655440000",
  "rating": 1,
  "created_at": "2025-10-22T11:15:00.000Z"
}
```

### Error Responses

#### 400 Bad Request

```json
{
  "error": {
    "code": "INVALID_RATING",
    "message": "Rating must be 1 (thumbs up) or -1 (thumbs down)"
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
    "message": "Song not found"
  }
}
```

#### 500 Internal Server Error

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred while submitting feedback"
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
│ Validate      │ Return 400        │
│ Rating Value  │ Bad Request       │
│               │                   │
│ Rating Valid? ├───────────────────┤
│ ┌─────┴─────┐ │                   │
│ │ YES       │ │                   │
│ │           │ │                   │
│ │ Check Song │ │                   │
│ │ Exists &   │ │                   │
│ │ User Has   │ │                   │
│ │ Access     │ │                   │
│ │           │ │                   │
│ │ ┌─────┴─────┐ │                   │
│ │ │ YES       │ │                   │
│ │ │           │ │                   │
│ │ │ Create    │ │                   │
│ │ │ Feedback  │ │                   │
│ │ │ Record    │ │                   │
│ │ │           │ │                   │
│ │ │ Return    │ │                   │
│ │ │ 201       │ │                   │
│ │ │ Created   │ │                   │
│ │ │           │ │                   │
│ │ │ NO        │ │                   │
│ │ │           │ │                   │
│ │ │ 404 Not   │ │                   │
│ │ │ Found     │ │                   │
│ │ └───────────┘ │                   │
│ └─────────────┴───────────────────┘
│               │
│ Invalid       │
│ Rating        │
│               │
│ 400 Bad       │
│ Request       │
└───────────────┴───────────────────┘
    ↓
Return SubmitRenderingFeedbackResponseDto
```

### Detailed Step-by-Step Flow

1. **Request Reception**
   - API route receives POST request to `/api/feedback/rendering`
   - Parse JSON request body for song_id and rating

2. **Authentication Check**
   - Extract JWT token from `Authorization: Bearer <token>` header
   - Validate token with Supabase Auth service
   - Extract user ID from authenticated token context
   - Return 401 if authentication fails

3. **Request Validation**
   - Validate request body is valid JSON
   - Check that `song_id` and `rating` fields are present
   - Validate `song_id` is valid UUID format
   - Validate `rating` is integer 1 or -1
   - Return 400 for validation failures

4. **Song Access Verification**
   - Query database to verify song exists
   - Check if user has access (public song or in their library)
   - Return 404 if song doesn't exist or isn't accessible

5. **Create Feedback Record**
   - Insert new record into `rendering_feedback` table
   - Include user_id, song_id, and rating
   - Use current timestamp for created_at

6. **Response Construction**
   - Build `SubmitRenderingFeedbackResponseDto` with created record data
   - Return JSON response with 201 Created status
   - Include all relevant feedback metadata

## 6. Security Considerations

### Authentication & Authorization

1. **JWT Token Validation**
   - Mandatory authentication for all feedback submissions
   - Validate token integrity and prevent anonymous feedback
   - Extract user identity for feedback association

2. **Row-Level Security (RLS)**
   - Database policies control access to feedback creation
   - RLS ensures users can only provide feedback on accessible songs
   - Automatic enforcement prevents unauthorized feedback

### Input Validation

1. **Request Body Validation**
   - Validate Content-Type is `application/json`
   - Ensure required fields (`song_id`, `rating`) are present
   - Validate UUID format for `song_id`
   - Validate rating values (exactly 1 or -1)

2. **Rating Constraints**
   - Strict validation of rating values
   - Prevent invalid ratings that could skew analytics
   - Use enumerated validation for rating field

### Data Integrity

1. **Feedback Validation**
   - Verify song exists and user has access before accepting feedback
   - Prevent feedback on non-existent or inaccessible songs
   - Ensure feedback records are properly associated with users and songs

2. **Audit Trail**
   - Log all feedback submissions for analytics
   - Track feedback patterns and rating distributions
   - Monitor feedback quality and potential abuse

## 7. Error Handling

### Error Scenarios

| Scenario                | HTTP Code | Error Code      | Handling Strategy                    |
| ----------------------- | --------- | --------------- | ------------------------------------ |
| Missing authentication  | 401       | UNAUTHORIZED    | Check Authorization header           |
| Invalid/expired token   | 401       | UNAUTHORIZED    | Validate with Supabase Auth          |
| Invalid JSON body       | 400       | INVALID_REQUEST | Parse JSON and catch syntax errors   |
| Missing required fields | 400       | INVALID_REQUEST | Validate song_id and rating presence |
| Invalid song_id format  | 400       | INVALID_REQUEST | Validate UUID format                 |
| Invalid rating value    | 400       | INVALID_RATING  | Validate rating is 1 or -1 only      |
| Song not found          | 404       | SONG_NOT_FOUND  | Query returns no song                |
| No access to song       | 404       | SONG_NOT_FOUND  | User cannot access private song      |
| Database insert error   | 500       | INTERNAL_ERROR  | Handle Supabase insert failures      |

### Error Handling Pattern

Implement structured error handling for feedback operations:

1. **Authentication Errors**: Detect Supabase Auth failures and return 401
2. **Validation Errors**: Check request format and field validation, return 400
3. **Not Found Errors**: Handle missing or inaccessible songs with 404
4. **Database Errors**: Catch Supabase operation failures and return 500

### Logging Strategy

1. **Error Logging**
   - Log validation failures with request details
   - Log access control violations
   - Include user ID and song ID in error logs

2. **Audit Logging**
   - Log all feedback submissions for analytics
   - Track rating distributions and patterns
   - Monitor feedback submission frequency

## 8. Implementation Steps

### Phase 1: Infrastructure Setup

1. **Extend Supabase Service**
   - File: `src/app/services/supabase.service.ts`
   - Add feedback methods:
     - `submitRenderingFeedback(data: SubmitRenderingFeedbackCommand): Promise<RenderingFeedbackRow>`

2. **Create Feedback Service**
   - File: `src/app/services/feedback.service.ts`
   - Methods:
     - `submitRenderingFeedback(command: SubmitRenderingFeedbackCommand): Promise<SubmitRenderingFeedbackResponseDto>`
   - Include validation and access control

3. **Add Validation Logic**
   - Implement rating value validation (1 or -1 only)
   - Add UUID format validation for song_id
   - Create comprehensive request validation

### Phase 2: API Route Implementation

4. **Create API Route Handler**
   - File: `src/app/api/feedback/rendering/route.ts` (or appropriate Angular routing structure)
   - Implement POST handler with authentication
   - Add request body parsing and validation

5. **Implement Request Validation**
   - Validate JSON request body structure
   - Check required fields and data types
   - Validate rating constraints and song_id format

6. **Implement Access Control Logic**
   - Check song existence and user accessibility
   - Prevent feedback on inaccessible songs
   - Return appropriate error responses

### Phase 3: Error Handling & Testing

7. **Implement Comprehensive Error Handling**
   - Add error handling for all operation stages
   - Map errors to appropriate HTTP responses
   - Ensure consistent error response format

8. **Add Logging**
   - Implement feedback submission logging
   - Add validation error tracking
   - Configure appropriate log levels
