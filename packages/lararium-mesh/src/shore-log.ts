/**
 * shore-log — THE VESSEL'S LOG AS RECORDS: one record per distinct event, never one per line.
 *
 * A vessel's console speaks in tagged lines (`[sealed-rest] save-unsealed (…): 3xY…`, `[faces] …`, `[shore] kept the disk: …`).
 * A storm repeats one line thousands of times, and a flat log buries the one line that differs. The sink reads each line once,
 * names its EVENT (the kind its tag and refusal word carry, the subject its document id, `lar:` URI or face handle names), and
 * folds it into that event's one record: the count climbs, the last line replaces the one before it (redacted under the strict
 * secret-shape guard), and the record's last seq moves. Nothing writes per line; a flush writes each record that changed, once.
 *
 * THE RING BOUNDS A BOOT. A boot holds at most `capacity` records; a new event past it evicts the record touched longest ago
 * and counts the eviction on the ring's own record (`shore-log/evicted`), so a storm of distinct subjects stands bounded too.
 *
 * THE SEQ ORDERS, THE CLOCK ANNOTATES. Each line takes the next seq this ring mints (`first-seq`, `last-seq`): order reads off
 * the seq alone. `first-at` / `last-at` ride beside as annotation, never a key, never an order (an attacker owns the clock).
 *
 * Pure: no substrate import. The node vessel taps its streams into it (`vessel-log-sink`), the daemon island writes its records
 * into the worn face's daemon temp layer, and `lares shore log` reads them back (or the flat `run/vessel-live.log` fallback).
 *
 * Meme: lar:///ha.ka.ba/lararium/api/disk-projection
 */

import { redactSecretShapes } from "./secret-shapes.js";

/** Where each event's record rests: one title per key, in the daemon wiki's temp layer. */
export const SHORE_LOG_PREFIX = "$:/lares/shore/log/event/";
/** The month's ash a folded record lands in (`$:/lares/shore/log/ash/<YYYY-MM>`). */
export const SHORE_LOG_ASH_PREFIX = "$:/lares/shore/log/ash/";
/** The tag every event record carries, so the shore page lists them by tag as by prefix. */
export const SHORE_LOG_TAG = "$:/tags/lares/shore/log";
/** The longest line a record keeps, after redaction. */
export const SHORE_LOG_LINE_MAX = 1000;
/** The ring's default bound: distinct events one boot holds. */
export const SHORE_LOG_CAPACITY = 512;
/** The kind the ring's own eviction count rides under. */
export const SHORE_LOG_EVICTED_KIND = "shore-log/evicted";

export type ShoreLogSeverity = "info" | "warn" | "error";
export type ShoreLogStream = "stdout" | "stderr";

/** One distinct event's record. */
export interface ShoreLogRecord {
  /** `kind` + subject, folded to a title-safe slug. */
  readonly key: string;
  readonly kind: string;
  /** The document id, `lar:` URI or face handle the line names; empty where it names none. */
  readonly subject: string;
  readonly severity: ShoreLogSeverity;
  readonly count: number;
  readonly firstSeq: number;
  readonly lastSeq: number;
  /** The last line, redacted under the strict guard and bounded. */
  readonly line: string;
  /** The boot this ring belongs to. */
  readonly boot: string;
  /** Annotation alone: the wall clock at the first and last line. */
  readonly firstAt: string;
  readonly lastAt: string;
}

/** What a line names: its event's kind, subject and severity. */
export interface ShoreLogEvent {
  readonly kind: string;
  readonly subject: string;
  readonly severity: ShoreLogSeverity;
}

// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g;
const TAG = /^\s*\[([A-Za-z][A-Za-z0-9 _.:-]{0,40})\]\s*(.*)$/;
/** A refusal word: a hyphen-joined lower-case code (`save-unsealed`, `face-not-open`). */
const CODE = /\b([a-z][a-z0-9]*(?:-[a-z0-9]+)+)\b/;
/** A subject the line names, most specific first: a `lar:` URI, an elided document id (`3xYq…`), a face handle (`h2`). */
const SUBJECT_URI = /\blar:\/\/[^\s)(,;'"`]+/;
const SUBJECT_DOC = /\b([1-9A-HJ-NP-Za-km-z]{6,}|[0-9a-f]{8,})…/;
const SUBJECT_FACE = /\bface h([0-9]+)\b/;
const ERROR_WORDS = /\b(fatal|error|failed|fails|refused|refuses|threw|crash(?:ed)?|lost)\b/i;
const WARN_WORDS = /\b(warn(?:ing)?|waits?|held|unsealed|skips?|stall(?:ed|s)?|dropped|unwritten|past its)\b/i;

/** The line with its terminal colour codes dropped and its ends trimmed. */
export function plainLine(raw: string): string {
  return raw.replace(ANSI, "").replace(/\s+$/, "").replace(/^\s+/, "");
}

/** The line redacted under the STRICT secret-shape guard (no fixtures stand, bare minted hex and every key block taken), bounded. */
export function redactLogLine(line: string): string {
  const { text } = redactSecretShapes(line, { allow: [], mintedHex: true, everyKeyBlock: true });
  return text.length > SHORE_LOG_LINE_MAX ? `${text.slice(0, SHORE_LOG_LINE_MAX - 1)}…` : text;
}

/** The words a message opens with, numbers and subjects dropped: an untagged line's or a codeless line's shape. */
function shapeOf(message: string): string {
  const words = message
    .replace(SUBJECT_URI, " ").replace(SUBJECT_DOC, " ")
    .toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 1).slice(0, 3);
  return words.length === 0 ? "line" : words.join("-");
}

/**
 * WHAT A LINE NAMES: its kind (`<tag>/<code>`, the tag and the refusal word it carries, else the tag and the shape its first
 * words make), its subject and its severity. A blank line names nothing. A line on stderr reads at least `warn`.
 */
export function classifyLogLine(raw: string, stream: ShoreLogStream = "stdout"): ShoreLogEvent | null {
  const line = plainLine(raw);
  if (line === "") return null;
  const tagged = TAG.exec(line);
  const tag = tagged ? tagged[1]!.trim().toLowerCase().replace(/\s+/g, "-") : "untagged";
  const message = tagged ? tagged[2]! : line;
  const code = CODE.exec(message.replace(SUBJECT_URI, " "))?.[1];
  const kind = `${tag}/${code ?? shapeOf(message)}`;
  const subject = SUBJECT_URI.exec(message)?.[0] ?? SUBJECT_DOC.exec(message)?.[1] ?? (SUBJECT_FACE.exec(message) ? `h${SUBJECT_FACE.exec(message)![1]}` : "");
  const severity: ShoreLogSeverity = ERROR_WORDS.test(message) ? "error" : WARN_WORDS.test(message) || stream === "stderr" ? "warn" : "info";
  return { kind, subject, severity };
}

/** FNV-1a 32 over a string, as eight hex digits: a key's stable short tail. */
function fnv32(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0");
}

/** An event's key: kind and subject as one title-safe slug, with a hash tail so two subjects that fold alike stay apart. */
export function shoreLogKey(kind: string, subject: string): string {
  const slug = (s: string, max: number): string => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, max);
  const head = [slug(kind, 48), slug(subject, 24)].filter((p) => p !== "").join("--");
  return `${head}--${fnv32(`${kind}\u0000${subject}`)}`;
}

/** The record's title in the temp layer. */
export const shoreLogTitle = (key: string): string => `${SHORE_LOG_PREFIX}${key}`;

/** A record as tiddler fields: every value a string, as the wiki keeps them. */
export function shoreLogFields(rec: ShoreLogRecord): Record<string, string> {
  return {
    title: shoreLogTitle(rec.key),
    tags: `[[${SHORE_LOG_TAG}]]`,
    type: "text/plain",
    text: rec.line,
    "shore-key": rec.key,
    kind: rec.kind,
    subject: rec.subject,
    severity: rec.severity,
    count: String(rec.count),
    "first-seq": String(rec.firstSeq),
    "last-seq": String(rec.lastSeq),
    boot: rec.boot,
    "first-at": rec.firstAt,
    "last-at": rec.lastAt,
  };
}

const wholeOf = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && /^[0-9]+$/.test(v) ? Number(v) : NaN;
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
};
const SEVERITIES: ReadonlySet<string> = new Set(["info", "warn", "error"]);

/** A record read back from its tiddler fields (or a live-log JSON object); null where a field reads malformed. */
export function shoreLogRecordOf(fields: Readonly<Record<string, unknown>>): (ShoreLogRecord & { readonly ack: number | null }) | null {
  const key = fields["shore-key"] ?? fields["key"];
  const kind = fields["kind"], severity = fields["severity"], boot = fields["boot"];
  const count = wholeOf(fields["count"]), firstSeq = wholeOf(fields["first-seq"] ?? fields["firstSeq"]), lastSeq = wholeOf(fields["last-seq"] ?? fields["lastSeq"]);
  if (typeof key !== "string" || key === "" || typeof kind !== "string" || typeof boot !== "string") return null;
  if (typeof severity !== "string" || !SEVERITIES.has(severity) || count === null || firstSeq === null || lastSeq === null) return null;
  const str = (v: unknown): string => (typeof v === "string" ? v : "");
  const ackRaw = fields["ack"];
  return {
    key, kind, subject: str(fields["subject"]), severity: severity as ShoreLogSeverity, count, firstSeq, lastSeq,
    line: str(fields["line"] ?? fields["text"]), boot, firstAt: str(fields["first-at"] ?? fields["firstAt"]), lastAt: str(fields["last-at"] ?? fields["lastAt"]),
    ack: ackRaw === undefined || ackRaw === "" ? null : wholeOf(ackRaw),
  };
}

/** Held: never acknowledged, or the event recurred past the seq its ack named. */
export const shoreLogHeld = (rec: { readonly lastSeq: number; readonly ack: number | null }): boolean => rec.ack === null || rec.ack < rec.lastSeq;

/** One live-log line: the record as one JSON object. */
export function shoreLogJsonLine(rec: ShoreLogRecord): string {
  return JSON.stringify({ key: rec.key, kind: rec.kind, subject: rec.subject, severity: rec.severity, count: rec.count, firstSeq: rec.firstSeq, lastSeq: rec.lastSeq, line: rec.line, boot: rec.boot, firstAt: rec.firstAt, lastAt: rec.lastAt });
}

/**
 * THE CLOSING SLICE of a live log: each key's last line, in the order each last changed (one record per event). A line that
 * reads malformed is skipped, never fatal: the flat fallback reads what it can.
 */
export function closingSlice(lines: Iterable<string>): ShoreLogRecord[] {
  const last = new Map<string, ShoreLogRecord>();
  for (const raw of lines) {
    if (raw.trim() === "") continue;
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { continue; }
    if (parsed === null || typeof parsed !== "object") continue;
    const rec = shoreLogRecordOf(parsed as Record<string, unknown>);
    if (rec === null) continue;
    const { ack: _ack, ...bare } = rec;
    last.delete(`${bare.boot}\u0000${bare.key}`);
    last.set(`${bare.boot}\u0000${bare.key}`, bare);
  }
  return [...last.values()];
}

/** The ring's options. */
export interface ShoreLogRingOptions {
  readonly boot: string;
  readonly capacity?: number;
  /** The annotation clock; never an order. */
  readonly now?: () => string;
}

/**
 * THE RING: one boot's records, collapsed at the source. `take` folds one line into its event's record in O(1) and marks
 * it changed; `drainChanged` hands back each changed record once (a flush's batch); `records` reads the whole ring.
 */
export class ShoreLogRing {
  readonly boot: string;
  readonly capacity: number;
  readonly #now: () => string;
  /** Insertion order = touch order: a take re-inserts its key, so the first key stands touched longest ago. */
  readonly #records = new Map<string, ShoreLogRecord>();
  readonly #changed = new Set<string>();
  #seq = 0;
  #evicted = 0;

  constructor(opts: ShoreLogRingOptions) {
    this.boot = opts.boot;
    this.capacity = Math.max(2, opts.capacity ?? SHORE_LOG_CAPACITY);
    this.#now = opts.now ?? (() => new Date().toISOString());
  }

  /** The last seq this ring minted. */
  get seq(): number { return this.#seq; }
  /** How many records the bound evicted this boot. */
  get evicted(): number { return this.#evicted; }

  /** Fold one line into its event's record; the record it moved, or null for a blank line. */
  take(raw: string, stream: ShoreLogStream = "stdout"): ShoreLogRecord | null {
    const event = classifyLogLine(raw, stream);
    if (event === null) return null;
    return this.#fold(event, redactLogLine(plainLine(raw)));
  }

  #fold(event: ShoreLogEvent, line: string, bound = true): ShoreLogRecord {
    const key = shoreLogKey(event.kind, event.subject);
    const seq = ++this.#seq;
    const at = this.#now();
    const prior = this.#records.get(key);
    const rec: ShoreLogRecord = prior
      ? { ...prior, count: prior.count + 1, lastSeq: seq, line, lastAt: at, severity: rank(event.severity) > rank(prior.severity) ? event.severity : prior.severity }
      : { key, kind: event.kind, subject: event.subject, severity: event.severity, count: 1, firstSeq: seq, lastSeq: seq, line, boot: this.boot, firstAt: at, lastAt: at };
    this.#records.delete(key);
    this.#records.set(key, rec);
    this.#changed.add(key);
    if (!prior && bound) this.#bound(key);
    return rec;
  }

  /** Past the bound, the record touched longest ago leaves (never the ring's own eviction record, never the fresh one), and
   *  the eviction counts on the ring's own record, which itself stands inside the bound. */
  #bound(fresh: string): void {
    const evictedKey = shoreLogKey(SHORE_LOG_EVICTED_KIND, "");
    let letGo = 0;
    const over = (): number => this.#records.size + (letGo > 0 && !this.#records.has(evictedKey) ? 1 : 0) - this.capacity;
    while (over() > 0) {
      const oldest = [...this.#records.keys()].find((k) => k !== evictedKey && k !== fresh);
      if (oldest === undefined) break;
      this.#records.delete(oldest);
      this.#changed.delete(oldest);
      letGo++;
    }
    if (letGo === 0) return;
    this.#evicted += letGo;
    this.#fold({ kind: SHORE_LOG_EVICTED_KIND, subject: "", severity: "warn" }, `the ring (bound ${this.capacity}) let ${this.#evicted} record(s) go this boot; the oldest touched leaves first`, false);
  }

  /** Each record that changed since the last drain, once, in touch order. */
  drainChanged(): ShoreLogRecord[] {
    const out: ShoreLogRecord[] = [];
    for (const [key, rec] of this.#records) if (this.#changed.has(key)) out.push(rec);
    this.#changed.clear();
    return out;
  }

  /** The whole ring, in touch order. */
  records(): ShoreLogRecord[] { return [...this.#records.values()]; }
}

const rank = (s: ShoreLogSeverity): number => (s === "error" ? 2 : s === "warn" ? 1 : 0);

/** A record as the island writes it: its title and string fields. */
export interface ShoreLogPlacement {
  readonly title: string;
  readonly fields: Record<string, string>;
}

/** The records as placements, the batch `daemon:shore-log` carries. */
export const shoreLogPlacements = (records: readonly ShoreLogRecord[]): ShoreLogPlacement[] =>
  records.map((rec) => ({ title: shoreLogTitle(rec.key), fields: shoreLogFields(rec) }));

/** Whether a placement reads whole: a title under the prefix, its fields all strings, its own title among them. */
export function readShoreLogPlacement(v: unknown): ShoreLogPlacement | null {
  if (v === null || typeof v !== "object") return null;
  const { title, fields } = v as { title?: unknown; fields?: unknown };
  if (typeof title !== "string" || !title.startsWith(SHORE_LOG_PREFIX) || fields === null || typeof fields !== "object") return null;
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(fields as Record<string, unknown>)) { if (typeof val !== "string") return null; out[k] = val; }
  if (out["title"] !== title || shoreLogRecordOf(out) === null) return null;
  return { title, fields: out };
}
