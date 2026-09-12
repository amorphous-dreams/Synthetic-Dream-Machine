/**
 * veil-tag-survives-repave — the founder's OWN veil identity recovers across a preserving re-pave.
 *
 * The founder-veil key derives from `deriveDyadVeil(vesselSeed, veilTag)` — deterministic in the pair.
 * The tag is minted per-founding (random) and today lives ONLY in the wiped daemon doc, so a preserving
 * re-pave (`vessel clear --force`, identity home kept) re-lights the face, mints a FRESH tag, and stands
 * a DIFFERENT veil identity. The cure: persist the tag beside the anchors and, on re-light, RE-DERIVE the
 * SAME veil from the persisted tag rather than minting a new one.
 *
 *   ★ recover — a re-light handed the persisted tag stands the SAME veil verifying key
 *   CONTROL   — a genuine fresh-from-void re-light (no tag handed in) still mints a NEW veil
 */
import { describe, test, expect } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { foundThePlace, foundTheFace } from "@lararium/keyhive";
import * as ed25519 from "@noble/ed25519";
import {
  hex, deriveDyadVeil, DYAD_VEIL_TAG_TIDDLER, tiddlerText, type LarDoc,
} from "@lararium/mesh";

const SEED = new Uint8Array(32).fill(9);
const pubOf = async (s: Uint8Array): Promise<string> => hex(await ed25519.getPublicKeyAsync(s));

/** Light a face on a fresh place (a re-pave hands a wiped substrate), optionally handed a persisted veil tag.
 *  Returns the tag the founding recorded and the veil verifying key that tag derives. */
async function lightAFace(
  repo: Repo, verifyingKey: string, veilTag?: string,
): Promise<{ tag: string; veilVk: string }> {
  const place = await foundThePlace({ repo, vesselSeed: SEED, hearthTrueName: "" });
  await foundTheFace({
    repo,
    daemonHandle:       place.daemonHandle,
    vesselSeed:         SEED,
    vesselVerifyingKey: verifyingKey,
    vesselDisplayName:  "Repave Shrine",
    binding:            { mode: "self-stood", signerSeed: SEED },
    hearthTrueName:     "",
    nexusPubkey:        verifyingKey,
    ...(veilTag ? { veilTag } : {}),
  });
  const tag    = tiddlerText((place.daemonHandle.doc() as unknown as LarDoc).tiddlers[DYAD_VEIL_TAG_TIDDLER])!;
  const veilVk = (await deriveDyadVeil(SEED, tag)).verifyingKey;
  return { tag, veilVk };
}

describe("the founder's veil identity survives a preserving re-pave", () => {
  test("★ a re-light handed the persisted tag stands the SAME veil ★", async () => {
    const verifyingKey = await pubOf(SEED);

    // First founding — mints a fresh tag, stands veil V1. The node adapter persists this tag in the anchors.
    const repo1 = new Repo({ sharePolicy: async () => true });
    const first = await lightAFace(repo1, verifyingKey);
    await repo1.shutdown();

    // Preserving re-pave: the substrate is wiped (a fresh repo), the identity home kept — so the persisted
    // tag rides back into the re-light. The SAME veil must recover.
    const repo2 = new Repo({ sharePolicy: async () => true });
    const second = await lightAFace(repo2, verifyingKey, first.tag);
    await repo2.shutdown();

    expect(second.tag,    "the re-light honors the persisted tag").toBe(first.tag);
    expect(second.veilVk, "the SAME veil identity recovers across the re-pave").toBe(first.veilVk);
  });

  test("CONTROL — a genuine fresh-from-void re-light still mints a NEW veil", async () => {
    const verifyingKey = await pubOf(SEED);

    const repoA = new Repo({ sharePolicy: async () => true });
    const a = await lightAFace(repoA, verifyingKey);
    await repoA.shutdown();

    // No tag handed in — a founding with no persisted tag mints a fresh one, never fabricates the prior veil.
    const repoB = new Repo({ sharePolicy: async () => true });
    const b = await lightAFace(repoB, verifyingKey);
    await repoB.shutdown();

    expect(b.tag,    "no persisted tag → a fresh mint").not.toBe(a.tag);
    expect(b.veilVk, "a fresh founding stands a NEW veil").not.toBe(a.veilVk);
  });
});
