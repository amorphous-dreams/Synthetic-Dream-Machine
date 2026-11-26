/**
 * census-locked-since-boot — a vessel that stood locked since it booted holds nothing by construction, and its census says so.
 *
 *   L1  locked, the custody door names its key never opened in this life (`everOpened: false`), no held save: CLEAN, exit 0, one
 *       line naming why; a sealed rest that sits uncomposed (no store to hold a save) reads the same.
 *   L2  locked since boot but a held save stands: the census lists it (document and count of saves, never a value); exit 3.
 *   L3  locked after its key opened in this life (`everOpened: true`), or a door too old to say: UNREAD, exit 2, the unlock
 *       cure; never assumed clean and never assumed lost.
 *   L4  a held row in a shape the door cannot read stays unread even over a vessel locked since boot.
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import { LOCKED_SINCE_BOOT_CENSUS, VESSEL_LOCKED_CENSUS, cmdCensus, readCensus, type CensusLines } from "../src/commands/census.js";
import type { ParsedArgs } from "../src/parse-args.js";

const args = (json: boolean): ParsedArgs => ({ command: "vessel", positional: [], flags: { json } }) as unknown as ParsedArgs;
/** A locked hearth: its islands refuse `vessel-locked`, so the shore census answers nothing. */
const locked = (custody: Record<string, unknown>): CensusLines => ({
  socketPresent: () => true,
  custody: async () => ({ op: "census", standing: "hearth", locked: true, ...custody }),
  shore: async () => ({ carriers: [], unanswered: [{ part: "the disk projector", why: "vessel-locked: no act reads or writes its control document until `lares vault unlock` opens it" }] }),
});
afterEach(() => { vi.restoreAllMocks(); });
function capture(): { out: string[]; err: string[] } {
  const out: string[] = [], err: string[] = [];
  vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => { out.push(a.join(" ")); });
  vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => { err.push(a.join(" ")); });
  return { out, err };
}

describe("RED the census over a vessel locked since it booted", () => {
  test("L1 never opened and nothing held: clean, exit 0, and the line names why nothing stood at risk", async () => {
    for (const held of [[], null]) {
      const reading = await readCensus(locked({ held, everOpened: false }));
      expect(reading).toMatchObject({ clean: true, items: [], unanswered: [], lockedSinceBoot: true });
    }
    const said = capture();
    expect(await cmdCensus(args(false), locked({ held: [], everOpened: false }))).toBe(0);
    expect(said.out).toEqual([LOCKED_SINCE_BOOT_CENSUS]);
    expect(LOCKED_SINCE_BOOT_CENSUS).toMatch(/^census: clean — the vessel stood locked since it booted/);
    expect(said.err.join("\n")).not.toMatch(/vessel locked: run/);
  });

  test("L2 never opened but a save stands held: the census lists it by document and count, exit 3", async () => {
    const lines = locked({ held: [{ refusal: "save-unbooked", documentId: "doc-a", saves: 3, bagId: null }], everOpened: false });
    const reading = await readCensus(lines);
    expect(reading.clean).toBe(false);
    expect(reading.lockedSinceBoot).toBeUndefined();
    expect(reading.items).toEqual([{ kind: "held-save", refusal: "save-unbooked", documentId: "doc-a", saves: 3, bagId: null }]);
    const said = capture();
    expect(await cmdCensus(args(false), lines)).toBe(3);
    expect(said.out.join("\n")).toMatch(/held-save {2}save-unbooked {2}doc doc-a {2}3 save\(s\) in memory/);
  });

  test("L3 a key that opened in this life and shut again, or a door that names no `everOpened`, reads UNREAD: exit 2 and the unlock cure", async () => {
    for (const custody of [{ held: [], everOpened: true }, { held: [] }, { held: null, everOpened: true }]) {
      const reading = await readCensus(locked(custody));
      expect(reading.clean).toBe(false);
      expect(reading.unanswered).toEqual([{ part: "the vessel", why: VESSEL_LOCKED_CENSUS }]);
      expect(await cmdCensus(args(true), locked(custody))).toBe(2);
    }
  });

  test("L4 a held row this door cannot read keeps the census unread, locked since boot or not", async () => {
    const reading = await readCensus(locked({ held: [{ refusal: "no-such-refusal", documentId: "doc-a" }], everOpened: false }));
    expect(reading.clean).toBe(false);
    expect(reading.lockedSinceBoot).toBeUndefined();
  });
});
