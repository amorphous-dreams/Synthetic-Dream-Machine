/**
 * seat-startup-offer — the one wall a seat keeps (state/decisions, "Native TW5 wikis, and the one wall a seat keeps"; "Five floors
 * walked" (2)).
 *
 * Each live wiki behaves as a native TiddlyWiki: a record lands whatever it carries, and a module, script or plugin record reads as
 * data on the server-side island (its code comes from the floor-admitted preloads alone). An EXECUTABLE record (the mesh's one list,
 * `executable-class.ts`: a module, plugin or script type, a startup action, a global macro or procedure, a view template, and every
 * system tag the list leaves unnamed) runs in the tab, so one the AI seat lands would run in the operator's browser. A seat-asked
 * write of such a record therefore OFFERS and never lands: every write door (the tiddler door, `meme put`, INGEST) calls
 * `refuseSeatExecutable` over each record it would land, and the refusal names the operator's own hand. Every other asker (the
 * operator's CLI, the tab, a door that read no asker) lands natively. A plain `$:/config`, `$:/state` or `$:/temp` record lands for
 * a seat too: the fields decide, never the title.
 */
import { VerbRefusal } from "./verb-refusal.js";
import type { Hand } from "./session-contract.js";
import { executableClassOf } from "./executable-class.js";

/** The refusal reason a write door raises for an AI seat's executable record. */
export const SEAT_STARTUP_OFFER_REASON = "seat-startup-offer" as const;

/**
 * Throws a `VerbRefusal` (reason `seat-startup-offer`) where the asker reads `seat` and the record reads executable; returns
 * otherwise. `act` names the door; nothing lands where it throws, so a door calls it before its first write.
 */
export function refuseSeatExecutable(title: string, fields: Readonly<Record<string, unknown>>, act: string, asker: Hand | undefined): void {
  if (asker !== "seat") return;
  const cls = executableClassOf(fields);
  if (cls === null) return;
  throw new VerbRefusal(SEAT_STARTUP_OFFER_REASON,
    `${SEAT_STARTUP_OFFER_REASON}: ${act} of "${title}" refused — it reads executable (${cls.class}, ${cls.mark}), and a wiki's executable record runs in the operator's tab, so the AI seat offers it and never lands it; land the record without that field or tag (it lands as data), and the executable form rides the operator's own hand (in the tab, or from the operator's own terminal), or a lei the face strung for this seat.`);
}
