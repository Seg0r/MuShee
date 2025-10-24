# API Endpoint Implementation Plan: Get Current User Profile

## 1. Endpoint Overview

This endpoint retrieves the authenticated user's profile information, including their onboarding status. The endpoint provides essential profile data that drives UI decisions around user experience flow, particularly whether to show onboarding modals or tutorials. It serves as the primary mechanism for the frontend to determine the current state of user setup and customization.

**Primary responsibilities:**

- Retrieve authenticated user's profile data from the database
- Return onboarding status to control UI flow
- Provide profile metadata for user interface display
- Handle cases where profile may not exist (automatic profile creation)

## 2. Request Details

- **HTTP Method**: `GET`
- **URL Structure**: `/api/profiles/me`
- **Authentication**: Required (JWT via Supabase Auth)
- **Query Parameters**: None

### Parameters

#### Optional:

- None

#### Request Body Structure

No request body for GET operations.

## 3. Used Types

### From `src/types.ts`:

#### Response Types

```typescript
export type ProfileDto = Pick<ProfileRow, 'id' | 'updated_at' | 'has_completed_onboarding'>;
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
// - PROFILE_NOT_FOUND
// - INTERNAL_ERROR
```

### Database Types (from generated types)

```typescript
Tables<'profiles'>; // For querying profile data
```

## 4. Response Details

### Success Response

#### 200 OK

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "updated_at": "2025-10-22T10:30:00.000Z",
  "has_completed_onboarding": false
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

#### 404 Not Found

```json
{
  "error": {
    "code": "PROFILE_NOT_FOUND",
    "message": "User profile does not exist"
  }
}
```

#### 500 Internal Server Error

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred while retrieving profile"
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
Extract User ID from Token
    ↓
Query profiles Table (by user ID)
    ↓
┌─────────────────┴─────────────────┐
│ Profile Found?                    │
├───────────────┬───────────────────┤
│ YES           │ NO                │
│               │                   │
│ Return        │ Check if auto-    │
│ Profile       │ creation enabled  │
│ Data (200)    │                   │
│               │ If auto-create:   │
│               │ → Create profile  │
│               │ → Return new      │
│               │   profile (200)   │
│               │                   │
│               │ If no auto-create:│
│               │ → 404 Not Found   │
└───────────────┴───────────────────┘
    ↓
Return ProfileDto
```

### Detailed Step-by-Step Flow

1. **Request Reception**
   - API route receives GET request to `/api/profiles/me`
   - No request body or query parameters expected

2. **Authentication Check**
   - Extract JWT token from `Authorization: Bearer <token>` header
   - Validate token with Supabase Auth service
   - Extract user ID from authenticated token context
   - Return 401 if token is missing, invalid, or expired

3. **Database Query**
   - Query `profiles` table using authenticated user ID
   - Select relevant fields: `id`, `updated_at`, `has_completed_onboarding`
   - Use single-row query expecting exactly one result

4. **Profile Existence Check**
   - **Profile exists**: Return profile data with 200 OK
   - **Profile missing**: Determine if automatic profile creation is enabled
     - If auto-creation enabled: Create new profile with defaults, return 201 or 200
     - If auto-creation disabled: Return 404 with PROFILE_NOT_FOUND error

5. **Response Construction**
   - Build `ProfileDto` from database result
   - Return JSON response with appropriate HTTP status code
   - Ensure all timestamps are in ISO 8601 format

## 6. Security Considerations

### Authentication & Authorization

1. **JWT Token Validation**
   - Mandatory authentication for all requests
   - Validate JWT token integrity and expiration
   - Extract user context from `auth.uid()` function
   - Reject requests without valid authentication

2. **Row-Level Security (RLS)**
   - Database policies ensure users can only access their own profile
   - RLS policy: `auth.uid() = id` for profiles table
   - Automatic enforcement prevents unauthorized access

### Input Validation

No input validation required for this GET endpoint as it has no parameters or body.

### Data Privacy

1. **Profile Data Access**
   - Users can only view their own profile information
   - No sensitive data exposed beyond onboarding status
   - Profile ID and timestamps are non-sensitive

2. **Audit Trail**
   - Log profile access for security monitoring
   - Track authentication failures and unauthorized attempts

## 7. Error Handling

### Error Scenarios

| Scenario                  | HTTP Code | Error Code        | Handling Strategy                   |
| ------------------------- | --------- | ----------------- | ----------------------------------- |
| Missing authentication    | 401       | UNAUTHORIZED      | Check Authorization header presence |
| Invalid/expired token     | 401       | UNAUTHORIZED      | Validate token with Supabase Auth   |
| Profile not found         | 404       | PROFILE_NOT_FOUND | Query returns no rows               |
| Database connection error | 500       | INTERNAL_ERROR    | Handle Supabase client errors       |
| Unexpected server error   | 500       | INTERNAL_ERROR    | Catch-all error handler             |

### Error Handling Pattern

Implement structured error handling that maps database and authentication errors to appropriate HTTP responses:

1. **Authentication Errors**: Check for Supabase Auth exceptions and return 401
2. **Not Found Errors**: Detect empty query results and return 404 with PROFILE_NOT_FOUND
3. **Database Errors**: Catch Supabase client errors and return 500 with INTERNAL_ERROR
4. **Unexpected Errors**: Use try-catch blocks to prevent unhandled exceptions

### Logging Strategy

1. **Error Logging**
   - Log all 500 errors with full context including user ID
   - Log authentication failures for security monitoring
   - Use structured logging with consistent format

2. **Audit Logging**
   - Log successful profile retrievals (user ID, timestamp)
   - Track profile access patterns for analytics

## 8. Implementation Steps

### Phase 1: Infrastructure Setup

1. **Extend Supabase Service**
   - File: `src/app/services/supabase.service.ts`
   - Add profile management methods:
     - `getUserProfile(userId: string): Promise<ProfileDto | null>`
     - `createUserProfile(userId: string): Promise<ProfileDto>`

2. **Create Profile Service**
   - File: `src/app/services/profile.service.ts`
   - Methods:
     - `getCurrentUserProfile(): Promise<ProfileDto>`
     - Error handling for profile retrieval

3. **Update Error Classes**
   - File: `src/app/models/errors.ts`
   - Add `NotFoundError` class for 404 responses

### Phase 2: API Route Implementation

4. **Create API Route Handler**
   - File: `src/app/api/profiles/me/route.ts` (or appropriate Angular routing structure)
   - Implement GET handler with authentication middleware
   - Wire up profile service for data retrieval

5. **Implement Authentication Middleware**
   - Validate JWT token using Supabase Auth
   - Extract user ID from authenticated context
   - Handle authentication errors gracefully

6. **Implement Profile Retrieval Logic**
   - Query database for user profile using authenticated user ID
   - Handle profile not found scenarios
   - Implement automatic profile creation if enabled

### Phase 3: Error Handling & Testing

7. **Implement Comprehensive Error Handling**
   - Add try-catch blocks for all database operations
   - Map errors to appropriate HTTP status codes
   - Ensure all errors return `ErrorResponseDto` format

8. **Add Logging**
   - Implement error logging for failed requests
   - Add audit logging for successful profile access
   - Configure appropriate log levels
