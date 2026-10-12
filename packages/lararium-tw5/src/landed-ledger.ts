import { ENVELOPE_FIELDS } from "./envelope-fields.js";

export interface LandedEntry {
  /** Explicit null means the last wave left no tiddler at this title. */
  readonly tiddler: unknown | null;
  readonly bag?: string;
  readonly heads?: readonly string[];
}

/** Volatile per-title account of the value each wave left in one wiki. */
export class LandedLedger {
  private readonly entries = new Map<string, LandedEntry>();

  landedOf(title: string): LandedEntry | undefined { return this.entries.get(title); }

  set(title: string, entry: LandedEntry): void { this.entries.set(title, entry); }
  delete(title: string): void { this.entries.delete(title); }
  clear(): void { this.entries.clear(); }
}

/** TiddlyWiki equality over persisted fields, ignoring only its host provenance stamp. */
export function same(a: unknown | null | undefined, b: unknown | null | undefined): boolean {
  if (a == null || b == null) return a == null && b == null;
  if (a === b) return true;
  const equal = (a as { isEqual?: (other: unknown, exclude?: string[]) => boolean }).isEqual;
  return typeof equal === "function" && equal.call(a, b, [...ENVELOPE_FIELDS]);
}

export function sameWithStamp(a: unknown | null | undefined, b: unknown | null | undefined): boolean {
  if (!same(a, b)) return false;
  if (a == null || b == null) return true;
  const fields = (value: unknown): Record<string, unknown> =>
    (value as { fields?: Record<string, unknown> }).fields ?? {};
  return fields(a)["$origin-bag"] === fields(b)["$origin-bag"];
}
