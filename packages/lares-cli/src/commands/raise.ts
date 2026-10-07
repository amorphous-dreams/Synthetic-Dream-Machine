/**
 * `lares raise sign <challenge-json> [--as <index>]` — the RECOGNISER's half of the raise ceremony.
 *
 * A vessel standing at the floor emits a challenge naming a Nexus. A recognised operator signs it on their
 * OWN machine with their persona's per-Nexus LEAF — never the root — and the grant carries that leaf's
 * admit, read off this vessel's own replica of the Nexus's board. The asking vessel verifies the admit and
 * raises only on `held`; the caps ride the leaf, and no key of theirs ever rests on the vessel they raise.
 *
 * ── WHY THIS VERB CARRIES NO `ask` OR `answer` YET, SAID PLAINLY ────────────────────────────────
 * Those two halves belong to the ASKING vessel, and the door that holds them lives in that vessel's
 * running process — a raise is presence, held in memory, never written down. Reaching it from a separate
 * CLI process needs the door registered as a daemon verb, at the `wireVerbs` shore in `open-node-vessel`,
 * which means constructing the door there rather than after the open. That is a boot-path change and it
 * waits for its own pass. Naming a verb here that does not stand would spend a reader's trust the first
 * time they typed it.
 *
 * So: this half runs today and needs no daemon at all. The vessel emits its challenge in its own boot
 * output; hand that text here, hand the grant back.
 */

import { runRaiseSign, RaiseSignError } from "@lararium/node";
import { presentationFindingLine } from "@lararium/mesh";
import type { ParsedArgs } from "../parse-args.js";
import { emit, refuseUsage } from "../render.js";
import { helpLines } from "../command-help.js";

function usage(args: ParsedArgs, detail?: string): number {
  return refuseUsage(args, "raise", helpLines("raise"), detail);
}

export async function cmdRaise(args: ParsedArgs): Promise<number> {
  const sub = args.positional[0];
  if (sub !== "sign") {
    if (sub) console.error(`lares raise: unknown sub-verb "${sub}"`);
    return usage(args);
  }

  const challengeText = args.positional[1];
  if (!challengeText) return usage(args);

  // WHICH COMPARTMENT ANSWERS BELONGS TO THE OPERATOR. A human holds several personas, and the one that
  // signs is the one whose leaf the challenge's Nexus admitted. Defaulting to 0 names the ordinary case
  // without hiding the choice — `--as` moves it.
  const idxRaw = args.options["as"];
  const handleIndex = idxRaw === undefined ? 0 : Number.parseInt(idxRaw, 10);
  if (!Number.isInteger(handleIndex) || handleIndex < 0) {
    console.error(`--as must be a non-negative integer (got "${idxRaw}")`);
    return 2;
  }

  try {
    const { grant, findings } = await runRaiseSign({ challengeText, handleIndex });
    emit(args, {
      ok: true,
      data: { challenge: { ...grant.challenge }, byNym: grant.byNym, sig: grant.sig, presentedAdmit: grant.presentedAdmit, findings },
      human: () => {
        // What the presenter noticed reaches the signer, and never stops the grant.
        for (const f of findings) console.error(`lares raise sign: the presenter noticed: ${presentationFindingLine(f)}`);
        console.log(`raise sign — signed the challenge as persona ${handleIndex}'s leaf for that Nexus:`);
        console.log(`  your leaf:  ${grant.byNym}`);
        console.log(`  admit:      carried, with ${grant.presentedAdmit.lineage.length} lineage act(s)`);
        console.log(`  for vessel: ${grant.challenge.vesselId.slice(0, 16)}…`);
        console.log(`  at epoch:   ${grant.challenge.epoch}`);
        console.log(`  hand this grant back to that vessel:`);
        console.log(`    ${JSON.stringify(grant)}`);
        console.log(`  it stands only while that Nexus's lease epoch has not rolled past ${grant.challenge.epoch}.`);
      },
    });
    return 0;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    emit(args, {
      ok: false,
      error: { code: err instanceof RaiseSignError ? "usage" : "error", message: msg },
      human: () => console.error(`lares raise sign: ${msg}`),
    });
    return 1;
  }
}
