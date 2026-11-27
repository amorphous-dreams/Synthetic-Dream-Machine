/**
 * rendered-derives — the rendered tiddler's names and its one wall (backlog-awakens, "The rendered tiddler").
 *
 * A tiddler marked `projection: rendered` derives a live tiddler of its own: the island renders the source (list resolved,
 * transclusions filled) and the render stands as a record of its `render-type`, carrying `rendered-from: <source title>`.
 * ONLY THE RENDERER WRITES IT. A hand's direct door (the tiddler door, over a wiki or a bag) calls `renderedWriteFault` over each
 * record it would land, and refuses `rendered-derives` where the title already stands as a render or the record would land
 * carrying `rendered-from`. The cure names the sources: edit them, and the render follows.
 *
 * A WAVE (INGEST, and so the watcher's read-back and the lay) lands no render either, and answers each render carrier
 * `derived` on a gradient, one answer per disk state whatever the house's age or the wave's order (`RenderedRung`): the
 * projector's echo reads the gate's `noop` ahead of every rung; a render whose source stands in the house or arrives in
 * the same wave waits for the renderer, quiet; a hand edit to a standing render names the cure; a render whose source
 * stands nowhere waits visible for it. The last two warn, and raise one alert per (rung, render title).
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

/**
 * The rung a wave's render carrier stands on, each answered `derived` and landing nothing:
 *   · `source-stands` — no render stands, and its source stands in the house or arrives in the same wave: the renderer
 *     stands the render once the source lands (quiet);
 *   · `hand-edit` — the file differs from the render that stands: the edit belongs on the source;
 *   · `awaits-source` — its source stands nowhere, house nor wave: the render waits visible for it.
 */
export type RenderedRung = "source-stands" | "hand-edit" | "awaits-source";

/** The alert kind each warning rung raises; `source-stands` raises none. */
export const RENDERED_ALERT_KIND = {
  "hand-edit":     "rendered-hand-edit",
  "awaits-source": "rendered-awaits-source",
} as const satisfies Partial<Record<RenderedRung, string>>;

/** The rung of a render carrier no echo settled: `standing` — a render stands at its title; `sourceStands` — its source
 *  stands in the house or the wave. */
export function renderedRungOf(standing: boolean, sourceStands: boolean): RenderedRung {
  return standing ? "hand-edit" : sourceStands ? "source-stands" : "awaits-source";
}

/** The warning a rung speaks over the render `title` of `source`, or null where it stays quiet. */
export function renderedRungWarning(rung: RenderedRung, title: string, source: string): string | null {
  switch (rung) {
    case "source-stands": return null;
    case "hand-edit":     return `"${title}" stands as the render of "${source}"; this file's edit lands nothing: edit "${source}"; this render follows.`;
    case "awaits-source": return `"${title}" renders "${source}", which stands nowhere in the house or this wave; the render awaits its source "${source}".`;
  }
}
