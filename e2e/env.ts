// Everything the test server and the tests share. Pointed only at local services:
// the dev server is started with these values, overriding whatever is in `.env`.
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://localhost:5432/badminton_test";

export const E2E_AUTH_SECRET = "e2e-local-only-secret-not-for-production";

export const PORT = 3100;
export const BASE_URL = `http://localhost:${PORT}`;

// `pnpm dev:test`: a dev server you can click around and screenshot, on the same test
// DB. Its own port, so it never collides with the one `pnpm test:e2e` starts.
export const DEV_TEST_PORT = 3200;
export const DEV_TEST_URL = `http://localhost:${DEV_TEST_PORT}`;
