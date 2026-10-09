/**
 * enrolment-group-secret.test — the PersonaGroup secret rides EVERY enrolment, beside the edge.
 *
 * When the persona root signs a DeviceDelegation it seals its secret to that device key in the same act:
 *   · CONTROL: a founding rests a seal on its own daemon doc that opens, for this device alone, to the secret the
 *     root derives;
 *   · CONTROL: a device admit carries a seal for the JOINEE's key; the carried payload lands it on the joinee's
 *     own daemon doc, and it opens there;
 *   · RED: an admit payload that carries no seal, or one sealed to another device, refuses at apply.
 */
import { describe, test, expect } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import * as ed25519 from "@noble/ed25519";
import { runFoundingCeremony, runDeviceAdmitEdge, runApplyAdmitPayload } from "@lararium/keyhive";
import {
  hex, personaKelBoardDocUrl, materializeSharedLarDoc, personaKelChainForPrefix, groupSecretSealTitle,
  groupSecretOpenerFromSeed, personaGroupSecret, verifyGroupSecretSeal, sealGroupSecret, tiddlerText, type LarDoc,
} from "@lararium/mesh";

const FOUNDER_SEED = new Uint8Array(32).fill(7);
const JOINEE_SEED  = new Uint8Array(32).fill(11);
const OTHER_SEED   = new Uint8Array(32).fill(13);
const pubOf = async (seed: Uint8Array): Promise<string> => hex(await ed25519.getPublicKeyAsync(seed));

async function restedSeal(repo: Repo, daemonUrl: string, group: string): Promise<unknown> {
  const daemon = await repo.find<LarDoc>(daemonUrl as never);
  return JSON.parse(tiddlerText(daemon.doc()?.tiddlers?.[groupSecretSealTitle(group)]) ?? "null");
}

async function founded() {
  const repo = new Repo({ sharePolicy: async () => true });
  const verifyingKey = await pubOf(FOUNDER_SEED);
  const f = await runFoundingCeremony({
    repo, vesselSeed: FOUNDER_SEED, vesselVerifyingKey: verifyingKey, vesselDisplayName: "founder",
    binding: { mode: "self-stood", signerSeed: FOUNDER_SEED }, hearthTrueName: "", nexusPubkey: verifyingKey,
  });
  const board = await materializeSharedLarDoc(repo, personaKelBoardDocUrl(verifyingKey), "board:persona-kel");
  const chain = personaKelChainForPrefix(board.doc(), f.personaKelPrefix)!;
  return { repo, f, chain };
}

async function admitFor(founder: Awaited<ReturnType<typeof founded>>, joineeKey: string) {
  return runDeviceAdmitEdge({
    signerSeed: FOUNDER_SEED, joineeVerifyingKey: joineeKey,
    personaKelPrefix: founder.f.personaKelPrefix, personaKelChain: founder.chain, hearthTrueName: "bafyHearth",
    personaGroupDocIdHex: founder.f.personaGroupDocIdHex, personaGroupAgentIdHex: founder.f.personaGroupAgentIdHex,
    meshCabalDocIdHex: founder.f.meshCabalDocIdHex, syncUrl: null, islandDocUrl: null,
    hearthDaemonUrl: founder.f.daemonUrl, personaUrl: founder.f.personaUrl,
  });
}

const apply = async (payload: Awaited<ReturnType<typeof runDeviceAdmitEdge>>) => {
  const repo = new Repo({ sharePolicy: async () => true });
  const joineeKey = await pubOf(JOINEE_SEED);
  const applied = await runApplyAdmitPayload({ repo, vesselSeed: JOINEE_SEED, vesselVerifyingKey: joineeKey, vesselDisplayName: "joinee", payload, nexusPubkey: joineeKey });
  return { repo, applied };
};

describe("every enrolment delivers the PersonaGroup secret beside the edge", () => {
  test("CONTROL: a founding rests a seal on its own daemon doc that opens for this device alone", async () => {
    const { repo, f } = await founded();
    const rested = await restedSeal(repo, f.daemonUrl, f.personaGroupDocIdHex);
    expect(await verifyGroupSecretSeal(rested)).not.toBeNull();
    expect(rested).toEqual(f.groupSecretSeal);
    const secret = personaGroupSecret(FOUNDER_SEED, f.personaKelPrefix);
    expect(groupSecretOpenerFromSeed(FOUNDER_SEED).seal(f.groupSecretSeal)).toEqual(secret);
    expect(groupSecretOpenerFromSeed(JOINEE_SEED).seal(f.groupSecretSeal)).toBeNull();
  });

  test("CONTROL: a device admit carries the joinee's seal, and the joinee's own daemon doc rests it", async () => {
    const founder = await founded();
    const payload = JSON.parse(JSON.stringify(await admitFor(founder, await pubOf(JOINEE_SEED))));
    expect(payload.groupSecretSeal.deviceKey).toBe(await pubOf(JOINEE_SEED));
    const { repo, applied } = await apply(payload);
    const rested = await restedSeal(repo, applied.daemonUrl, founder.f.personaGroupDocIdHex);
    expect(groupSecretOpenerFromSeed(JOINEE_SEED).seal(rested as never)).toEqual(personaGroupSecret(FOUNDER_SEED, founder.f.personaKelPrefix));
  });

  test("RED: an admit that carries no seal, or one sealed to another device, refuses at apply", async () => {
    const founder = await founded();
    const payload = await admitFor(founder, await pubOf(JOINEE_SEED));
    await expect(apply({ ...payload, groupSecretSeal: undefined as never })).rejects.toThrow(/no PersonaGroup secret sealed to this device/);
    const elsewhere = await sealGroupSecret({ opSeed: FOUNDER_SEED, prefix: founder.f.personaKelPrefix, deviceVerifyingKey: await pubOf(OTHER_SEED) });
    await expect(apply({ ...payload, groupSecretSeal: elsewhere })).rejects.toThrow(/no PersonaGroup secret sealed to this device/);
  });
});
