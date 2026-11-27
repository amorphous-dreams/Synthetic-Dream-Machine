/**
 * `lares oracle cast --recipe <slug> [--by <kind>] [--uncertain <words>] [--observe <pointers>] [--asking <the fork>] [--coins <six values>]`
 * — the CLI skin of the `oracle-cast` verb (`lar:///library.oracle.speaks`): one consult of the oracle whose corpus rests on
 * the library shelf `--by` names (`library/oracles/<kind>/`, default `e-jing`), landed by the vessel once as an OODA-HA meme
 * under `casts/`. The shelf's index declares its method (e-jing and doa: `three-coins`, the I Ching by three coins a line);
 * the door keeps the spelling `oracle cast` as its skin. `--observe` names the arm's context pointers and `--uncertain` the gathered
 * uncertainty; they fill the meme's first slots, and the slots the seat owes print with the append line that fills them.
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

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "@lararium/mesh/node";
import { PLATFORM_ENTROPY, seededEntropy } from "@lararium/mesh/entropy-door";
import { hex } from "@lararium/mesh/crypto";
import {
  DEFAULT_ORACLE_KIND, KIND_RE, ORACLE_SHELF_PREFIX, ORACLE_THROW_STANDS, RUN_METHODS, castFromCoins, castThreeCoins, castReadingTitles,
  castRecord, castText, parseCoins,
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
  const uncertain = wordOf(args.options["uncertain"]);
  const observe = wordOf(args.options["observe"]);
  const by = wordOf(args.options["by"]);
  if (seed !== null && fresh) throw new DoorUsage("--seed and --fresh name two hands for one throw; pass one (`--seed <words>` throws the same coins for the same words, `--fresh` throws new ones)");
  if (seed !== null && coins !== null) throw new DoorUsage("--seed draws the coins and --coins names them; pass one");
  if (by !== null && by !== DEFAULT_ORACLE_KIND) out["by"] = by;
  if (asking !== null) out["asking"] = asking;
  if (uncertain !== null) out["uncertain"] = uncertain;
  if (observe !== null) out["observe"] = observe.split(/\s+/u).filter((p) => p !== "");
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

/** The checkout's library shelves: `bags/crossroads/.../library/oracles/<kind>/index.mem`, the corpus a sleeping vessel reads. */
const SHELVES = join(repoRoot, "bags/crossroads/ha.ka.ba/lares/library/oracles");

/** Each shelf the checkout holds, with the method its index's meta declares (empty where it declares none). */
function checkoutShelves(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const kind of existsSync(SHELVES) ? readdirSync(SHELVES).sort() : []) {
    const index = join(SHELVES, kind, "index.mem");
    if (!KIND_RE.test(kind) || !existsSync(index)) continue;
    out[kind] = /^method\s*=\s*"([^"]*)"/m.exec(readFileSync(index, "utf8"))?.[1]?.trim() ?? "";
  }
  return out;
}

/** The shelf a sleeping vessel's consult reads: an unknown kind or a method the verb runs not yet refuses by name. */
function offlineShelf(kind: string): string {
  const shelves = checkoutShelves();
  const standing = Object.entries(shelves).filter(([, m]) => m !== "").map(([k, m]) => `${k} (${m})`).join(" · ") || "none";
  const cure = `consult a shelf that stands (\`lares oracle cast --by ${DEFAULT_ORACLE_KIND}\`); the shelves that stand: ${standing}`;
  const method = shelves[kind] ?? "";
  if (!KIND_RE.test(kind) || method === "") throw new DoorUsage(`oracle-shelf-unknown: no shelf ${ORACLE_SHELF_PREFIX}${kind}/index declares its method; ${cure}`);
  if (!RUN_METHODS.includes(method)) throw new DoorUsage(`oracle-method-unrun: the ${kind} shelf declares method \`${method}\`, which this verb runs not yet; ${cure}`);
  return method;
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
  const by = typeof plan.args["by"] === "string" ? plan.args["by"] : DEFAULT_ORACLE_KIND;
  const method = offlineShelf(by);
  const cast = coins ? castFromCoins(coins, ask) : castThreeCoins(seed !== null ? seededEntropy(seed) : PLATFORM_ENTROPY, ask);
  const { deserializeCarrier } = await import("@lararium/tw5");
  const readings = castReadingTitles(cast).map((title) => {
    const relative = title.slice("lar:///ha.ka.ba/lares/library/oracles/".length);
    const path = join(SHELVES, `${relative}.mem`);
    const records = deserializeCarrier(readFileSync(path, "utf8"), { title }).records;
    const root = records.find((record) => record["title"] === title);
    const slot = records.find((record) => record["title"] === `${title}#/reading`);
    if (!root || !slot) throw new Error(`offline oracle: carrier lacks reading ${title}`);
    const named: Record<string, unknown> = { title };
    for (const key of ["caption", "source", "license", "attribution"]) if (root[key] !== undefined) named[key] = root[key];
    if (slot["text"] !== undefined) named["text"] = slot["text"];
    return named;
  });
  return { band: "answered", decision: "put", created: false, title: castRecord(cast)["title"], by, method, cast: castRecord(cast), text: castText(cast), readings, note: ORACLE_THROW_STANDS, offline: true };
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
      if (answer["replayed"] === true) {
        console.log("replayed: this asking already holds its throw; the same words answer it again (a person's --fresh throws anew)");
        if (typeof answer["uncertain"] === "string" && answer["uncertain"] !== "") console.log(`kept: the uncertainty of the first throw: ${answer["uncertain"]}`);
      }
      for (const s of (answer["slots"] as Array<{ slot: string; phase: string; owed: boolean }> | undefined) ?? []) {
        if (s.owed) console.log(`owed: ${s.phase} ${s.slot}`);
      }
      const next = answer["next"] as { read?: string; append?: string } | undefined;
      if (next?.read) console.log(`read: ${next.read}`);
      if (next?.append) console.log(`append: ${next.append}`);
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

