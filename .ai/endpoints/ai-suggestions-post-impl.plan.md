# API Endpoint Implementation Plan: Get AI Song Suggestions

## 1. Endpoint Overview

This endpoint generates AI-powered song recommendations based on the user's current library collection. The endpoint sends the user's song metadata to an external AI service (OpenRouter.ai) and returns personalized suggestions for new music to explore. It includes a strict 3-second timeout requirement and comprehensive error handling for AI service failures. The endpoint also creates a feedback record for tracking user ratings of the suggestions.

**Primary responsibilities:**

- Collect user's current song library for AI analysis
- Send song metadata to OpenRouter.ai API with timeout constraints
- Process AI-generated recommendations and format response
- Create feedback tracking record for suggestion ratings
- Handle AI service failures gracefully with user-friendly messages
- Implement strict 3-second timeout as per PRD requirements

## 2. Request Details

- **HTTP Method**: `POST`
- **URL Structure**: `/api/ai/suggestions`
- **Authentication**: Required (JWT via Supabase Auth)
- **Content-Type**: `application/json`
- **Timeout**: 3 seconds (per PRD requirements)

### Parameters

#### Optional:

- None (uses current authenticated user's library)

#### Request Body Structure

```json
{
  "songs": [
    {
      "song_details": {
        "composer": "Ludwig van Beethoven",
        "title": "Moonlight Sonata"
      }
    },
    {
      "song_details": {
        "composer": "Frédéric Chopin",
        "title": "Nocturne Op. 9 No. 2"
      }
    }
  ]
}
```

## 3. Used Types

### From `src/types.ts`:

#### Request Types

```typescript
export interface GenerateAiSuggestionsCommand {
  songs: SongReferenceDto[];
}

export interface SongReferenceDto {
  song_details: SongDetailsDto;
}
```

#### Response Types

```typescript
export interface GenerateAiSuggestionsResponseDto {
  suggestions: AiSuggestionItemDto[];
  feedback_id: AiSuggestionFeedbackRow['id'];
}

export interface AiSuggestionItemDto {
  song_details: SongDetailsDto;
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
// - INVALID_REQUEST
// - AI_SERVICE_UNAVAILABLE
// - REQUEST_TIMEOUT
// - INTERNAL_ERROR
```

### Database Types (from generated types)

```typescript
Tables<'ai_suggestion_feedback'>; // For creating feedback records
Tables<'user_songs'>; // For retrieving user's library
Tables<'songs'>; // For joining with song metadata
```

## 4. Response Details

### Success Response

#### 200 OK

```json
{
  "suggestions": [
    {
      "song_details": {
        "composer": "Franz Schubert",
        "title": "Impromptu in G-flat Major"
      }
    },
    {
      "song_details": {
        "composer": "Claude Debussy",
        "title": "Clair de Lune"
      }
    },
    {
      "song_details": {
        "composer": "Erik Satie",
        "title": "Gymnopédie No. 1"
      }
    }
  ],
  "feedback_id": "550e8400-e29b-41d4-a716-446655440002"
}
```

### Error Responses

#### 400 Bad Request

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "At least one song is required to generate suggestions"
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

#### 503 Service Unavailable

```json
{
  "error": {
    "code": "AI_SERVICE_UNAVAILABLE",
    "message": "Sorry, we couldn't fetch suggestions at this time. Please try again later."
  }
}
```

#### 504 Gateway Timeout

```json
{
  "error": {
    "code": "REQUEST_TIMEOUT",
    "message": "The request took too long. Please try again."
  }
}
```

#### 500 Internal Server Error

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred while generating suggestions"
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
Extract User ID + Optional Request Body
    ↓
┌─────────────────┴─────────────────┐
│ Request Body Provided?            │
├───────────────┬───────────────────┤
│ YES           │ NO                │
│               │                   │
│ Validate      │ Retrieve User's   │
│ Provided      │ Current Library   │
│ Songs         │ from Database     │
│               │                   │
│ Use Provided  │ Use Library       │
│ Songs         │ Songs             │
│               │                   │
│ Validate Song │                   │
│ Count (≥1)    │                   │
│ ┌─────┴─────┐ │                   │
│ │ Valid      │ │                   │
│ │            │ │                   │
│ │ Send to AI │ │                   │
│ │ Service    │ │                   │
│ │ (3s timeout)│ │                   │
│ │            │ │                   │
│ │ ┌─────┴─────┐ │                   │
│ │ │ Success   │ │                   │
│ │ │           │ │                   │
│ │ │ Create    │ │                   │
│ │ │ Feedback  │ │                   │
│ │ │ Record    │ │                   │
│ │ │           │ │                   │
│ │ │ Return    │ │                   │
│ │ │ 200 OK    │ │                   │
│ │ │           │ │                   │
│ │ │ Timeout   │ │                   │
│ │ │           │ │                   │
│ │ │ AI Error  │ │                   │
│ │ │ 503/504   │ │                   │
│ │ └───────────┘ │                   │
│ └─────────────┴───────────────────┘
│               │
│ Invalid       │
│               │
│ 400 Bad       │
│ Request       │
└───────────────┴───────────────────┘
    ↓
Return GenerateAiSuggestionsResponseDto
```

### Detailed Step-by-Step Flow

1. **Request Initiation**
   - Angular component/service initiates AI suggestions request
   - Calls `AiService.generateSuggestions(songs)`
   - Service invokes Supabase Edge Function `ai-suggestions`
   - Edge Function receives and parses request payload

2. **Authentication Check (in Edge Function)**
   - Supabase Edge Function receives authenticated context automatically
   - Extract user ID from `context.user` or `supabase.auth.getUser()`
   - Edge Function has access to authenticated Supabase client
   - Handle authentication errors if user is not authenticated

3. **Song Collection Logic**
   - **If request body provided**: Use songs from request payload
   - **If no request body**: Query user's current library from database
   - Validate that at least one song is available
   - Return 400 if no songs available for analysis

4. **AI Service Call**
   - Format song data for OpenRouter.ai API
   - Send request with 3-second timeout
   - Handle various AI service response scenarios

5. **Response Processing**
   - **Success**: Parse AI suggestions and validate format
   - **Timeout**: Return 504 Gateway Timeout
   - **Service Error**: Return 503 Service Unavailable
   - **Other Errors**: Return appropriate error responses

6. **Feedback Record Creation**
   - Create record in `ai_suggestion_feedback` table
   - Store input songs and AI suggestions for rating
   - Generate feedback_id for client-side rating submission

7. **Response Construction**
   - Build `GenerateAiSuggestionsResponseDto` with suggestions and feedback_id
   - Return JSON response with 200 OK status
   - Ensure suggestions are properly formatted

## 6. Security Considerations

### Authentication & Authorization

1. **JWT Token Validation**
   - Mandatory authentication for all AI suggestion requests
   - Validate token integrity and prevent anonymous usage
   - Extract user identity for feedback record association

2. **Row-Level Security (RLS)**
   - Database policies control access to user's library data
   - RLS ensures users can only access their own song collections
   - Automatic enforcement prevents unauthorized data access

### Input Validation

1. **Request Body Validation**
   - Validate Content-Type is `application/json` when body provided
   - Ensure song array contains valid song references
   - Validate composer and title fields are present and reasonable
   - Prevent injection attacks through proper validation

2. **Song Count Validation**
   - Require at least one song for meaningful AI analysis
   - Prevent empty requests that would waste AI service resources
   - Validate both provided songs and library retrieval scenarios

### External Service Security

1. **AI Service Authentication**
   - Secure API key management for OpenRouter.ai
   - Use environment variables for sensitive credentials
   - Implement proper key rotation and access controls

2. **Timeout Protection**
   - Strict 3-second timeout prevents resource exhaustion
   - Fail fast on AI service unavailability
   - Prevent long-running requests from blocking server resources

### Data Privacy

1. **Song Data Transmission**
   - Only transmit necessary metadata (composer, title)
   - No sensitive user data sent to external AI service
   - Minimize data exposure for privacy protection

2. **Feedback Data Storage**
   - Store user feedback records with proper user association
   - Implement data retention policies for feedback records
   - Ensure feedback data is properly secured

## 7. Error Handling

### Error Scenarios

| Scenario               | HTTP Code | Error Code             | Handling Strategy                        |
| ---------------------- | --------- | ---------------------- | ---------------------------------------- |
| Missing authentication | 401       | UNAUTHORIZED           | Check Authorization header               |
| Invalid/expired token  | 401       | UNAUTHORIZED           | Validate with Supabase Auth              |
| Empty song list        | 400       | INVALID_REQUEST        | Validate at least one song provided      |
| Invalid song format    | 400       | INVALID_REQUEST        | Validate song object structure           |
| AI service timeout     | 504       | REQUEST_TIMEOUT        | Handle 3-second timeout expiration       |
| AI service error       | 503       | AI_SERVICE_UNAVAILABLE | Handle OpenRouter.ai failures            |
| Network connectivity   | 503       | AI_SERVICE_UNAVAILABLE | Handle connection failures               |
| Database error         | 500       | INTERNAL_ERROR         | Handle feedback record creation failures |

### Error Handling Pattern

Implement comprehensive error handling for AI service integration:

1. **Authentication Errors**: Detect token issues and return 401
2. **Validation Errors**: Check request format and content, return 400
3. **AI Service Errors**: Handle timeouts (504) and failures (503)
4. **Database Errors**: Catch Supabase operation failures with 500
5. **Network Errors**: Treat connectivity issues as service unavailable

### Logging Strategy

1. **Error Logging**
   - Log AI service failures with detailed error information
   - Log timeout events for performance monitoring
   - Include user ID and request context in logs

2. **Audit Logging**
   - Log successful AI suggestion generations
   - Track usage patterns and popular request times
   - Monitor AI service response times and reliability

## 8. Implementation Steps

### Phase 1: Infrastructure Setup

1. **Create AI Service for Edge Function Invocation**
   - File: `src/app/services/ai.service.ts`
   - Methods:
     - `generateSuggestions(songs: SongReferenceDto[]): Promise<AiSuggestionItemDto[]>`
     - Invoke Supabase Edge Function via `supabase.functions.invoke('ai-suggestions')`
   - Implement timeout logic and error handling

2. **Extend Supabase Service**
   - File: `src/app/services/supabase.service.ts`
   - Add AI feedback methods:
     - `createAiSuggestionFeedback(data: CreateAiFeedbackDto): Promise<AiSuggestionFeedbackRow>`

3. **Create AI Suggestions Service**
   - File: `src/app/services/ai-suggestions.service.ts`
   - Methods:
     - `generateSuggestionsForUser(userId: string, songs?: SongReferenceDto[]): Promise<GenerateAiSuggestionsResponseDto>`

4. **Add Timeout Utilities**
   - Implement timeout wrapper for external API calls
   - Add proper cleanup for timed-out requests

### Phase 2: Supabase Edge Function Implementation

5. **Create Supabase Edge Function**
   - File: `supabase/functions/ai-suggestions/index.ts`
   - Implement Edge Function handler with Supabase Auth context
   - Parse request body and validate

6. **Implement Song Collection Logic**
   - Handle optional request body vs database retrieval via Edge Function
   - Query user's library using Supabase client in Edge Function
   - Validate song count and format requirements

7. **Implement AI Service Integration**
   - Call OpenRouter.ai API from Edge Function with timeout
   - Store OpenRouter.ai API key in Edge Function secrets
   - Handle various response scenarios appropriately
   - Implement retry logic for transient failures

### Phase 3: Error Handling & Testing

8. **Implement Comprehensive Error Handling**
   - Add error handling for all operation stages
   - Map errors to appropriate HTTP responses
   - Ensure consistent error response format

9. **Add Logging**
   - Log basic flow to console
   - Configure appropriate log levels
