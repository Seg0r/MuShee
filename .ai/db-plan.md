# MuShee - Database Schema Plan

This document outlines the PostgreSQL database schema for the MuShee application, designed based on the project's PRD, planning sessions, and technical stack.

## 1. Tables

### `public.songs`

This table stores the master record for every unique piece of music in the system. Uniqueness is determined by the MD5 hash of the MusicXML file content.

| Column        | Data Type      | Constraints                                   | Description                                                                       |
| :------------ | :------------- | :-------------------------------------------- | :-------------------------------------------------------------------------------- |
| `id`          | `uuid`         | `PRIMARY KEY`, `DEFAULT gen_random_uuid()`    | Unique identifier for the song.                                                   |
| `created_at`  | `timestamptz`  | `NOT NULL`, `DEFAULT now()`                   | Timestamp of when the song was first added.                                       |
| `composer`    | `varchar(200)` |                                               | The composer of the music piece, parsed from the MusicXML file.                   |
| `title`       | `varchar(200)` |                                               | The title of the music piece, parsed from the MusicXML file.                      |
| `file_hash`   | `text`         | `NOT NULL`, `UNIQUE`                          | MD5 hash of the MusicXML file content to prevent duplicates.                      |
| `uploader_id` | `uuid`         | `REFERENCES auth.users(id) ON DELETE CASCADE` | The user who originally uploaded the song. `NULL` indicates a public domain song. |

### `public.profiles`

This table extends Supabase's `auth.users` table to store application-specific public data for each user.

| Column                     | Data Type     | Constraints                                                  | Description                                                       |
| :------------------------- | :------------ | :----------------------------------------------------------- | :---------------------------------------------------------------- |
| `id`                       | `uuid`        | `PRIMARY KEY`, `REFERENCES auth.users(id) ON DELETE CASCADE` | Corresponds to the `id` in the `auth.users` table.                |
| `updated_at`               | `timestamptz` |                                                              | Timestamp of the last profile update.                             |
| `has_completed_onboarding` | `boolean`     | `NOT NULL`, `DEFAULT false`                                  | Flag to track if the user has seen the new user onboarding modal. |

### `public.user_songs`

A junction table that represents the many-to-many relationship between users and songs, forming each user's personal library.

| Column       | Data Type     | Constraints                                                  | Description                                                 |
| :----------- | :------------ | :----------------------------------------------------------- | :---------------------------------------------------------- |
| `user_id`    | `uuid`        | `PRIMARY KEY`, `REFERENCES auth.users(id) ON DELETE CASCADE` | The user's identifier.                                      |
| `song_id`    | `uuid`        | `PRIMARY KEY`, `REFERENCES songs(id) ON DELETE CASCADE`      | The song's identifier.                                      |
| `created_at` | `timestamptz` | `NOT NULL`, `DEFAULT now()`                                  | Timestamp of when the song was added to the user's library. |

### `public.rendering_feedback`

This table logs user feedback on the quality of sheet music rendering for a specific song.

| Column       | Data Type     | Constraints                                   | Description                                                         |
| :----------- | :------------ | :-------------------------------------------- | :------------------------------------------------------------------ |
| `id`         | `uuid`        | `PRIMARY KEY`, `DEFAULT gen_random_uuid()`    | Unique identifier for the feedback entry.                           |
| `user_id`    | `uuid`        | `REFERENCES auth.users(id) ON DELETE CASCADE` | The user providing the feedback.                                    |
| `song_id`    | `uuid`        | `REFERENCES songs(id) ON DELETE CASCADE`      | The song being rated.                                               |
| `rating`     | `smallint`    | `NOT NULL`, `CHECK (rating IN (1, -1))`       | The rating given by the user (1 for thumbs up, -1 for thumbs down). |
| `created_at` | `timestamptz` | `NOT NULL`, `DEFAULT now()`                   | Timestamp of when the feedback was submitted.                       |

### `public.ai_suggestion_feedback`

This table logs user feedback on the relevance of song suggestions provided by the AI.

| Column                | Data Type      | Constraints                                   | Description                                                                                    |
| :-------------------- | :------------- | :-------------------------------------------- | :--------------------------------------------------------------------------------------------- |
| `id`                  | `uuid`         | `PRIMARY KEY`, `DEFAULT gen_random_uuid()`    | Unique identifier for the feedback entry.                                                      |
| `user_id`             | `uuid`         | `REFERENCES auth.users(id) ON DELETE CASCADE` | The user providing the feedback.                                                               |
| `rating`              | `smallint`     | `NOT NULL`, `CHECK (rating IN (1, -1))`       | The rating (1 for thumbs up, -1 for thumbs down).                                              |
| `suggestion_title`    | `varchar(200)` | `NOT NULL`                                    | The title of the suggested song being rated.                                                   |
| `suggestion_composer` | `varchar(200)` | `NOT NULL`                                    | The composer of the suggested song being rated.                                                |
| `input_songs`         | `json`         | `NOT NULL`                                    | A JSON object or array containing the list of songs sent to the AI to generate the suggestion. |
| `created_at`          | `timestamptz`  | `NOT NULL`, `DEFAULT now()`                   | Timestamp of when the feedback was submitted.                                                  |

## 2. Relationships

- **`auth.users` ↔ `profiles`**: One-to-One. Each user has one profile.
- **`auth.users` ↔ `songs`**: Many-to-Many, via the `user_songs` junction table. A user can have many songs in their library, and a song can be in many users' libraries.
- **`auth.users` → `songs`**: One-to-Many (for uploads). A user can upload many songs, but each non-public song has only one original uploader.
- **`auth.users` → `rendering_feedback`**: One-to-Many. A user can provide feedback on many song renderings.
- **`auth.users` → `ai_suggestion_feedback`**: One-to-Many. A user can provide feedback on many AI suggestions.
- **`songs` → `rendering_feedback`**: One-to-Many. A song can have many feedback entries associated with it.

## 3. Indexes

- **Unique Index**:
  - `CREATE UNIQUE INDEX songs_file_hash_idx ON public.songs (file_hash);`
- **Foreign Key Indexes**: Indexes will be automatically created by PostgreSQL for all `PRIMARY KEY` and `UNIQUE` constraints. Manually creating indexes on foreign key columns is best practice to optimize join performance.
  - `CREATE INDEX ON public.songs (uploader_id);`
  - `CREATE INDEX ON public.user_songs (user_id);`
  - `CREATE INDEX ON public.user_songs (song_id);`
  - `CREATE INDEX ON public.rendering_feedback (user_id);`
  - `CREATE INDEX ON public.rendering_feedback (song_id);`
  - `CREATE INDEX ON public.ai_suggestion_feedback (user_id);`

## 4. PostgreSQL Policies (Row-Level Security)

RLS will be enabled on all tables to ensure data privacy and security.

### `profiles` table

- **Enable RLS**: `ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;`
- **Policy**: Users can only view and edit their own profile.
  ```sql
  CREATE POLICY "Users can manage their own profile"
  ON public.profiles FOR ALL
  USING (auth.uid() = id);
  ```

### `songs` table

- **Enable RLS**: `ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;`
- **Policy**: Users can view all public songs (`uploader_id IS NULL`) and any songs present in their personal library.
  ```sql
  CREATE POLICY "Users can view public songs and songs in their library"
  ON public.songs FOR SELECT
  USING (
    uploader_id IS NULL OR
    EXISTS (
      SELECT 1 FROM user_songs
      WHERE user_songs.song_id = songs.id AND user_songs.user_id = auth.uid()
    )
  );
  ```
- **Policy**: Authenticated users can insert new songs.
  ```sql
  CREATE POLICY "Authenticated users can insert songs"
  ON public.songs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
  ```

### `user_songs` table

- **Enable RLS**: `ALTER TABLE public.user_songs ENABLE ROW LEVEL SECURITY;`
- **Policy**: Users can only manage the songs in their own library.
  ```sql
  CREATE POLICY "Users can manage their own library"
  ON public.user_songs FOR ALL
  USING (auth.uid() = user_id);
  ```

### `rendering_feedback` and `ai_suggestion_feedback` tables

- **Enable RLS**:
  ```sql
  ALTER TABLE public.rendering_feedback ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.ai_suggestion_feedback ENABLE ROW LEVEL SECURITY;
  ```
- **Policy**: Users can only insert feedback for themselves. They cannot view, update, or delete any feedback entries.

  ```sql
  -- For rendering_feedback
  CREATE POLICY "Users can insert their own feedback"
  ON public.rendering_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

  -- For ai_suggestion_feedback
  CREATE POLICY "Users can insert their own feedback"
  ON public.ai_suggestion_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);
  ```

## 5. Additional Notes and Design Decisions

- **User Deletion**: Foreign keys referencing `auth.users(id)` use `ON DELETE CASCADE` (e.g., in `profiles`, `user_songs`, `feedback` and `songs` tables) to automatically clean up all of a user's personal data upon account deletion.
- **File Storage**: MusicXML files will be stored in Supabase Storage. The filename in storage will be the `file_hash` from the `songs` table, ensuring deterministic file paths and preventing duplicate file uploads.
- **Data Truncation**: `composer` and `title` fields are `varchar(200)`. The application logic must handle truncating any values longer than this limit before insertion.
- **Historical Ratings**: The `rendering_feedback` table intentionally lacks a unique constraint on `(user_id, song_id)`. The `created_at` column allows for a historical log of user feedback, enabling analysis of rendering quality improvements over time.
