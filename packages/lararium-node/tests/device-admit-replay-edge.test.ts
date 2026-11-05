/**
 * A replayed fleet-join answer, driven through the REAL payload producer (`runDeviceAdmitEdge`, its operation cache and
 * `enrolDevice`): the edge a replay hands the joinee is the edge the `@persona` log seats, byte for byte by digest, or a
 * refusal by name when the face has moved past it. A fresh signed request (new nonce, same atom and tag) misses the
 * operation cache, so nothing but the door itself keeps a re-minted edge from reaching the joinee.
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
const seam = vi.hoisted(() => ({ bootstrapPath: "", edge: null as Record<string, unknown> | null, seeds: [] as number[], anchorsAsked: [] as number[], observed: 0, anchorPrefix: "kel-zero", anchorLease: 0, anchorSeq: -1, projectedWith: null as Record<string, unknown> | null, cids: [] as string[], anchorCid: null as string | null, vesselTags: [] as string[], records: [] as unknown[], admissions: [] as Array<{ deviceKey: string; cid: string }>, rootHalves: 0, appended: [] as unknown[], store: null as unknown }));

vi.mock("../src/vessel-paths.js", () => ({ larBootstrapPath: () => seam.bootstrapPath, larSealHome: () => "seal-home-under-test" }));
// The admit pins the Nexus the vessel's sovereign gate stands at (`stoodSovereignPin`, hearth-stood-pin P1-P3); this
// suite reads the edge alone, so the stood pin is a fixed one read at the seal home the paths name.
vi.mock("../src/hearth-sovereign-pin.js", async () => {
  const mesh = await vi.importActual<typeof import("@lararium/mesh")>("@lararium/mesh");
  return {
    stoodSovereignPin: (sealHome: string) => {
      if (sealHome !== "seal-home-under-test") throw new Error(`stood pin read at ${sealHome}`);
      const bundle = mesh.deriveGateBundle(mesh.sovereignGateRoot(mesh.custodyRootDoor({ derive: () => new Uint8Array(32).fill(7) })), new TextEncoder().encode("hearth-aid"), mesh.sovereignRoute(mesh.SOVEREIGN_SYNC_ROUTE));
      try { return bundle.pin; } finally { bundle.drop(); }
    },
  };
});
// Which face an unnamed run resolves has its reds in face-selector.test.ts; this suite reads which root signs.
vi.mock("../src/face-selector.js", () => ({ resolveFace: async (named?: number) => named ?? 0, FaceNotNamed: class extends Error {} }));
vi.mock("../src/identity-anchors.js", () => ({
  loadIdentityAnchors: async (face: number) => {
    seam.anchorsAsked.push(face);
    return face === 2 ? { personaGroupId: "group-two", meshCabalDocIdHex: "cabal-two", personaKelPrefix: "kel-two" } : null;
  },
}));
vi.mock("../src/node-vessel-identity.js", () => ({
  loadPersonaGroupRootSeed: async (face = 0) => { seam.seeds.push(face); return new Uint8Array(32).fill(face); },
  loadPersonaGroupRootVerifyingKey: async () => undefined,
  loadVesselVerifyingKey: async () => "vessel",
}));
vi.mock("../src/face-anchor-store.js", () => ({
  loadFaceAnchorOfGroup: async (group: string) => ({ personaGroup: group, personaKelPrefix: group === "group-two" ? "kel-two" : seam.anchorPrefix, frontier: { leaseEpoch: seam.anchorLease, actSeq: seam.anchorSeq, actCid: seam.anchorCid } }),
}));
vi.mock("../src/face-atom-store.js", () => ({ loadFaceAtomOfGroup: async () => new Uint8Array(32).fill(9) }));
vi.mock("@lararium/tw5", async (real) => ({ ...(await real<Record<string, unknown>>()), makeCatalogAccessor: () => ({ storeOf: async () => seam.store }) }));
vi.mock("../src/edge-board.js", () => ({ readVesselEdgeBoard: async () => ({ readings: new Map() }) }));
vi.mock("../src/nexus-standing.js", () => ({
  nodeNexusIsland: () => "island", nodeNexusIslandsBelow: () => [], nodeNexusStanding: () => ({ kind: "own", scope: "island" }),
}));
vi.mock("../src/persona-kel-ring.js", () => ({ carryPersonaKelUpTheGradient: async () => {} }));
// The hearth's canon reads the Kahu realm by the founding face's custody group (`admit-canon-reads-the-realm`); this file reads the edge alone.
vi.mock("../src/kahu-realm.js", () => ({ admitCanonDocs: async () => ({}), hearthCustodyGroup: async () => "group-zero" }));
vi.mock("../src/hearth-aid.js", () => ({ hearthAid: () => "hearth-aid" }));
vi.mock("../src/lan-address.js", () => ({ wsUrlForOrigin: () => null }));
vi.mock("@lararium/mesh", async (real) => {
  const mesh = await real<Record<string, unknown>>();
  return {
    ...mesh,
    DAEMON_BAG_ID: T.daemon, PERSONA_GROUP_ID_TIDDLER: T.group, MESH_CABAL_DOC_ID_TIDDLER: T.cabal, PERSONA_KEL_PREFIX_TIDDLER: T.kel,
    personaBagIdFor: (group: string) => `plane:${group}`,
    // Counts every root signature over a joinee's edge: a refusal must reach none.
    buildDeviceDelegationRootHalf: async (...args: unknown[]) => { seam.rootHalves++; return (mesh["buildDeviceDelegationRootHalf"] as (...a: unknown[]) => unknown)(...args); },
    materializeSharedLarDoc: async () => ({ doc: () => ({}) }),
    personaKelChainForPrefix: (_doc: unknown, prefix: string) => [`chain-of-${prefix}`],
    personaKelBoardDocUrl: () => "board",
    tiddlerText: (entry: { text?: string } | undefined) => entry?.text,
    oracleGenesisDocUrl: () => "oracle",
    // This suite reads WHICH face's root signs; the signed log's own proofs have their reds elsewhere (persona-act-boot).
    // The one door (`readFace`) stands mocked: this suite reads WHICH face's root signs and what the door is asked, not the KEL fold.
    readFace: (_chain: unknown, anchor?: { frontier: { leaseEpoch: number; actSeq: number } }) => ({
      lineage: [{ epoch: 0, signers: [], threshold: 1, rosterHash: "h" }],
      currentSigner: () => true,
      observedLease: () => seam.observed,
      leaseEpoch: () => Math.max(seam.observed, anchor?.frontier.leaseEpoch ?? 0),
      project: () => {
        seam.projectedWith = { acceptedThrough: anchor?.frontier.actSeq };
        return { founded: true, fork: null, head: { seq: 3, cid: "head" }, cids: seam.cids, vesselTags: seam.vesselTags, admissions: seam.admissions };
      },
    }),
  };
});
vi.mock("../src/persona-act-store.js", () => ({ readFacePersonaRecords: async () => seam.records, appendPersonaActs: (_handle: unknown, acts: unknown[]) => { seam.appended.push(...acts); } }));

import { runDeviceAdmit } from "../src/commands/device-admit.js";
import { edgeBodyDigest } from "@lararium/mesh";
import { MemoryTiddlerStore } from "@lararium/tw5";
import { testVesselTag } from "../../lararium-mesh/tests/vessel-tag-fixture.js";

const daemonDoc = { tiddlers: { [T.group]: { text: "group-zero" }, [T.kel]: { text: "kel-zero" } } };
const repo = {
  findWithProgress: () => ({ whenReady: async () => ({ doc: () => daemonDoc }) }),
  find: async () => ({ doc: () => ({}) }),
  flush: async () => {},
} as never;
const JOINEE = "6e7a1cdd29b0b78fd13af4c5598feff4ef2a97166e3ca6f2e4fbfccd80505bf1";
type Act = { body: Record<string, unknown> };
const request = (nonce: string) => new TextEncoder().encode(JSON.stringify({ atomKey: JOINEE, nonce }));
const answer = async (nonce: string) => (await runDeviceAdmit({ repo, catalogUrl: "catalog", joineeVerifyingKey: JOINEE,
  vesselTag: await testVesselTag(5, "group-zero", JOINEE), signedRequest: request(nonce) })).payload;
const loggedDigest = (acts: readonly Act[]) => acts.find((a) => a.body["act"] === "device-edge")!.body["edgeDigest"];

describe("a replayed answer carries the seated edge, never a re-minted one", () => {
  beforeEach(() => {
    seam.observed = 0; seam.anchorPrefix = "kel-zero"; seam.anchorLease = 0; seam.anchorSeq = -1; seam.cids = []; seam.anchorCid = null;
    seam.vesselTags = []; seam.records = []; seam.admissions = []; seam.appended = []; seam.store = new MemoryTiddlerStore("plane:group-zero");
    seam.bootstrapPath = join(tmpdir(), `lar-device-admit-replay-${process.pid}.json`);
    writeFileSync(seam.bootstrapPath, JSON.stringify({ text: JSON.stringify({ tiddlers: {
      [T.group]: { text: "group-zero" }, [T.cabal]: { text: "cabal-zero" }, [T.daemon]: { text: "automerge:daemon" },
      "plane:group-zero": { text: "automerge:plane-zero" },
    } }) }));
  });
  afterAll(() => rmSync(seam.bootstrapPath, { force: true }));

  /** The first answer, its two acts then standing in the log the next answer reads. */
  const seatFirst = async () => {
    const first = await answer("nonce-1");
    const acts = seam.appended as Act[];
    seam.records = [...acts]; seam.vesselTags = [acts[0]!.body["vesselTag"] as string];
    const { actCid } = await import("@lararium/mesh");
    seam.admissions = [{ deviceKey: JOINEE, cid: actCid(acts[0]!.body as never) }];
    seam.appended = [];
    return { first, acts };
  };

  test("CONTROL: a first answer mints one edge and logs its digest beside one admission", async () => {
    const { first, acts } = await seatFirst();
    expect(acts.map((a) => a.body["act"])).toEqual(["admission", "device-edge"]);
    expect(edgeBodyDigest(first.deviceEdge)).toBe(loggedDigest(acts));
  });

  test("CONTROL: a fresh signed request with no lease roll carries the seated edge and appends nothing", async () => {
    const { acts } = await seatFirst();
    const replay = await answer("nonce-2");
    expect(seam.appended).toEqual([]);
    expect(edgeBodyDigest(replay.deviceEdge)).toBe(loggedDigest(acts));
  });

  test("RED: a lease roll between the answer and a retry under a fresh signed request never hands the joinee an edge the log does not seat; the door refuses replay-edge-lapsed", async () => {
    await seatFirst();
    seam.observed = 4;   // the lease rolls; the retry carries a new nonce, so the operation cache misses
    const outcome = await answer("nonce-2").then((p) => ({ digest: edgeBodyDigest(p.deviceEdge) }), (e: unknown) => e);
    expect(outcome, "the replay's edge digest must equal the logged edge's, or the door refuses by name").toMatchObject({ refusal: "replay-edge-lapsed" });
    expect(seam.appended, "a refused replay appends nothing").toEqual([]);
    // A retry of the ORIGINAL request after the roll (an operation-cache hit) refuses the same way: the cache never decides.
    await expect(answer("nonce-1")).rejects.toMatchObject({ refusal: "replay-edge-lapsed" });
  });
});
