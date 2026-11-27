/*\
title: lar:///ha.ka.ba/lararium/tw5/modules/call
type: application/javascript
module-type: startup
\*/
/**
 * call — THE ONE CALL SHAPE (lar:///ha.ka.ba/kahua/memory/course/comms-ux-enacts landing 4): a verb and named params, resolved,
 * bound and dispatched by one rule on every surface. It publishes `$tw.lares.call(verb, params)`; the daemon verb `call`
 * (`makeCallReactor` in `verb-dispatcher.ts`) runs the same plan host-side.
 *
 *   resolve  the leading word reaches an address: an address in either spelling, a verb word (`get`), or any skin's spelling
 *            (`oracle cast`, `tiddler_get`), through `routesOf` over the live stack; a shared word (`get`) chooses by the
 *            `by/` param its skin rows name (`by/title`, `by/filter`), so the choice rests in carrier rows a layer may move.
 *   bind     the params meet the live `#/takes` rows of the carrier the stack seats (`carrierOf`): `needs/required`,
 *            `needs/one-of`, `needs/all-of`, `default/` (the container default, fork 5, rides the shared
 *            `#/takes/container` row like any other); an unknown param refuses by name with the nearest name and a cure.
 *   dispatch the address meets one address-to-reactor registry (`VerbTable.answer` in `verb-dispatcher.ts`); a carrier whose
 *            door the host runs (`handler/host` on a skin row) answers its bound params for the host to run; an address with
 *            neither refuses `affordance-unhandled` with a cure.
 *   stamp    every answer names the carrier that shaped it: `carrier/<title> bag/<bag> base/<hash>` on the has line, and
 *            `carrier: {carrier, bag, base}` beside it (fork 4).
 *
 * MUTABILITY AT THE ROOT: every row the plan reads (`#/skins`, `#/takes` with its defaults) resolves through the caller's
 * whole stack, working layers included; no fence guards a carrier. A CARRIER DESCRIBES; IT NEVER GRANTS (DAM law 1): the
 * reactor's own door checks the ocap, the base and the hand. `base` stands as the one guard name.
 *
 * A SIGIL GOES IN, A SIGIL COMES OUT (landing 5): a whole call sigil (``<<~ get title=`Room 4`>>``) reads through TiddlyWiki's own
 * macro-call parser in the VM (`callOfSigil`), and every cure renders as a call sigil a reader runs as written (`cureCall`), the
 * triple quote carrying any value that holds a substitution mark (`sigilQuote` in `affordance-rows`).
 *
 * MU SETS THE DEPTH (landing 6, `modules/mu.ts`): a `mu` param (a glyph or its word) reads to a carry, meets the cells the
 * carrier's `#/takes` tables, and rides the plan as its canonical carry for the seat to turn into its reactor's args; no `mu`
 * keeps the read gradient. A conflict carry answers its first tool and names the second as the next call (`mu.then`); a carry
 * outside the table refuses `mu-cell-empty` with the nearest cell as a cure sigil.
 *
 * DRY PREVIEWS EVERY WRITE AND ACT (landing 7): a carry holding `_` reaches a seat that walks its door's law to the last step
 * and lands nothing (`CallSeat.dry`), and the answer carries the carrier's seat hints (`hints`: its `#/gate` rows and any
 * `signs` row). A seat that walks no dry path, or a door the host runs, refuses the dry carry `mu-cell-empty` and names the
 * plain call (`dryUnwalked`), so a preview never lands as a write, whatever a layer above tables.
 *
 * In the VM the call dispatches through `$tw.lares.callDoor`, the host's seat of the registry; where no host seats one, the
 * call answers its plan (`handler/host`, the bound params), so a reader sees what would run.
 *
 * WHO RUNS THE DOOR (landings 9 and 11): a skin row's `handler/` names it per surface. `handler/host` (a terminal's door, which
 * reads host files or asks y/N) and `handler/seat` (an act whose handler rests in the MCP seat's own process) answer the bound
 * params for that host or seat to run; a row naming neither reaches the registry. The call's own surface row decides, and a
 * surface with no row of its own takes `handler/host` where any row names it. A host door that walks a dry path says so on its
 * row (`dry/walks`), and only then does a `_` carry reach it.
 *
 * THE MACHINA'S VOICE (landing 21): every answer's human line and every call refusal render through Iris-Sprite's templates
 * (`lar:///ha.ka.ba/lares/spirit/iris-sprite`, `#/answer/template` and `#/refusal/template`), read through the caller's stack
 * like any record, so a layer above canon re-shapes the voice by seating a slot; the baked pack carries canon's templates as the
 * floor. No answer prints her name.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/affordance
 */
import { VerbRefusal } from "@lararium/mesh/verb-refusal";
import { canonicalJsonBytes, sha256HexBytesSync } from "@lararium/mesh/crypto";
import type { LaresCallDoor, LaresTw5Extension } from "../types/lares-globals.js";
import type { TW5Instance } from "../types/tiddlywiki.js";
import { AFFORDANCE_TAG, AFFORD_SURFACES, type AffordSurface, type HasRow, bareAddressOf, renderCall, skinOmits, skinRow } from "../affordance-rows.js";
import { argOnSurface, carrierOf, routeOfCall, routesOf, seatHintRows, skinRows, takesRows, type AffordRoutes, type CarrierView, type TextOf } from "../affordance-read.js";
import { param } from "../has-line.js";
import { isDryCarry, isMuFault, lookupMu, muCellsOf, muWordsOf, readMu, type MuFault, type MuReading } from "./mu.js";

export const name        = "lararium-call";
export const after       = ["startup"];
export const synchronous = true;

declare const $tw: (Partial<TW5Instance> & LaresTw5Extension) | undefined;

/** What a call reads of a wiki: each record's text, the titles that may hold carriers, which title stands, and a record's receipt. */
export interface CallReader {
  readonly textOf: TextOf;
  /** The titles the routes read: every carrier root and `#/skins` slot the view holds (a superset reads the same). */
  titles(): Iterable<string>;
  readonly carriers: CarrierView;
  /** The receipt one carrier record hands: its bag (the layer that answered) and its base (the record hash a writer names). */
  receiptOf(title: string): CallReceipt;
}

/** The carrier that shaped an answer: its title, the bag that answered it, its base. */
export interface CallReceipt { readonly carrier: string; readonly bag: string; readonly base: string }

/** A call resolved and bound: the address, the carrier the stack seats, the surface, and the params in neutral names. */
export interface CallPlan {
  readonly address: string;
  readonly carrier: string;
  readonly surface: AffordSurface;
  readonly params: Readonly<Record<string, unknown>>;
  /** True where a skin row names `handler/host` or `handler/seat`: the host (the CLI) or the seat runs the door, never the registry. */
  readonly host: boolean;
  /** True where the call's own surface row names `handler/seat`: the MCP seat's own process runs the act (fork 10). */
  readonly seat?: boolean | undefined;
  /** True where the host or seat door names `dry/walks`: a `_` carry reaches it, and it lands nothing. */
  readonly dryWalks?: boolean | undefined;
  /** The depth a `mu` param asked and the cell that answers it (landing 6); absent where the call names no `mu`. */
  readonly mu?: MuCall | undefined;
}

/** One seat hint a carrier tables: a `gate` row (who may ask, the ocap the door checks) or a `signs` row. */
export interface SeatHint { readonly entity: string; readonly name: string; readonly params: Readonly<Record<string, string>>; readonly role: string }

/** A plan's depth: the cell's reading, the next call a conflict names (a call sigil), and a dry carry's seat hints. */
export interface MuCall extends MuReading {
  readonly next: string | null;
  /** The carrier's seat hints, read where the carry holds the dry tool (landing 7); absent otherwise. */
  readonly hints?: readonly SeatHint[] | undefined;
}

/** A refusal the call itself answers (before any reactor): its code leads the message, and `cure` renders a runnable call. */
export class CallRefusal extends VerbRefusal {
  /** What stands in the way, one line, apart from the code and the cure. */
  readonly detail: string;
  /** `line` stands for the whole message where a voice rendered it (landing 21); absent, the code, the detail and the cure join. */
  constructor(reason: string, message: string, readonly cure?: string, line?: string) {
    super(reason, line ?? (cure ? `${reason}: ${message}; cure: ${cure}` : `${reason}: ${message}`));
    this.detail = message;
  }
}

const bare = (address: string): string => bareAddressOf(address) ?? address.replace(/^lar:\/\/\//, "");

/** The edit distance between two names, for the nearest-name cure. */
function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const held = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = held;
    }
  }
  return row[b.length]!;
}

/** The nearest of `names` to `word`, or null where none stands. */
export function nearestName(word: string, names: Iterable<string>): string | null {
  let best: string | null = null;
  let score = Infinity;
  for (const n of [...names].sort()) {
    const d = distance(word, n);
    if (d < score) { best = n; score = d; }
  }
  return best;
}

/** A param's value as the sigil writes it: a switch stays `true`, a list or a map rides as its JSON, anything else as its string. */
const sigilArg = (v: unknown): string | true => (v === true ? true : typeof v === "object" && v !== null ? JSON.stringify(v) : String(v));

/** A neutral call rendered as a call sigil (landing 5): the cure a reader runs as written, on any surface, `call` reading it back. */
export function cureCall(word: string, params: Readonly<Record<string, unknown>>): string {
  return renderCall("sigil", word, { address: "", args: Object.entries(params).map(([k, v]) => [k, sigilArg(v)] as const) });
}

/** One attribute of a macro call as TiddlyWiki's parser hands it (`parseMacroParameterAsAttribute`). */
export interface MacroCallAttribute {
  readonly name: string;
  readonly type: string;
  readonly value?: unknown;
  readonly rawValue?: string;
  readonly isPositional?: boolean;
  readonly assignmentOperator?: string;
  readonly start?: number;
  readonly end?: number;
}

/** A macro call as TiddlyWiki's parser hands it (`parseMacroInvocationAsTransclusion`): a transclusion node. */
export interface MacroCallNode {
  readonly end: number;
  readonly attributes: Readonly<Record<string, MacroCallAttribute>>;
  readonly orderedAttributes: readonly MacroCallAttribute[];
}

/** TiddlyWiki's own macro-call parser, `$tw.utils.parseMacroInvocationAsTransclusion`: the one reader a call sigil meets. */
export type MacroCallParse = (source: string, pos: number) => MacroCallNode | null;

/**
 * A SIGIL GOES IN (comms-ux-enacts landing 5): ``<<~ get title=`Room 4`>>`` read by TiddlyWiki's own macro-call parser inside the
 * VM, never a second parser beside it. The head names the verb (`<<~ get …>>` and `<<~get …>>` read alike; a word the parser
 * would split, an address or a spelling with a space, rides a string literal); each named param keeps the value the parser
 * hands, a ticked one its `rawValue` as written (a call substitutes nothing), the triple tick and every string literal
 * included; a bare word past the verb reads as a switch. A value the parser types for a render (a filter, a text reference, a
 * macro call) refuses `sigil-malformed`, its cure the same call with that value written as text; a source the parser reads no
 * call in, or reads past before its end, refuses `sigil-malformed` in the parser's own measure.
 */
export function callOfSigil(sigil: string, parse: MacroCallParse | undefined): { word: string; params: Record<string, unknown> } {
  const source = sigil.trim();
  if (parse === undefined) throw new CallRefusal("sigil-malformed", `no TiddlyWiki engine stands here to read ${source}; a call sigil parses in the VM alone`);
  const node = parse(source, 0);
  if (node === null) throw new CallRefusal("sigil-malformed", `TiddlyWiki's macro-call parser (parseMacroInvocationAsTransclusion) reads no call in ${source}`);
  if (node.end !== source.length) {
    throw new CallRefusal("sigil-malformed", `TiddlyWiki's macro-call parser reads one call ending at offset ${node.end}; ${JSON.stringify(source.slice(node.end))} stays unread`);
  }
  const head = String(node.attributes["$variable"]?.value ?? "");
  const rest = node.orderedAttributes.filter((a) => a.name !== "$variable");
  let word = head.startsWith("~") ? head.slice(1) : head;
  if (word === "") {
    const lead = rest.shift();
    // A SCHEME IS NO PARAM: an unquoted `lar:///x.y.z` reads to the parser as a param `lar` (the colon caveat); the head rejoins it.
    if (lead !== undefined && !lead.isPositional && lead.assignmentOperator === ":" && String(lead.value ?? "").startsWith("//")) word = `${lead.name}:${String(lead.value)}`;
    else if (lead !== undefined && lead.isPositional && lead.type === "string") word = String(lead.value ?? "");
    else throw new CallRefusal("sigil-malformed", `${source} names no verb: the head reads \`${head}\`, and no word follows it`, `<<~ get title=\`<title>\`>>`);
  }
  const params: Record<string, unknown> = {};
  const typed: string[] = [];
  for (const a of rest) {
    if (a.isPositional) { params[String(a.value ?? "")] = true; continue; }
    if (a.type === "string") { params[a.name] = String(a.value ?? ""); continue; }
    if (a.type === "substituted") { params[a.name] = a.rawValue ?? ""; continue; }
    // A VALUE TYPED FOR A RENDER: the cure writes its source text as the value.
    const raw = a.start !== undefined && a.end !== undefined ? source.slice(a.start, a.end).trim() : "";
    params[a.name] = raw.slice(raw.indexOf("=") + 1).trim();
    typed.push(`${a.name} (${a.type})`);
  }
  if (typed.length > 0) {
    throw new CallRefusal("sigil-malformed", `${source} carries a value the parser types for a render: ${typed.join(", ")}; a call reads its values as written`, cureCall(word, params));
  }
  return { word, params };
}

/** The members a `needs/<kind>:a,b` param names on one row, or null. */
function groupOf(row: HasRow, kind: "one-of" | "all-of"): string[] | null {
  const needs = row.params["needs"] ?? "";
  return needs.startsWith(`${kind}:`) ? needs.slice(kind.length + 1).split(",").map((s) => s.trim()).filter(Boolean) : null;
}

/**
 * RESOLVE: the address and the carrier a call's leading word reaches over the live stack. A shared word whose params select
 * no address refuses `call-ambiguous` naming each choice as a call; a word nothing spells refuses `call-unrouted` with the
 * nearest spelling.
 */
export function resolveCall(reader: CallReader, word: string, params: Readonly<Record<string, unknown>>, routes: AffordRoutes = routesOf(reader.textOf, reader.titles(), reader.carriers)): { address: string; carrier: string } {
  const route = routeOfCall(routes, word, params);
  if (route === null) {
    const spellings = AFFORD_SURFACES.flatMap((s) => [...Object.keys(routes.routes[s]), ...Object.keys(routes.chosen[s])]);
    const near = nearestName(word, spellings);
    throw new CallRefusal("call-unrouted", `no carrier on this stack spells "${word}"${near ? `; the nearest spelling: ${near}` : ""}`, near ? cureCall(near, params) : undefined);
  }
  if (route.address === null) {
    throw new CallRefusal("call-ambiguous", `"${word}" reaches ${route.choices.map((c) => `${bare(c.address)} by ${c.by}`).join(" · ")}; name exactly one of ${route.choices.map((c) => c.by).join(", ")}`,
      route.choices.map((c) => cureCall(word, { ...params, [c.by]: `<${c.by}>` })).join(" · "));
  }
  const carrier = carrierOf(reader.carriers, route.address);
  if (carrier === null) {
    throw new CallRefusal("affordance-unseated", `no carrier on this stack answers ${route.address}`, cureCall("get", { filter: `[tag[${AFFORDANCE_TAG}]]` }));
  }
  return { address: route.address, carrier };
}

/**
 * A TERMINAL'S VALUES ARRIVE AS WORDS (landing 8): on the cli surface each string value turns by its row's `takes/` kind before
 * the bind reads it. `takes/json` parses to the value it spells, `takes/count` to a whole number, `takes/names` splits on commas,
 * and a row naming no `takes/` (a flag: `create`, `family`, `tree`) reads `true` or `false`; every other kind rides as written.
 * A value its kind refuses answers `param-malformed` with the call's cure. The conversion runs here, in the VM, so a layer that
 * re-tables a row's kind moves what a terminal's word means.
 */
export function cliValuesOf(address: string, word: string, params: Readonly<Record<string, unknown>>, rows: readonly HasRow[]): Record<string, unknown> {
  const kinds = new Map<string, string>();
  for (const row of rows) if (!kinds.has(row.name)) kinds.set(row.name, row.params["takes"] ?? "");
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    const kind = kinds.get(key);
    if (typeof value !== "string" || kind === undefined) { out[key] = value; continue; }
    const malformed = (why: string): never => {
      const { [key]: _drop, ...rest } = params;
      throw new CallRefusal("param-malformed", `${bare(address)} reads ${key} as ${why} (got ${JSON.stringify(value)})`, cureCall(word, { ...rest, [key]: `<${key}>` }));
    };
    if (kind === "json") {
      try { out[key] = JSON.parse(value); } catch { malformed("JSON (e.g. {\"status\":\"done\"})"); }
    } else if (kind === "count") {
      if (!/^[0-9]+$/.test(value.trim())) malformed("a whole count");
      out[key] = Number(value.trim());
    } else if (kind === "names") {
      out[key] = value.split(",").map((s) => s.trim()).filter((s) => s !== "");
    } else if (kind === "") {
      if (value !== "true" && value !== "false") malformed("a flag, true or false");
      out[key] = value === "true";
    } else out[key] = value;
  }
  return out;
}

/**
 * BIND: the params against the live `#/takes` rows of the carrier, on one surface (an arg whose `skins/` leaves the surface out,
 * or that its skin row `omits/`, takes no value there). Defaults fill first (a `one-of` member's default only where no member
 * rides); then `needs/` holds. Answers the params in neutral names, defaults filled.
 */
export function bindCall(reader: CallReader, address: string, carrier: string, word: string, params: Readonly<Record<string, unknown>>, surface: AffordSurface = "console"): Record<string, unknown> {
  const omitted = skinOmits(skinRow(skinRows(reader.textOf, carrier), surface));
  const rows = takesRows(reader.textOf, carrier).filter((r) => argOnSurface(r, surface, omitted));
  const names = new Set(rows.map((r) => r.name));
  for (const key of Object.keys(params)) {
    if (names.has(key)) continue;
    const near = nearestName(key, names);
    const { [key]: _drop, ...rest } = params;
    throw new CallRefusal("param-unknown", `${bare(address)} takes no param "${key}"${near ? `; the nearest: ${near}` : ""} (its takes: ${[...names].join(" · ")})`,
      near ? cureCall(word, { ...rest, [near]: params[key] }) : undefined);
  }
  const bound: Record<string, unknown> = surface === "cli" ? cliValuesOf(address, word, params, rows) : { ...params };
  const present = (n: string): boolean => bound[n] !== undefined;
  for (const row of rows) {
    const fallback = row.params["default"];
    if (fallback === undefined || present(row.name)) continue;
    const choice = groupOf(row, "one-of");
    if (choice !== null && choice.some((m) => present(m) || params[m] !== undefined)) continue;
    bound[row.name] = fallback;
  }
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.name)) continue;
    const choice = groupOf(row, "one-of");
    if (choice !== null) {
      for (const m of choice) seen.add(m);
      const riding = choice.filter(present);
      if (riding.length > 1) {
        throw new CallRefusal("one-of-doubled", `${bare(address)} takes exactly one of ${choice.join(", ")}; the call names ${riding.join(" and ")}`,
          cureCall(word, Object.fromEntries(Object.entries(bound).filter(([k]) => !riding.slice(1).includes(k)))));
      }
      if (riding.length === 0) {
        throw new CallRefusal("param-needed", `${bare(address)} needs one of ${choice.join(", ")}`, cureCall(word, { ...bound, [choice[0]!]: `<${choice[0]}>` }));
      }
      continue;
    }
    const together = groupOf(row, "all-of");
    if (together !== null) {
      for (const m of together) seen.add(m);
      const riding = together.filter(present);
      if (riding.length > 0 && riding.length < together.length) {
        const missing = together.filter((m) => !present(m));
        throw new CallRefusal("all-of-partial", `${bare(address)} takes ${together.join(", ")} together or not at all; the call leaves out ${missing.join(", ")}`,
          cureCall(word, { ...bound, ...Object.fromEntries(missing.map((m) => [m, `<${m}>`])) }));
      }
      continue;
    }
    seen.add(row.name);
    const needs = row.params["needs"];
    if ((needs === "required" || needs === "always") && !present(row.name)) {
      throw new CallRefusal("param-needed", `${bare(address)} needs ${row.name}`, cureCall(word, { ...bound, [row.name]: `<${row.name}>` }));
    }
  }
  return bound;
}

/** True where a skin row of the carrier names `handler/host`: the host runs the door, outside the registry. */
export function hostHandled(reader: CallReader, carrier: string): boolean {
  return skinRows(reader.textOf, carrier).some((r) => r.params["handler"] === "host");
}

/**
 * WHO RUNS A CARRIER'S DOOR ON ONE SURFACE: the surface's own skin row names it (`handler/host` or `handler/seat`); a row naming
 * neither, or no row at all, takes `host` where any row of the carrier names `handler/host`, else the registry (null).
 */
export function handlerOf(reader: CallReader, carrier: string, surface: AffordSurface): "host" | "seat" | null {
  const rows = skinRows(reader.textOf, carrier);
  const named = rows.find((r) => r.name === surface)?.params["handler"];
  if (named === "host" || named === "seat") return named;
  return rows.some((r) => r.params["handler"] === "host") ? "host" : null;
}

/** True where the door that runs the carrier on this surface says it walks a dry path (`dry/walks` on its skin row). */
export function walksDry(reader: CallReader, carrier: string, surface: AffordSurface): boolean {
  const rows = skinRows(reader.textOf, carrier);
  const own = rows.find((r) => r.name === surface);
  const door = own?.params["handler"] === "host" || own?.params["handler"] === "seat" ? own : rows.find((r) => r.params["handler"] === "host");
  return door?.params["dry"] === "walks";
}

/**
 * THE DEPTH A CALL ASKS (landing 6): the bound `mu` read to a carry and looked up against the cells the carrier's `#/takes`
 * tables (`cell` rows, the shared slots it calls by `kahea` read in place). A fault refuses with its cure as a call sigil: the
 * nearest cell's words in `mu`, or the plain call with no `mu` (the read gradient).
 */
export function muOfCall(reader: CallReader, carrier: string, word: string, bound: Readonly<Record<string, unknown>>): MuCall {
  const refuse = (fault: MuFault): never => {
    const { mu: _drop, ...plain } = bound;
    throw new CallRefusal(fault.reason, fault.message, cureCall(word, fault.cure === null ? plain : { ...plain, mu: fault.cure }));
  };
  const asked = String(bound["mu"]);
  const read = readMu(bound["mu"]);
  if (isMuFault(read)) return refuse(read);
  const reading = lookupMu(asked, read, muCellsOf(takesCells(reader, carrier)));
  if (isMuFault(reading)) return refuse(reading);
  const next = reading.then === null ? null : cureCall(word, { ...bound, mu: muWordsOf(reading.then) });
  if (!isDryCarry(reading.carry)) return { ...reading, next };
  const hints = seatHintRows(reader.textOf, carrier).map(({ entity, name, params, role }): SeatHint => ({ entity, name, params, role }));
  return { ...reading, next, hints };
}

/** The `cell` rows of a carrier's `#/takes`, the shared slots it calls by `kahea` read in place. */
function takesCells(reader: CallReader, carrier: string): HasRow[] {
  return takesRows(reader.textOf, carrier, "cell");
}

/** RESOLVE AND BIND: the whole plan, read over the live stack; a `mu` param meets the carrier's cells. */
export function planCall(reader: CallReader, word: string, params: Readonly<Record<string, unknown>> = {}, surface: AffordSurface = "console"): CallPlan {
  const { address, carrier } = resolveCall(reader, word, params);
  const bound = bindCall(reader, address, carrier, word, params, surface);
  const mu = bound["mu"] === undefined ? undefined : muOfCall(reader, carrier, word, bound);
  const handler = handlerOf(reader, carrier, surface);
  return {
    address, carrier, surface, params: mu === undefined ? bound : { ...bound, mu: mu.carry },
    host: handler !== null, seat: handler === "seat", dryWalks: handler !== null && walksDry(reader, carrier, surface),
    ...(mu !== undefined ? { mu } : {}),
  };
}

/** An answer beside the depth that shaped it: `mu: {asked, carry, axis, next?}`, a conflict's second tool named as the next call. */
export function muAnswer(answer: Record<string, unknown>, plan: CallPlan): Record<string, unknown> {
  if (plan.mu === undefined) return answer;
  const { asked, carry, axis, next, hints } = plan.mu;
  return { ...answer, mu: { asked, carry, words: muWordsOf(carry), axis, ...(next !== null ? { next } : {}) }, ...(hints !== undefined ? { hints } : {}) };
}

/** The camelCase a reactor reads for a neutral param (`max-bytes` → `maxBytes`). */
export const reactorArgOf = (name: string): string => name.replace(/-([a-z0-9])/g, (_m, c: string) => c.toUpperCase());

/**
 * One address's seat in the registry: the daemon verb that answers it, the params whose reactor spelling breaks the camelCase
 * rule (`tag-add` → `tagsAdd`), and an optional fold for a param that names a value of another (`all` → `grain: "whole"`).
 */
export interface CallSeat {
  readonly verb: string;
  readonly args?: Readonly<Record<string, string>>;
  readonly fold?: (args: Record<string, unknown>) => Record<string, unknown>;
  /** A seat that chooses its verb by the call's args (a get with `meme` and no title lists the families, `meme-list`). */
  readonly verbOf?: (args: Readonly<Record<string, unknown>>) => string;
  /** True where the seat walks a dry path (landing 7): its fold turns a `_` carry into its reactor's `dry` arg. */
  readonly dry?: boolean;
}

/** True where a plan's carry holds the dry tool. */
export const isDryPlan = (plan: CallPlan): boolean => plan.mu !== undefined && isDryCarry(plan.mu.carry);

/**
 * THE DRY CARRY A DOOR CANNOT WALK (landing 7): a seat with no dry path, or a door the host runs, refuses `mu-cell-empty` and
 * names the plain call with no `mu`, so a preview never lands as a write.
 */
export function dryUnwalked(plan: CallPlan): CallRefusal {
  const { mu: _drop, ...plain } = plan.params;
  const carry = plan.mu?.carry ?? "_";
  return new CallRefusal("mu-cell-empty", `${bare(plan.address)} walks no dry path, so a ${carry} (${muWordsOf(carry)}) call lands nothing; the plain call lands the act`, cureCall(plan.address, plain));
}

/** The daemon verb a seat answers with for one call's reactor args: its `verbOf` choice, else its one verb. */
export const seatVerbOf = (seat: CallSeat, args: Readonly<Record<string, unknown>>): string => seat.verbOf?.(args) ?? seat.verb;

/** The reactor's args for a bound plan, by its seat's spellings. */
export function reactorArgs(params: Readonly<Record<string, unknown>>, seat: CallSeat): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) out[seat.args?.[k] ?? reactorArgOf(k)] = v;
  return seat.fold ? seat.fold(out) : out;
}

/**
 * STAMP: the carrier that shaped the answer rides the has line (`carrier/ bag/ base/`) and the answer's `carrier`. A has line
 * already standing takes the params before its tagline; an answer with none gains one naming the address.
 */
export function stampAnswer(answer: Record<string, unknown>, address: string, receipt: CallReceipt): Record<string, unknown> {
  // AN ANSWER THAT ALREADY NAMES ITS CARRIER (the cast names the `#/loop` slot that shaped it) keeps its own, the finer receipt.
  if (typeof answer["carrier"] === "object" && answer["carrier"] !== null) return answer;
  const stamps = [param("carrier", receipt.carrier), param("bag", receipt.bag), param("base", receipt.base)].join(" ");
  const has = typeof answer["has"] === "string" ? answer["has"] : null;
  const stamped = has === null
    ? `<<~ has name=\`${address}\` params=\`${stamps}\`>>`
    : has.replace(/params=(`{1,3})([\s\S]*?)\1>>$/, (_m, q: string, body: string) => {
      const cut = body.indexOf(" ~ ");
      const lead = body.startsWith("~ ") ? 0 : cut;
      const head = lead < 0 ? body : body.slice(0, lead);
      const tail = lead < 0 ? "" : body.slice(lead === 0 ? 0 : lead);
      return `params=${q}${[head.trim(), stamps].filter(Boolean).join(" ")}${tail ? (tail.startsWith(" ") ? tail : ` ${tail}`) : ""}${q}>>`;
    });
  return { ...answer, has: stamped, carrier: receipt };
}

/** The answer a host-run (or seat-run) door gives: the plan itself, so that host runs the door with the bound params. */
export function hostAnswer(plan: CallPlan, receipt: CallReceipt): Record<string, unknown> {
  // THE HOST RUNS ITS DOOR WITH THE BOUND PARAMS: a dry carry reaches only a door whose row names `dry/walks`, and refuses here
  // otherwise, before the host sees a plan.
  if (isDryPlan(plan) && plan.dryWalks !== true) throw dryUnwalked(plan);
  return muAnswer(stampAnswer({ handler: plan.seat === true ? "seat" : "host", address: plan.address, params: plan.params }, plan.address, receipt), plan);
}

/** Iris-Sprite's shrine: the machina's deterministic voice, its templates read through the caller's stack (landing 21). */
export const IRIS_SHRINE = "lar:///ha.ka.ba/lares/spirit/iris-sprite";

/** The two lines her templates shape: an answer's human line and a call refusal. */
export type VoiceSlot = "answer" | "refusal";
export const VOICE_SLOTS: readonly VoiceSlot[] = ["answer", "refusal"];

/** The slot that carries one template. */
export const voiceTitle = (slot: VoiceSlot): string => `${IRIS_SHRINE}#/${slot}/template`;

/** The template a slot carries: the body of its first fenced block whose info string names `template`, or null. */
export function templateOf(text: string | undefined): string | null {
  if (text === undefined) return null;
  const m = /^(`{3,})[^\n`]*\btemplate\b[^\n]*\n([\s\S]*?)\n\1[ \t]*$/m.exec(text);
  return m === null ? null : m[2]!;
}

/** Renders one wikitext template to plain text with its variables (`wiki.renderText("text/plain", …)` in the VM). */
export type VoiceRender = (template: string, variables: Readonly<Record<string, string>>) => string;

/** Where the voice reads: the engine's renderer, and the floor a sleeping vessel answers from (the pack's baked templates). */
export interface CallVoice {
  readonly render: VoiceRender;
  readonly floor?: (() => Promise<Partial<Record<VoiceSlot, string>>>) | undefined;
}

/**
 * ONE LINE IN HER VOICE: the template the caller's stack seats for the slot (else the floor's), rendered with the variables;
 * null where neither stands or the render throws, so the plain words stand.
 */
export async function voiceLine(reader: CallReader, voice: CallVoice | undefined, slot: VoiceSlot, variables: Readonly<Record<string, string>>): Promise<string | null> {
  if (voice === undefined) return null;
  let template = templateOf(reader.textOf(voiceTitle(slot)));
  if (template === null && voice.floor !== undefined) {
    try { template = (await voice.floor())[slot] ?? null; } catch { template = null; }
  }
  if (template === null) return null;
  try { return voice.render(template, variables).trim(); } catch { return null; }
}

/** The answer with its human line in her voice (`human`), where her template renders one. */
export async function voicedAnswer(answer: Record<string, unknown>, reader: CallReader, voice: CallVoice | undefined): Promise<Record<string, unknown>> {
  const has = typeof answer["has"] === "string" ? answer["has"] : "";
  const line = await voiceLine(reader, voice, "answer", { has });
  return line === null || line === "" ? answer : { ...answer, human: line };
}

/** A call refusal in her voice: the code, what stands in the way, the cure; any other fault passes untouched. */
export async function voicedRefusal(fault: unknown, reader: CallReader, voice: CallVoice | undefined): Promise<unknown> {
  if (!(fault instanceof CallRefusal)) return fault;
  const line = await voiceLine(reader, voice, "refusal", { reason: fault.reason, detail: fault.detail, cure: fault.cure ?? "" });
  return line === null || line === "" ? fault : new CallRefusal(fault.reason, fault.detail, fault.cure, line);
}

/** The refusal an address with no reactor and no host door answers. */
export function unhandled(plan: CallPlan): CallRefusal {
  return new CallRefusal("affordance-unhandled", `no reactor answers ${plan.address} and no skin row of ${plan.carrier} names handler/host or an acts/ tiddler`,
    cureCall("get", { title: `${plan.carrier}#/skins` }));
}

/** The record base a writer names: the digest of every field the record carries, its residency stamp left out. */
export function recordBase(fields: Readonly<Record<string, string>>): string {
  const { ["$origin-bag"]: _bag, ...own } = fields;
  return `sha256-${sha256HexBytesSync(canonicalJsonBytes(own))}`;
}

type ReaderWiki = Pick<TW5Instance["wiki"], "getTiddler" | "filterTiddlers">;

/** A reader over one wiki's live records: the topmost layer answers each title, a shadow included. */
export function callReaderOf(wiki: ReaderWiki): CallReader {
  const fieldsOf = (title: string): Record<string, string> | undefined => {
    const t = wiki.getTiddler(title) as { getFieldStrings?: () => Record<string, string>; fields?: Record<string, unknown> } | undefined;
    if (t === undefined) return undefined;
    return t.getFieldStrings ? t.getFieldStrings() : Object.fromEntries(Object.entries(t.fields ?? {}).map(([k, v]) => [k, String(v)]));
  };
  return {
    textOf: (title) => { const f = fieldsOf(title); return f === undefined ? undefined : f["text"] ?? ""; },
    titles: () => wiki.filterTiddlers("[all[shadows+tiddlers]prefix[lar:///]!is[draft]]"),
    carriers: {
      has: (title) => wiki.getTiddler(title) !== undefined,
      tagged: (address) => wiki.filterTiddlers(`[all[shadows+tiddlers]tag[${AFFORDANCE_TAG}]tag[${address}]!is[draft]]`),
    },
    receiptOf: (title) => {
      const f = fieldsOf(title) ?? {};
      return { carrier: title, bag: f["$origin-bag"] || "wiki", base: recordBase(f) };
    },
  };
}

/** A leading word that opens a bracketed call: the call reads it as a sigil. */
export const isCallSigil = (word: string): boolean => word.trimStart().startsWith("<<");

/**
 * The face `$tw.lares.call` publishes over one wiki, dispatching through `door` where the host seats one. The leading word may
 * stand as a whole call sigil (``$tw.lares.call("<<~ get title=`Room 4`>>")``), read through `parse`, the engine's own parser;
 * params given beside it fill what the sigil leaves out.
 */
export function callFaceOf(wiki: ReaderWiki, door: () => LaresCallDoor | undefined, parse?: MacroCallParse): (word: string, params?: Record<string, unknown>) => Promise<Record<string, unknown>> {
  return async (given, more = {}) => {
    let word = given;
    let params: Record<string, unknown> = more;
    if (isCallSigil(given)) {
      const read = callOfSigil(given, parse);
      word = read.word;
      params = { ...more, ...read.params };
    }
    const reader = callReaderOf(wiki);
    const plan = planCall(reader, word, params);
    const receipt = reader.receiptOf(plan.carrier);
    if (plan.host) return hostAnswer(plan, receipt);
    const seated = door();
    if (seated === undefined) return { ...hostAnswer(plan, receipt), note: "no host seats $tw.lares.callDoor in this wiki; the plan answers, bound" };
    return muAnswer(stampAnswer(await seated(plan), plan.address, receipt), plan);
  };
}

export function startup(): void {
  if (!$tw?.wiki) return;
  $tw.lares ??= {};
  const lares = $tw.lares;
  const utils = ($tw as unknown as { utils?: { parseMacroInvocationAsTransclusion?: MacroCallParse } }).utils;
  lares.call = callFaceOf($tw.wiki as unknown as ReaderWiki, () => lares.callDoor, utils?.parseMacroInvocationAsTransclusion?.bind(utils));
}

