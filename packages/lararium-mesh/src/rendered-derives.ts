/**
 * rendered-derives — the rendered tiddler's names and its one wall (backlog-awakens, "The rendered tiddler").
 *
 * A tiddler marked `projection: rendered` derives a live tiddler of its own: the island renders the source (list resolved,
 * transclusions filled) and the render stands as a record of its `render-type`, carrying `rendered-from: <source title>`.
 * ONLY THE RENDERER WRITES IT: every other write door (the tiddler door, `meme put`, INGEST, and so the watcher's
 * read-back, whose waves ride INGEST) calls `renderedWriteFault` over each record it would land, and refuses
 * `rendered-derives` where the title already stands as a render or the record would land carrying `rendered-from`. The
 * cure names the sources: edit them, and the render follows.
 */
import { VerbRefusal } from "./verb-refusal.js";

/** The field a rendered tiddler carries, naming the source it derives from. */
export const RENDERED_FROM_FIELD = "rendered-from" as const;
/** The field that marks a source for rendering, and the one value that does. */
export const PROJECTION_FIELD = "projection" as const;
export const PROJECTION_RENDERED = "rendered" as const;
/** The refusal reason every write door raises over a rendered tiddler. */
export const RENDERED_DERIVES_REASON = "rendered-derives" as const;

/** The source a record's fields name as `rendered-from`, or null where it carries none. */
export function renderedFromOf(fields: Readonly<Record<string, unknown>> | null | undefined): string | null {
  const from = fields?.[RENDERED_FROM_FIELD];
  return typeof from === "string" && from !== "" ? from : null;
}

/**
 * The refusal text for a write door's write over a rendered tiddler, or null where the write may land. `standing` reads
 * the record the title holds now (null: none), `incoming` the record the write would land.
 */
export function renderedWriteFault(
  title: string, standing: Readonly<Record<string, unknown>> | null | undefined, incoming: Readonly<Record<string, unknown>> | null | undefined, act: string,
): string | null {
  const source = renderedFromOf(standing) ?? renderedFromOf(incoming);
  if (source === null) return null;
  return `${RENDERED_DERIVES_REASON}: ${act} of "${title}" refused — it stands as the render of "${source}", and only the renderer writes a rendered tiddler; edit the source tiddlers (the source and what its render reaches), and the render follows.`;
}

/** Throws a `VerbRefusal` (reason `rendered-derives`) where `renderedWriteFault` names a fault; returns otherwise. */
export function refuseRenderedWrite(
  title: string, standing: Readonly<Record<string, unknown>> | null | undefined, incoming: Readonly<Record<string, unknown>> | null | undefined, act: string,
): void {
  const fault = renderedWriteFault(title, standing, incoming, act);
  if (fault !== null) throw new VerbRefusal(RENDERED_DERIVES_REASON, fault);
}
