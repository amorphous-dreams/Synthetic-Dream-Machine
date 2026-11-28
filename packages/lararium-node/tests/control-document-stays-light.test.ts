/**
 * control-document-stays-light — THE CONTROL DOCUMENT'S RECORD COUNT STAYS BOUNDED, WHATEVER THE DOOR HAS ANSWERED.
 *
 * Mandate: lar:///ha.ka.ba/kahua/memory/state/course (the control document's weight). Measured off the engine itself
 * (control-diet#1, Automerge 3.5): one change to a LarDoc costs about a microsecond PER TITLE its `tiddlers` map holds,
 * whatever the history (100 titles 1.5 ms, 2,000 3.8 ms, 8,000 9.7 ms, 16,000 16.4 ms a change; 16,000 changes of
 * history over 50 titles 0.4 ms). Every change copies the map's materialized view on every replica that applies it. The
 * receipt ring held 43,456 facts before it evicted one, and an evicted fact, its bare outcome tombstone and its effect row
 * stayed in the document for good, so each door call's four changes grew dearer with every call the house had answered.
 *
 * The bars, each a count, none a clock:
 *   W1 — A THOUSAND LEDGERED WRITES LEAVE AT MOST ~6 TITLES PER RING SLOT: `ring` live facts with their rows, and `ring`
 *        evicted facts that still answer `retention-gap`; past both, a fact leaves the document with its rows.
 *   W2 — A FRESH LEDGER SEEDS ITS CACHE WITH THE LIVE RING ALONE: evicted facts read through the store when asked.
 *   W3 — THE VERDICTS HOLD ACROSS THE BOUNDS: the newest id answers `already-committed`, a retained evicted id
 *        `retention-gap`, and an id past both bounds reads as never seen (the ledger's honest memory ends there).
 *   W4 — A BOOT UNDER A TIGHTER RING SHEDS THE EXCESS IN BATCHES: the change count it writes stays far below one per fact.
 *
 * The test prints what it measured (titles, saved bytes, the cost of one change), for the floor to read.
 */
import { describe, test, expect } from "vitest";
import * as A from "@automerge/automerge";
import { Repo, type DocHandle } from "@automerge/automerge-repo";
import { emptyLarDoc, type LarDoc } from "@lararium/mesh/base-doc";
import { controlStoreOf } from "@lararium/mesh/control-home";
import { EFFECT_URI_PREFIX, OUTCOME_URI_PREFIX, RECEIPT_FACT_URI_PREFIX } from "@lararium/mesh/verb-tiddler";
import type { CompositeStore } from "@lararium/mesh/composite-store";
import { FactLedger } from "../src/uds-channel.js";

const FACE = "1";
const LIFE = "life-w";
const noFlush = { flush: async () => {} };

function stand(): { handle: DocHandle<LarDoc>; control: CompositeStore } {
  const repo = new Repo({ network: [] });
  const handle = repo.create<LarDoc>(emptyLarDoc());
  return { handle, control: controlStoreOf(handle) };
}

const titles = (handle: DocHandle<LarDoc>): string[] => Object.keys(handle.doc()?.tiddlers ?? {});
const changes = (handle: DocHandle<LarDoc>): number => A.stats(handle.doc() as A.Doc<unknown>).numChanges;

/** One ledgered write as the door and the island make it: the committed fact, the verdict row and effect row the island
 *  rests, then the done fact the channel observes. */
async function write(ledger: FactLedger, control: CompositeStore, i: number): Promise<void> {
  const id = `w-${i}`, digest = `sha256-${i}`, effectKey = `effect-${i}`;
  const verdict = await ledger.arbitrate(id, digest, FACE, "tiddler-put", effectKey);
  if (verdict.verdict !== "run") throw new Error(`write ${id} arbitrated ${JSON.stringify(verdict)}`);
  const origin = { kind: "lares-verb", requestId: id } as const;
  await control.put({ tiddler: { title: `${OUTCOME_URI_PREFIX}${id}`, status: "done", "input-digest": digest, face: FACE, verb: "tiddler-put" } }, origin);
  await control.put({ tiddler: { title: `${EFFECT_URI_PREFIX}${effectKey}`, "effect-key": effectKey, "request-id": id, "input-digest": digest, face: FACE } }, origin);
  await ledger.observeOutcome(id, "done", digest, 200, FACE, "tiddler-put");
}

/** What one more record costs this document now, in milliseconds a change. */
function changeCost(handle: DocHandle<LarDoc>): number {
  const at = performance.now();
  for (let i = 0; i < 20; i++) handle.change((d) => { (d.tiddlers as Record<string, unknown>)[`probe-${i}`] = { tiddler: { title: `probe-${i}` } }; });
  const ms = (performance.now() - at) / 20;
  handle.change((d) => { for (let i = 0; i < 20; i++) delete (d.tiddlers as Record<string, unknown>)[`probe-${i}`]; });
  return ms;
}

describe("the control document stays light", () => {
  test("W1/W2/W3 — a thousand ledgered writes under a ring of 64: the titles stay bounded, the seed stays lazy, the verdicts hold", async () => {
    const RING = 64, WRITES = 1000;
    const { handle, control } = stand();
    const ledger = new FactLedger(control, noFlush, RING, LIFE);
    for (let i = 0; i < WRITES; i++) await write(ledger, control, i);

    const all = titles(handle);
    const facts = all.filter((t) => t.startsWith(RECEIPT_FACT_URI_PREFIX)).length;
    console.log(`[control-stays-light] ${WRITES} writes, ring ${RING}: ${all.length} titles (${facts} facts), saved ${A.save(handle.doc() as A.Doc<unknown>).length} bytes, ${changeCost(handle).toFixed(2)} ms a change`);
    expect(facts, "W1: live facts plus the retained evicted ones").toBeLessThanOrEqual(2 * RING);
    expect(all.length, "W1: every title the ledger's writes leave").toBeLessThanOrEqual(6 * RING);

    // W2: a fresh ledger over the same document (a restart) seeds the live ring alone.
    const reborn = new FactLedger(control, noFlush, RING, LIFE);
    expect(await reborn.get(`w-${WRITES - 1}`)).not.toBeNull();
    const cache = (reborn as unknown as { cache: Map<string, unknown> }).cache;
    expect(cache.size, "W2: the seeded cache holds the live ring, not every fact the document names").toBeLessThanOrEqual(RING);

    // W3: the verdicts across the bounds.
    expect(await reborn.arbitrate(`w-${WRITES - 1}`, `sha256-${WRITES - 1}`, FACE, "tiddler-put", `effect-${WRITES - 1}`))
      .toEqual({ verdict: "refuse", reason: "already-committed" });
    const retained = `w-${WRITES - RING - 1}`;
    expect(await reborn.arbitrate(retained, `sha256-${WRITES - RING - 1}`, FACE)).toEqual({ verdict: "refuse", reason: "retention-gap" });
    expect(reborn.cached(retained), "W3: an evicted id still answers from the settled ledger").toMatchObject({ state: "evicted" });
    expect(await reborn.get("w-0"), "W3: an id past both bounds left the document").toBeNull();
    expect(handle.doc()?.tiddlers[`${OUTCOME_URI_PREFIX}w-0`], "W3: its outcome row left with it").toBeUndefined();
    expect(handle.doc()?.tiddlers[`${EFFECT_URI_PREFIX}effect-0`], "W3: its effect row left with it").toBeUndefined();
  }, 180_000);

  test("W4 — a boot under a tighter ring sheds the excess in batches, not one change per fact", async () => {
    const WIDE = 1000, TIGHT = 32, WRITES = 600;
    const { handle, control } = stand();
    const wide = new FactLedger(control, noFlush, WIDE, LIFE);
    for (let i = 0; i < WRITES; i++) await write(wide, control, i);
    const before = { titles: titles(handle).length, changes: changes(handle), cost: changeCost(handle) };

    const tight = new FactLedger(control, noFlush, TIGHT, LIFE);
    await tight.get("w-0");   // the seed runs, and its ring pass with it
    const after = { titles: titles(handle).length, changes: changes(handle), cost: changeCost(handle) };
    console.log(`[control-stays-light] boot shed: ${before.titles} -> ${after.titles} titles in ${after.changes - before.changes} changes (${before.cost.toFixed(2)} -> ${after.cost.toFixed(2)} ms a change)`);
    expect(after.titles, "W4: the tight ring's bound holds after the boot pass").toBeLessThanOrEqual(6 * TIGHT + 40 /* the probes' churn */);
    expect(after.changes - before.changes, "W4: the shed writes in batches").toBeLessThan(3 * TIGHT + 20);
  }, 180_000);
});
