/**
 * `lares vessel rotate` — ROTATE THE PLACE BY ITS FOUNDING CARD.
 *
 * The place's online signer signs the floor's duties; the next key rests on the founding card alone. This act reads that
 * card (typed on a terminal), mints the replacement signer and the next card, prints the replacement card and asks it back,
 * and only then lets the node's `rotatePlace` stage, publish and reconcile the signed rotation under one custody claim. A
 * card that opens no commitment, a replacement card that reads back otherwise, or a standing vessel refuses before any byte
 * moves, so the head, the chain and the key file stay as they stood.
 *
 * `--cold-key <code>` stands in for the terminal on a staged test root alone: a card typed into a flag on a live machine
 * rests in the shell's history.
 */
import { coldKeySeedFromCode, ColdKeyCardError } from "@lararium/mesh";
import { rotatePlace } from "@lararium/node";
import type { ParsedArgs } from "../parse-args.js";
import { CardReadBackRefused, readBack } from "../cold-card-readback.js";
import { vesselStanding } from "../custody-door.js";
import { promptSecret, canPromptSecret } from "../prompt-secret.js";
import { readBackStandsIn } from "../sealed-rows.js";

export async function cmdRotatePlace(args: ParsedArgs): Promise<number> {
  if (args.options["root"]) process.env["LAR_ROOT"] = args.options["root"];
  let card: Uint8Array | null = null;
  try {
    if ((await vesselStanding()).reading !== "none") {
      console.error("lares vessel rotate: a vessel stands here, and its online signer would outlive the rotation — stop it first (lares vessel stop), then rotate.");
      return 2;
    }
    const flagged = args.options["cold-key"];
    if (flagged !== undefined && !(await readBackStandsIn())) {
      console.error("lares vessel rotate: --cold-key stands in for the terminal on a staged test root alone: type the card when the rite asks for it.");
      return 2;
    }
    if (flagged === undefined && !canPromptSecret()) {
      console.error("lares vessel rotate: the rite reads the founding card on a terminal; run it on one.");
      return 2;
    }
    const code = flagged ?? (await promptSecret("type the place's founding card")).trim();
    try { card = coldKeySeedFromCode(code); }
    catch (err) { if (err instanceof ColdKeyCardError) { console.error(`lares vessel rotate: ${err.message}`); return 2; } throw err; }
    const done = await rotatePlace({
      card,
      placeFoundingCard: { readBack: async (next, fingerprint, generation) => {
        await readBack(args, [{ chair: "place", seed: next.seed, digest: next.digest }], generation, fingerprint);
      } },
    });
    if (args.flags["json"] === true) console.log(JSON.stringify({ ok: true, aid: done.aid, seq: done.seq, signerKey: done.event.key }));
    else console.log(`[lares vessel rotate] the place ${done.aid.slice(0, 16)}… rotated to seq ${done.seq}; the old card is spent, keep the replacement.`);
    return 0;
  } catch (err) {
    if (err instanceof CardReadBackRefused) { console.error(`lares vessel rotate: ${err.message}`); return 2; }
    if (err instanceof Error && /^place-(card-refused|rotation-torn|rotation-raced)$/.test(err.message)) {
      console.error(`lares vessel rotate: ${err.message} — nothing moved.`);
      return 2;
    }
    throw err;
  } finally { card?.fill(0); }
}
