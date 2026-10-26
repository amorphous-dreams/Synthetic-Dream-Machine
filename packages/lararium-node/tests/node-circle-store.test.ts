/**
 * node-circle-store — the recogniser's handle-book, one row per face sealed under its face key and read through the
 * custody seat. The follow graph holds ONE home, the persona-scoped circles plane, and no row of this module.
 *
 *   C1  a saved handle-book seals at rest and restores whole; the file carries its face key's seal and none of
 *       the nym.                                              control: before the save it reads as an empty book
 *   C2  a record whose own causal closure does not verify drops at the restore boundary, and the rest of the book
 *       stands.                                               control: the untouched record still recognises
 *   C3  a handle-book row that stands and does not open refuses by name: one frame byte moved, a truncated row, a
 *       BARE row (clear JSON at the path). None reads as an empty book, and a save over it refuses and moves no byte.
 *                                                             control: the intact row restores
 *   C4  a handle-book row that opens to another shape (not JSON, another era, no record list, a record that lost
 *       its shape) refuses `malformed` at the load AND at a save, which moves no byte over it.
 *                                                             control: this era's empty snapshot restores empty,
 *                                                             and a save lands over it
 *   C7  at the floor both doors refuse `CustodyLocked` and no file moves.
 *   C8  A vessel-key rotation leaves this face row byte-identical and readable under its face key. A fresh
 *       holder that opens the face reads the book and saves over it.
 *   C10 THE FOLLOW GRAPH HOLDS ONE HOME. The carrier table names no `circles` row, the node barrel and this module
 *       export no circle store, and a file spelled `.circles-follow.json` in the identity home enters no census and
 *       no custody door.                                      control: the handle-book row stands in all three
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  HandleBook, HANDLE_BOOK_SNAPSHOT_ERA, mintPersonaGlamour, readFckCarrier,
  type LarDoc,
} from "@lararium/mesh";
import * as circleStoreModule from "../src/node-circle-store.js";
import { loadNodeHandleBook, saveNodeHandleBook, HANDLE_BOOK_FILE, handleBookFile } from "../src/node-circle-store.js";
import * as nodeBarrel from "../src/index.js";
import { CustodyLocked, CustodyRowUnavailable, CustodyRowUnknown, makeCustodyHolder } from "../src/custody-holder.js";
import { seatCustody } from "../src/custody-seat.js";
import { rotateCustody } from "../src/custody-session.js";
import { carrierCensus, carrierTable } from "../src/vault-carriers.js";
import { handleRowPathIn } from "./face-paths.js";
import { seatScratchCustody, FIXTURE_PASSPHRASE, type SeatedScratchCustody } from "./custody-seat-fixture.js";

vi.setConfig({ testTimeout: 120_000 });

const SEED = Uint8Array.from(Array.from({ length: 32 }, (_, i) => (i * 5 + 11) & 0xff));
const OWNER = "persona-" + "cd".repeat(32);
const enc = (v: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(v));

function board(): { doc(): LarDoc; change(fn: (doc: LarDoc) => void): void } {
  const doc = { tiddlers: {} } as LarDoc;
  return { doc: () => doc, change: (fn) => fn(doc) };
}
async function cardAt(handleIndex: number) {
  return (await mintPersonaGlamour({ board: board(), seed: SEED, handleIndex, glamour: "A", store: {
    load: async () => null, save: async () => undefined, list: async () => [],
  }, ownerPersonaKelPrefix: OWNER })).card;
}
async function bookOf(...indexes: number[]): Promise<{ book: HandleBook; nyms: string[] }> {
  const book = new HandleBook();
  const nyms: string[] = [];
  for (const i of indexes) {
    const card = await cardAt(i);
    expect((await book.ingest(card)).ok).toBe(true);
    nyms.push(card.nym);
  }
  return { book, nyms };
}

let c: SeatedScratchCustody;
const FILE = handleBookFile(0);
const at = (file: string): string => HANDLE_BOOK_FILE.test(file) ? handleRowPathIn(c.homes.identity, file) : join(c.homes.identity, file);
beforeEach(async () => { c = await seatScratchCustody("circles"); });
afterEach(async () => { await c.drop(); });

describe("the handle-book row", () => {
  test("C1 a saved book seals at rest and restores whole", async () => {
    expect((await loadNodeHandleBook(0)).nyms()).toEqual([]);
    expect(existsSync(at(FILE))).toBe(false);
    const { book, nyms } = await bookOf(1);
    await saveNodeHandleBook(0, book);
    expect(readFckCarrier(readFileSync(at(FILE)))).toBe("sealed");
    expect(readFileSync(at(FILE)).includes(Buffer.from(nyms[0]!))).toBe(false);
    const restored = await loadNodeHandleBook(0);
    expect(restored.nyms()).toEqual(nyms);
    expect(restored.isRecognized(nyms[0]!)).toBe(true);
  });

  test("C2 a record whose closure does not verify drops at the restore boundary", async () => {
    const { book, nyms } = await bookOf(0, 1);
    const snapshot = structuredClone(book.snapshot());
    const forged = snapshot.records.findIndex((r) => r.nym === nyms[0]);
    (snapshot.records[forged]!.accepted[0] as { glamour: string }).glamour = "forged";
    await c.holder.writeRow("identity", FILE, enc(snapshot));
    const restored = await loadNodeHandleBook(0);
    expect(restored.isRecognized(nyms[0]!)).toBe(false);
    expect(restored.isRecognized(nyms[1]!)).toBe(true);   // control
  });

  test("C3 a row that stands and does not open refuses by name; a save moves no byte over it", async () => {
    const { book, nyms } = await bookOf(1);
    await saveNodeHandleBook(0, book);
    const intact = readFileSync(at(FILE));
    const tampered = Buffer.from(intact);
    tampered[tampered.length - 7] = tampered[tampered.length - 7]! ^ 0x01;
    expect(tampered.equals(intact)).toBe(false);
    for (const [label, bytes, reads] of [
      ["tampered", tampered, /reads (key-fails|torn)/], ["truncated", intact.subarray(0, intact.length - 9), /reads (key-fails|torn)/],
      ["bare", Buffer.from(JSON.stringify(book.snapshot())), /reads bare/],
    ] as const) {
      writeFileSync(at(FILE), bytes);
      await expect(loadNodeHandleBook(0), label).rejects.toThrow(CustodyRowUnavailable);
      await expect(loadNodeHandleBook(0), label).rejects.toThrow(reads);
      await expect(saveNodeHandleBook(0, new HandleBook()), label).rejects.toThrow();
      expect(readFileSync(at(FILE)).equals(bytes), `${label}: the bytes at rest never moved`).toBe(true);
    }
    writeFileSync(at(FILE), intact);
    expect((await loadNodeHandleBook(0)).nyms()).toEqual(nyms);   // control
  });

  test("C4 a row that opens to another shape refuses malformed", async () => {
    for (const shape of ["not json", JSON.stringify({ era: "scalar-handle-book-0", records: [] }), JSON.stringify({ era: HANDLE_BOOK_SNAPSHOT_ERA }), "[]", "null"]) {
      await c.holder.writeRow("identity", FILE, new TextEncoder().encode(shape));
      await expect(loadNodeHandleBook(0), shape).rejects.toThrow(/\.handle-book-h0\.json reads malformed/);
    }
    // a record that lost its shape refuses the whole book: a restore that skipped it would let the next save erase it
    const { book, nyms } = await bookOf(0, 1);
    for (const bend of [
      (r: Record<string, unknown>) => { r["accepted"] = null; },
      (r: Record<string, unknown>) => { r["nym"] = 7; },
      (r: Record<string, unknown>) => { (r["accepted"] as Array<Record<string, unknown>>)[0]!["nym"] = "another-nym"; },
    ]) {
      const snapshot = structuredClone(book.snapshot()) as unknown as { records: Array<Record<string, unknown>> };
      bend(snapshot.records[0]!);
      await c.holder.writeRow("identity", FILE, enc(snapshot));
      const standing = readFileSync(at(FILE));
      await expect(loadNodeHandleBook(0)).rejects.toThrow(/\.handle-book-h0\.json reads malformed/);
      // A SAVE NEVER LANDS OVER A ROW THAT TURNED UNREADABLE since its caller loaded the book
      await expect(saveNodeHandleBook(0, book)).rejects.toThrow(/\.handle-book-h0\.json reads malformed/);
      expect(readFileSync(at(FILE)).equals(standing)).toBe(true);
    }
    await c.holder.writeRow("identity", FILE, enc({ era: HANDLE_BOOK_SNAPSHOT_ERA, records: [] }));
    expect((await loadNodeHandleBook(0)).nyms()).toEqual([]);   // control
    await saveNodeHandleBook(0, book);                              // control: over a whole snapshot the save lands
    expect((await loadNodeHandleBook(0)).nyms().sort()).toEqual([...nyms].sort());
  });
});

describe("the key and the floor", () => {
  test("C7 at the floor both doors refuse CustodyLocked and no file moves", async () => {
    const { book } = await bookOf(1);
    await saveNodeHandleBook(0, book);
    const before = readFileSync(at(FILE));
    await c.holder.lock();
    await expect(loadNodeHandleBook(0)).rejects.toThrow(CustodyLocked);
    await expect(saveNodeHandleBook(0, book)).rejects.toThrow(CustodyLocked);
    expect(readFileSync(at(FILE)).equals(before)).toBe(true);
  });

  test("C8 an S key rotation leaves the face book sealed and readable under its face key", async () => {
    const { book, nyms } = await bookOf(1);
    await saveNodeHandleBook(0, book);
    const standing = readFileSync(at(FILE));
    const rotated = await rotateCustody({ io: c.io, homes: c.homes, oldTreeKey: c.treeKey, slots: [{ t: 1, pins: [{ kind: "passphrase", passphrase: FIXTURE_PASSPHRASE }] }] });
    expect(readFileSync(at(FILE)).equals(standing)).toBe(true);
    expect((await loadNodeHandleBook(0)).nyms()).toEqual(nyms);
    const fresh = makeCustodyHolder({ io: c.io, homes: c.homes });
    await fresh.adopt(rotated.treeKey);
    await fresh.unlockFaces([{ kind: "passphrase", passphrase: FIXTURE_PASSPHRASE }]);
    seatCustody(fresh);
    expect((await loadNodeHandleBook(0)).nyms()).toEqual(nyms);
    await saveNodeHandleBook(0, new HandleBook());
    expect((await loadNodeHandleBook(0)).nyms()).toEqual([]);
    await fresh.lock();
    seatCustody(c.holder);
  });
});

describe("the follow graph holds one home", () => {
  test("C10 no carrier row, no export and no custody door names a follow-graph file", async () => {
    const FOLLOW = ".circles-follow.json";
    // control: the handle-book stands as a row, as an export and behind the custody door
    expect(carrierTable().filter((r) => r.writer === "node-circle-store").map((r) => r.row)).toEqual(["handle-book"]);
    expect(typeof nodeBarrel.loadNodeHandleBook).toBe("function");
    await c.holder.writeRow("identity", FILE, enc({ era: HANDLE_BOOK_SNAPSHOT_ERA, records: [] }));
    expect(carrierCensus(c.homes).map((e) => e.row)).toContain("handle-book");

    expect(carrierTable().some((r) => r.row === "circles")).toBe(false);
    expect(Object.keys(circleStoreModule).sort()).toEqual(["HANDLE_BOOK_FILE", "handleBookFile", "loadNodeHandleBook", "saveNodeHandleBook"]);
    expect("makeNodeCircleStore" in nodeBarrel).toBe(false);
    expect("CIRCLES_FILE" in nodeBarrel).toBe(false);
    writeFileSync(at(FOLLOW), "{}");
    expect(carrierCensus(c.homes).some((e) => e.file === FOLLOW)).toBe(false);
    await expect(c.holder.readRow("identity", FOLLOW)).rejects.toBeInstanceOf(CustodyRowUnknown);
    await expect(c.holder.writeRow("identity", FOLLOW, enc({}))).rejects.toBeInstanceOf(CustodyRowUnknown);
  });
});
