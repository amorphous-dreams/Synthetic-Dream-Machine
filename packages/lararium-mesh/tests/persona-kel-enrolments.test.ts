/**
 * persona-kel-enrolments.test — a rotation's enrolments ride the PUBLIC persona-KEL board SEALED and ATTESTED:
 * each device's edge and next secret sealed to that device alone, naming no device, and the whole list committed
 * inside the event's content address, which the guardians' quorum signs.
 *
 * Proven, each red beside its control:
 *   · RED: a board writer who STRIPS one device's enrolment breaks the chain's walk — the cid no longer matches,
 *     and the stripped device reads no revocation off it; CONTROL: the whole list verifies and seats its secret;
 *   · RED: an ADDED, SWAPPED or REORDERED enrolment breaks the walk the same way;
 *   · RED: a list re-committed after a strip moves the cid, and a re-derived cid leaves the quorum signing other bytes;
 *   · RED: a box the event's op-key did not sign breaks the full walk, even under a digest the quorum signed;
 *   · two copies of one event on the board: the fold keeps the copy whose list the cid commits;
 *   · RED: the rolled event, as the board carries it, holds no device key, no edge field, no root key, no hearth —
 *     read DECODED in every encoding; CONTROL: the instrument finds a key planted in the clear;
 *   · RED: an edge inside an op-key-signed box whose own signature fails delivers nothing — `enrolledEdgeOf`
 *     verifies the edge; CONTROL: the lawful box delivers its edge and secret.
 */
import { describe, test, expect } from "vitest";
import { ed25519 as edCurve } from "@noble/curves/ed25519.js";
import * as ed from "@noble/ed25519";
import { emptyLarDoc } from "../src/base-doc.js";
import { canonicalJsonBytes, hex, hexToBytes } from "../src/crypto.js";
import { SEALED_ENROLMENT_INFO } from "../src/domains.js";
import { sealToRecipient } from "../src/sealed-box.js";
import { buildDeviceDelegation } from "../src/device-delegation.js";
import {
  verifyPersonaKel, verifyPersonaKelFull, sealedEnrolmentBytes, foldPersonaContests, enrolmentDigestOf, personaEventCidOf,
  personaRotationSigningBytes, type PersonaKelEvent, type SealedEnrolment,
} from "../src/persona-kel.js";
import { writePersonaKelEvent, personaKelChainForPrefix } from "../src/persona-kel-board.js";
import { attestAndRotate } from "../src/recovery-keel-core.js";
import {
  rollEnrolments, enrolledEdgeOf, leafStandingUnder, groupSecretOpenerFromSeed, personaGroupSecret,
} from "../src/persona-group-secret.js";
import { SEEDS, pubOf, didOf, signerOf, founded, enrol, rotatedKeeping, carriedReads } from "./fixtures/sibling-fleet.js";

const keyOf = pubOf;

/** A chain whose rotation carries `list` in place of what its cid commits. */
function carrying(chain: PersonaKelEvent[], list: readonly SealedEnrolment[]): PersonaKelEvent[] {
  return [chain[0]!, { ...chain[1]!, enrolments: list }];
}

describe("persona-KEL enrolments — sealed per device, attested inside the cid", () => {
  test("CONTROL: the whole list verifies, and each enrolled device reads its secret under the head", async () => {
    const chain = await rotatedKeeping([SEEDS.deviceX, SEEDS.deviceY]);
    expect((await verifyPersonaKelFull(chain)).ok).toBe(true);
    const ey = await enrol(SEEDS.opA, SEEDS.deviceY, chain[0]!.prefix);
    const standing = await leafStandingUnder({ kel: chain, deviceKey: await keyOf(SEEDS.deviceY), enrolment: ey, open: groupSecretOpenerFromSeed(SEEDS.deviceY) });
    expect(standing.secrets.at(-1)!.opKeyDid).toBe(await didOf(SEEDS.opB));
    expect(standing.secrets.at(-1)!.secret).toEqual(personaGroupSecret(SEEDS.opB, chain[0]!.prefix));
  });

  test("RED: a STRIPPED enrolment breaks the walk — the device reads no revocation off the board's word", async () => {
    const chain = await rotatedKeeping([SEEDS.deviceX, SEEDS.deviceY]);
    const list = chain[1]!.enrolments!;
    for (const i of [0, 1]) {
      const stripped = carrying(chain, list.filter((_, j) => j !== i));
      expect(stripped[1]!.eventCid).toBe(chain[1]!.eventCid);
      expect(verifyPersonaKel(stripped), `stripping box ${i} breaks the structural walk`).toBe(false);
      expect((await verifyPersonaKelFull(stripped)).ok).toBe(false);
    }
  });

  test("RED: an ADDED, SWAPPED or REORDERED enrolment breaks the walk", async () => {
    const chain = await rotatedKeeping([SEEDS.deviceX, SEEDS.deviceY]);
    const list = chain[1]!.enrolments!;
    const extra = (await rollEnrolments({ prefix: chain[0]!.prefix, opSeed: SEEDS.opB, devices: [{ deviceVerifyingKey: await keyOf(SEEDS.deviceZ), hearthTrueName: "", boundEpoch: 0 }] }))[0]!;
    expect(verifyPersonaKel(carrying(chain, [...list, extra])), "added").toBe(false);
    expect(verifyPersonaKel(carrying(chain, [extra, list[1]!])), "swapped").toBe(false);
    expect(verifyPersonaKel(carrying(chain, [list[1]!, list[0]!])), "reordered").toBe(false);
    expect(verifyPersonaKel(carrying(chain, list)), "CONTROL: the committed list").toBe(true);
  });

  test("RED: a list re-committed after a strip moves the cid — the digest rides INSIDE the content address", async () => {
    const chain = await rotatedKeeping([SEEDS.deviceX, SEEDS.deviceY]);
    const stripped = chain[1]!.enrolments!.slice(1);
    const recommitted = [chain[0]!, { ...chain[1]!, enrolments: stripped, enrolmentDigest: enrolmentDigestOf(stripped) }];
    expect(recommitted[1]!.eventCid).toBe(chain[1]!.eventCid);
    expect(verifyPersonaKel(recommitted), "the cid no longer recomputes").toBe(false);
    // Re-deriving the cid too leaves the guardians' quorum signing other bytes.
    const core = { ...recommitted[1]! };
    const recid = [chain[0]!, { ...core, eventCid: personaEventCidOf(core) }];
    expect(verifyPersonaKel(recid)).toBe(true);
    expect((await verifyPersonaKelFull(recid)).ok).toBe(false);
  });

  test("RED: a box the event's op-key did not sign breaks the full walk, even under a digest the quorum signed", async () => {
    const { inception, guardianRecoveryKeys, recoveryThreshold } = await founded();
    const freshOpKeyDid = await didOf(SEEDS.opB);
    const devices = [{ deviceVerifyingKey: await keyOf(SEEDS.deviceX), hearthTrueName: "", boundEpoch: 0 }];
    const [box] = await rollEnrolments({ prefix: inception.prefix, opSeed: SEEDS.opB, devices });
    const unsigned = { ...box!, sig: box!.sig.replace(/^./, (c) => (c === "0" ? "1" : "0")) };
    // Guardians who sign whatever bytes they are handed: the quorum attests a list whose box the op-key never sealed.
    const mint = async (list: readonly SealedEnrolment[]): Promise<PersonaKelEvent[]> => {
      const bytes = personaRotationSigningBytes(inception, freshOpKeyDid, inception.nextRecoverySetHash, false, list);
      const rotationSigs = await Promise.all([SEEDS.g1, SEEDS.g2].map(async (g) => ({ signer: await keyOf(g), sig: await signerOf(g)(bytes) })));
      const core = {
        seq: 1, prefix: inception.prefix, opKeyDid: freshOpKeyDid, recoverySetHash: inception.recoverySetHash,
        nextRecoverySetHash: inception.nextRecoverySetHash, prevEventCid: inception.eventCid, provisional: false, vetoOfCid: null,
        enrolmentDigest: enrolmentDigestOf(list),
      };
      return [inception, { ...core, eventCid: personaEventCidOf(core), recoveryRoster: guardianRecoveryKeys, recoveryThreshold, rotationSigs, enrolments: list }];
    };
    const forged = await mint([unsigned]);
    expect(verifyPersonaKel(forged)).toBe(true);
    expect(await verifyPersonaKelFull(forged)).toMatchObject({ ok: false, reason: expect.stringMatching(/did not seal/) });
    expect((await verifyPersonaKelFull(await mint([box!]))).ok, "CONTROL: the sealed box").toBe(true);
  });

  test("two copies of ONE event on the board: the fold keeps the copy whose list the cid commits", async () => {
    const chain = await rotatedKeeping([SEEDS.deviceX, SEEDS.deviceY]);
    const stripped = { ...chain[1]!, enrolments: chain[1]!.enrolments!.slice(1) };
    for (const order of [[stripped, chain[1]!], [chain[1]!, stripped]]) {
      const folded = foldPersonaContests([chain[0]!, ...order]);
      expect(folded[1]!.enrolments).toEqual(chain[1]!.enrolments);
      expect((await verifyPersonaKelFull(folded)).ok).toBe(true);
    }
    // A board that holds only the stripped copy breaks the walk, where every reader sees it.
    const board = emptyLarDoc();
    writePersonaKelEvent(board, chain[0]!);
    writePersonaKelEvent(board, stripped);
    expect(verifyPersonaKel(personaKelChainForPrefix(board, chain[0]!.prefix)!)).toBe(false);
  });

  test("RED: the rolled event names no device, no root, no hearth — read DECODED; CONTROL: a planted key is found", async () => {
    const chain = await rotatedKeeping([SEEDS.deviceX, SEEDS.deviceY]);
    const onBoard = JSON.stringify(chain[1]);
    for (const needle of [await keyOf(SEEDS.deviceX), await keyOf(SEEDS.deviceY), "personaRootDid", "deviceVerifyingKey", "hearthTrueName", "device-delegation", "deviceKey"]) {
      expect(carriedReads([onBoard], needle), `the board reads ${needle.slice(0, 16)}`).toBe(false);
    }
    const planted = JSON.stringify({ ...chain[1], enrolments: [{ ...chain[1]!.enrolments![0]!, c: hex(new TextEncoder().encode(await keyOf(SEEDS.deviceX))) }] });
    expect(carriedReads([planted], await keyOf(SEEDS.deviceX))).toBe(true);
  });

  test("RED: an edge whose own signature fails delivers nothing, inside a box the op-key did sign", async () => {
    const { inception, guardianRecoveryKeys, recoveryThreshold } = await founded();
    const deviceKey = await keyOf(SEEDS.deviceX);
    const opKeyDid = await didOf(SEEDS.opB);
    const real = await buildDeviceDelegation({ personaRootSeed: SEEDS.opB, deviceVerifyingKey: deviceKey, hearthTrueName: "", boundEpoch: 0 });
    const forgedEdge = { ...real, signature: "00".repeat(64) };
    const boxed = sealToRecipient({
      recipientPub: edCurve.utils.toMontgomery(hexToBytes(deviceKey)),
      plaintext: canonicalJsonBytes({ edge: forgedEdge, secret: hex(personaGroupSecret(SEEDS.opB, inception.prefix)) }),
      info: new TextEncoder().encode(SEALED_ENROLMENT_INFO),
      extraSalt: [new TextEncoder().encode(inception.prefix), new TextEncoder().encode(opKeyDid.toLowerCase()), hexToBytes(deviceKey)],
    });
    const unsigned = { e: hex(boxed.senderEphemeralPub), n: hex(boxed.aeadNonce), c: hex(boxed.ciphertext) };
    const sealed: SealedEnrolment = { kind: "sealed-enrolment", ...unsigned, sig: hex(await ed.signAsync(sealedEnrolmentBytes(inception.prefix, opKeyDid, unsigned), SEEDS.opB)) };
    const guardianSigners = await Promise.all([SEEDS.g1, SEEDS.g2].map(async (g) => ({ signer: await keyOf(g), sign: signerOf(g) })));
    const rot = await attestAndRotate({ head: inception, freshOpKeyDid: opKeyDid, guardianRecoveryKeys, recoveryThreshold, guardianSigners, enrolments: [sealed] });
    if (!rot.ok) throw new Error(rot.reason);
    const chain = [inception, rot.event];
    expect((await verifyPersonaKelFull(chain)).ok).toBe(true);
    const open = groupSecretOpenerFromSeed(SEEDS.deviceX);
    expect(open.enrolment(sealed, { prefix: inception.prefix, opKeyDid }), "the box opens for its device").not.toBeNull();
    expect(await enrolledEdgeOf(chain, open)).toBeNull();
    const ex = await enrol(SEEDS.opA, SEEDS.deviceX, inception.prefix);
    const standing = await leafStandingUnder({ kel: chain, deviceKey, enrolment: ex, open });
    expect(standing.secrets.map((s) => s.opKeyDid)).toEqual([await didOf(SEEDS.opA)]);
    expect(standing.edge).toEqual(ex.edge);
    // CONTROL: the lawful box for the same device delivers its edge and the next secret.
    const lawful = await rotatedKeeping([SEEDS.deviceX]);
    expect((await enrolledEdgeOf(lawful, open))?.personaRootDid).toBe(opKeyDid);
  });
});
