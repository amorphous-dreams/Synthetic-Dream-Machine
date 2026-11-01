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
import { describe, expect } from "vitest";
import { createHash, createPrivateKey, createPublicKey } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import * as ed from "@noble/ed25519";
import {
  hex, emptyFoundingCharterDoc, signCarriageContract, ed25519SignerFromSeed,
  nexusAidOf, type NexusDoc, type SealEpoch,
} from "@lararium/mesh";
import { generateOrLoadVesselIdentity, generateOrLoadPersonaGroupRoot, loadPersonaGroupRootSeed } from "../src/node-vessel-identity.js";
import { renderNexusDoc, writeNexusDoc, nexusCharterDocPath, parseNexusDoc } from "../src/nexus-doc.js";
import {
  importCarriedCharter, readCarriedCharters, readConsent, writeConsent, carriedSet, carriedReadings,
  carriageConsentPathFor, carriedCharterHome, hasContractedInto, CarriedCharterError,
} from "../src/carried-set.js";
import { runNexusAcceptCarriage } from "../src/commands/nexus-contract.js";
import { heldCharter, type HeldCharter } from "../../lararium-mesh/tests/charter-fixture.js";
import { seatChairs } from "./seat-fixture.js";
import { scratchRoot as root, it } from "./support/scratch-fixture.js";

const sealHome = (): string => join(root, "state", "nexus");


/** The seed behind each foreign key, so a partner's revealed hands can sign its rolls. */
const seedOf = new Map<string, Uint8Array>();

/** Three verifying keys this vessel does NOT hold — a partner Nexus's founding kahu. */
async function foreignKeys(salt: number): Promise<string[]> {
  return Promise.all([1, 2, 3].map(async (i) => {
    const seed = new Uint8Array(32).fill(salt + i);
    const pub = hex(await ed.getPublicKeyAsync(seed));
    seedOf.set(pub, seed);
    return pub;
  }));
}

/** The partner's hands over `keys`, each signing with its own seed. */
function partnerHands(keys: readonly string[]): { signer: string; sign: (b: Uint8Array) => Promise<string> }[] {
  return keys.map((k) => {
    const seed = seedOf.get(k);
    if (!seed) throw new Error("fixture: no seed for a key that must sign a roll");
    return { signer: k, sign: (b: Uint8Array) => ed.signAsync(b, seed).then(hex) };
  });
}

const partnerLabels = (keys: readonly string[]): string[] => keys.map((_, i) => `Partner ${i}`);

/**
 * The partner's seats at generation `g`: generation 0 names `keys`; each later one draws fresh seeds off the first
 * key (and `fork`), so no roll re-seats a key an earlier roll seated. Each seed lands in `seedOf`, so its hand signs.
 */
function partnerGeneration(keys: readonly string[], g: number, fork = 0): string[] {
  if (g === 0) return [...keys];
  return keys.map((_, i) => {
    const seed = Uint8Array.from(createHash("sha256").update(`carried-set|partner|${keys[0]}|${g}|${fork}|${i}`).digest());
    const der = Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), Buffer.from(seed)]);
    const pub = Buffer.from((createPublicKey(createPrivateKey({ key: der, format: "der", type: "pkcs8" })).export({ format: "jwk" }) as { x: string }).x, "base64url").toString("hex");
    seedOf.set(pub, seed);
    return pub;
  });
}

/** A partner charter at genesis: two of its seats sign, and it names the next generation's seats for its first roll. */
const partnerGenesis = (keys: string[]): HeldCharter => heldCharter({ keys, threshold: 2, successors: { keys: partnerGeneration(keys, 1), threshold: 2 } });

/** A partner Nexus at genesis only: one epoch, no roll. */
function genesisCharter(keys: string[]): { doc: NexusDoc; lineage: readonly SealEpoch[] } {
  const standing = partnerGenesis(keys);
  return { doc: standing.doc({ labels: partnerLabels(keys) }), lineage: standing.chain };
}

/**
 * A partner Nexus with a signed lineage that rolls to a fresh generation of seats at each step, so each rotation
 * seats what its predecessor named, under those seats' hands. `fork` varies what the last rotation names for the
 * roll after it.
 */
async function lineageCharter(keys: string[], depth: number, fork = 0): Promise<{ doc: NexusDoc; lineage: readonly SealEpoch[] }> {
  let standing = partnerGenesis(keys);
  for (let d = 1; d < depth; d++) {
    const named = partnerGeneration(keys, d + 1, d === depth - 1 ? fork : 0);
    standing = await standing.roll(partnerHands(partnerGeneration(keys, d)), { keys: named, threshold: 2 });
  }
  return { doc: standing.doc({ labels: partnerLabels(keys) }), lineage: standing.chain };
}

/** A SECOND, DIFFERENT genesis over the same kahu: another charter, so another AID, with a verified
 *  one-epoch lineage of its own. */
function genesisOnlyCharter(keys: string[], threshold: number): NexusDoc {
  return heldCharter({ keys, threshold, variant: 1 }).doc({ labels: partnerLabels(keys) });
}

/** This vessel's own founding: three held seat keys, filed under held persona-roots. */
async function standFounding(): Promise<string[]> {
  await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } });
  await Promise.all([0, 1, 2].map((i) => generateOrLoadPersonaGroupRoot(i)));
  const { keys } = await seatChairs([0, 1, 2]);
  writeNexusDoc(sealHome(), genesisCharter(keys).doc);
  return keys;
}

/** A vessel that founded nothing and holds one persona to consent with. */
async function standJoiner(): Promise<void> {
  await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } });
  await generateOrLoadPersonaGroupRoot(0);
}

describe("the carried set — one contract-in per Nexus", () => {
  it("★ two accept-carriage calls for two AIDs keep two consent records and carry two Nexuses ★", async () => {
    await standJoiner();
    const n1 = importCarriedCharter(sealHome(), renderNexusDoc(genesisCharter(await foreignKeys(10)).doc));
    const n2 = importCarriedCharter(sealHome(), renderNexusDoc(genesisCharter(await foreignKeys(20)).doc));
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
    const n = importCarriedCharter(sealHome(), renderNexusDoc(genesisCharter(await foreignKeys(10)).doc));
    await runNexusAcceptCarriage({ handleIndex: 0, sealHome: sealHome(), aid: n.aid });
    expect(existsSync(join(sealHome(), "nexus", "carriage-consent.json"))).toBe(false);
    expect(existsSync(carriageConsentPathFor(sealHome(), n.aid))).toBe(true);
  });

  it("★ a partner charter lands BESIDE the primary and leaves its bytes identical ★", async () => {
    await standFounding();
    const before = readFileSync(nexusCharterDocPath(sealHome()));
    const n = importCarriedCharter(sealHome(), renderNexusDoc(genesisCharter(await foreignKeys(10)).doc));
    expect(readFileSync(nexusCharterDocPath(sealHome())).equals(before)).toBe(true);
    expect(n.path).toBe(join(carriedCharterHome(sealHome(), n.aid), "founding-roster.mem"));
    expect([...readCarriedCharters(sealHome()).keys()]).toEqual([n.aid]);
  });

  it("★ a re-import that EXTENDS the lineage drops N until re-consent ★", async () => {
    await standJoiner();
    const keys = await foreignKeys(10);
    const n = importCarriedCharter(sealHome(), renderNexusDoc(genesisCharter(keys).doc));
    await runNexusAcceptCarriage({ handleIndex: 0, sealHome: sealHome(), aid: n.aid });
    expect(await carriedSet(sealHome())).toEqual(new Set([n.aid]));

    const rotated = importCarriedCharter(sealHome(), renderNexusDoc((await lineageCharter(keys, 2)).doc));
    expect(rotated.aid).toBe(n.aid);                             // a rotation keeps the AID
    expect(rotated.outcome).toBe("extended");
    expect(await hasContractedInto(sealHome(), n.aid)).toBe(false);
    expect(await carriedSet(sealHome())).toEqual(new Set());     // the consent sits behind the head

    await runNexusAcceptCarriage({ handleIndex: 0, sealHome: sealHome(), aid: n.aid });
    expect(await carriedSet(sealHome())).toEqual(new Set([n.aid]));
  });

  it("★ a seated chair carries its Nexus with NO consent record — primary or carried ★", async () => {
    const keys = await standFounding();
    const primary = nexusAidOf(genesisCharter(keys).doc)!;
    // A partner Nexus that seats one of this vessel's roots beside two foreign chairs.
    const shared = importCarriedCharter(sealHome(), renderNexusDoc(genesisCharter([keys[0]!, ...(await foreignKeys(30)).slice(0, 2)]).doc));

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
    const n = importCarriedCharter(sealHome(), renderNexusDoc(genesisCharter(await foreignKeys(10)).doc));
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
    const n1 = importCarriedCharter(sealHome(), renderNexusDoc(genesisCharter(await foreignKeys(10)).doc));
    const n2 = importCarriedCharter(sealHome(), renderNexusDoc(genesisCharter(await foreignKeys(20)).doc));
    const c1 = await runNexusAcceptCarriage({ handleIndex: 0, sealHome: sealHome(), aid: n1.aid });
    rmSync(carriageConsentPathFor(sealHome(), n1.aid));
    writeConsent(sealHome(), n2.aid, c1);                         // n1's genuine consent, moved under n2
    expect(await carriedSet(sealHome())).toEqual(new Set());
  });

  it("CONTROL — a re-import that FORKS the held lineage refuses; the held bytes stand", async () => {
    await standJoiner();
    const keys = await foreignKeys(10);
    const n = importCarriedCharter(sealHome(), renderNexusDoc((await lineageCharter(keys, 3)).doc));
    const held = readFileSync(n.path);
    const fork = (await lineageCharter(keys, 3, 1)).doc;                  // same genesis, a different epoch-2
    expect(nexusAidOf(fork)).toBe(n.aid);
    expect(fork.sealEpochCid).not.toBe(n.sealEpochCid);
    expect(() => importCarriedCharter(sealHome(), renderNexusDoc(fork))).toThrow(CarriedCharterError);
    expect(readFileSync(n.path).equals(held)).toBe(true);
  });

  it("CONTROL — a re-import that REWINDS to an ancestor refuses; the held bytes stand", async () => {
    await standJoiner();
    const keys = await foreignKeys(10);
    const n = importCarriedCharter(sealHome(), renderNexusDoc((await lineageCharter(keys, 2)).doc));
    const held = readFileSync(n.path);
    expect(() => importCarriedCharter(sealHome(), renderNexusDoc(genesisCharter(keys).doc))).toThrow(CarriedCharterError);
    expect(readFileSync(n.path).equals(held)).toBe(true);
  });

  it("CONTROL — re-importing the SAME head passes and carries the consent through", async () => {
    await standJoiner();
    const keys = await foreignKeys(10);
    const n = importCarriedCharter(sealHome(), renderNexusDoc(genesisCharter(keys).doc));
    await runNexusAcceptCarriage({ handleIndex: 0, sealHome: sealHome(), aid: n.aid });
    expect(importCarriedCharter(sealHome(), renderNexusDoc(genesisCharter(keys).doc)).outcome).toBe("same");
    expect(await carriedSet(sealHome())).toEqual(new Set([n.aid]));
  });

  it("CONTROL — a different genesis over the same kahu names a different Nexus and lands beside, never over", async () => {
    await standJoiner();
    const keys = await foreignKeys(10);
    const n = importCarriedCharter(sealHome(), renderNexusDoc(genesisOnlyCharter(keys, 2)));
    expect(n.outcome).toBe("landed");
    const other = importCarriedCharter(sealHome(), renderNexusDoc(genesisCharter(keys).doc));
    expect(other.aid).not.toBe(n.aid);
    expect(readCarriedCharters(sealHome()).size).toBe(2);
  });

  it("CONTROL — the primary's OWN charter refuses to land as a carried copy", async () => {
    const keys = await standFounding();
    expect(() => importCarriedCharter(sealHome(), renderNexusDoc(genesisCharter(keys).doc))).toThrow(CarriedCharterError);
    expect(existsSync(join(sealHome(), "carried"))).toBe(false);
  });

  it("★ a carried land leaves no temp file beside the charter ★", async () => {
    await standJoiner();
    const n = importCarriedCharter(sealHome(), renderNexusDoc(genesisCharter(await foreignKeys(10)).doc));
    expect(readdirSync(dirname(n.path)).filter((f) => /\.incoming$|\.tmp$/.test(f))).toEqual([]);
  });

  it.skipIf(!existsSync("/dev/full"))("★ a carried write that hits ENOSPC refuses with CarriedCharterError, strands no temp, and the held bytes stand ★", async () => {
    await standJoiner();
    const keys = await foreignKeys(10);
    const rotatedTwo = renderNexusDoc((await lineageCharter(keys, 2)).doc);
    const n = importCarriedCharter(sealHome(), renderNexusDoc(genesisCharter(keys).doc));
    const held = readFileSync(n.path);
    symlinkSync("/dev/full", `${n.path}.incoming`);              // the temp write faults mid-write (ENOSPC)
    expect(() => importCarriedCharter(sealHome(), rotatedTwo)).toThrow(CarriedCharterError);
    expect(readFileSync(n.path).equals(held)).toBe(true);
    expect(readdirSync(dirname(n.path)).filter((f) => /\.incoming$|\.tmp$/.test(f))).toEqual([]);
  });

  it("★ a carried write that faults on a directory at the temp refuses with CarriedCharterError ★", async () => {
    await standJoiner();
    const keys = await foreignKeys(10);
    const rotatedTwo = renderNexusDoc((await lineageCharter(keys, 2)).doc);
    const n = importCarriedCharter(sealHome(), renderNexusDoc(genesisCharter(keys).doc));
    const held = readFileSync(n.path);
    mkdirSync(`${n.path}.incoming`);
    expect(() => importCarriedCharter(sealHome(), rotatedTwo)).toThrow(CarriedCharterError);
    expect(readFileSync(n.path).equals(held)).toBe(true);
  });

  it("★ a re-import over a TORN held carried charter refuses and leaves the torn bytes ★", async () => {
    await standJoiner();
    const keys = await foreignKeys(10);
    const rotatedTwo = renderNexusDoc((await lineageCharter(keys, 2)).doc);
    const n = importCarriedCharter(sealHome(), renderNexusDoc(genesisCharter(keys).doc));
    const whole = readFileSync(n.path, "utf8");
    writeFileSync(n.path, whole.slice(0, Math.floor(whole.length / 2)), "utf8");
    expect(parseNexusDoc(readFileSync(n.path, "utf8"))).toBeNull();
    const torn = readFileSync(n.path);
    expect(() => importCarriedCharter(sealHome(), rotatedTwo)).toThrow(/reads torn/);
    expect(readFileSync(n.path).equals(torn)).toBe(true);
  });

  it("CONTROL — a torn or unseated charter refuses and writes nothing", async () => {
    await standJoiner();
    expect(() => importCarriedCharter(sealHome(), "not a charter")).toThrow(CarriedCharterError);
    expect(() => importCarriedCharter(sealHome(), renderNexusDoc({ ...emptyFoundingCharterDoc(), threshold: 2 })))
      .toThrow(CarriedCharterError);
    expect(existsSync(join(sealHome(), "carried"))).toBe(false);
  });

  it("CONTROL — a carried directory whose charter names another AID is not read as that directory's Nexus", async () => {
    await standJoiner();
    const n = importCarriedCharter(sealHome(), renderNexusDoc(genesisCharter(await foreignKeys(10)).doc));
    const misplaced = join(sealHome(), "carried", "nexus-" + "f".repeat(64), "founding-roster.mem");
    mkdirSync(dirname(misplaced), { recursive: true });
    writeFileSync(misplaced, readFileSync(n.path));
    expect([...readCarriedCharters(sealHome()).keys()]).toEqual([n.aid]);
  });
});
