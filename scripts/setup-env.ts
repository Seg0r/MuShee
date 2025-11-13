#!/usr/bin/env tsx

/**
 * Script to generate Angular environment files from environment variables.
 * Used in CI/CD pipelines to create environment.ts and environment.prod.ts
 *
 * Usage: npm run setup:env
 *
 * Environment Variables Required:
 * - SUPABASE_URL: Supabase project URL
 * - SUPABASE_ANON_KEY: Supabase anonymous key
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_URL = process.env['SUPABASE_URL'];
const SUPABASE_ANON_KEY = process.env['SUPABASE_ANON_KEY'];

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required');
  process.exit(1);
}

const environmentsDir = join(__dirname, '..', 'src', 'environments');

// Ensure directory exists
if (!existsSync(environmentsDir)) {
  mkdirSync(environmentsDir, { recursive: true });
}

// Generate environment.ts (development)
const environmentTs = `export const environment = {
  production: false,
  supabase: {
    url: '${SUPABASE_URL}',
    anonKey: '${SUPABASE_ANON_KEY}',
  },
};
`;

// Generate environment.prod.ts (production)
const environmentProdTs = `export const environment = {
  production: true,
  supabase: {
    url: '${SUPABASE_URL}',
    anonKey: '${SUPABASE_ANON_KEY}',
  },
};
`;

// Generate environment.test.ts (testing)
const environmentTestTs = `export const environment = {
  production: false,
  supabase: {
    url: '${SUPABASE_URL}',
    anonKey: '${SUPABASE_ANON_KEY}',
  },
};
`;

// Write files
writeFileSync(join(environmentsDir, 'environment.ts'), environmentTs);
writeFileSync(join(environmentsDir, 'environment.prod.ts'), environmentProdTs);
writeFileSync(join(environmentsDir, 'environment.test.ts'), environmentTestTs);

console.log('✓ Environment files created successfully');
console.log(`  - ${join(environmentsDir, 'environment.ts')}`);
console.log(`  - ${join(environmentsDir, 'environment.prod.ts')}`);
console.log(`  - ${join(environmentsDir, 'environment.test.ts')}`);
