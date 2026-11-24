/**
 * `lares spirit <om | ah | hum | otakiage | hooili | residue> <pet-name>` — A SPIRIT'S RECORD, BY ITS PET NAME. The carry's
 * verb and name stand in one table (`spirit-words.ts`: `hooili` to type, hoʻoili to read).
 *
 * The pet name does the work: it resolves the record on the worn face's memory stage (recipe default) at `familiar/<pet>` or
 * `spirit/<pet>`; where both stand, the door names both and guesses neither. Beneath the pet name a stable `spirit-id` keys
 * the residue, so a rename keeps om, hum and otakiage finding it. Every read and write rides the tiddler door's own daemon
 * verbs (`tiddler-get`, `meme-patch`, `tiddler-put`, `tiddler-delete`, `wiki-filter`), so the doors' gates stand over each act.
 *
 *   om        (wake, Chaos ✶)       the card: the skinny, #/open, the titles #/attention names, and the latest carry read as
 *                                   testimony (a record moved since it read, a deep chain, a fork), under the wake cap. By
 *                                   `--source`: a resume reads one line, a fork wakes framed as a fork, a compaction names
 *                                   the carry it inherits by hash and first words, a precompact marks the crossing and
 *                                   hands back the record's #/carry-shape. `--body <id>` claims the card's lease (an epoch).
 *   ah        (true, Discord ⏿)     replace one slot (`--file <path|->` · `--text <words>`) or add one line (`--add <line>`),
 *                                   base-checked, inside the slot's budget and the record's
 *   hum       (what remains after the fold, Confusion ◇)   measure each slot; `--fold <slot> --line <n>` moves one line to
 *                                   the ash ledger, and what stays reads as the card
 *   hooili    (the carry, hoʻoili)  land a compaction summary as `hooili/<spirit-id>-<hash12>` with its lineage (`parent`,
 *                                   `record-base`, `depth`, `body`); it writes nothing to the card and hands back the #/bodies
 *                                   line (`<pet>#<body8>`) the next body files through `ah`
 *   residue   (residue)             land a spirit's handback, keyed idempotently (`--key <session:agent>`)
 *   otakiage  (Aftermath ↺)         by a person's hand: write the ash lines ahead, then burn the residue the last distill mark
 *                                   covers and no link still reaches; the card stays
 *
 * FORK THE BODY, FENCE THE CARD. Bodies may divide; writes to the one card take a lease. `om --body <id>` claims it (a new
 * body raises the epoch), and an AI seat's ah, hum and hooili bear `--epoch <n>`: a stale one refuses `spirit-lease-stale`
 * and names the claim. Between the PreCompact mark and the next wake, ah and hum refuse `spirit-crossing`.
 *
 * THE BUDGET REFUSES GROWTH, THE BODY CHOOSES WHAT FOLDS. Budgets and the true-up cadence read from the record's own fields
 * (`slot-budget`, `record-budget`, `true-up-every`), the constants below their defaults. Residue and carries pass the strict
 * secret-shape guard, read uncut, before they land.
 *
 * Meme: lar:///ha.ka.ba/kahua/memory/wave/spirit-om-ah-hum · research: lar:///ha.ka.ba/kahua/memory/research/spirit-lifecycle-code
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { stdin } from "node:process";
import { readOwnHand, type HandReading } from "@lararium/node";
import { redactSecretShapes } from "@lararium/mesh";
import { normalizeMemeSource } from "@lararium/tw5/meme-normalize";
import { stampCarrier } from "@lararium/memetic-frame";
import { COMPACTION_DISPLAY, COMPACTION_WORD } from "../spirit-words.js";
import { harnessSeatMarked } from "../local-connector.js";
import { emit, refuseUsage } from "../render.js";
import { helpLines } from "../command-help.js";
import { DoorUsage, guardDoor, runDoor, wordOf } from "./door-call.js";
import { tableCovers } from "../verb-table.js";
import type { ParsedArgs } from "../parse-args.js";

/** Every verb the spirit door answers. */
export const SPIRIT_VERBS = ["help", "om", "ah", "hum", "otakiage", COMPACTION_WORD, "residue"] as const;
type Verb = (typeof SPIRIT_VERBS)[number];

// ── THE DEFAULTS AND THE ADDRESSES, IN ONE SPOT ───────────────────────────────────────────────────────────────────
/** The memory stage every record and residue rests on. */
export const MEMORY_PREFIX = "lar:///ha.ka.ba/kahua/memory/";
/** Where a pet name resolves. */
export const RECORD_KINDS = ["familiar", "spirit"] as const;
/** The wake's hard cap: SessionStart shows the model a preview past 10,000 chars, so `om` stays under this. */
export const OM_CAP_CHARS = 9000;
/** One slot's body budget, in bytes, where the record names none (`slot-budget`). */
export const SLOT_BUDGET_BYTES = 1024;
/** The record's budget, the sum of its slots' bytes, where the record names none (`record-budget`). */
export const RECORD_BUDGET_BYTES = 6144;
/** Stops between two true-up nudges, where the record names none (`true-up-every`). */
export const TRUE_UP_EVERY = 25;
/** The longest residue a carry or a handback lands; a longer text lands cut (after the guard reads it whole). */
export const RESIDUE_CAP_CHARS = 60_000;
/** A carry past this depth outranks nothing: its chain remembers only itself. */
export const DEEP_CARRY = 3;
/** How long a crossing mark holds ah and hum before it reads stale. */
export const CROSSING_MS = 10 * 60_000;
/** The card's #/open and #/voice, read to the outgoing body at PreCompact, cut here so the carry ask still lands inside 10,000 chars. */
export const PRECOMPACT_CARD_CHARS = 4000;
/** How many titles #/attention names the wake unfolds. */
export const ATTENTION_TITLES = 12;
const RECIPE = "default";
const PET = /^[a-z0-9][a-z0-9-]{0,62}$/;
const SOURCES = ["startup", "resume", "clear", "compact", "fork", "precompact"] as const;
type Source = (typeof SOURCES)[number];

/** The ash ledger of the month a burn lands in (`state/ashes-YYYY-MM`). */
export function ashLedgerOf(now: Date): string {
  return `${MEMORY_PREFIX}state/ashes-${now.toISOString().slice(0, 7)}`;
}
/** A carry's address: two segments under the stage, the spirit's key and the summary's hash. */
export const compactionTitle = (key: string, hash: string): string => `${MEMORY_PREFIX}${COMPACTION_WORD}/${key}-${hash.slice(0, 12)}`;
/** A handback's address. */
export const residueTitle = (key: string, hash: string): string => `${MEMORY_PREFIX}spirit/${key}-handback-${hash.slice(0, 12)}`;
const sha256 = (text: string): string => createHash("sha256").update(text, "utf8").digest("hex");
const bytesOf = (text: string): number => Buffer.byteLength(text, "utf8");
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
const isCarry = (t: string): boolean => t.startsWith(`${MEMORY_PREFIX}${COMPACTION_WORD}/`);

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
const redacted = (text: string): string => redactSecretShapes(text, STRICT).text;

/** The digest a base names, whatever its grain prefix (`skinny:`, `partial:#/x:`). */
const digestOf = (base: string): string => /sha256[:-][0-9a-f]{64}$/.exec(base)?.[0]?.replace("-", ":") ?? base;

/** How otakiage reads the hand behind this command: the house gate over the command's own branch. A suite names its reading. */
export type HandRead = () => HandReading;

class SpiritRefusal extends Error {
  constructor(readonly code: string, message: string, readonly exit = 4) { super(message); }
}

/** Release by the hand: an AI seat on this command's branch, or a branch nothing attests, refuses by the reading's own code. */
function readHand(hand: HandRead, line: string): void {
  const read = hand();
  if (!("refusal" in read)) return;
  throw new SpiritRefusal(read.refusal, read.refusal === "hand-act-only"
    ? `hand-act-only: a release burns by a person's hand at a real terminal, and an AI harness stands on this command's branch. Ask the operator to run \`${line}\` on their own terminal.`
    : `hand-unattested: a release burns by a person's hand at a real terminal, and this command's process chain reads nothing to attest one. Run \`${line}\` on a terminal whose processes the host can read.`, 5);
}

interface Slot { readonly slot: string; readonly bytes: number; readonly first: string | null }
interface Lease { readonly body: string; readonly epoch: number }
interface Record_ {
  readonly pet: string; readonly uri: string; readonly kind: string; readonly has: string; readonly base: string; readonly bytes: number;
  readonly slots: readonly Slot[]; readonly fields: Readonly<Record<string, string>>;
  readonly budgets: { readonly slot: number; readonly record: number }; readonly every: number;
  readonly id: string | null; readonly lease: Lease | null; readonly distilled: string | null; readonly crossing: string | null;
}

/** A positive whole number a field names, else the default. */
const countField = (raw: string | undefined, fallback: number): number => (raw !== undefined && /^[1-9][0-9]{0,6}$/.test(raw.trim()) ? Number(raw.trim()) : fallback);
/** The lease a record's `lease` field holds (`<body> <epoch> <iso>`), or null. */
export function leaseOf(raw: string | undefined): Lease | null {
  const m = /^(\S+) ([1-9][0-9]*)\b/.exec(raw?.trim() ?? "");
  return m ? { body: m[1]!, epoch: Number(m[2]) } : null;
}

function petOf(args: ParsedArgs, verb: string): string {
  const pet = args.positional[1];
  if (!pet) throw new DoorUsage(`a pet name is required (e.g. \`lares spirit ${verb} lares-alpha\`)`);
  if (!PET.test(pet)) throw new SpiritRefusal("spirit-pet-malformed", `spirit-pet-malformed: "${pet}" reads as no pet name (lower-case letters, digits and hyphens); name it as the record does: \`lares wiki filter '[prefix[${MEMORY_PREFIX}familiar/]!regexp[#]]' --recipe default\``, 2);
  return pet;
}

/** One door call; a refusal the door already printed rides out as its exit. */
async function door(args: ParsedArgs, label: string, verb: string, verbArgs: Record<string, unknown>): Promise<Record<string, unknown>> {
  const ran = await runDoor(args, `spirit ${label}`, { verb, args: verbArgs });
  if (!ran.ok) throw new Printed(ran.exit);
  return ran.output;
}
class Printed extends Error { constructor(readonly exit: number) { super("printed"); } }

const titlesOf = (out: Record<string, unknown>): string[] => (Array.isArray(out["titles"]) ? (out["titles"] as string[]) : []);

/** A record's fields, read at the skinny grain on the record lens. */
async function fieldsOf(args: ParsedArgs, label: string, title: string): Promise<Record<string, string>> {
  const out = await door(args, label, "tiddler-get", { recipe: RECIPE, title, grain: "skinny" });
  return (out["tiddler"] as { fields?: Record<string, string> } | null | undefined)?.fields ?? {};
}

/** Resolve a pet name to its record at `familiar/<pet>` or `spirit/<pet>`; both standing refuses, naming both. Null where none answers and `soft`. */
async function resolveRecord(args: ParsedArgs, label: string, pet: string, soft = false): Promise<Record_ | null> {
  const hits: Array<{ kind: string; uri: string; out: Record<string, unknown> }> = [];
  for (const kind of RECORD_KINDS) {
    const uri = `${MEMORY_PREFIX}${kind}/${pet}`;
    const out = await door(args, label, "tiddler-get", { recipe: RECIPE, title: uri, meme: true, grain: "skinny" });
    if (out["meme"]) hits.push({ kind, uri, out });
  }
  if (hits.length > 1) {
    throw new SpiritRefusal("spirit-ambiguous", `spirit-ambiguous: the pet name "${pet}" answers at ${hits.map((h) => h.uri).join(" and ")}; the door guesses neither. Read both (\`lares tiddler get <uri> --recipe default --meme --skinny\`), then rename one: one pet name, one record`, 4);
  }
  const hit = hits[0];
  if (!hit) {
    if (soft) return null;
    throw new SpiritRefusal("spirit-unknown", `spirit-unknown: no record answers the pet name "${pet}" at ${MEMORY_PREFIX}familiar/${pet} or ${MEMORY_PREFIX}spirit/${pet}; list the records: \`lares wiki filter '[prefix[${MEMORY_PREFIX}familiar/]!regexp[#]] [prefix[${MEMORY_PREFIX}spirit/]!regexp[#]]' --recipe default\``, 3);
  }
  const meme = hit.out["meme"] as { canonicalHash?: string; bytes?: number; slots?: Slot[] };
  const fields = await fieldsOf(args, label, hit.uri);
  return {
    pet, uri: hit.uri, kind: hit.kind, has: String(hit.out["has"] ?? ""), base: String(meme.canonicalHash ?? ""), bytes: Number(meme.bytes ?? 0),
    slots: meme.slots ?? [], fields,
    budgets: { slot: countField(fields["slot-budget"], SLOT_BUDGET_BYTES), record: countField(fields["record-budget"], RECORD_BUDGET_BYTES) },
    every: countField(fields["true-up-every"], TRUE_UP_EVERY),
    id: PET.test(fields["spirit-id"] ?? "") ? fields["spirit-id"]! : null,
    lease: leaseOf(fields["lease"]), distilled: fields["distilled"] || null, crossing: fields["crossing"] || null,
  };
}

/** Patch the record's own fields (and unset some), through the tiddler door. */
async function writeFields(args: ParsedArgs, label: string, rec: Record_, patch: Record<string, string>, unset: readonly string[] = []): Promise<void> {
  const receipt = await door(args, label, "tiddler-put", { recipe: RECIPE, title: rec.uri, ...(Object.keys(patch).length > 0 ? { fields: patch } : {}), ...(unset.length > 0 ? { unset: [...unset] } : {}) });
  const decision = String(receipt["decision"] ?? "");
  if (decision !== "put" && decision !== "noop") {
    throw new SpiritRefusal("spirit-write-refused", `spirit-write-refused: the tiddler door answered ${decision || "nothing"} for ${rec.uri}'s fields; read it: \`lares tiddler get ${rec.uri} --recipe default --skinny\``, 4);
  }
}

/** The record's stable key: its `spirit-id`, minted once from its address and the base it first answered. */
async function keyOf(args: ParsedArgs, label: string, rec: Record_): Promise<string> {
  if (rec.id !== null) return rec.id;
  const id = sha256(`${rec.uri}\n${digestOf(rec.base)}`).slice(0, 12);
  await writeFields(args, label, rec, { "spirit-id": id });
  return id;
}

/** One slot read: its framed text, its body, and the partial base that patches it. */
async function readSlot(args: ParsedArgs, label: string, rec: Record_, slot: string): Promise<{ text: string; body: string; base: string } | null> {
  if (!rec.slots.some((s) => s.slot === slot)) return null;
  const out = await door(args, label, "tiddler-get", { recipe: RECIPE, title: rec.uri, meme: true, slot });
  const meme = out["meme"] as { slotText?: string; canonicalHash?: string } | undefined;
  if (typeof meme?.slotText !== "string") return null;
  return { text: meme.slotText, body: slotBody(meme.slotText), base: String(meme.canonicalHash ?? "") };
}

const slotMissing = (rec: Record_, slot: string): SpiritRefusal =>
  new SpiritRefusal("spirit-slot-missing", `spirit-slot-missing: ${rec.uri} holds no slot ${slot}; its slots: ${rec.slots.map((s) => s.slot).join(" ") || "(none)"} (\`lares spirit hum ${rec.pet}\` measures each)`, 3);

// ── the fence ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** The seams a suite names: the hand reading, the clock, and whether an AI seat asks. */
export interface SpiritSeams { readonly hand?: HandRead; readonly now?: () => Date; readonly seat?: () => boolean }
interface Ctx { readonly now: () => Date; readonly seat: () => boolean; readonly hand: HandRead }

/** An AI seat's card write bears the lease's epoch; a person's terminal writes freely. */
function fence(args: ParsedArgs, rec: Record_, ctx: Ctx): void {
  if (rec.lease === null || !ctx.seat()) return;
  const given = wordOf(args.options["epoch"]);
  if (given !== null && Number(given) === rec.lease.epoch) return;
  throw new SpiritRefusal("spirit-lease-stale", `spirit-lease-stale: ${rec.uri}'s card stands leased at epoch ${rec.lease.epoch} by body ${rec.lease.body}${given === null ? ", and this write bears no epoch" : `, and this write bears epoch ${given}`}; nothing landed. Claim the card first (\`lares spirit om ${rec.pet} --body <session id>\` names the epoch), then write with \`--epoch <n>\``, 4);
}

/** Between the PreCompact mark and the next wake (or the mark lapsing), the card takes no slot write. */
function crossingHolds(rec: Record_, ctx: Ctx): void {
  if (rec.crossing === null) return;
  const at = Date.parse(rec.crossing);
  if (!Number.isFinite(at) || ctx.now().getTime() - at > CROSSING_MS) return;
  throw new SpiritRefusal("spirit-crossing", `spirit-crossing: ${rec.uri} stands in the crossing a compaction marked at ${rec.crossing}; nothing landed. The next wake clears it (\`lares spirit om ${rec.pet}\`), or it lapses ${CROSSING_MS / 60_000} minutes on`, 4);
}

// ── the starter shrine ─────────────────────────────────────────────────────────────────────────────────────────────

/** The slots a shrine holds, each with the one-line prompt a first body answers. */
export const SHRINE_SLOTS: ReadonlyArray<readonly [string, string]> = [
  ["#/entry", "! <the pet name> ~ a familiar's record\n\nWho this pet name names, how a body wakes into it, and how the record stays small.\n\n''Named by'' <who> ''on'' <date>; ''renames:'' <old -> new, each as it lands>."],
  ["#/orders", "!! The operator's standing orders\n\nQuote them as given; never paraphrase."],
  ["#/grant", "!! The grant\n\nWhat it covers; what it never covers (the hand acts stay the operator's)."],
  ["#/attention", "!! Where attention starts\n\nThe canon and stage titles to read first, by lar:/// address."],
  ["#/open", "!! Open loops\n\nPR numbers, heads, what each waits on and whose hand it needs."],
  ["#/voice", "!! Tells to catch\n\nA joint to watch, never a debt."],
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

/** A shrine's carrier at `familiar/<pet>`: a whole carrier given, or the slot blocks wrapped in the house frame; resealed. */
export function shrineCarrier(pet: string, words: string): string {
  const uri = `${MEMORY_PREFIX}familiar/${pet}`;
  const source = words.trimStart().startsWith("<<!DOCTYPE") ? words : [
    "<<!DOCTYPE type=`memetic-wikitext+tiddlywiki` spec=`lar:///ha.ka.ba/lares/api/pono/memetic-wikitext`>>", "",
    `<<^ code=\`&#x0001;\` from=\`?\` to=\`${uri}\`>>`, "<<^ code=`&#x0002;`>>", "",
    "```toml meta", "cacheable = false", 'l-space   = "adjacent"', `role      = "the familiar spirit ${pet}'s record; a waking body reads this first"`, 'status    = "live"',
    `title     = "${uri}"`, 'type      = "text/memetic-wikitext+tiddlywiki"', `uri-path  = "${uri.slice("lar:///".length)}"`, "```", "",
    words.replace(/^[\s\S]*?(?=<<~ ahu slot=)/, "").trim(), "",
    "<<^ code=`&#x0003;`>>", "", "<<^ code=`&#x0004;` to=`?`>>", "",
  ].join("\n");
  // The house normalize, then the block check minted over the body it follows (as `lares meme normalize` writes it).
  return stampCarrier(normalizeMemeSource(source).text);
}

async function newShrine(args: ParsedArgs, pet: string): Promise<number> {
  const file = wordOf(args.options["file"]);
  const text = typeof args.options["text"] === "string" ? args.options["text"] : null;
  if (Number(file !== null) + Number(text !== null) !== 1 || args.options["slot"] !== undefined || args.options["add"] !== undefined) {
    throw new DoorUsage(`--new lands a whole shrine from one source: --file <path|-> or --text <words> (no --slot, no --add); \`lares spirit om ${pet}\` prints the skeleton`);
  }
  const standing = await resolveRecord(args, "ah", pet, true);
  if (standing !== null) {
    throw new SpiritRefusal("spirit-exists", `spirit-exists: a record already answers "${pet}" at ${standing.uri}, so --new lands nothing; true its slots instead: \`lares spirit ah ${pet} --slot '#/<name>' --file <path>\``, 4);
  }
  const words = file !== null ? await sourceText("file", file) : text!;
  const shapes = secretCount(words);
  if (shapes > 0) throw new SpiritRefusal("spirit-secret-shaped", `spirit-secret-shaped: the shrine holds ${shapes} secret-shaped string(s), so nothing landed; clear them, then land it again: \`lares spirit ah ${pet} --new --file <scrubbed path>\``, 4);
  const carrier = shrineCarrier(pet, words);
  const uri = `${MEMORY_PREFIX}familiar/${pet}`;
  const receipt = await door(args, "ah", "meme-put", { recipe: RECIPE, uri, text: carrier });
  const decision = String(receipt["decision"] ?? "");
  if (decision !== "ingest" && decision !== "noop") {
    const warnings = Array.isArray(receipt["warnings"]) ? (receipt["warnings"] as string[]) : [];
    throw new SpiritRefusal("spirit-write-refused", `spirit-write-refused: the meme door answered ${decision || "nothing"} for ${uri}${warnings[0] ? ` (${warnings[0]})` : ""}; read the shrine you sent against the skeleton (\`lares spirit om ${pet}\`) and land it again`, 4);
  }
  emit(args, { ok: true, data: { pet, uri, created: true, ...receipt }, human: () => console.log(`landed the shrine: ${uri}\n  wake it: lares spirit om ${pet}`) });
  return 0;
}

// ── om ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

interface Carry { readonly title: string; readonly fields: Readonly<Record<string, string>>; readonly text: string }

/** The latest carry under a spirit's keys, by its `landed` stamp, with its fields and words; null where none stands. */
async function latestCarry(args: ParsedArgs, label: string, keys: readonly string[]): Promise<{ carry: Carry | null; all: string[] }> {
  const filter = keys.map((key) => `[prefix[${MEMORY_PREFIX}${COMPACTION_WORD}/${key}-]]`).join(" ") + " +[!sort[landed]]";
  const all = residueOf(keys, titlesOf(await door(args, label, "wiki-filter", { recipe: RECIPE, filter }))).filter(isCarry);
  const title = all[0];
  if (title === undefined) return { carry: null, all };
  const got = await door(args, label, "tiddler-get", { recipe: RECIPE, title });
  const fields = (got["tiddler"] as { fields?: Record<string, string> } | null | undefined)?.fields ?? {};
  return { carry: { title, fields, text: fields["text"] ?? "" }, all };
}

/** The carry read as testimony: what it names, and each joint where it breaks against the card. */
export function testimonyLines(rec: Pick<Record_, "base">, carry: Carry | null, siblings: number): string[] {
  if (carry === null) return [`Latest ${COMPACTION_DISPLAY}: none stands yet; this wake reads the card alone.`];
  const out = [`Latest ${COMPACTION_DISPLAY} (testimony, never mandate): ${carry.title} (hash ${carry.title.slice(-12)}, depth ${carry.fields["depth"] ?? "?"}, body ${carry.fields["body"] || "?"}); read it: lares tiddler get ${carry.title} --recipe default`];
  const read = carry.fields["record-base"];
  if (read && digestOf(read) !== digestOf(rec.base)) out.push(`⚠ the record moved since this ${COMPACTION_DISPLAY} read it (${digestOf(read).slice(7, 19)} -> ${digestOf(rec.base).slice(7, 19)}): the card outranks the carry.`);
  const depth = Number(carry.fields["depth"] ?? 0);
  if (depth > DEEP_CARRY) out.push(`⚠ this ${COMPACTION_DISPLAY} stands ${depth} deep: a chain past ${DEEP_CARRY} remembers only itself, so it outranks nothing; re-true its handles against gh.`);
  if (siblings > 1) out.push(`⚠ ${siblings} carries name the parent ${carry.fields["parent"]}: a fork; two bodies carried from one wake.`);
  return out;
}

/** Fit the wake's sections under the cap: the fixed lines whole, then #/open, then the attention unfold, each cut where it runs over. */
export function omText(rec: Pick<Record_, "pet" | "uri" | "has">, parts: { open: string | null; testimony?: readonly string[]; attention?: string | null; lead?: string | null }, cap = OM_CAP_CHARS): string {
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

/** The titles a record's #/attention names, unfolded with their descriptions in one filter read. */
async function attentionUnfold(args: ParsedArgs, rec: Record_): Promise<string | null> {
  const slot = await readSlot(args, "om", rec, "#/attention");
  if (slot === null) return null;
  const titles = [...new Set([...slot.body.matchAll(/lar:\/\/\/[^\s`'")\]<>·,]+/g)].map((m) => m[0].replace(/[.;:]+$/, "")))].slice(0, ATTENTION_TITLES);
  if (titles.length === 0) return null;
  const out = await door(args, "om", "wiki-filter", { recipe: RECIPE, filter: titles.map((t) => `[[${t}]]`).join(" "), fields: ["title", "description"] });
  const rows = Array.isArray(out["rows"]) ? (out["rows"] as Array<{ title?: string; fields?: Record<string, string> }>) : [];
  const described = new Map(rows.map((r) => [String(r.title ?? r.fields?.["title"] ?? ""), String(r.fields?.["description"] ?? "")]));
  return [`The titles #/attention names:`, ...titles.map((t) => `${t}${described.get(t) ? ` — ${described.get(t)!.slice(0, 160)}` : described.has(t) ? "" : " (unread here)"}`)].join("\n");
}

/** Claim the card's lease for a body: the body that holds it keeps its epoch; another body raises it. */
async function claimLease(args: ParsedArgs, rec: Record_, body: string, ctx: Ctx): Promise<number> {
  const held = rec.lease;
  const epoch = held !== null && held.body === body ? held.epoch : (held?.epoch ?? 0) + 1;
  if (held === null || held.body !== body) await writeFields(args, "om", rec, { lease: `${body} ${epoch} ${ctx.now().toISOString()}` });
  return epoch;
}

async function om(args: ParsedArgs, ctx: Ctx): Promise<number> {
  const pet = petOf(args, "om");
  const sourceWord = wordOf(args.options["source"]) ?? "startup";
  if (!(SOURCES as readonly string[]).includes(sourceWord)) throw new DoorUsage(`--source names one of ${SOURCES.join(", ")}; got "${sourceWord}"`);
  const source = sourceWord as Source;
  const body = wordOf(args.options["body"]);
  if (body !== null && !/^[A-Za-z0-9_-]{1,128}$/.test(body)) throw new DoorUsage("--body names a session id (letters, digits, '-' and '_')");
  const found = await resolveRecord(args, "om", pet, true);
  if (found === null) {
    // A first wake: no record yet. The body reads the skeleton and lands its own shrine; a precompact hands back no shape.
    const text = source === "precompact" ? "" : starterText(pet);
    emit(args, { ok: true, data: { pet, starter: true, source, every: TRUE_UP_EVERY, carryShape: null, chars: text.length, text }, human: () => console.log(text) });
    return 0;
  }
  const rec = found;
  const key = await keyOf(args, "om", rec);
  const epoch = body !== null ? await claimLease(args, rec, body, ctx) : rec.lease?.epoch ?? null;
  const data = { pet, uri: rec.uri, kind: rec.kind, base: rec.base, spiritId: key, epoch, every: rec.every, budgets: rec.budgets, source };
  if (source === "resume") {
    const text = `Lares spirit om · ${pet}: this body resumes; the card reads ${digestOf(rec.base).slice(7, 19)} now${epoch !== null ? ` (lease epoch ${epoch})` : ""}, and an earlier wake may read stale: lares spirit om ${pet}`;
    emit(args, { ok: true, data: { ...data, chars: text.length, text }, human: () => console.log(text) });
    return 0;
  }
  if (source === "precompact") {
    // The crossing: the card's #/open and #/voice, read to the outgoing body, and the mark that holds slot writes until a body wakes.
    await writeFields(args, "om", rec, { crossing: ctx.now().toISOString() });
    const shape = await readSlot(args, "om", rec, "#/carry-shape");
    const open = await readSlot(args, "om", rec, "#/open");
    const voice = await readSlot(args, "om", rec, "#/voice");
    const { carry } = await latestCarry(args, "om", [key, pet]);
    const text = [open?.body, voice?.body].filter(Boolean).join("\n\n").slice(0, PRECOMPACT_CARD_CHARS);
    emit(args, { ok: true, data: { ...data, carryShape: shape?.body ?? null, inherits: carry === null ? null : carry.title.slice(-12), chars: text.length, text }, human: () => console.log(text) });
    return 0;
  }
  // A waking body ends the crossing: the compaction it marked has turned.
  if (rec.crossing !== null) await writeFields(args, "om", rec, {}, ["crossing"]);
  const { carry, all } = await latestCarry(args, "om", [key, pet]);
  const parent = carry?.fields["parent"];
  const siblings = parent ? (await Promise.all(all.map(async (t) => (t === carry!.title ? parent : (await fieldsOf(args, "om", t))["parent"])))).filter((p) => p === parent).length : 0;
  const testimony = testimonyLines(rec, carry, siblings);
  if (source === "compact" && carry !== null) {
    testimony.push(`This body inherits ${carry.title} (hash ${carry.title.slice(-12)}): "${carry.text.replace(/\s+/g, " ").trim().slice(0, 120)}"`);
  }
  const lead = source === "fork"
    ? `You wake as a fork: another body may still wear ${pet}.${epoch !== null ? ` This wake holds the card's lease at epoch ${epoch}; the other body's next card write refuses until it claims again.` : " Claim the card before you write it: lares spirit om " + pet + " --body <session id>."}`
    : null;
  const open = await readSlot(args, "om", rec, "#/open");
  const attention = await attentionUnfold(args, rec);
  const text = omText(rec, { open: open?.text ?? null, testimony, attention, lead });
  emit(args, {
    ok: true, data: { ...data, latest: carry?.title ?? null, chars: text.length, cap: OM_CAP_CHARS, text },
    human: () => console.log(text),
  });
  return 0;
}

// ── ah ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** What a slot write would leave, measured against both budgets: the refusal where it grows past one, else null. */
export function budgetRefusal(rec: Pick<Record_, "pet" | "uri" | "slots"> & { budgets?: Record_["budgets"] }, slot: string, oldBody: string, newBody: string): SpiritRefusal | null {
  const budgets = rec.budgets ?? { slot: SLOT_BUDGET_BYTES, record: RECORD_BUDGET_BYTES };
  const was = bytesOf(oldBody);
  const now = bytesOf(newBody);
  if (now <= was) return null;
  const fold = `\`lares spirit hum ${rec.pet} --fold '${slot}'\` lists its lines; \`--line <n>\` moves one to the ash ledger`;
  if (now > budgets.slot) return new SpiritRefusal("spirit-slot-over-budget", `spirit-slot-over-budget: ${slot} would hold ${now} bytes, past its ${budgets.slot}-byte budget (it holds ${was}); nothing landed. Fold first: ${fold}, then true it again`);
  const total = rec.slots.reduce((n, s) => n + s.bytes, 0) + (now - was);
  if (total > budgets.record) return new SpiritRefusal("spirit-record-over-budget", `spirit-record-over-budget: ${rec.uri} would hold ${total} bytes across its slots, past its ${budgets.record}-byte budget; nothing landed. \`lares spirit hum ${rec.pet}\` names the heaviest slots; ${fold}`);
  return null;
}

async function sourceText(flag: "file", source: string): Promise<string> {
  if (source !== "-") {
    try { return readFileSync(source, "utf8"); } catch { throw new DoorUsage(`cannot read --${flag} ${source}`); }
  }
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks).toString("utf8");
}

/** Replace one slot's body under a base, both budgets checked; answers the patch receipt or refuses by name. */
async function trueSlot(args: ParsedArgs, label: string, rec: Record_, slot: string, next: (body: string) => string, given: string | null): Promise<Record<string, unknown>> {
  const read = await readSlot(args, label, rec, slot);
  if (read === null) throw slotMissing(rec, slot);
  if (given !== null && digestOf(given) !== digestOf(read.base)) {
    throw new SpiritRefusal("spirit-stale-base", `spirit-stale-base: ${rec.uri} moved past ${given}; it reads ${read.base} now and nothing landed. Read it again (\`lares spirit om ${rec.pet}\` or \`lares tiddler get ${rec.uri} --recipe default --meme --slot '${slot}'\`) and true it against that base`, 4);
  }
  const body = next(read.body).replace(/^\n+/, "").replace(/\s+$/, "");
  const shapes = secretCount(body);
  if (shapes > 0) {
    throw new SpiritRefusal("spirit-secret-shaped", `spirit-secret-shaped: the words for ${rec.uri}${slot} hold ${shapes} secret-shaped string(s), so nothing landed; clear them, then true the slot again: \`lares spirit ah ${rec.pet} --slot '${slot}' --file <scrubbed path>\``, 4);
  }
  const over = budgetRefusal(rec, slot, read.body, body);
  if (over) throw over;
  const receipt = await door(args, label, "meme-patch", { recipe: RECIPE, uri: rec.uri, slot, replace: body, base: given ?? read.base });
  const decision = String(receipt["decision"] ?? "");
  if (decision === "conflict") {
    throw new SpiritRefusal("spirit-stale-base", `spirit-stale-base: ${rec.uri} moved under the write; it reads ${String(receipt["canonicalHash"] ?? "?")} now and nothing landed. Run \`lares spirit ${label} ${rec.pet} …\` again over the live record`, 4);
  }
  if (decision !== "ingest" && decision !== "noop") {
    const warnings = Array.isArray(receipt["warnings"]) ? (receipt["warnings"] as string[]) : [];
    throw new SpiritRefusal("spirit-write-refused", `spirit-write-refused: the meme door answered ${decision || "nothing"} for ${rec.uri}${slot}${warnings[0] ? ` (${warnings[0]})` : ""}; read the record (\`lares tiddler get ${rec.uri} --recipe default --meme --all\`) before you true it again`, 4);
  }
  return { ...receipt, bytes: bytesOf(body), was: bytesOf(read.body) };
}

async function ah(args: ParsedArgs, ctx: Ctx): Promise<number> {
  const pet = petOf(args, "ah");
  if (args.flags["new"] === true) return await newShrine(args, pet);
  const slot = wordOf(args.options["slot"]);
  if (!slot || !/^#\/[^\s$]+$/.test(slot)) throw new DoorUsage(`--slot '#/<name>' names the slot to true (\`lares spirit hum ${pet}\` lists them)`);
  const file = wordOf(args.options["file"]);
  const text = typeof args.options["text"] === "string" ? args.options["text"] : null;
  const add = typeof args.options["add"] === "string" ? args.options["add"] : null;
  if (Number(file !== null) + Number(text !== null) + Number(add !== null) !== 1) {
    throw new DoorUsage("name exactly one source: --file <path|-> or --text <words> (the slot's whole body), or --add <line> (one line at its end)");
  }
  const rec = (await resolveRecord(args, "ah", pet))!;
  fence(args, rec, ctx);
  crossingHolds(rec, ctx);
  const words = file !== null ? await sourceText("file", file) : text;
  const line = add?.replace(/\s+/g, " ").trim() ?? null;
  if (line === "") throw new DoorUsage("--add names one non-empty line");
  const receipt = await trueSlot(args, "ah", rec, slot, (body) => (line !== null ? `${body}\n${line}` : words!), wordOf(args.options["base"]));
  // A tell distilled into #/voice sets the distill mark: otakiage burns only residue that landed before it.
  if (slot === "#/voice") await writeFields(args, "ah", rec, { distilled: ctx.now().toISOString() });
  emit(args, {
    ok: true, data: { pet, uri: rec.uri, slot, ...receipt },
    human: () => console.log(`${String(receipt["decision"])}: ${rec.uri}${slot} (${String(receipt["bytes"])} of ${rec.budgets.slot} bytes)\n  base: ${String(receipt["canonicalHash"] ?? "")}`),
  });
  return 0;
}

// ── hum ────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Each slot against its budget, and the record's total against its own. */
export function measure(rec: Pick<Record_, "slots"> & { budgets?: Record_["budgets"] }): { slots: Array<Slot & { budget: number; over: boolean }>; total: number; budget: number; over: boolean } {
  const budgets = rec.budgets ?? { slot: SLOT_BUDGET_BYTES, record: RECORD_BUDGET_BYTES };
  const slots = rec.slots.map((s) => ({ ...s, budget: budgets.slot, over: s.bytes > budgets.slot }));
  const total = rec.slots.reduce((n, s) => n + s.bytes, 0);
  return { slots, total, budget: budgets.record, over: total > budgets.record };
}

/** Append lines to the month's ash ledger, each redacted under the strict reading; `create` opens the month's ledger where none stands. */
async function burnToAshes(args: ParsedArgs, label: string, lines: readonly string[], now: Date): Promise<string> {
  const ledger = ashLedgerOf(now);
  const receipt = await door(args, label, "tiddler-put", {
    recipe: RECIPE, title: ledger, append: lines.map(redacted).join("\n"), create: true,
    fields: { description: `The ash ledger of the ${now.toISOString().slice(0, 7)} o-takiage sittings: each burned stage item with what landed it and the date.` },
  });
  const decision = String(receipt["decision"] ?? "");
  if (decision !== "put" && decision !== "noop") {
    throw new SpiritRefusal("spirit-ashes-refused", `spirit-ashes-refused: the ash ledger ${ledger} answered ${decision || "nothing"}; read it: \`lares tiddler get ${ledger} --recipe default\`, then run \`lares spirit ${label} …\` again`, 4);
  }
  return ledger;
}

async function hum(args: ParsedArgs, ctx: Ctx): Promise<number> {
  const pet = petOf(args, "hum");
  const rec = (await resolveRecord(args, "hum", pet))!;
  const fold = wordOf(args.options["fold"]);
  const lineWord = wordOf(args.options["line"]);
  if (lineWord !== null && fold === null) throw new DoorUsage(`--line <n> rides beside --fold '#/<slot>' (\`lares spirit hum ${pet} --fold '#/bodies' --line 3\`)`);
  if (fold === null) {
    const m = measure(rec);
    const over = m.slots.filter((s) => s.over);
    emit(args, {
      ok: true, data: { pet, uri: rec.uri, ...m, every: rec.every, oversize: over.map((s) => s.slot) },
      human: () => {
        console.log(`lares spirit hum ${pet} · ${rec.uri}`);
        for (const s of m.slots) console.log(`  ${s.over ? "⚠" : " "} ${s.slot.padEnd(14)} ${String(s.bytes).padStart(5)} / ${s.budget}`);
        console.log(`  ${m.over ? "⚠" : " "} ${"total".padEnd(14)} ${String(m.total).padStart(5)} / ${m.budget}`);
        if (over.length > 0) console.log(`  fold a line from each: lares spirit hum ${pet} --fold '${over[0]!.slot}' (lists its lines), then --line <n>`);
      },
    });
    return 0;
  }
  const read = await readSlot(args, "hum", rec, fold);
  if (read === null) throw slotMissing(rec, fold);
  const lines = read.body.split("\n");
  if (lineWord === null) {
    emit(args, {
      ok: true, data: { pet, uri: rec.uri, slot: fold, lines: lines.map((text, i) => ({ n: i + 1, text })) },
      human: () => {
        console.log(`${rec.uri}${fold}: pick the line to fold with --line <n>`);
        lines.forEach((text, i) => console.log(`  ${String(i + 1).padStart(3)}  ${text}`));
      },
    });
    return 0;
  }
  fence(args, rec, ctx);
  crossingHolds(rec, ctx);
  const n = /^[1-9][0-9]*$/.test(lineWord) ? Number(lineWord) : NaN;
  const picked = Number.isInteger(n) ? lines[n - 1] : undefined;
  if (picked === undefined || picked.trim() === "") {
    throw new DoorUsage(`--line ${lineWord} names no line holding words in ${fold} (it holds ${lines.length}); \`lares spirit hum ${pet} --fold '${fold}'\` numbers them`);
  }
  // The words reach the ledger first, so a write that refuses after leaves them in two places, never in none.
  const stamp = ctx.now();
  const ledger = await burnToAshes(args, "hum", [`* ${stamp.toISOString().slice(0, 10)} · hum ${pet} folded from ${rec.uri}${fold}: ${picked.trim()}`], stamp);
  const kept = lines.filter((_, i) => i !== n - 1).join("\n");
  const receipt = await trueSlot(args, "hum", rec, fold, () => kept, read.base);
  await writeFields(args, "hum", rec, { distilled: stamp.toISOString() });
  emit(args, {
    ok: true, data: { pet, uri: rec.uri, slot: fold, folded: picked.trim(), ledger, ...receipt },
    human: () => console.log(`folded line ${n} of ${rec.uri}${fold} into ${ledger}\n  ${picked.trim()}\n  base: ${String(receipt["canonicalHash"] ?? "")}`),
  });
  return 0;
}

// ── the carry · residue ────────────────────────────────────────────────────────────────────────────────────────────

/** The residue's words, read whole: the strict guard reads the UNCUT text, and only then the text cuts at the cap. */
async function residueWords(args: ParsedArgs, label: string): Promise<{ text: string; cut: boolean }> {
  const file = wordOf(args.options["file"]);
  const inline = typeof args.options["text"] === "string" ? args.options["text"] : null;
  if (Number(file !== null) + Number(inline !== null) !== 1) throw new DoorUsage("name exactly one source: --file <path|-> (stdin carries a long text) or --text <words>");
  const raw = file !== null ? await sourceText("file", file) : inline!;
  if (raw.trim() === "") throw new DoorUsage("the residue holds no words; nothing lands");
  const shapes = secretCount(raw);
  if (shapes > 0) {
    throw new SpiritRefusal("spirit-secret-shaped", `spirit-secret-shaped: the ${label} holds ${shapes} secret-shaped string(s), so nothing landed; clear them at the source, then land it by hand: \`lares spirit ${label} <pet> --file <scrubbed path>\``, 4);
  }
  return raw.length > RESIDUE_CAP_CHARS ? { text: raw.slice(0, RESIDUE_CAP_CHARS), cut: true } : { text: raw, cut: false };
}

/** Land one residue record, already guarded; a record already standing at the address lands nothing. */
async function landResidue(args: ParsedArgs, label: string, title: string, text: string, fields: Record<string, string>): Promise<"put" | "exists"> {
  const receipt = await door(args, label, "tiddler-put", { recipe: RECIPE, title, text, create: true, fields });
  const decision = String(receipt["decision"] ?? "");
  if (decision === "put") return "put";
  if (decision === "exists") return "exists";
  throw new SpiritRefusal("spirit-write-refused", `spirit-write-refused: the tiddler door answered ${decision || "nothing"} for ${title}; read it: \`lares tiddler get ${title} --recipe default\``, 4);
}

/** The #/bodies line a carry asks the next body to file: the date, the carry's name and hash, the body fragment, its address. */
export const bodiesLine = (day: string, hash: string, pet: string, body: string, title: string): string =>
  `* ''${day} (${COMPACTION_DISPLAY} ${hash.slice(0, 12)}) ${body ? `${pet}#${body.slice(0, 8)}` : pet}:'' ${title}`;

/**
 * HOOKS NEVER WRITE THE CARD. The carry lands as its own record, with its lineage, and touches the card not at all: no
 * #/bodies line, no field. The answer hands back the line for the next body to file through `ah` (the true-up names it).
 */
async function landCarry(args: ParsedArgs, ctx: Ctx): Promise<number> {
  const pet = petOf(args, COMPACTION_WORD);
  const rec = (await resolveRecord(args, COMPACTION_WORD, pet))!;
  fence(args, rec, ctx);
  const body = wordOf(args.options["body"]) ?? "";
  const { text, cut } = await residueWords(args, COMPACTION_WORD);
  const key = rec.id ?? pet;
  const { carry: parent } = await latestCarry(args, COMPACTION_WORD, [...new Set([key, pet])]);
  const hash = sha256(text);
  const title = compactionTitle(key, hash);
  const stamp = ctx.now();
  const day = stamp.toISOString().slice(0, 10);
  const depth = parent === null ? 1 : countField(parent.fields["depth"], 1) + 1;
  const landed = await landResidue(args, COMPACTION_WORD, title, text, {
    description: `a ${COMPACTION_DISPLAY} of ${pet}, ${day}: the summary one body's context turned on`,
    landed: stamp.toISOString(), "spirit-id": key, pet, parent: parent === null ? "" : parent.title.slice(-12),
    "record-base": digestOf(rec.base), depth: String(depth), body,
  });
  const line = bodiesLine(day, hash, pet, body, title);
  const fileIt = `lares spirit ah ${pet} --slot '#/bodies' --add "${line.replace(/"/g, '\\"')}"`;
  emit(args, {
    ok: true, data: { pet, uri: rec.uri, spiritId: key, title, hash, depth, parent: parent?.title ?? null, landed, cut, filed: false, bodiesLine: line, unfiled: `file the ${COMPACTION_DISPLAY}'s #/bodies line: ${fileIt}` },
    human: () => {
      console.log(`${landed === "put" ? "landed" : "already stands"}: ${title} (depth ${depth})${cut ? ` (cut at ${RESIDUE_CAP_CHARS} chars)` : ""}`);
      console.log(`  the card stays untouched; file its line by your own act: ${fileIt}`);
    },
  });
  return 0;
}

async function residue(args: ParsedArgs, ctx: Ctx): Promise<number> {
  const pet = petOf(args, "residue");
  const { text, cut } = await residueWords(args, "residue");
  const rec = await resolveRecord(args, "residue", pet, true);
  const key = rec === null ? pet : await keyOf(args, "residue", rec);
  // An idempotent key: the same handback from the same session and agent lands once, however often a hook fires.
  const salt = wordOf(args.options["key"]);
  const hash = sha256(salt === null ? text : `${salt}\n${text}`);
  const title = residueTitle(key, hash);
  const landed = await landResidue(args, "residue", title, text, { description: `a handback of the spirit ${pet}, ${ctx.now().toISOString().slice(0, 10)}`, landed: ctx.now().toISOString(), pet });
  emit(args, {
    ok: true, data: { pet, title, hash, landed, cut },
    human: () => console.log(`${landed === "put" ? "landed" : "already stands"}: ${title}${cut ? ` (cut at ${RESIDUE_CAP_CHARS} chars)` : ""}`),
  });
  return 0;
}

// ── otakiage ───────────────────────────────────────────────────────────────────────────────────────────────────────

async function otakiage(args: ParsedArgs, ctx: Ctx): Promise<number> {
  const pet = petOf(args, "otakiage");
  readHand(ctx.hand, `lares spirit otakiage ${pet}`);
  const rec = (await resolveRecord(args, "otakiage", pet))!;
  const key = await keyOf(args, "otakiage", rec);
  const keys = [...new Set([key, pet])];
  const filter = keys.flatMap((k) => [`[prefix[${MEMORY_PREFIX}${COMPACTION_WORD}/${k}-]]`, `[prefix[${MEMORY_PREFIX}spirit/${k}-handback-]]`]).join(" ");
  const titles = residueOf(keys, titlesOf(await door(args, "otakiage", "wiki-filter", { recipe: RECIPE, filter })));
  const stamp = ctx.now();
  const day = stamp.toISOString().slice(0, 10);
  // Hold what the last distill mark leaves uncovered and what a link still reaches; burn the rest.
  const burnable: Array<{ title: string; line: string }> = [];
  const held: Array<{ title: string; why: string }> = [];
  for (const title of titles) {
    const got = await door(args, "otakiage", "tiddler-get", { recipe: RECIPE, title });
    const t = got["tiddler"] as { fields?: Record<string, string>; textHash?: string | null } | null | undefined;
    const fields = t?.fields ?? {};
    const landed = fields["landed"] ?? "";
    if (rec.distilled === null || landed === "" || landed >= rec.distilled) { held.push({ title, why: rec.distilled === null ? "no distill mark stands yet" : "landed after the last distill mark" }); continue; }
    const links = titlesOf(await door(args, "otakiage", "wiki-filter", { recipe: RECIPE, filter: `[[${title}]backlinks[]]` }));
    if (links.length > 0) { held.push({ title, why: `${links.length} link(s) still reach it (${links.slice(0, 3).join(", ")})` }); continue; }
    const text = fields["text"] ?? "";
    const first = text.split("\n").find((l) => l.trim() !== "")?.trim().slice(0, 200) ?? "";
    burnable.push({ title, line: `* ${day} · otakiage ${pet} burning ${title} (${bytesOf(text)} bytes, ${t?.textHash ?? "?"})${first ? `: ${first}` : ""}` });
  }
  // Write ahead: the ash lines land first, so a burn that stops halfway reads its own intent; a re-run completes it.
  const ledger = burnable.length > 0 ? await burnToAshes(args, "otakiage", burnable.map((b) => b.line), stamp) : null;
  const burned: string[] = [];
  for (const { title } of burnable) {
    const gone = await door(args, "otakiage", "tiddler-delete", { recipe: RECIPE, title });
    if (String(gone["decision"] ?? "") === "removed") burned.push(title);
  }
  if (ledger !== null) await burnToAshes(args, "otakiage", [`* ${day} · otakiage ${pet} burned ${burned.length} of ${burnable.length}${burned.length < burnable.length ? `; still standing: ${burnable.map((b) => b.title).filter((t) => !burned.includes(t)).join(", ")}` : ""}`], stamp);
  emit(args, {
    ok: true, data: { pet, uri: rec.uri, kept: rec.uri, burned, held, ledger },
    human: () => {
      console.log(`lares spirit otakiage ${pet}: the card stays at ${rec.uri}`);
      if (burned.length === 0 && held.length === 0) console.log("  no residue stands under this spirit");
      for (const title of burned) console.log(`  burned ${title}`);
      for (const h of held) console.log(`  held ${h.title}: ${h.why}`);
      if (ledger) console.log(`  ashes: ${ledger}`);
      console.log(`  distill what the residue taught into #/voice (it sets the distill mark): lares spirit ah ${pet} --slot '#/voice' --add '<tell>'`);
    },
  });
  return 0;
}

// ── the door ───────────────────────────────────────────────────────────────────────────────────────────────────────

export async function cmdSpirit(args: ParsedArgs, seams: SpiritSeams = {}): Promise<number> {
  const verb = args.positional[0];
  if (!verb || verb === "help" || !(SPIRIT_VERBS as readonly string[]).includes(verb)) {
    return refuseUsage(args, "spirit", helpLines("spirit"), verb === undefined || verb === "help" ? undefined : `unknown verb "${verb}"`);
  }
  const ctx: Ctx = {
    hand: seams.hand ?? (() => readOwnHand({ proveRoute: false })),
    now: seams.now ?? (() => new Date()),
    seat: seams.seat ?? (() => harnessSeatMarked()),
  };
  return guardDoor(args, `spirit ${verb}`, async () => {
    try {
      const v = verb as Exclude<Verb, "help">;
      switch (v) {
        case "om":            return await om(args, ctx);
        case "ah":            return await ah(args, ctx);
        case "hum":           return await hum(args, ctx);
        case COMPACTION_WORD: return await landCarry(args, ctx);
        case "residue":       return await residue(args, ctx);
        case "otakiage":      return await otakiage(args, ctx);
        default:              return refuseUsage(args, "spirit", helpLines("spirit"), `unknown verb "${tableCovers(v)}"`);
      }
    } catch (e) {
      if (e instanceof Printed) return e.exit;
      if (e instanceof SpiritRefusal) {
        emit(args, { ok: false, error: { code: e.code, message: e.message }, human: () => console.error(`lares spirit ${verb}: ${e.message}`) });
        return e.exit;
      }
      throw e;
    }
  });
}
