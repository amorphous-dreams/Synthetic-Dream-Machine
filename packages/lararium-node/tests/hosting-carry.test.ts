/**
 * hosting-carry.test.ts — W: a hearth CARRIES a walker's own documents as sealed ciphertext, under quota, and
 * reclaims only under its own pressure, by the guest's own rhythm, with notice before any discard.
 *
 * Proven (each with its control):
 *   · CARRY ⊥ READ: the hearth's store never holds the plaintext, and nothing the hearth holds opens the bytes;
 *     CONTROL: the walker's own receipt opens them;
 *   · the per-grant quota refuses past its bound; CONTROL: a deposit within it is held;
 *   · NO EVICTION WITHOUT PRESSURE: a long-lapsed guest is untouched while room stands; CONTROL: under pressure
 *     the same guest is marked;
 *   · NOTICE BEFORE DISCARD: pressure first only MARKS; the guest's contact hears the notice; a renewal clears the
 *     mark and nothing is discarded; CONTROL: a mark that stood unrenewed through the guest's own threshold again
 *     is discarded;
 *   · HOST CADENCE CANCELS: the same guest behaviour under a hearth that rolls 10× as often reads the same
 *     eligibility; CONTROL: a flat count of epochs would not (the same absolute lapse reads differently);
 *   · MOST-LAPSED-FOR-ITSELF FIRST: the guest lapsed furthest past its OWN rhythm is taken, not the one with the
 *     longest absolute lapse; CONTROL: a regular guest is never taken while a long-lapsed one stands, even when
 *     the lapsed one cannot cover the whole shortfall;
 *   · NO GUEST NAMED: the store holds no lineage, leaf or grant tag; a record key needs the hearth's seed;
 *     CONTROL: the proven leaf's key reaches its record;
 *   · through the sorter: a renewed walker's carriage survives a roll; a marked carriage's contact pushes the
 *     notice on EITHER arm — a dial alone delivers it, the token arm included; CONTROL: an unmarked one pushes
 *     none; a fresh lineage under the same leaf reaches the same record, and another leaf reaches none.
 */
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ed from "@noble/ed25519";
import {
  sealBodyOnCas, openBodyOnCas, walkCarrySecret, carryRecordKey, hex, genesisSealEpochCid, deriveNexusScopedKey,
  hexToBytes, PERSONA_GLAMOUR_CONTEXT, mintHostToken, redeemClaim, signPresented, utf8Bytes,
  HOSTING_NOTICE_SESSION_KIND, type KahuQuorumSeats, type UnsignedPresented,
} from "@lararium/mesh";
import { depositCarried, noteContact, fetchCarried, readCarryRecord, type CarryLimits } from "../src/hosting-carry.js";
import { rollHosting, readHostingState, liveEpochs, hostingDir } from "../src/hosting-store.js";
import { makeSocketSorter } from "../src/socket-sorter.js";
import type { CarriedNexusReading } from "../src/nexus-carriage.js";

const AID = "epoch0-" + "a".repeat(64);
const HEARTH = new Uint8Array(32).fill(61);
const WALKER = new Uint8Array(32).fill(62);
let storageDir = "";
beforeEach(() => { storageDir = mkdtempSync(join(tmpdir(), "hosting-carry-")); });
afterEach(() => { rmSync(storageDir, { recursive: true, force: true }); });

const keyOf = (leaf: string) => carryRecordKey(HEARTH, AID, leaf);
const L = (c: string) => c.repeat(64);
const bytes = (n: number, fill = 7) => new Uint8Array(n).fill(fill);
/** A distinct ciphertext of `n` bytes and its address (the hearth carries only what it can address). */
function blob(n: number, fill: number): { cid: string; ciphertext: Uint8Array } {
  const s = sealBodyOnCas(bytes(n, fill), new Uint8Array(32).fill(fill));
  return { cid: s.cid, ciphertext: s.ciphertext };
}
function put(key: string, depth: number, n: number, fill: number, limits: CarryLimits) {
  return depositCarried({ storageDir, nexusAid: AID, key, depth, ...blob(n, fill), limits });
}
/** Every byte of every file under the hosting dir, as latin1 text. */
function everything(): string {
  const out: string[] = [];
  const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); out.push(f); if (statSync(p).isDirectory()) walk(p); else out.push(readFileSync(p, "latin1")); } };
  walk(hostingDir(storageDir, AID));
  return out.join("\n");
}

describe("carry ⊥ read", () => {
  test("RED: the hearth holds no plaintext and nothing it holds opens the bytes; CONTROL: the receipt does", () => {
    const plaintext = utf8Bytes("the walker's own private notes — never the hearth's to read");
    const sealed = sealBodyOnCas(plaintext, walkCarrySecret(WALKER, AID));
    expect(depositCarried({ storageDir, nexusAid: AID, key: keyOf(L("1")), depth: 1, cid: sealed.cid, ciphertext: sealed.ciphertext })).toBe("held");
    const stored = fetchCarried(storageDir, AID, keyOf(L("1")), sealed.cid)!;
    expect(everything()).not.toContain("private notes");
    // What the hearth holds — its own leaf seed, the record key, and anything derived the walker's way from them —
    // neither opens the bytes nor even CONFIRMS a guessed plaintext (the seal under it addresses elsewhere).
    for (const guess of [HEARTH, walkCarrySecret(HEARTH, AID), hexToBytes(keyOf(L("1"))), walkCarrySecret(hexToBytes(keyOf(L("1"))), AID)]) {
      expect(hex(openBodyOnCas(stored, guess))).not.toBe(hex(plaintext));
      expect(sealBodyOnCas(plaintext, guess).cid).not.toBe(sealed.cid);
    }
    expect(hex(openBodyOnCas(stored, sealed.readCap))).toBe(hex(plaintext));           // CONTROL
  });
});

describe("the quota", () => {
  test("RED: a grant's deposit past its bound is refused; CONTROL: within it, held", () => {
    const limits = { perGuestBytes: 100, totalBytes: 10_000 };
    expect(put(keyOf(L("1")), 1, 80, 1, limits)).toBe("held");
    expect(put(keyOf(L("1")), 1, 30, 2, limits)).toBe("quota");
    expect(put(keyOf(L("1")), 1, 20, 3, limits)).toBe("held");
    expect(readCarryRecord(storageDir, AID, keyOf(L("1")))?.bytes).toBe(100);
  });
});

describe("reclaim — pressure the only trigger, the guest's own rhythm the measure, notice before discard", () => {
  const roomy = { perGuestBytes: 100, totalBytes: 1_000 };
  const tight = { perGuestBytes: 100, totalBytes: 100 };

  test("RED: no eviction without pressure; CONTROL: under pressure the same guest is marked", () => {
    expect(put(keyOf(L("a")), 1, 60, 1, roomy)).toBe("held");
    expect(put(keyOf(L("b")), 500, 60, 2, roomy)).toBe("held");                     // A lapsed 499 epochs
    expect(readCarryRecord(storageDir, AID, keyOf(L("a")))).toMatchObject({ bytes: 60, pending: null });
    expect(put(keyOf(L("c")), 500, 60, 3, tight)).toBe("pressure");
    expect(readCarryRecord(storageDir, AID, keyOf(L("a")))).toMatchObject({ bytes: 60, pending: 500 });
  });

  test("RED: pressure first only MARKS; the contact hears the notice; a renewal clears it and nothing is discarded", () => {
    const a = blob(60, 1);
    expect(depositCarried({ storageDir, nexusAid: AID, key: keyOf(L("a")), depth: 1, ...a, limits: tight })).toBe("held");
    for (const d of [2, 3]) noteContact(storageDir, AID, keyOf(L("a")), d);         // rhythm: every epoch
    expect(put(keyOf(L("b")), 10, 60, 2, tight)).toBe("pressure");
    expect(readCarryRecord(storageDir, AID, keyOf(L("a")))).toMatchObject({ bytes: 60, pending: 10 });
    expect(fetchCarried(storageDir, AID, keyOf(L("a")), a.cid)).not.toBeNull();     // marked, not discarded
    expect(noteContact(storageDir, AID, keyOf(L("a")), 10).notice).toBe(true);       // the contact hears it
    expect(noteContact(storageDir, AID, keyOf(L("a")), 11).notice).toBe(false);      // a renewal clears it
    expect(readCarryRecord(storageDir, AID, keyOf(L("a")))?.pending).toBeNull();
    expect(put(keyOf(L("b")), 12, 60, 2, tight)).toBe("pressure");                   // A within its rhythm: kept
    expect(fetchCarried(storageDir, AID, keyOf(L("a")), a.cid)).not.toBeNull();
  });

  test("CONTROL: a mark that stood unrenewed through the guest's own threshold again is discarded", () => {
    const a = blob(60, 1);
    depositCarried({ storageDir, nexusAid: AID, key: keyOf(L("a")), depth: 1, ...a, limits: tight });
    for (const d of [2, 3]) noteContact(storageDir, AID, keyOf(L("a")), d);
    expect(put(keyOf(L("b")), 10, 60, 2, tight)).toBe("pressure");                   // marked at 10
    expect(put(keyOf(L("b")), 12, 60, 2, tight)).toBe("pressure");                   // 2 rhythms since: not yet
    expect(fetchCarried(storageDir, AID, keyOf(L("a")), a.cid)).not.toBeNull();
    expect(put(keyOf(L("b")), 13, 60, 2, tight)).toBe("held");                       // past it: discarded
    expect(fetchCarried(storageDir, AID, keyOf(L("a")), a.cid)).toBeNull();
    expect(readCarryRecord(storageDir, AID, keyOf(L("a")))?.bytes).toBe(0);
  });

  /** One guest A with a rhythm of `scale` epochs, lapsed `lapse` rhythms, under pressure from B. Marked? */
  function marked(scale: number, lapse: number, dir: string): boolean {
    storageDir = dir;
    put(keyOf(L("a")), 1, 60, 1, tight);
    noteContact(storageDir, AID, keyOf(L("a")), 1 + scale);
    noteContact(storageDir, AID, keyOf(L("a")), 1 + 2 * scale);
    put(keyOf(L("b")), 1 + 2 * scale + Math.round(lapse * scale), 60, 2, tight);
    return readCarryRecord(storageDir, AID, keyOf(L("a")))?.pending !== null;
  }

  test("RED: host cadence cancels — a hearth rolling 10× as often reads the same eligibility; CONTROL: a flat count would not", () => {
    const dirs = Array.from({ length: 4 }, () => mkdtempSync(join(tmpdir(), "hosting-carry-cadence-")));
    try {
      expect(marked(1, 3, dirs[0]!)).toBe(true);
      expect(marked(10, 3, dirs[1]!)).toBe(true);                                     // same behaviour, 10× rolls
      expect(marked(1, 1.5, dirs[2]!)).toBe(false);
      expect(marked(10, 1.5, dirs[3]!)).toBe(false);
      // CONTROL: the SAME absolute lapse (3 epochs) under the faster hearth is within that guest's rhythm.
      const flat = mkdtempSync(join(tmpdir(), "hosting-carry-flat-"));
      try { expect(marked(10, 0.3, flat)).toBe(false); } finally { rmSync(flat, { recursive: true, force: true }); }
    } finally { for (const d of dirs) rmSync(d, { recursive: true, force: true }); }
  });

  test("RED: the guest most lapsed FOR ITSELF is taken first, not the longest absolute lapse", () => {
    const limits = { perGuestBytes: 100, totalBytes: 150 };
    // A: rhythm 10, lapsed 50 epochs (5 rhythms). B: rhythm 1, lapsed 8 epochs (8 rhythms).
    put(keyOf(L("a")), 0, 50, 1, limits);
    noteContact(storageDir, AID, keyOf(L("a")), 10); noteContact(storageDir, AID, keyOf(L("a")), 20);
    put(keyOf(L("b")), 60, 50, 2, limits);
    for (const d of [61, 62]) noteContact(storageDir, AID, keyOf(L("b")), d);
    put(keyOf(L("c")), 70, 50, 3, limits);                                              // full
    expect(put(keyOf(L("d")), 70, 50, 4, limits)).toBe("pressure");
    expect(readCarryRecord(storageDir, AID, keyOf(L("b")))?.pending).toBe(70);          // most lapsed for itself
    expect(readCarryRecord(storageDir, AID, keyOf(L("a")))?.pending).toBeNull();        // one covers the need
  });

  test("CONTROL: a regular guest is never taken while a long-lapsed one stands — even past what it covers", () => {
    const limits = { perGuestBytes: 100, totalBytes: 100 };
    put(keyOf(L("a")), 1, 30, 1, limits);                                               // long-lapsed
    put(keyOf(L("r")), 1, 60, 2, limits);
    for (let d = 2; d <= 50; d++) noteContact(storageDir, AID, keyOf(L("r")), d);       // regular: every epoch
    expect(put(keyOf(L("n")), 50, 90, 3, limits)).toBe("pressure");
    expect(readCarryRecord(storageDir, AID, keyOf(L("a")))?.pending).toBe(50);
    expect(readCarryRecord(storageDir, AID, keyOf(L("r")))).toMatchObject({ bytes: 60, pending: null });
  });
});

describe("no enumerable guest set", () => {
  test("RED: the store holds no lineage, leaf or grant tag, and a record key needs the hearth's seed; CONTROL: the proven leaf's key reaches it", () => {
    const lineage = L("e"), leaf = L("f"), tag = L("9");
    put(keyOf(leaf), 1, 10, 1, { perGuestBytes: 100, totalBytes: 100 });
    const all = everything();
    for (const secret of [lineage, leaf, tag]) expect(all).not.toContain(secret);
    expect(readCarryRecord(storageDir, AID, carryRecordKey(new Uint8Array(32).fill(9), AID, leaf))).toBeNull();
    expect(readCarryRecord(storageDir, AID, keyOf(leaf))?.bytes).toBe(10);              // CONTROL
    expect(all).toContain(keyOf(leaf));                                                   // the scan sees what is there
  });
});

describe("through the sorter", () => {
  const SEEDS = [new Uint8Array(32).fill(1), new Uint8Array(32).fill(2), new Uint8Array(32).fill(3)];
  const GATE = "ee".repeat(32), NONCE = "ab".repeat(32);

  /** Mark a leaf's carriage pending at `depth`, as a reclaim would. */
  function markPending(leaf: string, depth: number): void {
    const rec = readCarryRecord(storageDir, AID, keyOf(leaf))!;
    writeFileSync(join(hostingDir(storageDir, AID), "carry", keyOf(leaf), "record.json"), JSON.stringify({ ...rec, pending: depth }));
  }
  async function readingNow(): Promise<CarriedNexusReading> {
    const keys = await Promise.all(SEEDS.map((s) => ed.getPublicKeyAsync(s).then(hex)));
    const roster: KahuQuorumSeats = { keys, threshold: 2, sealEpochCid: genesisSealEpochCid(keys, 2) };
    return { aid: AID, via: "consent", island: AID, roster, sealLineage: [], denyBoard: [], antigen: [], antigenRoster: roster, posture: "private" };
  }

  async function stand() {
    await rollHosting({ storageDir, nexusAid: AID, leafSeed: HEARTH });
    const reading = await readingNow();
    const sort = makeSocketSorter({
      readings: async () => [reading], carrier: () => false, primaryPosture: () => "private",
      hosting: { storageDir, leafSeedFor: async () => HEARTH },
    });
    const kp = await deriveNexusScopedKey(WALKER, 0, PERSONA_GLAMOUR_CONTEXT, AID);
    const leaf = { verifyingKey: kp.verifyingKey.toLowerCase(), seed: hexToBytes(kp.signingKey) };
    const vessel = await ed.getPublicKeyAsync(new Uint8Array(32).fill(63)).then(hex);
    const present = async (arm: UnsignedPresented) => sort({
      identifier: `0x${vessel}`, vesselKey: vessel, sameOperator: false,
      presented: await signPresented({ presented: arm, nonce: NONCE, gatePubKey: GATE, vesselKey: vessel, sign: async (m) => hex(await ed.signAsync(m, leaf.seed)) }),
      challenge: { nonce: NONCE, gatePubKey: GATE },
    });
    const token = mintHostToken(liveEpochs(readHostingState(storageDir, AID)!, HEARTH)!.current);
    const redeemed = await present({ kind: "token", nexusAid: AID, token, claim: redeemClaim(leaf.seed, token.n), leaf: leaf.verifyingKey });
    return { present, grant: redeemed!.grant!, leaf, token };
  }

  test("CONTROL: a renewed walker's carriage survives a roll", async () => {
    const { present, grant } = await stand();
    const doc = blob(40, 5);
    depositCarried({ storageDir, nexusAid: AID, key: keyOf(grant.leaf), depth: readHostingState(storageDir, AID)!.depth, ...doc });
    await rollHosting({ storageDir, nexusAid: AID, leafSeed: HEARTH });
    const renewed = (await present({ kind: "grant", grant }))!.grant!;
    expect(renewed.epoch).not.toBe(grant.epoch);
    expect(fetchCarried(storageDir, AID, keyOf(renewed.leaf), doc.cid)).not.toBeNull();
  });

  test("RED: a marked carriage's contact pushes the notice; CONTROL: an unmarked one pushes none", async () => {
    const { present, grant } = await stand();
    const depth = readHostingState(storageDir, AID)!.depth;
    depositCarried({ storageDir, nexusAid: AID, key: keyOf(grant.leaf), depth, ...blob(40, 5) });
    const quiet = await present({ kind: "grant", grant });
    expect(quiet?.class).toBe("walker");
    expect((quiet?.push ?? []).some((f) => f.kind === HOSTING_NOTICE_SESSION_KIND)).toBe(false);
    markPending(grant.leaf, depth);
    const noticed = await present({ kind: "grant", grant });
    expect(noticed?.class).toBe("walker");
    expect((noticed?.push ?? []).some((f) => f.kind === HOSTING_NOTICE_SESSION_KIND)).toBe(true);
  });

  test("RED: a dial alone delivers the notice — the token arm too, on a fresh lineage under the same leaf", async () => {
    const { present, grant, leaf } = await stand();
    depositCarried({ storageDir, nexusAid: AID, key: keyOf(grant.leaf), depth: readHostingState(storageDir, AID)!.depth, ...blob(40, 5) });
    // The grant lapses past two rolls, and pressure marks the lapsed guest's carriage in the hearth's epoch.
    await rollHosting({ storageDir, nexusAid: AID, leafSeed: HEARTH });
    await rollHosting({ storageDir, nexusAid: AID, leafSeed: HEARTH });
    markPending(grant.leaf, readHostingState(storageDir, AID)!.depth);
    // The guest walks back in on a fresh invite under the SAME leaf — no carry, no fetch, only the dial.
    const fresh = mintHostToken(liveEpochs(readHostingState(storageDir, AID)!, HEARTH)!.current);
    const back = await present({ kind: "token", nexusAid: AID, token: fresh, claim: redeemClaim(leaf.seed, fresh.n), leaf: leaf.verifyingKey });
    expect(back?.class).toBe("walker");
    expect(back!.grant!.lineage).not.toBe(grant.lineage);
    expect((back?.push ?? []).some((f) => f.kind === HOSTING_NOTICE_SESSION_KIND)).toBe(true);
    // The contact folded the guest's rhythm into the one record its leaf keys: no second record stands.
    expect(readdirSync(join(hostingDir(storageDir, AID), "carry"))).toEqual([keyOf(grant.leaf)]);
  });

  test("CONTROL: another leaf's dial touches no carriage and hears no notice", async () => {
    const { grant } = await stand();
    const depth = readHostingState(storageDir, AID)!.depth;
    depositCarried({ storageDir, nexusAid: AID, key: keyOf(grant.leaf), depth, ...blob(40, 5) });
    markPending(grant.leaf, depth);
    const before = readCarryRecord(storageDir, AID, keyOf(grant.leaf));
    // A second guest under its own leaf redeems its own invite at the same hearth.
    const kp = await deriveNexusScopedKey(new Uint8Array(32).fill(66), 0, PERSONA_GLAMOUR_CONTEXT, AID);
    const other = { verifyingKey: kp.verifyingKey.toLowerCase(), seed: hexToBytes(kp.signingKey) };
    const vessel = await ed.getPublicKeyAsync(new Uint8Array(32).fill(67)).then(hex);
    const token = mintHostToken(liveEpochs(readHostingState(storageDir, AID)!, HEARTH)!.current);
    const arm: UnsignedPresented = { kind: "token", nexusAid: AID, token, claim: redeemClaim(other.seed, token.n), leaf: other.verifyingKey };
    const sort = makeSocketSorter({
      readings: async () => [await readingNow()], carrier: () => false, primaryPosture: () => "private",
      hosting: { storageDir, leafSeedFor: async () => HEARTH },
    });
    const verdict = await sort({
      identifier: `0x${vessel}`, vesselKey: vessel, sameOperator: false,
      presented: await signPresented({ presented: arm, nonce: NONCE, gatePubKey: GATE, vesselKey: vessel, sign: async (m) => hex(await ed.signAsync(m, other.seed)) }),
      challenge: { nonce: NONCE, gatePubKey: GATE },
    });
    expect(verdict?.class).toBe("walker");
    expect((verdict?.push ?? []).some((f) => f.kind === HOSTING_NOTICE_SESSION_KIND)).toBe(false);
    expect(readCarryRecord(storageDir, AID, keyOf(grant.leaf))).toEqual(before);
  });
});

