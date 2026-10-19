// Everything the test server and the tests share. Pointed only at local services:
// the dev server is started with these values, overriding whatever is in `.env`.
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://localhost:5432/badminton_test";

export const E2E_AUTH_SECRET = "e2e-local-only-secret-not-for-production";

export const PORT = 3100;
export const BASE_URL = `http://localhost:${PORT}`;
