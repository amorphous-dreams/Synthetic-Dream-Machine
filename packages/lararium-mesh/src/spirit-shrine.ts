/**
 * spirit-shrine — THE SPIRIT DOOR'S PURE CORE: a familiar's record by its pet name, read and shaped without a door.
 *
 * `lares spirit <om | ah | hum | hooili | residue | otakiage>` (lares-cli `commands/spirit.ts`) carries the host's half: the
 * door calls, the file and stdin reads, the clock, the hand gate and the render. Everything that needs no I/O stands here,
 * so a reactor inside the island answers the same as the host loop: the addresses and defaults, the slot parse and its
 * digest, the record shaped from what the doors answer, the card's text under the wake cap, the carry read as testimony,
 * the waking caps and the advisory weight, the strict secret-shape guard, the conflict stanza and the fold by content,
 * the presence, wake epoch and crossing merges on the card's sibling record (bunrei: many bodies wear one pet, none locks
 * another out), and the shapes a carry, a handback and an ash line land in.
 *
 * THE CLOCK SEAM. The core reads no clock and no env: every function that dates or ages a line takes the caller's `now`
 * (a `Date`, or its epoch milliseconds). The digest rides the house's sync sha256 (`sha256HexSync`), never `node:crypto`.
 *
 * Platform-blind and pure.
 *
 * Meme: lar:///ha.ka.ba/kahua/memory/wave/spirit-om-ah-hum · research: lar:///ha.ka.ba/kahua/memory/research/into-the-vm
 */

import { sha256HexSync, utf8Bytes } from "./crypto.js";
import { redactSecretShapes } from "./secret-shapes.js";
import { handRefusalOf, type HandRefusalCode } from "./hand-refusal.js";

// ── THE CARRY'S WORDS ─────────────────────────────────────────────────────────────────────────────────────────────
/**
 * THE WORDS A SPIRIT'S CARRY TAKES, IN ONE PLACE: each name rides as a pair, its command spelling (ASCII: the `lares spirit`
 * verb, the stage address `<word>/<pet>-<hash12>`) and its display spelling (the full grammar people read: the heading the
 * compaction asks the summary to end on, the #/bodies line, om's context, the help). A rename lands here, in the hooks'
 * twin (lares-cli `.claude-plugin/hooks/lares-spirit-core.mjs` `COMPACTION_WORD` · `COMPACTION_DISPLAY`), which a test welds
 * to this one, and in both shims' stream match (`tools/lares-container.sh`, `.ps1`). lares-cli's `spirit-words.ts` carries
 * this pair to the command table.
 *
 * The carry: hoʻoili (ili 3, a responsibility falls upon the next), a compaction's summary handed down under its lineage.
 */
export const COMPACTION_WORD = "hooili" as const;
export const COMPACTION_DISPLAY = "hoʻoili" as const;

// ── THE DEFAULTS AND THE ADDRESSES, IN ONE SPOT ───────────────────────────────────────────────────────────────────
/** The memory stage every record and residue rests on. */
export const MEMORY_PREFIX = "lar:///ha.ka.ba/kahua/memory/";
/** Where a pet name resolves. */
export const RECORD_KINDS = ["familiar", "spirit"] as const;
/** The recipe every spirit act reads and writes: the worn face's memory stage. */
export const SPIRIT_RECIPE = "default";
/**
 * THE CARD'S SIBLING. A card's fields render into its carrier's meta, so a field write moves the canonical hash every slot write
 * checks. What orders bodies (the presence, the wake epoch, each body's crossing, the distill mark, each slot's last writer)
 * rides a plain record beside it, outside the carrier's render, so no wake ever moves the card's base. The card keeps its
 * `spirit-id` alone (minted once) and its budgets.
 */
export const sideOf = (pet: string): string => `${MEMORY_PREFIX}presence/${pet}`;
/** The wake's hard cap: SessionStart shows the model a preview past 10,000 chars, so `om` stays under this. */
export const OM_CAP_CHARS = 9000;
/**
 * THE WAKING SLOTS' BODY CAPS, in bytes: the only refusals the door keeps. `om` prints #/open whole and unfolds the titles
 * #/attention names, so their growth costs the wake's 9000 chars; every other slot rests in the store and reads whole by
 * its door, so it never refuses. A record's `slot-budget` field, where it names one, replaces both caps.
 */
export const WAKING_SLOT_BUDGETS: Readonly<Record<string, number>> = { "#/open": 2048, "#/attention": 1024 };
/** The record's advisory weight, in bytes, where the record names none (`record-budget`): `hum` and `om` name a record past it; nothing refuses. */
export const RECORD_BUDGET_BYTES = 6144;
/** Stops between two true-up nudges, where the record names none (`true-up-every`). */
export const TRUE_UP_EVERY = 25;
/** The longest residue a carry or a handback lands; a longer text lands cut (after the guard reads it whole). */
export const RESIDUE_CAP_CHARS = 60_000;
/** A carry past this depth outranks nothing: its chain remembers only itself. */
export const DEEP_CARRY = 3;
/** At most this many bodies stand in a card's presence, a cap by count and never by age: a clock only sorts siblings, it drops none. */
export const PRESENCE_CAP = 16;
/** The card's #/open and #/kulana, read to the outgoing body at PreCompact, cut here so the carry ask still lands inside 10,000 chars. */
export const PRECOMPACT_CARD_CHARS = 4000;
/** How many titles #/attention names the wake unfolds. */
export const ATTENTION_TITLES = 12;
/** How many times a fold's ash write tries before the line returns to its slot. */
export const ASH_ROUNDS = 3;
/** How many times a write reads again over a record that moved under it before it refuses. */
export const CAS_ROUNDS = 4;
/** A pet name: lower-case letters, digits and hyphens. */
export const PET_NAME = /^[a-z0-9][a-z0-9-]{0,62}$/;
/** A body names itself by its session id. */
export const BODY_ID = /^[A-Za-z0-9_-]{1,128}$/;
/** A slot digest: 16 hex. */
export const SLOT_DIGEST = /^[0-9a-f]{16}$/;
/** The wake sources `om` reads. */
export const SPIRIT_SOURCES = ["startup", "resume", "clear", "compact", "fork", "precompact"] as const;
export type SpiritSource = (typeof SPIRIT_SOURCES)[number];
/** The slot a distilled tell lands in: a write there sets the distill mark otakiage burns behind. */
export const DISTILL_SLOT = "#/kulana";

/** The ash ledger of the month a burn lands in (`state/ashes-YYYY-MM`). */
export function ashLedgerOf(now: Date): string {
  return `${MEMORY_PREFIX}state/ashes-${now.toISOString().slice(0, 7)}`;
}
/** A carry's address: two segments under the stage, the spirit's key and the summary's hash. */
export const compactionTitle = (key: string, hash: string): string => `${MEMORY_PREFIX}${COMPACTION_WORD}/${key}-${hash.slice(0, 12)}`;
/** A handback's address. */
export const residueTitle = (key: string, hash: string): string => `${MEMORY_PREFIX}spirit/${key}-handback-${hash.slice(0, 12)}`;
/** One shell word, single-quoted: what every suggested command wraps a title or a line in. */
export const shq = (word: string): string => `'${word.replace(/'/g, `'\\''`)}'`;
/** The full sha256 hex of a text's UTF-8 bytes: a carry's and a handback's hash. */
export const spiritHash = (text: string): string => sha256HexSync(text);
/** A slot's digest: the first 16 hex of the sha256 of its body, the grain a whole-slot write names as `--base`. */
export const slotDigest = (body: string): string => sha256HexSync(body).slice(0, 16);
/** A text's UTF-8 byte length: the grain every budget measures in. */
export const bytesOf = (text: string): number => utf8Bytes(text).length;
const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** The residue under any of a spirit's keys (its spirit-id, its pet name), by address alone: key `a` never reaches key `a-b`. */
export function residueOf(keys: string | readonly string[], titles: readonly string[]): string[] {
  const all = typeof keys === "string" ? [keys] : keys;
  const res = all.flatMap((key) => [
    new RegExp(`^${escapeRe(`${MEMORY_PREFIX}${COMPACTION_WORD}/${key}-`)}[0-9a-f]{12}$`),
    new RegExp(`^${escapeRe(`${MEMORY_PREFIX}spirit/${key}-handback-`)}[0-9a-f]{12}$`),
  ]);
  return [...new Set(titles.filter((t) => res.some((re) => re.test(t))))];
}
/** Does a title name a carry (and not a handback)? */
export const isCarry = (t: string): boolean => t.startsWith(`${MEMORY_PREFIX}${COMPACTION_WORD}/`);

/** A slot's body as `meme-patch` reads it: the slot text without its `<<~ ahu …>>` frame. */
export function slotBody(slotText: string): string {
  const lines = slotText.replace(/\s+$/, "").split("\n");
  if (/^<<~ ahu\b/.test(lines[0] ?? "")) lines.shift();
  if (/^<<~\/ahu>>$/.test(lines.at(-1) ?? "")) lines.pop();
  return lines.join("\n").replace(/^\n+/, "").replace(/\s+$/, "");
}
/** THE STRICT READING (as the alert door reads, `stay-home.ts`): no fixture stands, bare minted hex and every private-key block go. */
const STRICT = { allow: [], mintedHex: true, everyKeyBlock: true } as const;
/** How many secret shapes a text holds under the strict reading. */
export const secretCount = (text: string): number => redactSecretShapes(text, STRICT).redacted;
/** A text with every strict secret shape redacted: what a ledger line copies out of a record. */
export const redactedText = (text: string): string => redactSecretShapes(text, STRICT).text;

/** The digest a base names, whatever its grain prefix (`skinny:`, `partial:#/x:`). */
export const digestOf = (base: string): string => /sha256[:-][0-9a-f]{64}$/.exec(base)?.[0]?.replace("-", ":") ?? base;

/** A refusal the spirit door names by its code: the message names the cure command, the exit the CLI's code for it. */
export class SpiritRefusal extends Error {
  constructor(readonly code: string, message: string, readonly exit = 4) { super(message); }
}

/** A release by the hand refused: an AI seat on the command's branch (`hand-act-only`), or a branch nothing attests. */
export function handRefusal(code: HandRefusalCode, line: string): SpiritRefusal {
  return new SpiritRefusal(code, handRefusalOf(code, { act: "a release", reads: "branch", line }).message, 5);
}

// ── THE RECORD ─────────────────────────────────────────────────────────────────────────────────────────────────────

export interface SpiritSlot { readonly slot: string; readonly bytes: number; readonly first: string | null }
export interface SpiritLease { readonly body: string; readonly epoch: number }
export interface SpiritBudgets { readonly slot: number | null; readonly record: number }
export interface SpiritRecord {
  readonly pet: string; readonly uri: string; readonly kind: string; readonly has: string; readonly base: string; readonly bytes: number;
  readonly slots: readonly SpiritSlot[]; readonly fields: Readonly<Record<string, string>>;
  readonly budgets: SpiritBudgets; readonly every: number;
  readonly id: string | null; readonly lease: SpiritLease | null; readonly distilled: string | null; readonly crossing: string | null;
  /** The sibling record's address and fields (see `sideOf`). */
  readonly side: string; readonly sideFields: Readonly<Record<string, string>>;
}

/** A positive whole number a field names, else the default. */
export const countField = (raw: string | undefined, fallback: number): number => (raw !== undefined && /^[1-9][0-9]{0,6}$/.test(raw.trim()) ? Number(raw.trim()) : fallback);
/** The lease a record's `lease` field holds (`<body> <epoch> <iso>`), or null. */
export function leaseOf(raw: string | undefined): SpiritLease | null {
  const m = /^(\S+) ([1-9][0-9]*)\b/.exec(raw?.trim() ?? "");
  return m ? { body: m[1]!, epoch: Number(m[2]) } : null;
}

/** A tiddler door's `tiddler-get` answer read as fields and the live hash a put names as its base (a skinny hash names none). */
export function fieldsAndHashOf(out: Record<string, unknown>): { fields: Record<string, string>; hash: string | null } {
  const t = out["tiddler"] as { fields?: Record<string, string>; hash?: string } | null | undefined;
  return { fields: t?.fields ?? {}, hash: typeof t?.hash === "string" && !t.hash.startsWith("skinny:") ? t.hash : null };
}

/** The record a pet name resolves to, shaped from what the doors answered: the skinny meme read, the card's fields, its sibling's. */
export function spiritRecordOf(hit: { pet: string; kind: string; uri: string; out: Record<string, unknown> }, fields: Record<string, string>, sideFields: Record<string, string>): SpiritRecord {
  const meme = hit.out["meme"] as { canonicalHash?: string; bytes?: number; slots?: SpiritSlot[] };
  return {
    pet: hit.pet, uri: hit.uri, kind: hit.kind, has: String(hit.out["has"] ?? ""), base: String(meme.canonicalHash ?? ""), bytes: Number(meme.bytes ?? 0),
    slots: meme.slots ?? [], fields,
    budgets: { slot: fields["slot-budget"] === undefined ? null : countField(fields["slot-budget"], 0) || null, record: countField(fields["record-budget"], RECORD_BUDGET_BYTES) },
    every: countField(fields["true-up-every"], TRUE_UP_EVERY),
    id: PET_NAME.test(fields["spirit-id"] ?? "") ? fields["spirit-id"]! : null,
    lease: leaseOf(sideFields["lease"]), distilled: sideFields["distilled"] || fields["distilled"] || null, crossing: sideFields["crossing"] || null,
    side: sideOf(hit.pet), sideFields,
  };
}

/** Two records answer one pet name: the door guesses neither. */
export const spiritAmbiguous = (pet: string, uris: readonly string[]): SpiritRefusal =>
  new SpiritRefusal("spirit-ambiguous", `spirit-ambiguous: the pet name "${pet}" answers at ${uris.join(" and ")}; the door guesses neither. Read both (\`lares tiddler get <uri> --recipe default --meme --skinny\`), then rename one: one pet name, one record`, 4);
/** No record answers a pet name. */
export const spiritUnknown = (pet: string): SpiritRefusal =>
  new SpiritRefusal("spirit-unknown", `spirit-unknown: no record answers the pet name "${pet}" at ${MEMORY_PREFIX}familiar/${pet} or ${MEMORY_PREFIX}spirit/${pet}; list the records: \`lares wiki filter '[prefix[${MEMORY_PREFIX}familiar/]!regexp[#]] [prefix[${MEMORY_PREFIX}spirit/]!regexp[#]]' --recipe default\``, 3);
/** A slot the record lacks. */
export const slotMissing = (rec: Pick<SpiritRecord, "uri" | "slots" | "pet">, slot: string): SpiritRefusal =>
  new SpiritRefusal("spirit-slot-missing", `spirit-slot-missing: ${rec.uri} holds no slot ${slot}; its slots: ${rec.slots.map((s) => s.slot).join(" ") || "(none)"} (\`lares spirit hum ${rec.pet}\` measures each)`, 3);

/** The record's stable key, minted once from its address and the base it first answered. */
export const spiritIdOf = (uri: string, base: string): string => sha256HexSync(`${uri}\n${digestOf(base)}`).slice(0, 12);
/** The side field naming a slot's last writer (`#/open` -> `writer-open`). */
export const writerField = (slot: string): string => `writer-${slot.replace(/^#\//, "").replace(/[^A-Za-z0-9-]+/g, "-")}`;

// ── THE CROSSING ───────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The `crossing` field read: one `<body> <iso> <seq>` per line, keyed on the full body id. The iso annotates; the door-minted `seq`
 * (max + 1 inside the CAS write) orders the marks, so a skewed stamp never moves one. A line without a seq reads seq 0 (the oldest);
 * a bare iso (a mark naming no body) reads as no mark and drops.
 */
export function crossingsOf(raw: string | null | undefined): Array<{ who: string; at: string; seq: number }> {
  return String(raw ?? "").split("\n").flatMap((line) => {
    const m = /^([A-Za-z0-9_-]{1,128}) (\S+)(?: ([0-9]{1,15}))?$/.exec(line.trim());
    return m ? [{ who: m[1]!, at: m[2]!, seq: m[3] === undefined ? 0 : Number(m[3]) }] : [];
  });
}
/** At most this many crossing marks stand on a card; a mark drops only once this many later marks (by seq) have landed, never by age. */
export const CROSSING_CAP = 64;

/**
 * THE CROSSING RUNS PER BODY, AND STAYS ADVISORY. Between a body's PreCompact mark and its own next wake (the one event that lifts it; no timer does)
 * a write naming that body refuses; a sibling, or a write naming no body, writes freely. Answers the refusal, or null.
 */
export function crossingRefusal(rec: Pick<SpiritRecord, "crossing" | "uri" | "pet">, body: string | null): SpiritRefusal | null {
  if (body === null) return null;
  const mark = crossingsOf(rec.crossing).find((c) => c.who === body);
  if (mark === undefined) return null;
  return new SpiritRefusal("spirit-crossing", `spirit-crossing: body #${body.slice(0, 8)} stands in the crossing of its own compaction on ${rec.uri}, marked at ${mark.at} (an annotation); nothing landed. The mark advises only and holds this body alone (advisory); sibling bodies write on. Only this body's next wake or resume clears it, and no clock does; if this body crashed after its PreCompact and never wakes, the hand clears it: \`lares spirit om ${rec.pet} --body ${body}\``, 4);
}

/** A field write over the sibling record: what to patch and what to unset; null writes nothing. */
export type SideWrite = { patch?: Record<string, string>; unset?: readonly string[] } | null;

/** Mark (or clear) the crossing one body holds, keeping each mark a sibling holds (at most `CROSSING_CAP`, the highest seq; by the minted counter, never by clock): the write over the fields read. */
export function crossingWrite(fields: Readonly<Record<string, string>>, body: string, now: Date, mark: boolean): SideWrite {
  const was = crossingsOf(fields["crossing"]);
  const kept = was.filter((c) => c.who !== body);
  const seq = was.reduce((m, c) => Math.max(m, c.seq), 0) + 1;
  const next = (mark ? [...kept, { who: body, at: now.toISOString(), seq }] : kept).sort((x, y) => x.seq - y.seq).slice(-CROSSING_CAP);
  if (!mark && next.length === was.length && (fields["crossing"] ?? "").split("\n").filter((l) => l.trim() !== "").length === was.length) return null;
  return next.length > 0 ? { patch: { crossing: next.map((c) => `${c.who} ${c.at} ${c.seq}`).join("\n") } } : { unset: ["crossing"] };
}

// ── THE STARTER SHRINE ─────────────────────────────────────────────────────────────────────────────────────────────

/** The slots a shrine holds, each with the one-line prompt a first body answers. */
export const SHRINE_SLOTS: ReadonlyArray<readonly [string, string]> = [
  ["#/entry", "! <the pet name> ~ a familiar's record\n\nWho this pet name names, how a body wakes into it, and how the record stays small.\n\n''Named by'' <who> ''on'' <date>; ''renames:'' <old -> new, each as it lands>."],
  ["#/orders", "!! The operator's standing orders\n\nQuote them as given; never paraphrase."],
  ["#/grant", "!! The grant\n\nWhat it covers; what it never covers (the hand acts stay the operator's)."],
  ["#/attention", "!! Where attention starts\n\nThe canon and stage titles to read first, by lar:/// address."],
  ["#/open", "!! Open loops\n\nPR numbers, heads, what each waits on and whose hand it needs."],
  ["#/kulana", "!! Kūlana ~ the posture this spirit stands in\n\nCatmas held loosely, joints to watch, and outside memes transcluded in place."],
  ["#/carry-shape", `!! The carry's shape\n\nWhat a compaction hands down as the ${COMPACTION_DISPLAY}; the PreCompact hook reads this to the summarizer.`],
  ["#/bodies", "!! Bodies\n\nOne line each; fold the oldest when a new one lands."],
];
const slotBlock = (slot: string, body: string): string => `<<~ ahu slot=\`${slot}\`>>\n\n${body}\n\n<<~/ahu>>`;

/** What a first wake reads where no record answers the pet name: the slot skeleton, and the one command that lands it. */
export function starterText(pet: string): string {
  return [
    `Lares spirit om · ${pet}: no record answers this pet name yet, so this body names and writes its own shrine.`,
    `Answer each slot's prompt below, then land the shrine once: lares spirit ah ${pet} --new --file - (it refuses where a record already stands).`,
    "",
    ...SHRINE_SLOTS.map(([slot, prompt]) => slotBlock(slot, prompt)),
  ].join("\n\n");
}

/**
 * A shrine's carrier source at `familiar/<pet>`, before the house normalize and the block check: a whole carrier given stands
 * as given, else the slot blocks wrap in the house frame under the carrier type the caller names.
 */
export function shrineSource(pet: string, words: string, carrierType: string): string {
  const uri = `${MEMORY_PREFIX}familiar/${pet}`;
  return words.trimStart().startsWith("<<!DOCTYPE") ? words : [
    "<<!DOCTYPE type=`memetic-wikitext+tiddlywiki` spec=`lar:///ha.ka.ba/lares/api/pono/memetic-wikitext`>>", "",
    `<<^ code=\`&#x0001;\` from=\`?\` to=\`${uri}\`>>`, "<<^ code=`&#x0002;`>>", "",
    "```toml meta", "cacheable = false", 'l-space   = "adjacent"', `role      = "the familiar spirit ${pet}'s record; a waking body reads this first"`, 'status    = "live"',
    `title     = "${uri}"`, `type      = "${carrierType}"`, `uri-path  = "${uri.slice("lar:///".length)}"`, "```", "",
    words.replace(/^[\s\S]*?(?=<<~ ahu slot=)/, "").trim(), "",
    "<<^ code=`&#x0003;`>>", "", "<<^ code=`&#x0004;` to=`?`>>", "",
  ].join("\n");
}

// ── OM: THE CARD ───────────────────────────────────────────────────────────────────────────────────────────────────

export interface SpiritCarry { readonly title: string; readonly fields: Readonly<Record<string, string>>; readonly text: string }
export interface SpiritRow { readonly title: string; readonly fields: Readonly<Record<string, string>> }
/** The lineage a carry's listing reads in one filter call, no read per carry. */
export const LINEAGE_FIELDS = ["title", "landed", "parent", "depth", "body", "record-base"] as const;

/** Rows a filter answers with fields: each title beside the fields it asked. */
export function rowsOf(out: Record<string, unknown>): SpiritRow[] {
  const rows = Array.isArray(out["rows"]) ? (out["rows"] as Array<{ title?: string; fields?: Record<string, string> }>) : [];
  return rows.map((r) => ({ title: String(r.title ?? r.fields?.["title"] ?? ""), fields: r.fields ?? {} }));
}
/** The titles a filter answers. */
export const titlesOf = (out: Record<string, unknown>): string[] => (Array.isArray(out["titles"]) ? (out["titles"] as string[]) : []);

/** The filter listing every carry under a spirit's keys, newest first. */
export const carryFilter = (keys: readonly string[]): string => keys.map((key) => `[prefix[${MEMORY_PREFIX}${COMPACTION_WORD}/${key}-]]`).join(" ") + " +[!sort[landed]]";
/** The carries a listing holds under a spirit's keys, and the one a body reads: its own last carry, else the newest any body landed. */
export function carryRows(keys: readonly string[], listed: Record<string, unknown>, body: string | null = null): { top: SpiritRow | undefined; rows: SpiritRow[] } {
  const keep = new Set(residueOf(keys, rowsOf(listed).map((r) => r.title)).filter(isCarry));
  const rows = rowsOf(listed).filter((r) => keep.has(r.title));
  return { top: (body ? rows.find((r) => r.fields["body"] === body) : undefined) ?? rows[0], rows };
}

/** The carry read as testimony: what it names, and each joint where it breaks against the card. */
export function testimonyLines(rec: Pick<SpiritRecord, "base">, carry: SpiritCarry | null, siblings: number): string[] {
  if (carry === null) return [`Latest ${COMPACTION_DISPLAY}: none stands yet; this wake reads the card alone.`];
  const out = [`Latest ${COMPACTION_DISPLAY} (testimony, never mandate): ${carry.title} (hash ${carry.title.slice(-12)}, depth ${carry.fields["depth"] ?? "?"}, body ${carry.fields["body"] || "?"}); read it: lares tiddler get ${shq(carry.title)} --recipe default`];
  const read = carry.fields["record-base"];
  if (read && digestOf(read) !== digestOf(rec.base)) out.push(`⚠ the record moved since this ${COMPACTION_DISPLAY} read it (${digestOf(read).slice(7, 19)} -> ${digestOf(rec.base).slice(7, 19)}): the card outranks the carry.`);
  const depth = Number(carry.fields["depth"] ?? 0);
  if (depth > DEEP_CARRY) out.push(`⚠ this ${COMPACTION_DISPLAY} stands ${depth} deep: a chain past ${DEEP_CARRY} remembers only itself, so it outranks nothing; re-true its handles against gh.`);
  if (siblings > 1) out.push(`⚠ ${siblings} carries name the parent ${carry.fields["parent"]}: a fork; two bodies carried from one wake.`);
  return out;
}

/** Fit the wake's sections under the cap: the fixed lines whole, then #/open, then the attention unfold, each cut where it runs over. */
export function omText(rec: Pick<SpiritRecord, "pet" | "uri" | "has">, parts: { open: string | null; testimony?: readonly string[]; attention?: string | null; lead?: string | null }, cap = OM_CAP_CHARS): string {
  const head = `Lares spirit om · ${rec.pet} (${rec.uri}): the card a waking body reads first, before any summary.`;
  const doors = `Read a slot whole: lares tiddler get ${rec.uri} --recipe default --meme --slot '#/<name>' · true one: lares spirit ah ${rec.pet} --slot '#/<name>' --file <path> (or --add <line>) · fold: lares spirit hum ${rec.pet}`;
  const fixed = [parts.lead ?? null, head, rec.has, ...(parts.testimony ?? [])].flatMap((l) => (l === null ? [] : [l])).join("\n");
  let room = cap - fixed.length - doors.length - 4;
  const fit = (text: string | null | undefined, what: string): string | null => {
    if (!text) return null;
    if (room <= 0) return null;
    const cut = `\n… ${what} cut at the ${cap}-char wake cap`;
    const kept = text.length <= room ? text : `${text.slice(0, Math.max(0, room - cut.length))}${cut}`;
    room -= kept.length + 1;
    return kept;
  };
  const open = fit(parts.open, "#/open");
  const attention = fit(parts.attention, "the attention unfold");
  return [fixed, "", open, attention, doors].flatMap((l) => (l === null ? [] : [l])).join("\n").slice(0, cap);
}

/** The titles a record's #/attention body names, at most `ATTENTION_TITLES`, each once. */
export const attentionTitles = (body: string): string[] =>
  [...new Set([...body.matchAll(/lar:\/\/\/[^\s`'")\]<>·,]+/g)].map((m) => m[0].replace(/[.;:]+$/, "")))].slice(0, ATTENTION_TITLES);
/** The attention unfold: each title beside the description a filter read answered. */
export function attentionLines(titles: readonly string[], listed: Record<string, unknown>): string {
  const rows = Array.isArray(listed["rows"]) ? (listed["rows"] as Array<{ title?: string; fields?: Record<string, string> }>) : [];
  const described = new Map(rows.map((r) => [String(r.title ?? r.fields?.["title"] ?? ""), String(r.fields?.["description"] ?? "")]));
  return [`The titles #/attention names:`, ...titles.map((t) => `${t}${described.get(t) ? ` — ${described.get(t)!.slice(0, 160)}` : described.has(t) ? "" : " (unread here)"}`)].join("\n");
}

// ── BUNREI: PRESENCE AND THE WAKE EPOCH ───────────────────────────────────────────────────────────────────────────

/** One body awake on a card: its tag (`<pet>#<body>`), its full body id, and when it last woke. */
export interface SpiritAwake { readonly tag: string; readonly body: string; readonly at: string; readonly seq: number }
/** The `bodies-awake` field read: one `<pet>#<body> <iso> <seq>` per line, keyed on the full body id (the iso annotates, the minted seq orders; no seq reads 0); a line that parses not drops. */
export function presenceOf(raw: string | undefined): SpiritAwake[] {
  return String(raw ?? "").split("\n").flatMap((line) => {
    const m = /^(\S+#([A-Za-z0-9_-]{1,128})) (\S+)(?: ([0-9]{1,15}))?$/.exec(line.trim());
    return m ? [{ tag: m[1]!, body: m[2]!, at: m[3]!, seq: m[4] === undefined ? 0 : Number(m[4]) }] : [];
  });
}

/**
 * A waking body joins the card's presence: it refreshes its own entry and keeps at most `PRESENCE_CAP`, the
 * highest minted seq (the door mints seq = max + 1 inside the CAS write; the stamp annotates and never orders or drops). Answers who stands awake, this body first, and the write over the sibling's fields read.
 */
export function presenceJoin(fields: Readonly<Record<string, string>>, pet: string, body: string, now: Date): { awake: SpiritAwake[]; write: SideWrite } {
  const was = presenceOf(fields["bodies-awake"]);
  const me: SpiritAwake = { tag: `${pet}#${body}`, body, at: now.toISOString(), seq: was.reduce((m, a) => Math.max(m, a.seq), 0) + 1 };
  const others = was.filter((a) => a.body !== body).sort((x, y) => y.seq - x.seq);
  const awake = [me, ...others].slice(0, PRESENCE_CAP);
  return { awake, write: { patch: { "bodies-awake": awake.map((a) => `${a.tag} ${a.at} ${a.seq}`).join("\n") } } };
}

/** The presence line: how many bodies wear the pet, this one first. */
export const presenceLine = (pet: string, awake: readonly SpiritAwake[]): string =>
  `${awake.length} ${awake.length === 1 ? "body wears" : "bodies wear"} ${pet}: ${awake.map((a, i) => (i === 0 ? `#${a.body.slice(0, 8)} (you)` : `#${a.body.slice(0, 8)} since ${a.at.slice(11, 16)}`)).join(", ")}`;
/** The presence line a wake naming no body reads: who stands awake, null where none does. */
export const presenceSeenLine = (pet: string, awake: readonly SpiritAwake[]): string | null =>
  awake.length > 0 ? `${awake.length} ${awake.length === 1 ? "body wears" : "bodies wear"} ${pet}: ${awake.map((a) => `#${a.body.slice(0, 8)} since ${a.at.slice(11, 16)}`).join(", ")}` : null;

/**
 * Stamp the card's wake epoch for a body (an ordering stamp, never a fence): the body that holds it keeps its epoch; another
 * body raises it. Answers the epoch and the write over the sibling's fields read (null where the body already holds it).
 */
export function leaseClaim(fields: Readonly<Record<string, string>>, body: string, now: Date): { epoch: number; write: SideWrite } {
  const held = leaseOf(fields["lease"]);
  if (held !== null && held.body === body) return { epoch: held.epoch, write: null };
  const epoch = (held?.epoch ?? 0) + 1;
  return { epoch, write: { patch: { lease: `${body} ${epoch} ${now.toISOString()}` } } };
}

// ── A TITLE ONLY PROPOSES ─────────────────────────────────────────────────────────────────────────────────────────

/** The longest slug a pet name holds. */
export const SLUG_CHARS = 62;
/** A title's whole slug, uncut: a slug past `SLUG_CHARS` would collide once cut, so it names no familiar. */
export const rawSlug = (title: string): string => title.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
/** A slug of a title, as a pet name reads; null where none forms, or where it runs past a pet name's length. */
export const titleSlug = (title: string): string | null => {
  const slug = rawSlug(title);
  return slug.length <= SLUG_CHARS && PET_NAME.test(slug) ? slug : null;
};
/** Does a record name this title as its own: its `aliases` field, or a recognition line in its #/entry body (`named by`, `renames`, `alias`)? */
export function namesTitleIn(fields: Readonly<Record<string, string>>, entryBody: string, title: string): boolean {
  const want = title.trim().toLowerCase();
  if ((fields["aliases"] ?? "").split(/[,;\n]/).some((a) => a.trim().toLowerCase() === want)) return true;
  return entryBody.split("\n").some((line) => /named by|renames?|alias/i.test(line) && line.toLowerCase().includes(want));
}

// ── AH: THE CAPS AND THE GUARD ────────────────────────────────────────────────────────────────────────────────────

/** The cap a slot's body answers to: a waking slot's, else null (the slot never refuses). */
export const wakingCap = (budgets: SpiritBudgets | undefined, slot: string): number | null => {
  const base = WAKING_SLOT_BUDGETS[slot];
  return base === undefined ? null : budgets?.slot ?? base;
};

/** What a slot write would leave, measured against its cap: the refusal where a waking slot grows past it, else null. Every other slot and the record's total only advise (`advisoryLine`). */
export function budgetRefusal(rec: Pick<SpiritRecord, "pet" | "uri" | "slots"> & { budgets?: SpiritBudgets }, slot: string, oldBody: string, newBody: string, factor = 1): SpiritRefusal | null {
  const cap = wakingCap(rec.budgets, slot);
  if (cap === null) return null;
  const was = bytesOf(oldBody);
  const now = bytesOf(newBody);
  if (now <= was) return null;
  const fold = `\`lares spirit hum ${rec.pet} --fold '${slot}'\` lists its lines with their digests; \`--line <n> --expect <digest>\` moves one to the ash ledger`;
  if (now > cap * factor) return new SpiritRefusal("spirit-slot-over-budget", `spirit-slot-over-budget: ${slot} would hold ${now} bytes, past its ${cap * factor}-byte waking cap (om prints it into the wake; it holds ${was}); nothing landed. Fold first: ${fold}, then true it again`);
  return null;
}

/** Each waking slot against its cap (others carry none), and the record's total against its advisory weight. */
export function measure(rec: Pick<SpiritRecord, "slots"> & { budgets?: SpiritBudgets }): { slots: Array<SpiritSlot & { budget: number | null; over: boolean }>; total: number; budget: number; over: boolean } {
  const budgets = rec.budgets ?? { slot: null, record: RECORD_BUDGET_BYTES };
  const slots = rec.slots.map((s) => { const budget = wakingCap(budgets, s.slot); return { ...s, budget, over: budget !== null && s.bytes > budget }; });
  const total = rec.slots.reduce((n, s) => n + s.bytes, 0);
  return { slots, total, budget: budgets.record, over: total > budgets.record };
}

/** The advisory line for a record's weight: its total and its heaviest slots; null where the record stands under its advisory weight (unless `always`). */
export function advisoryLine(rec: Pick<SpiritRecord, "slots"> & { budgets?: SpiritBudgets }, always = false): string | null {
  const m = measure(rec);
  if (!always && !m.over) return null;
  const heavy = [...rec.slots].sort((a, b) => b.bytes - a.bytes).slice(0, 3).map((s) => `${s.slot} ${s.bytes}`);
  return `advisory: the record holds ${m.total} bytes${m.over ? `, past ${m.budget}` : ""}; heaviest ${heavy.join(", ")}`;
}

/** The guards every slot write passes: the secret-shape guard over the lines it brings, and (where `budget`) the waking cap. Throws the refusal. */
export function guardWords(rec: Pick<SpiritRecord, "pet" | "uri" | "slots" | "budgets">, slot: string, was: string, body: string, budget: boolean, factor = 1): void {
  // The guard reads the lines this write brings, never the ones already standing: a standing line answers to its own fold.
  const standing = new Set(was.split("\n"));
  const brought = body.split("\n").map((line, i) => ({ line, n: i + 1 })).filter(({ line }) => !standing.has(line));
  const shaped = brought.find(({ line }) => secretCount(line) > 0);
  if (shaped !== undefined) {
    throw new SpiritRefusal("spirit-secret-shaped", `spirit-secret-shaped: line ${shaped.n} of the words for ${rec.uri}${slot} holds a secret-shaped string (${redactedText(shaped.line).slice(0, 120)}), so nothing landed; clear it, then true the slot again: \`lares spirit ah ${rec.pet} --slot '${slot}' --file <scrubbed path>\``, 4);
  }
  if (!budget) return;
  const over = budgetRefusal(rec, slot, was, body, factor);
  if (over) throw over;
}

// ── THE CONFLICT STANZA ───────────────────────────────────────────────────────────────────────────────────────────

const STANZA_HEAD = "!! conflict · ";
const STANZA_END = "!! end conflict";
/** The versions a standing conflict stanza holds (each writer and its words), or null where the text holds none. */
export function stanzaVersions(text: string): Array<{ who: string; words: string }> | null {
  const t = text.trim();
  if (!t.startsWith(STANZA_HEAD)) return null;
  const inner = t.slice(t.indexOf("\n") + 1).replace(new RegExp(`${STANZA_END}\\s*$`), "");
  const out: Array<{ who: string; words: string }> = [];
  for (const part of inner.split(/^''(.+) wrote:''$/m).slice(1).reduce<string[][]>((acc, v, i) => (i % 2 === 0 ? [...acc, [v]] : (acc[acc.length - 1]!.push(v), acc)), [])) {
    out.push({ who: part[0]!, words: (part[1] ?? "").trim() });
  }
  return out;
}

/**
 * The marked stanza a whole-slot clash lands: every version, each named by its writer, for a body or the operator to settle
 * with hum. A standing stanza flattens into the new one (its versions join), so stanzas never nest.
 */
export function conflictStanza(slot: string, versions: ReadonlyArray<{ who: string; words: string }>): string {
  const flat = versions.flatMap((v) => stanzaVersions(v.words) ?? [v]);
  const seen = new Set<string>();
  const kept = flat.filter((v) => (seen.has(v.words.trim()) ? false : (seen.add(v.words.trim()), true)));
  return [
    `${STANZA_HEAD}${slot}: two bodies wrote this slot whole at once; settle it with hum (fold the lines that lose)`,
    ...kept.flatMap((v) => [`''${v.who} wrote:''`, v.words.trim()]),
    STANZA_END,
  ].join("\n\n");
}

/** A slot write: one line appended, or the slot's whole words named against the digest of the slot they read. */
export type SlotWrite = { add: string } | { words: string; base: string | null; who: string };

/**
 * The body a slot write lands over the slot as read: an add appends; a whole write lands its words where the slot still reads
 * the digest it named, else (a clash) both versions in a conflict stanza naming this writer and the slot's `last` writer.
 */
export function slotWriteBody(slot: string, readBody: string, write: SlotWrite, clash: boolean, last: string): string {
  const body = "add" in write ? `${readBody}\n${write.add}`
    : !clash ? write.words
    : conflictStanza(slot, [{ who: write.who, words: write.words }, { who: last, words: readBody }]);
  return body.replace(/^\n+/, "").replace(/\s+$/, "");
}

/** The line a fold takes, found by content: the slot's body without it, or null where the body holds no such line. */
export function foldOut(body: string, line: string): string | null {
  const lines = body.split("\n");
  const at = lines.indexOf(line);
  if (at < 0) return null;
  return lines.filter((_, i) => i !== at).join("\n").replace(/^\n+/, "").replace(/\s+$/, "");
}

/** The listed line a fold names: the numbered line where it still reads the digest expected, else the first line reading it; -1 where none does. */
export function pickLine(lines: readonly string[], lineWord: string, expect: string): number {
  const n = /^[1-9][0-9]*$/.test(lineWord) ? Number(lineWord) : NaN;
  return Number.isInteger(n) && lines[n - 1] !== undefined && slotDigest(lines[n - 1]!) === expect ? n - 1 : lines.findIndex((l) => slotDigest(l) === expect);
}

// ── THE ASH LEDGER ────────────────────────────────────────────────────────────────────────────────────────────────

/** The line a fold burns to the month's ledger. */
export const foldAshLine = (now: Date, pet: string, uri: string, slot: string, line: string): string =>
  `* ${now.toISOString().slice(0, 10)} · hum ${pet} folded from ${uri}${slot}: ${line.trim()}`;
/** The description a month's ledger takes once an append opens it. */
export const ledgerDescription = (now: Date): string =>
  `The ash ledger of the ${now.toISOString().slice(0, 7)} o-takiage sittings: each burned stage item with what landed it and the date.`;

// ── THE CARRY · RESIDUE ───────────────────────────────────────────────────────────────────────────────────────────

/** The #/bodies line a carry asks the next body to file: the date, the carry's name and hash, the body fragment, its address. */
export const bodiesLine = (day: string, hash: string, pet: string, body: string, title: string): string =>
  `* ''${day} (${COMPACTION_DISPLAY} ${hash.slice(0, 12)}) ${body ? `${pet}#${body.slice(0, 8)}` : pet}:'' ${title}`;

/** The carry's parent: the body's own last carry in its chain, else the newest any body landed; null for a first carry. */
export const carryParent = (chain: readonly SpiritRow[], body: string): SpiritRow | null =>
  ((body === "" ? undefined : chain.find((r) => (r.fields["body"] ?? "") === body)) ?? chain[0]) ?? null;

/** The fields a carry lands with: its lineage (`parent`, `record-base`, `depth`, `body`) beside its date and keys. */
export function carryFields(o: { pet: string; key: string; body: string; base: string; parent: SpiritRow | null; now: Date }): Record<string, string> {
  const day = o.now.toISOString().slice(0, 10);
  return {
    description: `a ${COMPACTION_DISPLAY} of ${o.pet}, ${day}: the summary one body's context turned on`,
    landed: o.now.toISOString(), "spirit-id": o.key, pet: o.pet, parent: o.parent === null ? "" : o.parent.title.slice(-12),
    "record-base": digestOf(o.base), depth: String(carryDepth(o.parent)), body: o.body,
  };
}
/** How deep a carry over this parent stands. */
export const carryDepth = (parent: SpiritRow | null): number => (parent === null ? 1 : countField(parent.fields["depth"], 1) + 1);

/** A handback's hash: idempotent under its key (`<session:agent>`), so the same handback lands once. */
export const residueHash = (text: string, salt: string | null): string => sha256HexSync(salt === null ? text : `${salt}\n${text}`);
/** The fields a handback lands with. */
export const residueFields = (pet: string, now: Date): Record<string, string> =>
  ({ description: `a handback of the spirit ${pet}, ${now.toISOString().slice(0, 10)}`, landed: now.toISOString(), pet });
/** A residue cut at the cap, after the guard read it whole. */
export const residueCut = (raw: string): { text: string; cut: boolean } =>
  (raw.length > RESIDUE_CAP_CHARS ? { text: raw.slice(0, RESIDUE_CAP_CHARS), cut: true } : { text: raw, cut: false });

// ── OTAKIAGE ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** The filter listing every residue under a spirit's keys. */
export const residueFilter = (keys: readonly string[]): string =>
  keys.flatMap((k) => [`[prefix[${MEMORY_PREFIX}${COMPACTION_WORD}/${k}-]]`, `[prefix[${MEMORY_PREFIX}spirit/${k}-handback-]]`]).join(" ");
/** The parents a standing carry names: a carry one names holds the chain, so the child burns first. */
export const carryParents = (rows: readonly SpiritRow[], titles: readonly string[]): Set<string> =>
  new Set(rows.filter((r) => titles.includes(r.title)).map((r) => r.fields["parent"] ?? "").filter((p) => p !== ""));
/** Why the distill mark holds a residue (no mark yet, or landed after it); null where the mark covers it. */
export const distillHold = (distilled: string | null, landed: string): string | null =>
  (distilled === null || landed === "" || landed >= distilled ? (distilled === null ? "no distill mark stands yet" : "landed after the last distill mark") : null);
/** The ash line a burn writes ahead for one residue. */
export function burnLine(day: string, pet: string, title: string, text: string, textHash: string | null | undefined): string {
  const first = text.split("\n").find((l) => l.trim() !== "")?.trim().slice(0, 200) ?? "";
  return `* ${day} · otakiage ${pet} burning ${title} (${bytesOf(text)} bytes, ${textHash ?? "?"})${first ? `: ${first}` : ""}`;
}
/** The ash line a burn closes on: how many burned, and what still stands. */
export const burnTally = (day: string, pet: string, burned: readonly string[], burnable: readonly string[]): string =>
  `* ${day} · otakiage ${pet} burned ${burned.length} of ${burnable.length}${burned.length < burnable.length ? `; still standing: ${burnable.filter((t) => !burned.includes(t)).join(", ")}` : ""}`;
