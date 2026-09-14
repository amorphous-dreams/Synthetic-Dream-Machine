/**
 * carrier-canonical — ONE question, asked from the OTHER shore: what canonical
 * text do these disk bytes SAY?
 *
 * `render(parse(disk))` is the seat of the Confluence's congruence `≈`: two
 * carriers that render alike say the same thing, whatever framing their bytes
 * wear. The ingest leg computes it inside `decideIngest` (its rule 3, the
 * canonical-equivalence gate) because it already holds the parse it needs for
 * its payload. The PROJECTING leg holds no parse at all — it renders records
 * out and never reads disk — so `projection-gate`'s canonical-equivalence
 * clause needs that one value handed in, and this is the ONE door that answers
 * it.
 *
 * WHY A PURPOSE-BUILT FUNCTION rather than exporting the deserializer: the
 * projector needs the ANSWER, not the machinery. Exporting `deserializeCarrier`
 * + `expandMemeRefs` would widen this package's public surface with two moving
 * parts and let a second implementation of `≈` grow beside the gate's. This
 * reuses `memeticIngestOps` — the SAME congruence bundle `decideIngest` reads —
 * so there stays exactly ONE implementation of `render(parse(·))` in the tree,
 * and a change to the memetic congruence reaches both legs at once.
 *
 * PURE SUBPATH (`@lararium/tw5/carrier-canonical`): the only import is
 * `./ingest-gate.js`, whose own header states the law — the `@lararium/mesh`
 * BARREL drags wasm the plugin build cannot bundle, so it reads the pure
 * `agile-digest` subpath instead. Nothing here reaches past that graph, and
 * nothing here touches the filesystem, a clock, or a hash.
 */

import { memeticIngestOps } from "./ingest-gate.js";

/**
 * The canonical text `diskText` SAYS, read through the memetic-wikitext
 * congruence: `render(parse(diskText))`.
 *
 * Returns `null` — never a guess, never `""` — when the answer does not exist:
 *   - the parse grades `error` (the carrier stopped round-tripping; the ingest
 *     leg REFUSES on this exact grade, so there is nothing to compare here),
 *   - the shore produced no render (a non-memetic parent, an absent group).
 *
 * The null carries a FACT: "no canonical view of these bytes exists". It does
 * NOT mean "equivalent" — `projection-gate`'s clause reads presence first, so an
 * absent view falls through to the standoff rather than silently licensing a
 * noop (the null-as-default inversion).
 *
 * Pure: no I/O, no clock, no hashing. The caller hashes what comes back.
 */
export function canonicalizeCarrierText(uri: string, diskText: string): string | null {
  const { records, diagnostics } = memeticIngestOps.deserialize(uri, diskText);
  if (memeticIngestOps.grade(diagnostics) === "error") return null;
  const canonical = memeticIngestOps.render(uri, records);
  return canonical === "" ? null : canonical;
}
