/**
 * place-receipt — the test seat for a rite receipt: THE PLACE signs one receipt per tree under its receipt duty, and every
 * face's trust reads it through its `place` predicate. A face's own key never signs as the place.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import { placeSignerFromSeed, type PlaceSigner } from "../src/place-signer.js";
import { signRiteReceipt, swarmReceiptTitle, type SwarmWikiPort } from "../src/swarm-tiddlers.js";

/** A place signer over a seed of one repeated byte. */
export const placeOf = (n: number): PlaceSigner => placeSignerFromSeed(new Uint8Array(32).fill(n));
/** The place every fixture's trust names, apart from every hand, vessel and lead seed the fixtures key. */
export const PLACE = placeOf(77);
/** A trust's `place` predicate over one place signer. */
export const placeTrust = (place: PlaceSigner = PLACE) => (key: string): boolean => key === place.key;

/** Rest a receipt the place signed over a tree, at its title; a later one replaces it. */
export async function restPlaceReceipt(wiki: SwarmWikiPort, tree: string, verdict: "pass" | "fail" = "pass", place: PlaceSigner = PLACE): Promise<void> {
  await wiki.write(swarmReceiptTitle(tree), JSON.stringify(await signRiteReceipt({ tree, checks: ["typecheck"], verdict, definitions: "d".repeat(64) }, place)));
}
