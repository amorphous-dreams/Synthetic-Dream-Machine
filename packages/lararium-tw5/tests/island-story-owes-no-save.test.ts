/**
 * island-story-owes-no-save — the island's own default story never leaves a save owed where no layer can take it.
 *
 * The worker island opens its default story after its bridge stands (`island-story.ts`). A composition with no personal layer (a faceless
 * floor, a session surface, a pure local boot) once took that write as a hand: the save refused, raised an unrouted-save alert for a write
 * no person made, stayed owed, and the island's teardown named `$:/StoryList` unsaved, so the vessel read the teardown as faulted
 * (CI on 407f3251d: surface-mount-real-island's `acked: false`, two-phase-boot T5 at the faceless herm floor).
 *
 * Driven over the REAL wiki and the REAL outbound bridge.
 */
import { describe, test, expect, beforeAll } from "vitest";
import { bootTestWiki, wikiSkip, skipNote } from "./test-wiki.js";
import { IslandAdaptor, unroutedSaveAlertTitle } from "../src/island-adaptor.js";
import { asIslandStore } from "./island-store-double.js";
import { bridgeWikiToAdaptor } from "../src/outbound-bridge.js";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { openIslandStory, HISTORY_LIST_TITLE } from "../src/island-story.js";
import { STORY_LIST_TITLE } from "../src/default-story.js";
import type { TW5Engine } from "../src/tw5-vm.js";
import type { ChangeOrigin, LarTiddlerRecord, LarWriteOptions } from "@lararium/mesh";

const POINTER_PERSONAL = "lar:///ha.ka.ba/lararium/config/current-wiki-personal";
const POINTER_TEMP     = "lar:///ha.ka.ba/lararium/config/current-wiki-temp";
const PERSONAL         = "lar:///ha.ka.ba/wikis/test/personal";

class RecordingStore extends MemoryTiddlerStore {
  readonly puts: Array<{ title: string; bag: string | undefined }> = [];
  override async put(record: LarTiddlerRecord, origin: ChangeOrigin, options?: LarWriteOptions): Promise<void> {
    this.puts.push({ title: record.tiddler.title, bag: options?.bag });
    return super.put(record, origin, options);
  }
}
interface Wiki { addTiddler(t: unknown): void; getTiddler(t: string): { fields: Record<string, unknown> } | undefined }

async function standIsland(pointers: Record<string, string> = {}) {
  const engine: TW5Engine = await bootTestWiki();
  const wiki = engine.$tw.wiki as never as Wiki;
  const Tiddler = (engine.$tw as never as { Tiddler: new (f: Record<string, unknown>) => unknown }).Tiddler;
  for (const [title, text] of Object.entries(pointers)) wiki.addTiddler(new Tiddler({ title, text }));
  const store = new RecordingStore();
  const adaptor = new IslandAdaptor(engine, asIslandStore(store), "island-story");
  adaptor.start();
  bridgeWikiToAdaptor(engine, adaptor);
  await adaptor.armSeedCheckpoint();
  const settle = async (): Promise<void> => { await adaptor.awaitWikiDispatch(); await adaptor.handsRested().catch(() => {}); };
  return { engine, wiki, store, adaptor, settle };
}

describe.skipIf(wikiSkip)(`the island's default story at a composition with no layer for it${skipNote}`, () => {
  let island: Awaited<ReturnType<typeof standIsland>>;
  beforeAll(async () => { island = await standIsland(); }, 120_000);

  test("the probe raises nothing: no alert, and the story reads as no layer's", () => {
    expect(island.adaptor.routesSave(STORY_LIST_TITLE)).toBe(false);
    expect(island.wiki.getTiddler(unroutedSaveAlertTitle(POINTER_PERSONAL)), "a probe raised a refusal").toBeUndefined();
  });

  test("the story opens in the engine, reaches no store, raises no alert, and the teardown names nothing unsaved", async () => {
    const opened = openIslandStory(island.engine, island.adaptor);
    expect(opened).not.toBeNull();
    await island.settle();
    expect(island.wiki.getTiddler(STORY_LIST_TITLE)?.fields["list"], "the engine shows no story").toEqual(opened);
    expect(island.store.puts.filter((p) => p.title === STORY_LIST_TITLE || p.title === HISTORY_LIST_TITLE)).toEqual([]);
    expect(island.wiki.getTiddler(unroutedSaveAlertTitle(POINTER_PERSONAL)), "the house's own story raised an unrouted-save alert").toBeUndefined();
    expect(island.wiki.getTiddler(unroutedSaveAlertTitle(POINTER_TEMP)), "the history entry raised an unrouted-save alert").toBeUndefined();
    expect(await island.adaptor.stop()).toEqual([]);
  });
});

describe.skipIf(wikiSkip)(`CONTROL: the island's default story at a composition with a personal layer${skipNote}`, () => {
  test("the story saves to the personal layer through the bridge", async () => {
    const island = await standIsland({ [POINTER_PERSONAL]: PERSONAL });
    expect(island.adaptor.routesSave(STORY_LIST_TITLE)).toBe(true);
    openIslandStory(island.engine, island.adaptor);
    await island.settle();
    expect(island.store.puts.find((p) => p.title === STORY_LIST_TITLE)?.bag).toBe(PERSONAL);
    expect(await island.adaptor.stop()).toEqual([]);
  }, 120_000);

  test("CONTROL: the bare opener at a composition with no layer leaves the story owed — the fault the island's door cures", async () => {
    const island = await standIsland();
    const { openDefaultStory } = await import("../src/default-story.js");
    openDefaultStory(island.engine.$tw as never, { keepLanded: true });
    await island.settle();
    expect(await island.adaptor.stop()).toContain(STORY_LIST_TITLE);
  }, 120_000);
});
