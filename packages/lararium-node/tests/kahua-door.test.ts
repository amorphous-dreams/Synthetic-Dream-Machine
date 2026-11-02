/**
 * kahua-door — the node's door onto a face's kahua stage: the once-per-face mint and its pin, the cap and the grant
 * before every lift and withdraw, the proposal on the intents plane, and the facet the stage rides to the face's sessions.
 *
 * Each red stands beside a CONTROL through the same door. Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { describe, expect, test } from "vitest";
import * as Automerge from "@automerge/automerge";
import { Repo, generateAutomergeUrl, interpretAsDocumentId, type AutomergeUrl, type DocHandle } from "@automerge/automerge-repo";
import {
  DAEMON_BAG_ID, KAHUA_BAG, KAHUA_PLANE, isFaceScopedBag, personaMembershipEntries, PERSONA_GROUP_ID_TIDDLER, SessionDocumentView, emptyLarDoc, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed,
  faceIntentVerbs, intentEntryRecordsOfGroup, kahuaBodyDigest, kahuaPlaneUrl, kahuaStageDocUrl, makeHandLineage, personaActRecordsOfGroup, personaBagIdFor,
  personaSiblingBagIds, projectPersonaLog, signFoundingLog, signPersonaAct, signsAtEpoch, buildKahuaProposal, intentId, writeIntentEntry, storedLarRecord, tiddlerText, writePersonaAct, type LarDoc,
} from "@lararium/mesh";
import { kahuaDoor, KahuaRefused, pinKahuaAtBoot, type KahuaBootPorts, type KahuaDoorPorts } from "../src/kahua-door.js";
import { bridgeBooks, faceFleetFacets, faceFleetViews } from "../src/face-fleet-view.js";

const who = async (n: number) => {
  const seed = new Uint8Array(32).fill(n);
  return { key: await ed25519VerifyingKeyFromSeed(seed), sign: ed25519SignerFromSeed(seed) };
};
const GROUP = "kahua-scratch-face";

async function face() {
  const repo = new Repo({ network: [] });
  const root = await who(7), atomA = await who(8), atomB = await who(9);
  const lineage = makeHandLineage([{ epoch: 0, signers: [root.key], threshold: 1 }])!;
  const persona = repo.create<LarDoc>(emptyLarDoc()), intents = repo.create<LarDoc>(emptyLarDoc());
  const acts = await signFoundingLog({ group: GROUP, personaKelPrefix: "E".repeat(44), rootCommitment: "c", epoch: 0,
    planes: { persona: persona.url, intents: intents.url }, deviceKey: atomA.key, edgeDigest: "d" }, root);
  persona.change((d) => { for (const a of acts) writePersonaAct(d, a); });
  const catalog: Record<string, string> = {};
  const ports = (over: Partial<KahuaDoorPorts> = {}): KahuaDoorPorts => ({
    repo, group: GROUP, verbs: faceIntentVerbs(),
    projection: () => projectPersonaLog(personaActRecordsOfGroup(persona.doc(), GROUP), { group: GROUP, lineage, authorize: () => true }),
    epoch: () => 0, currentSigner: (key) => key === root.key, atom: atomA, persona, intents,
    rootSigner: async () => root, cap: async () => ({ held: true }),
    register: (bagId, url) => { catalog[bagId] = url; }, session: () => "cli-session-1",
    ...over,
  });
  return { repo, root, atomA, atomB, persona, intents, catalog, ports, lineage };
}
const planeActs = (persona: DocHandle<LarDoc>, url: string) =>
  personaActRecordsOfGroup(persona.doc(), GROUP).filter((r) => (r as { body: Record<string, unknown> }).body["plane"] === KAHUA_PLANE && (r as { body: Record<string, unknown> }).body["url"] === url);

describe("the stage pin", () => {
  test("RED: a second mint no-ops and a second device of the face adopts the same url; CONTROL: the first mint pins one plane act", async () => {
    const f = await face();
    const first = await kahuaDoor(f.ports()).mint();
    expect(first.minted).toBe(true);
    expect(planeActs(f.persona, first.url)).toHaveLength(1);
    expect(f.catalog[KAHUA_BAG]).toBe(first.url);
    const again = await kahuaDoor(f.ports()).mint();
    expect(again).toEqual({ url: first.url, minted: false });
    // Device B reads the same synced persona log: it adopts the url and signs nothing, even holding a root signer.
    const deviceB = await kahuaDoor(f.ports({ atom: f.atomB })).mint();
    expect(deviceB).toEqual({ url: first.url, minted: false });
    expect(planeActs(f.persona, first.url)).toHaveLength(1);
  });

  test("RED: two hearths that mint at once, each offline at one head, never fork the face log: the founding hearth pins and the other adopts; CONTROL: the pin names the face's derived stage", async () => {
    const f = await face();
    // Hearth B holds the same face: a replica of its persona plane and the same root in custody.
    const repoB = new Repo({ network: [] });
    const personaB = repoB.import<LarDoc>(Automerge.save(f.persona.doc()), { docId: f.persona.documentId });
    const intentsB = repoB.import<LarDoc>(Automerge.save(f.intents.doc()), { docId: f.intents.documentId });
    const doorB = kahuaDoor(f.ports({ repo: repoB, persona: personaB, intents: intentsB, atom: f.atomB,
      projection: () => projectPersonaLog(personaActRecordsOfGroup(personaB.doc(), GROUP), { group: GROUP, lineage: f.lineage, authorize: () => true }) }));
    const [a, refused] = await Promise.all([kahuaDoor(f.ports()).mint(), doorB.mint().then(() => null, (e: Error) => e.message)]);
    expect(refused).toMatch(/kahua-mint-founder-hearth/);
    f.persona.merge(personaB); personaB.merge(f.persona);
    const b = await doorB.mint();
    expect(b.minted).toBe(false);
    const projection = f.ports().projection();
    expect(projection.fork).toBeNull();
    expect(a.url).toBe(kahuaStageDocUrl(GROUP));
    expect(b.url).toBe(a.url);
    expect(planeActs(f.persona, a.url)).toHaveLength(1);
    expect(kahuaPlaneUrl(projection, GROUP)).toBe(a.url);
  });

  test("RED: a mint with no root in hand refuses by name and pins nothing; CONTROL: an unpinned face lists nothing and refuses a lift by naming the mint", async () => {
    const f = await face();
    await expect(kahuaDoor(f.ports({ rootSigner: async () => { throw new Error("locked"); } })).mint()).rejects.toThrow(/operator-grant-absent/);
    expect(f.catalog[KAHUA_BAG]).toBeUndefined();
    await expect(kahuaDoor(f.ports()).lift({ title: "t", text: "x", taint: [], sources: [{ title: "d", revision: "r" }] })).rejects.toThrow(/kahua-unpinned/);
  });
});

describe("the mint fence", () => {
  test("RED: two replicas of one face one act apart (one holds an admission the other lacks) both holding the root mint offline, then merge: the log never forks and reads ONE pin; CONTROL: the non-founding device adopts that pin once synced, and sequential mints no-op", async () => {
    const f = await face();
    // Device B's replica of the face's log, offline from A until the merge; A's replica takes one admission B never sees.
    const repoB = new Repo({ network: [] });
    const personaB = repoB.import<LarDoc>(Automerge.save(f.persona.doc()), { docId: f.persona.documentId });
    const intentsB = repoB.import<LarDoc>(Automerge.save(f.intents.doc()), { docId: f.intents.documentId });
    const third = await who(10);
    const headA = f.ports().projection().head;
    const admissionAct = await signPersonaAct(headA, { group: GROUP, act: "admission", epoch: 0, fields: { deviceKey: third.key } }, f.root);
    f.persona.change((d) => writePersonaAct(d, admissionAct));
    const catalogB: Record<string, string> = {};
    const deviceB = kahuaDoor(f.ports({ repo: repoB, persona: personaB, intents: intentsB, atom: f.atomB,
      projection: () => projectPersonaLog(personaActRecordsOfGroup(personaB.doc(), GROUP), { group: GROUP, lineage: f.lineage, authorize: () => true }),
      register: (bagId, url) => { catalogB[bagId] = url; } }));
    const [onA, onB] = await Promise.allSettled([kahuaDoor(f.ports()).mint(), deviceB.mint()]);
    f.persona.merge(personaB); personaB.merge(f.persona);
    const projection = f.ports().projection();
    expect(projection.fork).toBeNull();
    expect(planeActs(f.persona, kahuaStageDocUrl(GROUP))).toHaveLength(1);
    expect(onA).toMatchObject({ status: "fulfilled", value: { url: kahuaStageDocUrl(GROUP), minted: true } });
    expect(onB).toMatchObject({ status: "rejected", reason: { message: expect.stringMatching(/kahua-mint-founder-hearth/) } });
    expect(await deviceB.mint()).toEqual({ url: kahuaStageDocUrl(GROUP), minted: false });
    expect(catalogB[KAHUA_BAG]).toBe(kahuaStageDocUrl(GROUP));
    expect(await kahuaDoor(f.ports()).mint()).toEqual({ url: kahuaStageDocUrl(GROUP), minted: false });
  });
});

describe("the founding hearth's boot pins a face founded before kahua", () => {
  // The fixture's founding log names the persona and intents planes alone: a face founded before its stage existed.
  const boot = (f: Awaited<ReturnType<typeof face>>, over: Partial<KahuaBootPorts> & { reads?: { n: number } } = {}): KahuaBootPorts => {
    const reads = over.reads ?? { n: 0 };
    const base = f.ports();
    return {
      repo: base.repo, group: GROUP, projection: base.projection, epoch: base.epoch, currentSigner: base.currentSigner,
      atom: f.atomA.key, persona: f.persona,
      rootSigner: async () => { reads.n++; return f.root; },
      ...over,
    };
  };

  test("RED: the founding hearth's boot mints the stage under the root its custody holds: one plane act at the derived url", async () => {
    const f = await face();
    expect(await pinKahuaAtBoot(boot(f))).toEqual({ url: kahuaStageDocUrl(GROUP), minted: true });
    expect(planeActs(f.persona, kahuaStageDocUrl(GROUP))).toHaveLength(1);
    expect(kahuaPlaneUrl(f.ports().projection(), GROUP)).toBe(kahuaStageDocUrl(GROUP));
    expect(f.ports().projection().fork).toBeNull();
  });

  test("CONTROL: a second boot of the founding hearth no-ops: one plane act, and the root stays sealed", async () => {
    const f = await face();
    await pinKahuaAtBoot(boot(f));
    const reads = { n: 0 };
    expect(await pinKahuaAtBoot(boot(f, { reads }))).toEqual({ url: kahuaStageDocUrl(GROUP), minted: false });
    expect(reads.n).toBe(0);
    expect(planeActs(f.persona, kahuaStageDocUrl(GROUP))).toHaveLength(1);
  });

  test("CONTROL: a device that is not the founding hearth never mints at boot and never opens a root, then adopts the founder's pin once its replica holds it", async () => {
    const f = await face();
    const repoB = new Repo({ network: [] });
    const personaB = repoB.import<LarDoc>(Automerge.save(f.persona.doc()), { docId: f.persona.documentId });
    const reads = { n: 0 };
    const deviceB = boot(f, { reads, repo: repoB, persona: personaB, atom: f.atomB.key,
      projection: () => projectPersonaLog(personaActRecordsOfGroup(personaB.doc(), GROUP), { group: GROUP, lineage: f.lineage, authorize: () => true }) });
    expect(await pinKahuaAtBoot(deviceB)).toEqual({ url: null, minted: false });
    expect(reads.n).toBe(0);
    expect(planeActs(personaB, kahuaStageDocUrl(GROUP))).toHaveLength(0);
    await pinKahuaAtBoot(boot(f));
    personaB.merge(f.persona);
    expect(await pinKahuaAtBoot(deviceB)).toEqual({ url: kahuaStageDocUrl(GROUP), minted: false });
    expect(reads.n).toBe(0);
    expect(planeActs(personaB, kahuaStageDocUrl(GROUP))).toHaveLength(1);
  });

  test("CONTROL: a founding hearth whose custody holds no root, or a root the face's roster no longer seats, signs nothing and the boot stands", async () => {
    const f = await face();
    expect(await pinKahuaAtBoot(boot(f, { rootSigner: async () => null }))).toEqual({ url: null, minted: false });
    const stranger = await who(11);
    expect(await pinKahuaAtBoot(boot(f, { rootSigner: async () => stranger }))).toEqual({ url: null, minted: false });
    expect(planeActs(f.persona, kahuaStageDocUrl(GROUP))).toHaveLength(0);
  });
});

describe("the lift and withdraw doors", () => {
  const src = [{ title: "daemon/t", revision: "r1" }];
  test("RED: a lift without the operator's grant refuses by name, and the atom's hand (the AI seat) never stands in for it; CONTROL: the root lifts", async () => {
    const f = await face();
    await kahuaDoor(f.ports()).mint();
    await expect(kahuaDoor(f.ports({ rootSigner: async () => { throw new Error("custody locked"); } })).lift({ title: "t", text: "x", taint: [], sources: src })).rejects.toThrow(/operator-grant-absent/);
    await expect(kahuaDoor(f.ports({ rootSigner: async () => f.atomA })).lift({ title: "t", text: "x", taint: [], sources: src })).rejects.toThrow(/operator-grant-absent/);
    const lifted = await kahuaDoor(f.ports()).lift({ title: "t", text: "x", taint: [], sources: src });
    expect((await kahuaDoor(f.ports()).get("t"))?.heads[0]?.cid).toBe(lifted.cid);
  });

  test("RED: the lōkahi cap gates apart from the grant: no island reads it, or the face does not hold it, and the lift refuses; CONTROL: held, it lifts", async () => {
    const f = await face();
    await kahuaDoor(f.ports()).mint();
    await expect(kahuaDoor(f.ports({ cap: null })).lift({ title: "t", text: "x", taint: [], sources: src })).rejects.toThrow(/lokahi-cap-unread/);
    await expect(kahuaDoor(f.ports({ cap: async () => ({ held: false, reason: "not a member" }) })).lift({ title: "t", text: "x", taint: [], sources: src })).rejects.toThrow(/lokahi-cap-absent/);
    await expect(kahuaDoor(f.ports({ cap: async () => ({ held: false }) })).withdraw("a".repeat(64))).rejects.toThrow(/lokahi-cap-absent/);
    expect((await kahuaDoor(f.ports()).list())).toEqual([]);
    await kahuaDoor(f.ports()).lift({ title: "t", text: "x", taint: [], sources: src });
    expect((await kahuaDoor(f.ports()).list()).map((i) => i.title)).toEqual(["t"]);
  });

  test("RED: a lift carrying no taint list or no source refuses; CONTROL: an explicit empty taint list lifts", async () => {
    const f = await face();
    await kahuaDoor(f.ports()).mint();
    await expect(kahuaDoor(f.ports()).lift({ title: "t", text: "x", sources: src } as never)).rejects.toThrow(/taint/);
    await expect(kahuaDoor(f.ports()).lift({ title: "t", text: "x", taint: [], sources: [] })).rejects.toThrow(/sources/);
    await expect(kahuaDoor(f.ports()).lift({ title: "t", text: "x", taint: [], sources: src })).resolves.toMatchObject({ cid: expect.any(String) });
  });

  test("RED: a lift whose parent is not the head surfaces a sibling; CONTROL: a lift naming no parent supersedes the standing head", async () => {
    const f = await face();
    const door = kahuaDoor(f.ports());
    await door.mint();
    const v1 = await door.lift({ title: "t", text: "v1", taint: [], sources: src });
    const v2 = await door.lift({ title: "t", text: "v2", taint: [], sources: src });
    expect(v2.parent).toBe(v1.cid);
    expect(await door.get("t")).toMatchObject({ status: "standing", heads: [{ cid: v2.cid }] });
    const stale = await door.lift({ title: "t", text: "v2-elsewhere", taint: [], sources: src, parent: v1.cid });
    const read = await door.get("t");
    expect(read?.status).toBe("siblings");
    expect(read?.heads.map((h) => h.cid).sort()).toEqual([v2.cid, stale.cid].sort());
    await expect(door.lift({ title: "t", text: "v3", taint: [], sources: src })).rejects.toThrow(/siblings/);
  });

  test("RED: a withdraw drops the item from list and get while history keeps it; CONTROL: a withdraw naming no held revision refuses", async () => {
    const f = await face();
    const door = kahuaDoor(f.ports());
    await door.mint();
    const lifted = await door.lift({ title: "t", text: "x", taint: [], sources: src });
    await expect(door.withdraw("b".repeat(64))).rejects.toThrow(/withdraw-unknown/);
    await door.withdraw(lifted.cid);
    expect(await door.list()).toEqual([]);
    expect(await door.get("t")).toBeNull();
    expect(await door.history("t")).toMatchObject([{ cid: lifted.cid, withdrawn: true }]);
    // A second device reading the synced stage reads the same.
    expect(await kahuaDoor(f.ports({ atom: f.atomB })).list()).toEqual([]);
  });
});

describe("the proposal", () => {
  test("RED: a lift naming a proposal whose digest differs refuses; CONTROL: the matching body lifts with the proposer's origin and taint, and an outcome answers the proposal", async () => {
    const f = await face();
    const door = kahuaDoor(f.ports());
    await door.mint();
    const proposed = await door.propose({ proposals: [{ title: "t", revision: "r9", text: "proposed body", taint: ["web:example"] }] });
    expect(intentEntryRecordsOfGroup(f.intents.doc(), GROUP)).toHaveLength(1);
    await expect(door.lift({ title: "t", text: "swapped body", taint: [], sources: [{ title: "t", revision: "r9" }], proposal: proposed.id })).rejects.toThrow(/proposal-digest/);
    const lifted = await door.lift({ title: "t", text: "proposed body", taint: [], sources: [{ title: "t", revision: "r9" }], proposal: proposed.id });
    const head = (await door.get("t"))!.heads[0]!;
    expect(head).toMatchObject({ cid: lifted.cid, origin: { seat: f.atomA.key, device: f.atomA.key }, taint: ["web:example"], proposal: proposed.id });
    expect(kahuaBodyDigest("proposed body")).toMatch(/^[0-9a-f]{64}$/);
    const entries = intentEntryRecordsOfGroup(f.intents.doc(), GROUP) as { body: Record<string, unknown> }[];
    expect(entries.filter((e) => e.body["entry"] === "outcome" && e.body["cause"] === proposed.id)).toHaveLength(1);
  });
});

describe("the proposal replay guard", () => {
  test("RED: a lift citing a proposal whose issuer the face never admitted refuses, even with a matching digest; CONTROL: the admitted atom's proposal lifts", async () => {
    const f = await face();
    const door = kahuaDoor(f.ports());
    await door.mint();
    const stranger = await who(42);
    const entry = await buildKahuaProposal({ group: GROUP, signer: stranger, session: "s-x", nonce: "n-x", verbs: faceIntentVerbs(),
      proposals: [{ title: "t", revision: "r1", digest: kahuaBodyDigest("body"), taint: [] }] });
    f.intents.change((d) => writeIntentEntry(d, entry));
    const foreign = intentId(entry.body as never);
    await expect(door.lift({ title: "t", text: "body", taint: [], sources: [{ title: "t", revision: "r1" }], proposal: foreign })).rejects.toThrow(/proposal-unknown/);
    expect(await door.list()).toEqual([]);
    const own = await door.propose({ proposals: [{ title: "t", revision: "r1", text: "body", taint: [] }] });
    await expect(door.lift({ title: "t", text: "body", taint: [], sources: [{ title: "t", revision: "r1" }], proposal: own.id })).resolves.toMatchObject({ cid: expect.any(String) });
  });
});

describe("the facet", () => {
  test("RED: the stage rides its own facet to its face's sessions; another face's session never fetches it; CONTROL: the daemon doc rides apart", async () => {
    const f = await face();
    const stage = await kahuaDoor(f.ports()).mint();
    const groupA = "0x" + "11".repeat(16), groupB = "0x" + "22".repeat(16);
    const daemonUrl = generateAutomergeUrl();
    const boot: Record<string, { text?: string }> = { [DAEMON_BAG_ID]: { text: daemonUrl }, [PERSONA_GROUP_ID_TIDDLER]: { text: groupA } };
    for (const group of [groupA, groupB]) {
      for (const e of personaMembershipEntries({ personaGroupId: group, url: generateAutomergeUrl() })) boot[e.title] = { text: e.text ?? undefined };
      boot[personaSiblingBagIds(personaBagIdFor(group))!.intents] = { text: generateAutomergeUrl() };
    }
    const kahuaOf = (group: string) => (group === groupA ? stage.url : null);
    const facets = faceFleetFacets(boot, groupA, kahuaOf);
    expect(facets).not.toBeNull();
    {
      const kahua = facets!.documents.filter((d) => d.name === "kahua");
      expect(kahua).toEqual([{ name: "kahua", document: stage.url, layer: "library" }]);
      // No face session writes the stage through its view: a lift lands only through the door.
      const view = new SessionDocumentView({ profile: "face", facets: facets! });
      expect(view.write(stage.url).ok).toBe(false);
      expect(view.fetch(String(interpretAsDocumentId(stage.url as AutomergeUrl))).ok).toBe(true);
      expect(facets!.documents.filter((d) => d.name === "daemon").every((d) => d.document !== stage.url)).toBe(true);
    }
    const views = faceFleetViews(() => boot, () => groupA, () => new Set(), kahuaOf);
    const stageId = interpretAsDocumentId(stage.url as AutomergeUrl);
    views.seat("peer-other-face", { personaGroup: groupB });
    expect(views.gateFor("peer-other-face")?.mayFederate(stageId) ?? false).toBe(false);
    views.seat("peer-same-face", { personaGroup: groupA });
    expect(views.gateFor("peer-same-face")?.mayFederate(stageId)).toBe(true);
    views.seat("peer-no-face", null);
    expect(views.gateFor("peer-no-face")).toBeNull();
    // The stage's own view, apart from any bootstrap facet: a face-scoped view with the kahua facet fetches it.
    const own = new SessionDocumentView({ profile: "face", facets: { documents: [{ name: "kahua", document: stage.url, layer: "plane" }], content: [] } });
    expect(own.fetch(String(stageId)).ok).toBe(true);
    views.close();
  });

  test("RED: the stage bag names no face by shape, so its face scoping rides the pin alone; a session of another face the vessel carries reads no stage", async () => {
    expect(isFaceScopedBag(KAHUA_BAG)).toBe(false);
    const f = await face();
    const stage = await kahuaDoor(f.ports()).mint();
    const groupA = "0x" + "33".repeat(16), groupB = "0x" + "44".repeat(16);
    const boot: Record<string, { text?: string }> = { [DAEMON_BAG_ID]: { text: generateAutomergeUrl() }, [PERSONA_GROUP_ID_TIDDLER]: { text: groupA } };
    for (const group of [groupA, groupB]) for (const e of personaMembershipEntries({ personaGroupId: group, url: generateAutomergeUrl() })) boot[e.title] = { text: e.text ?? undefined };
    let worn = groupA;
    // The face switches on the vessel: the stage pinned by face A stays A's; B's session, worn or not, never fetches it,
    // even with A's catalog row still standing among the vessel's books (the bridge the worn face reads).
    const catalog = { tiddlers: { [KAHUA_BAG]: storedLarRecord(KAHUA_BAG, { text: stage.url }, "kahua-pin"), "lar:///ha.ka.ba/wikis/notes": storedLarRecord("lar:///ha.ka.ba/wikis/notes", { text: generateAutomergeUrl() }, "x") } } as unknown as LarDoc;
    const books = bridgeBooks(catalog);
    expect(books.has(String(interpretAsDocumentId(tiddlerText(catalog.tiddlers["lar:///ha.ka.ba/wikis/notes"]) as AutomergeUrl)))).toBe(true);
    const views = faceFleetViews(() => boot, () => worn, () => books, (g) => (g === groupA ? stage.url : null));
    const stageId = interpretAsDocumentId(stage.url as AutomergeUrl);
    worn = groupB;
    views.seat("peer-b", { personaGroup: groupB });
    expect(views.gateFor("peer-b")?.mayFederate(stageId) ?? false).toBe(false);
    views.seat("peer-a", { personaGroup: groupA });
    expect(views.gateFor("peer-a")?.mayFederate(stageId)).toBe(true);
    views.close();
  });
});

describe("the carry door", () => {
  const src = [{ title: "daemon/t", revision: "r1" }];
  /** The face after its root rotates: epoch 1 seats `next`; the history view reads epoch 0's roster. */
  async function rotated() {
    const f = await face();
    const next = await who(17);
    const lineage = makeHandLineage([{ epoch: 0, signers: [f.root.key], threshold: 1 }, { epoch: 1, signers: [next.key], threshold: 1 }])!;
    const after = (over: Partial<KahuaDoorPorts> = {}) => f.ports({
      projection: () => projectPersonaLog(personaActRecordsOfGroup(f.persona.doc(), GROUP), { group: GROUP, lineage, authorize: () => true }),
      epoch: () => 1, currentSigner: (key) => key === next.key, signedAt: (epoch, key) => signsAtEpoch(lineage, epoch, key),
      rootSigner: async () => next, ...over,
    });
    return { ...f, next, after };
  }

  test("RED: after a rotation the earlier items read in history and not standing, and the new root's carry restores them; CONTROL: before the rotation they stand", async () => {
    const f = await rotated();
    const door = kahuaDoor(f.ports({ signedAt: (epoch, key) => epoch === 0 && key === f.root.key }));
    await door.mint();
    const a = await door.lift({ title: "a", text: "alpha", taint: [], sources: src });
    const b = await door.lift({ title: "b", text: "beta", taint: [], sources: src });
    expect((await door.list()).map((i) => i.title)).toEqual(["a", "b"]);
    const now = kahuaDoor(f.after());
    expect(await now.list()).toEqual([]);
    expect((await now.history("a")).map((r) => [r.cid, r.standing])).toEqual([[a.cid, false]]);
    const carried = await now.carry({ cids: [a.cid] });
    expect(carried.carried).toEqual([a.cid]);
    expect((await now.list()).map((i) => i.title)).toEqual(["a"]);
    const all = await now.carry({ all: true });
    expect(all.carried).toEqual([b.cid]);
    expect((await now.list()).map((i) => i.title)).toEqual(["a", "b"]);
    await expect(now.carry({ all: true })).rejects.toThrow(/carry-nothing/);
  });

  test("RED: a carry without the current root in hand, without the cap, or naming no held revision refuses by name and lands nothing; CONTROL: the rotated-out root's hand never carries", async () => {
    const f = await rotated();
    const door = kahuaDoor(f.ports());
    await door.mint();
    const a = await door.lift({ title: "a", text: "alpha", taint: [], sources: src });
    await expect(kahuaDoor(f.after({ rootSigner: async () => { throw new Error("custody locked"); } })).carry({ cids: [a.cid] })).rejects.toThrow(/operator-grant-absent/);
    await expect(kahuaDoor(f.after({ rootSigner: async () => f.root })).carry({ cids: [a.cid] })).rejects.toThrow(/operator-grant-absent/);
    await expect(kahuaDoor(f.after({ rootSigner: async () => f.atomA })).carry({ cids: [a.cid] })).rejects.toThrow(/operator-grant-absent/);
    await expect(kahuaDoor(f.after({ cap: async () => ({ held: false }) })).carry({ cids: [a.cid] })).rejects.toThrow(/lokahi-cap-absent/);
    await expect(kahuaDoor(f.after()).carry({ cids: ["e".repeat(64)] })).rejects.toThrow(/carry-unknown/);
    await expect(kahuaDoor(f.after()).carry({})).rejects.toThrow(/carry-nothing/);
    expect(await kahuaDoor(f.after()).list()).toEqual([]);
  });
});

export { KahuaRefused };
