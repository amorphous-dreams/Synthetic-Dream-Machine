/**
 * standoff-drafts — a stand-off comes inside the causal island as drafts, and the person's rules collapse what they can.
 *
 * THE OPERATOR'S RULING (2026-11-23): "It all gets loaded as draft tiddlers, automation (configurable from inside a daemon
 * face) then runs against those to see if any collapse, AND then surfaces any uncollapsable uncertainty as awaiting Alert
 * tiddlers and actions for the operator on their UX of choice (pono). Once it's 'all in a wiki' it becomes an actionable
 * tension inside the system, not something pressing from outside the causal island shore."
 *
 * So where the projector stands off (`both-moved` · `no-base`), the keeper:
 *
 *   1. LOADS THE DISK SIDE AS DRAFTS. The file's words parse through the one memetic congruence (`memeticIngestOps`), and
 *      each tiddler (the root and every slot) that says something the records' render does not, and that the file moved
 *      past the base, lands in the island's wiki as `Draft of '<title>' by disk`, carrying `draft.of` and `draft.title`.
 *      The wiki shore routes a `draft.of` tiddler to the worn face's own draft layer (the cascade's `current-wiki-draft`,
 *      a layer no other face reads), and its draft book stamps the target's heads as the draft opens
 *      (`lar-draft-base-bag` / `lar-draft-base-heads`): the records' heads the stand-off's key folded. A draft names its
 *      stand-off (`lar-standoff`, `lar-standoff-path`, `lar-standoff-bag`) and the fields it moved
 *      (`lar-conflict-fields`), in the parallel-draft shape (`@lararium/mesh` parallel-drafts), so the hand that opens it
 *      reads it as it reads any parallel draft.
 *   2. RUNS THE PERSON'S RULES (`standoff-collapse.ts`), read from their daemon face, against the base's words (the file's
 *      own git history, `basePoolText`), the records' render and the file's words.
 *   3. A COLLAPSE LANDS THROUGH THE ORDINARY SAVE PATH. Toward the disk or a merge: ONE wiki dispatch writes each target
 *      the landing words move and deletes the drafts, the shape the wiki shore reads as a SAVE, so each target builds on
 *      the base its draft opened on and merges at field grain with any hand that moved since. The projector's next weighing
 *      then finds the records saying the merge and the file the hand's words, and the same rules settle it toward the
 *      records, which writes the merge over the file (the hand's words stand inside it). Toward the records: the drafts
 *      leave (a cancel) and the records' render writes over the file under the stand-off's own key. Each collapse files one
 *      audit row naming the rule.
 *   4. WHAT NO RULE COLLAPSES STAYS DRAFTS PLUS ONE AWAITING ALERT (`$:/temp/lares/alert/standoff/<key>`). The alert names
 *      the carrier, the path, the bag and the drafts by title, and the actions as runnable commands; it never carries a
 *      draft's words. Approving an action stays a HAND act (`lares shore keep-disk|keep-records|keep-both`); a seat reads
 *      the alert and the drafts, and may write its own proposed-resolution draft, never approve.
 *
 * A stand-off that resolves takes its drafts with it (a cancel), save those a person kept (`keep-both`: the records take
 * the file and the disk's words stay as parallel drafts beside them).
 *
 * Meme: lar:///ha.ka.ba/lararium/api/disk-projection#/write-ward
 */

import { extname } from "node:path";
import { contentHash } from "./synced-tree.js";
import { digestsEqual } from "@lararium/mesh";
import { decideCollapse, type CollapseRule, type CollapseToward } from "./standoff-collapse.js";

/** The draft title the disk side of a stand-off takes for one target: TW5's own draft shape, its writer named `disk`. */
export const standoffDraftTitle = (title: string): string => `Draft of '${title}' by disk`;

/** The alert kind an uncollapsed stand-off raises, keyed by the stand-off's key. */
export const STANDOFF_ALERT_KIND = "standoff";
export const standoffAlertTitle = (key: string): string => `$:/temp/lares/alert/${STANDOFF_ALERT_KIND}/${key}`;

/** The fields a draft carries to name its stand-off. */
export const STANDOFF_FIELD = "lar-standoff";
export const STANDOFF_PATH_FIELD = "lar-standoff-path";
export const STANDOFF_BAG_FIELD = "lar-standoff-bag";
/** A person kept this draft past its stand-off's end (`keep-both`). */
export const STANDOFF_KEPT_FIELD = "lar-standoff-kept";

/** The actions an awaiting stand-off offers a person, each a runnable command. */
export function standoffActions(uri: string, key: string): Array<{ readonly action: string; readonly command: string }> {
  return [
    { action: "keep-disk", command: `lares shore keep-disk ${uri} --key ${key}` },
    { action: "keep-records", command: `lares shore keep-records ${uri} --key ${key}` },
    { action: "keep-both", command: `lares shore keep-both ${uri} --key ${key}` },
    { action: "open-drafts", command: `lares shore drafts ${uri}` },
  ];
}

type Fields = Readonly<Record<string, unknown>>;

/** The island's wiki, as the keeper writes it: TW5's own reads and writes, and its `change` dispatch. */
export interface KeeperWiki {
  get(title: string): Fields | undefined;
  titles(): string[];
  /**
   * Run `write` (the keeper's adds and deletes) and settle once the wiki dispatched the change it caused, so the wiki
   * shore reads the writes as one act. A write that changed nothing settles at once.
   */
  act(write: (put: (fields: Fields) => void, del: (title: string) => void) => number): Promise<void>;
}

/** One stand-off as the projector names it. */
export interface KeeperStandoff {
  readonly bagId: string;
  readonly uri: string;
  readonly standoff: string;
  readonly kind: "sides" | "home";
  readonly path?: string;
  readonly disk?: string | null;
  readonly records?: string;
  readonly base?: { readonly disk: string; readonly records: string };
}

export interface StandoffKeeperDeps {
  readonly wiki: KeeperWiki;
  readonly standing: () => readonly KeeperStandoff[];
  readonly render: (bagId: string, uri: string, standoff: string) => { readonly text: string } | null;
  readonly takeRecords: (bagId: string, uri: string, standoff: string) => Promise<{ readonly took: boolean; readonly why?: string }>;
  /** The person's rules for a bag, read from their daemon face. */
  readonly rules: (bagId: string) => ReadonlySet<CollapseRule>;
  /** The base's words for the file at `path` whose bytes hash to `baseDisk`, or null where no history holds them. */
  readonly baseText: (path: string, baseDisk: string) => string | null;
  readonly readDisk: (path: string) => string | null;
  /** The tiddlers a memetic carrier's words say (root and slots), or null where they parse to none. */
  readonly deserialize: (uri: string, text: string) => readonly Fields[] | null;
  readonly canonical: (uri: string, text: string) => string | null;
  /** One audit row per collapse. */
  readonly audit: (row: CollapseAudit) => void;
  /** Raise, or clear, the awaiting alert of one stand-off. */
  readonly alert: (a: StandoffAlert) => void | Promise<void>;
}

export interface CollapseAudit {
  readonly rule: CollapseRule;
  readonly toward: CollapseToward;
  readonly bagId: string;
  readonly uri: string;
  readonly path: string;
  readonly standoff: string;
  readonly drafts: readonly string[];
}

export type StandoffAlert =
  | { readonly clear: true; readonly standoff: string }
  | { readonly clear?: false; readonly standoff: string; readonly bagId: string; readonly uri: string; readonly path: string; readonly drafts: readonly string[]; readonly why: string };

export type KeeperOutcome =
  | { readonly kind: "collapsed"; readonly rule: CollapseRule; readonly toward: CollapseToward; readonly drafts: readonly string[] }
  | { readonly kind: "awaiting"; readonly drafts: readonly string[]; readonly why: string }
  | { readonly kind: "passed"; readonly why: string };

/** Fields that ride a record's storage or the wiki's own bookkeeping, never the words two sides compare. */
const BOOKKEEPING = new Set(["bag", "$origin-bag", "revision", "created", "modified", "creator", "modifier"]);

function fieldValue(v: unknown): string {
  if (Array.isArray(v)) return v.map((x) => { const s = String(x); return /\s/.test(s) ? `[[${s}]]` : s; }).join(" ");
  return v === undefined || v === null ? "" : String(v);
}

/** The fields two records disagree on, bookkeeping aside. */
export function movedFields(a: Fields | undefined, b: Fields | undefined): string[] {
  const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
  return [...keys].filter((k) => !BOOKKEEPING.has(k) && k !== "title" && fieldValue(a?.[k]) !== fieldValue(b?.[k])).sort();
}

const byTitle = (records: readonly Fields[] | null): Map<string, Fields> =>
  new Map((records ?? []).filter((r) => typeof r["title"] === "string").map((r) => [r["title"] as string, r]));

/** How many collapses one carrier may land in a row before the keeper stops and asks a person. */
const COLLAPSE_ROUNDS = 3;

export class StandoffKeeper {
  /** One weighing at a time: each act reads the wiki its predecessor left. */
  private chain: Promise<unknown> = Promise.resolve();
  /** Consecutive collapses toward the disk or a merge per carrier, until one settles toward the records. */
  private readonly rounds = new Map<string, number>();

  constructor(private readonly deps: StandoffKeeperDeps) {}

  private queue<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.chain.then(fn, fn);
    this.chain = next.catch(() => undefined);
    return next;
  }

  /** The drafts this island's wiki holds for a carrier's stand-offs. */
  draftsOf(uri: string): Array<{ readonly title: string; readonly of: string; readonly standoff: string; readonly kept: boolean }> {
    const family = (t: string): boolean => t === uri || t.startsWith(`${uri}#`);
    const out: Array<{ title: string; of: string; standoff: string; kept: boolean }> = [];
    for (const title of this.deps.wiki.titles()) {
      const f = this.deps.wiki.get(title);
      const of = typeof f?.["draft.of"] === "string" ? f["draft.of"] : null;
      const key = typeof f?.[STANDOFF_FIELD] === "string" ? f[STANDOFF_FIELD] : null;
      if (of !== null && key !== null && family(of)) out.push({ title, of, standoff: key, kept: f?.[STANDOFF_KEPT_FIELD] === "yes" });
    }
    return out.sort((a, b) => (a.title < b.title ? -1 : a.title > b.title ? 1 : 0));
  }

  /** A STAND-OFF ENTERED: load its disk side as drafts, run the person's rules, and collapse or raise its alert. */
  weigh(info: { readonly bagId: string; readonly uri: string; readonly standoff: string }): Promise<KeeperOutcome> {
    return this.queue(() => this.weighNow(info));
  }

  /** A STAND-OFF ENDED: its drafts leave, save those a person kept, and its alert clears. */
  resolved(info: { readonly standoff: string }): Promise<void> {
    return this.queue(async () => {
      const leave = this.deps.wiki.titles().filter((t) => {
        const f = this.deps.wiki.get(t);
        return f?.[STANDOFF_FIELD] === info.standoff && f?.[STANDOFF_KEPT_FIELD] !== "yes" && typeof f?.["draft.of"] === "string";
      });
      if (leave.length > 0) await this.deps.wiki.act((_put, del) => { for (const t of leave) del(t); return leave.length; });
      await this.deps.alert({ clear: true, standoff: info.standoff });
    });
  }

  /** A PERSON KEEPS BOTH: the drafts of the named stand-off stay past its end, as parallel drafts beside the records. */
  keep(uri: string, standoff: string): Promise<readonly string[]> {
    return this.queue(async () => {
      const kept = this.draftsOf(uri).filter((d) => d.standoff === standoff);
      await this.deps.wiki.act((put) => {
        for (const d of kept) put({ ...this.deps.wiki.get(d.title)!, [STANDOFF_KEPT_FIELD]: "yes" });
        return kept.length;
      });
      return kept.map((d) => d.title);
    });
  }

  private async weighNow(info: { readonly bagId: string; readonly uri: string; readonly standoff: string }): Promise<KeeperOutcome> {
    const { bagId, uri, standoff } = info;
    const entry = this.deps.standing().find((s) => s.bagId === bagId && s.uri === uri && s.standoff === standoff);
    if (entry === undefined) return { kind: "passed", why: "the stand-off left before the keeper weighed it" };
    if (entry.kind !== "sides" || !entry.path || !entry.disk) return { kind: "passed", why: "the stand-off names no one file whose words could load as drafts" };
    const path = entry.path;
    const render = this.deps.render(bagId, uri, standoff);
    const diskText = this.deps.readDisk(path);
    if (render === null || diskText === null || !digestsEqual(contentHash(diskText), entry.disk)) {
      return this.awaiting(entry, path, [], render === null ? "the records' side holds no text render (a sidecar, a pointer or a binary body)" : "the file moved since the stand-off was weighed");
    }
    const ext = extname(path);
    const diskRecs = ext === ".mem" ? byTitle(this.deps.deserialize(uri, diskText)) : new Map<string, Fields>();
    const recordRecs = ext === ".mem" ? byTitle(this.deps.deserialize(uri, render.text)) : new Map<string, Fields>();
    const baseText = entry.base ? this.deps.baseText(path, entry.base.disk) : null;
    const baseRecs = baseText !== null && ext === ".mem" ? byTitle(this.deps.deserialize(uri, baseText)) : null;

    // 1 — THE DISK SIDE LOADS AS DRAFTS: each tiddler the file moved past the base that says something the records do not.
    const drafted: Array<{ title: string; fields: Fields }> = [];
    for (const [title, fields] of diskRecs) {
      const moved = movedFields(fields, recordRecs.get(title));
      if (moved.length === 0) continue;
      if (baseRecs !== null && movedFields(fields, baseRecs.get(title)).length === 0) continue;
      const draft: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(fields)) if (!BOOKKEEPING.has(k)) draft[k] = v;
      Object.assign(draft, {
        title: standoffDraftTitle(title), "draft.of": title, "draft.title": title,
        [STANDOFF_FIELD]: standoff, [STANDOFF_PATH_FIELD]: path, [STANDOFF_BAG_FIELD]: bagId,
        "lar-conflict-fields": moved.join(" "), "lar-conflict-live": "",
      });
      drafted.push({ title: draft["title"] as string, fields: draft });
    }
    const drafts = drafted.map((d) => d.title);
    if (drafted.length > 0) await this.deps.wiki.act((put) => { for (const d of drafted) put(d.fields); return drafted.length; });

    // 2 — THE PERSON'S RULES.
    const verdict = decideCollapse({
      base: baseText, records: render.text, disk: diskText, ext, path, rules: this.deps.rules(bagId),
      canonical: (t) => this.deps.canonical(uri, t),
    });
    if (!verdict.collapsed) return this.awaiting(entry, path, drafts, verdict.why);
    const round = (this.rounds.get(uri) ?? 0) + 1;
    if (verdict.toward !== "records" && round > COLLAPSE_ROUNDS) {
      this.rounds.delete(uri);
      return this.awaiting(entry, path, drafts, `${verdict.rule} collapsed this carrier ${COLLAPSE_ROUNDS} times and the stand-off still stands`);
    }

    // 3 — THE COLLAPSE LANDS THROUGH THE ORDINARY SAVE PATH.
    const landing = verdict.toward === "records" ? null : byTitle(this.deps.deserialize(uri, verdict.text));
    let moved = 0;
    await this.deps.wiki.act((put, del) => {
      if (landing !== null) {
        for (const [title, fields] of landing) {
          if (movedFields(fields, recordRecs.get(title)).length === 0) continue;
          const held = this.deps.wiki.get(title) ?? {};
          const next: Record<string, unknown> = { ...held };
          for (const k of Object.keys(recordRecs.get(title) ?? {})) if (!BOOKKEEPING.has(k) && !(k in fields)) delete next[k];
          Object.assign(next, fields);
          put(next);
          moved++;
        }
        for (const title of recordRecs.keys()) if (!landing.has(title) && this.deps.wiki.get(title) !== undefined) { del(title); moved++; }
      }
      for (const d of drafts) del(d);
      return moved + drafts.length;
    });
    const toward: CollapseToward = landing !== null && moved === 0 ? "records" : verdict.toward;
    this.deps.audit({ rule: verdict.rule, toward, bagId, uri, path, standoff, drafts });
    if (toward === "records") {
      this.rounds.delete(uri);
      const took = await this.deps.takeRecords(bagId, uri, standoff);
      if (!took.took) return this.awaiting(entry, path, [], `${verdict.rule} settled toward the records, and the records' side could not land: ${took.why ?? "the states moved"}`);
    } else {
      this.rounds.set(uri, round);
    }
    return { kind: "collapsed", rule: verdict.rule, toward, drafts };
  }

  private async awaiting(entry: KeeperStandoff, path: string, drafts: readonly string[], why: string): Promise<KeeperOutcome> {
    this.rounds.delete(entry.uri);
    // ONE ALERT PER STAND-OFF: a memetic carrier's awaiting alert stands here; a native carrier loads no drafts, and the
    // ward rail's own alert stays its one alert.
    if (extname(path) === ".mem") await this.deps.alert({ standoff: entry.standoff, bagId: entry.bagId, uri: entry.uri, path, drafts, why });
    return { kind: "awaiting", drafts, why };
  }
}

/**
 * The alert an uncollapsed stand-off raises, as fields: it NAMES the carrier, the path, the bag, the drafts and the actions,
 * and never carries a draft's words. Its text names each action as the command that runs it.
 */
export function standoffAlertFields(a: Extract<StandoffAlert, { readonly bagId: string }>): { readonly title: string } & Record<string, string> {
  const list = (xs: readonly string[]): string => xs.map((x) => (/\s|\]\]/.test(x) ? `[[${x}]]` : x)).join(" ");
  const actions = standoffActions(a.uri, a.standoff);
  return {
    title: standoffAlertTitle(a.standoff),
    tags: "$:/tags/Alert",
    "alert-kind": STANDOFF_ALERT_KIND,
    standoff: a.standoff,
    carrier: a.uri,
    path: a.path,
    bag: a.bagId,
    drafts: list(a.drafts),
    actions: actions.map((x) => x.action).join(" "),
    text: [
      `A stand-off awaits a person: ${a.uri} (${a.path}) moved on disk and in the records, and no collapse rule settled it (${a.why}).`,
      a.drafts.length > 0 ? `The file's side stands as ${a.drafts.length} draft(s) in this face's draft layer.` : "The file's side loaded no draft.",
      ...actions.map((x) => `${x.action}: \`${x.command}\``),
    ].join("\n"),
  };
}

/** The TW5 wiki surface the keeper reads and writes. */
export interface Tw5WikiLike {
  readonly Tiddler: new (...fields: Array<Record<string, unknown>>) => unknown;
  readonly wiki: {
    getTiddler(title: string): { readonly fields: Record<string, unknown> } | undefined;
    allTitles(): string[];
    addTiddler(tiddler: unknown): void;
    deleteTiddler(title: string): void;
    addEventListener(type: string, listener: (changes: Record<string, unknown>) => void): void;
    removeEventListener(type: string, listener: (changes: Record<string, unknown>) => void): void;
  };
}

/**
 * THE KEEPER'S WIKI OVER A BOOTED TW5: each act's writes land in one turn, and the act settles on the wiki's own `change`
 * dispatch (armed before the writes), so the wiki shore reads them as one act and no span of time stands in for it.
 */
export function keeperWikiOf($tw: Tw5WikiLike): KeeperWiki {
  return {
    get: (title) => $tw.wiki.getTiddler(title)?.fields,
    titles: () => $tw.wiki.allTitles(),
    act: async (write) => {
      let seen!: () => void;
      const dispatched = new Promise<void>((resolve) => { seen = resolve; });
      const listener = (): void => { seen(); };
      $tw.wiki.addEventListener("change", listener);
      try {
        const n = write((fields) => { $tw.wiki.addTiddler(new $tw.Tiddler(fields as Record<string, unknown>)); }, (title) => { $tw.wiki.deleteTiddler(title); });
        if (n > 0) await dispatched;
      } finally {
        $tw.wiki.removeEventListener("change", listener);
      }
    },
  };
}
