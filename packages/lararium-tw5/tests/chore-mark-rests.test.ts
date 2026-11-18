/**
 * chore-mark-rests — the chore mark rests with the write (T4-5). The vessel's door hands the mark (`ChoreReceiptMark`: the
 * acting face, the asker's hand, its session) to the placed ask; the island books it with the act, and the dispatcher stamps it
 * into the durable outcome beside the result, so a receipt read later answers who acted and who asked. One cross-wiki read:
 * a seat writes into two wikis, and each outcome carries the mark beside the bag and layer its put named. A synced verb tiddler
 * (content) carries none.
 */
import { memoryControlStore } from "./control-store-fixture.js";
import { describe, test, expect } from "vitest";
import { Repo } from "./wiki-shore-rig.js";
import { AutomergeDocStore, CompositeStore, DAEMON_BAG_ID, OUTCOME_URI_PREFIX, emptyLarDoc, recipeUri, type LarTiddlerRecord } from "@lararium/mesh";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { VerbDispatcher, VerbTable } from "../src/verb-dispatcher.js";
import { makeLocalAskBook } from "../src/daemon-behavior.js";
import { makeMemePutReactor, type MemeVerbOptions } from "../src/meme-verbs.js";
import type { TW5Engine } from "../src/tw5-vm.js";

type TiddlerFields = Record<string, unknown>;
type ChangeListener = (changed: Record<string, { deleted?: boolean }>) => void;

/** A fake TW5 wiki whose addTiddler/deleteTiddler fire REAL synchronous "change" events — the one
 *  thing the dispatcher's LOCAL path depends on, and the one thing a plain field-bag fake (as
 *  verb-vm.test.ts's FakeTW5Engine) doesn't need to provide. */
class FakeTW5Engine {
  private readonly records = new Map<string, TiddlerFields>();
  private listeners: ChangeListener[] = [];

  readonly wiki = {
    addTiddler: (tiddler: { fields?: TiddlerFields } | TiddlerFields): void => {
      const fields = (tiddler && typeof tiddler === "object" && "fields" in tiddler && tiddler.fields)
        ? tiddler.fields
        : (tiddler as TiddlerFields);
      const title = typeof fields.title === "string" ? fields.title : null;
      if (!title) throw new Error("title required");
      this.records.set(title, { ...fields });
      for (const l of this.listeners) l({ [title]: {} });
    },
    getTiddler: (title: string): { fields: TiddlerFields } | undefined => {
      const fields = this.records.get(title);
      return fields ? { fields: { ...fields } } : undefined;
    },
    deleteTiddler: (title: string): void => {
      const existed = this.records.delete(title);
      if (existed) for (const l of this.listeners) l({ [title]: { deleted: true } });
    },
    addEventListener: (type: string, fn: ChangeListener): void => {
      if (type === "change") this.listeners.push(fn);
    },
    removeEventListener: (type: string, fn: ChangeListener): void => {
      if (type === "change") this.listeners = this.listeners.filter((l) => l !== fn);
    },
  };

  readonly $tw = {
    Tiddler: class {
      fields: TiddlerFields;
      constructor(fields: TiddlerFields) { this.fields = fields; }
    },
    wiki: this.wiki,
  };
}

function makeDaemon(): CompositeStore {
  const composite = new CompositeStore();
  composite.addLayer({ bagId: DAEMON_BAG_ID, store: new MemoryTiddlerStore(DAEMON_BAG_ID), writable: true });
  return composite;
}

/** Flush N real macrotask turns — the dispatcher's getLive→dedup→writeOutcome chain crosses a
 *  genuine async boundary (verbInputDigest rides Web Crypto's subtle.digest, which resolves on
 *  the platform's own task queue, not a bare microtask), so a `Promise.resolve()` spin isn't
 *  enough; `setTimeout(0)` is. */
async function settle(turns = 20): Promise<void> {
  for (let i = 0; i < turns; i++) await new Promise((r) => setTimeout(r, 0));
}

async function outcomeOf(daemon: CompositeStore, requestId: string) {
  const rec = await daemon.getLive(OUTCOME_URI_PREFIX + requestId);
  if (!rec) return null;
  const results = JSON.parse(String(rec.tiddler["results"] ?? "{}")) as Record<string, { ok: boolean; output?: unknown }>;
  return { fields: rec.tiddler, results };
}


const MARK = { acting: 0, asker: "seat", session: null } as const;
const meme = (uri: string, slot: string): string =>
  `<<^ code=\`&#x0001;\` from=\`?\` to=\`${uri}\`>>\n` +
  `<<^ code=\`&#x0002;\`>>\n\n\`\`\`toml meta\nuri-path = "${uri.slice("lar:///".length)}"\n\`\`\`\n\n<<~ ahu slot=\`#${slot}\`>>\n\n! ${slot}\n\n<<~/ahu>>\n\n` +
  `<<^ code=\`&#x0003;\`>>\n\n<<^ code=\`&#x0004;\` to=\`?\`>>\n`;

type Book = ReturnType<typeof makeLocalAskBook> & { choreOf(ask: unknown): unknown };

async function stand(register: (registry: VerbTable) => void) {
  const tw5 = new FakeTW5Engine() as unknown as TW5Engine;
  const control = memoryControlStore();
  const book = makeLocalAskBook() as Book;
  const registry = new VerbTable();
  register(registry);
  const dispatcher = new VerbDispatcher({
    daemonVm: tw5, daemon: makeDaemon(), control, registry,
    localOf: (inv) => book.has(inv), surfaceOf: (inv) => book.isSurface(inv), choreOf: (inv: unknown) => book.choreOf(inv),
  } as never);
  dispatcher.start();
  const place = async (requestId: string, verb: string, args: Record<string, unknown>, chore?: unknown) => {
    if (chore !== undefined) book.add({ requestId, action: verb, args, requestedBy: "me", origin: "channel", asker: "seat", chore } as never);
    dispatcher.placeVerb({ verb, args, requestedBy: "me", requestId });
    await settle();
    return control.getLive(OUTCOME_URI_PREFIX + requestId);
  };
  return { place, stop: () => dispatcher.stop() };
}

const markOf = (rec: LarTiddlerRecord | null): unknown => {
  const raw = rec?.tiddler["chore"];
  return typeof raw === "string" ? JSON.parse(raw) : raw;
};

describe("the chore mark rests in the durable outcome", () => {
  test("RED: the local ask book names the chore mark of the exact act; CONTROL: other args name none", () => {
    const book = makeLocalAskBook() as Book;
    const ask = { requestId: "r1", action: "meme-put", args: { x: 1 }, requestedBy: "me" };
    book.add({ ...ask, origin: "channel", chore: MARK } as never);
    expect(book.choreOf(ask)).toEqual(MARK);
    expect(book.choreOf({ ...ask, args: { x: 2 } })).toBeUndefined();
  });

  test("RED: a booked ask's outcome carries its mark; CONTROL: a synced verb tiddler's outcome carries none", async () => {
    const s = await stand((r) => r.register("probe", async () => ({ ok: true })));
    expect(markOf(await s.place("a1", "probe", { x: 1 }, MARK))).toEqual(MARK);
    expect((await s.place("a2", "probe", { x: 1 }))?.tiddler).not.toHaveProperty("chore");
    s.stop();
  });

  test("RED: one cross-wiki read: the seat writes two wikis, and each outcome names the mark beside the bag and layer its put named", async () => {
    const repo = new Repo({ network: [] });
    try {
      const working = (slug: string) => `lar:///ha.ka.ba/wikis/${slug}/working`;
      const stores = new Map<string, AutomergeDocStore>();
      const composite = new CompositeStore();
      for (const slug of ["notes", "works"]) {
        const store = new AutomergeDocStore(repo.create(emptyLarDoc()), working(slug));
        stores.set(slug, store);
        composite.addLayer({ bagId: working(slug), store, writable: true });
      }
      const recipe = (slug: string): LarTiddlerRecord => ({ tiddler: { title: recipeUri("catalog", slug), "bag-stack": working(slug), "writable-bag": working(slug) } });
      const opts: MemeVerbOptions = {
        composite,
        tw5: { $tw: { wiki: { getTiddlerText: () => "" } } } as unknown as MemeVerbOptions["tw5"],
        recipeOf: async (slug) => (slug === "notes" || slug === "works" ? recipe(slug) : null),
        slotStore: async (slug, kind) => (kind === "working" ? stores.get(slug) ?? null : null),
      };
      const s = await stand((r) => r.register("meme-put", makeMemePutReactor(opts)));
      for (const slug of ["notes", "works"]) {
        const uri = `lar:///t/${slug}-page`;
        const outcome = await s.place(`put-${slug}`, "meme-put", { uri, recipe: slug, text: meme(uri, "/a") }, MARK);
        expect(outcome?.tiddler["status"], slug).toBe("done");
        expect(markOf(outcome), slug).toEqual(MARK);
        const output = (JSON.parse(String(outcome?.tiddler["results"])) as Record<string, { output?: Record<string, unknown> }>)["summary"]?.output;
        expect(output, slug).toMatchObject({ bag: working(slug), layer: "working" });
      }
      s.stop();
    } finally { await repo.shutdown(); }
  });
});
