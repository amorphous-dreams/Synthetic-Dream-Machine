/**
 * carried-set.test.ts — the SET of Nexuses a vessel carries for, one contract-in each.
 *
 * Proven on a temp LAR_ROOT with a real vessel identity, real persona-roots, and real charters rendered
 * through the house carrier:
 *   · two consents to two Nexuses keep two records and carry two AIDs,
 *   · a partner charter lands BESIDE the primary and leaves its bytes untouched,
 *   · a re-import that extends N's lineage drops N from the set until the operator consents again,
 *   · a seated chair carries its Nexus with no consent record, primary or carried.
 * And the controls:
 *   · a planted consent, a root-nym consent, and another operator's genuine consent stay excluded,
 *   · a re-import that forks or rewinds the held lineage refuses and leaves the held bytes standing,
 *   · the primary's own charter, or a torn one, refuses to land as a carried charter.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import * as ed from "@noble/ed25519";
import {
  NEXUS_DOC_DOMAIN, hex, genesisCharterEpoch, rotateSealEpoch, sealKeySetHash, signCarriageContract, ed25519SignerFromSeed,
  realmIdOfCharter, type NexusDoc, type SealEpoch,
} from "@lararium/mesh";
import { generateOrLoadVesselIdentity, generateOrLoadPersonaGroupRoot, loadPersonaGroupRootSeed } from "../src/node-vessel-identity.js";
import { renderNexusDoc, writeNexusDoc, nexusCharterDocPath } from "../src/nexus-doc.js";
import {
  importCarriedCharter, readCarriedCharters, readConsent, writeConsent, carriedSet, carriedReadings,
  carriageConsentPathFor, carriedCharterHome, hasContractedInto, CarriedCharterError,
} from "../src/carried-set.js";
import { runNexusAcceptCarriage } from "../src/commands/nexus-contract.js";

let root: string;
let priorLarRoot: string | undefined;
const sealHome = (): string => join(root, "state", "nexus");

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "lares-carried-"));
  priorLarRoot = process.env["LAR_ROOT"];
  process.env["LAR_ROOT"] = root;
});
afterEach(() => {
  if (priorLarRoot === undefined) delete process.env["LAR_ROOT"];
  else process.env["LAR_ROOT"] = priorLarRoot;
  rmSync(root, { recursive: true, force: true });
});

/** Three verifying keys this vessel does NOT hold — a partner Nexus's founding kahu. */
async function foreignKeys(salt: number): Promise<string[]> {
  return Promise.all([1, 2, 3].map(async (i) => hex(await ed.getPublicKeyAsync(new Uint8Array(32).fill(salt + i)))));
}

/**
 * A partner Nexus with a pre-rotated lineage that alternates its quorum between 2 and 3, so each
 * rotation reveals the key-set its predecessor committed to. `fork` varies a rotation's next commit.
 */
function lineageCharter(keys: string[], depth: number, fork = 0): { doc: NexusDoc; lineage: SealEpoch[] } {
  const kahu = keys.map((k, i) => ({ displayName: `Partner ${i}`, verifyingKey: k }));
  const lineage: SealEpoch[] = [genesisCharterEpoch(keys, 2, sealKeySetHash(keys, 3))];
  let threshold = 2;
  for (let d = 1; d < depth; d++) {
    const revealed = threshold === 2 ? 3 : 2;
    const next     = d === depth - 1 && fork > 0 ? sealKeySetHash(keys, 1 + fork) : sealKeySetHash(keys, threshold);
    const r = rotateSealEpoch(lineage[lineage.length - 1]!, keys, revealed, next);
    if (!r.ok) throw new Error(r.reason);
    lineage.push(r.epoch);
    threshold = revealed;
  }
  const head = lineage[lineage.length - 1]!;
  return { doc: { kind: NEXUS_DOC_DOMAIN, threshold, sealEpochCid: head.epochCid, sealLineage: lineage, kahu }, lineage };
}

/** A partner Nexus with a genesis-only charter (no lineage), its AID the stored epoch. */
function genesisOnlyCharter(keys: string[], threshold: number): NexusDoc {
  const doc = lineageCharter(keys, 1).doc;
  return { ...doc, threshold, sealLineage: undefined, sealEpochCid: `epoch0-${"0".repeat(63)}${threshold}` };
}

/** This vessel's own founding: three held persona-roots seated in the primary charter. */
async function standFounding(): Promise<string[]> {
  await generateOrLoadVesselIdentity();
  const roots = await Promise.all([0, 1, 2].map((i) => generateOrLoadPersonaGroupRoot(i)));
  const keys  = roots.map((r) => r.verifyingKey);
  writeNexusDoc(sealHome(), lineageCharter(keys, 1).doc);
  return keys;
}

/** A vessel that founded nothing and holds one persona to consent with. */
async function standJoiner(): Promise<void> {
  await generateOrLoadVesselIdentity();
  await generateOrLoadPersonaGroupRoot(0);
}

describe("the carried set — one contract-in per Nexus", () => {
  it("★ two accept-carriage calls for two AIDs keep two consent records and carry two Nexuses ★", async () => {
    await standJoiner();
    const n1 = importCarriedCharter(sealHome(), renderNexusDoc(lineageCharter(await foreignKeys(10), 1).doc));
    const n2 = importCarriedCharter(sealHome(), renderNexusDoc(lineageCharter(await foreignKeys(20), 1).doc));
    expect(n1.aid).not.toBe(n2.aid);
    expect(await carriedSet(sealHome())).toEqual(new Set());   // charters held, nothing consented

    const c1 = await runNexusAcceptCarriage({ handleIndex: 0, sealHome: sealHome(), aid: n1.aid });
    const c2 = await runNexusAcceptCarriage({ handleIndex: 0, sealHome: sealHome(), aid: n2.aid });
    expect(c1.nym).not.toBe(c2.nym);                             // one leaf per Nexus

    expect(readConsent(sealHome(), n1.aid)).toMatchObject({ nym: c1.nym, sealEpochCid: n1.sealEpochCid });
    expect(readConsent(sealHome(), n2.aid)).toMatchObject({ nym: c2.nym, sealEpochCid: n2.sealEpochCid });
    expect(readdirSync(dirname(carriageConsentPathFor(sealHome(), n1.aid))).sort()).toEqual([`${n1.aid}.json`, `${n2.aid}.json`].sort());

    const set = await carriedSet(sealHome());
    expect(set.size).toBe(2);
    expect(set).toEqual(new Set([n1.aid, n2.aid]));
  });

  it("★ no single consent file remains — consent lives per Nexus ★", async () => {
    await standJoiner();
    const n = importCarriedCharter(sealHome(), renderNexusDoc(lineageCharter(await foreignKeys(10), 1).doc));
    await runNexusAcceptCarriage({ handleIndex: 0, sealHome: sealHome(), aid: n.aid });
    expect(existsSync(join(sealHome(), "nexus", "carriage-consent.json"))).toBe(false);
    expect(existsSync(carriageConsentPathFor(sealHome(), n.aid))).toBe(true);
  });

  it("★ a partner charter lands BESIDE the primary and leaves its bytes identical ★", async () => {
    await standFounding();
    const before = readFileSync(nexusCharterDocPath(sealHome()));
    const n = importCarriedCharter(sealHome(), renderNexusDoc(lineageCharter(await foreignKeys(10), 1).doc));
    expect(readFileSync(nexusCharterDocPath(sealHome())).equals(before)).toBe(true);
    expect(n.path).toBe(join(carriedCharterHome(sealHome(), n.aid), "founding-roster.mem"));
    expect([...readCarriedCharters(sealHome()).keys()]).toEqual([n.aid]);
  });

  it("★ a re-import that EXTENDS the lineage drops N until re-consent ★", async () => {
    await standJoiner();
    const keys = await foreignKeys(10);
    const n = importCarriedCharter(sealHome(), renderNexusDoc(lineageCharter(keys, 1).doc));
    await runNexusAcceptCarriage({ handleIndex: 0, sealHome: sealHome(), aid: n.aid });
    expect(await carriedSet(sealHome())).toEqual(new Set([n.aid]));

    const rotated = importCarriedCharter(sealHome(), renderNexusDoc(lineageCharter(keys, 2).doc));
    expect(rotated.aid).toBe(n.aid);                             // a rotation keeps the AID
    expect(rotated.outcome).toBe("extended");
    expect(await hasContractedInto(sealHome(), n.aid)).toBe(false);
    expect(await carriedSet(sealHome())).toEqual(new Set());     // the consent sits behind the head

    await runNexusAcceptCarriage({ handleIndex: 0, sealHome: sealHome(), aid: n.aid });
    expect(await carriedSet(sealHome())).toEqual(new Set([n.aid]));
  });

  it("★ a seated chair carries its Nexus with NO consent record — primary or carried ★", async () => {
    const keys = await standFounding();
    const primary = realmIdOfCharter(lineageCharter(keys, 1).doc)!;
    // A partner Nexus that seats one of this vessel's roots beside two foreign chairs.
    const shared = importCarriedCharter(sealHome(), renderNexusDoc(lineageCharter([keys[0]!, ...(await foreignKeys(30)).slice(0, 2)], 1).doc));

    expect(readConsent(sealHome(), primary)).toBeNull();
    expect(readConsent(sealHome(), shared.aid)).toBeNull();
    expect(await carriedSet(sealHome())).toEqual(new Set([primary, shared.aid]));
    const readings = await carriedReadings(sealHome());
    expect(readings.map((r) => [r.primary, r.seated, r.consented])).toEqual([[true, true, false], [false, true, false]]);
  });
});

describe("CONTROLS — what stays out of the set, and what refuses to land", () => {
  async function oneCarried(): Promise<{ aid: string; head: string }> {
    await standJoiner();
    const n = importCarriedCharter(sealHome(), renderNexusDoc(lineageCharter(await foreignKeys(10), 1).doc));
    return { aid: n.aid, head: n.sealEpochCid };
  }

  it("CONTROL — a PLANTED consent stays excluded: the file's location is not evidence", async () => {
    const { aid, head } = await oneCarried();
    const leafLike = hex(await ed.getPublicKeyAsync(new Uint8Array(32).fill(77)));
    writeConsent(sealHome(), aid, { nym: leafLike, sealEpochCid: head, contractSig: "00".repeat(64) });
    expect(await hasContractedInto(sealHome(), aid)).toBe(false);
    expect(await carriedSet(sealHome())).toEqual(new Set());
  });

  it("CONTROL — ANOTHER operator's genuine consent stays excluded: the nym must be a held leaf", async () => {
    const { aid, head } = await oneCarried();
    const seed = new Uint8Array(32).fill(9);
    const nym  = hex(await ed.getPublicKeyAsync(seed));
    const q    = await signCarriageContract(nym, head, async (b) => hex(await ed.signAsync(b, seed)));
    writeConsent(sealHome(), aid, { nym, sealEpochCid: head, contractSig: q.sig });
    expect(await hasContractedInto(sealHome(), aid)).toBe(false);
    expect(await carriedSet(sealHome())).toEqual(new Set());
  });

  it("CONTROL — a genuine consent signed by this vessel's own ROOT stays excluded", async () => {
    const { aid, head } = await oneCarried();
    const rootKey = (await generateOrLoadPersonaGroupRoot(0)).verifyingKey.toLowerCase();
    const q = await signCarriageContract(rootKey, head, ed25519SignerFromSeed(await loadPersonaGroupRootSeed(0)));
    writeConsent(sealHome(), aid, { nym: rootKey, sealEpochCid: head, contractSig: q.sig });
    expect(await hasContractedInto(sealHome(), aid)).toBe(false);
  });

  it("CONTROL — a consent filed under the WRONG AID carries neither Nexus", async () => {
    await standJoiner();
    const n1 = importCarriedCharter(sealHome(), renderNexusDoc(lineageCharter(await foreignKeys(10), 1).doc));
    const n2 = importCarriedCharter(sealHome(), renderNexusDoc(lineageCharter(await foreignKeys(20), 1).doc));
    const c1 = await runNexusAcceptCarriage({ handleIndex: 0, sealHome: sealHome(), aid: n1.aid });
    rmSync(carriageConsentPathFor(sealHome(), n1.aid));
    writeConsent(sealHome(), n2.aid, c1);                         // n1's genuine consent, moved under n2
    expect(await carriedSet(sealHome())).toEqual(new Set());
  });

  it("CONTROL — a re-import that FORKS the held lineage refuses; the held bytes stand", async () => {
    await standJoiner();
    const keys = await foreignKeys(10);
    const n = importCarriedCharter(sealHome(), renderNexusDoc(lineageCharter(keys, 3).doc));
    const held = readFileSync(n.path);
    const fork = lineageCharter(keys, 3, 1).doc;                   // same genesis, a different epoch-2
    expect(realmIdOfCharter(fork)).toBe(n.aid);
    expect(fork.sealEpochCid).not.toBe(n.sealEpochCid);
    expect(() => importCarriedCharter(sealHome(), renderNexusDoc(fork))).toThrow(CarriedCharterError);
    expect(readFileSync(n.path).equals(held)).toBe(true);
  });

  it("CONTROL — a re-import that REWINDS to an ancestor refuses; the held bytes stand", async () => {
    await standJoiner();
    const keys = await foreignKeys(10);
    const n = importCarriedCharter(sealHome(), renderNexusDoc(lineageCharter(keys, 2).doc));
    const held = readFileSync(n.path);
    expect(() => importCarriedCharter(sealHome(), renderNexusDoc(lineageCharter(keys, 1).doc))).toThrow(CarriedCharterError);
    expect(readFileSync(n.path).equals(held)).toBe(true);
  });

  it("CONTROL — re-importing the SAME head passes and carries the consent through", async () => {
    await standJoiner();
    const keys = await foreignKeys(10);
    const n = importCarriedCharter(sealHome(), renderNexusDoc(lineageCharter(keys, 1).doc));
    await runNexusAcceptCarriage({ handleIndex: 0, sealHome: sealHome(), aid: n.aid });
    expect(importCarriedCharter(sealHome(), renderNexusDoc(lineageCharter(keys, 1).doc)).outcome).toBe("same");
    expect(await carriedSet(sealHome())).toEqual(new Set([n.aid]));
  });

  it("CONTROL — a different genesis over the same kahu names a different Nexus and lands beside, never over", async () => {
    await standJoiner();
    const keys = await foreignKeys(10);
    const n = importCarriedCharter(sealHome(), renderNexusDoc(genesisOnlyCharter(keys, 2)));
    expect(n.outcome).toBe("landed");
    const other = importCarriedCharter(sealHome(), renderNexusDoc(lineageCharter(keys, 1).doc));
    expect(other.aid).not.toBe(n.aid);
    expect(readCarriedCharters(sealHome()).size).toBe(2);
  });

  it("CONTROL — the primary's OWN charter refuses to land as a carried copy", async () => {
    const keys = await standFounding();
    expect(() => importCarriedCharter(sealHome(), renderNexusDoc(lineageCharter(keys, 1).doc))).toThrow(CarriedCharterError);
    expect(existsSync(join(sealHome(), "carried"))).toBe(false);
  });

  it("CONTROL — a torn or unseated charter refuses and writes nothing", async () => {
    await standJoiner();
    expect(() => importCarriedCharter(sealHome(), "not a charter")).toThrow(CarriedCharterError);
    expect(() => importCarriedCharter(sealHome(), renderNexusDoc({ kind: NEXUS_DOC_DOMAIN, threshold: 2, sealEpochCid: null, kahu: [] })))
      .toThrow(CarriedCharterError);
    expect(existsSync(join(sealHome(), "carried"))).toBe(false);
  });

  it("CONTROL — a carried directory whose charter names another AID is not read as that directory's Nexus", async () => {
    await standJoiner();
    const n = importCarriedCharter(sealHome(), renderNexusDoc(lineageCharter(await foreignKeys(10), 1).doc));
    const misplaced = join(sealHome(), "carried", "epoch0-" + "f".repeat(64), "founding-roster.mem");
    mkdirSync(dirname(misplaced), { recursive: true });
    writeFileSync(misplaced, readFileSync(n.path));
    expect([...readCarriedCharters(sealHome()).keys()]).toEqual([n.aid]);
  });
});
