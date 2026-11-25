/**
 * pulama-offering — the CLOSED plugin-offering descriptor the pūlama's hand door signs (`publish`, and `sign` kind `plugin-offering`).
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/the-worn-house#/the-pulama
 */
import { PLUGIN_OFFERING_DOMAIN, computePluginsCid, verifyPluginOffering, type PluginOffering } from "@lararium/mesh";

/** The ONE shape the hand door's `publish` signs: the `signPluginOffering` preimage's parts, and nothing beside them. */
export type PulamaOfferingTerms = Omit<PluginOffering, "kind" | "sig">;
const OFFERING_TERMS_FIELDS: ReadonlySet<string> = new Set(["offeror", "pluginsCid", "blobs"]);

/**
 * The descriptor a `publish` frame asks the hand to sign, or the refusal its shape reads. CLOSED: exactly `offeror` (the face
 * root's lowercase hex), `pluginsCid` and a non-empty `blobs`, each blob the taker's own closed shape with its provenance (the
 * same checks `verifyPluginOffering` runs, short of the signature), and the region its blobs fold to. Arbitrary bytes never
 * reach the root through this act: the root signs `pluginOfferingBytes` of a descriptor that passed here.
 */
export async function offeringTermsOf(raw: unknown): Promise<{ readonly terms: PulamaOfferingTerms } | { readonly reading: "publish-malformed"; readonly detail: string }> {
  const malformed = (detail: string) => ({ reading: "publish-malformed" as const, detail });
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return malformed("a publish names its offering: one object of offeror, pluginsCid and blobs");
  const extra = Object.keys(raw).filter((k) => !OFFERING_TERMS_FIELDS.has(k));
  if (extra.length > 0) return malformed(`an offering names offeror, pluginsCid and blobs alone, never ${extra.join(", ")}`);
  const terms = raw as PulamaOfferingTerms;
  if (typeof terms.offeror !== "string" || !/^[0-9a-f]{64}$/.test(terms.offeror)) return malformed("an offering names its offeror as the face root's lowercase hex key");
  // THE TAKER'S OWN SHAPE CHECKS, short of the signature: a placeholder signature leaves `bad-signature` as the one verdict a whole shape reads.
  let verdict: Awaited<ReturnType<typeof verifyPluginOffering>>;
  try { verdict = await verifyPluginOffering({ kind: PLUGIN_OFFERING_DOMAIN, ...terms, sig: "0".repeat(128) }); }
  catch { return malformed("the offering forms no plugin offering"); }
  if (verdict.ok || verdict.code !== "bad-signature") return malformed(verdict.ok ? "the offering forms no plugin offering" : `${verdict.code}: ${verdict.reason}`);
  // THE FOLD the taker recomputes reads here too: a descriptor whose region its blobs do not fold to signs nothing.
  const folded = computePluginsCid(terms.blobs);
  if (folded !== terms.pluginsCid) return malformed(`fold-mismatch: the blobs fold to ${folded}, not the declared region ${terms.pluginsCid}`);
  return { terms: { offeror: terms.offeror, pluginsCid: terms.pluginsCid, blobs: terms.blobs } };
}
