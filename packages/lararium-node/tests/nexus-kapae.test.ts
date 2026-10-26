/**
 * nexus-kapae.test.ts — the RAISE side of the Kapae immune antigen (#65), end-to-end through the node command.
 *
 * Proven, against a SYNTHETIC seated roster on a temp LAR_ROOT (real vessel identity, real founder persona
 * roots and seat keys, a real Automerge board on disk):
 *   · the full loop RAISE → board → read → fold → isKapaed — a 2-of-3 signed ban lands on the always-carried
 *     board and folds the victim nym to Kapae'd (the exact set the antigen-ring enforces on),
 *   · a SUB-QUORUM raise REFUSES (fewer than threshold HELD seat keys sit in the roster) — nothing written,
 *   · an UNSEATED charter REFUSES (no roster to root on),
 *   · un_kapae as a causal descendant LIFTS; the fold reflects it,
 *   · the written tiddler PERSISTS across Repo instances (a fresh Repo reads the prior write back).
 *
 * The signing is the a-multitude-of-one: one operator holds all three faces' seat keys and signs the
 * quorum with two of their OWN held seats; seats that rest in two vaults cross as a partial (nexus-kapae-two-vault).
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ed from "@noble/ed25519";
import { hex, kapaeAntigenDocUrl, materializeSharedLarDoc, mutableLarRecord, signAntigenEntry } from "@lararium/mesh";
import { Repo } from "@automerge/automerge-repo";
import { restEvery, restingRepo } from "./resting-repo.js";
import {
  generateOrLoadVesselIdentity, generateOrLoadPersonaGroupRoot, loadVesselVerifyingKey,
} from "../src/node-vessel-identity.js";
import { larDataDir } from "../src/vessel-paths.js";
import { writeNexusDoc } from "../src/nexus-doc.js";
import { runNexusKapae, runNexusKapaeList, NexusKapaeError } from "../src/commands/nexus-kapae.js";
import { direct } from "./direct-store.js";
import { heldCharter } from "../../lararium-mesh/tests/charter-fixture.js";
import { seatChairs } from "./seat-fixture.js";

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

afterEach(async () => {
  // Every Repo this suite opened rests (its adapter closed) before the directory leaves: no save of theirs can land after.
  await restEvery();
  if (priorLarRoot === undefined) delete process.env["LAR_ROOT"];
  else process.env["LAR_ROOT"] = priorLarRoot;
  rmSync(root, { recursive: true, force: true });
});

/** Seat the keys under a verifiable genesis lineage in `bags/nexus`; return its cid. */
function seatCharter(keys: string[], threshold = 2): string {
  const charter = heldCharter({ keys, threshold });
  const doc = charter.doc({ labels: ["Kahu Alpha", "Kahu Beta", "Kahu Gamma"] });
  writeNexusDoc(sealHome(), doc);
  return charter.head.epochCid;
}

describe("nexus kapae — the RAISE side end-to-end (#65)", () => {
  it("RAISE → board → fold → isKapaed: a 2-of-3 held-seat ban Kapae's the victim", async () => {
    await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } });
    await Promise.all([0, 1, 2].map((i) => generateOrLoadPersonaGroupRoot(i)));
    const chairs = await seatChairs([0, 1, 2]); seatCharter([...chairs.keys]);

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
    await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } });
    await Promise.all([0, 1, 2].map((i) => generateOrLoadPersonaGroupRoot(i)));
    const chairs = await seatChairs([0, 1, 2]); seatCharter([...chairs.keys]);

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
    await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } });
    await Promise.all([0, 1, 2].map((i) => generateOrLoadPersonaGroupRoot(i)));
    const chairs = await seatChairs([0, 1, 2]); seatCharter([...chairs.keys]);
    const ban = await direct(runNexusKapae)({ action: "kapae", nym: VICTIM, sealHome: sealHome() });
    const repo = restingRepo(larDataDir());
    const handle = await materializeSharedLarDoc(repo, kapaeAntigenDocUrl(await loadVesselVerifyingKey()), "board:kapae-antigen");
    const raw = { kind: "lararium/kapae-antigen", nym: VICTIM, action: "kapae", actCid: "sha256:raw-poison", parents: [], sealEpochCid: ban.sealEpochCid, signatures: [] };
    handle.change((d) => { d.tiddlers["raw-poison"] = mutableLarRecord("raw-poison", { text: JSON.stringify(raw) }, "test"); });
    await repo.flush();
    const lift = await direct(runNexusKapae)({ action: "un_kapae", nym: VICTIM, sealHome: sealHome() });
    expect(lift.parents).toEqual([ban.actCid]);
    await repo.rest();
  });

  it("excludes a verified parent whose own grandparent is absent", async () => {
    await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } });
    await Promise.all([0, 1, 2].map((i) => generateOrLoadPersonaGroupRoot(i)));
    const chairs = await seatChairs([0, 1, 2]);
    const epoch = seatCharter([...chairs.keys]);
    const signers = chairs.hands.slice(0, 2);
    const branch = await signAntigenEntry({ nym: VICTIM, action: "kapae", parents: ["sha256:missing-grandparent"], sealEpochCid: epoch }, signers);
    const repo = restingRepo(larDataDir());
    const handle = await materializeSharedLarDoc(repo, kapaeAntigenDocUrl(await loadVesselVerifyingKey()), "board:kapae-antigen");
    handle.change((d) => { d.tiddlers["unavailable-branch"] = mutableLarRecord("unavailable-branch", { text: JSON.stringify(branch) }, "test"); });
    await repo.flush();
    const next = await direct(runNexusKapae)({ action: "un_kapae", nym: VICTIM, sealHome: sealHome() });
    expect(next.parents).toEqual([]);
    expect(next.kapaedNow).toBe(false);
    await repo.rest();
  });

  it("SUB-QUORUM REFUSES: one held seat key against a 2-of-3 roster writes NOTHING", async () => {
    await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } });
    await generateOrLoadPersonaGroupRoot(0);
    const held = (await seatChairs([0])).keys[0]!;   // the ONLY held seat key
    // Two roster co-signers the vessel does NOT hold — real ed25519 keys, just not in this vault.
    const stranger1 = hex(await ed.getPublicKeyAsync(new Uint8Array(32).fill(7)));
    const stranger2 = hex(await ed.getPublicKeyAsync(new Uint8Array(32).fill(8)));
    seatCharter([held, stranger1, stranger2]);

    const refused = direct(runNexusKapae)({ action: "kapae", nym: VICTIM, sealHome: sealHome() });
    await expect(refused).rejects.toBeInstanceOf(NexusKapaeError);
    // The shared selector refuses in THIS door's words: it names the antigen act, never the membership one.
    await expect(refused).rejects.toThrow(/holds 1 seat key\(s\) of the seated roster, but a valid antigen act carries 2/);

    // Fail-closed: nothing landed on the board.
    const list = await direct(runNexusKapaeList)({ sealHome: sealHome() });
    expect(list.entries).toHaveLength(0);
    expect(list.kapaed).toHaveLength(0);
  });

  it("UNSEATED charter REFUSES: no roster to root a ban on", async () => {
    await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } });
    await generateOrLoadPersonaGroupRoot(0);
    // No seatCharter — the authority home is absent.
    await expect(direct(runNexusKapae)({ action: "kapae", nym: VICTIM, sealHome: sealHome() }))
      .rejects.toBeInstanceOf(NexusKapaeError);
  });

  it("a malformed nym REFUSES before any quorum work", async () => {
    await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } });
    await Promise.all([0, 1, 2].map((i) => generateOrLoadPersonaGroupRoot(i)));
    const chairs = await seatChairs([0, 1, 2]); seatCharter([...chairs.keys]);
    await expect(direct(runNexusKapae)({ action: "kapae", nym: "not-a-key", sealHome: sealHome() }))
      .rejects.toBeInstanceOf(NexusKapaeError);
  });
});
