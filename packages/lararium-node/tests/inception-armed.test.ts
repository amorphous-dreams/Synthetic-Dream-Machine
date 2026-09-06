/**
 * inception-armed — NO PREFIX INCEPTS UNARMED (ruling 2, 2026-09-06).
 *
 * Every persona the live ceremony founds must pre-commit a REAL recovery-set digest into its prefix —
 * the founder's 1-of-1 self-recovery key (`deriveSelfRecoveryKey`, the multitude-of-one NAMED) until a
 * real guardian set stands. An empty pre-commit mints an identity Fork B can never rotate: a name with
 * no recovery future at all, discovered only the day a device dies.
 *
 * The third vector walks the whole point: the founder loses the device, still holds the seed, and
 * ROTATES — a fresh op-key seats under the unchanged prefix, attested by the self-recovery key,
 * nothing reconstructed.
 */
import { describe, test, expect } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import type { AutomergeUrl } from "@automerge/automerge-repo";
import { runFoundingCeremony } from "@lararium/keyhive";
import * as ed25519 from "@noble/ed25519";
import {
  hex, personaPrefixOf, sealKeySetHash, deriveSelfRecoveryKey,
  personaKelChainForPrefix, personaKelBoardDocUrl, personaRotationSigningBytes, mintPersonaRotation,
  type LarDoc,
} from "@lararium/mesh";

const pubOf = async (seed: Uint8Array): Promise<string> => hex(await ed25519.getPublicKeyAsync(seed));

const FOUNDER_SEED = new Uint8Array(32).fill(7);

async function found() {
  const repo = new Repo({ sharePolicy: async () => true });
  const verifyingKey = await pubOf(FOUNDER_SEED);
  const f = await runFoundingCeremony({
    repo,
    vesselSeed:         FOUNDER_SEED,
    vesselVerifyingKey: verifyingKey,
    vesselDisplayName:  "The Strandbeest Shrine",
    binding: { mode: "self-stood", signerSeed: FOUNDER_SEED },
    hearthTrueName:       "",
    nexusPubkey:          verifyingKey,
  });
  return { repo, f, verifyingKey };
}

describe("the inception arms", () => {
  test("★ NO PREFIX INCEPTS UNARMED — the pre-commit is never the empty string ★", async () => {
    const { f } = await found();
    expect(f.personaKelPrefix).not.toBe(personaPrefixOf(f.signerDid, ""));
  });

  test("★ the pre-commit is the founder's OWN 1-of-1 self-recovery digest ★", async () => {
    const { f } = await found();
    const selfRecovery = await deriveSelfRecoveryKey(FOUNDER_SEED);
    const expected = sealKeySetHash([selfRecovery.verifyingKey], 1);
    expect(f.personaKelPrefix).toBe(personaPrefixOf(f.signerDid, expected));
  });

  test("★ THE SELF-ROTATION WALKS — lose the device, hold the seed, rotate under the same name ★", async () => {
    const { repo, f, verifyingKey } = await found();

    const boardHandle = await repo.find(personaKelBoardDocUrl(verifyingKey) as AutomergeUrl);
    const chain = personaKelChainForPrefix(boardHandle.doc() as unknown as LarDoc, f.personaKelPrefix);
    expect(chain, "the board carries the armed inception").not.toBeNull();
    const head = chain![chain!.length - 1]!;
    expect(head.recoverySetHash).not.toBe("");

    // The founder's fresh operational key (a new device's), attested by the self-recovery key alone.
    const freshOpSeed = new Uint8Array(32).fill(23);
    const freshOpKeyDid = `0x${await pubOf(freshOpSeed)}`;
    const selfRecovery = await deriveSelfRecoveryKey(FOUNDER_SEED);
    const bytes = personaRotationSigningBytes(head, freshOpKeyDid);
    const sig = hex(await ed25519.signAsync(bytes, Uint8Array.from(Buffer.from(selfRecovery.signingKey, "hex"))));

    const rotated = await mintPersonaRotation({
      head,
      freshOpKeyDid,
      recoveryRoster:    [selfRecovery.verifyingKey],
      recoveryThreshold: 1,
      rotationSigs:      [{ signer: selfRecovery.verifyingKey, sig }],
    });
    expect(rotated.ok, rotated.ok ? "" : rotated.reason).toBe(true);
    if (rotated.ok) {
      expect(rotated.event.prefix).toBe(f.personaKelPrefix);   // the name survives
      expect(rotated.event.opKeyDid).toBe(freshOpKeyDid);      // the key turns over
    }
  });
});
