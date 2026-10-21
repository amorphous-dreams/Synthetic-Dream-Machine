/**
 * floor-answer.test.ts — W26 slice 4's reader: a vessel holding no charter reads the Nexus's floor off the porch's answer,
 * and every refusal lands BEFORE the floor is used.
 *
 * The reader holds the Nexus AID and nothing else. REDS, each refusing before the floor is used:
 *   · a lineage whose genesis bytes differ from the AID,
 *   · a skipped or forged epoch step,
 *   · a release sealed by a key outside its epoch's roster,
 *   · floor bytes that differ from the CID they were fetched by (the manifest and each snapshot).
 * CONTROL: a full valid answer (a rolled charter, a chain of two releases) reads the head's floor whole.
 */
import { describe, expect, test } from "vitest";
import { sha256HexBytesSync } from "../src/crypto.js";
import { floorManifestBytes, cutFloorSnapshot, type FloorManifest } from "../src/floor-manifest.js";
import { assembleFloorRelease, floorReleaseBodyBytes, floorReleaseCid, openFloorReleaseBody, type FloorRelease } from "../src/floor-release.js";
import { floorAnswerOf, readFloorAnswer } from "../src/floor-answer.js";
import { seatedCharter, uncommittedSuccessor, type SeatedCharter } from "./charter-fixture.js";
import type { LarTiddlerRecord } from "../src/tiddler-store.js";

const row = (title: string, text: string): LarTiddlerRecord => ({ tiddler: { title, text } });

/** A real floor: two snapshots and the manifest naming them, with every blob in one fake CAS. */
function floor(tag: string) {
  const cas = new Map<string, Uint8Array>();
  const put = (bytes: Uint8Array) => { const cid = sha256HexBytesSync(bytes); cas.set(cid, bytes); return cid; };
  const lares = cutFloorSnapshot({ [`lar:///t/${tag}/lares`]: row(`lar:///t/${tag}/lares`, `lares ${tag}`) });
  const lararium = cutFloorSnapshot({ [`lar:///t/${tag}/lararium`]: row(`lar:///t/${tag}/lararium`, `lararium ${tag}`) });
  cas.set(lares.cid, lares.bytes); cas.set(lararium.cid, lararium.bytes);
  const manifest: FloorManifest = { format: "lararium-floor/v1", engine: "e".repeat(64), grammar: "a".repeat(64), plugins: "b".repeat(64), lares: lares.cid, lararium: lararium.cid };
  const manifestBytes = floorManifestBytes(manifest);
  return { cas, manifestBytes, manifestCid: put(manifestBytes), lares, lararium };
}

async function released(c: SeatedCharter, f: ReturnType<typeof floor>, prior: string | null = null, hand = 0): Promise<FloorRelease> {
  const [steward] = await c.signers([hand]);
  return assembleFloorRelease({
    body: openFloorReleaseBody({ nexus: c.aid, epoch: c.head.epochCid, prior, manifest: f.manifestCid }),
    lineage: c.chain, manifestBytes: f.manifestBytes, steward: steward!, approvers: [...await c.signers()],
  });
}
const rowOf = (r: FloorRelease) => ({ keyCid: r.cid, record: r });
const fetchFrom = (cas: Map<string, Uint8Array>) => async (cid: string) => cas.get(cid) ?? null;

describe("a vessel with no charter reads the floor off the porch's answer", () => {
  test("CONTROL: a rolled charter and a chain of two releases read the head's floor whole, and the reader records no acceptance", async () => {
    const c0 = await seatedCharter({ seats: 3, threshold: 2 });
    const c1 = await c0.roll();
    const f1 = floor("one"), f2 = floor("two");
    const cas = new Map([...f1.cas, ...f2.cas]);
    const first = await released(c0, f1);
    const second = await released(c1, f2, first.cid);
    const read = await readFloorAnswer({ nexus: c0.aid, answer: floorAnswerOf(c0.aid, [rowOf(first), rowOf(second)]), fetchCas: fetchFrom(cas) });
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.head.cid).toBe(second.cid);
    expect(read.manifest.lares).toBe(f2.lares.cid);
    expect(Object.keys(read.lares)).toEqual(["lar:///t/two/lares"]);
    expect(Object.keys(read.lararium)).toEqual(["lar:///t/two/lararium"]);
    expect(read.refused).toEqual([]);
  });

  test("RED: a lineage whose genesis bytes differ from the AID refuses before the floor is fetched", async () => {
    const c = await seatedCharter({ seats: 3, threshold: 1 });
    const f = floor("g");
    const good = await released(c, f);
    const edited = { ...good, lineage: [{ ...c.chain[0]!, keySetHash: "0".repeat(64) }] };
    const fetched: string[] = [];
    const read = await readFloorAnswer({ nexus: c.aid, answer: floorAnswerOf(c.aid, [rowOf(edited)]), fetchCas: async (cid) => { fetched.push(cid); return f.cas.get(cid) ?? null; } });
    expect(read).toMatchObject({ ok: false, reason: "lineage-genesis-differs" });
    expect(fetched).not.toContain(f.lares.cid);                                    // the snapshots were never fetched
  });

  test("RED: a forged and a skipped epoch step each refuse; the AID of another Nexus refuses", async () => {
    const c0 = await seatedCharter({ seats: 3, threshold: 1 });
    const c1 = await c0.roll();
    const c2 = await c1.roll();
    const f = floor("steps");
    const stranger = await seatedCharter({ seats: 3, threshold: 1, seed: 9 });
    const forgedEpoch = await uncommittedSuccessor(c0, stranger);
    // Hand-built records whose every other part stands lawful: the body names the epoch, the CID re-derives, the steward
    // seals as a seat of THAT epoch, and the approval stands. Only the lineage lies.
    const handBuilt = async (lineage: SeatedCharter["chain"], epoch: string, author: SeatedCharter) => {
      const body = openFloorReleaseBody({ nexus: c0.aid, epoch, prior: null, manifest: f.manifestCid });
      const base = await released(author, f);
      const [hand] = await author.signers([0]);
      return { ...base, body, cid: floorReleaseCid(body), lineage, seal: { signer: hand!.signer, sig: await hand!.sign(floorReleaseBodyBytes(body)) } } as FloorRelease;
    };
    const forged = await handBuilt([c0.chain[0]!, forgedEpoch], forgedEpoch.epochCid, stranger);
    const skipped = await handBuilt([c2.chain[0]!, c2.chain[2]!], c2.head.epochCid, c2);
    const readOf = (record: FloorRelease) => readFloorAnswer({ nexus: c0.aid, answer: floorAnswerOf(c0.aid, [rowOf(record)]), fetchCas: fetchFrom(f.cas) });
    expect(await readOf(forged)).toMatchObject({ ok: false, reason: "lineage-refused" });
    expect(await readOf(skipped)).toMatchObject({ ok: false, reason: "lineage-refused", detail: "roll-unlinked" });
    // the reader's AID is another Nexus's: the answer names a Nexus the reader does not hold
    expect(await readFloorAnswer({ nexus: stranger.aid, answer: floorAnswerOf(c0.aid, []), fetchCas: fetchFrom(f.cas) })).toMatchObject({ ok: false, reason: "foreign-nexus" });
  });

  test("RED: a release sealed by a key outside its epoch's roster refuses (the key an earlier epoch seated)", async () => {
    const c0 = await seatedCharter({ seats: 3, threshold: 2 });
    const c1 = await c0.roll();
    const f = floor("outside");
    const good = await released(c1, f);
    const [oldHand] = await c0.signers([0]);
    const sealedByOld = { ...good, seal: { signer: oldHand!.signer, sig: await oldHand!.sign(floorReleaseBodyBytes(good.body)) } };
    const read = await readFloorAnswer({ nexus: c1.aid, answer: floorAnswerOf(c1.aid, [rowOf(sealedByOld)]), fetchCas: fetchFrom(f.cas) });
    expect(read).toMatchObject({ ok: false, reason: "steward-not-seated" });
  });

  test("RED: floor bytes that differ from the CID refuse: a manifest, and each snapshot", async () => {
    const c = await seatedCharter({ seats: 3, threshold: 1 });
    const f = floor("bytes");
    const answer = floorAnswerOf(c.aid, [rowOf(await released(c, f))]);
    const tamper = (cid: string) => async (asked: string) => {
      const bytes = f.cas.get(asked) ?? null;
      return asked === cid && bytes ? Uint8Array.from([...bytes, 0]) : bytes;
    };
    expect(await readFloorAnswer({ nexus: c.aid, answer, fetchCas: tamper(f.manifestCid) })).toMatchObject({ ok: false, reason: "manifest-bytes-differ" });
    expect(await readFloorAnswer({ nexus: c.aid, answer, fetchCas: tamper(f.lares.cid) })).toMatchObject({ ok: false, reason: "floor-snapshot-cid-mismatch" });
    expect(await readFloorAnswer({ nexus: c.aid, answer, fetchCas: tamper(f.lararium.cid) })).toMatchObject({ ok: false, reason: "floor-snapshot-cid-mismatch" });
    // CONTROL: the untampered fetch reads
    expect((await readFloorAnswer({ nexus: c.aid, answer, fetchCas: fetchFrom(f.cas) })).ok).toBe(true);
  });

  test("an absent snapshot, no release, a fork and a malformed answer each refuse by name", async () => {
    const c = await seatedCharter({ seats: 3, threshold: 1 });
    const f = floor("names");
    const first = await released(c, f);
    const left = await released(c, floor("left"), first.cid), right = await released(c, floor("right"), first.cid);
    const all = new Map([...f.cas]); for (const x of [floor("left"), floor("right")]) for (const [k, v] of x.cas) all.set(k, v);
    const gone = new Map(f.cas); gone.delete(f.lares.cid);
    expect(await readFloorAnswer({ nexus: c.aid, answer: floorAnswerOf(c.aid, [rowOf(first)]), fetchCas: fetchFrom(gone) })).toMatchObject({ ok: false, reason: "floor-absent" });
    expect(await readFloorAnswer({ nexus: c.aid, answer: floorAnswerOf(c.aid, []), fetchCas: fetchFrom(f.cas) })).toMatchObject({ ok: false, reason: "no-release" });
    expect(await readFloorAnswer({ nexus: c.aid, answer: floorAnswerOf(c.aid, [rowOf(first), rowOf(left), rowOf(right)]), fetchCas: fetchFrom(all) })).toMatchObject({ ok: false, reason: "release-unsettled" });
    for (const junk of [null, "x", {}, { format: "lararium-floor-answer/v1", nexus: c.aid, releases: [null] }]) {
      expect(await readFloorAnswer({ nexus: c.aid, answer: junk, fetchCas: fetchFrom(f.cas) })).toMatchObject({ ok: false, reason: "answer-malformed" });
    }
  });
});
