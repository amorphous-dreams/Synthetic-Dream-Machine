/**
 * oracle-cast-verb — the `oracle-cast` verb every vessel answers: one I Ching cast, written as one tiddler.
 *
 *   args { recipe | bag, at: string, caster?: string, asking?: string, nonce?: string, fresh?: true, seed?: string,
 *          coins?: number[] | string }
 *   → { band, intent, replayed, decision, created, title, bag, hash, cast, text, readings, asOf, note }
 *
 * THE DOOR ANSWERS ON A BAND (`@lararium/mesh` door-band): `answered` carries the cast inline; `asks` names the hand
 * that gives a fresh throw or a seed; a refusal (`void`) crosses as a named `VerbRefusal`.
 *
 * ONE ASKING, ONE THROW (idempotent per asking, the default). The asking's id hashes who asks (`bookedAsker`: the hand
 * and presenter the vessel's door booked, never the caller's `caster`, which rides as annotation alone), the asking's
 * words normalized (`normalizeAsking`: case, spacing, Unicode form and trailing punctuation never re-roll), the nonce
 * the caller minted at the word, the seed and any typed coins (`askingId`), and its cast lands under a title that id
 * names. A second ask of the same asking (a retry after a lost answer, or the same words again) finds that cast
 * standing and answers it, `replayed`, with no new draw: a retried cast never commits twice.
 *
 * NAME THE QUERY BEFORE THE CAST. A seat's bare cast (no asking, nonce or seed) answers `asks`, its cure naming
 * `--asking '<the fork>'`, so a seat never re-rolls by asking nothing. A person's bare cast mints its own nonce.
 *
 * THE PERSON'S HAND opens the second mode: `fresh` (a new nonce minted at the word, so the same words throw again) and
 * `seed` (the coins draw from a door seeded by the person's words). A seat asks either, or names a nonce of its own, and the door answers `asks`,
 * naming the line a person runs; nothing moves. A LOW-ENTROPY SEED READS BACK: the record names the seed by a 16-hex
 * digest and the asking by a 16-hex id, so a short or common seed can be guessed from them; choose a strong one.
 *
 * ONE DOOR FOR CHANCE. A draw takes the platform's entropy door (`crypto.getRandomValues`), or the seeded door; six
 * typed `coins` (bottom line first) stand as the operator's own throw, named `operator:three-coins`. THE CLOCK SEAM
 * stays with the caller: `at` names the time of the cast as testimony, a call naming none refuses
 * (`oracle-cast-untimed`), and the time never names the cast.
 *
 * The answer carries the readings the wiki holds for the hexagrams cast (`oracles/doa`, `oracles/e-jing`), each read
 * through the tiddler door's own get, labelled `asOf` the digest of the bytes read, and names the ones this wiki holds
 * none of. The throw stands and the reading stays open.
 */

import { VerbRefusal } from "@lararium/mesh/verb-refusal";
import { canonicalJsonBytes, hex, sha256HexBytesSync } from "@lararium/mesh/crypto";
import type { DoorBand } from "@lararium/mesh/door-band";
import {
  ORACLE_THROW_STANDS, askingCastTitle, askingId, castFields, castFromCoins, castFromLines, castReadingTitles, castRecord,
  castText, castThreeCoins, parseCoins, type LineValue, type OracleCast,
} from "@lararium/mesh/oracle-cast";
import { PLATFORM_ENTROPY, seededEntropy } from "@lararium/mesh/entropy-door";
import { makeTiddlerGetReactor, makeTiddlerPutReactor, type TiddlerVerbOptions } from "./tiddler-verbs.js";
import type { VerbContext, VerbReactor } from "./verb-dispatcher.js";

/** The caster a call names none for: the seat that placed it. */
const DEFAULT_CASTER = "lares";

function coinsOf(raw: unknown): readonly LineValue[] | null {
  if (raw === undefined || raw === null) return null;
  let values: readonly unknown[];
  if (Array.isArray(raw)) values = raw;
  else if (typeof raw === "string") {
    const read = parseCoins(raw);
    if (read === null) throw new VerbRefusal("oracle-cast-coins", `oracle-cast-coins: \`coins\` names six line values of 6, 7, 8 or 9, bottom line first ("7,8,9,6,7,7"); got "${raw}"`);
    values = read;
  } else throw new VerbRefusal("oracle-cast-coins", "oracle-cast-coins: `coins` names six line values, a list or a line of text");
  try {
    return castFromCoins(values, { caster: "-", at: "-" }).lines;
  } catch (fault) {
    throw new VerbRefusal("oracle-cast-coins", `oracle-cast-coins: ${fault instanceof Error ? fault.message : String(fault)}`);
  }
}

const wordArg = (raw: unknown): string => (typeof raw === "string" ? raw.trim() : "");

/** A nonce minted through the platform's entropy door, for a bare cast that named none. */
function mintNonce(): string {
  return hex(PLATFORM_ENTROPY.fill(new Uint8Array(16)));
}

/** The container the call names, carried to each door call unchanged. */
function containerOf(args: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of ["recipe", "bag", "realm"]) if (args[key] !== undefined) out[key] = args[key];
  return out;
}

/** A standing cast's record read back as its cast; null where the record reads otherwise. */
function standingCast(fields: Readonly<Record<string, string>>): OracleCast | null {
  const lines = parseCoins(String(fields["lines"] ?? ""));
  const caster = String(fields["caster"] ?? "").trim();
  const at = String(fields["cast-at"] ?? "").trim();
  if (lines === null || caster === "" || at === "") return null;
  return castFromLines(lines, String(fields["entropy"] ?? ""), { caster, at });
}

/** Who asks, as the vessel's door booked it: the hand (`seat`, `cli`, `tab`) and the presenter, never a caller's word. */
export function bookedAsker(ctx: Pick<VerbContext, "asker" | "presenter" | "worn">): string {
  return `${ctx.asker ?? "unbooked"}:${ctx.worn?.presenter ?? ctx.presenter ?? ""}`;
}

/** The line a person runs to give what the seat asked: the asking's own words, with the hand's flag. */
function handLine(args: Readonly<Record<string, unknown>>, asking: string, mode: "fresh" | "seed"): string {
  const container = typeof args["bag"] === "string" ? `--bag ${args["bag"]}` : `--recipe ${typeof args["recipe"] === "string" ? args["recipe"] : "default"}`;
  const words = asking !== "" ? ` --asking ${JSON.stringify(asking)}` : "";
  return `lares oracle cast ${container}${words} ${mode === "fresh" ? "--fresh" : "--seed <your words>"}`;
}

export function makeOracleCastReactor(opts: TiddlerVerbOptions): VerbReactor {
  const put = makeTiddlerPutReactor(opts);
  const get = makeTiddlerGetReactor(opts);
  return async (args, ctx) => {
    const at = wordArg(args["at"]);
    if (at === "") throw new VerbRefusal("oracle-cast-untimed", "oracle-cast-untimed: name `at`, the time of the cast; the verb reads no clock");
    const caster = wordArg(args["caster"]) || DEFAULT_CASTER;
    const coins = coinsOf(args["coins"]);
    const asking = wordArg(args["asking"]);
    const seed = wordArg(args["seed"]);
    const fresh = args["fresh"] === true;
    let nonce = wordArg(args["nonce"]);
    if (fresh && nonce === "") throw new VerbRefusal("oracle-cast-fresh-unminted", "oracle-cast-fresh-unminted: a fresh throw carries the nonce its caller minted at the word; run `lares oracle cast --fresh`, which mints one");
    // THE PERSON'S HAND: a seat never re-throws an asking or seeds the coins; it asks, and nothing moves.
    // A seat's own nonce re-throws as surely as `fresh`, so it meets the same hand.
    if ((fresh || seed !== "" || nonce !== "") && ctx.asker === "seat") {
      const mode = seed !== "" && !fresh ? "seed" : "fresh";
      const band: DoorBand = "asks";
      return {
        band, decision: "asks",
        asks: { who: "a person's hand", answer: handLine(args, asking, mode), why: `a ${mode === "fresh" ? "fresh throw" : "seeded throw"} rides a person's hand; a seat's asking stands on its one throw` },
        note: ORACLE_THROW_STANDS,
      };
    }
    if (asking === "" && nonce === "" && seed === "") {
      if (ctx.asker === "seat") {
        const band: DoorBand = "asks";
        const container = typeof args["bag"] === "string" ? `--bag ${args["bag"]}` : `--recipe ${typeof args["recipe"] === "string" ? args["recipe"] : "default"}`;
        return {
          band, decision: "asks",
          asks: { who: "the seat itself", answer: `lares oracle cast ${container} --asking '<the fork>'`, why: "name your query before the cast; a seat's throw stands on its asking" },
          note: ORACLE_THROW_STANDS,
        };
      }
      nonce = mintNonce();
    }
    const intent = askingId({ asker: bookedAsker(ctx), asking, nonce, seed, ...(coins ? { coins } : {}) });
    const title = askingCastTitle(intent);
    const container = containerOf(args);

    const readStanding = async (): Promise<OracleCast | null> => {
      const held = (await get({ ...container, title }, ctx))["tiddler"] as { fields: Record<string, string> } | null;
      return held ? standingCast(held.fields) : null;
    };

    let cast = await readStanding();
    let receipt: Record<string, unknown> = { decision: "exists", created: false };
    if (cast === null) {
      const drawn = coins ? castFromCoins(coins, { caster, at })
        : castThreeCoins(seed !== "" ? seededEntropy(seed) : PLATFORM_ENTROPY, { caster, at });
      const { title: _title, text, ...fields } = castFields(drawn, { title, intent, ...(asking !== "" ? { asking } : {}) });
      receipt = await put({ ...container, title, fields, text, create: true }, ctx) as Record<string, unknown>;
      cast = receipt["decision"] === "exists" ? await readStanding() : drawn;
      if (cast === null) throw new VerbRefusal("oracle-cast-record-torn", `oracle-cast-record-torn: ${title} stands but reads as no cast; read it with \`lares tiddler get ${title} --recipe default\``);
    }
    const replayed = receipt["created"] !== true;

    const readings: Array<Record<string, unknown>> = [];
    for (const reading of castReadingTitles(cast)) {
      const root = (await get({ ...container, title: reading, fields: ["caption", "source", "license", "attribution"] }, ctx))["tiddler"] as { fields: Record<string, string> } | null;
      if (!root) { readings.push({ title: reading, absent: true }); continue; }
      const slot = (await get({ ...container, title: reading, slot: "#/reading" }, ctx))["tiddler"] as { fields: Record<string, string> } | null;
      const { title: _title, ...named } = root.fields;
      readings.push({ title: reading, ...named, ...(slot?.fields["text"] !== undefined ? { text: slot.fields["text"] } : {}) });
    }
    const band: DoorBand = "answered";
    return {
      band, intent, replayed,
      decision: receipt["decision"], created: receipt["created"] === true, title,
      ...(receipt["bag"] !== undefined ? { bag: receipt["bag"] } : {}),
      ...(receipt["hash"] !== undefined ? { hash: receipt["hash"] } : {}),
      cast: { ...castRecord(cast), title }, text: castText(cast), readings,
      asOf: sha256HexBytesSync(canonicalJsonBytes(readings)).slice(0, 16),
      note: ORACLE_THROW_STANDS,
    };
  };
}
