/**
 * cas-references.test.ts — the DERIVED reference count over every locally-held bag's records.
 *
 * A blob is RETAINED while any tiddler in any locally-held bag references its CID. Nothing stores a
 * count: `casReferences` derives `cid → {bag·title}` from the records themselves (`textCid`, else a
 * `lar:///…/cid/<hash>` `_canonical_uri` — the SAME discrimination the lazy resolver reads), so the
 * count can never drift from the records. The proofs:
 *   · a pointer landed in one bag → referenced once,
 *   · the same pointer in TWO bags → referenced twice; dropping one bag leaves one (the survivor),
 *   · dropping the last bag → zero (the blob becomes sweepable),
 *   · an inline record (no cid) references nothing; a web2 `_canonical_uri` references nothing,
 *   · the summary counts blobs · referenced · unreferenced · pending · bytes off the store + the references.
 */
import { describe, test, expect } from "vitest";
import { casReferences, summarizeCas, type CasReferenceEntry } from "../src/index.js";

const CID_A = "a".repeat(64);
const CID_B = "b".repeat(64);
const pointer = (title: string, cid: string): Record<string, unknown> =>
  ({ title, _is_skinny: "yes", textCid: cid, _integrity: "ni:///sha-256;x", type: "image/png" });

const entry = (bagId: string, fields: Record<string, unknown>): CasReferenceEntry =>
  ({ title: String(fields["title"]), bagId, record: { tiddler: fields } });

describe("casReferences — cid → the records that hold it, derived", () => {
  test("a pointer landed in one bag → referenced once", () => {
    const refs = casReferences([entry("lares", pointer("lar:///t.w.b/photo", CID_A))]);
    expect(refs.get(CID_A)?.size).toBe(1);
    expect([...refs.get(CID_A)!][0]).toBe("lares lar:///t.w.b/photo");
  });

  test("the same pointer in TWO bags → twice; DROP one → the survivor keeps it; DROP both → zero", () => {
    const both = [entry("lares", pointer("lar:///t.w.b/photo", CID_A)), entry("crossroads", pointer("lar:///t.w.b/photo", CID_A))];
    expect(casReferences(both).get(CID_A)?.size).toBe(2);
    const afterDrop = both.filter((e) => e.bagId !== "lares");
    expect(casReferences(afterDrop).get(CID_A)?.size).toBe(1);
    expect(casReferences([]).get(CID_A)).toBeUndefined();
  });

  test("an inline record and a web2 _canonical_uri reference nothing; a lar cid _canonical_uri does", () => {
    const refs = casReferences([
      entry("lares", { title: "inline", text: "hello" }),
      entry("lares", { title: "web2", _is_skinny: "yes", _canonical_uri: "https://example.org/x.png" }),
      entry("lares", { title: "lar", _is_skinny: "yes", _canonical_uri: `lar:///ha.ka.ba/cid/${CID_B}` }),
    ]);
    expect(refs.size).toBe(1);
    expect(refs.get(CID_B)?.size).toBe(1);
  });

  test("summarizeCas — blobs · referenced · unreferenced · bytes, off the store + the references", () => {
    const refs = casReferences([entry("lares", pointer("lar:///t.w.b/photo", CID_A))]);
    const s = summarizeCas([{ cid: CID_A, size: 10 }, { cid: CID_B, size: 5 }], refs);
    expect(s).toEqual({ blobs: 2, referenced: 1, unreferenced: 1, pending: 0, bytes: 15 });
    // A pointer whose blob the store lacks reads PENDING — the fleet peer's shape after a record crossed.
    expect(summarizeCas([{ cid: CID_B, size: 5 }], refs)).toEqual({ blobs: 1, referenced: 0, unreferenced: 1, pending: 1, bytes: 5 });
  });
});
