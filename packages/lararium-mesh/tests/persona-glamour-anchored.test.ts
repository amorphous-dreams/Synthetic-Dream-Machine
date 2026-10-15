/**
 * persona-glamour-anchored — the personal face is PERSONA-ANCHORED, not self-owned (the owner-model
 * ruling, 2026-09-09). A 1-of-1 HandleGlamour founds its handle-KEL with the OWNING PERSONA-KEL prefix
 * as the sole owner-set member — never the handle key owning itself. The consequence is the whole point:
 * recovery of a lost handle key flows through the persona (the owner authorizes a rotation to a fresh
 * handle key), so a personal face is not orphaned when its presentation key is lost. Self-ownership would
 * seat an owner member no `ownerHeadResolver` can resolve to a persona head, foreclosing that path.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/identity-classes (#the-handle-chain)
 */
import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import { hex } from "../src/crypto.js";
import { mintPersonaGlamour, PERSONA_GLAMOUR_CONTEXT, type OwnPublicHandleStore, type PersonaPublicHandleRecord } from "../src/index.js";
import { deriveVeiledUserKey } from "../src/persona-identity.js";
import { didFromVerifyingKey } from "../src/lar-did.js";
import {
  currentOwnerSet, verifyHandleKel, verifyHandleKelFull, mintHandleRotation, handleKeyDigestOf,
  type OwnerHeadResolver, type HandleKelEvent,
} from "../src/handle-kel.js";

const SEED = Uint8Array.from(Array.from({ length: 32 }, (_, i) => (i * 5 + 1) & 0xff));
const pubOf = (s: Uint8Array) => ed.getPublicKeyAsync(s).then(hex);
const didOf = async (s: Uint8Array) => `0x${await pubOf(s)}`;
const signerOf = (s: Uint8Array) => async (b: Uint8Array) => hex(await ed.signAsync(b, s));

// The owning persona's KEL prefix + the op-key that stands as its current head. In a real founding these
// come from the ceremony (`personaKelPrefix`); here a fixed pair stands for that owner.
const PERSONA_PREFIX = "persona-" + "ab".repeat(32);
const PERSONA_OP_SEED = new Uint8Array(32).fill(91);

function makeInMemoryPublicStore(): OwnPublicHandleStore {
  const m = new Map<number, PersonaPublicHandleRecord>();
  return {
    async load(i) { return m.get(i) ?? null; },
    async save(r) { m.set(r.handleIndex, r); },
    async list() { return [...m.keys()].sort((a, b) => a - b); },
  };
}

const headsAre = (table: Record<string, string>): OwnerHeadResolver =>
  async (memberPrefix, authKeyDid) => table[memberPrefix] === authKeyDid;

describe("the personal face is persona-anchored", () => {
  test("★ the glamour's handle-KEL owner member is the PERSONA prefix, never the handle key ★", async () => {
    const store = makeInMemoryPublicStore();
    const { card } = await mintPersonaGlamour({
      seed: SEED, handleIndex: 3, glamour: "Tide-Caller", now: 100, store,
      ownerPersonaKelPrefix: PERSONA_PREFIX,
    });
    const chain = card.chain as HandleKelEvent[];
    expect(verifyHandleKel(chain)).toBe(true);
    const owners = currentOwnerSet(chain)!;
    expect(owners.members, "the persona owns the face").toEqual([PERSONA_PREFIX]);
    expect(owners.members[0], "the handle key does NOT own itself").not.toBe(chain[0]!.handleKeyDid);
    expect(owners.threshold).toBe(1);
  });

  test("★ recovery flows through the persona — a rotation authorizes against the persona head ★", async () => {
    const store = makeInMemoryPublicStore();
    const { card } = await mintPersonaGlamour({
      seed: SEED, handleIndex: 3, glamour: "Tide-Caller", now: 100, store,
      ownerPersonaKelPrefix: PERSONA_PREFIX,
    });
    const chain = card.chain as HandleKelEvent[];
    const personaHead = await didOf(PERSONA_OP_SEED);
    // KERI pre-rotation: the inception pre-committed the context-1 key, so the rotation REVEALS that ladder
    // key (the seed-holder's next rung) and commits the context-2 digest — a thief's arbitrary key would miss.
    const freshHandleKeyDid  = didFromVerifyingKey((await deriveVeiledUserKey(SEED, 3, PERSONA_GLAMOUR_CONTEXT + 1)).verifyingKey);
    const nextHandleKeyDigest = handleKeyDigestOf(didFromVerifyingKey((await deriveVeiledUserKey(SEED, 3, PERSONA_GLAMOUR_CONTEXT + 2)).verifyingKey));

    // The persona (owner), not the handle key, rotates the face to a fresh presentation key.
    const rot = await mintHandleRotation({
      head: chain[0]!, freshHandleKeyDid,
      ownerAuthMemberPrefix: PERSONA_PREFIX, ownerHeadOpKeyDid: personaHead,
      sign: signerOf(PERSONA_OP_SEED), nextHandleKeyDigest,
    });
    expect(rot.ok, rot.ok ? "" : rot.reason).toBe(true);
    if (!rot.ok) return;
    const rotated = [chain[0]!, rot.event];
    const full = await verifyHandleKelFull(rotated, headsAre({ [PERSONA_PREFIX]: personaHead }));
    expect(full.ok, full.ok ? "" : full.reason).toBe(true);
  });
});
