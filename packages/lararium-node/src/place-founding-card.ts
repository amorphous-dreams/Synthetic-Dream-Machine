/** A cold place card reads back before its commitment lands in the place KEL. */
export interface PlaceFoundingCard {
  readBack(card: { seed: Uint8Array; digest: string; verifyingKey: string }, fingerprint: string, generation: number): Promise<void>;
}

export class PlaceFoundingCardUnread extends Error {
  override readonly name = "PlaceFoundingCardUnread";
  constructor() { super("the place's cold card needs a terminal read-back before founding writes a key"); }
}
