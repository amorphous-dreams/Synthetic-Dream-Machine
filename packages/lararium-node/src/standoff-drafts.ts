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
 *   3. A COLLAPSE LANDS THROUGH THE ORDINARY SAVE PATH, AND ONLY WHERE THE INGEST GATE WOULD LAND IT. Toward the disk or a
 *      merge, the landing words pass the ingest grade first (`carrierLanding`: the frame, the parse, the render, every
 *      declared slot), the file's path stands inside the bag's own grant, the stand-off's key still stands, and a save of
 *      each target lands in the stand-off's OWN bag (the cascade's save bag, read as a probe); any of these failing, the
 *      drafts stay and the alert rises. Then ONE wiki dispatch writes each target the landing moves and deletes the drafts,
 *      the shape the wiki shore reads as a SAVE, so each target builds on the base its draft opened on and merges at field
 *      grain with any hand that moved since. The projector's next weighing finds the records saying the merge and the file
 *      the hand's words, and the same rules settle it toward the records, which writes the merge over the file. Toward the
 *      records: the records' render writes over the file under the stand-off's own key, and only once it landed do the
 *      drafts leave. A native carrier (no slots, no memetic congruence) collapses toward the records alone: its raw bytes
 *      never land in a record. Each collapse files one audit row naming the rule.
 *   4. WHAT NO RULE COLLAPSES STAYS DRAFTS PLUS ONE AWAITING ALERT, raised on the ward rail where the daemon face reads its
 *      alerts. It names the carrier, the path, the bag and the drafts by title, and the actions as runnable commands
 *      (`keep-both` only where drafts stand); it never carries a draft's words. Approving an action stays a HAND act
 *      (`lares shore keep-disk|keep-records|keep-both`, read off the hand behind the command and at the verb); a seat reads
 *      the alert and the drafts, and may write its own proposed-resolution draft, never approve.
 *
 * A draft's title carries its stand-off's key (`Draft of '<title>' by disk/<key>`), so a later stand-off, or the same
 * title in another bag, never writes over a draft a person kept; a draft that already stands is never written again, so a
 * hand's edit of it stays. At mount the keeper sweeps every unkept draft whose stand-off the projector's standing set holds not.
 *
 * A stand-off that resolves takes its drafts with it (a cancel), save those a person kept (`keep-both`: the records take
 * the file and the disk's words stay as parallel drafts beside them).
 *
 * Meme: lar:///ha.ka.ba/lararium/api/disk-projection#/write-ward
 */

import { extname } from "node:path";
import { contentHash } from "./synced-tree.js";
import { digestsEqual } from "@lararium/mesh/agile-digest";
import { decideCollapse, type CollapseRule, type CollapseToward } from "./standoff-collapse.js";

/**
 * The draft title the disk side of a stand-off takes for one target: TW5's own draft shape, its writer named `disk` and
 * the stand-off's key (its first twelve digits), so two stand-offs of one title never share a draft.
 */
export const standoffDraftTitle = (title: string, key: string): string => `Draft of '${title}' by disk/${key.slice(0, 12)}`;

/** The fields a draft carries to name its stand-off. */
export const STANDOFF_FIELD = "lar-standoff";
export const STANDOFF_PATH_FIELD = "lar-standoff-path";
export const STANDOFF_BAG_FIELD = "lar-standoff-bag";
/** A person kept this draft past its stand-off's end (`keep-both`). */
export const STANDOFF_KEPT_FIELD = "lar-standoff-kept";
/** The digest of the words the keeper loaded into a draft: a draft whose words read otherwise holds a hand's edit. */
export const STANDOFF_LOADED_FIELD = "lar-standoff-loaded";

/** The actions an awaiting stand-off offers a person, each a runnable command: `keep-both` and the drafts only where drafts stand. */
export function standoffActions(uri: string, key: string, withDrafts: boolean): Array<{ readonly action: string; readonly command: string }> {
  return [
    { action: "keep-disk", command: `lares shore keep-disk ${uri} --key ${key}` },
    { action: "keep-records", command: `lares shore keep-records ${uri} --key ${key}` },
    ...(withDrafts ? [
      { action: "keep-both", command: `lares shore keep-both ${uri} --key ${key}` },
      { action: "open-drafts", command: `lares shore drafts ${uri}` },
    ] : []),
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
  /** The records fell behind the base: the document, the heads it lacks, and whether it stood quiet since it mounted. */
  readonly behind?: { readonly doc?: string; readonly heads: readonly string[]; readonly quiet: boolean };
}

/** The law that keeps the disk where the records fell behind their base: the house's own, never a person's rule. */
export const BEHIND_RULE = "records-behind-base";

export interface StandoffKeeperDeps {
  readonly wiki: KeeperWiki;
  readonly standing: () => readonly KeeperStandoff[];
  readonly render: (bagId: string, uri: string, standoff: string) => { readonly text: string } | null;
  readonly takeRecords: (bagId: string, uri: string, standoff: string) => Promise<{ readonly took: boolean; readonly why?: string }>;
  /** The person's rules for a bag, read from their daemon face at each weighing. */
  readonly rules: (bagId: string) => ReadonlySet<CollapseRule> | Promise<ReadonlySet<CollapseRule>>;
  /** The base's words for the file at `path` whose bytes hash to `baseDisk`, or null where no history holds them. */
  readonly baseText: (path: string, baseDisk: string) => string | null;
  readonly readDisk: (path: string) => string | null;
  /** The tiddlers a memetic carrier's words say (root and slots), or null where they parse to none. */
  readonly deserialize: (uri: string, text: string) => readonly Fields[] | null;
  readonly canonical: (uri: string, text: string) => string | null;
  /** The tiddlers a collapse's landing words say, through the ingest gate's own grade, or why the gate refuses them (`carrierLanding`). */
  readonly land: (uri: string, text: string) => { readonly records: readonly Fields[] } | { readonly why: string };
  /** Where a save of `title` would land (the cascade's save bag, asked as a probe), or null where no layer takes it. */
  readonly saveBag: (title: string) => string | null;
  /** Whether the vessel's grant lets `bagId`'s mirror carry the file at `path` (the source root INGEST reads). */
  readonly grants: (bagId: string, path: string) => boolean;
  /** One audit row per collapse. */
  readonly audit: (row: CollapseAudit) => void;
  /** One line per keep of the disk the keeper landed with no hand: no silent act. */
  readonly notice?: (line: string, kept: { readonly bagId: string; readonly uri: string }) => void;
  /** Why a write to `bagId`'s document could not rest right now (its saves wait unsealed), or null where it can. */
  readonly unrested?: (bagId: string) => string | null;
  /** Raise, or clear, the awaiting alert of one stand-off. */
  readonly alert: (a: StandoffAlert) => void | Promise<void>;
}

export interface CollapseAudit {
  readonly rule: CollapseRule | typeof BEHIND_RULE;
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
  | { readonly kind: "collapsed"; readonly rule: CollapseRule | typeof BEHIND_RULE; readonly toward: CollapseToward; readonly drafts: readonly string[] }
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

/** The digest of a draft's words: every field but the bookkeeping, the draft book's own stamps and the loaded mark itself. */
export function standoffLoadedDigest(fields: Fields): string {
  const words = Object.keys(fields).filter((k) => !BOOKKEEPING.has(k) && k !== STANDOFF_LOADED_FIELD && k !== STANDOFF_KEPT_FIELD && !k.startsWith("lar-draft-")).sort();
  return contentHash(JSON.stringify(words.map((k) => [k, fieldValue(fields[k])])));
}

/** A draft the keeper may take away: nobody kept it, and its words still read as the keeper loaded them. */
function untouched(fields: Fields | undefined): boolean {
  return fields !== undefined && fields[STANDOFF_KEPT_FIELD] !== "yes" && fields[STANDOFF_LOADED_FIELD] === standoffLoadedDigest(fields);
}

const byTitle = (records: readonly Fields[] | null): Map<string, Fields> =>
  new Map((records ?? []).filter((r) => typeof r["title"] === "string").map((r) => [r["title"] as string, r]));

/** How many collapses one carrier may land in a row before the keeper stops and asks a person. */
const COLLAPSE_ROUNDS = 3;

/** The rules that settle toward the records byte for byte, and so the only ones a native carrier (no congruence, no slots) reads. */
const RECORDS_ONLY_RULES: ReadonlySet<CollapseRule> = new Set(["canonical-equivalent", "seal-line-only"]);

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
        return f?.[STANDOFF_FIELD] === info.standoff && typeof f?.["draft.of"] === "string" && untouched(f);
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

  /**
   * THE MOUNT'S SWEEP: each draft whose stand-off the projector's standing set does not hold leaves, save those a person
   * kept. A stand-off that ended while the island rested raised no resolution here, so its drafts would stand forever.
   */
  sweep(): Promise<readonly string[]> {
    return this.queue(async () => {
      const standing = new Set(this.deps.standing().map((s) => s.standoff));
      const leave = this.deps.wiki.titles().filter((t) => {
        const f = this.deps.wiki.get(t);
        const key = f?.[STANDOFF_FIELD];
        return typeof key === "string" && typeof f?.["draft.of"] === "string" && untouched(f) && !standing.has(key);
      });
      if (leave.length > 0) await this.deps.wiki.act((_put, del) => { for (const t of leave) del(t); return leave.length; });
      return leave;
    });
  }

  private async weighNow(info: { readonly bagId: string; readonly uri: string; readonly standoff: string }): Promise<KeeperOutcome> {
    const { bagId, uri, standoff } = info;
    const stands = (): KeeperStandoff | undefined => this.deps.standing().find((s) => s.bagId === bagId && s.uri === uri && s.standoff === standoff);
    const entry = stands();
    if (entry === undefined) return { kind: "passed", why: "the stand-off left before the keeper weighed it" };
    if (entry.kind !== "sides" || !entry.path || !entry.disk) return { kind: "passed", why: "the stand-off names no one file whose words could load as drafts" };
    const path = entry.path;
    const render = this.deps.render(bagId, uri, standoff);
    const diskText = this.deps.readDisk(path);
    if (render === null || diskText === null || !digestsEqual(contentHash(diskText), entry.disk)) {
      return this.awaiting(entry, path, [], render === null ? "the records' side holds no text render (a sidecar, a pointer or a binary body)" : "the file moved since the stand-off was weighed");
    }
    const ext = extname(path);
    const memetic = ext === ".mem";
    // A MEMETIC CARRIER READS THROUGH THE ONE CONGRUENCE, ON BOTH SIDES: words the ingest grade refuses load no draft and
    // collapse nothing, since no record could be said from them.
    const diskSaid = memetic ? this.deps.deserialize(uri, diskText) : [];
    const recordsSaid = memetic ? this.deps.deserialize(uri, render.text) : [];
    if (diskSaid === null) return this.awaiting(entry, path, [], "the file's words fail the ingest grade (a torn frame, an unterminated fence or another fault of error grade), so no draft loads and nothing collapses");
    if (recordsSaid === null) return this.awaiting(entry, path, [], "the records' render fails the ingest grade, so nothing collapses");
    const diskRecs = byTitle(diskSaid);
    const recordRecs = byTitle(recordsSaid);
    // THE RECORDS FELL BEHIND THEIR BASE: no draft loads and no person's rule runs. The file holds the newest words.
    if (entry.behind !== undefined) return this.keepDisk(entry, path, diskText, memetic, recordRecs, stands);
    const baseText = entry.base ? this.deps.baseText(path, entry.base.disk) : null;
    const baseSaid = baseText !== null && memetic ? this.deps.deserialize(uri, baseText) : null;
    const baseRecs = baseSaid ? byTitle(baseSaid) : null;

    // 1 — THE DISK SIDE LOADS AS DRAFTS: each tiddler the file moved past the base that says something the records do not.
    // A draft that stands already (this stand-off weighed before, or a hand edited it) is never written again.
    const drafts: string[] = [];
    const fresh: Array<Record<string, unknown>> = [];
    for (const [title, fields] of diskRecs) {
      const moved = movedFields(fields, recordRecs.get(title));
      if (moved.length === 0) continue;
      if (baseRecs !== null && movedFields(fields, baseRecs.get(title)).length === 0) continue;
      const draftTitle = standoffDraftTitle(title, standoff);
      drafts.push(draftTitle);
      if (this.deps.wiki.get(draftTitle) !== undefined) continue;
      const draft: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(fields)) if (!BOOKKEEPING.has(k)) draft[k] = v;
      Object.assign(draft, {
        title: draftTitle, "draft.of": title, "draft.title": title,
        [STANDOFF_FIELD]: standoff, [STANDOFF_PATH_FIELD]: path, [STANDOFF_BAG_FIELD]: bagId,
        "lar-conflict-fields": moved.join(" "), "lar-conflict-live": "",
      });
      draft[STANDOFF_LOADED_FIELD] = standoffLoadedDigest(draft);
      fresh.push(draft);
    }
    if (fresh.length > 0) await this.deps.wiki.act((put) => { for (const d of fresh) put(d); return fresh.length; });

    // 2 — THE PERSON'S RULES. A native carrier reads only the rules that settle toward the records byte for byte.
    const enabled = await this.deps.rules(bagId);
    const rules = memetic ? enabled : new Set([...enabled].filter((r) => RECORDS_ONLY_RULES.has(r)));
    const verdict = decideCollapse({ base: baseText, records: render.text, disk: diskText, ext, path, rules, canonical: (t) => this.deps.canonical(uri, t) });
    if (!verdict.collapsed) return this.awaiting(entry, path, drafts, verdict.why);
    if (verdict.toward !== "records" && !memetic) return this.awaiting(entry, path, drafts, `${verdict.rule} would land a native carrier's raw bytes in the records`);
    const round = (this.rounds.get(uri) ?? 0) + 1;
    if (verdict.toward !== "records" && round > COLLAPSE_ROUNDS) {
      this.rounds.delete(uri);
      return this.awaiting(entry, path, drafts, `${verdict.rule} collapsed this carrier ${COLLAPSE_ROUNDS} times and the stand-off still stands`);
    }

    // 3 — TOWARD THE RECORDS: the records' render lands over the file first; the drafts leave once it landed.
    if (verdict.toward === "records") return this.settleTowardRecords(entry, path, drafts, verdict.rule);

    // 3 — TOWARD THE DISK OR A MERGE: the landing passes the ingest grade, the grant, the key and the save bag, or waits.
    const plan = this.planLanding(entry, path, verdict.rule, verdict.text, recordRecs);
    if ("why" in plan) return this.awaiting(entry, path, drafts, plan.why);
    const { writes } = plan;
    // The landing says what the records say already: nothing lands in the records, and the file takes their render.
    if (writes.length === 0) return this.settleTowardRecords(entry, path, drafts, verdict.rule);
    if (stands() === undefined) return { kind: "passed", why: "the stand-off moved while the keeper weighed it" };
    await this.writeLanding(writes, recordRecs, drafts);
    this.deps.audit({ rule: verdict.rule, toward: verdict.toward, bagId, uri, path, standoff, drafts });
    this.rounds.set(uri, round);
    return { kind: "collapsed", rule: verdict.rule, toward: verdict.toward, drafts };
  }

  /**
   * THE WRITES A LANDING WOULD MAKE, or why it may not land: the words pass the ingest grade, the file's path stands
   * inside the bag's grant, and a save of each target lands in the stand-off's own bag.
   */
  private planLanding(entry: KeeperStandoff, path: string, rule: string, text: string, recordRecs: Map<string, Fields>):
    { readonly writes: Array<{ readonly title: string; readonly fields: Fields | null }> } | { readonly why: string } {
    const landed = this.deps.land(entry.uri, text);
    if ("why" in landed) return { why: `${rule} would land words the ingest gate refuses: ${landed.why}` };
    if (!this.deps.grants(entry.bagId, path)) return { why: `${rule} would land words from ${path}, which ${entry.bagId}'s grant does not reach` };
    const landing = byTitle(landed.records);
    const writes: Array<{ readonly title: string; readonly fields: Fields | null }> = [];
    for (const [title, fields] of landing) if (movedFields(fields, recordRecs.get(title)).length > 0) writes.push({ title, fields });
    for (const title of recordRecs.keys()) if (!landing.has(title) && this.deps.wiki.get(title) !== undefined) writes.push({ title, fields: null });
    for (const w of writes) {
      const lands = this.deps.saveBag(w.title);
      if (lands !== entry.bagId) return { why: `${rule} would land ${w.title} in ${lands ?? "no layer this face mounts"}, not in ${entry.bagId} where the stand-off stands` };
    }
    return { writes };
  }

  /** One wiki act lands the writes and takes the untouched drafts away: the shape the wiki shore reads as a SAVE. */
  private async writeLanding(writes: ReadonlyArray<{ readonly title: string; readonly fields: Fields | null }>, recordRecs: Map<string, Fields>, drafts: readonly string[]): Promise<void> {
    await this.deps.wiki.act((put, del) => {
      for (const w of writes) {
        if (w.fields === null) { del(w.title); continue; }
        const next: Record<string, unknown> = { ...(this.deps.wiki.get(w.title) ?? {}) };
        for (const k of Object.keys(recordRecs.get(w.title) ?? {})) if (!BOOKKEEPING.has(k) && !(k in w.fields)) delete next[k];
        Object.assign(next, w.fields);
        put(next);
      }
      for (const d of drafts) if (untouched(this.deps.wiki.get(d))) del(d);
      return writes.length + drafts.length;
    });
  }

  /**
   * KEEP THE DISK, WITH NO HAND (operator's talk-out, 2026-11-25). A document that lacks the heads its base names went
   * backwards: an older document loaded, or a save never rested. Where it also stood quiet since it mounted, it holds
   * nothing newer than that base, so the file carries the newest words the house holds and the answer needs no person:
   * the file's words land whole in the records (the road `lares shore keep-disk` takes), the projector's next weighing
   * finds both sides agreed and moves the base, and ONE notice line names the document, the heads and the act.
   *
   * A PERSON STILL HEARS where the answer cannot be read: a write landed in that document since it mounted (it may hold
   * words newer than the file), or the landing cannot stand. A landing that cannot stand answers `owed:` with its
   * reason and claims nothing: a native carrier, words the ingest grade refuses, a save no layer takes, or a document
   * whose saves cannot rest (`unrested`). The older render never writes over the file on any of these roads.
   */
  private async keepDisk(entry: KeeperStandoff, path: string, diskText: string, memetic: boolean, recordRecs: Map<string, Fields>, stands: () => KeeperStandoff | undefined): Promise<KeeperOutcome> {
    const behind = entry.behind!;
    const named = `${behind.doc ?? "its document"} lacks the heads its base names (${behind.heads.join(", ")})`;
    if (!behind.quiet) {
      return this.awaiting(entry, path, [], `the records fell behind their last agreement with the file (${named}), and a write landed in that document since it mounted, so it may hold words newer than the file; a person picks`);
    }
    const owed = (why: string): Promise<KeeperOutcome> =>
      this.awaiting(entry, path, [], `owed: the records fell behind their last agreement with the file (${named}) and the file's words did not land back: ${why}. The file stays whole; \`lares shore keep-disk ${entry.uri} --key ${entry.standoff}\` lands them by hand`);
    if (!memetic) return owed("a native carrier's raw bytes land through the ingest gesture alone");
    const unrested = this.deps.unrested?.(entry.bagId) ?? null;
    if (unrested !== null) return owed(`a write to ${entry.bagId} cannot rest (${unrested})`);
    const plan = this.planLanding(entry, path, BEHIND_RULE, diskText, recordRecs);
    if ("why" in plan) return owed(plan.why);
    if (stands() === undefined) return { kind: "passed", why: "the stand-off moved while the keeper weighed it" };
    if (plan.writes.length > 0) await this.writeLanding(plan.writes, recordRecs, []);
    this.rounds.delete(entry.uri);
    this.deps.audit({ rule: BEHIND_RULE, toward: "disk", bagId: entry.bagId, uri: entry.uri, path, standoff: entry.standoff, drafts: [] });
    this.deps.notice?.(`[shore] kept the disk: ${entry.uri} (${path}) in ${entry.bagId} — ${named}, so the records went backwards and the file holds the newest words; ${plan.writes.length} record(s) took the file's words and the older render wrote nothing`, { bagId: entry.bagId, uri: entry.uri });
    return { kind: "collapsed", rule: BEHIND_RULE, toward: "disk", drafts: [] };
  }

  /** The records' render writes over the file under the stand-off's key; the drafts leave only once it landed. */
  private async settleTowardRecords(entry: KeeperStandoff, path: string, drafts: readonly string[], rule: CollapseRule): Promise<KeeperOutcome> {
    this.rounds.delete(entry.uri);
    const took = await this.deps.takeRecords(entry.bagId, entry.uri, entry.standoff);
    if (!took.took) return this.awaiting(entry, path, drafts.filter((d) => this.deps.wiki.get(d) !== undefined), `${rule} settled toward the records, and the records' side could not land: ${took.why ?? "the states moved"}`);
    const leave = drafts.filter((d) => { const f = this.deps.wiki.get(d); return untouched(f); });
    if (leave.length > 0) await this.deps.wiki.act((_put, del) => { for (const d of leave) del(d); return leave.length; });
    this.deps.audit({ rule, toward: "records", bagId: entry.bagId, uri: entry.uri, path, standoff: entry.standoff, drafts });
    return { kind: "collapsed", rule, toward: "records", drafts };
  }

  private async awaiting(entry: KeeperStandoff, path: string, drafts: readonly string[], why: string): Promise<KeeperOutcome> {
    this.rounds.delete(entry.uri);
    // ONE ALERT PER STAND-OFF: the keeper's awaiting alert IS the stand-off's alert, on the ward rail.
    await this.deps.alert({ standoff: entry.standoff, bagId: entry.bagId, uri: entry.uri, path, drafts, why });
    return { kind: "awaiting", drafts, why };
  }
}

/**
 * The words of the alert an uncollapsed stand-off raises: it NAMES the carrier, the path, the bag, the drafts and the
 * actions, and never carries a draft's words. Each action reads as the command that runs it.
 */
export function standoffAlertWords(a: Extract<StandoffAlert, { readonly bagId: string }>): { readonly reason: string; readonly drafts: string; readonly actions: string } {
  const list = (xs: readonly string[]): string => xs.map((x) => (/\s|\]\]/.test(x) ? `[[${x}]]` : x)).join(" ");
  const actions = standoffActions(a.uri, a.standoff, a.drafts.length > 0);
  return {
    drafts: list(a.drafts),
    actions: actions.map((x) => x.action).join(" "),
    reason: [
      `a stand-off awaits a person: ${a.uri} (${a.path}) moved on disk and in the records, and no collapse rule settled it (${a.why}).`,
      a.drafts.length > 0 ? `The file's side stands as ${a.drafts.length} draft(s) in this face's draft layer: ${list(a.drafts)}.` : "The file's side loaded no draft.",
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
