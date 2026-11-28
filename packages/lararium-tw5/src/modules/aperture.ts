/**
 * aperture — THE RANGE OF EVERY CALL (the keypad head, lar:///ha.ka.ba/kahua/memory/course/comms-ux-enacts "Two dials"; the
 * boot seed's own scale, lar:///ha.ka.ba/lares/api/noosphere-boot #/aperture and #/set-and-setting). `mu=` names how a call
 * looks; `aperture=` names how much it answers, in the set panel's own `N/rank` spelling:
 *
 *   pulse    0–4    one has line
 *   beat     5–8    the tagline
 *   measure  9–12   the card: each slot's first line, a record's text left home
 *   arc      13–16  the whole record (a meme's carrier paged on slot boundaries and joined)
 *   theme    17–20  the record and its family (transclusions, citers, its course row)
 *
 * It takes `10/measure`, the rank word alone (`measure`) or the number alone (`10`); each resolves to the same band, and the
 * answer echoes the `N/rank` it read. A rank word alone seats its band's canonical number (pulse 2 · beat 6 · measure 10 ·
 * arc 16 · theme 18), the numbers the seed's own worked firings write. A number and a rank that disagree refuse by name.
 *
 * Absent, a door's own default stands: a carrier's `#/takes` may seat a `default/` on its aperture row (the bare door reads
 * `beat`); a read with none keeps its gradient (fat within a page, its card past it).
 *
 * A LEAF: pure; `modules/call.ts` reads the bound value and the seats turn the rank into their reactor's args.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/affordance
 */

export const APERTURE_RANKS = ["pulse", "beat", "measure", "arc", "theme"] as const;
export type ApertureRank = typeof APERTURE_RANKS[number];

/** Each rank's band on the 0–20 scale and the number a rank word alone seats. */
export const APERTURE_BANDS: Readonly<Record<ApertureRank, { readonly low: number; readonly high: number; readonly seat: number; readonly reads: string }>> = Object.freeze({
  pulse: { low: 0, high: 4, seat: 2, reads: "one has line" },
  beat: { low: 5, high: 8, seat: 6, reads: "the tagline" },
  measure: { low: 9, high: 12, seat: 10, reads: "the card: each slot's first line" },
  arc: { low: 13, high: 16, seat: 16, reads: "the whole record" },
  theme: { low: 17, high: 20, seat: 18, reads: "the record and its family" },
});

/** A read aperture: the number and rank it resolved to, and the value as asked. */
export interface Aperture { readonly asked: string; readonly n: number; readonly rank: ApertureRank }

/** An aperture no band reads. */
export interface ApertureFault { readonly reason: "aperture-malformed"; readonly message: string; readonly cure: string | null }

export const isApertureFault = (read: Aperture | ApertureFault): read is ApertureFault => "reason" in read;

const isRank = (word: string): word is ApertureRank => (APERTURE_RANKS as readonly string[]).includes(word);

/** The rank whose band holds a number on the 0–20 scale. */
export function rankOf(n: number): ApertureRank | null {
  return APERTURE_RANKS.find((r) => n >= APERTURE_BANDS[r].low && n <= APERTURE_BANDS[r].high) ?? null;
}

/** The set panel's spelling of an aperture (`10/measure`). */
export const apertureWords = (a: Pick<Aperture, "n" | "rank">): string => `${a.n}/${a.rank}`;

const TABLE = APERTURE_RANKS.map((r) => `${r} ${APERTURE_BANDS[r].low}–${APERTURE_BANDS[r].high}`).join(" · ");

/** READ AN `aperture` VALUE: `N/rank`, the rank word alone, or the number alone. */
export function readAperture(raw: unknown): Aperture | ApertureFault {
  const asked = (typeof raw === "string" ? raw : raw === undefined || raw === null || raw === true ? "" : String(raw)).trim();
  const lower = asked.toLowerCase();
  const fault = (message: string, cure: string | null = null): ApertureFault => ({ reason: "aperture-malformed", message, cure });
  if (lower === "") return fault(`aperture names a range as N/rank, the rank or the number: ${TABLE}`);
  const m = /^(?:(\d{1,2})(?:\/([a-z]+))?|([a-z]+))$/.exec(lower);
  if (m === null) return fault(`aperture reads N/rank (10/measure), a rank or a number; "${asked}" reads none of them (${TABLE})`);
  const word = m[2] ?? m[3];
  if (m[1] === undefined) {
    if (word === undefined || !isRank(word)) return fault(`aperture reads no rank in "${asked}"; the ranks: ${TABLE}`);
    return { asked, n: APERTURE_BANDS[word].seat, rank: word };
  }
  const n = Number(m[1]);
  const rank = rankOf(n);
  if (rank === null) return fault(`aperture runs 0–20; ${n} stands outside every band (${TABLE})`);
  if (word !== undefined && word !== rank) {
    if (!isRank(word)) return fault(`aperture reads no rank in "${asked}"; the ranks: ${TABLE}`);
    return fault(`aperture ${n} stands in ${rank}, never ${word} (${word} runs ${APERTURE_BANDS[word].low}–${APERTURE_BANDS[word].high})`, apertureWords({ n, rank }));
  }
  return { asked, n, rank };
}

/** True where a rank reaches the whole record or past it (arc, theme). */
export const reachesWhole = (rank: ApertureRank): boolean => rank === "arc" || rank === "theme";

/**
 * THE READ DOOR'S RANGE (`engine.record.reads`): pulse, beat and measure answer the card (a meme's has-stack, a record's has
 * line with its text left home; beside a slot, that slot's own card); arc and theme the whole (a meme's carrier paged on slot
 * boundaries; beside a slot, that one span). The family theme names stays owed to the carrier's later landing, so theme reads
 * the whole today, and says so on its cell.
 */
export function readRangeArgs(rank: ApertureRank, slotted: boolean): Record<string, unknown> {
  if (!reachesWhole(rank)) return slotted ? { grain: "skinny" } : { meme: true, grain: "skinny" };
  // Beside a slot the meme lens answers that span by itself (its `slot` grain); the whole grain would read past it.
  return slotted ? { meme: true } : { meme: true, grain: "whole" };
}

/** THE FILTER DOOR'S RANGE (`engine.filter.pages`): measure a page of has lines (`card`), arc and theme rows carrying their text or lines (`whole`). */
export function filterRangeArgs(rank: ApertureRank): Record<string, unknown> {
  if (rank === "measure") return { depth: "card" };
  if (reachesWhole(rank)) return { depth: "whole" };
  return {};
}
