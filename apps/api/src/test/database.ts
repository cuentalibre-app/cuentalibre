/** Integration tests run against a real Postgres: the compose one locally, a service container in CI. */
export const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgres://fiscalia:fiscalia@localhost:5432/fiscalia_test";
