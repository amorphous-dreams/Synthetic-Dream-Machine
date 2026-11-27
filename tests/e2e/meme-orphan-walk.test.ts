/**
 * e2e/meme-orphan-walk — the orphan gradient walked on ONE staged hearth, through the built `lares` binary.
 *
 * Operator, 2026-11-14: "Orphan meme slot children should get projected to disk as tiddlers & flag for the
 * operator/user (both node/browser)."
 *
 * The unit vectors read the family law over a wiki in one process. This walk reads it where an operator's
 * hands reach it: a fresh root founded by the CLI, its daemon, and the files its projector lays.
 *
 *   put (three slots)        → one carrier file; no orphan folder; no flag            (CONTROL)
 *   delete                   → the family leaves whole; the carrier file leaves; nothing orphaned
 *   LOAD of a lone slot      → the child lands with no root above it: `<stem>.orphans/<slot>.tid` appears in
 *                              the daemon wiki's folder and the flag reads back through the one read door
 *                              (`get title=`: a house alert reads, though the rest of `$:/temp` stays home)
 *   put (the root returns)   → the slot re-roots: the folder leaves and the flag clears, read through the same door
 *
 * A staged hearth holds no bare single-title delete door yet (the delete door lands it), so the orphan
 * arrives the second way the field makes one: a lone child landing by ingest.
 *
 * SKIPS LOUDLY when the built CLI or vessel stands absent. Staged only.
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { targetInstance, awaitRendezvous, daemonWikiDir, type LarInstance } from "../harness/instance.js";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const CLI_BIN   = join(REPO_ROOT, "packages/lares-cli/dist/src/bin/lares.js");
const NODE_MAIN = join(REPO_ROOT, "packages/lararium-node/dist/src/main.js");
const DAEMON_WORKING = "lar:///ha.ka.ba/wikis/daemon/working";
const ANCHOR = ["recipe=default"] as const;

const PATH = "ha.ka.ba/t/orphan-walk/npc";
const URI  = `lar:///${PATH}`;
const FLAG = `$:/temp/lares/alert/meme-orphan/${URI}`;

const meme = (slots: readonly string[]): string =>
  `<<^ code=\`&#x0001;\` from=\`?\` to=\`${URI}\`>>\n<<^ code=\`&#x0002;\`>>\n\n\`\`\`toml meta\nuri-path = "${PATH}"\n\`\`\`\n\n` +
  slots.map((s) => `<<~ ahu slot=\`#/${s}\`>>\n\n! ${s}\n\n<<~/ahu>>\n`).join("\n") +
  `\n<<^ code=\`&#x0003;\`>>\n\n<<^ code=\`&#x0004;\` to=\`?\`>>\n`;

function missing(): string[] {
  const out: string[] = [];
  if (!existsSync(CLI_BIN))   out.push(`built CLI at ${CLI_BIN} (pnpm --filter @lares/cli build)`);
  if (!existsSync(NODE_MAIN)) out.push(`built node vessel at ${NODE_MAIN} (pnpm --filter @lararium/node build)`);
  if (process.env["LAR_TARGET"] === "live") out.push("a STAGED target — this walk writes, and never writes to a live hearth");
  return out;
}
const said = (r: { stdout: string; stderr: string }): string => `${r.stdout}\n${r.stderr}`;
/** The orphan flag as the one read door answers it: its fields where it stands, null where none stands. */
const flagOf = (r: { json?: Record<string, unknown> | null; stdout: string; stderr: string }): Record<string, unknown> | null => {
  // An absent title answers `not-found` with `tiddler: null`; any other refusal (a withhold among them) fails the walk.
  const code = (r.json?.["error"] as { code?: unknown } | undefined)?.code;
  if (r.json?.["ok"] !== true && code !== "not-found") throw new Error(`the read door refused the flag: ${said(r)}`);
  return (((r.json?.["data"] ?? {}) as Record<string, unknown>)["tiddler"] as { fields?: Record<string, unknown> } | null)?.fields ?? null;
};

/** Wait for a condition the projector reaches on its own turn. */
async function until(holds: () => boolean, timeoutMs = 30_000): Promise<boolean> {
  const start = Date.now();
  for (;;) {
    if (holds()) return true;
    if (Date.now() - start > timeoutMs) return false;
    await new Promise((r) => setTimeout(r, 500));
  }
}

/** Every file beneath `dir`, relative and sorted; empty where the directory stands absent. */
function tree(dir: string, rel = ""): string[] {
  if (!existsSync(join(dir, rel))) return [];
  const out: string[] = [];
  for (const entry of readdirSync(join(dir, rel), { withFileTypes: true })) {
    const at = rel === "" ? entry.name : `${rel}/${entry.name}`;
    if (entry.isDirectory()) out.push(...tree(dir, at)); else out.push(at);
  }
  return out.sort();
}

const gaps = missing();
if (gaps.length > 0) console.error(`meme-orphan-walk: SKIPPED — missing ${gaps.join("; ")}`);

let lar: LarInstance;
let scratch = "";
let mirror = "";
const walkFiles = (): string[] => tree(mirror).filter((f) => f.includes("orphan-walk"));

describe.skipIf(gaps.length > 0)("★ the orphan gradient on a staged hearth ★", () => {
  beforeAll(async () => {
    lar = await targetInstance();
    scratch = join(lar.root, "witness");
    mkdirSync(scratch, { recursive: true });
    writeFileSync(join(scratch, "abc.mem"), meme(["a", "b", "c"]));
    const bound = await awaitRendezvous(lar);
    if (!bound) throw new Error(`the staged daemon reached live but bound no rendezvous:\n${lar.bootLog().slice(-800)}`);
    mirror = daemonWikiDir(lar.root);
  }, 150_000);
  afterAll(async () => { if (lar) await lar.stop(); });

  test("CONTROL: a meme with three slots projects ONE carrier file, no orphan folder, and raises no flag", async () => {
    const r = await lar.cli(["put", `title=${URI}`, ...ANCHOR, `file=${join(scratch, "abc.mem")}`, "--json"]);
    expect(r.json?.["ok"], said(r)).toBe(true);
    expect(((r.json?.["data"] as Record<string, unknown>)["landed"] as string[]).sort()).toEqual([URI, `${URI}#/a`, `${URI}#/b`, `${URI}#/c`]);
    expect(await until(() => existsSync(join(mirror, `${PATH}.mem`))), `no carrier file under ${mirror}: ${JSON.stringify(walkFiles())}`).toBe(true);
    console.error(`[walk] after put: ${JSON.stringify(walkFiles())}`);
    expect(walkFiles()).toEqual([`${PATH}.mem`]);
    // The flag, a house alert, reads through the one door: none stands over a whole family.
    expect(flagOf(await lar.cli(["get", `title=${FLAG}`, ...ANCHOR, "--json"])), "no orphan flag over a whole family").toBeNull();
  });

  test("★ a delete takes the family whole: the answer names root and slots, the carrier file leaves, nothing orphans ★", async () => {
    const r = await lar.cli(["delete", `title=${URI}`, "family=true", ...ANCHOR, "--json"]);
    expect(r.json?.["ok"], said(r)).toBe(true);
    const d = r.json?.["data"] as Record<string, unknown>;
    console.error(`[walk] delete answered: ${JSON.stringify({ decision: d["decision"], tombstoned: d["tombstoned"], retracted: d["retracted"] })}`);
    expect(d["decision"]).toBe("removed");
    // The family act names every member it moved: a kāpae where a lower layer holds the title, a plain retract elsewhere.
    expect([...(d["tombstoned"] as string[]), ...(d["retracted"] as string[])].sort()).toEqual([URI, `${URI}#/a`, `${URI}#/b`, `${URI}#/c`]);
    expect(await until(() => !existsSync(join(mirror, `${PATH}.mem`)))).toBe(true);
    console.error(`[walk] after delete: ${JSON.stringify(walkFiles())}`);
    expect(walkFiles().filter((f) => f.includes(".orphans/"))).toEqual([]);
  });

  test("★ a lone slot that lands with no root projects under `<stem>.orphans/` and the wiki raises the flag ★", async () => {
    const holding = join(scratch, "wikis", "holding", "ha.ka.ba/t/orphan-walk");
    mkdirSync(holding, { recursive: true });
    writeFileSync(join(holding, "stray.tid"),
      `title: ${URI}#/a\ntype: text/memetic-wikitext+tiddlywiki\n$fragment-parent: ${URI}\n$slot: #/a\n\nan orphaned slot body`);
    const ld = await lar.cli(["act", "LOAD", "--source-uri", holding, "--to", DAEMON_WORKING, "--yes", "--json"]);
    expect(ld.json?.["ok"], `the LOAD refused — ${said(ld)}`).toBe(true);
    const orphanFile = join(mirror, `${PATH}.orphans/a.tid`);
    expect(await until(() => existsSync(orphanFile)), `no orphan file under ${mirror}: ${JSON.stringify(walkFiles())}`).toBe(true);
    console.error(`[walk] after the lone landing: ${JSON.stringify(walkFiles())}`);
    console.error(`[walk] ${PATH}.orphans/a.tid reads:\n${readFileSync(orphanFile, "utf8")}`);
    expect(readFileSync(orphanFile, "utf8")).toContain(`title: ${URI}#/a`);
    expect(readFileSync(orphanFile, "utf8")).toContain("an orphaned slot body");
    // THE OUTSIDE READ OF THE FLAG: the wiki's orphan alert reads through the one door (a house alert, the named exception to
    // `$:/temp` staying home), beside the `<stem>.orphans/` folder above.
    let flag: Record<string, unknown> | null = null;
    for (let tries = 0; tries < 20 && flag === null; tries++) {
      flag = flagOf(await lar.cli(["get", `title=${FLAG}`, ...ANCHOR, "--json"]));
      if (flag === null) await new Promise((r) => setTimeout(r, 500));
    }
    expect(flag, "the orphan flag reads through the one door").not.toBeNull();
    expect(String(flag!["title"])).toBe(FLAG);
  });

  test("★ the root returns: the slot re-roots, the orphan folder leaves and the flag clears ★", async () => {
    const r = await lar.cli(["put", `title=${URI}`, ...ANCHOR, `file=${join(scratch, "abc.mem")}`, "--json"]);
    expect(r.json?.["ok"], said(r)).toBe(true);
    expect(await until(() => existsSync(join(mirror, `${PATH}.mem`)) && !existsSync(join(mirror, `${PATH}.orphans`))), `the folder stayed: ${JSON.stringify(walkFiles())}`).toBe(true);
    console.error(`[walk] after the root returned: ${JSON.stringify(walkFiles())}`);
    // The pass that removes the folder clears the flag first, so a folder that left names a flag that left: the door reads none.
    expect(flagOf(await lar.cli(["get", `title=${FLAG}`, ...ANCHOR, "--json"])), "the flag cleared with the folder").toBeNull();
  });
});
