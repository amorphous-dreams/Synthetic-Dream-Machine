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
  storedLarRecord, AutomergeDocStore, type LarDoc, type Verb,
} from "@lararium/mesh";
import { makeActionReactorFor } from "../src/action-handler.js";
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
 * THE VESSEL TIER (cap-tier.mem, vessel): a disk-sourced holding is plaintext canon from git, so the seed's CREATE stamps its
 * row `cap-tier = vessel` and the row rests on the floor half. A seed run as h1 and then as h2 converges on ONE document:
 * each face's own catalog stays sealed to the others, and the floor names the canon for all of them.
 *
 *   V1 — CREATE tier vessel as h1, then as h2: one document id; h2's answer reads alreadyStood; both faces (and h0) read it
 *   V2 — a row resting on a face's half (a face-sealed document) never takes the stamp: it stays on that face, named
 *   V3 — a re-seed over a floor row lacking the stamp restamps it in place; a second re-seed changes nothing
 *   V4 — the action parse refuses any other tier on CREATE
 */
describe("the vessel tier: one canon document across faces", () => {
  const secretOf = (n: number) => new Uint8Array(32).fill(0x10 + n);
  async function threeFaces() {
    const repo = new Repo({ network: [] });
    const floor = repo.create<LarDoc>(emptyLarDoc());
    const faces = await Promise.all([0, 1, 2].map((n) => openFaceCatalog(repo, faceCatalogDocUrl(secretOf(n)), secretOf(n))));
    const createAs = (n: number) => makeActionReactorFor("CREATE", {
      composite: new CompositeStore(),
      reach: { repo, catalogUrl: floor.url, faceCatalogUrl: faces[n]!.url, oracleUrl: null },
    });
    return { repo, floor, faces, createAs };
  }

  test("V1 — seed as h1 then as h2 yields ONE document for sdm, elyncia and elyncia-referee; every face reads it", async () => {
    const { repo, floor, faces, createAs } = await threeFaces();
    for (const slug of ["sdm", "elyncia", "elyncia-referee"]) {
      const bag = `lar:///ha.ka.ba/bags/${slug}`;
      const first = await createAs(1)({ bag, tier: "vessel" }, ctx());
      expect(typeof first.docUrl).toBe("string");
      expect(first.tier).toBe("vessel");
      const second = await createAs(2)({ bag, tier: "vessel" }, ctx());
      expect(second.alreadyStood).toBe(true);
      expect(second.docUrl).toBe(first.docUrl);
      // The row rests on the floor, stamped; no face's own catalog names it.
      const row = ownEntry(floor.doc()?.tiddlers, bag);
      expect(tiddlerText(row)).toBe(first.docUrl);
      for (const f of faces) expect(ownEntry(f.doc()?.tiddlers, bag)).toBeUndefined();
      for (const f of faces) expect(await makeCatalogAccessor(repo, floor.url, f.url).urlOf(bag)).toBe(first.docUrl);
      expect(await makeCatalogAccessor(repo, floor.url, null).urlOf(bag)).toBe(first.docUrl);
    }
    await repo.shutdown();
  });

  test("CONTROL — with no tier, h1 and h2 each mint under their own sealed half (the fork the vessel tier cures)", async () => {
    const { repo, createAs } = await threeFaces();
    const bag = "lar:///ha.ka.ba/bags/private-ledger";
    const a = await createAs(1)({ bag }, ctx());
    const b = await createAs(2)({ bag }, ctx());
    expect(b.alreadyStood).toBeUndefined();
    expect(b.docUrl).not.toBe(a.docUrl);
    await repo.shutdown();
  });

  test("V2 — a face-sealed row never takes the vessel stamp: it stays on its face, and the answer names why", async () => {
    const { repo, floor, faces, createAs } = await threeFaces();
    const bag = "lar:///ha.ka.ba/bags/h0-private";
    const minted = await createAs(0)({ bag }, ctx());
    expect(tiddlerText(ownEntry(faces[0]!.doc()?.tiddlers, bag))).toBe(minted.docUrl);
    const again = await createAs(0)({ bag, tier: "vessel" }, ctx());
    expect(again.alreadyStood).toBe(true);
    expect(String(again.vesselRefused)).toMatch(/^vessel-face-sealed:/);
    expect(again.tier).toBeUndefined();
    expect(ownEntry(floor.doc()?.tiddlers, bag)).toBeUndefined();
    expect(tiddlerText(ownEntry(faces[0]!.doc()?.tiddlers, bag))).toBe(minted.docUrl);
    await repo.shutdown();
  });

  test("V3 — a re-seed restamps a floor row lacking the stamp, once", async () => {
    const { repo, floor, createAs } = await threeFaces();
    const bag = "lar:///ha.ka.ba/bags/crossroads-like";
    const plane = repo.create<LarDoc>(emptyLarDoc());
    floor.change((d) => { d.tiddlers[bag] = storedLarRecord(bag, { text: plane.url, kind: "oracle", "cap-tier": "public" }, "test"); });
    const out = await createAs(1)({ bag, tier: "vessel" }, ctx());
    expect(out.restamped).toBe(true);
    const row = ownEntry(floor.doc()?.tiddlers, bag) as { tiddler?: Record<string, unknown> } | undefined;
    expect(tiddlerText(row as never)).toBe(plane.url);
    expect(JSON.stringify(row)).toContain("vessel");
    const twice = await createAs(2)({ bag, tier: "vessel" }, ctx());
    expect(twice.restamped).toBeUndefined();
    expect(twice.tier).toBe("vessel");
    await repo.shutdown();
  });

  test("V4 — CREATE takes the vessel tier alone, on the catalog plane", async () => {
    const { repo, createAs } = await threeFaces();
    await expect(createAs(1)({ bag: "lar:///ha.ka.ba/bags/x", tier: "public" }, ctx())).rejects.toThrow();
    await expect(createAs(1)({ bag: "lar:///ha.ka.ba/bags/y", tier: "vessel", plane: "oracle" }, ctx())).rejects.toThrow();
    await repo.shutdown();
  });
});
