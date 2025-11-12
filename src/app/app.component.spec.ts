import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AppComponent } from './app.component';
import { SupabaseService } from './services/supabase.service';
import { AuthService } from './services/auth.service';

describe('AppComponent', () => {
  beforeEach(async () => {
    // Create mock SupabaseService to avoid Navigator LockManager issues in tests
    const mockSupabaseService = jasmine.createSpyObj('SupabaseService', [], {
      client: jasmine.createSpyObj('SupabaseClient', ['auth'], {
        auth: jasmine.createSpyObj('Auth', ['getUser', 'onAuthStateChange', 'signOut']),
      }),
    });

    // Create mock AuthService to avoid initialization issues
    const mockAuthService = jasmine.createSpyObj('AuthService', ['getUserEmail'], {
      user: signal(null),
      isLoading: signal(false),
      isAuthenticated: signal(false),
    });

    // Setup mock auth responses
    mockSupabaseService.client.auth.getUser.and.returnValue(
      Promise.resolve({
        data: { user: null },
        error: null,
      })
    );
    mockSupabaseService.client.auth.onAuthStateChange.and.returnValue({
      data: {
        subscription: {
          unsubscribe: () => {
            // Mock unsubscribe - no-op for tests
          },
        },
      },
    });

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it(`should have the 'mushee' title`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('mushee');
  });

  it('should render router outlet', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });
});
