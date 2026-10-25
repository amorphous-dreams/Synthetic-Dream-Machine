/**
 * THE SETTLE WORD ENDS CAUSALLY (road row G36). A gesture that landed records names, beside each carrier's
 * render hash, the causal heads it landed. The word then follows those heads through the wiki's view: it
 * settles when the view holds them (even where the view has moved past the named records), and it ends by name
 * when the far side closes with the heads still absent. A wall clock never decides: the caller's wait may have
 * gone, and the word still ends on a named causal reason.
 *
 * Red first: with no far-side seam the word for records that never arrive waits forever; with no heads seam a
 * view that moved past the named records keeps the wait. Controls: records that arrive settle the word; heads
 * named but neither shown nor closed keep the wait; a word that named no heads ignores a close.
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

const roots: string[] = [];
afterEach(() => { for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true }); });

const BAG = "lares";
const URI = "lar:///ha.ka.ba/probe/settle-heads";
const HEADS = ["a".repeat(64)];
const body = (words: string): string => `title: ${URI}\n\n${words}\n`;
const flushJobs = async (): Promise<void> => { for (let i = 0; i < 5; i++) await new Promise<void>((r) => setImmediate(r)); };

async function stand() {
  const root = mkdtempSync(join(tmpdir(), "lar-settle-heads-"));
  roots.push(root);
  let records = "THE FIRST RECORDS";
  let handler: ((changes: Record<string, unknown>) => void) | null = null;
  /** The heads the view has landed, as the island's ledger would hold them. */
  const landed = new Set<string>();
  const far = { closed: false, cancelled: 0, close: (): void => {} };
  const projector = new LarDiskProjector({
    mirrors: [{ bagId: BAG, mirrorRoot: root }],
    carrierFileFn: async () => ({ ext: MEME_EXT, body: body(records), encoding: "utf8" }),
    viewHolds: (_bag, _uri, heads) => heads.every((h) => landed.has(h)),
    farSideClosed: () => {
      let resolve: () => void = () => {};
      const promise = new Promise<void>((r) => { resolve = r; });
      far.close = () => { far.closed = true; resolve(); };
      return { promise, cancel: () => { far.cancelled += 1; } };
    },
    syncedTree: new SyncedTree(join(root, ".projection", "synced-tree")),
  });
  projector.start({ $tw: { wiki: {
    getTiddler: (title: string) => (title === URI ? { fields: { title, "$origin-bag": BAG } } : undefined),
    allTitles: () => [URI],
    addEventListener: (_: string, fn: (changes: Record<string, unknown>) => void) => { handler = fn; },
    removeEventListener: () => {},
  } } } as unknown as TW5Engine);
  await projector.idle();
  const file = join(root, `${URI.slice("lar:///".length)}${MEME_EXT}`);
  /** Sync delivers records and heads: the view moves, the ledger lands the heads, the change event follows. */
  const arrive = (words: string, heads: readonly string[] = HEADS): void => {
    records = words;
    for (const h of heads) landed.add(h);
    handler?.({ [URI]: { modified: true } });
  };
  return { projector, file, arrive, far };
}
const waitsHeld = (p: LarDiskProjector): number => (p as unknown as { settleWakes: Set<unknown> }).settleWakes.size
  + (p as unknown as { settleInboxes: Set<unknown> }).settleInboxes.size;

const ask = (s: Awaited<ReturnType<typeof stand>>, words: string, heads?: readonly string[]) =>
  answerShore(s.projector, { op: "settle", bag: BAG, carriers: [{ uri: URI, records: carrierHash(body(words)), ...(heads ? { heads } : {}) }] });

describe("the settle word follows the heads its gesture landed", () => {
  test("RED: the named records never arrive and the far side closes: the word ends naming the carrier, whoever still waits", async () => {
    const s = await stand();
    // The caller's wait has gone: nothing awaits the word. It stands, and the close alone ends it.
    let answered: Record<string, unknown> | null = null;
    void ask(s, "NEVER LANDS", HEADS).then((a) => { answered = a; });
    await flushJobs();
    expect(answered, "no word while the heads could still arrive").toBeNull();
    s.far.close();
    await flushJobs();
    expect(answered).toMatchObject({ ok: false, refusal: "far-side-closed", closedCount: 1, closed: [URI], settledCount: 0 });
    // The word leaves nothing behind.
    expect(waitsHeld(s.projector)).toBe(0);
    expect(s.far.cancelled).toBeGreaterThan(0);
  });

  test("RED: the view holds the named heads but renders a later state: the word settles and the file shows that state", async () => {
    const s = await stand();
    const asked = ask(s, "THE NAMED RECORDS", HEADS);
    await flushJobs();
    // The view moved past the named records before it could show them: other words, the named heads landed.
    s.arrive("A LATER STATE");
    expect(await asked).toMatchObject({ ok: true, settledCount: 1, settled: [URI] });
    expect(readFileSync(s.file, "utf-8")).toBe(body("A LATER STATE"));
  });

  test("CONTROL: the named records arrive: the word settles on the hash, heads named or not", async () => {
    const s = await stand();
    const asked = ask(s, "THE LANDED RECORDS", HEADS);
    await flushJobs();
    s.arrive("THE LANDED RECORDS");
    expect(await asked).toMatchObject({ ok: true, settledCount: 1 });
    expect(readFileSync(s.file, "utf-8")).toBe(body("THE LANDED RECORDS"));
    const t = await stand();
    const plain = ask(t, "THE LANDED RECORDS");
    t.arrive("THE LANDED RECORDS", []);
    expect(await plain).toMatchObject({ ok: true, settledCount: 1 });
  });

  test("CONTROL: heads named, neither shown nor closed: the wait goes on through other events, then the heads settle it", async () => {
    const s = await stand();
    let answered: Record<string, unknown> | null = null;
    void ask(s, "THE NAMED RECORDS", HEADS).then((a) => { answered = a; });
    s.arrive("SOME OTHER WORDS", ["b".repeat(64)]);   // other heads land; the named ones stay absent
    await flushJobs();
    expect(answered).toBeNull();
    s.arrive("THE NAMED RECORDS");
    await flushJobs();
    expect(answered).toMatchObject({ ok: true, settledCount: 1 });
    expect(waitsHeld(s.projector)).toBe(0);
  });

  test("CONTROL: a close after the word settled changes nothing, and a word that named no heads ignores a close", async () => {
    const s = await stand();
    const settled = await ask(s, "THE FIRST RECORDS", HEADS);
    expect(settled).toMatchObject({ ok: true, settledCount: 1 });
    s.far.close();
    await flushJobs();
    expect(waitsHeld(s.projector)).toBe(0);

    const t = await stand();
    let answered: Record<string, unknown> | null = null;
    void ask(t, "NEVER LANDS").then((a) => { answered = a; });
    await flushJobs();
    t.far.close();
    await flushJobs();
    expect(answered, "a word without heads names no causal claim, so a close leaves it waiting").toBeNull();
    await t.projector.stop();
    await flushJobs();
    expect(answered).toMatchObject({ ok: false, refusal: "projector-stopped" });
  });

  test("a close that comes with the heads already landed reads one last look: the word settles, never closes", async () => {
    const s = await stand();
    const asked = ask(s, "THE NAMED RECORDS", HEADS);
    await flushJobs();
    // Heads land in the ledger and the far side closes before the change event reaches the wait.
    s.arrive("A LATER STATE");
    s.far.close();
    expect(await asked).toMatchObject({ ok: true, settledCount: 1 });
  });

  test("a heads list that is not whole refuses by name", async () => {
    const s = await stand();
    expect(await answerShore(s.projector, { op: "settle", bag: BAG, carriers: [{ uri: URI, records: "x", heads: "nope" }] }))
      .toMatchObject({ ok: false, refusal: "shore-answer-incomplete" });
    expect(await answerShore(s.projector, { op: "settle", bag: BAG, carriers: [{ uri: URI, records: "x", heads: [7] }] }))
      .toMatchObject({ ok: false, refusal: "shore-answer-incomplete" });
  });
});
