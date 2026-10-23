/**
 * runDeviceAdmit at a face an operator added: the edge it mints names that face's group, cabal, KEL prefix and
 * root, read off the face's own anchors, never the founding face's pins in the bootstrap and the daemon doc.
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
const seam = vi.hoisted(() => ({ bootstrapPath: "", edge: null as Record<string, unknown> | null, seeds: [] as number[], anchorsAsked: [] as number[], observed: 0, anchorPrefix: "kel-zero", anchorLease: 0, anchorSeq: -1, projectedWith: null as Record<string, unknown> | null, cids: [] as string[], anchorCid: null as string | null }));

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
vi.mock("@lararium/tw5", async (real) => ({ ...(await real<Record<string, unknown>>()), makeCatalogAccessor: () => ({ storeOf: async () => ({}) }) }));
vi.mock("../src/edge-board.js", () => ({ readVesselEdgeBoard: async () => ({ readings: new Map() }) }));
vi.mock("../src/nexus-standing.js", () => ({
  nodeNexusIsland: () => "island", nodeNexusIslandsBelow: () => [], nodeNexusStanding: () => ({ kind: "own", scope: "island" }),
}));
vi.mock("../src/persona-kel-ring.js", () => ({ carryPersonaKelUpTheGradient: async () => {} }));
vi.mock("../src/hearth-aid.js", () => ({ hearthAid: () => "hearth-aid" }));
vi.mock("../src/lan-address.js", () => ({ wsUrlForOrigin: () => null }));
vi.mock("@lararium/keyhive", () => ({
  runDeviceAdmitEdge: async (args: Record<string, unknown>) => { seam.edge = args; return { kind: "device-admit/v1" }; },
}));
vi.mock("@lararium/mesh", async (real) => {
  const mesh = await real<Record<string, unknown>>();
  return {
    ...mesh,
    DAEMON_BAG_ID: T.daemon, PERSONA_GROUP_ID_TIDDLER: T.group, MESH_CABAL_DOC_ID_TIDDLER: T.cabal, PERSONA_KEL_PREFIX_TIDDLER: T.kel,
    personaBagIdFor: (group: string) => `plane:${group}`,
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
        return { founded: true, fork: null, head: { seq: 3, cid: "head" }, cids: seam.cids };
      },
    }),
  };
});
vi.mock("../src/persona-act-store.js", () => ({ readFacePersonaRecords: async () => [], appendPersonaActs: () => {} }));

import { runDeviceAdmit } from "../src/commands/device-admit.js";

const daemonDoc = { tiddlers: { [T.group]: { text: "group-zero" }, [T.kel]: { text: "kel-zero" } } };
const repo = {
  findWithProgress: () => ({ whenReady: async () => ({ doc: () => daemonDoc }) }),
  find: async () => ({ doc: () => ({}) }),
  flush: async () => {},
} as never;
const admitAt = (face?: number) => runDeviceAdmit({ repo, catalogUrl: "catalog", joineeVerifyingKey: "6e7a1cdd29b0b78fd13af4c5598feff4ef2a97166e3ca6f2e4fbfccd80505bf1", ...(face === undefined ? {} : { face }) });

describe("runDeviceAdmit names the face whose root signs", () => {
  beforeEach(() => {
    seam.edge = null; seam.seeds = []; seam.anchorsAsked = []; seam.observed = 0; seam.anchorPrefix = "kel-zero"; seam.anchorLease = 0; seam.anchorSeq = -1; seam.projectedWith = null; seam.cids = []; seam.anchorCid = null;
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
});
