/**
 * cold-card-readback — PRINT EACH COLD-KEY CARD ONCE, AND READ IT BACK BEFORE A CHARTER MOVES.
 *
 * One printer serves every act that commits a chair's next key to a card: the seal rite's seat and roll, and the
 * Stable founding act (`lares vessel found hearth=true`). A card a person mis-copies would freeze the chair at its
 * next roll, so the printer asks each one back on the terminal and the act writes nothing until every card reads
 * true. A harness can explicitly seat a read-back stand-in in this CLI process; then the JSON answer carries each
 * card's code. With no seat the answer carries the digest and the confirm phrase alone.
 * Every seed zero-fills before the printer returns.
 */
import { ATTEMPT_BUDGET, attemptWarning } from "@lararium/mesh/attempt-budget";
import {
  COLD_KEY_CARD_DEFAULT_FIELDS,
  coldKeyCardLines,
  coldKeyCode,
  coldKeyConfirm,
  coldKeySeedFromCode,
} from "@lararium/mesh/cold-key-card";
import type { ParsedArgs } from "./parse-args.js";
import { readBackStandsIn } from "./sealed-records.js";
import { canPromptSecret, promptSecret } from "./prompt-secret.js";

/** One chair's cold next key, minted in this process. Its card prints once; its seed zero-fills once read back. */
export interface ColdCard { readonly chair: string; readonly seed: Uint8Array; readonly digest: string }

/** A read-back that refused: no terminal, a JSON run, or a card that never read back. Nothing was written. */
export class CardReadBackRefused extends Error {
  override readonly name = "CardReadBackRefused";
}

/** A card's code holds 72 characters once its dashes and spaces drop. */
const CODE_CHARACTERS = 72;
const CARD_LINES = 3;
const LINE_CHARACTERS = CODE_CHARACTERS / CARD_LINES;

/**
 * One read-back attempt gathers the card's three lines: typed one per line, pasted as three lines (the terminal
 * hands them over one line at a time), or pasted onto one line. It stops once 72 characters stand, after three
 * lines, on an empty line, or on a line that cannot be one card row (24 characters), so a wrong line never waits for
 * more. The input stays hidden, so each further line names how many characters it still needs.
 */
async function readCardLines(chair: string): Promise<string> {
  let code = "";
  for (let line = 0; line < CARD_LINES; line++) {
    const label = line === 0
      ? `type or paste ${chair}'s three code lines (dashes and spaces optional), not the confirm words; the input stays hidden\n  `
      : `  line ${line + 1} of ${CARD_LINES} (${CODE_CHARACTERS - code.length} characters to go): `;
    const typed = (await promptSecret(label)).replace(/[\s-]/g, "");
    if (typed.length === 0) break;
    code += typed;
    if (code.length >= CODE_CHARACTERS || typed.length !== LINE_CHARACTERS) break;
  }
  return code;
}

/** Count the line feeds written to stdout until `stop` restores it, so a card's erase covers exactly what it printed. */
function tapLineFeeds(): { count: () => number; stop: () => void } {
  const original = process.stdout.write;
  const columns = process.stdout.columns;
  const wraps = typeof columns === "number" && columns > 0;
  let rows = 0;     // rows the finished lines took
  let current = 0;  // visible characters on the line the cursor stands in
  process.stdout.write = ((chunk: unknown, ...rest: unknown[]) => {
    const segments = String(chunk).split("\n");
    segments.forEach((segment, at) => {
      // ANSI escapes take no column; what a hidden prompt reads back is never echoed, so it never reaches this tap.
      current += segment.replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "").length;
      if (at < segments.length - 1) {
        rows += wraps ? Math.max(1, Math.ceil(current / columns)) : 1;
        current = 0;
      }
    });
    return (original as (...a: unknown[]) => boolean).call(process.stdout, chunk, ...rest);
  }) as typeof process.stdout.write;
  // An unfinished line that wrapped leaves the cursor on a lower row; the climb covers those rows too.
  return { count: () => rows + (wraps && current > 0 ? Math.floor((current - 1) / columns) : 0), stop: () => { process.stdout.write = original; } };
}

/**
 * Print each card and read it back. A card a person mis-copies would freeze the
 * chair at its next roll, so the rite asks each one back on the terminal and writes nothing until every card reads
 * true. A harness can explicitly seat a read-back stand-in in this CLI process; then the JSON answer carries each
 * card's code. With no seat the answer carries the digest and the confirm phrase alone.
 * Every seed zero-fills before this returns.
 */
export async function readBack(args: ParsedArgs, cards: readonly ColdCard[], generation: number, charterFingerprint: string): Promise<Array<Record<string, string>>> {
  try {
    if (cards.length === 0) return [];
    const standIn = await readBackStandsIn();
    const json = args.flags["json"] === true;
    // A LIVE CARD PRINTS ON THE TERMINAL ALONE: never into a JSON answer, a redirected stream or a log.
    if (!standIn && (json || !canPromptSecret())) {
      throw new CardReadBackRefused(json
        ? "the rite prints each chair's cold-key card on the terminal and asks it back there; run it without --json. Nothing was written."
        : "the rite prints each chair's cold-key card and asks it back on a terminal; run it on one. Nothing was written.");
    }
    const say = (line: string): void => { process.stdout.write(`${line}\n`); };
    // A card names the fields its caller holds: a chair whose charter does not stand yet (a joint Nexus at `cofound
    // open` and `join`, a seat with no inception image) prints the three it holds and no charter line, never a refusal.
    const fields = charterFingerprint === "" ? (["purpose", "chairLabel", "generation"] as const) : COLD_KEY_CARD_DEFAULT_FIELDS;
    if (!json && cards.length > 1) say(`${cards.length} cards print in order: ${cards.map((card) => card.chair).join(", ")}.`);
    // On a terminal, a confirmed card's printed lines leave the screen: cursor up over exactly the lines written for
    // the card (a tap counts the line feeds the card, its prompts and any retry notes wrote), then erase to the end.
    const onTerminal = process.stdout.isTTY === true && !standIn && !json;
    for (const card of cards) {
      const tap = onTerminal ? tapLineFeeds() : null;
      try {
        if (!json) {
          say(`── cold-key card · ${card.chair} ──`);
          for (const line of coldKeyCardLines(card.seed, { purpose: "the next key of one chair; it rolls the charter once", chairLabel: card.chair, generation, charterFingerprint }, fields)) say(`  ${line}`);
        }
        if (standIn) continue;
        for (let tries = 0; ; tries++) {
          const typed = await readCardLines(card.chair);
          let back: Uint8Array | null = null;
          let reason = "reads as another card";
          try { back = coldKeySeedFromCode(typed); } catch (err) {
            const fault = err instanceof Error ? err.message : "";
            if (fault.endsWith(": length")) reason = `${typed.replace(/[\s-]/g, "").length} of 72 characters`;
            else if (fault.endsWith(": character")) reason = "a character outside 0-9 a-f";
            else if (fault.endsWith(": checksum")) reason = "a typo somewhere (checksum)";
            else throw err;
          }
          const same = back !== null && Buffer.from(back).equals(Buffer.from(card.seed));
          back?.fill(0);
          if (same) break;
          const left = ATTEMPT_BUDGET - tries - 1;
          if (left <= 0) throw new CardReadBackRefused(`the card for ${card.chair}: ${reason}. ${attemptWarning(0, "read-back")}`);
          say(`  ${reason}. ${attemptWarning(left, "read-back")}`);
        }
      } finally { tap?.stop(); }
      if (standIn || json) continue;
      if (tap) process.stdout.write(`\u001b[${tap.count()}A\u001b[0J`);
      else say(`  ${card.chair}'s card read back true; clear your scrollback so its code lines do not linger.`);
    }
    return cards.map((card) => {
      const code = coldKeyCode(card.seed);
      return standIn
        ? { chair: card.chair, digest: card.digest, confirm: coldKeyConfirm(code), code }
        : { chair: card.chair, digest: card.digest, confirm: coldKeyConfirm(code) };
    });
  } finally {
    for (const card of cards) card.seed.fill(0);
  }
}
