/**
 * gate-memory-rows — a sovereign gate's withdrawal memory rests in sealed rows of its own vessel, behind the
 * custody seat's one-holder update door.
 *
 * Every vector runs through the REAL door on a founded scratch root (`seatScratchCustody`).
 *
 *   M1  learn, restart, still deny: a gate over the real door learns a withdrawal; a second holder opens the same
 *       tree, a new gate stands over a new door, and it still denies.     control: a fresh vessel admits (it knows nothing)
 *   M2  the row at rest names no face key: its file answers to a digest, reads `sealed`, and holds no face key
 *       in its bytes.                                                      control: the opened row names the face key
 *   M3  a locked holder refuses by name at the read and at the write, and writes nothing.
 *   M4  TAMPER: a row sealed under a SECOND face key refuses at the read and at the write, and its bytes never
 *       move.                                                              control: the row's own key reads and writes it
 *   M5  a name outside the digest spelling, an empty row and a row past the bound refuse before the seat hears.
 *   M6  the carrier table names the face row, and the face census lists it once it stands.
 *   M7  the law's own sentence holds: an older copy of a row, restored by hand, makes the gate forget.
 *   M8  a write only accretes: a writer that joined against an older view refuses and the row keeps its bytes;
 *       two gates of one composition share ONE door; bytes that read as no list refuse, and a standing row that
 *       opens to no list refuses `malformed`.                             control: a superset lands in any key order; a new holder gets a new door
 *   M9  the store recovers from a refused write: it drops its view and verifies the row again, so a read after
 *       the refusal answers what the row holds.                           control: before the refusal the view read stale
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { GATE_MEMORY_ROW_MAX_BYTES, readFckCarrier, bindSlot, commitSlotTree, mintTreeKey } from "@lararium/mesh";
import { canonicalJsonBytes } from "../../lararium-mesh/src/crypto.js";
import { faceProofSubjectRef, withdrawalHead } from "../../lararium-mesh/src/face-proof-subjects.js";
import { storedWithdrawals } from "../../lararium-mesh/src/gate-withdrawal-store.js";
import { dial, memoryOf, presenter, sibling, world } from "../../lararium-mesh/tests/face-gate-fixture.js";
import { chain, history } from "../../lararium-mesh/tests/face-proof-fixture.js";
import { FsCustodyIo } from "../src/custody-io.js";
import { CustodyLocked, CustodyRowUnavailable, FaceLocked, makeCustodyHolder } from "../src/custody-holder.js";
import { seatCustody } from "../src/custody-seat.js";
import { GateMemoryRowRefused, gateMemoryRowFile, gateMemoryRows } from "../src/gate-memory-rows.js";
import { carrierTable, sSealedCarriers } from "../src/vault-carriers.js";
import { seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";
import { handleRowPathIn, faceRowNames } from "./face-paths.js";
import { readFaceIndexSync, findFace } from "../src/face-index.js";
import { FIXTURE_PASSPHRASE } from "./custody-seat-fixture.js";

vi.setConfig({ testTimeout: 180_000, hookTimeout: 180_000 });

const drops: SeatedScratchCustody[] = [];
async function vessel(label: string): Promise<SeatedScratchCustody> {
  const c = await seatScratchCustody(label);
  drops.push(c);
  return c;
}
afterEach(async () => { for (const c of drops.splice(0).reverse()) await c.drop(); });

const NAME = "ab".repeat(32);
const text = (s: string): Uint8Array => new TextEncoder().encode(s);
const rowPath = (c: SeatedScratchCustody, name: string, face = 0): string => handleRowPathIn(c.homes.identity, gateMemoryRowFile(face, name));

/** A gate world over the real door, a presenter whose sibling stands withdrawn, and the events that say so. */
async function learned(label: string) {
  const w = await world({ withdrawals: storedWithdrawals(gateMemoryRows(0)) });
  const honest = await presenter(w, label);
  const gone = await sibling(honest, `${label} gone`);
  const events = await history(honest.chain, [gone.vessel.key]);
  honest.history = memoryOf(honest.scope, events);
  return { w, honest, gone, events };
}

describe("a gate's memory behind the custody seat", () => {
  test("a withdrawal belongs to its gate face; another unlocked face sees none and a locked face refuses", async () => {
    const c = await vessel("gm-faces");
    const owner = await chain("two-face", "nexus-a.synthetic");
    const gone = await chain("two-face-gone", "nexus-a.synthetic");
    const name = faceProofSubjectRef(owner.scope);
    const events = await history(owner, [gone.vessel.key]);
    await gateMemoryRows(0).write(name, canonicalJsonBytes(events));
    await gateMemoryRows(1).write("cd".repeat(32), text("[]")); // found and unlock B
    expect(await gateMemoryRows(1).read(name)).toBeNull();
    expect(JSON.parse(new TextDecoder().decode((await gateMemoryRows(0).read(name))!))).toEqual(events);
    const b = findFace(readFaceIndexSync(c.homes.identity), { ordinal: 1 })!;
    await c.holder.lockFace(b.fcid);
    await expect(gateMemoryRows(1).read("cd".repeat(32))).rejects.toBeInstanceOf(FaceLocked);
    await c.holder.unlockFace({ ordinal: 1 }, [{ kind: "passphrase", passphrase: FIXTURE_PASSPHRASE }]);
  });
  test("M1 — learn, restart, still deny, through the real door; a fresh vessel knows nothing", async () => {
    const c = await vessel("gm-m1");
    const { w, honest, gone } = await learned("m1");
    expect((await dial(w, honest)).gate).toEqual({ outcome: "attached", class: "contracted" });
    expect((await dial(w, gone)).gate).toEqual({ outcome: "answered", state: "withdrawn" });
    expect(existsSync(rowPath(c, faceProofSubjectRef(honest.scope)))).toBe(true);

    // THE PROCESS ENDS: the holder drops its key, a second holder opens the same tree, and a new gate stands
    // over a new door. Nothing but the sealed row carries the memory across.
    await c.holder.lock();
    const again = makeCustodyHolder({ io: new FsCustodyIo(c.homes), homes: c.homes });
    await again.adopt(c.treeKey);
    await again.unlockFace({ ordinal: 0 }, [{ kind: "passphrase", passphrase: FIXTURE_PASSPHRASE }]);
    seatCustody(again);
    const after = await world({ withdrawals: storedWithdrawals(gateMemoryRows(0)) });
    expect((await dial(after, gone)).gate).toEqual({ outcome: "answered", state: "withdrawn" });
    await again.lock();
    seatCustody(c.holder);

    // CONTROL: another vessel's gate holds no such row and admits the withdrawn vessel (the named leak).
    await vessel("gm-m1-fresh");
    const fresh = await world({ withdrawals: storedWithdrawals(gateMemoryRows(0)) });
    expect((await dial(fresh, gone)).gate).toEqual({ outcome: "attached", class: "contracted" });
  });

  test("M2 — the row at rest names no face key", async () => {
    const c = await vessel("gm-m2");
    const { w, honest, gone } = await learned("m2");
    await dial(w, honest);
    const name = faceProofSubjectRef(honest.scope);
    expect(faceRowNames()).toContain(gateMemoryRowFile(0, name));
    const resting = readFileSync(rowPath(c, name));
    expect(readFckCarrier(resting)).toBe("sealed");
    const faceKey: string = honest.scope.faceKey;
    expect(faceKey.length).toBeGreaterThan(16);
    expect(resting.includes(Buffer.from(faceKey, "utf8"))).toBe(false);
    expect(resting.includes(Buffer.from(faceKey, "hex"))).toBe(false);
    expect(name.includes(faceKey)).toBe(false);
    // CONTROL: the opened row names the face key, so the search above reads a real difference.
    const opened = Buffer.from((await gateMemoryRows(0).read(name))!);
    expect(opened.includes(Buffer.from(faceKey, "utf8"))).toBe(true);
    void gone;
  });

  test("M3 — a locked holder refuses by name and writes nothing", async () => {
    const c = await vessel("gm-m3");
    const rows = gateMemoryRows(0);
    await rows.write(NAME, text("[1]"));
    const before = readFileSync(rowPath(c, NAME));
    await c.holder.lock();
    await expect(rows.read(NAME)).rejects.toBeInstanceOf(CustodyLocked);
    await expect(rows.write(NAME, text("[1,2]"))).rejects.toBeInstanceOf(CustodyLocked);
    await expect(rows.write("cd".repeat(32), text("[1]"))).rejects.toBeInstanceOf(CustodyLocked);
    expect(readFileSync(rowPath(c, NAME)).equals(before)).toBe(true);
    expect(existsSync(rowPath(c, "cd".repeat(32)))).toBe(false);
    // A home with no seat at all reads the same.
    seatCustody(null);
    await expect(rows.read(NAME)).rejects.toBeInstanceOf(CustodyLocked);
    seatCustody(c.holder);
    await c.holder.adopt(c.treeKey);
    await c.holder.unlockFace({ ordinal: 0 }, [{ kind: "passphrase", passphrase: FIXTURE_PASSPHRASE }]);
    expect(new TextDecoder().decode((await rows.read(NAME))!)).toBe("[1]");                 // CONTROL: unlocked, the row reads whole
  });

  test("M4 — TAMPER: a row sealed under a second face key refuses at both doors and never moves", async () => {
    const c = await vessel("gm-m4");
    const rows = gateMemoryRows(0);
    await rows.write(NAME, text("[\"mine\"]"));
    const mine = readFileSync(rowPath(c, NAME));
    // Seal the SAME carrier name under ANOTHER face key, in a vessel of its own, and lay those bytes over the row.
    const other = await seatScratchCustody("gm-m4-alien");
    await gateMemoryRows(0).write(NAME, text("[\"alien\"]"));
    const alien = readFileSync(handleRowPathIn(other.homes.identity, gateMemoryRowFile(0, NAME)));
    await other.drop();
    expect(readFckCarrier(alien)).toBe("sealed");
    expect(alien.equals(mine)).toBe(false);                                                 // the probe moved the encoded bytes …
    writeFileSync(rowPath(c, NAME), alien);
    // … and the decoded ones: the row no longer opens under this vessel's key.
    const read = await rows.read(NAME).catch((e: unknown) => e);
    expect(read).toBeInstanceOf(CustodyRowUnavailable);
    expect((read as CustodyRowUnavailable).reading).toBe("key-fails");
    await expect(rows.write(NAME, text("[\"mine\",\"more\"]"))).rejects.toBeInstanceOf(CustodyRowUnavailable);
    expect(readFileSync(rowPath(c, NAME)).equals(alien)).toBe(true);                         // the write landed nothing
    // CONTROL: the row's own bytes, laid back, read and take a write.
    writeFileSync(rowPath(c, NAME), mine);
    expect(new TextDecoder().decode((await rows.read(NAME))!)).toBe("[\"mine\"]");
    await rows.write(NAME, text("[\"mine\",\"more\"]"));
    expect(new TextDecoder().decode((await rows.read(NAME))!)).toBe("[\"mine\",\"more\"]");
  });

  test("M5 — a name outside the digest spelling, an empty row and a row past the bound refuse before the seat", async () => {
    const c = await vessel("gm-m5");
    await c.holder.lock();                                                                  // a refusal below never reaches the seat: locked, it would read CustodyLocked
    const rows = gateMemoryRows(0);
    for (const name of ["", "AB".repeat(32), "ab".repeat(31), "ab".repeat(33), `../${"ab".repeat(31)}`, `${"ab".repeat(31)}/x`, "ab".repeat(32) + ".bin"]) {
      await expect(rows.read(name)).rejects.toBeInstanceOf(GateMemoryRowRefused);
      await expect(rows.write(name, text("[1]"))).rejects.toBeInstanceOf(GateMemoryRowRefused);
    }
    await expect(rows.write(NAME, new Uint8Array(0))).rejects.toBeInstanceOf(GateMemoryRowRefused);
    await expect(rows.write(NAME, new Uint8Array(GATE_MEMORY_ROW_MAX_BYTES + 1))).rejects.toBeInstanceOf(GateMemoryRowRefused);
    await expect(rows.write(NAME, "[1]" as never)).rejects.toBeInstanceOf(GateMemoryRowRefused);
    await expect(rows.read(NAME)).rejects.toBeInstanceOf(CustodyLocked);                    // CONTROL: a sound name reaches the seat
    await expect(rows.write(NAME, text("[1]"))).rejects.toBeInstanceOf(CustodyLocked);
    expect(faceRowNames()).not.toContain(gateMemoryRowFile(0, NAME));                   // a refused write leaves no directory behind
  });

  test("M6 — the carrier table names the face row and its face census lists it once it stands", async () => {
    const c = await vessel("gm-m6");
    const row = carrierTable().find((r) => r.row === "gate-memory")!;
    expect(row).toMatchObject({ home: "identity", custody: "face-hot", keyClass: null, writer: "gate-memory-rows" });
    const m = row.match.exec(`faces/${"ab".repeat(16)}/${gateMemoryRowFile(0, NAME)}`)!;
    expect(m).not.toBeNull();
    expect(row.face(m)).toBe(0);                                                    // no face's bundle carries it
    const listed = () => sSealedCarriers(c.homes).map((s) => s.name).filter((n) => n.includes("gate-memory"));
    expect(listed()).toEqual([]);
    await gateMemoryRows(0).write(NAME, text("[1]"));
    expect(listed()).toEqual([]);
    expect(faceRowNames()).toContain(gateMemoryRowFile(0, NAME));
  });

  test("M7 — an older copy of a row, restored by hand, makes the gate forget (the law names it; no fence stands)", async () => {
    const c = await vessel("gm-m7");
    const rows = gateMemoryRows(0);
    await rows.write(NAME, text("[\"first\"]"));
    const older = join(c.root, "older-copy.bin");
    copyFileSync(rowPath(c, NAME), older);
    await rows.write(NAME, text("[\"first\",\"second\"]"));
    expect(new TextDecoder().decode((await rows.read(NAME))!)).toBe("[\"first\",\"second\"]");   // CONTROL: the later row read whole
    copyFileSync(older, rowPath(c, NAME));
    expect(new TextDecoder().decode((await rows.read(NAME))!)).toBe("[\"first\"]");
  });

  test("M8 — a write only accretes, and one holder answers one door", async () => {
    const c = await vessel("gm-m8");
    const rows = gateMemoryRows(0);
    expect(gateMemoryRows(0)).toBe(rows);                                                    // two gates, one writer queue
    const e = (n: string) => ({ position: n, withdrawn: n.repeat(4) });
    await rows.write(NAME, text(JSON.stringify([e("a"), e("b")])));
    const before = readFileSync(rowPath(c, NAME));
    // A second writer joined against the row as it stood at [a]: its write lacks b.
    await expect(rows.write(NAME, text(JSON.stringify([e("a"), e("c")])))).rejects.toBeInstanceOf(GateMemoryRowRefused);
    await expect(rows.write(NAME, text(JSON.stringify([])))).rejects.toBeInstanceOf(GateMemoryRowRefused);
    expect(readFileSync(rowPath(c, NAME)).equals(before)).toBe(true);
    // CONTROL: a write that holds every standing event lands, in any spelling of the rest.
    await rows.write(NAME, text(JSON.stringify([e("a"), e("b"), e("c")])));
    expect(JSON.parse(new TextDecoder().decode((await rows.read(NAME))!))).toEqual([e("a"), e("b"), e("c")]);
    // Bytes that read as no list never land, and neither does a list in another spelling that drops an event.
    for (const bad of ["{}", "7", "\"x\"", "not json"]) await expect(rows.write(NAME, text(bad))).rejects.toBeInstanceOf(GateMemoryRowRefused);
    // CONTROL: key order names no difference. A row spelled in another key order still counts as held.
    const OTHER = "cd".repeat(32);
    await rows.write(OTHER, text('[{"withdrawn":"zzzz","position":"z"}]'));
    await rows.write(OTHER, text(JSON.stringify([e("z"), e("y")])));
    expect(JSON.parse(new TextDecoder().decode((await rows.read(OTHER))!))).toEqual([e("z"), e("y")]);
    // A standing row that opens to no list refuses by name and keeps its bytes.
    const MAL = "ef".repeat(32);
    await c.holder.writeRow("identity", gateMemoryRowFile(0, MAL), text("{}"));
    const malformed = readFileSync(rowPath(c, MAL));
    const refused = await rows.write(MAL, text("[1]")).catch((err: unknown) => err);
    expect(refused).toBeInstanceOf(CustodyRowUnavailable);
    expect((refused as CustodyRowUnavailable).reading).toBe("malformed");
    expect(readFileSync(rowPath(c, MAL)).equals(malformed)).toBe(true);
    // The read refuses the same way, so a gate over that row falls silent and never reads the face as unlearned.
    const unread = await rows.read(MAL).catch((err: unknown) => err);
    expect(unread).toBeInstanceOf(CustodyRowUnavailable);
    expect((unread as CustodyRowUnavailable).reading).toBe("malformed");
    await expect(storedWithdrawals(rows).read({ faceKey: "00".repeat(32), nexus: "nexus-a.synthetic" } as never)).resolves.toBeNull();   // CONTROL: a face with no row reads as nothing
    // A new holder over the same tree answers a new door: its store verifies every row again.
    await c.holder.lock();
    const again = makeCustodyHolder({ io: new FsCustodyIo(c.homes), homes: c.homes });
    await again.adopt(c.treeKey);
    await again.unlockFace({ ordinal: 0 }, [{ kind: "passphrase", passphrase: FIXTURE_PASSPHRASE }]);
    seatCustody(again);
    expect(gateMemoryRows(0)).not.toBe(rows);
    expect(gateMemoryRows(0)).toBe(gateMemoryRows(0));
    await again.lock();
    seatCustody(c.holder);
  });

  test("M9 — the store recovers from a refused write: it verifies the row again", async () => {
    await vessel("gm-m9");
    const c = await chain("m9", "nexus-a.synthetic");
    const k = async (label: string) => (await chain(label, "nexus-a.synthetic")).vessel.key;
    const [k1, k2, k3] = [await k("m9 one"), await k("m9 two"), await k("m9 three")];
    const line = await history(c, [k1, k2]);                 // the row's own line: e1, e2
    const fork = await history(c, [k1, k3]);                 // another writer's view: e1, then a different second event
    expect(fork[0]).toEqual(line[0]);
    expect(fork[1]).not.toEqual(line[1]);
    const rows = gateMemoryRows(0);
    const store = storedWithdrawals(rows);
    await store.keep(memoryOf(c.scope, [line[0]]));
    expect((await store.read(c.scope))!.frontier.position).toBe(1);
    // Another writer lands e2 on the row, past this store's verified view.
    await rows.write(faceProofSubjectRef(c.scope), canonicalJsonBytes(line));
    expect((await store.read(c.scope))!.frontier.position).toBe(1);                          // CONTROL: the view reads stale
    // This store joins the fork against its stale view and writes [e1, e2']: the door refuses, the row stays.
    await expect(store.keep(memoryOf(c.scope, fork))).rejects.toBeInstanceOf(GateMemoryRowRefused);
    expect(JSON.parse(new TextDecoder().decode((await rows.read(faceProofSubjectRef(c.scope)))!))).toEqual(line);
    // The refusal dropped the view: the next read verifies the row and answers what it holds.
    const after = (await store.read(c.scope))!;
    expect(after.frontier.position).toBe(2);
    expect(after.frontier.head).toBe(withdrawalHead(line[1]!));

  });
});
