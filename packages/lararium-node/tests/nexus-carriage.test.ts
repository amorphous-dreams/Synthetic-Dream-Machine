/**
 * nexus-carriage.test.ts — the CARRIER-vs-STRANGER consult reads the LEAF MAP, and nothing else.
 *
 * Proven:
 *   · a presented admit whose leaf proof verifies for this socket, which `verifyPresentedAdmit` reads HELD
 *     against a CARRIED Nexus's deny board and antigen, seats the verdict's leaf nym → MEMBER;
 *   · CONTROL A — a wire key equal to a nym the board admits, presenting NO admit, reads STRANGER: no board
 *     admit is folded into an allow set and no raw wire key is read as a nym;
 *   · CONTROL B — an admit for a Nexus outside the carried readings reads STRANGER (and the real carried set
 *     leaves out a charter this vessel holds but never contracted into);
 *   · CONTROL C — a revoke descending from the admit lands, the refold drops the peer to STRANGER, `onRefold` fires;
 *   · CONTROL D — the same admit and proof replayed under another vessel key reads STRANGER;
 *   · a concurrent revoke (unsettled) and an admit at another epoch (wrong-epoch) stay STRANGER;
 *   · ROOT ⊥ LEAF — a held leaf leaves `contractNymOfPeer` null, and a root-map entry naming a board member
 *     seats nobody in the leaf map;
 *   · ONE CHAIN — a `present()` reading old readings and a `refold()` landing a descending revoke, interleaved,
 *     end STRANGER; CONTROL: the same interleaving with no revoke ends MEMBER.
 */
import { NEXUS_DOC_DOMAIN } from "@lararium/mesh";
import { afterEach, beforeEach, describe, test, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ed from "@noble/ed25519";
import {
  hex, genesisSealEpochCid, signCarriageQuorum, signCarriageContract, carriageEntryActCid, signLeafProof,
  makeMultiSigQuorumVerifier, signAntigenEntry,
  type NexusDoc, type CarriageEntry, type KahuQuorumSeats, type KapaeAntigenEntry,
} from "@lararium/mesh";
import {
  makeNexusMembership, makeRealmCharterConsult, readCarriedNexuses, leafStandingFor,
  type CarriedNexusReading, type SocketBinding,
} from "../src/nexus-carriage.js";
import { writeNexusDoc } from "../src/nexus-doc.js";

const SEEDS = [new Uint8Array(32).fill(1), new Uint8Array(32).fill(2), new Uint8Array(32).fill(3)];
const LEAF_SEED   = new Uint8Array(32).fill(5);
const ROOT_SEED   = new Uint8Array(32).fill(6);
const VESSEL_SEED = new Uint8Array(32).fill(11);
const OTHER_VESSEL_SEED = new Uint8Array(32).fill(12);
const pubOf    = (seed: Uint8Array) => ed.getPublicKeyAsync(seed).then(hex);
const signerOf = (seed: Uint8Array) => (bytes: Uint8Array) => ed.signAsync(bytes, seed).then(hex);
const GATE  = "ee".repeat(32);
const NONCE = "ab".repeat(32);

async function rosterAt(): Promise<KahuQuorumSeats> {
  const keys = await Promise.all(SEEDS.map(pubOf));
  return { keys, threshold: 2, sealEpochCid: genesisSealEpochCid(keys, 2) };
}
async function kahu() {
  return Promise.all([SEEDS[0]!, SEEDS[1]!].map(async (s) => ({ signer: await pubOf(s), sign: signerOf(s) })));
}
async function act(action: "admit" | "revoke", parents: readonly string[], epoch: string): Promise<CarriageEntry> {
  const nym = await pubOf(LEAF_SEED);
  const seal = action === "admit" ? await signCarriageContract(nym, epoch, signerOf(LEAF_SEED)) : undefined;
  return signCarriageQuorum({ nym, action, parents, sealEpochCid: epoch }, await kahu(), seal);
}
function reading(aid: string, roster: KahuQuorumSeats, denyBoard: CarriageEntry[] = [], antigen: KapaeAntigenEntry[] = []): CarriedNexusReading {
  return { aid, via: "consent", island: `island-${aid}`, roster, sealLineage: [], denyBoard, antigen, antigenRoster: roster };
}
async function bind(admit: CarriageEntry, opts: { lineage?: CarriageEntry[]; signer?: Uint8Array; vessel?: Uint8Array; wireVessel?: Uint8Array } = {}): Promise<SocketBinding> {
  const vesselKey = await pubOf(opts.vessel ?? VESSEL_SEED);
  const leafProof = await signLeafProof({ presented: { kind: "admit", admit, lineage: [] }, nonce: NONCE, gatePubKey: GATE, vesselKey, sign: signerOf(opts.signer ?? LEAF_SEED) });
  return {
    presentedAdmit: { admit, lineage: opts.lineage ?? [], leafProof },
    nonce: NONCE, gatePubKey: GATE, vesselKey: await pubOf(opts.wireVessel ?? opts.vessel ?? VESSEL_SEED),
  };
}

describe("the leaf map — a presented, proven, HELD admit for a carried Nexus reads MEMBER", () => {
  test("held + proven + carried → MEMBER, under the verdict's leaf nym", async () => {
    const roster = await rosterAt();
    const admit  = await act("admit", [], roster.sealEpochCid);
    const holder = makeNexusMembership({ readCarried: async () => [reading("N", roster)] });
    await holder.refold();
    await holder.present("peer-b", await bind(admit));
    expect(holder.membership.holdsCarriagePeer("peer-b")).toBe(true);
    expect(holder.leafNymOf("peer-b")).toBe(await pubOf(LEAF_SEED));
    expect(holder.heldCounts().get("N")).toBe(1);
    expect(holder.membership.holdsCarriagePeer("peer-absent")).toBe(false);   // never presented → STRANGER
  });

  test("CONTROL A: a wire key equal to a nym the board admits, presenting NO admit, reads STRANGER", async () => {
    const roster = await rosterAt();
    const admit  = await act("admit", [], roster.sealEpochCid);
    // The board holds the admit, and the peer's wire key IS the admitted nym — the retired fold would seat it.
    const holder = makeNexusMembership({ readCarried: async () => [reading("N", roster, [admit])] });
    await holder.refold();
    await holder.present("peer-wire-is-nym", null);
    expect(holder.membership.holdsCarriagePeer("peer-wire-is-nym")).toBe(false);
    // CONTROL of the control: the SAME admit, presented and proven, seats the peer.
    await holder.present("peer-wire-is-nym", await bind(admit, { vessel: LEAF_SEED }));
    expect(holder.membership.holdsCarriagePeer("peer-wire-is-nym")).toBe(true);
  });

  test("CONTROL B: an admit for a Nexus outside the carried readings reads STRANGER", async () => {
    const roster = await rosterAt();
    const other: KahuQuorumSeats = { ...roster, sealEpochCid: "another-nexus-epoch" };
    const admitElsewhere = await act("admit", [], other.sealEpochCid);
    const carried = makeNexusMembership({ readCarried: async () => [reading("N", roster)] });
    await carried.refold();
    await carried.present("peer", await bind(admitElsewhere));
    expect(carried.membership.holdsCarriagePeer("peer")).toBe(false);
    // CONTROL: carry that Nexus too, and the same presentation reads MEMBER.
    const both = makeNexusMembership({ readCarried: async () => [reading("N", roster), reading("M", other)] });
    await both.refold();
    await both.present("peer", await bind(admitElsewhere));
    expect(both.membership.holdsCarriagePeer("peer")).toBe(true);
  });

  test("CONTROL C: a descending revoke lands, the refold drops the peer to STRANGER, onRefold fires", async () => {
    const roster = await rosterAt();
    const admit  = await act("admit", [], roster.sealEpochCid);
    const deny: CarriageEntry[] = [];
    let fired = 0;
    const holder = makeNexusMembership({ readCarried: async () => [reading("N", roster, [...deny])], onRefold: () => { fired += 1; } });
    await holder.refold();
    await holder.present("peer-b", await bind(admit));
    expect(holder.membership.holdsCarriagePeer("peer-b")).toBe(true);
    const before = fired;
    deny.push(await act("revoke", [carriageEntryActCid(admit)], roster.sealEpochCid));
    await holder.refold();
    expect(holder.membership.holdsCarriagePeer("peer-b")).toBe(false);
    expect(fired).toBeGreaterThan(before);
  });

  test("CONTROL D: the same admit and proof replayed under another vessel key reads STRANGER", async () => {
    const roster = await rosterAt();
    const admit  = await act("admit", [], roster.sealEpochCid);
    const holder = makeNexusMembership({ readCarried: async () => [reading("N", roster)] });
    await holder.refold();
    await holder.present("peer-replay", await bind(admit, { wireVessel: OTHER_VESSEL_SEED }));
    expect(holder.membership.holdsCarriagePeer("peer-replay")).toBe(false);
    // A proof the persona ROOT signed binds nothing either.
    await holder.present("peer-root-proof", await bind(admit, { signer: ROOT_SEED }));
    expect(holder.membership.holdsCarriagePeer("peer-root-proof")).toBe(false);
  });

  test("a concurrent revoke (unsettled) and a held kapae (denied) stay STRANGER", async () => {
    const roster = await rosterAt();
    const admit  = await act("admit", [], roster.sealEpochCid);
    const concurrent = await act("revoke", [], roster.sealEpochCid);
    const r1 = makeNexusMembership({ readCarried: async () => [reading("N", roster, [concurrent])] });
    await r1.refold();
    await r1.present("peer", await bind(admit));
    expect(r1.membership.holdsCarriagePeer("peer")).toBe(false);

    const ban = await signAntigenEntry(
      { nym: await pubOf(LEAF_SEED), action: "kapae", parents: [], sealEpochCid: roster.sealEpochCid }, await kahu());
    const r2 = makeNexusMembership({ readCarried: async () => [reading("N", roster, [], [ban])] });
    await r2.refold();
    await r2.present("peer", await bind(admit));
    expect(r2.membership.holdsCarriagePeer("peer")).toBe(false);
    // The pure reader agrees, and names no standing.
    expect(await leafStandingFor(await bind(admit), [reading("N", roster, [], [ban])])).toBeNull();
    void makeMultiSigQuorumVerifier;
  });

  test("a socket that closes takes its standing with it", async () => {
    const roster = await rosterAt();
    const admit  = await act("admit", [], roster.sealEpochCid);
    const holder = makeNexusMembership({ readCarried: async () => [reading("N", roster)] });
    await holder.refold();
    await holder.present("peer-b", await bind(admit));
    expect(holder.membership.holdsCarriagePeer("peer-b")).toBe(true);
    await holder.present("peer-b", null);
    expect(holder.membership.holdsCarriagePeer("peer-b")).toBe(false);
  });
});

describe("ROOT ⊥ LEAF — the two maps fill independently and never link", () => {
  let bags: string;
  beforeEach(() => { bags = mkdtempSync(join(tmpdir(), "lares-root-leaf-")); });
  afterEach(() => { rmSync(bags, { recursive: true, force: true }); });

  test("a HELD leaf admit leaves contractNymOfPeer null", async () => {
    const roster = await rosterAt();
    const admit  = await act("admit", [], roster.sealEpochCid);
    const holder = makeNexusMembership({ readCarried: async () => [reading("N", roster)] });
    await holder.refold();
    await holder.present("peer-b", await bind(admit));
    expect(holder.membership.holdsCarriagePeer("peer-b")).toBe(true);
    const consult = makeRealmCharterConsult({ sealHome: bags, peerContractNymMap: new Map() });
    expect(consult.contractNymOfPeer("peer-b")).toBeNull();
  });

  test("a ROOT-map entry naming a board member seats nobody in the leaf map", async () => {
    const roster = await rosterAt();
    const admit  = await act("admit", [], roster.sealEpochCid);
    const leafNym = await pubOf(LEAF_SEED);
    const rootMap = new Map<string, string>([["peer-root", leafNym]]);
    const holder = makeNexusMembership({ readCarried: async () => [reading("N", roster, [admit])] });
    await holder.refold();
    expect(holder.membership.holdsCarriagePeer("peer-root")).toBe(false);
    // The realm consult reads its own map — the two answers are independent.
    const consult = makeRealmCharterConsult({ sealHome: bags, peerContractNymMap: rootMap });
    expect(consult.contractNymOfPeer("peer-root")).toBe(leafNym);
  });
});

describe("CONTROL B on the real carried set — a held charter this vessel never contracted into reads no Nexus", () => {
  let root: string;
  let prior: string | undefined;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), "lares-carried-none-")); prior = process.env["LAR_ROOT"]; process.env["LAR_ROOT"] = root; });
  afterEach(() => { if (prior === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = prior; rmSync(root, { recursive: true, force: true }); });

  test("no consent and no seat → no reading, so every presented admit for it reads STRANGER", async () => {
    const keys = await Promise.all(SEEDS.map(pubOf));
    const doc: NexusDoc = {
      kind: NEXUS_DOC_DOMAIN, threshold: 2, sealEpochCid: genesisSealEpochCid(keys, 2),
      kahu: keys.map((k, i) => ({ displayName: `Kahu ${i}`, verifyingKey: k })),
    };
    const bags = join(root, "nexus");
    writeNexusDoc(bags, doc);
    let opened = 0;
    const readings = await readCarriedNexuses({ sealHome: bags, ownVesselKey: "aa".repeat(32), open: async () => { opened += 1; return undefined; } });
    expect(readings).toEqual([]);
    expect(opened).toBe(0);
    const admit = await act("admit", [], doc.sealEpochCid!);
    expect(await leafStandingFor(await bind(admit), readings)).toBeNull();
  });
});

// ── ONE CHAIN — present() and refold() never interleave their writes to the leaf map ─────────────────────────
// A `present()` that read its readings before a revoke landed must not write its standing AFTER the refold that
// read the revoke: the later write would re-seat a peer the deny board already closed.

/** A promise the test resolves by hand, so one reading can be held back while another lands. */
function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void } {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

describe("ONE CHAIN — a stale present() never outlives the refold that read a revoke", () => {
  async function race(withRevoke: boolean): Promise<boolean> {
    const roster = await rosterAt();
    const admit  = await act("admit", [], roster.sealEpochCid);
    const revoke = await act("revoke", [carriageEntryActCid(admit)], roster.sealEpochCid);
    // The first reading (the present's) is held back and carries the OLD board; every later one carries the new.
    const old = deferred<readonly CarriedNexusReading[]>();
    let calls = 0;
    const holder = makeNexusMembership({
      readCarried: async () => {
        calls += 1;
        return calls === 1 ? old.promise : [reading("N", roster, withRevoke ? [revoke] : [])];
      },
    });
    const presenting = holder.present("peer-b", await bind(admit));           // reads the held-back OLD readings
    const refolding  = holder.refold();                                         // lands the revoke concurrently
    // Give the refold every chance to finish first — unserialized, it does, and the stale present then writes last.
    await Promise.race([refolding, new Promise((r) => setTimeout(r, 200))]);
    old.resolve([reading("N", roster)]);
    await Promise.all([presenting, refolding]);
    return holder.membership.holdsCarriagePeer("peer-b");
  }

  test("★ a present() on old readings and a concurrent descending revoke end STRANGER ★", async () => {
    expect(await race(true)).toBe(false);
  });

  test("CONTROL: the same interleaving with no revoke ends MEMBER", async () => {
    expect(await race(false)).toBe(true);
  });
});
