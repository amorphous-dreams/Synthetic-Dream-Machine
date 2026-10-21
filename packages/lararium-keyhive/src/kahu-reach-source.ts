/**
 * kahu-reach-source — the daemon island's source of the Kahu predicate's facts, composed where the sentinel read
 * lives.
 *
 * The predicate (`kahuCabalCanonAccess`) reads two facts apart: the counted admission (authority: the shore's
 * charter roster and the Nexus board's acts) and the sentinel membership (capability: this island's Keyhive
 * provider). The shore hands the first through a `KahuCabalBoardReader`; this module reads the second at ACCESS,
 * never at boot, and names the group through the one accessor (`kahuRealmGroup`). A vessel with no board reader,
 * no face group or no sentinel pin stands as a stranger: it returns no source, and every door refuses a system bag.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/kahu#/cabal-admission
 */
import {
  isSystemCanonBag, kahuReachAccess, kahuRealmGroup, requireKahuReach, KAHU_REACH_REASON,
  type CapabilityVerifier, type KahuCabalBoardReader, type KahuReachSource,
} from "@lararium/mesh";
import type { KeyhiveProvider } from "./keyhive-provider.js";

export function kahuReachSourceOf(input: {
  readonly board:             KahuCabalBoardReader | undefined;
  readonly personaGroupId:    string | undefined;
  readonly meshCabalDocIdHex: string | undefined;
  /** The provider that created the sentinel: the face's veil when one stands, else the vessel's. Read at ACCESS. */
  readonly sentinelProvider:  () => Pick<KeyhiveProvider, "verifySentinelMembership"> | null;
}): KahuReachSource | undefined {
  const { board, personaGroupId, meshCabalDocIdHex } = input;
  if (!board || !personaGroupId || !meshCabalDocIdHex) return undefined;
  return async () => {
    const read = await board();
    if (read === null) return null;
    const provider = input.sentinelProvider();
    let sentinelMember = false;
    if (provider !== null) {
      try { sentinelMember = (await provider.verifySentinelMembership(personaGroupId, meshCabalDocIdHex)).ok; }
      catch { sentinelMember = false; }
    }
    return { group: kahuRealmGroup(personaGroupId), nexus: read.nexus, roster: read.roster, acts: read.acts, sentinelMember };
  };
}

/**
 * THE VERIFY-THEN-DELEGATE GATE. A verb routed into a wiki island (`lares act --in-wiki`) clears the cap at THIS
 * island before main delegates it, and the wiki island answers every later ask by worker trust. So the Kahu
 * predicate stands in the verifier too: an `admin` ask on a system canon bag holds only for a hand the cabal's
 * reach admits, and a read asks nothing. Every other bag falls through to the inner verifier untouched.
 */
export function withKahuReach(inner: CapabilityVerifier, source: KahuReachSource | undefined): CapabilityVerifier {
  return {
    kahuReach: (bagUrl, act) => requireKahuReach(bagUrl, source, act),
    async verify(args) {
      if (args.access === "admin" && isSystemCanonBag(args.bagUrl)) {
        const access = await kahuReachAccess(source);
        if (!access.held) return { ok: false, reason: `${KAHU_REACH_REASON}: system canon takes a hand in the Kahu cabal (${access.reason})` };
      }
      return inner.verify(args);
    },
  };
}
