/**
 * keyring-delivery — recut named-epoch delivery proofs:
 * D1 envelope round trip (control: wrong recipient and tamper withhold; uppercase hex opens; malformed recipient,
 * malformed entry and duplicate name throw).
 * D2 CARRY ⊥ READ (control: stranger secret under the same name cannot read).
 * D3 admit delivery and read (control: before admission the joinee has no keyring; unlocked grant succeeds).
 * D4 MITM keyring-fragment substitution is refused (control: token swap changes carriage; D3 is genuine delivery).
 * D5 conflicting admission records the join but withholds delivery (control: held secret remains unchanged).
 * D6 founder with no held secret delivers none (control: join still records).
 * D7 locked founder cannot grant (control: D3 grants while unlocked).
 */
import { afterEach, beforeEach, describe, test, expect, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ed from "@noble/ed25519";
import {
  sealKeyringEnvelope, openKeyringEnvelope, mintKeyringRecipient,
  verifyCiphertextCid, openBodyOnCas, ed25519SignerFromSeed, utf8Bytes, base64UrlEncode, hex,
  type PersonaRef, type KeyringEntryWire,
} from "@lararium/mesh";
import { seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";
import { CustodyLocked } from "../src/custody-holder.js";
import { mintNexusEpochSecret, loadNexusKeyring, installDeliveredKeyring, heldNexusKeyringEntries } from "../src/nexus-convergence-secret-store.js";
import { makeNexusConvergenceKeyring, readCapForEpoch } from "../src/nexus-convergence-keyring.js";
import { offerAdmitFlow, grantAdmitFlow, openAdmitFlow } from "../src/persona-admit-flow.js";
import { cadSealDir, sealCarrierForFederation } from "../src/seal-carrier-federation.js";
import { makeSealedPlaneRegistry } from "../src/plane-seal.js";
import { readCasBlobFromFs } from "../src/node-cas.js";

vi.setConfig({ testTimeout: 120_000 });

const AID = "epoch0-" + "a1".repeat(32);
const EPOCH = AID;
const BODY = utf8Bytes("the sealed carrier body a member blind-transits but cannot read");
const A_PERSONA_SEED = new Uint8Array(32).fill(11);
const B_DEVICE_SEED = new Uint8Array(32).fill(22);
const PREFIX = "EpersonaAID_keyring_01";
const pubOf = (s: Uint8Array) => ed.getPublicKeyAsync(s).then(hex);
const wire = (secretHex: string): KeyringEntryWire => ({ nexusAid: AID, epochCid: EPOCH, secretHex });

let founder: SeatedScratchCustody;
let joinee: SeatedScratchCustody;
let storageDir: string;

async function as<T>(vessel: SeatedScratchCustody, fn: () => Promise<T>): Promise<T> {
  const prior = process.env["LAR_ROOT"];
  process.env["LAR_ROOT"] = vessel.root;
  try { return await fn(); }
  finally { if (prior === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = prior; }
}

beforeEach(async () => {
  founder = await seatScratchCustody("founder");
  const founderRoot = founder.root;
  joinee = await seatScratchCustody("joinee");
  // Keep each fixture's root explicit; calls use as() and never depend on the ambient seat order.
  expect(founder.root).toBe(founderRoot);
  storageDir = mkdtempSync(join(tmpdir(), "lares-kr-storage-"));
});

afterEach(async () => {
  rmSync(storageDir, { recursive: true, force: true });
  await joinee.drop();
  await founder.drop();
});

async function founderBody() {
  const keyring = await as(founder, async () => {
    await mintNexusEpochSecret({ nexusAid: AID, epochCid: EPOCH });
    return loadNexusKeyring({ nexusAid: AID, headEpochCid: EPOCH });
  });
  if (!keyring) throw new Error("founder keyring did not load");
  const registry = makeSealedPlaneRegistry();
  const cadDir = cadSealDir(storageDir);
  const installed = sealCarrierForFederation({ registry, cadDir, plaintext: BODY, keyring });
  const ciphertext = readCasBlobFromFs(installed.cid, cadDir)!;
  return { keyring, installed, ciphertext, cadDir };
}

async function ceremony(founderHasSecret = true) {
  if (founderHasSecret) await as(founder, async () => { await mintNexusEpochSecret({ nexusAid: AID, epochCid: EPOCH }); });
  const personaKey = await pubOf(A_PERSONA_SEED);
  const deviceKey = await pubOf(B_DEVICE_SEED);
  const personaRef: PersonaRef = { prefix: PREFIX, verifyingKey: personaKey };
  const personaSigner = ed25519SignerFromSeed(A_PERSONA_SEED);
  const deviceSigner = ed25519SignerFromSeed(B_DEVICE_SEED);
  const resolveHeadOpKey = (p: string): string | null => p === PREFIX ? personaKey : null;
  const offer = await as(joinee, () => offerAdmitFlow({ deviceVerifyingKey: deviceKey }));
  const grant = await as(founder, () => grantAdmitFlow({ offerCarriage: offer.carriage, personaRef, personaSigner }));
  return { offer, grant, resolveHeadOpKey, deviceSigner };
}

describe("recut keyring envelope", () => {
  test("D1 founder-held entries round-trip; wrong recipient and tamper withhold", async () => {
    await as(founder, async () => { await mintNexusEpochSecret({ nexusAid: AID, epochCid: EPOCH }); });
    const entries = await as(founder, heldNexusKeyringEntries);
    const recipient = mintKeyringRecipient();
    const envelope = sealKeyringEnvelope(entries, recipient.recipientPubkey);
    expect(openKeyringEnvelope(envelope, recipient.recipientSecret)).toEqual(entries);
    expect(openKeyringEnvelope(envelope, mintKeyringRecipient().recipientSecret)).toBeNull();
    expect(openKeyringEnvelope({ ...envelope, ciphertext: envelope.ciphertext.slice(0, -2) + "AA" }, recipient.recipientSecret)).toBeNull();

    const upperEnvelope = sealKeyringEnvelope([{ ...wire("ab".repeat(32)) }], recipient.recipientPubkey.toUpperCase());
    expect(openKeyringEnvelope({ ...upperEnvelope, senderEphemeralPubkey: upperEnvelope.senderEphemeralPubkey.toUpperCase() }, recipient.recipientSecret)?.[0]?.secretHex).toBe("ab".repeat(32));
    expect(() => sealKeyringEnvelope([wire("cd".repeat(32))], "00")).toThrow();
    expect(() => sealKeyringEnvelope([wire("cd".repeat(32))], "ab".repeat(40))).toThrow();
    expect(() => sealKeyringEnvelope([{ ...wire("zz".repeat(32)) }], recipient.recipientPubkey)).toThrow(/malformed/);
    expect(() => sealKeyringEnvelope([wire("11".repeat(32)), wire("22".repeat(32))], recipient.recipientPubkey)).toThrow(/twice/);
  });
});

describe("recut custody delivery", () => {
  test("D2 CARRY ⊥ READ: no keyring cannot read; delivered name re-derives the read-cap", async () => {
    const { installed, ciphertext, cadDir } = await founderBody();
    expect(await as(joinee, () => loadNexusKeyring({ nexusAid: AID, headEpochCid: EPOCH }))).toBeNull();
    expect(verifyCiphertextCid(ciphertext, installed.cid)).toBe(true);
    const entries = await as(founder, heldNexusKeyringEntries);
    await as(joinee, async () => { await installDeliveredKeyring(entries); });
    const joineeKeyring = await as(joinee, () => loadNexusKeyring({ nexusAid: AID, headEpochCid: installed.epochCid }));
    expect(joineeKeyring).not.toBeNull();
    const cap = readCapForEpoch(BODY, installed.epochCid, joineeKeyring!);
    expect([...openBodyOnCas(ciphertext, cap)]).toEqual([...BODY]);
    const stranger = makeNexusConvergenceKeyring({ nexusAid: AID, headEpochCid: installed.epochCid, entries: [{ nexusAid: AID, epochCid: installed.epochCid, secret: new Uint8Array(32).fill(0x77) }] });
    expect([...openBodyOnCas(ciphertext, readCapForEpoch(BODY, installed.epochCid, stranger))]).not.toEqual([...BODY]);
  });

  test("D3 admit delivers the founder key and records a readable join; joinee starts empty", async () => {
    const { installed, ciphertext } = await founderBody();
    expect(await as(joinee, () => loadNexusKeyring({ nexusAid: AID, headEpochCid: EPOCH }))).toBeNull();
    const { grant, resolveHeadOpKey, deviceSigner } = await ceremony(false);
    if ("error" in grant) throw new Error(grant.error);
    expect(grant.keyringDelivered).toBe(true);
    expect(grant.carriage).toContain("&keyring=");
    expect(grant.carriage.startsWith("#grant=")).toBe(true);
    const opened = await as(joinee, () => openAdmitFlow({ grantCarriage: grant.carriage, resolveHeadOpKey, deviceSigner }));
    if ("error" in opened) throw new Error(opened.error);
    const heldFounder = await as(founder, heldNexusKeyringEntries);
    expect(opened.keyringEpochs).toBe(heldFounder.length);
    const heldJoinee = await as(joinee, heldNexusKeyringEntries);
    expect(heldJoinee).toContainEqual(heldFounder[0]);
    const ring = await as(joinee, () => loadNexusKeyring({ nexusAid: AID, headEpochCid: installed.epochCid }));
    expect([...openBodyOnCas(ciphertext, readCapForEpoch(BODY, installed.epochCid, ring!))]).toEqual([...BODY]);
  });

  test("D4 substituted keyring fragment is refused and the row remains empty", async () => {
    const { offer, grant, resolveHeadOpKey, deviceSigner } = await ceremony();
    if ("error" in grant) throw new Error(grant.error);
    const attacker = sealKeyringEnvelope([wire("ee".repeat(32))], offer.offer.ephemeralPubkey);
    const token = base64UrlEncode(utf8Bytes(JSON.stringify(attacker)));
    const swapped = grant.carriage.replace(/&keyring=[A-Za-z0-9_-]+/, `&keyring=${token}`);
    expect(swapped).not.toBe(grant.carriage);
    const opened = await as(joinee, () => openAdmitFlow({ grantCarriage: swapped, resolveHeadOpKey, deviceSigner }));
    if ("error" in opened) throw new Error(opened.error);
    expect(opened.keyringEpochs).toBe(0);
    expect(await as(joinee, () => loadNexusKeyring({ nexusAid: AID, headEpochCid: EPOCH }))).toBeNull();
  });

  test("D5 conflicting delivered bytes record the join but preserve the joinee secret", async () => {
    const localHex = "33".repeat(32);
    await as(joinee, async () => { await installDeliveredKeyring([wire(localHex)]); });
    const { grant, resolveHeadOpKey, deviceSigner } = await ceremony();
    if ("error" in grant) throw new Error(grant.error);
    const founderHex = (await as(founder, heldNexusKeyringEntries))[0]!.secretHex;
    expect(founderHex).not.toBe(localHex);
    const opened = await as(joinee, () => openAdmitFlow({ grantCarriage: grant.carriage, resolveHeadOpKey, deviceSigner }));
    if ("error" in opened) throw new Error(opened.error);
    expect(opened.joinRecord).toBeDefined();
    expect(opened.keyringEpochs).toBe(0);
    expect(opened.keyringConflict).toBeTruthy();
    expect(opened.keyringConflict).not.toContain(localHex);
    expect(opened.keyringConflict).not.toContain(founderHex);
    expect((await as(joinee, heldNexusKeyringEntries))[0]!.secretHex).toBe(localHex);
  });

  test("D6 founder with no secret delivers none but records the join", async () => {
    const { grant, resolveHeadOpKey, deviceSigner } = await ceremony(false);
    if ("error" in grant) throw new Error(grant.error);
    expect(grant.keyringDelivered).toBe(false);
    expect(grant.carriage).not.toContain("&keyring=");
    const opened = await as(joinee, () => openAdmitFlow({ grantCarriage: grant.carriage, resolveHeadOpKey, deviceSigner }));
    if ("error" in opened) throw new Error(opened.error);
    expect(opened.joinRecord).toBeDefined();
    expect(opened.keyringEpochs).toBe(0);
  });

  test("D7 a locked founder cannot grant", async () => {
    await as(founder, async () => { await mintNexusEpochSecret({ nexusAid: AID, epochCid: EPOCH }); });
    const personaKey = await pubOf(A_PERSONA_SEED);
    const deviceKey = await pubOf(B_DEVICE_SEED);
    const offer = await as(joinee, () => offerAdmitFlow({ deviceVerifyingKey: deviceKey }));
    await founder.holder.lock();
    await expect(as(founder, () => grantAdmitFlow({
      offerCarriage: offer.carriage,
      personaRef: { prefix: PREFIX, verifyingKey: personaKey },
      personaSigner: ed25519SignerFromSeed(A_PERSONA_SEED),
    }))).rejects.toThrow(CustodyLocked);
  });
});
