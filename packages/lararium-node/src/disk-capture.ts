/**
 * disk-capture — the island's door for a file a hand moved: its words enter the causal island before any render writes
 * over them, and the CRDT merges from there.
 *
 * THE OPERATOR'S RULINGS (2026-11-27, 2026-11-28): FIELDS MERGE, DRAFTS STAND APART. No wave waits for a hand; every field
 * syncs through the CRDT; a true conflict stands as a parallel "Draft of 'X'" tiddler beside its target. The projector
 * renders and never ingests, so where it finds a file moved since it last wrote it or last saw it captured
 * (`LarDiskProjectorOptions.capture`), it hands the file here and writes nothing. This door:
 *
 *   1. READS THE FILE as the projector's judge read it (the body, base64 where its bytes fail the utf8 round trip, and the
 *      sidecar beside it) and proves it still holds the bytes the projector hashed. The bag's grant must reach its path,
 *      and a DROPped bag takes nothing (INGEST's `bag-retired`).
 *   2. PARSES IT THROUGH THE INGEST GRADE: a memetic carrier through the one congruence (`carrierLanding`: the frame, the
 *      parse, the render, every declared slot), a native carrier through TW5's own deserializer with its sidecar merged
 *      over (`nativeCarrierLanding`). Words the grade refuses land nothing, and the file stays as the hand left it. A
 *      pointer body lands through `lares ingest` alone (the blob law).
 *   3. LANDS THE WORDS where the records stand as the base left them (only the disk moved), or where the records lost the
 *      history the base read (the file holds the newer words): ONE wiki act writes each record the file moved and deletes
 *      each family record the file no longer says, the shape the wiki shore reads as a SAVE, so each record merges at
 *      field grain through the CRDT with any hand that moved since. Each target must save into the moved file's own bag.
 *   4. STANDS THE WORDS AS PARALLEL DRAFTS everywhere else (both moved, no base, a dropped carrier, or a save that would land
 *      in another bag): each record the file says differently from the records takes `Draft of '<title>' by disk/<hash>`
 *      in TW5's draft shape, carrying `draft.of`, `draft.title` and the parallel-draft fields (`@lararium/mesh`
 *      parallel-drafts), so a hand reads it as it reads any parallel draft. The wiki shore routes a `draft.of` tiddler to
 *      the face's draft layer, which projects to disk as a layer of its own. A draft that already stands is never written
 *      again, so a hand's edit of it stays.
 *
 * Either way the house now holds the file's words, so the projector moves its base to the file's bytes and its next
 * reading renders whatever the records say: the merged record, or the records beside their drafts.
 *
 * Meme: lar:///ha.ka.ba/lararium/api/disk-projection#/write-ward
 */

import { existsSync, readFileSync } from "node:fs";
import { extname } from "node:path";
import { digestsEqual } from "@lararium/mesh/agile-digest";
import { carrierHash } from "@lararium/mesh/crypto";
import { mediaTypeFromExt, ridesAsPointer } from "@lararium/mesh/content-handle";
import { parallelDraftTitle } from "@lararium/mesh/parallel-drafts";
import { carrierCasFlagged, declaredType } from "./ingest-scan.js";
import type { MovedFile, CaptureOutcome } from "./disk-projector/entries.js";

type Fields = Readonly<Record<string, unknown>>;

/** The island's wiki, as the capture writes it: TW5's own reads and writes, and its `change` dispatch. */
export interface CaptureWiki {
  get(title: string): Fields | undefined;
  titles(): string[];
  /** Run `write` (the adds and deletes) and settle once the wiki dispatched the change it caused, so the wiki shore reads the writes as one act. */
  act(write: (put: (fields: Fields) => void, del: (title: string) => void) => number): Promise<void>;
}

export interface DiskCaptureDeps {
  readonly wiki: CaptureWiki;
  /** The tiddlers a memetic carrier's words say, through the ingest gate's own grade, or why the gate refuses them (`carrierLanding`). */
  readonly land: (uri: string, text: string) => { readonly records: readonly Fields[] } | { readonly why: string };
  /** The one record a native carrier's bytes say (TW5's deserializer, the sidecar merged over), or why it lands nothing. */
  readonly landNative: (uri: string, ext: string, body: string, meta: string | undefined) => { readonly records: readonly Fields[] } | { readonly why: string };
  /** Where a save of `title` would land (the cascade's save bag, asked as a probe), or null where no layer takes it. */
  readonly saveBag: (title: string) => string | null;
  /** Whether the vessel's grant lets `bagId`'s mirror carry the file at `path`. */
  readonly grants: (bagId: string, path: string) => boolean;
  /** Whether `bagId` was DROPped and takes no writes. */
  readonly retired?: (bagId: string) => boolean | Promise<boolean>;
  /** One line per capture: no silent act. */
  readonly notice?: (line: string) => void;
}

/** The field a capture draft names its file by. */
export const CAPTURE_PATH_FIELD = "lar-capture-path";

/** The writer a capture draft names: the disk, and the first digits of the bytes it read, so two edits of one file never share a draft. */
export const captureDraftTitle = (title: string, diskHash: string): string => parallelDraftTitle(title, `disk/${diskHash.replace(/^[a-z0-9-]+:/, "").slice(0, 12)}`);

/** A carrier read off the disk. */
export interface DiskCarrier { readonly body: string; readonly meta?: string; readonly binary: boolean }

/** Read the carrier at `path` as the projector's judge reads it: the body, base64 where its bytes fail the utf8 round trip, and the sidecar beside it. */
export function readCarrierAt(path: string): DiskCarrier | null {
  try {
    const bytes = readFileSync(path);
    const text = bytes.toString("utf8");
    const binary = !Buffer.from(text, "utf8").equals(bytes);
    const meta = existsSync(`${path}.meta`) ? readFileSync(`${path}.meta`, "utf8") : undefined;
    return { body: binary ? bytes.toString("base64") : text, ...(meta !== undefined ? { meta } : {}), binary };
  } catch { return null; }
}

/** THE BLOB LAW at the capture: a body that rides a pointer to its bytes lands through `lares ingest` alone. */
export function pointerBodyAt(path: string, carrier: DiskCarrier): boolean {
  return ridesAsPointer(declaredType(carrier.meta) ?? mediaTypeFromExt(extname(path), carrier.binary)) || carrierCasFlagged(carrier.body, carrier.meta);
}

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

/** The capture door over an island's wiki (`LarDiskProjectorOptions.capture`). */
export function diskCapture(deps: DiskCaptureDeps): (moved: MovedFile) => Promise<CaptureOutcome> {
  let chain: Promise<unknown> = Promise.resolve();
  // One capture at a time: each reads the wiki its predecessor left.
  return (moved) => {
    const next = chain.then(() => captureNow(deps, moved), () => captureNow(deps, moved));
    chain = next.catch(() => undefined);
    return next;
  };
}

async function captureNow(deps: DiskCaptureDeps, moved: MovedFile): Promise<CaptureOutcome> {
  const { bagId, uri, path } = moved;
  const refused = (why: string): CaptureOutcome => ({ kind: "refused", why });
  if (!deps.grants(bagId, path)) return refused(`${bagId}'s grant does not reach ${path}`);
  if (await deps.retired?.(bagId)) return refused(`bag-retired: ${bagId} was DROPped and takes no writes`);
  const carrier = readCarrierAt(path);
  if (carrier === null) return refused(`no file stands at ${path} any more`);
  if (!digestsEqual(carrierHash(carrier.body, carrier.meta), moved.disk)) return refused(`the file at ${path} moved again since the projector read it; its next reading reads it afresh`);
  if (pointerBodyAt(path, carrier)) return refused(`${uri} rides a pointer to its bytes; \`lares ingest ${path}\` lands them`);
  const ext = extname(path);
  const landed = ext === ".mem" ? deps.land(uri, carrier.body) : deps.landNative(uri, ext, carrier.body, carrier.meta);
  if ("why" in landed) return refused(`the file's words fail the ingest grade: ${landed.why}`);
  const records = landed.records.filter((r): r is Fields & { title: string } => typeof r["title"] === "string");

  // ONLY THE DISK MOVED (or the records lost the history the base read): the words land in the bag, merged at field grain.
  const recordsUnmoved = moved.records !== null && moved.base !== null && digestsEqual(moved.records, moved.base.records);
  if (recordsUnmoved || moved.behind === true) {
    const said = new Set(records.map((r) => r.title));
    const writes: Array<{ readonly title: string; readonly fields: Fields | null }> = [];
    for (const r of records) if (movedFields(r, deps.wiki.get(r.title)).length > 0) writes.push({ title: r.title, fields: r });
    for (const title of deps.wiki.titles()) if ((title === uri || title.startsWith(`${uri}#`)) && !said.has(title)) writes.push({ title, fields: null });
    if (writes.every((w) => deps.saveBag(w.title) === bagId)) {
      if (writes.length > 0) {
        await deps.wiki.act((put, del) => {
          for (const w of writes) {
            if (w.fields === null) { del(w.title); continue; }
            const now = deps.wiki.get(w.title) ?? {};
            const next: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(now)) if (BOOKKEEPING.has(k) || k in w.fields) next[k] = v;
            Object.assign(next, w.fields);
            put(next);
          }
          return writes.length;
        });
      }
      deps.notice?.(`[capture] ${uri} (${path}) in ${bagId}: ${writes.length} record(s) took the file's words${moved.behind === true ? " (the records had lost the history their base read)" : ""}`);
      return { kind: "landed" };
    }
  }

  // EVERYWHERE ELSE THE FILE'S WORDS STAND AS PARALLEL DRAFTS beside the records, and the records stay as the CRDT holds them.
  const drafts: string[] = [];
  const fresh: Array<Record<string, unknown>> = [];
  for (const r of records) {
    const moves = movedFields(r, deps.wiki.get(r.title));
    if (moves.length === 0) continue;
    const draftTitle = captureDraftTitle(r.title, moved.disk);
    drafts.push(draftTitle);
    if (deps.wiki.get(draftTitle) !== undefined) continue;
    const draft: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) if (!BOOKKEEPING.has(k)) draft[k] = v;
    Object.assign(draft, {
      title: draftTitle, "draft.of": r.title, "draft.title": r.title,
      "lar-conflict-actor": "disk", "lar-conflict-fields": moves.join(" "), "lar-conflict-live": "", [CAPTURE_PATH_FIELD]: path,
    });
    fresh.push(draft);
  }
  if (fresh.length > 0) await deps.wiki.act((put) => { for (const d of fresh) put(d); return fresh.length; });
  if (drafts.length === 0) return { kind: "landed" };
  deps.notice?.(`[capture] ${uri} (${path}) in ${bagId}: the file and the records both moved, so the file's words stand as ${drafts.length} parallel draft(s): ${drafts.join(", ")}`);
  return { kind: "drafted", drafts };
}

/** The TW5 wiki surface the capture reads and writes. */
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
 * THE CAPTURE'S WIKI OVER A BOOTED TW5: each act's writes land in one turn, and the act settles on the wiki's own `change`
 * dispatch (armed before the writes), so the wiki shore reads them as one act and no span of time stands in for it.
 */
export function captureWikiOf($tw: Tw5WikiLike): CaptureWiki {
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
