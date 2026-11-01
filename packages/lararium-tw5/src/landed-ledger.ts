import { ENVELOPE_FIELDS } from "./envelope-fields.js";

export interface LandedEntry {
  /** Explicit null means the last wave left no tiddler at this title. */
  readonly tiddler: unknown | null;
  readonly bag?: string;
  readonly heads?: readonly string[];
}

/** A title that never landed: the deadline settled first, or the ledger cleared under the waiter. */
export class LandedNeverError extends Error {
  override readonly name = "LandedNeverError";
  constructor(readonly title: string, readonly why: "deadline" | "cleared") {
    super(`title never landed: ${title} (${why})`);
  }
}

interface Waiter {
  readonly title: string;
  readonly holds: (entry: LandedEntry) => boolean;
  readonly resolve: (entry: LandedEntry) => void;
  readonly reject: (error: LandedNeverError) => void;
}

/** Volatile per-title account of the value each wave left in one wiki. */
export class LandedLedger {
  private readonly entries = new Map<string, LandedEntry>();
  private waiters = new Set<Waiter>();

  landedOf(title: string): LandedEntry | undefined { return this.entries.get(title); }

  /**
   * The landing as an event: resolves with the first entry for `title` that satisfies `holds`, now or at a later
   * `set`. `until` carries the caller's deadline (a promise, so the clock stays injected): when it settles first,
   * the waiter refuses with {@link LandedNeverError} naming the title. `clear()` refuses every pending waiter too.
   */
  whenLanded(title: string, holds: (entry: LandedEntry) => boolean = () => true, until?: Promise<unknown>): Promise<LandedEntry> {
    const standing = this.entries.get(title);
    if (standing !== undefined && holds(standing)) return Promise.resolve(standing);
    return new Promise<LandedEntry>((resolve, reject) => {
      const waiter: Waiter = {
        title, holds,
        resolve: (entry) => { this.waiters.delete(waiter); resolve(entry); },
        reject: (error) => { this.waiters.delete(waiter); reject(error); },
      };
      this.waiters.add(waiter);
      if (until !== undefined) void until.then(() => waiter.reject(new LandedNeverError(title, "deadline")), () => waiter.reject(new LandedNeverError(title, "deadline")));
    });
  }

  set(title: string, entry: LandedEntry): void {
    this.entries.set(title, entry);
    for (const waiter of [...this.waiters]) if (waiter.title === title && waiter.holds(entry)) waiter.resolve(entry);
  }
  delete(title: string): void { this.entries.delete(title); }
  clear(): void {
    this.entries.clear();
    for (const waiter of [...this.waiters]) waiter.reject(new LandedNeverError(waiter.title, "cleared"));
  }
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
