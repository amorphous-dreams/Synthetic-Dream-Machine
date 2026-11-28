/**
 * stream-entries — ONE ENTITY, MANY STREAMS, ONE LOG GRAPH (lar:///ha.ka.ba/kahua/memory/course/comms-ux-enacts landings 14 and
 * 15; the model's #/msg and #/streams slots, lar:///ha.ka.ba/kahua/memory/draft/comms-ux).
 *
 * A stream holds one body's log, named `<pet>#<n>` (`lares-alpha#00003`). Its root record stands at
 * `lar:///ha.ka.ba/kahua/memory/stream/<pet>-<n>` and names the stream's seat, face, model and mandate; each entry lands as one
 * record at `<root>-<h8>-<slug>`, where `h8` reads the first eight hex of the SHA-256 over the entry's birth fields and never
 * recomputes, so an edit of its note keeps its title. The `#` of `pet#n` stays out of titles (it marks a slot); the `stream`
 * and `to` fields carry `pet#n` whole. Every title holds four path segments past the root (`kahua/memory/stream/<x>`), the
 * seed's URI anatomy, and reads as a two-segment stage path (`stream/<x>`), the stage meme law.
 *
 * TWO EDGES, NEVER ONE. `prev` names the one entry before it in its own stream; `re` names zero or more entries it answers or
 * braids, in any stream. A stream's HEAD reads as an entry no other entry of that stream names as `prev`: no clock and no
 * `modified` sort decides it, so two writers on one stream leave two heads, a fork the next writer names.
 *
 * SEEN, WITHOUT FLAGS OR CLOCKS. An entry addressed to a stream counts as seen once an entry of the reading stream names it
 * directly in `re` (direct, never transitive). `to` names an entity (`lares-alpha`) or one instance (`lares-alpha#00003`); an
 * instance's inbox reads both, and an entity's inbox reads every instance of it. The inbox reads over the reader's view alone,
 * so an entry behind another face's wall never counts.
 *
 * A LEAF: pure over the records a caller hands it. The filter operators (`filters/stream`: `[lares.heads[]]`, `[lares.inbox[]]`)
 * and the msg door (`msg-verbs`) read the same law here.
 *
 * Meme: lar:///ha.ka.ba/lares/afford/engine.msg.lands
 */
import { parseTitleList } from "@lararium/mesh/carrier-form";

/** Where every stream's records stand: the stream class of the memory stage. */
export const STREAM_STAGE = "lar:///ha.ka.ba/kahua/memory/stream/";

/** The longest note an entry carries, in characters: one line, the role law. */
export const NOTE_MAX = 72;

/** One segment of a name: lowercase letters and digits, hyphen-joined (the stage path segment). */
const SEGMENT = "[a-z0-9]+(?:-[a-z0-9]+)*";
const STREAM_NAME = new RegExp(`^(${SEGMENT})#([a-z0-9]+)$`);
const ENTITY_NAME = new RegExp(`^${SEGMENT}$`);

/** A stream's name read: its entity (the pet name) and its instance. Null where the name reads no `pet#n`. */
export function readStream(raw: string): { readonly pet: string; readonly n: string } | null {
  const match = STREAM_NAME.exec(raw.trim());
  return match === null ? null : { pet: match[1]!, n: match[2]! };
}

/** True where a `to` names an entity (`lares-alpha`) or one instance (`lares-alpha#00003`). */
export const isAddress = (raw: string): boolean => ENTITY_NAME.test(raw) || STREAM_NAME.test(raw);

/** The entity a stream or an address names: the pet name before any `#`. */
export const entityOf = (name: string): string => name.split("#")[0]!;

/** A stream's root record title: `lar:///ha.ka.ba/kahua/memory/stream/<pet>-<n>`. */
export function streamRootOf(stream: string): string {
  const read = readStream(stream);
  if (read === null) throw new Error(`stream-malformed: "${stream}" reads no <pet>#<n> name`);
  return `${STREAM_STAGE}${read.pet}-${read.n}`;
}

/** An entry's slug: lowercase words, hyphen-joined, the first few of the source (a given slug, or the note), never empty. */
export function slugOf(source: string): string {
  const words = source.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean).slice(0, 6);
  let slug = "";
  for (const word of words) {
    const next = slug === "" ? word : `${slug}-${word}`;
    if (next.length > 48) break;
    slug = next;
  }
  return slug === "" ? "msg" : slug;
}

/** An entry's title: the stream root, its birth hash's first eight hex, its slug. */
export const entryTitleOf = (stream: string, h8: string, slug: string): string => `${streamRootOf(stream)}-${h8}-${slug}`;

/** The fault a note carries, or null where it lands: one line, `NOTE_MAX` characters or fewer, never blank. */
export function noteFault(note: string): "note-needed" | "note-one-line" | "note-too-long" | null {
  if (note.trim() === "") return "note-needed";
  if (/[\r\n]/.test(note)) return "note-one-line";
  return [...note].length > NOTE_MAX ? "note-too-long" : null;
}

/** One entry as the log graph reads it. */
export interface StreamEntry {
  readonly title: string;
  readonly stream: string;
  readonly prev: string | null;
  readonly re: readonly string[];
  readonly to: string | null;
}

const fieldText = (value: unknown): string => (typeof value === "string" ? value : Array.isArray(value) ? value.map(String).join(" ") : "");

/**
 * An entry read off one record's fields, or null where the record stands as no entry: an entry carries a `stream` and a
 * `note`. A stream's root carries a `stream` and no `note`, so it never reads as an entry.
 */
export function entryOf(title: string, fields: Readonly<Record<string, unknown>> | undefined): StreamEntry | null {
  if (fields === undefined) return null;
  const stream = fieldText(fields["stream"]).trim();
  if (stream === "" || fieldText(fields["note"]).trim() === "") return null;
  const prev = fieldText(fields["prev"]).trim();
  const to = fieldText(fields["to"]).trim();
  const re = Array.isArray(fields["re"]) ? (fields["re"] as unknown[]).map(String) : [...(parseTitleList(fieldText(fields["re"])) ?? [])];
  return { title, stream, prev: prev === "" ? null : prev, re, to: to === "" ? null : to };
}

/** The titles a record names in `re`, entry or not: a hand-back's `re` may name a mandate. */
export const reOf = (fields: Readonly<Record<string, unknown>> | undefined): readonly string[] =>
  fields === undefined ? [] : Array.isArray(fields["re"]) ? (fields["re"] as unknown[]).map(String) : [...(parseTitleList(fieldText(fields["re"])) ?? [])];

/**
 * THE HEADS: each entry of `candidates` that no entry of its own stream (among `all`) names as `prev`, ordered by stream, then
 * title. `stream` narrows to one stream's heads; absent, every stream's.
 */
export function headsOf(candidates: readonly StreamEntry[], all: readonly StreamEntry[], stream?: string | null): string[] {
  const named = new Set<string>();
  for (const entry of all) if (entry.prev !== null) named.add(`${entry.stream}\u0000${entry.prev}`);
  return candidates
    .filter((entry) => (stream ? entry.stream === stream : true) && !named.has(`${entry.stream}\u0000${entry.title}`))
    .sort((a, b) => (a.stream === b.stream ? (a.title < b.title ? -1 : a.title > b.title ? 1 : 0) : a.stream < b.stream ? -1 : 1))
    .map((entry) => entry.title);
}

/** True where an entry's `to` reaches the reader `me` (an instance reads its own and its entity's; an entity reads every instance's). */
export function addressedTo(to: string | null, me: string): boolean {
  if (to === null) return false;
  if (me.includes("#")) return to === me || to === entityOf(me);
  return to === me || entityOf(to) === me;
}

/** True where a stream writes as the reader `me` (an instance its own stream alone; an entity every instance of it). */
export function writesAs(stream: string, me: string): boolean {
  return me.includes("#") ? stream === me : entityOf(stream) === me;
}

/**
 * THE INBOX: each entry of `candidates` addressed to `me` that no entry the reader writes (among `all`) names directly in `re`,
 * ordered by title. The shape `[field:to<me>] :except[field:stream<me>get[re]enlist-input[]]`, widened to entity and instance.
 */
export function inboxOf(candidates: readonly StreamEntry[], all: readonly StreamEntry[], me: string): string[] {
  const seen = new Set<string>();
  for (const entry of all) if (writesAs(entry.stream, me)) for (const title of entry.re) seen.add(title);
  return candidates.filter((entry) => addressedTo(entry.to, me) && !seen.has(entry.title)).map((entry) => entry.title).sort();
}

/** The tag `hum` leaves on each entry it folds into a shrine: the entry stays, and o-takiage may sweep it (comms-ux-enacts landing 17). */
export const ASH_READY = "ash-ready";

/** True where some entry a reader of `to` writes names `entry` directly in `re`: an addressed entry read as seen. */
function seenBy(entry: StreamEntry, all: readonly StreamEntry[]): boolean {
  if (entry.to === null) return true;
  return all.some((other) => writesAs(other.stream, entry.to!) && other.re.includes(entry.title));
}

/**
 * THE SETTLED ENTRIES (`hum`'s fold, comms-ux-enacts landing 17): each entry of `candidates` that a stream written as `me`
 * holds, that stands as no head of its stream, that its addressee has seen (an entry with no `to` needs no reader), and that no
 * unseen entry still answers (names it in `re`). A head stays out: the stream's next entry follows it. Ordered by title. No clock
 * decides; the same records answer the same set.
 */
export function settledOf(candidates: readonly StreamEntry[], all: readonly StreamEntry[], me: string): string[] {
  const heads = new Set(headsOf(all, all));
  return candidates
    .filter((entry) => writesAs(entry.stream, me) && !heads.has(entry.title) && seenBy(entry, all))
    .filter((entry) => !all.some((other) => other.re.includes(entry.title) && !seenBy(other, all)))
    .map((entry) => entry.title)
    .sort();
}
