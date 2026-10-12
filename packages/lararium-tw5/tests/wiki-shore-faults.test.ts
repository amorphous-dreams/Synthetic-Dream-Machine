import { createRequire } from "node:module";
import { describe, expect, test, vi } from "vitest";
import { AutomergeDocStore, CompositeStore, emptyLarDoc, type LarDoc, type LarTiddlerRecord, type Repo as RepoType, wikiSlotUri } from "@lararium/mesh";
import { IslandAdaptor } from "../src/island-adaptor.js";
import { buildIslandRecipe, seedDrained } from "../src/island-recipe.js";
import { bootTestWiki } from "./test-wiki.js";

const remote = { kind: "crdt-remote", edgeIsland: "shore-fault-peer" } as const;
const Repo = createRequire(import.meta.resolve("@lararium/mesh"))("@automerge/automerge-repo").Repo as new (options: { network: unknown[] }) => RepoType;

async function realRig() {
  const engine = await bootTestWiki();
  const wiki = engine.$tw.wiki as unknown as { addTiddler(t: unknown): void; getTiddler(title: string): unknown };
  const Tiddler = (engine.$tw as unknown as { Tiddler: new (fields: Record<string, unknown>) => unknown }).Tiddler;
  const slug = "shore-fault";
  const canonBag = wikiSlotUri(slug, "canon");
  const workingBag = wikiSlotUri(slug, "working");
  for (const [name, bag] of [["bag", workingBag], ["temp", wikiSlotUri(slug, "temp")], ["draft", wikiSlotUri(slug, "draft")], ["personal", wikiSlotUri(slug, "personal")]]) {
    wiki.addTiddler(new Tiddler({ title: `lar:///ha.ka.ba/lararium/config/current-wiki-${name}`, text: bag }));
  }
  const repo = new Repo({ network: [] });
  const canonHandle = repo.create<LarDoc>(emptyLarDoc());
  const workingHandle = repo.create<LarDoc>(emptyLarDoc());
  const canon = new AutomergeDocStore(canonHandle, canonBag);
  const working = new AutomergeDocStore(workingHandle, workingBag);
  const composite = new CompositeStore();
  composite.addLayer({ bagId: canonBag, store: canon, writable: false });
  composite.addLayer({ bagId: workingBag, store: working, writable: true });
  const adaptor = new IslandAdaptor(engine, composite, slug);
  adaptor.installLandingQueue();
  adaptor.start();
  return { engine, wiki, Tiddler, repo, canonHandle, workingHandle, canon, working, composite, adaptor, canonBag, workingBag };
}

describe("wiki shore fault vectors", () => {
  test("a failed composition read retries once during seed and the wiki shows the composition's record", async () => {
    const r = await realRig();
    const rejectedTitle = "lar:///t/shore/fault/rejected-resolver";
    const survivorTitle = "lar:///t/shore/fault/resolved-survivor";
    const rejectedRecord: LarTiddlerRecord = { tiddler: { title: rejectedTitle, text: "survives the resolver fault" } };
    const survivorRecord: LarTiddlerRecord = { tiddler: { title: survivorTitle, text: "survivor value" } };
    await r.working.put(rejectedRecord, remote);
    await r.working.put(survivorRecord, remote);
    r.working.emitInitialReplay();
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    // The composition read fails once for the rejected title; the landing retries it and lands what resolves.
    const resolveLayered = r.composite.resolveLayered.bind(r.composite);
    let failedOnce = false;
    vi.spyOn(r.composite, "resolveLayered").mockImplementation(async (title) => {
      if (title === rejectedTitle && !failedOnce) { failedOnce = true; throw new Error("layered read failed"); }
      return resolveLayered(title);
    });
    await r.canon.tombstone(rejectedTitle, remote);
    await r.canon.tombstone(survivorTitle, remote);

    // The checkpoint includes both resolver promises and the tombstone/survivor queue items.
    await r.adaptor.armSeedCheckpoint();
    expect(failedOnce, "the composition read failed once and the landing retried it").toBe(true);
    // The wiki shows what the composition resolves: the working layer's live record stands above canon's tombstone.
    expect(r.adaptor.ledger.landedOf(rejectedTitle)?.bag).toBe(r.workingBag);
    expect((r.wiki.getTiddler(rejectedTitle) as { fields: Record<string, unknown> }).fields.text).toBe("survives the resolver fault");
    expect((r.wiki.getTiddler(survivorTitle) as { fields: Record<string, unknown> }).fields).toMatchObject({ title: survivorTitle, text: "survivor value", "$origin-bag": r.workingBag });
    expect(r.adaptor.ledger.landedOf(survivorTitle)?.bag).toBe(r.workingBag);
    await r.adaptor.stop();
    expect(r.adaptor.isResident()).toBe(true);
    errors.mockRestore();
    await r.repo.shutdown();
  }, 120_000);

  test("a composition read failing twice on a resident shore is reported with its title", async () => {
    const r = await realRig();
    await r.adaptor.armSeedCheckpoint();
    const title = "lar:///t/shore/fault/resident-read";
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(r.composite, "resolveLayered").mockRejectedValue(new Error("resident composition read failed"));
    await r.working.put({ tiddler: { title, text: "resident value" } }, remote);
    await r.adaptor.landingIdle();
    expect(errors.mock.calls.flat().join(" ")).toContain(title);
    errors.mockRestore();
    await r.adaptor.stop();
    await r.repo.shutdown();
  }, 120_000);

  test("the recipe checkpoint retains the title and cause after two seed landing failures", async () => {
    class FakeTiddler {
      constructor(readonly fields: Record<string, unknown>) {}
      getFieldStrings(): Record<string, string> { return Object.fromEntries(Object.entries(this.fields).map(([key, value]) => [key, String(value)])); }
      isEqual(other: unknown, exclude: string[] = []): boolean {
        const fields = (other as FakeTiddler | null)?.fields;
        if (!fields) return false;
        const keys = new Set([...Object.keys(this.fields), ...Object.keys(fields)]);
        return [...keys].filter((key) => !exclude.includes(key)).every((key) => this.fields[key] === fields[key]);
      }
    }
    const wikiTiddlers = new Map<string, FakeTiddler>();
    const engine = {
      $tw: {
        Tiddler: FakeTiddler,
        wiki: {
          getTiddlerText: (title: string, fallback = "") => String(wikiTiddlers.get(title)?.fields.text ?? fallback),
          getTiddler: (title: string) => wikiTiddlers.get(title),
          filterTiddlers: () => [],
          addTiddler: (value: FakeTiddler) => { wikiTiddlers.set(String(value.fields.title), value); },
          deleteTiddler: (title: string) => { wikiTiddlers.delete(title); },
          addEventListener: () => {},
          removeEventListener: () => {},
          transact: (fn: () => void) => fn(),
        },
        lares: { isApplyingNalu: () => false, applyNalu: () => {} },
      },
    };
    const repo = new Repo({ network: [] });
    const handle = repo.create<LarDoc>(emptyLarDoc());
    const title = "lar:///t/shore/fault/seed-title";
    handle.change((doc) => { doc.tiddlers[title] = { tiddler: { title, text: "seed" } }; });
    const bag = wikiSlotUri("shore-fault-seed", "working");
    const { adaptor } = buildIslandRecipe({
      tw5: engine as never,
      composite: new CompositeStore(),
      recipe: { wikiSlug: "shore-fault-seed" },
      ready: [{ slot: bag, handle }],
    });
    let attempts = 0;
    const landOne = adaptor as unknown as { _landOne(change: { title: string }): Promise<void> };
    const originalLand = landOne._landOne.bind(adaptor);
    landOne._landOne = async (change) => {
      if (change.title === title) { attempts++; throw new Error("seed wiki write failed"); }
      await originalLand(change as never);
    };

    let fault: unknown;
    try { await seedDrained(engine as never); } catch (error) { fault = error; }
    expect(fault).toBeInstanceOf(Error);
    expect((fault as Error).message).toContain(title);
    expect((fault as Error).message).toContain("seed wiki write failed");
    expect(attempts).toBe(2);
    await adaptor.stop();
    await repo.shutdown();
  }, 120_000);
});
