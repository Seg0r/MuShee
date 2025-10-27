# Login View Implementation Plan

## 1. Overview

The Login View is a public-facing authentication page that allows returning users to access their MuShee accounts using email and password credentials. This view serves as the primary entry point for authentication in the application, leveraging Supabase Auth SDK for secure credential validation. The view emphasizes clear UX with real-time field validation, explicit error messages, and smooth navigation to the registration page for new users. Upon successful authentication, users are automatically redirected to their personal song library.

## 2. View Routing

- **Route Path**: `/login`
- **Access Level**: Public (unauthenticated users only)
- **Route Guard**: PublicOnlyGuard - redirects authenticated users to `/library`
- **Lazy Loading**: Can be lazy-loaded as part of the authentication feature module
- **Default Route**: Root route `/` should redirect to `/login` if user is not authenticated

## 3. Component Structure

```
LoginComponent (container/smart component)
├── AppComponent Router Outlet
├── Shell Layout (optional - depends on routing strategy for public routes)
└── AuthFormComponent (presentational component)
    ├── Email Field (MatFormField + matInput)
    ├── Password Field (MatFormField + matInput)
    ├── Error Message Display (error.message)
    ├── Submit Button (matButton)
    ├── Loading Spinner Overlay (MatProgressSpinner)
    └── Create Account Link (MatAnchor navigating to /register)
```

## 4. Component Details

### LoginComponent

**Component Description:**
The main container component for the login view. This smart component manages the authentication flow, handles form submissions, and orchestrates navigation. It checks if the user is already authenticated and redirects accordingly. The component is responsible for calling the authentication service and managing the overall login state.

**Main Elements:**

- Responsive container (centered, responsive padding)
- Heading: "Welcome back to MuShee"
- Subheading: "Sign in to your account"
- AuthFormComponent instance
- Optional: App header/toolbar (if not using shell layout for public routes)

**Handled Interactions:**

- Form submission (email + password)
- Navigation to registration page
- Error dismissal
- Keyboard shortcuts (Enter to submit)

**Handled Validation:**

- Pre-login: Check if user already authenticated, redirect to `/library`
- Post-login: Check Supabase Auth response for errors
- Route guard validation: Ensure unauthenticated access only

**Validation Details:**

- Verify no active session exists (redirect if authenticated)
- Verify API response contains valid session after login
- Handle all possible authentication error codes from Supabase
- Validate that user is redirected only after profile is verified as created/exists

**Types:**

- AuthError (custom error type extending ErrorResponseDto)
- ProfileDto (for post-login profile verification)

**Props:**

- None (component initialized by routing)

### AuthFormComponent

**Component Description:**
A presentational (dumb) component that displays the authentication form with email and password fields. This component handles all form-level interactions including field validation, form submission events, and user input feedback. It manages local form state using Angular Reactive Forms and emits login events to the parent component.

**Main Elements:**

- Email input field (matInput with email validation)
- Password input field (matInput with type="password")
- Error message display container (conditionally shown)
- Submit button (matButton filled variant)
- Loading spinner overlay (MatProgressSpinner, shown during submission)
- "Create Account" link (matAnchor to /register)
- Optional: Show/hide password toggle (accessibility enhancement)

**Handled Interactions:**

- Email field blur: Validate email format
- Password field blur: Validate password not empty
- Form submit: Validate entire form and emit login event
- Enter key press: Submit form if valid
- Create Account link click: Navigate to register
- Loading state: Disable form inputs during submission

**Handled Validation:**

- Email format validation: RFC 5322 compliant pattern
- Email required: Must not be empty
- Password required: Must not be empty
- Password minimum length: At least 8 characters (security requirement)
- Form-level: Both fields must be valid before submit enabled
- Cross-field: Cannot submit with empty or invalid email+password
- Real-time feedback: Validation errors shown on blur (except submit errors)

**Validation Details:**

1. **Email Field Validation:**
   - Pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ (basic email format)
   - Message if invalid: "Please enter a valid email address"
   - Message if empty: "Email is required"
   - Triggers on: blur, submit attempt

2. **Password Field Validation:**
   - MinLength: 8 characters
   - Message if too short: "Password must be at least 8 characters"
   - Message if empty: "Password is required"
   - Triggers on: blur (for length check), submit attempt

3. **Form-Level Validation:**
   - Submit button disabled if form.invalid
   - Submit button disabled if form.pending
   - Submit button disabled during loading state

**Types:**

- FormData: { email: string; password: string }
- FormState: { isLoading: boolean; error: AuthError | null; isSubmitted: boolean }
- AuthFormOutput: { email: string; password: string } (emitted on submit)

**Props:**

- `@Input() isLoading: boolean` - Whether authentication request is in progress
- `@Input() error: AuthError | null` - Error message to display
- `@Output() loginSubmit = new EventEmitter<FormData>()` - Emits form data on submit

## 5. Types

### FormData (ViewModel)

```typescript
export interface LoginFormData {
  email: string;
  password: string;
}
```

**Description:** Represents the login form input data structure. Contains the email address and password entered by the user. This interface is used for form control and when emitting the submit event to the parent component.

### AuthError (ViewModel)

```typescript
export interface AuthError {
  code: string; // Error code from Supabase or custom code
  message: string; // User-friendly error message
  field?: 'email' | 'password' | 'general'; // Which field the error relates to (optional)
  timestamp: Date; // When the error occurred
}
```

**Description:** Represents authentication errors with additional metadata beyond the API error response. Includes field targeting for form-specific errors and timestamp for error tracking. Extends the ErrorResponseDto structure with presentation-layer information.

### FormState (ViewModel)

```typescript
export interface FormState {
  isLoading: boolean; // True while API call is in progress
  error: AuthError | null; // Current error message, null if no error
  isSubmitted: boolean; // True if form submit has been attempted
  isDirty: boolean; // True if any field has been modified
}
```

**Description:** Represents the current state of the login form. Used to manage UI state including loading indicators, error displays, and validation feedback. Allows component to respond to user interactions and API responses.

### SessionCheckResult (ViewModel)

```typescript
export interface SessionCheckResult {
  isAuthenticated: boolean;
  user: AuthUser | null;
  profile: ProfileDto | null;
}
```

**Description:** Result of checking if user has an existing authenticated session. Used to determine if immediate redirect is needed on component initialization.

## 6. State Management

**State Architecture:**
The Login View uses Angular 19 signals for state management with Reactive Forms for form-specific state. No global state management store is required, as login is a transient operation that doesn't require cross-component state sharing.

**Signals (Angular 19):**

```typescript
export class LoginComponent {
  // Form and authentication state
  formLoading = signal<boolean>(false);
  authError = signal<AuthError | null>(null);
  isSessionChecking = signal<boolean>(true);

  // Derived state
  isSubmitDisabled = computed(() => this.formLoading() || this.authForm.invalid);
}
```

**Reactive Forms:**

```typescript
export class AuthFormComponent implements OnInit {
  formGroup = new FormGroup({
    email: new FormControl('', {
      validators: [Validators.required, Validators.email],
      updateOn: 'blur',
    }),
    password: new FormControl('', {
      validators: [Validators.required, Validators.minLength(8)],
      updateOn: 'blur',
    }),
  });
}
```

**Custom Hook (not required for this view):**
No custom hook is needed for the Login View. State management is straightforward with Reactive Forms handling form state and signals managing async operations.

**State Lifecycle:**

1. **Initialization:**
   - `isSessionChecking = true`
   - Check if user already authenticated
   - If authenticated: redirect to `/library` (no render)
   - If no session: `isSessionChecking = false`

2. **Form Interaction:**
   - User enters email: Form control value updated
   - User leaves email field: Validation runs, error state updated if invalid
   - User enters password: Form control value updated
   - User leaves password field: Validation runs, error state updated if invalid

3. **Form Submission:**
   - User clicks submit or presses Enter
   - Form validates (if invalid: show inline errors, return)
   - `formLoading = true`, `authError = null`
   - API call initiated

4. **API Response - Success:**
   - Session created in Supabase Auth
   - `formLoading = false`
   - Redirect to `/library`

5. **API Response - Error:**
   - `formLoading = false`
   - Map error code to user-friendly message
   - `authError = { code, message, field: 'general', timestamp }`
   - Display error in UI, allow retry

## 7. API Integration

**Authentication Service Call:**

The Login View uses `SupabaseService` to interact with Supabase Auth. The actual authentication is performed via Supabase Auth SDK's `signInWithPassword()` method.

**Request Execution:**

```typescript
// In LoginComponent
private authService = inject(SupabaseService);

async performLogin(email: string, password: string): Promise<void> {
  try {
    const { data, error } = await this.authService.client.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    // Upon success, Supabase automatically creates session
    // Redirect to library
  } catch (error) {
    // Handle authentication error
  }
}
```

**Request Type:**

```typescript
interface SignInWithPasswordParams {
  email: string;
  password: string;
}
```

**Response Type (Success):**

```typescript
interface AuthResponse {
  data: {
    user: AuthUser;
    session: Session;
  };
  error: null;
}

interface AuthUser {
  id: string;
  email: string;
  // ... other fields
}

interface Session {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
  token_type: string;
  user: AuthUser;
}
```

**Response Type (Error):**

```typescript
interface AuthErrorResponse {
  data: null;
  error: {
    message: string; // e.g., "Invalid login credentials"
    status: number;
  };
}
```

**Error Code Mapping (Supabase → User-Friendly):**

| Supabase Error            | HTTP Status | User Message                                   |
| ------------------------- | ----------- | ---------------------------------------------- |
| Invalid login credentials | 400         | "Invalid email or password"                    |
| Email not confirmed       | 400         | "Please verify your email before logging in"   |
| User not found            | 400         | "No account found with this email"             |
| Account disabled          | 400         | "This account has been disabled"               |
| Network error             | N/A         | "Network error. Please check your connection." |
| Generic error             | 500         | "Something went wrong. Please try again."      |

**Session Check (Pre-Login):**

```typescript
async checkExistingSession(): Promise<SessionCheckResult> {
  const { data: { user }, error } = await this.authService.client.auth.getUser();

  if (user) {
    // User has existing session, redirect to library
    return { isAuthenticated: true, user, profile: null };
  }

  return { isAuthenticated: false, user: null, profile: null };
}
```

**Post-Login Profile Verification:**

```typescript
// After successful login, optionally verify profile exists
private profileService = inject(ProfileService);

async verifyProfileExists(): Promise<void> {
  try {
    await this.profileService.getCurrentUserProfile();
  } catch (error) {
    // Profile will be auto-created if auto-creation is enabled
  }
}
```

**Session Token Management:**

- Handled automatically by Supabase SDK
- Tokens stored in browser (localStorage or secure cookie depending on Supabase config)
- Automatic refresh handled by SDK before expiration
- No manual token management needed in LoginComponent

## 8. User Interactions

**Interaction 1: Page Load / Component Initialize**

- **User Action:** Opens `/login` URL
- **Precondition:** User is not authenticated (or route guard allows access)
- **Component Response:**
  - Display loading state while checking session
  - If session exists: redirect to `/library` (no form render)
  - If no session: display login form
- **Expected Outcome:** Login form visible or redirected

**Interaction 2: Focus Email Field**

- **User Action:** Clicks on email input field
- **Precondition:** Form is displayed
- **Component Response:**
  - Auto-focus email field on page load (ngOnInit)
  - Clear previous error state if exists
- **Expected Outcome:** Email field receives focus, cursor visible

**Interaction 3: Enter Email Address**

- **User Action:** Types email address in email field
- **Precondition:** Email field is focused
- **Component Response:**
  - Update FormControl value
  - Store value in memory (no backend call)
- **Expected Outcome:** Email appears in input field

**Interaction 4: Leave Email Field (Blur)**

- **User Action:** Tabs out or clicks away from email field
- **Precondition:** Email field contains text (or is empty)
- **Component Response:**
  - Run email validators (required, pattern)
  - If invalid: display inline error message below field
  - If valid: clear error message
- **Expected Outcome:** Error message appears or disappears based on validation

**Interaction 5: Enter Password**

- **User Action:** Types password in password field
- **Precondition:** Password field is focused
- **Component Response:**
  - Update FormControl value
  - Store value in memory (not visible due to password masking)
- **Expected Outcome:** Password appears as dots/asterisks in input field

**Interaction 6: Leave Password Field (Blur)**

- **User Action:** Tabs out or clicks away from password field
- **Precondition:** Password field contains text (or is empty)
- **Component Response:**
  - Run password validators (required, minLength)
  - If invalid: display inline error message below field
  - If valid: clear error message
- **Expected Outcome:** Error message appears or disappears based on validation

**Interaction 7: Submit Form (Click Submit Button)**

- **User Action:** Clicks "Sign In" / "Login" button
- **Precondition:**
  - Form is valid (both fields valid)
  - Not currently loading (no duplicate submission)
- **Component Response:**
  - Disable form inputs and submit button
  - Show loading spinner
  - Call Supabase `signInWithPassword()` with email and password
  - Wait for API response
- **Expected Outcome:** Form disabled, spinner visible

**Interaction 8: Submit Form (Press Enter Key)**

- **User Action:** Presses Enter key in email or password field
- **Precondition:** Form is valid
- **Component Response:**
  - Same as clicking submit button
- **Expected Outcome:** Form submitted with same flow as button click

**Interaction 9: API Success - Authentication Successful**

- **User Action:** Valid credentials submitted
- **Precondition:** API responds with session token
- **Component Response:**
  - Disable loading state
  - Session automatically created in Supabase SDK
  - Navigate to `/library` using Angular Router
  - Optionally: verify profile exists and call onboarding check
- **Expected Outcome:** Page redirects to `/library`

**Interaction 10: API Error - Invalid Credentials**

- **User Action:** Invalid email/password combination submitted
- **Precondition:** Supabase returns 400 error with "Invalid login credentials"
- **Component Response:**
  - Disable loading state
  - Map error to: "Invalid email or password"
  - Store error in `authError` signal
  - Display error message in red box above form
  - Re-enable form inputs
- **Expected Outcome:** Error message visible, form ready for retry

**Interaction 11: API Error - User Not Found**

- **User Action:** Email not registered submitted
- **Precondition:** Supabase returns error indicating user not found
- **Component Response:**
  - Disable loading state
  - Display error: "No account found with this email"
  - Re-enable form
- **Expected Outcome:** Error message visible, user can click "Create Account" link

**Interaction 12: API Error - Network Error**

- **User Action:** Login attempt during network outage
- **Precondition:** Network request fails
- **Component Response:**
  - Catch network error in catch block
  - Display: "Network error. Please check your connection."
  - Allow retry
- **Expected Outcome:** User-friendly error message, form remains enabled

**Interaction 13: API Error - Server Error**

- **User Action:** Login attempt when API is down
- **Precondition:** Supabase returns 500 error
- **Component Response:**
  - Display generic message: "Something went wrong. Please try again."
  - Allow retry
- **Expected Outcome:** Generic error message, form remains enabled

**Interaction 14: Navigate to Registration**

- **User Action:** Clicks "Create Account" / "Sign Up" link
- **Precondition:** User is not yet registered
- **Component Response:**
  - Navigate to `/register` using routerLink or router.navigate()
- **Expected Outcome:** Page changes to registration form

**Interaction 15: Clear Error After Retry**

- **User Action:** User modifies form fields after seeing error
- **Precondition:** Error message is displayed
- **Component Response:**
  - Clear error state when user starts typing in fields
  - Remove error message from display
- **Expected Outcome:** Error message disappears as user retries

**Interaction 16: Show/Hide Password (Optional Enhancement)**

- **User Action:** Clicks eye icon on password field
- **Precondition:** Password field is focused and has content
- **Component Response:**
  - Toggle input type between "password" and "text"
  - Change icon appearance (eye open/closed)
- **Expected Outcome:** Password text becomes visible or hidden

## 9. Conditions and Validation

### Form-Level Conditions

**Condition 1: Email Format Validation**

- **Component Affected:** AuthFormComponent
- **Validators Applied:** `Validators.required`, `Validators.email`
- **Validation Pattern:** `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- **Verification Method:**
  - React Form automatically validates on blur (updateOn: 'blur')
  - UI displays inline error if invalid
  - Submit button disabled if email invalid
- **State Impact:** If invalid, submit button remains disabled until corrected
- **Error Message:** "Please enter a valid email address"

**Condition 2: Email Required**

- **Component Affected:** AuthFormComponent
- **Validators Applied:** `Validators.required`
- **Verification Method:** FormControl touched and empty
- **State Impact:** Submit button disabled if empty
- **Error Message:** "Email is required"

**Condition 3: Password Minimum Length**

- **Component Affected:** AuthFormComponent
- **Validators Applied:** `Validators.minLength(8)`
- **Verification Method:** Password length < 8 characters
- **State Impact:** Submit button disabled if too short
- **Error Message:** "Password must be at least 8 characters"

**Condition 4: Password Required**

- **Component Affected:** AuthFormComponent
- **Validators Applied:** `Validators.required`
- **Verification Method:** FormControl touched and empty
- **State Impact:** Submit button disabled if empty
- **Error Message:** "Password is required"

**Condition 5: Form Valid for Submission**

- **Component Affected:** AuthFormComponent
- **Verification Method:** `formGroup.valid && !formGroup.pending`
- **State Impact:** Submit button enabled only if condition true
- **UI Feedback:**
  - Button disabled state (greyed out)
  - Cursor changes to not-allowed

**Condition 6: No Duplicate Submission**

- **Component Affected:** LoginComponent
- **Verification Method:** `!formLoading()`
- **State Impact:** Form disabled while loading, prevents multiple clicks
- **UI Feedback:**
  - Submit button disabled
  - Loading spinner displayed
  - Form inputs disabled

### API-Level Conditions

**Condition 7: Valid Session Exists (Pre-Login Check)**

- **Component Affected:** LoginComponent
- **Verification Method:** `authService.client.auth.getUser()` returns user object
- **State Impact:** Auto-redirect to `/library` if true
- **Skip Condition:** Skip rendering login form entirely

**Condition 8: Credentials Match Supabase Records**

- **Component Affected:** LoginComponent
- **Verification Method:** Supabase returns session on `signInWithPassword()`
- **State Impact:** If true, navigate to library; if false, display error
- **Error Scenarios:**
  - User not found: "No account found with this email"
  - Password incorrect: "Invalid email or password"
  - Account disabled: "This account has been disabled"

**Condition 9: Email Exists in Supabase**

- **Component Affected:** LoginComponent
- **Verification Method:** Supabase validates email format and existence
- **State Impact:** If not found, specific error returned
- **User Feedback:** "No account found with this email"

**Condition 10: Network Connectivity**

- **Component Affected:** LoginComponent
- **Verification Method:** API call succeeds vs. fails
- **State Impact:** If fails, display network error message
- **User Feedback:** "Network error. Please check your connection."

### Route-Level Conditions

**Condition 11: User Not Authenticated (Route Guard)**

- **Component Affected:** LoginComponent
- **Verification Method:** PublicOnlyGuard checks auth status
- **State Impact:** If authenticated, prevent access to `/login`, redirect to `/library`
- **Redirect Target:** `/library`

**Condition 12: User Authenticated (Post-Login)**

- **Component Affected:** LoginComponent
- **Verification Method:** Session created after successful login
- **State Impact:** Allow navigation to protected routes
- **Redirect Target:** `/library` immediately after successful login

## 10. Error Handling

### Error Scenarios and Handling Strategy

**Error 1: Invalid Email Format**

- **Trigger:** User enters non-email text and leaves field
- **Detection:** `Validators.email` fails
- **Handling:**
  - Display inline error below email field: "Please enter a valid email address"
  - Disable submit button
  - Keep form enabled for correction
- **Recovery:** User corrects email format, error clears automatically on blur
- **User Experience:** Non-blocking, allows immediate correction

**Error 2: Empty Email Field**

- **Trigger:** User leaves email field empty and tries to submit
- **Detection:** `Validators.required` fails
- **Handling:**
  - Display inline error: "Email is required"
  - Disable submit button
- **Recovery:** User enters email address
- **User Experience:** Clear message, focus returns to field on error

**Error 3: Password Too Short**

- **Trigger:** User enters < 8 characters and leaves field
- **Detection:** `Validators.minLength(8)` fails
- **Handling:**
  - Display inline error: "Password must be at least 8 characters"
  - Disable submit button
- **Recovery:** User enters longer password
- **User Experience:** Clear requirement communicated upfront

**Error 4: Empty Password Field**

- **Trigger:** User leaves password field empty and tries to submit
- **Detection:** `Validators.required` fails
- **Handling:**
  - Display inline error: "Password is required"
  - Disable submit button
- **Recovery:** User enters password
- **User Experience:** Same as email field

**Error 5: Invalid Login Credentials (400 - Invalid login credentials)**

- **Trigger:** User submits wrong email/password combination
- **Detection:** Supabase returns error: `Invalid login credentials`
- **Handling:**
  - Hide loading spinner
  - Display prominent error box: "Invalid email or password"
  - Re-enable form inputs
  - Store error in `authError` signal with timestamp
- **Recovery:** User retries with correct credentials or resets password (future)
- **User Experience:** Clear error, form ready for retry, no form reset (preserve input for easy retry)
- **Security Note:** Don't differentiate between "user not found" and "password incorrect" for security

**Error 6: Email Not Confirmed (400 - Email not confirmed)**

- **Trigger:** User registers but doesn't verify email, then tries to login
- **Detection:** Supabase returns specific error
- **Handling:**
  - Display error: "Please verify your email before logging in"
  - Suggest checking spam folder
- **Recovery:** User verifies email from link, can then login
- **User Experience:** Clear guidance on next steps

**Error 7: Account Disabled (400)**

- **Trigger:** Admin disables user account for violations
- **Detection:** Supabase returns account disabled error
- **Handling:**
  - Display error: "This account has been disabled"
  - Provide contact support guidance (optional)
- **Recovery:** User contacts support
- **User Experience:** Professional error message

**Error 8: Network Error (Network Failure)**

- **Trigger:** User attempts login during network outage
- **Detection:** `fetch()` or Supabase SDK throws network error
- **Handling:**

  ```typescript
  try {
    // login attempt
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      authError.set({ message: 'Network error. Please check your connection.' });
    }
  }
  ```

  - Display prominent error: "Network error. Please check your connection."
  - Re-enable form

- **Recovery:** User waits for network restoration or tries again
- **User Experience:** Clear cause of error, actionable guidance

**Error 9: Server Error (500 Internal Server Error)**

- **Trigger:** Supabase backend encounters unhandled exception
- **Detection:** HTTP 500 response
- **Handling:**
  - Display generic error: "Something went wrong. Please try again."
  - Log full error to console for debugging
  - Optionally: track in error monitoring service (e.g., Sentry)
- **Recovery:** User retries or checks status page
- **User Experience:** Generic but professional message, doesn't expose internal details

**Error 10: Rate Limiting (429 - Too Many Requests)**

- **Trigger:** User attempts multiple failed logins rapidly
- **Detection:** Supabase returns 429 status
- **Handling:**
  - Display error: "Too many login attempts. Please try again in a few minutes."
  - Disable form temporarily (optional backoff)
- **Recovery:** User waits for rate limit window to expire
- **User Experience:** Communicates need to wait, protects against brute force

**Error 11: Service Unavailable (503)**

- **Trigger:** Supabase service is down for maintenance
- **Detection:** HTTP 503 response
- **Handling:**
  - Display error: "Service temporarily unavailable. Please try again later."
  - Provide status page link (optional)
- **Recovery:** User waits for service restoration
- **User Experience:** Clear service status communication

**Error 12: Timeout (Request exceeds time limit)**

- **Trigger:** Supabase doesn't respond within timeout window
- **Detection:** `AbortController` timeout or RxJS timeout operator
- **Handling:**
  - Display error: "Request took too long. Please try again."
  - Re-enable form
- **Recovery:** User retries login
- **User Experience:** Clear timeout indication, no ambiguity about result

### Global Error Handling Integration

**ErrorHandlingService Integration:**

- All errors caught in LoginComponent should be mapped through ErrorHandlingService
- Supabase error codes mapped to user-friendly messages
- Optional: Display toast notifications for transient errors
- HTTP interceptor automatically handles network errors

**Error State Cleanup:**

- Clear error state when user starts modifying form (indicates retry attempt)
- Clear error state when component destroys (avoid stale errors on revisit)

## 11. Implementation Steps

### Phase 1: Setup and Planning

1. **Create feature module structure**
   - Generate auth feature module (or use existing)
   - Create login component directory: `src/app/components/login/`

2. **Define types and interfaces**
   - Create `src/app/models/login.ts` with FormData, AuthError, FormState interfaces
   - Update main `src/types.ts` if global types needed

3. **Review dependencies**
   - Ensure Angular Material form components available (@angular/material/form-field, etc.)
   - Verify SupabaseService and AuthService setup in app.config.ts
   - Check route configuration in app.routes.ts

### Phase 2: Component Creation

4. **Create LoginComponent**
   - Generate with Angular CLI or manual creation
   - Set `standalone: true` and `changeDetection: OnPush`
   - Import required Angular Material modules
   - Define signals: `formLoading`, `authError`, `isSessionChecking`

5. **Implement session check logic in LoginComponent**
   - In constructor, inject SupabaseService and Router
   - In ngOnInit:
     - Set `isSessionChecking = true`
     - Call `authService.client.auth.getUser()`
     - If user exists: redirect to `/library`
     - If no user: set `isSessionChecking = false`

6. **Create AuthFormComponent**
   - Generate standalone component
   - Set `changeDetection: OnPush`
   - Define FormGroup with email and password controls
   - Set validators: email (required + pattern), password (required + minLength)
   - Set updateOn: 'blur' for email and password

7. **Implement form template (AuthFormComponent)**
   - Email MatFormField with matInput, email validator errors
   - Password MatFormField with matInput[type="password"], minLength validator errors
   - Submit button (matButton) with [disabled] binding
   - Error message display (NgIf checking error signal)
   - Loading spinner (MatProgressSpinner with \*ngIf)
   - Create Account link (routerLink="/register")

8. **Implement form logic (AuthFormComponent)**
   - @Input() isLoading, error properties
   - @Output() loginSubmit EventEmitter
   - Form reset after successful submission
   - Handle keyboard enter on form (keyup.enter)
   - Auto-focus email field in ngOnInit with @ViewChild

### Phase 3: Integration and Events

9. **Implement login flow in LoginComponent**
   - Define `performLogin()` method
   - Call `authService.client.auth.signInWithPassword(email, password)`
   - Handle success: navigate to `/library`
   - Handle error: map to user-friendly message, update `authError` signal
   - Set loading state during API call

10. **Connect AuthFormComponent to LoginComponent**
    - Bind `@Input() isLoading = formLoading()`
    - Bind `@Input() error = authError()`
    - Subscribe to `@Output() loginSubmit` event
    - Pass submitted form data to `performLogin()`

11. **Implement error mapping**
    - Create `mapSupabaseErrorToUserMessage()` helper function
    - Map error codes: "Invalid login credentials" → "Invalid email or password"
    - Map other Supabase errors to user-friendly messages
    - Include fallback for unknown errors

### Phase 4: Styling and UX

12. **Apply Material theming**
    - Use Angular Material system variables for colors
    - Import Material modules: MatFormFieldModule, MatInputModule, MatButtonModule, MatProgressSpinnerModule
    - Apply responsive padding/margins
    - Center form on screen
    - Add hover/focus states for accessibility

13. **Implement responsive design**
    - Use Angular Material breakpoints
    - Adjust form width for different screens
    - Ensure touch targets are adequate (44x44px minimum)
    - Test on mobile, tablet, desktop

14. **Add accessibility features**
    - Form field labels properly associated
    - Error messages linked with aria-describedby
    - Focus management: auto-focus email, focus trap in form
    - ARIA labels on icon buttons (if any)
    - Announce loading and error states

15. **Implement keyboard interactions**
    - Tab order: email → password → submit → create account
    - Enter key submits form
    - Escape key optional (close if in modal context)
    - Focus visible for all interactive elements

### Phase 5: Route and Navigation

16. **Update routing configuration**
    - Add `/login` route in app.routes.ts
    - Lazy load if using feature module: `loadComponent: () => LoginComponent`
    - Add PublicOnlyGuard to route
    - Set up root `/` redirect to `/login` or `/library` based on auth state

17. **Create/update PublicOnlyGuard**
    - Check if user authenticated
    - If yes: redirect to `/library`
    - If no: allow access to login page

### Phase 6: Testing and Refinement

18. **Create unit tests**
    - Test form validation: email pattern, password length
    - Test form submission: disabled state, loading state
    - Test error handling: display error messages
    - Test navigation: redirect on success/auth check
    - Mock Supabase service

19. **Test error scenarios**
    - Invalid credentials
    - Network error
    - Server error
    - Empty fields
    - Invalid email format

20. **Integration testing**
    - Test full login flow with mock Supabase
    - Test redirect after successful login
    - Test redirect on page load if already authenticated
    - Test route guard prevents authenticated users accessing login

### Phase 7: Final Review

21. **Security review**
    - Verify password field masked
    - Verify no credential logging
    - Verify HTTPS enforced (in production)
    - Verify CORS configured correctly
    - Verify error messages don't leak sensitive info

22. **Accessibility audit**
    - Test with screen reader (NVDA, JAWS)
    - Test keyboard-only navigation
    - Test color contrast (WCAG AA)
    - Test zoom support (200%)

23. **Performance optimization**
    - Lazy load form component
    - Use OnPush change detection
    - Minimize bundle imports from Material
    - Remove unused Material modules

24. **Documentation**
    - Document component props and events
    - Document error codes and mapping
    - Document setup in README
    - Document integration with auth flow
