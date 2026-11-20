/**
 * THE VEIL FLOOR STANDS ITS OWN WIKI CONTENT, AND A FACE'S LANDING LEAVES IT THERE (the-veil-ladder#/the-base-model;
 * lararium-identity#/the-veil; the after-re-found ruling: no face stealing).
 *
 *   V2 — a vessel that wears no face and whose FLOOR KEY stands stands a wiki's working layer in a floor document the floor
 *        registry names (`floor/slot/<slug>/working` in the place's daemon document), announced as the vessel's own BEFORE
 *        the floor row lands; no control document stands or gets asked
 *   V2b — a floor whose key stays shut (a locked floor) stands none: the mount answers no working url
 *   V3 — a seat's landing alone moves nothing: the floor's working, draft and personal rows and documents stay, and the
 *        face's own layers hold none of their words
 *   V6 — the daemon wiki's floor memory stays at the floor; the face's own daemon slot stands apart
 *   V8 — a face pinned and not yet seated keeps the floor's slots; its seat leaves them where they rest
 *   V9 — a wiki the veil minted keeps its canon on the floor's half: the face takes no cap and no seal re-files
 *   F1 — a keyed floor names a wiki's draft and personal documents in its own registry
 */
import { describe, test, expect } from "vitest";
import { makeIslandRepo, liftFaceCatalogRows, catalogRowHalf } from "@lararium/mesh";
import {
  CompositeStore, CONTROL_HOME_ID, DAEMON_BAG_ID, PERSONAL_BINDINGS_PREFIX, computeRecipeFingerprint, didFromVerifyingKey, emptyLarDoc,
  floorSlotTitle, mutableLarRecord, wikiBagUri, realmWorkbenchDocUrl, privateCabalRealmId, ledgerWorkbenches, materializeSharedLarDoc,
  tiddlerText, floorAnswerStore, ControlHomeUnavailable, CONTROL_HOME_UNNAMED, floorRegistryOf, floorDaemonSlotTitle, FLOOR_UNKEYED, VESSEL_LOCKED,
  type FloorKeyRefusal, type LarDoc, type LarTiddlerRecord,
} from "@lararium/mesh";
import { MemoryTiddlerStore, makeCatalogAccessor } from "@lararium/tw5";
import { KeyhiveProvider } from "../src/keyhive-provider.js";
import { makeSlotDocResolver } from "../src/slot-doc-resolver.js";
import { makeFaceBagDoor } from "../src/face-bag-door.js";
import { faceWorkbenchRealm } from "../src/workbench-realm.js";

const noopStore = { put: async () => {}, list: async () => [] };
const VERIFYING_KEY = "ab".repeat(32);
const DID = didFromVerifyingKey(VERIFYING_KEY);
type Ledger = { d: LarDoc; doc(): LarDoc; change(fn: (d: LarDoc) => void): void };

async function house(opts: { control?: CompositeStore; floorKey?: FloorKeyRefusal | null; daemon?: CompositeStore } = {}) {
  const kh = new KeyhiveProvider();
  await kh.init({ seed: new Uint8Array(32).fill(5), eventStore: noopStore });
  const group = await kh.createGroup();
  const repo = makeIslandRepo({ syncPort: new MessageChannel().port1 });
  const catalogHandle = repo.create<LarDoc>(emptyLarDoc());
  const wikiHandle = repo.create<LarDoc>(emptyLarDoc());
  catalogHandle.change((d) => { (d.tiddlers as Record<string, LarTiddlerRecord>)[wikiBagUri("garden")] = mutableLarRecord(wikiBagUri("garden"), { text: wikiHandle.url, kind: "oracle" }, "test"); });
  const daemon = opts.daemon ?? new CompositeStore();
  if (!opts.daemon) daemon.addLayer({ bagId: DAEMON_BAG_ID, store: new MemoryTiddlerStore(DAEMON_BAG_ID), writable: true });
  // The floor's registry over the daemon composite, gated on the floor's rest key (it stands unless a test says otherwise).
  const floorRegistry = floorRegistryOf(daemon, () => opts.floorKey ?? null);
  const control = opts.control ?? (() => { const s = new CompositeStore(); s.addLayer({ bagId: CONTROL_HOME_ID, store: new MemoryTiddlerStore(CONTROL_HOME_ID), writable: true, defaultWritable: true }); return s; })();
  const d = { tiddlers: {} } as LarDoc;
  const ledger: Ledger = { d, doc: () => d, change: (fn) => fn(d) };
  const workbenchRealm = (slug: string, mint: boolean): Promise<string | null> => faceWorkbenchRealm(kh, ledger, slug, group.groupId, mint);
  const order: string[] = [];
  const base = { repo, daemonStore: daemon, control, floor: floorRegistry, keyhive: kh, deviceScoped: (slug: string) => slug === "daemon", catalog: makeCatalogAccessor(repo, catalogHandle.url), vesselDid: () => DID, mintedByHex: () => VERIFYING_KEY };
  // The veil floor: no face.
  const floor = makeSlotDocResolver({ ...base, faceSeated: async () => false,
    announceFloor: (slug, kind, documentId) => { order.push(`announce:${slug}:${kind}:${documentId}`); } });
  // The same vessel once a face's seat lands.
  const faced = () => makeSlotDocResolver({ ...base, personaGroupId: group.groupId, faceSeated: async () => true,
    faceDoor: makeFaceBagDoor({ face: kh, groupId: group.groupId }) as never, workbenchRealm,
    workbenchDoc: (url: string) => materializeSharedLarDoc(repo, url as never, "board:workbench") });
  // The same vessel with a face pinned (its join landed) and not yet seated (no seat grant read): leaf-fleet.
  const pinned = () => makeSlotDocResolver({ ...base, personaGroupId: group.groupId, faceSeated: async () => false,
    faceDoor: makeFaceBagDoor({ face: kh, groupId: group.groupId }) as never, workbenchRealm,
    workbenchDoc: (url: string) => materializeSharedLarDoc(repo, url as never, "board:workbench") });
  const trace = { wikiDocId: wikiHandle.url, libraryBagDocIds: [] as readonly string[] };
  const fingerprint = await computeRecipeFingerprint(trace);
  const write = async (url: string, title: string, text: string) => { const h = await repo.find<LarDoc>(url as never); await h.whenReady(); h.change((doc) => { doc.tiddlers[title] = mutableLarRecord(title, { text }, "test"); }); };
  const read = async (url: string, title: string) => { const h = await repo.find<LarDoc>(url as never); await h.whenReady(); const r = h.doc()?.tiddlers[title]; return r ? tiddlerText(r) : null; };
  const done = async () => { await kh.dispose(); await repo.shutdown(); };
  return { kh, group, repo, control, daemon, ledger, floor, faced, pinned, trace, fingerprint, order, write, read, done, catalogHandle };
}

describe("★ the veil floor stands its own wiki content, and a seat's landing leaves it there ★", () => {
  test("RED V2 — no face, NO control document, the floor key standing: the working layer rests in a floor document the daemon document names", async () => {
    // The very store a faceless place's daemon island holds: no control document stands, and every control fact refuses.
    const h = await house({ control: floorAnswerStore(new ControlHomeUnavailable("this place names no control document", CONTROL_HOME_UNNAMED)) });
    const out = await h.floor.bindings(h.fingerprint, h.trace, "garden");
    expect(out.workingUrl, "the floor stands its own working layer").toMatch(/^automerge:/);
    const row = await h.daemon.get(floorSlotTitle("garden", "working"));
    expect(tiddlerText(row)).toBe(out.workingUrl);
    expect(row?.tiddler["face-reach"]).toBe("vessel-only");
    expect(row?.tiddler["minted-by"]).toBe(VERIFYING_KEY);
    // Named to the vessel's sealed map as the vessel's own, once, before any row could land in it.
    expect(h.order.filter((o) => o.startsWith("announce:garden:working:"))).toEqual([`announce:garden:working:${out.workingUrl!.replace(/^automerge:/, "")}`]);
    expect(h.order.length, "the floor's three documents each announce once (working, draft, personal: F1)").toBe(3);
    expect((await h.floor.bindings(h.fingerprint, h.trace, "garden")).workingUrl, "one floor document per wiki").toBe(out.workingUrl);
    expect((await h.floor.slotDoc("garden", "working", { mint: false }))?.reach).toBe("vessel-only");
    expect(ledgerWorkbenches(h.ledger.doc()), "a floor founds no realm").toEqual([]);
    await h.done();
  });

  test("RED V2b — a locked floor (its key stays shut) refuses the floor key: no floor working layer stands", async () => {
    const h = await house({ floorKey: VESSEL_LOCKED });
    const out = await h.floor.bindings(h.fingerprint, h.trace, "garden");
    expect(out.workingUrl).toBeNull();
    expect(h.order).toEqual([]);
    await h.done();
  });

  test("RED V2c — a HERM derives no floor key: its composition stands no floor working slot, registers no floor row, and nothing mints", async () => {
    // A herm never unlocks, so its vessel grants no floor key (`floor-unkeyed`); its control stand-in refuses beside it.
    const h = await house({ floorKey: FLOOR_UNKEYED, control: floorAnswerStore(new ControlHomeUnavailable("this place names no control document", CONTROL_HOME_UNNAMED)) });
    const out = await h.floor.bindings(h.fingerprint, h.trace, "garden");
    expect(out.workingUrl, "a herm gains no writable layer").toBeNull();
    expect(h.order, "nothing announces").toEqual([]);
    expect(await h.floor.slotDoc("garden", "working", { mint: false })).toBeNull();
    await expect(h.floor.slotDoc("garden", "working")).rejects.toThrow(/no-face/);
    expect((await h.daemon.listVisible()).filter((t) => t.includes("/floor/")), "a herm registers no floor row").toEqual([]);
    await expect(h.floor.slotDoc("daemon", "working"), "its daemon wiki's floor slot refuses by the floor's own name").rejects.toMatchObject({ name: "FloorUnavailable", refusal: FLOOR_UNKEYED });
    await h.done();
  });

  test("RED V2d — only the floor key's own refusal reads as no floor; any other fault of the registry's store surfaces", async () => {
    const broken = new CompositeStore();
    broken.addLayer({ bagId: DAEMON_BAG_ID, writable: true, store: Object.assign(Object.create(new MemoryTiddlerStore(DAEMON_BAG_ID)), { get: async (title: string) => { if (title.includes("/floor/")) throw new Error("disk-torn"); return null; } }) as never });
    const h = await house({ daemon: broken });
    await expect(h.floor.bindings(h.fingerprint, h.trace, "garden")).rejects.toThrow(/disk-torn/);
    await h.done();
  });

  test("RED V3 — a seat's landing alone moves nothing: the floor's working, draft and personal rows stay where they rest, and the face reads none of them", async () => {
    const h = await house();
    const at = await h.floor.bindings(h.fingerprint, h.trace, "garden");
    await h.write(at.workingUrl!, "Tabs", "C F G7");
    await h.write(at.draftUrl, "Draft Song", "Am Dm");
    await h.write(at.personalUrl, "$:/StoryList", "Tabs");
    const faced = h.faced();
    expect("liftFloor" in faced, "the resolver offers no automatic lift").toBe(false);
    const under = await faced.bindings(h.fingerprint, h.trace, "garden");
    // CONTROL: every floor row and document stands, its words intact.
    for (const kind of ["working", "draft", "personal"] as const) expect(await h.daemon.get(floorSlotTitle("garden", kind)), `the floor's ${kind} row stays`).not.toBeNull();
    expect(await h.read(at.workingUrl!, "Tabs")).toBe("C F G7");
    expect(await h.read(at.draftUrl, "Draft Song")).toBe("Am Dm");
    expect(await h.read(at.personalUrl, "$:/StoryList")).toBe("Tabs");
    // The face's own layers stand apart and hold none of the floor's words.
    const bench = realmWorkbenchDocUrl(privateCabalRealmId(h.group.groupId, "garden"), "garden");
    expect(under.workingUrl).toBe(bench);
    expect([under.draftUrl, under.personalUrl]).not.toEqual([at.draftUrl, at.personalUrl]);
    expect(await h.read(bench, "Tabs"), "the face's workbench sees none of the floor").toBeNull();
    expect(await h.read(under.draftUrl, "Draft Song")).toBeNull();
    expect(await h.read(under.personalUrl, "$:/StoryList")).toBeNull();
    await h.done();
  });

  test("V6 — the daemon wiki's floor memory stays at the floor when a seat lands; the face's own daemon slot stands apart and reads none of it", async () => {
    const h = await house();
    const floorSlot = floorDaemonSlotTitle("working");
    const at = (await h.floor.slotDoc("daemon", "working"))!;
    expect(tiddlerText(await h.daemon.get(floorSlot))).toBe(at.url);
    await h.write(at.url, "Memory", "the veil remembers");
    const faced = h.faced();
    // The face's daemon slot stays a device slot of that face: the control document names it under the face's group, and no realm founds.
    const faceSlot = (await faced.slotDoc("daemon", "working"))!;
    expect(tiddlerText(await h.control.get(`${CONTROL_HOME_ID}/daemon-slot/working/${encodeURIComponent(h.group.groupId)}`))).toBe(faceSlot.url);
    expect(faceSlot.url).not.toBe(at.url);
    expect(await h.read(faceSlot.url, "Memory"), "the face reads none of the floor's memory").toBeNull();
    expect(tiddlerText(await h.daemon.get(floorSlot)), "the floor's daemon slot row stays").toBe(at.url);
    expect(await h.read(at.url, "Memory")).toBe("the veil remembers");
    expect(ledgerWorkbenches(h.ledger.doc()).filter((b) => b.slug === "daemon"), "the daemon wiki never rests in a workbench").toEqual([]);
    await h.done();
  });
  test("V8 — a face pinned and not yet seated keeps the floor's slots, so nothing waits on a session; its seat leaves them where they rest", async () => {
    // leaf-fleet: a joined leaf with no road wears its face pinned until the carried seat grant lands. A slot of the face's
    // own would seal under a session that stands only once the face seats, so its bytes would wait in memory and a reload
    // would lose them (smoke: the daemon working layer read unavailable after the reload).
    const h = await house();
    const pinned = h.pinned();
    const daemonAt = (await pinned.slotDoc("daemon", "working"))!;
    expect(tiddlerText(await h.daemon.get(floorDaemonSlotTitle("working"))), "the daemon wiki keeps the floor's slot").toBe(daemonAt.url);
    expect(await h.control.get(`${CONTROL_HOME_ID}/daemon-slot/working/${encodeURIComponent(h.group.groupId)}`), "no slot of the face mints").toBeNull();
    const out = await pinned.bindings(h.fingerprint, h.trace, "garden");
    expect(out.workingUrl, "the wiki's working layer stands at the floor").toBe(tiddlerText(await h.daemon.get(floorSlotTitle("garden", "working"))));
    expect(ledgerWorkbenches(h.ledger.doc()), "no workbench realm founds while the face stands unseated").toEqual([]);
    await h.write(daemonAt.url, "Memory", "pinned words");
    await h.write(out.workingUrl!, "Note", "written while pinned");
    const faced = h.faced();
    const bench = (await faced.slotDoc("garden", "working"))!.url;
    expect(await h.read(bench, "Note"), "the seat carries none of the pinned wiki words into the face's workbench").toBeNull();
    expect(await h.read((await faced.slotDoc("daemon", "working"))!.url, "Memory")).toBeNull();
    expect(await h.read(out.workingUrl!, "Note"), "the pinned words stay at the floor").toBe("written while pinned");
    expect(await h.read(daemonAt.url, "Memory")).toBe("pinned words");
    await h.done();
  });

  test("V9 — a wiki the veil minted keeps its canon on the floor's half when a face lands: the row keeps its mark, the face takes no cap, and no seal re-files", async () => {
    const h = await house();
    // THE VEIL'S MINT (`init-wiki` at the floor): a canon document, its marked catalog row, and the control row that files it.
    const canon = h.repo.create<LarDoc>(emptyLarDoc());
    const key = wikiBagUri("tabs");
    const mark = { "face-reach": "vessel-only", "minted-by": VERIFYING_KEY };
    h.catalogHandle.change((d) => { (d.tiddlers as Record<string, LarTiddlerRecord>)[key] = mutableLarRecord(key, { text: canon.url, kind: "oracle", "mirror-root": "wikis/tabs", ...mark }, "test"); });
    await h.daemon.put(mutableLarRecord(floorSlotTitle("tabs", "canon"), { text: canon.url, kind: "oracle", ...mark }, "test"), { kind: "lares-verb", requestId: "t" }, { bag: DAEMON_BAG_ID });
    await h.write(canon.url, "Canon Note", "minted at the floor");
    const trace = { wikiDocId: canon.url, libraryBagDocIds: [] as readonly string[] };
    const fingerprint = await computeRecipeFingerprint(trace);
    const atFloor = await h.floor.bindings(fingerprint, trace, "tabs");
    await h.write(atFloor.workingUrl!, "Working Note", "written at the floor");
    expect(catalogRowHalf(key, h.catalogHandle.doc()!.tiddlers[key] as never), "the setup took: the row rests on the floor's half").toBe("floor");

    // THE FACE LANDS: the canon row keeps its floor mark and half, and the face takes no cap of it.
    const faced = h.faced();
    const row = h.catalogHandle.doc()!.tiddlers[key]!;
    expect(tiddlerText(row)).toBe(canon.url);
    expect(catalogRowHalf(key, row as never), "the row rests on the floor's half still").toBe("floor");
    expect(String(((row as unknown as LarTiddlerRecord).tiddler as Record<string, unknown>)["face-reach"])).toBe("vessel-only");
    expect(h.kh.docIdOfBag(key), "the face holds no cap of the floor's canon").toBeNull();
    const faceCatalog = h.repo.create<LarDoc>(emptyLarDoc());
    expect(liftFaceCatalogRows(h.catalogHandle as never, faceCatalog as never), "the floor's row never reaches the face's catalog").not.toContain(key);
    expect(tiddlerText(await h.daemon.get(floorSlotTitle("tabs", "canon"))), "the control row that files the canon stays").toBe(canon.url);
    expect(await h.read(canon.url, "Canon Note")).toBe("minted at the floor");
    expect(await h.read(atFloor.workingUrl!, "Working Note")).toBe("written at the floor");
    const under = await faced.bindings(fingerprint, trace, "tabs");
    expect(await h.read(under.workingUrl!, "Working Note"), "the face's workbench reads none of the floor's words").toBeNull();
    await h.done();
  }, 30_000);
  test("RED F1 — a keyed floor names a wiki's DRAFT and PERSONAL documents in its own registry, each announced before its row; the catalog and the daemon's binding rows name neither", async () => {
    const h = await house({ control: floorAnswerStore(new ControlHomeUnavailable("this place names no control document", CONTROL_HOME_UNNAMED)) });
    const out = await h.floor.bindings(h.fingerprint, h.trace, "garden");
    for (const kind of ["draft", "personal"] as const) {
      const url = kind === "draft" ? out.draftUrl : out.personalUrl;
      const row = await h.daemon.get(floorSlotTitle("garden", kind));
      expect(tiddlerText(row), `the floor registry names the ${kind} document`).toBe(url);
      expect(row?.tiddler["face-reach"]).toBe("vessel-only");
      expect(row?.tiddler["minted-by"]).toBe(VERIFYING_KEY);
      expect(h.order, `the ${kind} document announces as the floor's own`).toContain(`announce:garden:${kind}:${url.replace(/^automerge:/, "")}`);
    }
    expect(Object.keys(h.catalogHandle.doc()?.tiddlers ?? {}).filter((k) => k.includes("/drafts/")), "the catalog names no floor draft").toEqual([]);
    expect((await h.daemon.listVisible()).filter((t) => t.startsWith(`${PERSONAL_BINDINGS_PREFIX}/`)), "no vessel-only binding row stands").toEqual([]);
    const again = await h.floor.bindings(h.fingerprint, h.trace, "garden");
    expect([again.draftUrl, again.personalUrl], "one floor document per kind").toEqual([out.draftUrl, out.personalUrl]);
    expect((await h.floor.slotDoc("garden", "draft", { mint: false }))?.url).toBe(out.draftUrl);
    expect((await h.floor.slotDoc("garden", "personal", { mint: false }))?.url).toBe(out.personalUrl);
    await h.done();
  });

});
