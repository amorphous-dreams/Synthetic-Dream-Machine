/**
 * face-anchor — the sealed identity anchor. Reds: a forged selector, a coherent valid foreign bundle and a
 * missing anchor each refuse by name; the frontier never falls. Controls: the pinned face passes; a raise lifts.
 */
import { describe, expect, test } from "vitest";
import { checkFacePins, leaseEpochUnderAnchor, mintFaceAnchor, raiseFaceFrontier, readFaceAnchor } from "../src/face-anchor.js";

const edge = { deviceVerifyingKey: "aa", boundEpoch: 3 };
const mine = { personaGroup: "g-mine", personaKelPrefix: "kel-mine", personaRootDid: "did:key:root-mine", edge, leaseEpoch: 3 };
const anchor = mintFaceAnchor(mine);

describe("face-anchor", () => {
  test("CONTROL: the pinned face passes every check, and the row round-trips", () => {
    expect(checkFacePins(anchor, { personaGroup: "g-mine", personaKelPrefix: "kel-mine", personaRootDid: "did:key:root-mine", edge })).toEqual({ ok: true });
    expect(readFaceAnchor(JSON.parse(JSON.stringify(anchor)))).toEqual(anchor);
  });

  test("RED: a missing anchor refuses by name", () => {
    expect(checkFacePins(null, { personaGroup: "g-mine" })).toEqual({ ok: false, refusal: "anchor-missing" });
  });

  test("RED: a forged selector row names another group or prefix and switches no pinned face", () => {
    expect(checkFacePins(anchor, { personaGroup: "g-other" })).toEqual({ ok: false, refusal: "group" });
    expect(checkFacePins(anchor, { personaGroup: "g-mine", personaKelPrefix: "kel-other" })).toEqual({ ok: false, refusal: "kel-prefix" });
  });

  test("RED: a coherent valid foreign bundle (its own group, prefix, root and edge) is refused", () => {
    const foreign = { personaGroup: "g-other", personaKelPrefix: "kel-other", personaRootDid: "did:key:root-other", edge: { deviceVerifyingKey: "bb", boundEpoch: 9 } };
    expect(checkFacePins(anchor, foreign).ok).toBe(false);
    // even with the selectors forged to match, the root and edge still name another face
    expect(checkFacePins(anchor, { ...foreign, personaGroup: "g-mine", personaKelPrefix: "kel-mine" })).toEqual({ ok: false, refusal: "root" });
    expect(checkFacePins(anchor, { personaGroup: "g-mine", personaKelPrefix: "kel-mine", personaRootDid: "did:key:root-mine", edge: foreign.edge })).toEqual({ ok: false, refusal: "edge" });
  });

  test("RED: the frontier never falls: a stale or replayed observation lowers nothing", () => {
    const raised = raiseFaceFrontier(anchor, { leaseEpoch: 7, actSeq: 2, actCid: "c2" });
    expect(raised.frontier).toEqual({ leaseEpoch: 7, actSeq: 2, actCid: "c2" });
    expect(raiseFaceFrontier(raised, { leaseEpoch: 3, actSeq: 0, actCid: "c0" })).toBe(raised);
    expect(raiseFaceFrontier(raised, {})).toBe(raised);
    expect(leaseEpochUnderAnchor(raised, 3)).toEqual({ epoch: 7, refusal: "frontier-falls" });
    expect(leaseEpochUnderAnchor(raised, 8)).toEqual({ epoch: 8, refusal: null });
  });

  test("a torn row reads null, never a partial anchor", () => {
    expect(readFaceAnchor({ ...anchor, frontier: { leaseEpoch: -1, actSeq: -1, actCid: null } })).toBeNull();
    expect(readFaceAnchor({ ...anchor, frontier: { leaseEpoch: 1, actSeq: 0, actCid: null } })).toBeNull();
    expect(readFaceAnchor(null)).toBeNull();
  });
});

// ── A RECOVERY THAT ROTATES THE ROOT REWRITES THE ANCHOR ────────────────────────────────────────
import * as ed from "@noble/ed25519";
import { hex } from "../src/crypto.js";
import { emptyLarDoc } from "../src/base-doc.js";
import { writePersonaKelEvent, personaKelChainForPrefix } from "../src/persona-kel-board.js";
import { provisionThresholdRecoveryAtFounding, attestAndRotate } from "../src/recovery-keel-core.js";
import { guardianRecoveryRegistrationCard } from "../src/recovery-registration.js";
import { reanchorAfterRotation } from "../src/face-anchor.js";

describe("face-anchor: a face recovered to a new root", () => {
  const pubOf = (s: Uint8Array) => ed.getPublicKeyAsync(s).then(hex);
  const didOf = async (s: Uint8Array) => `0x${await pubOf(s)}`;
  const seeds = { opA: new Uint8Array(32).fill(11), opB: new Uint8Array(32).fill(22), g1: new Uint8Array(32).fill(1), g2: new Uint8Array(32).fill(2), g3: new Uint8Array(32).fill(3) };
  const signer = async (s: Uint8Array) => ({ signer: await pubOf(s), sign: async (b: Uint8Array) => hex(await ed.signAsync(b, s)) });

  async function rotated() {
    const keys = await Promise.all([pubOf(seeds.g1), pubOf(seeds.g2), pubOf(seeds.g3)]);
    const slots = ["mine", "guardian-a", "guardian-b"] as const;
    const prov = provisionThresholdRecoveryAtFounding({
      foundingOpKeyDid: await didOf(seeds.opA),
      guardians: keys.map((k, i) => guardianRecoveryRegistrationCard(slots[i]!, k, null)), recoveryThreshold: 2,
    });
    const rot = await attestAndRotate({
      head: prov.inception, freshOpKeyDid: await didOf(seeds.opB), guardianRecoveryKeys: keys, recoveryThreshold: prov.recoveryThreshold,
      guardianSigners: await Promise.all([signer(seeds.g1), signer(seeds.g2)]),
    });
    if (!rot.ok) throw new Error("fixture rotation refused");
    const doc = emptyLarDoc();
    writePersonaKelEvent(doc, prov.inception); writePersonaKelEvent(doc, rot.event);
    return { prov, chain: personaKelChainForPrefix(doc, prov.inception.prefix)!, oldDid: await didOf(seeds.opA), newDid: await didOf(seeds.opB) };
  }

  test("RED: a root rotated beneath the same prefix rewrites the anchor, the group and frontier staying", async () => {
    const { prov, chain, oldDid, newDid } = await rotated();
    const old = raiseFaceFrontier(mintFaceAnchor({ personaGroup: "g-mine", personaKelPrefix: prov.inception.prefix, personaRootDid: oldDid, edge: { e: 1 }, leaseEpoch: 3 }), { leaseEpoch: 6, actSeq: 4, actCid: "c4" });
    const newEdge = { e: 2 };
    const r = await reanchorAfterRotation(old, { chain, personaRootDid: newDid, edge: newEdge });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(checkFacePins(r.anchor, { personaGroup: "g-mine", personaKelPrefix: prov.inception.prefix, personaRootDid: newDid, edge: newEdge })).toEqual({ ok: true });
    expect(checkFacePins(r.anchor, { personaRootDid: oldDid })).toEqual({ ok: false, refusal: "root" });
    expect(r.anchor.frontier).toEqual(old.frontier);
    expect(r.anchor.personaGroup).toBe("g-mine");
  });

  test("CONTROL: a document naming the new root with no KEL rotation behind it refuses; so do a stranger's chain and the unchanged root", async () => {
    const { prov, chain, oldDid, newDid } = await rotated();
    const a = mintFaceAnchor({ personaGroup: "g-mine", personaKelPrefix: prov.inception.prefix, personaRootDid: oldDid, edge: { e: 1 }, leaseEpoch: 0 });
    expect(await reanchorAfterRotation(a, { chain: chain.slice(0, 1), personaRootDid: newDid, edge: {} })).toEqual({ ok: false, refusal: "not-head" });
    expect(await reanchorAfterRotation(a, { chain, personaRootDid: "0x" + "ab".repeat(32), edge: {} })).toEqual({ ok: false, refusal: "not-head" });
    expect(await reanchorAfterRotation({ ...a, personaKelPrefix: "kel-other" }, { chain, personaRootDid: newDid, edge: {} })).toEqual({ ok: false, refusal: "prefix" });
    expect(await reanchorAfterRotation(a, { chain: chain.slice(0, 1), personaRootDid: oldDid, edge: {} })).toEqual({ ok: false, refusal: "no-rotation" });
  });
});
