/**
 * The declare act re-stamps the standing catalog row at once (sealed-store U1, public-only F).
 *
 * RED: a bag declared public stamps its row onto F; re-declared private through the declare path's verb, a reader of
 * F alone stops listing it with no re-registration between. private -> public MAY wait for the next registration
 * (it fails toward the face, never toward F); the reactor stamps it at once anyway and the test pins that it does.
 */
import { describe, test, expect } from "vitest";
import { createRequire } from "node:module";
import {
  makeCatalogView, openFaceCatalog, faceCatalogDocUrl, emptyLarDoc, bagUri, catalogNamedBags, storedLarRecord, type CapTier, type LarDoc, type Repo as RepoType,
} from "@lararium/mesh";

const Repo = createRequire(import.meta.resolve("@lararium/mesh"))("@automerge/automerge-repo").Repo as new (options: { network: [] }) => RepoType;
import { makeRestampBagTierReactor } from "../src/bag-tier-restamp.js";
import type { CatalogAccessor } from "../src/catalog-accessor.js";
import type { VerbContext } from "../src/verb-dispatcher.js";

async function stand() {
  const repo = new Repo({ network: [] });
  const secret = new Uint8Array(32).fill(0xa1);
  const floor = repo.create<LarDoc>(emptyLarDoc());
  const face = await openFaceCatalog(repo, faceCatalogDocUrl(secret), secret);
  const view = makeCatalogView(floor, face);
  const accessor = { handle: async () => view } as unknown as CatalogAccessor;
  return { floor, face, view, accessor };
}
const ctx = {} as VerbContext;
const row = (title: string, tier?: string) => storedLarRecord(title, { text: "automerge:x", kind: "oracle", ...(tier ? { "cap-tier": tier } : {}) }, "test");

describe("the declare act re-stamps the catalog row", () => {
  test("RED — public -> private leaves F at once, the F-only reader stops listing it", async () => {
    const { floor, face, view, accessor } = await stand();
    const book = bagUri("turning"), other = bagUri("other-public");
    view.change((d) => { d.tiddlers[book] = row(book, "public"); d.tiddlers[other] = row(other, "public"); });
    expect(catalogNamedBags(floor.doc())).toContain(book);
    const declared = new Map<string, CapTier>([[book, "private" as CapTier], [other, "public" as CapTier]]);
    const out = await makeRestampBagTierReactor({ catalog: accessor, bagTier: (u) => declared.get(u) ?? null })({ bagUrl: book }, ctx);
    expect(out).toMatchObject({ status: "restamped", tier: null });
    expect(catalogNamedBags(floor.doc())).not.toContain(book);
    expect(catalogNamedBags(face.doc())).toContain(book);
    // CONTROL: an unrelated row's half stays put.
    expect(catalogNamedBags(floor.doc())).toContain(other);
  });

  test("private -> public stamps at once too (it could wait for registration: it fails toward the face)", async () => {
    const { floor, view, accessor } = await stand();
    const book = bagUri("opening");
    view.change((d) => { d.tiddlers[book] = row(book, "private"); });
    expect(catalogNamedBags(floor.doc())).not.toContain(book);
    const out = await makeRestampBagTierReactor({ catalog: accessor, bagTier: () => "public" as CapTier })({ bagUrl: book }, ctx);
    expect(out).toMatchObject({ status: "restamped", tier: "public" });
    expect(catalogNamedBags(floor.doc())).toContain(book);
  });

  test("CONTROL — a bag with no row, and a row already true, change nothing", async () => {
    const { view, accessor } = await stand();
    const book = bagUri("steady");
    const reactor = makeRestampBagTierReactor({ catalog: accessor, bagTier: () => "public" as CapTier });
    expect(await reactor({ bagUrl: book }, ctx)).toMatchObject({ status: "no-row" });
    view.change((d) => { d.tiddlers[book] = row(book, "public"); });
    expect(await reactor({ bagUrl: book }, ctx)).toMatchObject({ status: "unchanged" });
  });
});
