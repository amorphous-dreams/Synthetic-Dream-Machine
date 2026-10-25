/**
 * hosting-carry-sealed — a hearth's carriage rests as custody rows, and its count reads the rows standing.
 *
 *   K1  RED: EVERY CARRIAGE ROW RESTS SEALED. The guest's rhythm row and each blob row read as face-key-sealed frames;
 *       no file's bytes spell the walker's ciphertext or the rhythm's fields; a blob's name carries its address
 *       digest and its length. The parent commit's store wrote the ciphertext as it arrived and the record as JSON.
 *                                                 control: the fetch answers the deposited bytes
 *   K2  THE BLOB ROW COMMITS, AND THE COUNT RE-DERIVES. A deposit that stood its rhythm row and stopped before its
 *       blob counts nothing, and the same deposit again lands; a blob that leaves lowers the count with no record
 *       write; no counter stands ahead of the rows.
 *   K3  RED: A WRONG KEY CARRIES NOTHING AND HANDS OUT NOTHING. A rhythm row another face sealed refuses the
 *       contact, the deposit and the read by name; a blob row another face sealed refuses the fetch by name (it
 *       never reads as "carries nothing"); the bytes stay.
 *   K4  RED: a rhythm row that opens to another shape refuses by name.
 *   K5  RED: THE FLOOR READS NO CARRIAGE ROW: a locked seat refuses the read, the contact, the deposit and the fetch.
 *   K6  DEPOSITS RUN IN TURN: two that start together under a quota that fits one hold one and refuse one.
 *   K7  an address outside `blake3:<64 hex>` fetches nothing and deposits nothing.
 *   K8  RED: a deposit of a value whose row stands and does not open, or opens to other bytes, refuses by name: it
 *       never answers `held` for bytes nobody can fetch.
 *   K9  THE CARRIAGE'S ACTS RUN IN TURN: a contact that starts while a deposit runs settles after it, so a reclaim
 *       never discards on a reading a contact moved meanwhile.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { carryRecordKey, ciphertextCid, readFckCarrier } from "@lararium/mesh";
import { CustodyLocked, CustodyRowUnavailable } from "../src/custody-holder.js";
import { writeCustodyRow } from "../src/custody-seat.js";
import { depositCarried, fetchCarried, noteContact, readCarryRecord, type CarryLimits } from "../src/hosting-carry.js";

import { hostingDirPath, hostingRowDir } from "../src/hosting-face.js";
import { seatHostingCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";

const AID = "nexus-" + "a".repeat(64);
const HEARTH = new Uint8Array(32).fill(61);
const KEY = carryRecordKey(HEARTH, AID, "c".repeat(64));
const ROOMY: CarryLimits = { perGuestBytes: 1_000, totalBytes: 10_000 };
/** Distinct bytes of length `n` and their address: opaque bytes stand in for a walker's sealed value. */
function blob(n: number, fill: number): { cid: string; ciphertext: Uint8Array } {
  const ciphertext = new Uint8Array(n).fill(fill);
  return { cid: ciphertextCid(ciphertext), ciphertext };
}
const put = (b: { cid: string; ciphertext: Uint8Array }, depth = 1, limits = ROOMY, key = KEY) =>
  depositCarried({ nexusAid: AID, key, depth, ...b, limits });
const rhythmRow = (key = KEY): string => `${hostingRowDir(0, AID)}/carry/${key}/record.json`;
const enc = (v: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(v));

const drops: Array<() => Promise<void>> = [];
afterEach(async () => { for (const drop of drops.splice(0).reverse()) await drop(); });
async function custody(label: string): Promise<SeatedScratchCustody> {
  const c = await seatHostingCustody(label);
  drops.push(() => c.drop());
  return c;
}
const refusal = async (act: Promise<unknown>): Promise<unknown> => act.then((v) => `landed ${String(v)}`, (e: unknown) => e);
const guestDir = async (key = KEY): Promise<string> => join(hostingDirPath(0, AID)!, "carry", key);
const blobNames = async (): Promise<string[]> => readdirSync(join(await guestDir(), "blobs")).sort();
async function filesUnder(dir: string): Promise<string[]> {
  const out: string[] = [];
  const walk = (d: string): void => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else out.push(p); } };
  walk(dir);
  return out.sort();
}

describe("the carriage at rest", () => {
  test("K1 — the rhythm and each blob rest sealed, and no file spells the ciphertext or the rhythm", async () => {
    await custody("carry-k1");
    const a = blob(96, 0x41);                                                       // ninety-six letter A bytes: findable if stored as they came
    expect(await put(a, 7)).toBe("held");
    const files = await filesUnder(await guestDir());
    expect(files.map((f) => f.slice((dirname(f)).length + 1)).sort()).toEqual([`${a.cid.slice("blake3:".length)}.96`, "record.json"].sort());
    for (const f of files) {
      const bytes = readFileSync(f);
      expect(readFckCarrier(bytes), f).toBe("sealed");
      expect(bytes.includes(Buffer.from(a.ciphertext.subarray(0, 32))), "the ciphertext as it arrived").toBe(false);
      for (const field of ["lastSeen", "pending", "gap"]) expect(bytes.includes(Buffer.from(field)), field).toBe(false);
    }
    expect(Buffer.from((await fetchCarried(AID, KEY, a.cid))!).equals(Buffer.from(a.ciphertext))).toBe(true);   // CONTROL
    expect(await readCarryRecord(AID, KEY)).toEqual({ lastSeen: 7, gap: 0, pending: null, bytes: 96 });
    expect(await put(a, 9)).toBe("held");                                           // the same value again: idempotent, one row
    expect(await put(a, 9, { perGuestBytes: 100, totalBytes: 10_000 })).toBe("held");   // and it counts once against the quota
    expect(await blobNames()).toHaveLength(1);
    // A contact from a guest this hearth carries nothing for hears no notice and stands no directory.
    const stranger = carryRecordKey(HEARTH, AID, "d".repeat(64));
    expect(await noteContact(AID, stranger, 9)).toEqual({ notice: false });
    expect(existsSync(await guestDir(stranger))).toBe(false);
    expect(await readCarryRecord(AID, stranger)).toBeNull();
  });

  test("K2 — the blob row commits the deposit, and the count reads the rows standing", async () => {
    await custody("carry-k2");
    // A deposit stood its rhythm row and stopped before its blob: it counts nothing, and no value answers.
    mkdirSync(join(await guestDir(), "blobs"), { recursive: true });
    await writeCustodyRow("identity", rhythmRow(), enc({ lastSeen: 3, gap: 0, pending: null }));
    const a = blob(60, 1), b = blob(30, 2);
    expect(await readCarryRecord(AID, KEY)).toMatchObject({ bytes: 0 });
    expect(await fetchCarried(AID, KEY, a.cid)).toBeNull();
    expect(await put(a, 4)).toBe("held");                                           // the same deposit again lands
    expect(await put(b, 4)).toBe("held");
    expect(await readCarryRecord(AID, KEY)).toMatchObject({ bytes: 90, lastSeen: 3 });   // a deposit counts, and moves no rhythm
    // A blob leaves with no write to the rhythm row: the count follows the rows, and the quota opens again.
    const rhythm = readFileSync(join(await guestDir(), "record.json"));
    rmSync(join(await guestDir(), "blobs", `${a.cid.slice("blake3:".length)}.60`));
    expect(await readCarryRecord(AID, KEY)).toMatchObject({ bytes: 30 });
    expect(readFileSync(join(await guestDir(), "record.json")).equals(rhythm)).toBe(true);
    expect(await put(blob(70, 3), 4, { perGuestBytes: 100, totalBytes: 10_000 })).toBe("held");
    expect(await put(blob(1, 4), 4, { perGuestBytes: 100, totalBytes: 10_000 })).toBe("quota");
  });

  test("K3 — a wrong key carries nothing and hands out nothing", async () => {
    const b = await custody("carry-k3-b");
    const a = await custody("carry-k3-a");
    const as = (c: SeatedScratchCustody): void => { process.env["LAR_ROOT"] = c.root; };
    const doc = blob(40, 5);
    as(b);
    expect(await put(doc)).toBe("held");
    const bDir = await guestDir();
    as(a);
    expect(await put(doc)).toBe("held");
    const aDir = await guestDir();
    const name = `${doc.cid.slice("blake3:".length)}.40`;
    expect(readFileSync(join(aDir, "blobs", name)).equals(readFileSync(join(bDir, "blobs", name)))).toBe(false);   // two keys, two encodings
    // B's blob at A's path: the fetch refuses by name, where a null would read as "this hearth carries nothing".
    copyFileSync(join(bDir, "blobs", name), join(aDir, "blobs", name));
    const fetched = await refusal(fetchCarried(AID, KEY, doc.cid));
    expect(fetched).toBeInstanceOf(CustodyRowUnavailable);
    expect(fetched).toMatchObject({ home: "identity", file: `${hostingRowDir(0, AID)}/carry/${KEY}/blobs/${name}` });
    // B's rhythm row at A's path: nothing reads, counts a contact or lands a deposit over it.
    copyFileSync(join(bDir, "record.json"), join(aDir, "record.json"));
    const foreign = readFileSync(join(aDir, "record.json"));
    expect(await refusal(readCarryRecord(AID, KEY))).toBeInstanceOf(CustodyRowUnavailable);
    expect(await refusal(noteContact(AID, KEY, 9))).toBeInstanceOf(CustodyRowUnavailable);
    expect(await refusal(put(blob(10, 6)))).toBeInstanceOf(CustodyRowUnavailable);
    expect(readFileSync(join(aDir, "record.json")).equals(foreign)).toBe(true);
    expect(readdirSync(join(aDir, "blobs"))).toEqual([name]);
  });

  test("K4 — a rhythm row that opens to another shape refuses by name", async () => {
    await custody("carry-k4");
    expect(await put(blob(10, 1))).toBe("held");
    for (const shape of [{ lastSeen: 1, gap: 0 }, { lastSeen: -1, gap: 0, pending: null }, { lastSeen: 1, gap: "0", pending: null },
      { lastSeen: 1, gap: 0, pending: 1.5 }, { lastSeen: 1, gap: 0, pending: null, bytes: 10 }, [1], "x"]) {
      await writeCustodyRow("identity", rhythmRow(), enc(shape));
      expect(await refusal(readCarryRecord(AID, KEY)), JSON.stringify(shape)).toMatchObject({ reading: "malformed" });
      expect(await refusal(noteContact(AID, KEY, 2))).toMatchObject({ reading: "malformed" });
    }
    await writeCustodyRow("identity", rhythmRow(), enc({ lastSeen: 1, gap: 0, pending: null }));   // control: the true shape reads again
    expect(await readCarryRecord(AID, KEY)).toMatchObject({ bytes: 10 });
  });

  test("K5 — the floor reads no carriage row", async () => {
    const c = await custody("carry-k5");
    const doc = blob(20, 2);
    expect(await put(doc)).toBe("held");
    const before = (await filesUnder(await guestDir())).map((f) => readFileSync(f));
    const dir = await guestDir();
    await c.holder.lock();
    expect(await refusal(readCarryRecord(AID, KEY))).toBeInstanceOf(CustodyLocked);
    expect(await refusal(noteContact(AID, KEY, 5))).toBeInstanceOf(CustodyLocked);
    expect(await refusal(put(blob(5, 3)))).toBeInstanceOf(CustodyLocked);
    expect(await refusal(fetchCarried(AID, KEY, doc.cid))).toBeInstanceOf(CustodyLocked);
    await c.holder.adopt(c.vk);
    const after = (await filesUnder(dir)).map((f) => readFileSync(f));
    expect(after.length).toBe(before.length);
    for (let i = 0; i < after.length; i++) expect(after[i]!.equals(before[i]!)).toBe(true);
  });

  test("K6 — two deposits that start together under a quota that fits one hold one and refuse one", async () => {
    await custody("carry-k6");
    const tight: CarryLimits = { perGuestBytes: 100, totalBytes: 10_000 };
    const outcomes = await Promise.all([put(blob(60, 1), 1, tight), put(blob(60, 2), 1, tight)]);
    expect(outcomes).toEqual(["held", "quota"]);
    expect(await readCarryRecord(AID, KEY)).toMatchObject({ bytes: 60 });
  });

  test("K8 — a deposit of a value whose row does not open refuses by name; it never answers held", async () => {
    const b = await custody("carry-k8-b");
    const a = await custody("carry-k8-a");
    const doc = blob(40, 5);
    const name = `${doc.cid.slice("blake3:".length)}.40`;
    process.env["LAR_ROOT"] = b.root;
    expect(await put(doc)).toBe("held");
    const bBlob = join(await guestDir(), "blobs", name);
    process.env["LAR_ROOT"] = a.root;
    expect(await put(doc)).toBe("held");
    expect(await put(doc)).toBe("held");                                            // CONTROL: its own row answers held
    copyFileSync(bBlob, join(await guestDir(), "blobs", name));                     // a row another face sealed, under the same name
    const again = await refusal(put(doc));
    expect(again).toBeInstanceOf(CustodyRowUnavailable);
    expect(again).toMatchObject({ home: "identity", file: `${hostingRowDir(0, AID)}/carry/${KEY}/blobs/${name}` });
    // A row this vessel's key opens to OTHER bytes than its address names refuses too.
    rmSync(join(await guestDir(), "blobs", name));
    await writeCustodyRow("identity", `${hostingRowDir(0, AID)}/carry/${KEY}/blobs/${name}`, new Uint8Array(40).fill(6));
    expect(await refusal(put(doc))).toMatchObject({ reading: "holds other bytes than its address names" });
  });

  test("K9 — a contact that starts while a deposit runs waits for it: the carriage's acts run in turn", async () => {
    await custody("carry-k9");
    expect(await put(blob(10, 1), 1)).toBe("held");
    const order: string[] = [];
    // The deposit starts first and takes more steps than a contact; the contact still settles after it.
    await Promise.all([
      put(blob(10, 2), 2).then(() => { order.push("deposit"); }),
      noteContact(AID, KEY, 3).then(() => { order.push("contact"); }),
      put(blob(10, 3), 4).then(() => { order.push("second deposit"); }),
    ]);
    expect(order).toEqual(["deposit", "contact", "second deposit"]);
    expect(await readCarryRecord(AID, KEY)).toMatchObject({ bytes: 30, lastSeen: 3 });
  });

  test("K7 — an address outside the one spelling fetches nothing and deposits nothing", async () => {
    await custody("carry-k7");
    const doc = blob(20, 2);
    for (const cid of [doc.cid.slice("blake3:".length), `blake3:${"Z".repeat(64)}`, "blake3:../../state.json", ""]) {
      expect(await fetchCarried(AID, KEY, cid)).toBeNull();
      expect(String(await refusal(depositCarried({ nexusAid: AID, key: KEY, depth: 1, cid, ciphertext: doc.ciphertext })))).toMatch(/address reads/);
    }
    expect(await fetchCarried(AID, "../escape", doc.cid)).toBeNull();
    expect(String(await refusal(put(doc, 1, ROOMY, "../escape")))).toMatch(/names no carriage row/);
    expect(existsSync(join(hostingDirPath(0, AID)!, "carry"))).toBe(false);
  });
});
