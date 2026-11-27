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
 * In the VM the call dispatches through `$tw.lares.callDoor`, the host's seat of the registry; where no host seats one, the
 * call answers its plan (`handler/host`, the bound params), so a reader sees what would run.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/affordance
 */
import { VerbRefusal } from "@lararium/mesh/verb-refusal";
import { canonicalJsonBytes, sha256HexBytesSync } from "@lararium/mesh/crypto";
import type { LaresCallDoor, LaresTw5Extension } from "../types/lares-globals.js";
import type { TW5Instance } from "../types/tiddlywiki.js";
import { AFFORDANCE_TAG, AFFORD_SURFACES, type AffordSurface, type HasRow, bareAddressOf, renderCall, skinOmits, skinRow } from "../affordance-rows.js";
import { argOnSurface, carrierOf, routeOfCall, routesOf, skinRows, takesRows, type AffordRoutes, type CarrierView, type TextOf } from "../affordance-read.js";
import { param } from "../has-line.js";

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
  /** True where a skin row names `handler/host`: the host (the CLI or the seat) runs the door, never the registry. */
  readonly host: boolean;
}

/** A refusal the call itself answers (before any reactor): its code leads the message, and `cure` renders a runnable call. */
export class CallRefusal extends VerbRefusal {
  constructor(reason: string, message: string, readonly cure?: string) {
    super(reason, cure ? `${reason}: ${message}; cure: ${cure}` : `${reason}: ${message}`);
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

/** A neutral call rendered on the console surface: the cure a reader runs as written. */
function cureCall(word: string, params: Readonly<Record<string, unknown>>): string {
  const args = Object.entries(params).map(([k, v]) => [k, v === true ? true : String(v)] as const);
  return renderCall("console", word, { address: "", args });
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
  const bound: Record<string, unknown> = { ...params };
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

/** RESOLVE AND BIND: the whole plan, read over the live stack. */
export function planCall(reader: CallReader, word: string, params: Readonly<Record<string, unknown>> = {}, surface: AffordSurface = "console"): CallPlan {
  const { address, carrier } = resolveCall(reader, word, params);
  return { address, carrier, surface, params: bindCall(reader, address, carrier, word, params, surface), host: hostHandled(reader, carrier) };
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
}

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

/** The answer a host-run door gives: the plan itself, so the host runs the door with the bound params. */
export function hostAnswer(plan: CallPlan, receipt: CallReceipt): Record<string, unknown> {
  return stampAnswer({ handler: "host", address: plan.address, params: plan.params }, plan.address, receipt);
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

/** The face `$tw.lares.call` publishes over one wiki, dispatching through `door` where the host seats one. */
export function callFaceOf(wiki: ReaderWiki, door: () => LaresCallDoor | undefined): (word: string, params?: Record<string, unknown>) => Promise<Record<string, unknown>> {
  return async (word, params = {}) => {
    const reader = callReaderOf(wiki);
    const plan = planCall(reader, word, params);
    const receipt = reader.receiptOf(plan.carrier);
    if (plan.host) return hostAnswer(plan, receipt);
    const seated = door();
    if (seated === undefined) return { ...hostAnswer(plan, receipt), note: "no host seats $tw.lares.callDoor in this wiki; the plan answers, bound" };
    return stampAnswer(await seated(plan), plan.address, receipt);
  };
}

export function startup(): void {
  if (!$tw?.wiki) return;
  $tw.lares ??= {};
  const lares = $tw.lares;
  lares.call = callFaceOf($tw.wiki as unknown as ReaderWiki, () => lares.callDoor);
}

