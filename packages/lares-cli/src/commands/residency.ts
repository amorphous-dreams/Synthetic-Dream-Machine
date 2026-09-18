/**
 * `lares bag pin <url> [--reason <text>]`
 * `lares bag unpin <url>`
 * `lares bag stats`
 *
 * THE DOORS CARRY `bag` AS THEIR AXIS, and the qualifier is the whole point. `residency` names four
 * things in this tree (`one-name-one-relation#/the-words-that-carry-more-than-one-thing` ranks it first
 * of them), so the STOWAGE axis takes its name in the surface an operator types: `bag stats`, never a
 * bare `residency`. `cmdResidency` below stays an internal spelling behind that door, and `"residency"`
 * survives as the daemon's wire verb. A header naming top-level `lares pin` / `lares residency` would
 * send a reader to type three commands that resolve nowhere.
 *
 * Operator-driven residency control. Pin guarantees a bag stays hot;
 * unpin demotes (the LRU may then evict if pressure rises). residency
 * prints the current pinned / wela / anu snapshot.
 *
 * unpin demotes standing synchronously, but does NOT force an immediate LRU
 * trim: the collector's background sweeper (wired at boot, default tick
 * 30s — bag-residency.ts's startSweeper/sweepOnce) is what actually evicts
 * an over-cap unpinned bag, on its next tick. So unpin's own report never
 * shows an eviction it just caused; a real one lands within one sweep tick.
 */

import { vesselDid } from "../env.js";
import { summaryOutput } from "../verb-result.js";
import { runVerb } from "../verb-call.js";
import type { ParsedArgs } from "../parse-args.js";

export async function cmdPin(args: ParsedArgs): Promise<number> {
  const url    = args.positional[0];
  const reason = args.options["reason"];
  if (!url) {
    console.error("usage: lares pin <bag-url> [--reason <text>]");
    return 2;
  }
  return await runResidencyCommand("pin", { url, ...(reason && { reason }) });
}

export async function cmdUnpin(args: ParsedArgs): Promise<number> {
  const url = args.positional[0];
  if (!url) {
    console.error("usage: lares unpin <bag-url>");
    return 2;
  }
  return await runResidencyCommand("unpin", { url });
}

/**
 * `lares register-cold <bag-url>` — mark a URL as known-but-not-loaded.
 * Oracle traversal calls this for URLs it discovers but doesn't need to
 * fetch yet. Hydrate-on-read is wired: composite-store.ts's `attachResidency`
 * hook bumps `residency.touch()` on every read that resolves through a
 * layer, so the first read through this URL via composite hydrates it.
 */
export async function cmdRegisterCold(args: ParsedArgs): Promise<number> {
  const url = args.positional[0];
  if (!url) {
    console.error("usage: lares register-cold <bag-url>");
    return 2;
  }
  return await runResidencyCommand("register-cold", { url });
}

export async function cmdResidency(_args: ParsedArgs): Promise<number> {
  // UDS fast path, WS fallback (the lares↔lararium binding).
  let r;
  try {
    r = await runVerb("residency", {}, await vesselDid());
  } catch (err) {
    console.error(`lares: ${err instanceof Error ? err.message : String(err)}`);
    console.error("  Start the daemon with `lares vessel stand --foreground` and try again.");
    return 3;
  }
  if (r.status === "error") {
    console.error(`residency query failed: ${r.errorMessage ?? "unknown"}`);
    return 4;
  }
  const stats = summaryOutput(r) ?? {};
  const pinned = (stats["pinned"] ?? []) as string[];
  const wela   = (stats["wela"]   ?? []) as Array<{ url: string; lastTouched: number; syncActive?: boolean }>;
  const anuCount = stats["anuCount"] as number;
  const hotCap   = stats["hotCap"]   as number;

  console.log("");
  console.log(`pinned (${pinned.length}):`);
  for (const u of pinned) console.log(`  ${u}`);
  console.log("");
  console.log(`wela (${wela.length}/${hotCap}):`);
  for (const e of wela) {
    const age   = Date.now() - e.lastTouched;
    const human = age < 60_000 ? `${Math.round(age/1000)}s ago` : `${Math.round(age/60_000)}m ago`;
    const sync  = e.syncActive ? "  (syncing)" : "";
    console.log(`  ${e.url}  — touched ${human}${sync}`);
  }
  console.log("");
  console.log(`anu count: ${anuCount}`);
  console.log("");
  return 0;
}

async function runResidencyCommand(name: string, args: Record<string, unknown>): Promise<number> {
  // UDS fast path, WS fallback (the lares↔lararium binding).
  let r;
  try {
    r = await runVerb(name, args, await vesselDid());
  } catch (err) {
    console.error(`lares: ${err instanceof Error ? err.message : String(err)}`);
    console.error("  Start the daemon with `lares vessel stand --foreground` and try again.");
    return 3;
  }
  if (r.status === "error") {
    console.error(`${name} failed: ${r.errorMessage ?? "unknown"}`);
    return 4;
  }
  console.log(`${name}: ${JSON.stringify(summaryOutput(r) ?? {}, null, 2)}`);
  return 0;
}
