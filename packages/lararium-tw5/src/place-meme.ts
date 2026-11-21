/*\
title: lar:///ha.ka.ba/lararium/tw5/modules/place-meme
type: application/javascript
module-type: library
\*/
/**
 * place-meme — a meme arrives as text and lands as its records.
 *
 * ONE FUNCTION, EVERY SKIN. The plain TW5 server route (`PUT /recipes/:recipe/memes/:uri`), the
 * island's INGEST verb, and any MCP or CLI door that carries meme text all call `placeMeme`. The
 * placement law lives here once:
 *
 *   1. the meme's current FAMILY in the sink: the root and its component slots, by the one family law
 *      (`@lararium/mesh/family`). A `uri/path` title stands as its own meme and never joins it,
 *   2. the Confluence gate (`decideIngest`) over the family's present render vs the new text,
 *   3. land every fresh record, tombstone every family member the new text leaves undeclared.
 *
 * A `MemeSink` is the only thing a skin supplies: four verbs over whatever holds tiddlers — a live
 * `$tw.wiki` (`wikiMemeSink`), a bag store behind BagAccess, a Map in a test. The split itself runs
 * through the deserializer, so it happens inside the engine on every skin (the in-VM parse law).
 *
 * THE BASE HASH. A writer that read the meme before editing hands back the canonical hash it read
 * (`baseHash`, the route's `If-Match`). The gate treats it as the merge base: records that moved
 * past it read as a CONFLICT, never a silent overwrite. No base = a fresh adoption — the gate lands
 * it unless the records already carry an equivalent render (a noop).
 *
 * ONE RAW `#`, EVER. A `lar:` URI never carries a second raw `#` (bags/lares/ha.ka.ba/lares/docs/pono/
 * child-grade-decision.mem row 16): `placeMeme` may land against ANY group member's own address, not
 * only a founding's — a slot child of a slot child places by calling `placeMeme` with a slot URI
 * (already carrying `#/a`) as the root. A nested slot then composes onto the fragment the root
 * ALREADY HAS (`#/a/z`), never opens a second one beside it (`#/a#/z`). The deserializer's split
 * reads the fragment off the given root — not a bare `""` prefix — before it recurses, so the one
 * fragment a URI carries stays the only one it ever carries.
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/place-meme
 */

import { conflictWhy, decideIngest, QUOTEBLOCKED_CODE } from "./ingest-gate.js";
import { KAHEA_REF_RE } from "./meme-ast/ahu-scan.js";
import { readCarrierEdges } from "./carrier-edges.js";
import type { MemeDiagnostic } from "./meme-ast/diagnostics.js";
import { gradeOf, MEMETIC_SOURCE } from "./meme-ast/diagnostics.js";
import type { TiddlerFields } from "./deserializer.js";
import { carriageUri, expandMemeRefs } from "./deserializer.js";
import type { TW5Wiki } from "./types/tiddlywiki.js";

import { carrierMarkPattern, headUriOf, maskedExec, maskedExecAll } from "@lararium/memetic-frame";
import { CARRIER_TYPE } from "@lararium/mesh/carrier-type";
import {
  componentsBeneath, consequence, edgeDescendantsOf, isFamilyRoot, memeOrphanAlertTitle, MEME_ORPHAN_ALERT_PREFIX, orphanFamilies, orphansUnder, rootAddressOf, tombstonesOf,
  type Consequence, type FamilyFields, type FamilyReference, type FamilyView,
} from "@lararium/mesh/family";
import { carrierHash } from "@lararium/mesh/crypto";

type MaybePromise<T> = T | Promise<T>;

/** The four verbs a placement needs over whatever holds tiddlers. Every verb may answer sync or async. */
export interface MemeSink {
  /** Every live title the sink holds (the placement filters the meme's group out of it). */
  titles(): MaybePromise<readonly string[]>;
  /** The fields under one title, or undefined. */
  read(title: string): MaybePromise<TiddlerFields | undefined>;
  /** Land one record (create or replace under its title). */
  land(fields: TiddlerFields): MaybePromise<void>;
  /** Remove one title. */
  tombstone(title: string): MaybePromise<void>;
  /**
   * Remove a family's titles as ONE change, where the holder can carry one (a bag's document). Absent, a
   * removal tombstones title by title, and the holder's own shore gathers them (the island's drain lands a
   * root and the slots that left with it as one family write).
   */
  tombstoneFamily?(titles: readonly string[]): MaybePromise<void>;
  /**
   * WHERE THE SINK KNOWS ITS LAYERS: whether a live record of the title rests in a layer beneath the one this sink
   * writes. A removal tombstones only the titles that answer yes (a kāpae keeps the lower record hidden) and retracts
   * the rest plainly, so no kāpae rises over nothing. A sink that does not know (`beneath` or `leaveFamily` absent)
   * removes through `tombstone`, and the holder's own shore decides what leaves.
   */
  beneath?(title: string): MaybePromise<boolean>;
  /** Remove a family as ONE change: `tombstones` raise a kāpae, `retracts` leave their layer to absent. */
  leaveFamily?(tombstones: readonly string[], retracts: readonly string[]): MaybePromise<void>;
  /**
   * THE ALERT RAIL, where the sink has one: raise (or, with `null`, clear) the one coalesced alert a
   * meme root carries. A live wiki has it (`wikiMemeSink`); a bag store does not, and its placements
   * carry the finding on the receipt alone.
   */
  surface?(root: string, finding: MemeAlertFinding | null): MaybePromise<void>;
}

// ---------------------------------------------------------------------------
// THE ALERT RAIL — one coalesced alert per meme root
// ---------------------------------------------------------------------------

/** TW5's built-in alert tag — tiddlers carrying it surface in the alerts area. */
const TW5_ALERT_TAG = "$:/tags/Alert";

/** The one coalesced alert a root carries — stable per root, so a burst of saves (or two checks grading
 *  the same root) updates one tiddler rather than piling up a new one each time. */
export function memeAlertTitle(root: string): string {
  return `$:/temp/lares/alert/meme-child-gate/${root}`;
}

/** One finding the rail raises: the record whose write earned it (the root itself for a whole-chunk
 *  fence, a slot child for the child gate), and the codes + prose a reader sees. */
export interface MemeAlertFinding {
  readonly child: string;
  readonly codes: readonly string[];
  readonly why: string;
}

/** The wiki surface the rail writes through. */
export interface MemeAlertWiki {
  getTiddler(title: string): unknown;
  addTiddler(fields: Record<string, unknown>): void;
  deleteTiddler(title: string): void;
  /** The wiki's own change log, per title: the cursor an alert names in place of a clock (no global now). */
  getChangeCount?(title: string): number;
}

/** WHERE AN ALERT SAW ITS FINDING: the record's title and the count of changes this wiki's log holds for it. */
export function alertCursor(wiki: Pick<MemeAlertWiki, "getChangeCount">, title: string): string {
  return `${title}@${wiki.getChangeCount?.(title) ?? 0}`;
}

/**
 * THE RAIL every meme check shares — the backstop's child gate (the in-place ahu grain) and the
 * placement's quoteblock floor (the whole-chunk grain) raise and clear it alike. The LAST call standing
 * wins the slot, same as any other `$:/temp/…` alert in this house. Clearing touches only an alert that
 * stands, so a clean placement writes nothing. Never lands or refuses a record — surfacing, not gating.
 */
export function surfaceMemeAlert(wiki: MemeAlertWiki, root: string, finding: MemeAlertFinding | null): void {
  const alertTitle = memeAlertTitle(root);
  if (!finding) {
    if (wiki.getTiddler(alertTitle)) wiki.deleteTiddler(alertTitle);
    return;
  }
  const codes = finding.codes.join(", ");
  wiki.addTiddler({
    title: alertTitle,
    text: finding.child === root
      ? `${root} arrived un-decomposable (${codes}): ${finding.why}`
      : `${finding.child} moved ${root} out of frame (${codes}): ${finding.why}`,
    tags: TW5_ALERT_TAG,
    "alert-kind": "meme-child-gate",
    root,
    child: finding.child,
    codes,
    "seen-at": alertCursor(wiki, finding.child),
  });
}

/**
 * THE ORPHAN RAIL, beside the child gate's: one alert per root whose slot children stand with no root above
 * them (`$:/temp/lares/alert/meme-orphan/<root>`). The children stay live and named until a hand decides;
 * the alert carries the root, the orphans as a list, and the log cursor it saw them at. The `$:/temp` layer
 * keeps it per device and nothing persists it: each boot re-derives it from the view. An unchanged finding
 * writes nothing; an empty one clears an alert that stands.
 */
export function surfaceOrphanAlert(wiki: MemeAlertWiki, root: string, orphans: readonly string[]): void {
  const alertTitle = memeOrphanAlertTitle(root);
  const standing = (wiki.getTiddler(alertTitle) as { fields?: Record<string, unknown> } | undefined)?.fields;
  if (orphans.length === 0) {
    if (standing) wiki.deleteTiddler(alertTitle);
    return;
  }
  const list = orphans.map((title) => (/[\s\[\]]/.test(title) ? `[[${title}]]` : title)).join(" ");
  if (standing && standing["orphans"] === list) return;
  const one = orphans.length === 1;
  wiki.addTiddler({
    title: alertTitle,
    text: `${orphans.length} slot record${one ? "" : "s"} of ${root} stand${one ? "s" : ""} with no root above: ${orphans.join(", ")}. ` +
      `Each stays live as a plain tiddler until a hand keeps, re-roots or drops it.`,
    tags: TW5_ALERT_TAG,
    "alert-kind": "meme-orphan",
    root,
    orphans: list,
    "seen-at": alertCursor(wiki, root),
  });
}

/**
 * RE-DERIVE EVERY ORPHAN FLAG FROM THE VIEW: one pass, the predicate the node projector and the browser
 * mirror share (`orphanFamilies`). Raises the alert of each root that holds orphans and clears each standing
 * alert whose root holds none. Answers the orphans by root.
 */
export function tendOrphanAlerts(wiki: MemeAlertWiki & Pick<TW5Wiki, "allTitles" | "getTiddler">): Map<string, string[]> {
  const found = orphanFamilies(wikiFamilyView(wiki));
  for (const title of wiki.allTitles()) {
    if (!title.startsWith(MEME_ORPHAN_ALERT_PREFIX)) continue;
    const root = title.slice(MEME_ORPHAN_ALERT_PREFIX.length);
    if (!found.has(root)) surfaceOrphanAlert(wiki, root, []);
  }
  for (const [root, orphans] of found) surfaceOrphanAlert(wiki, root, orphans);
  return found;
}

/** Re-derive ONE root's orphan flag from the view; answers the orphans standing under it. */
export function tendOrphanAlert(wiki: MemeAlertWiki & Pick<TW5Wiki, "allTitles" | "getTiddler">, root: string): string[] {
  const orphans = orphansUnder(wikiFamilyView(wiki), root);
  surfaceOrphanAlert(wiki, root, orphans);
  return orphans;
}

export interface PlaceMemeInput {
  /** The meme's root lar: URI — the title its parent record carries. */
  readonly uri: string;
  /** The whole meme text, framed. */
  readonly text: string;
  /** The canonical hash the writer last read (the merge base); null/absent = fresh adoption. */
  readonly baseHash?: string | null;
  /** The base's RECORDS side, where a disk gesture's base holds two hashes (the disk stood in a
   *  framing the render would normalize). Null/absent = `baseHash` names both sides. */
  readonly baseRecordsHash?: string | null;
  /** The digest the gate compares by; defaults to the tagged sha256 every other shore uses. */
  readonly hash?: (text: string) => string;
  /** True where no person stands behind the placement (a watcher's wave): with no base it never adopts
   *  over records that say something else, and answers `conflict`, `no-base` (`ingest-gate`, rule 4½). */
  readonly unattended?: boolean;
  /** Reads every record an `ingest` decision would land, before the first lands; a throw lands nothing (a door's own wall). */
  readonly vet?: (records: readonly Record<string, unknown>[]) => void | Promise<void>;
}

export interface PlaceMemeReceipt {
  readonly uri: string;
  readonly decision: "ingest" | "noop" | "refuse" | "conflict";
  readonly grade: "clean" | MemeDiagnostic["severity"];
  /** The gate's reason on a noop, and on a conflict (`both-moved` · `no-base`). */
  readonly reason?: string;
  /** Titles landed (ingest only). */
  readonly landed: readonly string[];
  /** Group members removed because the new text leaves them undeclared (ingest only). */
  readonly tombstoned: readonly string[];
  /** Hash of the canonical render the records now carry — the next writer's base. */
  readonly canonicalHash?: string;
  readonly warnings: readonly string[];
  readonly diagnostics: readonly MemeDiagnostic[];
}

/**
 * THE WIRE PATH — the meme's URI projected onto an HTTP path, a sibling of the native
 * `/{recipes|bags}/:name/tiddlers/:title` collection: `<scheme>:///<path>` ⇄ `/memes/<scheme>/<path>`.
 * Groups: container kind · container name · scheme · uri-path.
 */
export const MEME_PATH = /^\/(recipes|bags)\/([^/]+)\/memes\/([a-z][a-z0-9+.-]*)\/(.+)$/;

/** The URI a matched `MEME_PATH` names, or null when a segment carries a malformed escape. */
export function memeUriOfParams(params: readonly string[]): string | null {
  const scheme = params[2];
  const rest = params[3];
  if (!scheme || !rest) return null;
  try { return `${scheme}:///${rest.split("/").map(decodeURIComponent).join("/")}`; } catch { return null; }
}

/** The path a meme's URI projects to, under one container. Null for a URI with an authority. */
export function memePathOf(uri: string, container: { kind: "bags" | "recipes"; name: string }): string | null {
  const m = /^([a-z][a-z0-9+.-]*):\/\/\/(.+)$/.exec(uri);
  if (!m) return null;
  return `/${container.kind}/${container.name}/memes/${m[1]}/${m[2]!.split("/").map(encodeURIComponent).join("/")}`;
}

/**
 * A FRAMED ROOT — a record the ROOT LAW names (`isMemeRoot`) whose text still opens with a SOH head
 * (masked: a head shown inside a fence opens nothing). The whole meme sits in one record, unsplit; the
 * placement law never ran over it. A split root carries a `<<~ kahea …>>` body and no head, so it never
 * reads as framed. Answers the URI the head names (else the title), or null.
 *
 * THE MARK IS NOT THE THING. A slot child carries the carrier type by construction and its text is the
 * author's, so a child into which someone pasted a whole framed carrier wears every mark a founding
 * wears. Reading the mark alone, this answered the CHILD's own address — and three doors believed it:
 * the charm re-addressed a fragment to `/memes/` and the split once minted `uri#/a#/z`, a title the
 * group law admits and the address grammar forbids (ROW 16 — one raw `#`, ever, see above); the native
 * door's gate answered 422 over the same record,
 * which stalls the stock syncer's queue permanently; the backstop took a child for a founding. So the
 * root law arrives FIRST, in the one spelling `isMemeRoot` already carries — a second copy of it would
 * drift the day one of them moved, which is exactly how this seam opened.
 *
 * What the child's frame then IS, is authored text: it lands verbatim through the native door and the
 * grade speaks where a child's save re-places its root (the backstop).
 */
export function framedRootOf(fields: Record<string, unknown>): string | null {
  const title = typeof fields["title"] === "string" ? fields["title"] : "";
  if (!isMemeRoot(title, fields as TiddlerFields)) return null;
  const text = typeof fields["text"] === "string" ? fields["text"] : "";
  if (!maskedExec(text, carrierMarkPattern("head", "g"))) return null;
  return headUriOf(text) ?? (title || null);
}

/**
 * THE TEXT GRAMMAR THE FAMILY LAW READS THROUGH. A `kahea ahu` call names a COMPONENT of the record's own
 * meme (the slot path composes onto the root's address); a `loulou` or a `pranala` names ANOTHER meme. Both
 * scans read under the fence mask: a call quoted in a code fence names nothing.
 */
export function familyRefsOf(title: string, fields: FamilyFields): FamilyReference[] {
  const text = typeof fields["text"] === "string" ? fields["text"] : "";
  if (!text.includes("<<~")) return [];
  const refs: FamilyReference[] = [];
  const root = rootAddressOf(title);
  if (text.includes("kahea")) for (const match of maskedExecAll(text, KAHEA_REF_RE)) refs.push({ kind: "kahea", to: root + match[1]! });
  for (const edge of readCarrierEdges(text)) {
    if (edge.form === "loulou" || edge.form === "pranala") refs.push({ kind: edge.form, to: `lar:///${edge.written}` });
  }
  return refs;
}

/** A family view over a plain `title -> fields` reader: the shape a wiki, a Map and a snapshot all lend. */
export function familyViewOf(
  titles: () => Iterable<string>, read: (title: string) => FamilyFields | undefined, extra: Partial<FamilyView> = {},
): FamilyView {
  return { titles, read, refs: familyRefsOf, ...extra };
}

/** The family view of a live wiki. */
export function wikiFamilyView(wiki: Pick<TW5Wiki, "allTitles" | "getTiddler">, extra: Partial<FamilyView> = {}): FamilyView {
  return familyViewOf(() => wiki.allTitles(), (title) => (wiki.getTiddler(title) as { fields?: FamilyFields } | undefined)?.fields, extra);
}

/** What a wiki lends a family re-title: its titles, its records, and the two writes a hand makes. */
export interface FamilyRenameWiki {
  allTitles(): string[];
  getTiddler(title: string): unknown;
  addTiddler(fields: Record<string, unknown>): void;
  deleteTiddler(title: string): void;
}

const fieldsIn = (wiki: Pick<FamilyRenameWiki, "getTiddler">, title: string): Record<string, unknown> | undefined =>
  (wiki.getTiddler(title) as { fields?: Record<string, unknown> } | undefined)?.fields;

/** One record under a new title: the address-bearing fields follow the title. */
function retitled(fields: Record<string, unknown>, to: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  const next: Record<string, unknown> = { ...fields, ...extra, title: to };
  if (typeof fields["uri-path"] === "string" && to.startsWith("lar:///")) next["uri-path"] = to.slice("lar:///".length);
  return next;
}

/**
 * THE SLOTS FOLLOW THEIR ROOT. Re-title every slot record standing beneath `from` (by its parent edges, at
 * every depth, whether or not `from` itself still stands) under `to`: the title, the parent edge and the
 * `uri-path` move together, and the body rides untouched. A `kahea` call names its slot by a rooted path, so
 * the root's text needs no rewrite. A title a record already holds is never landed over. Answers the new
 * titles. A stock rename of a root re-titles the one record and strands every slot beneath it; this carries them.
 */
export function retitleSlotsInWiki(wiki: FamilyRenameWiki, from: string, to: string): string[] {
  const moved: string[] = [];
  const prefix = `${from}#`;
  for (const old of edgeDescendantsOf(wikiFamilyView(wiki as never), from)) {
    const fields = fieldsIn(wiki, old);
    if (!fields || !old.startsWith(prefix)) continue;
    const next = to + old.slice(from.length);
    if (wiki.getTiddler(next) !== undefined) continue;
    const parent = String(fields["$fragment-parent"] ?? "");
    const parentNext = parent === from || parent.startsWith(prefix) ? to + parent.slice(from.length) : parent;
    wiki.addTiddler(retitled(fields, next, { "$fragment-parent": parentNext }));
    wiki.deleteTiddler(old);
    moved.push(next);
  }
  return moved;
}

/**
 * RENAME, MEME-AWARE, over a live wiki: the consequence gets read first, and a refusal lands nothing. A root
 * re-titles and its slots follow it (the root first, so its writes lead its slots'); a plain tiddler
 * re-titles alone; a slot refuses (`slot-without-root`). Relinking the references other tiddlers hold stays
 * the engine's own act (`relinkTiddler`). Answers the consequence it read.
 */
export function renameFamilyInWiki(wiki: FamilyRenameWiki, from: string, to: string): Consequence {
  const read = consequence(wikiFamilyView(wiki as never), { kind: "rename", title: from, to });
  if (read.refusals.length > 0) return read;
  const fields = fieldsIn(wiki, from)!;
  wiki.addTiddler(retitled(fields, to));
  wiki.deleteTiddler(from);
  if (read.position === "root") retitleSlotsInWiki(wiki, from, to);
  return read;
}

/**
 * ONE CONSISTENT READ of a meme's neighbourhood in a sink: the record under the URI and every record whose
 * title composes onto the same root address (`<root>#…`), which the address grammar makes the only titles a
 * component can hold. The view names every title the sink holds, so a consequence can name a path child,
 * and reads the records of this neighbourhood alone.
 */
async function familySnapshot(
  uri: string, sink: Pick<MemeSink, "titles" | "read">,
): Promise<{ view: FamilyView; records: Map<string, TiddlerFields> }> {
  const titles = [...await sink.titles()];
  const address = rootAddressOf(uri);
  const prefix = `${address}#`;
  const records = new Map<string, TiddlerFields>();
  for (const title of titles) {
    if (title !== uri && title !== address && !title.startsWith(prefix)) continue;
    const fields = await sink.read(title);
    if (fields) records.set(title, fields);
  }
  return { view: familyViewOf(() => titles, (title) => records.get(title)), records };
}

/** The family the placement law acts on: the record under the URI and its components; the orphans a dead root left. */
function familyGroup(view: FamilyView, uri: string): string[] {
  return view.read(uri) !== undefined ? componentsBeneath(view, uri) : orphansUnder(view, uri);
}

const defaultHash = (text: string): string => carrierHash(text);

/** The meme's family in the sink and its present render — the text the records carry now. */
async function currentRender(
  uri: string, sink: Pick<MemeSink, "titles" | "read">,
): Promise<{ group: string[]; text: string; view: FamilyView }> {
  const { view, records } = await familySnapshot(uri, sink);
  return { group: familyGroup(view, uri), text: expandMemeRefs((t) => records.get(t), uri) ?? heldText(records.get(uri)), view };
}

/**
 * A HELD RECORD RENDERS AS ITS OWN BYTES. The recompose answers a carrier alone; a record under the URI
 * that no frame reads as a meme (bare data, the gate's verbatim hold) carries nothing to recompose, and
 * its text stands as its canonical render. The gate's bare leg compares the arriving bytes against this
 * render, a writer's base hashes it, and the read half answers it: one reading for all three, so the
 * bytes a person put read back as the bytes a person gets.
 */
function heldText(root: TiddlerFields | undefined): string {
  return typeof root?.text === "string" ? root.text : "";
}

/**
 * A POINTER'S BODY RESTS ELSEWHERE. True where the record under the URI names its bytes by content address
 * and holds none of them in this sink. `readMeme` stays total over such a record (the gate, the listing
 * and the backstop read through it); a door that hands a person the TEXT asks here first and refuses by
 * name, since an empty answer would state bytes nobody wrote.
 */
export async function holdsUnreadPointer(uri: string, sink: Pick<MemeSink, "read">): Promise<boolean> {
  const root = await sink.read(uri);
  return root !== undefined && typeof root.text !== "string"
    && (root["_is_skinny"] === "yes" || typeof root["textCid"] === "string");
}

/** The code a read of an unread pointer refuses under. */
export const POINTER_BODY_CODE = "pointer-body";

/** The code a put that carries no bytes refuses under. */
export const EMPTY_BODY_CODE = "empty-body";

/**
 * THE STAGE MEME LAW (road `L9`). The memory stage keys every meme by its path: a stage meme's title and
 * `uri-path` carry the class and slug (a memory's class and slug, an event, a commit), never a clock or a
 * counter, so a re-pour of an exported projection after a re-found lands the same tiddlers.
 *
 * A stage path reads as one or two lowercase path segments, and the meme stands at `STAGE_MEME_PREFIX` + path
 * (`ha.ka.ba` + `kahua/memory` + at most two more keeps the uri's four path segments). The gate refuses by name
 * a title under the stage prefix whose path reads otherwise (`stage-path-shape`).
 */
export const STAGE_MEME_PREFIX = "lar:///ha.ka.ba/kahua/memory/";
export const STAGE_PATH_SHAPE_CODE = "stage-path-shape";

const STAGE_PATH_SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Why a stage path reads no path, or null where it reads one. */
function stagePathFault(path: string): string | null {
  const segments = path.split("/");
  if (segments.length > 2) return `"${path}" holds ${segments.length} segments; a stage path holds one or two`;
  const bad = segments.find((seg) => !STAGE_PATH_SEGMENT.test(seg));
  return bad === undefined ? null : `"${path}" holds the segment "${bad}"; a segment reads lowercase letters and digits, hyphen-joined`;
}

/** The title a stage meme stands at: the stage prefix and its path. Throws `stage-path-shape` on a path that reads no path. */
export function stageMemeTitle(path: string): string {
  const fault = stagePathFault(path);
  if (fault !== null) throw new Error(`${STAGE_PATH_SHAPE_CODE}: ${fault}`);
  return `${STAGE_MEME_PREFIX}${path}`;
}

/** The stage meme law over a title: the refusal, or null where the title stands outside the stage or reads a stage path. */
function stageMemeRefusal(uri: string): MemeDiagnostic | null {
  if (!uri.startsWith(STAGE_MEME_PREFIX)) return null;
  const fault = stagePathFault(uri.slice(STAGE_MEME_PREFIX.length));
  if (fault === null) return null;
  return { from: 0, to: 0, severity: "error", source: MEMETIC_SOURCE, code: STAGE_PATH_SHAPE_CODE, message: `${STAGE_PATH_SHAPE_CODE}: ${uri}: ${fault}` };
}

/** The Confluence gate's own verdict, read once — shared by `placeMeme` (which lands it) and
 *  `evaluateMeme` (which never does). Internal: callers get the two typed entry points below. */
async function evaluate(
  input: PlaceMemeInput, sink: Pick<MemeSink, "titles" | "read">,
): Promise<{ group: readonly string[]; view: FamilyView; decision: ReturnType<typeof decideIngest<TiddlerFields>>; currentRenderHash: string }> {
  const { uri, text } = input;
  const hash = input.hash ?? defaultHash;
  const baseHash = input.baseHash ?? null;

  const { group, view, text: currentText } = await currentRender(uri, sink);
  const currentRenderHash = hash(currentText);

  // A PUT THAT CARRIES NO BYTES REFUSES BY NAME. An empty text and an address nothing holds hash alike,
  // so the bare leg would answer "the records already say this" over a title that holds no record.
  if (text === "") {
    const wall: MemeDiagnostic = {
      from: 0, to: 0, severity: "error", source: MEMETIC_SOURCE, code: EMPTY_BODY_CODE,
      message: `${uri}: the put carries no bytes; nothing lands (a removal rides the delete verb)`,
    };
    return { group, view, decision: { kind: "refuse", warnings: [wall.message], diagnostics: [wall] }, currentRenderHash };
  }

  const decision = decideIngest({
    uri,
    diskText: text,
    diskHash: hash(text),
    syncedHash: baseHash,
    syncedRecordsHash: input.baseRecordsHash ?? null,
    currentRenderHash,
    hash,
    ...(input.unattended === true ? { unattended: true } : {}),
    recordsAbsent: !group.includes(uri),
  });
  if (decision.kind === "ingest") {
    const wall = stageMemeRefusal(uri);
    if (wall !== null) return { group, view, decision: { kind: "refuse", warnings: [wall.message], diagnostics: [wall] }, currentRenderHash };
  }
  return { group, view, decision, currentRenderHash };
}

function receiptOfNonIngest(
  uri: string, currentRenderHash: string, decision: Exclude<ReturnType<typeof decideIngest<TiddlerFields>>, { kind: "ingest" }>,
): PlaceMemeReceipt {
  if (decision.kind === "noop") {
    return { uri, decision: "noop", grade: "clean", reason: decision.reason, landed: [], tombstoned: [], canonicalHash: currentRenderHash, warnings: [], diagnostics: [] };
  }
  const grade = gradeOf(decision.diagnostics);
  if (decision.kind === "refuse") {
    return { uri, decision: "refuse", grade, landed: [], tombstoned: [], canonicalHash: currentRenderHash, warnings: decision.warnings, diagnostics: decision.diagnostics };
  }
  return { uri, decision: "conflict", grade, reason: decision.reason, landed: [], tombstoned: [], canonicalHash: currentRenderHash, warnings: [conflictWhy(uri, decision.reason)], diagnostics: decision.diagnostics };
}

/**
 * Place one meme into a sink through the Confluence gate. Never throws on a bad meme — the receipt
 * carries the refusal; a sink verb that throws propagates.
 */
export async function placeMeme(input: PlaceMemeInput, sink: MemeSink): Promise<PlaceMemeReceipt> {
  const { uri } = input;
  const hash = input.hash ?? defaultHash;
  const { view, decision, currentRenderHash } = await evaluate(input, sink);

  if (decision.kind !== "ingest") return receiptOfNonIngest(uri, currentRenderHash, decision);
  const grade = gradeOf(decision.diagnostics);
  await input.vet?.(decision.records);

  const lands: string[] = [];
  for (const fields of decision.records) {
    const title = typeof fields.title === "string" ? fields.title : "";
    if (!title) throw new Error(`placeMeme: ${uri} produced a record without a title`);
    lands.push(title);
  }
  // THE CONSEQUENCE NAMES THE STALE SLOTS: the family members the new text leaves undeclared, by the one
  // family law. A title the address merely prefixes (`uri/path`, an edge-less `uri#…`) stays where it stands.
  const stale = tombstonesOf(consequence(view, { kind: "put", title: uri, lands }));
  const landed: string[] = [];
  for (const fields of decision.records) {
    await sink.land(fields);
    landed.push(fields.title as string);
  }
  const tombstoned: string[] = [];
  for (const title of stale) {
    await sink.tombstone(title);
    tombstoned.push(title);
  }
  // THE QUOTEBLOCK FLOOR SURFACES (`ahu.mem#/quoteblock-floor`): a fence nobody sees reads as a drop
  // wearing a cure's face. The finding rides the receipt's warnings on every door, and the sink's rail
  // where it has one; a placement that decomposes clean clears the root's standing alert.
  const fenced = decision.diagnostics.filter((d) => d.code === QUOTEBLOCKED_CODE);
  const warnings = fenced.map((d) => d.message);
  await sink.surface?.(uri, fenced.length === 0 ? null : { child: uri, codes: [QUOTEBLOCKED_CODE], why: warnings.join("; ") });
  return { uri, decision: "ingest", grade, landed, tombstoned, canonicalHash: hash(decision.canonicalText), warnings, diagnostics: decision.diagnostics };
}

/**
 * Read the Confluence gate's verdict WITHOUT landing or tombstoning anything — `placeMeme`'s read
 * half, for a caller that must grade a meme (surface an alert, refuse a save) but never write on its
 * own account. An `ingest`-graded verdict still answers `decision: "ingest"` with its diagnostics and
 * the canonical hash the records WOULD carry; `landed`/`tombstoned` stand empty always, because this
 * call never reaches `sink.land`/`sink.tombstone` at all — the grading and the writing are two
 * different acts, and a caller that wants only the first must never be handed a sink verb that writes.
 */
export async function evaluateMeme(
  input: PlaceMemeInput, sink: Pick<MemeSink, "titles" | "read">,
): Promise<PlaceMemeReceipt> {
  const { uri } = input;
  const hash = input.hash ?? defaultHash;
  const { decision, currentRenderHash } = await evaluate(input, sink);
  if (decision.kind !== "ingest") return receiptOfNonIngest(uri, currentRenderHash, decision);
  const grade = gradeOf(decision.diagnostics);
  return { uri, decision: "ingest", grade, landed: [], tombstoned: [], canonicalHash: hash(decision.canonicalText), warnings: [], diagnostics: decision.diagnostics };
}

/** The code a slot patch refuses under when the meme holds no slot at the address it names. */
export const SLOT_MISSING_CODE = "slot-missing";
/** The code a slot patch refuses under when the meme moved past the base the writer read. */
export const STALE_BASE_CODE = "stale-base";

/** One slot's body edit: `append` lands a paragraph at the end of the body; `replace` swaps the whole body. */
export interface SlotPatchInput {
  readonly uri: string;
  /** The slot's address under the root, `#/name` (or `#/name/child`). */
  readonly slot: string;
  readonly mode: "append" | "replace";
  readonly text: string;
  /** The canonical hash the writer read; the patch reads against it and nothing else. */
  readonly baseHash: string;
  readonly hash?: (text: string) => string;
}

export type SlotPatchReading =
  | { readonly kind: "absent" }
  | { readonly kind: "stale"; readonly canonicalHash: string }
  | { readonly kind: "slot-missing"; readonly canonicalHash: string }
  | { readonly kind: "carrier"; readonly text: string; readonly canonicalHash: string };

/**
 * A SLOT PATCH WRITES NO CARRIER BY HAND: it edits the slot's own record in a copy of the family and lets the one recompose
 * (`expandMemeRefs`) frame the whole carrier, which mints the block check over the bytes it frames. The caller lands that text
 * through the put's own gate under the same base, so a patch passes every law a put passes and reseals as a put does.
 *
 * The body a slot carries spans its record's text and its `$preamble` / `$postamble` carriage (the text before its meta, and
 * the text after its last child). `append` adds to the body's end: the postamble where one stands, the slot's text otherwise.
 * `replace` swaps the whole body: the slot's text takes the new bytes and both carriages leave; a child slot the new body
 * does not call leaves with the put's consequence. The slot's fields (its meta) and its authored delimiters stay.
 */
export async function patchSlotCarrier(input: SlotPatchInput, sink: Pick<MemeSink, "titles" | "read">): Promise<SlotPatchReading> {
  const hash = input.hash ?? defaultHash;
  const { view, records } = await familySnapshot(input.uri, sink);
  const group = familyGroup(view, input.uri);
  if (!group.includes(input.uri)) return { kind: "absent" };
  const reader = (map: ReadonlyMap<string, TiddlerFields>) => (title: string): TiddlerFields | undefined => map.get(title);
  const canonicalHash = hash(expandMemeRefs(reader(records), input.uri) ?? heldText(records.get(input.uri)));
  if (input.baseHash !== canonicalHash) return { kind: "stale", canonicalHash };
  const title = `${rootAddressOf(input.uri)}${input.slot}`;
  const slot = records.get(title);
  if (!slot || !group.includes(title) || slot["$slot"] !== input.slot) return { kind: "slot-missing", canonicalHash };
  const next = new Map(records);
  const addition = input.text.replace(/^\n+/, "").replace(/\s+$/, "");
  const pre = carriageUri(title, "preamble");
  const post = carriageUri(title, "postamble");
  if (input.mode === "replace") {
    next.set(title, { ...slot, text: addition });
    next.delete(pre);
    next.delete(post);
  } else {
    const tail = next.get(post);
    const into = tail && typeof tail.text === "string" && tail.text.trim() !== "" ? post : title;
    const held = next.get(into)!;
    const standing = typeof held.text === "string" ? held.text.replace(/\s+$/, "") : "";
    next.set(into, { ...held, text: standing === "" ? addition : `${standing}\n\n${addition}` });
  }
  const text = expandMemeRefs(reader(next), input.uri);
  if (text === null) return { kind: "slot-missing", canonicalHash };
  return { kind: "carrier", text, canonicalHash };
}

/** The read half: the whole meme as text (children recomposed inline) and the canonical hash a
 *  writer hands back as its base. `null` when the sink holds no record under the URI. */
export async function readMeme(
  uri: string, sink: Pick<MemeSink, "titles" | "read">, hash: (text: string) => string = defaultHash,
): Promise<{ text: string; canonicalHash: string } | null> {
  const { group, text } = await currentRender(uri, sink);
  if (!group.includes(uri)) return null;
  return { text, canonicalHash: hash(text) };
}

/**
 * THE REMOVAL — the meme's whole FAMILY (the root and its component slots) leaves through the sink, as ONE
 * change where the sink carries one (`tombstoneFamily`). A `uri/path` title stands as its own meme: the
 * removal leaves it and the consequence names it. The same base law as a placement: a `baseHash` that fails
 * to match the standing render answers `conflict` and removes nothing. `absent` when no root stands under
 * the URI. The answer carries the `consequence` the removal read, so a caller sees what it left behind.
 */
export async function removeMeme(
  input: { readonly uri: string; readonly baseHash?: string | null; readonly hash?: (text: string) => string },
  sink: MemeSink,
): Promise<{ decision: "removed" | "absent" | "conflict"; tombstoned: readonly string[]; retracted?: readonly string[]; canonicalHash?: string; consequence?: Consequence }> {
  const hash = input.hash ?? defaultHash;
  const { group, text, view } = await currentRender(input.uri, sink);
  if (!group.includes(input.uri)) return { decision: "absent", tombstoned: [] };
  const canonicalHash = hash(text);
  if (input.baseHash && input.baseHash !== canonicalHash) return { decision: "conflict", tombstoned: [], canonicalHash };
  const read = consequence(view, { kind: "delete", title: input.uri });
  const leaving = tombstonesOf(read);
  // A KĀPAE ONLY WHERE A LOWER LAYER WOULD SURFACE (operator ruling 2026-11-20): over nothing beneath the family retracts plainly.
  if (sink.beneath && sink.leaveFamily) {
    const tombstoned: string[] = [];
    const retracted: string[] = [];
    for (const title of leaving) ((await sink.beneath(title)) ? tombstoned : retracted).push(title);
    await sink.leaveFamily(tombstoned, retracted);
    return { decision: "removed", tombstoned, retracted, canonicalHash, consequence: read };
  }
  const tombstoned = leaving;
  if (sink.tombstoneFamily) await sink.tombstoneFamily(tombstoned);
  else for (const title of tombstoned) await sink.tombstone(title);
  return { decision: "removed", tombstoned, canonicalHash, consequence: read };
}

/**
 * THE ROOT LAW, one spelling. A root reads as a record of the carrier type with no `#` in its title and
 * no `$fragment-parent`; a slot child carries the parent, a carriage part carries a `$`-opening `$slot`,
 * and a plain tiddler carries neither the type nor the parent. The listing reads it, and so does the
 * native delete door — a second spelling of it would drift the day one of them moved.
 */
export function isMemeRoot(title: string, fields: TiddlerFields | undefined): boolean {
  return isFamilyRoot(title, fields);
}

/** One slot of a listed meme's tree: the slot name, the record's title, the slots it holds. */
export interface MemeSlotNode {
  readonly slot: string;
  readonly uri: string;
  readonly slots: readonly MemeSlotNode[];
}

/** One listed meme: its root URI, the hash a writer hands back as its base, the slot tree on request. */
export interface MemeListing {
  readonly uri: string;
  readonly canonicalHash: string;
  readonly slots?: readonly MemeSlotNode[];
}

/**
 * THE LISTING — every meme ROOT the sink holds, with the canonical hash a writer hands back as its base;
 * `tree` nests each root's `uri#/slot` children beneath it, at their own depth.
 *
 * A root reads as a record of the carrier type with no `$fragment-parent` and no `#` in its title. A
 * slot child carries `$fragment-parent`; a carriage part (`$preamble` · `$postamble`) carries a `$slot`
 * that opens with `$`; a plain tiddler carries neither the type nor the parent. None of those lists as a
 * root, and a slot nests under the parent its own record names — never under a neighbour whose title it
 * merely extends. Roots answer in title order.
 */
export async function listMemes(
  sink: Pick<MemeSink, "titles" | "read">, opts: { readonly tree?: boolean } = {}, hash: (text: string) => string = defaultHash,
): Promise<MemeListing[]> {
  return (await listMemePage(sink, opts, hash)).roots;
}

/** One page of a listing: the roots it carries, and the cursor the next page takes (null where none remains). */
export interface MemeListPage {
  readonly roots: MemeListing[];
  /** The last root this page names where more roots stand behind it; a caller hands it back as `after`. */
  readonly next: string | null;
}

/**
 * THE LISTING, ONE PAGE AT A TIME. Roots answer in title order, so a root's own URI serves as the cursor:
 * `after` names the last root a caller read, `limit` bounds the page, and `next` names the cursor of the
 * page behind it. With neither, the page holds every root (`listMemes`). A door whose answer rides a
 * bounded channel pages here, so a seat that holds more roots than one answer carries still names each.
 *
 * The sink's titles get read once for the whole page. A root's title carries no `#`, so the root law reads
 * the records under such titles alone; a page then reads the groups of the roots it names and no other.
 */
export async function listMemePage(
  sink: Pick<MemeSink, "titles" | "read">,
  opts: { readonly tree?: boolean; readonly after?: string | null; readonly limit?: number } = {},
  hash: (text: string) => string = defaultHash,
): Promise<MemeListPage> {
  const titles = [...await sink.titles()].sort();
  const once: Pick<MemeSink, "titles" | "read"> = { titles: () => titles, read: (title) => sink.read(title) };
  const after = opts.after ?? null;
  const limit = opts.limit !== undefined && opts.limit > 0 ? opts.limit : Infinity;
  const roots: MemeListing[] = [];
  let next: string | null = null;
  for (const uri of titles) {
    if (uri.includes("#") || (after !== null && uri <= after)) continue;
    if (!isMemeRoot(uri, await sink.read(uri))) continue;
    if (roots.length >= limit) { next = roots[roots.length - 1]!.uri; break; }
    const listed = await listOneMeme(uri, once, opts.tree === true, hash);
    if (listed) roots.push(listed);
  }
  return { roots, next };
}

/**
 * One root as a listing answers it: its URI, the hash of its present render, and on request its slot tree.
 * A slot nests under the parent its own record names, so the tree reads the root's group and nothing else.
 * Null where the sink holds no record under the URI.
 */
export async function listOneMeme(
  uri: string, sink: Pick<MemeSink, "titles" | "read">, tree: boolean, hash: (text: string) => string = defaultHash,
): Promise<MemeListing | null> {
  const meme = await readMeme(uri, sink, hash);
  if (!meme) return null;
  if (!tree) return { uri, canonicalHash: meme.canonicalHash };
  const fields = new Map<string, TiddlerFields>();
  const slotPrefix = `${rootAddressOf(uri)}#`;
  for (const title of await sink.titles()) {
    if (title !== uri && !title.startsWith(slotPrefix)) continue;
    const f = await sink.read(title);
    if (f && f["type"] === CARRIER_TYPE) fields.set(title, f);
  }
  const childrenOf = (parent: string): MemeSlotNode[] =>
    [...fields.entries()]
      .filter(([, f]) => f["$fragment-parent"] === parent && typeof f["$slot"] === "string" && !String(f["$slot"]).startsWith("$"))
      .map(([title, f]) => ({ slot: String(f["$slot"]), uri: title, slots: childrenOf(title) }));
  return { uri, canonicalHash: meme.canonicalHash, slots: childrenOf(uri) };
}

/** The `$tw.wiki` skin — a live wiki, on the plain server or inside the island. Its rail is the wiki's
 *  own alerts area. */
export function wikiMemeSink(wiki: Pick<TW5Wiki, "allTitles" | "getTiddler" | "addTiddler" | "deleteTiddler">): MemeSink {
  return {
    titles: () => wiki.allTitles(),
    read: (title) => (wiki.getTiddler(title) as { fields?: TiddlerFields } | undefined)?.fields,
    land: (fields) => { wiki.addTiddler(fields as Record<string, unknown>); },
    tombstone: (title) => { wiki.deleteTiddler(title); },
    surface: (root, finding) => { surfaceMemeAlert(wiki, root, finding); },
  };
}
