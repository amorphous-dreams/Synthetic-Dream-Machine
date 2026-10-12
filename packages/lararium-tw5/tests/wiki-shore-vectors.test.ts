/**
 * Stage-one shore vectors. These exercise the packed TW5 engine, real TW5 wiki equality, and real
 * Automerge stores. Each vector pairs an inbound or hand case with a concrete control.
 */
import { describe, expect, test, vi } from "vitest";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { AutomergeDocStore, CompositeStore, emptyLarDoc, type LarDoc, type LarTiddlerRecord, type Repo as RepoType, wikiBagUri, wikiSlotUri } from "@lararium/mesh";
import { IslandAdaptor, LandingDoorUnavailableError } from "../src/island-adaptor.js";
import { bridgeWikiToAdaptor } from "../src/outbound-bridge.js";
import { HandGate, type ShoreTimers } from "../src/hand-gate.js";
import { WaveLanding } from "../src/wave-landing.js";
import { buildIslandRecipe, seedDrained } from "../src/island-recipe.js";
import { armBackstop } from "../src/modules/meme-backstop.js";
import { installLazyResolver } from "../src/lazy-resolver.js";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { bootTestWiki, wikiSkip, skipNote } from "./test-wiki.js";
import type { TW5Engine } from "../src/tw5-vm.js";

const canonBag = wikiSlotUri("shore-vector", "canon");
const workingBag = wikiSlotUri("shore-vector", "working");
const local = { kind: "tw-local", instanceId: "shore-vector" } as const;
const remote = { kind: "crdt-remote", edgeIsland: "shore-vector-peer" } as const;
const turns = async (n = 8): Promise<void> => { for (let i = 0; i < n; i++) await new Promise<void>((resolve) => setImmediate(resolve)); };
const Repo = createRequire(import.meta.resolve("@lararium/mesh"))("@automerge/automerge-repo").Repo as new (options: { network: unknown[] }) => RepoType;
const saveDoc = createRequire(import.meta.resolve("@lararium/mesh"))("@automerge/automerge").save as (doc: LarDoc) => Uint8Array;
const framed = (uri: string): string => `<<^ code="&#x0001;" from="?" -> to="${uri}">>\n<<^ code="&#x0002;">>\n\n\`\`\`toml meta\nuri-path = "t/shore/backstop"\n\`\`\`\n\n<<~ ahu #/a>>\n\n! body\n\n<<~/ahu>>\n\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to="?">>\n`;

class ManualTimers implements ShoreTimers {
  private id = 0;
  readonly tasks = new Map<number, { fn: () => void; ms: number }>();
  setTimer(fn: () => void, ms: number): number { const id = ++this.id; this.tasks.set(id, { fn, ms }); return id; }
  clearTimer(handle: unknown): void { this.tasks.delete(handle as number); }
  fire(ms: number): void {
    const found = [...this.tasks].find(([, task]) => task.ms === ms);
    if (!found) throw new Error(`no ${ms}ms timer is armed`);
    this.tasks.delete(found[0]);
    found[1].fn();
  }
}

async function rig(timers?: ShoreTimers, yieldHost?: () => Promise<void>) {
  const engine = await bootTestWiki();
  const wiki = engine.$tw.wiki as unknown as { addTiddler(t: unknown): void; getTiddler(t: string): unknown; getChangeCount(t: string): number };
  const Tiddler = (engine.$tw as unknown as { Tiddler: new (f: Record<string, unknown>) => unknown }).Tiddler;
  for (const [name, value] of [["bag", workingBag], ["temp", wikiSlotUri("shore-vector", "temp")], ["draft", wikiSlotUri("shore-vector", "draft")], ["personal", wikiSlotUri("shore-vector", "personal")]]) {
    wiki.addTiddler(new Tiddler({ title: `lar:///ha.ka.ba/lararium/config/current-wiki-${name}`, text: value }));
  }
  const repo = new Repo({ network: [] });
  const canonHandle = repo.create<LarDoc>(emptyLarDoc());
  const workingHandle = repo.create<LarDoc>(emptyLarDoc());
  const canon = new AutomergeDocStore(canonHandle, canonBag);
  const working = new AutomergeDocStore(workingHandle, workingBag);
  const composite = new CompositeStore();
  composite.addLayer({ bagId: canonBag, store: canon, writable: false });
  composite.addLayer({ bagId: workingBag, store: working, writable: true });
  const adaptor = new IslandAdaptor(engine, composite, "shore-vector", timers);
  const lares = (engine.$tw as unknown as { lares: { enqueueNalu(change: unknown): void } }).lares;
  const engineDoor = lares.enqueueNalu;
  adaptor.installLandingQueue(yieldHost);
  adaptor.start();
  const save = vi.spyOn(adaptor, "saveTiddler");
  const unbridge = bridgeWikiToAdaptor(engine, adaptor);
  await turns(); // settle the manual pointer setup while the adaptor is not resident
  return { engine, wiki, Tiddler, repo, canonHandle, workingHandle, canon, working, composite, adaptor, save, unbridge, engineDoor };
}

describe.skipIf(wikiSkip)(`wiki shore stage-one vectors${skipNote}`, () => {
  // Seed landings stay within the source layer and each title receives one wiki mutation.
  test("A + control: 400 canon records land as foam and a changed hand writes once", async () => {
    const r = await rig();
    const seed: Record<string, LarTiddlerRecord> = {};
    for (let i = 0; i < 400; i++) {
      const title = `lar:///t/shore/A-${i}`;
      seed[title] = { tiddler: { title, text: `canon-${i}` }, meta: { changeId: `seed-${i}` } };
    }
    r.canonHandle.change((doc) => { Object.assign((doc as LarDoc).tiddlers, seed); });
    const canonHeads = r.canonHandle.heads();
    const workingHeads = r.workingHandle.heads();
    r.canon.emitInitialReplay();
    await r.adaptor.armSeedCheckpoint();
    expect(r.save).toHaveBeenCalledTimes(0);
    expect(r.workingHandle.heads()).toEqual(workingHeads);
    expect(r.canonHandle.heads()).toEqual(canonHeads);
    for (const title of Object.keys(seed)) expect(r.wiki.getChangeCount(title)).toBe(1);

    const control = "lar:///t/shore/A-control";
    r.wiki.addTiddler(new r.Tiddler({ title: control, text: "hand" }));
    await new Promise((resolve) => setTimeout(resolve, HandGate.TRAILING_MS + 80));
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(r.save).toHaveBeenCalledTimes(1);
    expect((r.workingHandle.doc() as LarDoc).tiddlers[control]?.tiddler.text).toBe("hand");
    r.unbridge();
    await r.adaptor.stop();
    await r.repo.shutdown();
  }, 120_000);

  // Equal TW5 field strings preserve the store revision and its ceremony metadata.
  test("B/N: a new equal Tiddler stays foam and TW5 date/list fields round-trip", async () => {
    const r = await rig();
    const title = "lar:///t/shore/N";
    const record: LarTiddlerRecord = { tiddler: { title, text: "round trip", created: "20261012010203004", modified: "20261012010203005", tags: "[[two words]] other", list: "[[two words]]" }, meta: { changeId: "n-change" } };
    await r.working.put(record, remote);
    const heads = r.workingHandle.heads();
    r.working.emitInitialReplay();
    await r.adaptor.armSeedCheckpoint();
    const landed = r.wiki.getTiddler(title) as { getFieldStrings(): Record<string, string> };
    const rebuilt = new r.Tiddler(landed.getFieldStrings());
    const candidate = r.wiki.getTiddler(title) as { isEqual(other: unknown, exclude?: string[]): boolean };
    expect(candidate.isEqual(rebuilt, ["$origin-bag"])).toBe(true);
    r.wiki.addTiddler(rebuilt);
    await turns();
    expect(r.save).toHaveBeenCalledTimes(0);
    expect(r.workingHandle.heads()).toEqual(heads);
    expect((r.workingHandle.doc() as LarDoc).tiddlers[title]?.meta?.changeId).toBe("n-change");
    r.wiki.addTiddler(new r.Tiddler({ ...landed.getFieldStrings(), text: "changed control" }));
    await new Promise((resolve) => setTimeout(resolve, HandGate.TRAILING_MS + 80));
    expect(r.save).toHaveBeenCalledTimes(1);
    r.unbridge();
    await r.adaptor.stop();
    await r.repo.shutdown();
  }, 120_000);

  // Bulk changes retain the source bag on every queued title.
  test("A2: one Automerge change touching twelve titles lands every wiki provenance stamp", async () => {
    const r = await rig();
    r.workingHandle.change((doc) => {
      for (let i = 0; i < 12; i++) {
        const title = `lar:///t/shore/A2-${i}`;
        doc.tiddlers[title] = { tiddler: { title, text: `wave-${i}` } };
      }
    });
    // The change feeds the real store's changeset projection; the shore checkpoints its first empty queue.
    await new Promise((resolve) => setTimeout(resolve, 60));
    await r.adaptor.armSeedCheckpoint();
    for (let i = 0; i < 12; i++) {
      const title = `lar:///t/shore/A2-${i}`;
      expect((r.wiki.getTiddler(title) as { fields: Record<string, unknown> } | null)?.fields["$origin-bag"]).toBe(workingBag);
      expect(r.wiki.getChangeCount(title)).toBe(1);
    }
    r.wiki.addTiddler(new r.Tiddler({ title: "lar:///t/shore/A2-0", text: "changed control" }));
    await new Promise((resolve) => setTimeout(resolve, HandGate.TRAILING_MS + 80));
    expect(r.save).toHaveBeenCalledTimes(1);
    r.unbridge();
    await r.adaptor.stop();
    await r.repo.shutdown();
  }, 120_000);

  // Explicit absence distinguishes a wave deletion from a title the ledger never saw.
  test("E + control: an explicit absent ledger entry does not swallow the next hand", async () => {
    const r = await rig();
    const absent = "lar:///t/shore/E-absent";
    await r.working.tombstone(absent, remote);
    await new Promise((resolve) => setTimeout(resolve, 60));
    await r.adaptor.armSeedCheckpoint();
    expect(r.adaptor.ledger.landedOf(absent)?.tiddler).toBeNull();
    const writes: string[] = [];
    const writeFamily = r.working.writeFamily.bind(r.working);
    vi.spyOn(r.working, "writeFamily").mockImplementation(async (puts, deletes, origin, options) => {
      writes.push(...puts.map((put) => put.tiddler.title));
      return writeFamily(puts, deletes, origin, options);
    });
    r.wiki.addTiddler(new r.Tiddler({ title: absent, text: "created by hand" }));
    await new Promise((resolve) => setTimeout(resolve, HandGate.TRAILING_MS + 80));
    expect(writes.filter((title) => title === absent)).toHaveLength(1);

    const control = "lar:///t/shore/E-control";
    r.wiki.addTiddler(new r.Tiddler({ title: control, text: "first" }));
    r.wiki.addTiddler(new r.Tiddler({ title: control, text: "changed" }));
    await new Promise((resolve) => setTimeout(resolve, HandGate.TRAILING_MS + 80));
    expect(writes.filter((title) => title === control)).toHaveLength(1);
    expect((r.workingHandle.doc() as LarDoc).tiddlers[control]?.tiddler.text).toBe("changed");
    r.unbridge();
    await r.adaptor.stop();
    await r.repo.shutdown();
  }, 120_000);

  // Teardown acknowledges each marked title before the adaptor stops.
  test("J + control: stop waits for a deferred hand write to be acknowledged", async () => {
    const r = await rig();
    await r.adaptor.armSeedCheckpoint();
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => { markStarted = resolve; });
    let acknowledge!: () => void;
    const held = new Promise<void>((resolve) => { acknowledge = resolve; });
    const writeFamily = r.working.writeFamily.bind(r.working);
    vi.spyOn(r.working, "writeFamily").mockImplementation(async (puts, deletes, origin, options) => {
      markStarted();
      await held;
      return writeFamily(puts, deletes, origin, options);
    });
    const title = "lar:///t/shore/J";
    r.wiki.addTiddler(new r.Tiddler({ title, text: "pending" }));
    await turns();
    r.unbridge();
    let stopped = false;
    const stopping = r.adaptor.stop().then(() => { stopped = true; });
    await turns();
    expect(r.working.writeFamily, "teardown must start the marked write before it can resolve").toHaveBeenCalled();
    await started;
    await turns();
    expect(stopped).toBe(false);
    acknowledge();
    await stopping;
    expect(stopped).toBe(true);
    expect((r.workingHandle.doc() as LarDoc).tiddlers[title]?.tiddler.text).toBe("pending");
    await r.repo.shutdown();

    let releaseDrain!: () => void;
    const heldDrain = new Promise<void>((resolve) => { releaseDrain = resolve; });
    const pending = await rig(undefined, () => heldDrain);
    const pendingTitle = "lar:///t/shore/J-queued";
    const lares = (pending.engine.$tw as unknown as { lares: { enqueueNalu(change: unknown): void } }).lares;
    lares.enqueueNalu({ title: pendingTitle, record: { tiddler: { title: pendingTitle, text: "must not land after stop" } }, origin: remote });
    await turns(1);
    const stoppingPending = pending.adaptor.stop();
    releaseDrain();
    await stoppingPending;
    expect(pending.wiki.getTiddler(pendingTitle)).toBeUndefined();
    expect((pending.engine.$tw as unknown as { lares: { enqueueNalu(change: unknown): void } }).lares.enqueueNalu).toBe(pending.engineDoor);
    pending.unbridge();
    await pending.repo.shutdown();
  }, 120_000);

  // This measures one acknowledged absolute write per cap firing and the next write's landed base.
  test("P + control: continued typing crosses two caps with exact text and an advancing base", async () => {
    const timers = new ManualTimers();
    const r = await rig(timers);
    await r.adaptor.armSeedCheckpoint();
    const title = "lar:///t/shore/P";
    const bases: Array<readonly string[] | undefined> = [];
    const writeFamily = r.working.writeFamily.bind(r.working);
    vi.spyOn(r.working, "writeFamily").mockImplementation(async (puts, deletes, origin, options) => {
      if (puts.some((put) => put.tiddler.title === title)) bases.push(options?.base);
      return writeFamily(puts, deletes, origin, options);
    });
    for (let i = 0; i < 30; i++) {
      r.wiki.addTiddler(new r.Tiddler({ title, text: `keystroke-${i}`, modified: `202401010000${String(i).padStart(2, "0")}000` }));
      await turns(1);
    }
    timers.fire(2_000);
    await turns();
    expect(bases).toHaveLength(1);
    const firstHeads = r.working.headsNow();
    await new Promise((resolve) => setTimeout(resolve, 60));
    for (let i = 30; i < 60; i++) {
      r.wiki.addTiddler(new r.Tiddler({ title, text: `keystroke-${i}`, modified: `202401010000${String(i).padStart(2, "0")}000` }));
      await turns(1);
    }
    timers.fire(2_000);
    await turns();
    expect(bases).toHaveLength(2);
    expect(bases[1]).toEqual(firstHeads);
    expect((r.workingHandle.doc() as LarDoc).tiddlers[title]?.tiddler.text).toBe("keystroke-59");
    expect(await r.working.parallelDrafts(title)).toEqual([]);
    const control = "lar:///t/shore/P-control";
    r.wiki.addTiddler(new r.Tiddler({ title: control, text: "control changed" }));
    await turns(1);
    timers.fire(400);
    await turns();
    expect((r.workingHandle.doc() as LarDoc).tiddlers[control]?.tiddler.text).toBe("control changed");
    r.unbridge();
    await r.adaptor.stop();
    await r.repo.shutdown();
  }, 120_000);

  // A one-field hand carries the landed base after a remote field edit lands.
  test("Q + control: one field edit carries the landed base and preserves a remote field", async () => {
    const timers = new ManualTimers();
    const r = await rig(timers);
    const title = "lar:///t/shore/Q";
    await r.working.put({ tiddler: { title, text: "base text", tags: ["base"] } }, remote);
    await new Promise((resolve) => setTimeout(resolve, 60));
    await r.adaptor.armSeedCheckpoint();
    const remoteEdit = r.working.put({ tiddler: { title, text: "base text", tags: ["base"], type: "remote type" } }, remote);
    await remoteEdit;
    await new Promise((resolve) => setTimeout(resolve, 60));
    await turns();
    const landedHeads = r.adaptor.ledger.landedOf(title)?.heads;
    expect(landedHeads).toBeDefined();
    const writes: Array<readonly string[] | undefined> = [];
    const writeFamily = r.working.writeFamily.bind(r.working);
    vi.spyOn(r.working, "writeFamily").mockImplementation(async (puts, deletes, origin, options) => {
      if (puts.some((put) => put.tiddler.title === title)) writes.push(options?.base);
      return writeFamily(puts, deletes, origin, options);
    });
    const remoteFields = (r.wiki.getTiddler(title) as { fields: Record<string, unknown> }).fields;
    r.wiki.addTiddler(new r.Tiddler({ ...remoteFields, text: "hand text" }));
    await turns();
    timers.fire(400);
    await turns();
    const saved = (r.workingHandle.doc() as LarDoc).tiddlers[title]?.tiddler;
    expect(writes).toHaveLength(1);
    expect(writes[0]).toEqual(landedHeads);
    expect(saved?.text).toBe("hand text");
    expect(saved?.tags).toBe("base");
    expect(saved?.type).toBe("remote type");
    expect(await r.working.parallelDrafts(title)).toEqual([]);

    const control = "lar:///t/shore/Q-control";
    r.wiki.addTiddler(new r.Tiddler({ title: control, text: "changed" }));
    await turns(1);
    timers.fire(400);
    await turns();
    expect((r.workingHandle.doc() as LarDoc).tiddlers[control]?.tiddler.text).toBe("changed");
    r.unbridge();
    await r.adaptor.stop();
    await r.repo.shutdown();
  }, 120_000);

  // Repeated titles advance the ledger through the entire queued slice.
  test("F + control: 401 queued values with a repeated title do not echo, but a changed hand writes", async () => {
    const r = await rig(undefined, () => new Promise<void>((resolve) => setImmediate(resolve)));
    const lares = (r.engine.$tw as unknown as { lares: { enqueueNalu(change: unknown): void } }).lares;
    let repeated = "";
    for (let i = 0; i < 401; i++) {
      const title = i === 300 ? repeated : `lar:///t/shore/F-${i}`;
      if (i === 0) repeated = title;
      const text = i === 0 || i === 300 ? "same" : `wave-${i}`;
      lares.enqueueNalu({ title, record: { tiddler: { title, text } }, origin: remote, ...(i === 0 || i === 300 ? { heads: [`head-${i}`] } : {}) });
    }
    await r.adaptor.armSeedCheckpoint();
    expect(r.save).toHaveBeenCalledTimes(0);
    expect(r.adaptor.ledger.landedOf(repeated)?.heads).toEqual(["head-300"]);
    const before = r.save.mock.calls.length;
    r.wiki.addTiddler(new r.Tiddler({ title: repeated, text: "changed hand" }));
    await new Promise((resolve) => setTimeout(resolve, HandGate.TRAILING_MS + 80));
    expect(r.save.mock.calls.length - before).toBe(1);
    r.unbridge();
    await r.adaptor.stop();
    await r.repo.shutdown();
  }, 120_000);

  test("I + control: the drain sees a hand before its held change dispatch and drops the stale wave", async () => {
    const r = await rig();
    await r.adaptor.armSeedCheckpoint();
    const title = "lar:///t/shore/I";
    r.unbridge();
    const rawWiki = r.engine.$tw.wiki as unknown as {
      addEventListener(type: string, fn: (changes: Record<string, unknown>) => void): void;
      removeEventListener(type: string, fn: (changes: Record<string, unknown>) => void): void;
    };
    const nativeAdd = rawWiki.addEventListener.bind(rawWiki);
    const nativeRemove = rawWiki.removeEventListener.bind(rawWiki);
    let delayedChange: ((changes: Record<string, unknown>) => void) | null = null;
    rawWiki.addEventListener = (type, fn) => { if (type === "change") delayedChange = fn; else nativeAdd(type, fn); };
    rawWiki.removeEventListener = (type, fn) => { if (type !== "change") nativeRemove(type, fn); };
    const releaseBridge = bridgeWikiToAdaptor(r.engine, r.adaptor);
    const originalLand = (r.adaptor as unknown as { _landOne(change: unknown, handSettled?: boolean): Promise<void> })._landOne.bind(r.adaptor);
    const drainSawHand = vi.spyOn(r.adaptor as unknown as { _landOne(change: unknown, handSettled?: boolean): Promise<void> }, "_landOne")
      .mockImplementation(async (change, settled) => {
        expect(r.save, "the change bridge ran before the queued item reached the drain").not.toHaveBeenCalled();
        return originalLand(change, settled);
      });
    const before = r.workingHandle.heads();
    const lares = (r.engine.$tw as unknown as { lares: { enqueueNalu(change: unknown): void } }).lares;
    lares.enqueueNalu({ title, record: { tiddler: { title, text: "stale wave" } }, origin: remote });
    r.wiki.addTiddler(new r.Tiddler({ title, text: "hand wins" }));
    await turns(20);
    expect(drainSawHand).toHaveBeenCalled();
    expect(r.save).toHaveBeenCalledTimes(0);
    const record = (r.workingHandle.doc() as LarDoc).tiddlers[title];
    expect(record?.tiddler.text).toBe("hand wins");
    expect(r.workingHandle.heads()).not.toEqual(before);
    expect((r.wiki.getTiddler(title) as { fields: Record<string, unknown> }).fields.text).toBe("hand wins");
    delayedChange?.({ [title]: {} });
    await turns();
    expect(r.save).toHaveBeenCalledTimes(0);
    const control = "lar:///t/shore/I-control";
    r.wiki.addTiddler(new r.Tiddler({ title: control, text: "changed field" }));
    delayedChange?.({ [control]: {} });
    await new Promise((resolve) => setTimeout(resolve, HandGate.TRAILING_MS + 80));
    expect((r.workingHandle.doc() as LarDoc).tiddlers[control]?.tiddler.text).toBe("changed field");
    releaseBridge();
    rawWiki.addEventListener = nativeAdd;
    rawWiki.removeEventListener = nativeRemove;
    await r.adaptor.stop();
    await r.repo.shutdown();
  }, 120_000);

  test("R1: a hand that changes during a held leave is written before the queued wave can land", async () => {
    const timers = new ManualTimers();
    const r = await rig(timers);
    const title = "lar:///t/shore/R1";
    await r.working.put({ tiddler: { title, text: "seed" } }, remote);
    await turns();
    await r.adaptor.armSeedCheckpoint();
    let release!: () => void;
    let started!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const began = new Promise<void>((resolve) => { started = resolve; });
    const writeFamily = r.working.writeFamily.bind(r.working);
    let first = true;
    const writtenTexts: string[] = [];
    vi.spyOn(r.working, "writeFamily").mockImplementation(async (puts, deletes, origin, options) => {
      if (puts.some((put) => put.tiddler.title === title) && first) {
        first = false;
        started();
        await held;
      }
      for (const put of puts) if (put.tiddler.title === title) writtenTexts.push(String(put.tiddler.text));
      return writeFamily(puts, deletes, origin, options);
    });
    r.wiki.addTiddler(new r.Tiddler({ title, text: "hand first" }));
    const lares = (r.engine.$tw as unknown as { lares: { enqueueNalu(change: unknown): void } }).lares;
    lares.enqueueNalu({ title, record: { tiddler: { title, text: "stale wave" } }, origin: remote, bag: workingBag });
    await began;
    r.wiki.addTiddler(new r.Tiddler({ title, text: "hand latest" }));
    await turns();
    release();
    await turns(20);
    expect(writtenTexts).toEqual(["hand first", "hand latest"]);
    expect((r.workingHandle.doc() as LarDoc).tiddlers[title]?.tiddler.text).toBe("hand latest");
    expect((r.wiki.getTiddler(title) as { fields: Record<string, unknown> }).fields.text).toBe("hand latest");
    r.unbridge();
    await r.adaptor.stop();
    await r.repo.shutdown();
  }, 120_000);

  // A store with no heads (the temp layer's memory store) still acknowledges a write by its own-origin
  // envelope. A wave that meets an unsent hand there must see that hand as WRITTEN and drop its stale
  // item; read as "nothing written", the second pass would land the stale record over the hand.
  test("a wave meeting an unsent hand over a store with no heads drops its stale item", async () => {
    const engine = await bootTestWiki();
    const wiki = engine.$tw.wiki as unknown as { addTiddler(t: unknown): void; getTiddler(t: string): { fields: Record<string, unknown> } | undefined };
    const Tiddler = (engine.$tw as unknown as { Tiddler: new (f: Record<string, unknown>) => unknown }).Tiddler;
    const bag = wikiSlotUri("shore-memory", "working");
    for (const name of ["bag", "temp", "draft", "personal"]) {
      wiki.addTiddler(new Tiddler({ title: `lar:///ha.ka.ba/lararium/config/current-wiki-${name}`, text: bag }));
    }
    const store = new MemoryTiddlerStore();
    const composite = new CompositeStore();
    composite.addLayer({ bagId: bag, store, writable: true });
    const adaptor = new IslandAdaptor(engine, composite, "shore-memory", new ManualTimers());
    adaptor.installLandingQueue();
    adaptor.start();
    const unbridge = bridgeWikiToAdaptor(engine, adaptor);
    const title = "lar:///t/shore/memory-hand";
    await store.put({ tiddler: { title, text: "seed" } }, remote, { bag });
    await adaptor.armSeedCheckpoint();
    expect(wiki.getTiddler(title)?.fields.text).toBe("seed");

    wiki.addTiddler(new Tiddler({ title, text: "the hand" }));
    // Every value the wiki is handed for the title from here on: the stale record must never stand,
    // even for the moment a return wave would take to repair it.
    const stood: unknown[] = [];
    const addTiddler = wiki.addTiddler.bind(wiki);
    wiki.addTiddler = (t: unknown): void => {
      const fields = (t as { fields?: Record<string, unknown> }).fields ?? (t as Record<string, unknown>);
      if (fields["title"] === title) stood.push(fields["text"]);
      addTiddler(t);
    };
    const lares = (engine.$tw as unknown as { lares: { enqueueNalu(change: unknown): void } }).lares;
    lares.enqueueNalu({ title, record: { tiddler: { title, text: "stale wave" } }, origin: remote, bag });
    await turns(12);

    expect(stood).not.toContain("stale wave");
    expect((await store.get(title))?.tiddler.text).toBe("the hand");
    expect(wiki.getTiddler(title)?.fields.text).toBe("the hand");
    unbridge();
    await adaptor.stop();
  }, 120_000);

  test("R2: seedDrained waits for a deferred cross-bag tombstone resolver and its survivor", async () => {
    const r = await rig();
    const title = "lar:///t/shore/R2";
    await r.working.put({ tiddler: { title, text: "survivor" } }, remote);
    await turns();
    let release!: (value: { bagId: string; record: LarTiddlerRecord } | null) => void;
    const deferred = new Promise<{ bagId: string; record: LarTiddlerRecord } | null>((resolve) => { release = resolve; });
    const resolveTopmost = vi.spyOn(r.composite, "resolveTopmost").mockReturnValue(deferred);
    const tombstone = r.canon.tombstone(title, remote);
    await turns();
    const checkpoint = r.adaptor.armSeedCheckpoint();
    let drained = false;
    void checkpoint.then(() => { drained = true; });
    await turns();
    expect(drained).toBe(false);
    release({ bagId: workingBag, record: { tiddler: { title, text: "survivor" } } });
    await checkpoint;
    expect((r.wiki.getTiddler(title) as { fields: Record<string, unknown> }).fields.text).toBe("survivor");
    expect(resolveTopmost).toHaveBeenCalledWith(title);
    await tombstone;
    r.unbridge();
    await r.adaptor.stop();
    await r.repo.shutdown();
  }, 120_000);

  test("R3: a twice-failed seed landing rejects with the title and cause; a resident failure is reported", async () => {
    let attempts = 0;
    const failing = new WaveLanding(async () => { attempts++; throw new Error("read cause"); }, async () => {});
    failing.enqueue({ title: "lar:///t/shore/R3-seed", record: null, origin: remote });
    await expect(failing.checkpoint()).rejects.toThrow(/lar:\/\/\/t\/shore\/R3-seed.*read cause/);
    expect(attempts).toBe(2);

    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    let residentAttempts = 0;
    const resident = new WaveLanding(async () => { residentAttempts++; throw new Error("resident cause"); }, async () => {});
    await resident.checkpoint();
    resident.enqueue({ title: "lar:///t/shore/R3-resident", record: null, origin: remote });
    await turns();
    expect(residentAttempts).toBe(2);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('"lar:///t/shore/R3-resident"'));
    error.mockRestore();
  });

  test("R4: a failing offered headsNow read rejects the seed instead of landing the envelope record", async () => {
    const r = await rig();
    const title = "lar:///t/shore/R4";
    vi.spyOn(r.working, "headsNow").mockImplementation(() => { throw new Error("heads read failed"); });
    const lares = (r.engine.$tw as unknown as { lares: { enqueueNalu(change: unknown): void } }).lares;
    lares.enqueueNalu({ title, bag: workingBag, record: { tiddler: { title, text: "stale envelope" } }, origin: remote });
    await expect(r.adaptor.armSeedCheckpoint()).rejects.toThrow(/R4.*heads read failed/);
    expect(r.wiki.getTiddler(title)).toBeUndefined();
    r.unbridge();
    await r.adaptor.stop();
    await r.repo.shutdown();

    const second = await rig();
    const getAtTitle = "lar:///t/shore/R4-getAt";
    vi.spyOn(second.working, "getAt").mockImplementation(() => { throw new Error("record read failed"); });
    const secondDoor = (second.engine.$tw as unknown as { lares: { enqueueNalu(change: unknown): void } }).lares;
    secondDoor.enqueueNalu({ title: getAtTitle, bag: workingBag, record: { tiddler: { title: getAtTitle, text: "stale envelope" } }, origin: remote });
    await expect(second.adaptor.armSeedCheckpoint()).rejects.toThrow(/R4-getAt.*record read failed/);
    expect(second.wiki.getTiddler(getAtTitle)).toBeUndefined();
    second.unbridge();
    await second.adaptor.stop();
    await second.repo.shutdown();
  }, 120_000);

  test("R5: stop waits for an active flush and the later same-title flush queued behind it", async () => {
    const timers = new ManualTimers();
    const r = await rig(timers);
    await r.adaptor.armSeedCheckpoint();
    const title = "lar:///t/shore/R5";
    let release!: () => void;
    let started!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const began = new Promise<void>((resolve) => { started = resolve; });
    const writeFamily = r.working.writeFamily.bind(r.working);
    let writes = 0;
    vi.spyOn(r.working, "writeFamily").mockImplementation(async (puts, deletes, origin, options) => {
      if (puts.some((put) => put.tiddler.title === title)) {
        writes++;
        if (writes === 1) { started(); await held; }
      }
      return writeFamily(puts, deletes, origin, options);
    });
    const first = r.adaptor.saveTiddler(new r.Tiddler({ title, text: "first" }));
    timers.fire(400);
    await began;
    const second = r.adaptor.saveTiddler(new r.Tiddler({ title, text: "second" }));
    timers.fire(400);
    r.unbridge();
    let stopped = false;
    const stopping = r.adaptor.stop().then(() => { stopped = true; });
    await turns();
    expect(stopped).toBe(false);
    release();
    await Promise.all([first, second, stopping]);
    expect(writes).toBe(2);
    expect((r.workingHandle.doc() as LarDoc).tiddlers[title]?.tiddler.text).toBe("second");
    await r.repo.shutdown();
  }, 120_000);

  test("R8: landing setup fails by name when the packed engine door is unavailable", async () => {
    const engine = await bootTestWiki();
    const lares = (engine.$tw as unknown as { lares: { enqueueNalu?: (change: unknown) => void } }).lares;
    lares.enqueueNalu = undefined;
    const repo = new Repo({ network: [] });
    const handle = repo.create<LarDoc>(emptyLarDoc());
    const store = new AutomergeDocStore(handle, workingBag);
    const adaptor = new IslandAdaptor(engine, store as never, "shore-door");
    expect(() => adaptor.installLandingQueue()).toThrow(LandingDoorUnavailableError);
    await repo.shutdown();
  }, 120_000);

  // The kernel-facing checkpoint observes the shore queue's resident seed.
  test("hydration + control: seedDrained follows the last seed landing and arms the first hand", async () => {
    const engine = await bootTestWiki();
    const wiki = engine.$tw.wiki as unknown as { getTiddler(title: string): unknown; addTiddler(t: unknown): void };
    const Tiddler = (engine.$tw as unknown as { Tiddler: new (f: Record<string, unknown>) => unknown }).Tiddler;
    const repo = new Repo({ network: [] });
    const hydCanon = wikiBagUri("shore-hydration");
    const hydWorking = wikiSlotUri("shore-hydration", "working");
    const canonHandle = repo.create<LarDoc>(emptyLarDoc());
    const workingHandle = repo.create<LarDoc>(emptyLarDoc());
    const seed: Record<string, LarTiddlerRecord> = {};
    for (let i = 0; i < 401; i++) {
      const title = `lar:///t/shore/hydration-${i}`;
      seed[title] = { tiddler: { title, text: `seed-${i}` } };
    }
    canonHandle.change((doc) => { Object.assign(doc.tiddlers, seed); });
    const composite = new CompositeStore();
    const { adaptor, stores } = buildIslandRecipe({
      tw5: engine,
      composite,
      recipe: { wikiSlug: "shore-hydration" },
      ready: [
        { slot: hydCanon, handle: canonHandle },
        { slot: hydWorking, handle: workingHandle },
      ],
    });
    const save = vi.spyOn(adaptor, "saveTiddler");
    const unbridge = bridgeWikiToAdaptor(engine, adaptor);
    expect(wiki.getTiddler("lar:///t/shore/hydration-400")).toBeUndefined();
    await seedDrained(engine);
    expect(wiki.getTiddler("lar:///t/shore/hydration-400")).toBeTruthy();
    expect(save).toHaveBeenCalledTimes(0);
    expect(Object.keys(workingHandle.doc().tiddlers)).toEqual([]);
    wiki.addTiddler(new Tiddler({ title: "lar:///t/shore/hydration-control", text: "hand" }));
    await new Promise((resolve) => setTimeout(resolve, HandGate.TRAILING_MS + 80));
    expect(workingHandle.doc().tiddlers["lar:///t/shore/hydration-control"]?.tiddler.text).toBe("hand");
    unbridge();
    await adaptor.stop();
    expect(stores.length).toBeGreaterThan(0);
    await repo.shutdown();
  }, 120_000);

  // A canon seed remains in canon until a hand writes through the working route.
  test("M + control: a canon carrier seeds without a working copy, while a hand lands in working", async () => {
    const r = await rig();
    const title = "lar:///t/shore/M-canon";
    r.canonHandle.change((doc) => {
      doc.tiddlers[title] = { tiddler: { title, text: "canon content" } };
    });
    await new Promise((resolve) => setTimeout(resolve, 60));
    await r.adaptor.armSeedCheckpoint();
    expect((r.wiki.getTiddler(title) as { fields: Record<string, unknown> }).fields.text).toBe("canon content");
    expect(Object.keys((r.workingHandle.doc() as LarDoc).tiddlers)).toEqual([]);
    expect(r.save).toHaveBeenCalledTimes(0);

    const control = "lar:///t/shore/M-control";
    r.wiki.addTiddler(new r.Tiddler({ title: control, text: "hand" }));
    await new Promise((resolve) => setTimeout(resolve, HandGate.TRAILING_MS + 80));
    expect((r.workingHandle.doc() as LarDoc).tiddlers[control]?.tiddler.text).toBe("hand");
    r.unbridge();
    await r.adaptor.stop();
    await r.repo.shutdown();
  }, 120_000);

  // Backstop measurement: no save and no persisted field moved while the framed carrier landed.
  test("G + control: measure the packed backstop's re-place fields and let a changed field leave", async () => {
    const r = await rig();
    await r.adaptor.armSeedCheckpoint();
    armBackstop(r.engine.$tw as never, { log: () => {} });
    const title = "lar:///t/shore/backstop";
    const lares = (r.engine.$tw as unknown as { lares: { enqueueNalu(change: unknown): void } }).lares;
    lares.enqueueNalu({ title, record: { tiddler: { title, type: "text/vnd.tiddlywiki", text: framed(title) } }, origin: remote });
    await r.adaptor.armSeedCheckpoint();
    await new Promise((resolve) => setTimeout(resolve, 100));
    await turns();
    const landed = r.wiki.getTiddler(title) as { fields: Record<string, unknown> };
    const writes = r.save.mock.calls.map(([tiddler]) => {
      const fields = (tiddler as { fields?: Record<string, unknown> }).fields ?? {};
      return Object.fromEntries(Object.entries(fields).filter(([key]) => ["modified", "modifier", "created", "text", "tags", "type"].includes(key)));
    });
    expect(writes, `backstop moved these persisted fields: ${JSON.stringify(landed.fields)}`).toEqual([]);
    const beforeEqualReAdd = r.save.mock.calls.length;
    r.wiki.addTiddler(new r.Tiddler({ ...landed.fields }));
    await turns();
    expect(r.save.mock.calls.length - beforeEqualReAdd).toBe(0);
    const modified = { ...landed.fields, modified: "20261012000000000" };
    r.wiki.addTiddler(new r.Tiddler(modified));
    await new Promise((resolve) => setTimeout(resolve, HandGate.TRAILING_MS + 80));
    expect(r.save).toHaveBeenCalledTimes(1);
    r.unbridge();
    await r.adaptor.stop();
    await r.repo.shutdown();
  }, 120_000);

  // Lazy body expansion uses the shore door and does not emit a hand save.
  test("lazy splice + control: a bodyless landed handle fattens through the queue without a save", async () => {
    const r = await rig();
    const title = "lar:///t/shore/lazy";
    const body = "CAS body restored in the wiki";
    const cid = createHash("sha256").update(body).digest("hex");
    await r.working.put({ tiddler: { title, _is_skinny: "yes", textCid: cid } }, remote);
    await new Promise((resolve) => setTimeout(resolve, 60));
    await r.adaptor.armSeedCheckpoint();
    const heads = r.workingHandle.heads();
    const removeLazy = installLazyResolver(r.engine, async (requested) => requested === cid ? new TextEncoder().encode(body) : null);
    (r.wiki as unknown as { dispatchEvent(name: string, title: string): void }).dispatchEvent("lazyLoad", title);
    await turns();
    await turns();
    expect((r.wiki.getTiddler(title) as { fields: Record<string, unknown> }).fields.text).toBe(body);
    expect(r.save).toHaveBeenCalledTimes(0);
    expect(r.workingHandle.heads()).toEqual(heads);
    const control = "lar:///t/shore/lazy-control";
    r.wiki.addTiddler(new r.Tiddler({ title: control, text: "changed" }));
    await new Promise((resolve) => setTimeout(resolve, HandGate.TRAILING_MS + 80));
    expect((r.workingHandle.doc() as LarDoc).tiddlers[control]?.tiddler.text).toBe("changed");
    removeLazy();
    r.unbridge();
    await r.adaptor.stop();
    await r.repo.shutdown();
  }, 120_000);

  // A wave meeting a same-field hand leaves the conflict visible without losing either value.
  test("H + control: separate Repos merging one doc surface a same-field race without loss", async () => {
    const r = await rig();
    const title = "lar:///t/shore/H";
    await r.working.put({ tiddler: { title, text: "base" } }, remote);
    await new Promise((resolve) => setTimeout(resolve, 60));
    await r.adaptor.armSeedCheckpoint();
    const draftBag = wikiSlotUri("shore-vector", "draft");
    const draftHandle = r.repo.create<LarDoc>(emptyLarDoc());
    const draftStore = new AutomergeDocStore(draftHandle, draftBag);
    r.composite.addLayer({ bagId: draftBag, store: draftStore, writable: false });
    const remoteRepo = new Repo({ network: [] });
    const remoteHandle = remoteRepo.import<LarDoc>(saveDoc(r.workingHandle.doc()));
    const remoteStore = new AutomergeDocStore(remoteHandle, workingBag);
    r.wiki.addTiddler(new r.Tiddler({ title, text: "hand value" }));
    await turns(); // the hand gate is armed but has not reached its trailing edge
    await remoteStore.put({ tiddler: { title, text: "remote value" } }, remote);
    r.workingHandle.merge(remoteHandle);
    await new Promise((resolve) => setTimeout(resolve, 80));
    await turns();
    const drafts = await r.working.parallelDrafts(title);
    expect(drafts.map((draft) => draft.tiddler.text).sort()).toEqual(["hand value", "remote value"]);
    expect((r.workingHandle.doc() as LarDoc).tiddlers[title]?.tiddler.text).toBeTruthy();
    expect(r.save).toHaveBeenCalledTimes(1);
    const control = "lar:///t/shore/H-control";
    r.wiki.addTiddler(new r.Tiddler({ title: control, text: "changed field" }));
    await new Promise((resolve) => setTimeout(resolve, HandGate.TRAILING_MS + 80));
    expect((r.workingHandle.doc() as LarDoc).tiddlers[control]?.tiddler.text).toBe("changed field");
    r.unbridge();
    await r.adaptor.stop();
    await r.repo.shutdown();
    await remoteRepo.shutdown();
  }, 120_000);
});
