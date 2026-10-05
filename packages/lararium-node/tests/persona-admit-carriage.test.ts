/**
 * persona-admit-carriage.test.ts — each hop of the 3-hop ceremony round-trips through its base64url
 * envelope; a garbled/wrong-key carriage decodes to null, never a throw.
 */
import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import {
  mintEnrollmentOffer, sealPersonaGrant, openPersonaGrant, mintJoinAck,
  ed25519SignerFromSeed,
  type PersonaRef,
} from "@lararium/mesh";
import { hex } from "@lararium/mesh/crypto";
import {
  toEnrollmentCarriage, parseEnrollmentCarriage, toGrantCarriage, parseGrantCarriage,
  toAckCarriage, parseAckCarriage,
} from "../src/persona-admit-carriage.js";

const pubOf = (seed: Uint8Array) => ed.getPublicKeyAsync(seed).then(hex);

const A_PERSONA_SEED = new Uint8Array(32).fill(1);
const B_DEVICE_SEED  = new Uint8Array(32).fill(2);
const PERSONA_PREFIX = "EpersonaAID_prefix_0001";

function headResolver(map: Record<string, string>) {
  return (prefix: string): string | null => map[prefix] ?? null;
}

async function fixtures() {
  const personaKey = await pubOf(A_PERSONA_SEED);
  const deviceKey  = await pubOf(B_DEVICE_SEED);
  const personaRef: PersonaRef = { prefix: PERSONA_PREFIX, verifyingKey: personaKey };
  const personaSigner = ed25519SignerFromSeed(A_PERSONA_SEED);
  const deviceSigner  = ed25519SignerFromSeed(B_DEVICE_SEED);
  const resolveHeadOpKey = headResolver({ [PERSONA_PREFIX]: personaKey });
  return { personaKey, deviceKey, personaRef, personaSigner, deviceSigner, resolveHeadOpKey };
}

describe("persona-admit-carriage — the base64url envelope each hop rides", () => {
  test("CARRIAGE: each hop round-trips through its base64url envelope; a garbled/wrong-key carriage → null", async () => {
    const f = await fixtures();
    const { offer, secret } = mintEnrollmentOffer({ targetVesselId: f.deviceKey });
    const { sealed, sent } = await sealPersonaGrant({ offer, personaRef: f.personaRef, personaSigner: f.personaSigner });
    const opened = await openPersonaGrant({ sealed, secret, resolveHeadOpKey: f.resolveHeadOpKey });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const { ack } = await mintJoinAck({ accepted: opened.accepted, secret, deviceSigner: f.deviceSigner });

    // Round-trip each hop (fragment form) — and a whitespace-wrapped paste of the offer.
    const enrollC = toEnrollmentCarriage(offer);
    expect(enrollC.startsWith("#enroll=")).toBe(true);
    expect(parseEnrollmentCarriage(enrollC)).toEqual(offer);
    expect(parseEnrollmentCarriage(`  ${enrollC}\n`)).toEqual(offer);
    expect(parseGrantCarriage(toGrantCarriage(sealed))).toEqual(sealed);
    expect(parseAckCarriage(toAckCarriage(ack))).toEqual(ack);

    // A grant carriage read as an offer (wrong key) → null; a garbled token → null.
    expect(parseEnrollmentCarriage(toGrantCarriage(sealed))).toBeNull();
    expect(parseGrantCarriage("#grant=@@@not-b64@@@")).toBeNull();
    expect(parseAckCarriage("")).toBeNull();

    // The carriage-transported grant still opens end-to-end (the transport changed nothing).
    const reSealed = parseGrantCarriage(toGrantCarriage(sealed))!;
    const reOpened = await openPersonaGrant({ sealed: reSealed, secret, resolveHeadOpKey: f.resolveHeadOpKey });
    expect(reOpened.ok).toBe(true);
    void sent;
  });
});
