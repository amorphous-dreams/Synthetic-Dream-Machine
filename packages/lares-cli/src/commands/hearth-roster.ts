/**
 * `lares vessel roster` — the hearth roster: who is home. The worn face this vessel holds and who holds that slot, the seats
 * in two grains (here by presence on this vessel's socket, far by last signed act on the face intent plane), the lanes a
 * seat claims, and the vota still waiting.
 *
 * The vessel's verb channel answers `hearth-roster` itself (`@lararium/node`'s `hearth-roster-read`): it reads the sessions
 * its socket holds and the worn faces' intent planes, and places nothing. The verb sits under `vessel` because it reads the
 * vessel's own house, and the top-level list holds its one screen. It names no face: the roster reads every face the vessel
 * wears. The read prints plainly on a terminal and through a pipe; `--json` carries the roster whole, the body the MCP
 * seat's `vessel_roster` answers.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/hearth-roster
 */
import { renderHearthRoster, type HearthRoster } from "@lararium/mesh";
import { vesselDid } from "../env.js";
import { runVerb, verbFailure } from "../verb-call.js";
import { readVerbOutcome } from "../verb-result.js";
import { emit, exitFor, proseFirst } from "../render.js";
import type { ParsedArgs } from "../parse-args.js";

/** The verb the vessel's channel answers. */
export const HEARTH_ROSTER_VERB = "hearth-roster";

/** A transport fault (no vessel, a lost answer) names itself by its class, as every door's guard does. */
async function guarded(args: ParsedArgs, run: () => Promise<number>): Promise<number> {
  try { return await run(); }
  catch (err) {
    const f = verbFailure(err);
    emit(args, {
      ok: false, ...(f.requestId !== undefined ? { requestId: f.requestId } : {}),
      error: { code: f.code, message: f.message, ...(f.hint !== undefined ? { hint: f.hint } : {}) },
      human: () => console.error(`lares vessel roster: ${f.message}`),
    });
    return exitFor(f.code);
  }
}

export async function cmdHearthRoster(args: ParsedArgs): Promise<number> {
  return guarded(args, async () => {
    const result = await runVerb(HEARTH_ROSTER_VERB, {}, await vesselDid());
    const outcome = readVerbOutcome(result);
    if (!outcome.ok) {
      const message = outcome.error ?? "the vessel refused the read";
      emit(args, { ok: false, requestId: result.requestId, error: { code: "verb-error", message }, human: () => console.error(`lares vessel roster: ${message}`) });
      return exitFor("verb-error");
    }
    const roster = outcome.output as unknown as HearthRoster;
    emit(proseFirst(args), {
      ok: true, requestId: result.requestId, data: outcome.output,
      human: () => { for (const line of renderHearthRoster(roster)) console.log(line); },
    });
    return 0;
  });
}
