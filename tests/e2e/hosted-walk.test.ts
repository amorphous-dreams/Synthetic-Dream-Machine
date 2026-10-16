/**
 * e2e/hosted-walk — the hosted walk behind the sealed gate: THE WALKER ROUTE SHIPS SHUT BY NAME.
 *
 * The shut-routes house ruling (stable-founding-road #/rulings): walker arms, the sibling dial and the herm membership relay
 * ship SHUT by name, and a closed route grants no silent authority. It flips on a proven gate-native caller; while it stands
 * shut, this suite asserts the SHUT: it is never skipped to get green.
 *
 *   A   the hearth — a charter seated by its own quorum, PRIVATE; its daemon stands throughout.
 *   B   a node that takes A's invite as its worn face and stands.
 *   C   a node that takes an invite as the second walker (B's wallet is empty, so it takes A's second invite).
 *
 * Proven, in order:
 *   ① A's roll and invite still run INSIDE A's standing vessel (`via: daemon`) — the hearth's hosting is not the shut route;
 *   ② B takes the invite and stands: its boot says `walker-route-shut` by name, A counts NO redemption, and B's wallet stays
 *     empty — no walk arm reached the gate;
 *   ③ C does the same on a second invite: still shut by name, A still counts none.
 *
 * The walker's browser shape (the platform-blind walk client over the sealed adapter) is shut the same way: the adapter
 * carries no walk identity, so `walkOver` settles no invite (mesh walk-client, `walker-route-shut`).
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { existsSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { openStaged, freePort, stageDir, awaitRendezvous, foundStagedHearth, growStagedQuorum, type LarInstance } from "../harness/instance.js";
import { hostingDocUrl, decodeInvite } from "../../packages/lararium-mesh/src/index.js";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const CLI_BIN   = join(REPO_ROOT, "packages/lares-cli/dist/src/bin/lares.js");
const NODE_MAIN = join(REPO_ROOT, "packages/lararium-node/dist/src/main.js");
const said = (r: { stdout: string; stderr: string }): string => `${r.stdout}\n${r.stderr}`;
const dataOf = (r: { json: Record<string, unknown> | null }): Record<string, unknown> => (r.json?.["data"] ?? {}) as Record<string, unknown>;
const RULING = "the shut-routes house ruling";

function missing(): string[] {
  const out: string[] = [];
  if (!existsSync(CLI_BIN))   out.push(`built CLI at ${CLI_BIN}`);
  if (!existsSync(NODE_MAIN)) out.push(`built node vessel at ${NODE_MAIN}`);
  if (process.env["LAR_TARGET"] === "live") out.push("a STAGED target — this witness founds three vessels");
  return out;
}
const gaps = missing();
if (gaps.length > 0) console.error(`hosted-walk: SKIPPED — missing ${gaps.join("; ")}`);

let A: LarInstance | null = null;
let B: LarInstance | null = null;
let C: LarInstance | null = null;
let relayA = "";
let gateA = "";
let nexusA = "";
let inviteB = "";

/** The count A keeps for its current epoch and the one before it. */
async function redeemedAtA(): Promise<number> {
  const st = await A!.cli(["host", "--json"]);
  const rows = (dataOf(st)["nexuses"] ?? []) as Array<{ redeemed: number; redeemedPrevious: number }>;
  return rows.reduce((n, r) => n + r.redeemed + r.redeemedPrevious, 0);
}

/**
 * A shut route redeems nothing, and a count read the instant the boot lands proves only that no redemption has landed YET.
 * An open walk redeems within a few seconds of the take, so hold the count at zero across that whole window: every read
 * inside it reads none, and the last does too.
 */
async function noRedemptionWithin(windowMs: number): Promise<void> {
  const until = Date.now() + windowMs;
  do {
    expect(await redeemedAtA(), "a walker redeemed an invite at A though the route ships shut").toBe(0);
    if (Date.now() < until) await new Promise((r) => setTimeout(r, 1_000));
  } while (Date.now() < until);
}
const OPEN_WALK_WINDOW_MS = 10_000;

/** A walker vessel: founds, wears its face, takes the invite, stands. The walk is SHUT, so the boot says so by name. */
async function standWalker(tag: string, name: string, invite: string): Promise<LarInstance> {
  const root = mkdtempSync(join(stageDir(), `lares-staged-${tag}-`));
  return openStaged({ tag, root, found: async (cli, r) => {
    await foundStagedHearth(cli, r, name);
    // A walker walks as the face it wears: unworn, the take refuses and writes nothing.
    const unworn = await cli(["walk", "take", invite, "--json"]);
    if (unworn.code === 0) throw new Error(`${tag}: a take with no face worn was kept:\n${said(unworn)}`);
    const wear = await cli(["persona", "wear", "0"]);
    if (wear.code !== 0) throw new Error(`${tag}: wear failed (${wear.code})\n${said(wear).slice(-800)}`);
    const take = await cli(["walk", "take", invite, "--json"]);
    if (take.code !== 0) throw new Error(`${tag}: walk take failed (${take.code})\n${said(take).slice(-800)}`);
  } });
}

describe.skipIf(gaps.length > 0)("★ the walker route ships SHUT by name beside a standing hearth ★", () => {
  beforeAll(async () => {
    const portA = await freePort();
    relayA = `ws://127.0.0.1:${portA}/ws`;
    A = await openStaged({ tag: "hostA", port: portA, found: async (cli, root) => {
      await foundStagedHearth(cli, root, "hearth-keeper");
      await growStagedQuorum(cli, root, ["Kahu Alpha", "Kahu Beta", "Kahu Gamma"]);
      const wear = await cli(["persona", "wear", "0"]);
      if (wear.code !== 0) throw new Error(`A: wear failed (${wear.code})\n${said(wear).slice(-800)}`);
    } });
    if (!(await awaitRendezvous(A))) throw new Error(`A reached live but bound no rendezvous:\n${A.bootLog().slice(-800)}`);
  }, 400_000);

  afterAll(async () => {
    if (C) await C.stop();
    if (B) await B.stop();
    if (A) await A.stop();
  });

  test("① A's roll and invite still run inside A's standing vessel — hosting is not the shut route", async () => {
    const roll = await A!.cli(["host", "roll", "--json"]);
    expect(roll.code, said(roll)).toBe(0);
    expect(dataOf(roll)["via"]).toBe("daemon");
    nexusA = String(dataOf(roll)["nexusAid"]);
    const inv = await A!.cli(["host", "invite", "--relay", relayA, "--json"]);
    expect(inv.code, said(inv)).toBe(0);
    expect(dataOf(inv)["via"]).toBe("daemon");
    gateA = decodeInvite(String(dataOf(inv)["invite"]))!.gatePubKey;
    expect(dataOf(roll)["docUrl"]).toBe(hostingDocUrl(nexusA, gateA));
    inviteB = String(dataOf(inv)["invite"]);
  }, 60_000);

  test(`② B takes the invite and stands: the boot names \`walker-route-shut\` (${RULING}), A counts no redemption, B's wallet stays empty`, async () => {
    B = await standWalker("walkB", "wayfarer", inviteB);
    // The shut is a line the boot wrote before it went live: no clock to wait on.
    expect(B.bootLog(), "B's boot never named the shut walker route").toMatch(/walker-route-shut/);
    // A closed route grants no silent authority: nothing redeemed across the window an open walk redeems in, nothing vested.
    await noRedemptionWithin(OPEN_WALK_WINDOW_MS);
    const walks = (dataOf(await B.cli(["walk", "--json"]))["walks"] ?? []) as Array<{ wallet: number; grant: unknown }>;
    expect(walks[0]?.wallet).toBe(0);
    expect(walks[0]?.grant ?? null).toBeNull();
  }, 400_000);

  test("③ a second walker meets the same shut: named, and A still counts none", async () => {
    const inv = await A!.cli(["host", "invite", "--relay", relayA, "--json"]);
    expect(inv.code, said(inv)).toBe(0);
    C = await standWalker("walkC", "second-wayfarer", String(dataOf(inv)["invite"]));
    expect(C.bootLog(), "C's boot never named the shut walker route").toMatch(/walker-route-shut/);
    await noRedemptionWithin(OPEN_WALK_WINDOW_MS);
  }, 400_000);
});
