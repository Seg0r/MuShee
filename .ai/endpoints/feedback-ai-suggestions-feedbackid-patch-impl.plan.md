# API Endpoint Implementation Plan: Submit AI Suggestion Feedback

## 1. Endpoint Overview

This endpoint allows authenticated users to submit ratings for multiple AI-generated song suggestions in a single batch operation. The endpoint updates an existing AI suggestion feedback record with user ratings (thumbs up/down/unrated) for each suggestion. It validates that the user owns the feedback record and that the provided ratings match the original suggestions exactly. This endpoint is typically called when the user closes the suggestion modal after reviewing recommendations.

**Primary responsibilities:**

- Update existing AI suggestion feedback record with user ratings
- Validate user owns the feedback record being updated
- Ensure provided ratings match original suggestions structure
- Calculate and update aggregate rating score for analytics
- Handle batch rating updates for multiple suggestions
- Maintain data consistency and prevent unauthorized updates

## 2. Request Details

- **HTTP Method**: `PATCH`
- **URL Structure**: `/api/feedback/ai-suggestions/:feedbackId`
- **Authentication**: Required (JWT via Supabase Auth)
- **Content-Type**: `application/json`

### Parameters

#### Path Parameters:

- `feedbackId` (string, required): UUID of the feedback record to update

#### Request Body Structure

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

## 3. Used Types

### From `src/types.ts`:

#### Request Types

```typescript
export interface UpdateAiSuggestionFeedbackCommand {
  feedbackId: AiSuggestionFeedbackRow['id'];
  suggestions: AiSuggestionFeedbackSuggestionDto[];
}

export interface AiSuggestionFeedbackSuggestionDto {
  title: SongDetailsDto['title'];
  composer: SongDetailsDto['composer'];
  user_rating: -1 | 1 | null;
}
```

#### Response Types

```typescript
export type UpdateAiSuggestionFeedbackResponseDto = Pick<
  AiSuggestionFeedbackRow,
  'id' | 'rating_score' | 'updated_at'
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
// - FORBIDDEN
// - FEEDBACK_NOT_FOUND
// - INTERNAL_ERROR
```

### Database Types (from generated types)

```typescript
Tables<'ai_suggestion_feedback'>; // For updating feedback records
```

## 4. Response Details

### Success Response

#### 200 OK

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "rating_score": 0,
  "updated_at": "2025-10-22T11:20:00.000Z"
}
```

### Error Responses

#### 400 Bad Request

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Invalid suggestions format, mismatch with original suggestions, or invalid rating values"
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

#### 403 Forbidden

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You can only rate your own suggestions"
  }
}
```

#### 404 Not Found

```json
{
  "error": {
    "code": "FEEDBACK_NOT_FOUND",
    "message": "Feedback record not found"
  }
}
```

#### 500 Internal Server Error

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred while updating feedback"
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
Extract User ID + Feedback ID + Request Body
    ↓
Validate Request Payload Structure
    ↓
┌─────────────────┴─────────────────┐
│ Payload Valid?                   │
├───────────────┬───────────────────┤
│ YES           │ NO                │
│               │                   │
│ Retrieve      │ Return 400        │
│ Feedback      │ Bad Request       │
│ Record        │                   │
│               │                   │
│ Record Exists │                   │
│ & User Owns?  ├───────────────────┤
│ ┌─────┴─────┐ │                   │
│ │ YES       │ │                   │
│ │           │ │                   │
│ │ Validate   │ │                   │
│ │ Suggestions │ │                   │
│ │ Match      │ │                   │
│ │ Original   │ │                   │
│ │           │ │                   │
│ │ ┌─────┴─────┐ │                   │
│ │ │ YES       │ │                   │
│ │ │           │ │                   │
│ │ │ Update    │ │                   │
│ │ │ Ratings & │ │                   │
│ │ │ Score     │ │                   │
│ │ │           │ │                   │
│ │ │ Return    │ │                   │
│ │ │ 200 OK    │ │                   │
│ │ │           │ │                   │
│ │ │ NO        │ │                   │
│ │ │           │ │                   │
│ │ │ 400 Bad   │ │                   │
│ │ │ Request   │ │                   │
│ │ └───────────┘ │                   │
│ └─────────────┴───────────────────┘
│               │
│ User doesn't  │
│ own record    │
│               │
│ 403 Forbidden │
│               │
│ Record not    │
│ found         │
│               │
│ 404 Not Found │
└───────────────┴───────────────────┘
    ↓
Return UpdateAiSuggestionFeedbackResponseDto
```

### Detailed Step-by-Step Flow

1. **Request Reception**
   - API route receives PATCH request to `/api/feedback/ai-suggestions/:feedbackId`
   - Extract feedbackId from URL path parameter
   - Parse JSON request body for suggestions array

2. **Authentication Check**
   - Extract JWT token from `Authorization: Bearer <token>` header
   - Validate token with Supabase Auth service
   - Extract user ID from authenticated token context
   - Return 401 if authentication fails

3. **Request Validation**
   - Validate request body is valid JSON
   - Check that `suggestions` is an array with valid structure
   - Validate each suggestion has title, composer, and valid rating
   - Return 400 for validation failures

4. **Feedback Record Retrieval**
   - Query `ai_suggestion_feedback` table for the specified feedbackId
   - Verify record exists and belongs to authenticated user
   - Return 404 if record doesn't exist
   - Return 403 if user doesn't own the record

5. **Suggestion Validation**
   - Compare provided suggestions with stored original suggestions
   - Validate that titles, composers, and order match exactly
   - Ensure all required suggestions are rated
   - Return 400 if validation fails

6. **Rating Update and Score Calculation**
   - Update the suggestions JSONB array with user_rating values
   - Calculate rating_score as sum of all non-null user ratings
   - Update the feedback record with new ratings and score
   - Set updated_at timestamp

7. **Response Construction**
   - Build `UpdateAiSuggestionFeedbackResponseDto` with updated data
   - Return JSON response with 200 OK status
   - Include feedback ID, rating score, and update timestamp

## 6. Security Considerations

### Authentication & Authorization

1. **JWT Token Validation**
   - Mandatory authentication for all feedback updates
   - Validate token integrity and prevent unauthorized access
   - Extract user identity for ownership verification

2. **Row-Level Security (RLS)**
   - Database policies restrict feedback updates to record owners
   - RLS policy: `auth.uid() = user_id` for ai_suggestion_feedback table
   - Automatic enforcement prevents cross-user feedback modification

### Input Validation

1. **Request Body Validation**
   - Validate Content-Type is `application/json`
   - Ensure suggestions array is properly structured
   - Validate each suggestion object has required fields
   - Check rating values are valid (-1, 1, or null)

2. **Path Parameter Validation**
   - Validate `feedbackId` is valid UUID format
   - Prevent injection attacks through parameter validation

### Data Integrity

1. **Ownership Verification**
   - Verify user owns the feedback record before allowing updates
   - Prevent unauthorized modification of other users' feedback
   - Ensure feedback records remain tamper-proof

2. **Suggestion Matching**
   - Validate provided suggestions match original AI suggestions exactly
   - Prevent rating of different or additional suggestions
   - Maintain consistency between original and rated suggestions

### Data Privacy

1. **Feedback Data Protection**
   - Ensure users can only access and modify their own feedback
   - Protect feedback records from unauthorized viewing or editing
   - Implement proper data isolation between users

2. **Rating Analytics**
   - Store aggregate rating scores for system improvement
   - Anonymize individual feedback for analytics purposes
   - Maintain user privacy while enabling system learning

## 7. Error Handling

### Error Scenarios

| Scenario                  | HTTP Code | Error Code         | Handling Strategy                       |
| ------------------------- | --------- | ------------------ | --------------------------------------- |
| Missing authentication    | 401       | UNAUTHORIZED       | Check Authorization header              |
| Invalid/expired token     | 401       | UNAUTHORIZED       | Validate with Supabase Auth             |
| Invalid JSON body         | 400       | INVALID_REQUEST    | Parse JSON and catch syntax errors      |
| Invalid suggestions array | 400       | INVALID_REQUEST    | Validate array structure and contents   |
| Invalid rating values     | 400       | INVALID_REQUEST    | Validate rating is -1, 1, or null       |
| Feedback ID not UUID      | 400       | INVALID_REQUEST    | Validate UUID format                    |
| Feedback record not found | 404       | FEEDBACK_NOT_FOUND | Query returns no matching record        |
| User doesn't own record   | 403       | FORBIDDEN          | User ID doesn't match record owner      |
| Suggestion mismatch       | 400       | INVALID_REQUEST    | Provided suggestions don't match stored |
| Database update error     | 500       | INTERNAL_ERROR     | Handle Supabase update failures         |

### Error Handling Pattern

Implement comprehensive error handling for feedback updates:

1. **Authentication Errors**: Detect token issues and return 401
2. **Validation Errors**: Check request format and content, return 400
3. **Authorization Errors**: Handle ownership violations with 403
4. **Not Found Errors**: Detect missing feedback records with 404
5. **Database Errors**: Catch Supabase operation failures with 500

### Logging Strategy

1. **Error Logging**
   - Log validation failures with detailed error information
   - Log ownership violations for security monitoring
   - Include user ID and feedback ID in error logs

2. **Audit Logging**
   - Log successful feedback updates for analytics
   - Track rating patterns and score distributions
   - Monitor feedback completion rates

## 8. Implementation Steps

### Phase 1: Infrastructure Setup

1. **Extend Supabase Service**
   - File: `src/app/services/supabase.service.ts`
   - Add AI feedback update methods:
     - `updateAiSuggestionFeedback(feedbackId: string, ratings: AiSuggestionFeedbackSuggestionDto[]): Promise<AiSuggestionFeedbackRow>`

2. **Create Feedback Service**
   - File: `src/app/services/feedback.service.ts`
   - Methods:
     - `updateAiSuggestionFeedback(command: UpdateAiSuggestionFeedbackCommand): Promise<UpdateAiSuggestionFeedbackResponseDto>`
   - Include validation and ownership checking

3. **Add Validation Logic**
   - Implement suggestion matching validation
   - Add rating value validation (-1, 1, null)
   - Create comprehensive feedback update validation

### Phase 2: API Route Implementation

4. **Create API Route Handler**
   - File: `src/app/api/feedback/ai-suggestions/[feedbackId]/route.ts` (or appropriate Angular routing structure)
   - Implement PATCH handler with authentication
   - Add path parameter and request body validation

5. **Implement Ownership Verification**
   - Query feedback record and verify user ownership
   - Return 403 for unauthorized access attempts
   - Return 404 for non-existent records

6. **Implement Suggestion Validation**
   - Compare provided ratings with stored suggestions
   - Validate exact match of titles, composers, and order
   - Ensure all suggestions are accounted for

### Phase 3: Error Handling & Testing

7. **Implement Comprehensive Error Handling**
   - Add error handling for all operation stages
   - Map errors to appropriate HTTP responses
   - Ensure consistent error response format

8. **Add Logging**
   - Log basic flow to console
   - Configure appropriate log levels
