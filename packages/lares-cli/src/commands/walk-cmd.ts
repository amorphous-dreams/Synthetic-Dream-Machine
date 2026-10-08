/**
 * walk-cmd — this vessel's walking door: `lares walk`, `lares walk take`, `lares walk invite`.
 *
 * `@lararium/node` carries `commands/walk.ts` and this file imports from it; the `-cmd` suffix keeps the two
 * apart, as the house does wherever a node door and its CLI face share a name.
 *
 *   lares walk                          where this vessel walks: per hearth, the Nexus, whether its invite still
 *                                       waits to settle, the grant it holds, and how many invites its wallet holds
 *   lares walk take <lar-invite:…>      keep a carried invite; this vessel's hearth dial walks in on it, as the
 *                                       face it wears
 *   lares walk invite                   hand the newest invite out of the wallet, as one string to carry
 *
 * A vessel walks at one hearth, as the face it wears; a take for a second hearth refuses aloud and writes nothing.
 * A node carries none of its documents at a hearth — it is its own durable store.
 *
 * ONE STORE DOOR. While the vessel stands, each door runs inside it (`walk-*` verbs over the local socket), beside
 * the walk client that writes the same records; with no vessel standing, the door runs here (`store-door`).
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/the-invite
 */

import { runWalkState, runWalkTake, runWalkInvite, WalkRefusal, readHearthDialPin, larBootstrapPath } from "@lararium/node";
import { emit, exitFor, refuseUsage } from "../render.js";
import { helpLines } from "../command-help.js";
import { throughStoreDoor } from "../store-door.js";
import type { ParsedArgs } from "../parse-args.js";

function refuse(args: ParsedArgs, verb: string, err: unknown): number {
  const message = err instanceof Error ? err.message : String(err);
  const code = err instanceof WalkRefusal ? "refused" : "error";
  emit(args, { ok: false, error: { code, message }, human: () => console.error(`lares walk${verb ? ` ${verb}` : ""}: ${message}`) });
  return exitFor(code);
}

/** Run a walk door through the store door; a door's refusal comes back as a `WalkRefusal`, as on the direct path. */
async function walkDoor(verb: string, args: Record<string, unknown>, direct: () => Promise<Record<string, unknown>>): Promise<{ output: Record<string, unknown>; via: string }> {
  const r = await throughStoreDoor({ verb, args, direct });
  if (typeof r.output["refused"] === "string") throw new WalkRefusal(r.output["refused"]);
  return r;
}

/** The gate key a stopped vessel's hearth dial would pin at its next stand — an admit's pin, or `LAR_JOIN_GATE`. */
function pinnedDialGate(): string | null {
  return process.env["LAR_JOIN_GATE"] ?? readHearthDialPin(larBootstrapPath())?.gatePubKey ?? null;
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
    const { output, via } = await walkDoor("walk-state", {}, async () => ({ walks: runWalkState() }));
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
    const { output: r, via } = await walkDoor("walk-take", { invite: carried },
      async () => ({ ...(await runWalkTake({ carried, dialGate: pinnedDialGate() })), dialing: "next-stand" }));
    emit(args, {
      ok: true,
      data: { gatePubKey: r["gatePubKey"], nexusAid: r["nexusAid"], relay: r["relay"], leaf: r["leaf"], dialing: r["dialing"], via },
      human: () => {
        console.log(`walk taken — the hearth ${String(r["gatePubKey"]).slice(0, 16)}… in ${String(r["nexusAid"])}`);
        console.log(`  as leaf:   ${String(r["leaf"])}`);
        console.log(r["dialing"] === "now"
          ? "  the standing dial re-presents on it now"
          : "  this vessel's hearth dial walks in on it when the vessel next stands (`lares vessel stand`)");
      },
    });
    return 0;
  } catch (err) { return refuse(args, "take", err); }
}

async function walkInvite(args: ParsedArgs): Promise<number> {
  try {
    const { output: r, via } = await walkDoor("walk-invite", {}, async () => ({ ...(await runWalkInvite()) }));
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
