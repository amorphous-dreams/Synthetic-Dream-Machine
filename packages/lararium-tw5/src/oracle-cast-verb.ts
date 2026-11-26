/**
 * oracle-cast-verb — the `oracle-cast` verb every vessel answers: one I Ching cast, written as one tiddler.
 *
 *   args { recipe | bag, at: string, caster?: string, asking?: string, uncertain?: string, observe?: string[] | string,
 *          nonce?: string, fresh?: true, seed?: string, coins?: number[] | string }
 *   → { band, intent, replayed, decision, created, title, bag, hash, cast, text, readings, asOf, uncertain, observe,
 *       slots, next, note }
 *
 * THE CAST LANDS AS AN OODA-HA MEME (`api/pono/oracle-loop`). The verb reads the act slots from canon: the affordance
 * carrier's `#/loop` (`@lararium/mesh/oracle-loop` ORACLE_CARRIER) calls the procedure's own `#/loop`, whose rows name each
 * slot, its order, its writer, what the house fills and what the seat owes. The ask's `observe` pointers and `uncertain`
 * words fill the first slots, the throw and every reading (each source credited) fill the next, and every slot the seat
 * still owes names its ask. The meme lands once through the meme door's own gate (`meme-put`, `create`); the seat's later
 * writes ride the slot append (`lares tiddler put <cast> --meme --slot '<the slot you owe>' --append '<words>'`). No slot name and no
 * ask lives in this file; a wiki answering no loop rows refuses `oracle-loop-unread`. A replay answers the uncertainty and
 * the pointers the record kept at the first throw, and never rewrites them.
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
  ORACLE_THROW_STANDS, askingCastTitle, askingId, castFromCoins, castFromLines, castReadingTitles, castRecord,
  castText, castThreeCoins, parseCoins, type LineValue, type OracleCast,
} from "@lararium/mesh/oracle-cast";
import { PLATFORM_ENTROPY, seededEntropy } from "@lararium/mesh/entropy-door";
import {
  LOOP_SLOT, ORACLE_CARRIER, castMemeBody, castMeta, fillLoop, kaheaTarget, loopSlots, parseHasRows, type LoopReading, type LoopSlot,
} from "@lararium/mesh/oracle-loop";
import { frameCarrier } from "@lararium/memetic-frame";
import { makeTiddlerGetReactor, type TiddlerVerbOptions } from "./tiddler-verbs.js";
import { makeMemePutReactor } from "./meme-verbs.js";
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

/** The context pointers an ask carries: a list, or one line split on whitespace (a pointer holds no space). */
function pointersArg(raw: unknown): string[] {
  const items = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/\s+/u) : [];
  return items.filter((p): p is string => typeof p === "string").map((p) => p.trim()).filter((p) => p !== "");
}

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
function handLine(args: Readonly<Record<string, unknown>>, asking: string, mode: "fresh" | "seed" | "coins"): string {
  const words = asking !== "" ? ` --asking ${JSON.stringify(asking)}` : "";
  const hand = mode === "fresh" ? "--fresh" : mode === "seed" ? "--seed <your words>" : "--coins <the six values you threw>";
  return `lares oracle cast ${containerFlag(args)}${words} ${hand}`;
}

/** The container flag a line repeats: the one the caller named. */
function containerFlag(args: Readonly<Record<string, unknown>>): string {
  return typeof args["bag"] === "string" ? `--bag ${args["bag"]}` : `--recipe ${typeof args["recipe"] === "string" ? args["recipe"] : "default"}`;
}

/**
 * The act slots, read from canon: the carrier's `#/loop`, through the `kahea` it carries to the slot of the law that owns
 * the procedure (or its own rows, where it carries them inline). An empty answer refuses: no act record lands unshaped.
 */
async function readLoop(get: VerbReactor, container: Record<string, unknown>, ctx: VerbContext): Promise<LoopSlot[]> {
  const slotText = async (title: string, slot: string): Promise<string> => {
    const held = (await get({ ...container, title, slot }, ctx))["tiddler"] as { fields: Record<string, string> } | null;
    return String(held?.fields["text"] ?? "");
  };
  const carried = await slotText(ORACLE_CARRIER, LOOP_SLOT);
  const call = kaheaTarget(carried);
  const text = call ? await slotText(call.uri, call.slot ?? LOOP_SLOT) : carried;
  const slots = loopSlots(parseHasRows(text));
  if (slots.length === 0) {
    throw new VerbRefusal("oracle-loop-unread", `oracle-loop-unread: this wiki answers no loop rows from ${ORACLE_CARRIER}${LOOP_SLOT}${call ? ` (it calls ${call.uri}${call.slot ?? LOOP_SLOT})` : ""}, so no act record lands; read it with \`lares tiddler get ${call?.uri ?? ORACLE_CARRIER} --recipe default --meme --slot '${call?.slot ?? LOOP_SLOT}'\` and cast in a wiki that stands the lares canon`);
  }
  return slots;
}

export function makeOracleCastReactor(opts: TiddlerVerbOptions): VerbReactor {
  const memePut = makeMemePutReactor({ ...opts });
  const get = makeTiddlerGetReactor(opts);
  return async (args, ctx) => {
    const at = wordArg(args["at"]);
    if (at === "") throw new VerbRefusal("oracle-cast-untimed", "oracle-cast-untimed: name `at`, the time of the cast; the verb reads no clock");
    const caster = wordArg(args["caster"]) || DEFAULT_CASTER;
    const coins = coinsOf(args["coins"]);
    const asking = wordArg(args["asking"]);
    const uncertainAsked = wordArg(args["uncertain"]);
    const observeAsked = pointersArg(args["observe"]);
    const seed = wordArg(args["seed"]);
    const fresh = args["fresh"] === true;
    let nonce = wordArg(args["nonce"]);
    if (fresh && nonce === "") throw new VerbRefusal("oracle-cast-fresh-unminted", "oracle-cast-fresh-unminted: a fresh throw carries the nonce its caller minted at the word; run `lares oracle cast --fresh`, which mints one");
    // THE PERSON'S HAND: a seat never re-throws an asking or seeds the coins; it asks, and nothing moves.
    // A seat's own nonce re-throws as surely as `fresh`, so it meets the same hand.
    // A SEAT NEVER PICKS THE FIGURE: typed coins name `operator:three-coins`, a person's own throw, so a seat's coins meet the
    // same hand as its fresh, seed and nonce (oracle-joints finding 1; the carrier's #/gate testimony rests on this check).
    if ((fresh || seed !== "" || nonce !== "" || coins !== null) && ctx.asker === "seat") {
      const mode = coins !== null ? "coins" : seed !== "" && !fresh ? "seed" : "fresh";
      const band: DoorBand = "asks";
      const why = mode === "coins" ? "typed coins name a person's own throw; a seat never picks the figure" : `a ${mode === "fresh" ? "fresh throw" : "seeded throw"} rides a person's hand; a seat's asking stands on its one throw`;
      return {
        band, decision: "asks",
        asks: { who: "a person's hand", answer: handLine(args, asking, mode), why },
        note: ORACLE_THROW_STANDS,
      };
    }
    if (asking === "" && nonce === "" && seed === "") {
      if (ctx.asker === "seat") {
        const band: DoorBand = "asks";
        return {
          band, decision: "asks",
          asks: { who: "the seat itself", answer: `lares oracle cast ${containerFlag(args)} --uncertain '<what you hold>' --asking '<the fork>'`, why: "name your query before the cast; a seat's throw stands on its asking" },
          note: ORACLE_THROW_STANDS,
        };
      }
      nonce = mintNonce();
    }
    const intent = askingId({ asker: bookedAsker(ctx), asking, nonce, seed, ...(coins ? { coins } : {}) });
    const title = askingCastTitle(intent);
    const container = containerOf(args);

    // WHAT THE RECORD KEPT: a replay answers the uncertainty and the pointers of the first throw, never the replay's own words.
    let kept: { uncertain: string; observe: string[] } = { uncertain: "", observe: [] };
    const readStanding = async (): Promise<OracleCast | null> => {
      const held = (await get({ ...container, title }, ctx))["tiddler"] as { fields: Record<string, string> } | null;
      if (held) kept = { uncertain: String(held.fields["uncertain"] ?? "").trim(), observe: pointersArg(held.fields["observe"]) };
      return held ? standingCast(held.fields) : null;
    };

    const readingsOf = async (of: OracleCast): Promise<Array<Record<string, unknown>>> => {
      const out: Array<Record<string, unknown>> = [];
      for (const reading of castReadingTitles(of)) {
        const root = (await get({ ...container, title: reading, fields: ["caption", "source", "license", "attribution"] }, ctx))["tiddler"] as { fields: Record<string, string> } | null;
        if (!root) { out.push({ title: reading, absent: true }); continue; }
        const slot = (await get({ ...container, title: reading, slot: "#/reading" }, ctx))["tiddler"] as { fields: Record<string, string> } | null;
        const { title: _title, ...named } = root.fields;
        out.push({ title: reading, ...named, ...(slot?.fields["text"] !== undefined ? { text: slot.fields["text"] } : {}) });
      }
      return out;
    };

    let cast = await readStanding();
    let readings: Array<Record<string, unknown>> | null = null;
    let landed: Array<{ slot: string; phase: string; writer: string; owed: boolean }> = [];
    let receipt: Record<string, unknown> = { decision: "exists", created: false };
    if (cast === null) {
      // The loop's shape reads from canon BEFORE any coin draws: a wiki with no loop rows refuses, and nothing moves.
      const slots = await readLoop(get, container, ctx);
      const drawn = coins ? castFromCoins(coins, { caster, at })
        : castThreeCoins(seed !== "" ? seededEntropy(seed) : PLATFORM_ENTROPY, { caster, at });
      readings = await readingsOf(drawn);
      const filled = fillLoop(slots, { observe: observeAsked, uncertain: uncertainAsked, asking, cast: drawn, readings: readings as unknown as LoopReading[] });
      const meta = castMeta(drawn, { title, intent, ...(asking !== "" ? { asking } : {}), ...(uncertainAsked !== "" ? { uncertain: uncertainAsked } : {}), observe: observeAsked });
      const text = frameCarrier({ head: { uri: title }, body: castMemeBody({ title, meta, cast: drawn, slots: filled }) });
      const placed = await memePut({ ...container, uri: title, text, create: true }, ctx) as Record<string, unknown>;
      const decision = String(placed["decision"] ?? "");
      if (decision === "refuse" || decision === "conflict") {
        const why = [placed["reason"], ...((placed["warnings"] as unknown[] | undefined) ?? [])].filter((w) => typeof w === "string" && w !== "").join("; ");
        throw new VerbRefusal("oracle-cast-unlanded", `oracle-cast-unlanded: the meme door answered ${decision} for ${title}${why ? ` (${why})` : ""}; nothing moved, and the same asking casts again`);
      }
      const created = decision === "ingest";
      receipt = { decision: created ? "put" : decision, created, ...(placed["bag"] !== undefined ? { bag: placed["bag"] } : {}), ...(placed["canonicalHash"] !== undefined ? { hash: placed["canonicalHash"] } : {}) };
      if (created) {
        kept = { uncertain: uncertainAsked, observe: observeAsked };
        landed = filled.map(({ slot, phase, writer, owed }) => ({ slot, phase, writer, owed }));
        cast = drawn;
      } else {
        cast = await readStanding();
        readings = null;
      }
      if (cast === null) throw new VerbRefusal("oracle-cast-record-torn", `oracle-cast-record-torn: ${title} stands but reads as no cast; read it with \`lares tiddler get ${title} --recipe default\``);
    }
    const replayed = receipt["created"] !== true;
    if (readings === null) readings = await readingsOf(cast);

    const band: DoorBand = "answered";
    const where = containerFlag(args);
    return {
      band, intent, replayed,
      decision: receipt["decision"], created: receipt["created"] === true, title,
      ...(receipt["bag"] !== undefined ? { bag: receipt["bag"] } : {}),
      ...(receipt["hash"] !== undefined ? { hash: receipt["hash"] } : {}),
      cast: { ...castRecord(cast), title }, text: castText(cast), readings,
      asOf: sha256HexBytesSync(canonicalJsonBytes(readings)).slice(0, 16),
      uncertain: kept.uncertain, observe: kept.observe,
      ...(landed.length > 0 ? { slots: landed } : {}),
      next: {
        read: `lares tiddler get ${title} ${where} --meme`,
        append: `lares tiddler put ${title} ${where} --meme --slot '<the slot you owe>' --append '<your words>'`,
      },
      note: ORACLE_THROW_STANDS,
    };
  };
}
