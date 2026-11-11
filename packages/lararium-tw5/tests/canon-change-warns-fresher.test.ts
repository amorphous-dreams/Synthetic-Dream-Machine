/**
 * canon-change-warns-fresher — WHAT A SEED'S INGEST DOES TO THE WORKING COPIES ABOVE THE CANON IT CHANGES: NOTHING
 * BUT SAY SO.
 *
 * The seed feeds every disk-sourced holding through INGEST into canon (`bags/<slug>`), never through the wiki's working
 * layer. The recipe stack alone decides what shows: a top layer always shadows the one under it. A working copy of a
 * title canon holds remembers the carrier identity of the canon record it forked from (`meta.overrideBase`, `carrierHash`, tagged `sha256:<hex>`); when INGEST moves canon past it, the
 * outcome warns per title that canon stands fresher than the copy above it (`override-bases.ts`), and nothing writes.
 *
 *   W1  a re-seed over a working edit to a disk title: the copy still shadows canon, its bytes unchanged, and the warning
 *       names it
 *   W2  a working-only title is in canon neither before nor after the seed (nothing promotes)
 *   W3  a disk-deleted title with a working copy: the wave tombstones nothing in canon (the removal stands pending at
 *       the shore), and the working copy stays as it stood
 *   W4  an untouched copy (its text still equals its base) shadows too: it stands, and the warning names it
 *   W5  the fresher-canon read lists each copy whose canon moved past its base; it writes nothing
 *   W6  CONTROL: an INGEST that moves nothing under a copy raises no warning
 */
import { describe, test, expect } from "vitest";
import { AutomergeDocStore, CompositeStore, emptyLarDoc, overrideBaseOf, carrierHashOf, type CapabilityAccess, type CapabilityVerifyResult, type Verb, type VerbContext } from "@lararium/mesh";
import { carrierHash } from "@lararium/mesh/crypto";
import { Repo } from "./wiki-shore-rig.js";
import { registerActionReactors, makeFresherCanonReactor } from "../src/action-handler.js";
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
  const fresher = makeFresherCanonReactor({ composite });
  const ask = async (args: Record<string, unknown> = {}) => fresher({ bag: CANON, ...args }, ctxOf(composite, "fresher-canon", args)) as Promise<Record<string, unknown>>;
  const canonTitles = async () => (await canon.listVisible()).filter((t) => t.startsWith(URI));
  return { canon, working, composite, seed, ask, canonTitles };
}

describe("a seed's INGEST warns of fresher canon under a working copy, and writes nothing", () => {
  /** Write a working copy of every canon title of the carrier, through the composite (the fork names its base). */
  const copyAll = async (r: Awaited<ReturnType<typeof rig>>, text: (t: string) => string | undefined) => {
    const titles = await r.canonTitles();
    for (const t of titles) { const c = (await r.canon.get(t))!.tiddler; await r.composite.put({ tiddler: { ...c, text: text(t) ?? c["text"] } }, hand); }
    return titles;
  };
  const snapshot = async (r: Awaited<ReturnType<typeof rig>>, titles: readonly string[]) =>
    new Map(await Promise.all(titles.map(async (t) => [t, JSON.stringify(await r.working.get(t))] as const)));

  test("W1 — a re-seed over a working edit: the copy still shadows canon, bytes unchanged, and the warning names it", async () => {
    const r = await rig();
    await r.seed(carrier("the first words"));
    const titles = await copyAll(r, (t) => `a hand's words for ${t}`);
    const before = await snapshot(r, titles);
    const out = await r.seed(carrier("the disk moved on"));
    expect(await snapshot(r, titles)).toEqual(before);
    for (const t of titles) expect((await r.composite.get(t))?.tiddler["text"], t).toBe(`a hand's words for ${t}`);
    const warned = out["fresherCanon"] as { working: string; titles: string[]; count: number };
    expect(warned.working).toBe(WORKING);
    expect(warned.count).toBe(warned.titles.length);
    expect(warned.count).toBeGreaterThan(0);
    for (const t of warned.titles) expect(titles).toContain(t);
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

  test("W4 — an untouched copy shadows too: it stands after the canon change, and the warning names it", async () => {
    const r = await rig();
    await r.seed(carrier("the first words"));
    const titles = await copyAll(r, () => undefined);
    for (const t of titles) expect(overrideBaseOf(await r.working.get(t)), t).toBe(carrierHashOf((await r.canon.get(t))!.tiddler));
    const before = await snapshot(r, titles);
    const out = await r.seed(carrier("the disk moved on"));
    expect(await snapshot(r, titles)).toEqual(before);
    const moved = [] as string[];
    for (const t of titles) if ((await r.canon.get(t))?.tiddler["text"] !== (await r.working.get(t))?.tiddler["text"]) moved.push(t);
    expect(moved.length).toBeGreaterThan(0);
    expect([...(out["fresherCanon"] as { titles: string[] }).titles].sort()).toEqual([...moved].sort());
  });

  test("W5 — the fresher-canon read lists each copy whose canon moved past its base, and writes nothing", async () => {
    const r = await rig();
    await r.seed(carrier("the first words"));
    const titles = await copyAll(r, (t) => `edit ${t}`);
    expect((await r.ask())["count"]).toBe(0);
    const out = await r.seed(carrier("the disk moved on"));
    const before = await snapshot(r, titles);
    const read = await r.ask();
    const rows = read["fresher"] as Array<{ title: string; base: string; canonHash: string }>;
    expect(read["count"]).toBe(rows.length);
    expect(rows.map((x) => x.title).sort()).toEqual([...(out["fresherCanon"] as { titles: string[] }).titles].sort());
    for (const row of rows) expect(row.canonHash).toBe(carrierHashOf((await r.canon.get(row.title))!.tiddler));
    expect(await snapshot(r, titles)).toEqual(before);
  });

  test("W6 — CONTROL: an INGEST that moves nothing under a copy raises no warning", async () => {
    const r = await rig();
    await r.seed(carrier("the first words"));
    await r.composite.put({ tiddler: { title: URI, text: "a hand's words" } }, hand);
    const out = await r.seed(carrier("the first words"));
    expect(out["fresherCanon"]).toBeUndefined();
    expect((await r.working.get(URI))?.tiddler["text"]).toBe("a hand's words");
    expect((await r.ask())["count"]).toBe(0);
  });
});
