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
 * R2 (red) a face that does not own the shell refuses `not-the-owner` and nothing leaves; the reactor's owner reading agrees
 *    with `retireWorkbench` (a ledger binding the slug under the face's own realm AND another's refuses).
 * R3 (red) a shell holding records refuses `wiki-not-empty` naming no count and no forcing line; `--force` alone refuses
 *    `retire-count-missing`; a wrong count `retire-count-moved`; `--dry-run` reads the counts and writes nothing; the very
 *    count retires and CLEARS the layers' documents, so the same face's re-mint opens its deterministic workbench empty.
 * R4 a face that holds no shell refuses `no-such-wiki`; a system slug and the daemon wiki never retire; a catalog with no face
 *    half refuses `no-face`.
 * R5 (red, H1) a shell another face reaches (a seat noted in its workbench, or a share row naming the slug) refuses
 *    `wiki-shared`, and every seat stays.
 * R6 (red, H2) a layer lookup that faults fails the retire closed: nothing leaves, no zero stands in for the fault.
 * R7 (red, M1) only a person's hand retires: a seat asker, a watcher and an ask no door read refuse `retire-needs-hand`.
 * R9 (red, F1/F2) a `tab` asker refuses; a slot the resolver answered off the floor's row (the face holds none of its own)
 *    is neither counted nor cleared.
 * R8 (red, M2/M3) a count that moves between the two readings refuses with nothing written; a fault midway leaves the catalog
 *    rows, and the same retire run again finishes.
 * R10 (red, referee-walk #1/#6) `wiki init` over a shell another init left stands what is missing (the face's bag
 *    registrations, its workbench) and names what it completed (the canon reused from the floor); the same init again
 *    answers `already-exists` and changes nothing; a workbench another face's realm holds names its refusal, never throws.
 * R11 (red, referee-walk #5) a gated-ingest residency row the house minted counts as an effect record, never an authored one:
 *    `--dry-run` names the two apart, a shell holding effect records alone retires unforced and drops them, and a record that
 *    only wears the effect tag (no residency-ledger title) counts as authored.
 */
import { describe, test, expect } from "vitest";
import {
  DRAFT_BINDINGS_PREFIX, PERSONAL_BINDINGS_PREFIX, buildEffectRecordTiddler, effectRecordUri, emptyLarDoc, LARES_EFFECT_RECORD_TAG, ledgerWorkbenchRealms, makeCatalogView, makeIslandRepo, materializeSharedLarDoc, noteWorkbench, noteWorkbenchSeat,
  privateCabalRealmId, realmWorkbenchDocUrl, recipeUri, wikiBagUri, wikiSlotUri, workbenchSeats,
  type DocHandle, type LarDoc, type Repo,
} from "@lararium/mesh";
import { makeCatalogAccessorOver, makeInitWikiReactor, makeRetireWikiReactor, type VerbContext, type WikiShellPorts } from "@lararium/tw5";
import { InMemoryEventStore, KeyhiveProvider } from "../src/index.js";
import { standWorkbench, type LedgerDoc } from "../src/workbench-realm.js";
import { faceOwnSlot, wikiShellPorts, type ShellLayerDoc } from "../src/wiki-shell-ports.js";

const SLUG = "elyncia-referee";
const ENGINEER = "0x" + "e1".repeat(32);
const REFEREE = "0x" + "4e".repeat(32);
const HAND = { asker: "cli" } as unknown as VerbContext;

async function hive(fill: number): Promise<KeyhiveProvider> {
  const p = new KeyhiveProvider();
  await p.init({ seed: new Uint8Array(32).fill(fill), eventStore: new InMemoryEventStore() });
  return p;
}
function memLedger(): LedgerDoc {
  const d = { tiddlers: {} } as LarDoc;
  return { doc: () => d, change: (fn) => fn(d) };
}
const seed = (h: ShellLayerDoc, n: number, tag: string): void => h.change((d) => {
  for (let i = 0; i < n; i++) d.tiddlers[`${tag} ${i}`] = { tiddler: { title: `${tag} ${i}`, text: "x" } } as never;
});
const live = (h: { doc(): LarDoc | undefined }): number => Object.keys(h.doc()?.tiddlers ?? {}).length;

/** One vessel: one floor catalog, one ledger, one repo; each face its own catalog half, hive and draft/personal documents. */
async function vessel() {
  const repo: Repo = makeIslandRepo({ syncPort: new MessageChannel().port1 });
  const floor = repo.create<LarDoc>(emptyLarDoc());
  const ledger = memLedger();
  const shareRows: string[] = [];
  const face = async (group: string, fill: number) => {
    const half = repo.create<LarDoc>(emptyLarDoc()) as DocHandle<LarDoc>;
    const catalog = makeCatalogAccessorOver(repo, makeCatalogView(floor as DocHandle<LarDoc>, half));
    const provider = await hive(fill);
    const draft = repo.create<LarDoc>(emptyLarDoc()) as DocHandle<LarDoc>;
    const personal = repo.create<LarDoc>(emptyLarDoc()) as DocHandle<LarDoc>;
    // The working layer rests at the realm's deterministic address while the ledger binds the face's own realm.
    const working = async (): Promise<DocHandle<LarDoc> | null> => ledgerWorkbenchRealms(ledger.doc(), SLUG).includes(privateCabalRealmId(group, SLUG))
      ? materializeSharedLarDoc(repo, realmWorkbenchDocUrl(privateCabalRealmId(group, SLUG), SLUG), "board:workbench") : null;
    const faults = { layers: false, unbind: false, moveAfterReads: 0 };
    let reads = 0;
    const ports = wikiShellPorts({
      provider: () => provider, face: group, ledger: async () => ledger,
      shares: async (slug) => shareRows.filter((s) => s === `wiki:${slug}`),
      layers: async () => {
        if (faults.layers) throw new Error("document-unavailable: the working layer did not answer");
        if (faults.moveAfterReads > 0 && ++reads === faults.moveAfterReads) seed(draft, 1, "late");
        return { working: await working(), draft, personal };
      },
      unbindSlots: async () => [],
    });
    const shell: WikiShellPorts = { ...ports, unbind: async (slug) => { if (faults.unbind) throw new Error("ledger write faulted"); return ports.unbind(slug); } };
    return {
      group, half, catalog, provider, draft, personal, working, faults,
      init: () => makeInitWikiReactor({
        repo, catalog, rootDir: "", vesselDid: () => "did:key:vessel",
        registerBag: async (bag) => { await provider.registerBag(bag); },
        resolveDraftDoc: async () => ({ url: draft.url, reach: "face" as never }),
      })({ slug: SLUG }, HAND),
      /** The init the daemon runs: it reads which bags the face's hive holds and stands the face's workbench. */
      initWhole: () => makeInitWikiReactor({
        repo, catalog, rootDir: "", vesselDid: () => "did:key:vessel",
        registerBag: async (bag) => { await provider.registerBag(bag); },
        bagRegistered: async (bag) => provider.docIdOfBag(bag) !== null,
        workbench: async (slug) => { const r = await standWorkbench(provider, ledger, slug, group); return { realmId: r.realmId, founded: r.founded }; },
        resolveDraftDoc: async () => ({ url: draft.url, reach: "face" as never }),
      })({ slug: SLUG }, HAND),
      retire: (args: Record<string, unknown> = {}, ctx: VerbContext = HAND) => makeRetireWikiReactor({ catalog, shell })({ slug: SLUG, ...args }, ctx),
      stand: () => standWorkbench(provider, ledger, SLUG, group),
      rows: () => Object.keys(half.doc()?.tiddlers ?? {}).sort(),
    };
  };
  return { repo, floor, ledger, shareRows, face };
}
const SHELL_ROWS = [wikiBagUri(SLUG), recipeUri("catalog", SLUG)].sort();

describe("R1 — the owner retires its shell, and another face mints the slug cleanly", () => {
  test("A mints and stands S; B refuses `workbench-slug-bound`; A retires; B mints and founds its own workbench; A's canon document stands", async () => {
    const v = await vessel();
    const engineer = await v.face(ENGINEER, 0x51), referee = await v.face(REFEREE, 0x52);

    const minted = await engineer.init();
    expect(minted["status"]).toBe("minted");
    const canonDoc = String(minted["wikiDocUrl"]);
    expect(engineer.rows()).toEqual(SHELL_ROWS);
    await engineer.stand();
    expect(ledgerWorkbenchRealms(v.ledger.doc(), SLUG)).toEqual([privateCabalRealmId(ENGINEER, SLUG)]);
    await expect(referee.stand()).rejects.toThrow(/workbench-slug-bound/);

    const canon = await v.repo.find<LarDoc>(canonDoc as never);
    canon.change((d) => { d.tiddlers["Referee Canon"] = { tiddler: { title: "Referee Canon", text: "house canon" } } as never; });
    const canonBefore = JSON.stringify(canon.doc());

    const retired = await engineer.retire();
    expect(retired).toMatchObject({ slug: SLUG, status: "retired", realmId: privateCabalRealmId(ENGINEER, SLUG), forced: false, kept: { canonBag: wikiBagUri(SLUG), canonDoc } });
    expect(retired["catalogRows"]).toEqual([wikiBagUri(SLUG), recipeUri("catalog", SLUG)]);
    expect((retired["ledgerRows"] as string[]).length).toBeGreaterThanOrEqual(3);   // binding · key Document · founder's seat
    expect(retired["keyhiveBindings"]).toEqual([wikiSlotUri(SLUG, "working"), wikiSlotUri(SLUG, "draft")]);
    expect(engineer.rows()).toEqual([]);
    expect(Object.keys(v.ledger.doc()?.tiddlers ?? {})).toEqual([]);
    expect(engineer.provider.docIdOfBag(wikiSlotUri(SLUG, "working"))).toBeNull();
    // NEVER THE CANON: its document, its content and the face's binding of the canon bag all stand.
    expect(JSON.stringify(canon.doc())).toBe(canonBefore);
    expect(engineer.provider.docIdOfBag(wikiBagUri(SLUG))).not.toBeNull();

    expect((await referee.init())["status"]).toBe("minted");
    expect(referee.rows()).toEqual(SHELL_ROWS);
    expect(await referee.stand()).toMatchObject({ realmId: privateCabalRealmId(REFEREE, SLUG), founded: true });
    expect(ledgerWorkbenchRealms(v.ledger.doc(), SLUG)).toEqual([privateCabalRealmId(REFEREE, SLUG)]);
  });
});

describe("R2 — only the owner retires, by one reading", () => {
  test("a face whose cabal the ledger does not bind refuses `not-the-owner`, and nothing leaves", async () => {
    const v = await vessel();
    const engineer = await v.face(ENGINEER, 0x61), referee = await v.face(REFEREE, 0x62);
    await engineer.init();
    await engineer.stand();
    const ledgerBefore = JSON.stringify(v.ledger.doc());
    await expect(referee.retire()).rejects.toThrow(/^not-the-owner:/);
    expect(JSON.stringify(v.ledger.doc())).toBe(ledgerBefore);
    expect(engineer.rows()).toEqual(SHELL_ROWS);
    expect(engineer.provider.docIdOfBag(wikiSlotUri(SLUG, "working"))).not.toBeNull();
  });

  test("RED (M2) a ledger binding the slug under the face's own realm AND another's refuses `not-the-owner` before any write", async () => {
    const v = await vessel();
    const engineer = await v.face(ENGINEER, 0x65);
    await engineer.init();
    await engineer.stand();
    v.ledger.change((d) => noteWorkbench(d, privateCabalRealmId(REFEREE, SLUG), SLUG));   // two ledgers merged
    const before = JSON.stringify(v.ledger.doc());
    await expect(engineer.retire()).rejects.toThrow(/^not-the-owner:/);
    expect(JSON.stringify(v.ledger.doc())).toBe(before);
    expect(engineer.rows()).toEqual(SHELL_ROWS);
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
  test("refuses `wiki-not-empty` with no count; `retire-count-missing`; `retire-count-moved`; dry-run reads; the count retires and clears", async () => {
    const v = await vessel();
    const engineer = await v.face(ENGINEER, 0x71);
    await engineer.init();
    await engineer.stand();
    seed((await engineer.working())!, 2, "work");
    seed(engineer.draft, 1, "draft");
    seed(engineer.personal, 1, "mine");
    const refusal = engineer.retire();
    await expect(refusal).rejects.toThrow(/^wiki-not-empty:/);
    // The refusal hands no one the forcing line: no count, no `--force`.
    await expect(refusal).rejects.not.toThrow(/\d|--force|--count/);
    await expect(engineer.retire({ force: true })).rejects.toThrow(/^retire-count-missing:/);
    await expect(engineer.retire({ force: true, count: 3 })).rejects.toThrow(/^retire-count-moved:/);
    expect(await engineer.retire({ "dry-run": true })).toMatchObject({ status: "would-retire", total: 4, records: { working: 2, draft: 1, personal: 1 } });
    expect(engineer.rows()).toEqual(SHELL_ROWS);
    expect(ledgerWorkbenchRealms(v.ledger.doc(), SLUG)).toEqual([privateCabalRealmId(ENGINEER, SLUG)]);

    const workbench = (await engineer.working())!;
    expect(await engineer.retire({ force: true, count: 4 })).toMatchObject({ status: "retired", forced: true, records: { working: 2, draft: 1, personal: 1 } });
    expect(engineer.rows()).toEqual([]);
    // RED (M4) THE LAYERS CLEARED: the deterministic workbench a re-mint by the same face reopens holds nothing.
    expect([live(workbench), live(engineer.draft), live(engineer.personal)]).toEqual([0, 0, 0]);
    await engineer.init();
    await engineer.stand();
    expect(live((await engineer.working())!)).toBe(0);
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

  test("RED (L1) a catalog with no face half laid over the floor refuses `no-face`, never reading the floor as the face's", async () => {
    const v = await vessel();
    const engineer = await v.face(ENGINEER, 0x82);
    const floorOnly = makeCatalogAccessorOver(v.repo, makeCatalogView(v.floor as DocHandle<LarDoc>, null));
    const shell = wikiShellPorts({ provider: () => engineer.provider, face: ENGINEER, ledger: async () => v.ledger, shares: async () => [], layers: async () => ({ working: null, draft: null, personal: null }), unbindSlots: async () => [] });
    await expect(makeRetireWikiReactor({ catalog: floorOnly, shell })({ slug: SLUG }, HAND)).rejects.toThrow(/^no-face:/);
  });
});

describe("R5 (H1) — a shared shell never retires", () => {
  test("a seat another face holds in the workbench refuses `wiki-shared`, naming the clearing line, and every seat stays", async () => {
    const v = await vessel();
    const engineer = await v.face(ENGINEER, 0x91);
    await engineer.init();
    await engineer.stand();
    v.ledger.change((d) => noteWorkbenchSeat(d, privateCabalRealmId(ENGINEER, SLUG), SLUG, REFEREE, "ab".repeat(32)));
    await expect(engineer.retire()).rejects.toThrow(/^wiki-shared: .*lares wiki share elyncia-referee --remove/);
    expect([...workbenchSeats(v.ledger.doc(), privateCabalRealmId(ENGINEER, SLUG), SLUG).keys()].sort()).toEqual([ENGINEER, REFEREE].sort());
    expect(engineer.rows()).toEqual(SHELL_ROWS);
  });

  test("a share row naming the slug refuses `wiki-shared` though no member seat stands yet", async () => {
    const v = await vessel();
    const engineer = await v.face(ENGINEER, 0x92);
    await engineer.init();
    v.shareRows.push(`wiki:${SLUG}`);
    await expect(engineer.retire()).rejects.toThrow(/^wiki-shared:/);
    expect(engineer.rows()).toEqual(SHELL_ROWS);
  });
});

describe("R6 (H2) — a lookup fault fails closed", () => {
  test("a layer read that faults refuses with the fault itself; nothing leaves", async () => {
    const v = await vessel();
    const engineer = await v.face(ENGINEER, 0xa1);
    await engineer.init();
    await engineer.stand();
    engineer.faults.layers = true;
    await expect(engineer.retire()).rejects.toThrow(/document-unavailable/);
    expect(engineer.rows()).toEqual(SHELL_ROWS);
    expect(ledgerWorkbenchRealms(v.ledger.doc(), SLUG)).toEqual([privateCabalRealmId(ENGINEER, SLUG)]);
    expect(engineer.provider.docIdOfBag(wikiSlotUri(SLUG, "working"))).not.toBeNull();
  });
});

describe("R7 (M1) — a person's hand alone", () => {
  test("a seat, a watcher and an ask no door read refuse `retire-needs-hand`; nothing leaves", async () => {
    const v = await vessel();
    const engineer = await v.face(ENGINEER, 0xb1);
    await engineer.init();
    for (const ctx of [{ asker: "seat" }, { asker: "watcher" }, {}]) {
      await expect(engineer.retire({}, ctx as unknown as VerbContext)).rejects.toThrow(/^retire-needs-hand:/);
    }
    expect(engineer.rows()).toEqual(SHELL_ROWS);
  });
});

describe("R8 (M2/M3) — the count holds across the act, and a fault midway finishes on a second run", () => {
  test("a record landing between the two readings refuses `retire-count-moved` with nothing written", async () => {
    const v = await vessel();
    const engineer = await v.face(ENGINEER, 0xc1);
    await engineer.init();
    await engineer.stand();
    engineer.faults.moveAfterReads = 2;   // the first reading reads empty; a draft lands before the second
    await expect(engineer.retire()).rejects.toThrow(/^retire-count-moved:/);
    expect(engineer.rows()).toEqual(SHELL_ROWS);
    expect(ledgerWorkbenchRealms(v.ledger.doc(), SLUG)).toEqual([privateCabalRealmId(ENGINEER, SLUG)]);
    expect(engineer.provider.docIdOfBag(wikiSlotUri(SLUG, "working"))).not.toBeNull();
  });

  test("a ledger fault midway leaves the catalog rows (the owner's mark), and the same retire run again finishes", async () => {
    const v = await vessel();
    const engineer = await v.face(ENGINEER, 0xc2);
    await engineer.init();
    await engineer.stand();
    engineer.faults.unbind = true;
    await expect(engineer.retire()).rejects.toThrow(/ledger write faulted/);
    expect(engineer.rows()).toEqual(SHELL_ROWS);
    engineer.faults.unbind = false;
    expect(await engineer.retire()).toMatchObject({ status: "retired", realmId: privateCabalRealmId(ENGINEER, SLUG) });
    expect(engineer.rows()).toEqual([]);
    expect(ledgerWorkbenchRealms(v.ledger.doc(), SLUG)).toEqual([]);
  });
});

describe("R9 (F1/F2) — the CLI hand alone, and the face's own slots alone", () => {
  test("RED (F1) a `tab` asker refuses `retire-needs-hand`: the verb rides the CLI surface alone", async () => {
    const v = await vessel();
    const engineer = await v.face(ENGINEER, 0xd1);
    await engineer.init();
    await expect(engineer.retire({}, { asker: "tab" } as unknown as VerbContext)).rejects.toThrow(/^retire-needs-hand:/);
    expect(engineer.rows()).toEqual(SHELL_ROWS);
  });

  test("UNIT (F2) a slot the resolver answered off the floor's row reads null; a row under the face's own group keeps it", async () => {
    const rows = new Map<string, string>([[`${DRAFT_BINDINGS_PREFIX}/fp1`, "automerge:floor-draft"]]);
    const store = { listVisible: async () => [...rows.keys()], get: async (t: string) => (rows.has(t) ? { tiddler: { text: rows.get(t) } } : null) };
    expect(await faceOwnSlot(store, DRAFT_BINDINGS_PREFIX, ENGINEER, "automerge:floor-draft")).toBeNull();
    expect(await faceOwnSlot(store, DRAFT_BINDINGS_PREFIX, ENGINEER, null)).toBeNull();
    const own = `${DRAFT_BINDINGS_PREFIX}/${encodeURIComponent(ENGINEER)}/fp1`;
    rows.set(own, "automerge:own-draft");
    expect(await faceOwnSlot(store, DRAFT_BINDINGS_PREFIX, ENGINEER, "automerge:own-draft")).toEqual({ url: "automerge:own-draft", titles: [own] });
    // Another face's row never counts as this face's.
    expect(await faceOwnSlot(store, DRAFT_BINDINGS_PREFIX, REFEREE, "automerge:own-draft")).toBeNull();
  });

  test("RED (F2) a face holding no draft or personal row of its own neither counts nor clears the floor's documents", async () => {
    const v = await vessel();
    const engineer = await v.face(ENGINEER, 0xd2);
    await engineer.init();
    await engineer.stand();
    // The floor's vessel-only documents, named by floor rows alone (no row under the engineer's group).
    const floorDraft = v.repo.create<LarDoc>(emptyLarDoc()) as DocHandle<LarDoc>;
    const floorPersonal = v.repo.create<LarDoc>(emptyLarDoc()) as DocHandle<LarDoc>;
    seed(floorDraft, 2, "floor draft"); seed(floorPersonal, 1, "floor mine");
    const rows = new Map<string, string>([[`${DRAFT_BINDINGS_PREFIX}/fp`, floorDraft.url], [`${PERSONAL_BINDINGS_PREFIX}/fp`, floorPersonal.url]]);
    const store = { listVisible: async () => [...rows.keys()], get: async (t: string) => (rows.has(t) ? { tiddler: { text: rows.get(t) } } : null) };
    const byUrl = new Map<string, DocHandle<LarDoc>>([[floorDraft.url, floorDraft], [floorPersonal.url, floorPersonal]]);
    const own = async (prefix: string, url: string) => { const s = await faceOwnSlot(store, prefix, ENGINEER, url); return s ? byUrl.get(s.url)! : null; };
    const shell = wikiShellPorts({
      provider: () => engineer.provider, face: ENGINEER, ledger: async () => v.ledger, shares: async () => [], unbindSlots: async () => [],
      // The resolver's fallback hands the floor's urls; the port keeps only the face's own.
      layers: async () => ({ working: await engineer.working(), draft: await own(DRAFT_BINDINGS_PREFIX, floorDraft.url), personal: await own(PERSONAL_BINDINGS_PREFIX, floorPersonal.url) }),
    });
    expect(await makeRetireWikiReactor({ catalog: engineer.catalog, shell })({ slug: SLUG, "dry-run": true }, HAND)).toMatchObject({ total: 0 });
    expect(await makeRetireWikiReactor({ catalog: engineer.catalog, shell })({ slug: SLUG }, HAND)).toMatchObject({ status: "retired", forced: false });
    expect([live(floorDraft), live(floorPersonal)]).toEqual([2, 1]);
  });
});

describe("R10 (referee walk #1/#6) — init completes what a partial left, and says so plainly", () => {
  /** The veil floor's mint: the vessel, wearing no face, laid the canon and recipe rows on the floor's half. */
  const floorMint = (v: Awaited<ReturnType<typeof vessel>>) => makeInitWikiReactor({
    repo: v.repo, catalog: makeCatalogAccessorOver(v.repo, makeCatalogView(v.floor as DocHandle<LarDoc>, null)), rootDir: "", vesselDid: () => "did:key:vessel",
    registerBag: async () => {}, veilFloor: { mintedBy: "ab".repeat(32), nameCanon: async () => {} },
    resolveDraftDoc: async () => ({ url: "automerge:floor-draft", reach: "floor" as never }),
  })({ slug: SLUG }, HAND);

  test("a face's init over the floor's rows registers its bags and stands its workbench; the same init again changes nothing", async () => {
    const v = await vessel();
    const steward = await v.face(REFEREE, 0xe1);
    const floor = await floorMint(v);
    expect(floor["status"]).toBe("minted");

    const done = await steward.initWhole();
    expect(done).toMatchObject({ status: "completed", canonReused: "floor", wikiDocUrl: floor["wikiDocUrl"], workbench: { realmId: privateCabalRealmId(REFEREE, SLUG), founded: true } });
    expect(done["bagsRegistered"]).toEqual([wikiBagUri(SLUG), wikiSlotUri(SLUG, "working"), wikiSlotUri(SLUG, "draft")]);
    expect(steward.provider.docIdOfBag(wikiSlotUri(SLUG, "working"))).not.toBeNull();
    expect(ledgerWorkbenchRealms(v.ledger.doc(), SLUG)).toEqual([privateCabalRealmId(REFEREE, SLUG)]);

    const ledgerBefore = JSON.stringify(v.ledger.doc());
    const again = await steward.initWhole();
    expect(again).toMatchObject({ status: "already-exists", bagsRegistered: [], workbench: { realmId: privateCabalRealmId(REFEREE, SLUG), founded: false } });
    expect(JSON.stringify(v.ledger.doc())).toBe(ledgerBefore);
  });

  test("RED (#428 F3) a re-init where no hive reads, or where a registration refuses, answers what stands and never throws", async () => {
    const v = await vessel();
    await floorMint(v);
    const steward = await v.face(REFEREE, 0xe5);
    const reinit = (bagRegistered: () => Promise<boolean | null>) => makeInitWikiReactor({
      repo: v.repo, catalog: steward.catalog, rootDir: "", vesselDid: () => "did:key:vessel",
      registerBag: async () => { throw new Error("waking-floor: lightAFace before minting a bag"); },
      bagRegistered,
      resolveDraftDoc: async () => ({ url: steward.draft.url, reach: "face" as never }),
    })({ slug: SLUG }, HAND);
    expect(await reinit(async () => null)).toMatchObject({ status: "already-exists", bagsRegistered: [] });
    const refused = await reinit(async () => false);
    expect(refused).toMatchObject({ status: "already-exists", bagsRegistered: [] });
    expect((refused["bagsRefused"] as Array<{ bag: string; why: string }>).map((r) => r.bag)).toEqual([wikiBagUri(SLUG), wikiSlotUri(SLUG, "working"), wikiSlotUri(SLUG, "draft")]);
    expect((refused["bagsRefused"] as Array<{ why: string }>)[0]!.why).toMatch(/^waking-floor:/);
  });

  test("a fresh mint stands its workbench in the same act; a re-init answers `already-exists`", async () => {
    const v = await vessel();
    const steward = await v.face(REFEREE, 0xe2);
    expect(await steward.initWhole()).toMatchObject({ status: "minted", workbench: { founded: true } });
    expect(await steward.initWhole()).toMatchObject({ status: "already-exists", bagsRegistered: [], workbench: { founded: false } });
  });

  test("a workbench another face's realm holds names its refusal in the answer; the init still lands its rows and bags", async () => {
    const v = await vessel();
    const engineer = await v.face(ENGINEER, 0xe3), referee = await v.face(REFEREE, 0xe4);
    await engineer.init();
    await engineer.stand();
    const out = await referee.initWhole();
    expect(out["status"]).toBe("minted");
    expect(String((out["workbench"] as { refused?: string }).refused)).toMatch(/^workbench-slug-bound:/);
    expect(referee.rows()).toEqual(SHELL_ROWS);
  });
});

describe("R11 (referee walk #5) — the house's effect records never count as a shell's authored records", () => {
  const effect = (h: ShellLayerDoc, eventId: string): void => h.change((d) => {
    const rec = buildEffectRecordTiddler({
      eventId, archivalVerb: "accession", actionVerb: "INGEST" as never, requestId: "req-1", bag: wikiSlotUri(SLUG, "working"),
      actor: "lares", timestamp: "2026-11-21T00:00:00.000Z", tiddlerTitle: "Some Tiddler",
    });
    d.tiddlers[rec.tiddler.title] = rec as never;
  });

  test("a shell holding only a residency row retires unforced, names the effect apart in --dry-run, and drops the row with the shell", async () => {
    const v = await vessel();
    const engineer = await v.face(ENGINEER, 0xf1);
    await engineer.init();
    await engineer.stand();
    const workbench = (await engineer.working())!;
    effect(workbench, "evt-1");
    expect(Object.keys(workbench.doc()!.tiddlers)).toEqual([effectRecordUri(wikiSlotUri(SLUG, "working"), "evt-1")]);
    expect(await engineer.retire({ "dry-run": true })).toMatchObject({ status: "would-retire", total: 0, records: { working: 0, draft: 0, personal: 0, effects: 1 } });
    expect(await engineer.retire()).toMatchObject({ status: "retired", forced: false, records: { effects: 1 } });
    expect(live(workbench)).toBe(0);
    expect(engineer.rows()).toEqual([]);
  });

  test("RED (#428 F1b) a full-shape record that names another bag, rests under another layer's ledger, carries text or a field beside the schema counts as authored", async () => {
    const v = await vessel();
    const engineer = await v.face(ENGINEER, 0xf3);
    await engineer.init();
    await engineer.stand();
    const workbench = (await engineer.working())!;
    const WORKING = wikiSlotUri(SLUG, "working"), DRAFT = wikiSlotUri(SLUG, "draft");
    const shaped = (bag: string, eventId: string, more: Record<string, unknown> = {}) => {
      const rec = buildEffectRecordTiddler({ eventId, archivalVerb: "accession", actionVerb: "ADD" as never, requestId: "r", bag, actor: "lares", timestamp: "2026-11-21T00:00:00.000Z" });
      return { ...rec, tiddler: { ...rec.tiddler, ...more } };
    };
    workbench.change((d) => {
      const put = (title: string, rec: unknown) => { d.tiddlers[title] = rec as never; };
      put(effectRecordUri(WORKING, "real"), shaped(WORKING, "real"));                                       // the house's own: an effect
      put(effectRecordUri(wikiBagUri(SLUG), "ingest"), shaped(wikiBagUri(SLUG), "ingest"));                 // a gated ingest's canon row: an effect
      put(effectRecordUri(WORKING, "other-bag"), shaped(DRAFT, "other-bag"));                                // names another bag
      put(effectRecordUri(DRAFT, "other-ledger"), shaped(DRAFT, "other-ledger"));                            // another layer's ledger, in this layer
      put(effectRecordUri(WORKING, "with-text"), shaped(WORKING, "with-text", { text: "my words" }));        // carries text
      put(effectRecordUri(WORKING, "extra"), shaped(WORKING, "extra", { mood: "wry" }));                     // a field beside the schema
    });
    expect(await engineer.retire({ "dry-run": true })).toMatchObject({ total: 4, records: { working: 4, effects: 2 } });
    await expect(engineer.retire()).rejects.toThrow(/^wiki-not-empty:/);
  });

  test("authored records still need the count; a record wearing the effect tag at an authored title counts as authored", async () => {
    const v = await vessel();
    const engineer = await v.face(ENGINEER, 0xf2);
    await engineer.init();
    await engineer.stand();
    const workbench = (await engineer.working())!;
    effect(workbench, "evt-2");
    engineer.draft.change((d) => { d.tiddlers["Dressed Up"] = { tiddler: { title: "Dressed Up", tags: LARES_EFFECT_RECORD_TAG, text: "mine" } } as never; });
    await expect(engineer.retire()).rejects.toThrow(/^wiki-not-empty:/);
    expect(await engineer.retire({ "dry-run": true })).toMatchObject({ total: 1, records: { working: 0, draft: 1, personal: 0, effects: 1 } });
    await expect(engineer.retire({ force: true, count: 2 })).rejects.toThrow(/^retire-count-moved:/);
    expect(await engineer.retire({ force: true, count: 1 })).toMatchObject({ status: "retired", forced: true });
    expect([live(workbench), live(engineer.draft)]).toEqual([0, 0]);
  });
});
