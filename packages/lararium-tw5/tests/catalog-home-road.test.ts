/**
 * catalog-home-road — a private-synced home keeps one road for its own readers.
 *
 * The persona plane rests as a private-synced home (its catalog row carries `kind = private-synced`), so the catalog's
 * `find`/`storeOf` pass it by and no verb lookup or library mount reaches it. Its own readers and writers, the face-join
 * grant and the PersonaGroup ring, lost their road with it: the grant threw "the face's PersonaGroup plane is unresolved"
 * and the ring read no records (e2e meme-two-vessel-bag ⑨, persona-ring-cross-operator-admit). `homeOf`/`homeStoreOf`
 * resolve the home by the url its row names.
 */
import { Repo } from "./wiki-shore-rig.js";
import { describe, expect, test } from "vitest";
import { emptyLarDoc, storedLarRecord, type LarDoc } from "@lararium/mesh";
import { makeCatalogAccessorOver } from "../src/catalog-accessor.js";

describe("the private-synced home's road", () => {
  test("RED: storeOf passes the home by, and homeStoreOf reaches it by its row's url", async () => {
    const repo = new Repo({ network: [] });
    const plane = repo.create<LarDoc>(emptyLarDoc());
    plane.change((d) => { d.tiddlers["grant/x"] = storedLarRecord("grant/x", { text: "{}" }, "test"); });
    const catalog = repo.create<LarDoc>(emptyLarDoc());
    const bag = "lar:///ha.ka.ba/bags/persona-test";
    catalog.change((d) => { d.tiddlers[bag] = storedLarRecord(bag, { text: plane.url, kind: "private-synced" }, "test"); });
    const accessor = makeCatalogAccessorOver(repo, catalog);
    expect(await accessor.storeOf(bag), "a verb's store road reached the private home").toBeNull();
    expect(accessor.homeStoreOf, "no home road stands").toBeTypeOf("function");
    const home = await accessor.homeStoreOf!(bag);
    expect(await home?.listVisible()).toContain("grant/x");
    expect((await accessor.homeOf!(bag))?.url).toBe(plane.url);
    await repo.shutdown();
  });
});
