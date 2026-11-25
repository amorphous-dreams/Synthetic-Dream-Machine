/**
 * ddate-verb — the `ddate` verb every vessel answers: the Discordian date through the house's own calendar core.
 *
 *   args { format?: string, day?: number, month?: number, year?: number, today?: { year, month, day } }
 *   → { text, entropy, gregorian, yold, tibs, season, dayOfSeason, weekday, holyday }
 *
 * THE CLOCK SEAM stays with the caller. A vessel reads no clock for this verb: a caller that names no date names
 * `today` (its own local day), and a call naming neither refuses. `%.` draws through the platform's entropy door
 * (`crypto.getRandomValues`), and the answer's `entropy` names that source when a draw happened.
 */

import { ddateArgv, ddateRecord, readDdate, DDATE_INVALID, DDATE_USAGE, type DdateAsk, type GregorianDate } from "@lararium/mesh/ddate";
import { PLATFORM_ENTROPY } from "@lararium/mesh/entropy-door";

const whole = (v: unknown): number | null => (typeof v === "number" && Number.isInteger(v) ? v : null);

function dayOf(v: unknown): GregorianDate | null {
  if (v === null || typeof v !== "object") return null;
  const { year, month, day } = v as Record<string, unknown>;
  const [y, m, d] = [whole(year), whole(month), whole(day)];
  return y === null || m === null || d === null ? null : { year: y, month: m, day: d };
}

export async function ddateVerb(args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const ask: DdateAsk = {
    format: typeof args["format"] === "string" ? args["format"] : null,
    day: whole(args["day"]), month: whole(args["month"]), year: whole(args["year"]),
  };
  const argv = ddateArgv(ask);
  if (argv === null) throw new Error(`ddate: ${DDATE_USAGE} (name day, month and year together, or none)`);
  const today = dayOf(args["today"]);
  const named = ask.day !== null && ask.day !== undefined;
  if (!named && today === null) throw new Error("ddate: name `today` ({year, month, day}) when no date rides the call; the verb reads no clock");
  const reading = readDdate(argv, today ?? { year: 1, month: 1, day: 1 }, PLATFORM_ENTROPY);
  if (reading.kind === "usage") throw new Error(`ddate: ${DDATE_USAGE}`);
  if (reading.kind === "invalid") throw new Error(`ddate: ${DDATE_INVALID}`);
  return ddateRecord(reading);
}
