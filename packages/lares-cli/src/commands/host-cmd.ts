/**
 * host-cmd — the hearth's hosting door: `lares host`, `lares host roll`, `lares host invite`.
 *
 * `@lararium/node` carries `commands/host.ts` and this file imports from it; the `-cmd` suffix keeps the two
 * apart, as the house does wherever a node door and its CLI face share a name.
 *
 *   lares host                                     what this hearth hosts: per Nexus, the live epochs, the cap,
 *                                                  and how many invites were redeemed (counts, never rows)
 *   lares host roll   [--nexus <aid>] [--cap <n>]  roll the hosting epoch: a new signed act, landed on this
 *                                                  hearth's hosting doc in the Nexus; rolling twice is the hard roll
 *   lares host invite [--nexus <aid>] [--relay <ws-url>]
 *                                                  mint this hearth's own invite at the current epoch and print
 *                                                  the one string to carry; nothing about it is kept here
 *
 * Without `--nexus` a door acts on this hearth's own charter. A hearth hosts only in a Nexus it carries, and
 * only as the face this vessel wears.
 *
 * THE CUSTODY DOOR. The hosting state, its spend rows and its carriage rest sealed under the vessel key, so each
 * door here sends one `act` frame (`host.state`, `host.roll`, `host.invite`): an invite as a verb's outcome would
 * rest in the daemon's document in the clear. While the vessel stands unlocked the act runs inside it, so a roll
 * lands on the replica its walkers sync; with no vessel standing it runs here, under this command's own key
 * session, and holds the store for the moment of the roll.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/the-invite
 */

import { HostRefusal, SealedActRefused } from "@lararium/node";
import { emit, exitFor, refuseUsage } from "../render.js";
import { helpLines } from "../command-help.js";
import { sealedActVia } from "../sealed-act-door.js";
import type { ParsedArgs } from "../parse-args.js";

/** Run a host act on the custody door; the door's own refusal comes back as a `HostRefusal`, on either path. */
async function hostDoor(act: "host.state" | "host.roll" | "host.invite", args: Record<string, unknown> = {}): Promise<{ output: Record<string, unknown>; via: string }> {
  try {
    const r = await sealedActVia(act, args);
    // The command's own word for where a door ran stays what every store door says: `daemon` inside the standing vessel.
    return { output: r.result, via: r.via === "vessel" ? "daemon" : "direct" };
  } catch (err) {
    if (err instanceof SealedActRefused && err.reason === "act-refused") throw new HostRefusal(err.message);
    throw err;
  }
}

function nexusOf(args: ParsedArgs): string | undefined {
  const v = args.options["nexus"];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function refuse(args: ParsedArgs, verb: string, err: unknown): number {
  const message = err instanceof Error ? err.message : String(err);
  const code = err instanceof HostRefusal ? "refused" : "error";
  emit(args, { ok: false, error: { code, message }, human: () => console.error(`lares host${verb ? ` ${verb}` : ""}: ${message}`) });
  return exitFor(code);
}

export async function cmdHost(args: ParsedArgs): Promise<number> {
  const sub = args.positional[0];
  if (sub === undefined) return hostState(args);
  if (sub === "roll") return hostRoll(args);
  if (sub === "invite") return hostInvite(args);
  return refuseUsage(args, "host", helpLines("host"), `unknown sub-verb "${sub}"`);
}

interface HostedRow { nexusAid: string; epoch: string; previousEpoch: string | null; cap: number; redeemed: number; redeemedPrevious: number }

async function hostState(args: ParsedArgs): Promise<number> {
  try {
    const { output, via } = await hostDoor("host.state");
    const hosted = (output["nexuses"] ?? []) as HostedRow[];
    emit(args, {
      ok: true,
      data: { nexuses: hosted, via },
      human: () => {
        if (hosted.length === 0) { console.log("this hearth hosts no one yet — `lares host roll` opens its first epoch"); return; }
        for (const h of hosted) {
          console.log(`hosting in ${h.nexusAid}`);
          console.log(`  epoch:     ${h.epoch}   (redeemed ${h.redeemed})`);
          console.log(`  previous:  ${h.previousEpoch ?? "(none)"}${h.previousEpoch ? `   (redeemed ${h.redeemedPrevious})` : ""}`);
          console.log(`  cap:       ${h.cap} invite(s) per lineage per epoch`);
        }
      },
    });
    return 0;
  } catch (err) { return refuse(args, "", err); }
}

async function hostRoll(args: ParsedArgs): Promise<number> {
  const capRaw = args.options["cap"];
  const cap = capRaw === undefined ? undefined : Number(capRaw);
  if (cap !== undefined && (!Number.isSafeInteger(cap) || cap < 1)) {
    return refuseUsage(args, "host", helpLines("host"), `--cap takes a whole number of at least 1 (got "${String(capRaw)}")`);
  }
  try {
    const nexusAid = nexusOf(args);
    const vargs = { ...(nexusAid ? { nexusAid } : {}), ...(cap !== undefined ? { cap } : {}) };
    const { output: r, via } = await hostDoor("host.roll", vargs);
    emit(args, {
      ok: true,
      data: { nexusAid: r["nexusAid"], epoch: r["epoch"], previous: r["previous"], cap: r["cap"], docUrl: r["docUrl"], act: r["act"], via },
      human: () => {
        console.log(`hosting epoch rolled in ${String(r["nexusAid"])}`);
        console.log(`  epoch:     ${String(r["epoch"])}`);
        console.log(`  previous:  ${(r["previous"] as string | null) ?? "(none — the first epoch here)"}`);
        console.log(`  cap:       ${String(r["cap"])}`);
        console.log(`  act on:    ${String(r["docUrl"])}  (${via === "daemon" ? "the standing vessel's replica" : "this vessel's store"})`);
        console.log("  every grant and token two epochs back is now dead; roll again to end the previous epoch too.");
        console.log("  note: the walker route ships SHUT by name (house ruling \"Routes at the cutover\"): the epoch is written, but no gate seats a walker on it until a live grant reader opens the route.");
        if (Number(r["unswept"]) > 0) console.log(`  ${String(r["unswept"])} spend row(s) of dead epochs refused removal (bytes this vessel's key does not open); they stay on disk.`);
      },
    });
    return 0;
  } catch (err) { return refuse(args, "roll", err); }
}

async function hostInvite(args: ParsedArgs): Promise<number> {
  const relayRaw = args.options["relay"];
  const relay = typeof relayRaw === "string" && relayRaw.length > 0 ? relayRaw : undefined;
  try {
    const nexusAid = nexusOf(args);
    const vargs = { ...(nexusAid ? { nexusAid } : {}), ...(relay ? { relay } : {}) };
    const { output: r, via } = await hostDoor("host.invite", vargs);
    emit(args, {
      ok: true,
      data: { nexusAid: r["nexusAid"], epoch: r["epoch"], invite: r["invite"], via },
      human: () => {
        console.log(String(r["invite"]));
        console.error("  carry this to one newcomer; it redeems once, at this hearth's own gate. Nothing about it is kept here.");
        console.error("  note: the walker route ships SHUT by name (house ruling \"Routes at the cutover\"): no gate seats a walker on this invite until a live grant reader opens the route.");
      },
    });
    return 0;
  } catch (err) { return refuse(args, "invite", err); }
}
