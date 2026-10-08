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
 * ONE STORE DOOR. While the vessel stands, each door runs inside it (`host-*` verbs over the local socket), so a
 * roll lands on the replica its walkers sync; with no vessel standing, the door runs here (`store-door`).
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/the-invite
 */

import { runHostState, runHostRoll, runHostInvite, HostRefusal } from "@lararium/node";
import { larSealHome } from "../env.js";
import { emit, exitFor, refuseUsage } from "../render.js";
import { helpLines } from "../command-help.js";
import { throughStoreDoor } from "../store-door.js";
import type { ParsedArgs } from "../parse-args.js";

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

/** Run a host door through the store door; a door's refusal comes back as a `HostRefusal`, as on the direct path. */
async function hostDoor(verb: string, args: Record<string, unknown>, direct: () => Promise<Record<string, unknown>>): Promise<{ output: Record<string, unknown>; via: string }> {
  const r = await throughStoreDoor({ verb, args, direct });
  if (typeof r.output["refused"] === "string") throw new HostRefusal(r.output["refused"]);
  return r;
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
    const { output, via } = await hostDoor("host-state", {}, async () => ({ nexuses: await runHostState({ sealHome: larSealHome() }) }));
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
    const { output: r, via } = await hostDoor("host-roll", vargs, async () => ({ ...(await runHostRoll({ sealHome: larSealHome(), ...vargs })) }));
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
    const { output: r, via } = await hostDoor("host-invite", vargs, async () => ({ ...(await runHostInvite({ sealHome: larSealHome(), ...vargs })) }));
    emit(args, {
      ok: true,
      data: { nexusAid: r["nexusAid"], epoch: r["epoch"], invite: r["invite"], via },
      human: () => {
        console.log(String(r["invite"]));
        console.error("  carry this to one newcomer; it redeems once, at this hearth's own gate. Nothing about it is kept here.");
      },
    });
    return 0;
  } catch (err) { return refuse(args, "invite", err); }
}
