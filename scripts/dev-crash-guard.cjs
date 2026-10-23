// Preloaded into `pnpm dev:test`'s Vite process (NODE_OPTIONS=--require). On Node 23 a client
// that drops a request half-way (a phone on Wi-Fi) makes undici throw "ReadableStream is
// already closed" with nothing to catch it, which kills the dev server. Ignore that one error.
process.on("uncaughtException", (err) => {
  if (err && err.code === "ERR_INVALID_STATE") return;
  console.error(err);
  process.exit(1);
});
