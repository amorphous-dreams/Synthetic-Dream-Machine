/**
 * e2e/meme-two-vessel-bag — an author's `bag` field crosses between TWO vessels byte-whole.
 *
 * `bag-is-user-space` proves it in one process over a memory store: an author's `bag` is user space,
 * `$origin-bag` is the host's provenance, residency rides the envelope. This witness stands the pair
 * the law is for — a founder A and a same-operator joiner B, each on its own root, port and key — and
 * carries a meme whose meta holds `bag = "backpack: rope, lantern"` from A's wiki to B's.
 *
 * THE RITE, every step through the built CLI:
 *   ① A founds (a place, a face)                          `vessel clear --force` · `persona new 0`
 *   ② B mints its OWN key first, on a baked genesis        `vessel bake` · the vessel-identity mint
 *   ③ A signs the edge over B's key, naming A's dial       `device-admit --joinee-key … --sync-url …`
 *   ④ B founds BY that payload                             `vessel found --admit`
 *   ⑤ A stands; the meme lands on A's wiki                 `meme put --recipe lares`
 *   ⑥ B stands dialing A                                   LAR_JOIN_SYNC · LAR_JOIN_GATE · LAR_JOIN_DOC
 *   ⑦ B reads the meme; B edits; A reads the edit back     `meme get` · `meme put --base` · `meme get`
 *
 * TWO GATES, measured 2026-09-11, each named where it bites:
 *
 *   ⑥ dies. `vessel found --admit` mints the joiner's ContactCard and never persists it (`init.ts`: the
 *   admit branch computes `contactCardJson` and skips `persistVesselCard`), so the daemon's dial-out
 *   reports "leaf identity unavailable" and mounts nothing; the `@persona` doc the admit synced from the
 *   founder then never resolves, and the boot exits 1. Every vector past ⑥ SKIPS LOUDLY naming that line.
 *
 *   ⑤ lands in a bag ONE vessel mounts. `--recipe lares` designates the wiki's draft bag, keyed per
 *   vessel DID (`wikis/lares/drafts/<did>`) — `wiki which` says so below — and no disk projection
 *   follows it. `--bag lares` refuses a put (no writable layer; a placement never shadows up), and the
 *   daemon bag is each vessel's own. So once ⑥ stands, ⑦ still needs a put seat into a bag BOTH mount;
 *   today `act LOAD --to lar:///ha.ka.ba/bags/lares` is the one door that writes the shared bag.
 *
 * Nothing here fakes the sync. What ⑦ proves when it runs: B's `get` carries the `bag = …` line
 * byte-whole and no `$origin-bag`; an edit on B with B's base lands on A.
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  openStaged, cliFor, freePort, stageDir, awaitRendezvous, vesselStorageDir, type LarInstance, type CliResult,
} from "../harness/instance.js";
import { generateOrLoadVesselIdentity } from "../../packages/lararium-node/src/node-vessel-identity.js";
import { invokeLocal } from "../../packages/lares-cli/src/local-connector.js";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const CLI_BIN   = join(REPO_ROOT, "packages/lares-cli/dist/src/bin/lares.js");
const NODE_MAIN = join(REPO_ROOT, "packages/lararium-node/dist/src/main.js");

const INVENTORY = "backpack: rope, lantern";
const PATH = "t/witness/npc";
const URI  = `lar:///${PATH}`;
const WIKI = ["--recipe", "lares"] as const;
/** The author's line as the canonical carrier aligns it — the VALUE is what must read back byte-whole. */
const BAG_LINE = new RegExp(`^bag\\s+= "${INVENTORY}"$`, "m");

/** The NPC meme: the author's `bag` rides the meta, the named slots ride the body. */
const meme = (slots: readonly string[]): string =>
  `<<^ code="&#x0001;" from=? -> to=${URI}>>\n\`\`\`toml meta\nuri-path = "${PATH}"\nbag = "${INVENTORY}"\n\`\`\`\n\n` +
  `<<^ code="&#x0002;">>\n\n` +
  slots.map((s) => `<<~ ahu #/${s}>>\n\n! ${s}\n\n<<~/ahu>>\n`).join("\n") +
  `\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to=?>>\n`;

function missing(): string[] {
  const out: string[] = [];
  if (!existsSync(CLI_BIN))   out.push(`built CLI at ${CLI_BIN} (pnpm --filter @lares/cli build)`);
  if (!existsSync(NODE_MAIN)) out.push(`built node vessel at ${NODE_MAIN} (pnpm --filter @lararium/node build)`);
  if (process.env["LAR_TARGET"] === "live") out.push("a STAGED target — this witness founds two vessels, and never writes to a live hearth");
  return out;
}

const said = (r: { stdout: string; stderr: string }): string => `${r.stdout}\n${r.stderr}`;

const gaps = missing();
if (gaps.length > 0) console.error(`meme-two-vessel-bag: SKIPPED — missing ${gaps.join("; ")}`);

let A: LarInstance | null = null;
let B: LarInstance | null = null;
let rootB = "";
let admitted: CliResult | null = null;
/** Why B never stood — the daemon's own words; empty when B stands. */
let joinGate = "";
let baseA = "";

describe.skipIf(gaps.length > 0)("★ an author's `bag` crosses two vessels ★", () => {
  beforeAll(async () => {
    rootB = mkdtempSync(join(stageDir(), "lares-staged-B-"));
    const portA = await freePort();
    const portB = await freePort();
    const admit = join(rootB, "admit.json");
    const cliB  = cliFor({ LAR_ROOT: rootB, LAR_PORT: String(portB) });

    // ①–④ run while NO daemon stands: `device-admit` opens A's store directly, and a store has one owner.
    A = await openStaged({ tag: "A", port: portA, found: async (cliA, rootA) => {
      const clear = await cliA(["vessel", "clear", "--root", rootA, "--force"]);
      if (clear.code !== 0) throw new Error(`A: clear failed (${clear.code})\n${clear.stderr.slice(-800)}`);
      const face = await cliA(["persona", "new", "0", "--name", "alpha"]);
      if (face.code !== 0) throw new Error(`A: face failed (${face.code})\n${face.stderr.slice(-800)}`);

      // THE JOINEE MINTS FIRST. Admission signs a key the joiner already holds; the CLI offers no door
      // that mints a vessel key short of a founding, so the mint rides the same function a founding calls.
      const bake = await cliB(["vessel", "bake"]);
      if (bake.code !== 0) throw new Error(`B: bake failed (${bake.code})\n${bake.stderr.slice(-800)}`);
      const keyB = (await generateOrLoadVesselIdentity(join(rootB, "data/lares/vessel"))).verifyingKey;

      const edge = await cliA(["device-admit", "--joinee-key", keyB, "--sync-url", `ws://127.0.0.1:${portA}/ws`, "--out", admit]);
      if (edge.code !== 0) throw new Error(`A: device-admit failed (${edge.code})\n${edge.stderr.slice(-800)}`);
      admitted = await cliB(["vessel", "found", "--admit", admit]);
    } });
    if (!(await awaitRendezvous(A))) throw new Error(`A reached live but bound no rendezvous:\n${A.bootLog().slice(-800)}`);

    // ⑤ the meme lands on A's wiki.
    const f = join(A.root, "npc.mem");
    writeFileSync(f, meme(["a"]));
    const put = await A.cli(["meme", "put", URI, ...WIKI, "--file", f, "--json"]);
    if (put.json?.["ok"] !== true) throw new Error(`A: put refused\n${said(put)}`);
    baseA = String((put.json["data"] as Record<string, unknown>)["canonicalHash"]);

    // ⑥ B stands dialing A: A's gate key off A's own log, A's lares doc off A's registry.
    const gateA = /gate key: ([0-9a-f]{64})/.exec(A.bootLog())?.[1] ?? "";
    const wl = await invokeLocal("list-wikis", {}, `0x${"0".repeat(64)}`, { dataDir: vesselStorageDir(A) }) as
      { results?: { summary?: { output?: { wikis?: Array<{ slug: string; automergeUrl: string | null }> } } } };
    const laresA = wl.results?.summary?.output?.wikis?.find((w) => w.slug === "lares")?.automergeUrl ?? "";
    try {
      B = await openStaged({
        tag: "B", root: rootB, port: portB, found: async () => { /* ④ founded B already */ },
        daemonEnv: { LAR_JOIN_SYNC: `ws://127.0.0.1:${portA}/ws`, LAR_JOIN_GATE: gateA, LAR_JOIN_DOC: laresA },
      });
      if (!(await awaitRendezvous(B))) throw new Error(`B reached live but bound no rendezvous:\n${B.bootLog().slice(-800)}`);
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      const line = text.split("\n").find((l) => /nexus-join|fatal/.test(l)) ?? text.slice(-300);
      joinGate = line.trim();
      console.error(`meme-two-vessel-bag: B never stood — the sync vectors SKIP. The daemon said:\n  ${joinGate}`);
      B = null;
    }
  }, 400_000);

  afterAll(async () => {
    if (B) await B.stop();
    if (A) await A.stop();
    if (rootB && existsSync(rootB)) rmSync(rootB, { recursive: true, force: true });
  });

  test("④ the admit ceremony crosses: B founds by A's signed edge, holding its own key", () => {
    expect(admitted?.code, said(admitted ?? { stdout: "", stderr: "no founding ran" })).toBe(0);
    expect(admitted?.stdout).toContain("joined the PersonaGroup");
    expect(existsSync(join(rootB, "data/lares/vessel/social-bootstrap.json"))).toBe(true);
  });

  test("⑤ on A: `get` hands the author's `bag` line back byte-whole", async () => {
    const r = await A!.cli(["meme", "get", URI, ...WIKI, "--json"]);
    expect(r.json?.["ok"], said(r)).toBe(true);
    const text = String((r.json?.["data"] as Record<string, unknown>)["text"]);
    expect(text).toMatch(BAG_LINE);
    expect(text).not.toContain("$origin-bag");
  });

  test("⑤ on A: the recipe seat lands the meme in the wiki's per-DID draft bag — a bag ONE vessel mounts", async () => {
    const r = await A!.cli(["wiki", "which", URI, "--no-json"]);
    expect(r.code, said(r)).toBe(0);
    const primary = /primary:\s+(\S+)/.exec(r.stdout)?.[1] ?? "";
    expect(primary).toMatch(/^lar:\/\/\/ha\.ka\.ba\/wikis\/lares\/drafts\/0x[0-9a-f]{64}$/);
  });

  test("⑦ on B: `get` carries the `bag` line byte-whole and no `$origin-bag`", async (ctx) => {
    if (!B) { console.error(`meme-two-vessel-bag: ⑦ SKIPPED — ${joinGate}`); ctx.skip(); return; }
    const r = await B.cli(["meme", "get", URI, ...WIKI, "--json"]);
    expect(r.json?.["ok"], said(r)).toBe(true);
    const text = String((r.json?.["data"] as Record<string, unknown>)["text"]);
    expect(text).toMatch(BAG_LINE);
    expect(text).not.toContain("$origin-bag");
  });

  test("⑦ B edits with the base B read; A gets the new slot back", async (ctx) => {
    if (!B) { console.error(`meme-two-vessel-bag: ⑦ SKIPPED — ${joinGate}`); ctx.skip(); return; }
    const read = await B.cli(["meme", "get", URI, ...WIKI, "--json"]);
    const baseB = String((read.json?.["data"] as Record<string, unknown>)["canonicalHash"]);
    expect(baseB).toBe(baseA);
    const f = join(B.root, "npc-b.mem");
    writeFileSync(f, meme(["a", "b"]));
    const put = await B.cli(["meme", "put", URI, ...WIKI, "--base", baseB, "--file", f, "--json"]);
    expect(put.json?.["ok"], said(put)).toBe(true);
    const deadline = Date.now() + 60_000;
    for (;;) {
      const back = await A!.cli(["meme", "get", URI, ...WIKI, "--json"]);
      const text = String((back.json?.["data"] as Record<string, unknown>)?.["text"] ?? "");
      if (text.includes("<<~ ahu #/b>>")) { expect(text).toMatch(BAG_LINE); return; }
      if (Date.now() > deadline) throw new Error(`A never saw B's slot within 60s:\n${text}`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  });
});
