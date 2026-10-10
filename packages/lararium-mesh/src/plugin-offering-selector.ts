/**
 * plugin-offering-selector — resolve a recipe's ordered `pluginOfferings` CID list into the exact
 * blob set an island loads.
 *
 * ── WHOLE OFFERINGS, NEVER SUBSETS (the ki-handoff ruling) ──────────────────────────────────────
 * `WikiRecipe.pluginOfferings` names complete signed offering CIDs. There is no signed per-plugin
 * selector anywhere in this house, and this module does not invent one: it takes each named offering
 * whole or refuses it whole. A taker who wants "half of streams" has no lawful way to ask for it.
 *
 * ── WHAT THIS MODULE DOES, AND WHAT IT DOES NOT ─────────────────────────────────────────────────
 * It resolves CIDs → verified offerings → blob descriptors. It never fetches a byte, and it never
 * trusts a caller-handed offering object on its own say — it recomputes BOTH halves a taker must check:
 *   1. the offering's own content CID matches the CID the recipe actually named (`cid-mismatch` —
 *      the one failure named in offerings-handoff.md that `verifyPluginOffering` cannot check, because
 *      a single offering reasoned about in isolation holds no caller-named CID to compare against);
 *   2. the offering itself verifies (`verifyPluginOffering` — signature, fold, provenance, dependents,
 *      runtimes), via the SAME function a lone-offering taker would call.
 * `missing-bytes` / `corrupt-bytes` stay OUT of scope here on purpose: this module reasons over signed
 * descriptors, never raw CAS bytes, so an offering this module cannot find reads as `unknown` (the
 * recipe named a CID nothing here can resolve), never silently as an empty selection — "missing bytes
 * fail closed by name" (golden-path-p2-recipe.md REFINEMENTS #7). Resolving that unknown CID into actual
 * plugin bytes is the CAS/runtime-wiring layer R3 owns.
 *
 * ── DUPLICATE PLUGIN IDS ACROSS OFFERINGS REFUSE ────────────────────────────────────────────────
 * `verifyPluginOffering` already refuses a duplicate id WITHIN one offering. This selector extends that
 * law ACROSS the recipe's whole ordered list: two different offerings naming the same plugin id is
 * exactly the "same plugin, two hands" ambiguity the recipe model exists to rule out (RECIPE: plugins
 * load by recipe, "Duplicate plugin IDs across offerings get refused"). First offering in recipe order
 * claims an id; a later offering naming it again refuses the WHOLE selection — never a silent override,
 * never a silent drop.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/plugin-offering-selector
 */

import { pluginOfferingCid, verifyPluginOffering, type OfferedBlob, type OfferingFailureCode, type PluginOffering } from "./plugin-offering.js";

/**
 * Looks a signed offering up by its own content CID (`pluginOfferingCid`). Absent/`undefined` names an
 * offering this resolver cannot find — a locally-unavailable or never-announced gift, never an empty
 * recipe entry. Sync by design: the Crossroads board resolution this wraps is a local, already-synced
 * read (CRDT doc or in-memory announce cache); fetching bytes across a wire is a separate, later step.
 */
export type OfferingLookup = (cid: string) => PluginOffering | undefined;

/** The ONE failure the lone-offering verify (`verifyPluginOffering`) cannot name on its own — a
 *  caller-named CID that the resolved offering itself does not answer to. */
export type SelectorOnlyFailureCode = "unknown" | "cid-mismatch" | "duplicate-plugin";

export type SelectionFailure =
  | { readonly code: "unknown"; readonly cid: string }
  | { readonly code: "cid-mismatch"; readonly cid: string; readonly computed: string }
  | { readonly code: "duplicate-plugin"; readonly id: string; readonly offeringCid: string; readonly firstOfferingCid: string }
  | { readonly code: OfferingFailureCode; readonly cid: string; readonly reason: string };

export type SelectionVerdict =
  | { readonly ok: true; readonly blobs: readonly OfferedBlob[] }
  | { readonly ok: false; readonly failure: SelectionFailure };

/**
 * Resolve an ordered `pluginOfferings` CID list into exactly the chosen offerings' blobs, in order.
 *
 * An EMPTY list yields an empty, successful selection (no optional plugins) — never a refusal; "an
 * empty recipe yields no optional CIDs" is the control every other case is measured against.
 */
export async function selectPluginBlobs(
  offeringCids: readonly string[],
  lookup: OfferingLookup,
): Promise<SelectionVerdict> {
  const blobs: OfferedBlob[] = [];
  const claimedBy = new Map<string, string>(); // plugin id -> the offering CID that first claimed it

  for (const cid of offeringCids) {
    const offering = lookup(cid);
    if (!offering) return { ok: false, failure: { code: "unknown", cid } };

    // The caller named this CID; the offering must actually answer to it. A lookup keyed some other
    // way (or a lookup that lies) is exactly the forgery this check exists to catch before anything
    // else runs, including the signature check inside verifyPluginOffering.
    const computed = pluginOfferingCid(offering);
    if (computed !== cid) return { ok: false, failure: { code: "cid-mismatch", cid, computed } };

    const verdict = await verifyPluginOffering(offering);
    if (!verdict.ok) return { ok: false, failure: { code: verdict.code, cid, reason: verdict.reason } };

    for (const blob of offering.blobs) {
      const firstOfferingCid = claimedBy.get(blob.id);
      if (firstOfferingCid !== undefined) {
        return { ok: false, failure: { code: "duplicate-plugin", id: blob.id, offeringCid: cid, firstOfferingCid } };
      }
      claimedBy.set(blob.id, cid);
      blobs.push(blob);
    }
  }
  return { ok: true, blobs };
}

/** The sha256 CIDs a successful selection carries — the exact shape `IslandMsg_Manifest.pluginCids`
 *  (`island-protocol.ts`) takes, so a selection flows straight into a manifest with no re-derivation. */
export function selectedPluginCids(blobs: readonly OfferedBlob[]): readonly string[] {
  return blobs.map((b) => b.sha256);
}
