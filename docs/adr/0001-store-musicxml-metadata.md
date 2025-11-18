# ADR-0001: Store MusicXML Metadata Attributes for Seeded Scores

- **Status**: Accepted
- **Date**: 2025-11-18
- **Relevant Issues**: None

## Context

MuShee imports a curated set of public-domain MusicXML scores via `scripts/seed-scores.ts` so that our library has a rich starting point. The onboarding flows, song tiles, and AI recommendation engine now surface more than just the raw title/composer pair – they depend on richer “score types” (movements, suites, arrangements, etc.) and metadata attributes such as movement subtitles to describe what the user is looking at. Until now this metadata lived only in the MusicXML content and had to be re-parsed on demand, which led to inconsistent UI text, slower discovery, and uncertainty about which rows could safely be shown to the user.

At the same time, the frontend assumes that every song already has both a title and a composer so it can render metadata cards without defensive fallbacks. The database schema allowed those columns to be nullable, meaning public-domain seeds could slip through without the required information and later fail when the UI tried to render them. We needed a way to both persist the optional movement metadata and to guarantee that the basic metadata our UI expects is present before we surface seeded scores.

Alternative approaches included continuing to store metadata only in the MusicXML files and parsing it on each read or adding derived columns in materialized views. Those approaches forced the UI to re-parse and still didn’t provide a canonical, queryable representation of the new score types, so we rejected them in favor of extending the song schema and seed pipeline directly.

## Decision

We extended the canonical `public.songs` table and the seeding pipeline so that music metadata is stored explicitly:

1. Added a nullable `subtitle` column (varchar(200)) to `public.songs` with documentation describing how it maps to movement numbers/titles. This lets the database capture the “type” of score (e.g., Movement I – Allegro) as a first-class attribute that queries and UI components can surface without reparsing MusicXML.
2. Updated the Supabase seed script to parse and clean the subtitle information it already reads (movement number/title) and persist it alongside the title/composer/file hash. The script also now logs this richer metadata during seeding so operators understand which score types are being imported.
3. Normalized existing song rows (set null titles/composers to empty strings) and enforced `NOT NULL` on `title` and `composer` to match the UI’s assumptions. This ensures new seeds cannot enter the system with missing foundational metadata.

## Consequences

- **Positive**: The application can now surface score type metadata (movement subtitles) without reopening MusicXML files, making song tiles, explorer filters, and AI suggestions richer and more consistent. UI components can stop defensively checking for null titles/composers because the database enforces their presence.
- **Neutral**: Seed data requires a one-time migration run to populate the new column and to sanitize existing rows, but the process is already covered by the new SQL migrations and extended seed script.
- **Negative**: Any future change to the MusicXML metadata extraction must be carefully synchronized between the seed script and any runtime parser so they stay aligned. The schema change also requires updating Supabase clients (`src/db/database.types.ts`) so TypeScript code can access `subtitle`.
