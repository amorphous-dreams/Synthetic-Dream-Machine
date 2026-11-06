/**
 * catalog-view — the catalog splits by face (sealed-store#/owed, U1): a floor catalog naming public rows alone,
 * readable at the floor (F), and a per-face catalog naming that face's own rows, at the face's derived address (D).
 *
 *   V1 — two faces over one floor: face A's private bag lands in A's catalog alone; face B's view lists none of A's bags,
 *        and the floor names none of them either
 *   V2 — a raw read of A's catalog under B refuses by name: B's secret derives another address (`face-catalog-foreign`)
 *   V3 — one change that rewrites a canon row and a wiki row (bag-compact's and rotate-recipe's shape) lands each row on
 *        its own half, and the view reads both back merged
 *   V4 — the lift: the rows a floor wrote before the face stood move into the face's catalog and leave the floor, which
 *        then names public rows alone; the lift runs twice with one effect
 *   CONTROL — a view with no face lit (the anon floor, a herm) reads and writes the floor as it always did
 *   NONSENSE — every face row class routes D: an address nothing classes F never lands on the floor once a face stands
 */
import { describe, expect, test } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { emptyLarDoc, tiddlerText, type LarDoc } from "../src/base-doc.js";
import { storedLarRecord } from "../src/stored-record.js";
import { ownEntry } from "../src/stored-value.js";
import { bagUri, CATALOG_DOC_URI, CROSSROADS_DOC_URI, ORACLE_DOC_URI, catalogCorpusEntryUri, recipeUri } from "../src/lar-uris.js";
import { personaScopedBagIds } from "../src/persona-scope.js";
import { wikiSlotUri, wikiWorkingFloorKey } from "../src/wiki-recipe.js";
import { catalogNamedBags } from "../src/register-bags.js";
import {
  catalogRowHalf, faceCatalogDocUrl, openFaceCatalog, FaceCatalogRefusal, makeCatalogView, liftFaceCatalogRows,
} from "../src/catalog-view.js";

const secretA = new Uint8Array(32).fill(0xa1);
const secretB = new Uint8Array(32).fill(0xb2);
const row = (title: string, text: string) => storedLarRecord(title, { text, kind: "oracle" }, "test");
const titlesOf = (doc: LarDoc | undefined): string[] => Object.keys(doc?.tiddlers ?? {}).sort();

function stand() {
  const repo = new Repo({ network: [] });
  const floor = repo.create<LarDoc>(emptyLarDoc());
  const faceA = openFaceCatalog(repo, faceCatalogDocUrl(secretA), secretA);
  const faceB = openFaceCatalog(repo, faceCatalogDocUrl(secretB), secretB);
  return { repo, floor, faceA, faceB };
}

describe("the catalog splits by face (U1)", () => {
  test("V1 — face B's view lists none of face A's bags, and the floor names none of them", async () => {
    const { floor, faceA, faceB } = stand();
    const viewA = makeCatalogView(floor, await faceA);
    const viewB = makeCatalogView(floor, await faceB);
    const privateBag = bagUri("ledger-a");
    viewA.change((doc) => { doc.tiddlers[privateBag] = row(privateBag, "automerge:ledgerA"); });
    // Assert the setup took: A's own view reads its bag.
    expect(catalogNamedBags(viewA.doc())).toContain(privateBag);
    expect(catalogNamedBags(viewB.doc())).not.toContain(privateBag);
    expect(titlesOf(floor.doc())).not.toContain(privateBag);
    expect(titlesOf((await faceA).doc())).toContain(privateBag);
  });

  test("V2 — a raw read of face A's catalog under face B refuses by name", async () => {
    const { repo } = stand();
    const urlA = faceCatalogDocUrl(secretA);
    expect(faceCatalogDocUrl(secretB)).not.toBe(urlA);
    const refused = await openFaceCatalog(repo, urlA, secretB).then(() => null, (e: unknown) => e);
    expect(refused).toBeInstanceOf(FaceCatalogRefusal);
    expect((refused as FaceCatalogRefusal).reason).toBe("face-catalog-foreign");
    // CONTROL: A's own secret opens A's catalog.
    await expect(openFaceCatalog(repo, urlA, secretA)).resolves.toBeTruthy();
  });

  test("V3 — one change over a canon row and a wiki row lands each on its own half, read back merged", async () => {
    const { floor, faceA } = stand();
    const face = await faceA;
    const view = makeCatalogView(floor, face);
    const canon = catalogCorpusEntryUri("engine");
    const wiki = bagUri("notes");
    const recipe = recipeUri("catalog", "notes");
    view.change((doc) => {
      doc.tiddlers[canon] = row(canon, "automerge:corpus");
      doc.tiddlers[wiki] = row(wiki, "automerge:notes");
      doc.tiddlers[recipe] = row(recipe, "");
    });
    expect(titlesOf(floor.doc())).toEqual([canon]);
    expect(titlesOf(face.doc())).toEqual([wiki, recipe].sort());
    expect(tiddlerText(ownEntry(view.doc()?.tiddlers, canon))).toBe("automerge:corpus");
    expect(tiddlerText(ownEntry(view.doc()?.tiddlers, wiki))).toBe("automerge:notes");
    view.change((doc) => { delete doc.tiddlers[wiki]; });
    expect(titlesOf(face.doc())).toEqual([recipe]);
  });

  test("V4 — the lift moves the floor's face rows into the face's catalog; the floor then names public rows alone", async () => {
    const { floor, faceA } = stand();
    const priv = bagUri("diary");
    const plane = personaScopedBagIds("ab".repeat(32)).persona;
    const kahua = bagUri("kahua");
    const slot = wikiSlotUri("notes", "working");
    const workingFloor = wikiWorkingFloorKey("notes", { kind: "place", aid: "Eplace" } as never);
    // The floor stood alone first: every row it wrote rests there.
    floor.change((doc) => {
      for (const t of [ORACLE_DOC_URI, CROSSROADS_DOC_URI, CATALOG_DOC_URI, priv, plane, kahua, slot, workingFloor]) doc.tiddlers[t] = row(t, `automerge:${t.length}`);
    });
    const face = await faceA;
    const moved = liftFaceCatalogRows(floor, face);
    expect(moved.sort()).toEqual([priv, plane, kahua, slot].sort());
    expect(titlesOf(floor.doc())).toEqual([ORACLE_DOC_URI, CROSSROADS_DOC_URI, CATALOG_DOC_URI, workingFloor].sort());
    expect(catalogNamedBags(floor.doc()).every((b) => catalogRowHalf(b) === "floor")).toBe(true);
    expect(titlesOf(face.doc())).toEqual([priv, plane, kahua, slot].sort());
    // Twice, one effect.
    expect(liftFaceCatalogRows(floor, face)).toEqual([]);
    // A row the face already holds keeps the face's value; the floor's copy leaves.
    floor.change((doc) => { doc.tiddlers[priv] = row(priv, "automerge:stale"); });
    liftFaceCatalogRows(floor, face);
    expect(tiddlerText(ownEntry(face.doc()?.tiddlers, priv))).toBe(`automerge:${priv.length}`);
    expect(titlesOf(floor.doc())).not.toContain(priv);
  });

  test("CONTROL — no face lit: the view reads and writes the floor as it always did", async () => {
    const { floor } = stand();
    const view = makeCatalogView(floor, null);
    const priv = bagUri("anon-bag");
    view.change((doc) => { doc.tiddlers[priv] = row(priv, "automerge:anon"); });
    expect(titlesOf(floor.doc())).toEqual([priv]);
    expect(view.url).toBe(floor.url);
    expect(view.documentId).toBe(floor.documentId);
    expect(catalogNamedBags(view.doc())).toEqual([priv]);
  });

  test("NONSENSE — the classifier: floor rows name public, signed infrastructure alone; everything else routes D", () => {
    for (const t of [CATALOG_DOC_URI, ORACLE_DOC_URI, CROSSROADS_DOC_URI, catalogCorpusEntryUri("x"), bagUri("lares"), bagUri("lararium"),
      bagUri("daemon"), recipeUri("catalog", "daemon"), `${bagUri("realm")}/realm-id`, wikiWorkingFloorKey("w", { kind: "place", aid: "E" } as never)]) {
      expect([t, catalogRowHalf(t)]).toEqual([t, "floor"]);
    }
    for (const t of [bagUri("anything"), bagUri("kahua"), recipeUri("catalog", "notes"), wikiSlotUri("daemon", "working"), "lar:///nowhere/at/all", ""]) {
      expect([t, catalogRowHalf(t)]).toEqual([t, "face"]);
    }
  });
});
