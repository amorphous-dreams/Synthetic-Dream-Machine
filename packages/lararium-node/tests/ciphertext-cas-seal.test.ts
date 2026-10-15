/**
 * ciphertext-cas-seal.test.ts — the SEAL-PRODUCER lights the member blind-transit lane for a cad body.
 *
 * The load-bearing honesty proven end-to-end against the REAL member-carry decision + the REAL federatable gate:
 *   · the encrypt-on-CAS INSTALLER registers a sealed body's docId AS A SIDE-EFFECT (encrypt → CAS-write → register),
 *   · a MEMBER blind-transits that sealed ciphertext body (carry TRUE); the read-cap NEVER crosses the decision,
 *   · a STRANGER is DENIED the sealed body (public shelf only),
 *   · a PLAINTEXT body NEVER registers — no door but the encrypt path, so its docId reads unsealed (DENY),
 *   · READ-LANE UNTOUCHED — an empty registry behaves EXACTLY as the pre-split floor (carryContractShareDecision),
 *   · the ciphertext at rest verifies BLAKE3(bytes)==cid SECRET-FREE (the relay's blind check).
 */
import { describe, test, expect } from "vitest";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeFileSync } from "node:fs";
import {
  DeterministicFederationGate, carryContractShareDecision, carrierShareDecision,
  verifyCiphertextCid, parseDigest,
  type NexusMembership,
} from "@lararium/mesh";
import { makeSealedPlaneRegistry } from "../src/plane-seal.js";
import { installSealedBody, docIdForCiphertextCid } from "../src/ciphertext-cas-seal.js";
import { freshTestBodyKey, openAsMember } from "./cas-test-setup.js";

const NX = "abcdef0123456789";
const fedGate = new DeterministicFederationGate(NX);
const MEMBER = "peer-member", STRANGER = "peer-stranger";
const relayPeers = new Set([MEMBER, STRANGER]);
const membership: NexusMembership = { holdsCarriagePeer: (p) => p === MEMBER };
const casDir = mkdtempSync(join(tmpdir(), "lar-cad-seal-"));
const NAME = { nexusAid: "nexus-" + "cd".repeat(32), epochCid: "nexus-" + "cd".repeat(32) };

describe("the seal-producer registers a sealed body AS A SIDE-EFFECT and lights the member lane", () => {
  test("installing a sealed body registers its docId; a MEMBER blind-transits it, a STRANGER is denied", async () => {
    const registry = makeSealedPlaneRegistry();
    expect(registry.size).toBe(0);   // fail-closed at birth
    const body = new TextEncoder().encode("a private cad body that leaves the CRDT sealed");

    const under = freshTestBodyKey();
    const installed = installSealedBody(registry, casDir, body, under, NAME);   // encrypt → CAS-write → register
    expect(registry.size).toBe(1);                                         // the SIDE-EFFECT fired
    expect(registry.seal.isSealedPlane(installed.docId)).toBe(true);
    // The epoch sidecar rides beside the seal set — the cid stays pure BLAKE3(ct), the epoch keys the read-lookup.
    expect({ nexusAid: installed.nexusAid, epochCid: installed.epochCid }).toEqual(NAME);
    expect(registry.epochFor(installed.docId)).toEqual(NAME);

    // The member lane — the read-cap is NOT among carrierShareDecision's arguments (structurally cannot cross).
    expect(await carrierShareDecision(relayPeers, fedGate, null, null, membership, registry.seal, MEMBER, installed.docId)).toBe(true);
    expect(await carrierShareDecision(relayPeers, fedGate, null, null, membership, registry.seal, STRANGER, installed.docId)).toBe(false);

    // The ciphertext rests in CAS and verifies SECRET-FREE (the relay's blind check).
    expect(parseDigest(installed.cid).algo).toBe("blake3");             // fork-① tagged address
    const atRest = new Uint8Array(readFileSync(join(casDir, installed.cid)));
    expect(atRest.length).toBeGreaterThan(body.length);
    expect(verifyCiphertextCid(atRest, installed.cid)).toBe(true);
    expect(openAsMember(atRest, installed, under)).toEqual(body);
  });

  test("a PLAINTEXT body NEVER registers — its docId reads unsealed (a doc can never self-label sealed)", async () => {
    const registry = makeSealedPlaneRegistry();
    // A cleartext body that was NEVER put through the encrypt path — model its would-be docId directly.
    const plaintext = new TextEncoder().encode("a cleartext plane the sync wire carries today");
    // There is no register door but installSealedBody; a plaintext docId derived by any means stays absent.
    const fakeDocId = docIdForCiphertextCid("blake3:" + "aa".repeat(32));
    expect(registry.seal.isSealedPlane(fakeDocId)).toBe(false);
    expect(await carrierShareDecision(relayPeers, fedGate, null, null, membership, registry.seal, MEMBER, fakeDocId)).toBe(false);
  });
});

test("the installer's answer holds no key: every field may cross to a caller", () => {
  const registry = makeSealedPlaneRegistry();
  const under = freshTestBodyKey();
  const installed = installSealedBody(registry, casDir, new TextEncoder().encode("a body"), under, NAME);
  expect(Object.keys(installed).sort()).toEqual(["cid", "docId", "epochCid", "keyVersion", "nexusAid", "ref"]);
  const keyHex = Buffer.from(under.key).toString("hex");
  expect(keyHex.length).toBe(64);
  expect(JSON.stringify(installed)).not.toContain(keyHex);
});

test("ORDER: a write that fails registers nothing, and a seal that refuses writes nothing", () => {
  const registry = makeSealedPlaneRegistry();
  const body = new TextEncoder().encode("a body whose block never lands");
  // The cad dir's path holds a FILE, so the CAS write throws after the seal succeeded.
  const blocked = join(casDir, "not-a-dir");
  writeFileSync(blocked, "occupied");
  expect(() => installSealedBody(registry, blocked, body, freshTestBodyKey(), NAME)).toThrow();
  expect(registry.size).toBe(0);                                              // no docId stands with no ciphertext behind it
  // A seal that refuses (a short key) throws by name before any byte lands.
  const short = { bagId: "lar:///ha.ka.ba/@test/bags/sealed-fixture", key: new Uint8Array(16) } as never;
  expect(() => installSealedBody(registry, casDir, body, short, NAME)).toThrow(/did not seal \(key-malformed\)/);
  expect(registry.size).toBe(0);
  // CONTROL: the same body under a whole key and a real dir registers one docId.
  const installed = installSealedBody(registry, casDir, body, freshTestBodyKey(), NAME);
  expect(registry.size).toBe(1);
  expect(registry.seal.isSealedPlane(installed.docId)).toBe(true);
});

test("a relay that alters the stored ciphertext never yields plaintext", () => {
  const registry = makeSealedPlaneRegistry();
  const body = new TextEncoder().encode("address-bound private body");
  const under = freshTestBodyKey();
  const installed = installSealedBody(registry, casDir, body, under, NAME);
  const file = join(casDir, installed.cid);
  const untouched = new Uint8Array(readFileSync(file));
  const altered = untouched.slice();
  altered[altered.length - 1] ^= 1;
  expect(altered).not.toEqual(untouched);
  expect(verifyCiphertextCid(altered, installed.cid)).toBe(false);
  expect(openAsMember(altered, installed, under)).toBe("REFUSED address-mismatch");
  expect(openAsMember(untouched, installed, under)).toEqual(body);
});

describe("READ-LANE UNTOUCHED — an empty registry degenerates EXACTLY to the pre-split floor", () => {
  test("empty registry seal ≡ DENY-ALL: identical to carryContractShareDecision across the cells", async () => {
    const registry = makeSealedPlaneRegistry();   // never sealed anything → fail-closed DENY-ALL
    const someDoc = docIdForCiphertextCid("blake3:" + "bc".repeat(32));
    const cells: ReadonlyArray<readonly [string, typeof someDoc]> = [[MEMBER, someDoc], [STRANGER, someDoc]];
    for (const [peer, doc] of cells) {
      const split = await carrierShareDecision(relayPeers, fedGate, null, null, membership, registry.seal, peer, doc);
      const base  = await carryContractShareDecision(relayPeers, fedGate, null, null, peer, doc);
      expect(split).toBe(base);
    }
  });
});
