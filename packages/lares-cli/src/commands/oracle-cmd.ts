/**
 * `lares oracle cast [--coins <six values>] --recipe <slug>` — the CLI skin of the `oracle-cast` verb: one I Ching cast
 * by three coins a line, written by the vessel as one tiddler under `casts/`.
 *
 * A CAST STANDS AS AN ACT. The vessel casts and lands the record once; reading it again never casts again. With no
 * `--coins` the vessel draws the coins through the platform's entropy door (`crypto.getRandomValues`); `--coins` hands
 * it the six values the operator threw with real coins (6, 7, 8 or 9, bottom line first), named
 * `operator:three-coins`. THE CLOCK SEAM sits at this edge: the command reads the time once and the verb reads none.
 *
 * The reading prints plainly by default (the figure, the change, the source of chance, each reading the wiki holds
 * with its attribution and license, and the cast's title); `--json` carries the verb's own answer verbatim as `data`,
 * the same body the MCP seat's `oracle_cast` hands back. The throw stands and the reading stays open.
 *
 * The container law holds: name `--recipe <slug>` (`--recipe default`, the worn face's daemon wiki) or `--bag <slug>`.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "@lararium/mesh/node";
import { PLATFORM_ENTROPY, seededEntropy } from "@lararium/mesh/entropy-door";
import { hex } from "@lararium/mesh";
import {
  ORACLE_THROW_STANDS, castFromCoins, castThreeCoins, castReadingTitles, castRecord, castText, parseCoins,
} from "@lararium/mesh/oracle-cast";
import { DaemonUnreachable, verbFailure } from "../verb-call.js";
import { containerArgs } from "../container-target.js";
import { emit, exitFor } from "../render.js";
import { DoorUsage, guardDoor, runDoor, wordOf, type DoorPlan } from "./door-call.js";
import { helpLines } from "../command-help.js";
import type { ParsedArgs } from "../parse-args.js";

/** The caster a line names none for: the operator at the keyboard. */
const DEFAULT_CASTER = "operator";

/** A nonce minted at the word, through the platform's entropy door. */
const mintNonce = (): string => hex(PLATFORM_ENTROPY.fill(new Uint8Array(16)));

/**
 * The verb and its args for `oracle cast`: the argument law, with no vessel in reach. `at` is the time the CLI read, kept
 * as testimony. ONE ASKING, ONE THROW: `--asking <words>` names the asking, so the same words answer the same standing
 * cast; a bare cast mints its nonce here, at the word, so a retry of this one line sends the same asking. `--fresh` (a
 * new nonce for the same words) and `--seed <words>` (coins drawn from the person's seed) ride a person's hand.
 */
export function oraclePlan(args: ParsedArgs, at: string, mint: () => string = mintNonce): DoorPlan {
  const out: Record<string, unknown> = { ...containerArgs(args, "oracle cast", "write"), at, caster: wordOf(args.options["caster"]) ?? DEFAULT_CASTER };
  const asking = wordOf(args.options["asking"]);
  const seed = wordOf(args.options["seed"]);
  const fresh = args.flags["fresh"] === true;
  const coins = wordOf(args.options["coins"]);
  if (seed !== null && fresh) throw new DoorUsage("--seed and --fresh name two hands for one throw; pass one (`--seed <words>` throws the same coins for the same words, `--fresh` throws new ones)");
  if (seed !== null && coins !== null) throw new DoorUsage("--seed draws the coins and --coins names them; pass one");
  if (asking !== null) out["asking"] = asking;
  if (seed !== null) out["seed"] = seed;
  if (fresh || (asking === null && seed === null)) out["nonce"] = mint();
  if (fresh) out["fresh"] = true;
  if (coins !== null) {
    const lines = parseCoins(coins);
    if (lines === null) throw new DoorUsage(`--coins takes six line values of 6, 7, 8 or 9, bottom line first (e.g. --coins 7,8,9,6,7,7); got "${coins}"`);
    out["coins"] = lines;
  }
  return { verb: "oracle-cast", args: out };
}

interface Reading { title: string; absent?: boolean; caption?: string; attribution?: string; license?: string; source?: string; text?: string }

/** Read the checkout's carrier families using the same deserializer as the vessel. */
async function offlineCast(plan: DoorPlan): Promise<Record<string, unknown>> {
  const ask = { caster: String(plan.args["caster"]), at: String(plan.args["at"]) };
  const coins = plan.args["coins"] as readonly unknown[] | undefined;
  const seed = typeof plan.args["seed"] === "string" ? plan.args["seed"] : null;
  // A SLEEPING VESSEL KEEPS NO ASKING: its one throw lives in the vessel's record, so an asking with no seed and no coins
  // refuses here rather than draw coins no later ask could replay.
  if (plan.args["asking"] !== undefined && seed === null && !coins && plan.args["fresh"] !== true) {
    throw new DoorUsage("the vessel sleeps, and an asking keeps its one throw in the vessel's record: stand it (`lares vessel stand`) and ask again, or name a seed (`--seed <strong words>`) for a throw any later ask replays");
  }
  const cast = coins ? castFromCoins(coins, ask) : castThreeCoins(seed !== null ? seededEntropy(seed) : PLATFORM_ENTROPY, ask);
  const { deserializeCarrier } = await import("@lararium/tw5");
  const readings = castReadingTitles(cast).map((title) => {
    const relative = title.slice("lar:///ha.ka.ba/lares/library/oracles/".length);
    const path = join(repoRoot, "bags/crossroads/ha.ka.ba/lares/library/oracles", `${relative}.mem`);
    const records = deserializeCarrier(readFileSync(path, "utf8"), { title }).records;
    const root = records.find((record) => record["title"] === title);
    const slot = records.find((record) => record["title"] === `${title}#/reading`);
    if (!root || !slot) throw new Error(`offline oracle: carrier lacks reading ${title}`);
    const named: Record<string, unknown> = { title };
    for (const key of ["caption", "source", "license", "attribution"]) if (root[key] !== undefined) named[key] = root[key];
    if (slot["text"] !== undefined) named["text"] = slot["text"];
    return named;
  });
  return { band: "answered", decision: "put", created: false, title: castRecord(cast)["title"], cast: castRecord(cast), text: castText(cast), readings, note: ORACLE_THROW_STANDS, offline: true };
}

async function oracleCast(args: ParsedArgs): Promise<number> {
  const plan = oraclePlan(args, new Date().toISOString());
  let ran: Awaited<ReturnType<typeof runDoor>>;
  try { ran = await runDoor(args, "oracle cast", plan); }
  catch (error) {
    if (error instanceof DaemonUnreachable) {
      if (plan.args["recipe"] !== "default" || args.options["face"] || args.options["realm"]) throw error;
      ran = { ok: true, requestId: "", output: await offlineCast(plan) };
    } else {
      // OWED, NEVER FAILED: the vessel took the cast and this process stopped hearing back. The act stands; its outcome
      // reads back by id, and the same asking answers its standing cast, so a re-run never throws twice.
      const f = verbFailure(error);
      if (f.code !== "outcome-unknown" && f.code !== "outcome-committed") throw error;
      const asked = plan.args["asking"] !== undefined || plan.args["seed"] !== undefined;
      const readBack = f.requestId ? `read request ${f.requestId} with \`lares vessel request ${f.requestId}\`` : "read the casts under lar:///ha.ka.ba/lares/oracle/casts/";
      const hint = asked ? `the cast stays owed: run the same line again and the same asking answers its standing cast, never a second throw; or ${readBack}` : `the cast stays owed: ${readBack} before casting again`;
      emit(args, {
        ok: false, ...(f.requestId !== undefined ? { requestId: f.requestId } : {}),
        data: { band: "owed", ...(plan.args["asking"] !== undefined ? { asking: plan.args["asking"] } : {}) },
        error: { code: f.code, message: f.message, hint },
        human: () => { console.error(`lares oracle cast: owed: ${f.message}`); console.error(`  ${hint}`); },
      });
      return exitFor(f.code);
    }
  }
  if (!ran.ok) return ran.exit;
  const answer = ran.output;
  const band = answer["band"];
  if (band === "asks") {
    const asks = (answer["asks"] ?? {}) as { who?: string; answer?: string; why?: string };
    const line = asks.answer ?? "lares oracle cast";
    const message = `asks: ${asks.why ?? "a person's hand gives this throw"}; ${asks.who ?? "a person"} runs \`${line}\``;
    emit(args, {
      ok: false, requestId: ran.requestId, data: answer,
      error: { code: "asks-a-hand", message, hint: `run \`${line}\` from a person's own terminal` },
      human: () => console.error(`lares oracle cast: ${message}`),
    });
    return exitFor("asks-a-hand");
  }
  const decision = String(answer["decision"] ?? "");
  const ok = band === "answered" || decision === "put";
  const message = decision === "exists" ? `exists: a cast already stands at ${String(answer["title"])}; nothing moved` : `${decision}: ${String(answer["title"])}`;
  emit(args, {
    ok, requestId: ran.requestId, data: answer,
    ...(ok ? {} : { error: { code: decision === "exists" ? "conflict" : "verb-error", message } }),
    human: () => {
      if (!ok) { console.error(`lares oracle cast: ${message}`); return; }
      console.log(String(answer["text"] ?? ""));
      for (const reading of (answer["readings"] as Reading[] | undefined) ?? []) {
        console.log("");
        if (reading.absent) { console.log(`(${reading.title}: this wiki holds no such reading)`); continue; }
        console.log(`── ${reading.caption ?? reading.title}`);
        if (reading.text) console.log(reading.text);
        console.log(`   ${[reading.attribution, reading.license].filter(Boolean).join(" · ")}`);
      }
      console.log("");
      console.log(`cast: ${String(answer["title"])}`);
      if (answer["replayed"] === true) console.log("replayed: this asking already holds its throw; the same words answer it again (a person's --fresh throws anew)");
      if (typeof answer["asOf"] === "string") console.log(`readings as of: ${answer["asOf"]}`);
      if (answer["offline"] === true) console.log("offline: this cast remains in this reply; no record was saved");
    },
  });
  return exitFor(ok ? "ok" : decision === "exists" ? "conflict" : "verb-error");
}

/** The one verb the oracle door answers. */
export const CAST_DOOR_VERBS = ["cast"] as const;

export async function cmdOracle(args: ParsedArgs): Promise<number> {
  const sub = args.positional[0];
  if (sub !== CAST_DOOR_VERBS[0]) {
    if (sub) console.error(`lares oracle: unknown sub-verb "${sub}"`);
    for (const line of helpLines("oracle")) console.error(line);
    return 2;
  }
  return guardDoor(args, "oracle cast", () => oracleCast(args));
}

