/**
 * `lares vessel seed` — plant the disk holdings into the vessel docs.
 *
 * A nameless entity composed of #has caps: disk-grant (the bags dir) · synced-tree · the two
 * existing feed gestures, kind-routed per holding:
 *   - SYSTEM bags (lares, lararium — their docs mint at boot) → the diff-gated
 *     `ingest` gesture (disk-hash vs synced-hash vs island render-hash).
 *   - Every OTHER holding (sdm, elyncia, …) → the island's named road through the `act`
 *     gesture: CREATE the bag, LOAD onto the wiki's working layer, MOVE the whole layer into canon
 *     (W27: a write lands on a working layer, and canon takes it by promotion).
 *
 * IDEMPOTENT (causal-island law): each run converges from whatever state it finds —
 * a virgin Synced tree reads everything NEW; a converged tree no-ops per holding.
 * No toggles: whether a zero-new wave counts as failure belongs to the CALLER's flow
 * (founding feeds the initial corpus; a daily seed accepts convergence).
 *
 *   lares vessel seed [--apply] [--yes]   — preview per holding by default (the ingest posture)
 */

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { bagUri, LARES_DOC_URI, LARARIUM_DOC_URI, identitySlug } from "@lararium/mesh";
import type { ParsedArgs } from "../parse-args.js";
import { emit } from "../render.js";
import { larBagsDir } from "../env.js";
import { cmdIngest } from "./ingest.js";
import { cmdAct } from "./act.js";

/**
 * The holdings whose docs the vessel mints at boot — fed by the diff-gated ingest gesture.
 *
 * DERIVED from the bag URI constants (`LARES_DOC_URI`/`LARARIUM_DOC_URI`, the single owner of
 * "what these two holdings are named"), never hand-typed — a re-typed literal can drift out from
 * under the constants it means to mirror, and a set that can never match `discoverHoldings`'s
 * directory names is worse than an absent one: the branch below still reads as reachable while
 * the infrastructure bags silently take the LOAD route.
 */
export const SYSTEM_HOLDINGS = new Set(
  [identitySlug(LARES_DOC_URI), identitySlug(LARARIUM_DOC_URI)].filter(
    (s): s is string => s !== null,
  ),
);

export interface SeedHolding {
  readonly holding: string;               // "lares"
  readonly source: string;                // "<bags dir>/lares"
  readonly toBag: string;                 // "lar:///ha.ka.ba/bags/lares"
  readonly gesture: "ingest" | "load";    // the kind-route taken
  readonly exitCode: number;              // the gesture's verdict for this holding
}

/**
 * The holdings map — every dir under the BAGS DIR, discovered, never hardcoded.
 *
 * THE BAGS DIR SITES ON ITS OWN CAP (`larBagsDir`: `LAR_BAGS`, else `<corpus>/bags`), the same cap the daemon's
 * projection and the `ingest` and `act` gestures read. A vessel whose state and corpus rest on two mounts (the
 * container: `LAR_ROOT=/state`, `LAR_BAGS=/workspace/bags`) holds its bags apart from its root, so a seed that
 * joined `bags` onto the root read an empty map there and planted nothing.
 */
export function discoverHoldings(bagsDir: string): Array<{ holding: string; source: string; toBag: string }> {
  let names: string[] = [];
  try {
    // EVERY DIRECTORY UNDER bags/ IS A HOLDING. The kind-plane segment above already says these are bags,
    // so the entity name carries no marker of its own — and a filter demanding one matches nothing, returns
    // an empty roster, and seeds silently with a clean exit.
    names = readdirSync(bagsDir).filter((n) => !n.startsWith(".") && statSync(join(bagsDir, n)).isDirectory());
  } catch { return []; }
  return names.sort().map((holding) => ({
    holding,
    source: join(bagsDir, holding),
    // The disk dir `elyncia` names bag `bags/elyncia` — mint through bagUri so the seed
    // targets the bag the daemon registers.
    toBag: bagUri(holding),
  }));
}

/**
 * Feed ONE holding back into its doc — the kind-route (ingest for system bags, the island's named road
 * for the rest), lifted out so the whole-store `seedRun` shares ONE kind-routed spelling for feeding a holding.
 * Returns this holding's verdict row.
 *
 * THE NAMED ROAD (W27: a write lands on a working layer, and canon takes it by promotion). A LOAD into a canon
 * bag refuses `load-into-canon` and names this road, and the seed walks it as any hand would, through the one
 * public act gesture: CREATE the bag (idempotent), LOAD onto the wiki's working layer (the act mounts that wiki),
 * then ONE title-less MOVE from the working layer into canon, which promotes every live title the layer holds. No founding door stands: the rite's seed and the daily seed walk one road.
 */
export async function seedHolding(
  args: ParsedArgs,
  h: { holding: string; source: string; toBag: string },
): Promise<SeedHolding> {
  if (SYSTEM_HOLDINGS.has(h.holding)) {
    // Infrastructure bags (lares/lararium) flow as NAMELESS ENTITIES — no special auto-confirm.
    // A converged bag submits zero (silent no-op); a bag with genuinely NEW content trips the
    // ingest gate's "confirmation required" WITHOUT `--yes` — and that is the FEATURE: new infra
    // content SURFACES for the operator to grade on a gradient (approve → re-run with --yes, or
    // abort), never silently auto-applied. `--yes` (the operator's relayed approval) passes through.
    const exitCode = await cmdIngest({
      command: "ingest",
      positional: [],
      options: { ...args.options, source: h.source, to: h.toBag },
      flags: args.flags,
    });
    return { ...h, gesture: "ingest", exitCode };
  }
  const working = workingLayerOf(h.toBag);
  // LOAD refuses an unregistered bag (cap-denied) — CREATE registers the
  // catalog-corpus entry first. CREATE converges idempotently (same content
  // id → same outcome), so every seed run may lead
  // with it. Applied runs only — a preview mutates nothing.
  const flags = args.flags["apply"]
    ? { ...args.flags, yes: true }
    : { ...args.flags, "dry-run": true };
  if (args.flags["apply"]) {
    const createCode = await cmdAct({
      command: "act",
      positional: ["CREATE"],
      options: { ...args.options, bag: h.toBag },
      flags: { ...args.flags, yes: true },
    });
    if (createCode !== 0) return { ...h, gesture: "load", exitCode: createCode };
  }
  const loadCode = await cmdAct({
    command: "act",
    positional: ["LOAD"],
    options: { ...args.options, "source-uri": h.source, to: working },
    flags,
  });
  if (loadCode !== 0 || !args.flags["apply"]) return { ...h, gesture: "load", exitCode: loadCode };
  // THE PROMOTION: one title-less MOVE carries the whole working layer into canon. The seed names no title: the
  // island's answer rides bounded past the outcome cap, and a memetic record takes its name from its head.
  const moveCode = await cmdAct({
    command: "act",
    positional: ["MOVE"],
    options: { ...args.options, from: working, to: h.toBag },
    flags: { ...args.flags, yes: true },
  });
  return { ...h, gesture: "load", exitCode: moveCode };
}

/** The working layer of the wiki a canon bag opens as (W27: every bag opens as its own wiki). */
function workingLayerOf(canonBag: string): string {
  const slug = canonBag.slice(canonBag.lastIndexOf("/") + 1);
  return `lar:///ha.ka.ba/wikis/${slug}/working`;
}

/**
 * The core run — one existing gesture per holding, sequential (one island gate, no
 * write contention). Continues past a failing holding (converge what it can); the
 * caller reads per-holding exit codes.
 */
export async function seedRun(args: ParsedArgs): Promise<SeedHolding[]> {
  const holdings = discoverHoldings(larBagsDir());
  const ledger: SeedHolding[] = [];
  for (const h of holdings) ledger.push(await seedHolding(args, h));
  return ledger;
}

export async function cmdSeed(args: ParsedArgs): Promise<number> {
  const bagsDir = larBagsDir();
  const holdings = discoverHoldings(bagsDir);
  if (holdings.length === 0) {
    emit(args, {
      ok: false,
      error: { code: "not-found", message: `no holdings under ${bagsDir}` },
      human: () => console.error(`lares vessel seed: no holdings under ${bagsDir}`),
    });
    return 3;
  }
  console.log(`[seed] ${holdings.length} holding(s): ${holdings.map((h) => h.holding).join(" · ")}${args.flags["apply"] ? "" : "  (preview — pass --apply)"}`);
  const ledger = await seedRun(args);
  const failed = ledger.filter((h) => h.exitCode !== 0);
  for (const h of failed) console.error(`[seed] ${h.holding} (${h.gesture}) → exit ${h.exitCode}`);
  console.log(`[seed] ${ledger.length - failed.length}/${ledger.length} holding(s) converged`);
  return failed.length === 0 ? 0 : 1;
}
