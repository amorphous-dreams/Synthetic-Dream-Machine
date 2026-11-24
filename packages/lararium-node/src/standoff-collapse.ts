/**
 * standoff-collapse — the rules a PERSON sets for which stand-offs settle with no hand present.
 *
 * A stand-off says the file and the records both moved past their last agreement and no gate picks (`projection-gate`,
 * `both-moved` · `no-base`). The disk side loads into the worn face's draft layer as drafts of its targets
 * (`standoff-drafts.ts`), and before any alert rises these rules run against the three sides: the base (the words of the
 * last agreement, read from the file's own git history, `basePoolText`), the records' render the key folded, and the
 * file's words. A rule that collapses the stand-off names the side the carrier settles toward; a stand-off no enabled
 * rule collapses stays drafts plus one awaiting alert, for a person.
 *
 * THE RULES ARE THE PERSON'S, AND THEY REST IN THE DAEMON FACE. Each rule reads one config tiddler,
 * `$:/config/lares/shore/collapse/<rule>`, whose `bags` field names (a TiddlyWiki title list) the bags the rule may
 * collapse in. A rule with no tiddler, or a bag its list never names, collapses nothing. No env var, no flag on a
 * command line and no seat's word enables one: the person writes the tiddler in their daemon face, and the vessel reads
 * it from there (`collapseConfigOf`).
 *
 *   canonical-equivalent  the two sides say the same thing through the memetic congruence (`render(parse(·))`); the
 *                         file takes the records' framing, no word moves
 *   seal-line-only        the two sides differ only in the ETX seal line; the records' render re-seals the file
 *   whitespace-only       the two sides differ only in whitespace (trailing space, blank-line runs, the final newline),
 *                         the seal set bare; the file's words land in the records
 *   slot-disjoint         the two sides moved DIFFERENT slots of one meme against the base: each slot only one side
 *                         moved takes that side, through the one seal merge with NO line merge, so a slot both sides
 *                         moved stays a stand-off whatever lines it moved
 *   line-three-way        a slot both sides moved line-merges through git's own merge (`mergeTexts`), clean hunks only.
 *                         Its own tiddler is its own flag; the corpus proof
 *                         (`tests/standoff-collapse-corpus.test.ts`: every tracked `.mem` takes two-sided edits in
 *                         one slot, and no merge drops a line) stands before any person enables it
 *
 * PURE but for the line merge, which spawns git (`mergeTexts`). Nothing here reads a store, a wiki, a clock or the disk.
 *
 * Meme: lar:///ha.ka.ba/lararium/api/disk-projection#/projection-routing
 */

import { bareSeal, mergeCarrier, type LineMerge, type MemeSealer } from "@lararium/mesh/meme-merge";
import { mergeTexts } from "@lararium/mesh/meme-merge-git";
import { stampCarrier, verifyBcc } from "@lararium/memetic-frame";
import { normalizeMemeSource } from "@lararium/tw5/meme-normalize";

/** Where the person's collapse rules rest in their daemon face: one tiddler per rule. */
export const COLLAPSE_CONFIG_PREFIX = "$:/config/lares/shore/collapse/";

/** The rules, in the order they run. */
export const COLLAPSE_RULES = ["canonical-equivalent", "seal-line-only", "whitespace-only", "slot-disjoint", "line-three-way"] as const;
export type CollapseRule = (typeof COLLAPSE_RULES)[number];

export const isCollapseRule = (v: unknown): v is CollapseRule => typeof v === "string" && (COLLAPSE_RULES as readonly string[]).includes(v);

/** The config tiddler a rule reads. */
export const collapseRuleTitle = (rule: CollapseRule): string => `${COLLAPSE_CONFIG_PREFIX}${rule}`;

/** The person's rules, as read: each rule and the bags it may collapse in. */
export type CollapseConfig = Readonly<Partial<Record<CollapseRule, readonly string[]>>>;

/** A TiddlyWiki title list (`a [[b c]] d`) read into its titles. */
function titleList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value !== "string") return [];
  const out: string[] = [];
  for (const m of value.matchAll(/\[\[([^\]]*)\]\]|(\S+)/g)) out.push((m[1] ?? m[2]!).trim());
  return out.filter(Boolean);
}

/**
 * THE PERSON'S RULES, READ FROM THEIR DAEMON FACE: `fieldsOf(title)` answers a config tiddler's fields, or null where it
 * stands absent. Each rule reads its own `bags` list; a rule with no tiddler or an empty list enables nowhere.
 */
export function collapseConfigOf(fieldsOf: (title: string) => Readonly<Record<string, unknown>> | null | undefined): CollapseConfig {
  const out: Partial<Record<CollapseRule, readonly string[]>> = {};
  for (const rule of COLLAPSE_RULES) {
    const bags = titleList(fieldsOf(collapseRuleTitle(rule))?.["bags"]);
    if (bags.length > 0) out[rule] = Object.freeze(bags);
  }
  return Object.freeze(out);
}

/** The rules the person enabled for one bag. */
export function rulesFor(config: CollapseConfig | null | undefined, bag: string): ReadonlySet<CollapseRule> {
  const on = new Set<CollapseRule>();
  if (!config) return on;
  for (const rule of COLLAPSE_RULES) if (config[rule]?.includes(bag)) on.add(rule);
  return on;
}

/** The normalize law's shore for a merged `.mem` body: the frame canonical, then the block check stamped over it. */
export const memeSealer: MemeSealer = (body) => {
  const res = normalizeMemeSource(body, { grammar: false });
  if (res.faults.length > 0) return { ok: false, why: res.faults.map((f) => `${f.code}: ${f.message}`).join("; ") };
  const sealed = stampCarrier(res.text);
  const verdict = verifyBcc(sealed);
  return verdict === "ok" || verdict === "head-unbound" ? { ok: true, text: sealed } : { ok: false, why: `the merged carrier reads ${verdict}; no check can seal it` };
};

/**
 * A LINE MERGE THAT MERGES NO LINES: a piece one side alone moved takes that side, and a piece both moved stands
 * conflicted. Handed to the one seal merge, it leaves slot grain as the finest grain that settles.
 */
export const noLineMerge: LineMerge = ({ base, ours, theirs }) => {
  if (ours === theirs || theirs === base) return { text: ours, conflicts: 0 };
  if (ours === base) return { text: theirs, conflicts: 0 };
  return { text: ours, conflicts: 1 };
};

/**
 * Whitespace folded where it carries no words: each line's trailing space dropped, runs of blank lines folded to one, the
 * leading and trailing blank lines dropped. Two places keep every byte: a FENCED block (``` or ~~~, closed by a run at
 * least as long), whose blank lines and trailing spaces belong to the code it holds, and a line ending in two or more
 * spaces, the hard break a renderer reads.
 */
export function foldWhitespace(text: string): string {
  const out: string[] = [];
  let fence: string | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const mark = /^\s*(`{3,}|~{3,})/.exec(raw)?.[1] ?? null;
    if (fence !== null) {
      out.push(raw);
      if (mark !== null && mark[0] === fence[0] && mark.length >= fence.length && raw.trim() === mark) fence = null;
      continue;
    }
    if (mark !== null) fence = mark;
    const line = raw.trim() === "" ? "" : / {2,}$/.test(raw) && mark === null ? raw : raw.replace(/[ \t]+$/, "");
    if (line === "" && (out.length === 0 || out[out.length - 1] === "")) continue;
    out.push(line);
  }
  while (out.length > 0 && out[out.length - 1] === "" && fence === null) out.pop();
  return out.join("\n");
}

export interface CollapseInput {
  /** The words of the last agreement, or null where no history holds them. */
  readonly base: string | null;
  /** The records' render the stand-off's key folded. */
  readonly records: string;
  /** The file's words. */
  readonly disk: string;
  /** The file's extension: the slot rules read `.mem` carriers alone. */
  readonly ext: string;
  /** The path a conflict marker names. */
  readonly path: string;
  readonly rules: ReadonlySet<CollapseRule>;
  /** `render(parse(text))` through the memetic congruence, or null where none stands. */
  readonly canonical?: (text: string) => string | null;
  /** The line merge `line-three-way` runs (git's own by default). */
  readonly lineMerge?: LineMerge;
}

/**
 * Where a collapse settles the carrier: `records` (the records' render writes over the file), `disk` (the file's words
 * land in the records) or `merged` (`text` lands in the records, and the next weighing writes it over the file).
 */
export type CollapseToward = "records" | "disk" | "merged";

export type CollapseVerdict =
  | { readonly collapsed: true; readonly rule: CollapseRule; readonly toward: CollapseToward; readonly text: string }
  | { readonly collapsed: false; readonly why: string };

/**
 * ONE STAND-OFF AGAINST THE PERSON'S RULES, in their fixed order. The first rule that collapses names the rule and the
 * side; none collapsing answers why, naming each enabled rule's reading.
 */
export function decideCollapse(input: CollapseInput): CollapseVerdict {
  const { records, disk, rules, ext, path } = input;
  if (rules.size === 0) return { collapsed: false, why: "no collapse rule stands enabled for this bag" };
  const readings: string[] = [];
  const canon = (t: string): string | null => (input.canonical ? input.canonical(t) : null);

  if (rules.has("canonical-equivalent")) {
    const d = canon(disk);
    const r = canon(records);
    if (d !== null && r !== null && d === r) return { collapsed: true, rule: "canonical-equivalent", toward: "records", text: records };
    readings.push(d === null || r === null ? "canonical-equivalent: no canonical view of both sides" : "canonical-equivalent: the sides say different things");
  }
  if (rules.has("seal-line-only")) {
    if (bareSeal(disk) === bareSeal(records)) return { collapsed: true, rule: "seal-line-only", toward: "records", text: records };
    readings.push("seal-line-only: more than the seal line moved");
  }
  if (rules.has("whitespace-only")) {
    if (foldWhitespace(bareSeal(disk)) === foldWhitespace(bareSeal(records))) return { collapsed: true, rule: "whitespace-only", toward: "disk", text: disk };
    readings.push("whitespace-only: more than whitespace moved");
  }
  const merge = (rule: "slot-disjoint" | "line-three-way", lineMerge: LineMerge): CollapseVerdict | null => {
    if (input.base === null) { readings.push(`${rule}: no history holds the base's words`); return null; }
    if (rule === "slot-disjoint" && ext !== ".mem") { readings.push(`${rule}: the carrier holds no slots`); return null; }
    const merged = mergeCarrier({ base: input.base, ours: records, theirs: disk, path, lineMerge, seal: ext === ".mem" ? memeSealer : null });
    if (!merged.resolved) { readings.push(`${rule}: ${merged.why}`); return null; }
    return { collapsed: true, rule, toward: towardOf(merged.text, records, disk, canon), text: merged.text };
  };
  if (rules.has("slot-disjoint")) {
    const v = merge("slot-disjoint", noLineMerge);
    if (v) return v;
  }
  if (rules.has("line-three-way")) {
    const v = merge("line-three-way", input.lineMerge ?? mergeTexts);
    if (v) return v;
  }
  return { collapsed: false, why: readings.join("; ") };
}

/** The side a merged text already says: the records' (nothing left to land), the file's, or neither. */
function towardOf(merged: string, records: string, disk: string, canon: (t: string) => string | null): CollapseToward {
  if (merged === records || bareSeal(merged) === bareSeal(records)) return "records";
  const m = canon(merged);
  if (m !== null && m === canon(records)) return "records";
  if (merged === disk || bareSeal(merged) === bareSeal(disk)) return "disk";
  return "merged";
}
