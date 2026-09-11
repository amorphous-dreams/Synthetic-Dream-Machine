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
 *   S4 — working and personal bind on the vessel's key when unseated and say so
 */
import { describe, test, expect } from "vitest";
import { makeIslandRepo, type Repo } from "@lararium/mesh";
import {
  CompositeStore, DAEMON_BAG_ID, DRAFT_BINDINGS_PREFIX, computeRecipeFingerprint, didFromVerifyingKey, emptyLarDoc,
  mutableLarRecord, wikiBagUri, wikiDraftDocKey, wikiSlotUri, type LarDoc, type LarTiddlerRecord,
} from "@lararium/mesh";
import { MemoryTiddlerStore, makeCatalogAccessor, makeInitWikiReactor, makePruneStaleReactor, makeMemePutReactor, type MemeVerbOptions } from "@lararium/tw5";
import { KeyhiveProvider } from "../src/keyhive-provider.js";
import { makeSlotDocResolver, type SlotDocResolver } from "../src/slot-doc-resolver.js";

const noopStore = { put: async () => {}, list: async () => [] };
const VK = "ab".repeat(32);
const DID = didFromVerifyingKey(VK);

async function rig(opts: { seated: boolean }): Promise<{ resolver: SlotDocResolver; repo: Repo; catalogUrl: string; daemon: CompositeStore; kh: KeyhiveProvider; wikiUrl: string }> {
  const kh = new KeyhiveProvider();
  await kh.init({ seed: new Uint8Array(32).fill(3), eventStore: noopStore });
  const repo = makeIslandRepo({ syncPort: new MessageChannel().port1 });
  const catalogHandle = repo.create<LarDoc>(emptyLarDoc());
  const wikiHandle = repo.create<LarDoc>(emptyLarDoc());
  catalogHandle.change((d) => {
    (d.tiddlers as Record<string, LarTiddlerRecord>)[wikiBagUri("garden")] = mutableLarRecord(wikiBagUri("garden"), { text: wikiHandle.url, kind: "oracle" }, "test");
  });
  const daemon = new CompositeStore();
  daemon.addLayer({ bagId: DAEMON_BAG_ID, store: new MemoryTiddlerStore(DAEMON_BAG_ID), writable: true });
  const resolver = makeSlotDocResolver({
    repo, daemonStore: daemon, keyhive: kh,
    catalog: makeCatalogAccessor(repo, catalogHandle.url), oracle: null,
    vesselDid: () => DID, mintedByHex: () => "0x" + "a".repeat(64),
    personaGroupAgentIdHex: "cd".repeat(16),
    faceSeated: async () => opts.seated,
    delegateToFace: async () => {},
  });
  return { resolver, repo, catalogUrl: catalogHandle.url, daemon, kh, wikiUrl: wikiHandle.url };
}

describe("★ the ONE slot-doc resolver, floor-falling ★", () => {
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
    expect((await catalog.recordOf(wikiDraftDocKey("garden", DID)))?.tiddler["face-reach"]).toBe("vessel-only");
    // No binding record minted for the draft — the floor is the ONE truth while no seat stands.
    const fp = await computeRecipeFingerprint({ wikiDocId: r.wikiUrl, libraryBagDocIds: [] });
    expect(await r.daemon.get(`${DRAFT_BINDINGS_PREFIX}/${fp}`)).toBeNull();
    // Idempotent: a second call finds the same floor.
    expect((await r.resolver.draft("garden")).url).toBe(doc.url);
    await r.kh.dispose(); await r.repo.shutdown();
  });

  test("S4 — working and personal bind on the vessel's own key when unseated, and say so", async () => {
    const r = await rig({ seated: false });
    for (const kind of ["working", "personal"] as const) {
      const doc = await r.resolver.slotDoc("garden", kind);
      expect(doc?.reach, kind).toBe("vessel-only");
      expect((await r.resolver.slotDoc("garden", kind, { mint: false }))?.url, `${kind} reads back what stands`).toBe(doc?.url);
    }
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
      const text = `<<^ code="&#x0001;" from=? -> to=lar:///t/x>>\n\`\`\`toml meta\nuri-path = "t/x"\n\`\`\`\n\n<<^ code="&#x0002;">>\n\n<<~ ahu #a>>\n\n! a\n\n<<~/ahu>>\n\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to=?>>\n`;
      await makeMemePutReactor(memeOpts)({ recipe: "garden", uri: "lar:///t/x", text }, { daemon: r.daemon, invocation: { requestId: "m" } as never, cap: async () => ({ ok: true }) });
      sites["meme put --recipe"] = reachedUrls[0] ?? "(none)";

      const urls = new Set(Object.values(sites));
      expect(urls.size, `the sites disagree: ${JSON.stringify(sites, null, 2)}`).toBe(1);
      expect([...urls][0]).toMatch(/^automerge:/);
      await r.kh.dispose(); await r.repo.shutdown();
    });
  }
});
