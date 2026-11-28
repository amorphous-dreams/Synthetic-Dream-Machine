/**
 * command-help — the words behind `lares <command> --help` and every door's usage refusal, read off the baked affordance pack.
 *
 * ONE HOME FOR A DOOR'S WORDS. Every door's affordances hold canon carriers, so a door's help reads its carriers through the
 * baked pack (`@lararium/tw5/affordance-pack`): the door's own entry (`doors.<door>`, one carrier's whole or an index of
 * several), or one verb's carrier whole where a spelling routes alone (`lares law pin --help`). A command module that refuses
 * on a bad sub-verb draws its menu from HERE through `helpLines`, so the refusal and `--help` render identical bytes; a module
 * holding its own copy splits the two, and `tests/help-door-meme.test.ts` welds that split shut. The census law
 * (`tests/laws/affordance-census.law.test.ts`) reads every door flipped, so no registry stands beside the pack.
 *
 * PURE DATA, SO ANY VESSEL CAN HOLD IT. This module reads no `node:fs` and no environment; the pack rides as data. A door's
 * law lines ride its carriers' help (`Law:`), and `lares get title=<carrier> aperture=arc` reads any carrier whole.
 */
import { affordancePack, packDoor, packRender, packRoute } from "@lararium/tw5/affordance-pack";

/** The cure a word the pack has not baked names: the bake that gathers its carriers. */
const REBAKE_CURE = "re-bake: pnpm --filter @lararium/tw5 build";

/**
 * The door key for a `--help` call: the verb a carrier skins (`"<door> <sub>"`) where one routes, the command otherwise, so a
 * sub-verb's own flags reach the reader instead of its parent's.
 */
export function helpDoor(command: string, positional: readonly string[]): string {
  const sub = positional[0];
  // A verb a carrier skins reads its own whole (`lares law pin --help`).
  if (sub && packRoute("cli", `${command} ${sub}`) !== undefined) return `${command} ${sub}`;
  return command;
}

/**
 * A carried verb's one line, its carrier's role, for a door that keeps its own sub-verb table beside it: the table prints the
 * carrier's words and holds none of its own. Empty where the pack routes no carrier.
 */
export function verbRole(spelling: string): string {
  const address = packRoute("cli", spelling);
  return address === undefined ? "" : affordancePack().carriers[address]?.role ?? "";
}

/**
 * One door's help as LINES — the single home both the `--help` render and a module's usage REFUSAL draw
 * from. A module that keeps its own copy of these words splits the two; the weld test refuses that.
 */
export function helpLines(door: string, summary?: string): string[] {
  const packed = packDoor(door);
  if (packed !== undefined) return [...packed.help];
  const verb = packRoute("cli", door);
  const whole = verb === undefined ? undefined : packRender(verb, "cli", "whole");
  if (whole !== undefined) return [...whole];
  // A word no carrier skins (a door the pack has not baked yet) answers its row's account and the read that names the rest.
  const out = [`lares ${door}`, "", "Examples:", `  lares ${door}                 # usage`, `  lares ${door} --help          # this account`];
  if (summary) out.push("", "About:", `  ${summary}`);
  out.push("", `  (no carrier skins \`lares ${door}\` in the baked pack; ${REBAKE_CURE})`);
  return out;
}

/** Render a command's help to stdout, the lines `helpLines` reads; a word no carrier skins answers its row's `summary`. */
export function renderCommandHelp(door: string, summary?: string): void {
  for (const line of helpLines(door, summary)) console.log(line);
}
