/**
 * walk-cmd — this vessel's walking door: `lares walk`, `lares walk take`, `lares walk invite`.
 *
 * `@lararium/node` carries `commands/walk.ts` and this file imports from it; the `-cmd` suffix keeps the two
 * apart, as the house does wherever a node door and its CLI face share a name.
 *
 *   lares walk                          where this vessel walks: per hearth, the Nexus, whether its invite still
 *                                       waits to settle, the grant it holds, and how many invites its wallet holds
 *   lares walk take <lar-invite:…> [--face N]
 *                                       keep a carried invite; this vessel's hearth dial walks in on it, as the
 *                                       face named (else the one face standing open)
 *   lares walk invite                   hand the newest invite out of the wallet, as one string to carry
 *
 * A vessel walks at one hearth, as one face; a take for a second hearth refuses aloud and writes nothing.
 * A node carries none of its documents at a hearth — it is its own durable store.
 *
 * THE CUSTODY DOOR. A walk record holds bearer invites, the hearth's grant and one key per carried document, so it
 * rests sealed under the vessel key and each door here sends one `act` frame (`walk.state`, `walk.take`,
 * `walk.invite`): a carried invite as a verb's argument, or an invite as a verb's outcome, would rest in the
 * daemon's document in the clear. While the vessel stands unlocked the act runs inside it, beside the walk client
 * that writes the same records; with no vessel standing it runs here, under this command's own key session.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/the-invite
 */

import { faceOption } from "../face-option.js";
import { SealedActRefused, WalkRefusal } from "@lararium/node";
import { emit, exitFor, refuseUsage } from "../render.js";
import { helpLines } from "../command-help.js";
import { sealedActVia } from "../sealed-act-door.js";
import type { ParsedArgs } from "../parse-args.js";

function refuse(args: ParsedArgs, verb: string, err: unknown): number {
  const message = err instanceof Error ? err.message : String(err);
  const code = err instanceof WalkRefusal ? "refused" : "error";
  emit(args, { ok: false, error: { code, message }, human: () => console.error(`lares walk${verb ? ` ${verb}` : ""}: ${message}`) });
  return exitFor(code);
}

/** Run a walk act on the custody door; the door's own refusal comes back as a `WalkRefusal`, on either path. */
async function walkDoor(act: "walk.state" | "walk.take" | "walk.invite", args: Record<string, unknown> = {}): Promise<{ output: Record<string, unknown>; via: string }> {
  try {
    const r = await sealedActVia(act, args);
    // The command's own word for where a door ran stays what every store door says: `daemon` inside the standing vessel.
    return { output: r.result, via: r.via === "vessel" ? "daemon" : "direct" };
  } catch (err) {
    if (err instanceof SealedActRefused && err.reason === "act-refused") throw new WalkRefusal(err.message);
    throw err;
  }
}

export async function cmdWalk(args: ParsedArgs): Promise<number> {
  const sub = args.positional[0];
  if (sub === undefined) return walkState(args);
  if (sub === "take") return walkTake(args);
  if (sub === "invite") return walkInvite(args);
  return refuseUsage(args, "walk", helpLines("walk"), `unknown sub-verb "${sub}"`);
}

interface WalkRow { gatePubKey: string; nexusAid: string; relay: string | null; redeeming: boolean; grant: { epoch: string; survived: number; from: string } | null; wallet: number }

async function walkState(args: ParsedArgs): Promise<number> {
  try {
    const { output, via } = await walkDoor("walk.state");
    const walks = (output["walks"] ?? []) as WalkRow[];
    emit(args, {
      ok: true,
      data: { walks, via },
      human: () => {
        if (walks.length === 0) { console.log("this vessel walks nowhere — `lares walk take <lar-invite:…>` keeps an invite to walk in on"); return; }
        for (const w of walks) {
          console.log(`walking at ${w.gatePubKey}`);
          console.log(`  nexus:     ${w.nexusAid}`);
          console.log(`  relay:     ${w.relay ?? "(none named)"}`);
          console.log(`  standing:  ${w.redeeming ? "the invite waits for a dial to redeem it" : w.grant ? `a grant at ${w.grant.epoch.slice(0, 16)}… (${w.grant.from} lineage, ${w.grant.survived} roll(s) survived)` : "(none)"}`);
          console.log(`  wallet:    ${w.wallet} invite(s) to hand out`);
        }
      },
    });
    return 0;
  } catch (err) { return refuse(args, "", err); }
}

async function walkTake(args: ParsedArgs): Promise<number> {
  const carried = args.positional[1];
  if (!carried) return refuseUsage(args, "walk", helpLines("walk"), "walk take needs the carried `lar-invite:` string");
  try {
    const { output: r, via } = await walkDoor("walk.take", { carried, ...faceOption(args) });
    emit(args, {
      ok: true,
      data: { gatePubKey: r["gatePubKey"], nexusAid: r["nexusAid"], relay: r["relay"], leaf: r["leaf"], dialing: r["dialing"], via },
      human: () => {
        console.log(`walk taken — the hearth ${String(r["gatePubKey"]).slice(0, 16)}… in ${String(r["nexusAid"])}`);
        console.log(`  as leaf:   ${String(r["leaf"])}`);
        console.log(r["dialing"] === "now"
          ? "  the standing dial re-presents on it now"
          : "  this vessel's hearth dial walks in on it when the vessel next stands (`lares vessel stand`)");
        console.log("  note: the walker route ships SHUT by name (the shut-routes house ruling, stable-founding-road #/rulings): the invite is kept, but no hearth gate seats this walk until a live grant reader opens the route.");
      },
    });
    return 0;
  } catch (err) { return refuse(args, "take", err); }
}

async function walkInvite(args: ParsedArgs): Promise<number> {
  try {
    const { output: r, via } = await walkDoor("walk.invite");
    emit(args, {
      ok: true,
      data: { gatePubKey: r["gatePubKey"], invite: r["invite"], left: r["left"], via },
      human: () => {
        console.log(String(r["invite"]));
        console.error(`  carry this to one newcomer; it redeems once, at the hearth's own gate. ${String(r["left"])} left in the wallet.`);
      },
    });
    return 0;
  } catch (err) { return refuse(args, "invite", err); }
}
