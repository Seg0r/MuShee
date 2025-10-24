# API Endpoint Implementation Plan: Update Current User Profile

## 1. Endpoint Overview

This endpoint updates the authenticated user's profile information, primarily used to mark onboarding as complete. The endpoint provides a mechanism for users to update their profile state as they progress through the application, enabling personalized experiences and tracking user engagement with key application features. It supports partial updates while maintaining data integrity and security.

**Primary responsibilities:**

- Update authenticated user's profile data in the database
- Handle onboarding completion status updates
- Validate update requests and maintain data consistency
- Return updated profile information after successful modification
- Ensure atomic updates with proper error handling

## 2. Request Details

- **HTTP Method**: `PATCH`
- **URL Structure**: `/api/profiles/me`
- **Authentication**: Required (JWT via Supabase Auth)
- **Content-Type**: `application/json`

### Parameters

#### Optional:

- None (updates are applied to current authenticated user)

#### Request Body Structure

```json
{
  "has_completed_onboarding": true
}
```

## 3. Used Types

### From `src/types.ts`:

#### Request Types

```typescript
export type UpdateProfileCommand = Pick<TablesUpdate<'profiles'>, 'has_completed_onboarding'>;
```

#### Response Types

```typescript
export type UpdateProfileResponseDto = ProfileDto;
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
// - INVALID_REQUEST
// - PROFILE_NOT_FOUND
// - INTERNAL_ERROR
```

### Database Types (from generated types)

```typescript
TablesUpdate<'profiles'>; // For updating profile data
Tables<'profiles'>; // For querying updated profile data
```

## 4. Response Details

### Success Response

#### 200 OK

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "updated_at": "2025-10-22T10:35:00.000Z",
  "has_completed_onboarding": true
}
```

### Error Responses

#### 400 Bad Request

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "has_completed_onboarding must be a boolean"
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
    "message": "An unexpected error occurred while updating profile"
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
│ Validation Passed?                │
├───────────────┬───────────────────┤
│ YES           │ NO                │
│               │                   │
│ Query Profile │ Return 400        │
│ Existence     │ Bad Request       │
│               │                   │
│ Profile       │                   │
│ Exists?       ├───────────────────┤
│ ┌─────┴─────┐ │                   │
│ │ YES       │ │                   │
│ │           │ │                   │
│ │ Update    │ │                   │
│ │ Profile   │ │                   │
│ │ (200 OK)  │ │                   │
│ │           │ │                   │
│ │ NO        │ │                   │
│ │           │ │                   │
│ │ 404 Not   │ │                   │
│ │ Found     │ │                   │
│ └───────────┘ │                   │
└───────────────┴───────────────────┘
    ↓
Return Updated ProfileDto
```

### Detailed Step-by-Step Flow

1. **Request Reception**
   - API route receives PATCH request to `/api/profiles/me`
   - Parse JSON request body for update fields

2. **Authentication Check**
   - Extract JWT token from `Authorization: Bearer <token>` header
   - Validate token with Supabase Auth service
   - Extract user ID from authenticated token context
   - Return 401 if authentication fails

3. **Request Validation**
   - Validate request body is valid JSON
   - Check that `has_completed_onboarding` is boolean if provided
   - Reject requests with invalid field types or values
   - Return 400 for validation failures

4. **Profile Existence Check**
   - Query `profiles` table to verify profile exists for user
   - Use user ID from authentication context
   - Return 404 if profile doesn't exist

5. **Profile Update**
   - Perform atomic update of profile record
   - Update `has_completed_onboarding` field if provided
   - Automatically update `updated_at` timestamp
   - Use database transaction for consistency

6. **Retrieve Updated Profile**
   - Query updated profile data after successful update
   - Ensure all fields are properly returned
   - Handle any post-update query failures

7. **Response Construction**
   - Build `UpdateProfileResponseDto` from updated data
   - Return JSON response with 200 OK status
   - Include updated timestamp in response

## 6. Security Considerations

### Authentication & Authorization

1. **JWT Token Validation**
   - Mandatory authentication for all profile update requests
   - Validate JWT token integrity and signature
   - Extract user identity from authenticated context
   - Prevent unauthorized profile modifications

2. **Row-Level Security (RLS)**
   - Database policies restrict updates to user's own profile
   - RLS enforcement: `auth.uid() = id` for profile updates
   - Automatic security prevents cross-user data modification

### Input Validation

1. **Request Body Validation**
   - Validate Content-Type is `application/json`
   - Ensure request body is valid JSON format
   - Validate field types and allowed values
   - Prevent injection attacks through proper sanitization

2. **Field-Level Validation**
   - `has_completed_onboarding`: Must be boolean (true/false)
   - Reject null values for required boolean fields
   - Implement strict type checking

### Data Integrity

1. **Atomic Updates**
   - Use database transactions for update operations
   - Ensure update and retrieval happen atomically
   - Rollback on any failure to maintain consistency

2. **Audit Trail**
   - Log all profile update operations
   - Track user ID, timestamp, and changed fields
   - Monitor for suspicious update patterns

## 7. Error Handling

### Error Scenarios

| Scenario                | HTTP Code | Error Code        | Handling Strategy                      |
| ----------------------- | --------- | ----------------- | -------------------------------------- |
| Missing authentication  | 401       | UNAUTHORIZED      | Check Authorization header             |
| Invalid/expired token   | 401       | UNAUTHORIZED      | Validate with Supabase Auth            |
| Invalid JSON body       | 400       | INVALID_REQUEST   | Parse JSON and catch syntax errors     |
| Wrong field types       | 400       | INVALID_REQUEST   | Validate field types against schema    |
| Profile not found       | 404       | PROFILE_NOT_FOUND | Query returns no rows before update    |
| Database update error   | 500       | INTERNAL_ERROR    | Handle Supabase update failures        |
| Post-update query error | 500       | INTERNAL_ERROR    | Handle retrieval failures after update |

### Error Handling Pattern

Implement comprehensive error handling with proper error classification:

1. **Authentication Errors**: Detect Supabase Auth failures and return 401
2. **Validation Errors**: Check request format and field validation, return 400
3. **Not Found Errors**: Handle missing profiles with 404 and PROFILE_NOT_FOUND
4. **Database Errors**: Catch Supabase operation failures and return 500
5. **Transaction Errors**: Ensure atomic operations with proper rollback

### Logging Strategy

1. **Error Logging**
   - Log all validation and database errors with context
   - Include user ID, request payload, and error details
   - Use structured logging for analysis

2. **Audit Logging**
   - Log successful profile updates (user ID, changed fields, timestamp)
   - Track onboarding completion events for analytics
   - Monitor update frequency and patterns

## 8. Implementation Steps

### Phase 1: Infrastructure Setup

1. **Extend Supabase Service**
   - File: `src/app/services/supabase.service.ts`
   - Add profile update methods:
     - `updateUserProfile(userId: string, updates: UpdateProfileCommand): Promise<ProfileDto>`

2. **Update Profile Service**
   - File: `src/app/services/profile.service.ts`
   - Add update method:
     - `updateCurrentUserProfile(updates: UpdateProfileCommand): Promise<UpdateProfileResponseDto>`
   - Include validation and error handling

3. **Add Validation Logic**
   - Implement request body validation
   - Add field type checking for profile updates
   - Create validation error handling

### Phase 2: API Route Implementation

4. **Create API Route Handler**
   - File: `src/app/api/profiles/me/route.ts` (or appropriate Angular routing structure)
   - Implement PATCH handler with authentication
   - Add request body parsing and validation

5. **Implement Request Validation**
   - Validate JSON request body structure
   - Check field types and allowed values
   - Return appropriate 400 errors for invalid requests

6. **Implement Profile Update Logic**
   - Check profile existence before update
   - Perform atomic profile update operation
   - Retrieve and return updated profile data

### Phase 3: Error Handling & Testing

7. **Implement Comprehensive Error Handling**
   - Add error handling for all operation stages
   - Map errors to appropriate HTTP responses
   - Ensure consistent error response format

8. **Add Logging**
   - Log basic flow to console
   - Add error logging with full context
   - Configure appropriate log levels
