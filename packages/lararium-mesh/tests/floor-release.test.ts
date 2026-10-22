/**
 * floor-release.test.ts — W26 slice 4: the Nexus's one public answer. The steward seals a body that names the Nexus
 * AID, the charter epoch, the release before it and the floor manifest CID; the cabal's promotion approval over the
 * manifest's EXACT BYTES rides attached; the charter's epoch lineage rides the record; the crossroads board carries it.
 * Every refusal lands BEFORE any trust.
 *
 * Pinned:
 *   · the body's canonical bytes (the contract a reader re-derives), and the CID that names them,
 *   · a reader RE-DERIVES the CID: a moved body field, a lying `cid` and a record filed under another key each
 *     refuse `cid-differs` before the seal is read,
 *   · the lineage proves the roster: a genesis that differs from the AID, a forged step, a skipped step and a lineage
 *     that ends at another epoch each refuse, and a release verifies under the roster of ITS OWN epoch after rolls,
 *   · the wrong Nexus, a steward outside the roster of the release's epoch (a key an earlier epoch seated included),
 *     and a seal over another shape each refuse,
 *   · the approval binds the manifest's exact bytes: other bytes, a short quorum and the wrong surface each refuse
 *     by the approval's own name; the registry holds the class,
 *   · the chain: a first release opens it, a later one links by `prior`, a release naming an unknown prior stands
 *     outside it, and two releases on one prior leave the chain `unsettled`,
 *   · CONTROL: the whole valid release verifies, lands on a board draft and reads back.
 */
import { describe, test, expect } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { canonicalJsonBytes, sha256HexBytesSync } from "../src/crypto.js";
import { emptyLarDoc } from "../src/base-doc.js";
import { FLOOR_RELEASE_DOMAIN, KAHU_CABAL_ADMIT_DOMAIN, FLOW_POINTER_DOMAIN } from "../src/domains.js";
import { openPromotionApproval, signPromotionApproval } from "../src/promotion-approval.js";
import type { SealEpoch } from "../src/wax-stamp.js";
import {
  FLOOR_RELEASE_PREFIX, assembleFloorRelease, floorReleaseBodyBytes, floorReleaseCid, floorReleaseRowsFromBoard,
  foldFloorReleases, openFloorReleaseBody, rosterOfLineage, verifyFloorRelease, writeFloorRelease, type FloorRelease,
} from "../src/floor-release.js";
import { seatedCharter, uncommittedSuccessor, type SeatedCharter } from "./charter-fixture.js";

const MANIFEST_BYTES = new TextEncoder().encode('{"format":"lararium-floor/v1","engine":"e"}');
const MANIFEST = sha256HexBytesSync(MANIFEST_BYTES);
const OTHER_BYTES = new TextEncoder().encode("a manifest the cabal never approved");

async function release(c: SeatedCharter, opts: {
  prior?: string | null; manifestBytes?: Uint8Array; approvers?: number[]; steward?: number; lineage?: readonly SealEpoch[]; nexus?: string; epoch?: string;
} = {}): Promise<FloorRelease> {
  const manifestBytes = opts.manifestBytes ?? MANIFEST_BYTES;
  const body = openFloorReleaseBody({ nexus: opts.nexus ?? c.aid, epoch: opts.epoch ?? c.head.epochCid, prior: opts.prior ?? null, manifest: sha256HexBytesSync(manifestBytes) });
  const [steward] = await c.signers([opts.steward ?? 0]);
  return assembleFloorRelease({
    body, lineage: opts.lineage ?? c.chain, manifestBytes, steward: steward!, approvers: [...await c.signers(opts.approvers ?? c.keys.map((_, i) => i))],
  });
}

const verify = (record: unknown, c: SeatedCharter, extra: { keyedBy?: string; manifestBytes?: Uint8Array; nexus?: string } = {}) =>
  verifyFloorRelease({ record, nexus: extra.nexus ?? c.aid, manifestBytes: extra.manifestBytes ?? MANIFEST_BYTES, ...(extra.keyedBy ? { keyedBy: extra.keyedBy } : {}) });

describe("the body and its CID", () => {
  test("canonical bytes are sorted-key stable with `kind` the signing domain; the CID names exactly those bytes", async () => {
    const c = await seatedCharter({ seats: 3, threshold: 1 });
    const body = openFloorReleaseBody({ nexus: c.aid, epoch: c.head.epochCid, prior: null, manifest: MANIFEST });
    const expected = `{"epoch":"${c.head.epochCid}","kind":"${FLOOR_RELEASE_DOMAIN}","manifest":"${MANIFEST}","nexus":"${c.aid}","prior":null}`;
    expect(new TextDecoder().decode(floorReleaseBodyBytes(body))).toBe(expected);
    expect(floorReleaseCid(body)).toBe(sha256HexBytesSync(new TextEncoder().encode(expected)));
  });

  test("a body that reads malformed refuses to open", async () => {
    const c = await seatedCharter({ seats: 3, threshold: 1 });
    expect(() => openFloorReleaseBody({ nexus: c.aid, epoch: c.head.epochCid, prior: null, manifest: "not-hex" })).toThrow(/manifest-unreadable/);
    expect(() => openFloorReleaseBody({ nexus: c.aid, epoch: c.head.epochCid, prior: "zz", manifest: MANIFEST })).toThrow(/prior-unreadable/);
    expect(() => openFloorReleaseBody({ nexus: " ", epoch: c.head.epochCid, prior: null, manifest: MANIFEST })).toThrow(/no-nexus/);
  });
});

describe("a reader refuses before it trusts", () => {
  test("CONTROL: the whole valid release verifies (3 seats, the majority approving at the high-impact bar)", async () => {
    const c = await seatedCharter({ seats: 3, threshold: 1 });
    expect(verify(await release(c, { approvers: [0, 1] }), c)).toMatchObject({ ok: true, counted: 2, threshold: 2 });
  });

  test("the CID re-derives: a moved body field, a lying cid and a foreign key each refuse `cid-differs`", async () => {
    const c = await seatedCharter({ seats: 3, threshold: 1 });
    const good = await release(c);
    expect(verify({ ...good, body: { ...good.body, manifest: sha256HexBytesSync(OTHER_BYTES) } }, c)).toMatchObject({ ok: false, reason: "cid-differs" });
    expect(verify({ ...good, cid: "0".repeat(64) }, c)).toMatchObject({ reason: "cid-differs" });
    expect(verify(good, c, { keyedBy: "1".repeat(64) })).toMatchObject({ reason: "cid-differs" });
    expect(verify(good, c, { keyedBy: good.cid }).ok).toBe(true);                                                       // CONTROL
  });

  test("the wrong Nexus refuses", async () => {
    const c = await seatedCharter({ seats: 3, threshold: 1 });
    expect(verify(await release(c), c, { nexus: "nexus-" + "cd".repeat(32) })).toMatchObject({ reason: "foreign-nexus" });
  });
});

describe("the lineage proves the roster", () => {
  test("a genesis whose bytes differ from the AID refuses before the seal is read (another charter's lineage under this Nexus)", async () => {
    const mine = await seatedCharter({ seats: 3, threshold: 1, seed: 1 });
    const theirs = await seatedCharter({ seats: 3, threshold: 1, seed: 2 });
    const body = openFloorReleaseBody({ nexus: mine.aid, epoch: theirs.head.epochCid, prior: null, manifest: MANIFEST });
    const [steward] = await theirs.signers([0]);
    const forged = { ...(await assembleFloorRelease({ body: { ...body, nexus: theirs.aid }, lineage: theirs.chain, manifestBytes: MANIFEST_BYTES, steward: steward!, approvers: [...await theirs.signers()] })), body };
    expect(verify({ ...forged, cid: floorReleaseCid(body) }, mine)).toMatchObject({ ok: false, reason: "lineage-genesis-differs" });
    expect(rosterOfLineage(mine.aid, theirs.chain, theirs.head.epochCid)).toMatchObject({ ok: false, reason: "lineage-genesis-differs" });
  });

  test("a genesis epoch whose own bytes were edited refuses (the AID re-derives from the genesis, never from a field)", async () => {
    const c = await seatedCharter({ seats: 3, threshold: 1 });
    const edited = [{ ...c.chain[0]!, keySetHash: "0".repeat(64) }, ...c.chain.slice(1)];
    expect(rosterOfLineage(c.aid, edited, c.head.epochCid)).toMatchObject({ ok: false, reason: "lineage-genesis-differs" });
  });

  test("a forged step and a skipped step each refuse by the lineage law's own code", async () => {
    const c = await seatedCharter({ seats: 3, threshold: 1 });
    const rolled = await c.roll();
    const rolledTwice = await rolled.roll();
    const stranger = await seatedCharter({ seats: 3, threshold: 1, seed: 9 });
    const forgedStep = [...c.chain, await uncommittedSuccessor(c, stranger)];
    expect(rosterOfLineage(c.aid, forgedStep, forgedStep[1]!.epochCid)).toMatchObject({ ok: false, reason: "lineage-refused" });
    const skipped = [rolledTwice.chain[0]!, rolledTwice.chain[2]!];
    expect(rosterOfLineage(c.aid, skipped, rolledTwice.head.epochCid)).toMatchObject({ ok: false, reason: "lineage-refused", detail: "roll-unlinked" });
    // CONTROL: the whole lineage proves the head's roster
    expect(rosterOfLineage(c.aid, rolledTwice.chain, rolledTwice.head.epochCid)).toMatchObject({ ok: true, roster: { keys: [...rolledTwice.keys].sort(), sealEpochCid: rolledTwice.head.epochCid } });
  });

  test("a lineage that ends at another epoch than the release names refuses", async () => {
    const c = await seatedCharter({ seats: 3, threshold: 1 });
    const rolled = await c.roll();
    const r = await release(rolled, { lineage: rolled.chain });
    expect(verify(r, rolled).ok).toBe(true);
    const claimsHead = await release(rolled, { lineage: c.chain, epoch: rolled.head.epochCid }).catch((e: Error) => e);
    expect(String(claimsHead)).toMatch(/lineage-epoch-differs/);
    const record = { ...r, lineage: c.chain };
    expect(verify(record, rolled)).toMatchObject({ reason: "lineage-epoch-differs" });
  });

  test("a release verifies under the roster of ITS OWN epoch after the charter rolls; a key an earlier epoch seated seals nothing in a later one", async () => {
    const c0 = await seatedCharter({ seats: 3, threshold: 2 });
    const c1 = await c0.roll();
    const old = await release(c0);                                                       // sealed at epoch 0, lineage 0..0
    expect(verify(old, c1).ok).toBe(true);                                                // c1 holds the later charter: the old release still verifies
    // a steward holding an EPOCH-0 key signs a release naming EPOCH 1 (assembly refuses; a hand-built record refuses at the reader)
    const [oldHand] = await c0.signers([0]);
    const body = openFloorReleaseBody({ nexus: c1.aid, epoch: c1.head.epochCid, prior: null, manifest: MANIFEST });
    await expect(assembleFloorRelease({ body, lineage: c1.chain, manifestBytes: MANIFEST_BYTES, steward: oldHand!, approvers: [...await c1.signers()] })).rejects.toThrow(/steward-not-seated/);
    const good = await release(c1);
    const sealedByOld = { ...good, seal: { signer: oldHand!.signer, sig: await oldHand!.sign(floorReleaseBodyBytes(good.body)) } };
    expect(verify(sealedByOld, c1)).toMatchObject({ ok: false, reason: "steward-not-seated" });
  });
});

describe("the steward's seal and the cabal's approval", () => {
  test("an unseated steward refuses; a seal over another shape verifies as nothing", async () => {
    const c = await seatedCharter({ seats: 3, threshold: 1 });
    const other = await seatedCharter({ seats: 3, threshold: 1, seed: 7 });
    const [outsider] = await other.signers([0]);
    const good = await release(c);
    expect(verify({ ...good, seal: { signer: outsider!.signer, sig: await outsider!.sign(floorReleaseBodyBytes(good.body)) } }, c)).toMatchObject({ reason: "steward-not-seated" });
    const [seat] = await c.signers([0]);
    for (const kind of [KAHU_CABAL_ADMIT_DOMAIN, FLOW_POINTER_DOMAIN]) {
      const wrong = canonicalJsonBytes({ ...good.body, kind });
      expect(verify({ ...good, seal: { signer: seat!.signer, sig: await seat!.sign(wrong) } }, c)).toMatchObject({ reason: "steward-seal-fails" });
    }
    expect(verify({ ...good, seal: { signer: seat!.signer, sig: await seat!.sign(floorReleaseBodyBytes(good.body)) } }, c).ok).toBe(true);   // CONTROL
  });

  test("the approval binds the manifest's EXACT bytes: other bytes, a short quorum and the wrong surface each refuse", async () => {
    const c = await seatedCharter({ seats: 5, threshold: 2 });                  // high-impact takes 3 of 5
    const good = await release(c, { approvers: [0, 1, 2] });
    expect(verify(good, c).ok).toBe(true);                                                                              // CONTROL
    expect(verify(good, c, { manifestBytes: OTHER_BYTES })).toMatchObject({ reason: "manifest-bytes-differ" });
    expect(verify(await release(c, { approvers: [0, 1] }), c)).toMatchObject({ reason: "approval-below-class-threshold" });
    const roster = rosterOfLineage(c.aid, c.chain, c.head.epochCid);
    if (!roster.ok) throw new Error("fixture lineage unproven");
    const body = openFloorReleaseBody({ nexus: c.aid, epoch: c.head.epochCid, prior: null, manifest: MANIFEST });
    const [steward] = await c.signers([0]);
    const wrongSurface = await signPromotionApproval(
      openPromotionApproval({ bytes: MANIFEST_BYTES, purpose: "floor-release", surface: "promotion", actClass: "high-impact", roster: roster.roster }), [...await c.signers([0, 1, 2])], roster.roster);
    const bad = await assembleFloorRelease({ body, lineage: c.chain, manifestBytes: MANIFEST_BYTES, steward: steward!, approvers: [], approval: wrongSurface });
    expect(verify(bad, c)).toMatchObject({ reason: "approval-wrong-surface" });
    // the registry holds the surface at the high-impact bar: an ordinary-class approval refuses to open
    expect(() => openPromotionApproval({ bytes: MANIFEST_BYTES, purpose: "floor-release", surface: "floor-release", actClass: "ordinary", roster: roster.roster })).toThrow(/class-below-surface/);
    const forged = { ...(await signPromotionApproval(openPromotionApproval({ bytes: MANIFEST_BYTES, purpose: "floor-release", surface: "floor-release", actClass: "high-impact", roster: roster.roster }), [...await c.signers([0])], roster.roster)), actClass: "ordinary" as const };
    expect(verify(await assembleFloorRelease({ body, lineage: c.chain, manifestBytes: MANIFEST_BYTES, steward: steward!, approvers: [], approval: forged }), c).ok).toBe(false);
    // an approval over another manifest's bytes
    const elsewhere = await signPromotionApproval(
      openPromotionApproval({ bytes: OTHER_BYTES, purpose: "floor-release", surface: "floor-release", actClass: "high-impact", roster: roster.roster }), [...await c.signers([0, 1, 2])], roster.roster);
    const swapped = await assembleFloorRelease({ body, lineage: c.chain, manifestBytes: MANIFEST_BYTES, steward: steward!, approvers: [], approval: elsewhere });
    expect(verify(swapped, c)).toMatchObject({ reason: "approval-bytes-differ" });
  });

  test("a record of no release shape reads malformed", async () => {
    const c = await seatedCharter({ seats: 3, threshold: 1 });
    for (const junk of [null, "x", [], {}, { body: {}, seal: {} }]) expect(verify(junk, c)).toMatchObject({ ok: false, reason: "malformed-release" });
  });
});

describe("the chain on the crossroads board", () => {
  const manifests = new Map<string, Uint8Array>();
  const bytesOf = async (cid: string) => manifests.get(cid) ?? null;
  const manifestN = (n: number) => { const b = new TextEncoder().encode(`floor manifest ${n}`); manifests.set(sha256HexBytesSync(b), b); return b; };

  async function boardOf(releases: FloorRelease[]) {
    const repo = new Repo({ network: [] });
    try {
      const handle = repo.create(emptyLarDoc());
      handle.change((d) => { for (const r of releases) writeFloorRelease(d, r); });
      return floorReleaseRowsFromBoard(handle.doc());
    } finally { await repo.shutdown(); }
  }

  test("CONTROL: a first release opens the chain, a second links by prior and becomes the head; both ride the board under their CIDs", async () => {
    const c = await seatedCharter({ seats: 3, threshold: 1 });
    const first = await release(c, { manifestBytes: manifestN(1) });
    const second = await release(c, { manifestBytes: manifestN(2), prior: first.cid });
    const rows = await boardOf([first, second]);
    expect(rows.map((r) => r.keyCid).sort()).toEqual([first.cid, second.cid].sort());
    expect(rows.every((r) => `${FLOOR_RELEASE_PREFIX}${r.keyCid}`.startsWith("$:/lar/floor-release/"))).toBe(true);
    expect(await foldFloorReleases({ rows, nexus: c.aid, manifestBytesOf: bytesOf })).toMatchObject({ standing: "released", head: { cid: second.cid } });
    expect(await foldFloorReleases({ rows: rows.filter((r) => r.keyCid === first.cid), nexus: c.aid, manifestBytesOf: bytesOf }))
      .toMatchObject({ standing: "released", head: { cid: first.cid } });
  });

  test("a chain walks across a roll: the first release at epoch 0, the second at epoch 1, each under its own roster", async () => {
    const c0 = await seatedCharter({ seats: 3, threshold: 1 });
    const c1 = await c0.roll();
    const first = await release(c0, { manifestBytes: manifestN(10) });
    const second = await release(c1, { manifestBytes: manifestN(11), prior: first.cid });
    const rows = await boardOf([first, second]);
    expect(await foldFloorReleases({ rows, nexus: c0.aid, manifestBytesOf: bytesOf })).toMatchObject({ standing: "released", head: { cid: second.cid }, refused: [] });
  });

  test("a release naming an unknown prior stands outside the chain and says so; a board with none reads absent", async () => {
    const c = await seatedCharter({ seats: 3, threshold: 1 });
    const orphan = await release(c, { manifestBytes: manifestN(3), prior: "9".repeat(64) });
    const standing = await foldFloorReleases({ rows: await boardOf([orphan]), nexus: c.aid, manifestBytesOf: bytesOf });
    expect(standing).toMatchObject({ standing: "absent", refused: [expect.objectContaining({ reason: "prior-unknown" })] });
    expect(await foldFloorReleases({ rows: [], nexus: c.aid, manifestBytesOf: bytesOf })).toMatchObject({ standing: "absent", refused: [] });
  });

  test("two releases on one prior leave the chain unsettled; a row whose manifest bytes never arrived counts nothing", async () => {
    const c = await seatedCharter({ seats: 3, threshold: 1 });
    const first = await release(c, { manifestBytes: manifestN(4) });
    const left = await release(c, { manifestBytes: manifestN(5), prior: first.cid });
    const right = await release(c, { manifestBytes: manifestN(6), prior: first.cid });
    const rows = await boardOf([first, left, right]);
    expect(await foldFloorReleases({ rows, nexus: c.aid, manifestBytesOf: bytesOf })).toMatchObject({ standing: "unsettled", heads: [left.cid, right.cid].sort() });
    const partial = async (cid: string) => (cid === left.body.manifest ? null : bytesOf(cid));
    expect(await foldFloorReleases({ rows, nexus: c.aid, manifestBytesOf: partial })).toMatchObject({ standing: "released", head: { cid: right.cid }, refused: [expect.objectContaining({ reason: "manifest-unavailable" })] });
  });

  test("a torn row and a row under another prefix drop in silence", async () => {
    const repo = new Repo({ network: [] });
    try {
      const handle = repo.create(emptyLarDoc());
      handle.change((d) => {
        d.tiddlers[`${FLOOR_RELEASE_PREFIX}bad`] = { tiddler: { title: `${FLOOR_RELEASE_PREFIX}bad`, text: "{not json" } } as never;
        d.tiddlers["$:/lar/other/x"] = { tiddler: { title: "$:/lar/other/x", text: "{}" } } as never;
      });
      expect(floorReleaseRowsFromBoard(handle.doc())).toEqual([]);
    } finally { await repo.shutdown(); }
  });
});
