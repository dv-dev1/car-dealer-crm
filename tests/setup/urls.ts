// The port is overridable so several worktrees can run the suite at the same time.
export const TEST_PORT = Number(process.env.TEST_PG_PORT ?? 54329);
export const TEST_DATABASE = "crm_test";
export const TEST_APP_PASSWORD = "test";

export const TEST_ADMIN_URL = `postgres://postgres@127.0.0.1:${TEST_PORT}/${TEST_DATABASE}`;
export const TEST_APP_URL = `postgres://crm_app:${TEST_APP_PASSWORD}@127.0.0.1:${TEST_PORT}/${TEST_DATABASE}`;
