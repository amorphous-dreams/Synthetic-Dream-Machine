/**
 * `lares vessel census` — WHAT A STOP WOULD DROP, read before it happens.
 *
 * A vessel holds two kinds of content that rest nowhere yet: saves its sealed rest keeps in memory (a change no
 * session booked, a document whose map names no bag now, a seal the holder refused: `save-unbooked`,
 * `save-unmapped`, `save-unsealed`), and carriers its disk projector has not settled (each its queue still owes a
 * reconcile, each whose latest reconcile threw), and files a mirror root inside a checkout holds that git never tracked
 * (`untracked`: each an owed commit, named by path, since a re-found that takes its record leaves it the only copy). A
 * stopped container holds no memory to count, so the host shim
 * asks this census at `down`, while the vessel still stands, and refuses a stop over a non-empty answer, naming the act that
 * lands each item. No word drops them: an item lands, or the vessel stands.
 *
 * A SAVE AT REST UNDER THE VESSEL'S KEY HAS LANDED. A held row the store reads `kept` (every content save of it rests at its
 * storage key sealed under the vessel's key: sealed-pending under its face, or an unnamed push in the vessel's inbox) survives
 * the stop, and the next process carries it back into its wait. The census names it (`kept`: document, refusal, saves) and
 * never counts it as an item.
 *
 * AN UNASKED PUSH OF HEADS ALONE DROPS NO CONTENT. A `save-unnamed` row names a document no map, roster or local caller names
 * here (sealed-doc-store, "unknown means hold"). Where the store reads it `contentFree` (every save it holds a sync state:
 * peers' heads, no change, no checkpoint), the census names it (`unasked`: document, saves, bytes, and its age in saves the
 * store took since) and never counts it as an item, so `down` stops over it naming it and the keep's manifest names it as an
 * omission. A content save of any held row that waits in memory alone counts as owed, whoever made it: an island keeps no
 * store of its own, so no other copy answers for it.
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
import { HELD_REFUSALS } from "@lararium/mesh/sealed-doc-store";
import type { ParsedArgs } from "../parse-args.js";
import { sendCustodyFrame, type CustodyDoorAnswer } from "../custody-door.js";
import { askShoreCensus, type ShoreCensus } from "../shore-core.js";
import { udsSocketPresent } from "../local-connector.js";
import { vesselDid } from "../env.js";
import { emit } from "../render.js";

/** How long the custody door's census frame may take to answer. It answers at once, beside the custody chain. */
export const CENSUS_CUSTODY_MS = 10_000;

/** One unnamed document whose held saves carry no content (sync states alone): its saves and bytes, and its age in saves the store took since. */
export interface UnaskedPush { readonly documentId: string; readonly saves: number; readonly bytes: number; readonly heldAcross: number }

/** One held row whose every content save rests under the vessel's key: a stop keeps it, so it counts as landed. */
export interface KeptRow { readonly documentId: string; readonly refusal: string; readonly saves: number; readonly bagId: string | null }

/** One item a stop would drop. */
export type CensusItem =
  | { readonly kind: "held-save"; readonly refusal: string; readonly documentId: string; readonly saves: number; readonly bagId: string | null;
      /** How many of the row's saves also rest sealed-pending under the vessel's key: a stop keeps those. */
      readonly pending?: number;
      /** The document's unsealed saves fill their counted ceiling: a further save of it refuses (`held-bound`). */
      readonly atBound?: true }
  | { readonly kind: "carrier"; readonly state: string; readonly uri: string; readonly bagId: string | null; readonly island: string }
  | { readonly kind: "untracked"; readonly path: string; readonly bagId: string | null; readonly island: string };

export interface CensusReading {
  readonly clean: boolean;
  readonly items: readonly CensusItem[];
  readonly unanswered: ReadonlyArray<{ readonly part: string; readonly why: string }>;
  /** THE UNASKED ROWS (`save-unnamed`, sync states alone): a document waiting here for a name that holds no content, so a stop
   *  drops no change and the census reads clean beside them (absent where none waits). */
  readonly unasked?: readonly UnaskedPush[];
  /** THE KEPT ROWS: held saves whose content all rests under the vessel's key, so a stop keeps them (absent where none). */
  readonly kept?: readonly KeptRow[];
  /** THE LIT SET: each face whose key stands open, each sealing its own memory under its own key (absent where none reads). */
  readonly facesLit?: readonly number[];
  /** THE WORN FACE beside the lit set (present where the lit set reads): the daemon mount, or null where none wears. */
  readonly worn?: number | null;
  /** THE VESSEL STOOD LOCKED SINCE IT BOOTED: no key ever opened in this life, so no act wrote and a stop drops nothing. */
  readonly lockedSinceBoot?: true;
  /** Each face its custody serves that stands dark here (its light refused), with its cause and clearing line. */
  readonly facesDark?: ReadonlyArray<{ readonly face: number; readonly cause: string; readonly note: string }>;
}

/** The line a census over faces lit and none worn adds: the wear that lets the house settle, in the order a person runs it. */
export const noFaceWornLine = (lit: readonly number[]): string =>
  `no face worn (${lit.map((n) => `h${n}`).join(", ")} stand open): wear one (\`lares wear N\`), then down`;

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
  // This process's own vessel: the root rides absent (the ambient answer). A `null` reads "looked for, not found" and refuses.
  return sendCustodyFrame({ op: "census" }, undefined, abort.signal).finally(() => clearTimeout(timer));
}

const LIVE_LINES: CensusLines = {
  custody: boundedCustodyCensus,
  shore: async () => askShoreCensus(await vesselDid()),
  socketPresent: () => udsSocketPresent(),
};

/** The one line a locked hearth's census answers: the cure, in the order a person runs it. */
export const VESSEL_LOCKED_CENSUS = "vessel locked: run `lares vault unlock`, then down";

/** The line a census prints over a vessel that stood locked since it booted: clean, and why nothing stood at risk. */
export const LOCKED_SINCE_BOOT_CENSUS = "census: clean — the vessel stood locked since it booted: no key opened in this life, so no act wrote, no save waits in memory and no carrier or shore owes a write";

/** The refusals that keep a save in memory: the sealed doc store owns the list (`HELD_REFUSALS`), so a new one never drifts past this door. */
const HELD_REFUSAL_SET: ReadonlySet<string> = new Set<string>(HELD_REFUSALS);

/** The one held refusal a stop may drop no content over: an unnamed document whose held saves are sync states alone. */
const UNASKED_REFUSAL = "save-unnamed";
const countOf = (v: unknown): number => (Number.isSafeInteger(v) && (v as number) >= 0 ? (v as number) : 0);

/** Read both lines into one census. */
export async function readCensus(lines: CensusLines = LIVE_LINES): Promise<CensusReading> {
  const items: CensusItem[] = [];
  const unasked: UnaskedPush[] = [];
  const kept: KeptRow[] = [];
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
      if (!HELD_REFUSAL_SET.has(refusal) || typeof documentId !== "string") {
        unanswered.push({ part: "the sealed rest", why: "a held-save row arrived in a shape this door cannot read" });
        continue;
      }
      const saves = typeof row["saves"] === "number" ? row["saves"] : 1;
      // ONLY A ROW OF SYNC STATES ALONE reads unasked; any held content save, or a row that names none, stays owed (fail closed).
      if (refusal === UNASKED_REFUSAL && row["contentFree"] === true) {
        unasked.push({ documentId, saves, bytes: countOf(row["bytes"]), heldAcross: countOf(row["heldAcross"]) });
        continue;
      }
      const pending = countOf(row["pending"]);
      const bagId = typeof row["bagId"] === "string" ? row["bagId"] : null;
      // A ROW THE STORE READS KEPT rests whole under the vessel's key: landed, never an item (any other shape stays owed).
      if (row["kept"] === true && pending > 0) {
        kept.push({ documentId, refusal, saves, bagId });
        continue;
      }
      items.push({
        kind: "held-save", refusal, documentId, saves, bagId,
        ...(pending > 0 ? { pending } : {}),
        ...(row["atBound"] === true ? { atBound: true as const } : {}),
      });
    }
  }
  // A FACE STANDING LOCKED under a held key holds memory no census can read: each reads unanswered, by name, with its cure.
  const facesLocked = Array.isArray(custody?.["facesLocked"]) ? (custody!["facesLocked"] as unknown[]).filter((n): n is number => Number.isSafeInteger(n)) : [];
  for (const n of facesLocked) unanswered.push({ part: `the face h${n}`, why: `h${n} stands locked; unlock it (\`lares vault unlock face=${n}\`), then down` });
  let shore: ShoreCensus;
  try { shore = await lines.shore(); }
  catch (e) { shore = { carriers: [], unanswered: [{ part: "the disk projector", why: e instanceof Error ? e.message : String(e) }] }; }
  for (const c of shore.carriers) items.push({ kind: "carrier", state: c.state, uri: c.uri, bagId: c.bagId, island: c.island });
  for (const u of shore.untracked ?? []) items.push({ kind: "untracked", path: u.path, bagId: u.bagId, island: u.island });
  unanswered.push(...shore.unanswered);
  // A LOCKED HEARTH SAYS SO IN ONE LINE. Its key stands shut, so the islands refuse `vessel-locked` and nothing the census
  // asks can answer; the cure reads "unlock, then down", never "could not answer". A herm never unlocks, so it never hears it.
  const lockedHearth = (custody?.["locked"] === true && custody["standing"] !== "herm")
    || unanswered.some((u) => /\bvessel-locked\b/.test(u.why));
  // LOCKED SINCE BOOT HOLDS NOTHING BY CONSTRUCTION. The custody door names whether its key ever stood open in this life
  // (`everOpened`), and it counts held saves with no key (documents and counts, never a value). A vessel that never opened, whose
  // sealed rest names no held save (or sits uncomposed, with no store to hold one), wrote nothing: no carrier queue ever ran and
  // no shore took a record. The census reads clean and says why. A door that names no `everOpened`, a key that
  // opened and shut again, or a held row in any shape this door cannot read stays unread, and the stop asks.
  const sealedRestUnread = unanswered.some((u) => u.part === "the sealed rest" && !/^no composition sits/.test(u.why));
  if (lockedHearth && custody?.["everOpened"] === false && !sealedRestUnread) {
    if (items.length === 0) return { clean: true, items, unanswered: [], lockedSinceBoot: true, ...(unasked.length > 0 ? { unasked } : {}), ...(kept.length > 0 ? { kept } : {}) };
    // HELD SAVES OVER A VESSEL THAT NEVER OPENED: the islands' `vessel-locked` refusals name no unread content (no projector ever
    // ran), so they leave the list, and the census answers its items (exit 3): the stop lists exactly what it would drop.
    const moot = (u: { readonly part: string; readonly why: string }): boolean => /\bvessel-locked\b/.test(u.why) || (u.part === "the sealed rest" && /^no composition sits/.test(u.why));
    const rest = unanswered.filter((u) => !moot(u));
    return { clean: false, items, unanswered: rest, ...(unasked.length > 0 ? { unasked } : {}), ...(kept.length > 0 ? { kept } : {}) };
  }
  if (lockedHearth && items.length === 0) {
    return { clean: false, items, unanswered: [{ part: "the vessel", why: VESSEL_LOCKED_CENSUS }] };
  }
  const facesLit = Array.isArray(custody?.["facesLit"]) ? (custody!["facesLit"] as unknown[]).filter((n): n is number => Number.isSafeInteger(n)) : [];
  const worn = Number.isSafeInteger(custody?.["worn"]) ? (custody!["worn"] as number) : null;
  const facesDark = Array.isArray(custody?.["facesDark"]) ? (custody!["facesDark"] as unknown[]).flatMap((d) => {
    const r = d as { face?: unknown; cause?: unknown; note?: unknown };
    return Number.isSafeInteger(r.face) && typeof r.cause === "string" && typeof r.note === "string" ? [{ face: r.face as number, cause: r.cause, note: r.note }] : [];
  }) : [];
  return { clean: items.length === 0 && unanswered.length === 0, items, unanswered, ...(facesLit.length > 0 ? { facesLit, worn } : {}), ...(facesDark.length > 0 ? { facesDark } : {}), ...(unasked.length > 0 ? { unasked } : {}), ...(kept.length > 0 ? { kept } : {}) };
}

/** One unasked push as one printed line: its document and count, and why a stop leaves it. Never a body. */
export const unaskedLine = (u: UnaskedPush): string =>
  `census: unasked  doc ${u.documentId}  ${u.saves} save(s), ${u.bytes} byte(s), held across ${u.heldAcross} later save(s): sync states alone, peers' heads and no change, so a stop drops no content here`;

/** One kept row as one printed line: its document and count, and why a stop keeps it. Never a body. */
export const keptLine = (k: KeptRow): string =>
  `census: kept  ${k.refusal}  doc ${k.documentId}  ${k.saves} save(s)  bag ${k.bagId ?? "(none mapped)"}: at rest under the vessel's key, so a stop keeps them and the next boot carries them back`;

/** One item as one printed line: kind, state, name, and where it belongs. Never a body. */
export function censusLine(item: CensusItem): string {
  if (item.kind === "held-save") {
    const kept = (item.pending ?? 0) > 0 ? `  (${item.pending} of them rest sealed-pending under the vessel's key: a stop keeps those, and the next session of the face seals them)` : "";
    const bound = item.atBound === true ? "  AT ITS CEILING: a further save of this document refuses (held-bound); run any `lares` call under its face, or `lares vault unlock`, so a live session seals what waits" : "";
    const line = `held-save  ${item.refusal}  doc ${item.documentId}  ${item.saves} save(s) in memory  bag ${item.bagId ?? "(none mapped)"}${kept}${bound}`;
    // AN UNNAMED DOCUMENT HOLDING CONTENT: no map or roster names it, so the line names the ways on.
    return item.refusal === "save-unnamed" ? `${line}  (no map or roster names it, and the vessel's key stood out of reach as it arrived: \`lares vault unlock\` rests it in the vessel's inbox; or read who carries it with \`lares vessel census docs=true\` and open the bag that owns it so its saves land)` : line;
  }
  if (item.kind === "untracked") return `untracked  ${item.path}  bag ${item.bagId ?? "(none named)"}  island ${item.island}  (an owed commit: commit it, or remove it by hand)`;
  return `carrier  ${item.state}  ${item.uri}  bag ${item.bagId ?? "(none named)"}  island ${item.island}`;
}

export async function cmdCensus(args: ParsedArgs, lines: CensusLines = LIVE_LINES): Promise<number> {
  const reading = await readCensus(lines);
  const code = reading.unanswered.length > 0 ? 2 : reading.items.length > 0 ? 3 : 0;
  emit(args, {
    ok: code === 0,
    data: { census: reading },
    ...(code === 2 && reading.unanswered[0]?.why === VESSEL_LOCKED_CENSUS ? { error: { code: "vessel-locked", message: VESSEL_LOCKED_CENSUS } } : {}),
    ...(code === 2 && reading.unanswered[0]?.why !== VESSEL_LOCKED_CENSUS ? { error: { code: "census-unanswered", message: reading.unanswered.map((u) => `${u.part}: ${u.why}`).join("; ") } } : {}),
    ...(code === 3 ? { error: { code: "census-items", message: `${reading.items.length} item(s) rest nowhere yet; a stop now drops them` } } : {}),
    human: () => {
      // A SERVED FACE DARK HERE drops no save, so it never turns the census red; its line names the cause and the clearing act.
      for (const d of reading.facesDark ?? []) console.error(`census: ${d.note}`);
      // AN UNASKED ROW (sync states alone) names itself and never turns the census red: it holds no content.
      for (const u of reading.unasked ?? []) console.error(unaskedLine(u));
      // A KEPT ROW (its content at rest under the vessel's key) names itself and never turns the census red: a stop keeps it.
      for (const k of reading.kept ?? []) console.error(keptLine(k));
      if (code === 0 && reading.lockedSinceBoot === true) { console.log(LOCKED_SINCE_BOOT_CENSUS); return; }
      if (code === 0) { console.log("census: clean — no save waits in memory, and the disk projector owes no carrier"); return; }
      for (const item of reading.items) console.log(censusLine(item));
      for (const u of reading.unanswered) console.error(u.why === VESSEL_LOCKED_CENSUS ? `census: ${u.why}` : `census: unanswered — ${u.part}: ${u.why}`);
      if (reading.items.length > 0) console.error(`census: ${reading.items.length} item(s) rest nowhere yet; a stop now drops them`);
      if (reading.facesLit !== undefined && reading.worn === null) console.error(`census: ${noFaceWornLine(reading.facesLit)}`);
    },
  });
  return code;
}
