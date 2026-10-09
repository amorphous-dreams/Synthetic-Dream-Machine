/**
 * persona-group-secret.test — the secret a PersonaGroup's devices hold in common: delivered at enrolment beside
 * the edge, opened by the device alone, rolled with the op-key, and withheld from a device a rotation revokes.
 *
 * Proven, each red beside its control:
 *   · CONTROL: the root's seal opens for its device to the secret the root derives, and verifies under the root;
 *   · RED: the seal opens for no other device, and a seal re-addressed to another device opens for neither;
 *   · RED: a seal whose box or signature moved fails verification; a seal another key signed fails it too;
 *   · the secret derives from the op-key's seed and the prefix — never from the KEL — and rolls with the op-key;
 *   · RED: only the seed seating a rotation's op-key re-enrols on it — a box another key sealed refuses the rotation;
 *   · a device's standing reads every secret its enrolments deliver, oldest first, and the newest edge;
 *   · RED: a device a rotation left out holds no secret under the new head;
 *   · the KEL board carries the enrolments whole, and a torn enrolment list breaks the chain's walk.
 */
import { describe, test, expect } from "vitest";
import { emptyLarDoc } from "../src/base-doc.js";
import { canonicalJsonBytes } from "../src/crypto.js";
import { writePersonaKelEvent, personaKelChainForPrefix } from "../src/persona-kel-board.js";
import {
  personaGroupSecret, sealGroupSecret, verifyGroupSecretSeal, groupSecretOpenerFromSeed, rollEnrolments,
  leafStandingUnder, enrolledEdgeOf,
} from "../src/persona-group-secret.js";
import { verifyPersonaKel } from "../src/persona-kel.js";
import { attestAndRotate } from "../src/recovery-keel-core.js";
import { SEEDS, pubOf, didOf, signerOf, founded, enrol, rotatedKeeping } from "./fixtures/sibling-fleet.js";

describe("persona-group-secret — delivered at enrolment, rolled with the op-key", () => {
  test("CONTROL: the root's seal opens for its device to the secret the root derives", async () => {
    const { inception } = await founded();
    const seal = await sealGroupSecret({ opSeed: SEEDS.opA, prefix: inception.prefix, deviceVerifyingKey: await pubOf(SEEDS.deviceX) });
    expect(await verifyGroupSecretSeal(seal)).toEqual(seal);
    expect(seal.opKeyDid).toBe(await didOf(SEEDS.opA));
    expect(groupSecretOpenerFromSeed(SEEDS.deviceX).seal(seal)).toEqual(personaGroupSecret(SEEDS.opA, inception.prefix));
  });

  test("RED: the seal opens for no other device, and a re-addressed seal opens for neither", async () => {
    const { inception } = await founded();
    const seal = await sealGroupSecret({ opSeed: SEEDS.opA, prefix: inception.prefix, deviceVerifyingKey: await pubOf(SEEDS.deviceX) });
    expect(groupSecretOpenerFromSeed(SEEDS.deviceY).seal(seal)).toBeNull();
    const readdressed = { ...seal, deviceKey: await pubOf(SEEDS.deviceY) };
    expect(groupSecretOpenerFromSeed(SEEDS.deviceX).seal(readdressed)).toBeNull();
    expect(groupSecretOpenerFromSeed(SEEDS.deviceY).seal(readdressed)).toBeNull();
    expect(await verifyGroupSecretSeal(readdressed)).toBeNull();
  });

  test("RED: a seal whose box or signature moved fails, and so does one another key signed", async () => {
    const { inception } = await founded();
    const seal = await sealGroupSecret({ opSeed: SEEDS.opA, prefix: inception.prefix, deviceVerifyingKey: await pubOf(SEEDS.deviceX) });
    const flip = (h: string) => (h[0] === "0" ? "1" : "0") + h.slice(1);
    expect(await verifyGroupSecretSeal({ ...seal, c: flip(seal.c) })).toBeNull();
    expect(await verifyGroupSecretSeal({ ...seal, sig: flip(seal.sig) })).toBeNull();
    expect(await verifyGroupSecretSeal({ ...seal, opKeyDid: await didOf(SEEDS.opB) })).toBeNull();
    expect(await verifyGroupSecretSeal({ ...seal, kind: "something-else" })).toBeNull();
    expect(await verifyGroupSecretSeal(null)).toBeNull();
  });

  test("the secret derives from the op-key's seed and the prefix, and rolls with the op-key", async () => {
    const { inception } = await founded();
    const a = personaGroupSecret(SEEDS.opA, inception.prefix);
    expect(a).toHaveLength(32);
    expect(personaGroupSecret(SEEDS.opA, inception.prefix)).toEqual(a);
    expect(personaGroupSecret(SEEDS.opB, inception.prefix)).not.toEqual(a);
    expect(personaGroupSecret(SEEDS.opA, `${inception.prefix}x`)).not.toEqual(a);
    // Nothing public reproduces it: the KEL event's own bytes key nothing the secret equals.
    expect(personaGroupSecret(canonicalJsonBytes(inception).slice(0, 32), inception.prefix)).not.toEqual(a);
  });

  test("RED: only the seed seating a rotation's op-key re-enrols on it", async () => {
    const { inception, guardianRecoveryKeys, recoveryThreshold } = await founded();
    const devices = [{ deviceVerifyingKey: await pubOf(SEEDS.deviceX), hearthTrueName: "", boundEpoch: 0 }];
    const guardianSigners = await Promise.all([SEEDS.g1, SEEDS.g2].map(async (g) => ({ signer: await pubOf(g), sign: signerOf(g) })));
    const rotate = async (opSeed: Uint8Array) => attestAndRotate({
      head: inception, freshOpKeyDid: await didOf(SEEDS.opB), guardianRecoveryKeys, recoveryThreshold, guardianSigners,
      enrolments: await rollEnrolments({ prefix: inception.prefix, opSeed, devices }),
    });
    const wrong = await rotate(SEEDS.opA);
    expect(wrong.ok).toBe(false);
    expect(wrong.ok ? "" : wrong.reason).toMatch(/did not seal/);
    const right = await rotate(SEEDS.opB);   // CONTROL
    expect(right.ok && right.event.enrolments).toHaveLength(1);
  });

  test("a device's standing reads every secret its enrolments deliver, oldest first, and the newest edge", async () => {
    const { inception } = await founded();
    const chain = await rotatedKeeping([SEEDS.deviceX]);
    const ex = await enrol(SEEDS.opA, SEEDS.deviceX, inception.prefix);
    const standing = await leafStandingUnder({ kel: chain, deviceKey: await pubOf(SEEDS.deviceX), enrolment: ex, open: groupSecretOpenerFromSeed(SEEDS.deviceX) });
    expect(standing.secrets.map((s) => s.opKeyDid)).toEqual([await didOf(SEEDS.opA), await didOf(SEEDS.opB)]);
    expect(standing.secrets[1]!.secret).toEqual(personaGroupSecret(SEEDS.opB, inception.prefix));
    expect(standing.edge.personaRootDid).toBe(await didOf(SEEDS.opB));
    expect((await enrolledEdgeOf(chain, groupSecretOpenerFromSeed(SEEDS.deviceX)))?.personaRootDid).toBe(await didOf(SEEDS.opB));
    // CONTROL: under the inception alone, one secret and the edge it was handed.
    const before = await leafStandingUnder({ kel: [inception], deviceKey: await pubOf(SEEDS.deviceX), enrolment: ex, open: groupSecretOpenerFromSeed(SEEDS.deviceX) });
    expect(before.secrets).toHaveLength(1);
    expect(before.edge).toEqual(ex.edge);
  });

  test("RED: a device a rotation left out holds no secret under the new head", async () => {
    const { inception } = await founded();
    const chain = await rotatedKeeping([SEEDS.deviceX]);
    const ez = await enrol(SEEDS.opA, SEEDS.deviceZ, inception.prefix);
    const standing = await leafStandingUnder({ kel: chain, deviceKey: await pubOf(SEEDS.deviceZ), enrolment: ez, open: groupSecretOpenerFromSeed(SEEDS.deviceZ) });
    expect(standing.secrets.map((s) => s.opKeyDid)).toEqual([await didOf(SEEDS.opA)]);
    expect(standing.edge).toEqual(ez.edge);
    expect(await enrolledEdgeOf(chain, groupSecretOpenerFromSeed(SEEDS.deviceZ))).toBeNull();
  });

  test("the KEL board carries the enrolments whole, and a torn enrolment list breaks the walk where every reader sees it", async () => {
    const chain = await rotatedKeeping([SEEDS.deviceX, SEEDS.deviceY]);
    const board = emptyLarDoc();
    for (const e of chain) writePersonaKelEvent(board, e);
    const read = personaKelChainForPrefix(board, chain[0]!.prefix)!;
    expect(read[1]!.enrolments).toEqual(chain[1]!.enrolments);
    expect(verifyPersonaKel(read)).toBe(true);
    const torn = emptyLarDoc();
    writePersonaKelEvent(torn, chain[0]!);
    writePersonaKelEvent(torn, { ...chain[1]!, enrolments: [{ kind: "sealed-enrolment" } as never] });
    const tornRead = personaKelChainForPrefix(torn, chain[0]!.prefix)!;
    expect(tornRead.map((e) => e.seq)).toEqual([0, 1]);
    expect(verifyPersonaKel(tornRead)).toBe(false);
  });
});
