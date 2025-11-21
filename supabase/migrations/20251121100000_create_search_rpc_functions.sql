-- Migration for full-text search RPC functions

-- Function to search public songs with ranking
CREATE OR REPLACE FUNCTION search_public_songs(
    p_search_term TEXT,
    p_limit INT,
    p_offset INT
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    composer TEXT,
    subtitle TEXT,
    created_at TIMESTAMPTZ,
    rank REAL,
    total_count BIGINT
) AS $$
DECLARE
    query tsquery;
    query_text TEXT;
BEGIN
    IF p_search_term IS NULL OR trim(p_search_term) = '' THEN
        RETURN; -- Return empty set if search term is blank
    END IF;

    -- Build tsquery text, then check if it's empty (e.g. from only stop words)
    query_text := regexp_replace(websearch_to_tsquery('simple', p_search_term)::text, '''(\w+)''', E'''\\1'':*', 'g');
    IF query_text = '' THEN
        RETURN; -- Return empty set if query is empty after processing
    END IF;

    query := to_tsquery('simple', query_text);

    RETURN QUERY
    WITH results AS (
        SELECT
            s.id,
            s.title::text,
            s.composer::text,
            s.subtitle::text,
            s.created_at,
            ts_rank(s.search_vector, query) as rank
        FROM songs s
        WHERE s.uploader_id IS NULL AND s.search_vector @@ query
    ),
    total AS (
        SELECT COUNT(*) as total_count FROM results
    )
    SELECT
        r.id,
        r.title,
        r.composer,
        r.subtitle,
        r.created_at,
        r.rank,
        t.total_count
    FROM results r, total t
    ORDER BY r.rank DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Function to search user library songs with ranking
CREATE OR REPLACE FUNCTION search_user_library_songs(
    p_user_id UUID,
    p_search_term TEXT,
    p_limit INT,
    p_offset INT
)
RETURNS TABLE (
    user_id UUID,
    song_id UUID,
    added_at TIMESTAMPTZ,
    title TEXT,
    composer TEXT,
    subtitle TEXT,
    rank REAL,
    total_count BIGINT
) AS $$
DECLARE
    query tsquery;
    query_text TEXT;
BEGIN
    IF p_search_term IS NULL OR trim(p_search_term) = '' THEN
        RETURN; -- Return empty set if search term is blank
    END IF;

    -- Build tsquery text, then check if it's empty (e.g. from only stop words)
    query_text := regexp_replace(websearch_to_tsquery('english', p_search_term)::text, '''(\w+)''', E'''\\1'':*', 'g');
    IF query_text = '' THEN
        RETURN; -- Return empty set if query is empty after processing
    END IF;

    query := to_tsquery('english', query_text);

    RETURN QUERY
    WITH results AS (
        SELECT
            us.user_id,
            us.song_id,
            us.created_at as added_at,
            s.title::text,
            s.composer::text,
            s.subtitle::text,
            ts_rank(s.search_vector, query) as rank
        FROM user_songs us
        JOIN songs s ON us.song_id = s.id
        WHERE us.user_id = p_user_id AND s.search_vector @@ query
    ),
    total AS (
        SELECT COUNT(*) as total_count FROM results
    )
    SELECT
        r.user_id,
        r.song_id,
        r.added_at,
        r.title,
        r.composer,
        r.subtitle,
        r.rank,
        t.total_count
    FROM results r, total t
    ORDER BY r.rank DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;
