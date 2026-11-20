/**
 * THE ANON FLOOR STAYS WHERE IT RESTS (the-veil-ladder#/the-base-model; the after-re-found ruling: no face stealing). When an
 * anonymous vessel's face lands (founding, admission, wear or unlock), the documents its floor holds stay at the floor:
 * nothing moves them under the face, re-keys them or registers them in the face's cap stack. A carry stays a future
 * explicit act; until it stands, the seated face reads its own documents and none of the floor's.
 *
 *   L1  RED: the landing alone moves nothing: the resolver offers no automatic lift, the anon draft still reads at the
 *       floor (its record, its document, no cap naming it), and the face's own draft holds none of its words.
 *   L4  CONTROL: a vessel that never joins keeps its draft at the floor, unmoved.
 *   N1  RED: a vessel-only document never reaches a peer (no cap names it, so the share verdict denies); CONTROL: the
 *       seated face's own draft is registered under the face and the same verdict allows it.
 */
import { describe, test, expect } from "vitest";
import { identityShareDecision, makeIslandRepo, type Repo } from "@lararium/mesh";
import {
  CompositeStore, DAEMON_BAG_ID, DRAFT_BINDINGS_PREFIX, slotBindingKey, computeRecipeFingerprint, didFromVerifyingKey,
  emptyLarDoc, mutableLarRecord, plainField, wikiBagUri, wikiDraftDocKey,
  type LarDoc, type LarTiddlerRecord,
} from "@lararium/mesh";
import { MemoryTiddlerStore, makeCatalogAccessor } from "@lararium/tw5";
import { KeyhiveProvider } from "../src/keyhive-provider.js";
import { makeSlotDocResolver, type SlotDocResolver } from "../src/slot-doc-resolver.js";
import { makeFaceBagDoor, type FaceBagDoor } from "../src/face-bag-door.js";

/** The document id the share verdict reads (`identityShareDecision`). */
type DocumentId = NonNullable<Parameters<typeof identityShareDecision>[4]>;

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
function resolverFor(v: Vessel, face: { seated: () => boolean; door: FaceBagDoor; group: string } | null): SlotDocResolver {
  return makeSlotDocResolver({
    repo: v.repo, daemonStore: v.daemon, keyhive: v.kh,
    catalog: makeCatalogAccessor(v.repo, v.catalogUrl),
    vesselDid: () => DID, mintedByHex: () => MINTED_BY,
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

/** The draft binding row: a face's own under its group, the floor's with none (`slotBindingKey`). */
const draftKey = (v: Vessel, group?: string): string => slotBindingKey(DRAFT_BINDINGS_PREFIX, v.fp, group);
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

describe("the anon floor stays where it rests when a face lands", () => {
  test("L1 RED — the landing alone moves nothing: a draft made while anonymous stays at the floor once the face seats, and the face sees none of it", async () => {
    const v = await vessel();
    const joined = { on: false };
    const a = await newFace(v, joined);
    const resolver = resolverFor(v, a.face);
    const anon = await resolver.draft("garden");
    expect(anon.reach).toBe("vessel-only");
    await write(v, anon.url, "Draft", "ANONYMOUS-SECRET-DRAFT");
    joined.on = true;                                                             // the face lands
    expect("liftFloor" in resolver, "the resolver offers no automatic lift: a carry stays a future explicit act").toBe(false);
    // CONTROL: the anon document still reads at the floor, unmoved and unregistered.
    expect(await textOf(v, anon.url, "Draft")).toBe("ANONYMOUS-SECRET-DRAFT");
    expect(await opens(v, anon.url)).toBe(true);
    expect(await floorRecord(v), "the floor index keeps its record").not.toBeNull();
    expect(v.kh.docIdOfBag(anon.url), "no cap names the floor document").toBeNull();
    // The face's draft stands apart: its own document, holding none of the floor's words.
    const faced = await resolver.draft("garden");
    expect(faced.reach).toBe("face");
    expect(faced.url).not.toBe(anon.url);
    expect(await textOf(v, faced.url, "Draft"), "the face sees none of the anon draft").toBeUndefined();
  });

  test("L4 CONTROL — a vessel that never joins keeps its draft at the floor, unmoved", async () => {
    const v = await vessel();
    const a = await newFace(v, { on: false });
    const resolver = resolverFor(v, a.face);
    const once = await resolver.draft("garden");
    await write(v, once.url, "Draft", "stays");
    const again = await resolver.draft("garden");
    expect(again.url).toBe(once.url);
    expect(again.reach).toBe("vessel-only");
    expect(await textOf(v, once.url, "Draft")).toBe("stays");
    expect(await bindingOf(v, draftKey(v))).toBeUndefined();
    expect(await floorRecord(v)).not.toBeNull();
    expect(await opens(v, once.url)).toBe(true);
  });

});

describe("a vessel-only document never reaches a peer", () => {
  test("N1 — no cap names a floor document, so the share verdict denies it, before and after the face lands; CONTROL: the face's own draft is registered and the same verdict allows it", async () => {
    const v = await vessel();
    const joined = { on: false };
    const a = await newFace(v, joined);
    const resolver = resolverFor(v, a.face);
    const anon = await resolver.draft("garden");
    const floorHandle = await v.repo.find<LarDoc>(anon.url as never);
    const floorId = floorHandle.documentId as unknown as DocumentId;
    expect(v.kh.docIdOfBag(anon.url), "the cap layer holds no document for the floor URL").toBeNull();
    joined.on = true;
    const faceUrl = (await resolver.draft("garden")).url;                         // the seated face's own draft, minted under its door
    expect(faceUrl).not.toBe(anon.url);
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
