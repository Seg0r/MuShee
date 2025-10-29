import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  inject,
  OnInit,
  effect,
  Signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { SupabaseService } from '../../services/supabase.service';
import { ProfileService } from '../../services/profile.service';
import { ErrorHandlingService } from '../../services/error-handling.service';
import { MatFormField, MatLabel, MatError } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import type {
  AuthError,
  RegistrationFormData,
  PasswordValidationState,
} from '../../models/registration';

/**
 * Main registration page component that orchestrates the registration flow.
 * Manages form state using Angular's Reactive Forms API with signal-based state management.
 * Handles client-side validation, server communication via Supabase Auth, and navigation.
 */
@Component({
  selector: 'app-registration',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatFormField,
    MatLabel,
    MatError,
    MatInput,
    MatIcon,
    MatProgressSpinner,
  ],
  templateUrl: './registration.component.html',
  styleUrl: './registration.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistrationComponent implements OnInit {
  /**
   * Injected services
   */
  private readonly supabaseService = inject(SupabaseService);
  private readonly profileService = inject(ProfileService);
  private readonly errorHandlingService = inject(ErrorHandlingService);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);

  /**
   * State signals for form management
   */
  isLoading = signal<boolean>(false);
  serverError = signal<AuthError | null>(null);
  emailBlurred = signal<boolean>(false);
  passwordBlurred = signal<boolean>(false);
  formSubmitted = signal<boolean>(false);

  /**
   * Reactive form group for managing email and password inputs
   */
  registrationForm!: FormGroup;

  /**
   * Signal to track form control changes for reactivity
   */
  private formControlsChanged = signal(0);

  /**
   * Password value signal for reactive updates
   */
  private passwordValueSignal!: Signal<string>;

  /**
   * Email value signal for reactive updates
   */
  private emailValueSignal!: Signal<string>;

  /**
   * Computed password strength validation state
   */
  passwordStrength = computed<PasswordValidationState>(() => {
    // Access the password value signal to trigger this computed signal
    const password = this.passwordValueSignal?.() ?? '';
    return {
      minLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      isValid:
        password.length >= 8 &&
        /[A-Z]/.test(password) &&
        /[a-z]/.test(password) &&
        /[0-9]/.test(password),
    };
  });

  /**
   * Computed derived state to check if submit button should be disabled
   */
  isFormValid = computed(() => {
    // Access signals to trigger reactivity
    this.emailValueSignal?.();
    this.passwordValueSignal?.();
    this.formControlsChanged();

    const loading = this.isLoading();
    const formValid = this.registrationForm?.valid ?? false;
    const passwordValid = this.passwordStrength().isValid;

    return !(loading || (formValid && passwordValid));
  });

  /**
   * Show password toggle state
   */
  showPassword = signal<boolean>(false);

  constructor() {
    this.registrationForm = this.createFormGroup();

    const emailControl = this.registrationForm.get('email')!;
    const passwordControl = this.registrationForm.get('password')!;

    // Convert form value changes to signals for reactive updates
    this.emailValueSignal = toSignal(emailControl.valueChanges, {
      initialValue: emailControl.value,
    });
    this.passwordValueSignal = toSignal(passwordControl.valueChanges, {
      initialValue: passwordControl.value,
    });

    // Trigger computed signal updates on form value changes
    effect(() => {
      this.emailValueSignal();
      this.passwordValueSignal();
      this.formControlsChanged.update(v => v + 1);
    });
  }

  ngOnInit(): void {
    this.checkExistingSession();
  }

  /**
   * Checks if user already has an active session.
   * If authenticated, redirects to library immediately.
   * If not, displays registration form.
   */
  private async checkExistingSession(): Promise<void> {
    try {
      const {
        data: { user },
        error: authError,
      } = await this.supabaseService.client.auth.getUser();

      if (authError || !user) {
        console.log('No active session found, displaying registration form');
        return;
      }

      console.log('Existing session found, redirecting to library');
      // User already authenticated, redirect to library
      await this.router.navigate(['/library']);
    } catch (error) {
      console.error('Error checking existing session:', error);
      // On error, show registration form (safe fallback)
    }
  }

  /**
   * Creates the reactive form group with appropriate validators.
   * Email: required + email format validation, updates on blur
   * Password: required + custom password strength validator, updates on change
   */
  private createFormGroup(): FormGroup {
    return this.formBuilder.group({
      email: [
        '',
        {
          validators: [Validators.required, Validators.email],
          updateOn: 'blur',
        },
      ],
      password: [
        '',
        {
          validators: [Validators.required, this.passwordStrengthValidator.bind(this)],
          updateOn: 'change',
        },
      ],
    });
  }

  /**
   * Custom validator for password strength requirements.
   * Checks for minimum length (8), uppercase, lowercase, and numeric characters.
   */
  private passwordStrengthValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) {
      return null; // Let required validator handle empty values
    }

    const password = control.value;
    const errors: ValidationErrors = {};

    if (password.length < 8) {
      errors['minLength'] = true;
    }
    if (!/[A-Z]/.test(password)) {
      errors['noUppercase'] = true;
    }
    if (!/[a-z]/.test(password)) {
      errors['noLowercase'] = true;
    }
    if (!/[0-9]/.test(password)) {
      errors['noNumber'] = true;
    }

    return Object.keys(errors).length > 0 ? errors : null;
  }

  /**
   * Handles email field blur event.
   * Updates emailBlurred signal to show validation errors.
   */
  onEmailBlur(): void {
    this.emailBlurred.set(true);
  }

  /**
   * Handles password field blur event.
   * Updates passwordBlurred signal to show validation errors.
   */
  onPasswordBlur(): void {
    this.passwordBlurred.set(true);
  }

  /**
   * Toggles password visibility between masked and visible text.
   * Updates the input type between 'password' and 'text'.
   */
  togglePasswordVisibility(): void {
    this.showPassword.update(value => !value);
  }

  /**
   * Handles key down event on form inputs.
   * Submits form if Enter is pressed and form is valid.
   */
  onKeyDown(event: KeyboardEvent): void {
    if (
      event.key === 'Enter' &&
      this.registrationForm.valid &&
      !this.isLoading() &&
      this.passwordStrength().isValid
    ) {
      this.onSubmit(event);
    }
  }

  /**
   * Handles form submission.
   * Validates form, prevents submission if invalid, and calls registration API.
   */
  async onSubmit(event: Event): Promise<void> {
    event.preventDefault();

    // Mark all fields as touched to show validation errors
    Object.keys(this.registrationForm.controls).forEach(key => {
      this.registrationForm.get(key)?.markAsTouched();
    });

    // Validate form before submission
    if (this.registrationForm.invalid || !this.passwordStrength().isValid) {
      this.formSubmitted.set(true);
      return;
    }

    // Clear previous errors and set loading state
    this.serverError.set(null);
    this.isLoading.set(true);
    this.formSubmitted.set(true);

    try {
      const formData: RegistrationFormData = {
        email: this.registrationForm.get('email')?.value?.trim() || '',
        password: this.registrationForm.get('password')?.value || '',
      };

      // Attempt registration with Supabase
      const { data, error: signUpError } = await this.supabaseService.client.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (signUpError) {
        // Map Supabase error to user-friendly message using error handling service
        const appError = this.errorHandlingService.mapSupabaseAuthError(signUpError);
        this.errorHandlingService.logError(appError, 'RegistrationComponent.onSubmit');

        // Convert to AuthError for display
        const authError: AuthError = {
          code: appError.code,
          message: appError.message,
          field: 'general',
          timestamp: appError.timestamp,
        };
        this.serverError.set(authError);
        console.warn('Registration failed:', authError);
        return;
      }

      if (!data?.user || !data?.session) {
        // Unexpected response structure
        const error: AuthError = {
          code: 'INVALID_RESPONSE',
          message: 'Unexpected registration response. Please try again.',
          field: 'general',
          timestamp: new Date(),
        };
        this.serverError.set(error);
        this.errorHandlingService.logError(
          {
            code: error.code,
            message: error.message,
            timestamp: error.timestamp,
          },
          'RegistrationComponent.onSubmit'
        );
        return;
      }

      // Successful registration
      console.log('Registration successful, verifying profile');

      // Verify profile exists (auto-created if configured)
      try {
        await this.profileService.getCurrentUserProfile();
      } catch (profileError) {
        console.error('Profile verification failed:', profileError);
        // Continue anyway, profile will be created via trigger if needed
      }

      // Navigate to library
      console.log('Registration complete, redirecting to library');
      await this.router.navigate(['/library']);
    } catch (error) {
      // Handle unexpected errors
      console.error('Unexpected error during registration:', error);

      // Map error using error handling service
      let appError = this.errorHandlingService.mapGenericError(error);

      // Try to detect if it's a network error
      if (error instanceof TypeError && String(error).includes('fetch')) {
        appError = this.errorHandlingService.mapNetworkError(error);
      }

      this.errorHandlingService.logError(appError, 'RegistrationComponent.onSubmit');

      // Convert to AuthError for display
      const authError: AuthError = {
        code: appError.code,
        message: appError.message,
        field: 'general',
        timestamp: appError.timestamp,
      };
      this.serverError.set(authError);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Gets the email form control for template use.
   */
  get emailControl() {
    return this.registrationForm.get('email');
  }

  /**
   * Gets the password form control for template use.
   */
  get passwordControl() {
    return this.registrationForm.get('password');
  }

  /**
   * Determines which email error message to display.
   * Returns appropriate message based on validation state.
   */
  get emailErrorMessage(): string {
    const control = this.emailControl;
    if (control?.hasError('required') && (control?.touched || this.emailBlurred())) {
      return 'Email is required';
    }
    if (control?.hasError('email') && (control?.touched || this.emailBlurred())) {
      return 'Please enter a valid email address';
    }
    return '';
  }

  /**
   * Determines which password error message to display.
   * Returns appropriate message based on validation state.
   */
  get passwordErrorMessage(): string {
    const control = this.passwordControl;
    if (control?.hasError('required') && (control?.touched || this.passwordBlurred())) {
      return 'Password is required';
    }
    if (
      control?.hasError('minLength') ||
      control?.hasError('noUppercase') ||
      control?.hasError('noLowercase') ||
      control?.hasError('noNumber')
    ) {
      if (control?.touched || this.passwordBlurred()) {
        return 'Password must meet all requirements shown below';
      }
    }
    return '';
  }

  /**
   * Gets status of individual password requirement.
   */
  isPasswordRequirementMet(requirement: keyof PasswordValidationState): boolean {
    if (requirement === 'isValid') return false;
    return this.passwordStrength()[requirement];
  }
}
