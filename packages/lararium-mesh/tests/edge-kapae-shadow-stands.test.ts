/**
 * edge-kapae — a contested shadow STANDS, at the fold and at each reader that decides standing.
 *
 * The law (`kapae#law`): a raised kāpae wins remove-wins under contention, and lowering takes a deliberate
 * gesture that writes its own record. So only ONE reading lifts a shadow: every causal head on the edge reads
 * as a lower. A raise beside a lower with no causal order between them, a branch whose ancestry never
 * arrived, and a frontier that fails its own identity check each leave the shadow UP.
 *
 * Each vector carries a control: a lower that causally FOLLOWS the raise still lifts, so the rule fences the
 * contest and never freezes the marker.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/kapae
 */
import { DYAD_ID_DOMAIN } from "../src/domains.js";
import { describe, expect, test } from "vitest";
import * as ed from "@noble/ed25519";
import {
  signEdgeKapae, foldEdgeKapaeVerdicts, foldEdgeKapae, verifiedShadowSet, shadowSetFromBoard,
  writeEdgeKapae, emptyLarDoc, mutableLarRecord,
  dyadId, signDyadBinding, verifiedFleetOfGroup,
  signCabalInvite, writeVouch, verifiedVouchesFromBoard, vouchEdgeId,
  type DyadRecord, type EdgeKapae, type LarDoc, type CabalInvite,
} from "../src/index.js";
import * as mesh from "../src/index.js";
import { hex, hexToBytes } from "../src/crypto.js";
import type { DeviceDelegationTiddler } from "../src/device-delegation.js";

const A = new Uint8Array(32).fill(21), B = new Uint8Array(32).fill(22), MALLORY = new Uint8Array(32).fill(23);
const EPOCH = "charter-a";
const sign = (seed: Uint8Array) => (bytes: Uint8Array) => ed.signAsync(bytes, seed).then(hex);
const pub  = (seed: Uint8Array) => ed.getPublicKeyAsync(seed).then(hex);
const verify = (bytes: Uint8Array, sig: string, did: string) =>
  ed.verifyAsync(hexToBytes(sig), bytes, hexToBytes(did)).catch(() => false);
const act = (edgeId: string, raised: boolean, parents: string[] = [], seed = A, epochCid = EPOCH) =>
  signEdgeKapae({ edgeId, raised, parents, epochCid }, sign(seed));
const boardOf = (acts: readonly EdgeKapae[]): LarDoc => { const d = emptyLarDoc(); for (const a of acts) writeEdgeKapae(d, a); return d; };

describe("the fold — only a causal lower lifts", () => {
  test("★ a raise beside a concurrent lower leaves the shadow UP, in either arrival order ★", async () => {
    const up = await act("edge", true), down = await act("edge", false);
    expect(foldEdgeKapaeVerdicts([up, down]).get("edge")).toBe("unsettled");   // the contest still SURFACES
    expect(foldEdgeKapae([up, down]).has("edge")).toBe(true);
    expect(foldEdgeKapae([down, up]).has("edge")).toBe(true);
    const authority = await pub(A);
    expect((await verifiedShadowSet([down, up], () => authority, verify)).has("edge")).toBe(true);
    expect((await verifiedShadowSet([down, up], () => undefined, verify)).has("edge")).toBe(false);   // CONTROL: no known authority → no act → ABSENT
  });

  test("CONTROL — a lower that causally FOLLOWS the raise lifts", async () => {
    const up = await act("edge", true), down = await act("edge", false, [up.actCid]);
    expect(foldEdgeKapaeVerdicts([up, down]).get("edge")).toBe("withdrawn");
    expect(foldEdgeKapae([up, down]).has("edge")).toBe(false);
  });

  test("a lower citing BOTH contested heads settles the contest — a deliberate later hand, never the fold", async () => {
    const up = await act("edge", true), down = await act("edge", false);
    const settle = await act("edge", false, [up.actCid, down.actCid]);
    expect(foldEdgeKapae([up, down, settle]).has("edge")).toBe(false);
    const keep = await act("edge", true, [up.actCid, down.actCid]);
    expect(foldEdgeKapae([up, down, keep]).has("edge")).toBe(true);
  });

  test("★ a branch whose parent never arrived leaves the shadow UP — a missing parent never lifts ★", async () => {
    const up = await act("edge", true);
    const down = await act("edge", false, [up.actCid]);
    const again = await act("edge", true, [down.actCid]);
    // The reader holds the first raise and the re-raise; the lower between them never arrived.
    expect(foldEdgeKapaeVerdicts([up, again]).get("edge")).toBe("unavailable");
    expect(foldEdgeKapae([up, again]).has("edge")).toBe(true);
    // A lone lower whose parent never arrived proves no lift either: its ancestry stays unread.
    expect(foldEdgeKapae([down]).has("edge")).toBe(true);
    // CONTROL: the whole chain present reads by its head.
    expect(foldEdgeKapae([up, down]).has("edge")).toBe(false);
    expect(foldEdgeKapae([up, down, again]).has("edge")).toBe(true);
  });

  test("a frontier that fails its own identity check leaves the shadow UP at the bare fold", async () => {
    const up = await act("edge", true);
    const relabeled = { ...up, actCid: "sha256:relabeled" };
    expect(foldEdgeKapaeVerdicts([up, relabeled]).get("edge")).toBe("rejected");
    expect(foldEdgeKapae([up, relabeled]).has("edge")).toBe(true);
  });

  test("an edge nobody acted on reads ABSENT — the fold shadows nothing it never saw", async () => {
    const up = await act("edge", true);
    expect(foldEdgeKapae([up]).has("other-edge")).toBe(false);
    expect(foldEdgeKapae([])).toEqual(new Set());
  });
});

describe("the verifying fold — a forged act neither lifts nor raises", () => {
  test("a lower signed by a hand that holds no authority never lifts", async () => {
    const authority = await pub(A);
    const up = await act("edge", true);
    const forged = await act("edge", false, [up.actCid], MALLORY);
    expect(await verifiedShadowSet([up, forged], () => authority, verify)).toEqual(new Set(["edge"]));
  });

  test("★ a RELABELED copy of the authority's own raise never lifts — the signature binds no act id ★", async () => {
    const authority = await pub(A);
    const up = await act("edge", true);
    // Any hand able to write the board can copy a signed act under another act id: the signature still verifies.
    const relabeled: EdgeKapae = { ...up, actCid: "sha256:relabeled" };
    expect(await verify(mesh.edgeKapaeBytes(relabeled), relabeled.sig, authority)).toBe(true);
    expect(await verifiedShadowSet([up, relabeled], () => authority, verify)).toEqual(new Set(["edge"]));
    expect(await shadowSetFromBoard(boardOf([up, relabeled]), () => authority, verify)).toEqual(new Set(["edge"]));
  });

  test("CONTROL — a relabeled copy of a real lower never re-raises a withdrawn shadow", async () => {
    const authority = await pub(A);
    const up = await act("edge", true), down = await act("edge", false, [up.actCid]);
    const relabeled: EdgeKapae = { ...down, actCid: "sha256:relabeled" };
    expect(await verifiedShadowSet([up, down, relabeled], () => authority, verify)).toEqual(new Set());
  });

  test("the verdict map rides beside the set, so a reader may SURFACE the contest", async () => {
    const authority = await pub(A);
    const up = await act("contested", true), down = await act("contested", false);
    const held = await act("held", true);
    const r = await act("lifted", true), l = await act("lifted", false, [r.actCid]);
    const verdicts = await mesh.edgeKapaeVerdictsFromBoard(boardOf([up, down, held, r, l]), () => authority, verify);
    expect(Object.fromEntries(verdicts)).toEqual({ contested: "unsettled", held: "held", lifted: "withdrawn" });
    expect([...verdicts].filter(([, v]) => mesh.edgeShadowStands(v)).map(([e]) => e).sort()).toEqual(["contested", "held"]);
    expect(mesh.edgeShadowStands(undefined)).toBe(false);                    // ABSENT never shadows
    expect(mesh.edgeShadowStands("withdrawn")).toBe(false);
    for (const v of ["held", "unsettled", "unavailable", "rejected"] as const) expect(mesh.edgeShadowStands(v)).toBe(true);
  });
});

describe("mutual removal — both shadows hold, both stand aside, and no winner gets picked", () => {
  test("★ A shadows (B → group) while B shadows (A → group): both edges read shadowed, each under the OTHER hand ★", async () => {
    const keyA = await pub(A), keyB = await pub(B);
    const authorityFor = (edge: string) => edge === "A→group" ? keyB : edge === "B→group" ? keyA : undefined;
    const bOutsA = await act("A→group", true, [], B);
    const aOutsB = await act("B→group", true, [], A);
    // Each also tries to lift the shadow over ITSELF — a hand that holds no authority over its own edge.
    const aSelfLift = await act("A→group", false, [bOutsA.actCid], A);
    const bSelfLift = await act("B→group", false, [aOutsB.actCid], B);
    const acts = [bOutsA, aOutsB, aSelfLift, bSelfLift];
    expect(await verifiedShadowSet(acts, authorityFor, verify)).toEqual(new Set(["A→group", "B→group"]));
    // No arrival order picks a winner.
    expect(await verifiedShadowSet([...acts].reverse(), authorityFor, verify)).toEqual(new Set(["A→group", "B→group"]));
  });

  test("★ a partitioned concurrent lower on each edge still leaves BOTH shadowed, and the map names the fork ★", async () => {
    const keyA = await pub(A), keyB = await pub(B);
    const authorityFor = (edge: string) => edge === "A→group" ? keyB : edge === "B→group" ? keyA : undefined;
    const acts = [
      await act("A→group", true, [], B), await act("A→group", false, [], B),
      await act("B→group", true, [], A), await act("B→group", false, [], A),
    ];
    expect(await verifiedShadowSet(acts, authorityFor, verify)).toEqual(new Set(["A→group", "B→group"]));
    const verdicts = await mesh.verifiedEdgeKapaeVerdicts(acts, authorityFor, verify);
    expect(Object.fromEntries(verdicts)).toEqual({ "A→group": "unsettled", "B→group": "unsettled" });
  });
});

// ── The two readers that decide standing, each fed from a BOARD rather than a hand-built set ─────────────────

const VESSEL_1 = "0xaa".padEnd(66, "1"), VESSEL_2 = "0xbb".padEnd(66, "2");
const VEIL_1 = "0xcc".padEnd(66, "3"), VEIL_2 = "0xdd".padEnd(66, "4");

async function dyad(vessel: string, veil: string, rootSeed: Uint8Array): Promise<DyadRecord> {
  const ref = { vesselDid: vessel, veilDid: veil };
  const edge: DeviceDelegationTiddler = {
    kind: "device-delegation", personaRootDid: veil, deviceDid: vessel,
    deviceVerifyingKey: vessel.slice(2), hearthTrueName: "bafyHearth", boundEpoch: "0", signature: "00".repeat(128),
  };
  return { kind: DYAD_ID_DOMAIN, dyadId: dyadId(ref), ref, edge, binding: await signDyadBinding(ref, await pub(rootSeed), EPOCH, sign(rootSeed)) };
}

describe("the fleet closure reads the board's shadow", () => {
  test("★ a contested dyad stands aside; a causally lifted one stands again ★", async () => {
    const root = await pub(A);
    const one = await dyad(VESSEL_1, VEIL_1, A), two = await dyad(VESSEL_2, VEIL_2, A);
    const up = await act(one.dyadId, true), racing = await act(one.dyadId, false);
    const authorityFor = () => root;

    const contested = await shadowSetFromBoard(boardOf([up, racing]), authorityFor, verify);
    expect((await verifiedFleetOfGroup([one, two], root, contested)).map((d) => d.dyadId)).toEqual([two.dyadId]);

    // CONTROL: order by causality still lifts.
    const lifted = await shadowSetFromBoard(boardOf([up, await act(one.dyadId, false, [up.actCid])]), authorityFor, verify);
    expect(await verifiedFleetOfGroup([one, two], root, lifted)).toHaveLength(2);
  });

  test("mutual removal empties the fleet without a throw — no authority stands, and the caller reads that", async () => {
    const root = await pub(A);
    const one = await dyad(VESSEL_1, VEIL_1, A), two = await dyad(VESSEL_2, VEIL_2, A);
    const shadowed = await shadowSetFromBoard(boardOf([await act(one.dyadId, true), await act(two.dyadId, true)]), () => root, verify);
    await expect(verifiedFleetOfGroup([one, two], root, shadowed)).resolves.toEqual([]);
  });
});

describe("the vouch-lineage read reads the board's shadow", () => {
  const REALM = "a".repeat(64);
  const vouch = async (seed: Uint8Array, joiner: string): Promise<CabalInvite> => signCabalInvite(
    { realmDocIdHex: REALM, joinerIdentityHex: joiner, voucherDid: await pub(seed), boundEpoch: "0" }, sign(seed));
  const vouchBoard = (invites: readonly CabalInvite[]): LarDoc => { const d = emptyLarDoc(); for (const i of invites) writeVouch(d, i); return d; };

  test("★ a contested vouch leaves the lineage; a causally lifted one returns ★", async () => {
    const kept = await vouch(A, "b".repeat(64)), gone = await vouch(A, "c".repeat(64));
    const edge = vouchEdgeId(gone);
    const authorityFor = (id: string) => id === edge ? gone.voucherDid : undefined;
    const up = await act(edge, true), racing = await act(edge, false);

    const contested = await shadowSetFromBoard(boardOf([up, racing]), authorityFor, verify);
    expect((await verifiedVouchesFromBoard(vouchBoard([kept, gone]), REALM, verify, contested)).map((i) => i.joinerIdentityHex))
      .toEqual([kept.joinerIdentityHex]);

    const lifted = await shadowSetFromBoard(boardOf([up, await act(edge, false, [up.actCid])]), authorityFor, verify);
    expect(await verifiedVouchesFromBoard(vouchBoard([kept, gone]), REALM, verify, lifted)).toHaveLength(2);
  });

  test("a torn tiddler on the shadow board changes nothing", async () => {
    const gone = await vouch(A, "c".repeat(64));
    const edge = vouchEdgeId(gone);
    const board = boardOf([await act(edge, true), await act(edge, false)]);
    board.tiddlers["torn"] = mutableLarRecord("torn", { text: "not-json" }, "test");
    expect(await shadowSetFromBoard(board, () => gone.voucherDid, verify)).toEqual(new Set([edge]));
  });
});
