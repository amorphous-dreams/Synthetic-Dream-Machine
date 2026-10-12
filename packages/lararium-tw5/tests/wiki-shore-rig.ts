/**
 * Shared rig for the wiki-shore draft-road, cross-bag and returning-hand vectors: a real TiddlyWiki
 * through `test-wiki.ts`, real `AutomergeDocStore`s over a real automerge-repo `Repo`, a `CompositeStore`
 * with a read-only canon layer plus writable working and draft layers, and `ManualTimers`.
 *
 * Every composite store call is recorded SYNCHRONOUSLY at the call, so a vector reads what the shore
 * issued in a given turn, with the exact `base` argument and the bag.
 */
import { vi } from "vitest";
import { createRequire } from "node:module";
import {
  AutomergeDocStore, CompositeStore, emptyLarDoc,
  type LarDoc, type LarTiddlerRecord, type Repo as RepoType, wikiSlotUri,
} from "@lararium/mesh";
import { IslandAdaptor } from "../src/island-adaptor.js";
import { bridgeWikiToAdaptor } from "../src/outbound-bridge.js";
import type { ShoreTimers } from "../src/hand-gate.js";
import { bootTestWiki } from "./test-wiki.js";
import type { TW5Engine } from "../src/tw5-vm.js";

export const canonBag = wikiSlotUri("shore-road", "canon");
export const workingBag = wikiSlotUri("shore-road", "working");
export const draftBag = wikiSlotUri("shore-road", "draft");
export const remote = { kind: "crdt-remote", edgeIsland: "shore-road-peer" } as const;

const meshRequire = createRequire(import.meta.resolve("@lararium/mesh"));
export const Repo = meshRequire("@automerge/automerge-repo").Repo as new (options: { network: unknown[] }) => RepoType;
const automerge = meshRequire("@automerge/automerge") as {
  save(doc: LarDoc): Uint8Array;
  getAllChanges(doc: LarDoc): unknown[];
};

export const turns = async (n = 8): Promise<void> => { for (let i = 0; i < n; i++) await new Promise<void>((resolve) => setImmediate(resolve)); };
/** Resolves after the wiki's own `change` dispatch (TiddlyWiki dispatches on `process.nextTick`, FIFO). */
export const afterDispatch = (): Promise<void> => new Promise<void>((resolve) => process.nextTick(resolve));

export class ManualTimers implements ShoreTimers {
  private id = 0;
  readonly tasks = new Map<number, { fn: () => void; ms: number }>();
  setTimer(fn: () => void, ms: number): number { const id = ++this.id; this.tasks.set(id, { fn, ms }); return id; }
  clearTimer(handle: unknown): void { this.tasks.delete(handle as number); }
  armed(): number { return this.tasks.size; }
  fire(ms: number): void {
    const found = [...this.tasks].find(([, task]) => task.ms === ms);
    if (!found) throw new Error(`no ${ms}ms timer is armed`);
    this.tasks.delete(found[0]);
    found[1].fn();
  }
  fireAll(ms: number): void { while ([...this.tasks.values()].some((task) => task.ms === ms)) this.fire(ms); }
}

export interface StoreCall {
  readonly kind: "family" | "tombstone";
  readonly bag: string | undefined;
  readonly puts: readonly string[];
  readonly deletes: readonly string[];
  readonly base: readonly string[] | undefined;
}

export interface RigOptions {
  readonly instanceId?: string;
  readonly timers?: ShoreTimers;
  readonly yieldHost?: () => Promise<void>;
  /** Whether the canon layer accepts writes (default: it does not). */
  readonly canonWritable?: boolean;
  /** Leave the working layer unmounted, though the recipe pointers still name it. */
  readonly noWorking?: boolean;
  /** Saved docs to import, so a second shore stands over the same history as a first. */
  readonly docs?: { canon?: Uint8Array; working?: Uint8Array; draft?: Uint8Array };
}

export type Rig = Awaited<ReturnType<typeof shoreRig>>;

export async function shoreRig(opts: RigOptions = {}) {
  const instanceId = opts.instanceId ?? "shore-road";
  const engine = await bootTestWiki();
  const wiki = engine.$tw.wiki as unknown as {
    addTiddler(t: unknown): void;
    deleteTiddler(t: string): void;
    getTiddler(t: string): { fields: Record<string, unknown> } | undefined;
    getChangeCount(t: string): number;
    filterTiddlers(filter: string): string[];
    addEventListener(type: "change", fn: (changes: unknown) => void): void;
  };
  const Tiddler = (engine.$tw as unknown as { Tiddler: new (...f: Array<Record<string, unknown>>) => unknown }).Tiddler;
  for (const [name, value] of [["bag", workingBag], ["temp", wikiSlotUri("shore-road", "temp")], ["draft", draftBag], ["personal", wikiSlotUri("shore-road", "personal")]]) {
    wiki.addTiddler(new Tiddler({ title: `lar:///ha.ka.ba/lararium/config/current-wiki-${name}`, text: value }));
  }
  const repo = new Repo({ network: [] });
  const open = (saved: Uint8Array | undefined) => saved ? repo.import<LarDoc>(saved) : repo.create<LarDoc>(emptyLarDoc());
  const canonHandle = open(opts.docs?.canon);
  const workingHandle = open(opts.docs?.working);
  const draftHandle = open(opts.docs?.draft);
  const canon = new AutomergeDocStore(canonHandle, canonBag);
  const working = new AutomergeDocStore(workingHandle, workingBag);
  const draft = new AutomergeDocStore(draftHandle, draftBag);
  const composite = new CompositeStore();
  composite.addLayer({ bagId: canonBag, store: canon, writable: opts.canonWritable === true, defaultWritable: false });
  if (opts.noWorking !== true) composite.addLayer({ bagId: workingBag, store: working, writable: true });
  composite.addLayer({ bagId: draftBag, store: draft, writable: true, defaultWritable: false });

  const calls: StoreCall[] = [];
  /** Every hand-origin put or tombstone the shore sent into a bag outside this wiki's own slots. */
  const outsideSlots: string[] = [];
  const ownSlots = new Set<string>([workingBag, draftBag, wikiSlotUri("shore-road", "temp"), wikiSlotUri("shore-road", "personal")]);
  const writeFamily = composite.writeFamily.bind(composite);
  const tombstoneInBag = composite.tombstoneInBag.bind(composite);
  const failures: { family: Error | null; tombstone: Error | null; gate: Promise<void> | null; hold: Promise<void> | null } = { family: null, tombstone: null, gate: null, hold: null };
  vi.spyOn(composite, "writeFamily").mockImplementation((puts, deletes, origin, options) => {
    const destination = options?.bag ?? composite.defaultWritableBagId() ?? undefined;
    if (destination && !ownSlots.has(destination) && origin.kind === "tw-local") outsideSlots.push(`family ${destination}`);
    calls.push({ kind: "family", bag: destination, puts: puts.map((p) => p.tiddler.title), deletes: [...deletes], base: options?.base });
    if (failures.hold && options?.bag === draftBag) { const held = failures.hold; return held.then(() => writeFamily(puts, deletes, origin, options)); }
    if (failures.family) { const fault = failures.family; return (failures.gate ?? Promise.resolve()).then(() => { throw fault; }); }
    return writeFamily(puts, deletes, origin, options);
  });
  vi.spyOn(composite, "tombstoneInBag").mockImplementation((bag, title, origin, options) => {
    const destination = bag || composite.defaultWritableBagId() || "";
    if (!ownSlots.has(destination) && origin.kind === "tw-local") outsideSlots.push(`tombstone ${destination}`);
    calls.push({ kind: "tombstone", bag, puts: [], deletes: [title], base: options?.base });
    if (failures.tombstone) return Promise.reject(failures.tombstone);
    return tombstoneInBag(bag, title, origin, options);
  });

  const adaptor = new IslandAdaptor(engine, composite, instanceId, opts.timers);
  adaptor.installLandingQueue(opts.yieldHost);
  const arrivals: string[] = [];
  const onUriChanged = adaptor.onUriChanged.bind(adaptor);
  vi.spyOn(adaptor, "onUriChanged").mockImplementation((change) => { arrivals.push(change.title); onUriChanged(change); });
  adaptor.start();
  const unbridge = bridgeWikiToAdaptor(engine, adaptor);
  await turns();
  return {
    engine, wiki, Tiddler, repo, instanceId, composite, adaptor, unbridge, calls, failures, arrivals, outsideSlots,
    canonHandle, workingHandle, draftHandle, canon, working, draft,
    handles: { [canonBag]: canonHandle, [workingBag]: workingHandle, [draftBag]: draftHandle } as Record<string, typeof canonHandle>,
    saved: () => ({
      canon: automerge.save(canonHandle.doc()), working: automerge.save(workingHandle.doc()), draft: automerge.save(draftHandle.doc()),
    }),
    doc: (bag: string): LarDoc => (({ [canonBag]: canonHandle, [workingBag]: workingHandle, [draftBag]: draftHandle } as Record<string, typeof canonHandle>)[bag]!).doc() as LarDoc,
    changes: (bag: string): number => automerge.getAllChanges((({ [canonBag]: canonHandle, [workingBag]: workingHandle, [draftBag]: draftHandle } as Record<string, typeof canonHandle>)[bag]!).doc() as LarDoc).length,
    stop: async (): Promise<void> => {
      unbridge();
      try {
        await adaptor.stop();
        if (outsideSlots.length > 0) throw new Error(`a hand wrote outside the wiki's own slots: ${outsideSlots.join(", ")}`);
      } finally { await repo.shutdown(); }
    },
  };
}

/** A second actor over its own Repo: imports the bag's doc, writes, and merges back into the shore's handle. */
export async function peerWrite(r: Rig, bag: string, records: readonly LarTiddlerRecord[]): Promise<void> {
  const peerRepo = new Repo({ network: [] });
  const peerHandle = peerRepo.import<LarDoc>(automerge.save(r.handles[bag]!.doc()));
  const peerStore = new AutomergeDocStore(peerHandle, bag);
  for (const record of records) await peerStore.put(record, { kind: "crdt-remote", edgeIsland: `peer-of-${r.instanceId}` });
  const before = r.arrivals.length;
  r.handles[bag]!.merge(peerHandle);
  await arrived(r, before, records.map((record) => record.tiddler.title));
  await peerRepo.shutdown();
}

/** Waits (host turns only, no clock) until the shore has heard every title since `before` arrivals. */
export async function arrived(r: Rig, before: number, titles: readonly string[]): Promise<void> {
  // The store delivers a merge through its own debounce; the wait is on the arrival signal, the cap only ends a hang.
  for (let attempt = 0; attempt < 600; attempt++) {
    const heard = new Set(r.arrivals.slice(before));
    if (titles.every((title) => heard.has(title))) { await turns(24); return; }
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`the shore never heard ${titles.join(", ")}`);
}

/** A `change` listener registered after the bridge: records how many store calls stood when the dispatch reached it. */
export function atDispatch(r: Rig): { readonly seen: () => number } {
  let seen = -1;
  r.wiki.addEventListener("change", () => { seen = r.calls.length; });
  return { seen: () => seen };
}

export const draftTitleOf = (target: string): string => `Draft of '${target}'`;

/** What `makeDraftTiddler` writes: the target's fields, a title, and the two draft fields. */
export function openDraft(r: Rig, target: string, text = "draft"): string {
  const title = draftTitleOf(target);
  const standing = r.wiki.getTiddler(target)?.fields ?? {};
  r.wiki.addTiddler(new r.Tiddler({ text: "" }, standing, { title, "draft.title": target, "draft.of": target, text }));
  return title;
}

/** One keystroke on a draft: the editor writes the draft with the new text. */
export function typeInto(r: Rig, title: string, text: string, extra: Record<string, unknown> = {}): void {
  const standing = r.wiki.getTiddler(title)!.fields;
  r.wiki.addTiddler(new r.Tiddler(standing, { text }, extra));
}

/** The synchronous sequence `handleSaveTiddlerEvent` performs (one `change` dispatch). */
export function saveSequence(r: Rig, draftTitle: string, extra: Record<string, unknown> = {}): { target: string } {
  const fields = r.wiki.getTiddler(draftTitle)!.fields;
  const draftOf = String(fields["draft.of"] ?? "");
  const target = String(fields["draft.title"] ?? "").trim() || draftOf;
  r.wiki.addTiddler(new r.Tiddler(fields, { title: target, "draft.title": undefined, "draft.of": undefined }, extra));
  r.wiki.deleteTiddler(draftTitle);
  if (target !== draftOf) r.wiki.deleteTiddler(draftOf);
  return { target };
}

export function storeText(r: Rig, bag: string, title: string): string | undefined {
  const record = r.doc(bag).tiddlers[title];
  return record && !record.meta?.deleted ? String(record.tiddler.text) : undefined;
}
export function storeDeleted(r: Rig, bag: string, title: string): boolean {
  return r.doc(bag).tiddlers[title]?.meta?.deleted === true;
}
export type { TW5Engine };
