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
 * to the PersonaGroup plane, and the outcome NAMES it without carrying it: `recordTitle`, `recordCid` (tagged
 * sha256 over the record's canonical bytes) and `recordHeads` (the plane's heads just after the write). V1–V3 read
 * THAT record off the vessel's own storage through a throwaway repo: the catalog names the plane, and the read
 * waits CAUSALLY — until the stored plane's history holds `recordHeads` — then reads the record AS OF those heads,
 * so a later join's overwrite never answers for an earlier one. The record must verify under the root that
 * signed the joinee's edge, and its recomputed CID must equal `recordCid`. The view is held to the record as a
 * CONTROL: its digest and count match the record's array, or, unbounded, its array equals the record's.
 *
 * None of these vectors asserts RECOVERY. A summons returns a seat and public ops, never prekey secrets, so a
 * vessel that lost its store restores from its archive; the pair test holds that boundary.
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { Repo, type AutomergeUrl, type UrlHeads } from "@automerge/automerge-repo";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import { targetInstance, type LarInstance, awaitRendezvous, vesselStorageDir, bootDocUrl } from "../harness/instance.js";
import { KeyhiveProvider } from "../../packages/lararium-keyhive/src/keyhive-provider.js";
import {
  verifyFaceGrantRecord, faceGrantRecordCid, faceGrantTitle, FACE_GRANT_PREFIX, type FaceGrantRecord,
} from "../../packages/lararium-keyhive/src/face-grant-record.js";
import { canonicalJsonBytes, sha256HexBytesSync } from "../../packages/lararium-mesh/src/crypto.js";
import { personaBagIdFor } from "../../packages/lararium-mesh/src/persona-scope.js";
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

type PlaneDoc = { tiddlers?: Record<string, { tiddler?: { text?: string }; meta?: { deleted?: boolean } }> };

/**
 * Read the record at `title` off the vessel's OWN storage, as of `heads`, through a throwaway repo.
 *
 * The catalog names the PersonaGroup plane's doc; the stored plane is read only once its history holds every one
 * of `heads` (each a change the stored doc can decode), so the wait is causal: it ends when the write the join
 * reported has reached disk, never on a guessed delay. Each attempt opens a fresh repo, because one repo loads a
 * doc's storage once. The bound guards a hang; the answer is the heads.
 */
async function recordOffPlane(title: string, group: string, heads: UrlHeads): Promise<{ rec: FaceGrantRecord | null; why: string }> {
  const catalogUrl = bootDocUrl(lar, "catalog");
  if (!catalogUrl) return { rec: null, why: "the boot log names no catalog doc" };
  let why = "never attempted";
  for (let attempt = 0; attempt < 60; attempt++) {
    const repo = new Repo({ storage: new NodeFSStorageAdapter(vesselStorageDir(lar)) });
    try {
      const cat = await repo.find<PlaneDoc>(catalogUrl as AutomergeUrl);
      const planeUrl = cat.doc()?.tiddlers?.[personaBagIdFor(group)]?.tiddler?.text;
      if (!planeUrl) { why = `the catalog names no plane for ${personaBagIdFor(group)}`; }
      else {
        const plane = await repo.find<PlaneDoc>(planeUrl as AutomergeUrl);
        const missing = heads.filter((h) => plane.metadata(h) === undefined);
        if (missing.length > 0) throw new Error(`${missing.length} of ${heads.length} head(s) not yet in the stored history`);
        const row = plane.view(heads).doc()?.tiddlers?.[title];
        const text = row && !row.meta?.deleted ? row.tiddler?.text : undefined;
        return { rec: typeof text === "string" ? JSON.parse(text) as FaceGrantRecord : null, why: "read at the reported heads" };
      }
    } catch (err) {
      why = `the stored plane does not yet hold the reported heads (${err instanceof Error ? err.message : String(err)})`;
    } finally {
      await repo.shutdown().catch(() => {});
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return { rec: null, why };
}

/**
 * The grant RECORD a join wrote, read off the PersonaGroup plane as of the heads the join reported, verified, its
 * CID recomputed, and held against the view.
 *
 * Returns the record so a vector asserts on the act. Fails when no record stands, when its CID differs from the
 * outcome's `recordCid`, when its signature fails under the root that signed the joinee's edge, or when the
 * outcome's view disagrees with the record it summarises.
 */
async function recordedGrant(g: Record<string, unknown>): Promise<FaceGrantRecord> {
  const title = String(g["recordTitle"] ?? "");
  expect(title.startsWith(FACE_GRANT_PREFIX), `the join outcome names no record:\n${JSON.stringify(g).slice(0, 600)}`).toBe(true);
  expect(g["recordCid"]).toMatch(/^sha256:[0-9a-f]{64}$/);
  expect(Array.isArray(g["recordHeads"]) && (g["recordHeads"] as unknown[]).length > 0).toBe(true);
  // The outcome carries the act's NAME, never its body.
  expect(g["record"]).toBeUndefined();
  const group = title.slice(FACE_GRANT_PREFIX.length).split("/")[0] ?? "";
  expect(faceGrantTitle(group, String(g["joineeAgentIdHex"]))).toBe(title);
  const { rec, why } = await recordOffPlane(title, group, g["recordHeads"] as UrlHeads);
  expect(rec, `no grant record stands at ${title}: ${why}`).not.toBeNull();
  expect(faceGrantRecordCid(rec!), "the record read off the plane is not the record the outcome names").toBe(g["recordCid"]);
  // The record orders by the plane's history, so it carries no wall-clock stamp.
  expect(rec!, "the grant record carries a wall-clock stamp").not.toHaveProperty("issuedAt");
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
