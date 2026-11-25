/**
 * `lares vessel fresher --bag <slug|uri>` — each working copy that shadows a canon record fresher than the one it forked
 * from, with the copy's base hash beside the canon hash standing now; then each copy that names no base and differs from
 * canon (base unknown), for review. It reads alone, over the daemon's `fresher-canon`
 * verb a page at a time; a person who wants the fresher canon removes the copy with the ordinary verbs.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/founding-runbook
 */
import { bagUri } from "@lararium/mesh/lar-uris";

/** One row the daemon's `fresher-canon` read answers. */
export interface FresherRow {
  readonly title: string;
  readonly base: string | null;
  readonly canonHash: string | null;
}

/** The read's two classes: canon fresher than a copy's base, and copies that name no base yet differ from canon. */
export type FresherClass = "fresher" | "base-unknown";

/** One page of the read: its rows and the cursor behind it. */
export type FresherAsk = (args: { readonly bag: string; readonly after?: string; readonly class?: "base-unknown" }) => Promise<
  { readonly ok: true; readonly fresher: readonly FresherRow[]; readonly next: string | null } | { readonly ok: false; readonly why: string }
>;

/** The canon bag a person names, by slug or by its `lar:` URI. */
export function fresherBagOf(named: string): string {
  const n = named.trim();
  return n.startsWith("lar:///") ? n : bagUri(n);
}

/** Every page of one class of the read, in title order. A refusal answers by name and lists nothing. */
export async function readFresher(bag: string, ask: FresherAsk, cls: FresherClass = "fresher"): Promise<{ readonly ok: true; readonly rows: readonly FresherRow[] } | { readonly ok: false; readonly why: string }> {
  const rows: FresherRow[] = [];
  let after: string | undefined;
  for (;;) {
    const page = await ask({ bag, ...(after !== undefined ? { after } : {}), ...(cls === "base-unknown" ? { class: cls } : {}) });
    if (!page.ok) return page;
    rows.push(...page.fresher);
    if (page.next === null || page.next === after) return { ok: true, rows };
    after = page.next;
  }
}

/**
 * One line per copy: the title, the base it forked from and the canon standing now. The second class follows in its own
 * section, where any copy stands in it: each copy that names no base and differs from canon, `  <title>  base unknown ->
 * <canon>`, a review list of copies that may hide fresher canon (a working row that travelled without its base leaves these).
 */
export function fresherLines(bag: string, rows: readonly FresherRow[], unknown: readonly FresherRow[] = []): string[] {
  const short = (h: string | null): string => (h === null ? "(none)" : h.length > 23 ? `${h.slice(0, 23)}…` : h);
  const out = rows.length === 0 ? [`fresher: no working copy over ${bag} shadows a fresher canon record`] : [
    `fresher: ${rows.length} working cop${rows.length === 1 ? "y" : "ies"} over ${bag} shadow a fresher canon record (base -> canon now):`,
    ...rows.map((r) => `  ${r.title}  ${short(r.base)} -> ${short(r.canonHash)}`),
  ];
  if (unknown.length === 0) return out;
  const one = unknown.length === 1;
  return [
    ...out,
    `fresher: ${unknown.length} working cop${one ? "y" : "ies"} over ${bag} name${one ? "s" : ""} no base and differ${one ? "s" : ""} from canon (base unknown; review each, it may hide fresher canon):`,
    ...unknown.map((r) => `  ${r.title}  base unknown -> ${short(r.canonHash)}`),
  ];
}
