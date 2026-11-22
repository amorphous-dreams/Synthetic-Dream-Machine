/**
 * shell-leaving-record — THE RECORD OF A SHELL'S LEAVING, where a retired wiki shell's effect records stay.
 *
 * Canon calls a residency effect record indelible (`effect-record.ts`, residency-model#/effect-record-surface): the artifact may leave;
 * the record of its prior presence here, and of its leaving, never does. A wiki shell's layers hold such records (a gated
 * ingest's residency row), and `retire-wiki` erases the shell's layer documents. So before a retire erases one, it CARRIES the
 * shell's effect records out, verbatim, into ONE retirement record per slug in the worn face's daemon wiki working layer: the
 * face owns that layer (one owner per registry), it mirrors to the face's root under `projections/` (a re-found clears only the
 * hearth), and the keep bundle carries it with the rest of the face's daemon working rows. The shell goes; the record stays.
 *
 * ONE RECORD PER SLUG, a union. Every retire that carries appends its own outcome; a record already held under the same
 * fields stays once (a re-run carries no record twice). A carried title that already stands under other fields refuses: an
 * effect record's event id names one event, so two bodies under one title name a fault, never a merge.
 *
 * THE HOUSE'S HAND ALONE. The title rests outside every residency ledger, so the effect-ledger wall names it beside them
 * (`isHouseLedgerUri`, `refuseEffectLedgerWrite`): the tiddler door, the meme door and every hand origin of the composite
 * (a page's save, a tool's draft, a canvas's draft) neither write nor remove it, whoever asks. A row reads as the house's only
 * where the retire's own writer stamped it (`meta.authority` = `lares-retire-wiki`) and its body parses whole.
 *
 * The record's title rests outside every residency ledger (`isEffectRecordUri` reads it false), so it projects as a face's
 * memory row does; its text holds the carried records as JSON, each with the layer it left and its fields exactly as stored.
 * It types itself `text/plain`: a `.json` carrier reads back as tiddlers (the JSON deserializer splits the body), while a plain
 * body and its `.meta` sidecar read back byte for byte. The writer's stamp (`meta.authority`) rides the stored record, never a
 * disk carrier, so a copy re-ingested off disk (a keep's import after a re-found) reads as no retirement record by itself; the
 * next carry for that slug reads its body whole (`unstamped`), keeps every record it holds, and stamps it as it writes.
 *
 * Meme: lar:///ha.ka.ba/lararium/api/residency-model#/effect-record-surface
 */
import type { LarTiddlerRecord } from "./tiddler-store.js";

/** `lar:///ha.ka.ba/lararium/shell-leavings/` — where the record of each retired shell's leaving rests. */
export const RETIRED_SHELL_URI_PREFIX = "lar:///ha.ka.ba/lararium/shell-leavings/";

/** True when `title` names a shell's record of leaving. */
export function isShellLeavingUri(title: string): boolean {
  return title.startsWith(RETIRED_SHELL_URI_PREFIX);
}

/** The writer's stamp a retirement record carries (`meta.authority`); a row without it reads as no retirement record. */
export const RETIRED_SHELL_AUTHORITY = "lares-retire-wiki";

/** `lar:///ha.ka.ba/lararium/shell-leavings/<slug>` — one retirement record per wiki slug. */
export function retiredShellUri(slug: string): string {
  return `${RETIRED_SHELL_URI_PREFIX}${encodeURIComponent(slug)}`;
}

/** One effect record a retire carried out: the layer it left, its title, and its fields exactly as the layer stored them. */
export interface CarriedEffectRecord {
  readonly layer: "working" | "draft" | "personal";
  readonly title: string;
  readonly fields: Readonly<Record<string, string>>;
}

/** What one retire said of itself when it carried: who retired, which realm, whether forced, the authored count it destroyed, and the titles it carried (the carried records keep their own timestamps). */
export interface RetireOutcome {
  readonly face: string;
  readonly realmId: string | null;
  readonly forced: boolean;
  readonly authored: number;
  readonly carried: readonly string[];
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

const isOutcome = (o: unknown): o is RetireOutcome => {
  const r = o as Partial<RetireOutcome> | null;
  return !!r && typeof r === "object" && typeof r.face === "string" && (r.realmId === null || typeof r.realmId === "string")
    && typeof r.forced === "boolean" && typeof r.authored === "number" && Number.isInteger(r.authored) && r.authored >= 0
    && Array.isArray(r.carried) && r.carried.every((t) => typeof t === "string");
};

/** Parse a stored retirement record back to its body, or null where the row reads as no retirement record of `slug`: one the
 *  retire's writer never stamped, or one whose body does not parse whole. `unstamped` reads the body alone (the carry's
 *  reading of a copy the house re-ingested off disk, which it stamps again as it writes). */
export function parseRetiredShellRecord(slug: string, record: LarTiddlerRecord | null | undefined, opts: { readonly unstamped?: boolean } = {}): RetiredShellBody | null {
  const t = record?.tiddler as Record<string, unknown> | undefined;
  if (opts.unstamped !== true && (record?.meta as { authority?: unknown } | undefined)?.authority !== RETIRED_SHELL_AUTHORITY) return null;
  if (!t || t["title"] !== retiredShellUri(slug) || typeof t["text"] !== "string") return null;
  let body: unknown;
  try { body = JSON.parse(t["text"]); } catch { return null; }
  const b = body as Partial<RetiredShellBody>;
  if (!b || b.slug !== slug || !Array.isArray(b.records) || !Array.isArray(b.retires)) return null;
  for (const r of b.records) {
    if (!r || typeof r.title !== "string" || !LAYERS.has(r.layer) || typeof r.fields !== "object" || r.fields === null) return null;
    if (Object.values(r.fields).some((v) => typeof v !== "string")) return null;
  }
  for (const o of b.retires as readonly unknown[]) if (!isOutcome(o)) return null;
  return { slug, records: b.records, retires: b.retires };
}

/**
 * The union a carry writes: the standing body (or none) with `incoming` added (each title once) and `outcome` appended, every
 * time: a real retire always leaves its outcome. A title that stands under other fields throws.
 */
export function unionRetiredShell(slug: string, standing: RetiredShellBody | null, incoming: readonly CarriedEffectRecord[], outcome: RetireOutcome): RetiredShellBody {
  const held = new Map((standing?.records ?? []).map((r) => [r.title, r] as const));
  for (const r of incoming) {
    const prior = held.get(r.title);
    if (prior === undefined) { held.set(r.title, r); continue; }
    if (!sameFields(prior.fields, r.fields)) {
      throw new RetiredShellCarryRefusal("retire-carry-unlanded", `"${r.title}" already stands in ${retiredShellUri(slug)} under other fields; one event id names one event, so nothing carries and nothing retires`);
    }
  }
  return { slug, records: [...held.values()].sort(byTitle), retires: [...(standing?.retires ?? []), outcome] };
}

/** The record a carry writes for `body`. */
export function buildRetiredShellRecord(body: RetiredShellBody): LarTiddlerRecord {
  return {
    tiddler: {
      title: retiredShellUri(body.slug),
      type: "text/plain",
      "retired-wiki": body.slug,
      "effect-records": String(body.records.length),
      text: JSON.stringify(body, null, 2),
    },
    meta: { authority: RETIRED_SHELL_AUTHORITY },
  };
}

/** Whether `body` holds every one of `records` under the very fields carried. */
export function holdsEvery(body: RetiredShellBody | null, records: readonly CarriedEffectRecord[]): boolean {
  if (!body) return records.length === 0;
  const held = new Map(body.records.map((r) => [r.title, r] as const));
  return records.every((r) => { const h = held.get(r.title); return h !== undefined && h.layer === r.layer && sameFields(h.fields, r.fields); });
}
