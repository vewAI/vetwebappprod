// try to enable jest-dom matchers when present (optional)
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('@testing-library/jest-dom');
} catch (_) {
  // jest-dom not installed; that's fine for lightweight unit tests
}

import { beforeAll, afterEach, vi } from 'vitest';

// Provide safe defaults for environment variables used in tests
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon';

// Minimal mock for the OpenAI client to prevent network calls during unit tests
vi.mock('openai', () => {
  return {
    OpenAI: class OpenAIMock {
      constructor() {}
      // legacy and new shapes used in the codebase
      chat = {
        completions: {
          create: async () => ({
            choices: [{ message: { content: 'mock response' } }],
          }),
        },
        create: async () => ({
          choices: [{ message: { content: 'mock response' } }],
        }),
      };
      responses = {
        create: async () => ({ output: [{ content: 'mock response' }] }),
      };
      images = {
        generate: async () => ({ data: [] }),
      };
    },
  };
});

// Minimal mock for Supabase client
vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: () => ({
      from: () => ({
        select: async () => ({ data: [], error: null }),
        insert: async () => ({ data: null, error: null }),
        update: async () => ({ data: null, error: null }),
      }),
      auth: {
        onAuthStateChange: () => ({ data: null }),
      },
      storage: {
        from: () => ({
          upload: async () => ({ data: null, error: null }),
        }),
      },
    }),
  };
});

// Ensure msw is available if tests want to use it
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { setupServer } = require('msw/node');
  // Provide a no-op server by default; tests can reconfigure handlers
  const server = setupServer();
  beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
  afterEach(() => server.resetHandlers());
} catch (e) {
  // msw not installed or not available in some environments; ignore
}

// Helpful globals for tests
globalThis.__TEST_MODE__ = true as any;
