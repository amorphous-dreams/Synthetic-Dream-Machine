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
  storedLarRecord, AutomergeDocStore, seatHouseCanon, type LarDoc, type Verb,
} from "@lararium/mesh";
import { makeActionReactorFor, HOUSE_CANON_READS_FLOOR } from "../src/action-handler.js";
import { kahuHand, strangerHand } from "../../lararium-mesh/tests/kahu-reach-fixture.js";
import { makeCatalogAccessor, libraryDocUrl } from "../src/catalog-accessor.js";
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

 test("private-synced placement keeps the bag off verb access and island mounts while direct readers retain it", async () => {
  const { repo, floor } = await stand();
  const plane = repo.create<LarDoc>(emptyLarDoc());
  const bag = "lar:///ha.ka.ba/bags/private-group";
  const title = "lar:///acts/example";
  plane.change((d) => { d.tiddlers[title] = storedLarRecord(title, { text: "proof act" }, "test"); });
  floor.change((d) => { d.tiddlers[bag] = storedLarRecord(bag, { text: plane.url, kind: "private-synced" }, "test"); });
  const catalog = makeCatalogAccessor(repo, floor.url, null);
  expect(await catalog.find(bag)).toBeNull();
  expect(await catalog.storeOf(bag)).toBeNull();
  expect(await libraryDocUrl(catalog, bag)).toBeNull();
  expect(await catalog.urlOf(bag)).toBe(plane.url);
  expect((await new AutomergeDocStore(plane, bag).get(title))?.tiddler.text).toBe("proof act");
  await repo.shutdown();
});

/**
 * HOUSE CANON TAKES NO CATALOG ROW (cap-tier.mem, house canon): every disk-sourced holding but the public board rests in the
 * Kahu realm at contract. A seed run as h0 (the Kahu steward), then h1, then h2 mints nothing: the steward's CREATE names the
 * realm's ONE document, any other face's CREATE answers that it reads the floor, and no half of the catalog names canon, so
 * no face can fork it.
 *
 *   V1 — seed as h0, h1, h2: zero catalog rows; one document per house canon bag (the realm's); h1 and h2 read the floor
 *   V2 — a non-steward CREATE answers resolvedElsewhere with readsFloor, never a kahu-reach red; a stranger's own write refuses
 *   V3 — a steward whose realm registers no document refuses by name (house-canon-unlanded) and mints no row
 *   V4 — CREATE carries no tier: a `tier` arg stamps nothing, and the board (crossroads) stays an ordinary catalog bag
 */
describe("house canon: one realm document, no catalog row", () => {
  const secretOf = (n: number) => new Uint8Array(32).fill(0x10 + n);
  const HOUSE = ["sdm", "elyncia", "elyncia-referee"];
  async function threeFaces(realm: Record<string, string> = {}) {
    const repo = new Repo({ network: [] });
    const floor = repo.create<LarDoc>(emptyLarDoc());
    const faces = await Promise.all([0, 1, 2].map((n) => openFaceCatalog(repo, faceCatalogDocUrl(secretOf(n)), secretOf(n))));
    const steward = await kahuHand(), stranger = await strangerHand("joined-without-admission");
    const createAs = (n: number) => makeActionReactorFor("CREATE", {
      composite: new CompositeStore(),
      kahuReach: n === 0 ? steward : stranger,
      reach: { repo, catalogUrl: floor.url, faceCatalogUrl: faces[n]!.url, oracleUrl: null, systemCanonUrl: async (bag: string) => realm[bag] ?? null },
    });
    const rowsNaming = (bag: string) => [floor, ...faces].filter((h) => ownEntry(h.doc()?.tiddlers, bag) !== undefined).length;
    return { repo, floor, faces, createAs, rowsNaming };
  }
  const seated = <T>(run: () => Promise<T>): Promise<T> => { seatHouseCanon(["crossroads", ...HOUSE]); return run().finally(() => seatHouseCanon([])); };

  test("V1 — seed as h0, h1, h2: zero catalog rows, one document per house canon bag", () => seated(async () => {
    const realm: Record<string, string> = {};
    const { repo, createAs, rowsNaming } = await threeFaces(realm);
    // The realm's ONE document per bag (the founding's mint, `landKahuRealm`), named to the steward by the realm's row.
    for (const slug of HOUSE) realm[`lar:///ha.ka.ba/bags/${slug}`] = String(repo.create<LarDoc>(emptyLarDoc()).url);
    for (const slug of HOUSE) {
      const bag = `lar:///ha.ka.ba/bags/${slug}`;
      for (let run = 0; run < 2; run++) {
        expect(await createAs(0)({ bag }, ctx())).toMatchObject({ alreadyStood: true, resolvedElsewhere: true, docUrl: realm[bag], count: 0 });
      }
      for (const n of [1, 2]) {
        expect(await createAs(n)({ bag }, ctx())).toMatchObject({ alreadyStood: true, resolvedElsewhere: true, readsFloor: true });
      }
      expect(rowsNaming(bag)).toBe(0);
    }
    await repo.shutdown();
  }));

  test("V2 — a non-steward CREATE reads the floor, never a kahu-reach red; its write into canon refuses", () => seated(async () => {
    const { repo, floor, createAs, rowsNaming } = await threeFaces();
    const bag = "lar:///ha.ka.ba/bags/sdm";
    const out = await createAs(1)({ bag }, ctx());
    expect(out).toMatchObject({ resolvedElsewhere: true, readsFloor: true, houseCanon: HOUSE_CANON_READS_FLOOR });
    expect(out.docUrl).toBeUndefined();
    expect(rowsNaming(bag)).toBe(0);
    const clear = makeActionReactorFor("CLEAR", { composite: new CompositeStore(), kahuReach: await strangerHand("removed"), reach: { repo, catalogUrl: floor.url, oracleUrl: null } });
    await expect(clear({ bag }, ctx())).rejects.toMatchObject({ reason: "kahu-reach" });
    await repo.shutdown();
  }));

  test("V3 — a steward whose realm registers nothing refuses by name and mints no row", () => seated(async () => {
    const { repo, createAs, rowsNaming } = await threeFaces();
    const bag = "lar:///ha.ka.ba/bags/elyncia";
    await expect(createAs(0)({ bag }, ctx())).rejects.toMatchObject({ reason: "house-canon-unlanded" });
    expect(rowsNaming(bag)).toBe(0);
    await repo.shutdown();
  }));

  test("V4 — CREATE carries no tier; the board stays an ordinary catalog bag", () => seated(async () => {
    const { repo, floor, faces, createAs } = await threeFaces();
    const bag = "lar:///ha.ka.ba/bags/private-ledger";
    const out = await createAs(1)({ bag, tier: "vessel" }, ctx());
    const row = ownEntry(faces[1]!.doc()?.tiddlers, bag);
    expect(tiddlerText(row)).toBe(out.docUrl);
    expect(JSON.stringify(row)).not.toContain("cap-tier");
    expect(ownEntry(floor.doc()?.tiddlers, bag)).toBeUndefined();
    const board = "lar:///ha.ka.ba/bags/crossroads";
    const minted = await createAs(1)({ bag: board }, ctx());
    expect(typeof minted.docUrl).toBe("string");
    expect(minted.readsFloor).toBeUndefined();
    await repo.shutdown();
  }));

  test("CONTROL — an ordinary bag still forks per face (each face's half stays sealed to the others)", async () => {
    const { repo, createAs } = await threeFaces();
    const bag = "lar:///ha.ka.ba/bags/private-ledger";
    const a = await createAs(1)({ bag }, ctx());
    const b = await createAs(2)({ bag }, ctx());
    expect(b.alreadyStood).toBeUndefined();
    expect(b.docUrl).not.toBe(a.docUrl);
    await repo.shutdown();
  });
});
