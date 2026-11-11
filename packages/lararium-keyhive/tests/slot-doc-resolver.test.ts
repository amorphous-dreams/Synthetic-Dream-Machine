/**
 * ONE DRAFT RESOLVER, FLOOR-FALLING — operator ruling: "One doc -> fleet IF a PersonaGroup
 * sync-fleet cap available, ELSE this is a 'private device so far'. Our caps stack 'falls back to
 * the floor' never fails/reds in production."
 *
 *   S1 — seated  → the PersonaGroup × fingerprint binding (the daemon-doc record, `face-reach: face`)
 *   S2 — unseated → the device floor doc keyed by the vessel DID in the catalog (`face-reach: vessel-only`),
 *        and the call never throws for want of a group
 *   S3 — THE WELD: the same slug on the same vessel resolves to ONE doc from every call site — the
 *        island's slot grant (`bindings`), the host mount's read (`draft`), `meme put --recipe`'s
 *        store, `prune-stale`'s read, and `wiki init`'s report
 *   S4 — personal binds on the vessel's key when unseated, and says so
 *   S5 — THE ONE PATH (cabal-realm#/the-workbench): a wiki's working slot rests in its REALM WORKBENCH. The first stand
 *        founds a private cabal of one and the ledger notes it; the slot answers the realm's fixed address; a second
 *        resolver over the same ledger finds the same document; a replay founds nothing new
 *   S6 — a vessel that wears no face stands no working layer: the slot refuses `no-face`, and a read answers none
 */
import { describe, test, expect } from "vitest";
import { makeIslandRepo, type Repo } from "@lararium/mesh";
import {
  CompositeStore, CONTROL_HOME_ID, DAEMON_BAG_ID, DRAFT_BINDINGS_PREFIX, computeRecipeFingerprint, didFromVerifyingKey, emptyLarDoc,
  mutableLarRecord, wikiBagUri, wikiDraftDocKey, wikiSlotUri, realmWorkbenchDocUrl, ledgerWorkbenches, materializeSharedLarDoc,
  refusingControlStore, vesselLockedRefusal, VESSEL_LOCKED,
  type LarDoc, type LarTiddlerRecord,
} from "@lararium/mesh";
import { MemoryTiddlerStore, makeCatalogAccessor, makeInitWikiReactor, makePruneStaleReactor, makeMemePutReactor, type MemeVerbOptions } from "@lararium/tw5";
import { KeyhiveProvider } from "../src/keyhive-provider.js";
import { makeSlotDocResolver, type SlotDocResolver } from "../src/slot-doc-resolver.js";
import { makeFaceBagDoor } from "../src/face-bag-door.js";
import { standWorkbench, workbenchFaceHolds, adoptWorkbench } from "../src/workbench-realm.js";

const noopStore = { put: async () => {}, list: async () => [] };
const VERIFYING_KEY = "ab".repeat(32);
const DID = didFromVerifyingKey(VERIFYING_KEY);

/** The vessel ledger the workbench port reads: one plain document per rig, shared by every resolver a test stands over it. */
type Ledger = { d: LarDoc; doc(): LarDoc; change(fn: (d: LarDoc) => void): void };
const ledgerDoc = (): Ledger => { const d = { tiddlers: {} } as LarDoc; return { d, doc: () => d, change: (fn) => fn(d) }; };

/** The workbench port as the daemon composes it (`faceWorkbench`): the ledger's realm under this face's seat, founded on mint. */
const workbenchPort = (kh: KeyhiveProvider, ledger: Ledger) => async (slug: string, mint: boolean): Promise<string | null> => {
  const held = ledgerWorkbenches(ledger.doc()).find((b) => b.slug === slug)?.realmId ?? null;
  if (held === null) return mint ? (await standWorkbench(kh, ledger, slug)).realmId : null;
  if (kh.docIdOfBag(wikiSlotUri(slug, "working")) === null) adoptWorkbench(kh, slug, held);
  return (await workbenchFaceHolds(kh, slug, await kh.whoami(), "read")) ? held : null;
};

async function rig(opts: { seated: boolean | (() => boolean); faceless?: boolean; ledger?: Ledger; doorMints?: string[] }): Promise<{ resolver: SlotDocResolver; repo: Repo; catalogUrl: string; daemon: CompositeStore; kh: KeyhiveProvider; wikiUrl: string; ledger: Ledger }> {
  const kh = new KeyhiveProvider();
  await kh.init({ seed: new Uint8Array(32).fill(3), eventStore: noopStore });
  const group = await kh.createGroup();
  const repo = makeIslandRepo({ syncPort: new MessageChannel().port1 });
  const catalogHandle = repo.create<LarDoc>(emptyLarDoc());
  const wikiHandle = repo.create<LarDoc>(emptyLarDoc());
  catalogHandle.change((d) => {
    (d.tiddlers as Record<string, LarTiddlerRecord>)[wikiBagUri("garden")] = mutableLarRecord(wikiBagUri("garden"), { text: wikiHandle.url, kind: "oracle" }, "test");
  });
  const daemon = new CompositeStore();
  daemon.addLayer({ bagId: DAEMON_BAG_ID, store: new MemoryTiddlerStore(DAEMON_BAG_ID), writable: true });
  const ledger = opts.ledger ?? ledgerDoc();
  const resolver = makeSlotDocResolver({
    repo, daemonStore: daemon, keyhive: kh,
    catalog: makeCatalogAccessor(repo, catalogHandle.url),
    vesselDid: () => DID, mintedByHex: () => "0x" + "a".repeat(64),
    faceSeated: async () => (typeof opts.seated === "function" ? opts.seated() : opts.seated),
    ...(opts.faceless ? {} : {
      personaGroupId: group.groupId,
      faceDoor: ((door) => (opts.doorMints ? { ...door, mint: async (url: string, level: never) => { opts.doorMints!.push(url); return door.mint(url, level); } } : door))(makeFaceBagDoor({ face: kh, groupId: group.groupId })) as never,
      workbenchRealm: workbenchPort(kh, ledger),
      workbenchDoc: (url: string) => materializeSharedLarDoc(repo, url as never, "board:workbench"),
    }),
  });
  return { resolver, repo, catalogUrl: catalogHandle.url, daemon, kh, wikiUrl: wikiHandle.url, ledger };
}

describe("★ the ONE slot-doc resolver, floor-falling ★", () => {
  test("device-scoped slots stay in each control store with a seated face", async () => {
    const repo = makeIslandRepo({ syncPort: new MessageChannel().port1 });
    const store = () => { const s = new CompositeStore(); s.addLayer({ bagId: CONTROL_HOME_ID, store: new MemoryTiddlerStore(CONTROL_HOME_ID), writable: true, defaultWritable: true }); return s; };
    const control = store(), otherControl = store();
    const mints: string[] = [];
    const resolver = (home: CompositeStore) => makeSlotDocResolver({ repo, daemonStore: home, control: home, catalog: null, vesselDid: () => DID, mintedByHex: () => VERIFYING_KEY, personaGroupId: "face", faceSeated: async () => true, faceDoor: { mint: async (url: string) => { mints.push(url); } } as never, deviceScoped: slug => slug === "daemon" });
    const a = resolver(control), b = resolver(otherControl);
    for (const kind of ["working", "draft", "personal"] as const) {
      const first = await a.slotDoc("daemon", kind);
      expect(first?.reach).toBe("vessel-only");
      expect((await control.get(`${CONTROL_HOME_ID}/daemon-slot/${kind}/face`))?.tiddler.text).toBe(first?.url);
      expect((await a.slotDoc("daemon", kind))?.url).toBe(first?.url);
      expect((await b.slotDoc("daemon", kind))?.url).not.toBe(first?.url);
    }
    expect(mints).toEqual([]);
    await repo.shutdown();
  });

  test("RED: a device slot's document is named to the vessel's sealed map and in the control document BEFORE its first byte rests", async () => {
    const repo = makeIslandRepo({ syncPort: new MessageChannel().port1 });
    const control = new CompositeStore();
    control.addLayer({ bagId: CONTROL_HOME_ID, store: new MemoryTiddlerStore(CONTROL_HOME_ID), writable: true, defaultWritable: true });
    const events: string[] = [];
    const minter = {
      create: (v: never) => { events.push("create"); return repo.create(v); },
      import: (bytes: Uint8Array, args: { docId: never }) => {
        events.push(`import:${args.docId}:pointer=${Boolean(controlNamed[args.docId as string])}`);
        return repo.import(bytes, args as never);
      },
      flush: (ids?: string[]) => { events.push("flush"); return repo.flush(ids as never); },
    };
    const controlNamed: Record<string, boolean> = {};
    const resolver = makeSlotDocResolver({ repo: minter as never, daemonStore: control, control, catalog: null, vesselDid: () => DID, mintedByHex: () => VERIFYING_KEY,
      personaGroupId: "face", faceSeated: async () => true, faceDoor: { mint: async () => {} } as never, deviceScoped: (slug) => slug === "daemon",
      announceDevice: (kind, documentId) => { events.push(`announce:${kind}:${documentId}`); } });
    const put = control.put.bind(control);
    control.put = (async (record: { tiddler: { text?: string } }, ...rest: never[]) => {
      const id = record.tiddler.text?.replace(/^automerge:/, "");
      if (id) { controlNamed[id] = true; events.push(`pointer:${id}`); }
      return put(record as never, ...rest);
    }) as never;
    const slot = await resolver.slotDoc("daemon", "working");
    const id = slot!.url.replace(/^automerge:/, "");
    expect(events).toEqual([`announce:working:${id}`, `pointer:${id}`, `import:${id}:pointer=true`, "flush"]);
    expect(events).not.toContain("create");
    await repo.shutdown();
  });

  test("RED (locked floor mints no device slot): over a locked vessel's control store the device slot refuses `vessel-locked`; no id announces, no document mints", async () => {
    const repo = makeIslandRepo({ syncPort: new MessageChannel().port1 });
    const control = refusingControlStore(vesselLockedRefusal());
    const events: string[] = [];
    const minter = {
      create: (v: never) => { events.push("create"); return repo.create(v); },
      import: (bytes: Uint8Array, args: { docId: never }) => { events.push("import"); return repo.import(bytes, args as never); },
      flush: (ids?: string[]) => { events.push("flush"); return repo.flush(ids as never); },
    };
    const resolver = makeSlotDocResolver({ repo: minter as never, daemonStore: control, control, catalog: null, vesselDid: () => DID, mintedByHex: () => VERIFYING_KEY,
      faceSeated: async () => false, deviceScoped: (slug) => slug === "daemon", announceDevice: (kind) => { events.push(`announce:${kind}`); } });
    for (const kind of ["working", "draft", "personal"] as const) {
      await expect(resolver.slotDoc("daemon", kind)).rejects.toMatchObject({ refusal: VESSEL_LOCKED });
    }
    expect(events).toEqual([]);
    await repo.shutdown();
  });

  test("S1 — seated: the draft is the PersonaGroup × fingerprint binding, reach = face", async () => {
    const r = await rig({ seated: true });
    const doc = await r.resolver.draft("garden");
    expect(doc.reach).toBe("face");
    const fp = await computeRecipeFingerprint({ wikiDocId: r.wikiUrl, libraryBagDocIds: [] });
    const rec = await r.daemon.get(`${DRAFT_BINDINGS_PREFIX}/${fp}`);
    expect(rec?.tiddler["text"], "the binding record names the doc").toBe(doc.url);
    expect(rec?.tiddler["face-reach"]).toBe("face");
    await r.kh.dispose(); await r.repo.shutdown();
  });

  test("S2 — unseated: the draft falls to the device floor keyed by the DID, says so, never throws", async () => {
    const r = await rig({ seated: false });
    const doc = await r.resolver.draft("garden");
    expect(doc.reach).toBe("vessel-only");
    const catalog = makeCatalogAccessor(r.repo, r.catalogUrl);
    expect(await catalog.urlOf(wikiDraftDocKey("garden", DID)), "the floor registers under the per-DID key").toBe(doc.url);
    const floorRecord = (await catalog.recordOf(wikiDraftDocKey("garden", DID)))!.tiddler;
    expect(floorRecord["face-reach"]).toBe("vessel-only");
    // The floor record names its doc, its reach and the device that minted it, and no moment.
    expect(Object.keys(floorRecord).filter((k) => k !== "title").sort()).toEqual(["face-reach", "kind", "minted-by", "text"]);
    expect(floorRecord["minted-by"]).toBe("0x" + "a".repeat(64));
    expect(floorRecord["kind"]).toBe("oracle");
    // No binding record minted for the draft — the floor is the ONE truth while no seat stands.
    const fp = await computeRecipeFingerprint({ wikiDocId: r.wikiUrl, libraryBagDocIds: [] });
    expect(await r.daemon.get(`${DRAFT_BINDINGS_PREFIX}/${fp}`)).toBeNull();
    // Idempotent: a second call finds the same floor.
    expect((await r.resolver.draft("garden")).url).toBe(doc.url);
    await r.kh.dispose(); await r.repo.shutdown();
  });

  test("S4 — unseated, personal binds on the vessel's own key and says so", async () => {
    const r = await rig({ seated: false });
    const doc = await r.resolver.slotDoc("garden", "personal");
    expect(doc?.reach).toBe("vessel-only");
    expect((await r.resolver.slotDoc("garden", "personal", { mint: false }))?.url, "personal reads back what stands").toBe(doc?.url);
    await r.kh.dispose(); await r.repo.shutdown();
  });

  test("RED S5 — the one path: a wiki's working slot rests in its realm workbench, founded once on the first stand", async () => {
    const r = await rig({ seated: true });
    expect(await r.resolver.slotDoc("garden", "working", { mint: false }), "a read before the first stand founds nothing").toBeNull();
    const doc = await r.resolver.slotDoc("garden", "working");
    const rows = ledgerWorkbenches(r.ledger.doc());
    expect(rows).toHaveLength(1);
    expect(doc).toEqual({ url: realmWorkbenchDocUrl(rows[0]!.realmId, "garden"), reach: "face" });
    // The working bag rides the realm's Document: the face's own hive holds its seat there.
    expect(r.kh.docIdOfBag(wikiSlotUri("garden", "working"))).toBe(`0x${rows[0]!.realmId}`);
    const trace = { wikiDocId: r.wikiUrl, libraryBagDocIds: [] as readonly string[] };
    expect((await r.resolver.bindings(await computeRecipeFingerprint(trace), trace, "garden")).workingUrl).toBe(doc?.url);
    // A replay founds nothing new: the ledger still names one realm, and the slot the same document.
    expect((await r.resolver.slotDoc("garden", "working"))?.url).toBe(doc?.url);
    expect(ledgerWorkbenches(r.ledger.doc())).toHaveLength(1);
    // No binding record names the working document: the ledger's realm and the slug alone find it.
    expect((await r.daemon.listVisible()).filter((t) => t.includes("working"))).toEqual([]);
    await r.kh.dispose(); await r.repo.shutdown();
  });

  test("RED S6 — a vessel that wears no face stands no working layer: the slot refuses `no-face`, a read answers none", async () => {
    const r = await rig({ seated: false, faceless: true });
    await expect(r.resolver.slotDoc("garden", "working")).rejects.toMatchObject({ name: "WorkingSlotRefusal", reason: "no-face" });
    expect(await r.resolver.slotDoc("garden", "working", { mint: false })).toBeNull();
    expect(ledgerWorkbenches(r.ledger.doc()), "nothing founds").toEqual([]);
    await r.kh.dispose(); await r.repo.shutdown();
  });

  for (const seated of [true, false]) {
    test(`★ S3 — THE WELD (${seated ? "seated" : "unseated"}): five sites, ONE draft doc ★`, async () => {
      const r = await rig({ seated });
      const catalog = makeCatalogAccessor(r.repo, r.catalogUrl);
      const sites: Record<string, string> = {};

      // ① the island's slot grant
      const trace = { wikiDocId: r.wikiUrl, libraryBagDocIds: [] as readonly string[] };
      sites["island grant"] = (await r.resolver.bindings(await computeRecipeFingerprint(trace), trace, "garden")).draftUrl;
      // ② the host mount's read (through the daemon proxy, the same call)
      sites["host mount"] = (await r.resolver.draft("garden")).url;
      // ③ wiki init reports the doc it resolves
      const init = await makeInitWikiReactor({
        repo: r.repo, catalog, rootDir: "", vesselDid: () => DID,
        resolveDraftDoc: (slug) => r.resolver.draft(slug),
      })({ slug: "garden" }, { daemon: r.daemon, invocation: { requestId: "i" } as never, cap: async () => ({ ok: true }) });
      sites["wiki init"] = String(init["draftDocUrl"]);
      // ④ prune-stale reads the same doc
      const prune = await makePruneStaleReactor({
        repo: r.repo, catalog, rootDir: "", vesselDid: () => DID, composite: r.daemon,
        resolveDraftDoc: (slug) => r.resolver.draft(slug),
      })({ slug: "garden" }, { daemon: r.daemon, invocation: { requestId: "p" } as never, cap: async () => ({ ok: true }) });
      sites["prune-stale"] = String(prune["draftDocUrl"]);
      // ⑤ meme put --recipe lands in the store over that doc
      const recipes = new Map<string, LarTiddlerRecord>([[
        "lar:///ha.ka.ba/bags/catalog/recipes/garden",
        { tiddler: { title: "lar:///ha.ka.ba/bags/catalog/recipes/garden", "bag-stack": `${wikiBagUri("garden")}`, "writable-bag": wikiSlotUri("garden", "draft") } },
      ]]);
      const reachedUrls: string[] = [];
      const memeOpts: MemeVerbOptions = {
        composite: r.daemon,
        tw5: { $tw: { wiki: { getTiddlerText: () => "" } } } as never,
        recipeOf: async (slug) => recipes.get(`lar:///ha.ka.ba/bags/catalog/recipes/${slug}`) ?? null,
        slotStore: async (slug, kind, bag) => {
          const doc = await r.resolver.slotDoc(slug, kind);
          if (!doc) return null;
          reachedUrls.push(doc.url);
          return new MemoryTiddlerStore(bag);
        },
      };
      const text = `<<^ code=\`&#x0001;\` from=\`?\` to=\`lar:///t/x\`>>\n\`\`\`toml meta\nuri-path = "t/x"\n\`\`\`\n\n<<^ code=\`&#x0002;\`>>\n\n<<~ ahu slot=\`#a\`>>\n\n! a\n\n<<~/ahu>>\n\n<<^ code=\`&#x0003;\`>>\n\n<<^ code=\`&#x0004;\` -> to=?>>\n`;
      await makeMemePutReactor(memeOpts)({ recipe: "garden", uri: "lar:///t/x", text }, { daemon: r.daemon, invocation: { requestId: "m" } as never, cap: async () => ({ ok: true }) });
      sites["meme put --recipe"] = reachedUrls[0] ?? "(none)";

      const urls = new Set(Object.values(sites));
      expect(urls.size, `the sites disagree: ${JSON.stringify(sites, null, 2)}`).toBe(1);
      expect([...urls][0]).toMatch(/^automerge:/);
      await r.kh.dispose(); await r.repo.shutdown();
    });
  }
});
