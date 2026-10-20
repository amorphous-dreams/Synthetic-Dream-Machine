import { describe, expect, test } from "vitest";
import { buildDeviceDelegation } from "../src/device-delegation.js";
import { faceAtomKeyFromSeed } from "../src/face-atom.js";
import {
  HOLDER_SESSION_DOMAIN, holderSessionProofBytes, signHolderSessionProof, verifyHolderSessionProof,
  type HolderSessionProofFields,
} from "../src/holder-session-proof.js";

const root = new Uint8Array(32).fill(31);
const otherRoot = new Uint8Array(32).fill(32);
const atomSeed = new Uint8Array(32).fill(33);
const otherAtomSeed = new Uint8Array(32).fill(34);
const fields: HolderSessionProofFields = {
  ownerEpoch: "epoch-1", sessionId: "session-1", nonce: "a0b1c2d3", personaGroup: "face:A",
};

async function fixtures() {
  const atom = faceAtomKeyFromSeed(atomSeed, fields.personaGroup);
  const otherAtom = faceAtomKeyFromSeed(otherAtomSeed, fields.personaGroup);
  const edge = await buildDeviceDelegation({ personaRootSeed: root, atomSeed, hearthTrueName: "", boundEpoch: 1 });
  const signature = await signHolderSessionProof(atom, fields);
  return { atom, otherAtom, edge, signature };
}

describe("holder session proof", () => {
  test("the atom admits with the exact domain-separated challenge image", async () => {
    const { edge, signature } = await fixtures();
    expect(new TextDecoder().decode(holderSessionProofBytes(fields))).toBe(
      `${HOLDER_SESSION_DOMAIN}|epoch-1|session-1|a0b1c2d3|face:A`,
    );
    expect(await verifyHolderSessionProof({ edge, signature, fields })).toEqual({ ok: true });
  });

  test("a forged root half cannot carry a valid atom session", async () => {
    const { edge, signature } = await fixtures();
    const other = await buildDeviceDelegation({ personaRootSeed: otherRoot, atomSeed, hearthTrueName: "", boundEpoch: 1 });
    expect(await verifyHolderSessionProof({ edge: { ...edge, signature: other.signature }, signature, fields }))
      .toEqual({ ok: false, reason: "session-edge-invalid" });
    expect(await verifyHolderSessionProof({ edge, signature, fields })).toEqual({ ok: true });
  });

  test("an absent or unrelated atom countersignature refuses the edge", async () => {
    const { edge, signature } = await fixtures();
    const unrelated = await buildDeviceDelegation({ personaRootSeed: root, atomSeed: otherAtomSeed, hearthTrueName: "", boundEpoch: 1 });
    for (const atomSignature of [undefined, unrelated.atomSignature]) {
      expect(await verifyHolderSessionProof({
        edge: { ...edge, atomSignature } as typeof edge, signature, fields,
      })).toEqual({ ok: false, reason: "session-edge-invalid" });
    }
    expect(await verifyHolderSessionProof({ edge, signature, fields })).toEqual({ ok: true });
  });

  test("only the edge's atom signs this port's challenge", async () => {
    const { edge, signature, otherAtom } = await fixtures();
    const wrong = await signHolderSessionProof(otherAtom, fields);
    expect(await verifyHolderSessionProof({ edge, signature: wrong, fields }))
      .toEqual({ ok: false, reason: "session-proof-invalid" });
    expect(await verifyHolderSessionProof({ edge, signature, fields })).toEqual({ ok: true });
  });

  test("changing any one field breaks the proof; a delimiter cannot shift a field", async () => {
    const { edge, signature } = await fixtures();
    for (const changed of [
      { ownerEpoch: "epoch-2" }, { sessionId: "session-2" }, { nonce: "a0b1c2d4" }, { personaGroup: "face:B" },
    ]) {
      expect(await verifyHolderSessionProof({ edge, signature, fields: { ...fields, ...changed } }))
        .toEqual({ ok: false, reason: "session-proof-invalid" });
    }
    expect(() => holderSessionProofBytes({ ...fields, personaGroup: "face:A|session-2" })).toThrow(/malformed field/);
    expect(await verifyHolderSessionProof({ edge, signature, fields })).toEqual({ ok: true });
  });
});
