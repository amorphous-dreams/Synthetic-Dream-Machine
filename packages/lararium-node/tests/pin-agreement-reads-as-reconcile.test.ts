/**
 * pin-agreement-reads-as-reconcile — `pinAgreement` weighs a file against the render `reconcileCarrier` would project.
 *
 * Three cases once read `differs` against a render reconcile never wrote, or `recorded` against one reconcile never
 * projects: a stray `.meta` beside a carrier whose render holds no metaBody, a shadowed own record under a top tombstone,
 * and a pack member whose bytes live inside its pack file.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { MemoryTiddlerStore } from "../../lararium-tw5/src/memory-store.js";
import { LarDiskProjector } from "../src/disk-projector.js";
import type { CarrierFile } from "@lararium/tw5";

const WORK = "lar:///ha.ka.ba/wikis/notes/working";
const DRAFT = "lar:///ha.ka.ba/wikis/notes/draft";
const TITLE = "lar:///ha.ka.ba/t/notes/pinned";
const origin = { kind: "operator-import", sessionId: "test" } as const;
let root = "";
afterEach(() => { if (root) rmSync(root, { recursive: true, force: true }); root = ""; });

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
const carrier = (): string => join(root, "ha.ka.ba/t/notes/pinned.mem");

function projectorOver(view: Record<string, unknown> | null, work: MemoryTiddlerStore, top?: MemoryTiddlerStore): LarDiskProjector {
  return new LarDiskProjector({
    ...(top ? { topRecordFn: async (uri: string) => (await top.get(uri)) ?? (await work.get(uri)) } : {}),
    mirrors: [{ bagId: WORK, mirrorRoot: root }],
    carrierFileFn: async (uri) => { const f = (engine(view) as { $tw: { wiki: { getTiddler(t: string): { fields: Record<string, unknown> } | undefined } } }).$tw.wiki.getTiddler(uri)?.fields; return f ? mem(String(f["text"])) : null; },
    recoveryStore: (bag) => bag === WORK ? work : null,
    recordFileFn: async (bag, uri) => {
      if (bag !== WORK) return null;
      const record = await work.get(uri);
      return record && !record.meta?.deleted ? mem(String(record.tiddler["text"])) : null;
    },
    bagsHolding: async (uri) => { const r = await work.get(uri); return r && !r.meta?.deleted ? [WORK] : []; },
  });
}

/** A file a hand left at the carrier's path, holding the working record's words. */
function handLeaves(text: string): string {
  mkdirSync(dirname(carrier()), { recursive: true });
  writeFileSync(carrier(), text);
  return carrier();
}

test("a stray .meta beside a carrier whose render holds no metaBody stays no part of the disk's state", async () => {
  root = mkdtempSync(join(tmpdir(), "pin-reads-meta-"));
  const work = new MemoryTiddlerStore(WORK);
  await work.put({ tiddler: { title: TITLE, text: "working words" } }, origin);
  const view = { title: TITLE, text: "working words", "$origin-bag": WORK };
  const projector = projectorOver(view, work);
  const stop = projector.start(engine(view) as never);
  await projector.idle();
  writeFileSync(carrier() + ".meta", "title: stray\n");
  expect(await projector.pinAgreement(WORK, TITLE, carrier())).toMatch(/^(kept|waiting|recorded)$/);
  await stop();
});

test("a shadowed own record under a top tombstone projects no render, so a file holding its words differs", async () => {
  root = mkdtempSync(join(tmpdir(), "pin-reads-tomb-"));
  const work = new MemoryTiddlerStore(WORK);
  const draft = new MemoryTiddlerStore(DRAFT);
  await work.put({ tiddler: { title: TITLE, text: "working words" } }, origin);
  await draft.put({ tiddler: { title: TITLE, text: "gone" } }, origin);
  await draft.tombstone(TITLE, origin);
  const projector = projectorOver(null, work, draft);
  const stop = projector.start(engine(null) as never);
  await projector.idle();
  expect(await projector.pinAgreement(WORK, TITLE, handLeaves("working words"))).toBe("differs");
  await stop();
});

test("a pack member projects no file of its own, so a file holding its words differs", async () => {
  root = mkdtempSync(join(tmpdir(), "pin-reads-pack-"));
  const work = new MemoryTiddlerStore(WORK);
  await work.put({ tiddler: { title: TITLE, text: "member words" } }, origin);
  await work.put({ tiddler: { title: "$:/config/OriginalTiddlerPaths", text: JSON.stringify({ [TITLE]: "pack.json" }) } }, origin);
  const projector = projectorOver(null, work);
  const stop = projector.start(engine(null) as never);
  await projector.idle();
  expect(await projector.pinAgreement(WORK, TITLE, handLeaves("member words"))).toBe("differs");
  await stop();
});
