/**
 * oracle-cast-verb — the `oracle-cast` verb every vessel answers: one I Ching cast, written as one tiddler.
 *
 *   args { recipe | bag, at: string, caster?: string, coins?: number[] | string }
 *   → { decision, created, title, bag, hash, cast, text, readings, note }
 *
 * A CAST STANDS AS AN ACT. The verb casts once and lands the result through the tiddler door's own put (`create`, so a
 * standing cast answers `exists` and nothing moves): the same gates, the same working layer, the same face. Reading the
 * tiddler again never casts again; the record holds the throw.
 *
 * ONE DOOR FOR CHANCE. With no `coins` the eighteen coins draw through the platform's entropy door
 * (`crypto.getRandomValues`), named in the record's `entropy` field; six typed `coins` (bottom line first) stand as the
 * operator's own throw, named `operator:three-coins`. THE CLOCK SEAM stays with the caller: `at` names the time of the
 * cast, and a call naming none refuses (`oracle-cast-untimed`).
 *
 * The answer carries the readings the wiki holds for the hexagrams cast (`oracles/doa`, `oracles/e-jing`), each read
 * through the tiddler door's own get, and names the ones this wiki holds none of. The throw stands and the
 * reading stays open.
 */

import { VerbRefusal } from "@lararium/mesh/verb-refusal";
import {
  ORACLE_THROW_STANDS, castFields, castFromCoins, castReadingTitles, castRecord, castText, castThreeCoins, parseCoins,
  type OracleCast,
} from "@lararium/mesh/oracle-cast";
import { PLATFORM_ENTROPY } from "@lararium/mesh/entropy-door";
import { makeTiddlerGetReactor, makeTiddlerPutReactor, type TiddlerVerbOptions } from "./tiddler-verbs.js";
import type { VerbReactor } from "./verb-dispatcher.js";

/** The caster a call names none for: the seat that placed it. */
const DEFAULT_CASTER = "lares";

function coinsOf(raw: unknown): readonly unknown[] | null {
  if (raw === undefined || raw === null) return null;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    const read = parseCoins(raw);
    if (read === null) throw new VerbRefusal("oracle-cast-coins", `oracle-cast-coins: \`coins\` names six line values of 6, 7, 8 or 9, bottom line first ("7,8,9,6,7,7"); got "${raw}"`);
    return read;
  }
  throw new VerbRefusal("oracle-cast-coins", "oracle-cast-coins: `coins` names six line values, a list or a line of text");
}

function castFor(args: Readonly<Record<string, unknown>>): OracleCast {
  const at = typeof args["at"] === "string" ? args["at"].trim() : "";
  if (at === "") throw new VerbRefusal("oracle-cast-untimed", "oracle-cast-untimed: name `at`, the time of the cast; the verb reads no clock");
  const caster = typeof args["caster"] === "string" && args["caster"].trim() !== "" ? args["caster"].trim() : DEFAULT_CASTER;
  const coins = coinsOf(args["coins"]);
  if (coins === null) return castThreeCoins(PLATFORM_ENTROPY, { caster, at });
  try {
    return castFromCoins(coins, { caster, at });
  } catch (fault) {
    throw new VerbRefusal("oracle-cast-coins", `oracle-cast-coins: ${fault instanceof Error ? fault.message : String(fault)}`);
  }
}

/** The container the call names, carried to each door call unchanged. */
function containerOf(args: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of ["recipe", "bag", "realm"]) if (args[key] !== undefined) out[key] = args[key];
  return out;
}

export function makeOracleCastReactor(opts: TiddlerVerbOptions): VerbReactor {
  const put = makeTiddlerPutReactor(opts);
  const get = makeTiddlerGetReactor(opts);
  return async (args, ctx) => {
    const cast = castFor(args);
    const container = containerOf(args);
    const { title, text, ...fields } = castFields(cast);
    const receipt = await put({ ...container, title, fields, text, create: true }, ctx) as Record<string, unknown>;
    const readings: Array<Record<string, unknown>> = [];
    for (const reading of castReadingTitles(cast)) {
      const root = (await get({ ...container, title: reading, fields: ["caption", "source", "license", "attribution"] }, ctx))["tiddler"] as { fields: Record<string, string> } | null;
      if (!root) { readings.push({ title: reading, absent: true }); continue; }
      const slot = (await get({ ...container, title: reading, slot: "#/reading" }, ctx))["tiddler"] as { fields: Record<string, string> } | null;
      const { title: _title, ...named } = root.fields;
      readings.push({ title: reading, ...named, ...(slot?.fields["text"] !== undefined ? { text: slot.fields["text"] } : {}) });
    }
    return {
      decision: receipt["decision"], created: receipt["created"] === true, title,
      ...(receipt["bag"] !== undefined ? { bag: receipt["bag"] } : {}),
      ...(receipt["hash"] !== undefined ? { hash: receipt["hash"] } : {}),
      cast: castRecord(cast), text: castText(cast), readings, note: ORACLE_THROW_STANDS,
    };
  };
}
