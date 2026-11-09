/**
 * projection-hidden-row — a working row a higher layer shadows still reaches its own mirror.
 *
 * The working mirror followed the RESOLVED view: a same-title draft or personal row above it hid the working record
 * from the projector, and a crash between the working store's sealed write and the change notice left that record off
 * disk for good. The cure reads each ordinary mirror's OWN bag: a fresh projector enumerates the bag's own titles at
 * start, and a reconcile projects the mirrored bag's own record, rendered off its own fields, wherever a higher layer
 * shadows it.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { MemoryTiddlerStore } from "../../lararium-tw5/src/memory-store.js";
import { LarDiskProjector } from "../src/disk-projector.js";
import type { CarrierFile } from "@lararium/tw5";

const WORK = "lar:///ha.ka.ba/wikis/notes/working";
const DRAFT = "lar:///ha.ka.ba/wikis/notes/draft";
const TITLE = "lar:///ha.ka.ba/t/notes/hidden";
const origin = { kind: "test" } as const;
let root = "";
afterEach(() => { if (root) rmSync(root, { recursive: true, force: true }); root = ""; });

/** A view holding `fields` at TITLE (or nothing), shaped as the projector reads a TW5 engine. */
function engine(fields: Record<string, unknown> | null): unknown {
  const tiddlers = new Map(fields ? [[TITLE, { fields }]] : []);
  return { $tw: { wiki: {
    getTiddler: (t: string) => tiddlers.get(t),
    allTitles: () => [...tiddlers.keys()],
    addEventListener: () => {},
    removeEventListener: () => {},
  } } };
}

const mem = (text: string): CarrierFile => ({ ext: ".mem", body: text, defaultRelPath: "x.mem" });

/** A fresh projector over the working mirror: the resolved render reads the view, the record render reads the bag. */
function projectorOver(view: Record<string, unknown> | null, work: MemoryTiddlerStore, withRecords = true, top?: MemoryTiddlerStore): LarDiskProjector {
  return new LarDiskProjector({
    ...(top ? { topRecordFn: async (uri: string) => (await top.get(uri)) ?? (await work.get(uri)) } : {}),
    mirrors: [{ bagId: WORK, mirrorRoot: root }],
    carrierFileFn: async (uri) => { const f = (engine(view) as { $tw: { wiki: { getTiddler(t: string): { fields: Record<string, unknown> } | undefined } } }).$tw.wiki.getTiddler(uri)?.fields; return f ? mem(String(f["text"])) : null; },
    recoveryStore: (bag) => bag === WORK ? work : null,
    ...(withRecords ? { recordFileFn: async (bag: string, uri: string) => {
      if (bag !== WORK) return null;
      const record = await work.get(uri);
      return record && !record.meta?.deleted ? mem(String(record.tiddler["text"])) : null;
    } } : {}),
    bagsHolding: async (uri) => { const r = await work.get(uri); return r && !r.meta?.deleted ? [WORK] : []; },
  });
}

const carrier = (): string => join(root, "ha.ka.ba/t/notes/hidden.mem");

test("RED: a working record shadowed by a higher draft, written before its notice, lands from its own fields on a fresh start", async () => {
  root = mkdtempSync(join(tmpdir(), "hidden-row-"));
  const work = new MemoryTiddlerStore(WORK);
  // The working store's write lands; the change notice never reaches the view (the crash), and a draft row shadows it.
  work._seed({ tiddler: { title: TITLE, text: "working words" } } as never);
  const view = { title: TITLE, text: "draft words", "$origin-bag": DRAFT };
  const projector = projectorOver(view, work);
  const stop = projector.start(engine(view) as never);
  await projector.idle();
  await projector.idle();
  expect(existsSync(carrier())).toBe(true);
  expect(readFileSync(carrier(), "utf8")).toBe("working words");      // the working record, never the draft above it
  await stop();
});

test("a live working change under a standing shadow reaches disk through the bag's own notice", async () => {
  root = mkdtempSync(join(tmpdir(), "hidden-row-live-"));
  const work = new MemoryTiddlerStore(WORK);
  const view = { title: TITLE, text: "draft words", "$origin-bag": DRAFT };
  const projector = projectorOver(view, work);
  const stop = projector.start(engine(view) as never);
  await projector.idle();
  await work.put({ tiddler: { title: TITLE, text: "later working words" } }, origin);
  await projector.idle();
  expect(readFileSync(carrier(), "utf8")).toBe("later working words");
  await stop();
});

test("CONTROL: with no shadow, the resolved working row projects as it always has", async () => {
  root = mkdtempSync(join(tmpdir(), "hidden-row-control-"));
  const work = new MemoryTiddlerStore(WORK);
  await work.put({ tiddler: { title: TITLE, text: "working words" } }, origin);
  const view = { title: TITLE, text: "working words", "$origin-bag": WORK };
  for (const withRecords of [true, false]) {
    const projector = projectorOver(view, work, withRecords);
    const stop = projector.start(engine(view) as never);
    await projector.idle();
    expect(readFileSync(carrier(), "utf8")).toBe("working words");
    await stop();
  }
});

test("CONTROL: without a record renderer the projector follows the resolved view, and the shadowed row stays off disk", async () => {
  root = mkdtempSync(join(tmpdir(), "hidden-row-off-"));
  const work = new MemoryTiddlerStore(WORK);
  await work.put({ tiddler: { title: TITLE, text: "working words" } }, origin);
  const view = { title: TITLE, text: "draft words", "$origin-bag": DRAFT };
  const projector = projectorOver(view, work, false);
  const stop = projector.start(engine(view) as never);
  await projector.idle();
  expect(existsSync(carrier())).toBe(false);
  await stop();
});

test("CONTROL: a tombstone topping the composition (a deliberate deletion) keeps the shadowed working record off disk", async () => {
  root = mkdtempSync(join(tmpdir(), "hidden-row-tomb-"));
  const work = new MemoryTiddlerStore(WORK);
  const draft = new MemoryTiddlerStore(DRAFT);
  await work.put({ tiddler: { title: TITLE, text: "working words" } }, origin);
  await draft.put({ tiddler: { title: TITLE, text: "gone" } }, origin);
  await draft.tombstone(TITLE, origin);
  const projector = projectorOver(null, work, true, draft);
  const stop = projector.start(engine(null) as never);
  await projector.idle();
  expect(existsSync(carrier())).toBe(false);
  await stop();
});

test("CONTROL: a pack member the bag's own provenance names stays inside its pack, never its own file", async () => {
  root = mkdtempSync(join(tmpdir(), "hidden-row-pack-"));
  const work = new MemoryTiddlerStore(WORK);
  await work.put({ tiddler: { title: TITLE, text: "member words" } }, origin);
  await work.put({ tiddler: { title: "$:/config/OriginalTiddlerPaths", text: JSON.stringify({ [TITLE]: "pack.json" }) } }, origin);
  const projector = projectorOver(null, work);
  const stop = projector.start(engine(null) as never);
  await projector.idle();
  expect(existsSync(carrier())).toBe(false);
  await stop();
});
