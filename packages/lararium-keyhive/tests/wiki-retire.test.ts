/**
 * wiki-retire — `lares wiki retire <slug>`: the owner face unmints a shell it minted by mistake, so another face mints the slug
 * cleanly (cabal-realm#/the-workbench), over REAL Keyhive and real Automerge documents.
 *
 * The live case: `wiki init elyncia-referee` ran while the engineer face stood worn. The engineer's catalog half holds the canon
 * and recipe rows, its hive registered the shell's bags, and the vessel's ledger binds the workbench under the engineer's cabal
 * of one, so the referee's first stand refused `workbench-slug-bound`.
 *
 * R1 (red) face A mints S and stands its workbench; face B's stand refuses `workbench-slug-bound`. A retires S; B mints S and
 *    stands its workbench, founding its own cabal, and the canon document A minted stands untouched.
 * R2 (red) a face that does not own the shell refuses `not-the-owner` and nothing leaves.
 * R3 (red) a shell that holds records refuses `wiki-not-empty` (naming the count); `--force` with a count that moved refuses
 *    `retire-count-moved`; `--force --count <the count>` retires.
 * R4 a face that holds no shell refuses `no-such-wiki`; a system slug and the daemon wiki never retire.
 */
import { describe, test, expect } from "vitest";
import {
  emptyLarDoc, ledgerWorkbenchRealms, makeCatalogView, makeIslandRepo, privateCabalRealmId, recipeUri, wikiBagUri, wikiSlotUri,
  type DocHandle, type LarDoc, type Repo,
} from "@lararium/mesh";
import { makeCatalogAccessorOver, makeInitWikiReactor, makeRetireWikiReactor, type VerbContext } from "@lararium/tw5";
import { InMemoryEventStore, KeyhiveProvider } from "../src/index.js";
import { standWorkbench, type LedgerDoc } from "../src/workbench-realm.js";
import { wikiShellPorts } from "../src/wiki-shell-ports.js";

const SLUG = "elyncia-referee";
const ENGINEER = "0x" + "e1".repeat(32);
const REFEREE = "0x" + "4e".repeat(32);
const ctx = {} as VerbContext;

async function hive(fill: number): Promise<KeyhiveProvider> {
  const p = new KeyhiveProvider();
  await p.init({ seed: new Uint8Array(32).fill(fill), eventStore: new InMemoryEventStore() });
  return p;
}
function memLedger(): LedgerDoc {
  const d = { tiddlers: {} } as LarDoc;
  return { doc: () => d, change: (fn) => fn(d) };
}

/** One vessel: one floor catalog, one ledger, one repo; each face its own catalog half and hive. */
async function vessel() {
  const repo: Repo = makeIslandRepo({ syncPort: new MessageChannel().port1 });
  const floor = repo.create<LarDoc>(emptyLarDoc());
  const ledger = memLedger();
  const face = async (group: string, fill: number, records: { working: number; draft: number } = { working: 0, draft: 0 }) => {
    const half = repo.create<LarDoc>(emptyLarDoc()) as DocHandle<LarDoc>;
    const catalog = makeCatalogAccessorOver(repo, makeCatalogView(floor as DocHandle<LarDoc>, half));
    const provider = await hive(fill);
    const contents = { ...records };
    const shell = wikiShellPorts({ provider: () => provider, face: group, ledger: async () => ledger, contents: async () => ({ ...contents }) });
    return {
      group, half, catalog, provider, contents,
      init: () => makeInitWikiReactor({
        repo, catalog, rootDir: "", vesselDid: () => "did:key:vessel",
        registerBag: async (bag) => { await provider.registerBag(bag); },
        resolveDraftDoc: async () => ({ url: "automerge:draft", reach: "face" as never }),
      })({ slug: SLUG }, ctx),
      retire: (args: Record<string, unknown> = {}) => makeRetireWikiReactor({ catalog, shell })({ slug: SLUG, ...args }, ctx),
      stand: () => standWorkbench(provider, ledger, SLUG, group),
      rows: () => Object.keys(half.doc()?.tiddlers ?? {}).sort(),
    };
  };
  return { repo, floor, ledger, face };
}

describe("R1 — the owner retires its shell, and another face mints the slug cleanly", () => {
  test("A mints and stands S; B refuses `workbench-slug-bound`; A retires; B mints and founds its own workbench; A's canon document stands", async () => {
    const v = await vessel();
    const engineer = await v.face(ENGINEER, 0x51), referee = await v.face(REFEREE, 0x52);

    const minted = await engineer.init();
    expect(minted["status"]).toBe("minted");
    const canonDoc = String(minted["wikiDocUrl"]);
    expect(engineer.rows()).toEqual([wikiBagUri(SLUG), recipeUri("catalog", SLUG)].sort());
    await engineer.stand();
    expect(ledgerWorkbenchRealms(v.ledger.doc(), SLUG)).toEqual([privateCabalRealmId(ENGINEER, SLUG)]);
    // THE LIVE FAULT: the referee's own stand refuses while the engineer's workbench binds the slug.
    await expect(referee.stand()).rejects.toThrow(/workbench-slug-bound/);

    // The canon document carries content the retire must never touch.
    const canon = await v.repo.find<LarDoc>(canonDoc as never);
    canon.change((d) => { d.tiddlers["Referee Canon"] = { tiddler: { title: "Referee Canon", text: "house canon" } } as never; });
    const canonBefore = JSON.stringify(canon.doc());
    expect(engineer.provider.docIdOfBag(wikiBagUri(SLUG))).not.toBeNull();

    const retired = await engineer.retire();
    expect(retired).toMatchObject({ slug: SLUG, status: "retired", realmId: privateCabalRealmId(ENGINEER, SLUG), forced: false, kept: { canonBag: wikiBagUri(SLUG), canonDoc } });
    expect(retired["catalogRows"]).toEqual([wikiBagUri(SLUG), recipeUri("catalog", SLUG)]);
    expect((retired["ledgerRows"] as string[]).length).toBeGreaterThanOrEqual(3);   // binding · key Document · founder's seat
    expect(retired["keyhiveBindings"]).toEqual([wikiSlotUri(SLUG, "working"), wikiSlotUri(SLUG, "draft")]);
    expect(engineer.rows()).toEqual([]);
    expect(ledgerWorkbenchRealms(v.ledger.doc(), SLUG)).toEqual([]);
    expect(Object.keys(v.ledger.doc()?.tiddlers ?? {})).toEqual([]);
    expect(engineer.provider.docIdOfBag(wikiSlotUri(SLUG, "working"))).toBeNull();
    // NEVER THE CANON: its document, its content and the face's binding of the canon bag all stand.
    expect(JSON.stringify(canon.doc())).toBe(canonBefore);
    expect(engineer.provider.docIdOfBag(wikiBagUri(SLUG))).not.toBeNull();

    // The referee mints the slug on its own half and founds its own cabal of one: no `workbench-slug-bound`.
    expect((await referee.init())["status"]).toBe("minted");
    expect(referee.rows()).toEqual([wikiBagUri(SLUG), recipeUri("catalog", SLUG)].sort());
    const stood = await referee.stand();
    expect(stood).toMatchObject({ realmId: privateCabalRealmId(REFEREE, SLUG), founded: true });
    expect(ledgerWorkbenchRealms(v.ledger.doc(), SLUG)).toEqual([privateCabalRealmId(REFEREE, SLUG)]);
  });
});

describe("R2 — only the owner retires", () => {
  test("a face whose cabal the ledger does not bind refuses `not-the-owner`, and nothing leaves", async () => {
    const v = await vessel();
    const engineer = await v.face(ENGINEER, 0x61), referee = await v.face(REFEREE, 0x62);
    await engineer.init();
    await engineer.stand();
    const ledgerBefore = JSON.stringify(v.ledger.doc());
    await expect(referee.retire()).rejects.toThrow(/^not-the-owner:/);
    expect(JSON.stringify(v.ledger.doc())).toBe(ledgerBefore);
    expect(engineer.rows()).toEqual([wikiBagUri(SLUG), recipeUri("catalog", SLUG)].sort());
    expect(engineer.provider.docIdOfBag(wikiSlotUri(SLUG, "working"))).not.toBeNull();
  });

  test("CONTROL: a shell minted and never stood (no workbench yet) retires by its catalog rows alone", async () => {
    const v = await vessel();
    const engineer = await v.face(ENGINEER, 0x63), referee = await v.face(REFEREE, 0x64);
    await engineer.init();
    await expect(referee.retire()).rejects.toThrow(/^no-such-wiki:/);
    expect(await engineer.retire()).toMatchObject({ status: "retired", realmId: null, ledgerRows: [] });
    expect(engineer.rows()).toEqual([]);
  });
});

describe("R3 — nothing destroys content by default", () => {
  test("a shell holding records refuses `wiki-not-empty`; a moved count refuses; the very count retires", async () => {
    const v = await vessel();
    const engineer = await v.face(ENGINEER, 0x71, { working: 2, draft: 1 });
    await engineer.init();
    await engineer.stand();
    await expect(engineer.retire()).rejects.toThrow(/^wiki-not-empty: "elyncia-referee" holds 3 records \(working 2, draft 1\)/);
    await expect(engineer.retire({ force: true })).rejects.toThrow(/^retire-count-moved:/);
    await expect(engineer.retire({ force: true, count: 2 })).rejects.toThrow(/^retire-count-moved:/);
    expect(engineer.rows()).toEqual([wikiBagUri(SLUG), recipeUri("catalog", SLUG)].sort());
    expect(ledgerWorkbenchRealms(v.ledger.doc(), SLUG)).toEqual([privateCabalRealmId(ENGINEER, SLUG)]);
    expect(await engineer.retire({ force: true, count: 3 })).toMatchObject({ status: "retired", forced: true, records: { working: 2, draft: 1 } });
    expect(engineer.rows()).toEqual([]);
  });
});

describe("R4 — what never retires", () => {
  test("a face holding no shell refuses `no-such-wiki`; a system slug and the daemon wiki refuse by name", async () => {
    const v = await vessel();
    const engineer = await v.face(ENGINEER, 0x81);
    await expect(engineer.retire()).rejects.toThrow(/^no-such-wiki:/);
    await expect(engineer.retire({ slug: "lares" })).rejects.toThrow(/^system-bag:/);
    await expect(engineer.retire({ slug: "daemon" })).rejects.toThrow(/^wiki-face-private:/);
  });
});
