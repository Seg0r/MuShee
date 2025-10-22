import type { Tables, TablesInsert, TablesUpdate } from './db/database.types';

// =============================================================================
// Base Entity Helpers
// =============================================================================
// Type aliases for database table rows to simplify DTO definitions

type ProfileRow = Tables<'profiles'>;
type SongRow = Tables<'songs'>;
type UserSongRow = Tables<'user_songs'>;
type RenderingFeedbackRow = Tables<'rendering_feedback'>;
type AiSuggestionFeedbackRow = Tables<'ai_suggestion_feedback'>;

// =============================================================================
// Shared Building Blocks
// =============================================================================

/**
 * Canonical representation of title/composer pairs derived from the songs table.
 * Used across song-related DTOs to maintain consistent metadata structure.
 */
export type SongDetailsDto = Pick<SongRow, 'title' | 'composer'>;

/**
 * Normalized pagination metadata shared by list endpoints.
 * Provides consistent pagination information across all list responses.
 */
export interface PaginationDto {
  page: number;
  limit: number;
  total_items: number;
  total_pages: number;
}

/**
 * All possible error codes used across the REST API.
 * Enables consistent error handling and user feedback.
 */
export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INVALID_REQUEST'
  | 'CONFLICT'
  | 'SERVICE_UNAVAILABLE'
  | 'REQUEST_TIMEOUT'
  | 'INTERNAL_ERROR'
  | 'INVALID_FILE_FORMAT'
  | 'INVALID_MUSICXML'
  | 'FILE_TOO_LARGE'
  | 'SONG_ALREADY_IN_LIBRARY'
  | 'SONG_NOT_FOUND'
  | 'SONG_NOT_IN_LIBRARY'
  | 'AI_SERVICE_UNAVAILABLE'
  | 'PROFILE_NOT_FOUND'
  | 'INVALID_PARAMETERS'
  | 'INVALID_RATING'
  | 'FEEDBACK_NOT_FOUND';

/**
 * Standardized error response envelope used across the REST API.
 * Provides consistent error structure for client-side error handling.
 */
export interface ErrorResponseDto {
  error: {
    code: ErrorCode;
    message: string;
  };
}

// =============================================================================
// Profile Management
// =============================================================================

/**
 * User profile data transfer object for GET /api/profiles/me.
 * Contains onboarding status and basic profile information.
 */
export type ProfileDto = Pick<ProfileRow, 'id' | 'updated_at' | 'has_completed_onboarding'>;

/**
 * Command for updating user profile via PATCH /api/profiles/me.
 * Typically used to mark onboarding as complete.
 */
export type UpdateProfileCommand = Pick<TablesUpdate<'profiles'>, 'has_completed_onboarding'>;

/**
 * Response DTO for profile update operations.
 * Returns the updated profile data after successful modification.
 */
export type UpdateProfileResponseDto = ProfileDto;

// =============================================================================
// Song Management
// =============================================================================

/**
 * Command for uploading MusicXML files via POST /api/songs.
 * Wraps the multipart file upload payload for song creation.
 */
export interface UploadSongCommand {
  file: File | Blob;
}

/**
 * Response DTO for song upload operations (POST /api/songs).
 * Includes song metadata, file hash, and library addition timestamp.
 * May indicate duplicate detection via is_duplicate flag.
 */
export interface UploadSongResponseDto {
  id: SongRow['id'];
  song_details: SongDetailsDto;
  file_hash: SongRow['file_hash'];
  created_at: SongRow['created_at'];
  added_to_library_at: UserSongRow['created_at'];
  /**
   * Indicates whether the upload was deduplicated against an existing song record.
   */
  is_duplicate?: boolean;
}

/**
 * Song access DTO for GET /api/songs/:songId.
 * Provides song metadata and a signed URL for MusicXML file download.
 */
export interface SongAccessDto {
  id: SongRow['id'];
  song_details: SongDetailsDto;
  file_hash: SongRow['file_hash'];
  created_at: SongRow['created_at'];
  musicxml_url: string;
}

/**
 * Individual song item in public domain catalog listings.
 * Contains basic metadata for display in browse views.
 */
export type PublicSongListItemDto = Pick<SongRow, 'id' | 'created_at'> & {
  song_details: SongDetailsDto;
};

/**
 * Response DTO for browsing public domain songs via GET /api/songs/public.
 * Includes paginated list of public songs with metadata.
 */
export interface PublicSongsListResponseDto {
  data: PublicSongListItemDto[];
  pagination: PaginationDto;
}

// =============================================================================
// User Library Management
// =============================================================================

/**
 * Individual song item in user's personal library.
 * Represents a song in the user's collection with addition timestamp.
 */
export interface UserLibraryItemDto {
  song_id: UserSongRow['song_id'];
  song_details: SongDetailsDto;
  added_at: UserSongRow['created_at'];
}

/**
 * Response DTO for GET /api/user-songs.
 * Returns paginated list of songs in the authenticated user's library.
 */
export interface UserLibraryListResponseDto {
  data: UserLibraryItemDto[];
  pagination: PaginationDto;
}

/**
 * Command for adding a song to user's library via POST /api/user-songs.
 * References an existing song by ID (typically from public catalog).
 */
export type AddUserSongCommand = Pick<TablesInsert<'user_songs'>, 'song_id'>;

/**
 * Response DTO for adding song to library (POST /api/user-songs).
 * Confirms the song-user association with metadata.
 */
export type AddUserSongResponseDto = Pick<UserSongRow, 'user_id' | 'song_id' | 'created_at'> & {
  song_details: SongDetailsDto;
};

/**
 * Command for removing a song from user's library via DELETE /api/user-songs/:songId.
 * Identifies the song to be removed by ID.
 */
export interface RemoveUserSongCommand {
  songId: SongRow['id'];
}

// =============================================================================
// AI-Powered Suggestions
// =============================================================================

/**
 * Reference to a song by its metadata (without database ID).
 * Used as input for AI suggestion generation requests.
 */
export interface SongReferenceDto {
  song_details: SongDetailsDto;
}

/**
 * Command for generating AI song suggestions via POST /api/ai/suggestions.
 * Sends user's current library songs to AI for analysis.
 */
export interface GenerateAiSuggestionsCommand {
  songs: SongReferenceDto[];
}

/**
 * Individual AI-suggested song item in recommendation response.
 * Contains metadata for a song recommended by the AI engine.
 */
export interface AiSuggestionItemDto {
  song_details: SongDetailsDto;
}

/**
 * Response DTO for AI suggestion generation (POST /api/ai/suggestions).
 * Returns AI-generated song recommendations and feedback tracking ID.
 */
export interface GenerateAiSuggestionsResponseDto {
  suggestions: AiSuggestionItemDto[];
  feedback_id: AiSuggestionFeedbackRow['id'];
}

/**
 * Individual suggestion with user rating for feedback submission.
 * Captures user's thumbs up/down rating for each AI suggestion.
 */
export interface AiSuggestionFeedbackSuggestionDto {
  title: SongDetailsDto['title'];
  composer: SongDetailsDto['composer'];
  user_rating: -1 | 1 | null;
}

/**
 * Command for updating AI suggestion feedback via PATCH /api/feedback/ai-suggestions/:feedbackId.
 * Submits batch ratings for all suggestions when user dismisses recommendation modal.
 */
export interface UpdateAiSuggestionFeedbackCommand {
  feedbackId: AiSuggestionFeedbackRow['id'];
  suggestions: AiSuggestionFeedbackSuggestionDto[];
}

/**
 * Response DTO for AI suggestion feedback update.
 * Returns calculated aggregate rating score and update timestamp.
 */
export type UpdateAiSuggestionFeedbackResponseDto = Pick<
  AiSuggestionFeedbackRow,
  'id' | 'rating_score' | 'updated_at'
>;

// =============================================================================
// Rendering Feedback
// =============================================================================

/**
 * Command for submitting rendering quality feedback via POST /api/feedback/rendering.
 * Captures user's thumbs up/down rating for sheet music rendering quality.
 */
export type SubmitRenderingFeedbackCommand = Pick<
  TablesInsert<'rendering_feedback'>,
  'song_id' | 'rating'
>;

/**
 * Response DTO for rendering feedback submission (POST /api/feedback/rendering).
 * Confirms the feedback record creation with all relevant details.
 */
export type SubmitRenderingFeedbackResponseDto = Pick<
  RenderingFeedbackRow,
  'id' | 'user_id' | 'song_id' | 'rating' | 'created_at'
>;
