/**
 * host-cmd — the hearth's hosting door: `lares host`, `lares host roll`, `lares host invite`.
 *
 * `@lararium/node` carries `commands/host.ts` and this file imports from it; the `-cmd` suffix keeps the two
 * apart, as the house does wherever a node door and its CLI face share a name.
 *
 *   lares host                                     what this hearth hosts: per Nexus, the live epochs, the cap,
 *                                                  and how many invites were redeemed (counts, never rows)
 *   lares host roll   [--nexus <aid>] [--cap <n>]  roll the hosting epoch: a new signed act, landed on the
 *                                                  Nexus's carriage board; rolling twice is the hard roll
 *   lares host invite [--nexus <aid>] [--relay <ws-url>]
 *                                                  mint this hearth's own invite at the current epoch and print
 *                                                  the one string to carry; nothing about it is kept here
 *
 * Without `--nexus` a door acts on this hearth's own charter. A hearth hosts only in a Nexus it carries, and
 * only through a face that holds a leaf there.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/the-invite
 */

import { runHostState, runHostRoll, runHostInvite, HostRefusal } from "@lararium/node";
import { larSealHome } from "../env.js";
import { emit, exitFor, refuseUsage } from "../render.js";
import { helpLines } from "../command-help.js";
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

export async function cmdHost(args: ParsedArgs): Promise<number> {
  const sub = args.positional[0];
  if (sub === undefined) return hostState(args);
  if (sub === "roll") return hostRoll(args);
  if (sub === "invite") return hostInvite(args);
  return refuseUsage(args, "host", helpLines("host"), `unknown sub-verb "${sub}"`);
}

async function hostState(args: ParsedArgs): Promise<number> {
  try {
    const hosted = await runHostState({ sealHome: larSealHome() });
    emit(args, {
      ok: true,
      data: { nexuses: hosted },
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
    const r = await runHostRoll({ sealHome: larSealHome(), ...(nexusAid ? { nexusAid } : {}), ...(cap !== undefined ? { cap } : {}) });
    emit(args, {
      ok: true,
      data: { nexusAid: r.nexusAid, epoch: r.epoch, previous: r.previous, cap: r.cap, boardUrl: r.boardUrl, act: r.act },
      human: () => {
        console.log(`hosting epoch rolled in ${r.nexusAid}`);
        console.log(`  epoch:     ${r.epoch}`);
        console.log(`  previous:  ${r.previous ?? "(none — the first epoch here)"}`);
        console.log(`  cap:       ${r.cap}`);
        console.log(`  act on:    ${r.boardUrl}`);
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
    const r = await runHostInvite({ sealHome: larSealHome(), ...(nexusAid ? { nexusAid } : {}), ...(relay ? { relay } : {}) });
    emit(args, {
      ok: true,
      data: { nexusAid: r.nexusAid, epoch: r.epoch, invite: r.invite },
      human: () => {
        console.log(r.invite);
        console.error("  carry this to one newcomer; it redeems once, at this hearth's own gate. Nothing about it is kept here.");
      },
    });
    return 0;
  } catch (err) { return refuse(args, "invite", err); }
}
