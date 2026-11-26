/**
 * spirit-shrine — THE SPIRIT DOOR'S PURE CORE: a familiar's record by its pet name, read and shaped without a door.
 *
 * `lares spirit <om | ah | hum | hooili | residue | otakiage>` (lares-cli `commands/spirit.ts`) carries the host's half: the
 * door calls, the file and stdin reads, the clock, the hand gate and the render. Everything that needs no I/O stands here,
 * so a reactor inside the island answers the same as the host loop: the addresses and defaults, the slot parse and its
 * digest, the record shaped from what the doors answer, the card's text under the wake cap, the carry read as testimony,
 * the waking caps and the advisory weight, the strict secret-shape guard, the conflict stanza and the fold by content,
 * the presence, wake epoch and crossing merges on the card's sibling record (bunrei: many instances wear one pet, none locks
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
import { SPIRIT_CAPS, SPIRIT_PREFIX, maskCardOf, spiritOf } from "./spirit-stack.js";

// ── THE CARRY'S WORDS ─────────────────────────────────────────────────────────────────────────────────────────────
/**
 * THE WORDS A SPIRIT'S CARRY TAKES, IN ONE PLACE: each name rides as a pair, its command spelling (ASCII: the `lares spirit`
 * verb, the stage address `<word>/<pet>-<hash12>`) and its display spelling (the full grammar people read: the heading the
 * compaction asks the summary to end on, the #/instances line, om's context, the help). A rename lands here, in the hooks'
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
 * checks. What orders instances (the presence, the wake epoch, each instance's crossing, the distill mark, each slot's last writer)
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
/** At most this many instances stand in a card's presence, a cap by count and never by age: a clock only sorts siblings, it drops none. */
export const PRESENCE_CAP = 16;
/** The card's #/open and #/kulana, read to the outgoing instance at PreCompact, cut here so the carry ask still lands inside 10,000 chars. */
export const PRECOMPACT_CARD_CHARS = 4000;
/** How many titles #/attention names the wake unfolds. */
export const ATTENTION_TITLES = 12;
/** How many times a fold's ash write tries before the line returns to its slot. */
export const ASH_ROUNDS = 3;
/** How many times a write reads again over a record that moved under it before it refuses. */
export const CAS_ROUNDS = 4;
/** A pet name: lower-case letters, digits and hyphens. */
export const PET_NAME = /^[a-z0-9][a-z0-9-]{0,62}$/;
/** An instance names itself by its session id. */
export const INSTANCE_ID = /^[A-Za-z0-9_-]{1,128}$/;

/** The lineage slot: one line per instance that wore the spirit. */
export const INSTANCES_SLOT = "#/instances";
/** The instance a carry names: its `instance` field. */
export const carryInstanceOf = (fields: Readonly<Record<string, string>>): string => fields["instance"] ?? "";
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

/** A slot's body as a put on the slot reads it: the slot text without its `<<~ ahu …>>` frame. */
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
export interface SpiritLease { readonly instance: string; readonly epoch: number }
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
/** The lease a record's `lease` field holds (`<instance> <epoch> <iso>`), or null. */
export function leaseOf(raw: string | undefined): SpiritLease | null {
  const m = /^(\S+) ([1-9][0-9]*)\b/.exec(raw?.trim() ?? "");
  return m ? { instance: m[1]!, epoch: Number(m[2]) } : null;
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
  new SpiritRefusal("spirit-unknown", `spirit-unknown: no record answers the pet name "${pet}" at ${spiritOf(pet)}, nor at ${MEMORY_PREFIX}familiar/${pet}, ${MEMORY_PREFIX}spirit/${pet} or a card naming it at ${MEMORY_PREFIX}spirit-card/${pet} or ${maskCardOf(pet)}; list the records: \`lares wiki filter '[prefix[${SPIRIT_PREFIX}]!regexp[#]] [prefix[${MEMORY_PREFIX}familiar/]!regexp[#]] [prefix[${MEMORY_PREFIX}spirit/]!regexp[#]] [prefix[${MEMORY_PREFIX}spirit-card/]] [prefix[${MEMORY_PREFIX}mask-card/]]' --recipe default\``, 3);
/** A slot the record lacks. */
export const slotMissing = (rec: Pick<SpiritRecord, "uri" | "slots" | "pet">, slot: string): SpiritRefusal =>
  new SpiritRefusal("spirit-slot-missing", `spirit-slot-missing: ${rec.uri} holds no slot ${slot}; its slots: ${rec.slots.map((s) => s.slot).join(" ") || "(none)"} (\`lares spirit hum ${rec.pet}\` measures each)`, 3);

/** The record's stable key, minted once from its address and the base it first answered. */
export const spiritIdOf = (uri: string, base: string): string => sha256HexSync(`${uri}\n${digestOf(base)}`).slice(0, 12);
/** The side field naming a slot's last writer (`#/open` -> `writer-open`). */
export const writerField = (slot: string): string => `writer-${slot.replace(/^#\//, "").replace(/[^A-Za-z0-9-]+/g, "-")}`;

// ── THE CROSSING ───────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The `crossing` field read: one `<instance> <iso> <seq>` per line, keyed on the full instance id. The iso annotates; the door-minted `seq`
 * (max + 1 inside the CAS write) orders the marks, so a skewed stamp never moves one. A line without a seq reads seq 0 (the oldest);
 * a bare iso (a mark naming no instance) reads as no mark and drops.
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
 * THE CROSSING RUNS PER INSTANCE, AND STAYS ADVISORY. Between an instance's PreCompact mark and its own next wake (the one event that lifts it; no timer does)
 * a write naming that instance refuses; a sibling, or a write naming no instance, writes freely. Answers the refusal, or null.
 */
export function crossingRefusal(rec: Pick<SpiritRecord, "crossing" | "uri" | "pet">, instance: string | null): SpiritRefusal | null {
  if (instance === null) return null;
  const mark = crossingsOf(rec.crossing).find((c) => c.who === instance);
  if (mark === undefined) return null;
  return new SpiritRefusal("spirit-crossing", `spirit-crossing: instance #${instance.slice(0, 8)} stands in the crossing of its own compaction on ${rec.uri}, marked at ${mark.at} (an annotation); nothing landed. The mark advises only and holds this instance alone (advisory); sibling instances write on. Only this instance's next wake or resume clears it, and no clock does; if this instance crashed after its PreCompact and never wakes, the hand clears it: \`lares spirit om ${rec.pet} --instance ${instance}\``, 4);
}

/** A field write over the sibling record: what to patch and what to unset; null writes nothing. */
export type SideWrite = { patch?: Record<string, string>; unset?: readonly string[] } | null;

/** Mark (or clear) the crossing one instance holds, keeping each mark a sibling holds (at most `CROSSING_CAP`, the highest seq; by the minted counter, never by clock): the write over the fields read. */
export function crossingWrite(fields: Readonly<Record<string, string>>, instance: string, now: Date, mark: boolean): SideWrite {
  const was = crossingsOf(fields["crossing"]);
  const kept = was.filter((c) => c.who !== instance);
  const seq = was.reduce((m, c) => Math.max(m, c.seq), 0) + 1;
  const next = (mark ? [...kept, { who: instance, at: now.toISOString(), seq }] : kept).sort((x, y) => x.seq - y.seq).slice(-CROSSING_CAP);
  if (!mark && next.length === was.length && (fields["crossing"] ?? "").split("\n").filter((l) => l.trim() !== "").length === was.length) return null;
  return next.length > 0 ? { patch: { crossing: next.map((c) => `${c.who} ${c.at} ${c.seq}`).join("\n") } } : { unset: ["crossing"] };
}

// ── THE STARTER SHRINE ─────────────────────────────────────────────────────────────────────────────────────────────

/** The slots a shrine holds, each with the one-line prompt a first instance answers. */
export const SHRINE_SLOTS: ReadonlyArray<readonly [string, string]> = [
  ["#/entry", "! <the pet name> ~ a familiar's record\n\nWho this pet name names, how an instance wakes into it, and how the record stays small.\n\n''Named by'' <who> ''on'' <date>; ''renames:'' <old -> new, each as it lands>."],
  ["#/orders", "!! The operator's standing orders\n\nQuote them as given; never paraphrase."],
  ["#/grant", "!! The grant\n\nWhat it covers; what it never covers (the hand acts stay the operator's)."],
  ["#/attention", "!! Where attention starts\n\nThe canon and stage titles to read first, by lar:/// address."],
  ["#/open", "!! Open loops\n\nPR numbers, heads, what each waits on and whose hand it needs."],
  ["#/kulana", "!! Kūlana ~ the posture this spirit stands in\n\nCatmas held loosely, joints to watch, and outside memes transcluded in place."],
  ["#/carry-shape", `!! The carry's shape\n\nWhat a compaction hands down as the ${COMPACTION_DISPLAY}; the PreCompact hook reads this to the summarizer.`],
  ["#/instances", "!! Instances\n\nOne line each; fold the oldest when a new one lands."],
];
const slotBlock = (slot: string, body: string): string => `<<~ ahu slot=\`${slot}\`>>\n\n${body}\n\n<<~/ahu>>`;

/** What a first wake reads where no record answers the pet name: the slot skeleton, and the one command that lands it. */
export function starterText(pet: string): string {
  return [
    `Lares spirit om · ${pet}: no record answers this pet name yet, so this instance names and writes its own shrine.`,
    `Answer each slot's prompt below, then land the shrine once: lares spirit ah ${pet} --new --file - (it refuses where a record already stands).`,
    "",
    ...SHRINE_SLOTS.map(([slot, prompt]) => slotBlock(slot, prompt)),
  ].join("\n\n");
}

/**
 * A shrine's carrier source at the one address (`lares/spirit/<pet>`), before the house normalize and the block check: a whole carrier given stands
 * as given, else the slot blocks wrap in the house frame under the carrier type the caller names.
 */
export function shrineSource(pet: string, words: string, carrierType: string): string {
  const uri = spiritOf(pet);
  return words.trimStart().startsWith("<<!DOCTYPE") ? words : [
    "<<!DOCTYPE type=`memetic-wikitext+tiddlywiki` spec=`lar:///ha.ka.ba/lares/api/pono/memetic-wikitext`>>", "",
    `<<^ code=\`&#x0001;\` from=\`?\` to=\`${uri}\`>>`, "<<^ code=`&#x0002;`>>", "",
    "```toml meta", "cacheable = false", 'l-space   = "adjacent"', `role      = "the spirit ${pet}'s record; a waking instance reads this first"`, 'status    = "live"',
    `title     = "${uri}"`, `type      = "${carrierType}"`, `uri-path  = "${uri.slice("lar:///".length)}"`, "```", "",
    words.replace(/^[\s\S]*?(?=<<~ ahu slot=)/, "").trim(), "",
    "<<^ code=`&#x0003;`>>", "", "<<^ code=`&#x0004;` to=`?`>>", "",
  ].join("\n");
}

// ── OM: THE CARD ───────────────────────────────────────────────────────────────────────────────────────────────────

export interface SpiritCarry { readonly title: string; readonly fields: Readonly<Record<string, string>>; readonly text: string }
export interface SpiritRow { readonly title: string; readonly fields: Readonly<Record<string, string>> }
/** The lineage a carry's listing reads in one filter call, no read per carry. */
export const LINEAGE_FIELDS = ["title", "landed", "parent", "depth", "instance", "record-base"] as const;

/** Rows a filter answers with fields: each title beside the fields it asked. */
export function rowsOf(out: Record<string, unknown>): SpiritRow[] {
  const rows = Array.isArray(out["rows"]) ? (out["rows"] as Array<{ title?: string; fields?: Record<string, string> }>) : [];
  return rows.map((r) => ({ title: String(r.title ?? r.fields?.["title"] ?? ""), fields: r.fields ?? {} }));
}
/** The titles a filter answers. */
export const titlesOf = (out: Record<string, unknown>): string[] => (Array.isArray(out["titles"]) ? (out["titles"] as string[]) : []);

/** The filter listing every carry under a spirit's keys, newest first. */
export const carryFilter = (keys: readonly string[]): string => keys.map((key) => `[prefix[${MEMORY_PREFIX}${COMPACTION_WORD}/${key}-]]`).join(" ") + " +[!sort[landed]]";
/** The carries a listing holds under a spirit's keys, and the one an instance reads: its own last carry, else the newest any instance landed. */
export function carryRows(keys: readonly string[], listed: Record<string, unknown>, instance: string | null = null): { top: SpiritRow | undefined; rows: SpiritRow[] } {
  const keep = new Set(residueOf(keys, rowsOf(listed).map((r) => r.title)).filter(isCarry));
  const rows = rowsOf(listed).filter((r) => keep.has(r.title));
  return { top: (instance ? rows.find((r) => carryInstanceOf(r.fields) === instance) : undefined) ?? rows[0], rows };
}

/** The carry read as testimony: what it names, and each joint where it breaks against the card. */
export function testimonyLines(rec: Pick<SpiritRecord, "base">, carry: SpiritCarry | null, siblings: number): string[] {
  if (carry === null) return [`Latest ${COMPACTION_DISPLAY}: none stands yet; this wake reads the card alone.`];
  const out = [`Latest ${COMPACTION_DISPLAY} (testimony, never mandate): ${carry.title} (hash ${carry.title.slice(-12)}, depth ${carry.fields["depth"] ?? "?"}, instance ${carryInstanceOf(carry.fields) || "?"}); read it: lares tiddler get ${shq(carry.title)} --recipe default`];
  const read = carry.fields["record-base"];
  if (read && digestOf(read) !== digestOf(rec.base)) out.push(`⚠ the record moved since this ${COMPACTION_DISPLAY} read it (${digestOf(read).slice(7, 19)} -> ${digestOf(rec.base).slice(7, 19)}): the card outranks the carry.`);
  const depth = Number(carry.fields["depth"] ?? 0);
  if (depth > DEEP_CARRY) out.push(`⚠ this ${COMPACTION_DISPLAY} stands ${depth} deep: a chain past ${DEEP_CARRY} remembers only itself, so it outranks nothing; re-true its handles against gh.`);
  if (siblings > 1) out.push(`⚠ ${siblings} carries name the parent ${carry.fields["parent"]}: a fork; two instances carried from one wake.`);
  return out;
}

/** Fit the wake's sections under the cap: the fixed lines whole, then #/open, then the attention unfold, each cut where it runs over. */
export function omText(rec: Pick<SpiritRecord, "pet" | "uri" | "has">, parts: { open: string | null; testimony?: readonly string[]; attention?: string | null; lead?: string | null }, cap = OM_CAP_CHARS): string {
  const head = `Lares spirit om · ${rec.pet} (${rec.uri}): the card a waking instance reads first, before any summary.`;
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

/** One instance awake on a card: its tag (`<pet>#<instance>`), its full instance id, and when it last woke. */
export interface SpiritAwake { readonly tag: string; readonly instance: string; readonly at: string; readonly seq: number }
/** The `instances-awake` field read: one `<pet>#<instance> <iso> <seq>` per line, keyed on the full instance id (the iso annotates, the minted seq orders; no seq reads 0); a line that parses not drops. */
export function presenceOf(raw: string | undefined): SpiritAwake[] {
  return String(raw ?? "").split("\n").flatMap((line) => {
    const m = /^(\S+#([A-Za-z0-9_-]{1,128})) (\S+)(?: ([0-9]{1,15}))?$/.exec(line.trim());
    return m ? [{ tag: m[1]!, instance: m[2]!, at: m[3]!, seq: m[4] === undefined ? 0 : Number(m[4]) }] : [];
  });
}
/** Who stands awake on a sibling record: its `instances-awake`. */
export const presenceRead = (fields: Readonly<Record<string, string>>): SpiritAwake[] => presenceOf(fields["instances-awake"]);

/**
 * A waking instance joins the card's presence: it refreshes its own entry and keeps at most `PRESENCE_CAP`, the
 * highest minted seq (the door mints seq = max + 1 inside the CAS write; the stamp annotates and never orders or drops). Answers who stands awake, this instance first, and the write over the sibling's fields read.
 */
export function presenceJoin(fields: Readonly<Record<string, string>>, pet: string, instance: string, now: Date): { awake: SpiritAwake[]; write: SideWrite } {
  const was = presenceOf(fields["instances-awake"]);
  const me: SpiritAwake = { tag: `${pet}#${instance}`, instance, at: now.toISOString(), seq: was.reduce((m, a) => Math.max(m, a.seq), 0) + 1 };
  const others = was.filter((a) => a.instance !== instance).sort((x, y) => y.seq - x.seq);
  const awake = [me, ...others].slice(0, PRESENCE_CAP);
  const patch = { "instances-awake": awake.map((a) => `${a.tag} ${a.at} ${a.seq}`).join("\n") };
  return { awake, write: { patch } };
}

/** The presence line: how many instances wear the pet, this one first. */
export const presenceLine = (pet: string, awake: readonly SpiritAwake[]): string =>
  `${awake.length} ${awake.length === 1 ? "instance wears" : "instances wear"} ${pet}: ${awake.map((a, i) => (i === 0 ? `#${a.instance.slice(0, 8)} (you)` : `#${a.instance.slice(0, 8)} since ${a.at.slice(11, 16)}`)).join(", ")}`;
/** The presence line a wake naming no instance reads: who stands awake, null where none does. */
export const presenceSeenLine = (pet: string, awake: readonly SpiritAwake[]): string | null =>
  awake.length > 0 ? `${awake.length} ${awake.length === 1 ? "instance wears" : "instances wear"} ${pet}: ${awake.map((a) => `#${a.instance.slice(0, 8)} since ${a.at.slice(11, 16)}`).join(", ")}` : null;

/**
 * Stamp the card's wake epoch for an instance (an ordering stamp, never a fence): the instance that holds it keeps its epoch; another
 * instance raises it. Answers the epoch and the write over the sibling's fields read (null where the instance already holds it).
 */
export function leaseClaim(fields: Readonly<Record<string, string>>, instance: string, now: Date): { epoch: number; write: SideWrite } {
  const held = leaseOf(fields["lease"]);
  if (held !== null && held.instance === instance) return { epoch: held.epoch, write: null };
  const epoch = (held?.epoch ?? 0) + 1;
  return { epoch, write: { patch: { lease: `${instance} ${epoch} ${now.toISOString()}` } } };
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
 * The marked stanza a whole-slot clash lands: every version, each named by its writer, for an instance or the operator to settle
 * with hum. A standing stanza flattens into the new one (its versions join), so stanzas never nest.
 */
export function conflictStanza(slot: string, versions: ReadonlyArray<{ who: string; words: string }>): string {
  const flat = versions.flatMap((v) => stanzaVersions(v.words) ?? [v]);
  const seen = new Set<string>();
  const kept = flat.filter((v) => (seen.has(v.words.trim()) ? false : (seen.add(v.words.trim()), true)));
  return [
    `${STANZA_HEAD}${slot}: two instances wrote this slot whole at once; settle it with hum (fold the lines that lose)`,
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

/** The #/instances line a carry asks the next instance to file: the date, the carry's name and hash, the instance fragment, its address. */
export const instancesLine = (day: string, hash: string, pet: string, instance: string, title: string): string =>
  `* ''${day} (${COMPACTION_DISPLAY} ${hash.slice(0, 12)}) ${instance ? `${pet}#${instance.slice(0, 8)}` : pet}:'' ${title}`;

/** The carry's parent: the instance's own last carry in its chain, else the newest any instance landed; null for a first carry. */
export const carryParent = (chain: readonly SpiritRow[], instance: string): SpiritRow | null =>
  ((instance === "" ? undefined : chain.find((r) => carryInstanceOf(r.fields) === instance)) ?? chain[0]) ?? null;

/** The fields a carry lands with: its lineage (`parent`, `record-base`, `depth`, `instance`) beside its date and keys. */
export function carryFields(o: { pet: string; key: string; instance: string; base: string; parent: SpiritRow | null; now: Date }): Record<string, string> {
  const day = o.now.toISOString().slice(0, 10);
  return {
    description: `a ${COMPACTION_DISPLAY} of ${o.pet}, ${day}: the summary one instance's context turned on`,
    landed: o.now.toISOString(), "spirit-id": o.key, pet: o.pet, parent: o.parent === null ? "" : o.parent.title.slice(-12),
    "record-base": digestOf(o.base), depth: String(carryDepth(o.parent)), instance: o.instance,
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

// ── THE CARD-BACKED SPIRIT ────────────────────────────────────────────────────────────────────────────────────────
/**
 * A SPIRIT HOLDING A CARD ALONE (`spirit-card/<pet>`: metadata as fields, a text that transcludes its template) answers the
 * slot verbs through its FIELDS: `#/<name>` reads and writes the card's field `<name>` (reference/tasked-spirit names the card
 * "metadata as FIELDS only", and its brief bids each instance "true it (`instances`, `open`)"), so no shrine gets minted beside a
 * card, and the template renders each truing where it already reads. These fields hold the card's identity and its frame (the
 * lane a bare `--offer` takes as its mandate, and the fields the template renders as wikitext), so no slot verb writes them.
 */
export const CARD_HELD_FIELDS: ReadonlySet<string> = new Set([
  "title", "text", "tags", "type", "pet", "description", "created", "modified", "creator", "modifier", "revision", "bag",
  "spirit-id", "slot-budget", "record-budget", "true-up-every", "distilled", "aliases",
  // THE FRAME: the lane a bare offer takes as its mandate, and the fields the template renders as wikitext; the hand sets them.
  "lane", "model", "feeds", "wave", "waits",
  // A MASK'S FRAME: its keepers hold the pen, so a wearer's slot verbs true the instances and the story, never the character.
  "canon", "keepers", "stage", "look", "voice", "handle", "goals", "sealed", "template",
  // THE STACK'S OWN FIELDS: each cap's value lands through `#/has` (or the door's own act), never as a loose field write.
  ...SPIRIT_CAPS.map((k) => k.field), "offer-seq", "offered-by",
]);
/** The card field a slot names (`#/open` -> `open`), or null where the slot names no writable field. */
export function cardField(slot: string): string | null {
  const name = /^#\/([a-z][a-z0-9-]{0,62})$/.exec(slot)?.[1];
  return name === undefined || CARD_HELD_FIELDS.has(name) ? null : name;
}
/** A card field a slot verb never writes: the card's identity or frame, or a name no field takes. */
export const cardSlotHeld = (rec: Pick<SpiritRecord, "uri" | "pet">, slot: string): SpiritRefusal =>
  new SpiritRefusal("spirit-slot-held", `spirit-slot-held: ${rec.uri} answers ${slot} as no writable field (a card's slot names one lower-case field outside ${[...CARD_HELD_FIELDS].join(" ")}); nothing landed. The card's own fields: \`lares tiddler get ${shq(rec.uri)} --recipe default\``, 2);

/** The record a card answers as: its fields as the slots, its record hash as the base every field write names. */
export function cardRecordOf(pet: string, uri: string, out: Record<string, unknown>, sideFields: Record<string, string>): SpiritRecord {
  const { fields, hash } = fieldsAndHashOf(out);
  const slots = Object.keys(fields).filter((k) => cardField(`#/${k}`) !== null).sort().map((k) => {
    const v = String(fields[k] ?? "");
    return { slot: `#/${k}`, bytes: bytesOf(v), first: v.split("\n")[0] ?? null };
  });
  const base = hash ?? "";
  return {
    pet, uri, kind: "card", has: String(out["has"] ?? ""), base, bytes: slots.reduce((n, s) => n + s.bytes, 0), slots, fields,
    budgets: { slot: fields["slot-budget"] === undefined ? null : countField(fields["slot-budget"], 0) || null, record: countField(fields["record-budget"], RECORD_BUDGET_BYTES) },
    every: countField(fields["true-up-every"], TRUE_UP_EVERY),
    id: PET_NAME.test(fields["spirit-id"] ?? "") ? fields["spirit-id"]! : null,
    lease: leaseOf(sideFields["lease"]), distilled: sideFields["distilled"] || fields["distilled"] || null, crossing: sideFields["crossing"] || null,
    side: sideOf(pet), sideFields,
  };
}

// ── THE ʻĀLANA CIRCLE: THE OFFERING AND THE ECHO ──────────────────────────────────────────────────────────────────
/**
 * ʻĀLANA, THE OFFERING (docs/pono/spirit-circle #/the-circle). A summon sets the mandate (the lane's words and their sha256),
 * the lane's memory pointer, the grant's slice and WHO offered it (`hand`, or `seat#<instance>`) on the spirit's shelf,
 * `alana/<pet>`, BEFORE any instance wakes. The spirit door writes the shelf; the tiddler door still reaches the `alana/` prefix
 * (a course item: guard it at the tiddler door as the other door-owned prefixes stand guarded), so a damaged shelf (a hash its
 * words disagree with) FAILS CLOSED: every instance's write refuses `spirit-offering-damaged` until the offerer offers again.
 * AN OFFERING CARRIES NO AUTHORITY BEYOND A NUDGE until per-summon seats get minted (spirit-circle #/admission, #/open): it
 * records its offerer, om names it, and a re-offer over a standing mandate lands only from the same offerer or a hand. HOʻĀLA, THE WAKING: an instance's om pulls the mandate and its hash through the door, and the instance echoes
 * the hash back (`ah <pet> --echo <hash> --instance <id>`); the echo lands on the card's sibling record as `<pet>#<instance> <hash>
 * <seq> h<N>`, the seq door-minted, so no clock orders an echo, and `h<N>` the face that answered the echo (plan/companion-context
 * #/4): the instance stays bound to the face it woke under, and a turned mount meets `spirit-face-turned` (`echoTurned`). Where an offering stands, a slot write from an instance that has not
 * echoed the standing mandate lands and carries an `unechoed:` notice (`echoReceipt`: a receipt, never a gate); a fresh offering
 * asks every instance to echo again.
 * A spirit no summon offered (a familiar) writes as before. The grant rides as a declared slice: the leased register entry it
 * names waits on its own talk-story (ruling 2026-11-25-alana-circle-code).
 */
export const ALANA_WORD = "alana" as const;
export const ALANA_DISPLAY = "ʻālana" as const;
/** The spirit's shelf: where its offering rests. */
export const offeringOf = (pet: string): string => `${MEMORY_PREFIX}${ALANA_WORD}/${pet}`;
/** A mandate's hash: the full sha256 hex of its words. */
export const MANDATE_HASH = /^[0-9a-f]{64}$/;
/** At most this many echoes stand on the sibling record, the highest seq kept; never dropped by age. */
export const ECHO_CAP = 64;

export interface SpiritOffering {
  readonly uri: string; readonly hash: string; readonly seq: number; readonly lane: string; readonly grant: string; readonly text: string;
  /** Who offered: `hand`, or `seat#<instance>`; empty where the shelf names none. */
  readonly offeredBy: string;
  /** The stored hash disagrees with the words (or names no hash): the gate fails closed on it. */
  readonly damaged: boolean;
}

/**
 * The offering the shelf holds, read from its fields: null only where no offering ever landed (no `mandate-hash`, no
 * `offer-seq`); a shelf whose hash disagrees with its words reads `damaged`, never absent, so the gate it holds fails closed.
 */
export function offeringRead(pet: string, fields: Readonly<Record<string, string>>): SpiritOffering | null {
  const hash = fields["mandate-hash"];
  if (hash === undefined && fields["offer-seq"] === undefined) return null;
  const text = fields["text"] ?? "";
  const damaged = hash === undefined || !MANDATE_HASH.test(hash) || sha256HexSync(text) !== hash;
  return { uri: offeringOf(pet), hash: hash ?? "", seq: countField(fields["offer-seq"], 1), lane: fields["lane"] ?? "", grant: fields["grant"] ?? "", text, offeredBy: fields["offered-by"] ?? "", damaged };
}

/** The offerer a summon names: a hand, or a seat by the instance it names (a seat with no instance names none: null). */
export const offererOf = (hand: boolean, instance: string | null): string | null => (hand ? "hand" : instance === null ? null : `seat#${instance}`);

/** A re-offer over a standing mandate lands only from its own offerer or a hand; null where it lands. */
export function offerHeld(pet: string, standing: SpiritOffering | null, offeredBy: string): SpiritRefusal | null {
  if (standing === null || offeredBy === "hand" || (standing.offeredBy !== "" && standing.offeredBy === offeredBy)) return null;
  return new SpiritRefusal("spirit-offer-held", `spirit-offer-held: ${standing.uri} holds a mandate ${standing.offeredBy === "" ? "no offerer names" : `${standing.offeredBy} offered`} (seq ${standing.seq}), and an offering carries no authority to replace another's; nothing landed. The same offerer offers again, or a person's hand at the terminal does: \`lares spirit ah ${pet} --offer --file <mandate>\``, 4);
}

/** A damaged shelf: the refusal every instance's write and echo meets until its offerer offers again. */
export const offeringDamaged = (pet: string, offering: SpiritOffering): SpiritRefusal =>
  new SpiritRefusal("spirit-offering-damaged", `spirit-offering-damaged: ${offering.uri} holds a mandate whose stored hash disagrees with its words (seq ${offering.seq}${offering.offeredBy === "" ? "" : `, offered by ${offering.offeredBy}`}), so the gate holds closed; nothing landed. Its offerer (or a hand) offers again: \`lares spirit ah ${pet} --offer --file <mandate>\`, then each instance wakes and echoes`, 4);

/** The write an offering lands over the shelf's fields read: the words, their hash, the pointer, the slice, and the next door-minted seq. */
export function offeringWrite(was: Readonly<Record<string, string>>, pet: string, words: string, lane: string, grant: string, offeredBy: string): { text: string; fields: Record<string, string>; hash: string; seq: number } {
  const hash = sha256HexSync(words);
  const seq = countField(was["offer-seq"], 0) + 1;
  return {
    text: words, hash, seq,
    fields: { pet, "mandate-hash": hash, "offer-seq": String(seq), lane, grant, "offered-by": offeredBy, description: `${ALANA_DISPLAY} for ${pet}: the mandate a summon offered (seq ${seq}), its lane's memory and its grant's slice` },
  };
}

export interface SpiritEcho {
  readonly tag: string; readonly instance: string; readonly hash: string; readonly seq: number;
  /** The face (handle index) that answered the echo; null on a line that names none (it binds at its next echo). */
  readonly face: number | null;
}
/** The face word an echo line carries: `h<N>`, a handle index. */
const ECHO_FACE = /^h(0|[1-9][0-9]{0,5})$/;
/** The `echoes` field read: one `<pet>#<instance> <mandate hash> <seq> [h<N>]` per line; a line that parses not drops. */
export function echoesOf(raw: string | undefined): SpiritEcho[] {
  return String(raw ?? "").split("\n").flatMap((line) => {
    const m = /^(\S+#([A-Za-z0-9_-]{1,128})) ([0-9a-f]{64}) ([0-9]{1,15})(?: (h[0-9]{1,6}))?$/.exec(line.trim());
    if (!m || (m[5] !== undefined && !ECHO_FACE.test(m[5]))) return [];
    return [{ tag: m[1]!, instance: m[2]!, hash: m[3]!, seq: Number(m[4]), face: m[5] === undefined ? null : Number(m[5].slice(1)) }];
  });
}
/** One echo line as the field holds it: the face word rides fourth where the answering face named one. */
const echoLine = (e: SpiritEcho): string => `${e.tag} ${e.hash} ${e.seq}${e.face === null ? "" : ` h${e.face}`}`;
/**
 * An instance's echo joins the sibling record: its own line replaced, seq = max + 1 inside the CAS write, the highest `ECHO_CAP`
 * kept, and the face that answered (`face`, a handle index; null where the island named none) riding as the line's fourth word.
 */
export function echoJoin(fields: Readonly<Record<string, string>>, pet: string, instance: string, hash: string, face: number | null = null): { seq: number; write: SideWrite } {
  const was = echoesOf(fields["echoes"]);
  const seq = was.reduce((m, e) => Math.max(m, e.seq), 0) + 1;
  const kept = [...was.filter((e) => e.instance !== instance), { tag: `${pet}#${instance}`, instance, hash, seq, face }].sort((x, y) => x.seq - y.seq).slice(-ECHO_CAP);
  return { seq, write: { patch: { echoes: kept.map(echoLine).join("\n") } } };
}
/**
 * THE FACE JOINT (plan/companion-context #/4: finish under the face the echo named, never re-home). An instance whose standing echo
 * names one face, written to while another face answers, refuses by name; the cure names the face it echoed under. Null where the
 * echo names no face, the island names none, the faces agree, or no instance writes.
 */
export function echoTurned(pet: string, sideFields: Readonly<Record<string, string>>, instance: string | null, answered: number | null, verb: string): SpiritRefusal | null {
  if (instance === null || answered === null) return null;
  const echoed = echoesOf(sideFields["echoes"]).find((e) => e.instance === instance)?.face ?? null;
  if (echoed === null || echoed === answered) return null;
  return new SpiritRefusal("spirit-face-turned", `spirit-face-turned: ${pet}#${instance} echoed its mandate under h${echoed}, and h${answered} answered; nothing landed. Name the face: \`lares spirit ${verb} ${pet} … --instance ${instance} --face ${echoed}\``, 4);
}
/** Does this instance's echo of this mandate stand? */
export const echoStands = (sideFields: Readonly<Record<string, string>>, instance: string, hash: string): boolean =>
  echoesOf(sideFields["echoes"]).some((e) => e.instance === instance && e.hash === hash);

/**
 * A RECEIPT, NEVER A GATE (ruling 2026-11-25-one-spirit-record). Where an offering stands, a write naming an instance whose echo of
 * the standing mandate stands writes clean; any other write (an instance that has not echoed, a seat naming no instance) still lands and
 * carries the notice this answers, and echoes stay recorded as lineage. A person's hand (the hand gate's reading, never the
 * harness mark alone) naming no instance writes clean. A damaged shelf alone holds closed: it answers the refusal. Null where the
 * write lands clean.
 */
export function echoReceipt(pet: string, offering: SpiritOffering | null, sideFields: Readonly<Record<string, string>>, instance: string | null, hand: boolean): { refusal: SpiritRefusal } | { notice: string } | null {
  if (offering === null) return null;
  if (instance === null && hand) return null;
  if (offering.damaged) return { refusal: offeringDamaged(pet, offering) };
  if (instance !== null && echoStands(sideFields, instance, offering.hash)) return null;
  return { notice: `unechoed: ${instance === null ? `${pet} (a seat naming no instance)` : `${pet}#${instance}`} has not read mandate ${offering.hash}` };
}

/** The mandate a wake reads ahead of the carrier: its seq, hash, pointer, slice, words (cut) and the echo it asks. */
export function mandateLines(pet: string, offering: SpiritOffering, instance: string | null, echoed: boolean, cut = 1200): string {
  const words = offering.text.length <= cut ? offering.text : `${offering.text.slice(0, cut)}\n… the mandate cut at ${cut} chars; read it whole: lares tiddler get ${shq(offering.uri)} --recipe default`;
  const ask = echoed
    ? `This instance's echo stands (${pet}#${instance}).`
    : `Echo it before any slot write: lares spirit ah ${pet} --echo ${offering.hash} --instance ${instance ?? "<id>"}`;
  if (offering.damaged) return `${ALANA_DISPLAY} · DAMAGED: ${offering.uri} (seq ${offering.seq}${offering.offeredBy === "" ? "" : `, offered by ${offering.offeredBy}`}) holds a hash its words disagree with, so no instance's write lands until its offerer offers again: lares spirit ah ${pet} --offer --file <mandate>`;
  return `${ALANA_DISPLAY} · the mandate offered ${pet} (seq ${offering.seq}, offered by ${offering.offeredBy || "no one named"}; a nudge, no authority) · hash ${offering.hash}\nlane: ${offering.lane || "(none named)"} · grant: ${offering.grant || "(none named)"}\n${words}\n${ask}`;
}
