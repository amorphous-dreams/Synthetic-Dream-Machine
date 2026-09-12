/**
 * e2e/outbound-bridge — the two seams between the daemon's live wiki and its disk, typed through the
 * daemon's own door.
 *
 *   B1  the OUTBOUND BRIDGE: `lares meme put <uri>` with no target lands in the daemon's `$tw.wiki`
 *       (the anchor). Nothing carries that wiki change to `IslandAdaptor.saveTiddler`, so the daemon's
 *       working store never receives it — `meme get --bag wikis/daemon/working` answers not-found.
 *   B2  the DAEMON MIRROR: a record put DIRECTLY into `wikis/daemon/working` (`--bag`, the composite
 *       sink — no bridge needed) reaches the daemon's wiki, but the daemon island mounts no disk
 *       projector and its manifest carries no `diskMirrors`, so `<root>/wikis/daemon/…` never appears.
 *
 * Each seam reads red for its own reason and flips loud when its wire lands (`test.fails`). The
 * CONTROLS stand green today and MUST stay green under both wires.
 *
 * Staged only — a live hearth is never written to by a test. SKIPS LOUDLY when the vessel cannot stand.
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { targetInstance, awaitRendezvous, type LarInstance } from "../harness/instance.js";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const CLI_BIN   = join(REPO_ROOT, "packages/lares-cli/dist/src/bin/lares.js");
const NODE_MAIN = join(REPO_ROOT, "packages/lararium-node/dist/src/main.js");

const DAEMON_WORKING = "lar:///ha.ka.ba/wikis/daemon/working";
const PATH_A = "ha.ka.ba/t/bridge/anchor";   // a three-term root — the siting law sites `lar:///w.w.w/…` names alone
const PATH_B = "ha.ka.ba/t/bridge/direct";
const uriOf  = (p: string): string => `lar:///${p}`;
const REL    = (p: string): string => `${p}.mem`;

const meme = (path: string, slots: readonly string[]): string =>
  `<<^ code="&#x0001;" from=? -> to=${uriOf(path)}>>\n\`\`\`toml meta\nuri-path = "${path}"\n\`\`\`\n\n` +
  `<<^ code="&#x0002;">>\n\n` +
  slots.map((s) => `<<~ ahu #/${s}>>\n\n! ${s}\n\n<<~/ahu>>\n`).join("\n") +
  `\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to=?>>\n`;

function missing(): string[] {
  const out: string[] = [];
  if (!existsSync(CLI_BIN))   out.push(`built CLI at ${CLI_BIN} (pnpm --filter @lares/cli build)`);
  if (!existsSync(NODE_MAIN)) out.push(`built node vessel at ${NODE_MAIN} (pnpm --filter @lararium/node build)`);
  if (process.env["LAR_TARGET"] === "live") out.push("a STAGED target — this witness writes, and never writes to a live hearth");
  return out;
}

const said = (r: { stdout: string; stderr: string }): string => `${r.stdout}\n${r.stderr}`;
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Poll a path until it reaches the wanted existence state (or timeout). */
async function awaitFileState(path: string, want: boolean, timeoutMs = 20_000): Promise<boolean> {
  const start = Date.now();
  for (;;) {
    if (existsSync(path) === want) return true;
    if (Date.now() - start > timeoutMs) return false;
    await sleep(500);
  }
}

const gaps = missing();
if (gaps.length > 0) console.error(`outbound-bridge: SKIPPED — missing ${gaps.join("; ")}`);

let lar: LarInstance;
let scratch = "";

describe.skipIf(gaps.length > 0)("★ the outbound bridge and the daemon mirror, over a live rendezvous ★", () => {
  beforeAll(async () => {
    lar = await targetInstance();
    scratch = join(lar.root, "witness");
    mkdirSync(scratch, { recursive: true });
    writeFileSync(join(scratch, "anchor.mem"), meme(PATH_A, ["a"]));
    writeFileSync(join(scratch, "direct.mem"), meme(PATH_B, ["a"]));
    const bound = await awaitRendezvous(lar);
    if (!bound) throw new Error(`the staged daemon reached live but bound no rendezvous:\n${lar.bootLog().slice(-800)}`);
  }, 150_000);
  afterAll(async () => { if (lar) await lar.stop(); });

  test("CONTROL: the anchor put lands in the daemon's wiki — `meme get` with no target reads it back", async () => {
    const put = await lar.cli(["meme", "put", uriOf(PATH_A), "--file", join(scratch, "anchor.mem"), "--json"]);
    expect(put.json?.["ok"], said(put)).toBe(true);
    const got = await lar.cli(["meme", "get", uriOf(PATH_A), "--json"]);
    expect(got.json?.["ok"], said(got)).toBe(true);
  });

  test("B1 the bridge (Road B): the anchor put reaches the daemon's working store — `meme get --bag wikis/daemon/working` answers", async () => {
    // The adaptor's capture debounce (400 ms) then the store put — poll to a deadline, never a fixed nap.
    const deadline = Date.now() + 20_000;
    let got = await lar.cli(["meme", "get", uriOf(PATH_A), "--bag", DAEMON_WORKING, "--json"]);
    while (got.json?.["ok"] !== true && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 1000));
      got = await lar.cli(["meme", "get", uriOf(PATH_A), "--bag", DAEMON_WORKING, "--json"]);
    }
    expect(got.json?.["ok"], `the anchor placement stands in $tw.wiki alone — ${said(got)}`).toBe(true);
    expect(String((got.json?.["data"] as Record<string, unknown>)["text"])).toContain(`uri-path = "${PATH_A}"`);
  });

  test("CONTROL: a DIRECT put into wikis/daemon/working (the composite sink) lands, and reads back through the same bag", async () => {
    const put = await lar.cli(["meme", "put", uriOf(PATH_B), "--bag", DAEMON_WORKING, "--file", join(scratch, "direct.mem"), "--json"]);
    expect(put.json?.["ok"], said(put)).toBe(true);
    const got = await lar.cli(["meme", "get", uriOf(PATH_B), "--bag", DAEMON_WORKING, "--json"]);
    expect(got.json?.["ok"], said(got)).toBe(true);
  });

  test("★ the daemon wiki projects: a record in wikis/daemon/working lands at <root>/wikis/daemon/<uri-path>.mem ★", async () => {
    const at = join(lar.root, "wikis", "daemon", REL(PATH_B));
    expect(await awaitFileState(at, true), `nothing projected at ${at}`).toBe(true);
  });

  test("CONTROL: the daemon's private bag projects NOWHERE — no bags/daemon/ under the root", () => {
    expect(existsSync(join(lar.root, "bags", "daemon"))).toBe(false);
  });
});
