# Proof of Concept Generation Prompt - MuShee Song Library

## Objective
Create a minimal proof of concept to validate the core technical stack and basic song library functionality for MuShee - a web-based sheet music management application. The PoC should demonstrate that the chosen technologies work together effectively and that the fundamental user workflow is viable.

## Important Instructions
**BEFORE implementing any code:**
1. Review the requirements below
2. Create a detailed implementation plan breaking down the work into logical steps
3. Present this plan to me for approval
4. Wait for my confirmation before proceeding with implementation

## Technology Stack (MUST USE)
- **Frontend:** Angular 19 with TypeScript 5
- **UI Components:** Angular Material
- **Sheet Music Rendering:** OpenSheetMusicDisplay library

## Core Features to Implement

### 1. Song Upload
- File upload interface accepting only `.musicxml` or `.xml` files
- Parse MusicXML files to extract composer and title metadata
- Store uploaded files in Supabase storage
- Save song metadata (composer, title, file reference, user ID)
- Basic error handling for invalid file formats

**Validation Goal:** Confirm file upload

### 3. Personal Library View
- Display user's songs as a grid/list of tiles
- Each tile shows "Composer - Title" format
- Empty state message when no songs exist ("Upload your first song to get started")
- Responsive layout using Angular Material components

**Validation Goal:** UI rendering perform adequately

### 4. Sheet Music Viewer
- Click on a song tile to open a dedicated viewer page
- Render MusicXML file using OpenSheetMusicDisplay library
- Display rendered sheet music in a clean, readable format
- Basic navigation (back to library button)

**Validation Goal:** Validate OpenSheetMusicDisplay integration and MusicXML rendering quality


## Explicitly EXCLUDED Features (Out of Scope for PoC)
- ❌ User authentication
- ❌ Backend for storage
- ❌ AI-powered song suggestions
- ❌ User feedback/rating system (thumbs up/down)
- ❌ Onboarding modal for first-time users
- ❌ Pre-loaded public domain song library
- ❌ Social features or sharing
- ❌ Advanced filtering or search
- ❌ Song editing or annotation
- ❌ Mobile-specific optimizations (web-only is fine)
- ❌ Comprehensive error handling and edge cases
- ❌ Production-ready security hardening
- ❌ CI/CD pipeline setup


## Success Criteria
The PoC is successful if:
1. A user can upload a valid MusicXML file
2. The uploaded song appears in their library with correct metadata
3. Clicking the song opens a viewer with properly rendered sheet music
4. All features work without critical bugs or errors
6. The application is clean, functional, and demonstrates technical viability

## Technical Requirements
- Use Angular 19 standalone components (no NgModules)
- Follow Angular Material design guidelines for consistent UI
- Implement proper TypeScript typing (no 'any' types unless absolutely necessary)
- Implement basic error handling with user-friendly messages
- Ensure responsive design (desktop and tablet, mobile can be basic)

## Deliverables
1. Angular application with all core features implemented

## Development Approach
- Focus on functionality over polish
- Use default Angular Material themes
- Minimal custom CSS/styling
- Prioritize working features over perfect code architecture
- Document any technical decisions or trade-offs made

---

**Remember:** Create an implementation plan first and wait for my approval before writing any code!
