#!/usr/bin/env node
// Committed bin shim: exists at install time so pnpm's bin link never
// dangles on a cold clone (the dist target only exists after a build —
// the cold-start wart found on the 2026-06-11 blank-slate rebuild).
try {
  const argv = process.argv.slice(2);
  if (argv[0] === "mcp" && argv[1] === "aho" && argv[2] === "--") {
    // THE AHO RUNS BEFORE THE DISPATCHER LOADS. A harness spawns this line as its MCP seat, and the seat sees every
    // tool call, so it loads its own module and the core alone: no custody, no vessel, no house root.
    const { ahoMain } = await import("../dist/src/mcp-aho.js");
    process.exitCode = await ahoMain(argv.slice(3));
  } else {
    const { runCli } = await import("../dist/src/bin/lares.js");
    runCli();
  }
} catch (err) {
  if (err?.code === "ERR_MODULE_NOT_FOUND") {
    console.error("lares: not built yet — run `pnpm -r build` first.");
    process.exit(1);
  }
  throw err;
}
