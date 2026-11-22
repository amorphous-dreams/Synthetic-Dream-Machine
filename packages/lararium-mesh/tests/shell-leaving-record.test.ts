/**
 * shell-leaving-record — the record of a retired shell's leaving takes the house's hand alone, and reads as the house's only
 * where the house wrote it (lar:///ha.ka.ba/lararium/api/residency-model#/effect-record-surface).
 *
 * L1 (red) a hand's door never writes, tombstones or removes `shell-leavings/<slug>`: `refuseEffectLedgerWrite` and the
 *    composite's hand origins (tw-local, mcp-draft, canvas-draft) refuse `effect-ledger-house-only`; the house's own writer lands.
 * L2 (red) a row the retire did not write (no `lares-retire-wiki` authority) or whose `retires[]` holds a malformed outcome
 *    reads as no retirement record.
 * L3 a union keeps every record once, refuses a title under other fields, and appends each retire's outcome, even when it
 *    adds no record.
 */
import { describe, expect, test } from "vitest";
import {
  buildRetiredShellRecord, CompositeStore, parseRetiredShellRecord, refuseEffectLedgerWrite, retiredShellUri, unionRetiredShell, wikiSlotUri,
  type ChangeOrigin, type CarriedEffectRecord, type LarTiddlerRecord, type RetireOutcome,
} from "../src/index.js";
import { AtomicMemoryStore } from "../../lararium-tw5/tests/atomic-memory-store.js";

const SLUG = "elyncia-referee";
const TITLE = retiredShellUri(SLUG);
const HOME = wikiSlotUri("daemon", "working");
const REC: CarriedEffectRecord = { layer: "working", title: "lar:///ha.ka.ba/wikis/elyncia-referee/working/ledger/residency/e1", fields: { title: "lar:///ha.ka.ba/wikis/elyncia-referee/working/ledger/residency/e1", bag: "lar:///ha.ka.ba/wikis/elyncia-referee/working" } };
const OUT: RetireOutcome = { face: "0xface", realmId: null, forced: false, authored: 0, carried: [REC.title] };
const body = () => unionRetiredShell(SLUG, null, [REC], OUT);

describe("L1 (red) — the record of leaving takes the house's hand alone", () => {
  test("refuseEffectLedgerWrite refuses the shell-leavings title by name", () => {
    expect(() => refuseEffectLedgerWrite(TITLE, "tiddler-put")).toThrow(/^effect-ledger-house-only:/);
  });

  test("a hand origin's put, family, tombstone or remove of the record refuses; the house's writer lands it", async () => {
    const c = new CompositeStore();
    c.addLayer({ bagId: HOME, store: new AtomicMemoryStore(HOME), writable: true });
    const rec = buildRetiredShellRecord(body());
    for (const origin of [{ kind: "tw-local", instanceId: "i" }, { kind: "mcp-draft", toolCallId: "t" }, { kind: "canvas-draft", shapeId: "s" }] as ChangeOrigin[]) {
      await expect(c.put(rec, origin, { bag: HOME })).rejects.toMatchObject({ reason: "effect-ledger-house-only" });
      await expect(c.writeFamily([rec], [], origin, { bag: HOME })).rejects.toMatchObject({ reason: "effect-ledger-house-only" });
      await expect(c.tombstoneInBag(HOME, TITLE, origin)).rejects.toMatchObject({ reason: "effect-ledger-house-only" });
      await expect(c.removeInBag(HOME, TITLE, origin)).rejects.toMatchObject({ reason: "effect-ledger-house-only" });
    }
    expect(await c.storeForBag(HOME)!.get(TITLE)).toBeNull();
    await c.put(rec, { kind: "lares-verb", requestId: "retire-wiki" }, { bag: HOME });
    expect(parseRetiredShellRecord(SLUG, await c.storeForBag(HOME)!.get(TITLE))).toMatchObject({ slug: SLUG, records: [REC] });
  });
});

describe("L2 (red) — a row the retire never wrote reads as no retirement record", () => {
  test("a hand-planted row (no authority, or another authority) reads null; the house's own reads whole", () => {
    const rec = buildRetiredShellRecord(body());
    expect(parseRetiredShellRecord(SLUG, rec)).not.toBeNull();
    const planted: LarTiddlerRecord = { tiddler: rec.tiddler };
    expect(parseRetiredShellRecord(SLUG, planted)).toBeNull();
    expect(parseRetiredShellRecord(SLUG, { ...rec, meta: { authority: "tw-local" } })).toBeNull();
  });

  test("a malformed retires[] entry reads null", () => {
    const rec = buildRetiredShellRecord(body());
    const bent = (retires: unknown[]): LarTiddlerRecord => ({ ...rec, tiddler: { ...rec.tiddler, text: JSON.stringify({ slug: SLUG, records: [REC], retires }) } });
    expect(parseRetiredShellRecord(SLUG, bent([OUT]))).not.toBeNull();
    expect(parseRetiredShellRecord(SLUG, bent([{ ...OUT, face: 7 }]))).toBeNull();
    expect(parseRetiredShellRecord(SLUG, bent([{ ...OUT, forced: "no" }]))).toBeNull();
    expect(parseRetiredShellRecord(SLUG, bent([{ ...OUT, carried: [1] }]))).toBeNull();
    expect(parseRetiredShellRecord(SLUG, bent([null]))).toBeNull();
  });
});

describe("L3 — the union", () => {
  test("keeps each record once, appends each retire's outcome even when it adds nothing, and refuses a title under other fields", () => {
    const first = body();
    const again = unionRetiredShell(SLUG, first, [REC], { ...OUT, forced: true });
    expect(again.records).toEqual([REC]);
    expect(again.retires.map((r) => r.forced)).toEqual([false, true]);
    expect(() => unionRetiredShell(SLUG, first, [{ ...REC, fields: { ...REC.fields, bag: "other" } }], OUT)).toThrow(/^retire-carry-unlanded:/);
  });
});
