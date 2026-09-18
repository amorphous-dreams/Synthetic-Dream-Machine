/**
 * edge-kapae-cmd — raising and lowering a relationship, end-to-end through the node.
 *
 * Proven on a real vessel with a real persona root over a temp LAR_ROOT. What matters: the version CLIMBS
 * from the board so a fresh act supersedes rather than ties; a lower takes the shadow down while BOTH acts
 * survive as the record; a pinned same-version lower leaves the shadow UP (remove-wins, reachable from the
 * verb); and the write asserts no authority — a root with no claim over an edge still lands an act that
 * every reader consulting a different authority drops.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import * as ed from "@noble/ed25519";
import { Repo } from "@automerge/automerge-repo";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import {
  hex, hexToBytes, edgeKapaeBoardDocUrl, materializeSharedLarDoc,
  edgeKapaeActsFromBoard, shadowSetFromBoard,
  noChainHeld,
} from "@lararium/mesh";
import {
  generateOrLoadVesselIdentity, generateOrLoadPersonaGroupRoot,
  loadVesselVerifyingKey, loadPersonaGroupRootVerifyingKey,
} from "../src/node-vessel-identity.js";
import { larDataDir } from "../src/vessel-paths.js";
import { readNexusDoc, nexusCharterDocPath } from "../src/nexus-doc.js";
import { daemonBagsDir } from "../src/lares-config.js";
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
  // so the fold orders on version alone, which is exactly what these witnesses exercise.
  const shadowed = await shadowSetFromBoard(handle.doc(), () => authority, verify, noChainHeld);
  await repo.flush();
  return { acts, shadowed };
}

describe("runEdgeKapae — a relationship set aside, and taken back", () => {
  it("RAISES, and the shadow stands under the signer that raised it", async () => {
    const r = await runEdgeKapae({ edgeId: EDGE, raised: true, epochCid: EPOCH });

    expect(r.version).toBe(1);                     // a monotone counter starts where the law starts it
    expect(r.shadowStands).toBe(true);
    expect(r.signerDid).toBe(await loadPersonaGroupRootVerifyingKey(0));

    const { shadowed } = await boardState(r.signerDid);
    expect(shadowed.has(EDGE)).toBe(true);
  });

  it("★ the version CLIMBS from the board, so a lower SUPERSEDES rather than ties ★", async () => {
    const up   = await runEdgeKapae({ edgeId: EDGE, raised: true,  epochCid: EPOCH });
    const down = await runEdgeKapae({ edgeId: EDGE, raised: false, epochCid: EPOCH });

    expect(up.version).toBe(1);
    expect(down.version).toBe(2);
    expect(down.shadowStands).toBe(false);

    const { acts, shadowed } = await boardState(down.signerDid);
    expect(acts).toHaveLength(2);                  // BOTH acts survive as the record
    expect(shadowed.has(EDGE)).toBe(false);
  });

  it("★ a PINNED same-version lower leaves the shadow UP — remove-wins, reachable from the verb ★", async () => {
    const up   = await runEdgeKapae({ edgeId: EDGE, raised: true,  epochCid: EPOCH });
    const tie  = await runEdgeKapae({ edgeId: EDGE, raised: false, epochCid: EPOCH, version: up.version });

    expect(tie.version).toBe(up.version);
    expect(tie.shadowStands).toBe(true);           // the raise held the tie
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

  it("acts on DIFFERENT edges never contend — each climbs its own counter", async () => {
    const a = await runEdgeKapae({ edgeId: "edge-a", raised: true, epochCid: EPOCH });
    const b = await runEdgeKapae({ edgeId: "edge-b", raised: true, epochCid: EPOCH });
    expect(a.version).toBe(1);
    expect(b.version).toBe(1);                     // b's counter never saw a's

    const { shadowed } = await boardState(a.signerDid);
    expect([...shadowed].sort()).toEqual(["edge-a", "edge-b"]);
  });

  it("REFUSES a blank edge, a blank epochCid, an unheld root, and a sub-floor version", async () => {
    await expect(runEdgeKapae({ edgeId: "  ", raised: true, epochCid: EPOCH })).rejects.toThrow(EdgeKapaeError);
    await expect(runEdgeKapae({ edgeId: EDGE, raised: true, epochCid: "  " })).rejects.toThrow(EdgeKapaeError);
    await expect(runEdgeKapae({ edgeId: EDGE, raised: true, epochCid: EPOCH, handleIndex: 99 }))
      .rejects.toThrow(EdgeKapaeError);
    await expect(runEdgeKapae({ edgeId: EDGE, raised: true, epochCid: EPOCH, version: 0 }))
      .rejects.toThrow(EdgeKapaeError);
  });
});

/**
 * A TORN CHARTER MUST NOT SILENTLY DEGRADE THE EPOCH ORDERING.
 *
 * `foldEdgeKapae` ranks acts by `epochOrder(epochCid) ?? -1`, so a reader that answers null for every cid
 * orders on VERSION ALONE — and the mesh law names that state out loud: `noChainHeld` exists precisely so
 * "a caller that cannot order epochs should SAY it at the call site where a reviewer will see it."
 *
 * This command built its rank map from `readNexusDoc(...)?.sealLineage ?? []`, which answers the empty
 * chain for BOTH "no charter stands" and "a charter stands and reads torn". The first reads as the honest
 * floor. The second hides a degradation inside a default: a command deciding whether a shadow STANDS drops
 * to version-only ordering, and the doc for that state says the ceiling grab stands open.
 *
 * Absent keeps the floor. TORN refuses.
 */
describe("the epoch ordering a kāpae act folds under", () => {
  it("★ a charter that STANDS and reads torn refuses the act — never a silent drop to version-only ★", async () => {
    // The suite's beforeEach already stood the vessel identity and persona root.
    // Tear the charter: the file stands, its fenced blocks no longer compose.
    const charter = nexusCharterDocPath(daemonBagsDir());
    mkdirSync(dirname(charter), { recursive: true });
    writeFileSync(charter, "```toml seal\nnot a fence at all\n", "utf8");
    expect(readNexusDoc(daemonBagsDir()), "the tear did not tear").toBeNull();

    await expect(runEdgeKapae({
      edgeId: "edge-torn", epochCid: "cid-torn", raised: true, storageDir: larDataDir(),
    })).rejects.toThrow(/torn|unreadable|refus/i);
  });

  it("CONTROL — with NO charter at all the act still lands: the honest floor, ordered on version alone", async () => {
    expect(readNexusDoc(daemonBagsDir())).toBeNull();

    const out = await runEdgeKapae({
      edgeId: "edge-nochain", epochCid: "cid-nochain", raised: true, storageDir: larDataDir(),
    });
    expect(out.edgeId).toBe("edge-nochain");
  });
});
