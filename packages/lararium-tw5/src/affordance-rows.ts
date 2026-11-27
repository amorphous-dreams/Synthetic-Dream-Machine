/**
 * affordance-rows — the pure reading an affordance carrier's slots take before any skin renders them.
 *
 * An affordance carrier (lar:///ha.ka.ba/lares/api/pono/affordance) titles at its bare address (`lar:///oracle.library.consults`)
 * and keeps a closed slot set, in loop order: `#/head · #/shows · #/takes · #/gate · #/refuses · #/answers · #/skins · #/edges`.
 * Each slot leads with a digest line (`!! takes ~ recipe · asking · fresh`) and carries its rows as `has` lines with key/value
 * params, the `~` tail holding the row's one line:
 *
 *   <<has entity=`arg` name=`asking` params=`takes/words needs/seat ~ the query, named before the throw`>>
 *
 * This module reads those rows and derives what every skin spells by RULE (Loom #/slots): cli `--kebab-case`, mcp `snake_case`,
 * tw5 a widget attribute, console an object key. A skin row names only the exceptions (`maps/asking:query`). An example and a
 * cure ride as NEUTRAL CALLS (an address and bound args) and each skin renders its own runnable line from one row.
 *
 * WHERE THE RENDER RUNS. The skin templates in the house skin (`tiddlers-lararium/afford-skin-*.tid`) compose the lines; the
 * `afford` filter operator hands them these rows. The bake (`scripts/build-affordance-pack.ts`) renders those templates in a
 * vessel-less engine into one content-addressed pack. This module holds no words of any affordance: it reads carriers.
 *
 * A CARRIER DESCRIBES; IT NEVER GRANTS (DAM law 1). Nothing here feeds an admission check: the `gate` rows read as testimony.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/affordance
 */

/** The type tag every affordance carrier wears, fully qualified (a bare-root title derives no bag scope). */
export const AFFORDANCE_TAG = "lar:///ha.ka.ba/lares/api/pono/affordance";

/** The surfaces a carrier may skin. `tw5` names the wiki skin (an action widget); `mcp` names the seat's tool. */
export const AFFORD_SURFACES = ["cli", "mcp", "tw5", "console"] as const;
export type AffordSurface = (typeof AFFORD_SURFACES)[number];

/** The read depths, in the read door's own words: the has-stack line, one slot, the whole. */
export const AFFORD_DEPTHS = ["line", "slot", "whole"] as const;
export type AffordDepth = (typeof AFFORD_DEPTHS)[number];

/** The closed slot set, in loop order (observe · orient · decide · act · hoʻoko), so a paged whole-read stops at a phase edge. */
export const AFFORD_SLOTS = ["#/head", "#/shows", "#/takes", "#/gate", "#/refuses", "#/answers", "#/loop", "#/skins", "#/edges"] as const;
export type AffordSlot = (typeof AFFORD_SLOTS)[number];

/** One `has` row: its entity, its name, its key/value params, its bare tokens, and the `~` line. */
export interface HasRow {
  readonly entity: string;
  readonly name: string;
  readonly params: Readonly<Record<string, string>>;
  /** Tokens with no `/` (a bare param reads as a boolean switch: an example's `fresh`). */
  readonly bare: readonly string[];
  readonly role: string;
}

/** A neutral call: an address and its bound args, in authored order; `true` marks a bare switch. */
export interface NeutralCall {
  readonly address: string;
  readonly args: ReadonlyArray<readonly [string, string | true]>;
}

const HAS_ROW = /<<~?\s*has\s+entity=`([^`]*)`\s+name=`([^`]*)`(?:\s+params=`([^`]*)`)?\s*>>/g;
const KAHEA_REF = /<<~\s*kahea\s+ahu\s+slot=`([^`]+)`\s+to=`([^`]+)`\s*>>/g;
const KAHEA_URI = /<<~\s*kahea\s+uri=`([^`]+)`\s*>>/g;

/** Split a params string into tokens, honouring `[[…]]` around a value with spaces (`asking/[[which road first]]`). */
export function tokenize(text: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    while (i < text.length && /\s/.test(text[i]!)) i++;
    if (i >= text.length) break;
    let token = "";
    while (i < text.length && !/\s/.test(text[i]!)) {
      if (text.startsWith("[[", i)) {
        const end = text.indexOf("]]", i + 2);
        if (end === -1) { token += text.slice(i); i = text.length; break; }
        token += text.slice(i + 2, end);
        i = end + 2;
      } else {
        token += text[i]!;
        i++;
      }
    }
    out.push(token);
  }
  return out;
}

/** Read one row's params: `key/value` tokens, bare tokens, and the line after ` ~ ` (or a leading `~ `). */
export function parseParams(text: string): { params: Record<string, string>; bare: string[]; role: string } {
  const cut = text.startsWith("~ ") ? 0 : text.indexOf(" ~ ");
  const head = cut === -1 ? text : text.slice(0, cut);
  const role = cut === -1 ? "" : text.slice(cut + (cut === 0 ? 2 : 3)).trim();
  const params: Record<string, string> = {};
  const bare: string[] = [];
  for (const token of tokenize(head)) {
    const slash = token.indexOf("/");
    if (slash <= 0) bare.push(token);
    else params[token.slice(0, slash)] = token.slice(slash + 1);
  }
  return { params, bare, role };
}

/** Every `has` row a slot's text carries, in authored order; `entity` narrows to one kind. */
export function parseHasRows(text: string, entity?: string): HasRow[] {
  const rows: HasRow[] = [];
  for (const m of text.matchAll(HAS_ROW)) {
    if (entity !== undefined && m[1] !== entity) continue;
    const { params, bare, role } = parseParams(m[3] ?? "");
    rows.push({ entity: m[1]!, name: m[2]!, params, bare, role });
  }
  return rows;
}

/** The shared-slot references a slot calls by `kahea` (``<<~ kahea uri=`…affordance#/takes/container`>>``, or the
 *  `ahu slot=… to=…` spelling): each a title to read, in authored order. */
export function kaheaTitles(text: string): string[] {
  const refs: Array<[number, string]> = [
    ...[...text.matchAll(KAHEA_REF)].map((m) => [m.index ?? 0, `${m[2]!}${m[1]!}`] as [number, string]),
    ...[...text.matchAll(KAHEA_URI)].map((m) => [m.index ?? 0, m[1]!] as [number, string]),
  ];
  return refs.sort((a, b) => a[0] - b[0]).map(([, t]) => t);
}

const LOULOU_EDGE = /<<~\s*loulou\s+uri=`([^`]+)`[^>]*>>/g;

/** The canon a carrier's `#/edges` slot links (`<<~ loulou uri=`…`>>`), in authored order. */
export function edgesOf(text: string): string[] {
  return [...text.matchAll(LOULOU_EDGE)].map((m) => m[1]!);
}

/** A slot's digest line: its first `!` heading, the marks dropped (`takes ~ recipe · asking`). */
export function digestOf(text: string): string {
  const line = text.split("\n").find((l) => /^!+\s/.test(l));
  return line ? line.replace(/^!+\s*/, "").trim() : "";
}

/** A slot's prose: every line that is no heading, no row and no sigil, paragraphs folded to one line each. */
export function proseOf(text: string): string[] {
  // A head's `! <address> ~ <tagline>` heading reads its tagline as the first paragraph; a digest line (`!!`) reads as none.
  const head = /^!\s+[^~\n]*~\s*(.+)$/m.exec(text.split("\n").find((l) => /^!\s/.test(l)) ?? "");
  const kept = text.split("\n").filter((l) => !/^!+\s/.test(l) && !/^\s*<<[~^]?\s*\w/.test(l) && !/^```/.test(l));
  const paragraphs: string[] = [];
  let open: string[] = [];
  for (const l of kept) {
    if (l.trim() === "") { if (open.length) paragraphs.push(open.join(" ")); open = []; continue; }
    open.push(l.trim());
  }
  if (open.length) paragraphs.push(open.join(" "));
  return head ? [head[1]!.trim(), ...paragraphs] : paragraphs;
}

const kebab = (name: string): string => name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/_/g, "-").toLowerCase();
const snake = (name: string): string => kebab(name).replace(/-/g, "_");

/** The `maps/a:b,c:d` exceptions a skin row names, as a lookup from the neutral name to the skin's own. */
export function skinMaps(skin: HasRow | undefined): Map<string, string> {
  const out = new Map<string, string>();
  for (const pair of (skin?.params["maps"] ?? "").split(",")) {
    const [from, to] = pair.split(":");
    if (from && to) out.set(from.trim(), to.trim());
  }
  return out;
}

/** The args a skin row says its door does not take (`omits/fresh,seed`: a seat's tool holds no hand-only switch). */
export function skinOmits(skin: HasRow | undefined): Set<string> {
  return new Set((skin?.params["omits"] ?? "").split(",").map((s) => s.trim()).filter(Boolean));
}

/** An argument's spelling on one surface: the skin's exception where it names one, the rule otherwise. */
export function spellArg(surface: AffordSurface, name: string, skin?: HasRow): string {
  const own = skinMaps(skin).get(name) ?? name;
  switch (surface) {
    case "cli": return `--${kebab(own)}`;
    case "mcp": return snake(own);
    case "tw5": return kebab(own);
    case "console": return own;
  }
}

/** The skin row for one surface among the rows of `#/skins` and its nested slots; absent, the carrier holds no such skin. */
export function skinRow(rows: readonly HasRow[], surface: AffordSurface): HasRow | undefined {
  return rows.find((r) => r.entity === "skin" && r.name === surface);
}

/** Read a neutral call off a cure or example value: `oracle.library.consults asking/<words>` (the address leads; args follow). */
export function neutralCallOf(value: string, fallbackAddress: string): NeutralCall {
  const tokens = tokenize(value);
  const lead = tokens[0] ?? "";
  const address = /^[a-z0-9-]+\.[a-z0-9-]+\.[a-z0-9-]+$/.test(lead) ? lead : null;
  const rest = address === null ? tokens : tokens.slice(1);
  const args: Array<readonly [string, string | true]> = [];
  for (const token of rest) {
    const slash = token.indexOf("/");
    const value = token.slice(slash + 1);
    args.push(slash <= 0 ? [token, true] : [token.slice(0, slash), value === "true" ? true : value]);
  }
  return { address: address === null ? fallbackAddress : `lar:///${address}`, args };
}

/** An example row as a neutral call: its params are the bound args (the `then/` param names the next read, never an arg). */
export function exampleCall(row: HasRow, address: string): NeutralCall {
  const args: Array<readonly [string, string | true]> = [];
  for (const [k, v] of Object.entries(row.params)) if (k !== "then") args.push([k, v === "true" ? true : v]);
  for (const b of row.bare) args.push([b, true]);
  return { address, args };
}

/** A cli value as a shell word: a `<placeholder>` and a plain word stand bare; anything else rides single-quoted. */
const shellQuote = (v: string): string =>
  /^<[^\s<>]+>$/.test(v) || /^[A-Za-z0-9_./:,=@+-]+$/.test(v) ? v : `'${v.replace(/'/g, "'\\''")}'`;

/**
 * A positional arg's seat on the cli: the door reads its word by place, never by flag (`lares law pin <uri>`, `lares ddate
 * [+FORMAT] [day month year]`). An arg row names it with `seat/N` (N from 1); `as/<spelling>` names how the cli writes it
 * in a usage spine and `lead/<prefix>` the characters its word carries glued to it (`+` before a ddate format). Other
 * surfaces spell the arg by name as ever.
 */
export interface Seat { readonly seat: number; readonly as: string; readonly lead: string }

/** The seat an arg row names, or null where it rides a flag. */
export function seatOf(row: HasRow): Seat | null {
  const n = Number(row.params["seat"]);
  return row.entity === "arg" && Number.isInteger(n) && n > 0 ? { seat: n, as: row.params["as"] ?? `<${row.name}>`, lead: row.params["lead"] ?? "" } : null;
}

/** The seats of every positional arg among a slot's rows, by neutral name. */
export function seatsOf(rows: readonly HasRow[]): Map<string, Seat> {
  const out = new Map<string, Seat>();
  for (const row of rows) { const s = seatOf(row); if (s !== null) out.set(row.name, s); }
  return out;
}

/** A value as a literal on the code surfaces: a whole number stands bare, anything else rides as a JSON string. */
const literal = (v: string): string => (/^-?\d+$/.test(v) ? v : JSON.stringify(v));

/** One neutral call rendered runnable on one surface, given that surface's spelling (`lares oracle cast`, `oracle_cast`, …). */
export function renderCall(surface: AffordSurface, spells: string, call: NeutralCall, skin?: HasRow, seats?: ReadonlyMap<string, Seat>): string {
  switch (surface) {
    case "cli": {
      const seated = call.args
        .filter(([k]) => seats?.has(k))
        .sort((a, b) => seats!.get(a[0])!.seat - seats!.get(b[0])!.seat)
        .map(([k, v]) => shellQuote(`${seats!.get(k)!.lead}${v === true ? "" : v}`));
      const flags = call.args.filter(([k]) => !seats?.has(k)).map(([k, v]) => [spellArg(surface, k, skin), v] as const);
      return [spells, ...seated, ...flags.map(([k, v]) => (v === true ? k : `${k} ${shellQuote(v)}`))].join(" ");
    }
    case "mcp": {
      const named = call.args.map(([k, v]) => [spellArg(surface, k, skin), v] as const);
      return `${spells}(${named.map(([k, v]) => `${k}=${v === true ? "True" : literal(v)}`).join(", ")})`;
    }
    case "tw5": {
      const named = call.args.map(([k, v]) => [spellArg(surface, k, skin), v] as const);
      return `<$${spells}${named.map(([k, v]) => ` ${k}${v === true ? `="yes"` : `=${JSON.stringify(v)}`}`).join("")}/>`;
    }
    case "console": {
      const named = call.args.map(([k, v]) => [spellArg(surface, k, skin), v] as const);
      return `$tw.lares.afford.run(${JSON.stringify(call.address.replace(/^lar:\/\/\//, ""))}, {${named.map(([k, v]) => `${JSON.stringify(k)}: ${v === true ? "true" : literal(v)}`).join(", ")}})`;
    }
  }
}

/** Whether an arg row reads as required: `needs/required` or `needs/always`, or one side of a `needs/one-of:a,b` choice. */
const oneOf = (row: HasRow): string[] | null => {
  const needs = row.params["needs"] ?? "";
  return needs.startsWith("one-of:") ? needs.slice("one-of:".length).split(",").map((s) => s.trim()).filter(Boolean) : null;
};

/** The usage spine on one surface, derived from `#/takes` (the cli spine reads `usage: <spells> …`; positionals lead it). */
export function usageOf(surface: AffordSurface, spells: string, takes: readonly HasRow[], skin?: HasRow): string {
  const parts: string[] = [];
  const grouped = new Set<string>();
  const seated = surface === "cli" ? takes.filter((r) => seatOf(r) !== null).sort((a, b) => seatOf(a)!.seat - seatOf(b)!.seat) : [];
  const ordered = [...seated, ...takes.filter((r) => !seated.includes(r))];
  for (const row of ordered) {
    if (row.entity !== "arg" || grouped.has(row.name)) continue;
    const spell = (r: HasRow): string => {
      const own = surface === "cli" ? seatOf(r) : null;
      if (own !== null) return own.as;
      const flag = spellArg(surface, r.name, skin);
      const value = r.params["takes"];
      if (surface === "cli") return value ? `${flag} <${value}>` : flag;
      return value ? `${flag}=<${value}>` : flag;
    };
    const choice = oneOf(row);
    if (choice !== null) {
      const members = takes.filter((r) => r.entity === "arg" && choice.includes(r.name));
      for (const m of members) grouped.add(m.name);
      parts.push(`(${members.map(spell).join(" | ")})`);
      continue;
    }
    parts.push(row.params["needs"] === "required" || row.params["needs"] === "always" ? spell(row) : `[${spell(row)}]`);
  }
  return surface === "cli" ? `usage: ${[spells, ...parts].join(" ")}` : `${spells}(${parts.join(", ")})`;
}

/** The read that opens the next depth on one surface: the read door's own words, never a new unfold verb. */
export function unfoldRead(surface: AffordSurface, address: string, slot?: string): string {
  const title = slot ? `${address}${slot}` : address;
  switch (surface) {
    case "cli": return `lares tiddler get ${title} --recipe lares --meme${slot ? "" : " --skinny"}`;
    case "mcp": return `tiddler_get(title=${JSON.stringify(address)}, recipe="lares", meme=True, grain=${slot ? `"slot", slot=${JSON.stringify(slot)}` : `"skinny"`})`;
    case "tw5": return `[[${title}]]`;
    case "console": return slot ? `$tw.lares.afford.slot(${JSON.stringify(address.replace(/^lar:\/\/\//, ""))}, ${JSON.stringify(slot)})` : `$tw.lares.afford.whole(${JSON.stringify(address.replace(/^lar:\/\/\//, ""))})`;
  }
}

/** The bare address an affordance title carries (`lar:///oracle.library.consults` → `oracle.library.consults`), or null where it holds none. */
export function bareAddressOf(title: string): string | null {
  const m = /^lar:\/\/\/([a-z0-9-]+\.[a-z0-9-]+\.[a-z0-9-]+)$/.exec(title);
  return m ? m[1]! : null;
}

/**
 * The address a carrier's title carries: the bare root itself (`lar:///oracle.library.consults`), or the stable seat canon gives it
 * (`lar:///ha.ka.ba/lares/afford/oracle.library.consults`, whose record tags the bare address). Null for any other title.
 */
export function addressOfTitle(title: string): string | null {
  const m = /^lar:\/\/\/(?:ha\.ka\.ba\/[a-z0-9-]+\/afford\/)?([a-z0-9-]+\.[a-z0-9-]+\.[a-z0-9-]+)$/.exec(title);
  return m ? `lar:///${m[1]!}` : null;
}

/** A wildcard over addresses (t2/t3 only: `oracle.*`, `custody.hand.*`); a t1 wildcard refuses by name (DAM law 2). */
export function addressMatcher(pattern: string): (address: string) => boolean {
  const bare = pattern.replace(/^lar:\/\/\//, "");
  const terms = bare.split(".");
  if (terms[0] === "*" || terms[0] === "") throw new Error(`afford-wildcard-heading: "${pattern}" wildcards the heading; a filter names t1 and wildcards t2 or t3 alone`);
  return (address: string): boolean => {
    const have = address.replace(/^lar:\/\/\//, "").split(".");
    for (let i = 0; i < terms.length; i++) {
      if (terms[i] === "*") return i === terms.length - 1 || have[i] !== undefined;
      if (have[i] !== terms[i]) return false;
    }
    return have.length === terms.length;
  };
}
