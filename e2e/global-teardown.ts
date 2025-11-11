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
 * - SUPABASE_ANON_KEY: Supabase anonymous key for API access
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
  // Get Supabase configuration from environment
  const supabaseUrl = process.env['SUPABASE_URL'];
  const supabaseAnonKey = process.env['SUPABASE_ANON_KEY'];

  // Skip cleanup if credentials are not configured
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('⚠️ Skipping database cleanup: SUPABASE_URL or SUPABASE_ANON_KEY not configured');
    return;
  }

  try {
    console.log('🧹 Starting database cleanup...');

    // Launch browser for API requests
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    // Fetch all users from Supabase Auth
    // The admin API requires service role key, but we try with anon key as fallback
    console.log(`📋 Fetching users from ${supabaseUrl}`);

    const authResponse = await page.request.get(`${supabaseUrl}/auth/v1/admin/users`, {
      headers: {
        Authorization: `Bearer ${supabaseAnonKey}`,
        apikey: supabaseAnonKey,
      },
    });

    if (authResponse.ok()) {
      const users = (await authResponse.json()) as { id: string; email: string }[];

      // Filter for test users with @example.com domain
      const testUsers = users.filter(user => user.email?.endsWith('@example.com'));

      console.log(`Found ${testUsers.length} test user(s) to delete`);

      // Delete each test user
      let deletedCount = 0;
      for (const user of testUsers) {
        const deleteResponse = await page.request.delete(
          `${supabaseUrl}/auth/v1/admin/users/${user.id}`,
          {
            headers: {
              Authorization: `Bearer ${supabaseAnonKey}`,
              apikey: supabaseAnonKey,
            },
          }
        );

        if (deleteResponse.ok()) {
          console.log(`✅ Deleted test user: ${user.email}`);
          deletedCount += 1;
        } else {
          const errorText = await deleteResponse.text();
          console.warn(`⚠️ Failed to delete user ${user.email}: ${deleteResponse.status()}`);
          if (errorText) {
            console.warn(`   Error details: ${errorText}`);
          }
        }
      }

      console.log(`\n✨ Cleanup completed: ${deletedCount}/${testUsers.length} users deleted`);
    } else {
      const statusText = `${authResponse.status()}`;
      console.warn(`⚠️ Failed to fetch users: ${statusText}`);
      console.warn('   Teardown may require proper Supabase auth configuration');
    }

    await context.close();
    await browser.close();
  } catch (error) {
    if (error instanceof Error) {
      console.error('❌ Error during teardown:', error.message);
      console.error('   Stack:', error.stack);
    } else {
      console.error('❌ Error during teardown:', error);
    }
    // Note: We don't throw errors during teardown to prevent test suite failures
    // due to cleanup issues. Cleanup failures are logged but non-fatal.
  }
}

export default globalTeardown;
