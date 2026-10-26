/**
 * THE ANON-VEIL LIFT (operator ruling 2026-10-22): when an anonymous vessel joins a PersonaGroup, the keyed material its anon
 * veil holds, a draft included, lifts into the face's cap stack. The seat's landing is the gate: no per-item accept stands.
 * The lift MOVES content (a new face-keyed document; the floor document leaves the catalog and the repo's storage), since
 * re-registering the old URL under the face would leave its earlier history plain at the floor URL (`anon-lift`).
 *
 *   L1  RED: a draft made while anonymous is the face's draft after the join, at a NEW URL under the face with equal content;
 *       the floor record is GONE from the catalog (no mark on the floor) and the old document is deleted from the repo.
 *   L2  RED: a second pass, a replayed join and a second face's join lift nothing twice.
 *   L3  RED: the lift carries no other vessel's material (`minted-by`).
 *   L4  CONTROL: a vessel that never joins keeps its draft at the floor, unmoved.
 *   L5  RED: a draft the vessel never resolves again still sits under the face after the join (the lift is a pass, not a lookup).
 *   L6  RED: a crash between the binding and the burn finishes on the next pass without a second copy.
 *   L7  RED: a vessel-only working binding (daemon bag) moves too, derived by its record and not by a list of kinds.
 *   N1  RED: a vessel-only document never reaches a peer (no cap names it, so the share verdict denies); CONTROL: the lifted face
 *       document is registered under the face and the same verdict allows it.
 */
import { describe, test, expect } from "vitest";
import { identityShareDecision, makeIslandRepo, type DocumentId, type Repo } from "@lararium/mesh";
import {
  CompositeStore, DAEMON_BAG_ID, DRAFT_BINDINGS_PREFIX, WORKING_BINDINGS_PREFIX, computeRecipeFingerprint, didFromVerifyingKey,
  emptyLarDoc, mutableLarRecord, plainField, storedLarRecord, wikiBagUri, wikiDraftDocKey, type LarDoc, type LarTiddlerRecord,
} from "@lararium/mesh";
import { MemoryTiddlerStore, makeCatalogAccessor } from "@lararium/tw5";
import { KeyhiveProvider } from "../src/keyhive-provider.js";
import { makeSlotDocResolver, type SlotDocResolver } from "../src/slot-doc-resolver.js";
import { makeFaceBagDoor, type FaceBagDoor } from "../src/face-bag-door.js";

const noopStore = { put: async () => {}, list: async () => [] };
const VERIFYING_KEY = "ab".repeat(32);
const DID = didFromVerifyingKey(VERIFYING_KEY);
const MINTED_BY = "0x" + "a".repeat(64);

interface Vessel { repo: Repo; daemon: CompositeStore; kh: KeyhiveProvider; catalogUrl: string; wikiUrl: string; fp: string }

async function vessel(): Promise<Vessel> {
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
  const fp = await computeRecipeFingerprint({ wikiDocId: wikiHandle.url, libraryBagDocIds: [] });
  return { repo, daemon, kh, catalogUrl: catalogHandle.url, wikiUrl: wikiHandle.url, fp };
}

/** A resolver over the vessel for one face (or none): the same repo, daemon bag and catalog every time. */
function resolverFor(v: Vessel, face: { seated: () => boolean; door: FaceBagDoor; group: string } | null, repo: unknown = v.repo, mintedBy = MINTED_BY): SlotDocResolver {
  return makeSlotDocResolver({
    repo: repo as Repo, daemonStore: v.daemon, keyhive: v.kh,
    catalog: makeCatalogAccessor(v.repo, v.catalogUrl),
    vesselDid: () => DID, mintedByHex: () => mintedBy,
    ...(face ? { personaGroupId: face.group, faceSeated: async () => face.seated(), faceDoor: face.door } : {}),
  });
}

async function newFace(v: Vessel, seated: { on: boolean }) {
  const group = await v.kh.createGroup();
  const door = makeFaceBagDoor({ face: v.kh, groupId: group.groupId });
  const minted: string[] = [];
  const counting: FaceBagDoor = { ...door, mint: async (url, access) => { minted.push(url); return door.mint(url, access); } };
  return { face: { seated: () => seated.on, door: counting, group: group.groupId }, minted };
}

const draftKey = (v: Vessel): string => `${DRAFT_BINDINGS_PREFIX}/${v.fp}`;
const bindingOf = async (v: Vessel, title: string) => (await v.daemon.get(title))?.tiddler as Record<string, unknown> | undefined;
const floorRecord = (v: Vessel) => makeCatalogAccessor(v.repo, v.catalogUrl).recordOf(wikiDraftDocKey("garden", DID));

async function write(v: Vessel, url: string, title: string, text: string): Promise<void> {
  const handle = await v.repo.find<LarDoc>(url as never);
  await handle.whenReady?.();
  handle.change((d) => { (d.tiddlers as Record<string, LarTiddlerRecord>)[title] = mutableLarRecord(title, { text }, "test"); });
}
async function textOf(v: Vessel, url: string, title: string): Promise<string | undefined> {
  const handle = await v.repo.find<LarDoc>(url as never);
  await handle.whenReady?.();
  const record = handle.doc()?.tiddlers?.[title];
  return record === undefined ? undefined : plainField(record, "text") as string;
}
/** Whether the repo still opens a document from its storage: false once it is deleted. */
async function opens(v: Vessel, url: string): Promise<boolean> {
  try { const handle = await v.repo.find<LarDoc>(url as never); return !handle.isDeleted() && handle.doc() !== undefined; } catch { return false; }
}

describe("the anon-veil lift on join", () => {
  test("L1 — a draft made while anonymous is the face's draft after the join, moved: a new URL, equal content, the floor record and the old document gone", async () => {
    const v = await vessel();
    const joined = { on: false };
    const a = await newFace(v, joined);
    const resolver = resolverFor(v, a.face);
    const anon = await resolver.draft("garden");
    expect(anon.reach).toBe("vessel-only");
    await write(v, anon.url, "Draft", "ANONYMOUS-SECRET-DRAFT");
    joined.on = true;                                                             // the join
    const lifted = await resolver.liftFloor();
    expect(lifted.moved).toHaveLength(1);
    const after = await resolver.draft("garden");
    expect(after.reach).toBe("face");
    expect(after.url, "the face's draft is a NEW document").not.toBe(anon.url);
    expect(await textOf(v, after.url, "Draft")).toBe("ANONYMOUS-SECRET-DRAFT");
    expect(a.minted, "the new document registers under the face's cap stack").toEqual([after.url]);
    expect(v.kh.docIdOfBag(after.url)).not.toBeNull();
    expect(await floorRecord(v), "the floor index keeps no record and no mark").toBeNull();
    expect(await opens(v, anon.url), "the old document no longer opens from the repo's storage").toBe(false);
    expect(await bindingOf(v, draftKey(v))).toMatchObject({ text: after.url, "face-reach": "face" });
    expect((await bindingOf(v, draftKey(v)))?.["lifted-from-url"], "the burn finished").toBeUndefined();
  });

  test("L2 — a second pass, a replayed join and a second face's join lift nothing twice", async () => {
    const v = await vessel();
    const first = { on: false };
    const a = await newFace(v, first);
    const resolver = resolverFor(v, a.face);
    const anon = await resolver.draft("garden");
    await write(v, anon.url, "Draft", "once");
    first.on = true;
    await resolver.liftFloor();
    const landed = (await bindingOf(v, draftKey(v)))!["text"];
    expect((await resolver.liftFloor()).moved).toEqual([]);                       // a second pass
    expect((await resolverFor(v, a.face).liftFloor()).moved).toEqual([]);         // a replayed join: a fresh resolver over the same stores
    expect(a.minted, "one lift, one new document").toHaveLength(1);
    const second = { on: true };
    const b = await newFace(v, second);
    expect((await resolverFor(v, b.face).liftFloor()).moved, "the second face finds nothing at the floor").toEqual([]);
    expect(b.minted).toEqual([]);
    expect((await bindingOf(v, draftKey(v)))?.["text"]).toBe(landed);
  });

  test("L3 — the lift carries no other vessel's material: a floor doc another vessel minted never moves", async () => {
    const v = await vessel();
    const catalog = makeCatalogAccessor(v.repo, v.catalogUrl);
    const strangerDoc = v.repo.create<LarDoc>(emptyLarDoc());
    const key = wikiDraftDocKey("garden", DID);
    (await catalog.handle()).change((doc) => {
      doc.tiddlers[key] = storedLarRecord(key, { text: strangerDoc.url, kind: "oracle", "face-reach": "vessel-only", "minted-by": "0x" + "9".repeat(64) }, "test");
    });
    const a = await newFace(v, { on: true });
    const resolver = resolverFor(v, a.face);
    expect((await resolver.liftFloor()).moved).toEqual([]);
    expect(a.minted).toEqual([]);
    expect(await opens(v, strangerDoc.url)).toBe(true);
    expect(await catalog.recordOf(key)).not.toBeNull();
  });

  test("L4 CONTROL — a vessel that never joins keeps its draft at the floor, unmoved", async () => {
    const v = await vessel();
    const a = await newFace(v, { on: false });
    const resolver = resolverFor(v, a.face);
    const once = await resolver.draft("garden");
    await write(v, once.url, "Draft", "stays");
    expect((await resolver.liftFloor()).moved, "no seat, nothing to lift into").toEqual([]);
    const again = await resolver.draft("garden");
    expect(again.url).toBe(once.url);
    expect(again.reach).toBe("vessel-only");
    expect(await textOf(v, once.url, "Draft")).toBe("stays");
    expect(await bindingOf(v, draftKey(v))).toBeUndefined();
    expect(await floorRecord(v)).not.toBeNull();
    expect(await opens(v, once.url)).toBe(true);
  });

  test("L5 — a draft the vessel never resolves again still sits under the face after the join", async () => {
    const v = await vessel();
    const joined = { on: false };
    const a = await newFace(v, joined);
    const resolver = resolverFor(v, a.face);
    const anon = await resolver.draft("garden");
    await write(v, anon.url, "Draft", "never asked for again");
    joined.on = true;
    await resolver.liftFloor();                                                   // no draft() call after the join
    const binding = (await bindingOf(v, draftKey(v)))!;
    expect(binding["face-reach"]).toBe("face");
    expect(await textOf(v, String(binding["text"]), "Draft")).toBe("never asked for again");
  });

  test("L6 — a crash between the binding and the burn finishes on the next pass, with no second copy", async () => {
    const v = await vessel();
    const joined = { on: false };
    const a = await newFace(v, joined);
    const anon = await resolverFor(v, a.face).draft("garden");
    await write(v, anon.url, "Draft", "survives a crash");
    joined.on = true;
    const crashing = { create: v.repo.create.bind(v.repo), find: v.repo.find.bind(v.repo), flush: v.repo.flush.bind(v.repo), delete: () => { throw new Error("the disk faulted"); } };
    await expect(resolverFor(v, a.face, crashing).liftFloor()).rejects.toThrow(/the disk faulted/);
    const half = (await bindingOf(v, draftKey(v)))!;
    expect(half["lifted-from-url"], "the binding keeps the old URL until the burn finishes").toBe(anon.url);
    expect(await opens(v, anon.url)).toBe(true);
    const finished = await resolverFor(v, a.face).liftFloor();
    expect(finished.finished).toHaveLength(1);
    expect(finished.moved).toEqual([]);
    const done = (await bindingOf(v, draftKey(v)))!;
    expect(done["text"], "the same new document, not a second copy").toBe(half["text"]);
    expect(done["lifted-from-url"]).toBeUndefined();
    expect(await opens(v, anon.url)).toBe(false);
    expect(await floorRecord(v)).toBeNull();
    expect(a.minted).toHaveLength(1);
  });

  test("L7 — a vessel-only working binding moves too: derived by its record, not by a list of kinds", async () => {
    const v = await vessel();
    const joined = { on: false };
    const a = await newFace(v, joined);
    const resolver = resolverFor(v, a.face);
    const { workingUrl } = await resolver.bindings(v.fp, { wikiDocId: v.wikiUrl, libraryBagDocIds: [] }, "garden");
    await write(v, workingUrl, "Saved", "working layer");
    expect((await bindingOf(v, `${WORKING_BINDINGS_PREFIX}/${v.fp}`))?.["face-reach"]).toBe("vessel-only");
    joined.on = true;
    await resolver.liftFloor();
    const record = (await bindingOf(v, `${WORKING_BINDINGS_PREFIX}/${v.fp}`))!;
    expect(record["face-reach"]).toBe("face");
    expect(record["text"]).not.toBe(workingUrl);
    expect(await textOf(v, String(record["text"]), "Saved")).toBe("working layer");
    expect(await opens(v, workingUrl)).toBe(false);
  });
});

describe("a vessel-only document never reaches a peer", () => {
  test("N1 — no cap names a floor document, so the share verdict denies it; CONTROL: the lifted face document is registered and the same verdict allows it", async () => {
    const v = await vessel();
    const joined = { on: false };
    const a = await newFace(v, joined);
    const resolver = resolverFor(v, a.face);
    const anon = await resolver.draft("garden");
    const floorHandle = await v.repo.find<LarDoc>(anon.url as never);
    const floorId = floorHandle.documentId as unknown as DocumentId;
    expect(v.kh.docIdOfBag(anon.url), "the cap layer holds no document for the floor URL").toBeNull();
    joined.on = true;
    await resolver.liftFloor();
    const faceUrl = String((await bindingOf(v, draftKey(v)))!["text"]);
    const faceId = (await v.repo.find<LarDoc>(faceUrl as never)).documentId as unknown as DocumentId;
    const ring = {
      slot: { verifyCapability: async () => true } as never,
      bagUrlForDoc: (id: DocumentId) => (id === faceId && v.kh.docIdOfBag(faceUrl) !== null ? faceUrl : id === floorId && v.kh.docIdOfBag(anon.url) !== null ? anon.url : null),
    };
    const relay = new Set(["peer"]);
    const open = { mayFederate: () => true };
    expect(await identityShareDecision(relay, open, ring, "peer", floorId)).toBe(false);   // the floor document reaches no peer
    expect(await identityShareDecision(relay, open, ring, "peer", faceId)).toBe(true);     // CONTROL: the face document does
  });
});
