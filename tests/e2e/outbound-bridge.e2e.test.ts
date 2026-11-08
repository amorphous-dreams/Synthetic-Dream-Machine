/**
 * LEAD RUNS: this suite boots a staged daemon and waits on its journal projection events.
 * e2e/outbound-bridge — the two seams between the daemon's live wiki and its disk, typed through the
 * daemon's own door.
 *
 *   B1  the OUTBOUND BRIDGE: `lares meme put <uri> --recipe default` lands in the daemon's `$tw.wiki`
 *       (the anchor). Nothing carries that wiki change to `IslandAdaptor.saveTiddler`, so the daemon's
 *       working store never receives it — `meme get --bag wikis/daemon/working` answers not-found.
 *   B2  the DAEMON MIRROR: a record put DIRECTLY into `wikis/daemon/working` (`--bag`, the composite
 *       sink — no bridge needed) reaches the daemon's wiki, but the daemon island mounts no disk
 *       projector and its manifest carries no `diskMirrors`, so `<root>/wikis/kahua-<tag>/…` never appears.
 *
 * Each seam reads red for its own reason and flips loud when its wire lands (`test.fails`). The
 * CONTROLS stand green today and MUST stay green under both wires.
 *
 * Staged only — a live hearth is never written to by a test. SKIPS LOUDLY when the vessel cannot stand.
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { openStaged, awaitRendezvous, daemonWikiDir, stageDir, type LarInstance } from "../harness/instance.js";
import { expectEntry } from "../harness/journal-expect.js";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const CLI_BIN   = join(REPO_ROOT, "packages/lares-cli/dist/src/bin/lares.js");
const NODE_MAIN = join(REPO_ROOT, "packages/lararium-node/dist/src/main.js");

const DAEMON_WORKING = "lar:///ha.ka.ba/wikis/daemon/working";
const PATH_A = "ha.ka.ba/t/bridge/anchor";   // a three-term root — the siting law sites `lar:///w.w.w/…` names alone
const uriOf  = (p: string): string => `lar:///${p}`;
const REL    = (p: string): string => `${p}.mem`;

const meme = (path: string, slots: readonly string[]): string =>
  `<<^ code=\`&#x0001;\` from=\`?\` to=\`${uriOf(path)}\`>>\n<<^ code=\`&#x0002;\`>>\n\n\`\`\`toml meta\nuri-path = "${path}"\n\`\`\`\n\n` +
  slots.map((s) => `<<~ ahu slot=\`#/${s}\`>>\n\n! ${s}\n\n<<~/ahu>>\n`).join("\n") +
  `\n<<^ code=\`&#x0003;\`>>\n\n<<^ code=\`&#x0004;\` to=\`?\`>>\n`;

function missing(): string[] {
  const out: string[] = [];
  if (!existsSync(CLI_BIN))   out.push(`built CLI at ${CLI_BIN} (pnpm --filter @lares/cli build)`);
  if (!existsSync(NODE_MAIN)) out.push(`built node vessel at ${NODE_MAIN} (pnpm --filter @lararium/node build)`);
  if (process.env["LAR_TARGET"] === "live") out.push("a STAGED target — this witness writes, and never writes to a live hearth");
  return out;
}

const said = (r: { stdout: string; stderr: string }): string => `${r.stdout}\n${r.stderr}`;
const gaps = missing();
if (gaps.length > 0) console.error(`outbound-bridge: SKIPPED — missing ${gaps.join("; ")}`);

let lar: LarInstance;
let scratch = "";
let priorHome: string | undefined;

describe.skipIf(gaps.length > 0)("★ the outbound bridge and the daemon mirror, over a live rendezvous ★", () => {
  beforeAll(async () => {
    const root = mkdtempSync(join(stageDir(), "lares-outbound-bridge-"));
    priorHome = process.env["HOME"];
    process.env["HOME"] = join(root, "home");
    mkdirSync(process.env["HOME"], { recursive: true });
    lar = await openStaged({ root, tag: "outbound-bridge" });
    scratch = join(lar.root, "witness");
    mkdirSync(scratch, { recursive: true });
    writeFileSync(join(scratch, "anchor.mem"), meme(PATH_A, ["a"]));
    const bound = await awaitRendezvous(lar);
    if (!bound) throw new Error(`the staged daemon reached live but bound no rendezvous:\n${lar.bootLog().slice(-800)}`);
  }, 150_000);
  afterAll(async () => {
    if (lar) await lar.stop();
    if (priorHome === undefined) delete process.env["HOME"];
    else process.env["HOME"] = priorHome;
  });

  test("CONTROL: explicit `--recipe default` lands in the daemon wiki and reads it back", async () => {
    const put = await lar.cli(["meme", "put", uriOf(PATH_A), "--recipe", "default", "--file", join(scratch, "anchor.mem"), "--json"]);
    expect(put.json?.["ok"], said(put)).toBe(true);
    const got = await lar.cli(["meme", "get", uriOf(PATH_A), "--recipe", "default", "--json"]);
    expect(got.json?.["ok"], said(got)).toBe(true);
  });

  test("B1 the bridge (Road B): the explicit anchor recipe reaches the daemon working store", async () => {
    // LIVENESS: fail if the matching projector event never arrives; event arrival, not elapsed time, gates the read.
    await expectEntry(lar, { kind: "bag-projected", match: (event) => {
      const data = event.data as Record<string, unknown>;
      return data["bagId"] === DAEMON_WORKING && data["path"] === daemonWikiDir(lar.root);
    } }, { budgetMs: 60_000 });
    const got = await lar.cli(["meme", "get", uriOf(PATH_A), "--bag", DAEMON_WORKING, "--json"]);
    expect(got.json?.["ok"], `the anchor placement stands in $tw.wiki alone — ${said(got)}`).toBe(true);
    expect(String((got.json?.["data"] as Record<string, unknown>)["text"])).toContain(`uri-path = "${PATH_A}"`);
    const at = join(daemonWikiDir(lar.root), REL(PATH_A));
    expect(existsSync(at), `the working wiki did not project ${at}`).toBe(true);
  });

  test("CONTROL: the daemon's private bag projects NOWHERE — no bags/daemon/ under the root", () => {
    expect(existsSync(join(lar.root, "bags", "daemon"))).toBe(false);
  });
});
