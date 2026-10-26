/**
 * place-founding-card — the port a place's cold card reads back through before its commitment lands in the place KEL.
 *
 * A founding mints the cold next key, shows it on a card and asks it back; the KEL's inception commits that key's digest only
 * after the card reads back, and no byte of the cold seed rests anywhere. The ceremony itself (a terminal, a dialog) stays on
 * the shore that owns the person: node and browser each seat a port and neither mints without one. Platform-blind.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/place-kel
 */
import { type RandomProvider } from "./crypto.js";
import { mintColdKey } from "./cold-key-card.js";
import { mintPlaceInception, type PlaceInception } from "./vessel-kel.js";

/** A cold place card reads back before its commitment lands in the place KEL. */
export interface PlaceFoundingCard {
  readBack(card: { seed: Uint8Array; digest: string; verifyingKey: string }, fingerprint: string, generation: number): Promise<void>;
}

/** No ceremony stands to read the place's cold card back, so no founding writes a key. */
export class PlaceFoundingCardUnread extends Error {
  override readonly name = "PlaceFoundingCardUnread";
  constructor() { super("the place's cold card needs a read-back before founding writes a key"); }
}

/**
 * Mint the armed inception for `signerSeed`: draw the cold key (from `entropy`), commit its digest, and read the card back
 * through `card` before returning. A refused read-back throws and leaves nothing; the cold seed zero-fills either way.
 */
export async function armPlaceInception(args: {
  readonly signerSeed: Uint8Array;
  readonly card:       PlaceFoundingCard;
  readonly entropy?:   RandomProvider;
}): Promise<{ readonly event: PlaceInception; readonly aid: string }> {
  const cold = await mintColdKey(args.entropy);
  try {
    const minted = mintPlaceInception({ signerSeed: args.signerSeed, coldVerifyingKey: cold.verifyingKey });
    await args.card.readBack({ seed: cold.seed, digest: minted.event.next, verifyingKey: cold.verifyingKey }, minted.aid.slice(-16), 0);
    return { event: minted.event, aid: minted.aid };
  } finally { cold.seed.fill(0); }
}
