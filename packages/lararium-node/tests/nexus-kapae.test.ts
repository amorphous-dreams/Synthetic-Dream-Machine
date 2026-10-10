/**
 * nexus-kapae.test.ts — the RAISE side of the Kapae immune antigen (#65), end-to-end through the node command.
 *
 * Proven, against a SYNTHETIC seated roster on a temp LAR_ROOT (real vessel identity, real founder persona-
 * roots, a real Automerge board on disk):
 *   · the full loop RAISE → board → read → fold → isKapaed — a 2-of-3 signed ban lands on the always-carried
 *     board and folds the victim nym to Kapae'd (the exact set the antigen-ring enforces on),
 *   · a SUB-QUORUM raise REFUSES (fewer than threshold HELD roots sit in the roster) — nothing written,
 *   · an UNSEATED charter REFUSES (no roster to root on),
 *   · un_kapae as a causal descendant LIFTS; the fold reflects it,
 *   · the written tiddler PERSISTS across Repo instances (a fresh Repo reads the prior write back).
 *
 * The signing is the a-multitude-of-one: one operator holds all three founding persona-roots and signs the
 * quorum with two of their OWN held roots (the real-cabal collect-signatures ceremony is the surfaced fork).
 */

import { NEXUS_DOC_DOMAIN } from "@lararium/mesh";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ed from "@noble/ed25519";
import { hex, genesisSealEpochCid, kapaeAntigenDocUrl, materializeSharedLarDoc, mutableLarRecord, signAntigenEntry, type NexusDoc } from "@lararium/mesh";
import { Repo } from "@automerge/automerge-repo";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import {
  generateOrLoadVesselIdentity, generateOrLoadPersonaGroupRoot, loadVesselVerifyingKey, loadPersonaGroupRootSeed,
} from "../src/node-vessel-identity.js";
import { larDataDir } from "../src/vessel-paths.js";
import { writeNexusDoc } from "../src/nexus-doc.js";
import { runNexusKapae, runNexusKapaeList, NexusKapaeError } from "../src/commands/nexus-kapae.js";
import { direct } from "./direct-store.js";

const VICTIM = "beadfeed".repeat(8);   // the presenter nym a ban targets

let root: string;
let priorLarRoot: string | undefined;

/** The bags dir under the isolated LAR_ROOT — mirrors the CLI's `larBagsDir()` (LAR_BAGS ?? <root>/bags). */
const sealHome = (): string => join(root, "state", "nexus");

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "lares-kapae-"));
  priorLarRoot = process.env["LAR_ROOT"];
  process.env["LAR_ROOT"] = root;   // isolates data/state/bags under the temp tree
});

afterEach(() => {
  if (priorLarRoot === undefined) delete process.env["LAR_ROOT"];
  else process.env["LAR_ROOT"] = priorLarRoot;
  rmSync(root, { recursive: true, force: true });
});

/** Seat a legacy-inception charter DOC binding the given verifying keys at 2-of-3 into `bags/nexus`. */
function seatCharter(keys: string[], threshold = 2): void {
  const doc: NexusDoc = {
    kind: NEXUS_DOC_DOMAIN,
    threshold,
    sealEpochCid: genesisSealEpochCid(keys, threshold),
    kahu: [
      { displayName: "Kahu Alpha", verifyingKey: keys[0] ?? null },
      { displayName: "Kahu Beta",        verifyingKey: keys[1] ?? null },
      { displayName: "Kahu Gamma",        verifyingKey: keys[2] ?? null },
    ],
  };
  writeNexusDoc(sealHome(), doc);
}

describe("nexus kapae — the RAISE side end-to-end (#65)", () => {
  it("RAISE → board → fold → isKapaed: a 2-of-3 held-root ban Kapae's the victim", async () => {
    await generateOrLoadVesselIdentity();
    const roots = await Promise.all([0, 1, 2].map((i) => generateOrLoadPersonaGroupRoot(i)));
    seatCharter(roots.map((r) => r.verifyingKey));

    const res = await direct(runNexusKapae)({ action: "kapae", nym: VICTIM, sealHome: sealHome() });
    expect(res.actCid).toMatch(/^sha256:/);
    expect(res.parents).toEqual([]);
    expect(res.signers).toHaveLength(2);       // exactly the 2-of-3 quorum
    expect(res.kapaedNow).toBe(true);          // folds to Kapae'd against the seated roster

    // A FRESH Repo (inside runNexusKapaeList) reads the persisted board back — the loop the ring runs.
    const list = await direct(runNexusKapaeList)({ sealHome: sealHome() });
    expect(list.kapaed).toContain(VICTIM);
    expect(list.entries).toHaveLength(1);
    expect(list.entries[0]).toMatchObject({ nym: VICTIM, action: "kapae", actCid: res.actCid, parents: [], signers: 2 });
  });

  it("un_kapae as a causal descendant LIFTS the standing ban", async () => {
    await generateOrLoadVesselIdentity();
    const roots = await Promise.all([0, 1, 2].map((i) => generateOrLoadPersonaGroupRoot(i)));
    seatCharter(roots.map((r) => r.verifyingKey));

    const ban = await direct(runNexusKapae)({ action: "kapae", nym: VICTIM, sealHome: sealHome() });
    const lift = await direct(runNexusKapae)({ action: "un_kapae", nym: VICTIM, sealHome: sealHome() });
    expect(lift.actCid).toMatch(/^sha256:/);
    expect(lift.parents).toEqual([ban.actCid]);
    expect(lift.kapaedNow).toBe(false);        // the fold lifts it

    const list = await direct(runNexusKapaeList)({ sealHome: sealHome() });
    expect(list.kapaed).not.toContain(VICTIM);
    expect(list.entries).toHaveLength(2);      // both entries accrete; the fold picks the higher

    // A re-ban as a child of the lift re-imposes it.
    const reban = await direct(runNexusKapae)({ action: "kapae", nym: VICTIM, sealHome: sealHome() });
    expect(reban.parents).toEqual([lift.actCid]);
    expect(reban.kapaedNow).toBe(true);
  });

  it("rejects a raw CID-poisoned board act when selecting the next frontier", async () => {
    await generateOrLoadVesselIdentity();
    const roots = await Promise.all([0, 1, 2].map((i) => generateOrLoadPersonaGroupRoot(i)));
    seatCharter(roots.map((r) => r.verifyingKey));
    const ban = await direct(runNexusKapae)({ action: "kapae", nym: VICTIM, sealHome: sealHome() });
    const repo = new Repo({ storage: new NodeFSStorageAdapter(larDataDir()) });
    const handle = await materializeSharedLarDoc(repo, kapaeAntigenDocUrl(await loadVesselVerifyingKey()), "board:kapae-antigen");
    const raw = { kind: "lararium/kapae-antigen", nym: VICTIM, action: "kapae", actCid: "sha256:raw-poison", parents: [], sealEpochCid: ban.sealEpochCid, signatures: [] };
    handle.change((d) => { d.tiddlers["raw-poison"] = mutableLarRecord("raw-poison", { text: JSON.stringify(raw) }, "test"); });
    await repo.flush();
    const lift = await direct(runNexusKapae)({ action: "un_kapae", nym: VICTIM, sealHome: sealHome() });
    expect(lift.parents).toEqual([ban.actCid]);
    await repo.shutdown();
  });

  it("excludes a verified parent whose own grandparent is absent", async () => {
    await generateOrLoadVesselIdentity();
    const roots = await Promise.all([0, 1, 2].map((i) => generateOrLoadPersonaGroupRoot(i)));
    seatCharter(roots.map((r) => r.verifyingKey));
    const epoch = genesisSealEpochCid(roots.map((r) => r.verifyingKey), 2);
    const signers = await Promise.all([0, 1].map(async (i) => ({
      signer: roots[i]!.verifyingKey,
      sign: async (bytes: Uint8Array) => ed.signAsync(bytes, await loadPersonaGroupRootSeed(i)).then(hex),
    })));
    const branch = await signAntigenEntry({ nym: VICTIM, action: "kapae", parents: ["sha256:missing-grandparent"], sealEpochCid: epoch }, signers);
    const repo = new Repo({ storage: new NodeFSStorageAdapter(larDataDir()) });
    const handle = await materializeSharedLarDoc(repo, kapaeAntigenDocUrl(await loadVesselVerifyingKey()), "board:kapae-antigen");
    handle.change((d) => { d.tiddlers["unavailable-branch"] = mutableLarRecord("unavailable-branch", { text: JSON.stringify(branch) }, "test"); });
    await repo.flush();
    const next = await direct(runNexusKapae)({ action: "un_kapae", nym: VICTIM, sealHome: sealHome() });
    expect(next.parents).toEqual([]);
    expect(next.kapaedNow).toBe(false);
    await repo.shutdown();
  });

  it("SUB-QUORUM REFUSES: one held root against a 2-of-3 roster writes NOTHING", async () => {
    await generateOrLoadVesselIdentity();
    const held = await generateOrLoadPersonaGroupRoot(0);   // the ONLY held root
    // Two roster co-signers the vessel does NOT hold — real ed25519 keys, just not in this vault.
    const stranger1 = hex(await ed.getPublicKeyAsync(new Uint8Array(32).fill(7)));
    const stranger2 = hex(await ed.getPublicKeyAsync(new Uint8Array(32).fill(8)));
    seatCharter([held.verifyingKey, stranger1, stranger2]);

    const refused = direct(runNexusKapae)({ action: "kapae", nym: VICTIM, sealHome: sealHome() });
    await expect(refused).rejects.toBeInstanceOf(NexusKapaeError);
    // The shared selector refuses in THIS door's words: it names the antigen act, never the membership one.
    await expect(refused).rejects.toThrow(/holds 1 seated persona-root\(s\), but a valid antigen act carries 2/);

    // Fail-closed: nothing landed on the board.
    const list = await direct(runNexusKapaeList)({ sealHome: sealHome() });
    expect(list.entries).toHaveLength(0);
    expect(list.kapaed).toHaveLength(0);
  });

  it("UNSEATED charter REFUSES: no roster to root a ban on", async () => {
    await generateOrLoadVesselIdentity();
    await generateOrLoadPersonaGroupRoot(0);
    // No seatCharter — the authority home is absent.
    await expect(direct(runNexusKapae)({ action: "kapae", nym: VICTIM, sealHome: sealHome() }))
      .rejects.toBeInstanceOf(NexusKapaeError);
  });

  it("a malformed nym REFUSES before any quorum work", async () => {
    await generateOrLoadVesselIdentity();
    const roots = await Promise.all([0, 1, 2].map((i) => generateOrLoadPersonaGroupRoot(i)));
    seatCharter(roots.map((r) => r.verifyingKey));
    await expect(direct(runNexusKapae)({ action: "kapae", nym: "not-a-key", sealHome: sealHome() }))
      .rejects.toBeInstanceOf(NexusKapaeError);
  });
});
