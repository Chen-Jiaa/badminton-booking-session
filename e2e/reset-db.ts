// `pnpm test:db:reset`: rebuild and seed the local test DB without running the tests,
// e.g. to poke at it with `psql badminton_test` or point a dev server at it.
import { resetTestDb } from "./db";
import { seed } from "./seed";
import { TEST_DATABASE_URL } from "./env";

async function main() {
  await resetTestDb();
  await seed();
  console.log(`Test database ready: ${TEST_DATABASE_URL}`);
}

void main();
