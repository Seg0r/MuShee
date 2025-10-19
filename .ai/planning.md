<conversation_summary>
<decisions>

1.  **Sheet Music Format:** The MVP will exclusively support the MusicXML format for uploading and rendering songs.
2.  **User Authentication:** The user account system will be a simple email and password registration. Social logins are out of scope for the MVP.
3.  **User Interface (UI):** The UI will be simple, clean, and ergonomic, designed to be intuitive for all users, regardless of skill level.
4.  **AI Suggestions:** Suggestions will be triggered on-demand. The song list will be displayed as tiles, with one tile being a "Find Similar Music" call-to-action. Clicking this will query an external AI API (sending song titles/artists) and display the results in a pop-up.
5.  **Initial Content:** The application will be pre-loaded with a library of public domain songs to ensure there are no copyright issues. The specific pieces will be chosen by the project owner.
6.  **First-Time User Experience:** New users with an empty library will be greeted with a 3-step introductory modal explaining how to upload songs, browse the free library, and use AI suggestions. Each step displayed on separate card of modal.
7.  **Success Criteria Measurement:** The thumbs up/down rating system for rendering and AI suggestions will be implemented solely to gather statistics. These metrics are not tied to any immediate product iteration plans in the MVP phase.
8.  **Technical Stack:** Sheet music rendering will be handled by an open-source library.

</decisions>

<matched_recommendations>

1.  **Core Technology:** Use MusicXML as the standard format for its robustness in preserving notation, which benefits both rendering and AI analysis.
2.  **Authentication:** Start with a standard email and password system for the MVP, as it provides a secure baseline for user management.
3.  **User Interface Design:** Prioritize a clean, minimalist interface to make the core features (uploading, viewing, managing) as intuitive as possible.
4.  **AI Suggestion UI:** Place a clear, on-demand trigger for AI suggestions within the user's main workflow. Displaying results in a pop-up is an effective, non-disruptive method.
5.  **API Performance:** For the AI suggestion feature, aim for a response time under 3 seconds, and implement loading indicators and user-friendly error messages to manage user expectations.
6.  **Content Strategy:** The initial song library should consist of public domain pieces to provide immediate value without incurring legal risks or licensing costs.
7.  **Content Discovery:** A dedicated "Browse Library" or "Discover" section is the recommended approach for users to find and add pre-loaded songs to their personal collection.
8.  **Song List Display:** The song list view should be scannable, displaying the essential "Composer - Title" information parsed from the MusicXML file.
</matched_recommendations>

<prd_planning_summary>

### Main Functional Requirements

The MUSHEE MVP is a web application designed to help musicians organize and access their sheet music. Key functionalities include:

  * **User Account Management:** A simple email/password system for user registration and login to store their personal song library.
  * **Song Library Management:** Users can upload songs in MusicXML format, view a list of their songs (displayed as "Composer - Title" tiles), and delete songs.
  * **Pre-loaded Library:** A browsable collection of pre-selected, public domain songs that users can add to their personal library.
  * **Sheet Music Rendering:** An integrated viewer that renders MusicXML files into clean, readable sheet music using an open-source library.
  * **AI-Powered Suggestions:** An on-demand feature, triggered from the song list view, that calls an external AI API to suggest similar songs. Results are displayed in a pop-up.
  * **User Feedback:** A thumbs up/down rating system on rendered music and AI suggestions to collect usage statistics.

### Key User Stories and Usage Paths

1.  **New User Onboarding:** A new user signs up and logs in for the first time. They are presented with a 3-step introduction to core features. They can then choose to either upload their first MusicXML file or browse the pre-loaded library to populate their collection.
2.  **Viewing and Practicing:** A returning user logs in, sees their list of songs, clicks on a specific piece, and views the rendered sheet music for practice or performance.
3.  **Discovering New Music:** A user with several songs in their library wants to find new pieces. They click the "Find Similar Music" tile, which triggers the AI to suggest new songs based on their existing library.

### Success Criteria

The initial success criteria are based on user feedback statistics:

  * 95% of music sheet renderings receive a "thumb up".
  * 75% of AI song suggestions receive a "thumb up".
    It has been clarified that for the MVP, these metrics are purely for data collection and will not be used to drive immediate product changes. A primary business or engagement metric (e.g., user retention) was deemed out of scope for this planning phase.
</prd_planning_summary>

<unresolved_issues>

1.  **Primary Success Metric:** No primary business or user engagement metric (e.g., weekly active users, retention rate) has been defined for the MVP. Relying solely on thumbs-up statistics for data gathering might obscure the product's overall market fit and user value.
2.  **Prioritization:** The relative priority between implementing the AI suggestions and the pre-loaded song library is undecided. This will need to be clarified for resource planning.
3.  **AI Service Details:** The specific external AI service, prompt engineering details, and associated costs have not been defined.
4.  **Content Selection:** The specific list of public domain pieces for the initial library has not been determined.
5.  **Data Privacy and Storage:** Technical and policy decisions regarding user data storage and privacy were deferred to a later discussion.
</unresolved_issues>
</conversation_summary>