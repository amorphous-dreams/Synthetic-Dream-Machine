/**
 * PLANE LABELS — the ONE constant every plane, slot and floor name in the code derives from.
 *
 * An `@` after whitespace triggers a file import in the house's own harness (the kupono cut, Cut 2), so
 * the plane names drop it: `daemon-plane`, `oracle-floor`, `personal-slot`, bare `lares`. The memes name
 * the same planes, so a code literal left behind a text rename would desync docs from code. Every label
 * the code prints, keys a diagnostic by or asserts reads this table; `tests/plane-labels.test.ts` reds
 * on a spaced `@name` literal in the sources that print one.
 *
 * These are LABELS — diagnostics, log lines, error text. The wire keys a face's founding log writes
 * (`persona`, `identities`, `circles`, `sessions`, `intents`: keyhive `ceremony-core.ts`) and the bag
 * ids (`bagUri("daemon")`) are their own identifiers and never read this table.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/grammar-watch
 */
export const PLANE_LABELS = {
  daemon:     "daemon-plane",
  crossroads: "crossroads-plane",
  catalog:    "catalog-plane",
  persona:    "persona-plane",
  circles:    "circles-plane",
  identities: "identities-plane",
  sessions:   "sessions-plane",
  intents:    "intents-plane",
  oracle:     "oracle-floor",
  personal:   "personal-slot",
  working:    "working-slot",
  draft:      "draft-slot",
  temp:       "temp-slot",
  lares:      "lares",
  lararium:   "lararium",
} as const;

export type PlaneName = keyof typeof PLANE_LABELS;

/** A plane's label, or a per-tag plane's (`circles-plane-<tag>`, `intents-plane-<tag>`). */
export function planeLabelOf(name: PlaneName, tag?: string): string {
  return tag ? `${PLANE_LABELS[name]}-${tag}` : PLANE_LABELS[name];
}
