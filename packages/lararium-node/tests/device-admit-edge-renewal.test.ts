/**
 * The edge renewal at the fleet-join answer: a joinee seated in the face's `@persona` log that lost its answer and meets
 * a lease roll before it retries. The retry renews its edge: the root signs a `device-edge` act at the current lease
 * epoch for the seated admission, the log takes it, and the answer serves exactly that edge, so the joinee passes the
 * boot proof and the Binding Gate's lease. Everything on the edge path runs real here: the persona KEL, the one face
 * reading, the act fold, the signed lease slot, the payload producer and its operation cache. Only the node's disk and
 * standing shores stand mocked.
 */
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const T = vi.hoisted(() => ({
  group: "lar:///ha.ka.ba/lares/persona-group-id",
  cabal: "lar:///ha.ka.ba/lares/mesh-cabal-doc-id",
  daemon: "lar:///ha.ka.ba/bags/daemon",
  kel: "lar:///ha.ka.ba/lares/persona-kel-prefix",
}));
const seam = vi.hoisted(() => ({
  bootstrapPath: "", rootSeed: new Uint8Array(32).fill(11), issuerAtom: new Uint8Array(32).fill(9),
  anchor: null as unknown, kelBoard: {} as unknown, store: null as unknown, aside: null as string | null,
}));

vi.mock("../src/vessel-paths.js", () => ({ larBootstrapPath: () => seam.bootstrapPath, larSealHome: () => "seal-home-under-test" }));
vi.mock("../src/hearth-sovereign-pin.js", async () => {
  const mesh = await vi.importActual<typeof import("@lararium/mesh")>("@lararium/mesh");
  return {
    stoodSovereignPin: () => {
      const bundle = mesh.deriveGateBundle(mesh.sovereignGateRoot(mesh.custodyRootDoor({ derive: () => new Uint8Array(32).fill(7) })), new TextEncoder().encode("hearth-aid"), mesh.sovereignRoute(mesh.SOVEREIGN_SYNC_ROUTE));
      try { return bundle.pin; } finally { bundle.drop(); }
    },
  };
});
vi.mock("../src/face-selector.js", () => ({ resolveFace: async (named?: number) => named ?? 0, FaceNotNamed: class extends Error {} }));
vi.mock("../src/identity-anchors.js", () => ({ loadIdentityAnchors: async () => ({ personaGroupId: "ab".repeat(16) }) }));
vi.mock("../src/node-vessel-identity.js", async () => {
  const mesh = await vi.importActual<typeof import("@lararium/mesh")>("@lararium/mesh");
  return {
    loadPersonaGroupRootSeed: async () => seam.rootSeed,
    // The fleet's own reading runs only where the test stands a set-aside dyad (r2); elsewhere the fleet reads no root.
    loadPersonaGroupRootVerifyingKey: async () => (seam.aside ? await mesh.ed25519VerifyingKeyFromSeed(seam.rootSeed) : undefined),
    loadVesselVerifyingKey: async () => "vessel",
  };
});
vi.mock("../src/face-anchor-store.js", () => ({ loadFaceAnchorOfGroup: async () => seam.anchor }));
vi.mock("../src/face-atom-store.js", () => ({ loadFaceAtomOfGroup: async () => seam.issuerAtom }));
// The face's sealed catalog has no row here, so the admit reads the plane the bootstrap names.
vi.mock("@lararium/tw5", async (real) => ({ ...(await real<Record<string, unknown>>()), makeCatalogAccessor: () => ({ urlOf: async () => null }) }));
// The fleet board's fold has its reds in kapae and fleet-frontier suites; here it answers the dyad r2 names, set aside.
vi.mock("../src/edge-board.js", () => ({
  readVesselEdgeBoard: async () => ({
    handle: { doc: () => ({}) }, counted: { acts: [] }, ledger: { doc: () => ({}) },
    readings: new Map(seam.aside ? [[seam.aside, { stands: true, verdict: "aside" }]] : []),
  }),
}));
vi.mock("../src/fleet-lineage.js", () => ({ fleetLineageForVessel: async () => ({ fixture: true }) }));
vi.mock("../src/nexus-standing.js", () => ({
  nodeNexusIsland: () => "island", nodeNexusIslandsBelow: () => [], nodeNexusStanding: () => ({ kind: "own", scope: "island" }),
}));
vi.mock("../src/persona-kel-ring.js", () => ({ carryPersonaKelUpTheGradient: async () => {} }));
vi.mock("../src/kahu-realm.js", () => ({ admitCanonDocs: async () => ({}), hearthCustodyGroup: async () => "group-zero" }));
vi.mock("../src/hearth-aid.js", () => ({ hearthAid: () => "hearth-aid" }));
vi.mock("../src/lan-address.js", () => ({ wsUrlForOrigin: () => null }));
vi.mock("@lararium/mesh", async (real) => {
  const mesh = await real<Record<string, unknown>>();
  return {
    ...mesh,
    DAEMON_BAG_ID: T.daemon, PERSONA_GROUP_ID_TIDDLER: T.group, MESH_CABAL_DOC_ID_TIDDLER: T.cabal, PERSONA_KEL_PREFIX_TIDDLER: T.kel,
    personaBagIdFor: (group: string) => `plane:${group}`,
    // Keep the operation cache on the same memory store across opens and retries.
    AutomergeDocStore: class {
      constructor(_handle: unknown, readonly bagId: string) {}
      get(...args: Parameters<MemoryTiddlerStore["get"]>) { return (seam.store as MemoryTiddlerStore).get(...args); }
      put(...args: Parameters<MemoryTiddlerStore["put"]>) { return (seam.store as MemoryTiddlerStore).put(...args); }
    },
    // The KEL board this replica holds: the real inception, read by the real `personaKelChainForPrefix`.
    materializeSharedLarDoc: async () => ({ doc: () => seam.kelBoard }),
    personaKelBoardDocUrl: () => "board",
    tiddlerText: (entry: { text?: string } | undefined) => entry?.text,
    readFleetFrontier: () => ({ status: "known", missing: [] }),
  };
});

import { Repo, type DocHandle } from "@automerge/automerge-repo";
import {
  emptyLarDoc, signFoundingLog, mintFaceAnchor, faceRootCommitment, didFromVerifyingKey, ed25519VerifyingKeyFromSeed,
  ed25519SignerFromSeed, provisionThresholdRecoveryAtFounding, recoveryContactRegistrationCard, writePersonaKelEvent,
  personaKelChainForPrefix, proveFaceFromLog, edgeBodyDigest, signLeaseAdvance, leaseEpochSlotUri, readFace,
  countersignDeviceDelegation, verifyEdgeAgainstPersonaKel, deviceEdgeId, buildDeviceDelegation,
  type LarDoc, type PersonaKelEvent,
} from "@lararium/mesh";
import { MemoryTiddlerStore } from "@lararium/tw5";
import { runDeviceAdmit } from "../src/commands/device-admit.js";
import { readFacePersonaRecords, appendPersonaActs } from "../src/persona-act-store.js";
import { testVesselTag } from "../../lararium-mesh/tests/vessel-tag-fixture.js";

const group = "ab".repeat(16);
const joineeSeed = new Uint8Array(32).fill(21);
type Act = { body: Record<string, unknown> };

let planes: Repo;
let personaUrl: string;
let chain: PersonaKelEvent[];
let rootKey: string;
let joinee: string;
let daemonDoc: { tiddlers: Record<string, { text?: string }> };

const repo = () => ({
  findWithProgress: () => ({ whenReady: async () => ({ doc: () => daemonDoc }) }),
  find: async (url: string) => planes.find(url as never),
  flush: async () => {},
}) as never;
const request = (nonce: string) => new TextEncoder().encode(JSON.stringify({ atomKey: joinee, nonce }));
const answer = async (nonce: string) => (await runDeviceAdmit({ repo: repo(), catalogUrl: "catalog", joineeVerifyingKey: joinee,
  vesselTag: await testVesselTag(5, group, joinee), signedRequest: request(nonce) })).payload;
const logged = async (): Promise<Act[]> => (await readFacePersonaRecords(planes, { personaUrl, group })) as Act[];
const actsOf = (acts: readonly Act[], kind: string) => acts.filter((a) => a.body["act"] === kind);
/** The lease rolls: the root signs the next epoch into its own slot, as `lares persona lease` does. */
const rollLease = async (epoch: number) => {
  const signed = await signLeaseAdvance({ resource: group, epoch }, { key: rootKey, sign: ed25519SignerFromSeed(seam.rootSeed) });
  daemonDoc.tiddlers[leaseEpochSlotUri(group, rootKey)] = { text: signed };
};
/** The joinee's boot over what the answer served: the face proof from the log, then the Binding Gate's lease. */
const joineeBoots = async (payload: Awaited<ReturnType<typeof answer>>, epoch: number) => {
  const anchor = mintFaceAnchor({ personaGroup: group, personaKelPrefix: chain[0]!.prefix, personaRootDid: didFromVerifyingKey(rootKey), edge: payload.deviceEdge, leaseEpoch: epoch });
  const proof = proveFaceFromLog({ records: [...await logged(), ...payload.personaActs], chain, group, anchor,
    deviceKey: joinee, edge: payload.deviceEdge, planes: { persona: personaUrl } });
  const full = await countersignDeviceDelegation(payload.deviceEdge, ed25519SignerFromSeed(joineeSeed));
  const gate = await verifyEdgeAgainstPersonaKel(full, chain, { expectedEpoch: epoch });
  return { proof: proof.ok ? "ok" : proof.refusal.why, gate: gate.ok ? "ok" : gate.reason };
};

describe("a seated joinee's retry across a lease roll renews its edge", () => {
  beforeEach(async () => {
    seam.aside = null; seam.store = new MemoryTiddlerStore("plane:" + group);
    rootKey = await ed25519VerifyingKeyFromSeed(seam.rootSeed);
    joinee = await ed25519VerifyingKeyFromSeed(joineeSeed);
    const rootDid = didFromVerifyingKey(rootKey);
    const contacts = await Promise.all([1, 2, 3].map(async (n, i) =>
      recoveryContactRegistrationCard((["mine", "contact-a", "contact-b"] as const)[i]!, await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), null)));
    const inception = provisionThresholdRecoveryAtFounding({ foundingOpKeyDid: rootDid, recoveryContacts: contacts, recoveryThreshold: 2 }).inception;
    const board = emptyLarDoc();
    writePersonaKelEvent(board, inception);
    seam.kelBoard = board;
    chain = personaKelChainForPrefix(board, inception.prefix)!;
    planes = new Repo({ network: [] });
    const plane: DocHandle<LarDoc> = planes.create(emptyLarDoc());
    personaUrl = plane.url;
    const founderEdge = await buildDeviceDelegation({ personaRootSeed: seam.rootSeed, atomSeed: seam.issuerAtom, hearthTrueName: "hearth-aid", boundEpoch: 0 });
    const issuerAtomKey = founderEdge.deviceVerifyingKey;
    appendPersonaActs(plane, await signFoundingLog({ group, personaKelPrefix: inception.prefix, rootCommitment: faceRootCommitment(rootDid), epoch: 0,
      planes: { persona: personaUrl }, deviceKey: issuerAtomKey, edgeDigest: edgeBodyDigest(founderEdge),
      vesselTag: await testVesselTag(1, group, issuerAtomKey) }, { key: rootKey, sign: ed25519SignerFromSeed(seam.rootSeed) }));
    seam.anchor = mintFaceAnchor({ personaGroup: group, personaKelPrefix: inception.prefix, personaRootDid: rootDid, edge: founderEdge, leaseEpoch: 0 });
    daemonDoc = { tiddlers: { [T.group]: { text: group }, [T.kel]: { text: inception.prefix } } };
    seam.bootstrapPath = join(tmpdir(), `lar-device-admit-renewal-${process.pid}.json`);
    writeFileSync(seam.bootstrapPath, JSON.stringify({ text: JSON.stringify({ tiddlers: {
      [T.group]: { text: group }, [T.cabal]: { text: "cabal-zero" }, [T.daemon]: { text: "automerge:daemon" },
      [`plane:${group}`]: { text: personaUrl },
    } }) }));
  });
  afterAll(() => rmSync(seam.bootstrapPath, { force: true }));

  test("CONTROL (r4): a first answer logs exactly one admission and one edge, and the joinee boots on it", async () => {
    const before = (await logged()).length;
    const first = await answer("nonce-1");
    const acts = (await logged()).slice(before);
    expect(acts.map((a) => a.body["act"]).sort()).toEqual(["admission", "device-edge"]);
    expect(actsOf(acts, "device-edge")[0]!.body["edgeDigest"]).toBe(edgeBodyDigest(first.deviceEdge));
    expect(await joineeBoots(first, 0)).toEqual({ proof: "ok", gate: "ok" });
  });

  test("CONTROL (r4): a retry under a fresh request with no roll appends nothing and serves the seated edge", async () => {
    const first = await answer("nonce-1");
    const seated = (await logged()).length;
    const retry = await answer("nonce-2");
    expect((await logged()).length, "a replay with no roll appends nothing").toBe(seated);
    expect(edgeBodyDigest(retry.deviceEdge)).toBe(edgeBodyDigest(first.deviceEdge));
  });

  test("RED (r1): answer, lease roll, retry under a fresh request: the joinee gets an edge whose digest a NEW logged device-edge act at the current epoch carries, and it boots", async () => {
    const first = await answer("nonce-1");
    const seated = await logged();
    await rollLease(1);
    expect(readFace(chain, seam.anchor as never)!.leaseEpoch(group, Object.values(daemonDoc.tiddlers).map((t) => t.text)), "the roll took").toBe(1);
    expect((await joineeBoots(first, 1)).gate, "the first answer's edge strands at the rolled lease").toMatch(/stale/);
    const retry = await answer("nonce-2");
    expect(retry.deviceEdge.boundEpoch, "the served edge binds the current epoch").toBe("1");
    const now = await logged();
    const renewal = now.filter((a) => !seated.some((s) => JSON.stringify(s) === JSON.stringify(a)));
    expect(renewal.map((a) => a.body["act"]), "the renewal appends one device-edge act, never a second admission").toEqual(["device-edge"]);
    expect(renewal[0]!.body).toMatchObject({ deviceKey: joinee, edgeDigest: edgeBodyDigest(retry.deviceEdge) });
    expect(actsOf(now, "admission"), "one admission for the joinee").toHaveLength(2);   // the founder's and the joinee's
    expect(await joineeBoots(retry, 1)).toEqual({ proof: "ok", gate: "ok" });
    // A retry of the ORIGINAL request after the roll hits the operation cache, whose edge the log no longer seats: it refuses.
    const tally = (await logged()).length;
    await expect(answer("nonce-1")).rejects.toMatchObject({ refusal: "replay-edge-lapsed" });
    expect((await logged()).length, "a refused retry appends nothing").toBe(tally);
    // And a further fresh retry serves the renewed edge as it stands, appending nothing.
    const again = await answer("nonce-3");
    expect(edgeBodyDigest(again.deviceEdge)).toBe(edgeBodyDigest(retry.deviceEdge));
    expect((await logged()).length).toBe(tally);
  });

  test("RED (r2): an atom the fleet set aside gets a named refusal across the roll, and no act lands", async () => {
    await answer("nonce-1");
    await rollLease(1);
    seam.aside = deviceEdgeId(rootKey, joinee);
    const tally = (await logged()).length;
    await expect(answer("nonce-2")).rejects.toMatchObject({ name: "DeviceSetAside" });
    expect((await logged()).length, "a refusal appends nothing").toBe(tally);
    // CONTROL: lifted, the same retry renews.
    seam.aside = null;
    expect((await answer("nonce-3")).deviceEdge.boundEpoch).toBe("1");
  });
});
