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
  personaSiblingBagIds, projectPersonaLog, signFoundingLog, writePersonaAct, type LarDoc,
} from "@lararium/mesh";
import { kahuaDoor, KahuaRefused, type KahuaDoorPorts } from "../src/kahua-door.js";
import { faceFleetFacets, faceFleetViews } from "../src/face-fleet-view.js";

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

  test("RED: two hearths that mint at once, each offline, sign one pin and never fork the face log; CONTROL: the pin names the face's derived stage", async () => {
    const f = await face();
    // Hearth B holds the same face: a replica of its persona plane and the same root in custody.
    const repoB = new Repo({ network: [] });
    const personaB = repoB.import<LarDoc>(Automerge.save(f.persona.doc()), { docId: f.persona.documentId });
    const intentsB = repoB.import<LarDoc>(Automerge.save(f.intents.doc()), { docId: f.intents.documentId });
    const [a, b] = await Promise.all([
      kahuaDoor(f.ports()).mint(),
      kahuaDoor(f.ports({ repo: repoB, persona: personaB, intents: intentsB, atom: f.atomB,
        projection: () => projectPersonaLog(personaActRecordsOfGroup(personaB.doc(), GROUP), { group: GROUP, lineage: f.lineage, authorize: () => true }) })).mint(),
    ]);
    f.persona.merge(personaB); personaB.merge(f.persona);
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
    // The face switches on the vessel: the stage pinned by face A stays A's; B's session, worn or not, never fetches it.
    const views = faceFleetViews(() => boot, () => worn, () => new Set(), (g) => (g === groupA ? stage.url : null));
    const stageId = interpretAsDocumentId(stage.url as AutomergeUrl);
    worn = groupB;
    views.seat("peer-b", { personaGroup: groupB });
    expect(views.gateFor("peer-b")?.mayFederate(stageId) ?? false).toBe(false);
    views.seat("peer-a", { personaGroup: groupA });
    expect(views.gateFor("peer-a")?.mayFederate(stageId)).toBe(true);
    views.close();
  });
});

export { KahuaRefused };
