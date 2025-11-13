/**
 * Global Playwright Teardown
 * Executed after all tests complete to clean up test data
 *
 * This teardown performs the following cleanup:
 * - Deletes all test users with @example.com email domain from Supabase Auth
 * - Cascades delete related data (profiles, songs, etc.) via database foreign keys
 *
 * Environment Variables:
 * - SUPABASE_URL: Supabase API URL (default: http://127.0.0.1:54321 for local dev)
 * - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key for admin API access
 *
 * Usage:
 * The teardown is automatically executed by Playwright after all tests complete.
 * Configure in playwright.config.ts with: globalTeardown: require.resolve('./e2e/global-teardown.ts')
 */

import { chromium } from '@playwright/test';

/**
 * Cleanup all test users created during E2E tests
 * Targets users with @example.com email domain
 */
async function globalTeardown() {
  // Log to both stdout and stderr to ensure visibility
  const log = (message: string) => {
    console.log(message);
    process.stderr.write(`[TEARDOWN] ${message}\n`);
  };

  const warn = (message: string) => {
    console.warn(message);
    process.stderr.write(`[TEARDOWN] ⚠️ ${message}\n`);
  };

  const error = (message: string) => {
    console.error(message);
    process.stderr.write(`[TEARDOWN] ❌ ${message}\n`);
  };

  // Log that teardown has started
  log('🚀 Global teardown started');

  // Get Supabase configuration from environment
  const supabaseUrl = process.env['SUPABASE_URL'];
  const supabaseServiceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

  log(`Environment check - SUPABASE_URL: ${supabaseUrl ? 'SET' : 'NOT SET'}`);
  log(
    `Environment check - SUPABASE_SERVICE_ROLE_KEY: ${supabaseServiceRoleKey ? 'SET' : 'NOT SET'}`
  );

  // Skip cleanup if credentials are not configured
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    warn('Skipping database cleanup: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured');
    return;
  }

  try {
    log('🧹 Starting database cleanup...');

    // Launch browser for API requests
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    // Fetch all users from Supabase Auth
    // The admin API requires service role key for authentication
    log(`📋 Fetching users from ${supabaseUrl}`);

    const authResponse = await page.request.get(`${supabaseUrl}/auth/v1/admin/users`, {
      headers: {
        Authorization: `Bearer ${supabaseServiceRoleKey}`,
        apikey: supabaseServiceRoleKey,
      },
    });

    if (authResponse.ok()) {
      const responseData = await authResponse.json();

      // Supabase Admin API returns { users: [...] } format
      // Handle both possible response structures
      let users: { id: string; email: string }[] = [];
      if (Array.isArray(responseData)) {
        users = responseData;
      } else if (responseData && typeof responseData === 'object' && 'users' in responseData) {
        users = Array.isArray(responseData.users) ? responseData.users : [];
      } else {
        warn(`Unexpected response format: ${JSON.stringify(responseData).substring(0, 200)}`);
        users = [];
      }

      // Filter for test users with @example.com domain
      const testUsers = users.filter(user => user.email?.endsWith('@example.com'));

      log(`Found ${testUsers.length} test user(s) to delete`);

      // Delete each test user
      let deletedCount = 0;
      for (const user of testUsers) {
        const deleteResponse = await page.request.delete(
          `${supabaseUrl}/auth/v1/admin/users/${user.id}`,
          {
            headers: {
              Authorization: `Bearer ${supabaseServiceRoleKey}`,
              apikey: supabaseServiceRoleKey,
            },
          }
        );

        if (deleteResponse.ok()) {
          log(`✅ Deleted test user: ${user.email}`);
          deletedCount += 1;
        } else {
          const errorText = await deleteResponse.text();
          warn(`Failed to delete user ${user.email}: ${deleteResponse.status()}`);
          if (errorText) {
            warn(`   Error details: ${errorText}`);
          }
        }
      }

      log(`\n✨ Cleanup completed: ${deletedCount}/${testUsers.length} users deleted`);
    } else {
      const statusText = `${authResponse.status()}`;
      const errorText = await authResponse.text().catch(() => 'Unable to read error response');
      warn(`Failed to fetch users: ${statusText}`);
      if (errorText) {
        warn(`   Error details: ${errorText}`);
      }
      warn('   Ensure SUPABASE_SERVICE_ROLE_KEY is set correctly for admin API access');
    }

    await context.close();
    await browser.close();
    log('✅ Global teardown completed successfully');
  } catch (err) {
    if (err instanceof Error) {
      error(`Error during teardown: ${err.message}`);
      error(`   Stack: ${err.stack}`);
    } else {
      error(`Error during teardown: ${err}`);
    }
    // Note: We don't throw errors during teardown to prevent test suite failures
    // due to cleanup issues. Cleanup failures are logged but non-fatal.
  }
}

export default globalTeardown;
