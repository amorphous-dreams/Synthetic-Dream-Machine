/** The relay service owns a random durable gate row, independent of the place and face. */
import { afterEach, describe, test, expect } from "vitest";
import { createHmac } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ed from "@noble/ed25519";
import { CARRIAGE_CARRIER_DOMAIN, carrierContractBytes, hex, mintPlaceInception, placeSignerFromSeed, verifyPlaceDutyAtHead,
  provisionThresholdRecoveryAtFounding, recoveryContactRegistrationCard, attestAndRotate, httpPersonaKelDropHerm,
  depositPersonaKelChain, pullPersonaKelSuccessors } from "@lararium/mesh";
import { startCarriageRelay } from "../src/carriage-relay.js";
import { openRelayGateSeed, rotateRelayGateSeed, RELAY_GATE_SEED_FILE, RelayGateSeedRefused } from "../src/relay-gate-seed.js";
import { larIdentityDir } from "../src/vessel-paths.js";

const previous = process.env.LAR_ROOT;
const roots: string[] = [];
function home(): string {
  const root = mkdtempSync(join(tmpdir(), "relay-row-")); roots.push(root); process.env.LAR_ROOT = root; return root;
}
afterEach(() => {
  if (previous === undefined) delete process.env.LAR_ROOT; else process.env.LAR_ROOT = previous;
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

/** The label a thief keys an HMAC of the place seed under, to guess a derived relay key: and must not reach the relay's pin. */
const OLD_RELAY_DERIVATION_TAG = "relay-gate";

describe("relay service S row", () => {
  test("thief: place and face seeds cannot reconstruct the random pin; restart retains it", async () => {
    home();
    const place = new Uint8Array(32).fill(31), atom = new Uint8Array(32).fill(41);
    process.env.LAR_HERM_RELAY_SEED = "aa".repeat(32);
    try {
      const first = openRelayGateSeed();
      const oldDerivation = new Uint8Array(createHmac("sha256", OLD_RELAY_DERIVATION_TAG).update(place).digest());
      expect(hex(first)).not.toBe(hex(oldDerivation));
      expect(hex(first)).not.toBe(hex(place));
      expect(hex(first)).not.toBe(hex(atom));
      expect(hex(first)).not.toBe("aa".repeat(32));
      const head = mintPlaceInception({ signerSeed: place, coldVerifyingKey: hex(await ed.getPublicKeyAsync(atom)) }).event;
      const image = carrierContractBytes({ nym: hex(await ed.getPublicKeyAsync(place)), sealEpochCid: "epoch" });
      const relaySig = await placeSignerFromSeed(first).signFloor(CARRIAGE_CARRIER_DOMAIN, image);
      expect(verifyPlaceDutyAtHead({ kel: head, domain: CARRIAGE_CARRIER_DOMAIN, image, sig: relaySig })).toBe(false);
      expect(verifyPlaceDutyAtHead({ kel: head, domain: CARRIAGE_CARRIER_DOMAIN, image,
        sig: await placeSignerFromSeed(place).signFloor(CARRIAGE_CARRIER_DOMAIN, image) })).toBe(true);
      const stood = await startCarriageRelay({ gateSeed: first, port: 0 });
      const pin = stood.gatePubKey;
      expect(pin).toBe(hex(await ed.getPublicKeyAsync(first)));
      await stood.close();
      first.fill(0);
      const restarted = openRelayGateSeed();
      expect(hex(await ed.getPublicKeyAsync(restarted))).toBe(pin);
      restarted.fill(0);
    } finally { delete process.env.LAR_HERM_RELAY_SEED; }
  });

  test("explicit rotation changes the public pin; malformed row refuses by name", async () => {
    home();
    const old = openRelayGateSeed();
    const oldPin = hex(await ed.getPublicKeyAsync(old));
    old.fill(0);
    const newPin = rotateRelayGateSeed();
    expect(newPin).not.toBe(oldPin);
    const current = openRelayGateSeed();
    expect(hex(await ed.getPublicKeyAsync(current))).toBe(newPin);
    current.fill(0);
    const path = join(larIdentityDir(), RELAY_GATE_SEED_FILE);
    expect(readFileSync(path, "utf8")).toMatch(/^[0-9a-f]{64}\n$/);
    writeFileSync(path, "bad", "utf8");
    expect(() => openRelayGateSeed()).toThrow(RelayGateSeedRefused);
    expect(() => rotateRelayGateSeed()).toThrow(RelayGateSeedRefused);
  });

  test("the pinned HTTP drop address serves across restart and requires re-pinning after rotation", async () => {
    home();
    const key = (b: number) => new Uint8Array(32).fill(b);
    const pub = (seed: Uint8Array) => ed.getPublicKeyAsync(seed).then(hex);
    const recoveryContacts = [key(61), key(62), key(63)];
    const recoveryContactKeys = await Promise.all(recoveryContacts.map(pub));
    const start = provisionThresholdRecoveryAtFounding({
      foundingOpKeyDid: `0x${await pub(key(51))}`,
      recoveryContacts: recoveryContactKeys.map((value, i) => recoveryContactRegistrationCard(["mine", "contact-a", "contact-b"][i]!, value, null)),
      recoveryThreshold: 2,
    }).inception;
    const rotated = await attestAndRotate({
      head: start, freshOpKeyDid: `0x${await pub(key(52))}`, recoveryContactKeys: recoveryContactKeys, recoveryThreshold: 2,
      recoveryContactSigners: await Promise.all(recoveryContacts.slice(0, 2).map(async (seed) => ({ signer: await pub(seed), sign: async (bytes: Uint8Array) => hex(await ed.signAsync(bytes, seed)) }))),
    });
    if (!rotated.ok) throw new Error(rotated.reason);
    const journal = join(process.env.LAR_ROOT!, "drops.jsonl");
    const stand = async () => {
      const seed = openRelayGateSeed();
      try { return await startCarriageRelay({ gateSeed: seed, port: 0, dropJournalPath: journal }); }
      finally { seed.fill(0); }
    };
    const first = await stand();
    const oldPin = first.gatePubKey;
    const oldAddress = `ws://127.0.0.1:${first.port}#${oldPin}`;
    expect((await depositPersonaKelChain([start, rotated.event], [httpPersonaKelDropHerm(oldAddress)])).unanswered).toEqual([]);
    await first.close();
    const restarted = await stand();
    try {
      expect(restarted.gatePubKey).toBe(oldPin);
      const address = `ws://127.0.0.1:${restarted.port}#${oldPin}`;
      expect((await pullPersonaKelSuccessors([start], [httpPersonaKelDropHerm(address)])).kel.map((row) => row.eventCid))
        .toEqual([start.eventCid, rotated.event.eventCid]);
    } finally { await restarted.close(); }
    const newPin = rotateRelayGateSeed();
    const next = await stand();
    try {
      expect(next.gatePubKey).toBe(newPin);
      expect(next.gatePubKey).not.toBe(oldPin);
      const oldAddressAtNewPort = `ws://127.0.0.1:${next.port}#${oldPin}`;
      const newAddress = `ws://127.0.0.1:${next.port}#${newPin}`;
      expect((await pullPersonaKelSuccessors([start], [httpPersonaKelDropHerm(oldAddressAtNewPort)])).kel.map((row) => row.eventCid))
        .toEqual([start.eventCid]);
      expect((await depositPersonaKelChain([start, rotated.event], [httpPersonaKelDropHerm(newAddress)])).unanswered).toEqual([]);
      expect((await pullPersonaKelSuccessors([start], [httpPersonaKelDropHerm(newAddress)])).kel.map((row) => row.eventCid))
        .toEqual([start.eventCid, rotated.event.eventCid]);
    } finally { await next.close(); }
  }, 20_000);
});
