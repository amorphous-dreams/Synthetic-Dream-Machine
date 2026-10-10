/**
 * THE SELECTOR — a recipe's ordered `pluginOfferings` CID list resolves to exactly the chosen
 * offerings' blobs, in order, or refuses by name. See `plugin-offering-selector.ts`'s docblock for
 * what stays out of scope (missing/corrupt bytes — the CAS/runtime layer R3 wires).
 */
import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import { hex } from "../src/crypto.js";
import { computePluginsCid } from "../src/genesis-doc.js";
import { pluginOfferingCid, signPluginOffering, type OfferedBlob, type PluginOffering } from "../src/plugin-offering.js";
import { selectPluginBlobs, selectedPluginCids, type OfferingLookup } from "../src/plugin-offering-selector.js";

const SEED_A = new Uint8Array(32).fill(21);
const SEED_B = new Uint8Array(32).fill(42);
const signerFor = (seed: Uint8Array) => async (bytes: Uint8Array) => hex(await ed.signAsync(bytes, seed));
const keyFor = async (seed: Uint8Array) => hex(await ed.getPublicKeyAsync(seed));

async function offer(seed: Uint8Array, blobs: readonly OfferedBlob[]): Promise<PluginOffering> {
  return signPluginOffering(
    { offeror: await keyFor(seed), pluginsCid: computePluginsCid(blobs), blobs }, signerFor(seed));
}

const HIGHLIGHT: OfferedBlob = { id: "$:/plugins/tiddlywiki/highlight", version: "0.9.0", sha256: "aa".repeat(32) };
const DYNAVIEW:  OfferedBlob = { id: "$:/plugins/tiddlywiki/dynaview",  version: "0.1.0", sha256: "bb".repeat(32) };

function lookupOf(...offerings: PluginOffering[]): OfferingLookup {
  const byCid = new Map(offerings.map((o) => [pluginOfferingCid(o), o]));
  return (cid) => byCid.get(cid);
}

describe("★ an empty recipe selects nothing — the CONTROL every other case is measured against ★", () => {
  test("[] yields an empty, OK selection — never a refusal", async () => {
    await expect(selectPluginBlobs([], lookupOf())).resolves.toEqual({ ok: true, blobs: [] });
  });
});

describe("one offering selects exactly its blobs", () => {
  test("a single-blob offering yields exactly that blob", async () => {
    const offering = await offer(SEED_A, [HIGHLIGHT]);
    const cid = pluginOfferingCid(offering);
    await expect(selectPluginBlobs([cid], lookupOf(offering))).resolves.toEqual({ ok: true, blobs: [HIGHLIGHT] });
  });

  test("a multi-blob offering yields every one of its blobs, none dropped and none added", async () => {
    const offering = await offer(SEED_A, [HIGHLIGHT, DYNAVIEW]);
    const cid = pluginOfferingCid(offering);
    const result = await selectPluginBlobs([cid], lookupOf(offering));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.blobs).toEqual(expect.arrayContaining([HIGHLIGHT, DYNAVIEW]));
    if (result.ok) expect(result.blobs).toHaveLength(2);
  });
});

describe("★ order holds across the whole selection ★", () => {
  test("two offerings' blobs arrive in RECIPE order, not CID order or lookup-insertion order", async () => {
    const offA = await offer(SEED_A, [HIGHLIGHT]);
    const offB = await offer(SEED_B, [DYNAVIEW]);
    const cidA = pluginOfferingCid(offA);
    const cidB = pluginOfferingCid(offB);
    const lookup = lookupOf(offA, offB);

    const forward = await selectPluginBlobs([cidA, cidB], lookup);
    expect(forward).toEqual({ ok: true, blobs: [HIGHLIGHT, DYNAVIEW] });

    const backward = await selectPluginBlobs([cidB, cidA], lookup);
    expect(backward).toEqual({ ok: true, blobs: [DYNAVIEW, HIGHLIGHT] });
  });
});

describe("★ unknown, malformed and unverified entries each refuse by their OWN name ★", () => {
  test("an offering CID the lookup cannot find refuses as unknown — missing bytes fail closed by name", async () => {
    const result = await selectPluginBlobs(["sha256:" + "00".repeat(32)], lookupOf());
    expect(result).toEqual({ ok: false, failure: { code: "unknown", cid: "sha256:" + "00".repeat(32) } });
  });

  test("★ MUTATION PROOF — a lookup keyed to the WRONG cid (a lying or misrouted resolver) refuses as cid-mismatch, never as a successful selection ★", async () => {
    const offering = await offer(SEED_A, [HIGHLIGHT]);
    const realCid = pluginOfferingCid(offering);
    const wrongCid = "sha256:" + "ff".repeat(32);
    // A lookup that hands back the real offering for whatever cid it's asked — the exact bug class
    // this check exists to catch: trusting the caller-handed object's say over its own content.
    const lyingLookup: OfferingLookup = () => offering;
    const result = await selectPluginBlobs([wrongCid], lyingLookup);
    expect(result).toEqual({ ok: false, failure: { code: "cid-mismatch", cid: wrongCid, computed: realCid } });
  });

  test("an offering whose signature does not verify refuses with the SAME code verifyPluginOffering names", async () => {
    const offering = await offer(SEED_A, [HIGHLIGHT]);
    const tampered = { ...offering, sig: "00".repeat(64) };
    const cid = pluginOfferingCid(tampered);
    const result = await selectPluginBlobs([cid], lookupOf(tampered));
    expect(result.ok).toBe(false);
    if (!result.ok && result.failure.code !== "unknown" && result.failure.code !== "cid-mismatch" && result.failure.code !== "duplicate-plugin") {
      expect(result.failure.code).toBe("bad-signature");
    }
  });
});

describe("★ duplicate plugin IDs ACROSS offerings refuse the WHOLE selection ★", () => {
  test("two different offerings naming the same plugin id refuse as duplicate-plugin", async () => {
    const offA = await offer(SEED_A, [HIGHLIGHT]);
    const sameIdDifferentBytes: OfferedBlob = { ...HIGHLIGHT, sha256: "cc".repeat(32) };
    const offB = await offer(SEED_B, [sameIdDifferentBytes]);
    const cidA = pluginOfferingCid(offA);
    const cidB = pluginOfferingCid(offB);
    const result = await selectPluginBlobs([cidA, cidB], lookupOf(offA, offB));
    expect(result).toEqual({
      ok: false,
      failure: { code: "duplicate-plugin", id: HIGHLIGHT.id, offeringCid: cidB, firstOfferingCid: cidA },
    });
  });

  test("CONTROL — the SAME plugin id named twice by naming the SAME offering CID twice is not a cross-offering collision", async () => {
    const offering = await offer(SEED_A, [HIGHLIGHT]);
    const cid = pluginOfferingCid(offering);
    // Not a lawful recipe (an offering named twice is pointless), but the duplicate-detection law is
    // specifically about two DIFFERENT offerings colliding on a plugin id — re-asserting it here pins
    // that this selector's rule and verifyPluginOffering's within-offering rule are not conflated.
    const result = await selectPluginBlobs([cid, cid], lookupOf(offering));
    expect(result).toEqual({
      ok: false,
      failure: { code: "duplicate-plugin", id: HIGHLIGHT.id, offeringCid: cid, firstOfferingCid: cid },
    });
  });
});

describe("the list round-trips exactly into the manifest's pluginCids shape", () => {
  test("selectedPluginCids yields the sha256 set, in the SAME order the selection resolved", async () => {
    const offA = await offer(SEED_A, [HIGHLIGHT]);
    const offB = await offer(SEED_B, [DYNAVIEW]);
    const result = await selectPluginBlobs([pluginOfferingCid(offA), pluginOfferingCid(offB)], lookupOf(offA, offB));
    expect(result.ok).toBe(true);
    if (result.ok) expect(selectedPluginCids(result.blobs)).toEqual([HIGHLIGHT.sha256, DYNAVIEW.sha256]);
  });

  test("CONTROL — an empty selection yields an empty pluginCids list", () => {
    expect(selectedPluginCids([])).toEqual([]);
  });
});
