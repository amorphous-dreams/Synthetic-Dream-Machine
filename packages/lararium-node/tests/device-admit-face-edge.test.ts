/**
 * runDeviceAdmit at a face an operator added: the edge it mints names that face's group, cabal, KEL prefix and
 * root, read off the face's own anchors, never the founding face's pins in the bootstrap and the daemon doc.
 */
import { seatSuiteWard } from "./support/scratch-custody-setup.js";
// This suite stands as the person at the terminal: its root acts carry no ward route, and the suite's person answers (seat-harness#/the-ward).
seatSuiteWard();
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
const seam = vi.hoisted(() => ({ bootstrapPath: "", edge: null as Record<string, unknown> | null, seeds: [] as number[], anchorsAsked: [] as number[], observed: 0, anchorPrefix: "kel-zero", anchorLease: 0, anchorSeq: -1, projectedWith: null as Record<string, unknown> | null, cids: [] as string[], anchorCid: null as string | null, vesselTags: [] as string[], records: [] as unknown[], admissions: [] as Array<{ deviceKey: string; cid: string }>, rootHalves: 0, appended: [] as unknown[] }));

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
// The face's plane row rests sealed in its own catalog (sealed-store#/owed, U1), which a door with no vessel standing never
// opens: the catalog answers no row, and the admit reads the plane the bootstrap names.
vi.mock("@lararium/tw5", async (real) => ({ ...(await real<Record<string, unknown>>()), makeCatalogAccessor: () => ({ urlOf: async () => null }) }));
vi.mock("../src/edge-board.js", () => ({ readVesselEdgeBoard: async () => ({ readings: new Map() }) }));
vi.mock("../src/nexus-standing.js", () => ({
  nodeNexusIsland: () => "island", nodeNexusIslandsBelow: () => [], nodeNexusStanding: () => ({ kind: "own", scope: "island" }),
}));
vi.mock("../src/persona-kel-ring.js", () => ({ carryPersonaKelUpTheGradient: async () => {} }));
// The hearth's canon reads the Kahu realm by the founding face's custody group (`admit-canon-reads-the-realm`); this file reads the edge alone.
vi.mock("../src/kahu-realm.js", () => ({ admitCanonDocs: async () => ({}), hearthCustodyGroup: async () => "group-zero" }));
vi.mock("../src/hearth-aid.js", () => ({ hearthAid: () => "hearth-aid" }));
vi.mock("../src/lan-address.js", () => ({ wsUrlForOrigin: () => null }));
// The payload carries the edge the real producer would mint from these args (the door reads its digest on a replay).
// The root seed zero-fills once the admit settles (seat-harness#/the-ward), so the seam keeps its own copy of what it saw.
vi.mock("@lararium/keyhive", async () => {
  const mesh = await vi.importActual<typeof import("@lararium/mesh")>("@lararium/mesh");
  return {
    runDeviceAdmitEdge: async (args: Record<string, unknown>) => {
      seam.edge = { ...args, ...(args["signerSeed"] instanceof Uint8Array ? { signerSeed: Uint8Array.from(args["signerSeed"]) } : {}) };
      const deviceEdge = await mesh.buildDeviceDelegationRootHalf({ personaRootSeed: args["signerSeed"] as Uint8Array,
        deviceVerifyingKey: args["joineeVerifyingKey"] as string, hearthTrueName: args["hearthTrueName"] as string, boundEpoch: (args["boundEpoch"] as number | undefined) ?? 0 });
      return { kind: "device-admit/v1", deviceEdge };
    },
  };
});
vi.mock("@lararium/mesh", async (real) => {
  const mesh = await real<Record<string, unknown>>();
  return {
    ...mesh,
    DAEMON_BAG_ID: T.daemon, PERSONA_GROUP_ID_TIDDLER: T.group, MESH_CABAL_DOC_ID_TIDDLER: T.cabal, PERSONA_KEL_PREFIX_TIDDLER: T.kel,
    personaBagIdFor: (group: string) => `plane:${group}`,
    // The admit's act store opens over the plane the bootstrap names; this suite reads which root signs, never the store's writes.
    AutomergeDocStore: class { constructor(_handle: unknown, readonly bagId: string) {} },
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
        // The fold's edges: the latest device-edge act per device among the carried records, as `projectPersonaLog` reads them.
        const edges = Object.fromEntries((seam.records as { body?: Record<string, unknown> }[]).map((r) => r.body)
          .filter((b) => b?.["act"] === "device-edge").map((b) => [b!["deviceKey"], b!["edgeDigest"]]));
        return { founded: true, fork: null, head: { seq: 3, cid: "head" }, cids: seam.cids, vesselTags: seam.vesselTags, admissions: seam.admissions, edges };
      },
    }),
  };
});
vi.mock("../src/persona-act-store.js", () => ({ readFacePersonaRecords: async () => seam.records, appendPersonaActs: (_handle: unknown, acts: unknown[]) => { seam.appended.push(...acts); } }));

import { DeviceAdmitTagRefused, runDeviceAdmit } from "../src/commands/device-admit.js";
import { actCid, CONTROL_HOME_ID } from "@lararium/mesh";
import { testVesselTag } from "../../lararium-mesh/tests/vessel-tag-fixture.js";

// The daemon doc names the vessel's control document, where the lease slots rest (a fence read refuses where it names none).
const daemonDoc = { tiddlers: { [T.group]: { text: "group-zero" }, [T.kel]: { text: "kel-zero" }, [CONTROL_HOME_ID]: { text: "automerge:control", tiddler: { text: "automerge:control" } } } };
const repo = {
  find: async (url: string) => ({ url, doc: () => (url === "automerge:daemon" ? daemonDoc : {}) }),
  flush: async () => {},
} as never;
const JOINEE = "6e7a1cdd29b0b78fd13af4c5598feff4ef2a97166e3ca6f2e4fbfccd80505bf1";
const OTHER_ATOM = "8a88e3dd7409f195fd52db2d3cba5d72ca6709bf1d94121bf3748801b40f6f5c";
const admitAt = async (face?: number, vesselTag?: { vesselTag?: unknown; vesselSig?: unknown }) => runDeviceAdmit({ repo, catalogUrl: "catalog", joineeVerifyingKey: JOINEE,
  vesselTag: vesselTag ?? await testVesselTag(5, face === 2 ? "group-two" : "group-zero", JOINEE), ...(face === undefined ? {} : { face }) });
const admissionOf = () => (seam.edge!["personaActs"] as { body: Record<string, unknown> }[]).map((a) => a.body).find((b) => b["act"] === "admission")!;

describe("runDeviceAdmit names the face whose root signs", () => {
  beforeEach(() => {
    seam.edge = null; seam.seeds = []; seam.anchorsAsked = []; seam.observed = 0; seam.anchorPrefix = "kel-zero"; seam.anchorLease = 0; seam.anchorSeq = -1; seam.projectedWith = null; seam.cids = []; seam.anchorCid = null; seam.vesselTags = []; seam.records = []; seam.admissions = []; seam.rootHalves = 0; seam.appended = [];
    seam.bootstrapPath = join(tmpdir(), `lar-device-admit-face-${process.pid}.json`);
    writeFileSync(seam.bootstrapPath, JSON.stringify({ text: JSON.stringify({ tiddlers: {
      [T.group]: { text: "group-zero" }, [T.cabal]: { text: "cabal-zero" }, [T.daemon]: { text: "automerge:daemon" },
      "plane:group-zero": { text: "automerge:plane-zero" }, "plane:group-two": { text: "automerge:plane-two" },
    } }) }));
  });
  afterAll(() => rmSync(seam.bootstrapPath, { force: true }));

  test("CONTROL: the founding face mints off the bootstrap and daemon doc pins", async () => {
    await admitAt();
    expect(seam.edge).toMatchObject({ personaGroupId: "group-zero", meshCabalDocIdHex: "cabal-zero", personaKelPrefix: "kel-zero", personaKelChain: ["chain-of-kel-zero"], personaUrl: "automerge:plane-zero" });
    expect(seam.seeds).toEqual([0]);
    expect(seam.anchorsAsked).toEqual([]);
  });

  test("ADMIT_EDGE_NAMES_THE_FACE: face 2's edge carries face 2's group, cabal, KEL prefix, chain, plane and root", async () => {
    await admitAt(2);
    expect(seam.edge).toMatchObject({ personaGroupId: "group-two", meshCabalDocIdHex: "cabal-two", personaKelPrefix: "kel-two", personaKelChain: ["chain-of-kel-two"], personaUrl: "automerge:plane-two" });
    expect((seam.edge!["signerSeed"] as Uint8Array)[0]).toBe(2);
    expect(seam.seeds).toEqual([2]);
    expect(seam.anchorsAsked).toEqual([2]);
  });

  test("a face with no anchors refuses before any root opens", async () => {
    await expect(admitAt(3)).rejects.toThrow(/no face at index 3/);
    expect(seam.seeds).toEqual([]);
    expect(seam.edge).toBeNull();
  });

  test("RED (M16): a daemon doc that names no control document refuses the admission before the root signs, never binds at genesis", async () => {
    const named = daemonDoc.tiddlers[CONTROL_HOME_ID];
    delete (daemonDoc.tiddlers as Record<string, unknown>)[CONTROL_HOME_ID];
    try {
      await expect(admitAt()).rejects.toThrow(/lease fence reads unread: control-home-unavailable/);
      expect(seam.edge).toBeNull();
    } finally { (daemonDoc.tiddlers as Record<string, unknown>)[CONTROL_HOME_ID] = named; }
  });

  test("RED: a stale daemon doc never signs the joinee below the issuer's sealed lease frontier, and the log projects from the anchor's accepted seq; CONTROL: an honest fresher advance still binds", async () => {
    seam.observed = 0; seam.anchorLease = 7; seam.anchorSeq = 4; seam.anchorCid = "p4"; seam.cids = ["a", "b", "c", "d", "p4"];
    await admitAt();
    expect(seam.edge!["boundEpoch"], "the anchor's epoch 7 bounds the edge, not the stale slot's 0").toBe(7);
    expect(seam.projectedWith).toMatchObject({ acceptedThrough: 4 });
    seam.observed = 9; seam.edge = null;
    await admitAt();
    expect(seam.edge!["boundEpoch"], "a verified higher advance still lands").toBe(9);
  });

  test("RED: a bootstrap/daemon KEL prefix the sealed anchor does not name refuses before any signing; CONTROL: the matching prefix signs", async () => {
    seam.anchorPrefix = "kel-elsewhere";
    await expect(admitAt()).rejects.toThrow(/KEL prefix this face's sealed anchor does not/);
    expect(seam.edge).toBeNull();
    seam.anchorPrefix = "kel-zero";
    await admitAt();
    expect(seam.edge).not.toBeNull();
  });

  test("RED: a replica that replays an older valid log (the anchor's pinned act missing from it) signs nothing; CONTROL: the log holding the pinned act signs", async () => {
    seam.anchorSeq = 2; seam.anchorCid = "pinned";
    seam.cids = ["a", "b", "other"];
    await expect(admitAt()).rejects.toThrow(/frontier-falls/);
    expect(seam.edge).toBeNull();
    seam.cids = ["a", "b", "pinned"];
    await admitAt();
    expect(seam.edge).not.toBeNull();
  });

  test("RED: a join with no vessel tag refuses vessel-tag-absent, and one whose proof covers another atom or face vessel-tag-invalid, before the root signs", async () => {
    await expect(admitAt(undefined, {})).rejects.toMatchObject({ name: "DeviceAdmitTagRefused", refusal: "vessel-tag-absent" });
    await expect(admitAt(undefined, { vesselTag: (await testVesselTag(5, "group-zero", JOINEE)).vesselTag })).rejects.toMatchObject({ refusal: "vessel-tag-absent" });
    await expect(admitAt(undefined, await testVesselTag(5, "group-zero", OTHER_ATOM))).rejects.toMatchObject({ refusal: "vessel-tag-invalid" });
    await expect(admitAt(undefined, await testVesselTag(5, "group-two", JOINEE))).rejects.toMatchObject({ refusal: "vessel-tag-invalid" });
    expect(seam.edge).toBeNull();
  });

  test("RED: a second join of one vessel (its door's secret, another atom) into a face that seats its tag refuses vessel-already-admitted; CONTROL: another vessel seats, and its admission carries its tag", async () => {
    seam.vesselTags = [(await testVesselTag(5, "group-zero", OTHER_ATOM)).vesselTag];
    const err = await admitAt().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DeviceAdmitTagRefused);
    expect(err).toMatchObject({ refusal: "vessel-already-admitted" });
    expect(seam.edge).toBeNull();
    const fresh = await testVesselTag(6, "group-zero", JOINEE);
    await admitAt(undefined, fresh);
    expect(admissionOf()).toMatchObject({ deviceKey: JOINEE, vesselTag: fresh.vesselTag, vesselSig: fresh.vesselSig });
  });

  test("RED: a retried answer for the atom that already holds the tag is a replay and seats nothing twice; CONTROL: the same vessel under another atom still refuses", async () => {
    const mine = await testVesselTag(5, "group-zero", JOINEE);
    const body = { act: "admission", deviceKey: JOINEE, vesselTag: mine.vesselTag, vesselSig: mine.vesselSig };
    seam.vesselTags = [mine.vesselTag]; seam.records = [{ body }]; seam.admissions = [{ deviceKey: JOINEE, cid: actCid(body as never) }];
    await admitAt(undefined, mine);
    expect(seam.edge).not.toBeNull();
    seam.edge = null;
    seam.vesselTags = [(await testVesselTag(5, "group-zero", OTHER_ATOM)).vesselTag];
    seam.records = [{ body: { ...body, deviceKey: OTHER_ATOM } }]; seam.admissions = [{ deviceKey: OTHER_ATOM, cid: actCid({ ...body, deviceKey: OTHER_ATOM } as never) }];
    await expect(admitAt()).rejects.toMatchObject({ refusal: "vessel-already-admitted" });
  });

  test("RED: a tag refusal (absent, invalid, already admitted) reaches no root signature over the joinee's edge; CONTROL: a sound tag signs once", async () => {
    await expect(admitAt(undefined, {})).rejects.toMatchObject({ refusal: "vessel-tag-absent" });
    await expect(admitAt(undefined, await testVesselTag(5, "group-zero", OTHER_ATOM))).rejects.toMatchObject({ refusal: "vessel-tag-invalid" });
    seam.vesselTags = [(await testVesselTag(5, "group-zero", OTHER_ATOM)).vesselTag];
    await expect(admitAt()).rejects.toMatchObject({ refusal: "vessel-already-admitted" });
    expect(seam.rootHalves, "no refusal signs the edge").toBe(0);
    seam.vesselTags = [];
    await admitAt();
    expect(seam.rootHalves).toBe(1);
  });

  test("RED: a retried answer for an atom and tag already seated appends no second admission or edge to the log; CONTROL: a first answer appends both", async () => {
    const mine = await testVesselTag(5, "group-zero", JOINEE);
    await admitAt(undefined, mine);
    expect(seam.appended.map((a) => (a as { body: Record<string, unknown> }).body["act"]), "a first answer appends its admission and edge").toEqual(["admission", "device-edge"]);
    const [admission, edge] = seam.appended as { body: Record<string, unknown> }[];
    seam.records = [admission, edge]; seam.vesselTags = [mine.vesselTag];
    seam.admissions = [{ deviceKey: JOINEE, cid: actCid(admission!.body as never) }];
    seam.appended = []; seam.edge = null;   // a lease roll between the answer and its retry refuses by name: device-admit-replay-edge.test.ts
    await admitAt(undefined, mine);
    expect(seam.appended, "the replay appends nothing").toEqual([]);
    expect(seam.edge!["personaActs"], "the replay carries the log as seated").toEqual([admission, edge]);
  });
});
