/**
 * e2e/face-join — the capability half of a join, driven against a REAL standing daemon.
 *
 * The unit tests fence the decision against a recording fake, and the pair test proves the crypto between two
 * in-process providers holding their own bag list. Neither touches what a live vessel supplies: the group id
 * off `daemonAuth`, the lease epoch scanned from real daemon slots, and the standing-bag set the re-grant
 * walks. A join can pass every other test and still, on a real hearth, seat a member that reaches nothing.
 *
 * So these vectors ride the daemon's own verb surface, over its UDS channel, exactly as a summons relayed from
 * the daemon doc would arrive:
 *
 *   V1 — an edge THIS hearth's root signed admits, seats, and RE-GRANTS its standing bags (regranted > 0)
 *   V2 — a repeat hands the seat back and moves no epoch (reKeyed false, regranted 0), material still flowing
 *   V3 — force re-keys and re-grants again, for a suspected-but-unrevoked key
 *   V4 — an edge signed by ANOTHER root refuses, with a reason a joinee's panel can paint
 *   V5 — a hearth refuses to seat ITSELF, so a fleet-synced summons never draws two writers
 *
 * V1's `regranted` assertion is the one that cannot be inferred: membership WITHOUT reach looks identical to a
 * healthy join from every other angle — admitted, re-keyed, events flowing — and only the count says so.
 *
 * THE RECORD OVER THE SUMMARY. The verb's outcome is a bounded VIEW: past the outcome cap its `capEvents` fold to
 * `{boundedArrayCount, tallies, sha256, sample}`. The act is the signed `face-join-grant/v1` record the verb writes
 * to the PersonaGroup plane, so V1–V3 read THAT record back through `face-grant-get` — the same store the join
 * wrote, so the read follows the join causally — verify its signature under the root that signed the joinee's
 * edge, and assert on it. The view is held to the record as a CONTROL: its digest and count match the record's
 * array, or, unbounded, its array equals the record's.
 *
 * None of these vectors asserts RECOVERY. A summons returns a seat and public ops, never prekey secrets, so a
 * vessel that lost its store restores from its archive; the pair test holds that boundary.
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { targetInstance, type LarInstance, awaitRendezvous, vesselStorageDir } from "../harness/instance.js";
import { KeyhiveProvider } from "../../packages/lararium-keyhive/src/keyhive-provider.js";
import { verifyFaceGrantRecord, type FaceGrantRecord } from "../../packages/lararium-keyhive/src/face-grant-record.js";
import { canonicalJsonBytes, sha256HexBytesSync } from "../../packages/lararium-mesh/src/crypto.js";
import { invokeLocal } from "../../packages/lares-cli/src/local-connector.js";
import type { DeviceDelegationTiddler } from "../../packages/lararium-mesh/src/device-delegation.js";

let lar: LarInstance;
let dataDir = "";
let joineeCard = "";
let joineeKey = "";
let edge: DeviceDelegationTiddler | null = null;

/** Wait for the daemon's UDS home to appear under this root. The socket lands a beat AFTER the boot phase
 *  resolves, so a single sample races it — and a raced sample reads as "no socket" rather than "not yet". */

async function summon(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const r = await invokeLocal("face-join", { summons: { kind: "face-join/v1", ...body } },
    `0x${"0".repeat(64)}`, { dataDir, timeoutMs: 30_000 });
  return (r as { results?: { summary?: { output?: Record<string, unknown> } } })
    .results?.summary?.output ?? (r as unknown as Record<string, unknown>);
}

/**
 * The grant RECORD a join wrote, read back through the daemon's own store, verified, and held against the view.
 *
 * Returns the record so a vector asserts on the act. Fails when no record stands, when its signature fails under
 * the root that signed the joinee's edge, or when the outcome's view disagrees with the record it summarises.
 */
async function recordedGrant(g: Record<string, unknown>): Promise<FaceGrantRecord> {
  const r = await invokeLocal("face-grant-get", { joinee: g["joineeAgentIdHex"] },
    `0x${"0".repeat(64)}`, { dataDir, timeoutMs: 30_000 });
  const out = (r as { results?: { summary?: { output?: Record<string, unknown> } } }).results?.summary?.output
    ?? (r as unknown as Record<string, unknown>);
  expect(out["title"], `the read names another title than the join wrote:\n${JSON.stringify(r).slice(0, 600)}`).toBe(g["recordTitle"]);
  const rec = out["record"] as FaceGrantRecord | null;
  expect(rec, `no grant record stands at ${String(g["recordTitle"])}:\n${JSON.stringify(r).slice(0, 600)}`).not.toBeNull();
  const verdict = await verifyFaceGrantRecord(rec, {
    personaRootDid: (edge as DeviceDelegationTiddler).personaRootDid, selfVerifyingKey: joineeKey, groupDocIdHex: rec!.groupDocIdHex,
  });
  expect(verdict, "the grant record does not verify as signed under the hearth's root").toEqual({ ok: true });
  expect(rec!.capEvents.length).toBeGreaterThan(0);

  // CONTROL — the view carries the record's digest. A bounded summary names the record's array by its sha256 over
  // canonical JSON and by its count; an unbounded one IS the record's array.
  const view = g["capEvents"];
  if (Array.isArray(view)) {
    expect(view).toEqual(rec!.capEvents);
  } else {
    const bounded = view as { boundedArrayCount: number; sha256: string };
    expect(bounded.sha256).toBe(sha256HexBytesSync(canonicalJsonBytes(rec!.capEvents)));
    expect(bounded.boundedArrayCount).toBe(rec!.capEvents.length);
  }
  return rec!;
}

beforeAll(async () => {
  lar = await targetInstance();
  // THE ROOT IS THE ANSWER, and the connector re-derives the socket from it. A hunt for a file named
  // `lares.sock` under the root found nothing — the rendezvous stands at
  // `/tmp/lares-<uid>/<root-digest>.sock` — and every vector below then failed on an empty string,
  // reading as a broken join ceremony the run never reached.
  dataDir = (await awaitRendezvous(lar)) ? vesselStorageDir(lar) : "";

  // A THROWAWAY vessel stands its own keyhive and offers its own card — the joinee half, never this hearth's.
  const p = new KeyhiveProvider();
  await p.init({ seed: new Uint8Array(32).fill(88), eventStore: { put: async () => {}, list: async () => [] } });
  joineeKey  = (await p.whoami()).replace(/^0x/, "");
  joineeCard = new TextDecoder().decode(await p.contactCard());

  // The hearth's OWN root signs the edge that licenses it.
  const admit = await lar.cli(["device-admit", "--joinee-key", joineeKey]);
  const b64 = /#admit=([A-Za-z0-9_-]+)/.exec(admit.stdout)?.[1];
  if (b64) edge = JSON.parse(Buffer.from(b64, "base64url").toString("utf8")).deviceEdge;
}, 240_000);

afterAll(async () => { await lar?.stop(); });

describe("e2e/face-join — the join against a live hearth", () => {
  test("the rig stands: a socket to summon through, and a signed edge to present", () => {
    expect(dataDir).not.toBe("");
    expect(edge?.deviceVerifyingKey).toBe(joineeKey);
  });

  test("V1 — a licensed edge seats the joinee AND re-grants the hearth's standing bags", async () => {
    const g = await summon({ contactCard: joineeCard, deviceEdge: edge });
    expect(g["admitted"]).toBe(true);
    expect(typeof g["founderCard"]).toBe("string");
    const rec = await recordedGrant(g);
    expect(rec.reKeyed).toBe(true);
    // THE VECTOR THAT CANNOT BE INFERRED — a seat that re-grants nothing reaches nothing.
    expect(rec.regranted).toBeGreaterThan(0);
  }, 120_000);

  test("V2 — a repeat hands the seat back and moves no epoch", async () => {
    const g = await summon({ contactCard: joineeCard, deviceEdge: edge });
    expect(g["admitted"]).toBe(true);
    // Events still flow (the record's own `capEvents.length > 0`), and that is membership rather than recovery:
    // a vessel whose store was wiped mints fresh prekeys and opens none of the group's sealed material from
    // these. Its keel is the archive.
    const rec = await recordedGrant(g);
    expect(rec.reKeyed).toBe(false);
    expect(rec.regranted).toBe(0);
  }, 120_000);

  test("V3 — force re-keys a seated device and re-grants again", async () => {
    const g = await summon({ contactCard: joineeCard, deviceEdge: edge, force: true });
    expect(g["admitted"]).toBe(true);
    const rec = await recordedGrant(g);
    expect(rec.reKeyed).toBe(true);
    expect(rec.regranted).toBeGreaterThan(0);
  }, 120_000);

  test("V5 — a hearth refuses to seat ITSELF, so one summons never draws two writers", async () => {
    // A summons rides the daemon doc, and the daemon doc fleet-syncs across the operator's own devices — so the joinee's own
    // island sees it too, runs this same verb over the same group under the same root, and would pass its own
    // gate. Two writers racing to seat one member and re-key one group. The joinee knows itself by the key it
    // just presented, and stands down.
    const ownKey = /gate=([0-9a-f]{64})/.exec(lar.bootLog())?.[1]
      ?? /this leaf's key: 0x([0-9a-f]{64})/.exec(lar.bootLog())?.[1] ?? "";
    expect(ownKey).not.toBe("");
    const selfEdge = { ...(edge as DeviceDelegationTiddler), deviceVerifyingKey: ownKey, deviceDid: `0x${ownKey}` };
    const g = await summon({ contactCard: joineeCard, deviceEdge: selfEdge });
    expect(g["admitted"]).toBe(false);
    expect(g["self"]).toBe(true);
  }, 120_000);

  test("V4 — an edge signed by another root refuses, with a reason worth painting", async () => {
    const foreign = { ...(edge as DeviceDelegationTiddler), personaRootDid: `0x${"1".repeat(64)}` };
    const g = await summon({ contactCard: joineeCard, deviceEdge: foreign });
    expect(g["admitted"]).toBe(false);
    expect(String(g["reason"])).toMatch(/pinned root|edge refused/i);
  }, 120_000);
});
