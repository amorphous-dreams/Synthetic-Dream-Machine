/**
 * dyad-mint-ceremony — A DYAD IS MINTED WHEN A FACE MEETS A DEVICE (register ⑨, Stage 2).
 *
 * The Stage 0 ruling (2026-09-05) named what stands behind the veil: the per-handle credential
 * derived from the DEVICE-MINTED vessel seed (`deriveDyadVeil`). These vectors assert the two
 * ceremony sites WRITE that relationship down: founding and admit each land a dyad slot whose
 * veilDid is the derived face — never the persona root, which spans devices and names no veil.
 *
 * The binding asymmetry is the model's own honesty: at FOUNDING (self-stood) the group root stands
 * in the same hands, so the binding gets signed; at APPLY the joinee holds no root, so its slot
 * carries `binding: null` — presented, not yet gathered — and the absence travels rather than hides.
 */
import { describe, test, expect } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import type { AutomergeUrl } from "@automerge/automerge-repo";
import { runFoundingCeremony, runDeviceAdmitEdge, runApplyAdmitPayload } from "@lararium/keyhive";
import * as ed25519 from "@noble/ed25519";
import { hex, deriveDyadVeil, DYAD_SLOT_PREFIX, type DyadRecord } from "@lararium/mesh";
import { vesselDyads } from "../src/vessel-dyads.js";
import type { LarDoc } from "@lararium/mesh";

const pubOf = async (seed: Uint8Array): Promise<string> => hex(await ed25519.getPublicKeyAsync(seed));

const FOUNDER_SEED = new Uint8Array(32).fill(7);
const JOINEE_SEED  = new Uint8Array(32).fill(11);

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

async function dyadSlotsOf(repo: Repo, daemonUrl: string): Promise<DyadRecord[]> {
  const handle = await repo.find(daemonUrl as AutomergeUrl);
  const doc = await handle.doc() as { tiddlers: Record<string, { tiddler?: { text?: string } }> };
  return Object.keys(doc.tiddlers)
    .filter((t) => t.startsWith(DYAD_SLOT_PREFIX))
    .map((t) => JSON.parse(doc.tiddlers[t]!.tiddler!.text!) as DyadRecord);
}

describe("the ceremony mints the dyad", () => {
  test("★ FOUNDING writes a dyad slot — veilDid is the DERIVED face, never the root, binding SIGNED ★", async () => {
    const { repo, f } = await found();
    const slots = await dyadSlotsOf(repo, f.daemonUrl);
    expect(slots.length, "founding mints exactly one dyad").toBe(1);

    const veil = await deriveDyadVeil(FOUNDER_SEED, f.personaGroupDocIdHex);
    const slot = slots[0]!;
    expect(slot.ref.veilDid.toLowerCase()).toContain(veil.verifyingKey);
    expect(slot.ref.veilDid.toLowerCase()).not.toBe(f.signerDid.toLowerCase());
    expect(slot.ref.vesselDid.toLowerCase()).toBe(f.founderEdge.deviceDid.toLowerCase());
    expect(slot.binding, "the root stands self-stood here, so the binding signs").not.toBeNull();
  });

  test("★ APPLY writes the joinee's dyad slot — its OWN derived face, binding null (the root is absent) ★", async () => {
    const founder = await found();
    const joineeKey = await pubOf(JOINEE_SEED);
    const payload = await runDeviceAdmitEdge({
      signerSeed:             FOUNDER_SEED,
      joineeVerifyingKey:     joineeKey,
      personaKelPrefix:       founder.f.personaKelPrefix,
      hearthTrueName:         "bafyHearth",
      personaGroupDocIdHex:   founder.f.personaGroupDocIdHex,
      personaGroupAgentIdHex: founder.f.personaGroupAgentIdHex,
      meshCabalDocIdHex:      founder.f.meshCabalDocIdHex,
      syncUrl: null, islandDocUrl: null, personaUrl: founder.f.personaUrl,
    } as Parameters<typeof runDeviceAdmitEdge>[0]);

    const joineeRepo = new Repo({ sharePolicy: async () => true });
    const applied = await runApplyAdmitPayload({
      repo: joineeRepo, vesselSeed: JOINEE_SEED, vesselVerifyingKey: joineeKey,
      vesselDisplayName: "Ichi", payload, nexusPubkey: joineeKey,
    });

    const slots = await dyadSlotsOf(joineeRepo, applied.daemonUrl);
    expect(slots.length, "the admit mints exactly one dyad on the joinee").toBe(1);

    const veil = await deriveDyadVeil(JOINEE_SEED, founder.f.personaGroupDocIdHex);
    const slot = slots[0]!;
    expect(slot.ref.veilDid.toLowerCase()).toContain(veil.verifyingKey);
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
    const veil = await deriveDyadVeil(FOUNDER_SEED, f.personaGroupDocIdHex);
    expect(dyads[0]!.ref.veilDid.toLowerCase()).toContain(veil.verifyingKey);
    expect(dyads[0]!.ref.veilDid.toLowerCase()).not.toBe(f.signerDid.toLowerCase());
    expect(dyads[0]!.binding).not.toBeNull();
  });

  test("the two vessels wear DIFFERENT faces into one group — no roster key appears on another", async () => {
    const a = await deriveDyadVeil(FOUNDER_SEED, "deadbeef".repeat(8));
    const b = await deriveDyadVeil(JOINEE_SEED,  "deadbeef".repeat(8));
    expect(a.verifyingKey).not.toBe(b.verifyingKey);
  });
});
