# View Implementation Plan: Login View

## 1. Overview

The Login View provides authentication functionality for returning users. It presents a form-based interface where users can authenticate using their email address and password credentials. Upon successful authentication, users are redirected to their library page. The view includes comprehensive validation, error handling, and accessibility features to ensure a smooth user experience.

## 2. View Routing

- **Path**: `/login`
- **Access**: Public route (unauthenticated users only)
- **Guard**: `PublicOnlyGuard` - Redirects already authenticated users to `/library`
- **Lazy Loading**: Can be lazy-loaded as part of authentication feature module

## 3. Component Structure

```
LoginComponent
└── LoginFormComponent (or inline form)
    ├── MatFormField (Email)
    │   ├── MatLabel
    │   ├── Input[type="email"]
    │   └── MatError
    ├── MatFormField (Password)
    │   ├── MatLabel
    │   ├── Input[type="password"]
    │   └── MatError
    ├── MatButton (Login)
    ├── ErrorMessageDisplay (conditional)
    ├── LoadingSpinner (conditional)
    └── RouterLink (to Registration)
```

## 4. Component Details

### LoginComponent

**Component Description:**
The main container component for the login view. Manages the authentication flow, form submission, error handling, and navigation. It serves as the orchestrator between the UI form and the authentication service.

**Main Elements:**

- Material Card container (`mat-card`) wrapping the entire login form
- Application logo/branding at the top
- `LoginFormComponent` or inline reactive form
- Loading overlay with spinner (conditional, displayed during authentication)
- Global error message display area (conditional, displayed on authentication failure)
- Navigation link to registration view

**Handled Events:**

- `formSubmit`: Triggered when user submits login form (via button click or Enter key)
- `navigateToRegister`: Triggered when user clicks "Create Account" link
- `retryLogin`: Triggered when user attempts to login again after an error

**Handled Validation:**

- Email format validation (standard email pattern)
- Password presence validation (required field)
- Form-level validation (all fields must be valid before submission)
- Server-side validation feedback (invalid credentials from Supabase)

**Types:**

- `LoginFormViewModel` (custom ViewModel for form state)
- `ErrorResponseDto` (from types.ts)
- `FormGroup`, `FormControl` (Angular reactive forms types)

**Props:**
None (top-level route component)

### LoginFormComponent (Optional - can be inline)

**Component Description:**
Encapsulates the login form UI with email and password fields. Can be implemented inline in LoginComponent or as a separate component for reusability. Uses Angular Material form fields with reactive forms for validation and state management.

**Main Elements:**

- `mat-card-header`: Contains title "Login to MuShee"
- `mat-card-content`: Contains form fields
  - Email `mat-form-field` with:
    - `mat-label`: "Email"
    - `input` with `type="email"`, `formControlName="email"`, `autocomplete="email"`
    - `mat-error` for validation messages
  - Password `mat-form-field` with:
    - `mat-label`: "Password"
    - `input` with `type="password"`, `formControlName="password"`, `autocomplete="current-password"`
    - `mat-error` for validation messages
- `mat-card-actions`: Contains action buttons
  - Primary button: "Log In" with `matButton="filled"`, `type="submit"`
  - Link button: "Create Account" with `matButton`, routing to `/register`

**Handled Events:**

- `ngSubmit`: Form submission handler
- `blur`: Field-level validation trigger on blur
- `input`: Real-time validation (optional for email format)

**Handled Validation:**

- **Email field**:
  - Required: "Email is required"
  - Email format: "Please enter a valid email address"
  - Validation triggered on blur and form submit
- **Password field**:
  - Required: "Password is required"
  - Validation triggered on blur and form submit

**Types:**

- `FormGroup` from `@angular/forms`
- `FormControl` from `@angular/forms`
- `Validators` from `@angular/forms`

**Props:**

- `@Input() loading: boolean` - Indicates if authentication is in progress
- `@Input() errorMessage: string | null` - Authentication error message from parent
- `@Output() submitLogin: EventEmitter<LoginFormViewModel>` - Emits form data on submission

## 5. Types

### LoginFormViewModel (New Type)

Custom interface representing the login form data model:

```typescript
export interface LoginFormViewModel {
  email: string;
  password: string;
}
```

**Field Breakdown:**

- `email` (string): User's email address, validated for proper email format
- `password` (string): User's password, must be non-empty

### LoginState (New Type)

Custom interface for managing component state:

```typescript
export interface LoginState {
  loading: boolean;
  error: string | null;
}
```

**Field Breakdown:**

- `loading` (boolean): Indicates if authentication request is in progress
- `error` (string | null): Stores user-friendly error message, null when no error

### Existing Types Used

From `types.ts`:

- `ErrorResponseDto`: Used for handling error responses from authentication
- `ErrorCode`: Specifically 'UNAUTHORIZED' for invalid credentials

## 6. State Management

### State Approach

The Login View uses Angular 19 signals for reactive state management without external state libraries.

### State Signals

```typescript
// Component-level signals
private readonly loadingSignal = signal<boolean>(false);
private readonly errorSignal = signal<string | null>(null);

// Computed signals (if needed)
readonly isSubmitDisabled = computed(() =>
  this.loadingSignal() || !this.loginForm.valid
);
```

### State Updates

- **loadingSignal**: Set to `true` when authentication begins, `false` when complete
- **errorSignal**: Set to error message on authentication failure, `null` on success or retry

### Form State

Managed through Angular Reactive Forms:

```typescript
private readonly fb = inject(FormBuilder);

readonly loginForm = this.fb.group({
  email: ['', [Validators.required, Validators.email]],
  password: ['', [Validators.required]]
});
```

### State Flow

1. Initial state: `loading = false`, `error = null`, form empty
2. User fills form: Form validity updates reactively
3. User submits: `loading = true`, `error = null`
4. Authentication success: `loading = false`, navigate to `/library`
5. Authentication failure: `loading = false`, `error = "Invalid email or password"`
6. User retries: `error = null`, form remains populated

## 7. API Integration

### Authentication Service

The Login View integrates with Supabase Auth through a custom `AuthService` wrapper.

### Service Injection

```typescript
private readonly authService = inject(AuthService);
private readonly router = inject(Router);
```

### Login Method Call

**Method**: `AuthService.login(email: string, password: string)`

**Request Type**: `LoginFormViewModel` (custom)

```typescript
{
  email: string;
  password: string;
}
```

**Response Type**: `void` (success) or throws `AuthenticationError`

The Supabase Auth SDK handles session management internally, storing JWT tokens securely.

### Implementation Pattern

```typescript
async onSubmitLogin(): Promise<void> {
  if (this.loginForm.invalid) {
    this.loginForm.markAllAsTouched();
    return;
  }

  this.loadingSignal.set(true);
  this.errorSignal.set(null);

  try {
    const { email, password } = this.loginForm.value;
    await this.authService.login(email!, password!);

    // Navigate to library on success
    await this.router.navigate(['/library']);
  } catch (error) {
    this.loadingSignal.set(false);

    if (error instanceof AuthenticationError) {
      this.errorSignal.set('Invalid email or password');
    } else {
      this.errorSignal.set('An unexpected error occurred. Please try again.');
    }
  }
}
```

### AuthService Expected Interface

```typescript
@Injectable({ providedIn: 'root' })
export class AuthService {
  async login(email: string, password: string): Promise<void> {
    const { error } = await this.supabaseService.client.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new AuthenticationError('Authentication failed');
    }
  }
}
```

## 8. User Interactions

### Interaction 1: Initial Page Load

**User Action**: User navigates to `/login`

**System Response**:

1. Check if user is already authenticated via `PublicOnlyGuard`
2. If authenticated, redirect to `/library`
3. If not authenticated, render login form
4. Auto-focus on email input field

### Interaction 2: Email Field Input

**User Action**: User types in email field

**System Response**:

1. Update form control value reactively
2. On blur, validate email format
3. Display inline error message if invalid: "Please enter a valid email address"
4. Clear error message when valid input provided

### Interaction 3: Password Field Input

**User Action**: User types in password field

**System Response**:

1. Update form control value reactively (masked input)
2. On blur, validate presence
3. Display inline error message if empty: "Password is required"
4. Clear error message when input provided

### Interaction 4: Form Submission via Button

**User Action**: User clicks "Log In" button

**System Response**:

1. Validate entire form
2. If invalid, mark all fields as touched to show errors, prevent submission
3. If valid, set loading state to true
4. Disable form inputs and submit button
5. Call `AuthService.login()` with credentials
6. On success: Navigate to `/library`
7. On failure: Display error message, re-enable form

### Interaction 5: Form Submission via Enter Key

**User Action**: User presses Enter key while focused on any form field

**System Response**: Same as Interaction 4 (form submission)

### Interaction 6: Navigate to Registration

**User Action**: User clicks "Create Account" link

**System Response**:

1. Navigate to `/register` route
2. Form state is cleared (component destroyed)

### Interaction 7: Retry After Error

**User Action**: User corrects credentials and submits again after authentication failure

**System Response**:

1. Clear previous error message
2. Set loading state to true
3. Attempt authentication again (same flow as Interaction 4)

## 9. Conditions and Validation

### Email Field Validation

**Component**: LoginFormComponent / inline form

**Conditions**:

1. **Required**: Field must not be empty
   - Verified: On blur and form submission
   - Effect: Display error message, prevent form submission
   - Error message: "Email is required"

2. **Email Format**: Field must match valid email pattern
   - Verified: On blur and form submission (using Angular's `Validators.email`)
   - Effect: Display error message, prevent form submission
   - Error message: "Please enter a valid email address"

**UI State Changes**:

- Field shows error state (red underline) when invalid and touched
- Error message appears below field
- Submit button remains disabled while invalid

### Password Field Validation

**Component**: LoginFormComponent / inline form

**Conditions**:

1. **Required**: Field must not be empty
   - Verified: On blur and form submission
   - Effect: Display error message, prevent form submission
   - Error message: "Password is required"

**UI State Changes**:

- Field shows error state (red underline) when invalid and touched
- Error message appears below field
- Submit button remains disabled while invalid

### Form-Level Validation

**Component**: LoginComponent

**Conditions**:

1. **All fields valid**: Both email and password must pass individual validation
   - Verified: Before API call
   - Effect: Enable/disable submit button
2. **Not currently loading**: Form submission disabled during authentication
   - Verified: Via loading signal
   - Effect: Disable form controls and submit button

**UI State Changes**:

- Submit button disabled when form invalid or loading
- Loading spinner overlay displayed during authentication
- Form inputs disabled during authentication

### Authentication Validation

**Component**: LoginComponent

**Conditions**:

1. **Credentials match existing user**: Validated by Supabase Auth
   - Verified: Server-side during login attempt
   - Effect on failure: Display error message, re-enable form
   - Error message: "Invalid email or password"

**UI State Changes**:

- Error message banner appears above form
- Loading state cleared
- Form re-enabled for retry

## 10. Error Handling

### Client-Side Validation Errors

**Scenario**: User submits form with invalid data

**Handling**:

1. Prevent API call
2. Mark all form fields as touched
3. Display inline validation errors for each invalid field
4. Maintain focus on first invalid field
5. No global error message displayed

**User Recovery**: Correct invalid fields and resubmit

### Authentication Errors (Invalid Credentials)

**Scenario**: Supabase Auth returns error for invalid email/password

**Handling**:

1. Catch `AuthenticationError` from service
2. Set error signal with message: "Invalid email or password"
3. Display error message in alert/banner above form
4. Clear loading state
5. Re-enable form for retry
6. Preserve entered email (clear password for security)

**User Recovery**: Correct credentials and resubmit, or navigate to password reset (future feature)

### Network Errors

**Scenario**: Network connection fails during authentication

**Handling**:

1. Catch network error from service
2. Set error signal with message: "Network error. Please check your connection."
3. Display error message in alert/banner
4. Clear loading state
5. Re-enable form

**User Recovery**: Check connection and retry

### Unexpected Errors

**Scenario**: Unexpected error occurs during authentication flow

**Handling**:

1. Catch generic error in catch block
2. Log error to console for debugging
3. Set error signal with message: "An unexpected error occurred. Please try again."
4. Display error message in alert/banner
5. Clear loading state
6. Re-enable form

**User Recovery**: Retry or contact support if persistent

### Already Authenticated Users

**Scenario**: Authenticated user navigates to `/login`

**Handling**:

1. `PublicOnlyGuard` intercepts route activation
2. Redirect to `/library` automatically
3. No login form displayed

**User Recovery**: None needed (desired behavior)

### Session Expiration During Login Attempt

**Scenario**: Rare case where session state is inconsistent

**Handling**:

1. Clear any existing session via `AuthService`
2. Allow login attempt to proceed normally
3. Supabase Auth handles session replacement

**User Recovery**: Continue with login normally

## 11. Implementation Steps

### Step 1: Create Component Files

1. Generate LoginComponent: `ng generate component components/login --changeDetection=OnPush`
2. Create supporting files:
   - `login.component.ts` - Component logic
   - `login.component.html` - Template
   - `login.component.scss` - Styles (if needed)
   - `login.component.spec.ts` - Unit tests

### Step 2: Define Custom Types

1. Create `login.types.ts` in the same directory or `src/app/models/`
2. Define `LoginFormViewModel` interface
3. Define `LoginState` interface (if extracted from component)
4. Export types for use in component

### Step 3: Set Up Component Structure

1. Import required Angular modules:
   - `ReactiveFormsModule` for forms
   - `Router`, `RouterLink` for navigation
   - Material modules: `MatCard`, `MatFormField`, `MatInput`, `MatButton`, `MatError`, `MatProgressSpinner`
2. Set up dependency injection:
   - Inject `FormBuilder` using `inject()`
   - Inject `AuthService` using `inject()`
   - Inject `Router` using `inject()`
3. Set `changeDetection: ChangeDetectionStrategy.OnPush`
4. Configure component standalone mode (Angular 19 default)

### Step 4: Initialize Form and State

1. Create form group with email and password controls:
   ```typescript
   readonly loginForm = this.fb.group({
     email: ['', [Validators.required, Validators.email]],
     password: ['', [Validators.required]]
   });
   ```
2. Initialize state signals:
   ```typescript
   private readonly loadingSignal = signal<boolean>(false);
   private readonly errorSignal = signal<string | null>(null);
   ```
3. Create computed signal for submit button state:
   ```typescript
   readonly isSubmitDisabled = computed(() =>
     this.loadingSignal() || !this.loginForm.valid
   );
   ```

### Step 5: Implement Template

1. Create `mat-card` container with title
2. Add global error message display (conditional with `@if`):
   ```html
   @if (errorSignal()) {
   <mat-error>{{ errorSignal() }}</mat-error>
   }
   ```
3. Create form element with `[formGroup]` and `(ngSubmit)`:
   ```html
   <form [formGroup]="loginForm" (ngSubmit)="onSubmitLogin()"></form>
   ```
4. Add email `mat-form-field` with validation messages:
   ```html
   <mat-form-field>
     <mat-label>Email</mat-label>
     <input matInput type="email" formControlName="email" autocomplete="email" />
     @if (loginForm.controls.email.hasError('required')) {
     <mat-error>Email is required</mat-error>
     } @if (loginForm.controls.email.hasError('email')) {
     <mat-error>Please enter a valid email address</mat-error>
     }
   </mat-form-field>
   ```
5. Add password `mat-form-field` with validation messages
6. Add submit button with loading and disabled states:
   ```html
   <button matButton="filled" type="submit" [disabled]="isSubmitDisabled()">
     @if (loadingSignal()) {
     <mat-spinner diameter="20"></mat-spinner>
     } @else { Log In }
   </button>
   ```
7. Add "Create Account" link:
   ```html
   <a matButton routerLink="/register">Create Account</a>
   ```

### Step 6: Implement Form Submission Logic

1. Create `onSubmitLogin()` method:

   ```typescript
   async onSubmitLogin(): Promise<void> {
     // Validate form
     if (this.loginForm.invalid) {
       this.loginForm.markAllAsTouched();
       return;
     }

     // Set loading state
     this.loadingSignal.set(true);
     this.errorSignal.set(null);

     try {
       // Extract form values
       const { email, password } = this.loginForm.value;

       // Call authentication service
       await this.authService.login(email!, password!);

       // Navigate to library on success
       await this.router.navigate(['/library']);
     } catch (error) {
       // Handle errors
       this.loadingSignal.set(false);

       if (error instanceof AuthenticationError) {
         this.errorSignal.set('Invalid email or password');
       } else {
         this.errorSignal.set('An unexpected error occurred. Please try again.');
       }
     }
   }
   ```

### Step 7: Implement Auto-Focus

1. Add `ViewChild` to get reference to email input:
   ```typescript
   @ViewChild('emailInput') emailInput?: ElementRef<HTMLInputElement>;
   ```
2. In template, add template reference:
   ```html
   <input #emailInput matInput type="email" ... />
   ```
3. Implement `AfterViewInit` to focus on load:
   ```typescript
   ngAfterViewInit(): void {
     this.emailInput?.nativeElement.focus();
   }
   ```

### Step 8: Add Route Configuration

1. In `app.routes.ts`, add login route:
   ```typescript
   {
     path: 'login',
     loadComponent: () => import('./components/login/login.component').then(m => m.LoginComponent),
     canActivate: [PublicOnlyGuard]
   }
   ```

### Step 9: Implement PublicOnlyGuard (if not exists)

1. Create functional guard:

   ```typescript
   export const PublicOnlyGuard: CanActivateFn = () => {
     const authService = inject(AuthService);
     const router = inject(Router);

     if (authService.isAuthenticated()) {
       return router.createUrlTree(['/library']);
     }

     return true;
   };
   ```

### Step 10: Style the Component

1. Add SCSS styling in `login.component.scss`:
   - Center the login card on the page
   - Set appropriate max-width for card (e.g., 400px)
   - Style error message banner
   - Add proper spacing between form fields
   - Style loading spinner overlay if needed
   - Ensure responsive design for mobile

### Step 11: Add Accessibility Features

1. Add ARIA labels to form fields (handled by Material components)
2. Ensure error messages are announced to screen readers:
   ```html
   <div role="alert" aria-live="polite">
     @if (errorSignal()) {
     <mat-error>{{ errorSignal() }}</mat-error>
     }
   </div>
   ```
3. Verify keyboard navigation (Tab order)
4. Test with screen reader
5. Ensure focus management (focus returns to email field on error)

### Step 12: Write Unit Tests

1. Test form validation:
   - Email required validation
   - Email format validation
   - Password required validation
2. Test form submission:
   - Successful login flow
   - Invalid credentials error
   - Network error handling
   - Form state during loading
3. Test navigation:
   - Redirect to library on success
   - Link to registration page
4. Test accessibility:
   - Auto-focus on email field
   - Error announcements

### Step 13: Integration Testing

1. Test with AuthService integration:
   - Mock Supabase responses
   - Test successful authentication
   - Test failed authentication
2. Test route guard integration:
   - Verify redirect when already authenticated
3. Test navigation flow:
   - Login → Library
   - Login → Register → Login

### Step 14: Manual Testing

1. Test in browser with actual Supabase connection
2. Verify all user interactions work as expected
3. Test error scenarios:
   - Invalid email format
   - Empty fields
   - Wrong credentials
   - Network disconnection
4. Test accessibility:
   - Keyboard navigation
   - Screen reader compatibility
   - Focus management
5. Test responsive design on various screen sizes

### Step 15: Code Review and Refinement

1. Review code against Angular best practices
2. Ensure TypeScript strict mode compliance
3. Verify all error messages are user-friendly
4. Check for proper logging (console.log for debugging)
5. Ensure no sensitive data logged
6. Optimize performance (OnPush change detection)
7. Final code cleanup and documentation
