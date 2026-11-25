/**
 * stay-home — ONE predicate names the titles no door reads or writes, and every door reads it (re-read #444): the tiddler door's
 * gate and view, and the internal meme reads. A second spelling would drift the day one of them moved.
 */
import { describe, test, expect } from "vitest";
import { CompositeStore } from "@lararium/mesh/composite-store";
import { bagUri } from "@lararium/mesh/lar-uris";
import { staysHome } from "../src/stay-home.js";
import { makeMemeGetReactor, type MemeVerbOptions } from "../src/meme-verbs.js";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import type { VerbContext } from "../src/verb-dispatcher.js";

/** Titles either side of the line: three that stay home, two that leave. */
const TITLES = ["$:/temp/lares/alert/x", "$:/state/popup/y", "lar:///lararium.local.vm/verbs/r1", "Note 01", "lar:///ha.ka.ba/lares/api/pono/meme"];

describe("the one stay-home predicate", () => {
  test("RED: temp, state, the volatile VM plane, control and secret homes and cap/** stay home; a plain title and a lar: meme leave", () => {
    for (const title of ["$:/temp/lares/alert/x", "$:/state/popup/y", "lar:///lararium.local.vm/verbs/r1"]) expect(staysHome(title), title).toBe(true);
    for (const title of ["Note 01", "lar:///ha.ka.ba/lares/api/pono/meme"]) expect(staysHome(title), title).toBe(false);
  });

  test("the meme door refuses exactly what the predicate keeps home, by behaviour: a stay-home title refuses tiddler-withheld, a leaving one reads", async () => {
    const store = new Map<string, Record<string, unknown>>();
    const wiki = {
      allTitles: () => [...store.keys()],
      getTiddler: (t: string) => (store.has(t) ? { fields: store.get(t) } : undefined),
      getTiddlerText: (t: string, d = ""): string => (t === "lar:///ha.ka.ba/lararium/config/current-wiki-bag" ? bagUri("daemon") : d),
      addTiddler: (f: Record<string, unknown>) => { store.set(String(f["title"]), f); },
      deleteTiddler: (t: string) => { store.delete(t); },
    };
    const composite = new CompositeStore();
    composite.addLayer({ bagId: bagUri("daemon"), store: new MemoryTiddlerStore(bagUri("daemon")), writable: true });
    const get = makeMemeGetReactor({ composite, tw5: { $tw: { wiki } } } as unknown as MemeVerbOptions);
    const ctx = { daemon: {} as CompositeStore, invocation: { requestId: "r" }, cap: async () => ({ ok: true }) } as unknown as VerbContext;
    for (const title of TITLES) {
      const answered = await get({ recipe: "default", uri: title }, ctx).then(() => "read", (e: { reason?: string }) => e.reason ?? "threw");
      expect(answered, title).toBe(staysHome(title) ? "tiddler-withheld" : "read");
    }
  });
});
