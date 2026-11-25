/**
 * sibling-seat-cleans-on-throw — Hearth-Reader-II's F5 (course held-saves-edges): a sibling's entry lit, then its seat stood, and
 * only then did the cleanup that drops the entry register on the identity. A seat that threw left a half-made entry standing (no
 * seat), which the light's catch never cleared. `standSiblingEntry` registers the cleanup first, so the identity's disposal drops
 * the entry, and only while the table still holds that very entry.
 */
import { describe, expect, test } from "vitest";
import { faceSeatTable, standSiblingEntry } from "../src/face-seat-table.js";
import type { ContentKeySeat } from "../src/content-key-seat.js";

const KEY = "ab".repeat(32);

function identity() {
  const leaving: Array<() => void> = [];
  return { whenDisposed: (fn: () => void) => { leaving.push(fn); }, dispose: () => { for (const fn of leaving.splice(0)) fn(); } };
}

describe("a sibling's half-made seat leaves with its identity", () => {
  test("RED: a seat that throws leaves the entry half-made; the identity's disposal drops it", () => {
    const table = faceSeatTable({ proof: () => undefined });
    const id = identity();
    expect(() => standSiblingEntry(table, KEY, id, () => { throw new Error("the seat refused"); })).toThrow(/the seat refused/);
    expect(table.lit(KEY)?.seat ?? null, "the entry stands half-made until the identity leaves").toBeNull();
    id.dispose();
    expect(table.lit(KEY), "the disposal dropped it").toBeUndefined();
  });

  test("CONTROL: a seat that stands keeps its entry until its identity leaves; an earlier identity's late disposal drops no later light's entry", () => {
    const table = faceSeatTable({ proof: () => undefined });
    const seat = (): ContentKeySeat => ({ lock: () => {} } as unknown as ContentKeySeat);
    const first = identity();
    const entry = standSiblingEntry(table, KEY, first, seat);
    expect(table.lit(KEY)).toBe(entry);
    expect(entry.seat).not.toBeNull();
    // The face lights again under a second identity before the first one's disposal runs.
    const second = identity();
    const relit = standSiblingEntry(table, KEY, second, seat);
    expect(relit).not.toBe(entry);
    first.dispose();
    expect(table.lit(KEY), "the first identity's cleanup finds another entry and drops nothing").toBe(relit);
    second.dispose();
    expect(table.lit(KEY)).toBeUndefined();
  });
});
