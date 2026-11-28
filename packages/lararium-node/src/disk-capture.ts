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
 *      sidecar beside it) and proves it still holds the bytes the projector hashed: a file that changed between the hash
 *      and the read refuses this once, and its next change reads afresh. The bag's grant must reach its path (the one
 *      containment wall, `confineMirrorWrite`), and a DROPped bag takes nothing (INGEST's `bag-retired`).
 *   2. PARSES IT THROUGH THE INGEST GRADE: a memetic carrier through the one congruence (`carrierLanding`), a native carrier
 *      through TW5's own deserializer with its sidecar merged over (`nativeCarrierLanding`).
 *   3. LANDS THE WORDS only where the records stand exactly as the base left them (only the disk moved): ONE wiki act writes
 *      each record the file moved, the shape the wiki shore reads as a SAVE, so each merges at field grain through the CRDT
 *      with any hand that moved since. Each target must save into the moved file's own bag. A landing never deletes: a
 *      family record the file omits (a truncated save, a rename caught mid-flight) stands as a removal draft
 *      beside its record, and a deletion rides the vanished-file path alone.
 *   4. STANDS THE WORDS AS PARALLEL DRAFTS everywhere else: both moved, no base, a dropped carrier, records that lost the
 *      history their base read, a save that would land in another bag. Each record the file says differently takes
 *      `Draft of '<title>' by disk` in TW5's draft shape (`draft.of`, `draft.title` and the parallel-draft fields of
 *      `@lararium/mesh` parallel-drafts), ONE draft per title, updated in place as the file moves on. Words the grade
 *      cannot parse, and a binary body, come inside the same way: the raw text as one draft of the carrier, no parse.
 *      The wiki shore routes a `draft.of` tiddler to the face's draft layer, which projects to disk as a layer of its own.
 *
 * Either way the house now holds the file's words, so the projector moves its base to the file's bytes and its next
 * reading renders whatever the records say. Only a body too large for a record (the skinny-handle wall) and a file
 * outside the grant refuse; the projector names such a refusal once per state of the file.
 *
 * Meme: lar:///ha.ka.ba/lararium/api/disk-projection#/write-ward
 */

import { existsSync, readFileSync } from "node:fs";
import { extname } from "node:path";
import { digestsEqual } from "@lararium/mesh/agile-digest";
import { carrierHash } from "@lararium/mesh/crypto";
import { isOversizedBody, mediaTypeFromExt, ridesAsPointer } from "@lararium/mesh/content-handle";
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

/** The one draft the disk keeps beside a title: its writer names the disk, and a later edit of the file updates it in place. */
export const captureDraftTitle = (title: string): string => parallelDraftTitle(title, "disk");

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
  if (await deps.retired?.(bagId)) return refused(`bag-retired: a DROP retired ${bagId}, and it takes no writes`);
  const carrier = readCarrierAt(path);
  if (carrier === null) return refused(`no file stands at ${path} any more`);
  if (!digestsEqual(carrierHash(carrier.body, carrier.meta), moved.disk)) return refused(`the file at ${path} changed between the projector's hash and this read; its next change reads afresh`);
  const ext = extname(path);
  // A BODY TOO LARGE FOR A RECORD rests outside the CRDT (the skinny-handle wall): the file stays whole and nothing writes over it.
  if (isOversizedBody(Buffer.byteLength(carrier.body, carrier.binary ? "base64" : "utf8"))) return refused(`${uri} holds a body too large for a record; the file stays as the hand left it`);
  // A BINARY OR POINTER BODY, and words the grade cannot parse, come inside raw: one draft of the carrier holds the text.
  const raw = carrier.binary || pointerBodyAt(path, carrier);
  const landed = raw ? null : ext === ".mem" ? deps.land(uri, carrier.body) : deps.landNative(uri, ext, carrier.body, carrier.meta);
  if (landed === null || "why" in landed) {
    const fields: Record<string, unknown> = { title: uri, text: carrier.body, type: carrier.binary || ext === ".mem" ? mediaTypeFromExt(ext, carrier.binary) : declaredType(carrier.meta) ?? mediaTypeFromExt(ext, false) };
    const drafts = await standDrafts(deps, [fields], [], "*");
    deps.notice?.(`[capture] ${uri} (${path}) in ${bagId}: ${landed === null ? "a binary body" : `words the ingest grade refuses (${landed.why})`} stand raw as ${drafts.join(", ")}`);
    return { kind: "drafted", drafts };
  }
  const records = landed.records.filter((r): r is Fields & { title: string } => typeof r["title"] === "string");
  const said = new Set(records.map((r) => r.title));
  // A FAMILY RECORD THE FILE OMITS never deletes through a capture: it stands as a removal draft beside its record.
  const omitted = deps.wiki.titles().filter((title) => (title === uri || title.startsWith(`${uri}#`)) && !said.has(title) && !title.startsWith("Draft of "));

  // ONLY THE DISK MOVED: the records stand exactly as the base left them, so the words land in the bag, merged at field grain.
  const recordsUnmoved = moved.behind !== true && moved.records !== null && moved.base !== null && digestsEqual(moved.records, moved.base.records);
  if (recordsUnmoved) {
    const writes = records.filter((r) => movedFields(r, deps.wiki.get(r.title)).length > 0);
    if (writes.every((w) => deps.saveBag(w.title) === bagId)) {
      if (writes.length > 0) {
        await deps.wiki.act((put) => {
          for (const w of writes) {
            const now = deps.wiki.get(w.title) ?? {};
            const next: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(now)) if (BOOKKEEPING.has(k) || k in w) next[k] = v;
            Object.assign(next, w);
            put(next);
          }
          return writes.length;
        });
      }
      const drafts = await standDrafts(deps, [], omitted, "");
      deps.notice?.(`[capture] ${uri} (${path}) in ${bagId}: ${writes.length} record(s) took the file's words${drafts.length > 0 ? `; ${drafts.length} record(s) the file omits stand as removal drafts` : ""}`);
      return drafts.length > 0 ? { kind: "drafted", drafts } : { kind: "landed" };
    }
  }

  // EVERYWHERE ELSE THE FILE'S WORDS STAND AS PARALLEL DRAFTS beside the records, and the records stay as the CRDT holds them.
  const drafts = await standDrafts(deps, records, omitted, "");
  if (drafts.length === 0) return { kind: "landed" };
  deps.notice?.(`[capture] ${uri} (${path}) in ${bagId}: the file's words stand as ${drafts.length} parallel draft(s) beside the records: ${drafts.join(", ")}`);
  return { kind: "drafted", drafts };
}

/**
 * Stand the disk's drafts in one wiki act: a draft of each record whose words differ from the record's (`fields: "*"` marks a
 * raw draft whose every field differs by kind), and a removal draft for each record the file omits. ONE draft per title,
 * written where none stands and updated in place where the file moved on. Answers every draft title standing for these.
 */
async function standDrafts(deps: DiskCaptureDeps, records: readonly Fields[], omitted: readonly string[], whole: "" | "*"): Promise<string[]> {
  const drafts: string[] = [];
  const writes: Array<Record<string, unknown>> = [];
  const stand = (title: string, draft: Record<string, unknown>): void => {
    const draftTitle = captureDraftTitle(title);
    drafts.push(draftTitle);
    const next = { ...draft, title: draftTitle, "draft.of": title, "draft.title": title, "lar-conflict-actor": "disk", "lar-conflict-live": "" };
    const standing = deps.wiki.get(draftTitle);
    if (standing === undefined || movedFields(standing, next).length > 0) writes.push(next);
  };
  for (const r of records) {
    const title = String(r["title"]);
    const moves = whole === "*" ? ["*"] : movedFields(r, deps.wiki.get(title));
    if (moves.length === 0) continue;
    const draft: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) if (!BOOKKEEPING.has(k)) draft[k] = v;
    stand(title, { ...draft, "lar-conflict-fields": moves.join(" ") });
  }
  for (const title of omitted) stand(title, { text: "", "lar-conflict-fields": "*", "lar-conflict-removed": "*" });
  if (writes.length > 0) await deps.wiki.act((put) => { for (const d of writes) put(d); return writes.length; });
  return drafts;
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
