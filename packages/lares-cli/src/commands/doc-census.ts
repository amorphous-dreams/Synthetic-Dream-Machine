/**
 * `lares vessel census --docs` — EVERY DOCUMENT THE STORES HOLD, AND WHO NAMES IT, read before any sweep.
 *
 * The vessel reads its own stores (the root and each island store standing beside it) through the custody door's
 * `doc-census` frame, read-only and asking no custody: each document by id, its store, bytes, clear and sealed chunks,
 * and the names that reach it (the catalog pointer and its rows, a slot pointer, a binding mint, a binding, a keyhive
 * bag-doc row, a derived address, the vessel registry and its rows, a cap's mint at compose, a live handle, or another
 * document's content). Each row reads one class: `current`, `duplicate` (an island copy of a root document), `orphan`
 * (no live name reaches it), `last-version` (a shape the current house does not read) or `sealed-unread` (sealed, and the vessel
 * could not open it: never guessed an orphan). The host never reads the hearth itself.
 *
 * Prose by default (`proseFirst`): a summary per class, then the unnamed list. `--json` answers the full rows. It removes
 * nothing; a sweep stays a later door.
 *
 * Exit: 0 the census read · 2 the census could not answer (no vessel, a silent door, a refusal).
 *
 * Meme: lar:///ha.ka.ba/lares/cli/vessel-door
 */
import type { DocCensusReading, DocClass } from "@lararium/mesh/doc-census";
import type { ParsedArgs } from "../parse-args.js";
import { sendCustodyFrame, type CustodyDoorAnswer } from "../custody-door.js";
import { emit, proseFirst } from "../render.js";

/** How long the document census may take: it walks every store and decodes every document it can open. */
export const DOC_CENSUS_MS = 300_000;

/** The one line the census reads, injectable so a test drives it without a vessel. */
export type DocCensusLine = () => Promise<CustodyDoorAnswer | null>;

const LIVE_LINE: DocCensusLine = () => {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), DOC_CENSUS_MS);
  return sendCustodyFrame({ op: "doc-census" }, undefined, abort.signal).finally(() => clearTimeout(timer));
};

const CLASS_ORDER: readonly DocClass[] = ["current", "duplicate", "orphan", "last-version", "sealed-unread"];

/** Bytes as a person reads them. */
export function sizeOf(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
}

/** The census as prose lines: the stores, a summary per class, then each orphan by id, store, bytes and why. */
export function docCensusLines(c: DocCensusReading): string[] {
  const out: string[] = [];
  out.push(`doc census: ${c.rows.length} document(s) in ${c.stores.length} store(s): ${c.stores.map((s) => `${s.name} ${s.documents} (${sizeOf(s.bytes)})`).join(" · ")}`);
  for (const cls of CLASS_ORDER) {
    const rows = c.rows.filter((r) => r.class === cls);
    out.push(`  ${cls.padEnd(13)} ${String(rows.length).padStart(5)}  ${sizeOf(rows.reduce((s, r) => s + r.bytes, 0))}`);
  }
  const unnamed = c.rows.filter((r) => r.class === "orphan");
  if (unnamed.length > 0) {
    out.push(`unnamed (${unnamed.length}): no live name reaches these`);
    for (const r of unnamed) out.push(`  ${r.id}  ${r.store}  ${sizeOf(r.bytes)}  ${r.why ?? "unnamed"}`);
  }
  if (c.unreadSealed > 0) {
    // Documents (one per id) and copies (one per store) apart; the `sealed-unread` share reads the class line's count.
    const byClass = CLASS_ORDER.filter((cls) => (c.unreadSealedCopies[cls] ?? 0) > 0);
    const copies = byClass.reduce((s, cls) => s + c.unreadSealedCopies[cls]!, 0);
    const split = [...byClass].sort((a, b) => (a === "sealed-unread" ? -1 : b === "sealed-unread" ? 1 : 0)).map((cls) => `${c.unreadSealedCopies[cls]} ${cls}`).join(" · ");
    out.push(`${c.unreadSealed} sealed document(s) stand unread in ${copies} cop(ies) across the stores: ${split}; an orphan may be named inside one, so no orphan reads proven until each opens`);
  }
  return out;
}

export async function cmdDocCensus(args: ParsedArgs, line: DocCensusLine = LIVE_LINE): Promise<number> {
  const answer = await line();
  let why: string | null = null;
  if (answer === null) why = "no vessel answered the census on this store's socket (stand the vessel: lares vessel stand), or it gave no answer in time";
  else if (answer["status"] === "error") why = typeof answer["errorMessage"] === "string" ? answer["errorMessage"] : "the vessel refused the census";
  else if (answer["op"] !== "doc-census" || answer["census"] === null || typeof answer["census"] !== "object") why = "the vessel answered no document census (a vessel older than this door)";
  const quiet = proseFirst(args);
  if (why !== null) {
    emit(quiet, { ok: false, error: { code: "census-unanswered", message: why }, human: () => { console.error(`doc census: unanswered — ${why}`); } });
    return 2;
  }
  const census = answer!["census"] as DocCensusReading;
  emit(quiet, { ok: true, data: { docCensus: census }, human: () => { for (const l of docCensusLines(census)) console.log(l); } });
  return 0;
}
