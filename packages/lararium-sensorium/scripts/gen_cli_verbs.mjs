#!/usr/bin/env node
/**
 * gen_cli_verbs — emit fixtures/cli-verbs.json from the ACTUAL `lares` command table.
 *
 * Derives the verb list from the built `COMMAND_NAMES` export (packages/lares-cli), so the
 * fixture never drifts from the real CLI surface: re-run after adding/renaming a command.
 * The seat's three-way parity test (CLI command-table ↔ MCP tool-set ↔ this fixture) reads the output.
 *
 * The isomorphism (operator ruling): `lares`-CLI ↔ `lares`-MCP across the whole call shape. The seat holds the record
 * tools (`get`, `put`, `delete`, `rename`) and the one `act`; each sends `{verb, params}` to the vessel's `call`, and the
 * CLI's call door reads the same heads (`lares get title=…`, `lares act lar:///<address> …`). `cli_forms` maps each tool
 * to its CLI spelling. Every other affordance reaches both surfaces by its `lar:` address through `act`, so no other
 * command needs a tool of its own.
 *
 * Usage:  node scripts/gen_cli_verbs.mjs        (writes fixtures/cli-verbs.json)
 *         node scripts/gen_cli_verbs.mjs --check (fails if the on-disk fixture drifts)
 *
 * Meme: lar:///ha.ka.ba/lararium/sensorium/cli-verbs-fixture
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI_DIST = resolve(HERE, "../../lares-cli/dist/src/bin/lares.js");
// The `sense analyze` lens table — the CLI's own (sense-analyze.ts), carried here so the seat's `analyze` act can weld its
// ANALYZE_LENSES to it (test_lares_mcp.py: one lens table, two skins).
const LENS_DIST = resolve(HERE, "../../lares-cli/dist/src/commands/sense-analyze.js");
const OUT = join(HERE, "fixtures", "cli-verbs.json");

// THE SEAT'S TOOLS → their CLI spelling (comms-ux-enacts landing 11). The record tools ride their own top-level words
// (`lares get|put|delete|rename name=value…`); `act` rides the call door's `act` head (`lares act lar:///<address> …`), which
// the CLI reads outside its command table. One table welds both skins' call and answer: fixtures/tiddler-door-answers.json.
const CLI_FORMS = {
  get:    "get",
  put:    "put",
  delete: "delete",
  rename: "rename",
  act:    "act",
};
// A VERB DECLARES ITS SEAT. These CLI sub-verbs run LOCAL over a file with no daemon in reach (the
// offline re-stamp of a stale block check must keep working with no socket), so they hold NO seat by
// law — the seat runs the daemon-seated acts only. Named here so the parity test reads the allowance
// as declared, never as a tool that went missing.
const LOCAL_SEAT = ["meme normalize", "meme check"];
// The heads the seat's CLI spellings land on, DERIVED from the cli_forms value-heads (single source, never drifts).
const HEADS = [...new Set(Object.values(CLI_FORMS).map((f) => f.split(" ")[0]))];

async function loadLenses() {
  const mod = await import(pathToFileURL(LENS_DIST).href);
  if (typeof mod.SENSE_LENSES !== "object" || typeof mod.SENSE_LENS_ALIASES !== "object") {
    throw new Error(`SENSE_LENSES not found in ${LENS_DIST} — build lares-cli first (pnpm -C packages/lares-cli build)`);
  }
  const lenses = Object.fromEntries(Object.entries(mod.SENSE_LENSES).map(([name, lens]) => [name, lens.wire]));
  const reads = Object.fromEntries(Object.entries(mod.SENSE_LENSES).map(([name, lens]) => [name, [...lens.reads]]));
  return { lenses, aliases: { ...mod.SENSE_LENS_ALIASES }, reads };
}

async function loadCommandNames() {
  const mod = await import(pathToFileURL(CLI_DIST).href);
  if (!Array.isArray(mod.COMMAND_NAMES)) {
    throw new Error(`COMMAND_NAMES not found in ${CLI_DIST} — build lares-cli first (pnpm -C packages/lares-cli build)`);
  }
  return mod.COMMAND_NAMES;
}

function buildFixture(verbs, { lenses, aliases, reads }) {
  const mirrored = Object.keys(CLI_FORMS); // the seat's tool names (the anchor)
  // A head the command table carries hosts a mirror (the coverage partition); one it carries none of is a call head the
  // CLI's call door reads on its own (`act`).
  const mirrorHosts = HEADS.filter((h) => verbs.includes(h)).sort();
  const callHeads = HEADS.filter((h) => !verbs.includes(h)).sort();
  const notYet = verbs.filter((v) => !mirrorHosts.includes(v));
  return {
    _doc: "Isomorphism fixture — the `lares` CLI verb surface for the three-way parity test " +
      "(CLI command-table ↔ MCP tool-set ↔ this table). `mirrored` = the seat's tool names (the anchor); `cli_forms` maps " +
      "each tool to its CLI spelling; `mirror_hosts` = the CLI TOP-LEVEL commands those spellings land on (the coverage " +
      "partition); `call_heads` = the heads they land on that the CLI's call door reads outside its command table; " +
      "`not_yet_mirrored` = verbs − mirror_hosts (each reaches the seat's `act` by its carriers' addresses, never by a tool " +
      "of its own); `local_seat` = CLI sub-verbs that run over a file with no daemon and hold no seat by law; " +
      "`analyze_lenses` = the `sense analyze` lens table (lens → daemon verb) and `analyze_lens_aliases` the canon " +
      "house names each flowing to a lens, and `analyze_lens_reads` the flags each lens reads (a stray one refuses " +
      "by name on both skins), all read off the CLI. " +
      "Invariant: mirror_hosts ∪ not_yet_mirrored == verbs. Generated by gen_cli_verbs.mjs.",
    verbs,
    mirrored,
    cli_forms: CLI_FORMS,
    mirror_hosts: mirrorHosts,
    call_heads: callHeads,
    not_yet_mirrored: notYet,
    local_seat: LOCAL_SEAT,
    analyze_lenses: lenses,
    analyze_lens_aliases: aliases,
    analyze_lens_reads: reads,
  };
}

const verbs = await loadCommandNames();
const fixture = buildFixture(verbs, await loadLenses());
const rendered = JSON.stringify(fixture, null, 2) + "\n";

if (process.argv.includes("--check")) {
  let onDisk = "";
  try { onDisk = readFileSync(OUT, "utf8"); } catch { /* absent → drift */ }
  if (onDisk !== rendered) {
    console.error("cli-verbs.json DRIFT — re-run `node packages/lararium-sensorium/scripts/gen_cli_verbs.mjs` (from the repo root) to sync.");
    process.exit(1);
  }
  console.log("cli-verbs.json up to date.");
} else {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, rendered);
  console.log(`wrote ${OUT} — ${verbs.length} verbs, ${fixture.mirrored.length} mirrored.`);
}
