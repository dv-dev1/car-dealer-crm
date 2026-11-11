// Preloaded by `npm run dev` (node --import) to put .dev.vars into process.env.
// `node --env-file=.dev.vars` cannot be used: Next forwards the flag to its dev
// server child through NODE_OPTIONS, and Node rejects --env-file there.
try {
  process.loadEnvFile(".dev.vars");
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
  // The public site runs without it; login needs it (see db/README.md). Next's child
  // processes inherit the flag, so the warning shows once.
  if (!process.env.DEV_VARS_MISSING_WARNED) {
    console.warn("No .dev.vars: starting without WorkOS and Turnstile keys, so login will not work.");
    process.env.DEV_VARS_MISSING_WARNED = "1";
  }
}
