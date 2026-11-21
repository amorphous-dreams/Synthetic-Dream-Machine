/**
 * retired-shell-record — THE RECORD OF A SHELL'S LEAVING, where a retired wiki shell's effect records stay.
 *
 * Canon calls a residency effect record indelible (`effect-record.ts`, residency-model#/effect-record-surface): the artifact may leave;
 * the record of its prior presence here, and of its leaving, never does. A wiki shell's layers hold such records (a gated
 * ingest's residency row), and `retire-wiki` erases the shell's layer documents. So before a retire erases one, it CARRIES the
 * shell's effect records out, verbatim, into ONE retirement record per slug in the worn face's daemon wiki working layer: the
 * face owns that layer (one owner per registry), it mirrors to the face's root under `projections/` (a re-found clears only the
 * hearth), and the keep bundle carries it with the rest of the face's daemon working rows. The shell goes; the record stays.
 *
 * ONE RECORD PER SLUG, a union. A later retire of the same slug (a re-minted shell retired again) adds its records to the same
 * row and appends its own outcome; a re-run that carries nothing new writes nothing (idempotent). A carried title that already
 * stands under other fields refuses: an effect record's event id names one event, so two bodies under one title name a fault,
 * never a merge.
 *
 * The record's title rests outside every residency ledger (`isEffectRecordUri` reads it false), so it projects as a face's
 * memory row does; its text holds the carried records as JSON, each with the layer it left and its fields exactly as stored.
 *
 * Meme: lar:///ha.ka.ba/lararium/api/residency-model#/effect-record-surface
 */
import type { LarTiddlerRecord } from "./tiddler-store.js";

/** `lar:///ha.ka.ba/lararium/retired-shells/` — where the record of each retired shell's leaving rests. */
export const RETIRED_SHELL_URI_PREFIX = "lar:///ha.ka.ba/lararium/retired-shells/";

/** `lar:///ha.ka.ba/lararium/retired-shells/<slug>` — one retirement record per wiki slug. */
export function retiredShellUri(slug: string): string {
  return `${RETIRED_SHELL_URI_PREFIX}${encodeURIComponent(slug)}`;
}

/** One effect record a retire carried out: the layer it left, its title, and its fields exactly as the layer stored them. */
export interface CarriedEffectRecord {
  readonly layer: "working" | "draft" | "personal";
  readonly title: string;
  readonly fields: Readonly<Record<string, string>>;
}

/** What one retire said of itself when it carried: who retired, which realm, the counts it read, and the titles it carried. */
export interface RetireOutcome {
  readonly face: string;
  readonly realmId: string | null;
  readonly forced: boolean;
  readonly authored: number;
  readonly carried: readonly string[];
  readonly at: string;
}

/** The retirement record's body. */
export interface RetiredShellBody {
  readonly slug: string;
  readonly records: readonly CarriedEffectRecord[];
  readonly retires: readonly RetireOutcome[];
}

/** The refusal a carry names: the code leads the message. */
export class RetiredShellCarryRefusal extends Error {
  override readonly name = "RetiredShellCarryRefusal";
  constructor(readonly code: "retire-carry-unlanded", detail: string) {
    super(`${code}: ${detail}`);
  }
}

const LAYERS = new Set(["working", "draft", "personal"]);
const sameFields = (a: Readonly<Record<string, string>>, b: Readonly<Record<string, string>>): boolean => {
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => Object.hasOwn(b, k) && a[k] === b[k]);
};
const byTitle = (a: CarriedEffectRecord, b: CarriedEffectRecord): number => (a.title < b.title ? -1 : a.title > b.title ? 1 : 0);

/** An effect record's fields as the carry keeps them: every field a string, exactly as stored. */
export function carriedFields(fields: Readonly<Record<string, unknown>>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) out[k] = typeof v === "string" ? v : String(v);
  return out;
}

/** Parse a stored retirement record back to its body, or null where the row reads as no retirement record of `slug`. */
export function parseRetiredShellRecord(slug: string, record: LarTiddlerRecord | null | undefined): RetiredShellBody | null {
  const t = record?.tiddler as Record<string, unknown> | undefined;
  if (!t || t["title"] !== retiredShellUri(slug) || typeof t["text"] !== "string") return null;
  let body: unknown;
  try { body = JSON.parse(t["text"]); } catch { return null; }
  const b = body as Partial<RetiredShellBody>;
  if (!b || b.slug !== slug || !Array.isArray(b.records) || !Array.isArray(b.retires)) return null;
  for (const r of b.records) {
    if (!r || typeof r.title !== "string" || !LAYERS.has(r.layer) || typeof r.fields !== "object" || r.fields === null) return null;
    if (Object.values(r.fields).some((v) => typeof v !== "string")) return null;
  }
  return { slug, records: b.records, retires: b.retires };
}

/**
 * The union a carry writes: the standing body (or none) with `incoming` added and `outcome` appended. Answers `null` where every
 * incoming record already stands under the same fields (nothing to write). A title that stands under other fields throws.
 */
export function unionRetiredShell(slug: string, standing: RetiredShellBody | null, incoming: readonly CarriedEffectRecord[], outcome: RetireOutcome): RetiredShellBody | null {
  const held = new Map((standing?.records ?? []).map((r) => [r.title, r] as const));
  const added: CarriedEffectRecord[] = [];
  for (const r of incoming) {
    const prior = held.get(r.title);
    if (prior === undefined) { added.push(r); held.set(r.title, r); continue; }
    if (!sameFields(prior.fields, r.fields)) {
      throw new RetiredShellCarryRefusal("retire-carry-unlanded", `"${r.title}" already stands in ${retiredShellUri(slug)} under other fields; one event id names one event, so nothing carries and nothing retires`);
    }
  }
  if (added.length === 0 && standing !== null) return null;
  return { slug, records: [...held.values()].sort(byTitle), retires: [...(standing?.retires ?? []), outcome] };
}

/** The record a carry writes for `body`. */
export function buildRetiredShellRecord(body: RetiredShellBody): LarTiddlerRecord {
  return {
    tiddler: {
      title: retiredShellUri(body.slug),
      type: "application/json",
      "retired-wiki": body.slug,
      "effect-records": String(body.records.length),
      text: JSON.stringify(body, null, 2),
    },
    meta: { authority: "lares-retire-wiki" },
  };
}

/** Whether `body` holds every one of `records` under the very fields carried. */
export function holdsEvery(body: RetiredShellBody | null, records: readonly CarriedEffectRecord[]): boolean {
  if (!body) return records.length === 0;
  const held = new Map(body.records.map((r) => [r.title, r] as const));
  return records.every((r) => { const h = held.get(r.title); return h !== undefined && h.layer === r.layer && sameFields(h.fields, r.fields); });
}
