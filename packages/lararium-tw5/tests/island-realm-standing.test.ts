/**
 * island-realm-standing — THE DAEMON ISLAND reads a realm's standing verdict off the vessel's own plane.
 *
 * I1 a verb that names realm A reaches A's registered book / control: realm B's verdict answers B alone.
 * I2 a verdict with no doc pin beside it answers nothing / control: the pin restores the reach.
 * I3 the write side reads THAT realm's steward pin / control: realm A's pin opens nothing in realm B.
 * I5 a named realm never falls through to the vessel's own bag / control: no realm named, the own bag answers.
 * I4 with no realm named, the default realm's verdict answers / control: a cabal verdict never answers for it.
 */
import { describe, expect, test } from "vitest";
import { createRequire } from "node:module";
import {
  CompositeStore, REALM_BAG_DOMAIN, REALM_ID_TIDDLER, deterministicDocUrl, emptyLarDoc, materializeSharedLarDoc,
  realmDocPointer, realmDocUrl, realmStandingPointer, realmStewardPointer, storedLarRecord, writeRealmStanding,
  type LarDoc, type RealmBagRegistration, type Repo as RepoType,
} from "@lararium/mesh";
import { memeVerbOptions } from "../src/meme-verbs.js";

const Repo = createRequire(import.meta.resolve("@lararium/mesh"))("@automerge/automerge-repo").Repo as new (options: { network: unknown[] }) => RepoType;

const A = "a".repeat(64), B = "b".repeat(64), C = "charter-c";
const BAG = "lar:///ha.ka.ba/bags/club";
const reg = (realmId: string, docUrl: string, keptBy: string): RealmBagRegistration => ({
  kind: REALM_BAG_DOMAIN, realmId, bagUri: BAG, docUrl, keptBy: [keptBy], readTier: "contract", signatures: [],
});

async function rig(pins: ReadonlyArray<{ realm: string; doc: string; steward?: string; keptBy?: string; pinDoc?: boolean }>, own?: string) {
  const repo = new Repo({ network: [] });
  for (const p of pins) await materializeSharedLarDoc(repo, p.doc as never, "book");
  if (own) await materializeSharedLarDoc(repo, own as never, "book");
  const oracle = repo.create<LarDoc>(emptyLarDoc());
  oracle.change((d) => {
    d.tiddlers[REALM_ID_TIDDLER] = storedLarRecord(REALM_ID_TIDDLER, { text: C }, "vessel-boot");
    if (own) d.tiddlers[BAG] = storedLarRecord(BAG, { text: own }, "registry");
    for (const p of pins) {
      if (p.pinDoc !== false) d.tiddlers[realmDocPointer(p.realm)] = storedLarRecord(realmDocPointer(p.realm), { text: realmDocUrl(p.realm) }, "vessel-boot");
      writeRealmStanding(d, p.realm, new Map([[BAG, reg(p.realm, p.doc, p.keptBy ?? p.steward ?? "nobody")]]));
      if (p.steward) d.tiddlers[realmStewardPointer(p.realm)] = storedLarRecord(realmStewardPointer(p.realm), { text: p.steward }, "realm-bag");
    }
  });
  const opts = memeVerbOptions(
    { composite: new CompositeStore(), tw5: {} as never, repo, catalogUrl: null, oracleUrl: oracle.url },
    async () => null,
  );
  return { repo, oracle, opts };
}
const DOC_A = deterministicDocUrl("island-book-a"), DOC_B = deterministicDocUrl("island-book-b"), DOC_C = deterministicDocUrl("island-book-c");

describe("the island reads a realm's standing verdict", () => {
  test("I1 a named realm reaches its own book; control: another realm's verdict answers that realm alone", async () => {
    const { opts } = await rig([{ realm: A, doc: DOC_A }, { realm: B, doc: DOC_B }]);
    const a = await opts.reach!(BAG, BAG, A), b = await opts.reach!(BAG, BAG, B);
    expect(a).not.toBeNull(); expect(b).not.toBeNull();
    expect(await opts.reach!(BAG, BAG, "c".repeat(64))).toBeNull();
    expect(await opts.reach!("lar:///ha.ka.ba/bags/other", "lar:///ha.ka.ba/bags/other", A)).toBeNull();
  });

  test("I2 a verdict with no doc pin beside it answers nothing; control: the pin restores the reach", async () => {
    const { opts, oracle } = await rig([{ realm: A, doc: DOC_A, pinDoc: false }]);
    expect(await opts.reach!(BAG, BAG, A)).toBeNull();
    oracle.change((d) => { d.tiddlers[realmDocPointer(A)] = storedLarRecord(realmDocPointer(A), { text: "automerge:elsewhere" }, "vessel-boot"); });
    expect(await opts.reach!(BAG, BAG, A)).toBeNull();                    // a pin that names another doc pins nothing
    oracle.change((d) => { d.tiddlers[realmDocPointer(A)] = storedLarRecord(realmDocPointer(A), { text: realmDocUrl(A) }, "vessel-boot"); });
    expect(await opts.reach!(BAG, BAG, A)).not.toBeNull();
  });

  test("I3 the write side reads that realm's own steward pin; control: realm A's pin opens nothing in realm B", async () => {
    const { opts } = await rig([{ realm: A, doc: DOC_A, steward: "hand-a" }, { realm: B, doc: DOC_B, keptBy: "hand-a" }]);
    expect(await opts.realmWritable!(BAG, A)).not.toBeNull();
    expect(await opts.realmWritable!(BAG, B)).toBeNull();
  });

  test("I4 with no realm named the default realm's verdict answers; control: a cabal verdict never answers for it", async () => {
    const only = await rig([{ realm: A, doc: DOC_A, steward: "hand-a" }]);
    expect(await only.opts.realmWritable!(BAG)).toBeNull();
    const both = await rig([{ realm: A, doc: DOC_A, steward: "hand-a" }, { realm: C, doc: DOC_C, steward: "hand-c" }]);
    expect(await both.opts.realmWritable!(BAG)).not.toBeNull();
    expect(await both.opts.realmWritable!(BAG, A)).not.toBeNull();
  });

  test("I5 a named realm never falls through to the vessel's own bag of that name; control: with no realm named the own bag answers", async () => {
    const own = deterministicDocUrl("island-book-own");
    const { opts } = await rig([{ realm: A, doc: DOC_A }], own);
    expect(await opts.reach!(BAG, BAG, B)).toBeNull();
    expect(await opts.reach!(BAG, BAG)).not.toBeNull();
  });
});
