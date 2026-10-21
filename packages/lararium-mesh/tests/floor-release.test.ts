/**
 * floor-release.test.ts — W26 slice 4: the Nexus's one public answer. The steward seals a body that names the Nexus
 * AID, the charter epoch, the release before it and the floor manifest CID; the cabal's promotion approval over the
 * manifest's EXACT BYTES rides attached; the crossroads board carries it. Every refusal lands BEFORE any trust.
 *
 * Pinned:
 *   · the body's canonical bytes (the contract a reader re-derives), and the CID that names them,
 *   · a reader RE-DERIVES the CID: a moved body field, a lying `cid` and a record filed under another key each
 *     refuse `cid-differs` before the seal is read,
 *   · the wrong Nexus, the wrong charter epoch, a steward outside the roster, and a seal over another shape
 *     (a cabal act, a pointer-shaped body) each refuse, and no seal over another domain verifies as a release,
 *   · the approval binds the manifest's exact bytes: other bytes, a short quorum, the wrong surface and a class
 *     below the high-impact bar each refuse by the approval's own name,
 *   · the chain: a first release opens it, a later one links by `prior`, a release naming an unknown prior stands
 *     outside it, and two releases on one prior leave the chain `unsettled`,
 *   · CONTROL: the whole valid release verifies, lands on a board draft and reads back.
 */
import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import { Repo } from "@automerge/automerge-repo";
import { canonicalJsonBytes, hex, sha256HexBytesSync } from "../src/crypto.js";
import { emptyLarDoc } from "../src/base-doc.js";
import type { KahuQuorumSeats } from "../src/kapae-antigen.js";
import { FLOOR_RELEASE_DOMAIN, KAHU_CABAL_ADMIT_DOMAIN, ORACLE_POINTER_DOMAIN } from "../src/domains.js";
import { openPromotionApproval, signPromotionApproval } from "../src/promotion-approval.js";
import {
  FLOOR_RELEASE_PREFIX, assembleFloorRelease, floorReleaseBodyBytes, floorReleaseCid, floorReleaseRowsFromBoard,
  foldFloorReleases, openFloorReleaseBody, verifyFloorRelease, writeFloorRelease, type FloorRelease,
} from "../src/floor-release.js";

const NEXUS = "nexus-" + "ab".repeat(32);
const seed = (n: number) => new Uint8Array(32).fill(n);
const pub = (n: number) => ed.getPublicKeyAsync(seed(n)).then(hex);
const signerOf = async (n: number) => ({ signer: await pub(n), sign: (b: Uint8Array) => ed.signAsync(b, seed(n)).then(hex) });
const MANIFEST_BYTES = new TextEncoder().encode('{"format":"lararium-floor/v1","engine":"e"}');
const MANIFEST = sha256HexBytesSync(MANIFEST_BYTES);
const OTHER_BYTES = new TextEncoder().encode("a manifest the cabal never approved");

async function rosterOf(n: number, threshold = 1, epoch = "epoch-release-1"): Promise<KahuQuorumSeats> {
  return { keys: await Promise.all(Array.from({ length: n }, (_, i) => pub(i + 1))), threshold, sealEpochCid: epoch };
}

async function release(roster: KahuQuorumSeats, opts: { prior?: string | null; manifestBytes?: Uint8Array; approvers?: number[]; steward?: number } = {}): Promise<FloorRelease> {
  const manifestBytes = opts.manifestBytes ?? MANIFEST_BYTES;
  const body = openFloorReleaseBody({ nexus: NEXUS, roster, prior: opts.prior ?? null, manifest: sha256HexBytesSync(manifestBytes) });
  return assembleFloorRelease({
    body, roster, manifestBytes, steward: await signerOf(opts.steward ?? 1),
    approvers: await Promise.all((opts.approvers ?? [1, 2, 3]).map(signerOf)),
  });
}

const verify = (record: unknown, roster: KahuQuorumSeats, extra: { keyedBy?: string; manifestBytes?: Uint8Array; nexus?: string } = {}) =>
  verifyFloorRelease({ record, roster, nexus: extra.nexus ?? NEXUS, manifestBytes: extra.manifestBytes ?? MANIFEST_BYTES, ...(extra.keyedBy ? { keyedBy: extra.keyedBy } : {}) });

describe("the body and its CID", () => {
  test("canonical bytes are sorted-key stable with `kind` the signing domain; the CID names exactly those bytes", async () => {
    const roster = await rosterOf(3);
    const body = openFloorReleaseBody({ nexus: NEXUS, roster, prior: null, manifest: MANIFEST });
    const expected = `{"epoch":"epoch-release-1","kind":"${FLOOR_RELEASE_DOMAIN}","manifest":"${MANIFEST}","nexus":"${NEXUS}","prior":null}`;
    expect(new TextDecoder().decode(floorReleaseBodyBytes(body))).toBe(expected);
    expect(floorReleaseCid(body)).toBe(sha256HexBytesSync(new TextEncoder().encode(expected)));
  });

  test("a body that reads malformed refuses to open", async () => {
    const roster = await rosterOf(3);
    expect(() => openFloorReleaseBody({ nexus: NEXUS, roster, prior: null, manifest: "not-hex" })).toThrow(/manifest-unreadable/);
    expect(() => openFloorReleaseBody({ nexus: NEXUS, roster, prior: "zz", manifest: MANIFEST })).toThrow(/prior-unreadable/);
    expect(() => openFloorReleaseBody({ nexus: " ", roster, prior: null, manifest: MANIFEST })).toThrow(/no-nexus/);
  });
});

describe("a reader refuses before it trusts", () => {
  test("CONTROL: the whole valid release verifies (3 seats, the majority approving at the high-impact bar)", async () => {
    const roster = await rosterOf(3);
    const verdict = verify(await release(roster, { approvers: [1, 2] }), roster);
    expect(verdict).toMatchObject({ ok: true, counted: 2, threshold: 2 });
  });

  test("the CID re-derives: a moved body field, a lying cid and a foreign key each refuse `cid-differs`", async () => {
    const roster = await rosterOf(3);
    const good = await release(roster);
    expect(verify({ ...good, body: { ...good.body, manifest: sha256HexBytesSync(OTHER_BYTES) } }, roster).ok).toBe(false);
    expect(verify({ ...good, body: { ...good.body, manifest: sha256HexBytesSync(OTHER_BYTES) } }, roster)).toMatchObject({ reason: "cid-differs" });
    expect(verify({ ...good, cid: "0".repeat(64) }, roster)).toMatchObject({ reason: "cid-differs" });
    expect(verify(good, roster, { keyedBy: "1".repeat(64) })).toMatchObject({ reason: "cid-differs" });
    expect(verify(good, roster, { keyedBy: good.cid }).ok).toBe(true);                                                  // CONTROL
  });

  test("the wrong Nexus and the wrong charter epoch refuse", async () => {
    const roster = await rosterOf(3);
    const good = await release(roster);
    expect(verify(good, roster, { nexus: "nexus-" + "cd".repeat(32) })).toMatchObject({ reason: "foreign-nexus" });
    expect(verify(good, await rosterOf(3, 1, "epoch-elsewhere"))).toMatchObject({ reason: "wrong-charter-epoch" });
  });

  test("the steward's seal: an unseated steward refuses at assembly and at verification; a seal over another shape verifies as nothing", async () => {
    const roster = await rosterOf(3);
    const body = openFloorReleaseBody({ nexus: NEXUS, roster, prior: null, manifest: MANIFEST });
    await expect(assembleFloorRelease({ body, roster, manifestBytes: MANIFEST_BYTES, steward: await signerOf(42), approvers: [await signerOf(1), await signerOf(2)] }))
      .rejects.toThrow(/steward-not-seated/);
    const good = await release(roster);
    const outsider = await signerOf(42);
    expect(verify({ ...good, seal: { signer: outsider.signer, sig: await outsider.sign(floorReleaseBodyBytes(good.body)) } }, roster)).toMatchObject({ reason: "steward-not-seated" });
    // The seat signs ANOTHER shape (a cabal act, a pointer-shaped body): neither verifies as a release seal.
    const seat = await signerOf(1);
    for (const kind of [KAHU_CABAL_ADMIT_DOMAIN, ORACLE_POINTER_DOMAIN]) {
      const other = canonicalJsonBytes({ ...good.body, kind });
      expect(verify({ ...good, seal: { signer: seat.signer, sig: await seat.sign(other) } }, roster)).toMatchObject({ reason: "steward-seal-fails" });
    }
    expect(verify({ ...good, seal: { signer: seat.signer, sig: await seat.sign(floorReleaseBodyBytes(good.body)) } }, roster).ok).toBe(true);   // CONTROL
  });

  test("the approval binds the manifest's EXACT bytes: other bytes, a short quorum, and the wrong surface each refuse; the registry holds the class", async () => {
    const roster = await rosterOf(5, 2);                                       // high-impact takes 3 of 5
    const good = await release(roster, { approvers: [1, 2, 3] });
    expect(verify(good, roster).ok).toBe(true);                                                                       // CONTROL
    expect(verify(good, roster, { manifestBytes: OTHER_BYTES })).toMatchObject({ reason: "manifest-bytes-differ" });
    expect(verify(await release(roster, { approvers: [1, 2] }), roster)).toMatchObject({ reason: "approval-below-class-threshold" });
    // an approval opened over the SAME bytes but under another surface
    const wrongSurface = await signPromotionApproval(
      openPromotionApproval({ bytes: MANIFEST_BYTES, purpose: "floor-release", surface: "promotion", actClass: "high-impact", roster }),
      await Promise.all([1, 2, 3].map(signerOf)), roster);
    const body = openFloorReleaseBody({ nexus: NEXUS, roster, prior: null, manifest: MANIFEST });
    const bad = await assembleFloorRelease({ body, roster, manifestBytes: MANIFEST_BYTES, steward: await signerOf(1), approvers: [], approval: wrongSurface });
    expect(verify(bad, roster)).toMatchObject({ reason: "approval-wrong-surface" });
    // the registry holds the surface at the high-impact bar: an ordinary-class approval of it refuses to open, and one
    // forged past opening refuses at verification by the approval's own name (no second list of the bar lives here)
    expect(() => openPromotionApproval({ bytes: MANIFEST_BYTES, purpose: "floor-release", surface: "floor-release", actClass: "ordinary", roster }))
      .toThrow(/class-below-surface/);
    const forged = { ...(await signPromotionApproval(openPromotionApproval({ bytes: MANIFEST_BYTES, purpose: "floor-release", surface: "floor-release", actClass: "high-impact", roster }), [await signerOf(1)], roster)), actClass: "ordinary" as const };
    const low = await assembleFloorRelease({ body, roster, manifestBytes: MANIFEST_BYTES, steward: await signerOf(1), approvers: [], approval: forged });
    expect(verify(low, roster).ok).toBe(false);
    // an approval over another manifest's bytes
    const elsewhere = await signPromotionApproval(
      openPromotionApproval({ bytes: OTHER_BYTES, purpose: "floor-release", surface: "floor-release", actClass: "high-impact", roster }),
      await Promise.all([1, 2, 3].map(signerOf)), roster);
    const swapped = await assembleFloorRelease({ body, roster, manifestBytes: MANIFEST_BYTES, steward: await signerOf(1), approvers: [], approval: elsewhere });
    expect(verify(swapped, roster)).toMatchObject({ reason: "approval-bytes-differ" });
  });

  test("a record of no release shape reads malformed", async () => {
    const roster = await rosterOf(3);
    for (const junk of [null, "x", [], {}, { body: {}, seal: {} }]) expect(verify(junk, roster)).toMatchObject({ ok: false, reason: "malformed-release" });
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
    const roster = await rosterOf(3);
    const first = await release(roster, { manifestBytes: manifestN(1) });
    const second = await release(roster, { manifestBytes: manifestN(2), prior: first.cid });
    const rows = await boardOf([first, second]);
    expect(rows.map((r) => r.keyCid).sort()).toEqual([first.cid, second.cid].sort());
    expect(rows.every((r) => `${FLOOR_RELEASE_PREFIX}${r.keyCid}`.startsWith("$:/lar/floor-release/"))).toBe(true);
    const standing = await foldFloorReleases({ rows, nexus: NEXUS, roster, manifestBytesOf: bytesOf });
    expect(standing).toMatchObject({ standing: "released", head: { cid: second.cid } });
    expect(await foldFloorReleases({ rows: rows.filter((r) => r.keyCid === first.cid), nexus: NEXUS, roster, manifestBytesOf: bytesOf }))
      .toMatchObject({ standing: "released", head: { cid: first.cid } });
  });

  test("a release naming an unknown prior stands outside the chain; a board with none reads absent", async () => {
    const roster = await rosterOf(3);
    const orphan = await release(roster, { manifestBytes: manifestN(3), prior: "9".repeat(64) });
    expect(await foldFloorReleases({ rows: await boardOf([orphan]), nexus: NEXUS, roster, manifestBytesOf: bytesOf })).toMatchObject({ standing: "absent" });
    expect(await foldFloorReleases({ rows: [], nexus: NEXUS, roster, manifestBytesOf: bytesOf })).toMatchObject({ standing: "absent" });
  });

  test("two releases on one prior leave the chain unsettled; a row whose manifest bytes never arrived counts nothing", async () => {
    const roster = await rosterOf(3);
    const first = await release(roster, { manifestBytes: manifestN(4) });
    const left = await release(roster, { manifestBytes: manifestN(5), prior: first.cid });
    const right = await release(roster, { manifestBytes: manifestN(6), prior: first.cid });
    const rows = await boardOf([first, left, right]);
    expect(await foldFloorReleases({ rows, nexus: NEXUS, roster, manifestBytesOf: bytesOf }))
      .toMatchObject({ standing: "unsettled", heads: [left.cid, right.cid].sort() });
    // CONTROL: with one fork's manifest unresolved, the other fork alone heads the chain.
    const partial = async (cid: string) => (cid === left.body.manifest ? null : bytesOf(cid));
    expect(await foldFloorReleases({ rows, nexus: NEXUS, roster, manifestBytesOf: partial })).toMatchObject({ standing: "released", head: { cid: right.cid } });
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
