import { describe, expect, test } from "vitest";
import { CompositeStore } from "@lararium/mesh/composite-store";
import { DAEMON_BAG_ID } from "@lararium/mesh/lar-uris";
import { wikiSlotUri } from "@lararium/mesh/wiki-recipe";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import * as house from "../src/index.js";
import { HOME_WIKI_TITLE, homeWikiFilter, readHomeWikiSlug, selectHomeWikiSlug } from "../src/home-wiki.js";

// RED FIRST (written unrun, pin migration step 1): the boot pointer burns; a lit face's home wiki reads as a PREFERENCE RECORD
// that face writes in its own daemon wiki's working layer, read at light. A record in, a slug or the floor out.
describe("a face's home preference", () => {
  test("a filter-shaped record names the home wiki; blank or absent reads as the floor", () => {
    expect(readHomeWikiSlug({ tiddler: { title: HOME_WIKI_TITLE, text: "[[probe-book]]" } })).toBe("probe-book");
    expect(readHomeWikiSlug({ tiddler: { title: HOME_WIKI_TITLE, text: homeWikiFilter("ember-hall") } })).toBe("ember-hall");
    expect(readHomeWikiSlug({ tiddler: { title: HOME_WIKI_TITLE, text: "  " } })).toBeNull();
    expect(readHomeWikiSlug({ tiddler: { title: HOME_WIKI_TITLE } })).toBeNull();
    expect(readHomeWikiSlug(null)).toBeNull();
  });

  test("the lit face's record selects its wiki at light; no record stands on the boot's own floor ask", () => {
    expect(selectHomeWikiSlug("lares", { tiddler: { title: HOME_WIKI_TITLE, text: "[[probe-book]]" } })).toEqual({ slug: "probe-book", source: "home-preference" });
    expect(selectHomeWikiSlug("lares", null)).toEqual({ slug: "lares", source: "boot-arg" });
  });

  test("a record in the daemon wiki's working layer answers through the composite, and no active-wiki marker reads", async () => {
    const composite = new CompositeStore();
    composite.addLayer({ bagId: DAEMON_BAG_ID, store: new MemoryTiddlerStore(DAEMON_BAG_ID), writable: true });
    const working = wikiSlotUri("daemon", "working");
    composite.addLayer({ bagId: working, store: new MemoryTiddlerStore(working), writable: true, defaultWritable: true });
    await composite.put({ tiddler: { title: HOME_WIKI_TITLE, text: homeWikiFilter("probe-book") } }, { kind: "lares-verb", requestId: "home" }, { bag: working });
    expect(readHomeWikiSlug(await composite.get(HOME_WIKI_TITLE))).toBe("probe-book");
    // The boot pointer's old spellings stand burned whole (no back-compat).
    expect(Object.keys(house)).not.toEqual(expect.arrayContaining(["ACTIVE_WIKI_URI", "buildActiveWikiRecord", "readActiveWikiSlug", "selectActiveWikiSlug", "makeOpenWikiReactor"]));
  });
});

