/**
 * seat-startup-offer — the one wall a seat keeps (state/decisions, "Native TW5 wikis, and the one wall a seat keeps"; "Five floors
 * walked" (2)).
 *
 * Each live wiki behaves as a native TiddlyWiki: a record lands whatever it carries, and a module, script or plugin record reads as
 * data on the server-side island (its code comes from the floor-admitted preloads alone). An EXECUTABLE record (the mesh's one list,
 * `executable-class.ts`: a module, plugin or script type, a startup action, a global macro or procedure, a view template, and every
 * system tag the list leaves unnamed) runs in the tab, so one the AI seat lands would run in the operator's browser. A seat-asked
 * write of such a record therefore OFFERS and never lands, unless an executable-record lei the face strung stands for it: every
 * write door (the tiddler door, `meme put`, INGEST) calls `admitSeatExecutable` over each record it would land, before its first
 * write. Under a standing lei the vessel's port spends one return (`spendExecLei`) and the record lands; with none, or past its
 * returns, or outside its scope, the refusal names the lei's own reading and the operator's own hand. Every other asker (the
 * operator's CLI, the tab, a door that read no asker) lands natively. A plain `$:/config`, `$:/state` or `$:/temp` record lands for
 * a seat too: the fields decide, never the title.
 */
import { VerbRefusal } from "./verb-refusal.js";
import type { Hand } from "./session-contract.js";
import { executableClassOf } from "./executable-class.js";
import { SwarmRefused } from "./swarm-tiddlers.js";

/** The refusal reason a write door raises for an AI seat's executable record. */
export const SEAT_STARTUP_OFFER_REASON = "seat-startup-offer" as const;

/**
 * The vessel's exec-lei port, bound to its daemon wiki, its trust and its own signer (`spendExecLei` behind it). A door names the
 * wiki it lands in, the record, and the writer it read (`seat` for an AI seat's ask); a tab booting a wiki names no writer, since
 * a synced record carries none the vessel verified. It answers the spent return, or throws the lei grammar's refusal
 * (`SwarmRefused`): absent, spent, out of scope.
 */
export interface ExecLeiPort {
  spend(land: { readonly wiki: string; readonly title: string; readonly fields: Readonly<Record<string, unknown>>; readonly writer?: string }): Promise<{ readonly lei: string; readonly n: number }>;
}

/**
 * Admits or offers one record a door would land. Returns null for a record no wall reaches (another asker, a data record), the
 * spent return where a standing exec lei admits a seat's executable record, and throws a `VerbRefusal` (reason
 * `seat-startup-offer`) otherwise. `act` names the door; nothing lands where it throws.
 */
export async function admitSeatExecutable(title: string, fields: Readonly<Record<string, unknown>>, act: string, asker: Hand | undefined,
  at: { readonly wiki: string; readonly port?: ExecLeiPort | undefined }): Promise<{ readonly lei: string; readonly n: number } | null> {
  if (asker !== "seat") return null;
  const cls = executableClassOf(fields);
  if (cls === null) return null;
  let lei = "no exec lei port stands on this vessel";
  if (at.port) {
    try { return await at.port.spend({ wiki: at.wiki, title, fields, writer: "seat" }); }
    catch (error) { if (!(error instanceof SwarmRefused)) throw error; lei = error.message; }
  }
  throw new VerbRefusal(SEAT_STARTUP_OFFER_REASON,
    `${SEAT_STARTUP_OFFER_REASON}: ${act} of "${title}" refused — it reads executable (${cls.class}, ${cls.mark}), and a wiki's executable record runs in the operator's tab, so the AI seat offers it and never lands it (the lei reads: ${lei}); land the record without that field or tag (it lands as data), and the executable form rides the operator's own hand (in the tab, or from the operator's own terminal), or an exec lei the face strings for this seat.`);
}
