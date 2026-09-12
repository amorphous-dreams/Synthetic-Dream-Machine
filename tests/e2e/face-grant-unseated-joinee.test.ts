/**
 * e2e/face-grant-unseated-joinee — MEASURE: does the founder's face-grant record reach a joinee that boots
 * WITHOUT `LAR_JOIN_*` set?
 *
 * `meme-two-vessel-bag` ⑨ proves the later grant (basket-one #/the-later-grant, `c3bcab741`): the founder's
 * `face-join` writes `$:/lares/face-grant/<group>/<joinee>` on the PersonaGroup plane, and the joinee's kit
 * takes the seat by its own act. THAT joinee dials the founder by hand (`LAR_JOIN_SYNC` · `LAR_JOIN_GATE` ·
 * `LAR_JOIN_DOC`), so the plane it reads crosses a socket the operator opened at boot.
 *
 * THIS joinee holds the same admit edge — the PIN names the hearth's dial (`device-admit --sync-url`, landed as
 * `HEARTH_DAEMON_URL_TIDDLER` at founding) — and boots with NO `LAR_JOIN_*`: the herm-relayed fleet shape,
 * a device that never presented its edge to anyone. The question the drift-ward asks: does the record reach it
 * at all? The CONTROL is the founder's side — the record lands on A's plane regardless (`recordTitle`).
 *
 * MEASURED 2026-09-12: it never reaches — the joinee never reaches LIVE. Its boot waits on the founder's
 * PersonaGroup doc, which crosses only over the dial, and with no `LAR_JOIN_SYNC` the fail-closed boot window
 * closes: `[lararium] fatal: Error: [boot] @persona (automerge:…) did not resolve within 15000ms`. The PIN
 * carries the hearth's url and the boot never dials it (`open-node-vessel.ts`, `joinSyncUrl = opts.joinSyncUrl
 * ?? process.env["LAR_JOIN_SYNC"] ?? null`). The smallest cure — the pinned edge's hearth url as the dial's
 * default — sits in the dial, outside the realm plane's ownership; the vector holds as `test.fails` naming it.
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { openStaged, cliFor, freePort, stageDir, awaitRendezvous, vesselStorageDir, type LarInstance } from "../harness/instance.js";
import { mintVesselKey } from "../harness/vessel-key.js";
import { invokeLocal } from "../../packages/lares-cli/src/local-connector.js";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const CLI_BIN   = join(REPO_ROOT, "packages/lares-cli/dist/src/bin/lares.js");
const NODE_MAIN = join(REPO_ROOT, "packages/lararium-node/dist/src/main.js");

function missing(): string[] {
  const out: string[] = [];
  if (!existsSync(CLI_BIN))   out.push(`built CLI at ${CLI_BIN}`);
  if (!existsSync(NODE_MAIN)) out.push(`built node vessel at ${NODE_MAIN}`);
  if (process.env["LAR_TARGET"] === "live") out.push("a STAGED target — this witness founds two vessels");
  return out;
}
const gaps = missing();
if (gaps.length > 0) console.error(`face-grant-unseated-joinee: SKIPPED — missing ${gaps.join("; ")}`);

let A: LarInstance | null = null;
let B: LarInstance | null = null;
let rootB = "";
let admitCode = -1;
/** Why B never stood — its daemon's own fatal line; empty when B stands. */
let bootFailure = "";

describe.skipIf(gaps.length > 0)("★ the later grant, to a joinee that never dialed ★", () => {
  beforeAll(async () => {
    rootB = mkdtempSync(join(stageDir(), "lares-staged-Bq-"));
    const portA = await freePort();
    const portB = await freePort();
    const admit = join(rootB, "admit.json");
    const cliB  = cliFor({ LAR_ROOT: rootB, LAR_PORT: String(portB) });
    A = await openStaged({ tag: "A", port: portA, found: async (cliA, rootA) => {
      const clear = await cliA(["vessel", "clear", "--root", rootA, "--force", "--skip-build"]);
      if (clear.code !== 0) throw new Error(`A: clear failed (${clear.code})\n${clear.stderr.slice(-800)}`);
      const face = await cliA(["persona", "new", "0", "--name", "alpha"]);
      if (face.code !== 0) throw new Error(`A: face failed (${face.code})\n${face.stderr.slice(-800)}`);
      // THE GENESIS UNDER B'S ROOT. `vessel found --admit` reads the hearth true-name off `<root>/genesis`; the
      // re-derive is an internal rite step now (no `vessel bake` door), and A's `clear` just derived it under
      // A's root — the same bytes B founds by, copied whole.
      cpSync(join(rootA, "genesis"), join(rootB, "genesis"), { recursive: true });
      const keyB = await mintVesselKey(rootB);
      // THE PIN NAMES THE DIAL: the edge carries A's sync url — the one thing this joinee will hold about A.
      const edge = await cliA(["device-admit", "--joinee-key", keyB, "--sync-url", `ws://127.0.0.1:${portA}/ws`, "--out", admit]);
      if (edge.code !== 0) throw new Error(`A: device-admit failed (${edge.code})\n${edge.stderr.slice(-800)}`);
      admitCode = (await cliB(["vessel", "found", "--admit", admit])).code;
    } });
    if (!(await awaitRendezvous(A))) throw new Error(`A reached live but bound no rendezvous:\n${A.bootLog().slice(-800)}`);
    // B boots by its pinned edge and NOTHING ELSE — no LAR_JOIN_SYNC, no LAR_JOIN_GATE, no LAR_JOIN_DOC.
    try {
      B = await openStaged({ tag: "B", root: rootB, port: portB, found: async () => { /* founded by the admit above */ } });
      if (!(await awaitRendezvous(B))) throw new Error(`B reached live but bound no rendezvous:\n${B.bootLog().slice(-800)}`);
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      bootFailure = text.split("\n").find((l) => /fatal/.test(l))?.trim() ?? text.slice(-300);
      console.error(`face-grant-unseated-joinee MEASURE B: never stood — ${bootFailure.slice(0, 240)}`);
      B = null;
    }
  }, 400_000);

  afterAll(async () => {
    if (B) await B.stop();
    if (A) await A.stop();
    if (rootB && existsSync(rootB)) rmSync(rootB, { recursive: true, force: true });
  });

  test("① B founds by A's edge, holding the hearth's dial in its PIN", () => {
    expect(admitCode).toBe(0);
    expect(existsSync(join(rootB, "data/lares/vessel/social-bootstrap.json"))).toBe(true);
  });

  test("MEASURE: a joinee that never dialed never reaches LIVE — the boot waits on a plane only the dial carries", () => {
    if (B) {
      expect(B.bootLog()).not.toContain("[nexus-join]");   // the measure's premise: no dial at boot
      return;
    }
    expect(bootFailure).toContain("[boot] @persona");
    expect(bootFailure).toContain("did not resolve");
  });

  test("CONTROL: the founder's side lands the record whether or not the joinee ever reads it", async () => {
    const grant = await seatB();
    console.error(`face-grant-unseated-joinee MEASURE A: face-join → admitted ${String(grant["admitted"])} · record ${String(grant["recordTitle"] ?? "(none)")}`);
    expect(grant["admitted"], JSON.stringify(grant).slice(0, 400)).toBe(true);
    expect(typeof grant["recordTitle"]).toBe("string");
  }, 120_000);

  // THE VECTOR. The record is on A's plane; does it reach a joinee that never dialed?
  test.fails("★ the founder's grant record reaches a joinee that never dialed ★ (SEAM — the PIN names the dial, the boot never dials it)", async () => {
    expect(B, `B never stood: ${bootFailure}`).not.toBeNull();
    // B's next present reads its plane for the record — poll, bounded.
    const deadline = Date.now() + 60_000;
    let taken = false;
    while (Date.now() < deadline) {
      await B!.cli(["meme", "get", "lar:///t.witness.probe/present", "--recipe", "lares", "--json"]);
      if (/grant record taken .* SEATED/.test(B!.bootLog())) { taken = true; break; }
      await new Promise((res) => setTimeout(res, 3000));
    }
    const tail = B!.bootLog().split("\n").filter((l) => /face-join|pinned|grant record|nexus-join/.test(l)).slice(-6).join("\n  ");
    console.error(`face-grant-unseated-joinee MEASURE B: seat lines\n  ${tail}`);
    expect(taken, `the record never reached B:\n  ${tail}`).toBe(true);
  }, 180_000);

  /** A seats B by summons — the verb runs where A's booted provider lives; the record lands on A's plane. */
  async function seatB(): Promise<Record<string, unknown>> {
    const idDir = join(rootB, "data/lares/identity");
    const cardFile = readdirSync(idDir).find((f) => f.startsWith(".vessel-card"))!;
    const contactCard = readFileSync(join(idDir, cardFile), "utf8");
    const payload = JSON.parse(readFileSync(join(rootB, "admit.json"), "utf8")) as Record<string, unknown>;
    const deviceEdge = payload["deviceEdge"] ?? (JSON.parse(Buffer.from(String(payload["admit"] ?? ""), "base64url").toString("utf8") || "{}") as Record<string, unknown>)["deviceEdge"];
    const r = await invokeLocal("face-join", { summons: { kind: "face-join/v1", contactCard, deviceEdge } },
      `0x${"0".repeat(64)}`, { dataDir: vesselStorageDir(A!), timeoutMs: 60_000 }) as
      { results?: { summary?: { output?: Record<string, unknown> } } };
    return r.results?.summary?.output ?? {};
  }
});
