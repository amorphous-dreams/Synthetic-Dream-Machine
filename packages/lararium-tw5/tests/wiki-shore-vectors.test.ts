/**
 * Stage-one shore vectors. These exercise the packed TW5 engine, real TW5 wiki equality, and real
 * Automerge stores. Each vector pairs an inbound or hand case with a concrete control.
 */
import { describe, expect, test, vi } from "vitest";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { AutomergeDocStore, CompositeStore, emptyLarDoc, type LarDoc, type LarTiddlerRecord, type Repo as RepoType, wikiBagUri, wikiSlotUri } from "@lararium/mesh";
import { CARRIER_TYPE } from "@lararium/mesh/carrier-type";
import { plainEntries } from "@lararium/mesh";

/** A document as a test reads it: every record unwrapped through the one door. */
const plainDoc = (doc: unknown): { tiddlers: Record<string, LarTiddlerRecord> } =>
  ({ tiddlers: Object.fromEntries(plainEntries((doc as LarDoc | undefined)?.tiddlers)) });
import { IslandAdaptor, LandingDoorUnavailableError } from "../src/island-adaptor.js";
import { bridgeWikiToAdaptor } from "../src/outbound-bridge.js";
import { WaveLanding } from "../src/wave-landing.js";
import { buildIslandRecipe, seedDrained } from "../src/island-recipe.js";
import { armBackstop } from "../src/modules/meme-backstop.js";
import { placeMeme, type MemeSink } from "../src/place-meme.js";
import { installLazyResolver } from "../src/lazy-resolver.js";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { bootTestWiki, wikiSkip, skipNote } from "./test-wiki.js";
import type { TW5Engine } from "../src/tw5-vm.js";

const canonBag = wikiSlotUri("shore-vector", "canon");
const workingBag = wikiSlotUri("shore-vector", "working");
const local = { kind: "tw-local", instanceId: "shore-vector" } as const;
const remote = { kind: "crdt-remote", edgeIsland: "shore-vector-peer" } as const;
const turns = async (n = 8): Promise<void> => { for (let i = 0; i < n; i++) await new Promise<void>((resolve) => setImmediate(resolve)); };
async function settleTurns(r: Awaited<ReturnType<typeof rig>>, titles: readonly string[], calls: () => number): Promise<void> {
  let prior = "";
  let stable = 0;
  for (let turn = 0; turn < 240 && stable < 8; turn++) {
    await turns(1);
    const heads = r.working.headsNow();
    const state = JSON.stringify([titles.map((title) => [title, r.wiki.getChangeCount(title)]), heads, calls()]);
    if (state === prior) stable++;
    else { prior = state; stable = 0; }
  }
  expect(stable, "wiki notifications, store calls, and heads settle across host turns").toBeGreaterThanOrEqual(8);
}
const Repo = createRequire(import.meta.resolve("@lararium/mesh"))("@automerge/automerge-repo").Repo as new (options: { network: unknown[] }) => RepoType;
const saveDoc = createRequire(import.meta.resolve("@lararium/mesh"))("@automerge/automerge").save as (doc: LarDoc) => Uint8Array;
const framed = (uri: string): string => `<<^ code=\`&#x0001;\` from=\`?\` to=\`${uri}\`>>\n<<^ code=\`&#x0002;\`>>\n\n\`\`\`toml meta\nuri-path = "${uri.slice(7)}"\n\`\`\`\n\n<<~ ahu slot=\`#/a\`>>\n\n! body\n\n<<~/ahu>>\n\n<<^ code=\`&#x0003;\`>>\n\n<<^ code=\`&#x0004;\` to=\`?\`>>\n`;

class ManualBoundary {
  private adaptor: IslandAdaptor | null = null;
  bind(adaptor: IslandAdaptor): void { this.adaptor = adaptor; }
  fire(): void { if (!this.adaptor) throw new Error("boundary has no adaptor"); void this.adaptor.boundary().catch(() => {}); }
}

async function rig(boundary?: ManualBoundary, yieldHost?: () => Promise<void>) {
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
  const adaptor = new IslandAdaptor(engine, composite, "shore-vector");
  boundary?.bind(adaptor);
  adaptor.installLandingQueue(yieldHost);
  // THE STORE'S CHANGE REACHES AN OBSERVER BESIDE THE SHORE: every title a changeset names lands here as
  // the store closes it (the changeset follows its URI changes, so the change is whole when it arrives), so a vector waits on the arrival itself and never on a pause after the write.
  const arrivals: string[] = [];
  const hearers = new Set<() => void>();
  const heard = (titles: readonly string[]): void => { arrivals.push(...titles); for (const hearer of [...hearers]) hearer(); };
  composite.addProjection({ onUriChanged: () => {}, onChangeset: (changes) => heard(changes.map((change) => change.title)) });
  adaptor.start();
  const save = vi.spyOn(adaptor, "saveTiddler");
  const unbridge = bridgeWikiToAdaptor(engine, adaptor);
  await turns(); // settle the manual pointer setup while the adaptor is not resident
  /** Resolves once the shore has heard every title since `mark` (`arrivals.length` taken before the write). The store's own event ends the wait. */
  const hearSince = (mark: number, titles: readonly string[]): Promise<void> => new Promise<void>((resolve) => {
    const check = (): void => { const seen = new Set(arrivals.slice(mark)); if (titles.every((title) => seen.has(title))) { hearers.delete(check); resolve(); } };
    hearers.add(check);
    check();
  });
  return { engine, wiki, Tiddler, repo, canonHandle, workingHandle, canon, working, composite, adaptor, save, unbridge, arrivals, hearSince };
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
    await r.adaptor.handsRested();
    await r.adaptor.landingIdle();
    expect(r.save).toHaveBeenCalledTimes(1);
    expect(plainDoc(r.workingHandle.doc()).tiddlers[control]?.tiddler.text).toBe("hand");
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
    expect(plainDoc(r.workingHandle.doc()).tiddlers[title]?.meta?.changeId).toBe("n-change");
    r.wiki.addTiddler(new r.Tiddler({ ...landed.getFieldStrings(), text: "changed control" }));
    await r.adaptor.handsRested();
    expect(r.save).toHaveBeenCalledTimes(1);
    r.unbridge();
    await r.adaptor.stop();
    await r.repo.shutdown();
  }, 120_000);

  // Bulk changes retain the source bag on every queued title.
  test("A2: one Automerge change touching twelve titles lands every wiki provenance stamp", async () => {
    const r = await rig();
    const a2Mark = r.arrivals.length;
    r.workingHandle.change((doc) => {
      for (let i = 0; i < 12; i++) {
        const title = `lar:///t/shore/A2-${i}`;
        doc.tiddlers[title] = { tiddler: { title, text: `wave-${i}` } };
      }
    });
    // The change feeds the real store's changeset projection; the shore checkpoints its first empty queue.
    await r.hearSince(a2Mark, Array.from({ length: 12 }, (_, i) => `lar:///t/shore/A2-${i}`));
    await r.adaptor.armSeedCheckpoint();
    for (let i = 0; i < 12; i++) {
      const title = `lar:///t/shore/A2-${i}`;
      expect((r.wiki.getTiddler(title) as { fields: Record<string, unknown> } | null)?.fields["$origin-bag"]).toBe(workingBag);
      expect(r.wiki.getChangeCount(title)).toBe(1);
    }
    r.wiki.addTiddler(new r.Tiddler({ title: "lar:///t/shore/A2-0", text: "changed control" }));
    await r.adaptor.handsRested();
    expect(r.save).toHaveBeenCalledTimes(1);
    r.unbridge();
    await r.adaptor.stop();
    await r.repo.shutdown();
  }, 120_000);

  // Explicit absence distinguishes a wave deletion from a title the ledger never saw.
  test("E + control: an explicit absent ledger entry does not swallow the next hand", async () => {
    const r = await rig();
    const absent = "lar:///t/shore/E-absent";
    const eMark = r.arrivals.length;
    await r.working.tombstone(absent, remote);
    await r.hearSince(eMark, [absent]);
    await r.adaptor.armSeedCheckpoint();
    expect(r.adaptor.ledger.landedOf(absent)?.tiddler).toBeNull();
    const writes: string[] = [];
    const writeFamily = r.working.writeFamily.bind(r.working);
    vi.spyOn(r.working, "writeFamily").mockImplementation(async (puts, deletes, origin, options) => {
      writes.push(...puts.map((put) => put.tiddler.title));
      return writeFamily(puts, deletes, origin, options);
    });
    r.wiki.addTiddler(new r.Tiddler({ title: absent, text: "created by hand" }));
    await r.adaptor.handsRested();
    expect(writes.filter((title) => title === absent)).toHaveLength(1);

    const control = "lar:///t/shore/E-control";
    r.wiki.addTiddler(new r.Tiddler({ title: control, text: "first" }));
    r.wiki.addTiddler(new r.Tiddler({ title: control, text: "changed" }));
    await r.adaptor.handsRested();
    expect(writes.filter((title) => title === control)).toHaveLength(1);
    expect(plainDoc(r.workingHandle.doc()).tiddlers[control]?.tiddler.text).toBe("changed");
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
    expect(plainDoc(r.workingHandle.doc()).tiddlers[title]?.tiddler.text).toBe("pending");
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
    expect((pending.engine.$tw as unknown as { lares: { enqueueNalu?: (change: unknown) => void } }).lares.enqueueNalu).toBeUndefined();
    pending.unbridge();
    await pending.repo.shutdown();
  }, 120_000);

  // A hand's base follows its own acknowledged write until a wave lands for that title.
  test("P/M23: a hand's base comes from writtenAt, never from merged heads", async () => {
    const boundary = new ManualBoundary();
    let holdQueue = false;
    let releaseQueue!: () => void;
    const heldQueue = new Promise<void>((resolve) => { releaseQueue = resolve; });
    const r = await rig(boundary, async () => { if (holdQueue) await heldQueue; });
    const title = "lar:///t/shore/P";
    await r.working.put({ tiddler: { title, text: "landed seed" } }, remote);
    await turns();
    await r.adaptor.armSeedCheckpoint();
    const olderLandedHeads = r.adaptor.ledger.landedOf(title)?.heads;
    expect(olderLandedHeads).toBeDefined();
    const bases: Array<readonly string[] | undefined> = [];
    const writtenAt: Array<readonly string[] | undefined> = [];
    const writeTitles: string[] = [];
    const writeFamily = r.working.writeFamily.bind(r.working);
    vi.spyOn(r.working, "writeFamily").mockImplementation(async (puts, deletes, origin, options) => {
      writeTitles.push(...puts.map((put) => put.tiddler.title), ...deletes);
      if (puts.some((put) => put.tiddler.title === title)) bases.push(options?.base);
      return writeFamily(puts, deletes, origin, options);
    });
    const onUriChanged = r.adaptor.onUriChanged.bind(r.adaptor);
    vi.spyOn(r.adaptor, "onUriChanged").mockImplementation((change) => {
      if (change.title === title && change.origin.kind === "tw-local") writtenAt.push(change.writtenAt);
      onUriChanged(change);
    });
    holdQueue = true;
    r.wiki.addTiddler(new r.Tiddler({ title, text: "hand first" }));
    await turns(1);
    boundary.fire();
    for (let turn = 0; turn < 80 && writtenAt.length < 1; turn++) await turns(1);
    expect(writtenAt).toHaveLength(1);
    const firstWriteHead = writtenAt.at(-1);
    expect(firstWriteHead).toBeDefined();
    const remoteRepo = new Repo({ network: [] });
    const remoteHandle = remoteRepo.import<LarDoc>(saveDoc(r.workingHandle.doc()));
    const remoteStore = new AutomergeDocStore(remoteHandle, workingBag);
    const otherTitle = "lar:///t/shore/P-remote-title";
    await remoteStore.put({ tiddler: { title: otherTitle, text: "remote moved the document head" } }, { kind: "crdt-remote", edgeIsland: "shore-vector-p-base-peer" });
    r.workingHandle.merge(remoteHandle);
    await turns(12);
    const mergedHeads = r.working.headsNow();
    expect(mergedHeads).not.toEqual(firstWriteHead);
    expect(mergedHeads).not.toEqual(olderLandedHeads);
    r.wiki.addTiddler(new r.Tiddler({ title, text: "hand second" }));
    await turns(1);
    boundary.fire();
    for (let turn = 0; turn < 80 && bases.length < 2; turn++) await turns(1);
    expect(bases).toHaveLength(2);
    expect(bases[0]).toEqual(olderLandedHeads);
    expect(bases[1]).toEqual(firstWriteHead);
    expect(bases[1]).not.toEqual(mergedHeads);
    expect(bases[1]).not.toEqual(olderLandedHeads);
    expect(r.adaptor.ledger.landedOf(title)?.heads).toEqual(olderLandedHeads);
    holdQueue = false;
    releaseQueue();
    await settleTurns(r, [title, otherTitle], () => bases.length);
    const landedHeads = r.adaptor.ledger.landedOf(title)?.heads;
    expect(landedHeads).toBeDefined();
    r.wiki.addTiddler(new r.Tiddler({ title, text: "hand after landing" }));
    await turns(1);
    boundary.fire();
    for (let turn = 0; turn < 80 && bases.length < 3; turn++) await turns(1);
    expect(bases).toHaveLength(3);
    expect(bases[2]).toEqual(landedHeads);
    const control = "lar:///t/shore/P-control";
    r.wiki.addTiddler(new r.Tiddler({ title: control, text: "control changed" }));
    await turns(1);
    boundary.fire();
    for (let turn = 0; turn < 80 && !writeTitles.includes(control); turn++) await turns(1);
    expect(plainDoc(r.workingHandle.doc()).tiddlers[control]?.tiddler.text).toBe("control changed");
    expect(writeTitles.filter((writtenTitle) => writtenTitle === control)).toHaveLength(1);
    r.unbridge();
    await r.adaptor.stop();
    await r.repo.shutdown();
    await remoteRepo.shutdown();
  }, 120_000);

  // Independent actors merge a remote field before a one-field hand write.
  test("Q + control: one field edit builds on another actor's landed field", async () => {
    const boundary = new ManualBoundary();
    const r = await rig(boundary);
    const title = "lar:///t/shore/Q";
    await r.working.put({ tiddler: { title, text: "base text", tags: ["base"] } }, remote);
    await turns(12);
    await r.adaptor.armSeedCheckpoint();
    const remoteRepo = new Repo({ network: [] });
    const remoteHandle = remoteRepo.import<LarDoc>(saveDoc(r.workingHandle.doc()));
    const remoteStore = new AutomergeDocStore(remoteHandle, workingBag);
    await remoteStore.put({ tiddler: { title, text: "base text", tags: ["base"], type: "remote type" } }, { kind: "crdt-remote", edgeIsland: "shore-vector-independent-peer" });
    r.workingHandle.merge(remoteHandle);
    await turns(12);
    const landedHeads = r.adaptor.ledger.landedOf(title)?.heads;
    expect(landedHeads).toBeDefined();
    const writes: Array<readonly string[] | undefined> = [];
    const writeFamily = r.composite.writeFamily.bind(r.composite);
    vi.spyOn(r.composite, "writeFamily").mockImplementation(async (puts, deletes, origin, options) => {
      if (puts.some((put) => put.tiddler.title === title)) writes.push(options?.base);
      return writeFamily(puts, deletes, origin, options);
    });
    const remoteFields = (r.wiki.getTiddler(title) as { fields: Record<string, unknown> }).fields;
    r.wiki.addTiddler(new r.Tiddler({ ...remoteFields, text: "hand text" }));
    await turns();
    boundary.fire();
    await turns();
    const saved = plainDoc(r.workingHandle.doc()).tiddlers[title]?.tiddler;
    expect(writes).toHaveLength(1);
    expect(writes[0]).toEqual(landedHeads);
    expect(saved?.text).toBe("hand text");
    expect(saved?.tags).toBe("base");
    expect(saved?.type).toBe("remote type");
    expect(await r.working.parallelDrafts(title)).toEqual([]);

    const sameField = "lar:///t/shore/Q-same-field";
    const draftBag = wikiSlotUri("shore-vector", "draft");
    const draftHandle = r.repo.create<LarDoc>(emptyLarDoc());
    r.composite.addLayer({ bagId: draftBag, store: new AutomergeDocStore(draftHandle, draftBag), writable: false });
    let holdSameField = false;
    let releaseSameField!: () => void;
    const sameFieldQueue = new Promise<void>((resolve) => { releaseSameField = resolve; });
    const second = await rig(boundary, async () => { if (holdSameField) await sameFieldQueue; });
    const sameBase = "lar:///t/shore/Q-same-field";
    await second.working.put({ tiddler: { title: sameBase, text: "same-field base" } }, remote);
    await turns();
    await second.adaptor.armSeedCheckpoint();
    const staleBase = second.adaptor.ledger.landedOf(sameBase)?.heads;
    const secondDraftBag = wikiSlotUri("shore-vector", "draft");
    const secondDraftHandle = second.repo.create<LarDoc>(emptyLarDoc());
    second.composite.addLayer({ bagId: secondDraftBag, store: new AutomergeDocStore(secondDraftHandle, secondDraftBag), writable: false });
    const peerRepo = new Repo({ network: [] });
    const peerHandle = peerRepo.import<LarDoc>(saveDoc(second.workingHandle.doc()));
    const peerStore = new AutomergeDocStore(peerHandle, workingBag);
    holdSameField = true;
    await peerStore.put({ tiddler: { title: sameBase, text: "remote value" } }, { kind: "crdt-remote", edgeIsland: "shore-vector-q-control-peer" });
    second.workingHandle.merge(peerHandle);
    await turns(12);
    const sameWrites: Array<readonly string[] | undefined> = [];
    const sameWriteTitles: string[] = [];
    const secondWriteFamily = second.composite.writeFamily.bind(second.composite);
    vi.spyOn(second.composite, "writeFamily").mockImplementation(async (puts, deletes, origin, options) => {
      if (puts.some((put) => put.tiddler.title === sameBase)) sameWrites.push(options?.base);
      sameWriteTitles.push(...puts.map((put) => put.tiddler.title), ...deletes);
      return secondWriteFamily(puts, deletes, origin, options);
    });
    second.wiki.addTiddler(new second.Tiddler({ title: sameBase, text: "hand value" }));
    const sameControl = `${sameBase}-control`;
    second.wiki.addTiddler(new second.Tiddler({ title: sameControl, text: "ordinary hand" }));
    await turns(1);
    boundary.fire();
    for (let turn = 0; turn < 80 && sameWrites.length < 1; turn++) await turns(1);
    expect(sameWrites).toEqual([staleBase]);
    expect((await second.working.parallelDrafts(sameBase)).map((draft) => draft.tiddler.text).sort()).toEqual(["hand value", "remote value"]);
    expect(sameWriteTitles.filter((writtenTitle) => writtenTitle === sameControl)).toHaveLength(1);
    expect(plainDoc(second.workingHandle.doc()).tiddlers[sameControl]?.tiddler.text).toBe("ordinary hand");
    holdSameField = false;
    releaseSameField();
    await settleTurns(second, [sameBase], () => sameWrites.length);
    second.unbridge();
    await second.adaptor.stop();
    await second.repo.shutdown();
    await peerRepo.shutdown();

    boundary.bind(r.adaptor);
    const control = "lar:///t/shore/Q-control";
    r.wiki.addTiddler(new r.Tiddler({ title: control, text: "changed" }));
    await turns(1);
    boundary.fire();
    await turns();
    expect(plainDoc(r.workingHandle.doc()).tiddlers[control]?.tiddler.text).toBe("changed");
    r.unbridge();
    await r.adaptor.stop();
    await r.repo.shutdown();
    await remoteRepo.shutdown();
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
    await r.adaptor.handsRested();
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
    const door = r.adaptor as unknown as { engineApply: (change: { title: string; record?: { tiddler?: { text?: string } } | null }) => void };
    const originalDoor = door.engineApply;
    const doorCalls: Array<{ title: string; text: string | undefined }> = [];
    door.engineApply = (change) => {
      doorCalls.push({ title: change.title, text: change.record?.tiddler?.text });
      originalDoor(change);
    };
    const before = r.workingHandle.heads();
    const wikiChangesBeforeHand = r.wiki.getChangeCount(title);
    const lares = (r.engine.$tw as unknown as { lares: { enqueueNalu(change: unknown): void } }).lares;
    lares.enqueueNalu({ title, record: { tiddler: { title, text: "stale wave" } }, origin: remote });
    r.wiki.addTiddler(new r.Tiddler({ title, text: "hand wins" }));
    await turns(20);
    expect(drainSawHand).toHaveBeenCalled();
    expect(r.save).toHaveBeenCalledTimes(0);
    // The hand write's own store-return wave mutates the wiki once; the stale wave never reaches the applier.
    expect(r.wiki.getChangeCount(title) - wikiChangesBeforeHand).toBe(2);
    expect(doorCalls).not.toContainEqual({ title, text: "stale wave" });
    const record = plainDoc(r.workingHandle.doc()).tiddlers[title];
    expect(record?.tiddler.text).toBe("hand wins");
    expect(r.workingHandle.heads()).not.toEqual(before);
    expect((r.wiki.getTiddler(title) as { fields: Record<string, unknown> }).fields.text).toBe("hand wins");
    delayedChange?.({ [title]: {} });
    await turns();
    expect(r.save).toHaveBeenCalledTimes(0);
    const control = "lar:///t/shore/I-control";
    r.wiki.addTiddler(new r.Tiddler({ title: control, text: "changed field" }));
    delayedChange?.({ [control]: {} });
    await r.adaptor.handsRested();
    expect(plainDoc(r.workingHandle.doc()).tiddlers[control]?.tiddler.text).toBe("changed field");
    releaseBridge();
    rawWiki.addEventListener = nativeAdd;
    rawWiki.removeEventListener = nativeRemove;
    await r.adaptor.stop();
    door.engineApply = originalDoor;
    await r.repo.shutdown();
  }, 120_000);

  test("R1: a hand that changes during a held leave is written before the queued wave can land", async () => {
    const boundary = new ManualBoundary();
    const r = await rig(boundary);
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
    expect(plainDoc(r.workingHandle.doc()).tiddlers[title]?.tiddler.text).toBe("hand latest");
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
    const adaptor = new IslandAdaptor(engine, composite, "shore-memory");
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

  test("R2: seedDrained waits for a deferred composition read and the record it resolves", async () => {
    const r = await rig();
    const title = "lar:///t/shore/R2";
    await r.working.put({ tiddler: { title, text: "survivor" } }, remote);
    await turns();
    let release!: (value: { bagId: string; record: LarTiddlerRecord } | null) => void;
    const deferred = new Promise<{ bagId: string; record: LarTiddlerRecord } | null>((resolve) => { release = resolve; });
    let resolveArrived!: () => void;
    const arrived = new Promise<void>((resolve) => { resolveArrived = resolve; });
    const resolveLayered = vi.spyOn(r.composite, "resolveLayered").mockImplementation((requestedTitle) => {
      if (requestedTitle === title) resolveArrived();
      return deferred as never;
    });
    const tombstone = r.canon.tombstone(title, remote);
    // Observe the resolver entry directly; idle remains pending while this composition read is held.
    await arrived;
    const checkpoint = r.adaptor.armSeedCheckpoint();
    let drained = false;
    void checkpoint.then(() => { drained = true; });
    await turns();
    expect(drained).toBe(false);
    release({ bagId: workingBag, record: { tiddler: { title, text: "survivor" } } });
    await checkpoint;
    expect((r.wiki.getTiddler(title) as { fields: Record<string, unknown> }).fields.text).toBe("survivor");
    expect(resolveLayered).toHaveBeenCalledWith(title);
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

    let residentAttempts = 0;
    const reported: string[] = [];
    const resident = new WaveLanding(async () => { residentAttempts++; throw new Error("resident cause"); }, async () => {}, (title, error) => { reported.push(`${title}: ${error.message}`); });
    await resident.checkpoint();
    resident.enqueue({ title: "lar:///t/shore/R3-resident", record: null, origin: remote });
    await turns();
    expect(residentAttempts).toBe(2);
    expect(reported).toHaveLength(1);
    expect(reported[0]).toContain("lar:///t/shore/R3-resident");
    expect(reported[0]).toContain("resident cause");
  });

  test("R4: a layer read that fails rejects the seed instead of landing the envelope record", async () => {
    const r = await rig();
    const title = "lar:///t/shore/R4";
    vi.spyOn(r.working, "readNow").mockImplementation(() => { throw new Error("layer read failed"); });
    const lares = (r.engine.$tw as unknown as { lares: { enqueueNalu(change: unknown): void } }).lares;
    lares.enqueueNalu({ title, bag: workingBag, record: { tiddler: { title, text: "stale envelope" } }, origin: remote });
    await expect(r.adaptor.armSeedCheckpoint()).rejects.toThrow(/R4.*layer read failed/);
    expect(r.wiki.getTiddler(title)).toBeUndefined();
    r.unbridge();
    await r.adaptor.stop();
    await r.repo.shutdown();
  }, 120_000);

  test("R5: stop waits for an active flush and the later same-title flush queued behind it", async () => {
    const boundary = new ManualBoundary();
    const r = await rig(boundary);
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
    boundary.fire();
    await began;
    const second = r.adaptor.saveTiddler(new r.Tiddler({ title, text: "second" }));
    boundary.fire();
    r.unbridge();
    let stopped = false;
    const stopping = r.adaptor.stop().then(() => { stopped = true; });
    await turns();
    expect(stopped).toBe(false);
    release();
    await Promise.all([first, second, stopping]);
    expect(writes).toBe(2);
    expect(plainDoc(r.workingHandle.doc()).tiddlers[title]?.tiddler.text).toBe("second");
    await r.repo.shutdown();
  }, 120_000);

  test("R8: landing setup fails by name when the engine applier is unavailable", async () => {
    const engine = await bootTestWiki();
    const lares = (engine.$tw as unknown as { lares: { applyNalu?: (change: unknown) => void } }).lares;
    lares.applyNalu = undefined;
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
    expect(Object.keys(plainDoc(workingHandle.doc()).tiddlers)).toEqual([]);
    wiki.addTiddler(new Tiddler({ title: "lar:///t/shore/hydration-control", text: "hand" }));
    await adaptor.handsRested();
    expect(plainDoc(workingHandle.doc()).tiddlers["lar:///t/shore/hydration-control"]?.tiddler.text).toBe("hand");
    unbridge();
    await adaptor.stop();
    expect(stores.length).toBeGreaterThan(0);
    await repo.shutdown();
  }, 120_000);

  // A canon seed remains in canon until a hand writes through the working route.
  test("M + control: a canon carrier seeds without a working copy, while a hand lands in working", async () => {
    const r = await rig();
    const title = "lar:///t/shore/M-canon";
    const mMark = r.arrivals.length;
    r.canonHandle.change((doc) => {
      doc.tiddlers[title] = { tiddler: { title, text: "canon content" } };
    });
    await r.hearSince(mMark, [title]);
    await r.adaptor.armSeedCheckpoint();
    expect((r.wiki.getTiddler(title) as { fields: Record<string, unknown> }).fields.text).toBe("canon content");
    expect(Object.keys(plainDoc(r.workingHandle.doc()).tiddlers)).toEqual([]);
    expect(r.save).toHaveBeenCalledTimes(0);

    const control = "lar:///t/shore/M-control";
    r.wiki.addTiddler(new r.Tiddler({ title: control, text: "hand" }));
    await r.adaptor.handsRested();
    expect(plainDoc(r.workingHandle.doc()).tiddlers[control]?.tiddler.text).toBe("hand");
    r.unbridge();
    await r.adaptor.stop();
    await r.repo.shutdown();
  }, 120_000);

  // A carrier's product placement writes a root with kahea refs and each child as its own record.
  test("G(a): the packed backstop writes nothing over a placed carrier", async () => {
    const boundary = new ManualBoundary();
    const r = await rig(boundary);
    const title = "lar:///t/shore/backstop";
    const placedByProduct = new Map<string, Record<string, unknown>>();
    const placeSink: MemeSink = {
      titles: () => [...placedByProduct.keys()],
      read: (uri) => placedByProduct.get(uri),
      land: (fields) => { placedByProduct.set(String(fields.title), fields as Record<string, unknown>); },
      tombstone: (uri) => { placedByProduct.delete(uri); },
    };
    await placeMeme({ uri: title, text: framed(title) }, placeSink);
    const placed = [...placedByProduct.values()];
    expect(placed.map((record) => record.title)).toEqual([title, `${title}#/a`]);
    expect(placed[0]?.text).toContain("<<~ kahea ahu slot=`#/a`>>");
    expect(placed[1]).toMatchObject({ "uri-path": "t/shore/backstop#/a", "$fragment-parent": title });
    await r.working.writeFamily(placed.map((record) => ({ tiddler: record })), [], remote, { bag: workingBag });
    await r.adaptor.armSeedCheckpoint();
    await settleTurns(r, [title, `${title}#/a`], () => 0);
    const landed = r.wiki.getTiddler(title) as { fields: Record<string, unknown> };
    const landedChild = r.wiki.getTiddler(`${title}#/a`) as { fields: Record<string, unknown> };
    const eventWiki = r.engine.$tw.wiki as unknown as {
      addEventListener(type: string, listener: (changes: Record<string, { modified: boolean }>) => void): void;
    };
    const nativeAddEventListener = eventWiki.addEventListener.bind(eventWiki);
    let backstopPass: ((changes: Record<string, { modified: boolean }>) => void) | undefined;
    eventWiki.addEventListener = (type, listener) => {
      if (type === "change") backstopPass = listener;
      nativeAddEventListener(type, listener);
    };
    armBackstop(r.engine.$tw as never, { log: () => {} });
    const wikiWrites: Array<{ action: "add" | "delete"; title: string }> = [];
    const nativeAdd = r.wiki.addTiddler.bind(r.wiki);
    const nativeDelete = (r.engine.$tw.wiki as unknown as { deleteTiddler(title: string): void }).deleteTiddler.bind(r.engine.$tw.wiki);
    let measuring = false;
    r.wiki.addTiddler = (tiddler: unknown): void => {
      const fields = (tiddler as { fields?: Record<string, unknown> }).fields ?? (tiddler as Record<string, unknown>);
      const writtenTitle = String(fields.title ?? "");
      if (measuring) wikiWrites.push({ action: "add", title: writtenTitle });
      nativeAdd(tiddler);
    };
    (r.engine.$tw.wiki as unknown as { deleteTiddler(title: string): void }).deleteTiddler = (writtenTitle) => {
      if (measuring) wikiWrites.push({ action: "delete", title: writtenTitle });
      nativeDelete(writtenTitle);
    };
    measuring = true;
    expect(backstopPass).toBeDefined();
    backstopPass!({ [title]: { modified: true } });
    await settleTurns(r, [title, `${title}#/a`], () => wikiWrites.length);
    measuring = false;
    const backstopPassWrites = [...wikiWrites];
    const backstopPassFields = { ...((r.wiki.getTiddler(title) as { fields: Record<string, unknown> }).fields) };
    const backstopChildFields = { ...((r.wiki.getTiddler(`${title}#/a`) as { fields: Record<string, unknown> }).fields) };
    r.wiki.addTiddler(new r.Tiddler({ ...landed.fields }));
    await settleTurns(r, [title, `${title}#/a`], () => r.workingHandle.heads().length);
    expect(backstopPassWrites).toEqual([]);
    expect(backstopPassFields).toEqual(landed.fields);
    expect(backstopChildFields).toEqual(landedChild.fields);
    const familyWrites: Array<{ puts: string[]; deletes: string[] }> = [];
    const nativeWriteFamily = r.composite.writeFamily.bind(r.composite);
    vi.spyOn(r.composite, "writeFamily").mockImplementation(async (puts, deletes, origin, options) => {
      familyWrites.push({ puts: puts.map((put) => put.tiddler.title), deletes: [...deletes] });
      return nativeWriteFamily(puts, deletes, origin, options);
    });
    const equalFields = { ...landed.fields };
    r.wiki.addTiddler(new r.Tiddler(equalFields));
    await settleTurns(r, [title, `${title}#/a`], () => familyWrites.length);
    expect(familyWrites).toEqual([]);
    const equalReAddWrites = familyWrites.length;
    const modified = { ...landed.fields, modified: "20261012000000000" };
    r.wiki.addTiddler(new r.Tiddler(modified));
    await turns(1);
    boundary.fire();
    await settleTurns(r, [title, `${title}#/a`], () => familyWrites.length);
    expect({
      backstopPassWrites,
      backstopPassFields,
      backstopChildFields,
      equalReAddWrites,
      modifiedFamilyWrites: familyWrites.slice(equalReAddWrites),
    }).toEqual({
      backstopPassWrites: [],
      backstopPassFields: landed.fields,
      backstopChildFields,
      equalReAddWrites: 0,
      modifiedFamilyWrites: [{ puts: [title], deletes: [] }],
    });
    r.unbridge();
    await r.adaptor.stop();
    r.wiki.addTiddler = nativeAdd;
    (r.engine.$tw.wiki as unknown as { deleteTiddler(title: string): void }).deleteTiddler = nativeDelete;
    await r.repo.shutdown();
  }, 120_000);

  test("G(b): an unsplit carrier places once and its return wave does not loop", async () => {
    const boundary = new ManualBoundary();
    const r = await rig(boundary);
    await r.adaptor.armSeedCheckpoint();
    const title = "lar:///t/shore/backstop-unsplit";
    r.wiki.addTiddler(new r.Tiddler({ title, type: CARRIER_TYPE, text: framed(title) }));
    const unsplitFields = { ...((r.wiki.getTiddler(title) as { fields: Record<string, unknown> }).fields) };
    expect(r.wiki.getTiddler(`${title}#/a`)).toBeUndefined();
    await turns(1);
    const eventWiki = r.engine.$tw.wiki as unknown as {
      addEventListener(type: string, listener: (changes: Record<string, { modified: boolean }>) => void): void;
    };
    let backstopPass: ((changes: Record<string, { modified: boolean }>) => void) | undefined;
    const nativeAddEventListener = eventWiki.addEventListener.bind(eventWiki);
    eventWiki.addEventListener = (type, listener) => {
      if (type === "change") backstopPass = listener;
      nativeAddEventListener(type, listener);
    };
    armBackstop(r.engine.$tw as never, { log: () => {} });
    const familyWrites: Array<{ puts: string[]; deletes: string[] }> = [];
    const nativeWriteFamily = r.composite.writeFamily.bind(r.composite);
    vi.spyOn(r.composite, "writeFamily").mockImplementation(async (puts, deletes, origin, options) => {
      familyWrites.push({ puts: puts.map((put) => put.tiddler.title), deletes: [...deletes] });
      return nativeWriteFamily(puts, deletes, origin, options);
    });
    const wikiWrites: Array<{ action: "add" | "delete"; title: string; stamped: boolean }> = [];
    const nativeAdd = r.wiki.addTiddler.bind(r.wiki);
    const nativeDelete = (r.engine.$tw.wiki as unknown as { deleteTiddler(title: string): void }).deleteTiddler.bind(r.engine.$tw.wiki);
    let measuring = false;
    r.wiki.addTiddler = (value: unknown): void => {
      const fields = (value as { fields?: Record<string, unknown> }).fields ?? value as Record<string, unknown>;
      if (measuring) wikiWrites.push({ action: "add", title: String(fields.title ?? ""), stamped: fields["$origin-bag"] !== undefined });
      nativeAdd(value);
    };
    (r.engine.$tw.wiki as unknown as { deleteTiddler(title: string): void }).deleteTiddler = (writtenTitle) => {
      if (measuring) wikiWrites.push({ action: "delete", title: writtenTitle, stamped: false });
      nativeDelete(writtenTitle);
    };
    expect(backstopPass).toBeDefined();
    measuring = true;
    backstopPass!({ [title]: { modified: true } });
    await settleTurns(r, [title, `${title}#/a`], () => familyWrites.length);
    const placeWrites = [...wikiWrites];
    const root = r.wiki.getTiddler(title) as { fields: Record<string, unknown> };
    const child = r.wiki.getTiddler(`${title}#/a`) as { fields: Record<string, unknown> };
    expect(unsplitFields).toMatchObject({ title, type: CARRIER_TYPE, text: framed(title) });
    expect(root.fields).toMatchObject({ title, type: CARRIER_TYPE, "uri-path": "t/shore/backstop-unsplit" });
    expect(root.fields.text).toContain("<<~ kahea ahu slot=`#/a`>>");
    expect(root.fields.text).not.toContain("! body");
    expect(child.fields).toMatchObject({ title: `${title}#/a`, type: CARRIER_TYPE, text: "! body", "uri-path": "t/shore/backstop-unsplit#/a", "$fragment-parent": title, "$slot": "#/a" });
    expect(placeWrites.map((write) => write.title).filter((writtenTitle) => writtenTitle === title || writtenTitle === `${title}#/a`)).toEqual([title, `${title}#/a`]);
    boundary.fire();
    await settleTurns(r, [title, `${title}#/a`], () => familyWrites.length);
    // The family call records its two member titles; separate member calls are not one atomic placement.
    expect(familyWrites, "one hand change stores the carrier root and its child in one family call").toEqual([{ puts: [title, `${title}#/a`], deletes: [] }]);
    // The family's return wave lands each member once, stamping its bag; the backstop places nothing again.
    await settleTurns(r, [title, `${title}#/a`], () => wikiWrites.length);
    expect(familyWrites).toHaveLength(1);
    const afterPlacement = wikiWrites.slice(placeWrites.length);
    expect(afterPlacement.every((write) => write.action === "add" && write.stamped), "every later wiki write is a wave landing with its bag stamp").toBe(true);
    expect(afterPlacement.map((write) => write.title).sort()).toEqual([title, `${title}#/a`]);
    expect(placeWrites.every((write) => !write.stamped)).toBe(true);
    const changeCounts = [r.wiki.getChangeCount(title), r.wiki.getChangeCount(`${title}#/a`)];
    const settledWrites = wikiWrites.length;
    await turns(40);
    expect(wikiWrites).toHaveLength(settledWrites);
    expect(familyWrites).toHaveLength(1);
    expect([r.wiki.getChangeCount(title), r.wiki.getChangeCount(`${title}#/a`)]).toEqual(changeCounts);
    r.unbridge();
    await r.adaptor.stop();
    measuring = false;
    r.wiki.addTiddler = nativeAdd;
    (r.engine.$tw.wiki as unknown as { deleteTiddler(title: string): void }).deleteTiddler = nativeDelete;
    await r.repo.shutdown();
  }, 120_000);

  test("H12-1: a never-landed create then delete leaves no store record or wiki title", async () => {
    const boundary = new ManualBoundary();
    const r = await rig(boundary);
    await r.adaptor.armSeedCheckpoint();
    const title = "lar:///t/shore/H12-never-landed";
    const control = `${title}-control`;
    const writes: string[] = [];
    const write = r.working.writeFamily.bind(r.working);
    vi.spyOn(r.working, "writeFamily").mockImplementation(async (puts, deletes, origin, options) => {
      writes.push(...puts.map((put) => put.tiddler.title), ...deletes);
      return write(puts, deletes, origin, options);
    });
    r.wiki.addTiddler(new r.Tiddler({ title, text: "briefly present" }));
    await turns(2);
    (r.wiki as unknown as { deleteTiddler(title: string): void }).deleteTiddler(title);
    await turns(2);
    r.wiki.addTiddler(new r.Tiddler({ title: control, text: "ordinary hand" }));
    await turns(1);
    boundary.fire();
    await settleTurns(r, [title, control], () => writes.length);
    expect(writes.filter((written) => written === control)).toHaveLength(1);
    expect(plainDoc(r.workingHandle.doc()).tiddlers[control]?.tiddler.text).toBe("ordinary hand");
    expect({
      titleWrites: writes.filter((written) => written === title),
      storeRecord: plainDoc(r.workingHandle.doc()).tiddlers[title] ?? null,
      wikiText: (r.wiki.getTiddler(title) as { fields?: Record<string, unknown> } | undefined)?.fields?.text ?? null,
    }).toEqual({ titleWrites: [], storeRecord: null, wikiText: null });
    r.unbridge(); await r.adaptor.stop(); await r.repo.shutdown();
  }, 120_000);

  test("H12-2: a landed a to b to a run leaves store and wiki at a without a write", async () => {
    const boundary = new ManualBoundary();
    const r = await rig(boundary);
    const title = "lar:///t/shore/H12-revert";
    const seedMark = r.arrivals.length;
    await r.working.put({ tiddler: { title, text: "a" } }, remote);
    await r.hearSince(seedMark, [title]);
    await r.adaptor.armSeedCheckpoint();
    const control = `${title}-control`;
    const writes: string[] = [];
    const write = r.working.writeFamily.bind(r.working);
    vi.spyOn(r.working, "writeFamily").mockImplementation(async (puts, deletes, origin, options) => {
      writes.push(...puts.map((put) => put.tiddler.title), ...deletes);
      return write(puts, deletes, origin, options);
    });
    r.wiki.addTiddler(new r.Tiddler({ title, text: "b" }));
    await turns(2);
    r.wiki.addTiddler(new r.Tiddler({ title, text: "a" }));
    await turns(2);
    r.wiki.addTiddler(new r.Tiddler({ title: control, text: "ordinary hand" }));
    await turns(1);
    boundary.fire();
    await settleTurns(r, [title, control], () => writes.length);
    expect(writes.filter((written) => written === control)).toHaveLength(1);
    expect(plainDoc(r.workingHandle.doc()).tiddlers[control]?.tiddler.text).toBe("ordinary hand");
    expect({
      titleWrites: writes.filter((written) => written === title),
      storeText: plainDoc(r.workingHandle.doc()).tiddlers[title]?.tiddler.text ?? null,
      wikiText: (r.wiki.getTiddler(title) as { fields?: Record<string, unknown> } | undefined)?.fields?.text ?? null,
    }).toEqual({ titleWrites: [], storeText: "a", wikiText: "a" });
    r.unbridge(); await r.adaptor.stop(); await r.repo.shutdown();
  }, 120_000);

  // The first write is still in flight when the hand returns to the landed value: the store would end at the
  // stale value unless the next flush writes the title's state at flush.
  test("H12-5: a hand that returns to the landed value while its write is in flight ends store and wiki at that value", async () => {
    const boundary = new ManualBoundary();
    const r = await rig(boundary);
    const title = "lar:///t/shore/H12-in-flight";
    await r.working.put({ tiddler: { title, text: "a" } }, remote);
    await turns();
    await r.adaptor.armSeedCheckpoint();
    let release!: () => void;
    let started!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const began = new Promise<void>((resolve) => { started = resolve; });
    const write = r.working.writeFamily.bind(r.working);
    let first = true;
    const texts: string[] = [];
    vi.spyOn(r.working, "writeFamily").mockImplementation(async (puts, deletes, origin, options) => {
      for (const put of puts) if (put.tiddler.title === title) texts.push(String(put.tiddler.text));
      if (first && puts.some((put) => put.tiddler.title === title)) { first = false; started(); await held; }
      return write(puts, deletes, origin, options);
    });
    r.wiki.addTiddler(new r.Tiddler({ title, text: "b" }));
    await turns(2);
    boundary.fire();
    await began;
    r.wiki.addTiddler(new r.Tiddler({ title, text: "a" }));
    await turns(2);
    release();
    await turns(4);
    boundary.fire();
    await settleTurns(r, [title], () => texts.length);
    expect({
      texts,
      storeText: plainDoc(r.workingHandle.doc()).tiddlers[title]?.tiddler.text ?? null,
      wikiText: (r.wiki.getTiddler(title) as { fields?: Record<string, unknown> } | undefined)?.fields?.text ?? null,
    }).toEqual({ texts: ["b", "a"], storeText: "a", wikiText: "a" });
    r.unbridge(); await r.adaptor.stop(); await r.repo.shutdown();
  }, 120_000);

  test("H12-3: a landed delete then equal restore leaves the live store and wiki untouched", async () => {
    const boundary = new ManualBoundary();
    const r = await rig(boundary);
    const title = "lar:///t/shore/H12-restore";
    const seedMark = r.arrivals.length;
    await r.working.put({ tiddler: { title, text: "keep", tags: ["same"] } }, remote);
    await r.hearSince(seedMark, [title]);
    await r.adaptor.armSeedCheckpoint();
    const control = `${title}-control`;
    const fields = (r.wiki.getTiddler(title) as { getFieldStrings(): Record<string, string> }).getFieldStrings();
    const writes: string[] = [];
    const write = r.composite.writeFamily.bind(r.composite);
    const tombstone = r.composite.tombstoneInBag.bind(r.composite);
    vi.spyOn(r.composite, "writeFamily").mockImplementation(async (puts, deletes, origin, options) => {
      writes.push(...puts.map((put) => put.tiddler.title), ...deletes);
      return write(puts, deletes, origin, options);
    });
    vi.spyOn(r.composite, "tombstoneInBag").mockImplementation(async (bag, deletedTitle, origin, options) => {
      writes.push(deletedTitle);
      return tombstone(bag, deletedTitle, origin, options);
    });
    (r.wiki as unknown as { deleteTiddler(title: string): void }).deleteTiddler(title);
    await turns(2);
    r.wiki.addTiddler(new r.Tiddler(fields));
    await turns(2);
    r.wiki.addTiddler(new r.Tiddler({ title: control, text: "ordinary hand" }));
    await turns(1);
    boundary.fire();
    await settleTurns(r, [title, control], () => writes.length);
    expect(writes.filter((written) => written === control)).toHaveLength(1);
    expect({
      titleWrites: writes.filter((written) => written === title),
      storeRecord: plainDoc(r.workingHandle.doc()).tiddlers[title] ?? null,
      storeDeleted: plainDoc(r.workingHandle.doc()).tiddlers[title]?.meta?.deleted ?? false,
      wikiText: (r.wiki.getTiddler(title) as { fields?: Record<string, unknown> } | undefined)?.fields?.text ?? null,
    }).toMatchObject({ titleWrites: [], storeRecord: { tiddler: { text: "keep" } }, storeDeleted: false, wikiText: "keep" });
    r.unbridge(); await r.adaptor.stop(); await r.repo.shutdown();
  }, 120_000);

  test("H12-4: an open-and-discarded draft leaves no store record or wiki title", async () => {
    const boundary = new ManualBoundary();
    const r = await rig(boundary);
    await r.adaptor.armSeedCheckpoint();
    const target = "lar:///t/shore/H12-draft-target";
    const title = `Draft of '${target}'`;
    const control = `${title}-control`;
    const writes: string[] = [];
    const write = r.composite.writeFamily.bind(r.composite);
    const tombstone = r.composite.tombstoneInBag.bind(r.composite);
    vi.spyOn(r.composite, "writeFamily").mockImplementation(async (puts, deletes, origin, options) => {
      writes.push(...puts.map((put) => put.tiddler.title), ...deletes);
      return write(puts, deletes, origin, options);
    });
    vi.spyOn(r.composite, "tombstoneInBag").mockImplementation(async (bag, deletedTitle, origin, options) => {
      writes.push(deletedTitle);
      return tombstone(bag, deletedTitle, origin, options);
    });
    r.wiki.addTiddler(new r.Tiddler({ title, "draft.of": target, "draft.title": target, text: "discard me" }));
    await turns(2);
    (r.wiki as unknown as { deleteTiddler(title: string): void }).deleteTiddler(title);
    await turns(2);
    r.wiki.addTiddler(new r.Tiddler({ title: control, text: "ordinary hand" }));
    await turns(1);
    boundary.fire();
    await settleTurns(r, [title, control], () => writes.length);
    expect(writes.filter((writtenTitle) => writtenTitle === control)).toHaveLength(1);
    expect({
      draftWrites: writes.filter((writtenTitle) => writtenTitle === title),
      storeRecord: plainDoc(r.workingHandle.doc()).tiddlers[title] ?? null,
      wikiTitle: r.wiki.getTiddler(title) ?? null,
    }).toEqual({ draftWrites: [], storeRecord: null, wikiTitle: null });
    r.unbridge(); await r.adaptor.stop(); await r.repo.shutdown();
  }, 120_000);

  // Lazy body expansion uses the shore door and does not emit a hand save.
  test("lazy splice + control: a bodyless landed handle fattens through the queue without a save", async () => {
    const r = await rig();
    const title = "lar:///t/shore/lazy";
    const body = "CAS body restored in the wiki";
    const cid = createHash("sha256").update(body).digest("hex");
    const lazyMark = r.arrivals.length;
    await r.working.put({ tiddler: { title, _is_skinny: "yes", textCid: cid } }, remote);
    await r.hearSince(lazyMark, [title]);
    await r.adaptor.armSeedCheckpoint();
    const heads = r.workingHandle.heads();
    const removeLazy = installLazyResolver(r.engine, async (requested) => requested === cid ? new TextEncoder().encode(body) : null);
    // The wiki's own change event for the title is the fattening arriving; the body is the resolver's answer.
    const fattened = new Promise<void>((resolve) => {
      (r.wiki as unknown as { addEventListener(name: string, fn: (changes: Record<string, unknown>) => void): void })
        .addEventListener("change", (changes) => { if (Object.hasOwn(changes, title)) resolve(); });
    });
    (r.wiki as unknown as { dispatchEvent(name: string, title: string): void }).dispatchEvent("lazyLoad", title);
    await fattened;
    await r.adaptor.landingIdle();
    expect((r.wiki.getTiddler(title) as { fields: Record<string, unknown> }).fields.text).toBe(body);
    expect(r.save).toHaveBeenCalledTimes(0);
    expect(r.workingHandle.heads()).toEqual(heads);
    const control = "lar:///t/shore/lazy-control";
    r.wiki.addTiddler(new r.Tiddler({ title: control, text: "changed" }));
    await r.adaptor.handsRested();
    expect(plainDoc(r.workingHandle.doc()).tiddlers[control]?.tiddler.text).toBe("changed");
    removeLazy();
    r.unbridge();
    await r.adaptor.stop();
    await r.repo.shutdown();
  }, 120_000);

  // A wave meeting a same-field hand leaves the conflict visible without losing either value.
  test("H + control: separate Repos merging one doc surface a same-field race without loss", async () => {
    const r = await rig();
    const title = "lar:///t/shore/H";
    const hMark = r.arrivals.length;
    await r.working.put({ tiddler: { title, text: "base" } }, remote);
    await r.hearSince(hMark, [title]);
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
    const mergeMark = r.arrivals.length;
    await remoteStore.put({ tiddler: { title, text: "remote value" } }, remote);
    r.workingHandle.merge(remoteHandle);
    await r.hearSince(mergeMark, [title]);
    await turns();
    const drafts = await r.working.parallelDrafts(title);
    expect(drafts.map((draft) => draft.tiddler.text).sort()).toEqual(["hand value", "remote value"]);
    expect(plainDoc(r.workingHandle.doc()).tiddlers[title]?.tiddler.text).toBeTruthy();
    expect(r.save).toHaveBeenCalledTimes(1);
    const control = "lar:///t/shore/H-control";
    r.wiki.addTiddler(new r.Tiddler({ title: control, text: "changed field" }));
    await r.adaptor.handsRested();
    expect(plainDoc(r.workingHandle.doc()).tiddlers[control]?.tiddler.text).toBe("changed field");
    r.unbridge();
    await r.adaptor.stop();
    await r.repo.shutdown();
    await remoteRepo.shutdown();
  }, 120_000);
});
