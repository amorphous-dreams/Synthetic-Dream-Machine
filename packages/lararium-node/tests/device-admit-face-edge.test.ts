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
const seam = vi.hoisted(() => ({ bootstrapPath: "", edge: null as Record<string, unknown> | null, seeds: [] as number[], anchorsAsked: [] as number[] }));

vi.mock("../src/vessel-paths.js", () => ({ larBootstrapPath: () => seam.bootstrapPath }));
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
  };
});

import { runDeviceAdmit } from "../src/commands/device-admit.js";

const daemonDoc = { tiddlers: { [T.group]: { text: "group-zero" }, [T.kel]: { text: "kel-zero" } } };
const repo = {
  findWithProgress: () => ({ whenReady: async () => ({ doc: () => daemonDoc }) }),
  find: async () => ({ doc: () => ({}) }),
  flush: async () => {},
} as never;
const admitAt = (face?: number) => runDeviceAdmit({ repo, joineeVerifyingKey: "JOINEE", ...(face === undefined ? {} : { face }) });

describe("runDeviceAdmit names the face whose root signs", () => {
  beforeEach(() => {
    seam.edge = null; seam.seeds = []; seam.anchorsAsked = [];
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
});
