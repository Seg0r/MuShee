import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RegistrationComponent } from './registration.component';
import { SupabaseService } from '../../services/supabase.service';
import { ProfileService } from '../../services/profile.service';
import { ErrorHandlingService } from '../../services/error-handling.service';
import { Router } from '@angular/router';
import type { ProfileDto } from '../../../types';

describe('RegistrationComponent', () => {
  let component: RegistrationComponent;
  let fixture: ComponentFixture<RegistrationComponent>;
  let mockSupabaseService: jasmine.SpyObj<SupabaseService>;
  let mockProfileService: jasmine.SpyObj<ProfileService>;
  let mockErrorHandlingService: jasmine.SpyObj<ErrorHandlingService>;
  let mockRouter: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    // Create mock services
    mockSupabaseService = jasmine.createSpyObj('SupabaseService', ['client'], {
      client: jasmine.createSpyObj('SupabaseClient', ['auth']),
    });
    mockProfileService = jasmine.createSpyObj('ProfileService', ['getCurrentUserProfile']);
    mockErrorHandlingService = jasmine.createSpyObj('ErrorHandlingService', [
      'mapSupabaseAuthError',
      'mapGenericError',
      'mapNetworkError',
      'logError',
    ]);
    mockRouter = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [RegistrationComponent],
      providers: [
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: ProfileService, useValue: mockProfileService },
        { provide: ErrorHandlingService, useValue: mockErrorHandlingService },
        { provide: Router, useValue: mockRouter },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RegistrationComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with empty form', () => {
    expect(component.registrationForm.get('email')?.value).toBe('');
    expect(component.registrationForm.get('password')?.value).toBe('');
  });

  it('should mark form as invalid initially', () => {
    expect(component.registrationForm.valid).toBeFalsy();
  });

  it('should validate email format', () => {
    const emailControl = component.registrationForm.get('email');
    emailControl?.setValue('invalid-email');
    emailControl?.markAsTouched();
    expect(emailControl?.hasError('email')).toBeTruthy();
  });

  it('should validate password requirements', () => {
    const passwordControl = component.registrationForm.get('password');

    // Test minimum length
    passwordControl?.setValue('Pass1');
    expect(component.passwordStrength().minLength).toBeFalsy();

    // Test uppercase
    passwordControl?.setValue('pass123');
    expect(component.passwordStrength().hasUppercase).toBeFalsy();

    // Test lowercase
    passwordControl?.setValue('PASS1234');
    expect(component.passwordStrength().hasLowercase).toBeFalsy();

    // Test number
    passwordControl?.setValue('Password');
    expect(component.passwordStrength().hasNumber).toBeFalsy();

    // Test valid password
    passwordControl?.setValue('Password1');
    expect(component.passwordStrength().isValid).toBeTruthy();
  });

  it('should toggle password visibility', () => {
    expect(component.showPassword()).toBeFalsy();
    component.togglePasswordVisibility();
    expect(component.showPassword()).toBeTruthy();
    component.togglePasswordVisibility();
    expect(component.showPassword()).toBeFalsy();
  });

  it('should set emailBlurred signal on email blur', () => {
    expect(component.emailBlurred()).toBeFalsy();
    component.onEmailBlur();
    expect(component.emailBlurred()).toBeTruthy();
  });

  it('should set passwordBlurred signal on password blur', () => {
    expect(component.passwordBlurred()).toBeFalsy();
    component.onPasswordBlur();
    expect(component.passwordBlurred()).toBeTruthy();
  });

  it('should disable submit button when form is invalid', () => {
    expect(component.isFormValid()).toBeTruthy(); // Returns true when disabled
    component.registrationForm.get('email')?.setValue('test@example.com');
    component.registrationForm.get('password')?.setValue('Password1');
    expect(component.isFormValid()).toBeFalsy(); // Returns false when enabled
  });

  it('should display email error message when email is invalid', () => {
    const emailControl = component.registrationForm.get('email');
    emailControl?.setValue('invalid');
    emailControl?.markAsTouched();
    expect(component.emailErrorMessage).toContain('valid email');
  });

  it('should display password error message when password is weak', () => {
    const passwordControl = component.registrationForm.get('password');
    passwordControl?.setValue('weak');
    passwordControl?.markAsTouched();
    expect(component.passwordErrorMessage).toContain('requirements');
  });

  it('should submit form with valid data', async () => {
    const email = 'test@example.com';
    const password = 'Password1';

    component.registrationForm.get('email')?.setValue(email);
    component.registrationForm.get('password')?.setValue(password);

    const mockAuthResponse = {
      data: {
        user: { id: '123', email },
        session: { access_token: 'token' },
      },
      error: null,
    };

    const mockProfile: ProfileDto = {
      id: '123',
      updated_at: new Date().toISOString(),
      has_completed_onboarding: false,
    };

    mockSupabaseService.client.auth.signUp = jasmine
      .createSpy('signUp')
      .and.returnValue(Promise.resolve(mockAuthResponse));
    mockProfileService.getCurrentUserProfile.and.returnValue(Promise.resolve(mockProfile));

    const event = new Event('submit');
    await component.onSubmit(event);

    expect(mockSupabaseService.client.auth.signUp).toHaveBeenCalledWith({
      email,
      password,
    });
    expect(mockProfileService.getCurrentUserProfile).toHaveBeenCalled();
  });

  it('should handle registration error', async () => {
    component.registrationForm.get('email')?.setValue('test@example.com');
    component.registrationForm.get('password')?.setValue('Password1');

    const mockError = new Error('Registration failed');
    mockSupabaseService.client.auth.signUp = jasmine.createSpy('signUp').and.returnValue(
      Promise.resolve({
        data: null,
        error: mockError,
      })
    );

    mockErrorHandlingService.mapSupabaseAuthError.and.returnValue({
      code: 'CONFLICT',
      message: 'Email already registered',
      timestamp: new Date(),
    });

    const event = new Event('submit');
    await component.onSubmit(event);

    expect(component.serverError()).toBeTruthy();
  });

  it('should handle Enter key submission', () => {
    component.registrationForm.get('email')?.setValue('test@example.com');
    component.registrationForm.get('password')?.setValue('Password1');

    const event = new KeyboardEvent('keydown', { key: 'Enter' });
    spyOn(component, 'onSubmit');

    component.onKeyDown(event);

    expect(component.onSubmit).toHaveBeenCalled();
  });

  it('should not submit on other keys', () => {
    const event = new KeyboardEvent('keydown', { key: 'Tab' });
    spyOn(component, 'onSubmit');

    component.onKeyDown(event);

    expect(component.onSubmit).not.toHaveBeenCalled();
  });
});
