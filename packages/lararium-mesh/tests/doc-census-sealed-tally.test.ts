/**
 * The document census tallies its sealed documents once, in two units it names apart: documents (one read per id) and
 * copies (one row per store that rests it), each copy under the class it reads. The `sealed-unread` class line and the
 * unread-sealed footer then read the same truth: the class counts the unread copies no live name reaches, and the footer
 * names that same count beside the copies a live name reaches and the island copies the root also holds.
 *
 * Fixture: a sealed document in the root and one island (the island copy reads `duplicate`), a sealed island-only
 * document, and a sealed document a live name reaches (it reads `current`, yet stands unread all the same).
 */
import { expect, test } from "vitest";
import { censusDocuments, type StoreDocRow } from "../src/index.js";

const sealed = (id: string, store: string): StoreDocRow => ({ id, store, bytes: 100, clearChunks: 0, sealedChunks: 1, syncStates: 0, temps: 0 });
const SHARED = "5hared5ea1edDoc111111111";
const ISLAND = "1s1and5ea1edDoc111111111";
const REACHED = "Reached5ea1edDoc11111111";

test("the sealed-unread class and the unread footer agree, and name documents and copies apart", async () => {
  const reading = await censusDocuments({
    rows: [sealed(SHARED, "(root)"), sealed(SHARED, "notes"), sealed(ISLAND, "notes"), sealed(REACHED, "(root)")],
    rootStore: "(root)",
    named: [{ id: REACHED, kind: "pointer", by: "a sealed home" }],
    read: async () => ({ read: "sealed-unread" }),
  });
  const classOf = (id: string, store: string) => reading.rows.find((r) => r.id === id && r.store === store)!.class;
  expect(classOf(SHARED, "(root)")).toBe("sealed-unread");
  expect(classOf(SHARED, "notes")).toBe("duplicate");
  expect(classOf(ISLAND, "notes")).toBe("sealed-unread");
  expect(classOf(REACHED, "(root)")).toBe("current");

  // Three sealed documents stand unread, in four copies across the stores.
  expect(reading.unreadSealed).toBe(3);
  expect(reading.unreadSealedCopies).toEqual({ "sealed-unread": 2, duplicate: 1, current: 1 });
  // The footer's `sealed-unread` share reads the class line's own count.
  expect(reading.unreadSealedCopies["sealed-unread"]).toBe(reading.counts["sealed-unread"]);
  const copies = Object.values(reading.unreadSealedCopies).reduce((s, n) => s + (n ?? 0), 0);
  expect(copies).toBe(4);
});
