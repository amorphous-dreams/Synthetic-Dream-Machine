/**
 * daemon-surface-state-routes-temp — the daemon's own surface state (which panel shows, what the projection
 * button last projected) routes to the wiki's temp slot through the shipped bag-paths cascade, never to the
 * working layer, so a click on the switcher persists nothing and a second boot writes nothing.
 *
 * Driven over the REAL cascade the grammar plugin ships, with the slot pointers a recipe seeds.
 */
import { beforeAll, describe, expect, test } from "vitest";
import { wikiSlotUri } from "@lararium/mesh";
import { routeBag, type CascadeWiki } from "../src/bag-cascade.js";
import { LARES_SURFACE_STATE, PROJECT_STATE_TITLE } from "../src/daemon-ui-tiddlers.js";
import { bootTestWiki, skipNote, wikiSkip } from "./test-wiki.js";

const WORKING = wikiSlotUri("daemon", "working");
const TEMP = wikiSlotUri("daemon", "temp");

describe.skipIf(wikiSkip)(`the daemon's surface state routes to temp${skipNote}`, () => {
  let wiki: CascadeWiki;
  beforeAll(async () => {
    const engine = await bootTestWiki({ tiddlers: [
      { title: "lar:///ha.ka.ba/lararium/config/current-wiki-bag", text: WORKING },
      { title: "lar:///ha.ka.ba/lararium/config/current-wiki-temp", text: TEMP },
    ] });
    wiki = engine.$tw.wiki as never;
  }, 120_000);

  test("RED: the surface pointer and the projection state land in the temp slot; CONTROL: an ordinary title lands in working", () => {
    expect(routeBag(wiki, LARES_SURFACE_STATE)).toMatchObject({ kind: "slot", uri: TEMP });
    expect(routeBag(wiki, PROJECT_STATE_TITLE)).toMatchObject({ kind: "slot", uri: TEMP });
    expect(routeBag(wiki, "lar:///ha.ka.ba/bags/daemon/an-ordinary-record")).toMatchObject({ kind: "slot", uri: WORKING });
  });
});
