/**
 * THE VEIL FLOOR AND ITS LIFT (the-veil-ladder#/the-base-model; lararium-identity#/the-veil; operator ruling 2026-10-22).
 *
 *   V2 — a vessel that wears no face and whose FLOOR KEY stands stands a wiki's working layer in a floor document the floor
 *        registry names (`floor/slot/<slug>/working` in the place's daemon document), announced as the vessel's own BEFORE
 *        the floor row lands; no control document stands or gets asked
 *   V2b — a floor whose key stays shut (a locked floor) stands none: the mount answers no working url
 *   V3 — a seat that lands lifts the floor's rows into the face's realm workbench at its derived address; the floor document
 *        and its control row leave; the personal margin lifts under the face beside it
 *   V4 — a replayed lift moves nothing
 *   V5 — a title the workbench already holds otherwise stays at the floor and gets named; a replay still moves nothing
 */
import { describe, test, expect } from "vitest";
import { makeIslandRepo, liftFaceCatalogRows, catalogRowHalf } from "@lararium/mesh";
import {
  CompositeStore, CONTROL_HOME_ID, DAEMON_BAG_ID, PERSONAL_BINDINGS_PREFIX, computeRecipeFingerprint, didFromVerifyingKey, emptyLarDoc,
  floorSlotTitle, mutableLarRecord, wikiBagUri, wikiSlotUri, realmWorkbenchDocUrl, privateCabalRealmId, ledgerWorkbenches, materializeSharedLarDoc, workbenchKeyDocs,
  tiddlerText, floorAnswerStore, ControlHomeUnavailable, CONTROL_HOME_UNNAMED, floorRegistryOf, floorDaemonSlotTitle, FLOOR_UNKEYED, VESSEL_LOCKED,
  type FloorKeyRefusal, type LarDoc, type LarTiddlerRecord,
} from "@lararium/mesh";
import { MemoryTiddlerStore, makeCatalogAccessor } from "@lararium/tw5";
import { KeyhiveProvider } from "../src/keyhive-provider.js";
import { makeSlotDocResolver } from "../src/slot-doc-resolver.js";
import { makeFaceBagDoor } from "../src/face-bag-door.js";
import { standWorkbench, workbenchFaceHolds, adoptWorkbench } from "../src/workbench-realm.js";

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
  const workbenchRealm = async (slug: string, mint: boolean): Promise<string | null> => {
    const held = ledgerWorkbenches(ledger.doc()).find((b) => b.slug === slug)?.realmId ?? null;
    const keys = held === null ? [] : workbenchKeyDocs(ledger.doc(), held, slug);
    if (held === null || keys.length === 0) return mint ? (await standWorkbench(kh, ledger, slug, group.groupId)).realmId : null;
    if (kh.docIdOfBag(wikiSlotUri(slug, "working")) === null) adoptWorkbench(kh, slug, keys[0]!);
    return (await workbenchFaceHolds(kh, slug, await kh.whoami(), "read")) ? held : null;
  };
  const order: string[] = [];
  const base = { repo, daemonStore: daemon, control, floor: floorRegistry, keyhive: kh, deviceScoped: (slug: string) => slug === "daemon", catalog: makeCatalogAccessor(repo, catalogHandle.url), vesselDid: () => DID, mintedByHex: () => VERIFYING_KEY };
  // The veil floor: no face.
  const floor = makeSlotDocResolver({ ...base, faceSeated: async () => false,
    announceFloor: (slug, kind, documentId) => { order.push(`announce:${slug}:${kind}:${documentId}`); } });
  const lifted: string[] = [];
  // The same vessel once a face's seat lands.
  const faced = () => makeSlotDocResolver({ ...base, personaGroupId: group.groupId, faceSeated: async () => true,
    faceDoor: makeFaceBagDoor({ face: kh, groupId: group.groupId }) as never, workbenchRealm,
    announceLifted: (slug: string, documentId: string) => { lifted.push(`${slug}:${documentId}`); },
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
  return { kh, group, repo, control, daemon, ledger, floor, faced, pinned, trace, fingerprint, order, write, read, done, catalogHandle, lifted };
}

describe("★ the veil floor stands its own wiki content, and a seat's landing lifts it ★", () => {
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

  test("RED V3 · V4 — the seat's landing lifts the floor's rows into the face's realm workbench, once", async () => {
    const h = await house();
    const at = await h.floor.bindings(h.fingerprint, h.trace, "garden");
    await h.write(at.workingUrl!, "Tabs", "C F G7");
    await h.write(at.personalUrl, "$:/StoryList", "Tabs");
    const faced = h.faced();
    const lifted = await faced.liftFloor();
    expect(lifted.moved).toContain(floorSlotTitle("garden", "working"));
    expect(lifted.kept ?? []).toEqual([]);
    // The address every device of the face derives.
    const bench = realmWorkbenchDocUrl(privateCabalRealmId(h.group.groupId, "garden"), "garden");
    expect((await faced.slotDoc("garden", "working"))?.url).toBe(bench);
    expect(await h.read(bench, "Tabs")).toBe("C F G7");
    expect(await h.daemon.get(floorSlotTitle("garden", "working")), "the floor's row leaves the registry").toBeNull();
    // The private margin lifted under the face beside it.
    const personal = await h.daemon.get(`${PERSONAL_BINDINGS_PREFIX}/${h.fingerprint}`);
    expect(personal?.tiddler["face-reach"]).toBe("face");
    expect(await h.read(tiddlerText(personal)!, "$:/StoryList")).toBe("Tabs");
    // V4: a replay moves nothing.
    const again = await faced.liftFloor();
    expect(again.moved).toEqual([]);
    expect(again.finished).toEqual([]);
    expect(await h.read(bench, "Tabs")).toBe("C F G7");
    await h.done();
  });

  test("RED V5 — a title the face's workbench holds otherwise stays at the floor, named; an absent one moves", async () => {
    const h = await house();
    const at = await h.floor.bindings(h.fingerprint, h.trace, "garden");
    await h.write(at.workingUrl!, "Tabs", "the floor's own");
    await h.write(at.workingUrl!, "Chords", "Am Dm");
    const faced = h.faced();
    const bench = (await faced.slotDoc("garden", "working"))!.url;
    await h.write(bench, "Tabs", "the face's own");
    const lifted = await faced.liftFloor();
    expect(lifted.kept).toEqual([{ slug: "garden", titles: ["Tabs"] }]);
    expect(await h.read(bench, "Tabs"), "the face's row stands").toBe("the face's own");
    expect(await h.read(bench, "Chords")).toBe("Am Dm");
    expect(await h.read(at.workingUrl!, "Tabs"), "the floor keeps its own").toBe("the floor's own");
    expect(await h.read(at.workingUrl!, "Chords"), "the moved row left the floor").toBeNull();
    const again = await faced.liftFloor();
    expect(again.moved).toEqual([]);
    expect(again.kept).toEqual([{ slug: "garden", titles: ["Tabs"] }]);
    await h.done();
  });

  test("RED V6 — the daemon wiki's floor memory lifts into the face's own daemon working slot (face-private), once", async () => {
    const h = await house();
    const floorSlot = floorDaemonSlotTitle("working");
    const at = (await h.floor.slotDoc("daemon", "working"))!;
    expect(tiddlerText(await h.daemon.get(floorSlot))).toBe(at.url);
    await h.write(at.url, "Memory", "the veil remembers");
    const faced = h.faced();
    const lifted = await faced.liftFloor();
    expect(lifted.moved).toContain(floorSlot);
    // The face's daemon slot stays a device slot of that face: the control document names it under the face's group, and no realm founds.
    const faceSlot = (await faced.slotDoc("daemon", "working"))!;
    expect(tiddlerText(await h.control.get(`${CONTROL_HOME_ID}/daemon-slot/working/${encodeURIComponent(h.group.groupId)}`))).toBe(faceSlot.url);
    expect(faceSlot.url).not.toBe(at.url);
    expect(await h.read(faceSlot.url, "Memory")).toBe("the veil remembers");
    expect(await h.daemon.get(floorSlot), "the floor's daemon slot row leaves").toBeNull();
    expect(ledgerWorkbenches(h.ledger.doc()).filter((b) => b.slug === "daemon"), "the daemon wiki never rests in a workbench").toEqual([]);
    const again = await faced.liftFloor();
    expect(again.moved).toEqual([]);
    expect(await h.read(faceSlot.url, "Memory")).toBe("the veil remembers");
    await h.done();
  });

  test("RED V8 — a face pinned and not yet seated keeps the floor's slots, so nothing waits on a session; its seat lifts them, once", async () => {
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
    const lifted = await faced.liftFloor();
    expect(lifted.skipped).toEqual([]);
    const bench = (await faced.slotDoc("garden", "working"))!.url;
    expect(await h.read(bench, "Note"), "the seat lifts the pinned wiki words into the face's workbench").toBe("written while pinned");
    expect(await h.read((await faced.slotDoc("daemon", "working"))!.url, "Memory")).toBe("pinned words");
    const again = await faced.liftFloor();
    expect(again.moved, "a replay moves nothing").toEqual([]);
    await h.done();
  });

  test("V7 — a seated lift over a floor whose key stays shut skips its floor legs and still lifts the bindings", async () => {
    const h = await house({ floorKey: VESSEL_LOCKED });
    const lifted = await h.faced().liftFloor();
    expect(lifted.moved.filter((t) => t.includes("/floor/"))).toEqual([]);
    await h.done();
  });

  test("RED V8 — a wiki the veil minted: its CANON stays where it stands (same URL), its row's mark leaves, its seal's release gets named once; draft and personal still resolve", async () => {
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

    const faced = h.faced();
    const out = await faced.liftFloor();
    expect(out.moved).toContain(floorSlotTitle("tabs", "canon"));
    // THE CANON DID NOT MOVE: the row names the same URL, the document reads, and the recipe fingerprint stays.
    const row = h.catalogHandle.doc()!.tiddlers[key]!;
    expect(tiddlerText(row)).toBe(canon.url);
    expect(await h.read(canon.url, "Canon Note")).toBe("minted at the floor");
    const lifted = (row as unknown as LarTiddlerRecord).tiddler as Record<string, unknown>;
    expect(String(lifted["face-reach"])).toBe("face");
    expect(String(lifted["keyhive-doc-id"] ?? "")).not.toBe("");
    expect(h.kh.docIdOfBag(key), "the face holds the canon bag's cap").not.toBeNull();
    // THE ROW LIFTS WITH THE SAME URL (`liftFaceCatalogRows`): it now classes to the face's half.
    expect(catalogRowHalf(key, row as never)).toBe("face");
    const faceCatalog = h.repo.create<LarDoc>(emptyLarDoc());
    expect(liftFaceCatalogRows(h.catalogHandle as never, faceCatalog as never)).toContain(key);
    expect(tiddlerText(faceCatalog.doc()!.tiddlers[key]!)).toBe(canon.url);
    // THE SEAL'S RE-FILE GETS NAMED ONCE, after the control row left.
    expect(await h.daemon.get(floorSlotTitle("tabs", "canon"))).toBeFalsy();
    expect(h.lifted).toEqual([`tabs:${canon.documentId}`]);
    // DRAFT AND PERSONAL STILL RESOLVE under the same fingerprint, and the working rows rest in the face's workbench.
    const after = await faced.bindings(await computeRecipeFingerprint({ wikiDocId: tiddlerText(row)!, libraryBagDocIds: [] }), trace, "tabs");
    expect(after.personalUrl).toMatch(/^automerge:/);
    expect(after.draftUrl).toMatch(/^automerge:/);
    expect(await h.read(after.workingUrl!, "Working Note")).toBe("written at the floor");
    // A REPLAY RE-FILES NOTHING.
    const again = await faced.liftFloor();
    expect(again.moved).toEqual([]);
    expect(h.lifted).toEqual([`tabs:${canon.documentId}`]);
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

  test("RED F2 — the seat's landing lifts the floor's draft and personal rows under the face, once; rows another face's pinned label minted stand apart", async () => {
    const h = await house();
    const at = await h.floor.bindings(h.fingerprint, h.trace, "garden");
    await h.write(at.draftUrl, "Draft Song", "Am Dm");
    await h.write(at.personalUrl, "$:/StoryList", "Draft Song");
    const faced = h.faced();
    const lifted = await faced.liftFloor();
    expect(lifted.moved).toEqual(expect.arrayContaining([floorSlotTitle("garden", "draft"), floorSlotTitle("garden", "personal")]));
    for (const kind of ["draft", "personal"] as const) expect(await h.daemon.get(floorSlotTitle("garden", kind)), `the floor's ${kind} row leaves`).toBeNull();
    const under = await faced.bindings(h.fingerprint, h.trace, "garden");
    expect([under.draftUrl, under.personalUrl]).not.toEqual([at.draftUrl, at.personalUrl]);
    expect(await h.read(under.draftUrl, "Draft Song")).toBe("Am Dm");
    expect(await h.read(under.personalUrl, "$:/StoryList")).toBe("Draft Song");
    expect((await faced.slotDoc("garden", "draft", { mint: false }))?.reach).toBe("face");
    expect((await faced.liftFloor()).moved, "a replay moves nothing").toEqual([]);
    // A SECOND FACE, pinned on this browser and not yet seated, stands floor rows under its own label. The first face's
    // lift never carries them: they wait for their own face's seat.
    const OTHER = "cd".repeat(32);
    const other = makeSlotDocResolver({ repo: h.repo, daemonStore: h.daemon, control: h.control, floor: floorRegistryOf(h.daemon, () => null), keyhive: h.kh,
      catalog: makeCatalogAccessor(h.repo, h.catalogHandle.url), vesselDid: () => didFromVerifyingKey(OTHER), mintedByHex: () => OTHER, personaGroupId: "ef".repeat(16), faceSeated: async () => false });
    const theirs = await other.bindings(h.fingerprint, h.trace, "garden");
    await h.write(theirs.draftUrl, "Their Draft", "E7");
    expect((await faced.liftFloor()).moved, "the first face lifts nothing of the second's").toEqual([]);
    expect(tiddlerText(await h.daemon.get(floorSlotTitle("garden", "draft"))), "the second face's floor row stands").toBe(theirs.draftUrl);
    expect(await h.read(under.draftUrl, "Their Draft"), "and its words never reach the first face's draft").toBeNull();
    await h.done();
  });
});
