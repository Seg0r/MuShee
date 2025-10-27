# View Implementation Plan: Registration View

## 1. Overview

The Registration View is a public-facing authentication page that enables new users to create accounts for MuShee. Users enter their email address and password, which are validated client-side for format and strength before being submitted to Supabase Auth for secure account creation. Upon successful registration, the user is automatically authenticated and redirected to their empty personal library. The view emphasizes security best practices with real-time validation feedback, clear password requirements, and user-friendly error handling.

## 2. View Routing

- **Path**: `/register`
- **Access**: Public (unauthenticated users only)
- **Route Protection**: `PublicOnlyGuard` prevents authenticated users from accessing this route (redirects to `/library`)
- **Navigation**: Accessible from login page via "Create Account" link or direct URL entry

## 3. Component Structure

### Component Hierarchy

```
RegistrationComponent (main page component)
├── PageHeader/Title
├── Form Container
│   ├── EmailField (mat-form-field)
│   ├── PasswordField (mat-form-field)
│   ├── PasswordRequirementsDisplay
│   ├── CreateAccountButton
│   ├── ServerErrorMessage (conditional)
│   └── LoginLink
└── LoadingOverlay (conditional, during submission)
```

### Shared Components Usage

- **Angular Material Form Fields** (`MatFormField`, `MatInput`): For email and password inputs with validation indicators
- **Angular Material Button** (`MatButton`): For submission and navigation
- **Angular Material Icon** (`MatIcon`): For password visibility toggle and requirement icons
- **MatProgressBar** (optional): For password strength visualization

## 4. Component Details

### RegistrationComponent

**Component description:**
The main registration page component that orchestrates the registration flow. It manages form state using Angular's Reactive Forms API with signal-based state management. Handles client-side validation, server communication via Supabase Auth, and navigation upon success or error.

**Main elements:**

- Email input field with Angular Material styling
- Password input field with visibility toggle icon
- Password requirements checklist showing current validation status
- "Create Account" submit button (disabled until form is valid)
- "Already have an account? Log in" link for navigation to login
- Error message display container (only shown when errors exist)
- Loading spinner overlay during form submission

**Handled interactions:**

- Form field blur events trigger field-level validation
- Form field value changes update password strength indicator
- Submit button click initiates registration process
- Login link navigates to `/login` route
- Password visibility icon toggles between masked/visible text
- Keyboard enter key in password field submits form

**Handled validation:**

- **Email validation (on blur)**:
  - Must match email format pattern (RFC 5322 simplified)
  - Example: "user@example.com" is valid
  - Display inline error below field if invalid format
- **Password validation (on change and submit)**:
  - Minimum 8 characters in length
  - At least one uppercase letter (A-Z)
  - At least one lowercase letter (a-z)
  - At least one number (0-9)
  - Display all requirements in checklist with real-time status updates (✓ or ✗)
- **Form-level validation (on submit)**:
  - Both email and password fields are required (not empty or whitespace)
  - Email must be valid format
  - Password must meet all strength requirements
  - Prevent submission if form invalid
- **Server-side validation (upon API response)**:
  - Email uniqueness (Supabase Auth returns "User already registered" error)
  - Password strength per Supabase Auth policy
  - Handle server errors gracefully and display user-friendly messages

**Types:**

- `RegistrationForm`: Form structure with email and password fields
- `PasswordValidationState`: Password strength validation status
- `RegistrationState`: Component state signals
- `RegistrationError`: Typed error responses from API

**Props:**

- None (standalone component, uses services via `inject()`)

### PasswordRequirementsComponent (Nested/Inline)

**Purpose:** Display password strength requirements in real-time checklist format

**Elements:**

- Requirement items: Minimum 8 characters, Uppercase letter, Lowercase letter, Number
- Each item shows checkmark (✓) or x (✗) based on current password value
- Color coding: green checkmark for met requirement, gray/red x for unmet

---

## 5. Types

### RegistrationForm (FormGroup Value Type)

```typescript
{
  email: string; // User's email address
  password: string; // User's password
}
```

### PasswordValidationState

Computed signal tracking password strength requirements:

```typescript
{
  minLength: boolean; // password.length >= 8
  hasUppercase: boolean; // matches /[A-Z]/
  hasLowercase: boolean; // matches /[a-z]/
  hasNumber: boolean; // matches /[0-9]/
  isValid: boolean; // all above are true
}
```

### RegistrationState

Signal-based component state:

```typescript
{
  isLoading: boolean; // Form submission in progress
  serverError: ErrorResponseDto | null; // Error from Supabase Auth
  emailBlurred: boolean; // Has email field been blurred
  passwordBlurred: boolean; // Has password field been blurred
  formSubmitted: boolean; // Has form been submitted
}
```

### RegistrationError

Extends `ErrorResponseDto` for registration-specific errors:

```typescript
{
  error: {
    code: ErrorCode; // e.g., "UNAUTHORIZED", "CONFLICT"
    message: string; // User-friendly message
  }
}
```

Specific Supabase Auth error codes this component handles:

- `CONFLICT` / "User already registered" → Display "An account with this email already exists"
- `INVALID_REQUEST` → Display "Invalid email or password format"
- `SERVICE_UNAVAILABLE` → Display "Registration service is temporarily unavailable"
- Network timeout → Display "Request timed out. Please check your connection"

---

## 6. State Management

### Signal-Based State

The component uses Angular 19 signals for reactive state management without external state libraries:

```typescript
// Form control state
registrationForm: FormGroup;  // Angular Reactive Forms FormGroup

// UI state signals
isLoading = signal<boolean>(false);
serverError = signal<ErrorResponseDto | null>(null);
emailBlurred = signal<boolean>(false);
passwordBlurred = signal<boolean>(false);
formSubmitted = signal<boolean>(false);

// Computed state
passwordStrength = computed(() => {
  const password = this.registrationForm.get('password')?.value;
  return {
    minLength: password?.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    isValid: /* all above true */
  };
});

isFormValid = computed(() =>
  this.registrationForm.valid && this.passwordStrength().isValid
);
```

### No Custom Hook Required

State management is straightforward and localized to the component. Custom hooks are not needed as signals and computed values handle all state transformations. The component remains self-contained without dependencies on shared state management services.

---

## 7. API Integration

### Authentication Service Integration

The component delegates authentication to `AuthService` which wraps Supabase Auth SDK:

**Supabase Auth Method:**

```typescript
supabase.auth.signUp({
  email: string;
  password: string;
  options?: {
    data?: Record<string, any>;
    redirectTo?: string;
  }
})
```

**Request Payload (from component):**

```json
{
  "email": "user@example.com",
  "password": "SecureP@ss123"
}
```

**Success Response (200 OK):**
Supabase returns authenticated session:

```typescript
{
  session: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    user: {
      id: string;
      email: string;
      created_at: string;
    }
  }
}
```

**Error Response Examples:**

1. **Email Already Registered (409 Conflict)**

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "User already registered"
  }
}
```

UI Message: "An account with this email already exists. Please log in instead."

2. **Weak Password (400 Bad Request)**

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Password is not strong enough"
  }
}
```

UI Message: "Password must meet security requirements. Please try again."

3. **Invalid Email (400 Bad Request)**

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Invalid email format"
  }
}
```

UI Message: "Please enter a valid email address."

### Integration Flow

1. User fills form and clicks "Create Account"
2. Component validates form client-side
3. If valid, component calls `authService.register(email, password)`
4. Service calls `supabase.auth.signUp()`
5. Supabase validates and creates account
6. On success:
   - Supabase Auth SDK sets session automatically
   - AuthService updates `user` signal
   - Component detects authentication state change
   - Component navigates to `/library`
7. On error:
   - AuthService catches error
   - Component displays error message in `serverError` signal
   - User can correct input and retry

---

## 8. User Interactions

### Interaction 1: Email Entry

- **Action**: User clicks email field and types email address
- **Feedback**: No validation until blur (to avoid premature errors)
- **Expected Outcome**: Email value stored in form

### Interaction 2: Email Blur

- **Action**: User tabs/clicks away from email field
- **Validation**: Check email format against pattern
- **Feedback**:
  - Valid: Checkmark icon, field border green
  - Invalid: Red error text below field ("Please enter a valid email address")
- **Expected Outcome**: `emailBlurred` signal set to true, validation error shown if invalid

### Interaction 3: Password Entry

- **Action**: User types in password field
- **Feedback**: Real-time password strength checklist updates
  - Shows current status of each requirement
  - Green checkmark for met, gray x for unmet
- **Expected Outcome**: Password value stored, strength displayed

### Interaction 4: Password Visibility Toggle

- **Action**: User clicks eye icon in password field
- **Feedback**: Password text toggles between hidden (●●●) and visible
- **Expected Outcome**: `type` attribute on input toggles between "password" and "text"

### Interaction 5: Form Submission

- **Action**: User clicks "Create Account" button or presses Enter in password field
- **Validation**:
  - Both fields required and non-empty
  - Email format valid
  - Password meets all strength requirements
- **Feedback**:
  - If invalid: Show all validation errors, focus first invalid field
  - If valid: Loading spinner appears, button disabled
- **Expected Outcome**:
  - Valid: API call initiated, loading state shown
  - Invalid: Form not submitted, errors displayed

### Interaction 6: API Response (Success)

- **Action**: Server responds with success (user account created)
- **Feedback**:
  - Loading spinner disappears
  - Brief success message (optional)
  - Automatic redirect to `/library`
- **Expected Outcome**: User navigated to library with authenticated session

### Interaction 7: API Response (Error)

- **Action**: Server responds with error (e.g., email already registered)
- **Feedback**:
  - Loading spinner disappears
  - Error message displayed in container below form
  - Related form fields highlighted (e.g., email field for "already registered" error)
- **Expected Outcome**: User sees error message, can correct and retry

### Interaction 8: Navigation to Login

- **Action**: User clicks "Already have an account? Log in" link
- **Feedback**: None (standard link behavior)
- **Expected Outcome**: Navigate to `/login` route

### Interaction 9: Keyboard Navigation

- **Action**: User navigates between fields using Tab key
- **Feedback**: Focus indicator visible on each element
- **Expected Outcome**:
  - Tab through: email field → password field → visibility toggle → submit button → login link
  - Shift+Tab reverses order

---

## 9. Conditions and Validation

### Email Validation

**Condition 1: Email Format**

- **Rule**: Must match valid email format
- **Pattern**: Simplified RFC 5322 (e.g., `user@example.com`)
- **Where**: Client-side (form validator) and server-side (Supabase Auth)
- **UI Impact**:
  - Invalid format on blur → Show inline error "Please enter a valid email address"
  - Error cleared when corrected
- **Status**: Shown in form-level validation feedback

**Condition 2: Email Uniqueness**

- **Rule**: Email must not already exist in Supabase Auth
- **Where**: Server-side (Supabase Auth enforces)
- **UI Impact**:
  - Server returns "User already registered" error
  - Display error message: "An account with this email already exists. Please log in instead."
  - Provide link to login page
- **Status**: Shown in `serverError` signal

### Password Validation

**Condition 3: Minimum Length**

- **Rule**: Password must be at least 8 characters
- **Where**: Client-side (display validation) and server-side (Supabase Auth)
- **UI Impact**:
  - Requirement checklist shows ✓ when met, ✗ when not met
  - Real-time update as user types
- **Status**: Shown in password requirements checklist

**Condition 4: Uppercase Letter**

- **Rule**: Password must contain at least one uppercase letter (A-Z)
- **Where**: Client-side (display validation) and server-side (Supabase Auth)
- **UI Impact**: Checklist item updates real-time
- **Status**: Shown in password requirements checklist

**Condition 5: Lowercase Letter**

- **Rule**: Password must contain at least one lowercase letter (a-z)
- **Where**: Client-side (display validation) and server-side (Supabase Auth)
- **UI Impact**: Checklist item updates real-time
- **Status**: Shown in password requirements checklist

**Condition 6: Numeric Character**

- **Rule**: Password must contain at least one number (0-9)
- **Where**: Client-side (display validation) and server-side (Supabase Auth)
- **UI Impact**: Checklist item updates real-time
- **Status**: Shown in password requirements checklist

### Form-Level Conditions

**Condition 7: Required Fields**

- **Rule**: Both email and password fields must be non-empty
- **Where**: Client-side (form validator)
- **UI Impact**: Submit button disabled if either field empty
- **Status**: Reflected in button `disabled` attribute

**Condition 8: Form Validity**

- **Rule**: All field validators must pass and all password requirements met
- **Where**: Client-side (computed signal)
- **UI Impact**:
  - Submit button enabled only when form is valid
  - Button visual state changes (color, pointer)
- **Status**: Reflected in `isFormValid` computed signal

### Condition Verification at Component Level

| Condition          | Verification Method      | Component Impact                            |
| ------------------ | ------------------------ | ------------------------------------------- |
| Email format       | Form validator on blur   | Error message shown, field styling          |
| Email uniqueness   | Supabase Auth response   | `serverError` signal set, message displayed |
| Password length    | Form validator on change | Checklist item updates, button state        |
| Uppercase present  | Form validator on change | Checklist item updates                      |
| Lowercase present  | Form validator on change | Checklist item updates                      |
| Numeric present    | Form validator on change | Checklist item updates                      |
| Both fields filled | Form validator on change | Button `disabled` updates                   |
| All conditions met | Computed signal          | Button enabled, form ready for submission   |

---

## 10. Error Handling

### Error Scenario 1: Invalid Email Format

**Trigger**: User enters malformed email (e.g., "notanemail") and blurs field

**Display**:

- Inline error message below email field: "Please enter a valid email address"
- Email field border turns red
- Error icon appears next to field

**Recovery Options**:

- User corrects email and error clears on blur
- Submit button remains disabled until corrected

**Implementation**:

```typescript
const emailValidator = Validators.email;
// Custom pattern validator for more strict RFC compliance if needed
```

---

### Error Scenario 2: Email Already Registered

**Trigger**: User enters valid email that already has an account and clicks "Create Account"

**Display**:

- Error message container at top of form: "An account with this email already exists. Please log in instead."
- Message includes clickable link to `/login` route
- Email field highlighted with error styling
- Loading spinner removed

**Recovery Options**:

- User clicks "Log in" link to navigate to login
- User clears email field and enters different email to retry
- User can try password reset flow (future feature)

**Implementation**:

```typescript
if (error.code === 'CONFLICT') {
  serverError.set({
    error: {
      code: 'CONFLICT',
      message: 'An account with this email already exists. Please log in instead.',
    },
  });
}
```

---

### Error Scenario 3: Weak Password (Server Response)

**Trigger**: User password doesn't meet Supabase Auth's strength requirements

**Display**:

- Error message: "Password does not meet security requirements. Please ensure it contains uppercase, lowercase, numbers, and is at least 8 characters."
- Password field highlighted
- Form remains on screen with values preserved

**Recovery Options**:

- User modifies password to meet requirements
- Real-time checklist helps identify which requirements are missing
- User can view requirements at any time

**Implementation**:

```typescript
if (error.message.includes('not strong enough')) {
  serverError.set({
    error: {
      code: 'INVALID_REQUEST',
      message: 'Password does not meet security requirements...',
    },
  });
}
```

---

### Error Scenario 4: Network Error

**Trigger**: Network request times out or fails during registration

**Display**:

- Error message: "Network error. Please check your connection and try again."
- Loading spinner removed
- Form values preserved

**Recovery Options**:

- User checks internet connection
- User clicks "Create Account" button again to retry
- User can navigate away and return to try again

**Implementation**:

```typescript
this.authService.register(email, password).pipe(
  timeout(5000),
  catchError(err => {
    if (err instanceof TimeoutError) {
      serverError.set({
        error: { code: 'REQUEST_TIMEOUT', message: 'Network error...' },
      });
    }
    return throwError(() => err);
  })
);
```

---

### Error Scenario 5: Supabase Service Unavailable

**Trigger**: Supabase Auth service returns 500/503 error

**Display**:

- Error message: "Registration service is temporarily unavailable. Please try again later."
- Loading spinner removed
- Form values preserved

**Recovery Options**:

- Wait and retry after a few moments
- Check Supabase status page for known issues

**Implementation**:

```typescript
if (error.status >= 500) {
  serverError.set({
    error: {
      code: 'SERVICE_UNAVAILABLE',
      message: 'Registration service is temporarily unavailable...',
    },
  });
}
```

---

### Error Scenario 6: Validation Error (Missing Fields)

**Trigger**: User attempts to submit form with empty email or password

**Display**:

- Email field error (if empty): "Email is required"
- Password field error (if empty): "Password is required"
- Submit button disabled
- Form does not submit

**Recovery Options**:

- User fills in required fields
- Errors clear as user types

**Implementation**:

```typescript
this.registrationForm = this.formBuilder.group({
  email: ['', [Validators.required, Validators.email]],
  password: ['', [Validators.required, this.passwordStrengthValidator]],
});
```

---

### Global Error Handling

All errors are caught and displayed to user. No unhandled errors displayed in console to end user:

```typescript
this.authService.register(email, password).subscribe({
  next: response => {
    // Success: navigate to library
    this.router.navigate(['/library']);
  },
  error: error => {
    isLoading.set(false);
    serverError.set(this.mapErrorToDto(error));
  },
});
```

---

## 11. Implementation Steps

1. **Generate Component Structure**
   - Create `RegistrationComponent` using Angular CLI
   - Set `standalone: true` in component decorator
   - Set `changeDetection: ChangeDetectionStrategy.OnPush`
   - Create inline template and styles (component is focused)

2. **Import Required Modules**
   - Import `ReactiveFormsModule` from `@angular/forms`
   - Import Material modules: `MatFormFieldModule`, `MatInputModule`, `MatButtonModule`, `MatIconModule`, `MatProgressSpinnerModule`
   - Import `CommonModule` for structural directives
   - Import routing functions: `Router`, `inject()`

3. **Define Types and Interfaces**
   - Define `PasswordValidationState` type
   - Define `RegistrationState` type
   - Define validation error types
   - Add to `src/types.ts` if needed for reusability

4. **Initialize Form Group**
   - Inject `FormBuilder` in component
   - Create `FormGroup` with email and password controls
   - Add validators: `Validators.required`, `Validators.email`, custom password strength validator

5. **Create Custom Validators**
   - Implement `passwordStrengthValidator()` function checking:
     - Minimum 8 characters
     - At least one uppercase letter
     - At least one lowercase letter
     - At least one number
   - Return validation result object with status for each requirement

6. **Set Up Signals**
   - `isLoading = signal(false)` for submission state
   - `serverError = signal(null)` for API errors
   - `emailBlurred = signal(false)` for field blur state
   - `passwordBlurred = signal(false)` for field blur state
   - `formSubmitted = signal(false)` for form submission state

7. **Create Computed Signals**
   - `passwordStrength = computed(...)` analyzing password field value
   - `isFormValid = computed(...)` checking form validity and password requirements

8. **Build Template Structure**
   - Create form container with responsive layout
   - Add email input field with mat-form-field
   - Add password input field with visibility toggle icon
   - Add password requirements checklist component (inline)
   - Add error message display container
   - Add submit button (disabled until form valid)
   - Add "Log in" link at bottom

9. **Implement Form Validation Display**
   - Show email error on blur if invalid: "Please enter a valid email address"
   - Show password requirements checklist with real-time status
   - Show form-level validation errors before submission
   - Highlight invalid fields with error styling

10. **Implement Form Submission**
    - Create `onSubmit()` method
    - Check form validity before proceeding
    - Set `isLoading` signal to true
    - Inject `AuthService` and call `register(email, password)`
    - Handle success: auto-navigate to `/library`
    - Handle error: display error message, set `serverError` signal

11. **Implement Error Handling**
    - Map Supabase Auth error codes to user-friendly messages
    - Handle network errors with timeout
    - Handle server-side validation failures
    - Display errors in `serverError` container
    - Show related field errors with styling

12. **Implement Navigation**
    - Create "Already have an account? Log in" link
    - Inject `Router` and navigate to `/login` on click
    - Ensure routing is lazy-loaded where applicable

13. **Add Accessibility Features**
    - Add `<label>` elements for form fields with `for` attribute
    - Add `aria-label` on icon buttons (visibility toggle)
    - Add `aria-describedby` linking errors to error messages
    - Add `aria-live="polite"` for error message container
    - Ensure proper focus management and keyboard navigation

14. **Apply Styling with Angular Material**
    - Use Material form field styling: `mat-form-field` class
    - Use Material button styling: `matButton="filled"` or `matButton="outlined"`
    - Implement responsive layout for mobile/tablet/desktop
    - Use Material theme colors and typography
    - Add loading spinner overlay during submission

15. **Implement Keyboard Interactions**
    - Allow Enter key in password field to submit form
    - Support Tab key for field navigation
    - Support Escape key if any modals involved

16. **Add Loading State UI**
    - Show spinner overlay during registration
    - Disable form inputs while loading
    - Disable submit button while loading
    - Show loading message (optional)

17. **Test All Flows**
    - Valid registration: email and password meet requirements
    - Email already registered: display appropriate error
    - Weak password: show validation requirements
    - Network error: handle gracefully
    - Form validation: all error cases
    - Keyboard navigation: all interactive elements

18. **Integrate with Route Guards**
    - Ensure `PublicOnlyGuard` redirects authenticated users to `/library`
    - Test deep linking to `/register` when already authenticated

19. **Integrate with AuthService**
    - Ensure AuthService properly wraps Supabase Auth
    - Handle token storage and session management
    - Update `user` signal on successful registration
    - Update `isAuthenticated` computed signal

20. **Final Polish**
    - Remove any console logs
    - Add descriptive comments for complex logic
    - Ensure error messages are clear and actionable
    - Test across different browsers and devices
    - Verify accessibility with screen reader
