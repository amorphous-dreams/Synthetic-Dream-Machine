/**
 * `lares sense` lifecycle sub-verbs — the DURABLE sensorium lifecycle door, run DIRECT (CLI → the node
 * lifecycle-verb functions over manifest.json; no store holder, no daemon needed).
 *
 * THE HAND VERBS READ A HAND (hitl-reads-a-hand). `harden`, `retire`, `un-retire` and `purge` run on a person's
 * hand at a real terminal alone. With no socket between this command and the vessel, the command reads its own
 * branch through the house hand gate (`readOwnHand`): a harness mark in its environment or a harness on its parent
 * chain refuses `hand-act-only`, an unreadable chain refuses `hand-unattested`, and nothing moves. `--approve`
 * still names the intent on harden, retire and purge; it approves nothing by itself. The read (roster, at two
 * grains), the reversible re-settle (reconcile) and the pioneer build run for every caller.
 *
 *   lares sense roster                         list every sensorium + its lifecycle
 *   lares sense roster   <name>                one sensorium's manifest facets (the same read, one grain finer)
 *   lares sense reconcile <name> | --all       re-settle against evidence (on-demand; idempotent)
 *   lares sense build    <name> --ephemeral    mint a fresh pioneer (refuses a name-collision)
 *   lares sense harden  <name> --approve      climb a rung (in-place field-flip)   [+ --store-swap <t>, gated]   hand
 *   lares sense retire   <name> --grounds <g> --approve   judged tombstone (NO byte-delete)                   hand
 *   lares sense un-retire <name>               move-not-delete restore of the prior state                        hand
 *   lares sense purge    <name> --approve      the irreversible byte GC (tombstone-only)                         hand
 *
 * The daemon carries the same verbs for a terminal's session alone (its reactor reads the asker the door booked),
 * and no MCP tool carries a hand verb: a seat names the command for the operator to run.
 *
 * Meme: lar:///ha.ka.ba/lararium/api/living-grammar-palace#/phased-plan
 */

import {
  rosterSensoria, inspectSensorium, reconcileSensorium, reconcileAllSensoria,
  buildEphemeralSensorium, promoteSensorium, retireSensorium, unRetireSensorium, purgeSensorium,
  sensoriumDir, readOwnHand, handRefusalOf, type HandReading, type HandRefusalCode,
} from "@lararium/node";
import { guardHitl, MUSTIE_GROUNDS, type SenseHand } from "@lararium/mesh/sensorium-lifecycle";
import { emit, exitFor } from "../render.js";
import type { ParsedArgs } from "../parse-args.js";

/** How a hand verb reads the hand behind this command: the house gate over the command's own branch. A suite names its reading. */
export type HandRead = () => HandReading;
const ownHand: HandRead = () => readOwnHand({ proveRoute: false });

/** A hand verb's refusal: the reading's own code, and the command the operator runs on their own terminal. */
export class HandActRefused extends Error {
  override readonly name = "HandActRefused";
  constructor(readonly code: HandRefusalCode, readonly verb: string, readonly line: string) {
    super(handRefusalOf(code, { act: `\`${verb}\``, reads: "branch", line }).message);
  }
}

/** Read the hand behind a hand verb, answering the value that approves it (`guardHitl`); a refusal throws `HandActRefused`. */
export function handFor(verb: string, line: string, hand: HandRead): SenseHand {
  const read = hand();
  if ("refusal" in read) throw new HandActRefused(read.refusal, verb, line);
  return "hand";
}

/** Emit one lifecycle outcome uniformly (legible-intent: the verb + its result ride the payload). */
function landed(args: ParsedArgs, verb: string, data: unknown): number {
  emit(args, {
    ok: true,
    data: { verb, result: data },
    human: () => { console.log(`lares sense ${verb}\n`); console.log(JSON.stringify(data, null, 2)); },
  });
  return 0;
}

/** Emit one lifecycle error uniformly; a hand refusal carries its own code (`hand-act-only` · `hand-unattested`). */
function refused(args: ParsedArgs, verb: string, message: string, hint?: string, code = "verb-error"): number {
  emit(args, {
    ok: false,
    error: { code, message, ...(hint ? { hint } : {}) },
    human: () => console.error(`lares sense ${verb} — ${message}${hint ? `\n  ${hint}` : ""}`),
  });
  return exitFor(code);
}

/** Refuse a thrown error, keeping a hand refusal's own code. */
function refusedBy(args: ParsedArgs, verb: string, e: unknown, hint?: string): number {
  if (e instanceof HandActRefused) return refused(args, verb, e.message, undefined, e.code);
  return refused(args, verb, e instanceof Error ? e.message : String(e), hint);
}

/** A hand verb's gate: the hand behind the command first, then `--approve` naming the intent where the verb asks one. */
function requireHand(args: ParsedArgs, verb: string, line: string, hand: HandRead, approve = true): SenseHand {
  const read = handFor(`lares sense ${verb}`, line, hand);
  if (approve && args.flags["approve"] !== true) throw new Error(`${verb} names its intent with --approve: ${line}`);
  guardHitl(verb, read);
  return read;
}

/** ONE READ AT TWO GRAINS: bare, every sensorium and its lifecycle; with a name, that one sensorium's manifest facets. */
export function cmdSenseRoster(args: ParsedArgs): number {
  const name = args.positional[0];
  if (!name) return landed(args, "roster", { sensoria: rosterSensoria() });
  const insp = inspectSensorium(name);
  if (!insp) return refused(args, "roster", `no sensorium named '${name}'`, "lares sense roster   # every sensorium");
  return landed(args, "roster", insp);
}

export function cmdSenseReconcile(args: ParsedArgs): number {
  try {
    if (args.flags["all"] === true) return landed(args, "reconcile", { all: reconcileAllSensoria() });
    const name = args.positional[0];
    if (!name) return refused(args, "reconcile", "reconcile wants a sensorium name (or --all)", "lares sense reconcile <name>");
    return landed(args, "reconcile", reconcileSensorium(sensoriumDir(name)));
  } catch (e) {
    return refused(args, "reconcile", e instanceof Error ? e.message : String(e));
  }
}

export function cmdSenseBuild(args: ParsedArgs): number {
  const name = args.positional[0];
  if (!name) return refused(args, "build", "build wants a sensorium name", "lares sense build <name> --ephemeral");
  if (args.flags["ephemeral"] !== true) {
    return refused(args, "build", "build mints an EPHEMERAL sensorium — pass --ephemeral", "lares sense build <name> --ephemeral");
  }
  try {
    return landed(args, "build", buildEphemeralSensorium(name));
  } catch (e) {
    return refused(args, "build", e instanceof Error ? e.message : String(e));
  }
}

export function cmdSensePromote(args: ParsedArgs, hand: HandRead = ownHand): number {
  const name = args.positional[0];
  if (!name) return refused(args, "harden", "harden wants a sensorium name", "lares sense harden <name> --approve");
  try {
    const read = requireHand(args, "harden", `lares sense harden ${name} --approve`, hand);
    const storeSwapTarget = args.options["store-swap"];
    return landed(args, "harden", promoteSensorium(name, read, storeSwapTarget ? { storeSwapTarget } : {}));
  } catch (e) {
    return refusedBy(args, "harden", e);
  }
}

export function cmdSenseRetire(args: ParsedArgs, hand: HandRead = ownHand): number {
  const name = args.positional[0];
  if (!name) return refused(args, "retire", "retire wants a sensorium name", `lares sense retire <name> --grounds <${MUSTIE_GROUNDS.join("|")}> --approve`);
  try {
    const read = requireHand(args, "retire", `lares sense retire ${name} --grounds <${MUSTIE_GROUNDS.join("|")}> --approve`, hand);
    return landed(args, "retire", retireSensorium(name, args.options["grounds"], read));
  } catch (e) {
    return refusedBy(args, "retire", e, `grounds: ${MUSTIE_GROUNDS.join(" · ")}`);
  }
}

export function cmdSenseUnRetire(args: ParsedArgs, hand: HandRead = ownHand): number {
  const name = args.positional[0];
  if (!name) return refused(args, "un-retire", "un-retire wants a sensorium name", "lares sense un-retire <name>");
  try {
    const read = requireHand(args, "un-retire", `lares sense un-retire ${name}`, hand, false);
    return landed(args, "un-retire", unRetireSensorium(name, read));
  } catch (e) {
    return refusedBy(args, "un-retire", e);
  }
}

export function cmdSensePurge(args: ParsedArgs, hand: HandRead = ownHand): number {
  const name = args.positional[0];
  if (!name) return refused(args, "purge", "purge wants a sensorium name", "lares sense purge <name> --approve");
  try {
    const read = requireHand(args, "purge", `lares sense purge ${name} --approve`, hand);
    return landed(args, "purge", purgeSensorium(name, read));
  } catch (e) {
    return refusedBy(args, "purge", e);
  }
}
