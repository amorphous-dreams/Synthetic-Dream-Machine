/**
 * The draft book: what the shore knows of each draft between the draft's first keystroke and the
 * acknowledgment of its deletion.
 *
 * A draft is an ordinary tiddler carrying `draft.of`; the book reads from it only the two facts a save
 * needs, the target the draft stands for and the base a save builds on. The base is the target's bag and
 * heads at the moment the draft opened. It persists on the draft's own record as two ordinary fields, so
 * it follows the draft across devices and survives the draft's absence from the wiki inside the dispatch
 * that deletes it.
 *
 *   `lar-draft-base-bag`    the bag the target lived in (or would land in) when the draft opened
 *   `lar-draft-base-heads`  that bag's heads for the target, space-joined; a target that was absent
 *                           reads `absent` followed by the bag's heads at that moment
 *
 * Neither field persists on a record that carries no `draft.of`, and neither is ever held by the wiki tiddler.
 */

export const DRAFT_BASE_BAG = "lar-draft-base-bag";
export const DRAFT_BASE_HEADS = "lar-draft-base-heads";
const ABSENT = "absent";

/** The base a draft carries: where its target lived, at which heads, and whether it stood at all. */
export interface DraftBase {
  readonly baseBag?: string;
  readonly baseHeads: readonly string[];
  readonly absent: boolean;
}

export interface DraftEntry extends DraftBase {
  /** The target the draft stands for. */
  readonly of: string;
  /** The title the person wants the target saved under (empty = none yet). */
  readonly title: string;
  /** The bag the draft's own record lives in. */
  readonly bag?: string;
}

/** The base carried by a draft's persisted fields, or undefined when it carries none. */
export function readDraftBase(fields: Readonly<Record<string, unknown>>): DraftBase | undefined {
  const bag = String(fields[DRAFT_BASE_BAG] ?? "");
  const heads = String(fields[DRAFT_BASE_HEADS] ?? "");
  if (!bag || !heads) return undefined;
  const tokens = heads.split(" ").filter(Boolean);
  const absent = tokens[0] === ABSENT;
  return { baseBag: bag, baseHeads: absent ? tokens.slice(1) : tokens, absent };
}

/** The two persisted fields that carry an entry's base. */
export function draftBaseFields(base: DraftBase): Record<string, string> {
  if (!base.baseBag) return {};
  const heads = base.absent ? [ABSENT, ...base.baseHeads] : base.baseHeads;
  return { [DRAFT_BASE_BAG]: base.baseBag, [DRAFT_BASE_HEADS]: heads.join(" ") };
}

/** A copy of `fields` without the draft-base fields. */
export function withoutDraftBase<T extends Record<string, unknown>>(fields: T): T {
  const { [DRAFT_BASE_BAG]: _bag, [DRAFT_BASE_HEADS]: _heads, ...rest } = fields;
  return rest as T;
}

/** True when two head sets name the same heads. */
export function sameHeads(a: readonly string[] | undefined, b: readonly string[] | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return a.length === b.length && a.every((head, index) => head === b[index]);
}

/**
 * The content of a record as the wiki sees it: its tiddler fields and whether it reads live or deleted.
 * `meta` ceremony keys never take part. Two records with the same key hold the same content.
 */
export function contentKey(record: { tiddler?: Record<string, unknown>; meta?: { deleted?: unknown } } | null | undefined): string {
  if (!record) return "absent";
  if (record.meta?.deleted) return "deleted";
  const tiddler = record.tiddler ?? {};
  return JSON.stringify(Object.keys(tiddler).sort().map((key) => [key, tiddler[key]]));
}
