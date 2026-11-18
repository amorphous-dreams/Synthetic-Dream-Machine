/**
 * place-card — A BROWSER'S PLACE CARD, READ BACK THROUGH THE CEREMONY (the node's `found` card ceremony, ported:
 * `lares-cli` cold-card-readback). A browser's founding arms its place KEL (W29): the device key signs, and the place's cold
 * next key rests on one paper card alone, so a lost or leaked device key rotates the place once with it. A card a person
 * mis-copies would freeze the place at its next rotation, so the founding writes no key until the card reads back true.
 *
 * The card's lines (its fields, its three code rows, its confirm phrase) ride the ceremony's brokered port to the clean
 * ceremony document alone: the surface page hears the ask's public words and opens the ceremony, as for every custody ask.
 * The typed code arrives on that port, decodes on the vessel worker's thread, and compares with the seed there.
 *
 * Canon: lar:///ha.ka.ba/lares/docs/stable-founding-road (W29) · lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift#/the-ceremony
 */
import { coldKeyCardLines, coldKeySeedFromCode, type Credential, type PlaceFoundingCard } from "@lararium/mesh";
import type { CeremonyAskSpec } from "./ceremony-door.js";

/** A card that never read back, or one the person declined: nothing was written. */
export class PlaceCardRefused extends Error {
  override readonly name = "PlaceCardRefused";
  constructor(readonly refusal: string, detail: string) { super(`${refusal}: ${detail}`); }
}

const TRIES = 3;
const CODE_CHARACTERS = 72;

/** What the card serves, in the person's words: the ceremony shows it above the card. */
const SERVES = "This is this browser's place card: the cold next key of this browser's place. Write its three code rows on paper "
  + "and keep the paper away from this device. If this device's key is ever lost or leaks, this card rotates the place once. "
  + "Then type the three code rows back below (dashes and spaces optional), not the confirm words.";

/** Why a typed code failed, in words the next attempt shows. */
function faultOf(typed: string): string | null {
  let back: Uint8Array | null = null;
  try { back = coldKeySeedFromCode(typed); return null; }
  catch (err) {
    const fault = err instanceof Error ? err.message : "";
    if (fault.endsWith(": length")) return `${typed.replace(/[\s-]/g, "").length} of ${CODE_CHARACTERS} characters`;
    if (fault.endsWith(": character")) return "a character outside 0-9 a-f";
    if (fault.endsWith(": checksum")) return "a typo somewhere (checksum)";
    return "the code does not read";
  } finally { back?.fill(0); }
}

/** The founding's read-back over one session's ceremony door: the card shows once per attempt, three attempts at most. */
export function ceremonyPlaceCard(door: { ask(spec: CeremonyAskSpec): Promise<Credential | null> }): PlaceFoundingCard {
  return {
    async readBack(card, fingerprint, generation) {
      const lines = coldKeyCardLines(card.seed, { purpose: "the next key of this browser's place; it rotates the place once", chairLabel: "place", generation, charterFingerprint: fingerprint });
      let note = "";
      for (let tries = 0; tries < TRIES; tries++) {
        const answer = await door.ask({ kind: "card", act: "found this browser's place", face: null, card: lines,
          words: `${SERVES}${note ? ` Attempt ${tries + 1} of ${TRIES}: the last one read ${note}.` : ""}` });
        if (answer === null || answer.kind !== "passphrase") throw new PlaceCardRefused("card-declined", "the place card was not read back; nothing was written. Opening this page again prints a new card: discard this one");
        const fault = faultOf(answer.passphrase);
        if (fault === null) {
          const back = coldKeySeedFromCode(answer.passphrase);
          try {
            if (back.length === card.seed.length && back.every((b, i) => b === card.seed[i])) return;
          } finally { back.fill(0); }
          note = "as another card";
        } else note = fault;
      }
      throw new PlaceCardRefused("card-unread", `the place card: ${note}; ${TRIES} attempts never matched, and nothing was written. Opening this page again prints a new card: discard this one and write down the new one`);
    },
  };
}
