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
 *
 * THE WALKER ROUTE SHIPS SHUT ("Routes at the cutover"). The vectors that rode the hearth's sorter — a renewed walker's
 * carriage surviving a roll, a marked carriage's contact pushing the notice on either arm, another leaf's dial touching
 * no carriage — retire with the walker arms they pinned (the gate sorts a grant or a claim as no walker; see
 * socket-sorter.test). The carry store's own laws above stand without a socket.
 */
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ed from "@noble/ed25519";
import {
  sealPrivateBody, openPrivateBody, authorizeAddress, readContentKey, ciphertextCid, walkCarriageBagId, walkCarryDocumentKey, sha256HexBytesSync,
  walkCarrySecret, carryRecordKey, hex,
  hexToBytes, PERSONA_GLAMOUR_CONTEXT, utf8Bytes,
} from "@lararium/mesh";
import { depositCarried, noteContact, fetchCarried, readCarryRecord, type CarryLimits } from "../src/hosting-carry.js";
import { rollHosting, readHostingState, hostingDir, hostingRowDir } from "../src/hosting-store.js";
import { writeCustodyRow } from "../src/custody-seat.js";

const AID = "nexus-" + "a".repeat(64);
const HEARTH = new Uint8Array(32).fill(61);
const WALKER = new Uint8Array(32).fill(62);
// Each case hosts under its own scratch root: the hosting rows rest sealed in that root's custody storage home.
let root = "";
let priorRoot: string | undefined;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "hosting-carry-")); priorRoot = process.env["LAR_ROOT"]; process.env["LAR_ROOT"] = root; });
afterEach(() => {
  if (priorRoot === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = priorRoot;
  rmSync(root, { recursive: true, force: true });
});

const keyOf = (leaf: string) => carryRecordKey(HEARTH, AID, leaf);
const L = (c: string) => c.repeat(64);
const bytes = (n: number, fill = 7) => new Uint8Array(n).fill(fill);
/** Distinct bytes of length `n` and their address. The hearth holds no key and reads no format: it carries
 *  whatever it can address, so opaque bytes stand in for a sealed value wherever only size and address matter. */
function blob(n: number, fill: number): { cid: string; ciphertext: Uint8Array } {
  const ciphertext = bytes(n, fill);
  return { cid: ciphertextCid(ciphertext), ciphertext };
}
function put(key: string, depth: number, n: number, fill: number, limits: CarryLimits) {
  return depositCarried({ nexusAid: AID, key, depth, ...blob(n, fill), limits });
}
/** Every name and every byte of every file under the hosting dir, as latin1 text. */
async function everything(): Promise<string> {
  const out: string[] = [];
  const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); out.push(f); if (statSync(p).isDirectory()) walk(p); else out.push(readFileSync(p, "latin1")); } };
  walk((await hostingDir(AID)));
  return out.join("\n");
}

/** A synthetic walker's key at the Nexus: its 32 bytes ARE the key, as a per-Nexus key mints at random. */
const randomKeyOf = async (seed: Uint8Array): Promise<{ signingKey: string; verifyingKey: string }> =>
  ({ signingKey: Buffer.from(seed).toString("hex"), verifyingKey: Buffer.from(await import("@noble/ed25519").then((m) => m.getPublicKeyAsync(seed))).toString("hex") });

describe("carry ⊥ read", () => {
  test("RED: the hearth holds no plaintext and nothing it holds opens the bytes; CONTROL: the receipt does", async () => {
    const plaintext = utf8Bytes("the walker's own private notes — never the hearth's to read");
    const bagId = walkCarriageBagId(AID, sha256HexBytesSync(plaintext));
    const walkerKey = readContentKey(walkCarryDocumentKey(WALKER, AID, sha256HexBytesSync(plaintext)))!;
    const r = sealPrivateBody(plaintext, { bagId, key: walkerKey });
    if (!("body" in r)) throw new Error(r.refusal);
    const sealed = r.body;
    expect(await depositCarried({ nexusAid: AID, key: keyOf(L("1")), depth: 1, cid: sealed.cid, ciphertext: sealed.ciphertext })).toBe("held");
    const stored = await fetchCarried(AID, keyOf(L("1")), sealed.cid)!;
    expect(await everything()).not.toContain("private notes");
    const openWith = (key: Uint8Array): string => {
      const opened = openPrivateBody({ ciphertext: stored, under: { bagId, key: readContentKey(key)! }, ref: sealed.ref, authorized: authorizeAddress(sealed.cid, "own-receipt")! });
      return "plaintext" in opened ? hex(opened.plaintext) : `REFUSED ${opened.refusal}`;
    };
    // What the hearth holds — its own leaf seed, the record key, and anything derived the walker's way from them —
    // opens nothing, by name. And a guessed plaintext CONFIRMS nothing: every seal draws fresh, so even the
    // walker's own key seals the same document to another address.
    for (const guess of [HEARTH, walkCarrySecret(HEARTH, AID), hexToBytes(keyOf(L("1"))), walkCarrySecret(hexToBytes(keyOf(L("1"))), AID)]) {
      expect(openWith(guess)).toBe("REFUSED version-mismatch");
      const again = sealPrivateBody(plaintext, { bagId, key: readContentKey(guess)! });
      expect("body" in again && again.body.cid).not.toBe(sealed.cid);
    }
    const twin = sealPrivateBody(plaintext, { bagId, key: walkerKey });
    expect("body" in twin && twin.body.cid).not.toBe(sealed.cid);
    expect(openWith(walkerKey)).toBe(hex(plaintext));                                   // CONTROL
  });
});

describe("the quota", () => {
  test("RED: a grant's deposit past its bound is refused; CONTROL: within it, held", async () => {
    const limits = { perGuestBytes: 100, totalBytes: 10_000 };
    expect(await put(keyOf(L("1")), 1, 80, 1, limits)).toBe("held");
    expect(await put(keyOf(L("1")), 1, 30, 2, limits)).toBe("quota");
    expect(await put(keyOf(L("1")), 1, 20, 3, limits)).toBe("held");
    expect((await readCarryRecord(AID, keyOf(L("1"))))?.bytes).toBe(100);
  });
});

describe("reclaim — pressure the only trigger, the guest's own rhythm the measure, notice before discard", () => {
  const roomy = { perGuestBytes: 100, totalBytes: 1_000 };
  const tight = { perGuestBytes: 100, totalBytes: 100 };

  test("RED: no eviction without pressure; CONTROL: under pressure the same guest is marked", async () => {
    expect(await put(keyOf(L("a")), 1, 60, 1, roomy)).toBe("held");
    expect(await put(keyOf(L("b")), 500, 60, 2, roomy)).toBe("held");                     // A lapsed 499 epochs
    expect((await readCarryRecord(AID, keyOf(L("a"))))).toMatchObject({ bytes: 60, pending: null });
    expect(await put(keyOf(L("c")), 500, 60, 3, tight)).toBe("pressure");
    expect((await readCarryRecord(AID, keyOf(L("a"))))).toMatchObject({ bytes: 60, pending: 500 });
  });

  test("RED: pressure first only MARKS; the contact hears the notice; a renewal clears it and nothing is discarded", async () => {
    const a = blob(60, 1);
    expect(await depositCarried({ nexusAid: AID, key: keyOf(L("a")), depth: 1, ...a, limits: tight })).toBe("held");
    for (const d of [2, 3]) await noteContact(AID, keyOf(L("a")), d);         // rhythm: every epoch
    expect(await put(keyOf(L("b")), 10, 60, 2, tight)).toBe("pressure");
    expect((await readCarryRecord(AID, keyOf(L("a"))))).toMatchObject({ bytes: 60, pending: 10 });
    expect(await fetchCarried(AID, keyOf(L("a")), a.cid)).not.toBeNull();     // marked, not discarded
    expect((await noteContact(AID, keyOf(L("a")), 10)).notice).toBe(true);       // the contact hears it
    expect((await noteContact(AID, keyOf(L("a")), 11)).notice).toBe(false);      // a renewal clears it
    expect((await readCarryRecord(AID, keyOf(L("a"))))?.pending).toBeNull();
    expect(await put(keyOf(L("b")), 12, 60, 2, tight)).toBe("pressure");                   // A within its rhythm: kept
    expect(await fetchCarried(AID, keyOf(L("a")), a.cid)).not.toBeNull();
  });

  test("CONTROL: a mark that stood unrenewed through the guest's own threshold again is discarded", async () => {
    const a = blob(60, 1);
    await depositCarried({ nexusAid: AID, key: keyOf(L("a")), depth: 1, ...a, limits: tight });
    for (const d of [2, 3]) await noteContact(AID, keyOf(L("a")), d);
    expect(await put(keyOf(L("b")), 10, 60, 2, tight)).toBe("pressure");                   // marked at 10
    expect(await put(keyOf(L("b")), 12, 60, 2, tight)).toBe("pressure");                   // 2 rhythms since: not yet
    expect(await fetchCarried(AID, keyOf(L("a")), a.cid)).not.toBeNull();
    expect(await put(keyOf(L("b")), 13, 60, 2, tight)).toBe("held");                       // past it: discarded
    expect(await fetchCarried(AID, keyOf(L("a")), a.cid)).toBeNull();
    expect((await readCarryRecord(AID, keyOf(L("a"))))?.bytes).toBe(0);
  });

  /** One guest A with a rhythm of `scale` epochs, lapsed `lapse` rhythms, under pressure from B. Marked? */
  async function marked(scale: number, lapse: number, dir: string): Promise<boolean> {
    process.env["LAR_ROOT"] = dir;
    await put(keyOf(L("a")), 1, 60, 1, tight);
    await noteContact(AID, keyOf(L("a")), 1 + scale);
    await noteContact(AID, keyOf(L("a")), 1 + 2 * scale);
    await put(keyOf(L("b")), 1 + 2 * scale + Math.round(lapse * scale), 60, 2, tight);
    return (await readCarryRecord(AID, keyOf(L("a"))))?.pending !== null;
  }

  test("RED: host cadence cancels — a hearth rolling 10× as often reads the same eligibility; CONTROL: a flat count would not", async () => {
    const dirs = Array.from({ length: 4 }, () => mkdtempSync(join(tmpdir(), "hosting-carry-cadence-")));
    try {
      expect(await marked(1, 3, dirs[0]!)).toBe(true);
      expect(await marked(10, 3, dirs[1]!)).toBe(true);                                     // same behaviour, 10× rolls
      expect(await marked(1, 1.5, dirs[2]!)).toBe(false);
      expect(await marked(10, 1.5, dirs[3]!)).toBe(false);
      // CONTROL: the SAME absolute lapse (3 epochs) under the faster hearth is within that guest's rhythm.
      const flat = mkdtempSync(join(tmpdir(), "hosting-carry-flat-"));
      try { expect(await marked(10, 0.3, flat)).toBe(false); } finally { rmSync(flat, { recursive: true, force: true }); }
    } finally { for (const d of dirs) rmSync(d, { recursive: true, force: true }); }
  });

  test("RED: the guest most lapsed FOR ITSELF is taken first, not the longest absolute lapse", async () => {
    const limits = { perGuestBytes: 100, totalBytes: 150 };
    // A: rhythm 10, lapsed 50 epochs (5 rhythms). B: rhythm 1, lapsed 8 epochs (8 rhythms).
    await put(keyOf(L("a")), 0, 50, 1, limits);
    await noteContact(AID, keyOf(L("a")), 10); await noteContact(AID, keyOf(L("a")), 20);
    await put(keyOf(L("b")), 60, 50, 2, limits);
    for (const d of [61, 62]) await noteContact(AID, keyOf(L("b")), d);
    await put(keyOf(L("c")), 70, 50, 3, limits);                                              // full
    expect(await put(keyOf(L("d")), 70, 50, 4, limits)).toBe("pressure");
    expect((await readCarryRecord(AID, keyOf(L("b"))))?.pending).toBe(70);          // most lapsed for itself
    expect((await readCarryRecord(AID, keyOf(L("a"))))?.pending).toBeNull();        // one covers the need
  });

  test("CONTROL: a regular guest is never taken while a long-lapsed one stands — even past what it covers", async () => {
    const limits = { perGuestBytes: 100, totalBytes: 100 };
    await put(keyOf(L("a")), 1, 30, 1, limits);                                               // long-lapsed
    await put(keyOf(L("r")), 1, 60, 2, limits);
    for (let d = 2; d <= 50; d++) await noteContact(AID, keyOf(L("r")), d);       // regular: every epoch
    expect(await put(keyOf(L("n")), 50, 90, 3, limits)).toBe("pressure");
    expect((await readCarryRecord(AID, keyOf(L("a"))))?.pending).toBe(50);
    expect((await readCarryRecord(AID, keyOf(L("r"))))).toMatchObject({ bytes: 60, pending: null });
  });
});

describe("no enumerable guest set", () => {
  test("RED: the store holds no lineage, leaf or grant tag, and a record key needs the hearth's seed; CONTROL: the proven leaf's key reaches it", async () => {
    const lineage = L("e"), leaf = L("f"), tag = L("9");
    await put(keyOf(leaf), 1, 10, 1, { perGuestBytes: 100, totalBytes: 100 });
    const all = await everything();
    for (const secret of [lineage, leaf, tag]) expect(all).not.toContain(secret);
    expect((await readCarryRecord(AID, carryRecordKey(new Uint8Array(32).fill(9), AID, leaf)))).toBeNull();
    expect((await readCarryRecord(AID, keyOf(leaf)))?.bytes).toBe(10);              // CONTROL
    expect(all).toContain(keyOf(leaf));                                                   // the scan sees what is there
  });
});
