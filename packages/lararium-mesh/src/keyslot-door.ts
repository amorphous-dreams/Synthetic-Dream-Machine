/**
 * keyslot-door: the keyslot tree's PUBLIC names, on a subpath of their own.
 *
 * A caller that must load no Repo and no WASM (the ceremony's custody-proof worker) cannot ride the package barrel,
 * and `keyslot.ts` itself leaves by no door: `mintKdfPort` lives there, and a hand that could import it could mint a
 * KDF port the brand exists to keep in this package (`tests/keyslot-internal-door.test.ts`). This door carries exactly
 * the names the barrel already exports from `keyslot.ts`, and nothing else.
 *
 * Meme: lar:///ha.ka.ba/lararium/browser/browser-custody
 */
export { bindSlot, unbindSlot, openTreeKey, nobleKdf, encodeSlotTree, decodeSlotTree, draftPaperPin, confirmPaperPin, confirmHeldPaper, mintPasskeySalt, openPasskeyPin, PIN_KINDS } from "./keyslot.js";
export type { KdfPort, ScryptCost, PaperDraft, ConfirmedPaperPin, SlotTree, SlotSpec, PinSpec, PinKind, PinRecord, PasskeyPinRecord, Credential, TreeKeyUnlock, SlotTreeReading } from "./keyslot.js";
