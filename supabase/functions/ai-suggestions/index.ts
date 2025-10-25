import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { Database } from '../../../src/db/database.types.ts';
import type {
  GenerateAiSuggestionsCommand,
  GenerateAiSuggestionsResponseDto,
  SongReferenceDto,
  AiSuggestionItemDto,
  ErrorResponseDto,
} from '../../../src/types.ts';

// =============================================================================
// Configuration
// =============================================================================

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const AI_MODEL = 'anthropic/claude-3-haiku:beta'; // Cost-effective model for this use case

// =============================================================================
// CORS Headers
// =============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// =============================================================================
// Error Response Helpers
// =============================================================================

function createErrorResponse(code: string, message: string, status = 400): Response {
  const errorResponse: ErrorResponseDto = {
    error: { code, message },
  };

  return new Response(JSON.stringify(errorResponse), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// =============================================================================
// AI Service Integration
// =============================================================================

/**
 * Calls OpenRouter.ai API to generate song recommendations based on user's library.
 * Uses a structured prompt to ensure consistent, high-quality suggestions.
 */
async function callOpenRouterAI(songs: SongReferenceDto[]): Promise<AiSuggestionItemDto[]> {
  const openRouterApiKey = Deno.env.get('OPENROUTER_API_KEY');
  if (!openRouterApiKey) {
    throw new Error('AI_SERVICE_UNAVAILABLE');
  }

  // Format songs for the AI prompt
  const songsText = songs
    .map(song => `- "${song.song_details.title}" by ${song.song_details.composer}`)
    .join('\n');

  const prompt = `You are a music recommendation expert. Based on the following songs in a user's music library, suggest 3 similar classical pieces they might enjoy. Focus on musical style, composer, era, and mood similarities.

User's Library:
${songsText}

Please respond with exactly 3 song recommendations in the following JSON format:
[
  {
    "song_details": {
      "title": "Song Title",
      "composer": "Composer Name"
    }
  },
  {
    "song_details": {
      "title": "Another Song Title",
      "composer": "Another Composer Name"
    }
  },
  {
    "song_details": {
      "title": "Third Song Title",
      "composer": "Third Composer Name"
    }
  }
]

Requirements:
- Suggest real, existing classical music pieces
- Ensure variety in composers and styles
- Focus on pieces that would complement the user's existing collection
- Only return the JSON array, no additional text`;

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openRouterApiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://mushee.app', // Required by OpenRouter
      'X-Title': 'MuShee Music Library',
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    console.error('OpenRouter API error:', response.status, response.statusText);
    throw new Error('AI_SERVICE_UNAVAILABLE');
  }

  const data = await response.json();

  if (!data.choices?.[0]?.message?.content) {
    console.error('Invalid OpenRouter response format:', data);
    throw new Error('AI_SERVICE_UNAVAILABLE');
  }

  try {
    const suggestions: AiSuggestionItemDto[] = JSON.parse(data.choices[0].message.content);

    // Validate response structure
    if (!Array.isArray(suggestions) || suggestions.length !== 3) {
      console.error('AI returned invalid suggestions format:', suggestions);
      throw new Error('AI_SERVICE_UNAVAILABLE');
    }

    // Validate each suggestion
    for (const suggestion of suggestions) {
      if (!suggestion.song_details?.title || !suggestion.song_details?.composer) {
        console.error('AI suggestion missing required fields:', suggestion);
        throw new Error('AI_SERVICE_UNAVAILABLE');
      }
    }

    return suggestions;
  } catch (parseError) {
    console.error(
      'Failed to parse AI response as JSON:',
      data.choices[0].message.content,
      parseError
    );
    throw new Error('AI_SERVICE_UNAVAILABLE');
  }
}

// =============================================================================
// Database Operations
// =============================================================================

/**
 * Retrieves a user's song library for AI analysis.
 */
async function getUserLibrary(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<SongReferenceDto[]> {
  const { data, error } = await supabase
    .from('user_songs')
    .select(
      `
      songs!inner (
        title,
        composer
      )
    `
    )
    .eq('user_id', userId)
    .limit(100); // Reasonable limit for AI analysis

  if (error) {
    console.error('Database error retrieving user library:', error);
    throw new Error('INTERNAL_ERROR');
  }

  return (data || []).map((item: { songs: { title: string; composer: string } }) => ({
    song_details: {
      title: item.songs.title || '',
      composer: item.songs.composer || '',
    },
  }));
}

/**
 * Creates a feedback record for tracking user ratings of AI suggestions.
 */
async function createFeedbackRecord(
  supabase: SupabaseClient<Database>,
  userId: string,
  inputSongs: SongReferenceDto[],
  suggestions: AiSuggestionItemDto[]
): Promise<string> {
  const { data, error } = await supabase
    .from('ai_suggestion_feedback')
    .insert({
      user_id: userId,
      input_songs: inputSongs,
      suggestions: suggestions,
      rating_score: 0,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Database error creating feedback record:', error);
    throw new Error('INTERNAL_ERROR');
  }

  return data.id;
}

// =============================================================================
// Main Edge Function Handler
// =============================================================================

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return createErrorResponse('INVALID_REQUEST', 'Method not allowed', 405);
  }

  try {
    // Initialize Supabase client with service role for Edge Function
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

    // Get authenticated user from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return createErrorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));

    if (authError || !user) {
      console.error('Authentication error:', authError);
      return createErrorResponse('UNAUTHORIZED', 'Invalid authentication token', 401);
    }

    const userId = user.id;
    console.log('Authenticated user:', userId);

    // Parse and validate request body
    let requestBody: GenerateAiSuggestionsCommand | undefined;

    try {
      const bodyText = await req.text();
      if (bodyText) {
        requestBody = JSON.parse(bodyText);
      }
    } catch (parseError) {
      console.error('Request body parse error:', parseError);
      return createErrorResponse('INVALID_REQUEST', 'Invalid JSON in request body', 400);
    }

    // Determine which songs to use for analysis
    let songsForAnalysis: SongReferenceDto[];

    if (requestBody?.songs && Array.isArray(requestBody.songs) && requestBody.songs.length > 0) {
      // Use provided songs
      songsForAnalysis = requestBody.songs;
      console.log('Using provided songs for analysis:', songsForAnalysis.length);
    } else {
      // Retrieve user's library
      console.log('Retrieving user library for analysis');
      songsForAnalysis = await getUserLibrary(supabase, userId);

      if (songsForAnalysis.length === 0) {
        return createErrorResponse(
          'INVALID_REQUEST',
          'At least one song is required to generate suggestions. Add songs to your library or provide them in the request.',
          400
        );
      }
    }

    // Validate song data
    for (const song of songsForAnalysis) {
      if (!song.song_details?.title || !song.song_details?.composer) {
        return createErrorResponse(
          'INVALID_REQUEST',
          'All songs must have title and composer information',
          400
        );
      }
    }

    // Call AI service with 3-second timeout (implemented at client level)
    console.log('Calling AI service for suggestions');
    const suggestions = await callOpenRouterAI(songsForAnalysis);

    // Create feedback record
    console.log('Creating feedback record');
    const feedbackId = await createFeedbackRecord(supabase, userId, songsForAnalysis, suggestions);

    // Return successful response
    const response: GenerateAiSuggestionsResponseDto = {
      suggestions,
      feedback_id: feedbackId,
    };

    console.log('AI suggestions generated successfully:', {
      userId,
      suggestionCount: suggestions.length,
      feedbackId,
    });

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Unexpected error in Edge Function:', error);

    // Handle specific error types
    if (error instanceof Error) {
      switch (error.message) {
        case 'AI_SERVICE_UNAVAILABLE':
          return createErrorResponse(
            'AI_SERVICE_UNAVAILABLE',
            "Sorry, we couldn't fetch suggestions at this time. Please try again later.",
            503
          );
        case 'INTERNAL_ERROR':
          return createErrorResponse(
            'INTERNAL_ERROR',
            'An unexpected error occurred while generating suggestions',
            500
          );
        default:
          return createErrorResponse(
            'INTERNAL_ERROR',
            'An unexpected error occurred while generating suggestions',
            500
          );
      }
    }

    return createErrorResponse(
      'INTERNAL_ERROR',
      'An unexpected error occurred while generating suggestions',
      500
    );
  }
});
