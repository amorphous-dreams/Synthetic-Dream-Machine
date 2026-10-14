/**
 * THE SETTLE WORD — the projector says when the projection that landed records cause has run.
 *
 * `lares ingest --apply` lands records, often in another island's store, and they reach this wiki by sync
 * at no instant a caller can name. A scan that followed on a nap read a file the projection still moved.
 * The shore's `settle` act names each carrier with the hash its records render; the projector answers once
 * the wiki holds those records and its reconcile queue drained, so the file already stands as the
 * projection leaves it. No clock: the wait wakes at each change event the wiki raises.
 *
 * Here the records arrive by a change event the test raises, as sync would. The real projector writes a
 * scratch mirror.
 *
 * Controls: records that already stand answer at once; a carrier another bag projects, and a bag no
 * mirror holds, answer at once naming it; a projector that stops ends the wait by name.
 */
import { describe, test, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { carrierHash } from "@lararium/mesh";
import { MEME_EXT } from "@lararium/mesh/mirror-paths";
import { LarDiskProjector } from "../src/disk-projector.js";
import { SyncedTree } from "../src/synced-tree.js";
import { answerShore } from "../src/shore-verb.js";
import type { TW5Engine } from "@lararium/tw5";

let root = "";
/** Every scratch root a vector stood, so a vector that stands two leaves neither behind. */
const roots: string[] = [];
afterEach(() => { for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true }); root = ""; });

const BAG = "lares";
const URI = "lar:///ha.ka.ba/probe/settle-word";
const body = (words: string): string => `title: ${URI}\n\n${words}\n`;

/** A wiki whose records a test moves by hand, raising the change event sync would raise. */
async function stand(initial = "THE FIRST RECORDS", origin = BAG) {
  root = mkdtempSync(join(tmpdir(), "lar-settle-"));
  roots.push(root);
  let records = initial;
  let originBag: string | null = origin;
  let handler: ((changes: Record<string, unknown>) => void) | null = null;
  const projector = new LarDiskProjector({
    mirrors: [{ bagId: BAG, mirrorRoot: root }],
    carrierFileFn: async () => ({ ext: MEME_EXT, body: body(records), encoding: "utf8" }),
    syncedTree: new SyncedTree(join(root, ".projection", "synced-tree")),
  });
  const engine = { $tw: { wiki: {
    getTiddler: (title: string) => (title === URI ? { fields: { title, ...(originBag !== null ? { "$origin-bag": originBag } : {}) } } : undefined),
    allTitles: () => [URI],
    addEventListener: (_: string, fn: (changes: Record<string, unknown>) => void) => { handler = fn; },
    removeEventListener: () => {},
  } } } as unknown as TW5Engine;
  projector.start(engine);
  await projector.idle();
  const file = join(root, `${URI.slice("lar:///".length)}${MEME_EXT}`);
  /** Sync delivers new records: the wiki's view moves and, unless held back, raises its change event. A `null`
   *  bag names no origin. */
  const arrive = (words: string, bag: string | null = originBag, opts: { event?: boolean } = {}): void => {
    records = words; originBag = bag;
    if (opts.event !== false) handler?.({ [URI]: { modified: true } });
  };
  const raise = (): void => { handler?.({ [URI]: { modified: true } }); };
  return { projector, file, arrive, raise };
}

/** The settle waits a projector holds, read for the leak vector. */
const waitsHeld = (p: LarDiskProjector): number => (p as unknown as { settleWakes: Set<unknown> }).settleWakes.size;

/** Let every pending job run: a wait that answered early would answer here. A flush, never a nap. */
const flushJobs = async (): Promise<void> => { for (let i = 0; i < 5; i++) await new Promise<void>((r) => setImmediate(r)); };

describe("the settle word", () => {
  test("waits for the records it names, then answers once the projection they cause has written the file", async () => {
    const s = await stand();
    expect(readFileSync(s.file, "utf-8")).toBe(body("THE FIRST RECORDS"));
    let answered: Record<string, unknown> | null = null;
    const asked = answerShore(s.projector, { op: "settle", bag: BAG, carriers: [{ uri: URI, records: carrierHash(body("THE LANDED RECORDS")) }] })
      .then((a) => { answered = a; });
    await flushJobs();
    expect(answered, "no word while the wiki holds other records").toBeNull();
    s.arrive("THE LANDED RECORDS");
    await asked;
    expect(answered).toEqual({ ok: true, op: "settle", bag: BAG, mirrored: true, settledCount: 1, elsewhereCount: 0 });
    // THE WORD COMES AFTER THE PROJECTION: the file already holds what the records render.
    expect(readFileSync(s.file, "utf-8")).toBe(body("THE LANDED RECORDS"));
  });

  test("the word waits for the whole queue: siblings the same change marked stand written when it answers", async () => {
    // One change event lands the named carrier and twelve siblings. The queue reconciles them one root at a
    // time and yields to the host between roots, so a word given at the named carrier's match alone would
    // answer while siblings still wait to write.
    root = mkdtempSync(join(tmpdir(), "lar-settle-q-"));
    roots.push(root);
    const uris = [URI, ...Array.from({ length: 12 }, (_, i) => `${URI}-sibling-${String(i).padStart(2, "0")}`)];
    const words = new Map(uris.map((u) => [u, "BEFORE"] as const));
    let handler: ((changes: Record<string, unknown>) => void) | null = null;
    const projector = new LarDiskProjector({
      mirrors: [{ bagId: BAG, mirrorRoot: root }],
      carrierFileFn: async (uri) => ({ ext: MEME_EXT, body: `title: ${uri}\n\n${words.get(uri)}\n`, encoding: "utf8" }),
      syncedTree: new SyncedTree(join(root, ".projection", "synced-tree")),
    });
    projector.start({ $tw: { wiki: {
      getTiddler: (title: string) => (words.has(title) ? { fields: { title, "$origin-bag": BAG } } : undefined),
      allTitles: () => uris,
      addEventListener: (_: string, fn: (changes: Record<string, unknown>) => void) => { handler = fn; },
      removeEventListener: () => {},
    } } } as unknown as TW5Engine);
    await projector.idle();
    const fileOf = (u: string): string => join(root, `${u.slice("lar:///".length)}${MEME_EXT}`);
    const asked = answerShore(projector, { op: "settle", bag: BAG, carriers: [{ uri: URI, records: carrierHash(`title: ${URI}\n\nAFTER\n`) }] });
    for (const u of uris) words.set(u, "AFTER");
    handler!(Object.fromEntries(uris.map((u) => [u, { modified: true }])));
    expect(await asked).toMatchObject({ ok: true, settledCount: 1 });
    for (const u of uris) expect(readFileSync(fileOf(u), "utf-8"), u).toBe(`title: ${u}\n\nAFTER\n`);
  });

  test("a view that moved before its change event: the word still follows the projection, and a late event changes nothing", async () => {
    // TW5 raises the change event on a later tick than the view moves. The view holds the records here
    // and no event has come: the word must not rest on the queue's look of idleness.
    const s = await stand();
    s.arrive("MOVED WITHOUT A WORD", BAG, { event: false });
    const answered = await answerShore(s.projector, { op: "settle", bag: BAG, carriers: [{ uri: URI, records: carrierHash(body("MOVED WITHOUT A WORD")) }] });
    expect(answered).toMatchObject({ ok: true, settledCount: 1 });
    expect(readFileSync(s.file, "utf-8")).toBe(body("MOVED WITHOUT A WORD"));
    s.raise();
    await s.projector.idle();
    expect(readFileSync(s.file, "utf-8")).toBe(body("MOVED WITHOUT A WORD"));
  });

  test("a view that names no origin yet counts as not arrived, never as another bag's", async () => {
    const s = await stand();
    s.arrive("THE FIRST RECORDS", null, { event: false });
    let answered: Record<string, unknown> | null = null;
    const asked = answerShore(s.projector, { op: "settle", bag: BAG, carriers: [{ uri: URI, records: carrierHash(body("ARRIVED WITH ITS BAG")) }] })
      .then((a) => { answered = a; });
    await flushJobs();
    expect(answered).toBeNull();
    s.arrive("ARRIVED WITH ITS BAG", BAG);
    await asked;
    expect(answered).toMatchObject({ ok: true, settledCount: 1, elsewhereCount: 0 });
  });

  test("no wait outlives its answer: the projector holds no settle waiter once each word came back", async () => {
    const s = await stand();
    for (let i = 0; i < 3; i++) {
      await answerShore(s.projector, { op: "settle", bag: BAG, carriers: [{ uri: URI, records: carrierHash(body("THE FIRST RECORDS")) }] });
    }
    const asked = answerShore(s.projector, { op: "settle", bag: BAG, carriers: [{ uri: URI, records: carrierHash(body("LATER")) }] });
    await flushJobs();
    expect(waitsHeld(s.projector)).toBe(1);
    s.arrive("LATER");
    await asked;
    expect(waitsHeld(s.projector)).toBe(0);
  });

  test("an intermediate change that names other records keeps the wait", async () => {
    const s = await stand();
    let answered = false;
    const asked = answerShore(s.projector, { op: "settle", bag: BAG, carriers: [{ uri: URI, records: carrierHash(body("THE LAST WORDS")) }] })
      .then(() => { answered = true; });
    s.arrive("A WORD ON THE WAY");
    await flushJobs();
    expect(answered).toBe(false);
    s.arrive("THE LAST WORDS");
    await asked;
    expect(readFileSync(s.file, "utf-8")).toBe(body("THE LAST WORDS"));
  });

  test("a carrier another bag projects answers as elsewhere, and a projector that stops ends the wait by name", async () => {
    const s = await stand();
    const asked = answerShore(s.projector, { op: "settle", bag: BAG, carriers: [{ uri: URI, records: carrierHash(body("NEVER")) }] });
    s.arrive("STILL OTHER WORDS", "another-bag");
    expect(await asked).toMatchObject({ ok: true, settledCount: 0, elsewhereCount: 1 });

    const t = await stand();
    const waiting = answerShore(t.projector, { op: "settle", bag: BAG, carriers: [{ uri: URI, records: carrierHash(body("NEVER")) }] });
    await flushJobs();
    await t.projector.stop();
    expect(await waiting).toMatchObject({ ok: false, refusal: "projector-stopped", stoppedCount: 1 });
  });

  test("CONTROL: records that already stand answer at once; a bag no mirror holds answers at once; an incomplete ask refuses", async () => {
    const s = await stand();
    expect(await answerShore(s.projector, { op: "settle", bag: BAG, carriers: [{ uri: URI, records: carrierHash(body("THE FIRST RECORDS")) }] }))
      .toEqual({ ok: true, op: "settle", bag: BAG, mirrored: true, settledCount: 1, elsewhereCount: 0 });
    expect(await answerShore(s.projector, { op: "settle", bag: "no-such-bag", carriers: [{ uri: URI, records: "x" }] }))
      .toMatchObject({ ok: true, mirrored: false, settledCount: 0 });
    expect(await answerShore(s.projector, { op: "settle", bag: BAG })).toMatchObject({ ok: false, refusal: "shore-answer-incomplete" });
    expect(await answerShore(s.projector, { op: "settle", carriers: [] })).toMatchObject({ ok: false, refusal: "shore-answer-incomplete" });
  });
});
