import { describe, expect, test } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import * as ed from "@noble/ed25519";
import { runFoundingCeremony } from "@lararium/keyhive";
import {
  composeFleetJoinRequest, ed25519SignerFromSeed, fleetJoinOffer, fleetJoinRequestImage,
  fleetJoinSealPair, hex, readFleetJoinRequest,
} from "@lararium/mesh";

const isRefusal = (v: unknown): boolean => typeof v === "object" && v !== null && Object.hasOwn(v, "refusal");
const seed = (n: number) => new Uint8Array(32).fill(n);
const placeSeed = seed(31);
const atomSeed = seed(32);
const faceBSeed = seed(33);
const key = async (s: Uint8Array) => hex(await ed.getPublicKeyAsync(s));

describe("fleet-join request uses the selected face", () => {
  test("the founded atom's request reads; place, face B and unnamed requests refuse", async () => {
    const placeKey = await key(placeSeed);
    const founded = await runFoundingCeremony({
      repo: new Repo(), atomSeed, placeVerifyingKey: placeKey, vesselDisplayName: "requester",
      binding: { mode: "self-stood", signerSeed: placeSeed }, hearthTrueName: "",
      nexusPubkey: placeKey,
    });
    const offer = fleetJoinOffer({
      personaGroup: founded.personaGroupId, rootKey: await key(seed(34)),
      nonce: "ab".repeat(32), scopes: [],
    });
    const atomKey = founded.founderEdge.deviceVerifyingKey;
    const seal = fleetJoinSealPair();
    const request = await composeFleetJoinRequest({
      offer, atomKey, sealKey: seal.key, mintFaceKey: async () => { throw new Error("no scopes"); },
      custody: {} as never, sign: ed25519SignerFromSeed(founded.atomSeed),
    });
    expect(isRefusal(request)).toBe(false);
    if (isRefusal(request)) return;
    expect(isRefusal(readFleetJoinRequest(request, offer))).toBe(false);

    const image = fleetJoinRequestImage(request);
    const placeSigned = { ...request, signature: await ed25519SignerFromSeed(placeSeed)(image) };
    expect(readFleetJoinRequest(placeSigned, offer)).toMatchObject({ refusal: "request-unsigned" });
    const faceBSigned = { ...request, signature: await ed25519SignerFromSeed(faceBSeed)(image) };
    expect(readFleetJoinRequest(faceBSigned, offer)).toMatchObject({ refusal: "request-unsigned" });
    expect(readFleetJoinRequest({ ...request, atomKey: "" }, offer)).toMatchObject({ refusal: "request-malformed" });
  });
});
