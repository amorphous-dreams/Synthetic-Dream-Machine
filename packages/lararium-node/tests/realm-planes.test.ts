/**
 * realm-planes — THE REALM HOLDER vectors, each with its control.
 *
 * R1 A registration stays in its named cabal plane / control: no realm names the charter plane alone.
 * R2 the charter plane remains the default / control: explicit default aliases answer alike.
 * R3 an act enters a cabal plane / controls: bad names and an unchartered holder refuse; a read never enters.
 * R4 refresh reads the realm ledger / controls: new valid realms stand and invalid names do not.
 * R5 each realm's wire lane answers its own standing / controls: the charter keeps its Nexus lane and unknown docs fall back.
 * R6 boards answer only to standing in their own realm / controls: standing in both opens both; realm docs keep their own lane.
 * R7 a cabal realm carries no key or roster / control: its oracle record holds only its three realm pointers.
 * R8 steward pins stay per realm / control: the charter key and cabal key occupy separate pointers.
 * R10 a book two realms register crosses where every holding realm admits / control: a peer standing in both.
 * R11 a named plane's gate answers its own realm alone / control: the holder's gate answers both.
 * R12 a left Nexus takes every pin / control: a cabal realm the ledger notes under none stands again with its doc
 *     pin and its verdict.
 * R13 concurrent entries stand one plane / control: a second realm notes apart.
 * R14 folds run one at a time / control: every act lands.
 * R15 a realm the ledger failed to note stands nowhere / control: the next entry stands.
 * R16 the vessel's ledger reads back its realms / control: another vessel's ledger reads none.
 * R17 an own-kept book answers by the realms its own steward keeps it in / control: a carried book answers by every holding realm.
 * R18 a failed stand leaves the holder inert / control: the next refresh stands the realms the ledger notes.
 * R19 an entry and a Nexus change each run whole / control: a lone entry stands and pins.
 * R20 a same-Nexus refresh folds every plane again / control: nothing re-pins.
 * R9 a new Nexus re-stands the cabal planes the ledger notes under none, and none this run entered under the
 *     Nexus it left / control: the cabal id stays while its nexusAid changes.
 * R21 a realm the ledger stands under another Nexus stands no plane and refuses entry / control: an entry notes
 *     the realm under the Nexus that stands.
 * R23 a standing realm the ledger comes to read conflicted, or pinned elsewhere, leaves with its pins at the next
 *     refresh, and an entry refuses it though it stood / control: an untouched realm keeps standing.
 * R24 a carried charter's realm stands a plane of its own under ITS Nexus, beside the hearth's own charter realm, and
 *     a realm-bag act that names it registers there / control: a charter no longer carried leaves with its pins,
 *     and the hearth's own realm stays the default.
 * R25 each plane's Nexus lane answers a leaf of ITS Nexus alone, and the return lane opens the dialed hearth's Nexus
 *     alone (the one carried plane on a self-founded hearth, never its own seed realm; two carried and no pin shut
 *     it) / control: a pinned dial opens the plane its pin names and no other.
 * R22 a realm entered under one Nexus stands no plane under the next when the ledger pins it to the first; a
 *     conflicted realm stands nowhere; a charter that leaves takes every plane and pin / control: a realm under
 *     none re-stands under the next.
 */
import { createHash } from "node:crypto";
import { describe, expect, test, vi } from "vitest";
import * as ed from "@noble/ed25519";
import { Repo, interpretAsDocumentId, type DocHandle } from "@automerge/automerge-repo";
import {
  deterministicDocUrl, emptyLarDoc, hex, mutableLarRecord, realmDocUrl, tiddlerText,
  realmDocPointer, realmEdgeBoardDocUrl, realmStandingPointer, realmStewardPointer, realmVouchBoardDocUrl,
  REALM_ID_TIDDLER, RealmBagGate, RealmBoardGate, signRealmBagRegistration, writeRealmBagRegistration, type FederationGate, type LarDoc, type NexusDoc, type NexusMembership,
  type RealmCharterConsult,
} from "@lararium/mesh";
import { makeRealmPlane, type NotedRealm, type RealmPlaneHolder } from "../src/realm-plane.js";
import { noteVesselRealm, readVesselRealms } from "../src/edge-board.js";
import { runRealmBag, runRealmBags, stewardGuard, type RealmDoorPlanes, type StewardVault } from "../src/realm-steward.js";
import { namedCharter } from "../../lararium-mesh/tests/charter-fixture.js";

const A = "a".repeat(64), B = "b".repeat(64);
const BAG_A = "lar:///ha.ka.ba/bags/cabal-a", BAG_B = "lar:///ha.ka.ba/bags/cabal-b";
const DOC_A = deterministicDocUrl("cabal-book-a"), DOC_B = deterministicDocUrl("cabal-book-b");
const denyAll: FederationGate = { mayFederate: async () => false };
const noMembers: NexusMembership = { holdsCarriagePeer: () => false };
const seed = (n: number): Uint8Array => new Uint8Array(32).fill(n);
const keyOf = async (s: Uint8Array): Promise<string> => hex(await ed.getPublicKeyAsync(s));
const signOf = (s: Uint8Array) => (bytes: Uint8Array): Promise<string> => ed.signAsync(bytes, s).then(hex);
/** A charter named by a label: the label hashes into a Nexus AID, the one shape a charter names. */
const aidOf = (label: string): string => `nexus-${createHash("sha256").update(label).digest("hex")}`;
const charter = (label: string): NexusDoc => namedCharter(aidOf(label));

interface Actor { readonly worn: string; readonly wornSeed: Uint8Array; readonly vault: StewardVault; }
async function actor(n: number): Promise<Actor> {
  const wornSeed = seed(n), worn = await keyOf(wornSeed);
  return { worn, wornSeed, vault: {
    async wornLeaf() { return { verifyingKey: worn, seed: wornSeed }; },
    async heldKeys() { return { personaGroupRoots: [], vesselKeys: [], nexusScopedKeys: [worn], veiledHandles: [] }; },
  } };
}
function registryDoc(bags: ReadonlyArray<[string, string]>): LarDoc {
  const doc = emptyLarDoc();
  for (const [bag, url] of bags) doc.tiddlers[bag] = mutableLarRecord(bag, { text: url }, "registry");
  return doc;
}
const oracles = new WeakMap<object, DocHandle<LarDoc>>();
function makeHolder(repo: Repo, options: {
  realms?: () => readonly (string | NotedRealm)[] | Promise<readonly (string | NotedRealm)[]>; noteRealm?: (realm: string, nexusAid: string) => Promise<void>;
  standsInRealm?: (peer: string, realm: string) => boolean;
  membership?: NexusMembership; base?: FederationGate;
  carried?: () => readonly NexusDoc[];
  leafAidOf?: (peerId: string) => string | null; dialedHearth?: () => { readonly pinned: boolean; readonly aid: string | null }; charter?: RealmCharterConsult;
} = {}) {
  const oracleHandle = repo.create<LarDoc>(emptyLarDoc());
  const crossroadsHandle = repo.create<LarDoc>(emptyLarDoc());
  const holder = makeRealmPlane({ repo, oracleHandle, crossroadsHandle, membership: options.membership ?? noMembers,
    base: options.base ?? denyAll,
    // A bare name reads as a realm the ledger notes under no Nexus yet.
    ...(options.realms ? { realms: async () => (await options.realms!()).map((r) => typeof r === "string" ? { realm: r, nexus: null } : r) } : {}),
    ...(options.noteRealm ? { noteRealm: options.noteRealm } : {}),
    ...(options.standsInRealm ? { standsInRealm: options.standsInRealm } : {}),
    ...(options.carried ? { carried: options.carried } : {}),
    ...(options.leafAidOf ? { leafAidOf: options.leafAidOf } : {}),
    ...(options.dialedHearth ? { dialedHearth: options.dialedHearth } : {}),
    ...(options.charter ? { charter: options.charter } : {}),
  });
  oracles.set(holder, oracleHandle);
  return { holder, oracleHandle, crossroadsHandle };
}
async function bag(holder: ReturnType<typeof makeHolder>["holder"], args: Record<string, unknown>, who: Actor, docs: ReadonlyArray<[string, string]>) {
  return runRealmBag({ plane: holder as RealmDoorPlanes, args, vault: who.vault, registryDocs: () => [registryDoc(docs)] });
}
async function oracleDoc(repo: Repo, holder: ReturnType<typeof makeHolder>["holder"]): Promise<LarDoc> {
  void repo;
  const handle = oracles.get(holder);
  if (!handle) throw new Error("no oracle plane for this holder");
  return handle.doc();
}
async function realmDoc(repo: Repo, id: string): Promise<LarDoc> { return (await repo.find<LarDoc>(realmDocUrl(id))).doc(); }

// R24
describe("a carried charter's realm", () => {
  test("R24 stands under its own Nexus beside the hearth's own realm; an act naming it registers there — control: uncarried, it leaves", async () => {
    const repo = new Repo({});
    let carried: NexusDoc[] = [charter("r24-theirs")];
    const { holder, oracleHandle } = makeHolder(repo, { carried: () => carried });
    await holder.refresh(charter("r24-own"));
    const own = aidOf("r24-own"), theirs = aidOf("r24-theirs");
    expect(holder.realmId()).toBe(own);
    expect(holder.realms()).toEqual([own, theirs]);
    expect(holder.plane(theirs)!.nexusAid()).toBe(theirs);                       // its steward keys derive at ITS AID
    expect(holder.plane(own)!.nexusAid()).toBe(own);
    expect(tiddlerText(oracleHandle.doc().tiddlers[realmDocPointer(theirs)])).toBe(realmDocUrl(theirs));
    expect(tiddlerText(oracleHandle.doc().tiddlers[REALM_ID_TIDDLER])).toBe(own);  // the default stays the hearth's own
    const who = await actor(24), doc = deterministicDocUrl("r24-book");
    const reg = await bag(holder, { bag: BAG_A, realm: theirs }, who, [[BAG_A, doc]]);
    expect(reg.realm).toBe(theirs);
    expect((await holder.plane(theirs)!.standing()).has(BAG_A)).toBe(true);
    expect((await holder.standing()).has(BAG_A)).toBe(false);
    // CONTROL: the charter leaves the carried set, and its plane leaves with its pins at the next refresh.
    carried = [];
    await holder.refresh(charter("r24-own"));
    expect(holder.realms()).toEqual([own]);
    expect(holder.plane(theirs)).toBeNull();
    expect(oracleHandle.doc().tiddlers[realmDocPointer(theirs)]).toBeUndefined();
    holder.dispose();
  });
});

// R25
describe("a plane's lanes scope to its own Nexus", () => {
  test("R25 a leaf of one Nexus reads no other's realm; the return lane opens the dialed hearth's plane alone — control: a pin names the plane", async () => {
    const own = aidOf("r25-own"), theirs = aidOf("r25-theirs"), other = aidOf("r25-other");
    const leaves: Record<string, string> = { "peer-own": own, "peer-theirs": theirs, "peer-other": other };
    // The vessel-wide membership holds every leaf: the plane's own scope alone keeps them apart.
    const membership: NexusMembership = { holdsCarriagePeer: (peer) => peer in leaves };
    const charterConsult: RealmCharterConsult = {
      contractNymOfPeer: () => null, holdsCharter: () => false, holdsCharterPeer: (peer) => peer === "peer-hearth",
    };
    const doc = (id: string) => interpretAsDocumentId(id);
    const reads = async (holder: ReturnType<typeof makeHolder>["holder"], realm: string, peer: string) =>
      holder.gate.mayFederate(doc(realmDocUrl(realm)), peer);

    let pinned: string | null = null;
    let carried: NexusDoc[] = [charter("r25-theirs")];
    const { holder } = makeHolder(new Repo({}), { membership, carried: () => carried, charter: charterConsult,
      leafAidOf: (peer) => leaves[peer] ?? null, dialedHearth: () => ({ pinned: pinned !== null, aid: pinned === "" ? null : pinned }) });
    await holder.refresh(charter("r25-own"));
    expect(holder.realms()).toEqual([own, theirs]);
    expect(await reads(holder, theirs, "peer-theirs")).toBe(true);
    expect(await reads(holder, own, "peer-own")).toBe(true);
    expect(await reads(holder, theirs, "peer-other")).toBe(false);     // admitted by another Nexus: nothing of this one
    expect(await reads(holder, own, "peer-theirs")).toBe(false);       // a carried Nexus's leaf: nothing of the seed realm
    // A self-founded hearth (no pin): the dialed hearth reads the carried realm, never the hearth's own seed realm.
    expect(await reads(holder, theirs, "peer-hearth")).toBe(true);
    expect(await reads(holder, own, "peer-hearth")).toBe(false);
    // CONTROL: a pin naming the own charter (a joiner) opens that plane and closes the carried one.
    pinned = own;
    expect(await reads(holder, own, "peer-hearth")).toBe(true);
    expect(await reads(holder, theirs, "peer-hearth")).toBe(false);
    // A pin naming no charter scope (a joiner's older admit): the joiner's primary plane, the hearth it joined.
    pinned = "";
    expect(await reads(holder, own, "peer-hearth")).toBe(true);
    expect(await reads(holder, theirs, "peer-hearth")).toBe(false);
    // Two charters carried and no pin: the dialed hearth stays unnamed, and the lane shuts on both carried planes.
    pinned = null;
    carried = [charter("r25-theirs"), charter("r25-other")];
    expect(await reads(holder, theirs, "peer-hearth")).toBe(false);    // shut at the import, before any refresh
    await holder.refresh(charter("r25-own"));
    expect(await reads(holder, theirs, "peer-hearth")).toBe(false);
    expect(await reads(holder, other, "peer-hearth")).toBe(false);
    expect(await reads(holder, other, "peer-other")).toBe(true);       // its own Nexus's leaf still reads it
    holder.dispose();
  });
});

// R1
 describe("many realm planes", () => {
  test("R1 cabal registrations stay in their named plane; control: an unnamed act lands in C", async () => {
    const repo = new Repo({}), { holder } = makeHolder(repo); await holder.refresh(charter("charter-c"));
    const actorA = await actor(1), actorC = await actor(3), docA = deterministicDocUrl("r1-a");
    const registered = await bag(holder, { bag: BAG_A, realm: A }, actorA, [[BAG_A, docA]]);
    expect((await holder.plane(A)!.standing()).has(BAG_A)).toBe(true);
    expect(holder.plane(B)).toBeNull();                       // a read never enters
    expect((await holder.standing()).has(BAG_A)).toBe(false);
    expect((await runRealmBags({ plane: holder as RealmDoorPlanes, args: { realm: B } })).bags).toEqual([]);
    const cText = JSON.stringify((await realmDoc(repo, holder.realmId()!)).tiddlers);
    expect(cText).not.toContain(docA); expect(cText).not.toContain(registered.bag);
    expect(JSON.stringify((await realmDoc(repo, A)).tiddlers)).toContain(docA);
    for (const id of [B, holder.realmId()!]) {
      expect(JSON.stringify((await oracleDoc(repo, holder)).tiddlers[realmStandingPointer(id)] ?? null)).not.toContain(BAG_A);
    }
    expect((await oracleDoc(repo, holder)).tiddlers[realmStandingPointer(B)]).toBeUndefined();
    expect(JSON.stringify((await oracleDoc(repo, holder)).tiddlers[realmStandingPointer(A)])).toContain(BAG_A);
    const defaultRegistered = await bag(holder, { bag: BAG_B }, actorC, [[BAG_B, DOC_B]]);
    expect((await holder.standing()).has(BAG_B)).toBe(true);
    expect((await holder.plane(A)!.standing()).has(BAG_B)).toBe(false);
    expect(defaultRegistered.realm).toBe(holder.realmId()); holder.dispose();
  });

  // R2
  test("R2 default aliases and id pointer resolve to C; control: an unknown realm has no plane", async () => {
    const repo = new Repo({}), { holder } = makeHolder(repo); await holder.refresh(charter("charter-r2"));
    const who = await actor(4); await bag(holder, { bag: BAG_A }, who, [[BAG_A, DOC_A]]);
    const c = holder.realmId()!;
    expect(holder.realms()).toEqual([c]);
    expect((await holder.plane()!.standing()).get(BAG_A)).toEqual((await holder.standing()).get(BAG_A));
    expect((await holder.plane(null)!.standing()).get(BAG_A)).toEqual((await holder.standing()).get(BAG_A));
    expect((await holder.plane(c)!.standing()).get(BAG_A)).toEqual((await holder.standing()).get(BAG_A));
    expect(holder.plane(A)).toBeNull();
    expect(tiddlerText((await oracleDoc(repo, holder)).tiddlers[REALM_ID_TIDDLER])).toBe(c);
    holder.dispose();
  });

  // R3
  test("R3 acts enter once; controls: unreadable names refuse, inert entry refuses, and reads do not enter", async () => {
    const repo = new Repo({}), noted: string[] = [], { holder } = makeHolder(repo, { noteRealm: async (r) => { noted.push(r); } });
    await holder.refresh(charter("charter-r3")); const who = await actor(5);
    const one = await bag(holder, { bag: BAG_A, realm: A }, who, [[BAG_A, DOC_A]]);
    expect(one.realm).toBe(A); expect(noted).toEqual([A]); expect((await holder.plane(A)!.standing()).has(BAG_A)).toBe(true);
    await bag(holder, { bag: BAG_B, realm: A }, who, [[BAG_B, DOC_B]]); expect(noted).toEqual([A]);
    const before = holder.realms();
    await expect(holder.enter("bad-name")).rejects.toMatchObject({ refusal: "realm-unreadable" });
    await expect(bag(holder, { bag: BAG_A, realm: "bad-name" }, who, [[BAG_A, DOC_A]])).rejects.toMatchObject({ refusal: "realm-unreadable" });
    expect((await holder.standing()).has(BAG_A)).toBe(false);          // and the act landed in no default realm
    expect(holder.realms()).toEqual(before);
    const inert = makeHolder(new Repo({})).holder;
    await expect(inert.enter(A)).rejects.toMatchObject({ refusal: "no-realm" });
    const absent = B; const listed = await runRealmBags({ plane: holder as RealmDoorPlanes, args: { realm: absent } });
    expect(listed).toMatchObject({ realm: B, realmDoc: null, bags: [] });
    expect(listed.realms).toEqual(before); expect(before).toEqual([holder.realmId(), A]);
    expect(holder.realms()).toEqual(before); holder.dispose(); inert.dispose();
  });

  // R4
  test("R4 refresh reads the live realm ledger; control: invalid ledger entries stand nowhere", async () => {
    const repo = new Repo({}), ledger = [A], { holder } = makeHolder(repo, { realms: () => ledger });
    await holder.refresh(charter("charter-r4")); expect(holder.realms()).toEqual([holder.realmId(), A]);
    const who = await actor(6); await bag(holder, { bag: BAG_A, realm: A }, who, [[BAG_A, DOC_A]]);
    ledger.push(B, "not-a-realm"); await holder.refresh(charter("charter-r4"));
    expect(holder.realms()).toContain(B); expect((await holder.plane(A)!.standing()).has(BAG_A)).toBe(true);
    expect(holder.plane("not-a-realm")).toBeNull(); expect(holder.realms()).not.toContain("not-a-realm"); holder.dispose();
  });

  // R5
  test("R5 cabal wire lanes require realm standing; control: C keeps its Nexus lane and unknown docs use base", async () => {
    const repo = new Repo({}), membership: NexusMembership = { holdsCarriagePeer: (peer) => peer === "peer-m" };
    const { holder } = makeHolder(repo, { membership, standsInRealm: (peer, realm) => peer === "peer-a" && realm === A });
    await holder.refresh(charter("charter-r5")); const a = await actor(7), b = await actor(8);
    await bag(holder, { bag: BAG_A, realm: A }, a, [[BAG_A, DOC_A]]);
    await bag(holder, { bag: BAG_B, realm: B }, b, [[BAG_B, DOC_B]]);
    const doc = (id: string) => interpretAsDocumentId(id);
    expect(await holder.gate.mayFederate(doc(realmDocUrl(A)), "peer-a")).toBe(true);
    expect(await holder.gate.mayFederate(doc(DOC_A), "peer-a")).toBe(true);
    expect(await holder.gate.mayFederate(doc(realmDocUrl(B)), "peer-a")).toBe(false);
    expect(await holder.gate.mayFederate(doc(DOC_B), "peer-a")).toBe(false);
    expect(await holder.gate.mayFederate(doc(realmDocUrl(A)), "peer-m")).toBe(false);
    expect(await holder.gate.mayFederate(doc(DOC_A), "peer-m")).toBe(false);
    expect(await holder.gate.mayFederate(doc(realmDocUrl(B)), "peer-m")).toBe(false);
    expect(await holder.gate.mayFederate(doc(realmDocUrl(holder.realmId()!)), "peer-m")).toBe(true);
    const baseId = doc(deterministicDocUrl("r5-base"));
    const fallback = makeHolder(new Repo({}), { base: { mayFederate: async (id) => id === baseId } });
    expect(await fallback.holder.gate.mayFederate(baseId, "peer-x")).toBe(true);
    holder.dispose(); fallback.holder.dispose();
  });

  // R6
  test("R6 boards follow realm standing; control: standing in B opens B's boards", async () => {
    const repo = new Repo({}), boards = new Map();
    for (const id of [A, B]) {
      boards.set(interpretAsDocumentId(realmVouchBoardDocUrl(id)), id);
      boards.set(interpretAsDocumentId(realmEdgeBoardDocUrl(id)), id);
    }
    let peerB = false;
    const stands = (peer: string, realm: string) => peer === "peer-a" && (realm === A || (peerB && realm === B));
    const base = new RealmBoardGate(denyAll, () => boards, stands);
    const { holder } = makeHolder(repo, { base, standsInRealm: stands }); await holder.refresh(charter("charter-r6"));
    const aid = await actor(9), bid = await actor(10);
    await bag(holder, { bag: BAG_A, realm: A }, aid, [[BAG_A, DOC_A]]);
    await bag(holder, { bag: BAG_B, realm: B }, bid, [[BAG_B, DOC_B]]);
    for (const url of [realmVouchBoardDocUrl(A), realmEdgeBoardDocUrl(A)]) expect(await holder.gate.mayFederate(interpretAsDocumentId(url), "peer-a")).toBe(true);
    for (const url of [realmVouchBoardDocUrl(B), realmEdgeBoardDocUrl(B)]) expect(await holder.gate.mayFederate(interpretAsDocumentId(url), "peer-a")).toBe(false);
    for (const url of [...[A, B].flatMap((r) => [realmVouchBoardDocUrl(r), realmEdgeBoardDocUrl(r)])]) expect(await holder.gate.mayFederate(interpretAsDocumentId(url), "nobody")).toBe(false);
    expect(await holder.gate.mayFederate(interpretAsDocumentId(realmDocUrl(A)), "peer-a")).toBe(true);
    peerB = true;
    for (const url of [realmVouchBoardDocUrl(B), realmEdgeBoardDocUrl(B)]) expect(await holder.gate.mayFederate(interpretAsDocumentId(url), "peer-a")).toBe(true);
    holder.dispose();
  });

  // R7
  test("R7 cabal holder exposes no key or roster; control: oracle carries exactly three cabal pointers", async () => {
    const repo = new Repo({}), { holder } = makeHolder(repo); await holder.refresh(charter("charter-r7")); await holder.enter(A);
    const who = await actor(13); await bag(holder, { bag: BAG_A, realm: A }, who, [[BAG_A, DOC_A]]);
    const surface = ["gate", "realmId", "nexusAid", "realmUrl", "refresh", "reading", "sealedHere", "standing", "register", "join", "coSign", "dispose"];
    expect(Object.keys(holder.plane(A)!).sort()).toEqual(surface.sort());
    expect(Object.keys(holder).sort()).toEqual([...surface, "realms", "plane", "enter"].sort());
    const doc = await oracleDoc(repo, holder), realmPointers = [realmDocPointer(A), realmStewardPointer(A), realmStandingPointer(A)];
    expect(realmPointers.every((key) => doc.tiddlers[key] !== undefined)).toBe(true);
    expect(Object.keys(doc.tiddlers).filter((key) => key.startsWith(`${realmDocPointer(A).split("/doc/")[0]}/`) && key.includes(encodeURIComponent(A))).sort()).toEqual([...realmPointers].sort());
    holder.dispose();
  });

  // R8
  test("R8 each realm pins its own steward; control: distinct worn keys stay distinct", async () => {
    const repo = new Repo({}), { holder } = makeHolder(repo); await holder.refresh(charter("charter-r8"));
    const c = await actor(11), a = await actor(12);
    await bag(holder, { bag: BAG_A }, c, [[BAG_A, DOC_A]]);
    await bag(holder, { bag: BAG_B, realm: A }, a, [[BAG_B, DOC_B]]);
    const doc = await oracleDoc(repo, holder);
    expect(tiddlerText(doc.tiddlers[realmStewardPointer(holder.realmId()!)])).toBe(c.worn);
    expect(tiddlerText(doc.tiddlers[realmStewardPointer(A)])).toBe(a.worn); holder.dispose();
  });

  // R9
  test("R9 a different genesis re-stands A, which the ledger notes under none, and not B, entered under the Nexus it left; control: A keeps its id", async () => {
    const repo = new Repo({}), { holder } = makeHolder(repo, { realms: () => [A] }); await holder.refresh(charter("charter-old")); await holder.enter(B);
    expect(holder.plane(A)!.nexusAid()).toBe(holder.realmId());
    await holder.refresh(charter("charter-new"));
    expect(holder.realmId()).not.toBe(aidOf("charter-old")); expect(holder.realms()).toContain(A); expect(holder.realms()).not.toContain(B);
    expect(holder.plane(A)!.nexusAid()).toBe(holder.realmId()); expect(holder.plane(A)!.realmId()).toBe(A); holder.dispose();
  });
  // R10
  test("R10 a book two realms both register crosses to a peer EVERY holding realm admits; control: a peer standing in both reads it", async () => {
    const repo = new Repo({});
    const stands = (peer: string, realm: string) => (peer === "peer-a" && realm === A) || (peer === "peer-ab" && (realm === A || realm === B));
    const { holder } = makeHolder(repo, { standsInRealm: stands }); await holder.refresh(charter("charter-r10"));
    const a = await actor(14), b = await actor(15), shared = deterministicDocUrl("r10-shared"), id = interpretAsDocumentId(shared);
    await bag(holder, { bag: BAG_A, realm: A }, a, [[BAG_A, shared]]);
    expect(await holder.gate.mayFederate(id, "peer-a")).toBe(true);          // one holder: A's lane alone answers
    await bag(holder, { bag: BAG_B, realm: B }, b, [[BAG_B, shared]]);
    expect(await holder.gate.mayFederate(id, "peer-a")).toBe(false);         // B's refusal holds
    expect(await holder.gate.mayFederate(id, "peer-ab")).toBe(true);
    holder.dispose();
  });

  // R11
  test("R11 a named plane's gate answers for its own realm alone; control: the holder's gate answers for both", async () => {
    const repo = new Repo({}), stands = (peer: string, realm: string) => peer === "peer-b" && realm === B;
    const { holder } = makeHolder(repo, { standsInRealm: stands }); await holder.refresh(charter("charter-r11"));
    const a = await actor(16), b = await actor(17);
    await bag(holder, { bag: BAG_A, realm: A }, a, [[BAG_A, DOC_A]]);
    await bag(holder, { bag: BAG_B, realm: B }, b, [[BAG_B, DOC_B]]);
    const docB = interpretAsDocumentId(DOC_B);
    expect(await holder.gate.mayFederate(docB, "peer-b")).toBe(true);
    expect(await holder.plane(B)!.gate.mayFederate(docB, "peer-b")).toBe(true);
    expect(await holder.plane(A)!.gate.mayFederate(docB, "peer-b")).toBe(false);
    holder.dispose();
  });

  // R12
  test("R12 a Nexus this vessel left takes every pin with it; control: the cabal realm stands again with its doc pin and its verdict", async () => {
    const repo = new Repo({}), { holder } = makeHolder(repo, { realms: () => [A] }); await holder.refresh(charter("charter-r12-old"));
    const c = await actor(18), a = await actor(19);
    await bag(holder, { bag: BAG_A }, c, [[BAG_A, DOC_A]]);
    await bag(holder, { bag: BAG_B, realm: A }, a, [[BAG_B, DOC_B]]);
    const old = holder.realmId()!;
    const pointers = (id: string) => [realmDocPointer(id), realmStewardPointer(id), realmStandingPointer(id)];
    let doc = await oracleDoc(repo, holder);
    expect(pointers(old).every((k) => doc.tiddlers[k] !== undefined)).toBe(true);
    await holder.refresh(charter("charter-r12-new"));
    doc = await oracleDoc(repo, holder);
    expect(pointers(old).filter((k) => doc.tiddlers[k] !== undefined)).toEqual([]);
    // The cabal realm stands again under the new Nexus with its doc pin and its verdict; its steward pin named a
    // key of the Nexus this vessel left, so it waits on this hand's next seal.
    expect(tiddlerText(doc.tiddlers[realmDocPointer(A)])).toBe(realmDocUrl(A));
    expect(tiddlerText(doc.tiddlers[realmStandingPointer(A)])).toContain(BAG_B);
    expect(doc.tiddlers[realmStewardPointer(A)]).toBeUndefined();
    expect(tiddlerText(doc.tiddlers[REALM_ID_TIDDLER])).toBe(holder.realmId());
    holder.dispose();
  });

  // R13
  test("R13 two acts that name one unentered realm stand one plane and note it once; control: a second realm notes apart", async () => {
    const repo = new Repo({}), noted: string[] = [], { holder } = makeHolder(repo, { noteRealm: async (r) => { noted.push(r); } });
    await holder.refresh(charter("charter-r13"));
    const [one, two] = await Promise.all([holder.enter(A), holder.enter(A)]);
    expect(one).toBe(two); expect(noted).toEqual([A]);
    await holder.enter(B); expect(noted).toEqual([A, B]); holder.dispose();
  });

  // R14
  test("R14 one plane folds one doc at a time; control: every act lands and the pinned verdict matches the realm doc", async () => {
    const repo = new Repo({}), { holder } = makeHolder(repo); await holder.refresh(charter("charter-r14"));
    // Count the folds of realm A that run at once: each act writes the realm doc (a change that folds) and folds again itself.
    let active = 0, most = 0;
    const real = RealmBagGate.prototype.refold;
    const spy = vi.spyOn(RealmBagGate.prototype, "refold").mockImplementation(async function (this: RealmBagGate, doc, realm) {
      if (realm !== A) return real.call(this, doc, realm);
      active += 1; most = Math.max(most, active);
      try { return await real.call(this, doc, realm); } finally { active -= 1; }
    });
    try {
      const who = await actor(20), bags = [0, 1, 2, 3, 4, 5].map((n) => `lar:///ha.ka.ba/bags/r14-${n}`);
      await Promise.all(bags.map((b, n) => bag(holder, { bag: b, realm: A }, who, [[b, deterministicDocUrl(`r14-${n}`)]])));
      expect(most).toBe(1);
      const standing = await holder.plane(A)!.standing();
      expect([...standing.keys()].sort()).toEqual(bags);
      const pinned = JSON.parse(tiddlerText((await oracleDoc(repo, holder)).tiddlers[realmStandingPointer(A)])!) as Array<{ bagUri: string }>;
      expect(pinned.map((r) => r.bagUri).sort()).toEqual(bags);
    } finally { spy.mockRestore(); holder.dispose(); }
  });

  // R15
  test("R15 a realm the ledger failed to note stands nowhere; control: the next entry notes and stands", async () => {
    const repo = new Repo({}); let torn = true; const noted: string[] = [];
    const { holder } = makeHolder(repo, { noteRealm: async (r) => { if (torn) throw new Error("ledger torn"); noted.push(r); } });
    await holder.refresh(charter("charter-r15"));
    await expect(holder.enter(A)).rejects.toThrow("ledger torn");
    expect(holder.plane(A)).toBeNull(); expect(holder.realms()).toEqual([holder.realmId()]);
    expect((await oracleDoc(repo, holder)).tiddlers[realmDocPointer(A)]).toBeUndefined();
    torn = false; await holder.enter(A);
    expect(noted).toEqual([A]); expect(holder.plane(A)).not.toBeNull(); holder.dispose();
  });
  // R16
  test("R16 the vessel's own ledger reads back the realms it noted; control: another vessel's ledger reads none of them", async () => {
    const repo = new Repo({}), mine = "1".repeat(64), other = "2".repeat(64);
    expect(await readVesselRealms(repo, mine)).toEqual([]);
    await noteVesselRealm(repo, mine, A); await noteVesselRealm(repo, mine, B); await noteVesselRealm(repo, mine, A);
    expect([...(await readVesselRealms(repo, mine))].map((n) => n.realm).sort()).toEqual([A, B]);
    expect(await readVesselRealms(repo, other)).toEqual([]);
    // The ledger feeds the holder: a boot stands what the ledger notes.
    const { holder } = makeHolder(repo, { realms: () => readVesselRealms(repo, mine), noteRealm: (r, n) => noteVesselRealm(repo, mine, r, n) });
    await holder.refresh(charter("charter-r16"));
    expect(holder.realms()).toEqual([holder.realmId(), A, B]); holder.dispose();
  });
  // R17
  test("R17 where this vessel's own steward keeps a book, another hand's record in another realm neither opens nor shuts it; control: a book no own hand keeps crosses where every holding realm admits", async () => {
    const repo = new Repo({});
    const stands = (peer: string, realm: string) => (peer === "peer-a" && realm === A) || (peer === "peer-b" && realm === B) || (peer === "peer-ab" && (realm === A || realm === B));
    const { holder } = makeHolder(repo, { standsInRealm: stands }); await holder.refresh(charter("charter-r17"));
    const mine = await actor(21), own = deterministicDocUrl("r17-own"), ownId = interpretAsDocumentId(own);
    await bag(holder, { bag: BAG_A, realm: A }, mine, [[BAG_A, own]]);
    await holder.enter(B);
    // ANOTHER HAND writes a counted record into realm B that names this vessel's own book.
    const foreignSeed = seed(22), foreign = await keyOf(foreignSeed);
    const plant = async (realm: string, bagUri: string, docUrl: string): Promise<void> => {
      const rec = await signRealmBagRegistration({ realmId: realm, bagUri, docUrl, readTier: "contract" }, [{ signer: foreign, sign: signOf(foreignSeed) }]);
      (await repo.find<LarDoc>(realmDocUrl(realm))).change((d) => { writeRealmBagRegistration(d, rec, foreign, true); });
    };
    await plant(B, BAG_B, own); await holder.refresh(charter("charter-r17"));
    expect((await holder.plane(B)!.standing()).get(BAG_B)?.docUrl).toBe(own);       // the record does stand in B
    expect(await holder.gate.mayFederate(ownId, "peer-a")).toBe(true);              // and shuts nothing
    expect(await holder.gate.mayFederate(ownId, "peer-b")).toBe(false);             // and opens nothing
    // CONTROL: a book this vessel only carries answers by every realm that holds it.
    const carried = deterministicDocUrl("r17-carried"), carriedId = interpretAsDocumentId(carried);
    await plant(A, "lar:///ha.ka.ba/bags/r17-x", carried); await plant(B, "lar:///ha.ka.ba/bags/r17-y", carried);
    await holder.refresh(charter("charter-r17"));
    expect(await holder.gate.mayFederate(carriedId, "peer-a")).toBe(false);
    expect(await holder.gate.mayFederate(carriedId, "peer-b")).toBe(false);
    expect(await holder.gate.mayFederate(carriedId, "peer-ab")).toBe(true);
    holder.dispose();
  });

  // R18
  test("R18 a stand that fails leaves the holder inert with no pin; control: the next refresh stands the Nexus and the cabal realm", async () => {
    const repo = new Repo({}), { holder } = makeHolder(repo, { realms: () => [A] });
    const real = RealmBagGate.prototype.refold; let torn = 1;
    const spy = vi.spyOn(RealmBagGate.prototype, "refold").mockImplementation(async function (this: RealmBagGate, doc, realm) {
      if (torn > 0) { torn -= 1; throw new Error("fold torn"); }
      return real.call(this, doc, realm);
    });
    try {
      await expect(holder.refresh(charter("charter-r18"))).rejects.toThrow("fold torn");
      expect(holder.realmId()).toBeNull(); expect(holder.realms()).toEqual([]);
      const doc = await oracleDoc(repo, holder);
      expect(Object.keys(doc.tiddlers).filter((k) => k.includes("/doc/") || k.includes("/standing/"))).toEqual([]);
      await holder.refresh(charter("charter-r18"));
      expect(holder.realmId()).not.toBeNull(); expect(holder.realms()).toEqual([holder.realmId(), A]);
      // A cabal stand that fails stands again at the next refresh, under the Nexus that kept standing.
      await holder.enter(B); torn = 1;
      const who = await actor(23); await bag(holder, { bag: BAG_A, realm: A }, who, [[BAG_A, DOC_A]]); torn = 1;
      await expect(holder.refresh(charter("charter-r18b"))).rejects.toThrow("fold torn");
      expect(holder.realmId()).toBeNull();
      // No realm of the Nexus this vessel left stays readable: every doc pin, steward pin and verdict left with its plane.
      const after = await oracleDoc(repo, holder);
      expect(Object.keys(after.tiddlers).filter((k) => k.includes("/doc/") || k.includes("/standing/") || k.includes("/steward/"))).toEqual([]);
      await holder.refresh(charter("charter-r18b"));
      // B entered under the Nexus this vessel left, so it waits for an act under the next; A, noted under none, stands.
      expect(holder.realms()).toEqual([holder.realmId(), A]);
    } finally { spy.mockRestore(); holder.dispose(); }
  });
  // R19
  test("R19 an entry and a Nexus change each run whole; control: an entry with no Nexus change beside it stands and pins", async () => {
    const repo = new Repo({}); let release: () => void = () => {}; let held = false;
    const gate = new Promise<void>((res) => { release = res; });
    const { holder } = makeHolder(repo, { noteRealm: async () => { if (held) await gate; } });
    await holder.refresh(charter("charter-r19"));
    await holder.enter(B);                                                    // CONTROL: stands and pins
    expect(tiddlerText((await oracleDoc(repo, holder)).tiddlers[realmDocPointer(B)])).toBe(realmDocUrl(B));
    // An entry waits on its ledger note while a Nexus change arrives whose charter plane fails to stand.
    held = true;
    const real = RealmBagGate.prototype.refold; let torn = false;
    const spy = vi.spyOn(RealmBagGate.prototype, "refold").mockImplementation(async function (this: RealmBagGate, doc, realm) {
      if (torn && realm !== A && realm !== B) throw new Error("fold torn");
      return real.call(this, doc, realm);
    });
    try {
      const entry = holder.enter(A).then(() => "entered", () => "refused");
      torn = true;
      let settled = false;
      const change = holder.refresh(charter("charter-r19b")).then(() => "stood", () => "torn").finally(() => { settled = true; });
      for (let turn = 0; turn < 200 && !settled; turn += 1) await new Promise<void>((res) => setImmediate(res));
      release();
      await entry; expect(await change).toBe("torn");
      expect(holder.realmId()).toBeNull(); expect(holder.realms()).toEqual([]);
      const doc = await oracleDoc(repo, holder);
      expect(Object.keys(doc.tiddlers).filter((k) => k.includes("/doc/") || k.includes("/standing/") || k.includes("/steward/"))).toEqual([]);
    } finally { spy.mockRestore(); holder.dispose(); }
  });
  // R20
  test("R20 a refresh under the same Nexus folds every plane again and re-pins nothing; control: the realms stay", async () => {
    const repo = new Repo({}), { holder } = makeHolder(repo); await holder.refresh(charter("charter-r20")); await holder.enter(A);
    const folded: string[] = [], real = RealmBagGate.prototype.refold;
    const spy = vi.spyOn(RealmBagGate.prototype, "refold").mockImplementation(async function (this: RealmBagGate, doc, realm) { folded.push(realm); return real.call(this, doc, realm); });
    try {
      const before = JSON.stringify((await oracleDoc(repo, holder)).tiddlers), realms = holder.realms();
      await holder.refresh(charter("charter-r20"));
      expect([...folded].sort()).toEqual([holder.realmId()!, A].sort());
      expect(JSON.stringify((await oracleDoc(repo, holder)).tiddlers)).toBe(before); expect(holder.realms()).toEqual(realms);
    } finally { spy.mockRestore(); holder.dispose(); }
  });

  // R21
  test("R21 A REALM STANDS UNDER ONE NEXUS: a realm the ledger notes under another Nexus stands no plane here and refuses entry; control: one noted under the standing Nexus stands, and an entry notes it there", async () => {
    const repo = new Repo({}), noted: [string, string][] = [];
    const standing = aidOf("charter-r21"), elsewhere = aidOf("charter-r21-elsewhere");
    const { holder } = makeHolder(repo, {
      realms: () => [{ realm: A, nexus: elsewhere }, { realm: B, nexus: standing }],
      noteRealm: async (r, n) => { noted.push([r, n]); },
    });
    await holder.refresh(charter("charter-r21"));
    expect(holder.realms()).toEqual([standing, B]);
    expect(holder.plane(A)).toBeNull();
    await expect(holder.enter(A)).rejects.toMatchObject({ refusal: "realm-under-another-nexus" });
    expect(holder.plane(A)).toBeNull(); expect(noted).toEqual([]);
    // CONTROL: a realm under no Nexus yet enters here and gets noted under the Nexus that stands.
    const C = "c".repeat(64);
    await holder.enter(C);
    expect(noted).toEqual([[C, standing]]); expect(holder.plane(C)).not.toBeNull(); holder.dispose();
  });
  // R22
  test("R22 a Nexus switch re-stands no realm pinned to the Nexus it left; a conflict stands nowhere; a charter that leaves takes every plane", async () => {
    const repo = new Repo({});
    const first = aidOf("charter-r22-first"), C = "c".repeat(64), D = "d".repeat(64);
    const noted: NotedRealm[] = [{ realm: D, nexus: null, conflict: true }];
    const { holder } = makeHolder(repo, {
      realms: () => noted,
      noteRealm: async (r, n) => { noted.push({ realm: r, nexus: n }); },
    });
    await holder.refresh(charter("charter-r22-first"));
    await holder.enter(A);                      // pinned to the first Nexus
    await holder.enter(C);
    await expect(holder.enter(D)).rejects.toMatchObject({ refusal: "realm-under-another-nexus" });
    expect(holder.realms()).toEqual([first, A, C]);
    // C's pin leaves the ledger (a realm under none): it re-stands under the next Nexus; A stays with the first.
    noted.splice(noted.findIndex((n) => n.realm === C), 1, { realm: C, nexus: null });
    await holder.refresh(charter("charter-r22-next"));
    expect(holder.realms()).toEqual([aidOf("charter-r22-next"), C]);
    expect(holder.plane(A)).toBeNull(); expect(holder.plane(D)).toBeNull();
    // The charter leaves: every plane and pin goes with it.
    await holder.refresh(null);
    expect(holder.realms()).toEqual([]); expect(holder.plane(C)).toBeNull();
    expect((await oracleDoc(repo, holder)).tiddlers[realmDocPointer(C)]).toBeUndefined();
    holder.dispose();
  });
  // R23
  test("R23 a standing realm the ledger comes to read conflicted leaves with its pins, and an entry refuses it; control: an untouched realm keeps standing", async () => {
    const repo = new Repo({}), noted: NotedRealm[] = [];
    const { holder } = makeHolder(repo, { realms: () => noted, noteRealm: async (r, n) => { noted.push({ realm: r, nexus: n }); } });
    await holder.refresh(charter("charter-r23"));
    await holder.enter(A); await holder.enter(B);
    expect(holder.realms()).toEqual([aidOf("charter-r23"), A, B]);
    // A second replica of the ledger met this one: A now carries two pins.
    noted.splice(noted.findIndex((n) => n.realm === A), 1, { realm: A, nexus: null, conflict: true });
    await expect(holder.enter(A)).rejects.toMatchObject({ refusal: "realm-under-another-nexus" });
    await holder.refresh(charter("charter-r23"));
    expect(holder.plane(A)).toBeNull(); expect(holder.realms()).toEqual([aidOf("charter-r23"), B]);
    expect((await oracleDoc(repo, holder)).tiddlers[realmDocPointer(A)]).toBeUndefined();
    holder.dispose();
  });
});
