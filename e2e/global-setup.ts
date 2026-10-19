import { resetTestDb } from "./db";
import { seed } from "./seed";

export default async function globalSetup() {
  await resetTestDb();
  await seed();
}
