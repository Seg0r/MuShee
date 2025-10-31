# Project: MuShee

## Project Overview

MuShee is a web-based sheet music library management application. It allows musicians to upload, organize, and view their sheet music using an AI-powered recommendation system to discover new pieces. The application is built with Angular and TypeScript on the frontend, and it uses Supabase for the backend, including database, authentication, and file storage.

### Key Technologies

*   **Frontend:** Angular, TypeScript, Angular Material, OpenSheetMusicDisplay
*   **Backend:** Supabase (PostgreSQL, Auth, Storage, Edge Functions)
*   **AI:** OpenRouter.ai for music recommendations
*   **Build & CI/CD:** Angular CLI, npm, GitHub Actions

## Building and Running

### Prerequisites

*   Node.js (version 18 or higher)
*   npm

### Installation and Setup

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Environment Variables:**
    Create a `.env` file in the root directory and add the following, replacing the placeholder values with your Supabase project details:
    ```
    SUPABASE_URL=your_supabase_project_url
    SUPABASE_ANON_KEY=your_supabase_anon_key
    ```

### Development Server

To run the application locally in development mode:

```bash
npm start
```

The application will be available at `http://localhost:4200`.

### Building for Production

To build the application for a production environment:

```bash
npm run build
```

The compiled assets will be placed in the `dist/mushee` directory.

### Testing

To run the unit tests:

```bash
npm test
```

## Development Conventions

### Linting and Formatting

The project uses ESLint for linting and Prettier for code formatting.

*   **Check for linting and formatting issues:**
    ```bash
    npm run lint
    npm run format:check
    ```

*   **Automatically fix linting and formatting issues:**
    ```bash
    npm run lint:fix
    npm run format
    ```

### Git Hooks

The project uses Husky to enforce code quality with a pre-commit hook that runs `lint-staged`. This ensures that all committed code is properly linted and formatted.

### Database

The database schema is managed through Supabase. The schema is detailed in `.ai/db-plan.md`. It includes tables for users, songs, user libraries, and feedback. Row-Level Security (RLS) is enabled on all tables to ensure data privacy.

### Seeding the Database

The project includes a script to seed the database with public domain scores.

1.  **Add Supabase Service Role Key to `.env`:**
    ```
    SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
    ```

2.  **Run the seed script:**
    ```bash
    npm run seed:scores
    ```
