/**
 * `lares ddate [+FORMAT] [day month year]` — the Discordian date, computed by the house's own calendar.
 *
 * The same argument shape as the host's `ddate(1)`, answered by the isomorphic core in `@lararium/mesh/ddate`, so a
 * machine with no `ddate` binary (a vessel's container, a bare host) reads the day all the same. This verb runs on
 * the host and needs no vessel, no house root and no key.
 *
 * THE CLOCK SEAM lives here: with no date on the line, the command reads the local calendar day once and hands it to the
 * core; the core reads no clock. `%.` draws one exclamation through the platform's entropy door
 * (`crypto.getRandomValues`). The default answer is the bare line (render.ts `proseFirst`); `--json` answers the envelope and names that source in `data.entropy` when a draw happened.
 */

import { readDdate, ddateRecord, DDATE_INVALID, DDATE_USAGE } from "@lararium/mesh/ddate";
import { PLATFORM_ENTROPY } from "@lararium/mesh/entropy-door";
import { emit, exitFor, proseFirst } from "../render.js";
import { helpLines } from "../command-help.js";
import type { ParsedArgs } from "../parse-args.js";

/** The local calendar day, read once: the caller's side of the clock seam. */
function localToday(): { year: number; month: number; day: number } {
  const here = new Date();
  return { year: here.getFullYear(), month: here.getMonth() + 1, day: here.getDate() };
}

export async function cmdDdate(given: ParsedArgs): Promise<number> {
  // THE DATE ANSWERS A PIPE IN PROSE (render.ts `proseFirst`, the way `tiddler get --meme` answers a carrier): the bare line, like ddate(1); only `--json` asks for the envelope.
  const args = proseFirst(given);
  const reading = readDdate(args.positional, localToday(), PLATFORM_ENTROPY);
  if (reading.kind === "usage") {
    emit(args, {
      ok: false,
      error: { code: "usage", message: DDATE_USAGE },
      human: () => { for (const line of helpLines("ddate")) console.error(line); },
    });
    return exitFor("usage");
  }
  if (reading.kind === "invalid") {
    emit(args, { ok: false, error: { code: "usage", message: DDATE_INVALID }, human: () => console.error(`lares ddate: ${DDATE_INVALID}`) });
    return exitFor("usage");
  }
  emit(args, {
    ok: true,
    data: ddateRecord(reading),
    human: () => console.log(reading.text),
  });
  return 0;
}
