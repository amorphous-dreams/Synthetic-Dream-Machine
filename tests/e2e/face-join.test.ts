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
 *   V2 — a repeat of the same summons hands V1's act back: the operation replays its outcome, and no epoch moves
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
import { plainField, plainRecordOrNull } from "../../packages/lararium-mesh/src/stored-value.js";
import { DEVICE_DELEGATION_SELF_TIDDLER } from "../../packages/lararium-mesh/src/lar-uris.js";
import { invokeLocal } from "../../packages/lares-cli/src/local-connector.js";
import { countersignDeviceDelegation, type DeviceDelegationRootHalf, type DeviceDelegationTiddler } from "../../packages/lararium-mesh/src/device-delegation.js";
import { composeFleetJoinRequest, fleetJoinSealPair, readFleetJoinOffer } from "../../packages/lararium-mesh/src/fleet-join.js";
import { mintVesselFaceKey } from "../../packages/lararium-mesh/src/face-authority.js";
import { createPrivateKey, sign as edSign } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let lar: LarInstance;
let dataDir = "";
let joineeCard = "";
let joineeKey = "";
let edge: DeviceDelegationTiddler | null = null;
let courier = "";
/** V1's whole outcome and its record: V2 is a replay of the same summons and must hand the same act back. */
let v1Outcome: Record<string, unknown> | null = null;
let v1Record: FaceGrantRecord | null = null;

/** An Ed25519 signature under a raw 32-byte seed, through node's own key door (PKCS#8 wraps the seed). */
function signUnder(seed: Uint8Array, image: Uint8Array): Uint8Array {
  const key = createPrivateKey({ key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), seed]), format: "der", type: "pkcs8" });
  return new Uint8Array(edSign(null, image, key));
}

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
      const planeUrl = plainField(cat.doc()?.tiddlers?.[personaBagIdFor(group)] as never, "text") as string | undefined;
      if (!planeUrl) { why = `the catalog names no plane for ${personaBagIdFor(group)}`; }
      else {
        const plane = await repo.find<PlaneDoc>(planeUrl as AutomergeUrl);
        const missing = heads.filter((h) => plane.metadata(h) === undefined);
        if (missing.length > 0) throw new Error(`${missing.length} of ${heads.length} head(s) not yet in the stored history`);
        const row = plane.view(heads).doc()?.tiddlers?.[title];
        const text = row && !row.meta?.deleted ? plainField(row as never, "text") : undefined;
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
  // Nor does the founder's edge it carries: the lease is the edge's only decay.
  expect(Object.keys(rec!.founderEdge).filter((k) => /^(issuedAt|expiresAt)$/.test(k)), "the founder's edge carries a wall-clock stamp").toEqual([]);
  const verdict = await verifyFaceGrantRecord(rec, {
    personaRootDid: (edge as DeviceDelegationTiddler).personaRootDid, selfVerifyingKey: joineeKey, groupId: rec!.groupId,
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

/** The key this hearth's own face signs under, read off its daemon doc: the delegate of its own device edge (its atom). */
async function ownAtomKey(): Promise<string> {
  const daemonUrl = bootDocUrl(lar, "daemon");
  if (!daemonUrl) throw new Error("the boot log names no daemon doc");
  const repo = new Repo({ storage: new NodeFSStorageAdapter(vesselStorageDir(lar)) });
  try {
    const handle = await repo.find<PlaneDoc>(daemonUrl as AutomergeUrl);
    const record = plainRecordOrNull(handle.doc()?.tiddlers?.[DEVICE_DELEGATION_SELF_TIDDLER] as never);
    const delegate = (record?.tiddler as { deviceVerifyingKey?: string } | undefined)?.deviceVerifyingKey;
    if (!delegate) throw new Error("the hearth's daemon doc names no device edge of its own");
    return delegate;
  } finally { await repo.shutdown().catch(() => {}); }
}

beforeAll(async () => {
  lar = await targetInstance();
  // THE ROOT IS THE ANSWER, and the connector re-derives the socket from it. A hunt for a file named
  // `lares.sock` under the root found nothing — the rendezvous stands at
  // `/tmp/lares-<uid>/<root-digest>.sock` — and every vector below then failed on an empty string,
  // reading as a broken join ceremony the run never reached.
  dataDir = (await awaitRendezvous(lar)) ? vesselStorageDir(lar) : "";

  // A THROWAWAY vessel stands its own keyhive and offers its own card — the joinee half, never this hearth's.
  const seed = new Uint8Array(32).fill(88);
  const p = new KeyhiveProvider();
  await p.init({ seed, eventStore: { put: async () => {}, list: async () => [] } });
  joineeKey  = (await p.whoami()).replace(/^0x/, "");
  joineeCard = new TextDecoder().decode(await p.contactCard());

  // The hearth's OWN root signs the edge that licenses it, through the fleet-join door: the hearth offers, the
  // throwaway joinee requests under its own key (its face-scoped keys rest in this process alone), the hearth answers.
  courier = mkdtempSync(join(tmpdir(), "lares-face-join-courier-"));
  const files = { offer: join(courier, "offer.json"), request: join(courier, "request.json"), answer: join(courier, "answer.json") };
  const offered = await lar.cli(["fleet", "join", "offer", "--out", files.offer]);
  if (offered.code !== 0) throw new Error(`fleet join offer failed (${offered.code})\n${offered.stderr.slice(-800)}`);
  const offer = readFleetJoinOffer(JSON.parse(readFileSync(files.offer, "utf8")));
  if ("refusal" in offer) throw new Error(`the hearth's offer refuses: ${offer.refusal}`);
  const faceKeys = new Map<string, Uint8Array>();
  const request = await composeFleetJoinRequest({
    offer, atomKey: joineeKey, sealKey: fleetJoinSealPair().key,
    mintFaceKey: async () => { const m = await mintVesselFaceKey(); faceKeys.set(m.publicKey, m.secret); return m.publicKey; },
    custody: { signAsVesselFace: async (_scope, key, image) => signUnder(faceKeys.get(key)!, image) },
    sign: async (image) => Buffer.from(signUnder(seed, image)).toString("hex"),
  });
  if ("refusal" in request) throw new Error(`the joinee's request refuses: ${request.refusal}`);
  writeFileSync(files.request, JSON.stringify(request));
  const answered = await lar.cli(["fleet", "join", "answer", files.request, "--out", files.answer]);
  if (answered.code !== 0) throw new Error(`fleet join answer failed (${answered.code})\n${answered.stderr.slice(-800)}`);
  // The answer carries the root's half; the joinee countersigns it with its own atom, as a landing does.
  const half = (JSON.parse(readFileSync(files.answer, "utf8")) as { edge?: { deviceEdge?: DeviceDelegationRootHalf } }).edge?.deviceEdge ?? null;
  edge = half ? await countersignDeviceDelegation(half, async (image) => Buffer.from(signUnder(seed, image)).toString("hex")) : null;
}, 240_000);

afterAll(async () => { await lar?.stop(); if (courier) rmSync(courier, { recursive: true, force: true }); });

describe("e2e/face-join — the join against a live hearth", () => {
  test("the rig stands: a socket to summon through, and a signed edge to present", () => {
    expect(dataDir).not.toBe("");
    expect(edge?.deviceVerifyingKey).toBe(joineeKey);
  });

  test("V1 — a licensed edge seats the joinee in the hearth's PersonaGroup", async () => {
    const g = await summon({ contactCard: joineeCard, deviceEdge: edge });
    expect(g["admitted"]).toBe(true);
    expect(typeof g["founderCard"]).toBe("string");
    const rec = await recordedGrant(g);
    // The seat moved the group: a Keyhive group carries the seat into every bag it reaches, with no re-grant.
    expect(rec.reKeyed).toBe(true);
    v1Outcome = g; v1Record = rec;
  }, 120_000);

  test("V2 — a repeat of the same summons hands V1's act back and moves no epoch", async () => {
    expect(v1Outcome, "V1 runs first").not.toBeNull();
    const g = await summon({ contactCard: joineeCard, deviceEdge: edge });
    expect(g["admitted"]).toBe(true);
    // The operation is keyed by the summons' bytes: an identical summons replays the complete outcome it already
    // issued, so the record it names IS V1's (and says `reKeyed: true`, V1's own word). Nothing moved: the same
    // record id and plane heads, the same cap events, no further seat and no further seal.
    expect(g, "an identical summons answers the very outcome V1 returned").toEqual(v1Outcome);
    const rec = await recordedGrant(g);
    expect(rec, "the record at the title is V1's, byte for byte").toEqual(v1Record);
    expect(rec.capEvents).toEqual(v1Record!.capEvents);
    expect(rec.reSealed).toEqual(v1Record!.reSealed);
  }, 120_000);

  test("V3 — force re-keys a seated device", async () => {
    const g = await summon({ contactCard: joineeCard, deviceEdge: edge, force: true });
    expect(g["admitted"]).toBe(true);
    const rec = await recordedGrant(g);
    expect(rec.reKeyed).toBe(true);
  }, 120_000);

  test("V5 — a hearth refuses to seat ITSELF, so one summons never draws two writers", async () => {
    // A summons rides the daemon doc, and the daemon doc fleet-syncs across the operator's own devices — so the joinee's own
    // island sees it too, runs this same verb over the same group under the same root, and would pass its own
    // gate. Two writers racing to seat one member and re-key one group. The joinee knows itself by the key it
    // just presented, and stands down.
    // The verb knows itself by its own device edge's delegate, which is this hearth's face atom (not the place key).
    const ownKey = await ownAtomKey();
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
