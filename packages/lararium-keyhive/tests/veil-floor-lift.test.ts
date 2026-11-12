/**
 * THE VEIL FLOOR AND ITS LIFT (the-veil-ladder#/the-base-model; lararium-identity#/the-veil; operator ruling 2026-10-22).
 *
 *   V2 — a vessel that wears no face and whose control document reads stands a wiki's working layer in a floor document the
 *        control document names (`floor-slot/<slug>/working`), announced as the vessel's own BEFORE the control row lands
 *   V2b — a control document that does not read (a locked floor) stands none: the mount answers no working url
 *   V3 — a seat that lands lifts the floor's rows into the face's realm workbench at its derived address; the floor document
 *        and its control row leave; the personal margin lifts under the face beside it
 *   V4 — a replayed lift moves nothing
 *   V5 — a title the workbench already holds otherwise stays at the floor and gets named; a replay still moves nothing
 */
import { describe, test, expect } from "vitest";
import { makeIslandRepo } from "@lararium/mesh";
import {
  CompositeStore, CONTROL_HOME_ID, DAEMON_BAG_ID, PERSONAL_BINDINGS_PREFIX, computeRecipeFingerprint, didFromVerifyingKey, emptyLarDoc,
  floorSlotTitle, mutableLarRecord, wikiBagUri, wikiSlotUri, realmWorkbenchDocUrl, privateCabalRealmId, ledgerWorkbenches, materializeSharedLarDoc, workbenchKeyDocs,
  refusingControlStore, vesselLockedRefusal, tiddlerText, floorAnswerStore, ControlHomeUnavailable, CONTROL_HOME_UNNAMED,
  type LarDoc, type LarTiddlerRecord,
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

async function house(opts: { control?: CompositeStore } = {}) {
  const kh = new KeyhiveProvider();
  await kh.init({ seed: new Uint8Array(32).fill(5), eventStore: noopStore });
  const group = await kh.createGroup();
  const repo = makeIslandRepo({ syncPort: new MessageChannel().port1 });
  const catalogHandle = repo.create<LarDoc>(emptyLarDoc());
  const wikiHandle = repo.create<LarDoc>(emptyLarDoc());
  catalogHandle.change((d) => { (d.tiddlers as Record<string, LarTiddlerRecord>)[wikiBagUri("garden")] = mutableLarRecord(wikiBagUri("garden"), { text: wikiHandle.url, kind: "oracle" }, "test"); });
  const daemon = new CompositeStore();
  daemon.addLayer({ bagId: DAEMON_BAG_ID, store: new MemoryTiddlerStore(DAEMON_BAG_ID), writable: true });
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
  const base = { repo, daemonStore: daemon, control, keyhive: kh, catalog: makeCatalogAccessor(repo, catalogHandle.url), vesselDid: () => DID, mintedByHex: () => VERIFYING_KEY };
  // The veil floor: no face.
  const floor = makeSlotDocResolver({ ...base, faceSeated: async () => false,
    announceFloor: (slug, kind, documentId) => { order.push(`announce:${slug}:${kind}:${documentId}`); } });
  // The same vessel once a face's seat lands.
  const faced = () => makeSlotDocResolver({ ...base, personaGroupId: group.groupId, faceSeated: async () => true,
    faceDoor: makeFaceBagDoor({ face: kh, groupId: group.groupId }) as never, workbenchRealm,
    workbenchDoc: (url: string) => materializeSharedLarDoc(repo, url as never, "board:workbench") });
  const trace = { wikiDocId: wikiHandle.url, libraryBagDocIds: [] as readonly string[] };
  const fingerprint = await computeRecipeFingerprint(trace);
  const write = async (url: string, title: string, text: string) => { const h = await repo.find<LarDoc>(url as never); await h.whenReady(); h.change((doc) => { doc.tiddlers[title] = mutableLarRecord(title, { text }, "test"); }); };
  const read = async (url: string, title: string) => { const h = await repo.find<LarDoc>(url as never); await h.whenReady(); const r = h.doc()?.tiddlers[title]; return r ? tiddlerText(r) : null; };
  const done = async () => { await kh.dispose(); await repo.shutdown(); };
  return { kh, group, repo, control, daemon, ledger, floor, faced, trace, fingerprint, order, write, read, done };
}

describe("★ the veil floor stands its own wiki content, and a seat's landing lifts it ★", () => {
  test("RED V2 — no face, a reading control document: the working layer rests in a floor document the control document names", async () => {
    const h = await house();
    const out = await h.floor.bindings(h.fingerprint, h.trace, "garden");
    expect(out.workingUrl, "the floor stands its own working layer").toMatch(/^automerge:/);
    const row = await h.control.get(floorSlotTitle("garden", "working"));
    expect(tiddlerText(row)).toBe(out.workingUrl);
    expect(row?.tiddler["face-reach"]).toBe("vessel-only");
    expect(row?.tiddler["minted-by"]).toBe(VERIFYING_KEY);
    // Named to the vessel's sealed map as the vessel's own, once, before any row could land in it.
    expect(h.order).toEqual([`announce:garden:working:${out.workingUrl!.replace(/^automerge:/, "")}`]);
    expect((await h.floor.bindings(h.fingerprint, h.trace, "garden")).workingUrl, "one floor document per wiki").toBe(out.workingUrl);
    expect((await h.floor.slotDoc("garden", "working", { mint: false }))?.reach).toBe("vessel-only");
    expect(ledgerWorkbenches(h.ledger.doc()), "a floor founds no realm").toEqual([]);
    await h.done();
  });

  test("RED V2b — a control document that does not read stands no floor working layer", async () => {
    const h = await house({ control: refusingControlStore(vesselLockedRefusal()) });
    const out = await h.floor.bindings(h.fingerprint, h.trace, "garden");
    expect(out.workingUrl).toBeNull();
    expect(h.order).toEqual([]);
    await h.done();
  });

  test("RED V2c — a HERM's composition stands no floor working slot: its control stand-in refuses `control-home-unnamed`, and nothing mints", async () => {
    // The very store a faceless place's daemon island holds (control-home `standIn` + `controlStoreOf`): a herm never unlocks.
    const h = await house({ control: floorAnswerStore(new ControlHomeUnavailable("this place names no control document", CONTROL_HOME_UNNAMED)) });
    const out = await h.floor.bindings(h.fingerprint, h.trace, "garden");
    expect(out.workingUrl, "a herm gains no writable layer").toBeNull();
    expect(h.order, "nothing announces").toEqual([]);
    expect(await h.floor.slotDoc("garden", "working", { mint: false })).toBeNull();
    await expect(h.floor.slotDoc("garden", "working")).rejects.toThrow(/no-face/);
    await h.done();
  });

  test("RED V2d — only the control document's own refusal reads as no floor; any other fault of the control store surfaces", async () => {
    const broken = new CompositeStore();
    broken.addLayer({ bagId: CONTROL_HOME_ID, writable: true, defaultWritable: true, store: Object.assign(Object.create(new MemoryTiddlerStore(CONTROL_HOME_ID)), { get: async () => { throw new Error("disk-torn"); } }) as never });
    const h = await house({ control: broken });
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
    expect(await h.control.get(floorSlotTitle("garden", "working")), "the floor's control row leaves").toBeNull();
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
});
