/**
 * canon-change-weighs-overrides — WHAT A SEED'S INGEST DOES TO THE WORKING OVERRIDES ABOVE THE CANON IT CHANGES.
 *
 * The seed feeds every disk-sourced holding through INGEST into canon (`bags/<slug>`), never through the wiki's working
 * layer. A working override of a title canon holds remembers the canon text it forked from (`meta.overrideBase`); when
 * INGEST moves canon under it, the override weighs (`override-bases.ts`):
 *
 *   W1  a re-seed over a working edit to a disk title leaves the working bytes unchanged; the override stands off
 *       under a key, and the outcome names it
 *   W2  a working-only title is in canon neither before nor after the seed (nothing promotes)
 *   W3  a disk-deleted title with a working copy: the wave tombstones nothing in canon (the removal stands pending at
 *       the shore), and the working copy stays as it stood
 *   W4  an override whose text still equals its base (a stale untouched copy) retracts after a canon change, so the new
 *       canon shows through; the outcome counts it
 *   W5  the override verb lists a diverged override with its key; take-working re-bases it (its text untouched, the
 *       standoff gone); take-canon retracts it; a stale key takes nothing
 *   W6  CONTROL: an INGEST that changes nothing under an override leaves it standing quiet
 */
import { describe, test, expect } from "vitest";
import { AutomergeDocStore, CompositeStore, emptyLarDoc, overrideBaseOf, overrideTextHash, type CapabilityAccess, type CapabilityVerifyResult, type Verb, type VerbContext } from "@lararium/mesh";
import { carrierHash } from "@lararium/mesh/crypto";
import { Repo } from "./wiki-shore-rig.js";
import { registerActionReactors, makeOverrideReactor } from "../src/action-handler.js";
import { VerbTable } from "../src/verb-dispatcher.js";

const CANON = "lar:///ha.ka.ba/bags/probe";
const WORKING = "lar:///ha.ka.ba/wikis/probe/working";
const URI = "lar:///t.seed.weighs/one";
const hand = { kind: "tw-local", instanceId: "test" } as const;

const carrier = (prose: string): string =>
  `<<^ code=\`&#x0001;\` from=\`?\` to=\`${URI}\`>>\n<<^ code=\`&#x0002;\`>>\n\n` +
  "```toml meta\nuri-path = \"t.seed.weighs/one\"\n```\n\n" +
  `! One\n\n${prose}\n\n<<^ code=\`&#x0003;\`>>\n\n<<^ code=\`&#x0004;\` to=\`?\`>>\n`;

const allowCap = async (_a: CapabilityAccess, _b: string): Promise<CapabilityVerifyResult> => ({ ok: true });
const ctxOf = (composite: CompositeStore, action: string, args: Record<string, unknown>): VerbContext => ({
  daemon: composite, cap: allowCap,
  invocation: { requestId: `req-${action}`, title: `lar:///lararium.local.vm/verbs/req-${action}`, action, args, targets: [], batchMode: "best-effort", status: "pending", requestedBy: "operator-test", requestedAt: "2026-11-10T00:00:00Z" } as Verb,
});

async function rig() {
  const repo = new Repo({ network: [] });
  const canon = new AutomergeDocStore(repo.create(emptyLarDoc()), CANON);
  const working = new AutomergeDocStore(repo.create(emptyLarDoc()), WORKING);
  const composite = new CompositeStore();
  composite.addLayer({ bagId: CANON, store: canon, writable: true, defaultWritable: false });
  composite.addLayer({ bagId: WORKING, store: working, writable: true, defaultWritable: true });
  const table = new VerbTable();
  registerActionReactors(table, { composite });
  let synced: string | null = null;
  let records: string | undefined;
  /** One seed wave of the carrier's bytes into canon, the gesture's synced base riding along. */
  const seed = async (text: string, extra: Record<string, unknown> = {}) => {
    const args = { "source-uri": "file:///scratch/bags/probe", "to-bag": CANON, "change-id": `chg-${Math.random()}`, carriers: [{ uri: URI, text, diskHash: carrierHash(text), syncedHash: synced, ...(records ? { syncedRecordsHash: records } : {}), ext: ".mem" }], ...extra };
    const out = await table.get("INGEST")!(args, ctxOf(composite, "INGEST", args)) as Record<string, unknown>;
    const row = (out["carriers"] as Array<Record<string, unknown>>)[0]!;
    if (row["decision"] === "ingest" || row["decision"] === "noop") { synced = carrierHash(text); records = row["canonicalHash"] as string | undefined; }
    return out;
  };
  const override = makeOverrideReactor({ composite });
  const ask = async (args: Record<string, unknown>) => override({ bag: CANON, ...args }, ctxOf(composite, "override", args)) as Promise<Record<string, unknown>>;
  const canonTitles = async () => (await canon.listVisible()).filter((t) => t.startsWith(URI));
  return { canon, working, composite, seed, ask, canonTitles };
}

describe("a seed's INGEST weighs the working overrides above the canon it changes", () => {
  test("W1 — a re-seed over a working edit leaves the working bytes unchanged and stands off under a key", async () => {
    const r = await rig();
    await r.seed(carrier("the first words"));
    const titles = await r.canonTitles();
    for (const t of titles) await r.composite.put({ tiddler: { ...(await r.canon.get(t))!.tiddler, text: `a hand's words for ${t}` } }, hand);
    const before = new Map(await Promise.all(titles.map(async (t) => [t, (await r.working.get(t))!.tiddler["text"]] as const)));
    const out = await r.seed(carrier("the disk moved on"));
    for (const [t, text] of before) expect((await r.working.get(t))?.tiddler["text"], t).toBe(text);
    const summary = out["overrides"] as { standing: Array<{ title: string; key: string }>; standingCount: number; retractedCount: number };
    expect(summary.standingCount).toBeGreaterThan(0);
    expect(summary.retractedCount).toBe(0);
    for (const s of summary.standing) expect(s.key).toMatch(/^[0-9a-f]{24}$/);
  });

  test("W2 — a working-only title is never promoted into canon", async () => {
    const r = await rig();
    await r.composite.put({ tiddler: { title: "lar:///t.seed.weighs/working-only", text: "only a hand wrote this" } }, hand);
    await r.seed(carrier("the first words"));
    await r.seed(carrier("the disk moved on"));
    expect(await r.canon.get("lar:///t.seed.weighs/working-only")).toBeNull();
    expect((await r.working.get("lar:///t.seed.weighs/working-only"))?.tiddler["text"]).toBe("only a hand wrote this");
  });

  test("W3 — a disk-deleted title with a working copy tombstones nothing in canon, and the copy stays", async () => {
    const r = await rig();
    await r.seed(carrier("the first words"));
    await r.composite.put({ tiddler: { title: URI, text: "a hand's copy" } }, hand);
    const gone = "lar:///t.seed.weighs/gone";
    await r.canon.put({ tiddler: { title: gone, text: "canon holds it" } }, hand);
    const args = { "source-uri": "file:///scratch/bags/probe", "to-bag": CANON, "change-id": "chg-del", carriers: [], deletions: [{ uri: gone, syncedHash: carrierHash("x") }] };
    const table = new VerbTable();
    registerActionReactors(table, { composite: r.composite });
    const out = await table.get("INGEST")!(args, ctxOf(r.composite, "INGEST", args)) as Record<string, unknown>;
    expect((out["deletions"] as { declined: string[] }).declined).toEqual([gone]);
    expect((await r.canon.get(gone))?.tiddler["text"]).toBe("canon holds it");
    expect((await r.working.get(URI))?.tiddler["text"]).toBe("a hand's copy");
  });

  test("W4 — a stale untouched copy retracts after the canon change, and the new canon shows through", async () => {
    const r = await rig();
    await r.seed(carrier("the first words"));
    const titles = await r.canonTitles();
    for (const t of titles) await r.composite.put({ tiddler: { ...(await r.canon.get(t))!.tiddler } }, hand);
    for (const t of titles) expect(overrideBaseOf(await r.working.get(t)), t).toBe(overrideTextHash((await r.canon.get(t))!.tiddler));
    const out = await r.seed(carrier("the disk moved on"));
    const moved = [] as string[];
    for (const t of titles) if ((await r.working.get(t)) === null) moved.push(t);
    expect(moved.length).toBeGreaterThan(0);
    expect((out["overrides"] as { retractedCount: number }).retractedCount).toBe(moved.length);
    for (const t of moved) expect((await r.composite.get(t))?.tiddler["text"]).toBe((await r.canon.get(t))?.tiddler["text"]);
    expect((out["overrides"] as { standingCount: number }).standingCount).toBe(0);
  });

  test("W5 — the override verb lists a diverged override; take-working re-bases, take-canon retracts, a stale key takes nothing", async () => {
    const r = await rig();
    await r.seed(carrier("the first words"));
    const titles = await r.canonTitles();
    for (const t of titles) await r.composite.put({ tiddler: { ...(await r.canon.get(t))!.tiddler, text: `edit ${t}` } }, hand);
    await r.seed(carrier("the disk moved on"));
    const listed = await r.ask({ op: "list" });
    const rows = listed["standoffs"] as Array<{ title: string; key: string }>;
    expect(listed["standoffCount"]).toBe(rows.length);
    expect(rows.length).toBeGreaterThan(0);
    const [first, second] = rows;

    expect(await r.ask({ op: "take-working", title: first!.title, key: "000000000000000000000000" })).toMatchObject({ ok: false, refusal: "standoff-key-moved" });
    expect(await r.ask({ op: "take-working", title: first!.title, key: first!.key })).toMatchObject({ ok: true, took: "working" });
    expect((await r.working.get(first!.title))?.tiddler["text"]).toBe(`edit ${first!.title}`);
    expect(overrideBaseOf(await r.working.get(first!.title))).toBe(overrideTextHash((await r.canon.get(first!.title))!.tiddler));
    const after = (await r.ask({ op: "list" }))["standoffs"] as Array<{ title: string }>;
    expect(after.map((s) => s.title)).not.toContain(first!.title);

    if (second) {
      expect(await r.ask({ op: "take-canon", title: second.title, key: second.key })).toMatchObject({ ok: true, took: "canon" });
      expect(await r.working.get(second.title)).toBeNull();
      expect((await r.composite.get(second.title))?.tiddler["text"]).toBe((await r.canon.get(second.title))?.tiddler["text"]);
    }
  });

  test("W6 — CONTROL: an INGEST that moves nothing under an override leaves it quiet", async () => {
    const r = await rig();
    await r.seed(carrier("the first words"));
    await r.composite.put({ tiddler: { title: URI, text: "a hand's words" } }, hand);
    const out = await r.seed(carrier("the first words"));
    expect(out["overrides"]).toBeUndefined();
    expect((await r.working.get(URI))?.tiddler["text"]).toBe("a hand's words");
    expect((await r.ask({ op: "list" }))["standoffCount"]).toBe(0);
  });
});
