/**
 * `lares sense analyze --lens <lens>` — ONE door for every read instrument over a poured sensorium.
 *
 * Eight instruments once stood as eight sense verbs, each with its own help line and its own MCP tool. They
 * read different things and compute different things, so nothing here merges them: the LENS chooses which
 * instrument runs, and each instrument keeps its own read path and its own daemon verb on the wire. What
 * folds is the door — one verb to learn, one place that lists what can be read, one refusal that names
 * every lens when the one asked for stands nowhere.
 *
 *   lares sense analyze                          the lenses, one line each (a usage refusal, exit 2)
 *   lares sense analyze --lens changes           where the content changes hands (change-points)
 *   lares sense analyze --lens couple            do coupled peers reconcile (the H¹ coupling gate)
 *   lares sense analyze --lens forecast --signal series.ndjson
 *
 * Every answer names the lens it applied (`data.lens`, and the first human line). A lens spelled by its
 * house name (`ki`, `li`) answers only where canon pins that name (li-ki-integrities names the two
 * postures `li` and `ki`); the answer still names the plain lens.
 *
 * The MCP seat's `analyze` tool reads the same table: `fixtures/cli-verbs.json` carries it as
 * `analyze_lenses` (gen_cli_verbs.mjs), and the seat's own test welds `ANALYZE_LENSES` to it.
 *
 * Meme: lar:///ha.ka.ba/lararium/sensorium/sense-analyze
 */

import { helpLines } from "../command-help.js";
import { refuseUsage } from "../render.js";
import { unreadFlag } from "./fold-flags.js";
import type { ParsedArgs } from "../parse-args.js";
import { cmdAnalyze } from "./analyze.js";
import { cmdRejim } from "./rejim.js";
import { cmdKi } from "./ki.js";
import { cmdLi } from "./li.js";
import { cmdJing } from "./jing.js";
import { cmdCoupleR } from "./couple-r.js";
import { cmdForecast } from "./forecast.js";
import { cmdMismatch } from "./mismatch.js";

/** One lens: what it reads, the daemon verb it rides (null: read TS-native in this process), the flags it reads, and its handler. */
export interface SenseLens {
  readonly brief: string;
  readonly wire: string | null;
  readonly reads: readonly string[];
  readonly run: (a: ParsedArgs) => Promise<number> | number;
}

/** The lenses, in the order the help lists them. Each name reads as plain English; the wire keeps the old verb. */
export const SENSE_LENSES: Readonly<Record<string, SenseLens>> = {
  changes:  { brief: "where the poured content changes hands (change-points; --spectral, --halves, --span)", wire: "analyze", reads: ["spectral", "halves", "span"], run: cmdAnalyze },
  rhythm:   { brief: "the landed regimes and their couples (--repour re-derives first; --channel)", wire: "rejim", reads: ["repour", "channel"], run: cmdRejim },
  couple:   { brief: "do the sensorium's coupled peers reconcile (the H¹ coupling gate)", wire: "ki", reads: [], run: cmdKi },
  cohere:   { brief: "do the sensorium's planes glue into one section (li-radius + the H¹ gate)", wire: "li", reads: [], run: cmdLi },
  square:   { brief: "do a child-host's lobes round-trip to one self (default: the mesh)", wire: "jing", reads: [], run: cmdJing },
  lead:     { brief: "who leads whom across signals (the R transfer-entropy reference; --signal, --names)", wire: "couple-r", reads: ["signal", "names"], run: cmdCoupleR },
  forecast: { brief: "does a regime shift approach (the R early-warning read; --signal)", wire: "forecast", reads: ["signal"], run: cmdForecast },
  mismatch: { brief: "do `couple` and `lead` agree over the same signals (--signal, --names)", wire: "mismatch", reads: ["signal", "names"], run: cmdMismatch },
};

/** House names canon pins (li-ki-integrities: the two postures `li` and `ki`), each flowing to its plain lens. */
export const SENSE_LENS_ALIASES: Readonly<Record<string, string>> = { ki: "couple", li: "cohere" };

/** The lens a spelling names, or undefined where none stands. */
export function resolveLens(spelling: string): string | undefined {
  if (spelling in SENSE_LENSES) return spelling;
  return SENSE_LENS_ALIASES[spelling];
}

export async function cmdSenseAnalyze(args: ParsedArgs): Promise<number> {
  const asked = args.options["lens"];
  const names = Object.keys(SENSE_LENSES).join(" · ");
  if (asked === undefined) {
    return refuseUsage(args, "sense analyze", helpLines("sense"), `name a lens: ${names}`);
  }
  const lens = resolveLens(asked);
  if (lens === undefined) {
    return refuseUsage(args, "sense analyze", helpLines("sense"), `no lens named '${asked}'; the lenses: ${names}`);
  }
  if (args.positional.length > 0) {
    return refuseUsage(args, "sense analyze", helpLines("sense"), `--lens ${lens} takes no word after it (got '${args.positional.join(" ")}')`);
  }
  const chosen = SENSE_LENSES[lens]!;
  const stray = unreadFlag(args, ["lens", ...chosen.reads]);
  if (stray !== undefined) {
    const reads = chosen.reads.length ? chosen.reads.map((r) => `--${r}`).join(" ") : "no flag beyond --lens";
    return refuseUsage(args, "sense analyze", helpLines("sense"), `--lens ${lens} reads no ${stray} (it reads ${reads})`);
  }
  return await chosen.run(args);
}
