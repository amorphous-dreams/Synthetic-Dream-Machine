/**
 * kel-fixture — a REAL persona KEL for the readers that take a chain: an inception under the first op-key and one guardian-quorum
 * rotation per further key (a 1-of-1 self guardian signs each), so a lineage test reads a chain the one KEL reader verifies,
 * never a hand-shaped list of events.
 */
import * as ed from "@noble/ed25519";
import { hex } from "../src/crypto.js";
import type { PersonaKelEvent } from "../src/persona-kel.js";
import { attestAndRotate, provisionThresholdRecoveryAtFounding } from "../src/recovery-keel-core.js";
import { guardianRecoveryRegistrationCard } from "../src/recovery-registration.js";

const GUARDIAN_SEED = new Uint8Array(32).fill(5);
const pubOf = (s: Uint8Array): Promise<string> => ed.getPublicKeyAsync(s).then(hex);
const signerOf = (s: Uint8Array) => async (b: Uint8Array): Promise<string> => hex(await ed.signAsync(b, s));

/** The KEL whose op-keys are `opKeys` (hex verifying keys), in order: epoch n seats opKeys[n]. */
export async function realKel(opKeys: readonly string[]): Promise<{ readonly chain: PersonaKelEvent[]; readonly guardianPub: string }> {
  const guardianPub = await pubOf(GUARDIAN_SEED);
  const prov = provisionThresholdRecoveryAtFounding({
    foundingOpKeyDid: `0x${opKeys[0]!}`, guardians: [guardianRecoveryRegistrationCard("mine", guardianPub, null)], recoveryThreshold: 1,
  });
  const chain: PersonaKelEvent[] = [prov.inception];
  for (const key of opKeys.slice(1)) {
    const rot = await attestAndRotate({
      head: chain[chain.length - 1]!, freshOpKeyDid: `0x${key}`, guardianRecoveryKeys: [guardianPub], recoveryThreshold: 1,
      guardianSigners: [{ signer: guardianPub, sign: signerOf(GUARDIAN_SEED) }],
    });
    if (!rot.ok) throw new Error(`kel-fixture: ${rot.reason}`);
    chain.push(rot.event);
  }
  return { chain, guardianPub };
}

/** An event shaped like a rotation at the chain's next seat that no quorum signed: the heap a node ring carries beside the lineage. */
export function forgedRotation(chain: readonly PersonaKelEvent[], attackerKey: string): PersonaKelEvent {
  const head = chain[chain.length - 1]!;
  return { ...head, seq: head.seq + 1, opKeyDid: `0x${attackerKey}`, prevEventCid: head.eventCid, eventCid: `forged-${attackerKey.slice(0, 8)}`, rotationSigs: [] } as unknown as PersonaKelEvent;
}
