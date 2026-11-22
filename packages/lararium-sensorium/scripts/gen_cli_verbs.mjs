#!/usr/bin/env node
/**
 * gen_cli_verbs — emit fixtures/cli-verbs.json from the ACTUAL `lares` command table.
 *
 * Derives the verb list from the built `COMMAND_NAMES` export (packages/lares-cli), so the
 * fixture never drifts from the real CLI surface: re-run after adding/renaming a command.
 * YIN's three-way parity test (CLI command-table ↔ MCP tool-set ↔ VERB_SEATS) reads the output.
 *
 * The isomorphism (operator ruling): `lares`-CLI ↔ `lares`-MCP across the WHOLE verb-set. The six
 * lifecycle tools mirror today; every other verb reads NOT-YET-MIRRORED (the MCP surface grows into
 * it), never permanently CLI-only. `cli_forms` maps each MCP tool name to its CLI spelling — each
 * mirror rides the one `sense` door (`sense pour`, `sense status`, `sense worldline kapae`).
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
// The `sense analyze` lens table — the CLI's own (sense-analyze.ts), carried here so the MCP seat's `analyze`
// tool can weld its ANALYZE_LENSES to it (test_lares_mcp.py: one lens table, two skins).
const LENS_DIST = resolve(HERE, "../../lares-cli/dist/src/commands/sense-analyze.js");
const OUT = join(HERE, "fixtures", "cli-verbs.json");

// The MCP lifecycle tool names (mirror YIN's py `LIFECYCLE_VERBS`) → their CLI spelling. After the
// radical two-door collapse EVERY sovereign lifecycle tool mirrors through the one `sense` door — one
// host, no top-level twins. `pour` names the SOVEREIGN capture on both surfaces, never the guest miner.
const CLI_FORMS = {
  // `pour` carries the bulk pass on both surfaces: `bulk` on the tool, `--bulk` on the CLI (the sweep spine).
  pour:      "sense pour",
  recall:    "sense recall",
  status:    "sense status",
  worldline: "sense worldline",
  kapae:     "sense worldline kapae",
  un_kapae:  "sense worldline un-kapae",
  // EVERY READ INSTRUMENT over a poured sensorium mirrors through ONE tool and ONE verb: `analyze` takes the
  // lens (`lens` on the tool, `--lens` on the CLI), and `analyze_lenses` below carries the lens table both
  // skins read. Each lens keeps its own daemon wire verb; nothing merges their computations.
  analyze:   "sense analyze",
  // `flow` runs a pet-named COMPOSED cap-stack (crystal · rhythm · couple) against an explicit signal —
  // the anti-verb-sprawl surface. A REAL top-level CLI command (`lares flow`), so it hosts its OWN mirror
  // (not a `sense` sub-verb); the daemon routes each cap-step by hull (crystallize/couple TS · phase py).
  flow:      "flow",
  // The wiki-SWITCHER: one MCP `wiki` tool mirrors the `lares wiki <verb>` namespace
  // (switch/hold/release/active) — the host verb is `wiki`, a real top-level CLI command.
  wiki:      "wiki switch",
  // The MEME door — the MCP skin of the meme family's DAEMON-seated verbs. `meme_put` lands a meme's
  // text at a `lar:` uri through the island's Confluence gate; `meme_get` reads the text + canonical
  // hash back; `meme_list` names every root a seat holds (`--tree` on the CLI, `tree` on the tool);
  // `meme_delete` removes the whole group (`--if-match` on the CLI, `base` on the tool); `meme_project`
  // renders the meme the island holds to a target (`--to` on the CLI, `to` on the tool — the target
  // rides as a parameter, never a suffix on the verb). The host `meme` is a real top-level CLI command,
  // so each mirrors as `<host> <sub>` — ONE host, five tools, the shape kapae/un_kapae ride under
  // `sense worldline`. The family's LOCAL seats ride LOCAL_SEAT below.
  meme_put:     "meme put",
  meme_get:     "meme get",
  meme_list:    "meme list",
  meme_delete:  "meme delete",
  meme_project: "meme project",
  // THE TIDDLER DOOR (wiki-surface-scout #/a-lean) — every TiddlyWiki act over one record or one wiki's engine. The record
  // verbs ride their own host (`lares tiddler get|put|delete`); the engine verbs join the `wiki` host beside the switcher
  // (`lares wiki filter|render|status`). One table welds both skins' wire and answer: fixtures/tiddler-door-answers.json.
  tiddler_get:    "tiddler get",
  tiddler_put:    "tiddler put",
  tiddler_delete: "tiddler delete",
  wiki_filter:    "wiki filter",
  wiki_render:    "wiki render",
  wiki_status:    "wiki status",
  // The DISCORDIAN CALENDAR — the MCP `ddate` tool mirrors the host verb `lares ddate`, a real top-level CLI command that runs
  // with no vessel; the tool rides the daemon verb every vessel answers, so a seat reads the day through the same core.
  ddate:          "ddate",
  // THE ORACLE CAST — the MCP `oracle_cast` tool mirrors `lares oracle cast`, a vessel verb: the vessel casts and writes
  // the cast as one tiddler, so the draw lives in the tool and never in the prompt.
  oracle_cast:    "oracle cast",
  // THE LAW INDEX — the pinned law first, then the law canon derives, read in the worn face's daemon wiki; a pin orders it.
  // Each tool mirrors `lares law <sub>` (the host `law` is a real top-level CLI command), riding the tiddler door's verbs.
  law_index:      "law list",
  law_pin:        "law pin",
  law_unpin:      "law unpin",
  // THE HEARTH ROSTER — who is home, offered beside the law. The tool mirrors `lares vessel roster` (a `vessel` sub-door: the
  // top-level list holds its one screen); both ride the one `hearth-roster` verb the vessel's channel answers itself.
  vessel_roster:  "vessel roster",
  // The OFFERING door (offering#/the-canon-offer) — an AI seat offers toward house canon and reads the offer table; each
  // mirrors `lares meme offer …` under the one `meme` host. `lares meme offer promote` stays the Kahu steward's hand and
  // holds no MCP tool, the way `kahua lift` holds none.
  meme_offer:      "meme offer",
  meme_offer_list: "meme offer list",
  meme_offer_show: "meme offer show",
  // The KAHUA seat verbs — an AI seat proposes, stages and reads its face's kahua stage; each mirrors `lares kahua <sub>`
  // (the host `kahua` is a real top-level CLI command). `lares kahua lift|withdraw|carry|mint` stay the operator's hand
  // and hold no MCP tool, the way the LOCAL seats hold none: no tool spells them.
  kahua_propose: "kahua propose",
  kahua_stage:   "kahua stage",
  kahua_list:    "kahua list",
  kahua_get:     "kahua get",
  // The DURABLE sensorium-lifecycle sub-verbs a seat runs — each mirrors `lares sense <verb>` (the one `sense` door),
  // routed over the @daemon wire to the pure manifest.json reducer. `sense promote|retire|un-retire|purge|teardown`
  // stay a person's hand at a real terminal and hold no MCP tool (hitl-reads-a-hand), the way `kahua lift` holds none.
  // `roster` reads at two grains on both surfaces: bare, every sensorium; with a name, that one's facets.
  roster:    "sense roster",
  build:     "sense build",
  reconcile: "sense reconcile",
};
// A VERB DECLARES ITS SEAT. These CLI sub-verbs run LOCAL over a file with no daemon in reach (the
// offline re-stamp of a stale block check must keep working with no socket), so they hold NO MCP tool by
// law — the MCP mirrors the daemon-seated verbs only. Named here so the parity test reads the allowance
// as declared, never as a tool that went missing.
const LOCAL_SEAT = ["meme normalize", "meme check"];
// The CLI TOP-LEVEL verbs that HOST a mirror — DERIVED from the cli_forms value-heads (single source,
// never drifts): `sensorium status` → sensorium, `worldline kapae` → worldline, harvest → harvest. The
// coverage partition rides these CLI-form heads, NOT the MCP tool-names (kapae/un_kapae are worldline
// sub-verbs, not top-level verbs; status mirrors under `sensorium`, not bare `status` = node-health).
const MIRROR_HOSTS = new Set(Object.values(CLI_FORMS).map((f) => f.split(" ")[0]));

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
  const mirrored = Object.keys(CLI_FORMS); // MCP tool names — set-equal to py LIFECYCLE_VERBS (the MCP anchor)
  const mirrorHosts = [...MIRROR_HOSTS].sort(); // CLI top-level verbs hosting a mirror (the coverage partition)
  const notYet = verbs.filter((v) => !MIRROR_HOSTS.has(v));
  return {
    _doc: "Isomorphism fixture — the `lares` CLI verb surface for the three-way parity test " +
      "(CLI command-table ↔ MCP tool-set ↔ VERB_SEATS). `mirrored` = the MCP tool-names that mirror " +
      "today (set-equal to py LIFECYCLE_VERBS, the MCP anchor); `cli_forms` maps each MCP tool to its " +
      "CLI spelling (some ride sub-verbs); `mirror_hosts` = the CLI TOP-LEVEL verbs those spellings land " +
      "on (the coverage partition); `not_yet_mirrored` = verbs − mirror_hosts (the surface grows into " +
      "them); `local_seat` = CLI sub-verbs that run over a file with no daemon and hold no MCP tool by law; " +
      "`analyze_lenses` = the `sense analyze` lens table (lens → daemon verb) and `analyze_lens_aliases` the canon " +
      "house names each flowing to a lens, and `analyze_lens_reads` the flags each lens reads (a stray one refuses " +
      "by name on both skins), all read off the CLI. " +
      "Invariant: mirror_hosts ∪ not_yet_mirrored == verbs. Generated by gen_cli_verbs.mjs.",
    verbs,
    mirrored,
    cli_forms: CLI_FORMS,
    mirror_hosts: mirrorHosts,
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
    console.error("cli-verbs.json DRIFT — re-run `node scripts/gen_cli_verbs.mjs` to sync.");
    process.exit(1);
  }
  console.log("cli-verbs.json up to date.");
} else {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, rendered);
  console.log(`wrote ${OUT} — ${verbs.length} verbs, ${fixture.mirrored.length} mirrored.`);
}
