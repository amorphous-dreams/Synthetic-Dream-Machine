/**
 * realm-steward — THE STEWARD DOOR's vectors, each with its control.
 *
 * The ruling: a scoped face signs acts that belong to one person, and the root never appears publicly. The docker
 * `meme` scenario reads red at "B edits, promotes" while the verb seals with a persona ROOT. D4 holds that
 * scenario as a unit vector through the door, in the order the door's law gives it: a name enters a record by
 * its own hand first, so B ASKS to keep the bag and A consents. D9 and D10 hold the two reds measured on a
 * root-sealing verb.
 *
 * D1 the acting face signs / a vessel of several faces with none named, and one holding no root for the face, refuse by name.
 * D2 the guard classes keys: a root, a vessel key and an unknown key refuse / a second held per-Nexus key passes.
 * D3 the guard's Handle arm reads the chain's opening prefix / a matching chain passes.
 * D4 B asks to keep A's bag with her acting key and A consents: both keep it, and no root and no vessel key
 *    reaches `keptBy`, `signedBy` or the public announce / while B's ask waits, A's registration keeps
 *    standing, B holds no write cap, and a vessel no proposal names refuses.
 * D5 a vessel whose act names no face among several writes nothing / the same vessel lands once the act names one.
 * D6 A NAME ENTERS BY ITS OWN HAND FIRST: a keeping hand that names a key which sealed nothing here refuses
 *    `steward-name-unproven` and writes nothing; a name that reads no class, and this vessel's own root, refuse;
 *    `index` picks no key / a name that already sealed another book of this realm gets proposed.
 * D7 no realm refuses by name / a null plane lists empty.
 * D8 the list names a counted record / it omits a bare proposal.
 * D9 THE PLANE'S OWN GUARD: a root-sealed registration, ask and co-sign refuse inside the plane, and nothing
 *    lands on the realm doc or the public announce / the acting key lands through the same plane.
 * D10 a root never completes a proposal that names the face / the face completes it.
 * D11 a vault that will not read refuses `steward-key-unreadable` at the acting face, at the guard and at the verb,
 *     and writes nothing / the same vault, reading, lands.
 * D12 THREE HANDS: C asks to keep a bag A and B keep; A's consent lands as a proposal that leaves the standing
 *     record standing; B consents to the record that carries the most seals and the widest set stands / an ask
 *     with no standing registration refuses, and so does an ask by a hand that already keeps the bag.
 * D13 CONSENT WIDENS WHO KEEPS A BOOK AND NEVER MOVES THE BOOK: a proposal that names the standing steward over
 *     ANOTHER doc, or at a wider tier, draws no seal from her co-sign, however many seals it carries / the ask
 *     that keeps the standing record's own bytes completes.
 * D14 two different asks wait on one steward: her bare co-sign refuses and lists them, and `with` picks one /
 *     a `with` that names a hand which sealed neither refuses.
 * D15 a record that carries a junk seal never lands over a counted record / the same flow with honest seals
 *     lands the wider record under the counted key.
 * D16 THE WRITE BOUNDARY: the plane's own `register` refuses a proposed name that sealed nothing here, whoever
 *     calls it, and writes nothing / a name that sealed a book of this realm gets proposed.
 * D17 WHERE NO REGISTRATION STANDS a bare co-sign founds nothing: it refuses and asks for the hand it consents
 *     with / `with` names that hand and the first joint registration counts.
 * D18 a charter map listed in another order, in another case, still reads as the same book / an ask that moves
 *     a hand under another charter draws no seal.
 */
import { describe, expect, test } from "vitest";
import * as ed from "@noble/ed25519";
import { Repo } from "@automerge/automerge-repo";
import {
  deterministicDocUrl, emptyLarDoc, hex, mutableLarRecord, proposeRealmBagRegistration, signRealmBagRegistration, writeRealmBagRegistration,
  realmBagKey, realmBagProposalKey, type FederationGate, type LarDoc,
  type NexusMembership, type StewardSigner,
} from "@lararium/mesh";
import { makeRealmPlane } from "../src/realm-plane.js";
import { runRealmBag, runRealmBags, stewardGuard, StewardRefused, faceStewardSigner, type StewardVault } from "../src/realm-steward.js";
import { namedCharter } from "../../lararium-mesh/tests/charter-fixture.js";
import { FaceNotNamed } from "../src/face-selector.js";

const REALM = `nexus-${"e1".repeat(32)}`;
const AID = "nexus-genesis-aid";
const BAG = "lar:///ha.ka.ba/bags/lares";
const DOC = deterministicDocUrl("the-registered-book");
const denyAll: FederationGate = { mayFederate: async () => false };
const noMembers: NexusMembership = { holdsCarriagePeer: () => false };
const seed = (n: number): Uint8Array => new Uint8Array(32).fill(n);
const keyOf = async (s: Uint8Array): Promise<string> => hex(await ed.getPublicKeyAsync(s));
const signOf = (s: Uint8Array) => (bytes: Uint8Array): Promise<string> => ed.signAsync(bytes, s).then(hex);
const idOf = (key: string): string => key.toLowerCase();
const charter = namedCharter(REALM);

interface Actor {
  readonly rootSeed: Uint8Array; readonly root: string; readonly vessel: string;
  readonly actingSeed: Uint8Array; readonly acting: string; readonly secondSeed: Uint8Array; readonly second: string;
  readonly vault: StewardVault; holds: "named" | "unnamed" | "rootless";
}

async function actor(offset: number): Promise<Actor> {
  const rootSeed = seed(offset), vesselSeed = seed(offset + 1), actingSeed = seed(offset + 2), secondSeed = seed(offset + 3);
  const root = await keyOf(rootSeed), vessel = await keyOf(vesselSeed), acting = await keyOf(actingSeed), second = await keyOf(secondSeed);
  const self: Actor = {
    rootSeed, root, vessel, actingSeed, acting, secondSeed, second, holds: "named",
    vault: {
      async faceLeaf() {
        if (self.holds === "unnamed") throw new FaceNotNamed("this vessel stands faces h0, h1 open: name the face the command acts as (--face N)");
        return self.holds === "named" ? { verifyingKey: acting, seed: actingSeed } : null;
      },
      async heldKeys() { return { personaGroupRoots: [root], vesselKeys: [vessel], nexusScopedKeys: [acting, second], veiledHandles: [] }; },
    },
  };
  return self;
}

function standingPlanes(repo: Repo, labels: readonly string[], guardOf?: (label: string) => StewardVault) {
  const entries = labels.map((label) => {
    const crossroads = repo.create<LarDoc>(emptyLarDoc());
    return { crossroads, plane: makeRealmPlane({
    repo, registry: repo.create<LarDoc>(emptyLarDoc()), crossroadsHandle: crossroads,
    membership: noMembers, base: denyAll,
    ...(guardOf ? { stewardGuard: stewardGuard(guardOf(label)) } : {}),
  }) };
  });
  return Promise.all(entries.map(async (entry) => {
    await entry.plane.refresh(charter);
    return entry;
  }));
}

function registryDoc(): LarDoc {
  const doc = emptyLarDoc();
  doc.tiddlers[BAG] = mutableLarRecord(BAG, { text: DOC }, "registry");
  doc.tiddlers[`${BAG}/pending`] = mutableLarRecord(`${BAG}/pending`, { text: deterministicDocUrl("the-pending-book") }, "registry");
  doc.tiddlers[`${BAG}/other`] = mutableLarRecord(`${BAG}/other`, { text: deterministicDocUrl("the-other-book") }, "registry");
  return doc;
}

describe("the realm steward door", () => {
  test("D1 the acting face signs; control: no face named among several, or no root held for it, refuses by name", async () => {
    const a = await actor(1);
    const signer = await faceStewardSigner(AID, a.vault);
    expect(signer.signer).toBe(a.acting);
    const bytes = new Uint8Array([1, 2, 3]);
    const signature = await signer.sign(bytes);
    const signatureBytes = Uint8Array.from(signature.match(/../g)!.map((byte) => Number.parseInt(byte, 16)));
    const publicKeyBytes = Uint8Array.from(a.acting.match(/../g)!.map((byte) => Number.parseInt(byte, 16)));
    expect(await ed.verifyAsync(signatureBytes, bytes, publicKeyBytes)).toBe(true);
    a.holds = "unnamed";
    await expect(faceStewardSigner(AID, a.vault)).rejects.toMatchObject({ refusal: "face-not-named", message: expect.stringContaining("--face N") });
    a.holds = "rootless";
    await expect(faceStewardSigner(AID, a.vault)).rejects.toMatchObject({ refusal: "face-root-absent", message: expect.stringContaining("--face N") });
  });

  test("D2 guard classifies keys; control: second held per-Nexus key passes", async () => {
    const a = await actor(10), guard = stewardGuard(a.vault);
    const as = (signer: string): StewardSigner => ({ signer, sign: signOf(a.actingSeed) });
    await expect(guard(as(a.acting), AID)).resolves.toBeUndefined();
    await expect(guard(as(a.root), AID)).rejects.toMatchObject({ refusal: "steward-key-class", message: expect.stringContaining("persona-group-root") });
    await expect(guard(as(a.vessel), AID)).rejects.toMatchObject({ refusal: "steward-key-class", message: expect.stringContaining("vessel-key") });
    await expect(guard(as("f".repeat(64)), AID)).rejects.toMatchObject({ refusal: "steward-key-class", message: expect.stringContaining("unknown") });
    await expect(guard(as("not-a-key"), AID)).rejects.toMatchObject({ refusal: "steward-name-unreadable" });
    await expect(guard(as(a.second), AID)).resolves.toBeUndefined();
  });

  test("D3 Handle arm checks its opening prefix; control: matching chain passes", async () => {
    const a = await actor(20), guard = stewardGuard(a.vault), handle = `handle-${"a".repeat(64)}`;
    const signer = (chain?: readonly { prefix: string }[]): StewardSigner => ({ signer: handle, sign: signOf(a.actingSeed), ...(chain === undefined ? {} : { chain } as never) });
    await expect(guard(signer(), AID)).rejects.toMatchObject({ refusal: "handle-chain-mismatch" });
    await expect(guard(signer([]), AID)).rejects.toMatchObject({ refusal: "handle-chain-mismatch" });
    await expect(guard(signer([{ prefix: `handle-${"b".repeat(64)}` }]), AID)).rejects.toMatchObject({ refusal: "handle-chain-mismatch" });
    await expect(guard({ ...signer([{ prefix: handle }]), signer: a.acting }, AID)).rejects.toMatchObject({ refusal: "handle-chain-mismatch" });
    await expect(guard(signer([{ prefix: handle }]), AID)).resolves.toBeUndefined();
  });

  test("D4 B asks to keep A's bag and A consents; controls: A's record stands meanwhile, an unnamed C refuses, no private key surfaces", async () => {
    const repo = new Repo({}), [{ plane: planeA, crossroads: crossroadsA }, { plane: planeB, crossroads: crossroadsB }, { plane: planeC }] = await standingPlanes(repo, ["A", "B", "C"]);
    const a = await actor(30), b = await actor(40), c = await actor(50);
    const run = (plane: typeof planeA, who: Actor, args: Record<string, unknown>) => runRealmBag({ plane, args, vault: who.vault,
      registryDocs: () => [registryDoc()] });
    const registered = await run(planeA, a, { bag: BAG });
    expect([registered.counts, registered.keptBy]).toEqual([true, [a.acting]]);
    // B ASKS with her own acting face: the record names the standing steward and herself, sealed by her alone.
    const asked = await run(planeB, b, { bag: BAG, join: true });
    expect([asked.counts, asked.awaiting, asked.signedBy]).toEqual([false, [a.acting], [b.acting]]);
    expect(asked.doc).toBe(registered.doc);                                       // the standing record's own doc
    // The ask rests under B's PROPOSAL key and nowhere else.
    const afterAsk = (await repo.find<LarDoc>(planeA.realmUrl()!)).doc().tiddlers;
    expect(afterAsk[realmBagProposalKey(BAG, b.acting)]).toBeDefined();
    expect(afterAsk[realmBagKey(BAG, b.acting)]).toBeUndefined();
    // CONTROLS while the ask waits: A's registration keeps standing, A alone keeps it, and C co-signs nothing.
    expect((await planeA.standing()).get(BAG)?.keptBy).toEqual([a.acting]);
    expect((await planeB.standing()).get(BAG)?.keptBy).toEqual([a.acting]);
    await expect(run(planeC, c, { bag: BAG, cosign: true })).rejects.toThrow("no standing proposal");
    // A CONSENTS with his own acting face.
    const completed = await run(planeA, a, { bag: BAG, cosign: true });
    expect(completed.counts).toBe(true);
    expect([...completed.keptBy].sort()).toEqual([a.acting, b.acting].sort());
    expect((await planeA.standing()).get(BAG)?.keptBy).toEqual(expect.arrayContaining([a.acting, b.acting]));
    expect((await planeB.standing()).get(BAG)?.keptBy).toEqual(expect.arrayContaining([a.acting, b.acting]));
    const forbidden = [a.root, b.root, c.root, a.vessel, b.vessel, c.vessel];
    expect([...completed.keptBy, ...completed.signedBy].some((key) => forbidden.includes(key))).toBe(false);
    const realmText = JSON.stringify((await repo.find<LarDoc>(planeA.realmUrl()!)).doc().tiddlers);
    const announceText = JSON.stringify([crossroadsA.doc().tiddlers, crossroadsB.doc().tiddlers]);
    expect(forbidden.some((key) => announceText.includes(key) || realmText.includes(key))).toBe(false);
    expect(announceText).toContain(b.acting);                                       // the counted record got announced
    planeA.dispose(); planeB.dispose(); planeC.dispose();
  });

  test("D5 unnamed-face write barrier; control: the same vessel lands once the act names its face", async () => {
    const repo = new Repo({}), [{ plane }] = await standingPlanes(repo, ["A"]), a = await actor(60);
    const before = (await repo.find<LarDoc>(plane.realmUrl()!)).doc().tiddlers;
    a.holds = "unnamed";
    await expect(runRealmBag({ plane, args: { bag: BAG }, registryDocs: () => [registryDoc()], vault: a.vault })).rejects.toMatchObject({ refusal: "face-not-named" });
    expect(Object.keys((await repo.find<LarDoc>(plane.realmUrl()!)).doc().tiddlers)).toHaveLength(Object.keys(before).length);
    a.holds = "named";
    await expect(runRealmBag({ plane, args: { bag: BAG }, registryDocs: () => [registryDoc()], vault: a.vault })).resolves.toMatchObject({ counts: true });
    plane.dispose();
  });

  test("D6 a name enters by its own hand first; control: a name that sealed another book of this realm gets proposed", async () => {
    const repo = new Repo({}), [{ plane }, { plane: planeC }] = await standingPlanes(repo, ["A", "C"]), a = await actor(70), c = await actor(75);
    const run = (args: Record<string, unknown>) => runRealmBag({ plane, args: { bag: BAG, ...args }, registryDocs: () => [registryDoc()], vault: a.vault });
    const realmText = async (): Promise<string> => JSON.stringify((await repo.find<LarDoc>(plane.realmUrl()!)).doc().tiddlers);
    await expect(run({ stewards: ["not-readable"] })).rejects.toMatchObject({ refusal: "steward-name-unreadable" });
    await expect(run({ stewards: [a.root] })).rejects.toMatchObject({ refusal: "steward-key-class" });
    // A key that sealed nothing in this realm: the door cannot class it, so no hand but its own may write it.
    const before = await realmText();
    await expect(run({ stewards: [c.acting] })).rejects.toMatchObject({ refusal: "steward-name-unproven", message: expect.stringContaining("--join") });
    await expect(run({ stewards: [c.root] })).rejects.toMatchObject({ refusal: "steward-name-unproven" });
    expect(await realmText()).toBe(before);
    expect(before).not.toContain(c.acting);
    // CONTROL: C seals a book of her own in this realm; A may then name her, and `index` picks no key.
    await runRealmBag({ plane: planeC, args: { bag: `${BAG}/pending` }, registryDocs: () => [registryDoc()], vault: c.vault });
    const result = await run({ stewards: [c.acting], index: 999 });
    expect(result.signedBy).toEqual([a.acting]);
    expect(result.keptBy).toContain(c.acting);
    expect(result.counts).toBe(false);
    plane.dispose(); planeC.dispose();
  });

  test("D7 null and unstood planes refuse; control: null-plane list is empty", async () => {
    const repo = new Repo({}), [{ plane }] = await standingPlanes(repo, ["A"]), a = await actor(80);
    const unstood = makeRealmPlane({ repo, registry: repo.create<LarDoc>(emptyLarDoc()), crossroadsHandle: repo.create<LarDoc>(emptyLarDoc()), membership: noMembers, base: denyAll });
    const opts = { args: { bag: BAG }, registryDocs: () => [registryDoc()], vault: a.vault };
    await expect(runRealmBag({ plane: null, ...opts })).rejects.toMatchObject({ refusal: "no-realm" });
    await expect(runRealmBag({ plane: unstood, ...opts })).rejects.toMatchObject({ refusal: "no-realm" });
    expect(await runRealmBags({ plane: null })).toEqual({ verb: "realm-bags", realm: null, realmDoc: null, realms: [], bags: [], stewards: [] });
    plane.dispose(); unstood.dispose();
  });

  test("D8 lists counted records and omits bare proposals", async () => {
    const repo = new Repo({}), [{ plane }] = await standingPlanes(repo, ["A"]), a = await actor(90);
    const counted = await runRealmBag({ plane, args: { bag: BAG }, registryDocs: () => [registryDoc()], vault: a.vault });
    // A bare proposal: A proposes his own second face (which sealed a book here) for a bag nobody registered.
    const second: StewardVault = { faceLeaf: async () => ({ verifyingKey: a.second, seed: a.secondSeed }), heldKeys: a.vault.heldKeys };
    await runRealmBag({ plane, args: { bag: `${BAG}/other` }, registryDocs: () => [registryDoc()], vault: second });
    const bare = await runRealmBag({ plane, args: { bag: `${BAG}/pending`, stewards: [a.second] }, registryDocs: () => [registryDoc()], vault: a.vault });
    expect(bare.counts).toBe(false);
    const listed = await runRealmBags({ plane });
    expect(listed.bags.map((row) => row.bag)).toContain(counted.bag);
    expect(listed.bags.map((row) => row.bag)).not.toContain(bare.bag);
    plane.dispose();
  });

  test("D9 the plane's own guard refuses a root-sealed registration, ask and co-sign; control: the acting key lands", async () => {
    const a = await actor(100), b = await actor(110);
    const vaults: Record<string, StewardVault> = { A: a.vault, B: b.vault };
    const repo = new Repo({}), [{ plane: planeA, crossroads }, { plane: planeB }] = await standingPlanes(repo, ["A", "B"], (label) => vaults[label]!);
    const realmDoc = async (): Promise<string> => JSON.stringify((await repo.find<LarDoc>(planeA.realmUrl()!)).doc().tiddlers);
    const before = await realmDoc();
    // A root signer: `signer` names the persona root, and `sign` signs under the root's own seed.
    await expect(planeA.register({ bagUri: BAG, docUrl: DOC, signers: [{ signer: a.root, sign: signOf(a.rootSeed) }] }))
      .rejects.toMatchObject({ refusal: "steward-key-class", message: expect.stringContaining("persona-group-root") });
    expect(await realmDoc()).toBe(before);
    expect(JSON.stringify(crossroads.doc().tiddlers)).not.toContain(a.root);
    // CONTROL: the acting key lands through the same plane.
    await planeA.register({ bagUri: BAG, docUrl: DOC, signers: [{ signer: a.acting, sign: signOf(a.actingSeed) }] });
    const registered = await realmDoc();
    // B's ROOT asking refuses at the guard, before the plane reads any standing record; so does a root co-sign.
    await expect(planeB.join({ bagUri: BAG, signer: b.root, sign: signOf(b.rootSeed) })).rejects.toMatchObject({ refusal: "steward-key-class" });
    expect(await realmDoc()).toBe(registered);
    await planeB.join({ bagUri: BAG, signer: b.acting, sign: signOf(b.actingSeed) });
    const asked = await realmDoc();
    await expect(planeA.coSign({ bagUri: BAG, signer: a.root, sign: signOf(a.rootSeed) })).rejects.toMatchObject({ refusal: "steward-key-class" });
    expect(await realmDoc()).toBe(asked);
    await expect(planeA.coSign({ bagUri: BAG, signer: a.acting, sign: signOf(a.actingSeed) })).resolves.toMatchObject({ keptBy: expect.arrayContaining([a.acting, b.acting]) });
    planeA.dispose(); planeB.dispose();
  });

  test("D10 a root never completes a proposal that names the face; control: the face completes it", async () => {
    // No guard stands on these planes: the proposal's own names refuse a root, whatever a caller's guard reads.
    const repo = new Repo({}), [{ plane: planeA }, { plane: planeB }] = await standingPlanes(repo, ["A", "B"]);
    const a = await actor(120), b = await actor(130);
    await planeA.register({ bagUri: BAG, docUrl: DOC, signers: [{ signer: a.acting, sign: signOf(a.actingSeed) }] });
    await planeB.join({ bagUri: BAG, signer: b.acting, sign: signOf(b.actingSeed) });
    await expect(planeA.coSign({ bagUri: BAG, signer: a.root, sign: signOf(a.rootSeed) })).rejects.toThrow("no standing proposal");
    expect((await planeA.standing()).get(BAG)?.keptBy).toEqual([a.acting]);
    await planeA.coSign({ bagUri: BAG, signer: a.acting, sign: signOf(a.actingSeed) });
    expect((await planeA.standing()).get(BAG)?.keptBy).toEqual(expect.arrayContaining([a.acting, b.acting]));
    planeA.dispose(); planeB.dispose();
  });

  test("D11 a vault that will not read refuses by name and writes nothing; control: the same vault, reading, lands", async () => {
    const repo = new Repo({}), [{ plane }] = await standingPlanes(repo, ["A"]), a = await actor(140);
    let locked = true;
    const vault: StewardVault = {
      async faceLeaf(aid) { if (locked) throw new Error("custody rests at the floor"); return a.vault.faceLeaf(aid); },
      async heldKeys(aid) { if (locked) throw new Error("custody rests at the floor"); return a.vault.heldKeys(aid); },
    };
    const before = JSON.stringify((await repo.find<LarDoc>(plane.realmUrl()!)).doc().tiddlers);
    await expect(faceStewardSigner(AID, vault)).rejects.toMatchObject({ refusal: "steward-key-unreadable", message: expect.stringContaining("custody rests at the floor") });
    await expect(stewardGuard(vault)({ signer: a.acting, sign: signOf(a.actingSeed) }, AID)).rejects.toMatchObject({ refusal: "steward-key-unreadable" });
    await expect(runRealmBag({ plane, args: { bag: BAG }, registryDocs: () => [registryDoc()], vault })).rejects.toMatchObject({ refusal: "steward-key-unreadable" });
    expect(JSON.stringify((await repo.find<LarDoc>(plane.realmUrl()!)).doc().tiddlers)).toBe(before);
    locked = false;
    await expect(runRealmBag({ plane, args: { bag: BAG }, registryDocs: () => [registryDoc()], vault })).resolves.toMatchObject({ counts: true });
    plane.dispose();
  });

  test("D12 three hands: the widest consented set stands, and a half-consented record unseats nothing", async () => {
    const repo = new Repo({}), [{ plane: planeA, crossroads }, { plane: planeB }, { plane: planeC }] = await standingPlanes(repo, ["A", "B", "C"]);
    const a = await actor(150), b = await actor(160), c = await actor(170);
    const run = (plane: typeof planeA, who: Actor, args: Record<string, unknown>) => runRealmBag({ plane, args: { bag: BAG, ...args }, vault: who.vault, registryDocs: () => [registryDoc()] });
    // CONTROL: nothing stands yet, so an ask refuses; and once A keeps the bag, A's own ask refuses.
    await expect(run(planeB, b, { join: true })).rejects.toThrow("no registration stands");
    await run(planeA, a, {});
    await expect(run(planeA, a, { join: true })).rejects.toThrow("already keeps");
    await run(planeB, b, { join: true });
    await run(planeA, a, { cosign: true });
    const two = [a.acting, b.acting].sort();
    expect([...(await planeA.standing()).get(BAG)!.keptBy].sort()).toEqual(two);
    // C asks; A consents first: the record still lacks B, lands as a proposal, and [A, B] keeps standing.
    await run(planeC, c, { join: true });
    const half = await run(planeA, a, { cosign: true });
    expect([half.counts, half.awaiting]).toEqual([false, [b.acting]]);
    expect(JSON.stringify(crossroads.doc().tiddlers)).not.toContain(c.acting);      // a short record announces nothing
    expect([...(await planeB.standing()).get(BAG)!.keptBy].sort()).toEqual(two);
    // B consents to the record that carries the MOST seals (C's and A's), and the widest set stands.
    const whole = await run(planeB, b, { cosign: true });
    expect(whole.counts).toBe(true);
    const three = [a.acting, b.acting, c.acting].sort();
    for (const plane of [planeA, planeB, planeC]) expect([...(await plane.standing()).get(BAG)!.keptBy].sort()).toEqual(three);
    planeA.dispose(); planeB.dispose(); planeC.dispose();
  });

  test("D13 a co-sign never moves the book: another doc, or a wider tier, draws no seal; control: the honest ask completes", async () => {
    const repo = new Repo({}), [{ plane: planeA }, { plane: planeB }] = await standingPlanes(repo, ["A", "B"]);
    const a = await actor(180), b = await actor(190), h = await actor(200);
    const run = (plane: typeof planeA, who: Actor, args: Record<string, unknown>) => runRealmBag({ plane, args: { bag: BAG, ...args }, vault: who.vault, registryDocs: () => [registryDoc()] });
    await run(planeA, a, {});
    const realm = await repo.find<LarDoc>(planeA.realmUrl()!);
    const base = { realmId: REALM, bagUri: BAG, readTier: "contract" as const };
    const hostile = { signer: h.acting, sign: signOf(h.actingSeed) };
    // H plants two proposals that name A: one over ANOTHER doc, one over the standing doc at the PUBLIC tier.
    const moved = await proposeRealmBagRegistration({ ...base, docUrl: deterministicDocUrl("a-rival-book") }, [hostile], [a.acting]);
    const wider = await proposeRealmBagRegistration({ ...base, docUrl: DOC, readTier: "public" }, [hostile], [a.acting]);
    realm.change((d) => { writeRealmBagRegistration(d, moved, h.acting, false); });
    realm.change((d) => { d.tiddlers[`${realmBagProposalKey(BAG, h.acting)}/2`] = mutableLarRecord("x", { text: JSON.stringify(wider) }, REALM); });
    const before = JSON.stringify(realm.doc().tiddlers);
    await expect(run(planeA, a, { cosign: true })).rejects.toThrow("no standing proposal");
    expect(JSON.stringify(realm.doc().tiddlers)).toBe(before);
    expect((await planeA.standing()).get(BAG)).toMatchObject({ docUrl: DOC, readTier: "contract", keptBy: [a.acting] });
    // A proposal that keeps the book's bytes and names A, sealed by nobody whose seal verifies: nothing to consent to.
    const unsealed = await proposeRealmBagRegistration({ ...base, docUrl: DOC }, [hostile], [a.acting]);
    realm.change((d) => { d.tiddlers[`${realmBagProposalKey(BAG, h.acting)}/3`] = mutableLarRecord("y", { text: JSON.stringify({ ...unsealed, signatures: [{ signer: h.acting, sig: "00".repeat(64) }] }) }, REALM); });
    await expect(run(planeA, a, { cosign: true })).rejects.toThrow("no standing proposal");
    // CONTROL: B's honest ask keeps the standing record's own bytes, and A's co-sign completes it.
    await run(planeB, b, { join: true });
    const done = await run(planeA, a, { cosign: true });
    expect([done.counts, done.doc, done.readTier]).toEqual([true, DOC, "contract"]);
    expect([...done.keptBy].sort()).toEqual([a.acting, b.acting].sort());
    planeA.dispose(); planeB.dispose();
  });

  test("D14 two different asks wait on one steward: a bare co-sign refuses and lists them, and `with` picks one", async () => {
    const repo = new Repo({}), [{ plane: planeA }, { plane: planeB }, { plane: planeC }] = await standingPlanes(repo, ["A", "B", "C"]);
    const a = await actor(210), b = await actor(220), c = await actor(230);
    const run = (plane: typeof planeA, who: Actor, args: Record<string, unknown>) => runRealmBag({ plane, args: { bag: BAG, ...args }, vault: who.vault, registryDocs: () => [registryDoc()] });
    await run(planeA, a, {});
    await run(planeB, b, { join: true });
    await run(planeC, c, { join: true });
    await expect(run(planeA, a, { cosign: true })).rejects.toThrow(/2 different proposals.*--with/);
    expect((await planeA.standing()).get(BAG)?.keptBy).toEqual([a.acting]);
    // A `with` that names a hand which sealed neither ask finds nothing to consent to.
    await expect(run(planeA, a, { cosign: true, with: "f".repeat(64) })).rejects.toThrow("no standing proposal");
    const done = await run(planeA, a, { cosign: true, with: c.acting });
    expect(done.counts).toBe(true);
    expect([...done.keptBy].sort()).toEqual([a.acting, c.acting].sort());
    planeA.dispose(); planeB.dispose(); planeC.dispose();
  });

  test("D15 a record that carries a junk seal never lands over a counted record", async () => {
    const repo = new Repo({}), [{ plane: planeA }] = await standingPlanes(repo, ["A"]);
    const a = await actor(240), b = await actor(250), c = await actor(260);
    const run = (who: Actor, args: Record<string, unknown>) => runRealmBag({ plane: planeA, args: { bag: BAG, ...args }, vault: who.vault, registryDocs: () => [registryDoc()] });
    await run(a, {});
    const realm = await repo.find<LarDoc>(planeA.realmUrl()!);
    const counted = JSON.stringify(realm.doc().tiddlers[realmBagKey(BAG, a.acting)]);
    // A proposal that names A, B and C: B's seal verifies, C's reads as junk. With A's seal it would carry
    // three seals for three names and count nothing.
    const proposal = await proposeRealmBagRegistration({ realmId: REALM, bagUri: BAG, docUrl: DOC, readTier: "contract" }, [{ signer: b.acting, sign: signOf(b.actingSeed) }], [a.acting, c.acting]);
    const junk = { ...proposal, signatures: [...proposal.signatures, { signer: c.acting, sig: "00".repeat(64) }] };
    realm.change((d) => { writeRealmBagRegistration(d, junk, b.acting, false); });
    const half = await run(a, { cosign: true });
    // The report reads VERIFIED seals: three names, two that sealed, and C still awaited.
    expect([half.keptBy.length, [...half.signedBy].sort(), half.counts, half.awaiting]).toEqual([3, [a.acting, b.acting].sort(), false, [c.acting]]);
    // It landed under A's PROPOSAL key: A's counted record keeps its bytes and keeps standing.
    expect(JSON.stringify(realm.doc().tiddlers[realmBagKey(BAG, a.acting)])).toBe(counted);
    expect(realm.doc().tiddlers[realmBagProposalKey(BAG, a.acting)]).toBeDefined();
    expect((await planeA.standing()).get(BAG)?.keptBy).toEqual([a.acting]);
    planeA.dispose();
  });

  test("D16 the plane's own register refuses a proposed name that sealed nothing here; control: a sealed name lands", async () => {
    const repo = new Repo({}), [{ plane: planeA }, { plane: planeB }] = await standingPlanes(repo, ["A", "B"]);
    const a = await actor(270), b = await actor(280);
    const realm = await repo.find<LarDoc>(planeA.realmUrl()!);
    const before = JSON.stringify(realm.doc().tiddlers);
    const signers = [{ signer: a.acting, sign: signOf(a.actingSeed) }];
    await expect(planeA.register({ bagUri: BAG, docUrl: DOC, signers, propose: [b.acting] })).rejects.toMatchObject({ refusal: "steward-name-unproven" });
    await expect(planeA.register({ bagUri: BAG, docUrl: DOC, signers, propose: [b.root] })).rejects.toMatchObject({ refusal: "steward-name-unproven" });
    expect(JSON.stringify(realm.doc().tiddlers)).toBe(before);
    // CONTROL: B seals a book of her own here; the plane then takes her name on A's proposal.
    await planeB.register({ bagUri: `${BAG}/other`, docUrl: deterministicDocUrl("the-other-book"), signers: [{ signer: b.acting, sign: signOf(b.actingSeed) }] });
    const rec = await planeA.register({ bagUri: BAG, docUrl: DOC, signers, propose: [b.acting] });
    expect([...rec.keptBy].sort()).toEqual([a.acting, b.acting].sort());
    planeA.dispose(); planeB.dispose();
  });

  test("D17 where no registration stands a bare co-sign founds nothing; control: `with` names the hand and it counts", async () => {
    const repo = new Repo({}), [{ plane: planeA }, { plane: planeB }] = await standingPlanes(repo, ["A", "B"]);
    const a = await actor(290), b = await actor(300), h = await actor(310);
    const realm = await repo.find<LarDoc>(planeA.realmUrl()!);
    // H plants a proposal for a bag NOBODY registered, naming A and sealed by H's own key.
    const planted = await proposeRealmBagRegistration({ realmId: REALM, bagUri: BAG, docUrl: deterministicDocUrl("a-planted-book"), readTier: "public" }, [{ signer: h.acting, sign: signOf(h.actingSeed) }], [a.acting]);
    realm.change((d) => { writeRealmBagRegistration(d, planted, h.acting, false); });
    const before = JSON.stringify(realm.doc().tiddlers);
    const run = (plane: typeof planeA, who: Actor, args: Record<string, unknown>) => runRealmBag({ plane, args: { bag: BAG, ...args }, vault: who.vault, registryDocs: () => [registryDoc()] });
    await expect(run(planeA, a, { cosign: true })).rejects.toThrow(/no registration stands.*--with/);
    expect(JSON.stringify(realm.doc().tiddlers)).toBe(before);
    expect((await planeA.standing()).has(BAG)).toBe(false);
    // CONTROL: B sealed another book here, proposes a first joint registration that names A, and A consents WITH B.
    await runRealmBag({ plane: planeB, args: { bag: `${BAG}/other` }, vault: b.vault, registryDocs: () => [registryDoc()] });
    await runRealmBag({ plane: planeA, args: { bag: `${BAG}/pending` }, vault: a.vault, registryDocs: () => [registryDoc()] });
    const first = await runRealmBag({ plane: planeB, args: { bag: `${BAG}/joint`, stewards: [a.acting], charters: { [b.acting]: "another-charter", [a.acting]: "third-charter" } }, vault: b.vault,
      registryDocs: () => { const d = registryDoc(); d.tiddlers[`${BAG}/joint`] = mutableLarRecord("j", { text: deterministicDocUrl("the-joint-book") }, "registry"); return [d]; } });
    expect(first.counts).toBe(false);
    await expect(runRealmBag({ plane: planeA, args: { bag: `${BAG}/joint`, cosign: true }, vault: a.vault, registryDocs: () => [registryDoc()] })).rejects.toThrow(/no registration stands/);
    const done = await runRealmBag({ plane: planeA, args: { bag: `${BAG}/joint`, cosign: true, with: b.acting }, vault: a.vault, registryDocs: () => [registryDoc()] });
    expect(done.counts).toBe(true);
    planeA.dispose(); planeB.dispose();
  });

  test("D18 a charter map listed in another order still reads as the same book; control: another charter refuses", async () => {
    const repo = new Repo({}), [{ plane: planeA }] = await standingPlanes(repo, ["A"]);
    const a = await actor(320), b = await actor(330), c = await actor(340);
    const realm = await repo.find<LarDoc>(planeA.realmUrl()!);
    const seal = (who: Actor) => ({ signer: who.acting, sign: signOf(who.actingSeed) });
    const parts = { realmId: REALM, bagUri: BAG, docUrl: DOC, readTier: "contract" as const };
    // [A, B] stands, each hand under a charter of its own.
    const stands = await signRealmBagRegistration({ ...parts, charters: { [a.acting]: "charter-one", [b.acting]: "charter-two" } }, [seal(a), seal(b)]);
    realm.change((d) => { writeRealmBagRegistration(d, stands, a.acting, true); });
    expect((await planeA.standing()).get(BAG)?.keptBy).toHaveLength(2);
    // C asks over the SAME map, listed in the other order, upper-case names and all.
    const ask = await proposeRealmBagRegistration({ ...parts, charters: { [b.acting.toUpperCase()]: "charter-two", [a.acting]: "charter-one" } }, [seal(c)], [a.acting, b.acting]);
    // CONTROL: an ask that moves B under another charter draws no seal.
    const moved = await proposeRealmBagRegistration({ ...parts, charters: { [a.acting]: "charter-one", [b.acting]: "charter-three" } }, [seal(c)], [a.acting, b.acting]);
    realm.change((d) => { writeRealmBagRegistration(d, moved, c.acting, false); });
    await expect(planeA.coSign({ bagUri: BAG, ...seal(a) })).rejects.toThrow("no standing proposal");
    realm.change((d) => { d.tiddlers[`${realmBagProposalKey(BAG, c.acting)}/2`] = mutableLarRecord("z", { text: JSON.stringify(ask) }, REALM); });
    const half = await planeA.coSign({ bagUri: BAG, ...seal(a) });
    expect([...half.signatures.map((s) => s.signer)].sort()).toEqual([a.acting, c.acting].sort());
    planeA.dispose();
  });

  test("D19 realm-bags reports ROOTS for a co-signed standing; controls: a one-steward standing and the null plane report none", async () => {
    const repo = new Repo({}), [{ plane: planeA }, { plane: planeB }] = await standingPlanes(repo, ["A", "B"]);
    const a = await actor(120), b = await actor(130);
    const run = (plane: typeof planeA, who: Actor, args: Record<string, unknown>) => runRealmBag({ plane, args, vault: who.vault,
      registryDocs: () => [registryDoc()] });
    await run(planeA, a, { bag: BAG });
    // CONTROL: one hand's own book co-signs nobody.
    expect((await runRealmBags({ plane: planeA })).stewards).toEqual([]);
    await run(planeB, b, { bag: BAG, join: true });
    await run(planeA, a, { bag: BAG, cosign: true });
    const listed = await runRealmBags({ plane: planeA });
    expect(listed.stewards).toEqual([a.acting, b.acting].sort().map((name) => ({ name, bags: [BAG] })));
    expect((await runRealmBags({ plane: null })).stewards).toEqual([]);
    planeA.dispose(); planeB.dispose();
  });
});
