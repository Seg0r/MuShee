# MuShee Application Test Plan

## 1. Introduction and Testing Objectives

### 1.1. Introduction

This document outlines the comprehensive testing strategy for MuShee, a web-based sheet music library management application. The application is built with Angular on the frontend and utilizes Supabase for backend services (database, authentication, storage). This plan details the scope, methods, resources, and procedures for testing all aspects of the MuShee application.

### 1.2. Testing Objectives

The primary objectives of this test plan are to:

- Ensure the application meets all functional requirements as specified in the project documentation.
- Verify the stability, reliability, and performance of the application across supported platforms.
- Guarantee data integrity and security, with a strong focus on Supabase Row-Level Security (RLS) policies.
- Identify and document all defects, and track them to resolution.
- Validate that the user interface (UI) is intuitive, accessible, and consistent with the design specifications.
- Confirm that the end-to-end user workflows are seamless and functional.

## 2. Scope of Testing

### 2.1. In-Scope Features

- **User Authentication:** Registration, Login, Logout, and session management.
- **User Profile Management:** Onboarding status tracking.
- **Sheet Music Management:** Uploading new `.mxl` files, parsing metadata (title, composer), and adding songs to the user's library.
- **User Library:** Viewing, searching, and managing personal sheet music collections.
- **Public Music Discovery:** Accessing and viewing public domain scores.
- **Sheet Music Viewer:** Rendering and display of MusicXML files using OpenSheetMusicDisplay.
- **AI-Powered Suggestions:** Generating and displaying new music recommendations.
- **Feedback System:** Submitting and recording feedback for both sheet music rendering and AI suggestions.
- **Backend Security:** Verification of all Supabase RLS policies to ensure users can only access their own data.

### 2.2. Out-of-Scope Features

- Testing the underlying Supabase infrastructure, services, or performance.
- Load and stress testing of third-party APIs (e.g., OpenRouter.ai).
- Browser extension compatibility testing.
- The `npm run seed:scores` script functionality will be verified but not formally tested under multiple failure conditions.
- Comprehensive testing of the OpenSheetMusicDisplay library beyond its integration with MuShee.

## 3. Types of Tests

- **Unit Testing:** Focused on individual Angular components, services, and guards. Developers are responsible for writing unit tests for their code. The existing test framework is Karma and Jasmine.
- **Integration Testing:** Testing the interactions between different components and services, particularly between the Angular frontend and Supabase backend services (Auth, Database, Storage).
- **End-to-End (E2E) Testing:** Simulating real user scenarios from start to finish. This covers complete workflows like user registration, uploading a song, and viewing it in the library.
- **Security Testing:** Specifically focused on validating Supabase RLS policies to prevent unauthorized data access between users. This will involve creating multiple test user accounts and attempting to access data across them.
- **UI & UX Testing:** Validating that the UI is visually correct, responsive, and provides a good user experience across modern web browsers (Chrome, Firefox, Safari).
- **Compatibility Testing:** Ensuring the application functions correctly on the latest versions of major desktop web browsers.

## 4. Test Scenarios for Key Functionalities

### 4.1. User Authentication & Authorization

- **Scenario 1:** A new user can successfully register for an account and is redirected to the login page or library.
- **Scenario 2:** An existing user can log in and is redirected to their library.
- **Scenario 3:** A logged-in user can log out successfully.
- **Scenario 4:** An unauthenticated user attempting to access a protected route (e.g., `/app/library`) is redirected to the login page.
- **Scenario 5:** A logged-in user attempting to access a public-only route (e.g., `/login`) is redirected to their library.

### 4.2. Library and Song Management

- **Scenario 1:** A logged-in user can upload a valid `.mxl` file. The file is processed, and the song appears in their library.
- **Scenario 2:** An attempt to upload a duplicate file (based on content hash) does not create a new master song record.
- **Scenario 3:** A user can view all songs in their personal library.
- **Scenario 4:** A user can delete a song from their library, and it is removed from their view.
- **Scenario 5:** A user can open a song from their library in the sheet music viewer.

### 4.3. Security (RLS Policies)

- **Scenario 1:** User A cannot view or access songs that are exclusively in User B's library.
- **Scenario 2:** User A can view public domain songs.
- **Scenario 3:** User A cannot update or delete User B's profile information.
- **Scenario 4:** Anonymous (unauthenticated) users can only view public songs and cannot access any user-specific data.

### 4.4. Sheet Music Viewer & Discovery

- **Scenario 1:** A user can open and view a public domain song from the "Discover" page.
- **Scenario 2:** The sheet music viewer correctly renders a variety of simple and complex `.mxl` files.
- **Scenario 3:** A user can submit "thumbs up" or "thumbs down" feedback on the rendering quality of a score.

## 5. Test Environment

- **Development/Local:** Developers' local machines using `npm start` with a local or shared development Supabase project.
- **Staging/Pre-Production:** A dedicated environment that mirrors production. It will use its own dedicated Supabase project. All features are tested here before a production release.
- **Production:** The live environment accessible to end-users.

## 6. Testing Tools

- **Unit Testing:** Angular CLI with Karma and Jasmine (`npm test`).
- **E2E Testing:** A Playwright framework should be set up to automate browser-based user workflows.
- **API Testing:** Postman or a similar REST client for manually testing Supabase Edge Functions.
- **Browser DevTools:** For debugging, inspecting network requests, and checking for console errors.
- **Bug Tracking:** GitHub Issues will be used to log, track, and manage defects.

## 7. Test Schedule

- **Continuous Testing:** Developers run unit tests and lint checks before every commit (enforced by Husky pre-commit hooks).
- **Sprint-Based Testing:** At the end of each development sprint, QA will perform integration and E2E testing on all new features in the Staging environment.
- **Regression Testing:** Before any production release, a full regression suite (covering all key E2E scenarios) will be executed on the Staging environment to ensure existing functionality has not been broken.

## 8. Test Acceptance Criteria

- **Unit Tests:** All new code must be accompanied by unit tests with a target of >80% code coverage.
- **Build Success:** The application must build successfully without errors (`npm run build`).
- **No Critical/Blocker Bugs:** No bugs that prevent a core user workflow from being completed are present in the release candidate.
- **All E2E Scenarios Pass:** All defined E2E test scenarios must pass successfully in the Staging environment.
- **Security Review:** All RLS policies must be manually reviewed and tested, with no identified vulnerabilities.

## 9. Roles and Responsibilities

- **Developers:** Responsible for writing unit tests, fixing bugs, and performing initial testing of their features in the development environment.
- **QA Engineer/Team:** Responsible for creating and maintaining the test plan, writing and executing integration and E2E tests, performing regression testing, and managing the bug lifecycle.
- **Product Manager:** Responsible for defining acceptance criteria from a user perspective and performing final user acceptance testing (UAT).

## 10. Bug Reporting Procedures

1.  **Discovery:** When a defect is found, it must be reproducible.
2.  **Logging:** A new issue will be created in the project's GitHub repository.
3.  **Content:** The issue must include:
    - A clear and concise title.
    - A detailed description of the bug and the actual vs. expected results.
    - Steps to reproduce the bug.
    - Environment details (e.g., Browser, OS).
    - Screenshots or video recordings, if applicable.
    - A severity label (e.g., Critical, High, Medium, Low).
4.  **Triage:** The development team will review the bug, prioritize it, and assign it to a developer.
5.  **Resolution:** Once fixed, the bug will be re-tested by QA in the Staging environment. If it passes, the issue will be closed.
