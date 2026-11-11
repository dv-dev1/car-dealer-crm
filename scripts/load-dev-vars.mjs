// Preloaded by `npm run dev` (node --import) to put .dev.vars into process.env.
// `node --env-file=.dev.vars` cannot be used: Next forwards the flag to its dev
// server child through NODE_OPTIONS, and Node rejects --env-file there.
process.loadEnvFile(".dev.vars");
