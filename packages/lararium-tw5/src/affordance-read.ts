/**
 * affordance-read — one affordance carrier read through a wiki's own records: the slot rows a skin template asks for, each
 * enriched with what its surface spells (an arg's flag, an example's runnable line, a refusal's cure), the usage spine, the
 * skin's spelling, the slot's prose and digest, and the read that opens the next depth.
 *
 * It reads RECORDS, never carrier text: the engine's own deserializer already split the carrier into its root and `#/slot`
 * children (`uri#/takes`, `uri#/skins/cli`), so this adds no parser beyond the `has` row reader. A slot that calls a shared slot
 * by `kahea` (`#/takes/container` in the affordance law) reads that slot's rows in place, never a copy.
 *
 * WHICH CARRIER ANSWERS AN ADDRESS: THE STACK DECIDES (`carrierOf`, lar:///ha.ka.ba/lares/api/pono/affordance#/residency). The
 * canon walk seats no bare root, so a canon carrier rests at its stable seat (`lar:///ha.ka.ba/lares/afford/<address terms>`)
 * and TAGS its bare address; a working layer may seat one at the bare root itself. A record titled with the bare root wins
 * where any layer holds one; else the stable seat answers; and TiddlyWiki's own shadow cascade picks the topmost layer for
 * either title, so a carrier a spirit or an operator seats above canon answers in canon's place, and a reveal returns canon.
 * Every view here resolves the title it takes through `carrierOf` first, then reads the records that hang under the carrier
 * that answered.
 *
 * The `afford` filter operator (`filters/afford.ts`) hands these views to the skin templates; the bake and the console face ask
 * through that operator, so one reading serves every render.
 *
 * ROUTES READ THE LIVE STACK (`routesOf`): spelling to address, per surface, from the skins of the carrier that answers each
 * address. The baked pack (`affordance-pack.ts`) runs the same derivation over canon and stands as the floor a sleeping vessel
 * answers from; a standing vessel reads its own stack.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/affordance
 */
import {
  type NeutralCall, AFFORD_SURFACES, type AffordSurface, type HasRow, addressMatcher, addressOfTitle, bareAddressOf, bodyOf, digestOf, edgesOf, exampleCall, kaheaTitles, neutralCallOf,
  parseHasRows, proseOf, renderCall, seatOf, seatsOf, skinOmits, skinRow, spellArg, unfoldRead, usageOf,
} from "./affordance-rows.js";

/** How this module reads one record's text: `undefined` where the wiki holds no such record. */
export type TextOf = (title: string) => string | undefined;

/** The bags whose stable seat (`lar:///ha.ka.ba/<bag>/afford/<address>`) a carrier may rest at, in the order they answer. */
export const AFFORD_SEAT_BAGS = ["lares", "lararium"] as const;

/** One address's stable seat in one bag: `lar:///ha.ka.ba/lares/afford/library.oracle.speaks`. */
export function seatTitleOf(address: string, bag: string = AFFORD_SEAT_BAGS[0]): string {
  return `lar:///ha.ka.ba/${bag}/afford/${address.replace(/^lar:\/\/\//, "")}`;
}

/**
 * What `carrierOf` reads of a wiki: whether a title answers (over the reader's view, so a record the caller may not read
 * answers nothing), and, where the wiki can filter, the carriers that tag an address (a seat in a bag past `AFFORD_SEAT_BAGS`).
 */
export interface CarrierView {
  has(title: string): boolean;
  tagged?(address: string): readonly string[];
}

/** A carrier view over a text lookup: a title answers where the lookup holds a record for it. */
export const carrierViewOfText = (textOf: TextOf): CarrierView => ({ has: (title) => textOf(title) !== undefined });

/**
 * THE CARRIER THAT ANSWERS AN ADDRESS (fork 3 of lar:///ha.ka.ba/kahua/memory/course/comms-ux-enacts). The address rides any
 * spelling: `lar:///library.oracle.speaks`, `library.oracle.speaks`, or a seat title. A record titled with the bare root
 * wins where one stands; else the first stable seat that stands (`AFFORD_SEAT_BAGS` order); else the first carrier that tags
 * the address. The view already answers each title from its topmost layer, so the cascade picks the layer for either title.
 * Null where nothing answers, or where the spelling carries no address.
 */
export function carrierOf(view: CarrierView, address: string): string | null {
  const own = addressOfTitle(address) ?? addressOfTitle(`lar:///${address.replace(/^lar:\/\/\//, "")}`);
  if (own === null) return null;
  if (view.has(own)) return own;
  for (const bag of AFFORD_SEAT_BAGS) {
    const seat = seatTitleOf(own, bag);
    if (view.has(seat)) return seat;
  }
  return [...(view.tagged?.(own) ?? [])].filter((t) => addressOfTitle(t) === own && view.has(t)).sort()[0] ?? null;
}

/** The text of one slot record and of every shared slot it calls by `kahea`, joined in order. */
function slotText(textOf: TextOf, address: string, slot: string): string {
  const own = textOf(`${address}${slot}`) ?? "";
  const called = kaheaTitles(own).map((t) => textOf(t) ?? "");
  return [own, ...called].join("\n");
}

/**
 * The arg rows of a carrier's `#/takes`, the shared slots it calls by `kahea` read in place: what a call binds against. `entity`
 * names another row kind the slot tables (`cell`: the depths a `mu` param reaches, landing 6).
 */
export function takesRows(textOf: TextOf, address: string, entity: "arg" | "cell" = "arg"): HasRow[] {
  return parseHasRows(slotText(textOf, address, "#/takes")).filter((r) => r.entity === entity);
}

/**
 * THE CARRIER'S SEAT HINTS (landing 7; the model's "seat hints answered on every call"): the `gate` rows its `#/gate` tables (who
 * may ask, the ocap the door checks: testimony, never a grant) and any `signs` row it tables in any slot (nature, reversible,
 * crossing, hand). A dry call answers them beside its preview, so a caller reads what the real call would ask of it.
 */
export function seatHintRows(textOf: TextOf, address: string): HasRow[] {
  const gate = parseHasRows(slotText(textOf, address, "#/gate"), "gate");
  const signs = ["", "#/head", "#/takes", "#/gate", "#/skins"].flatMap((slot) => parseHasRows(textOf(`${address}${slot}`) ?? "", "signs"));
  return [...gate, ...signs];
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
  // A DEPTH CELL (landing 6) rides where its surface takes `mu`: a skin that binds no `mu` renders no depth line.
  const takesMu = parseHasRows(slotText(textOf, address, "#/takes")).some((r) => r.entity === "arg" && r.name === "mu" && argOnSurface(r, surface, omitted));
  const rows = (slot === "#/skins" ? skinRows(textOf, address) : parseHasRows(slotText(textOf, address, slot)))
    .filter((row) => !(row.entity === "arg" && !argOnSurface(row, surface, omitted)))
    .filter((row) => !(row.entity === "cell" && !takesMu))
    .filter((row) => !(row.entity === "example" && !runsHere(exampleCall(row, own))));
  // A call naming another affordance (a cure that reads `tiddler.get.reads`) renders under that address, marked foreign: this
  // carrier knows no spelling of another door, and witness W4 parses only the calls that name this one.
  const seats = surface === "cli" ? seatsOf(parseHasRows(slotText(textOf, address, "#/takes")).filter((r) => argOnSurface(r, surface, omitted))) : undefined;
  const callOn = (call: NeutralCall): { line: string; foreign: boolean } =>
    call.address === own
      ? { line: renderCall(surface, spells, call, skin, seats), foreign: false }
      : { line: renderCall(surface, bareAddressOf(call.address) ?? call.address, call), foreign: true };
  // THE SAME CALL AS A SIGIL (landing 5): one runnable line every surface reads alike, beside the skin's own spelling, so a glass
  // button, a seat and a terminal hand `call` the same bytes. Its word is the console spelling where this carrier skins one.
  const word = spellsOf(textOf, address, "console");
  const sigilOf = (call: NeutralCall): string =>
    renderCall("sigil", call.address === own && word !== null && word !== "console" ? word : bareAddressOf(call.address) ?? call.address, call);
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
      out["sigil"] = sigilOf(exampleCall(row, own));
      if (foreign) out["foreign"] = true;
    }
    if (row.entity === "refusal" && row.params["cure"] && runsHere(neutralCallOf(row.params["cure"], own))) {
      const { line, foreign } = callOn(neutralCallOf(row.params["cure"], own));
      out["cure"] = line;
      out["sigil"] = sigilOf(neutralCallOf(row.params["cure"], own));
      if (foreign) out["foreign"] = true;
    }
    // A cell spells the depth it answers as its surface writes the `mu` param, in words (a shell's nomatch refuses a bare `?`).
    if (row.entity === "cell") out["spell"] = `${spellArg(surface, "mu", skin)}=${row.params["mu"] ?? row.name}`;
    if (row.entity === "band" && row.params["exit"]) out["exit"] = row.params["exit"];
    if (row.entity === "skin") out["spells"] = row.params["spells"] ?? row.name;
    return out;
  });
}

/** Two carriers that skin one spelling on one surface: the address that claimed it first (sorted order) and the one after. */
export interface RouteClaim {
  readonly surface: AffordSurface;
  readonly spelling: string;
  readonly addresses: readonly [string, string];
}

/** What `routesOf` derives from the carriers a view holds. */
export interface AffordRoutes {
  /** Per surface: the skin's spelling to the address it reaches (cli `oracle cast`, mcp `oracle_cast`, console the bare address). */
  readonly routes: Record<AffordSurface, Record<string, string>>;
  /** Per address: the carrier title that answered it (`carrierOf`), the one whose skins the routes read. */
  readonly carriers: Record<string, string>;
  /** Per address: its own cli spelling (the skin row's `spells/`), apart from the `also/` spellings routed beside it. */
  readonly own: Record<string, string>;
  /** The cli spellings whose skin row reads `door/part`: one verb of a door whose other verbs keep the door's own table. */
  readonly part: readonly string[];
  /** Every spelling two addresses claim; the first claim keeps the route, and the bake refuses on any. */
  readonly twice: readonly RouteClaim[];
  /**
   * Per surface: the spellings several addresses share, each skin row naming the param that selects it (`by/title`,
   * `by/filter`: one verb word, `get`, skinning `engine.record.reads` and `engine.filter.pages`). The selection rests in
   * carrier rows, so a layer above may move it; `routeOfCall` picks the address whose `by` param a call names, and where the
   * call names none, the one row reading `default/true` (a bare `get meme=true` lists the families through the read).
   */
  readonly chosen: Record<AffordSurface, Record<string, ReadonlyArray<{ readonly address: string; readonly by: string; readonly default?: true }>>>;
}

/**
 * The carrier roots a list of titles names: every title that carries an address (the bare root, or a stable seat) where the
 * list holds the root itself or one of its `#/skins` slots. A bare-root carrier a layer seats with no type tag joins by its
 * skins alone, so a spirit's carrier routes without the tag.
 */
export function carrierRootsIn(titles: Iterable<string>): string[] {
  const roots = new Set<string>();
  for (const title of titles) {
    const cut = title.indexOf("#/");
    const root = cut < 0 ? title : title.slice(0, cut);
    if (addressOfTitle(root) === null) continue;
    if (cut < 0 || title.startsWith(`${root}#/skins`)) roots.add(root);
  }
  return [...roots].sort();
}

/**
 * THE ROUTES THE LIVE STACK SPELLS (comms-ux-enacts landing 3). Spelling to address, per surface, derived from the `#/skins`
 * of the carrier that answers each address over the caller's view (`carrierOf`): a working-layer carrier at the seat or the
 * bare root moves the routes its address takes, and a reveal returns canon's. `titles` lists what the view holds (the roots
 * and slots of every candidate carrier); `carriers` answers which title stands (default: the text lookup). The baked pack
 * runs this same derivation over canon, so the floor a sleeping vessel answers from and the live stack read by one rule.
 * Addresses claim in sorted order; a spelling two addresses claim keeps its first claim and lands in `twice`. A carrier that
 * skins no surface routes nothing, not even its console key.
 */
export function routesOf(textOf: TextOf, titles: Iterable<string>, carriers: CarrierView = carrierViewOfText(textOf)): AffordRoutes {
  const routes = Object.fromEntries(AFFORD_SURFACES.map((s) => [s, {} as Record<string, string>])) as Record<AffordSurface, Record<string, string>>;
  const answered: Record<string, string> = {};
  const own: Record<string, string> = {};
  const part: string[] = [];
  const twice: RouteClaim[] = [];
  type Choice = { address: string; by: string; default?: true };
  const chosen = Object.fromEntries(AFFORD_SURFACES.map((s) => [s, {} as Record<string, Choice[]>])) as Record<AffordSurface, Record<string, Choice[]>>;
  const claim = (surface: AffordSurface, spelling: string, address: string): void => {
    const held = routes[surface][spelling];
    if (held !== undefined && held !== address) { twice.push({ surface, spelling, addresses: [held, address] }); return; }
    routes[surface][spelling] = address;
  };
  const addresses = [...new Set(carrierRootsIn(titles).map((root) => addressOfTitle(root)!))].sort();
  for (const address of addresses) {
    const title = carrierOf(carriers, address);
    if (title === null) continue;
    answered[address] = title;
    // A RECORD WITH NO SKIN ROUTES NOTHING: an alias record at an old seat (DAM law 4) answers its address and no door reaches it.
    const skins = skinRows(textOf, title);
    if (skins.length === 0) continue;
    for (const row of skins) {
      const surface = row.name as AffordSurface;
      if (!(AFFORD_SURFACES as readonly string[]).includes(surface)) continue;
      const spells = (row.params["spells"] ?? row.name).trim();
      const spelling = surface === "cli" ? spells.replace(/^lares\s+/, "") : spells;
      // A SPELLING CHOSEN BY A PARAM (`by/title`) joins the shared word's choices and claims no route of its own.
      const by = row.params["by"]?.trim();
      if (by) { (chosen[surface][spelling] ??= []).push({ address, by, ...(row.params["default"] === "true" ? { default: true as const } : {}) }); continue; }
      claim(surface, spelling, address);
      if (surface === "cli") {
        own[address] = spelling;
        if (row.params["door"] === "part") part.push(spelling);
      }
      // A skin row may name further spellings the one door answers (`also/[[lares shore keep-records]]`, comma-joined).
      for (const alias of (row.params["also"] ?? "").split(",").map((a) => a.trim().replace(/^lares\s+/, "")).filter(Boolean)) claim(surface, alias, address);
    }
    claim("console", bareAddressOf(address)!, address);
  }
  return { routes, carriers: answered, own, part: part.sort(), twice, chosen };
}

/** What a call's leading word reaches: the address, or the choices a shared word offers where no param of the call selects one. */
export type CallRoute =
  | { readonly address: string }
  | { readonly address: null; readonly choices: ReadonlyArray<{ readonly address: string; readonly by: string; readonly default?: true }> };

/**
 * THE ADDRESS A CALL'S LEADING WORD REACHES (comms-ux-enacts landing 4): an address in either spelling (`lar:///engine.record.reads`,
 * `engine.record.reads`) stands for itself; else a verb word or a skin spelling routes on the first surface that spells it
 * (console, cli, mcp, tw5), a shared word choosing by the `by/` param the call names. Null where nothing spells the word.
 */
export function routeOfCall(routes: AffordRoutes, word: string, params: Readonly<Record<string, unknown>>): CallRoute | null {
  const address = addressOfTitle(word) ?? addressOfTitle(`lar:///${word.replace(/^lar:\/\/\//, "")}`);
  if (address !== null) return { address };
  const spelled = word.trim().replace(/^lares\s+/, "");
  for (const surface of ["console", "cli", "mcp", "tw5"] as const) {
    const routed = routes.routes[surface][spelled];
    if (routed !== undefined) return { address: routed };
    const choices = routes.chosen[surface][spelled];
    if (choices === undefined) continue;
    const named = choices.filter((c) => params[c.by] !== undefined);
    if (named.length === 1) return { address: named[0]!.address };
    // A CALL NAMING NO CHOICE takes the one row that reads `default/true`; several, or none, leave the word ambiguous.
    const fallback = choices.filter((c) => c.default === true);
    return named.length === 0 && fallback.length === 1 ? { address: fallback[0]!.address } : { address: null, choices };
  }
  return null;
}

/** The usage spine on one surface, from `#/takes` and its shared slots. */
export function usageLine(textOf: TextOf, address: string, surface: AffordSurface): string {
  const skin = skinRow(skinRows(textOf, address), surface);
  const spells = spellsOf(textOf, address, surface) ?? bareAddressOf(addressOfTitle(address) ?? address) ?? address;
  const omitted = skinOmits(skin);
  return usageOf(surface, spells, parseHasRows(slotText(textOf, address, "#/takes")).filter((r) => r.entity !== "arg" || argOnSurface(r, surface, omitted)), skin);
}

/** The views the `afford` operator answers, by name. A view the operator does not name throws: an empty answer would read as an empty carrier. */
export const AFFORD_VIEWS = ["rows", "usage", "spells", "prose", "body", "digest", "read", "surfaces", "edges", "address", "match"] as const;
export type AffordView = (typeof AFFORD_VIEWS)[number];

/**
 * Answer one view for one carrier address. `arg` carries the slot (rows · prose · body · digest · read) or the pattern (match).
 * The title it takes resolves through `carrierOf` first (over `carriers`, else over `textOf`), so a bare root reads the carrier
 * the stack seats, and a seat title reads a bare-root carrier standing above it. `match` answers the carrier that answers, so
 * a filter over every tagged carrier names each address once.
 */
export function affordView(textOf: TextOf, title: string, view: string, surface: AffordSurface, arg: string, carriers?: CarrierView): string[] {
  const address = carrierOf(carriers ?? carrierViewOfText(textOf), title) ?? title;
  switch (view as AffordView) {
    case "rows": return rowsOf(textOf, address, arg, surface).map((r) => JSON.stringify(r));
    case "usage": return [usageLine(textOf, address, surface)];
    case "spells": { const s = spellsOf(textOf, address, surface); return s === null ? [] : [s]; }
    case "prose": return proseOf(textOf(`${address}${arg}`) ?? "");
    // The prose without the head's tagline: the role restated, which a surface naming the role on its own line leaves out.
    case "body": return bodyOf(textOf(`${address}${arg}`) ?? "");
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
