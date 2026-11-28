/**
 * carrier-canonical — ONE question, asked from the OTHER shore: what canonical
 * text do these disk bytes SAY?
 *
 * `render(parse(disk))` is the seat of the three-way gate's congruence `≈`: two
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

import { memeticVerdict } from "./meta-parity.js";
import { memeticIngestOps } from "./ingest-gate.js";

/**
 * The canonical text `diskText` SAYS, read through the memetic-wikitext
 * congruence: `render(parse(diskText))`.
 *
 * Returns `null` — never a guess, never `""` — when the answer does not exist
 * or cannot be trusted:
 *   - the parse grades `error` (the carrier stopped round-tripping; the ingest
 *     leg REFUSES on this exact grade, so there is nothing to compare here),
 *   - the shore produced no render (a non-memetic parent, an absent group),
 *   - THE ROUND TRIP IS LOSSY — the disk declares a structural slot the render
 *     drops (the ahu-drop). See the fidelity note below.
 *
 * The null carries a FACT: "no trustworthy canonical view of these bytes
 * exists". It does NOT mean "equivalent" — `projection-gate`'s clause reads
 * presence first, so an absent view falls through to the base clauses (a write
 * only where the file stands as the projector left it, the capture door
 * otherwise) rather than silently licensing a write (the null-as-default
 * inversion).
 *
 * THE AHU-FIDELITY GUARD RIDES, AND IT BITES HARDER HERE THAN ON THE INGEST
 * SHORE. Ingest's rule 3 guards it because a lossy render makes an edit inside a
 * dropped slot read as "framing only" and never reach the records. On THIS shore
 * the canonical-equivalence verdict is a DISK WRITE: a lossy render that matched
 * the records' view would replace the operator's bytes with a text that drops
 * the slot — the edit does not merely fail to land, it DIES on disk. So
 * the guard belongs inside this door, where every caller of `≈` gets it, rather
 * than in the pure gate (which holds no text to scan) or in one caller's body.
 *
 * Pure: no I/O, no clock, no hashing. The caller hashes what comes back.
 */
export function canonicalizeCarrierText(uri: string, diskText: string): string | null {
  const { records, diagnostics, declared } = memeticIngestOps.deserialize(uri, diskText, memeticVerdict(diskText));
  if (memeticIngestOps.grade(diagnostics) === "error") return null;
  const canonical = memeticIngestOps.render(uri, records);
  if (canonical === "") return null;
  const rendered = memeticIngestOps.declaredStructure(canonical);
  for (const slot of declared) if (!rendered.has(slot)) return null;
  return canonical;
}

/**
 * THE TIDDLERS a memetic carrier's words SAY — `parse(diskText)`, the same deserialize `render(parse(·))` reads above, so
 * the words of a file a hand moved land, or stand as parallel drafts, through the one congruence the gates weigh it by. Null where the parse
 * grades `error` (the ingest leg refuses those bytes, and nothing here loads them either).
 */
export function carrierRecords(uri: string, diskText: string): ReadonlyArray<Readonly<Record<string, unknown>>> | null {
  const { records, diagnostics } = memeticIngestOps.deserialize(uri, diskText, memeticVerdict(diskText));
  if (memeticIngestOps.grade(diagnostics) === "error") return null;
  return records as ReadonlyArray<Readonly<Record<string, unknown>>>;
}

/**
 * THE WORDS A COLLAPSE WOULD LAND, read through the ingest gate's own grade before anything writes: the tiddlers they say,
 * or why the gate would refuse them. A fragment address, bare data (no frame), a parse that grades `error`, a render that
 * says nothing and a render that drops a slot the words declare each refuse, as `decideIngest` refuses them; a landing
 * never writes what a person's own `lares ingest` of the same words could not land.
 */
export function carrierLanding(uri: string, text: string): { readonly records: ReadonlyArray<Readonly<Record<string, unknown>>> } | { readonly why: string } {
  if (uri.includes("#")) return { why: `${uri}: a fragment address never founds a meme` };
  const frame = memeticVerdict(text);
  if (frame.kind === "bare") return { why: `${uri}: the words stand as bare data (no frame), which the ingest gate holds verbatim and never reads as a meme's tiddlers` };
  const { records, diagnostics, declared } = memeticIngestOps.deserialize(uri, text, frame);
  if (memeticIngestOps.grade(diagnostics) === "error") {
    const faults = diagnostics.filter((d) => d.severity === "error").map((d) => d.message);
    return { why: `${uri}: the ingest grade refuses the words (${faults.join("; ") || "a fault of error grade"})` };
  }
  const canonical = memeticIngestOps.render(uri, records);
  if (canonical === "") return { why: `${uri}: the words render no canonical text` };
  const rendered = memeticIngestOps.declaredStructure(canonical);
  const dropped = [...declared].filter((slot) => !rendered.has(slot));
  if (dropped.length > 0) return { why: `${uri}: the render drops the slot(s) the words declare (${dropped.join(", ")})` };
  return { records: records as ReadonlyArray<Readonly<Record<string, unknown>>> };
}
