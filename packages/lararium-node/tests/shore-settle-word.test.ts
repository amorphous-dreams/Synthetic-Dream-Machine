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
 * Controls: records that already stand answer at once; a carrier a HIGHER bag projects, and a bag no
 * mirror holds, answer at once naming it; a projector that stops ends the wait by name.
 *
 * Each reading stands red first: a view whose origin names a LOWER bag keeps the wait (the records have not
 * arrived), a later word for the same carrier supersedes an earlier wait, a change to another carrier renders
 * nothing of a waiting one, a stop before the marked reconcile runs reads `stopped`, and a reconcile or a look
 * that throws reads `failed` and leaves no watch behind.
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
/** The composition's ranks: a lower bag, this mirror's bag, a higher one. */
const RANKS: Record<string, number> = { "lower-bag": 0, [BAG]: 1, "higher-bag": 2 };
const rankOf = (bag: string): number => RANKS[bag] ?? -1;

async function stand(initial = "THE FIRST RECORDS", origin = BAG, opts: { ranks?: boolean } = { ranks: true }) {
  root = mkdtempSync(join(tmpdir(), "lar-settle-"));
  roots.push(root);
  let records = initial;
  let originBag: string | null = origin;
  let handler: ((changes: Record<string, unknown>) => void) | null = null;
  const calls: { renders: number; throwAt: number; during?: () => void } = { renders: 0, throwAt: 0 };
  const projector = new LarDiskProjector({
    mirrors: [{ bagId: BAG, mirrorRoot: root }],
    carrierFileFn: async () => {
      calls.renders += 1;
      calls.during?.();
      if (calls.throwAt !== 0 && calls.renders >= calls.throwAt) throw new Error("the render threw");
      return { ext: MEME_EXT, body: body(records), encoding: "utf8" };
    },
    ...(opts.ranks ? { layerIndexOf: rankOf } : {}),
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
  const raiseOther = (): void => { handler?.({ "lar:///ha.ka.ba/probe/another-carrier": { modified: true } }); };
  return { projector, file, arrive, raise, raiseOther, calls };
}

/** The settle waits a projector holds, read for the leak vector. */
const waitsHeld = (p: LarDiskProjector): number => (p as unknown as { settleWakes: Set<unknown> }).settleWakes.size;
/** The reconcile watches a projector holds, read for the leak vector. */
const watchesHeld = (p: LarDiskProjector): number => (p as unknown as { reconcileWatches: Map<unknown, unknown> }).reconcileWatches.size;

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
    expect(answered).toEqual({ ok: true, op: "settle", bag: BAG, mirrored: true, settledCount: 1, elsewhereCount: 0, supersededCount: 0 });
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

  test("an intermediate state of this bag keeps the wait: a family lands title by title, and the named records still come", async () => {
    const s = await stand();
    let answered = false;
    const asked = answerShore(s.projector, { op: "settle", bag: BAG, carriers: [{ uri: URI, records: carrierHash(body("THE LAST WORDS")) }] });
    void asked.then(() => { answered = true; });
    await flushJobs();
    s.arrive("A WORD ON THE WAY");
    await flushJobs();
    expect(answered).toBe(false);
    s.arrive("THE LAST WORDS");
    expect(await asked).toMatchObject({ ok: true, settledCount: 1 });
    expect(readFileSync(s.file, "utf-8")).toBe(body("THE LAST WORDS"));
  });

  test("CONTROL: a lower bag's edit while the named records travel keeps the wait", async () => {
    const s = await stand("THE LOWER COPY", "lower-bag");
    let answered: Record<string, unknown> | null = null;
    const asked = answerShore(s.projector, { op: "settle", bag: BAG, carriers: [{ uri: URI, records: carrierHash(body("THE EDIT")) }] })
      .then((a) => { answered = a; });
    await flushJobs();
    s.arrive("THE LOWER COPY, EDITED", "lower-bag");
    await flushJobs();
    expect(answered).toBeNull();
    s.arrive("THE EDIT", BAG);
    await asked;
    expect(answered).toMatchObject({ ok: true, settledCount: 1, supersededCount: 0 });
  });

  test("a carrier a higher bag projects answers as elsewhere, and a projector that stops ends the wait by name", async () => {
    const s = await stand();
    const asked = answerShore(s.projector, { op: "settle", bag: BAG, carriers: [{ uri: URI, records: carrierHash(body("NEVER")) }] });
    s.arrive("STILL OTHER WORDS", "higher-bag");
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
      .toEqual({ ok: true, op: "settle", bag: BAG, mirrored: true, settledCount: 1, elsewhereCount: 0, supersededCount: 0 });
    expect(await answerShore(s.projector, { op: "settle", bag: "no-such-bag", carriers: [{ uri: URI, records: "x" }] }))
      .toMatchObject({ ok: true, mirrored: false, settledCount: 0 });
    expect(await answerShore(s.projector, { op: "settle", bag: BAG })).toMatchObject({ ok: false, refusal: "shore-answer-incomplete" });
    expect(await answerShore(s.projector, { op: "settle", carriers: [] })).toMatchObject({ ok: false, refusal: "shore-answer-incomplete" });
  });

  test("F4.1 a view whose origin names a LOWER bag waits for the records: the first edit into this bag settles only once it arrives", async () => {
    // The carrier stands in a lower bag; the gesture lands its first record in this one. Until sync carries it,
    // the view still shows the lower copy.
    const s = await stand("THE LOWER COPY", "lower-bag");
    let answered: Record<string, unknown> | null = null;
    const asked = answerShore(s.projector, { op: "settle", bag: BAG, carriers: [{ uri: URI, records: carrierHash(body("THE FIRST EDIT")) }] })
      .then((a) => { answered = a; });
    await flushJobs();
    expect(answered, "no word while the view shows the lower bag's copy").toBeNull();
    s.arrive("THE FIRST EDIT", BAG);
    await asked;
    expect(answered).toMatchObject({ ok: true, settledCount: 1, elsewhereCount: 0 });
    // CONTROL: with no reading of the composition, another origin never reads as elsewhere.
    const t = await stand("A COPY", "higher-bag", { ranks: false });
    let unranked: Record<string, unknown> | null = null;
    void answerShore(t.projector, { op: "settle", bag: BAG, carriers: [{ uri: URI, records: carrierHash(body("NEVER")) }] }).then((a) => { unranked = a; });
    await flushJobs();
    expect(unranked).toBeNull();
    await t.projector.stop();
  });

  test("F4.2 a later word for the same carrier supersedes an earlier wait, so waits never pile; a change to another carrier renders nothing of it", async () => {
    const s = await stand();
    let answered: Record<string, unknown> | null = null;
    const first = answerShore(s.projector, { op: "settle", bag: BAG, carriers: [{ uri: URI, records: carrierHash(body("NEVER ARRIVES")) }] })
      .then((a) => { answered = a; });
    await flushJobs();
    const rendered = s.calls.renders;
    s.raiseOther();
    await flushJobs();
    expect(s.calls.renders, "a change that names another carrier renders nothing of the waiting one").toBe(rendered);
    expect(answered).toBeNull();
    // The caller gave up on the first word and asks again: the later word takes the carrier.
    const second = answerShore(s.projector, { op: "settle", bag: BAG, carriers: [{ uri: URI, records: carrierHash(body("THE NEXT RECORDS")) }] });
    await first;
    expect(answered).toMatchObject({ ok: true, settledCount: 0, supersededCount: 1, superseded: [URI] });
    expect(waitsHeld(s.projector)).toBe(1);
    s.arrive("THE NEXT RECORDS");
    expect(await second).toMatchObject({ ok: true, settledCount: 1, supersededCount: 0 });
    expect(waitsHeld(s.projector)).toBe(0);
  });

  test("CONTROL: a later word for the same carrier in ANOTHER bag supersedes nothing: each bag waits for its own records", async () => {
    root = mkdtempSync(join(tmpdir(), "lar-settle-two-bags-"));
    roots.push(root);
    let words = "BEFORE"; let origin = "lower-bag";
    let handler: ((changes: Record<string, unknown>) => void) | null = null;
    const projector = new LarDiskProjector({
      mirrors: [{ bagId: BAG, mirrorRoot: join(root, "a") }, { bagId: "lower-bag", mirrorRoot: join(root, "b") }],
      carrierFileFn: async () => ({ ext: MEME_EXT, body: body(words), encoding: "utf8" }),
      layerIndexOf: rankOf,
      syncedTree: new SyncedTree(join(root, ".projection", "synced-tree")),
    });
    projector.start({ $tw: { wiki: {
      getTiddler: (title: string) => (title === URI ? { fields: { title, "$origin-bag": origin } } : undefined),
      allTitles: () => [URI],
      addEventListener: (_: string, fn: (changes: Record<string, unknown>) => void) => { handler = fn; },
      removeEventListener: () => {},
    } } } as unknown as TW5Engine);
    await projector.idle();
    let first: Record<string, unknown> | null = null;
    const waitingHere = answerShore(projector, { op: "settle", bag: BAG, carriers: [{ uri: URI, records: carrierHash(body("HERE")) }] });
    void waitingHere.then((a) => { first = a; });
    await flushJobs();
    const below = answerShore(projector, { op: "settle", bag: "lower-bag", carriers: [{ uri: URI, records: carrierHash(body("BELOW")) }] });
    await flushJobs();
    expect(first, "the other bag's word left this one waiting").toBeNull();
    words = "BELOW"; handler!({ [URI]: { modified: true } });
    expect(await below).toMatchObject({ ok: true, settledCount: 1 });
    words = "HERE"; origin = BAG; handler!({ [URI]: { modified: true } });
    expect(await waitingHere).toMatchObject({ ok: true, settledCount: 1, supersededCount: 0 });
  });

  test("F4.3 a stop that lands before the marked reconcile runs reads stopped, never settled", async () => {
    const s = await stand();
    const asked = answerShore(s.projector, { op: "settle", bag: BAG, carriers: [{ uri: URI, records: carrierHash(body("THE FIRST RECORDS")) }] });
    const stopping = s.projector.stop();
    expect(await asked).toMatchObject({ ok: false, refusal: "projector-stopped", stoppedCount: 1, stopped: [URI] });
    await stopping;
  });

  test("F4.4 a reconcile that throws reads failed, never settled", async () => {
    const s = await stand();
    // The look renders once; the reconcile it marks renders next, and that render throws.
    s.calls.throwAt = s.calls.renders + 2;
    const answered = await answerShore(s.projector, { op: "settle", bag: BAG, carriers: [{ uri: URI, records: carrierHash(body("THE FIRST RECORDS")) }] });
    expect(answered).toMatchObject({ ok: false, refusal: "projection-failed", failedCount: 1, failed: [URI], settledCount: 0 });
    expect(watchesHeld(s.projector)).toBe(0);
  });

  test("a view a lower bag answers renders nothing for the word: a render that would throw there never fails the wait", async () => {
    const s = await stand("THE LOWER COPY", "lower-bag");
    s.calls.throwAt = s.calls.renders + 1;
    let answered: Record<string, unknown> | null = null;
    const asked = answerShore(s.projector, { op: "settle", bag: BAG, carriers: [{ uri: URI, records: carrierHash(body("THE EDIT")) }] });
    void asked.then((a) => { answered = a; });
    await flushJobs();
    expect(answered, "the wait goes on while a lower bag answers the view").toBeNull();
    s.calls.throwAt = 0;
    s.arrive("THE EDIT", BAG);
    expect(await asked).toMatchObject({ ok: true, settledCount: 1 });
  });

  test("a view that moves to another bag while the look renders counts for nothing: the next look reads it", async () => {
    const s = await stand("THE NAMED WORDS", "lower-bag");
    // This bag answers the view as the word asks, with no event yet; during the word's first render the view
    // moves back beneath it.
    s.arrive("THE NAMED WORDS", BAG, { event: false });
    s.calls.during = () => { s.calls.during = undefined; s.arrive("THE NAMED WORDS", "lower-bag", { event: false }); };
    let answered: Record<string, unknown> | null = null;
    const asked = answerShore(s.projector, { op: "settle", bag: BAG, carriers: [{ uri: URI, records: carrierHash(body("THE NAMED WORDS")) }] });
    void asked.then((a) => { answered = a; });
    await flushJobs();
    expect(answered, "a render read under this bag while the view moved away settles nothing").toBeNull();
    s.arrive("THE NAMED WORDS", BAG);
    expect(await asked).toMatchObject({ ok: true, settledCount: 1 });
  });

  test("a render that throws while the view moves off this bag fails nothing: the wait goes on", async () => {
    const s = await stand("THE NAMED WORDS", "lower-bag");
    s.arrive("THE NAMED WORDS", BAG, { event: false });
    // During the word's first render the view moves beneath this bag, and that render throws.
    s.calls.during = () => { s.calls.during = undefined; s.calls.throwAt = s.calls.renders; s.arrive("THE NAMED WORDS", "lower-bag", { event: false }); };
    let answered: Record<string, unknown> | null = null;
    const asked = answerShore(s.projector, { op: "settle", bag: BAG, carriers: [{ uri: URI, records: carrierHash(body("THE NAMED WORDS")) }] });
    void asked.then((a) => { answered = a; });
    await flushJobs();
    expect(answered, "a throw read under a view that moved away fails nothing").toBeNull();
    s.calls.throwAt = 0;
    s.arrive("THE NAMED WORDS", BAG);
    expect(await asked).toMatchObject({ ok: true, settledCount: 1 });
  });

  test("a look that cannot render a carrier names it failed, and the watch an earlier carrier took leaves with the word", async () => {
    // Two carriers: the first matches and takes a watch; the look then throws rendering the second.
    root = mkdtempSync(join(tmpdir(), "lar-settle-look-"));
    roots.push(root);
    const OTHER = `${URI}-other`;
    let throwing = false;
    const projector = new LarDiskProjector({
      mirrors: [{ bagId: BAG, mirrorRoot: root }],
      carrierFileFn: async (uri) => {
        if (throwing && uri === OTHER) throw new Error("the look threw");
        return { ext: MEME_EXT, body: `title: ${uri}\n\nWORDS\n`, encoding: "utf8" };
      },
      layerIndexOf: rankOf,
      syncedTree: new SyncedTree(join(root, ".projection", "synced-tree")),
    });
    projector.start({ $tw: { wiki: {
      getTiddler: (title: string) => ([URI, OTHER].includes(title) ? { fields: { title, "$origin-bag": BAG } } : undefined),
      allTitles: () => [URI, OTHER],
      addEventListener: () => {}, removeEventListener: () => {},
    } } } as unknown as TW5Engine);
    await projector.idle();
    throwing = true;
    const answered = await answerShore(projector, { op: "settle", bag: BAG, carriers: [
      { uri: URI, records: carrierHash(`title: ${URI}\n\nWORDS\n`) }, { uri: OTHER, records: carrierHash(`title: ${OTHER}\n\nWORDS\n`) },
    ] });
    expect(answered).toMatchObject({ ok: false, refusal: "projection-failed", failed: [OTHER], settledCount: 1 });
    expect(watchesHeld(projector)).toBe(0);
  });
});
