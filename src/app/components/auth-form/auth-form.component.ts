import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  viewChild,
  computed,
  inject,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatFormField, MatLabel, MatError } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatIcon } from '@angular/material/icon';
import type { AuthError, LoginFormData } from '../../models/login';

/**
 * Presentational component for the authentication form.
 * Handles form display, validation, and submission without managing authentication logic.
 * The parent component (LoginComponent) handles the actual authentication API calls.
 */
@Component({
  selector: 'app-auth-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatFormField,
    MatLabel,
    MatError,
    MatInput,
    MatProgressSpinner,
    MatIcon,
  ],
  templateUrl: './auth-form.component.html',
  styleUrl: './auth-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'auth-form-component',
  },
})
export class AuthFormComponent {
  /**
   * Input: Controls whether the form is in loading state during API call
   */
  readonly isLoading = input<boolean>(false);

  /**
   * Input: Error message to display, null if no error
   */
  readonly error = input<AuthError | null>(null);

  /**
   * Output: Emits form data when user submits the form
   */
  readonly loginSubmit = output<LoginFormData>();

  /**
   * Reference to the form for programmatic access
   */
  readonly formRef = viewChild<HTMLFormElement>('form');

  /**
   * State to track whether password should be visible
   */
  showPassword = false;

  /**
   * Reactive form group for managing email and password inputs
   */
  formGroup: FormGroup;

  /**
   * Computed state to check if submit button should be disabled
   */
  isSubmitDisabled = computed(() => {
    const loading = this.isLoading();
    const emailValid = this.emailControl?.valid ?? false;
    const passwordValid = this.passwordControl?.valid ?? false;
    const allValid = emailValid && passwordValid;

    return loading || !allValid;
  });

  private readonly formBuilder = inject(FormBuilder);

  constructor() {
    this.formGroup = this.createFormGroup();
  }

  /**
   * Creates the reactive form group with appropriate validators.
   * Email: required + email format validation, updates on change
   * Password: required + minimum length 8, updates on change
   */
  private createFormGroup(): FormGroup {
    return this.formBuilder.group({
      email: [
        '',
        {
          validators: [Validators.required, Validators.email],
          updateOn: 'change',
        },
      ],
      password: [
        '',
        {
          validators: [Validators.required, Validators.minLength(8)],
          updateOn: 'change',
        },
      ],
    });
  }

  /**
   * Handles form submission.
   * Validates form, clears any previous errors, and emits login data to parent component.
   * Prevents default form submission behavior.
   */
  onSubmit(event: Event): void {
    event.preventDefault();

    // Mark all fields as touched to show validation errors
    Object.keys(this.formGroup.controls).forEach(key => {
      this.formGroup.get(key)?.markAsTouched();
    });

    // Validate form before submission
    if (this.formGroup.invalid) {
      return;
    }

    // Emit form data to parent component
    const formData: LoginFormData = {
      email: this.formGroup.get('email')?.value?.trim() || '',
      password: this.formGroup.get('password')?.value || '',
    };

    this.loginSubmit.emit(formData);
  }

  /**
   * Handles Enter key press on form inputs.
   * Submits form if Enter is pressed.
   */
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && this.formGroup.valid && !this.isLoading()) {
      this.onSubmit(event);
    }
  }

  /**
   * Toggles password visibility between masked and visible text.
   * Updates the input type between 'password' and 'text'.
   */
  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  /**
   * Gets the email form control for template use.
   */
  get emailControl() {
    return this.formGroup.get('email');
  }

  /**
   * Gets the password form control for template use.
   */
  get passwordControl() {
    return this.formGroup.get('password');
  }

  /**
   * Determines which email error message to display.
   * Returns appropriate message based on validation state.
   */
  get emailErrorMessage(): string {
    const control = this.emailControl;
    if (control?.hasError('required') && control?.touched) {
      return 'Email is required';
    }
    if (control?.hasError('email') && control?.touched) {
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
    if (control?.hasError('required') && control?.touched) {
      return 'Password is required';
    }
    if (control?.hasError('minlength') && control?.touched) {
      return 'Password must be at least 8 characters';
    }
    return '';
  }
}
