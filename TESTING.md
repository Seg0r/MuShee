# MuShee Testing Guide

This guide provides comprehensive instructions for running and writing tests in the MuShee project, covering both unit tests (Karma/Jasmine) and end-to-end tests (Playwright).

## Table of Contents

1. [Unit Testing with Karma & Jasmine](#unit-testing-with-karma--jasmine)
2. [E2E Testing with Playwright](#e2e-testing-with-playwright)
3. [Test Structure & Best Practices](#test-structure--best-practices)
4. [Running Tests](#running-tests)
5. [Debugging Tests](#debugging-tests)
6. [CI/CD Integration](#cicd-integration)

---

## Unit Testing with Karma & Jasmine

### Overview

Unit tests validate individual components, services, and utilities in isolation using Jasmine, with Karma as the test runner. Tests run in a real browser environment (ChromeHeadless by default).

### Key Concepts

- **TestBed**: Angular's testing utility for configuring the test module and dependency injection
- **ComponentFixture**: Wraps an Angular component for testing with access to the component instance and DOM
- **Spies**: Mock functions for tracking calls and controlling behavior using Jasmine's `spyOn()`
- **AAA Pattern**: Arrange-Act-Assert structure for readable tests

### Running Unit Tests

```bash
# Run tests in watch mode (default)
npm run test

# Run tests once (CI mode)
npm run test:ci

# Generate coverage report
npm run test:coverage
```

### File Organization

```
src/
├── app/
│   ├── components/
│   │   └── component-name/
│   │       ├── component-name.component.ts
│   │       ├── component-name.component.html
│   │       └── component-name.component.spec.ts  ← Test file
│   ├── services/
│   │   ├── service-name.service.ts
│   │   └── service-name.service.spec.ts  ← Test file
│   └── ...
└── testing/
    ├── mock-providers.ts    ← Centralized mock services
    └── test-helpers.ts      ← Reusable test utilities
```

### Writing Unit Tests

#### 1. Component Tests

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MyComponent } from './my.component';
import { getMockProviders } from '@/testing/mock-providers';
import { getElement, clickElement } from '@/testing/test-helpers';

describe('MyComponent', () => {
  let component: MyComponent;
  let fixture: ComponentFixture<MyComponent>;

  beforeEach(async () => {
    // Arrange: Configure TestBed
    await TestBed.configureTestingModule({
      imports: [MyComponent, MaterialModules],
      providers: [getMockProviders()],
    }).compileComponents();

    // Create component instance
    fixture = TestBed.createComponent(MyComponent);
    component = fixture.componentInstance;
  });

  it('should display title', () => {
    // Arrange
    component.title = 'Test Title';

    // Act
    fixture.detectChanges();

    // Assert
    const titleEl = getElement<HTMLElement>(fixture, '[data-testid="title"]');
    expect(titleEl?.textContent).toContain('Test Title');
  });

  it('should emit event on button click', () => {
    // Arrange
    fixture.detectChanges();
    spyOn(component.buttonClicked, 'emit');

    // Act
    clickElement(fixture, 'button');

    // Assert
    expect(component.buttonClicked.emit).toHaveBeenCalled();
  });
});
```

#### 2. Service Tests

```typescript
import { TestBed } from '@angular/core/testing';
import { MyService } from './my.service';

describe('MyService', () => {
  let service: MyService;

  beforeEach(() => {
    // Arrange
    TestBed.configureTestingModule({});
    service = TestBed.inject(MyService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return expected data', () => {
    // Act
    const result = service.getData();

    // Assert
    expect(result).toEqual(['item1', 'item2']);
  });

  it('should handle async operations', async () => {
    // Arrange
    const expected = { id: 1, name: 'Test' };

    // Act & Assert
    await expectAsync(service.fetchData()).toBeResolvedTo(expected);
  });
});
```

#### 3. Using Mocks Effectively

```typescript
describe('ComponentWithDependencies', () => {
  let component: ComponentWithDependencies;
  let fixture: ComponentFixture<ComponentWithDependencies>;
  let mockAuthService: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    // Create spy object
    mockAuthService = jasmine.createSpyObj('AuthService', ['login', 'logout']);

    await TestBed.configureTestingModule({
      imports: [ComponentWithDependencies],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compileComponents();

    fixture = TestBed.createComponent(ComponentWithDependencies);
    component = fixture.componentInstance;
  });

  it('should call login on submit', () => {
    // Arrange
    mockAuthService.login.and.returnValue(Promise.resolve());
    fixture.detectChanges();

    // Act
    clickElement(fixture, 'button[type="submit"]');
    fixture.detectChanges();

    // Assert
    expect(mockAuthService.login).toHaveBeenCalled();
  });
});
```

### Test Coverage

The project targets >80% code coverage for critical paths. Check coverage with:

```bash
npm run test:coverage
```

Coverage reports are generated in `coverage/` directory.

---

## E2E Testing with Playwright

### Overview

E2E tests validate complete user workflows by simulating real browser interactions. Playwright runs headless Chromium by default, with support for visual comparisons and API testing.

### Running E2E Tests

```bash
# Run all E2E tests
npm run e2e

# Run in UI mode (interactive)
npm run e2e:ui

# Debug mode with inspector
npm run e2e:debug

# Generate code from browser interactions
npm run e2e:codegen
```

### File Organization

```
e2e/
├── fixtures/
│   ├── page-objects.ts      ← Page Object Models
│   ├── test-data.ts         ← Test data and constants
│   └── index.ts             ← Fixture exports
├── auth.spec.ts             ← Authentication tests
├── library.spec.ts          ← Library feature tests
└── ...
```

### Writing E2E Tests

#### 1. Using Page Objects

Page Object Model pattern encapsulates page interactions and improves maintainability:

```typescript
import { test, expect } from '@playwright/test';
import { LoginPage } from './fixtures/page-objects';

test.describe('Authentication', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.navigate();
  });

  test('should login successfully', async ({ page }) => {
    // Arrange
    const testUser = {
      email: 'test@example.com',
      password: 'TestPassword123!',
    };

    // Act
    await loginPage.login(testUser.email, testUser.password);

    // Assert
    await loginPage.waitForURL('/library');
    expect(page.url()).toContain('/library');
  });
});
```

#### 2. Creating Custom Page Objects

```typescript
export class CustomPage extends BasePage {
  readonly emailInput = () => this.page.locator('input[type="email"]');
  readonly submitButton = () => this.page.locator('button[type="submit"]');

  async navigate(): Promise<void> {
    await this.goto('/custom-page');
  }

  async fillForm(email: string): Promise<void> {
    await this.fillField('input[type="email"]', email);
  }

  async submit(): Promise<void> {
    await this.clickButton('button[type="submit"]');
  }
}
```

#### 3. Visual Regression Testing

```typescript
test('should render correctly', async ({ page }) => {
  await page.goto('/library');

  // Compare screenshot with baseline
  await expect(page).toHaveScreenshot('library-page.png');
});
```

#### 4. API Testing Integration

```typescript
test('should verify API response', async ({ page }) => {
  // Intercept API requests
  await page.route('/api/songs', route => {
    route.abort();
  });

  // Or inspect request
  const [response] = await Promise.all([page.waitForResponse('/api/songs'), page.goto('/library')]);

  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data).toHaveProperty('songs');
});
```

### Test Organization

Tests should be organized by feature:

```
e2e/
├── auth.spec.ts              ← Login, signup, logout
├── library.spec.ts           ← Song library management
├── sheet-viewer.spec.ts      ← Sheet music viewing
├── discover.spec.ts          ← Song discovery
└── fixtures/
    ├── page-objects.ts
    └── test-data.ts
```

### Best Practices

1. **Use Page Object Model**: Encapsulate page interactions
2. **Locator Strategy**: Prefer `data-testid` over fragile selectors
3. **Wait for Elements**: Use explicit waits, not arbitrary delays
4. **Isolate Tests**: Each test should be independent
5. **Use Fixtures**: Share setup code with `test.beforeEach()`
6. **Capture Evidence**: Enable screenshots and videos on failure

---

## Test Structure & Best Practices

### AAA Pattern (Arrange-Act-Assert)

All tests should follow the AAA pattern for clarity:

```typescript
it('should do something', () => {
  // Arrange: Set up test data and conditions
  const input = { name: 'Test', value: 123 };

  // Act: Execute the code being tested
  const result = myFunction(input);

  // Assert: Verify the outcome
  expect(result).toEqual(expectedValue);
});
```

### Naming Conventions

- **Test suites**: `describe('ComponentName', ...)`
- **Test cases**: `it('should [action] [when condition]', ...)`
- **Test files**: `*.spec.ts` for unit tests, `*.spec.ts` for E2E tests

### Test Data

Keep test data centralized and reusable:

```typescript
// src/testing/mock-providers.ts
export function createMockSong(overrides?: any) {
  return {
    id: 'test-1',
    title: 'Test Song',
    composer: 'Test Composer',
    ...overrides,
  };
}
```

### Avoiding Common Pitfalls

❌ **Don't:**

- Use hardcoded delays (`setTimeout`)
- Test implementation details
- Create tightly coupled tests
- Ignore accessibility

✅ **Do:**

- Use explicit waits (`waitForSelector`, `waitForURL`)
- Test behavior and outcomes
- Create focused, independent tests
- Include accessibility tests

---

## Running Tests

### Unit Tests Commands

```bash
# Watch mode (for development)
npm run test

# Single run (for CI/CD)
npm run test:ci

# With coverage report
npm run test:coverage

# Specific test file
ng test --include='**/my-component.spec.ts'

# Specific test suite
ng test --include='**/auth/**/*.spec.ts'
```

### E2E Tests Commands

```bash
# Run all E2E tests
npm run e2e

# Run specific test file
npx playwright test e2e/auth.spec.ts

# Run single test
npx playwright test e2e/auth.spec.ts -g "should login"

# UI mode (interactive debugging)
npm run e2e:ui

# Debug mode with inspector
npm run e2e:debug

# Codegen (record interactions)
npm run e2e:codegen

# Generate report
npx playwright show-report
```

---

## Debugging Tests

### Unit Test Debugging

1. **Chrome DevTools in Watch Mode**:
   - Run `npm run test`
   - Browser window opens automatically
   - Click DEBUG button or inspect in DevTools

2. **console.log Output**:

   ```typescript
   it('should debug', () => {
     const value = component.getData();
     console.log('Value:', value);
     expect(value).toBeTruthy();
   });
   ```

3. **Browser DevTools**:
   - Open ChromeDevTools (F12)
   - Set breakpoints in source code
   - Watch variables and stack traces

### E2E Test Debugging

1. **UI Mode**:

   ```bash
   npm run e2e:ui
   ```

   - Step through tests
   - See DOM/network inspector
   - Time travel debugging

2. **Debug Mode**:

   ```bash
   npm run e2e:debug
   ```

   - Playwright Inspector opens
   - Step through code
   - Preview DOM

3. **Screenshots & Videos**:

   ```typescript
   await page.screenshot({ path: 'debug.png' });
   ```

4. **Trace Viewer**:
   ```bash
   npx playwright show-trace trace.zip
   ```

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
name: Tests

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test:ci

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npx playwright install
      - run: npm run build
      - run: npm run e2e
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

### Pre-commit Testing

Tests are automatically run via husky on commit. To skip (not recommended):

```bash
git commit --no-verify
```

---

## Resources

- [Angular Testing Documentation](https://angular.dev/guide/testing)
- [Jasmine Documentation](https://jasmine.github.io/)
- [Playwright Documentation](https://playwright.dev/)
- [Karma Configuration](https://karma-runner.github.io/latest/config/configuration-file.html)

## Code Coverage Targets

- **Statements**: 80%
- **Branches**: 75%
- **Functions**: 80%
- **Lines**: 80%

Focus on testing critical paths and business logic rather than achieving 100% coverage.

---

## Getting Help

- Check existing tests for patterns: `src/app/**/*.spec.ts`, `e2e/**/*.spec.ts`
- Review mock providers: `src/testing/mock-providers.ts`
- Review test helpers: `src/testing/test-helpers.ts`
- Review page objects: `e2e/fixtures/page-objects.ts`

Happy testing! 🧪
