/**
 * `lares vessel census` — WHAT A STOP WOULD DROP, read before it happens.
 *
 * A vessel holds two kinds of content that rest nowhere yet: saves its sealed rest keeps in memory (a change no
 * session booked, a document whose map names no bag now, a seal the holder refused: `save-unbooked`,
 * `save-unmapped`, `save-unsealed`), and carriers its disk projector has not settled (each its queue still owes a
 * reconcile, each whose latest reconcile threw). A stopped container holds no memory to count, so the host shim
 * asks this census at `down`, while the vessel still stands, and refuses a silent stop over a non-empty answer.
 *
 * Two lines carry it, both read-only and neither asking custody: the custody door's `census` frame (the saves, by
 * document id, never a body) and the `census` act of the shore verb on every island that mounts a disk shore (the
 * carriers, by title). Each wait carries its own bound; a line that cannot answer lands in `unanswered`, by name,
 * and never reads as clean.
 *
 * Exit: 0 clean · 3 items stand (each printed, one per line) · 2 the census could not answer whole.
 *
 * Meme: lar:///ha.ka.ba/lares/cli/vessel-door
 */
import type { ParsedArgs } from "../parse-args.js";
import { sendCustodyFrame, type CustodyDoorAnswer } from "../custody-door.js";
import { askShoreCensus, type ShoreCensus } from "../shore-core.js";
import { udsSocketPresent } from "../local-connector.js";
import { vesselDid } from "../env.js";
import { emit } from "../render.js";

/** How long the custody door's census frame may take to answer. It answers at once, beside the custody chain. */
export const CENSUS_CUSTODY_MS = 10_000;

/** One item a stop would drop. */
export type CensusItem =
  | { readonly kind: "held-save"; readonly refusal: string; readonly documentId: string; readonly saves: number; readonly bagId: string | null }
  | { readonly kind: "carrier"; readonly state: string; readonly uri: string; readonly bagId: string | null; readonly island: string };

export interface CensusReading {
  readonly clean: boolean;
  readonly items: readonly CensusItem[];
  readonly unanswered: ReadonlyArray<{ readonly part: string; readonly why: string }>;
}

/** The two lines the census reads, injectable so a test drives them without a vessel. */
export interface CensusLines {
  readonly custody: () => Promise<CustodyDoorAnswer | null>;
  readonly shore: () => Promise<ShoreCensus>;
  readonly socketPresent: () => boolean;
}

/** The custody frame, bounded: a holder that never answers reads `null` once the bound passes. */
function boundedCustodyCensus(): Promise<CustodyDoorAnswer | null> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), CENSUS_CUSTODY_MS);
  return sendCustodyFrame({ op: "census" }, null, abort.signal).finally(() => clearTimeout(timer));
}

const LIVE_LINES: CensusLines = {
  custody: boundedCustodyCensus,
  shore: async () => askShoreCensus(await vesselDid()),
  socketPresent: () => udsSocketPresent(),
};

const HELD_REFUSALS: ReadonlySet<string> = new Set(["save-unbooked", "save-unmapped", "save-unsealed"]);

/** Read both lines into one census. */
export async function readCensus(lines: CensusLines = LIVE_LINES): Promise<CensusReading> {
  const items: CensusItem[] = [];
  const unanswered: Array<{ part: string; why: string }> = [];
  if (!lines.socketPresent()) {
    return { clean: false, items, unanswered: [{ part: "the vessel", why: "no vessel answers on this store's socket" }] };
  }
  const custody = await lines.custody();
  const held = custody?.["held"];
  if (custody === null) {
    unanswered.push({ part: "the sealed rest", why: `the custody door gave no answer within ${CENSUS_CUSTODY_MS / 1000}s` });
  } else if (custody["op"] !== "census" || custody["status"] === "error") {
    unanswered.push({ part: "the sealed rest", why: typeof custody["errorMessage"] === "string" ? custody["errorMessage"] : "the custody door answered no census (a vessel older than this door)" });
  } else if (!Array.isArray(held)) {
    unanswered.push({ part: "the sealed rest", why: `no composition sits to count its saves (the vessel stands ${String(custody["standing"] ?? "unread")})` });
  } else {
    for (const row of held as Array<Record<string, unknown>>) {
      const refusal = String(row["refusal"]);
      const documentId = row["documentId"];
      if (!HELD_REFUSALS.has(refusal) || typeof documentId !== "string") {
        unanswered.push({ part: "the sealed rest", why: "a held-save row arrived in a shape this door cannot read" });
        continue;
      }
      items.push({ kind: "held-save", refusal, documentId, saves: typeof row["saves"] === "number" ? row["saves"] : 1, bagId: typeof row["bagId"] === "string" ? row["bagId"] : null });
    }
  }
  let shore: ShoreCensus;
  try { shore = await lines.shore(); }
  catch (e) { shore = { carriers: [], unanswered: [{ part: "the disk projector", why: e instanceof Error ? e.message : String(e) }] }; }
  for (const c of shore.carriers) items.push({ kind: "carrier", state: c.state, uri: c.uri, bagId: c.bagId, island: c.island });
  unanswered.push(...shore.unanswered);
  return { clean: items.length === 0 && unanswered.length === 0, items, unanswered };
}

/** One item as one printed line: kind, state, name, and where it belongs. Never a body. */
export function censusLine(item: CensusItem): string {
  return item.kind === "held-save"
    ? `held-save  ${item.refusal}  doc ${item.documentId}  ${item.saves} save(s) in memory  bag ${item.bagId ?? "(none mapped)"}`
    : `carrier  ${item.state}  ${item.uri}  bag ${item.bagId ?? "(none named)"}  island ${item.island}`;
}

export async function cmdCensus(args: ParsedArgs, lines: CensusLines = LIVE_LINES): Promise<number> {
  const reading = await readCensus(lines);
  const code = reading.unanswered.length > 0 ? 2 : reading.items.length > 0 ? 3 : 0;
  emit(args, {
    ok: code === 0,
    data: { census: reading },
    ...(code === 2 ? { error: { code: "census-unanswered", message: reading.unanswered.map((u) => `${u.part}: ${u.why}`).join("; ") } } : {}),
    ...(code === 3 ? { error: { code: "census-items", message: `${reading.items.length} item(s) rest nowhere yet; a stop now drops them` } } : {}),
    human: () => {
      if (code === 0) { console.log("census: clean — no save waits in memory, and the disk projector owes no carrier"); return; }
      for (const item of reading.items) console.log(censusLine(item));
      for (const u of reading.unanswered) console.error(`census: unanswered — ${u.part}: ${u.why}`);
      if (reading.items.length > 0) console.error(`census: ${reading.items.length} item(s) rest nowhere yet; a stop now drops them`);
    },
  });
  return code;
}
