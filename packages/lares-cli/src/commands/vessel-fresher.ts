/**
 * `lares vessel fresher --bag <slug|uri>` — each working copy that shadows a canon record fresher than the one it forked
 * from, with the copy's base hash beside the canon hash standing now. It reads alone, over the daemon's `fresher-canon`
 * verb a page at a time; a person who wants the fresher canon removes the copy with the ordinary verbs.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/founding-runbook
 */
import { bagUri } from "@lararium/mesh";

/** One row the daemon's `fresher-canon` read answers. */
export interface FresherRow {
  readonly title: string;
  readonly base: string | null;
  readonly canonHash: string | null;
}

/** One page of the read: its rows and the cursor behind it. */
export type FresherAsk = (args: { readonly bag: string; readonly after?: string }) => Promise<
  { readonly ok: true; readonly fresher: readonly FresherRow[]; readonly next: string | null } | { readonly ok: false; readonly why: string }
>;

/** The canon bag a person names, by slug or by its `lar:` URI. */
export function fresherBagOf(named: string): string {
  const n = named.trim();
  return n.startsWith("lar:///") ? n : bagUri(n);
}

/** Every page of the read, in title order. A refusal answers by name and lists nothing. */
export async function readFresher(bag: string, ask: FresherAsk): Promise<{ readonly ok: true; readonly rows: readonly FresherRow[] } | { readonly ok: false; readonly why: string }> {
  const rows: FresherRow[] = [];
  let after: string | undefined;
  for (;;) {
    const page = await ask({ bag, ...(after !== undefined ? { after } : {}) });
    if (!page.ok) return page;
    rows.push(...page.fresher);
    if (page.next === null || page.next === after) return { ok: true, rows };
    after = page.next;
  }
}

/** One line per copy: the title, the base it forked from and the canon standing now. */
export function fresherLines(bag: string, rows: readonly FresherRow[]): string[] {
  if (rows.length === 0) return [`fresher: no working copy over ${bag} shadows a fresher canon record`];
  const short = (h: string | null): string => (h === null ? "(none)" : h.length > 23 ? `${h.slice(0, 23)}…` : h);
  return [
    `fresher: ${rows.length} working cop${rows.length === 1 ? "y" : "ies"} over ${bag} shadow a fresher canon record (base -> canon now):`,
    ...rows.map((r) => `  ${r.title}  ${short(r.base)} -> ${short(r.canonHash)}`),
  ];
}
