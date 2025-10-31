# MuShee 🎵

A web-based sheet music library management application that helps musicians organize, access, and discover sheet music through AI-powered recommendations.

## Table of Contents

- [Project Description](#project-description)
- [Tech Stack](#tech-stack)
- [Getting Started Locally](#getting-started-locally)
- [Available Scripts](#available-scripts)
- [Project Scope](#project-scope)
- [Project Status](#project-status)
- [License](#license)

## Project Description

MuShee is a comprehensive web application designed to solve the common problem musicians face when managing disorganized collections of sheet music. Instead of scattered PDF files, physical books, and bookmarks, MuShee provides a centralized, accessible digital library where musicians can upload, organize, and render their MusicXML files into readable sheet music.

### Key Features

- **User Account Management**: Secure registration and login with email/password authentication
- **Song Library Management**: Upload MusicXML files, view library as organized tiles, delete unwanted songs
- **Pre-loaded Content Library**: Access to public domain compositions that can be added to personal collections
- **Sheet Music Rendering**: Clean, readable sheet music display using OpenSheetMusicDisplay
- **AI-Powered Recommendations**: Discover similar music through intelligent suggestions via OpenRouter.ai
- **User Feedback System**: Rate rendering quality and AI suggestion relevance to improve the platform
- **New User Onboarding**: Guided introduction for first-time users

### Target Users

Musicians who want to centralize their sheet music collection and discover new pieces to play through intelligent recommendations.

## Tech Stack

### Frontend

- **Angular 19** - Full-featured SPA framework providing routing, forms, HTTP client, and application structure
- **TypeScript 5** - Static code typing and enhanced IDE support
- **Angular Material** - UI component library for consistent, modern interface design
- **OpenSheetMusicDisplay** - Open-source JavaScript library for parsing and rendering MusicXML files

### Backend

- **Supabase** - Comprehensive backend solution providing:
  - PostgreSQL database with Row Level Security (RLS)
  - Built-in user authentication and session management
  - File storage and management for MusicXML files
  - Client-side SDK for direct database and auth operations
  - Edge Functions for server-side operations (external API calls)

### AI

- **OpenRouter.ai** - Access to multiple AI models (OpenAI, Anthropic, Google, etc.) for music recommendations with cost controls

### CI/CD and Hosting

- **GitHub Actions** - Automated CI/CD pipelines
- **DigitalOcean** - Application hosting via Docker containers

## Getting Started Locally

### Prerequisites

- Node.js (version 18 or higher)
- npm or yarn package manager
- Git

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/your-username/mushee.git
   cd mushee
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create a `.env` file in the root directory and configure the following:

   ```env
   # Supabase Configuration
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

   **Note**: The OpenRouter.ai API key is stored securely in Supabase Edge Functions, not in client-side environment variables.

4. **Start the development server**

   ```bash
   npm start
   ```

5. **Open your browser**

   Navigate to `http://localhost:4200` to access the application.

### Database Setup

1. Create a new project on [Supabase](https://supabase.com)
2. Set up authentication tables and storage buckets
3. Configure Row Level Security (RLS) policies for user data isolation
4. Run database migrations if any are provided in the project

### Seeding Public Domain Scores

The application comes with pre-loaded public domain sheet music scores. To seed these scores into your database:

1. **Ensure your database schema is set up** (run migrations first)

2. **Set up additional environment variables** for seeding:

   Add to your `.env` file:

   ```env
   # Supabase Service Role Key (required for seeding)
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   ```

   **Note**: The service role key has admin privileges and should be kept secure. Never commit it to version control.

3. **Run the seeding script**:

   ```bash
   npm run seed:scores
   ```

   This will:
   - Parse MusicXML files from `src/assets/scores/`
   - Extract metadata (composer, title) from each file
   - Upload files to Supabase Storage
   - Create database records with `uploader_id = NULL` (public domain)

4. **Verify the seeding**:

   The script will output a summary of successfully seeded and failed files. Check your Supabase dashboard to confirm the scores appear in the `songs` table and storage bucket.

#### GitHub Actions (Optional CI/CD)

For automated seeding in production, use the provided GitHub Actions workflow:

1. Set up the following secrets in your GitHub repository:
   - `SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key

2. Trigger the workflow manually from the Actions tab or call it from another workflow after database migrations.

## Available Scripts

| Command                | Description                                              |
| ---------------------- | -------------------------------------------------------- |
| `npm start`            | Starts the development server at `http://localhost:4200` |
| `npm run build`        | Builds the application for production                    |
| `npm run watch`        | Builds the application in watch mode for development     |
| `npm test`             | Runs unit tests with Karma and Jasmine                   |
| `npm run lint`         | Runs ESLint to check code quality                        |
| `npm run lint:fix`     | Automatically fixes ESLint issues                        |
| `npm run format`       | Formats code using Prettier                              |
| `npm run format:check` | Checks if code is properly formatted                     |
| `npm run prepare`      | Sets up Husky git hooks                                  |
| `npm run seed:scores`  | Seeds public domain scores into the database             |

## Project Scope

### MVP Features (Current Release)

**✅ User Account Management**

- Email/password registration and login
- Secure session management

**✅ Song Library Management**

- MusicXML file upload and storage
- Library display as composer-title tiles
- Song deletion with confirmation

**✅ Pre-loaded Content Library**

- Public domain compositions available for browsing
- One-click addition to personal library

**✅ Sheet Music Rendering**

- OpenSheetMusicDisplay integration
- Clean, readable sheet music visualization

**✅ AI-Powered Song Suggestions**

- "Find Similar Music" functionality
- OpenRouter.ai integration for recommendations
- Modal display of suggestions

**✅ User Feedback System**

- Thumbs up/down rating for rendering quality
- Thumbs up/down rating for AI suggestion relevance

**✅ New User Onboarding**

- 3-step introductory modal for new users
- Guidance on uploading, browsing, and AI features

### Out of Scope for MVP

- Support for formats other than MusicXML (PDF, MIDI, etc.)
- Sheet music editing or annotation capabilities
- Advanced filtering by genre, difficulty, or key
- Social features (sharing, collaboration)
- Native mobile applications
- Social login options (Google, Facebook, etc.)

## Project Status

🚧 **MVP Development** - This project is currently in active development for the Minimum Viable Product release.

### Success Metrics (Target)

- **Sheet Music Rendering Quality**: 95% thumbs up ratings
- **AI Suggestion Relevance**: 75% thumbs up ratings

### Roadmap

- [ ] Complete MVP development
- [ ] User testing and feedback collection
- [ ] Performance optimization
- [ ] Mobile responsiveness improvements
- [ ] Additional MusicXML features

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**MuShee** - Making sheet music management musical again! 🎼
