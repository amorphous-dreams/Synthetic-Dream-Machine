/**
 * catalog-split-create — a register act lands its row on the half of the split catalog its class names
 * (sealed-store#/owed, U1), through the island's reach and through the vessel's own accessor.
 *
 *   C1 — CREATE under a reach that names the lit face's catalog lands the new bag's row in that face's catalog, never on
 *        the floor; the accessor reads it back through the view
 *   C2 — an accessor opened with no face named reads the face this process stands lit over that floor
 *        (`standLitFaceCatalog`), and the floor alone once the face stands down
 *   CONTROL — CREATE under a reach with no face catalog writes the floor, as an anon floor and a herm always did
 *
 * Written beside the cure; against the parent (5cb65c121) it fails to import the split's seams.
 */
import { describe, expect, test } from "vitest";
import { Repo } from "./wiki-shore-rig.js";
import {
  CompositeStore, emptyLarDoc, faceCatalogDocUrl, openFaceCatalog, standLitFaceCatalog, tiddlerText, ownEntry,
  type LarDoc, type Verb,
} from "@lararium/mesh";
import { makeActionReactorFor } from "../src/action-handler.js";
import { makeCatalogAccessor } from "../src/catalog-accessor.js";
import type { VerbContext } from "../src/verb-dispatcher.js";

const secret = new Uint8Array(32).fill(0x5c);
const ctx = (): VerbContext => ({
  daemon: new CompositeStore(),
  invocation: { action: "CREATE", args: {}, requestId: "req-split-1", requestedBy: "did:key:test" } as unknown as Verb,
  cap: async () => ({ ok: true }),
}) as VerbContext;

async function stand() {
  const repo = new Repo({ network: [] });
  const floor = repo.create<LarDoc>(emptyLarDoc());
  const face = await openFaceCatalog(repo, faceCatalogDocUrl(secret), secret);
  return { repo, floor, face };
}

describe("a register act lands its row on its half", () => {
  test("C1 — CREATE under a lit face's reach writes the face's catalog, never the floor", async () => {
    const { repo, floor, face } = await stand();
    const bag = "lar:///ha.ka.ba/bags/split-ledger";
    const reactor = makeActionReactorFor("CREATE", {
      composite: new CompositeStore(),
      reach: { repo, catalogUrl: floor.url, faceCatalogUrl: face.url, oracleUrl: null },
    });
    const out = await reactor({ bag }, ctx());
    expect(typeof out.docUrl).toBe("string");
    expect(tiddlerText(ownEntry(face.doc()?.tiddlers, bag))).toBe(out.docUrl);
    expect(ownEntry(floor.doc()?.tiddlers, bag)).toBeUndefined();
    expect(await makeCatalogAccessor(repo, floor.url, face.url).urlOf(bag)).toBe(out.docUrl);
    expect(await makeCatalogAccessor(repo, floor.url, null).urlOf(bag)).toBeNull();
  });

  test("C2 — an unnamed accessor reads the face this process stands lit, and the floor once it stands down", async () => {
    const { repo, floor, face } = await stand();
    const bag = "lar:///ha.ka.ba/bags/lit-only";
    face.change((d) => { (d.tiddlers as Record<string, unknown>)[bag] = { tiddler: { title: bag, text: "automerge:x" }, meta: {} }; });
    const accessor = makeCatalogAccessor(repo, floor.url);
    expect(await accessor.urlOf(bag)).toBeNull();
    const down = standLitFaceCatalog(floor.url, face.url);
    expect(await accessor.urlOf(bag)).toBe("automerge:x");
    down();
    expect(await accessor.urlOf(bag)).toBeNull();
  });

  test("CONTROL — CREATE with no face catalog writes the floor", async () => {
    const { repo, floor } = await stand();
    const bag = "lar:///ha.ka.ba/bags/anon-floor";
    const reactor = makeActionReactorFor("CREATE", { composite: new CompositeStore(), reach: { repo, catalogUrl: floor.url, oracleUrl: null } });
    const out = await reactor({ bag }, ctx());
    expect(tiddlerText(ownEntry(floor.doc()?.tiddlers, bag))).toBe(out.docUrl);
  });
});
