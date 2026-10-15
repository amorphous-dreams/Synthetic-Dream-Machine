/**
 * A FIELD VALUE RESTS AS AN IMMUTABLE SCALAR — measured where it costs: a peer receiving the document.
 *
 * A plain string rests in Automerge as a Text object, one operation per character; a reader that
 * receives the document pays for every character. The store rests each field value as one immutable
 * scalar. The budget reads as a RATIO measured inside one run: receiving N records the store wrote costs
 * under a quarter of receiving the same N records written as plain strings. The clock here measures and
 * decides nothing; no wall-clock number stands as a budget.
 *
 * Control: the plain-string arm itself. It must cost more than the store arm by the stated ratio, so a
 * store that falls back to plain strings reads red; and each raw field of the store's document must
 * read as an immutable scalar, so a fast run on a tiny corpus cannot pass by accident.
 */
import { describe, test, expect } from "vitest";
import * as A from "@automerge/automerge";
import { Repo } from "@automerge/automerge-repo";
import { AutomergeDocStore } from "../src/automerge-doc-store.js";
import { emptyLarDoc, type LarDoc } from "../src/base-doc.js";
import type { ChangeOrigin, LarTiddlerRecord } from "../src/tiddler-store.js";

const origin: ChangeOrigin = { kind: "lares-verb", requestId: "bench" };
const N = 240;
const FAMILY = 8;

/** Deterministic prose-shaped bodies, about 1.5 kB each: the corpus's own order of size per record. */
function corpus(): LarTiddlerRecord[] {
  const words = ["tide", "shore", "wave", "ledger", "hand", "carrier", "meme", "island", "hearth", "nexus", "draft", "field"];
  const out: LarTiddlerRecord[] = [];
  for (let i = 0; i < N; i++) {
    let text = "";
    for (let w = 0; w < 240; w++) text += words[(i * 7 + w * 13) % words.length] + (w % 17 === 0 ? ".\n" : " ");
    out.push({
      tiddler: { title: `lar:///bench/carrier-${Math.floor(i / FAMILY)}#${i % FAMILY}`, text, type: "text/x-memetic-wikitext", tags: "bench shore" },
      meta: { changeId: `change-${i}` },
    });
  }
  return out;
}

/** Sync `writer` into a fresh reader; answer the milliseconds the READER spent receiving. */
function receiveCost(source: A.Doc<unknown>): { ms: number; reader: A.Doc<unknown> } {
  let writer = A.clone(source);
  let reader: A.Doc<unknown> = A.init();
  let ws = A.initSyncState();
  let rs = A.initSyncState();
  let ms = 0;
  for (let round = 0; round < 1000; round++) {
    const [ws2, toReader] = A.generateSyncMessage(writer, ws);
    ws = ws2;
    if (toReader) {
      const at = performance.now();
      [reader, rs] = A.receiveSyncMessage(reader, rs, toReader);
      ms += performance.now() - at;
    }
    const [rs2, toWriter] = A.generateSyncMessage(reader, rs);
    rs = rs2;
    if (toWriter) [writer, ws] = A.receiveSyncMessage(writer, ws, toWriter);
    if (!toReader && !toWriter) break;
  }
  return { ms, reader };
}

describe("a reader receives immutable field values at a fraction of the plain-string cost", () => {
  test(`receiving ${N} store-written records costs under a quarter of the plain-string figure of the same run`, async () => {
    const records = corpus();

    // The plain-string arm: the same records, each field a plain string, one change per record.
    let plain = A.from<{ tiddlers: Record<string, unknown> }>({ tiddlers: {} });
    for (const r of records) plain = A.change(plain, (d) => { d.tiddlers[r.tiddler.title] = { tiddler: { ...r.tiddler }, meta: { ...r.meta } }; });

    // The store arm: the same records through the one store, a family per change.
    const repo = new Repo({ network: [] });
    const handle = repo.create<LarDoc>(emptyLarDoc());
    const store = new AutomergeDocStore(handle, "bench-bag");
    for (let i = 0; i < records.length; i += FAMILY) await store.writeFamily(records.slice(i, i + FAMILY), [], origin);

    // Each arm twice, interleaved, the lower figure kept: one arm never rides a warmer engine.
    const plainMs = Math.min(receiveCost(plain).ms, receiveCost(plain).ms);
    const stored = receiveCost(handle.doc());
    const storeMs = Math.min(stored.ms, receiveCost(handle.doc()).ms);

    // The reader holds every record, whole.
    const received = stored.reader as { tiddlers: Record<string, { tiddler: Record<string, unknown> }> };
    expect(Object.keys(received.tiddlers)).toHaveLength(N);
    const sample = records[N - 1]!;
    expect(String(received.tiddlers[sample.tiddler.title]!.tiddler["text"])).toBe(sample.tiddler.text);

    expect(plainMs, "the plain-string arm measured something").toBeGreaterThan(0);
    expect(storeMs / plainMs, `store receive ${storeMs.toFixed(1)} ms against plain ${plainMs.toFixed(1)} ms`).toBeLessThan(0.25);

    // Control: every string of the store's document rests as an immutable scalar.
    const raw = handle.doc().tiddlers as unknown as Record<string, { tiddler: Record<string, unknown>; meta: Record<string, unknown> }>;
    for (const r of [records[0]!, sample]) {
      const rested = raw[r.tiddler.title]!;
      for (const field of ["title", "text", "type", "tags"]) expect(A.isImmutableString(rested.tiddler[field]), `${field} rests immutable`).toBe(true);
      expect(A.isImmutableString(rested.meta["changeId"]), "meta.changeId rests immutable").toBe(true);
    }
  }, 120_000);
});
