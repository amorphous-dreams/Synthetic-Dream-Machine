/**
 * carrier-edges — every address a carrier points AT, in each form the grammar spells one.
 *
 * ── WHY THE GRAPH NEEDS ITS OWN READING ─────────────────────────────────────────────────────────
 * A `lar:` URI names; it does not fetch. So a carrier whose target moved keeps rendering, keeps
 * round-tripping, and keeps passing every gate this tree stands — `carrier-shape` asks whether a file
 * is whole, `meme-coordinates` asks whether its own coordinate agrees, `bcc` asks whether its bytes
 * match their check. **None of them looks outward.** An edge that resolves to nothing is invisible to
 * all three at once.
 *
 * A move that runs this scan BEFORE it lands breaks no reference; a move without it leaves references
 * naming addresses that answer nothing, found only by hand after the commit. This is that scan,
 * made an instrument instead of a habit.
 *
 * ── FIVE SPELLINGS, ONE RELATION ────────────────────────────────────────────────────────────────
 * A reader counting only `loulou` sees 149 of the corpus's 194 dangling edges. The other 45 ride
 * `pranala` and two wikilink forms — and an instrument that misses a form reports a clean move over a
 * broken one. Every form a carrier can name an address in belongs here.
 *
 * Measured over 614 carriers: 2,197 edges — loulou 1,851 · wikilink 255 · pranala 84 · kahea 7.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/memetic-wikitext
 */

import { fencedSpans, inMask } from "@lararium/memetic-frame";

/** How a carrier spelled the reference. */
export type EdgeForm = "loulou" | "pranala" | "kahea" | "wikilink";

export interface CarrierEdge {
  /** The address named, fragment stripped — what a resolver would look up. */
  readonly address: string;
  /** The address as written, fragment included. */
  readonly written: string;
  readonly form: EdgeForm;
}

// EVERY ADDRESS RIDES A NAMED, TICKED VALUE (the kupono cut): ``<<~ loulou uri=`lar:///x`>>``,
// ``<<~ pranala from=`…` to=`lar:///x`>>``, ``<<~ kahea uri=`lar:///x`>>``. The tick is not part of the
// address, and every scan here strips the pair. A form that stopped matching reports no edges at all,
// silently, so `tests/kupono-readers.test.ts` holds a known positive for each.
//
// A `>` CLOSES A CALL ONLY WHEN A SECOND ONE FOLLOWS — TiddlyWiki's own `reUnquotedAttribute` law — so
// every scan spells its run `(?:[^>]|>(?!>))*?`. Measured: a scan of `[^>]*?` once found 0 of the
// corpus's 84 `pranala` edges.
//
// AN EDGE IS THE END IT POINTS AT. A `pranala` names both ends, and only `to=` is the edge — `from=` is
// where the carrier already stands. Anchored on the NAME, never on position: the writer emits `from`
// first and a reader accepts either order, so position is not the relation.
const PATTERNS: ReadonlyArray<readonly [EdgeForm, RegExp]> = [
  ["loulou",   /<<~\s*loulou(?:[^>]|>(?!>))*?\suri=`lar:\/\/\/([^`\s]+?)`/g],
  ["pranala",  /<<~\s*pranala(?:[^>]|>(?!>))*?\sto=`lar:\/\/\/([^`\s]+?)`/g],
  ["kahea",    /<<~\s*kahea(?:[^>]|>(?!>))*?\suri=`lar:\/\/\/([^`\s]+?)`/g],
  ["wikilink", /\[\[[^\]|]*\|lar:\/\/\/([^\]]+)\]\]/g],
  ["wikilink", /\[\[lar:\/\/\/([^\]|]+)\]\]/g],
];

/**
 * Every edge a carrier writes, read through the fence mask.
 *
 * The specification memes teach these forms by quoting them, so an unmasked scan reports a lesson's
 * example as a broken link and sends a reader chasing an address nobody meant to stand.
 */
export function readCarrierEdges(text: string): CarrierEdge[] {
  const spans = fencedSpans(text);
  const out: CarrierEdge[] = [];
  for (const [form, re] of PATTERNS) {
    const g = new RegExp(re.source, re.flags);
    let m: RegExpExecArray | null;
    while ((m = g.exec(text)) !== null) {
      if (inMask(spans, m.index)) continue;
      // A trailing period or comma belongs to the prose, never to the name.
      const written = m[1]!.replace(/[.,;]+$/, "");
      out.push({ written, address: written.split("#")[0]!, form });
    }
  }
  return out;
}

/**
 * HOMED IN THE KAHU WORKBENCH, OUTSIDE THE CORPUS — the one class of unheld edge that names a carrier
 * standing somewhere this reader cannot see. The operator's ruling of 2026-11-20 moved the founding
 * road (`docs/stable-founding-road`, `docs/road-ashes`, every `docs/road/*` rank and ruling) out of
 * canon and into the shared Kahu workbench wiki (slug `kahu`, `recipe=kahu`): an engineer's working
 * plan, not shared canon. A canon loulou to the road still names a live carrier; it answers in the
 * workbench, never in `bags/`. The class names that prefix exactly and nothing beside it, and the
 * corpus test holds its own ceiling, so no other broken edge hides inside it.
 */
export function homedInTheKahuWorkbench(address: string): boolean {
  return /^ha\.ka\.ba\/lares\/docs\/(?:stable-founding-road|road-ashes|road\/[^/]+)$/.test(address);
}
