#!/usr/bin/env node
// Committed bin shim: exists at install time so pnpm's bin link never
// dangles on a cold clone (the dist target only exists after a build —
// the cold-start wart found on the 2026-06-11 blank-slate rebuild).
try {
  const argv = process.argv.slice(2);
  if (argv[0] === "mcp" && argv[1] === "aho" && (argv.length === 2 || argv[2] === "--")) {
    // THE AHO RUNS BEFORE THE DISPATCHER LOADS. A harness spawns this line as its MCP seat, and the seat sees every
    // tool call, so it loads its own module and the core alone: no custody, no vessel, no house root.
    const { ahoMain } = await import("../dist/src/mcp-aho.js");
    // `lares mcp aho` alone takes the house's own surface; `-- <argv>` names another child.
    process.exitCode = await ahoMain(argv.length === 2 ? null : argv.slice(3));
  } else {
    const { runCli } = await import("../dist/src/bin/lares.js");
    runCli();
  }
} catch (err) {
  if (err?.code === "ERR_MODULE_NOT_FOUND") {
    // THREE BREAKS THROW ONE CODE. A missing dist entry means the tree never built. An entry that stands but imports a
    // PACKAGE the workspace no longer links (a bare specifier: Node says "Cannot find package") means `pnpm install` owes
    // this checkout a relink, and a rebuild never cures it. An entry that imports a missing FILE (a relative dist path)
    // means a stale or partial build, and a rebuild cures it.
    const { existsSync } = await import("node:fs");
    if (!existsSync(new URL("../dist/src/bin/lares.js", import.meta.url))) {
      console.error("lares: not built yet — run `pnpm -r build` first.");
    } else if (/Cannot find package /.test(String(err.message))) {
      console.error(`lares: ${err.message}`);
      console.error("lares: a workspace link broke: run `pnpm install` in this checkout.");
    } else {
      console.error(`lares: ${err.message}`);
      console.error("lares: the build stands stale or partial (a dist file is missing): run `pnpm -r build` in this checkout.");
    }
    process.exit(1);
  }
  throw err;
}
