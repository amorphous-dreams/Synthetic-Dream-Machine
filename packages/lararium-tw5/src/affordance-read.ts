/**
 * affordance-read — one affordance carrier read through a wiki's own records: the slot rows a skin template asks for, each
 * enriched with what its surface spells (an arg's flag, an example's runnable line, a refusal's cure), the usage spine, the
 * skin's spelling, the slot's prose and digest, and the read that opens the next depth.
 *
 * It reads RECORDS, never carrier text: the engine's own deserializer already split the carrier into its root and `#/slot`
 * children (`uri#/takes`, `uri#/skins/cli`), so this adds no parser beyond the `has` row reader. A slot that calls a shared slot
 * by `kahea` (`#/takes/container` in the affordance law) reads that slot's rows in place, never a copy.
 *
 * A CARRIER'S TITLE AND ITS ADDRESS DIFFER IN CANON (measured by weaver#1, lar:///ha.ka.ba/lares/api/pono/affordance#/residency):
 * the canon walk seats no bare root, so a carrier rests at `lar:///ha.ka.ba/lares/afford/<address terms>` and TAGS its bare
 * address. Every view here takes the carrier's TITLE (the records hang under it) and derives the address from it.
 *
 * The `afford` filter operator (`filters/afford.ts`) hands these views to the skin templates; the bake and the console face ask
 * through that operator, so one reading serves every render.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/affordance
 */
import {
  type NeutralCall, AFFORD_SURFACES, type AffordSurface, type HasRow, addressMatcher, addressOfTitle, bareAddressOf, digestOf, edgesOf, exampleCall, kaheaTitles, neutralCallOf,
  parseHasRows, proseOf, renderCall, seatOf, seatsOf, skinOmits, skinRow, spellArg, unfoldRead, usageOf,
} from "./affordance-rows.js";

/** How this module reads one record's text: `undefined` where the wiki holds no such record. */
export type TextOf = (title: string) => string | undefined;

/** The text of one slot record and of every shared slot it calls by `kahea`, joined in order. */
function slotText(textOf: TextOf, address: string, slot: string): string {
  const own = textOf(`${address}${slot}`) ?? "";
  const called = kaheaTitles(own).map((t) => textOf(t) ?? "");
  return [own, ...called].join("\n");
}

/** Every skin row the carrier holds: `#/skins` itself and each nested `#/skins/<surface>` slot. */
export function skinRows(textOf: TextOf, address: string): HasRow[] {
  const texts = [textOf(`${address}#/skins`) ?? "", ...AFFORD_SURFACES.map((s) => textOf(`${address}#/skins/${s}`) ?? "")];
  const seen = new Set<string>();
  return texts.flatMap((t) => parseHasRows(t, "skin")).filter((r) => (seen.has(r.name) ? false : (seen.add(r.name), true)));
}

/** One surface's spelling of the affordance (`lares oracle cast`), or null where the carrier skins no such surface. */
export function spellsOf(textOf: TextOf, address: string, surface: AffordSurface): string | null {
  const row = skinRow(skinRows(textOf, address), surface);
  const spells = row?.params["spells"]?.trim();
  return spells ? spells : row ? row.name : null;
}

/**
 * Whether an arg reaches one surface: a `skins/mcp,tw5` param names the surfaces it rides (absent, every surface), and the
 * surface's skin row may still omit it (`omits/fresh,seed`).
 */
export function argOnSurface(row: HasRow, surface: AffordSurface, omitted: ReadonlySet<string> = new Set()): boolean {
  if (omitted.has(row.name)) return false;
  const only = row.params["skins"];
  return only === undefined || only.split(",").map((s) => s.trim()).includes(surface);
}

/** One slot's rows on one surface, each a plain object carrying what that surface spells. */
export function rowsOf(textOf: TextOf, address: string, slot: string, surface: AffordSurface): Array<Record<string, unknown>> {
  const skin = skinRow(skinRows(textOf, address), surface);
  const spells = spellsOf(textOf, address, surface) ?? "";
  const omitted = skinOmits(skin);
  const own = addressOfTitle(address) ?? address;
  // AN ARG THE SKIN NEVER TAKES RIDES THE WIRE ALONE (`at/` on the cli, which reads the time itself): a call binding one runs
  // on no door of this skin, so the skin renders no line for it (an example drops; a refusal keeps its words, without a cure).
  const offSurface = new Set(parseHasRows(slotText(textOf, address, "#/takes"))
    .filter((r) => r.entity === "arg" && !argOnSurface(r, surface, omitted)).map((r) => r.name));
  const runsHere = (call: NeutralCall): boolean => call.args.every(([k]) => !offSurface.has(k));
  const rows = (slot === "#/skins" ? skinRows(textOf, address) : parseHasRows(slotText(textOf, address, slot)))
    .filter((row) => !(row.entity === "arg" && !argOnSurface(row, surface, omitted)))
    .filter((row) => !(row.entity === "example" && !runsHere(exampleCall(row, own))));
  // A call naming another affordance (a cure that reads `tiddler.get.reads`) renders under that address, marked foreign: this
  // carrier knows no spelling of another door, and witness W4 parses only the calls that name this one.
  const seats = surface === "cli" ? seatsOf(parseHasRows(slotText(textOf, address, "#/takes")).filter((r) => argOnSurface(r, surface, omitted))) : undefined;
  const callOn = (call: NeutralCall): { line: string; foreign: boolean } =>
    call.address === own
      ? { line: renderCall(surface, spells, call, skin, seats), foreign: false }
      : { line: renderCall(surface, bareAddressOf(call.address) ?? call.address, call), foreign: true };
  return rows.map((row) => {
    const out: Record<string, unknown> = { entity: row.entity, name: row.name, role: row.role, params: row.params, bare: row.bare };
    if (row.entity === "arg") {
      const seat = surface === "cli" ? seatOf(row) : null;
      out["spell"] = seat !== null ? seat.as : spellArg(surface, row.name, skin);
      if (seat !== null) out["positional"] = true;
      else if (row.params["takes"]) out["value"] = row.params["takes"];
    }
    if (row.entity === "example") {
      const { line, foreign } = callOn(exampleCall(row, own));
      out["call"] = line;
      if (foreign) out["foreign"] = true;
    }
    if (row.entity === "refusal" && row.params["cure"] && runsHere(neutralCallOf(row.params["cure"], own))) {
      const { line, foreign } = callOn(neutralCallOf(row.params["cure"], own));
      out["cure"] = line;
      if (foreign) out["foreign"] = true;
    }
    if (row.entity === "band" && row.params["exit"]) out["exit"] = row.params["exit"];
    if (row.entity === "skin") out["spells"] = row.params["spells"] ?? row.name;
    return out;
  });
}

/** The usage spine on one surface, from `#/takes` and its shared slots. */
export function usageLine(textOf: TextOf, address: string, surface: AffordSurface): string {
  const skin = skinRow(skinRows(textOf, address), surface);
  const spells = spellsOf(textOf, address, surface) ?? bareAddressOf(addressOfTitle(address) ?? address) ?? address;
  const omitted = skinOmits(skin);
  return usageOf(surface, spells, parseHasRows(slotText(textOf, address, "#/takes")).filter((r) => r.entity !== "arg" || argOnSurface(r, surface, omitted)), skin);
}

/** The views the `afford` operator answers, by name. A view the operator does not name throws: an empty answer would read as an empty carrier. */
export const AFFORD_VIEWS = ["rows", "usage", "spells", "prose", "digest", "read", "surfaces", "edges", "address", "match"] as const;
export type AffordView = (typeof AFFORD_VIEWS)[number];

/** Answer one view for one carrier address. `arg` carries the slot (rows · prose · digest · read) or the pattern (match). */
export function affordView(textOf: TextOf, address: string, view: string, surface: AffordSurface, arg: string): string[] {
  switch (view as AffordView) {
    case "rows": return rowsOf(textOf, address, arg, surface).map((r) => JSON.stringify(r));
    case "usage": return [usageLine(textOf, address, surface)];
    case "spells": { const s = spellsOf(textOf, address, surface); return s === null ? [] : [s]; }
    case "prose": return proseOf(textOf(`${address}${arg}`) ?? "");
    case "digest": { const d = digestOf(textOf(`${address}${arg}`) ?? ""); return d ? [d] : []; }
    case "read": return [unfoldRead(surface, address, arg || undefined)];
    case "edges": return edgesOf(textOf(`${address}#/edges`) ?? "");
    case "surfaces": return skinRows(textOf, address).map((r) => r.name);
    case "address": { const a = addressOfTitle(address); return a === null ? [] : [bareAddressOf(a)!]; }
    // One pattern, or several named apart by spaces (a door whose addresses share no two leading terms lists them one by one).
    case "match": { const a = addressOfTitle(address); return a !== null && (arg === "" || arg.split(/\s+/).some((p) => addressMatcher(p)(a))) ? [address] : []; }
    default: throw new Error(`afford-view-unknown: "${view}"; the afford operator answers ${AFFORD_VIEWS.join(" · ")}`);
  }
}

/** A surface word, checked: an unknown surface throws by name rather than rendering nothing. */
export function surfaceOf(word: string | undefined): AffordSurface {
  const s = (word ?? "").trim() || "cli";
  if ((AFFORD_SURFACES as readonly string[]).includes(s)) return s as AffordSurface;
  throw new Error(`afford-surface-unknown: "${s}"; a carrier skins ${AFFORD_SURFACES.join(" · ")}`);
}
