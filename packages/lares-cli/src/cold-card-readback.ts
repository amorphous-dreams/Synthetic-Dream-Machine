/**
 * cold-card-readback — PRINT EACH COLD-KEY CARD ONCE, AND READ IT BACK BEFORE A CHARTER MOVES.
 *
 * One printer serves every act that commits a chair's next key to a card: the seal rite's seat and roll, and the
 * Stable founding act (`lares vessel found --hearth`). A card a person mis-copies would freeze the chair at its
 * next roll, so the printer asks each one back on the terminal and the act writes nothing until every card reads
 * true. On a staged test root whose custody opens under the published test route the read-back stands in, and the
 * JSON answer carries each card's code; anywhere else the answer carries the digest and the confirm phrase alone.
 * Every seed zero-fills before the printer returns.
 */
import { COLD_KEY_CARD_DEFAULT_FIELDS, coldKeyCardLines, coldKeyCode, coldKeyConfirm, coldKeySeedFromCode } from "@lararium/mesh";
import type { ParsedArgs } from "./parse-args.js";
import { readBackStandsIn } from "./sealed-rows.js";
import { canPromptSecret, promptSecret } from "./prompt-secret.js";

/** One chair's cold next key, minted in this process. Its card prints once; its seed zero-fills once read back. */
export interface ColdCard { readonly chair: string; readonly seed: Uint8Array; readonly digest: string }

/** A read-back that refused: no terminal, a JSON run, or a card that never read back. Nothing was written. */
export class CardReadBackRefused extends Error {
  override readonly name = "CardReadBackRefused";
}

/**
 * Print each card and read it back. A card a person mis-copies would freeze the
 * chair at its next roll, so the rite asks each one back on the terminal and writes nothing until every card reads
 * true. On a staged test root whose custody opens under the published test route the read-back stands in, and the
 * JSON answer carries each card's code; anywhere else the answer carries the digest and the confirm phrase alone.
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
    for (const card of cards) {
      if (!json) {
        say(`── cold-key card · ${card.chair} ──`);
        for (const line of coldKeyCardLines(card.seed, { purpose: "the next key of one chair; it rolls the charter once", chairLabel: card.chair, generation, charterFingerprint }, fields)) say(`  ${line}`);
      }
      if (standIn) continue;
      for (let tries = 0; ; tries++) {
        const typed = (await promptSecret(`type the card for ${card.chair} back`)).trim();
        let back: Uint8Array | null = null;
        try { back = coldKeySeedFromCode(typed); } catch { back = null; }
        const same = back !== null && Buffer.from(back).equals(Buffer.from(card.seed));
        back?.fill(0);
        if (same) break;
        if (tries >= 2) throw new CardReadBackRefused(`the card for ${card.chair} read back three times and never matched — nothing was written; run the rite again`);
        say("  that card reads otherwise — try again");
      }
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
