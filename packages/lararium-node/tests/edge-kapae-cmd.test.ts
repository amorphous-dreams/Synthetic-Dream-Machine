/**
 * edge-kapae-cmd — raising and lowering a relationship, end-to-end through the node.
 *
 * Proven on a real vessel with a real persona root over a temp LAR_ROOT. The command cites only the local
 * admissible causal frontier; a lower becomes a descendant, and authority remains a reader-side decision.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync,  } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ed from "@noble/ed25519";
import { Repo } from "@automerge/automerge-repo";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import {
  hex, hexToBytes, edgeKapaeBoardDocUrl, materializeSharedLarDoc,
  edgeKapaeActsFromBoard, shadowSetFromBoard, mutableLarRecord, signEdgeKapae,
} from "@lararium/mesh";
import {
  generateOrLoadVesselIdentity, generateOrLoadPersonaGroupRoot,
  loadVesselVerifyingKey, loadPersonaGroupRootVerifyingKey, loadPersonaGroupRootSeed,
} from "../src/node-vessel-identity.js";
import { larDataDir } from "../src/vessel-paths.js";
import { runEdgeKapae, EdgeKapaeError } from "../src/commands/edge-kapae-cmd.js";

let root: string;
let priorLarRoot: string | undefined;

const EDGE  = "dyad-".padEnd(20, "a");
const EPOCH = "epoch0-aaa";
const verify = (b: Uint8Array, sig: string, did: string) =>
  ed.verifyAsync(hexToBytes(sig), b, hexToBytes(did)).catch(() => false);

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), "lares-kapae-"));
  priorLarRoot = process.env["LAR_ROOT"];
  process.env["LAR_ROOT"] = root;
  await generateOrLoadVesselIdentity();
  await generateOrLoadPersonaGroupRoot();
});
afterEach(async () => {
  if (priorLarRoot === undefined) delete process.env["LAR_ROOT"];
  else process.env["LAR_ROOT"] = priorLarRoot;
  await new Promise((r) => setTimeout(r, 200));   // past the storage debounce, as the sibling suites do
  rmSync(root, { recursive: true, force: true });
});

/** Read the board back the way any consumer must — through the verifying fold, under a named authority. */
async function boardState(authority: string) {
  const repo   = new Repo({ storage: new NodeFSStorageAdapter(larDataDir()) });
  const handle = await materializeSharedLarDoc(
    repo, edgeKapaeBoardDocUrl(await loadVesselVerifyingKey()), "board:edge-kapae");
  const acts     = edgeKapaeActsFromBoard(handle.doc());
  // This harness holds no charter chain, and declares it rather than omitting the argument —
  // The fold uses only locally closed causal acts; no epoch-order scalar is consulted.
  const shadowed = await shadowSetFromBoard(handle.doc(), () => authority, verify);
  await repo.flush();
  return { acts, shadowed };
}

describe("runEdgeKapae — a relationship set aside, and taken back", () => {
  it("RAISES, and the shadow stands under the signer that raised it", async () => {
    const r = await runEdgeKapae({ edgeId: EDGE, raised: true, epochCid: EPOCH });

    expect(r.actCid).toMatch(/^sha256:/);
    expect(r.parents).toEqual([]);
    expect(r.shadowStands).toBe(true);
    expect(r.signerDid).toBe(await loadPersonaGroupRootVerifyingKey(0));

    const { shadowed } = await boardState(r.signerDid);
    expect(shadowed.has(EDGE)).toBe(true);
  });

  it("★ the CLI selects the observed causal head, so a lower supersedes by lineage ★", async () => {
    const up   = await runEdgeKapae({ edgeId: EDGE, raised: true,  epochCid: EPOCH });
    const down = await runEdgeKapae({ edgeId: EDGE, raised: false, epochCid: EPOCH });

    expect(down.parents).toEqual([up.actCid]);
    expect(down.actCid).toMatch(/^sha256:/);
    expect(down.shadowStands).toBe(false);

    const { acts, shadowed } = await boardState(down.signerDid);
    expect(acts).toHaveLength(2);                  // BOTH acts survive as the record
    expect(shadowed.has(EDGE)).toBe(false);
  });

  it("★ an explicit causal parent makes the lower a deliberate descendant ★", async () => {
    const up   = await runEdgeKapae({ edgeId: EDGE, raised: true,  epochCid: EPOCH });
    const tie  = await runEdgeKapae({ edgeId: EDGE, raised: false, epochCid: EPOCH, parents: [up.actCid] });

    expect(tie.parents).toEqual([up.actCid]);
    expect(tie.shadowStands).toBe(false);
  });

  it("rejects a raw CID-poisoned board act when selecting the next frontier", async () => {
    const up = await runEdgeKapae({ edgeId: EDGE, raised: true, epochCid: EPOCH });
    const repo = new Repo({ storage: new NodeFSStorageAdapter(larDataDir()) });
    const handle = await materializeSharedLarDoc(repo, edgeKapaeBoardDocUrl(await loadVesselVerifyingKey()), "board:edge-kapae");
    const poisoned = { ...up, actCid: "sha256:raw-poison" };
    handle.change((d) => { d.tiddlers["raw-poison"] = mutableLarRecord("raw-poison", { text: JSON.stringify(poisoned) }, "test"); });
    await repo.flush();
    const down = await runEdgeKapae({ edgeId: EDGE, raised: false, epochCid: EPOCH });
    expect(down.parents).toEqual([up.actCid]);
    await repo.shutdown();
  });

  it("excludes a verified parent whose own grandparent is absent", async () => {
    const signer = await loadPersonaGroupRootSeed(0);
    const branch = await signEdgeKapae(
      { edgeId: EDGE, raised: true, parents: ["sha256:missing-grandparent"], epochCid: EPOCH },
      (bytes) => ed.signAsync(bytes, signer).then(hex),
    );
    const repo = new Repo({ storage: new NodeFSStorageAdapter(larDataDir()) });
    const handle = await materializeSharedLarDoc(repo, edgeKapaeBoardDocUrl(await loadVesselVerifyingKey()), "board:edge-kapae");
    handle.change((d) => { d.tiddlers["unavailable-branch"] = mutableLarRecord("unavailable-branch", { text: JSON.stringify(branch) }, "test"); });
    await repo.flush();
    const next = await runEdgeKapae({ edgeId: EDGE, raised: false, epochCid: EPOCH });
    expect(next.parents).toEqual([]);
    expect(next.shadowStands).toBe(false);
    await repo.shutdown();
  });

  it("the write asserts NO authority — an act lands, and a reader under a different authority drops it", async () => {
    const r = await runEdgeKapae({ edgeId: EDGE, raised: true, epochCid: EPOCH });
    expect(r.shadowStands).toBe(true);

    // the same board, read by someone who holds a DIFFERENT key as the edge's authority
    const stranger = await ed.getPublicKeyAsync(new Uint8Array(32).fill(9)).then(hex);
    const { acts, shadowed } = await boardState(stranger);
    expect(acts).toHaveLength(1);                  // the act sits on the board …
    expect(shadowed.size).toBe(0);                 // … and buys nothing where it holds no claim
  });

  it("acts on DIFFERENT edges never contend — each has its own founded head", async () => {
    const a = await runEdgeKapae({ edgeId: "edge-a", raised: true, epochCid: EPOCH });
    const b = await runEdgeKapae({ edgeId: "edge-b", raised: true, epochCid: EPOCH });
    expect(a.parents).toEqual([]);
    expect(b.parents).toEqual([]);

    const { shadowed } = await boardState(a.signerDid);
    expect([...shadowed].sort()).toEqual(["edge-a", "edge-b"]);
  });

  it("REFUSES a blank edge, a blank epochCid, and an unheld root", async () => {
    await expect(runEdgeKapae({ edgeId: "  ", raised: true, epochCid: EPOCH })).rejects.toThrow(EdgeKapaeError);
    await expect(runEdgeKapae({ edgeId: EDGE, raised: true, epochCid: "  " })).rejects.toThrow(EdgeKapaeError);
    await expect(runEdgeKapae({ edgeId: EDGE, raised: true, epochCid: EPOCH, handleIndex: 99 }))
      .rejects.toThrow(EdgeKapaeError);
  });
});
