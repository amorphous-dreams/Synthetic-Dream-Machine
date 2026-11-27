/**
 * oracle-cast-verb — the `oracle-cast` verb every vessel answers (`lar:///oracle.library.consults`): one consult of an oracle
 * whose corpus rests on a library shelf, written as one tiddler.
 *
 *   args { recipe | bag, at: string, by?: string, caster?: string, asking?: string, uncertain?: string,
 *          observe?: string[] | string, nonce?: string, fresh?: true, seed?: string, coins?: number[] | string }
 *   → { band, intent, replayed, decision, created, title, bag, hash, by, method, cast, text, readings, asOf, uncertain,
 *       observe, slots, next, note }
 *
 * THE KIND RIDES AS DATA. `by` names a shelf (`library/oracles/<kind>/`, default `e-jing`), and the shelf's index record
 * declares its `method`; the verb runs the methods it knows (`RUN_METHODS`: `three-coins`), and a kind no shelf declares,
 * or a method the verb runs not yet, refuses by name (`oracle-shelf-unknown`, `oracle-method-unrun`) with the shelves that
 * stand. A new oracle joins as a shelf, never a new address or a new verb.
 *
 * THE CAST LANDS AS AN OODA-HA MEME (`api/pono/oracle-loop`). The verb reads the act slots from the carrier that answers
 * `lar:///oracle.library.consults` over the caller's stack: its `#/loop` calls the procedure's own `#/loop` (or carries rows
 * inline), whose rows name each slot, its order, its writer, what the house fills and what the seat owes. THE STACK FIRST,
 * THE PACK THE FLOOR: the target's own stack answers (a carrier a working layer seats above canon, at the seat or the bare
 * root, shapes the act in canon's place), then the affordance pack this binary baked from the canon tree (the carrier's
 * resolved `loop` rows), so a house that holds no carrier still casts; the cast lands in the target as before, and its
 * answer names the carrier slot that shaped it (`carrier`, and the has line's `carrier/<title> bag/<bag> base/<hash>`).
 * The ask's `observe` pointers and `uncertain`
 * words fill the first slots, the throw and every reading (each source credited) fill the next, and every slot the seat
 * still owes names its ask. The carrier lands once through the tiddler door's put (`create`), which splits a family's text into its slots; the seat's later
 * writes ride the slot append (`lares tiddler put '<cast>#/<the slot you owe>' --append '<words>'`). No slot name and no
 * ask lives in this file; where the stack and the pack both answer no loop rows, the cast refuses `oracle-loop-unread`. A replay answers the uncertainty and
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

import { VerbRefusal, isVerbRefusal } from "@lararium/mesh/verb-refusal";
import { canonicalJsonBytes, hex, sha256HexBytesSync } from "@lararium/mesh/crypto";
import type { DoorBand } from "@lararium/mesh/door-band";
import {
  DEFAULT_ORACLE_KIND, KIND_RE, ORACLE_THROW_STANDS, RUN_METHODS, askingCastTitle, askingId, castFromCoins, castFromLines,
  castReadingTitles, castRecord, castText, castThreeCoins, oracleShelfTitle, parseCoins, type LineValue, type OracleCast,
} from "@lararium/mesh/oracle-cast";
import { PLATFORM_ENTROPY, seededEntropy } from "@lararium/mesh/entropy-door";
import {
  LOOP_SLOT, ORACLE_AFFORDANCE, ORACLE_CARRIER, castMemeBody, castMeta, fillLoop, kaheaTarget, loopOfRungs, type CarrierReceipt, type LoopReading, type LoopRead, type LoopRung,
} from "@lararium/mesh/oracle-loop";
import { frameCarrier } from "@lararium/memetic-frame";
import { makeTiddlerGetReactor, makeTiddlerPutReactor, type TiddlerVerbOptions } from "./tiddler-verbs.js";
import type { VerbContext, VerbReactor } from "./verb-dispatcher.js";
import type { AffordancePack } from "./affordance-pack.js";
import { hasLine, param } from "./has-line.js";
import type { CallSeat } from "./modules/call.js";

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
  const kind = wordArg(args["by"]);
  const by = kind !== "" && kind !== DEFAULT_ORACLE_KIND ? ` --by ${kind}` : "";
  const words = `${by}${asking !== "" ? ` --asking ${JSON.stringify(asking)}` : ""}`;
  const hand = mode === "fresh" ? "--fresh" : mode === "seed" ? "--seed <your words>" : "--coins <the six values you threw>";
  return `lares oracle cast ${containerFlag(args)}${words} ${hand}`;
}

/** The container flag a line repeats: the one the caller named. */
function containerFlag(args: Readonly<Record<string, unknown>>): string {
  return typeof args["bag"] === "string" ? `--bag ${args["bag"]}` : `--recipe ${typeof args["recipe"] === "string" ? args["recipe"] : "default"}`;
}

/**
 * What the baked affordance pack carries for the consult: the carrier's resolved loop rows, each shelf's method, and the
 * floor's names (the canon carrier's title and the pack's hash) its receipt hands back.
 */
export interface PackedConsult {
  readonly loop: readonly string[];
  readonly shelves: Readonly<Record<string, { readonly title: string; readonly method: string }>>;
  readonly carrier?: string;
  readonly hash?: string;
}

/** Options past the tiddler door's own: where the baked pack's consult rows come from (a test seats its own). */
export interface OracleConsultOptions {
  readonly packed?: () => Promise<PackedConsult | null>;
}

/**
 * THE PACK, LOADED LAZILY AND BY A NAME NO BUNDLER FOLLOWS: the pack reader requires its JSON through `node:module`, which a
 * browser island never loads, so the browser reads no pack (the target's stack answers there) and a node vessel
 * reads the pack its own binary baked.
 */
const PACK_MODULE = "./affordance-pack.js";
async function packedFromAffordancePack(): Promise<PackedConsult | null> {
  try {
    const mod = await import(/* @vite-ignore */ PACK_MODULE) as { affordancePack(): AffordancePack };
    const pack = mod.affordancePack();
    const carrier = pack.carriers[ORACLE_AFFORDANCE];
    return { loop: carrier?.loop ?? [], shelves: pack.shelves ?? {}, ...(carrier ? { carrier: carrier.title } : {}), ...(pack.hash ? { hash: pack.hash } : {}) };
  } catch {
    return null;
  }
}

/** A door read that a wiki out of reach answers as nothing: the next source of canon then answers. */
async function quietly<T>(read: () => Promise<T>, none: T): Promise<T> {
  try { return await read(); } catch (fault) {
    if (isVerbRefusal(fault)) return none;
    throw fault;
  }
}

/**
 * The act slots, read from the carrier the caller's stack seats for the consult: the get of the bare address reads the carrier
 * that answers over the target's view (`carrierOf`: a bare-root record in any layer, else the stable seat, the topmost layer
 * answering either), its `#/loop` through the `kahea` it carries to the slot of the law that owns the procedure (or its own
 * rows, where it carries them inline). The baked pack stands as the floor. The rung that answered hands its receipt. Where
 * neither answers, the cast refuses: no act record lands unshaped.
 */
async function readLoop(get: VerbReactor, container: Record<string, unknown>, ctx: VerbContext, packed: () => Promise<PackedConsult | null>): Promise<LoopRead> {
  const slotRead = (title: string, slot: string): Promise<{ text: string; receipt: CarrierReceipt } | null> => quietly(async () => {
    const out = await get({ ...container, title, slot }, ctx);
    const held = out["tiddler"] as { fields: Record<string, string>; bag?: string | null; hash?: string } | null;
    if (!held) return null;
    const bag = held.bag ?? (typeof container["bag"] === "string" ? container["bag"] : String(container["recipe"] ?? ""));
    return { text: String(held.fields["text"] ?? ""), receipt: { carrier: String(out["title"] ?? `${title}${slot}`), bag, base: String(held.hash ?? "") } };
  }, null);
  const rungs: LoopRung[] = [];
  const carried = await slotRead(ORACLE_AFFORDANCE, LOOP_SLOT);
  const called = carried ? kaheaTarget(carried.text) : null;
  if (carried) {
    const law = called ? await slotRead(called.uri, called.slot ?? LOOP_SLOT) : null;
    rungs.push({ text: called ? law?.text ?? "" : carried.text, receipt: carried.receipt });
  }
  const floor = await packed();
  if (floor) rungs.push({ text: floor.loop.join("\n"), receipt: { carrier: `${floor.carrier ?? ORACLE_CARRIER}${LOOP_SLOT}`, bag: "pack", base: floor.hash ?? "" } });
  const read = loopOfRungs(rungs);
  if (read) return read;
  const where = containerFlag(container);
  throw new VerbRefusal("oracle-loop-unread", `oracle-loop-unread: neither the stack of ${where.replace(/^--/, "")} nor the baked affordance pack answers loop rows for ${ORACLE_AFFORDANCE}${LOOP_SLOT}${called ? ` (its carrier calls ${called.uri}${called.slot ?? LOOP_SLOT})` : ""}, so no act record lands; read it with \`lares tiddler get ${ORACLE_AFFORDANCE} ${where} --meme --slot '${LOOP_SLOT}'\`, then seat a carrier whose #/loop names act slots (or ingest the lares canon), or re-bake the pack (\`pnpm --filter @lararium/tw5 build\`)`);
}

/**
 * The shelf a consult names, and the method its index record declares: the target's stack (every layer it composes, canon
 * among them, the topmost answering), then the baked pack, the floor, the first that declares a method answering. A kind no source declares refuses `oracle-shelf-unknown`, a method the
 * verb runs not yet `oracle-method-unrun`, each naming the shelves that stand.
 */
async function readShelf(kind: string, get: VerbReactor, container: Record<string, unknown>, ctx: VerbContext, packed: () => Promise<PackedConsult | null>): Promise<{ kind: string; title: string; method: string }> {
  const shelves = (await packed())?.shelves ?? {};
  const kinds = Object.keys(shelves).sort();
  const standing = kinds.length > 0
    ? `the shelves that stand: ${kinds.map((k) => `${k} (${shelves[k]!.method})`).join(" · ")}`
    : `list the shelves with \`lares wiki filter '[prefix[lar:///ha.ka.ba/lares/library/oracles/]suffix[/index]]' ${containerFlag(container)}\``;
  const cure = `consult a shelf that stands (\`lares oracle cast --by ${DEFAULT_ORACLE_KIND}\`); ${standing}`;
  if (!KIND_RE.test(kind)) throw new VerbRefusal("oracle-shelf-unknown", `oracle-shelf-unknown: \`by\` names a shelf in lower-case words joined by hyphens; got "${kind}"; ${cure}`);
  const title = oracleShelfTitle(kind);
  // THE STACK, THEN THE FLOOR (comms-ux-enacts landing 3's fork, folded in landing 4): no canon-recipe rung; the target's stack
  // already composes canon beneath its working layers, and the pack answers where the stack holds no shelf.
  let method = await quietly(async () => {
    const held = (await get({ ...container, title, fields: ["method"] }, ctx))["tiddler"] as { fields: Record<string, string> } | null;
    return String(held?.fields["method"] ?? "").trim();
  }, "");
  if (method === "") method = String(shelves[kind]?.method ?? "").trim();
  if (method === "") throw new VerbRefusal("oracle-shelf-unknown", `oracle-shelf-unknown: no shelf ${title} declares its method, in this wiki's stack or the baked pack; ${cure}`);
  if (!RUN_METHODS.includes(method)) {
    throw new VerbRefusal("oracle-method-unrun", `oracle-method-unrun: the ${kind} shelf declares method \`${method}\`, which this verb runs not yet (it runs ${RUN_METHODS.join(", ")}); ${cure}`);
  }
  return { kind, title, method };
}

/** The consult's seat in the call registry (comms-ux-enacts landing 4): its address answers through `oracle-cast`. */
export const ORACLE_CALL_SEATS: Readonly<Record<string, CallSeat>> = Object.freeze({ [ORACLE_AFFORDANCE]: { verb: "oracle-cast" } });

export function makeOracleCastReactor(opts: TiddlerVerbOptions, consult: OracleConsultOptions = {}): VerbReactor {
  const put = makeTiddlerPutReactor(opts);
  const get = makeTiddlerGetReactor(opts);
  let packedOnce: Promise<PackedConsult | null> | null = null;
  const packed = consult.packed ?? ((): Promise<PackedConsult | null> => (packedOnce ??= packedFromAffordancePack()));
  return async (args, ctx) => {
    const at = wordArg(args["at"]);
    if (at === "") throw new VerbRefusal("oracle-cast-untimed", "oracle-cast-untimed: name `at`, the time of the cast; the verb reads no clock");
    const by = wordArg(args["by"]) || DEFAULT_ORACLE_KIND;
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
    const container = containerOf(args);
    // THE SHELF ANSWERS FIRST: a kind no shelf declares, or a method the verb runs not yet, refuses before any coin draws.
    const shelf = await readShelf(by, get, container, ctx, packed);
    const intent = askingId({ asker: bookedAsker(ctx), asking, nonce, seed, ...(coins ? { coins } : {}), by: shelf.kind });
    const title = askingCastTitle(intent);

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
    /** The carrier slot that shaped this cast's act record (fork 4); a replay reads no loop and names none. */
    let shaped: CarrierReceipt | null = null;
    if (cast === null) {
      // The loop's shape reads from the stack (the pack the floor) BEFORE any coin draws: where neither answers rows, it refuses, and nothing moves.
      const { slots, receipt: loopReceipt } = await readLoop(get, container, ctx, packed);
      shaped = loopReceipt;
      const drawn = coins ? castFromCoins(coins, { caster, at })
        : castThreeCoins(seed !== "" ? seededEntropy(seed) : PLATFORM_ENTROPY, { caster, at });
      readings = await readingsOf(drawn);
      const filled = fillLoop(slots, { observe: observeAsked, uncertain: uncertainAsked, asking, cast: drawn, readings: readings as unknown as LoopReading[] });
      const meta = { ...castMeta(drawn, { title, intent, ...(asking !== "" ? { asking } : {}), ...(uncertainAsked !== "" ? { uncertain: uncertainAsked } : {}), observe: observeAsked }), by: shelf.kind };
      const text = frameCarrier({ head: { uri: title }, body: castMemeBody({ title, meta, cast: drawn, slots: filled }) });
      // ALL TIDDLERS: the carrier lands through the one tiddler door, whose put splits a family's text into its slots.
      const placed = await put({ ...container, title, text, create: true }, ctx) as Record<string, unknown>;
      const decision = String(placed["decision"] ?? "");
      if (decision === "conflict") {
        throw new VerbRefusal("oracle-cast-unlanded", `oracle-cast-unlanded: the tiddler door answered conflict for ${title}; nothing moved, and the same asking casts again`);
      }
      const created = decision === "put" && placed["created"] === true;
      receipt = { decision, created, ...(placed["bag"] !== undefined ? { bag: placed["bag"] } : {}), ...(placed["hash"] !== undefined ? { hash: placed["hash"] } : {}) };
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
    // EVERY ANSWER NAMES THE CARRIER THAT ANSWERED (fork 4): the has line carries `carrier/<title> bag/<bag> base/<hash>`.
    const carrierParams = shaped ? [param("carrier", shaped.carrier), param("bag", shaped.bag), param("base", shaped.base)] : [];
    return {
      has: hasLine(title, [param("decision", String(receipt["decision"] ?? "")), param("replayed", replayed), ...carrierParams]),
      band, intent, replayed,
      decision: receipt["decision"], created: receipt["created"] === true, title,
      ...(shaped ? { carrier: shaped } : {}),
      ...(receipt["bag"] !== undefined ? { bag: receipt["bag"] } : {}),
      ...(receipt["hash"] !== undefined ? { hash: receipt["hash"] } : {}),
      by: shelf.kind, method: shelf.method,
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
