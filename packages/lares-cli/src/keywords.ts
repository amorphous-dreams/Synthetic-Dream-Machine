/**
 * keywords — ONE DOOR, KEYWORD PARAMS (lar:///ha.ka.ba/kahua/memory/course/comms-ux-enacts, its "One door" section, as
 * the operator meant it: key=value keyword params; the keyword head): `lares` plus key=value keywords in any order. A
 * `lares` call acts as a `set` firing acts in a chat turn, so the two share one param set and the seed's own values
 * (lar:///ha.ka.ba/lares/api/noosphere-boot #/set-and-setting). A typed call reads as THE KEYWORD LINE.
 *
 *   ACT KEYWORDS      name the act, EXACTLY ONE per line. Each house door word stands as a keyword whose value names its
 *                     sub-act or target: `get=<title>` · `put=<title>` · `delete=<title>` · `rename=<title> to=<title>` ·
 *                     `filter=<expr>` (a get by filter) · `act=lar:///t1.t2.t3` (any affordance by address) · `rite=kukulu` ·
 *                     `bag=show` · `spirit=om` · every door the command table holds. Two act keywords refuse, naming both
 *                     lines. None: the house reads (the bare door).
 *   SHAPING KEYWORDS  shape the act: the set panel's own keywords (`mu` the lens, `aperture` the range, `stance`, `mode`,
 *                     `mood`, `note`), then `recipe` · `face` · `slot` · `by` · `base` · `file` · `append` · `replace` ·
 *                     `with`, and any param the act's carrier takes (`text`, `fields`, `to`, …), which the VM binds against
 *                     the carrier's live `#/takes`.
 *
 * The call door's act keywords route through the carriers' cli skin rows like any spelling (the VM resolves `get` by `title`
 * or `filter`). A door the command table still runs by position takes its act keyword's value as its sub-verb words, and its
 * shaping keywords as its own flags, the dials folded where its code walks them: a Pentacle carry (`_0` `_?` `_!`) asks
 * `--dry-run`, the Sword alone (`!0`) the machine answer (`--json`), Rest (`00`) nothing; any other carry refuses
 * `mu-cell-empty` until the door takes a carrier ([10 + 23]). `with=` carries a door's own words through whole (`with=--keep`).
 *
 * THE FLAG ZOO BURNS INTO THE DIALS: a keyword line carries no `--flag`. `--dry-run` reads `mu=_0` · `--json` and `--quiet`
 * read `mu=!0` · `--meme` and `--skinny` read `aperture=measure` · `--all` and `--grain` read `aperture=arc`; any other flag
 * reads as its own keyword. Each answers a teaching refusal naming the keyword line to run.
 *
 * A LEAF: pure over the tokens and the door table; `bin/lares.ts` runs the line it reads.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/affordance
 */
import { isMuFault, muWordsOf, readMu, readAperture, isApertureFault, reachesWhole } from "@lararium/tw5";
import { PARAM_TOKEN } from "./parse-args.js";

/** The call door's act keywords, each to the param its value fills (`act` names the address itself). */
export const CALL_KEYS: Readonly<Record<string, string | null>> = Object.freeze({ get: "title", put: "title", delete: "title", rename: "title", filter: "filter", act: null });

/** The set panel's keywords a keyword line shares (beside the two dials): testimony that shapes the call, echoed on stderr. */
export const SET_KEYS: readonly string[] = ["stance", "mode", "mood", "note"];

/** The two dials. */
export const DIAL_KEYS: readonly string[] = ["mu", "aperture"];

/** The container keywords: door words that read as a container beside an act keyword (`get=x bag=lares`), and as a door alone. */
export const CONTAINER_KEYS: readonly string[] = ["recipe", "bag", "realm", "face", "target"];

/** Every shaping keyword the law names; a carrier's own params ride beside them. */
export const SHAPING_KEYS: readonly string[] = [...DIAL_KEYS, ...SET_KEYS, "recipe", "face", "slot", "by", "base", "file", "append", "replace", "with"];

/** The flags that burned into the dials, each to the key=value it reads as. */
export const BURNED_FLAGS: Readonly<Record<string, string>> = Object.freeze({
  "dry-run": "mu=_0", json: "mu=!0", quiet: "mu=!0", meme: "aperture=measure", skinny: "aperture=measure", all: "aperture=arc", grain: "aperture=arc",
});

/** A keyword line the grammar refuses: its code, the words, and the keyword line that cures it. */
export class KeywordUsage extends Error {
  constructor(readonly code: string, message: string, readonly cure: string | null = null) {
    super(cure === null ? `${code}: ${message}` : `${code}: ${message}; run: ${cure}`);
    this.name = "KeywordUsage";
  }
}

/** One keyword line read: the bare door, a call through the call door, or a door the command table runs. */
export type KeywordLine =
  | { readonly kind: "bare"; readonly params: Readonly<Record<string, string>>; readonly set: Readonly<Record<string, string>> }
  | { readonly kind: "call"; readonly verb: string; readonly params: Readonly<Record<string, string>>; readonly set: Readonly<Record<string, string>> }
  | { readonly kind: "door"; readonly door: string; readonly argv: readonly string[]; readonly set: Readonly<Record<string, string>>; readonly notes: readonly string[] };

/** What the keyword reader takes from the command table: each door's name and the flag names its handlers read. */
export interface KeywordDoors {
  readonly names: readonly string[];
  readonly accepts: (door: string) => readonly string[];
}

/** True where a command line is a keyword line: its first token names a keyword (`lares rite=kukulu`, `lares mu=_0`). */
export const isKeywordLine = (argv: readonly string[]): boolean => argv.length > 0 && PARAM_TOKEN.test(argv[0]!);

/** A value as a shell word, quoted where it holds a space or a quote. */
export const shellWord = (value: string): string => (/^[A-Za-z0-9_@%+=:,./#*?!-]*$/.test(value) && value !== "" ? value : `'${value.replace(/'/g, "'\\''")}'`);

/** One key=value keyword as a token a shell reads back. */
export const keyWord = (key: string, value: string): string => `${key}=${shellWord(value)}`;

/** A keyword line spelled back: `lares k=v …`. */
export const keywordLine = (pairs: ReadonlyArray<readonly [string, string]>): string => ["lares", ...pairs.map(([k, v]) => keyWord(k, v))].join(" ");

/** The flag a token names (`--dry-run`, `--grain=whole`), or null. */
function flagOf(token: string): { readonly name: string; readonly value: string | null } | null {
  if (!token.startsWith("--") || token === "--") return null;
  const body = token.slice(2);
  const eq = body.indexOf("=");
  return eq === -1 ? { name: body, value: null } : { name: body.slice(0, eq), value: body.slice(eq + 1) };
}

/** The key=value a burned flag reads as (`--grain=skinny` reads the card, `--grain whole` the arc). */
export function flagReading(name: string, value: string | null): string {
  if (name === "grain" && value !== null && value !== "whole") return value === "skinny" ? "aperture=measure" : `aperture=${value}`;
  return BURNED_FLAGS[name] ?? (value === null ? `${name}=true` : keyWord(name, value));
}

/** A keyword line's tokens split: the pairs in the order written, a repeated keyword joining its values with a space. */
function pairsOf(tokens: readonly string[]): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  for (const token of tokens) {
    const flag = flagOf(token);
    if (flag !== null) {
      const reading = flagReading(flag.name, flag.value);
      const others = tokens.filter((t) => t !== token && PARAM_TOKEN.test(t));
      throw new KeywordUsage("keyword-flag", `a keyword line carries no flag: --${flag.name}${flag.value === null ? "" : `=${flag.value}`} reads as ${reading}`, ["lares", ...others, reading].join(" "));
    }
    if (!PARAM_TOKEN.test(token)) {
      const lead = pairs[0];
      const hint = lead === undefined ? `lares ${token}=…` : `lares ${keyWord(lead[0], `${lead[1]} ${token}`.trim())}`;
      throw new KeywordUsage("keyword-positional", `every token on a keyword line names a keyword as key=value, and "${token}" names none (a door's sub-verb rides its act keyword's value)`, hint);
    }
    const eq = token.indexOf("=");
    const key = token.slice(0, eq);
    const value = token.slice(eq + 1);
    const held = pairs.find(([k]) => k === key);
    if (held === undefined) pairs.push([key, value]);
    else held[1] = held[1] === "" ? value : value === "" ? held[1] : `${held[1]} ${value}`;
  }
  return pairs;
}

/** The act keywords a line names, in the order written. */
function actKeywordsOf(keys: readonly string[], doors: KeywordDoors): string[] {
  const calls = keys.filter((k) => k in CALL_KEYS);
  const doorKeys = keys.filter((k) => !(k in CALL_KEYS) && doors.names.includes(k) && !CONTAINER_KEYS.includes(k) && !SHAPING_KEYS.includes(k));
  const acts = [...calls, ...doorKeys];
  // A DOOR WORD THAT NAMES ANOTHER DOOR'S FLAG (`lares lei=show rite=kukulu`: the lei door reads `--rite`) shapes that door: where
  // exactly one door's own flags cover every other door word on the line, that door takes the act. An act keyword of the call door never absorbs one.
  if (calls.length === 0 && doorKeys.length > 1) {
    const owners = doorKeys.filter((d) => doorKeys.every((o) => o === d || doors.accepts(d).includes(o)));
    if (owners.length === 1) return owners;
  }
  // A container word alone (no other act keyword) names its own door: `lares bag=show` runs the bag door.
  if (acts.length === 0) {
    const container = keys.filter((k) => doors.names.includes(k) && CONTAINER_KEYS.includes(k));
    if (container.length > 0) return container.slice(0, 1);
  }
  return acts;
}

/** READ ONE KEYWORD LINE (`tokens` exclude `lares` itself). */
export function readKeywords(tokens: readonly string[], doors: KeywordDoors): KeywordLine {
  const pairs = pairsOf(tokens);
  const keys = pairs.map(([k]) => k);
  const acts = actKeywordsOf(keys, doors);
  if (acts.length > 1) {
    const lines = acts.map((k) => keywordLine([[k, pairs.find(([p]) => p === k)![1]]]));
    throw new KeywordUsage("act-keywords-doubled", `a keyword line names exactly one act keyword, and this one names ${acts.length}: ${acts.join(" and ")}; run each as its own line: ${lines.join(" · ")}`, lines[0]!);
  }
  const set: Record<string, string> = {};
  const act = acts[0];
  if (act === undefined) {
    const params: Record<string, string> = {};
    for (const [k, v] of pairs) {
      if (SET_KEYS.includes(k)) set[k] = v;
      else if (DIAL_KEYS.includes(k) || k === "face" || k === "mandate") params[k] = v;
      else {
        throw new KeywordUsage("act-keyword-unnamed", `"${k}" names no act keyword and shapes no house read; an act keyword names the act (get= put= delete= rename= filter= act= rite= bag= …)`, `lares help mu=?0`);
      }
    }
    return { kind: "bare", params, set };
  }
  const value = pairs.find(([k]) => k === act)![1];
  if (act in CALL_KEYS) {
    const params: Record<string, string> = {};
    let verb: string;
    if (act === "act") {
      if (!value.startsWith("lar:///")) throw new KeywordUsage("act-address", `act= names an affordance by its lar: address (lar:///t1.t2.t3), and "${value}" names none`, "lares act=lar:///engine.law.indexes");
      verb = value;
    } else {
      if (value === "") throw new KeywordUsage("act-keyword-empty", `${act}= names its ${CALL_KEYS[act]} as its value`, `lares ${act}=<${CALL_KEYS[act]}>`);
      verb = act === "filter" ? "get" : act;
      params[CALL_KEYS[act]!] = value;
    }
    for (const [k, v] of pairs) {
      if (k === act) continue;
      // The set panel's keywords stay shared on every call, a delete's included: its own choice rides `way=kapae|reveal`.
      if (SET_KEYS.includes(k)) { set[k] = v; continue; }
      params[k] = v;
    }
    return { kind: "call", verb, params, set };
  }
  return doorLine(act, value, pairs, doors, set);
}

/** A door the command table runs by position: its act keyword's value as its sub-verb words, the dials folded, the rest as its flags. */
function doorLine(door: string, value: string, pairs: ReadonlyArray<readonly [string, string]>, doors: KeywordDoors, set: Record<string, string>): KeywordLine {
  const accepts = doors.accepts(door);
  const argv: string[] = [door, ...value.split(/\s+/).filter(Boolean)];
  const notes: string[] = [];
  const line = keywordLine([[door, value]]);
  for (const [k, v] of pairs) {
    if (k === door) continue;
    if (SET_KEYS.includes(k)) { set[k] = v; continue; }
    if (k === "mu") {
      const read = readMu(v);
      if (isMuFault(read)) throw new KeywordUsage(read.reason, read.message, read.cure === null ? line : `${line} mu=${read.cure}`);
      if (read.carry === "00") continue;
      if (read.carry === "_0" || read.carry === "_?" || read.carry === "_!") {
        if (!accepts.includes("dry-run")) throw new KeywordUsage("mu-cell-empty", `the ${door} door walks no dry path yet, so a ${read.carry} call lands nothing; its carrier lands the preview ([10 + 23]), and the plain line lands the act`, line);
        argv.push("--dry-run");
        continue;
      }
      if (read.carry === "!0") { argv.push("--json"); continue; }
      throw new KeywordUsage("mu-cell-empty", `the ${door} door takes no carrier yet, so it reads ${read.carry} (${muWordsOf(read.carry)}) on no cell: by its own code it walks _0 (--dry-run, where it walks one) and !0 (its machine answer) alone, until its carrier lands ([10 + 23])`, line);
    }
    if (k === "aperture") {
      const read = readAperture(v);
      if (isApertureFault(read)) throw new KeywordUsage(read.reason, read.message, read.cure === null ? line : `${line} aperture=${read.cure}`);
      if (reachesWhole(read.rank) && accepts.includes("verbose")) argv.push("--verbose");
      else notes.push(`aperture=${read.n}/${read.rank} rides as testimony: the ${door} door reads no range until its carrier lands ([10 + 23])`);
      continue;
    }
    if (k === "with") { argv.push(...v.split(/\s+/).filter(Boolean)); continue; }
    if (v === "true") argv.push(`--${k}`);
    else if (v === "false") argv.push(`--no-${k}`);
    else argv.push(`--${k}=${v}`);
  }
  return { kind: "door", door, argv, set, notes };
}

/**
 * THE POSITIONAL SPELLING A CALL WORD BURNED (`lares get Room4`, `lares rename a b`): the keyword line that reads it, or null
 * where the line already speaks params (`lares get title=…`, the call shape) or names no call word.
 */
export function positionalCure(command: string | null, positional: readonly string[]): string | null {
  if (command === null || !(command in CALL_KEYS) || command === "act" || command === "filter") return null;
  const words = positional.filter((t) => !PARAM_TOKEN.test(t) && !t.startsWith("--"));
  if (words.length === 0 || PARAM_TOKEN.test(positional[0] ?? "")) return null;
  const rest = positional.filter((t) => PARAM_TOKEN.test(t)).map((t) => { const eq = t.indexOf("="); return [t.slice(0, eq), t.slice(eq + 1)] as const; });
  const pairs: Array<readonly [string, string]> = [[command, words[0]!]];
  if (command === "rename" && words[1] !== undefined) pairs.push(["to", words[1]]);
  return keywordLine([...pairs, ...rest]);
}
