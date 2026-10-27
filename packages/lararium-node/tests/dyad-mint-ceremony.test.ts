/**
 * dyad-mint-ceremony — A DYAD IS MINTED WHEN A FACE MEETS A DEVICE (register ⑨, Stage 2).
 *
 * A face's random atom names the device end of the relationship. These vectors assert that
 * founding and admit each land a dyad slot under the atom DID.
 *
 * The binding asymmetry is the model's own honesty: at FOUNDING (self-stood) the group root stands
 * in the same hands, so the binding gets signed, rooted on the HEARTH it binds (the seed charter's AID);
 * at APPLY the joinee holds no root, so its slot carries `binding: null` — presented, not yet gathered —
 * and the absence travels rather than hides. A face founded at no hearth binds no dyad either.
 */
import { describe, test, expect, vi } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import type { AutomergeUrl } from "@automerge/automerge-repo";
import { KeyhiveProvider, runFoundingCeremony, runDeviceAdmitEdge, runApplyAdmitPayload } from "@lararium/keyhive";
import * as ed25519 from "@noble/ed25519";
import {
  hex, faceAtomKeyFromSeed, vesselDyads, DYAD_SLOT_PREFIX, seedDaemonDoc, type DyadRecord,
  personaKelBoardDocUrl, materializeSharedLarDoc, personaKelChainForPrefix, MESH_CABAL_SENTINEL_URI,
} from "@lararium/mesh";
import type { LarDoc } from "@lararium/mesh";

import { founderAndJoineeActs, frontierFromFoundingSeed } from "./admit-acts.js";
const pubOf = async (seed: Uint8Array): Promise<string> => hex(await ed25519.getPublicKeyAsync(seed));

const FOUNDER_SEED = new Uint8Array(32).fill(7);
/** The hearth the founding binds: a seed charter's Nexus AID. */
const HEARTH_AID = `nexus-${"5a".repeat(32)}`;
const JOINEE_SEED  = new Uint8Array(32).fill(11);
const JOINEE_ATOM = new Uint8Array(32).fill(12);

async function found(hearthTrueName: string = HEARTH_AID) {
  const repo = new Repo({ sharePolicy: async () => true });
  const verifyingKey = await pubOf(FOUNDER_SEED);
  const f = await runFoundingCeremony({ repo,
    vesselSeed:         FOUNDER_SEED,
    placeVerifyingKey: verifyingKey,
    vesselDisplayName:  "The Strandbeest Shrine",
    binding: { mode: "self-stood", signerSeed: FOUNDER_SEED },
    hearthTrueName,
    nexusPubkey:          verifyingKey,
  });
  return { repo, f, verifyingKey };
}

/** REQUIRED on every device-admit payload now (early alpha, no back-compat) — read the founder's own
 *  persona-KEL chain back off the per-Nexus board the founding seated, the same way the production CLI
 *  (`device-admit.ts`) does, rather than letting a payload mint silently degraded. */
async function founderPersonaKelChain(founder: Awaited<ReturnType<typeof found>>) {
  const kelBoard = await materializeSharedLarDoc(founder.repo, personaKelBoardDocUrl(founder.verifyingKey), "board:persona-kel");
  const chain = personaKelChainForPrefix(kelBoard.doc(), founder.f.personaKelPrefix);
  if (!chain) throw new Error("test fixture: founder seated no KEL chain for its own prefix");
  return chain;
}

async function dyadSlotsOf(repo: Repo, daemonUrl: string): Promise<DyadRecord[]> {
  const handle = await repo.find(daemonUrl as AutomergeUrl);
  const doc = await handle.doc() as { tiddlers: Record<string, { tiddler?: { text?: string } }> };
  return Object.keys(doc.tiddlers)
    .filter((t) => t.startsWith(DYAD_SLOT_PREFIX))
    .map((t) => JSON.parse(doc.tiddlers[t]!.tiddler!.text!) as DyadRecord);
}

describe("the ceremony mints the dyad", () => {
  test("founding writes one atom dyad slot with a signed binding", async () => {
    const { repo, f } = await found();
    const slots = await dyadSlotsOf(repo, f.daemonUrl);
    expect(slots.length, "founding mints exactly one dyad").toBe(1);

    const atom = faceAtomKeyFromSeed(f.atomSeed, f.personaGroupId);
    const slot = slots[0]!;
    expect(slot.ref.deviceDid.toLowerCase()).toBe(atom.did.toLowerCase());
    expect(slot.ref.deviceDid.toLowerCase()).not.toBe(f.signerDid.toLowerCase());
    expect(slot.binding, "the root stands self-stood here, so the binding signs").not.toBeNull();
    expect(slot.binding!.epochCid, "the binding roots on the hearth's AID").toBe(HEARTH_AID);
  });

  test("★ the cabal sentinel seeds from the HEARTH: the face founds its cabal under the hearth's AID — CONTROL: no hearth, the bare URI ★", async () => {
    const created = vi.spyOn(KeyhiveProvider.prototype, "createSentinelDoc");
    try {
      await found();
      expect(created.mock.calls.map((c) => c[0])).toContain(`${MESH_CABAL_SENTINEL_URI}/${HEARTH_AID}`);
      created.mockClear();
      await found("");
      expect(created.mock.calls.map((c) => c[0])).toContain(MESH_CABAL_SENTINEL_URI);                  // CONTROL
      expect(created.mock.calls.map((c) => c[0])).not.toContain(`${MESH_CABAL_SENTINEL_URI}/`);
    } finally { created.mockRestore(); }
  });

  test("★ a face founded at NO hearth binds no dyad: its slot carries binding null — CONTROL: at a hearth it binds ★", async () => {
    const { repo, f } = await found("");
    const slots = await dyadSlotsOf(repo, f.daemonUrl);
    expect(slots).toHaveLength(1);
    expect(slots[0]!.binding).toBeNull();
    const at = await found();
    expect((await dyadSlotsOf(at.repo, at.f.daemonUrl))[0]!.binding).not.toBeNull();
  });

  test("apply writes the joinee atom's dyad slot with a null binding", async () => {
    const founder = await found();
    const joineeKey = faceAtomKeyFromSeed(JOINEE_ATOM, founder.f.personaGroupId).key;
    const payload = await runDeviceAdmitEdge({
      signerSeed:             FOUNDER_SEED, edgeFrontier: await frontierFromFoundingSeed(FOUNDER_SEED),
      joineeVerifyingKey:     joineeKey,
      personaKelPrefix:       founder.f.personaKelPrefix,
      personaKelChain:        await founderPersonaKelChain(founder),
      hearthTrueName:         "bafyHearth",
      personaGroupId:   founder.f.personaGroupId,
      meshCabalDocIdHex:      founder.f.meshCabalDocIdHex,
      syncUrl: null, islandDocUrl: null, hearthDaemonUrl: founder.f.daemonUrl, personaUrl: founder.f.personaUrl,
      personaActs: await founderAndJoineeActs({ face: founder.f, signerSeed: FOUNDER_SEED, founderAtomSeed: founder.f.atomSeed, joineeKey, chain: await founderPersonaKelChain(founder) }),
    } as Parameters<typeof runDeviceAdmitEdge>[0]);

    const joineeRepo = new Repo({ sharePolicy: async () => true });
    const applied = await runApplyAdmitPayload({ repo: joineeRepo, atomSeed: JOINEE_ATOM, daemonHandle: seedDaemonDoc(joineeRepo),
      vesselDisplayName: "Ichi", payload, nexusPubkey: await pubOf(JOINEE_SEED),
    });

    const slots = await dyadSlotsOf(joineeRepo, applied.daemonUrl);
    expect(slots.length, "the admit mints exactly one dyad on the joinee").toBe(1);

    const slot = slots[0]!;
    expect(slot.ref.deviceDid.toLowerCase()).toBe(faceAtomKeyFromSeed(JOINEE_ATOM, founder.f.personaGroupId).did.toLowerCase());
    expect(slot.binding, "no root stands on the joinee — the absence travels").toBeNull();
  });

  test("★ THE READ PATH MEETS THE MINT — vesselDyads reads the slot, and the slot WINS over the edge ★", async () => {
    // The edge-derived fallback would read (device × root); the ceremony-minted slot carries the
    // derived veil. One relationship, one record, and the slot's reading is the one that surfaces —
    // the exact union the boot read path (`openDaemon`) now walks on a live daemon doc.
    const { repo, f } = await found();
    const handle = await repo.find(f.daemonUrl as AutomergeUrl);
    const doc = await handle.doc() as unknown as LarDoc;

    const dyads = vesselDyads(doc);
    expect(dyads.length, "one relationship, slot and edge united").toBe(1);
    expect(dyads[0]!.ref.deviceDid.toLowerCase()).toBe(faceAtomKeyFromSeed(f.atomSeed, f.personaGroupId).did.toLowerCase());
    expect(dyads[0]!.ref.deviceDid.toLowerCase()).not.toBe(f.signerDid.toLowerCase());
    expect(dyads[0]!.binding).not.toBeNull();
  });

  test("the two vessels wear DIFFERENT faces into one group — no roster key appears on another", async () => {
    const a = faceAtomKeyFromSeed(FOUNDER_SEED, "one-group");
    const b = faceAtomKeyFromSeed(JOINEE_ATOM, "one-group");
    expect(a.key).not.toBe(b.key);
  });
});
