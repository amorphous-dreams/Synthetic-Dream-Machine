/**
 * save-refusal — a save with no bag to land in refuses BY NAME, where the person reads it.
 *
 * The cascade routes a title through slot pointers (`config/current-wiki-bag` and its siblings). A wiki
 * whose pointers hold nothing gives every save a rule that chose to route and a slot with no name. The
 * adaptor then refuses out loud on TiddlyWiki's own alert rail (`$:/tags/Alert`, which the page template
 * renders): the alert names the pointer, the rule, and every title that stands in the page alone. The
 * wiki keeps the person's text exactly as written; nothing reaches the store.
 *
 * Driven over the REAL wiki and the REAL outbound bridge, so the refusal is read where a hand edit
 * would raise it.
 */

import { describe, test, expect, beforeAll } from "vitest";
import { bootTestWiki, wikiSkip, skipNote } from "./test-wiki.js";
import { IslandAdaptor, unroutedSaveAlertTitle, UnroutedSaveRefusal } from "../src/island-adaptor.js";
import { asIslandStore } from "./island-store-double.js";
import { bridgeWikiToAdaptor } from "../src/outbound-bridge.js";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import type { TW5Engine } from "../src/tw5-vm.js";
import type { ChangeOrigin, LarTiddlerRecord, LarWriteOptions } from "@lararium/mesh";

const POINTER_BAG   = "lar:///ha.ka.ba/lararium/config/current-wiki-bag";
const POINTER_DRAFT = "lar:///ha.ka.ba/lararium/config/current-wiki-draft";
const POINTER_TEMP  = "lar:///ha.ka.ba/lararium/config/current-wiki-temp";
const WORKING       = "lar:///ha.ka.ba/wikis/test/working";

class RecordingStore extends MemoryTiddlerStore {
  readonly puts: Array<{ title: string; bag: string | undefined }> = [];
  override async put(record: LarTiddlerRecord, origin: ChangeOrigin, options?: LarWriteOptions): Promise<void> {
    this.puts.push({ title: record.tiddler.title, bag: options?.bag });
    return super.put(record, origin, options);
  }
}

const settle = (): Promise<void> => new Promise((r) => setTimeout(r, IslandAdaptor.DEBOUNCE_MS + 100));

interface Wiki {
  addTiddler(t: unknown): void;
  deleteTiddler(t: string): void;
  getTiddler(t: string): { fields: Record<string, unknown> } | undefined;
  getTiddlerText(t: string, fallback?: string): string | undefined;
  filterTiddlers(filter: string): string[];
}

describe.skipIf(wikiSkip)(`a save with no bag to land in refuses by name${skipNote}`, () => {
  let engine: TW5Engine;
  let store: RecordingStore;
  let adaptor: IslandAdaptor;
  let wiki: Wiki;
  let Tiddler: new (f: Record<string, unknown>) => unknown;

  beforeAll(async () => {
    engine  = await bootTestWiki();
    wiki    = engine.$tw.wiki as never;
    Tiddler = (engine.$tw as never as { Tiddler: typeof Tiddler }).Tiddler;
    store   = new RecordingStore();
    adaptor = new IslandAdaptor(engine, asIslandStore(store), "save-refusal");
    adaptor.start();
    bridgeWikiToAdaptor(engine, adaptor);
    // No slot pointer stands in this wiki: the shipped cascade routes through references that hold nothing.
  }, 120_000);

  const AKI = "lar:///t/refusal/lady-aki";

  test("a hand edit over an empty slot pointer raises a named alert, and the wiki keeps the text", async () => {
    wiki.addTiddler(new Tiddler({ title: AKI, text: "her sheet", "sdm-character-level": "3" }));
    await settle();

    expect(store.puts.filter((p) => p.title === AKI), "the edit reached a store with no bag named").toEqual([]);

    const alert = wiki.getTiddler(unroutedSaveAlertTitle(POINTER_BAG));
    expect(alert, "the save vanished in silence: no alert names the pointer that holds nothing").toBeDefined();
    expect(wiki.filterTiddlers("[all[tiddlers]tag[$:/tags/Alert]]")).toContain(unroutedSaveAlertTitle(POINTER_BAG));
    expect(alert!.fields["alert-kind"]).toBe("unrouted-save");
    expect(alert!.fields["reference"]).toBe(POINTER_BAG);
    expect(String(alert!.fields["rule"])).toBe(`[prefix[lar:]then{${POINTER_BAG}}]`);
    expect(String(alert!.fields["text"])).toContain(AKI);
    expect(String(alert!.fields["text"])).toContain(POINTER_BAG);

    // The person's text stands in the wiki exactly as written.
    expect(wiki.getTiddler(AKI)?.fields["sdm-character-level"]).toBe("3");
    expect(wiki.getTiddlerText(AKI)).toBe("her sheet");
  });

  test("a draft over an empty draft pointer refuses under its own pointer, and one alert gathers every title", async () => {
    const DRAFT = "Draft of 'refusal'";
    wiki.addTiddler(new Tiddler({ title: DRAFT, "draft.of": AKI, "draft.title": AKI, text: "typing" }));
    wiki.addTiddler(new Tiddler({ title: "lar:///t/refusal/second", text: "also unsaved" }));
    await settle();
    const draftAlert = wiki.getTiddler(unroutedSaveAlertTitle(POINTER_DRAFT));
    expect(draftAlert, "the draft's refusal names no pointer").toBeDefined();
    expect(String(draftAlert!.fields["text"])).toContain(DRAFT);
    const bagAlert = String(wiki.getTiddler(unroutedSaveAlertTitle(POINTER_BAG))!.fields["text"]);
    expect(bagAlert).toContain(AKI);
    expect(bagAlert).toContain("lar:///t/refusal/second");
    expect(wiki.getTiddlerText(DRAFT), "the draft's text left the editor").toBe("typing");
  });

  test("the refusal answers its caller: `saveTiddler` rejects with the named refusal", async () => {
    const tiddler = new Tiddler({ title: "lar:///t/refusal/direct", text: "x" });
    await expect(adaptor.saveTiddler(tiddler)).rejects.toBeInstanceOf(UnroutedSaveRefusal);
    await expect(adaptor.saveTiddler(tiddler)).rejects.toThrow(POINTER_BAG);
  });

  test("the alert rail's own tiddlers raise no alert about themselves", async () => {
    await settle();
    // The alerts above live under `$:/temp/`, whose pointer holds nothing too; a refusal of a refusal would
    // recurse without end. No alert lists an alert among the titles it refused.
    const alerts = wiki.filterTiddlers("[all[tiddlers]tag[$:/tags/Alert]field:alert-kind[unrouted-save]]");
    expect(alerts).toContain(unroutedSaveAlertTitle(POINTER_BAG));
    expect(alerts).toContain(unroutedSaveAlertTitle(POINTER_DRAFT));
    for (const alert of alerts) {
      expect(wiki.getTiddlerText(alert), `${alert} lists an alert as a refused title`).not.toContain(unroutedSaveAlertTitle(""));
    }
    // CONTROL — a person's own volatile title under the same empty pointer does raise one.
    wiki.addTiddler(new Tiddler({ title: "$:/temp/refusal/scratch", text: "volatile" }));
    await settle();
    expect(wiki.getTiddlerText(unroutedSaveAlertTitle(POINTER_TEMP))).toContain("$:/temp/refusal/scratch");
  });

  test("CONTROL: a literal empty operand still withholds in quiet — a decision, never a refusal", async () => {
    const CASCADE = "lar:///ha.ka.ba/lararium/config/bag-paths";
    const shipped = wiki.getTiddlerText(CASCADE) ?? "";
    wiki.addTiddler(new Tiddler({ title: CASCADE, text: `[match[lar:///t/refusal/withheld]then[]]\n${shipped}` }));
    await settle();
    store.puts.length = 0;
    const tiddler = new Tiddler({ title: "lar:///t/refusal/withheld", text: "kept out by name" });
    await expect(adaptor.saveTiddler(tiddler)).resolves.toBeUndefined();
    await settle();
    expect(store.puts.filter((p) => p.title === "lar:///t/refusal/withheld")).toEqual([]);
    expect(wiki.getTiddlerText(unroutedSaveAlertTitle(POINTER_BAG))).not.toContain("lar:///t/refusal/withheld");
  });

  test("CONTROL: the pointer seeded, the same edit lands in the named bag and raises nothing", async () => {
    wiki.addTiddler(new Tiddler({ title: POINTER_BAG, text: WORKING }));
    await settle();
    wiki.deleteTiddler(unroutedSaveAlertTitle(POINTER_BAG));
    store.puts.length = 0;
    wiki.addTiddler(new Tiddler({ title: "lar:///t/refusal/routed", text: "lands" }));
    await settle();
    expect(store.puts.find((p) => p.title === "lar:///t/refusal/routed")?.bag).toBe(WORKING);
    expect(wiki.getTiddler(unroutedSaveAlertTitle(POINTER_BAG)), "a routed save raised a refusal").toBeUndefined();
  });
});
