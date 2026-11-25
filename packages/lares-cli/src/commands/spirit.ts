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
 *                                   hands back the record's #/carry-shape. `--body <id>` names the waking body: it joins the
 *                                   presence on the card's sibling record, stamps a wake epoch (an ordering stamp, never a
 *                                   fence), and hands back each slot's digest.
 *   ah        (true, Discord ⏿)     replace one slot (`--file <path|->` · `--text <words>`) or add one line (`--add <line>`),
 *                                   base-checked; only the waking slots (#/open, #/attention) hold a cap
 *   hum       (what remains after the fold, Confusion ◇)   measure each slot; `--fold <slot> --line <n>` moves one line to
 *                                   the ash ledger, and what stays reads as the card
 *   hooili    (the carry, hoʻoili)  land a compaction summary as `hooili/<spirit-id>-<hash12>` with its lineage (`parent`,
 *                                   `record-base`, `depth`, `body`); it writes nothing to the card and hands back the #/bodies
 *                                   line (`<pet>#<body8>`) the next body files through `ah`
 *   residue   (residue)             land a spirit's handback, keyed idempotently (`--key <session:agent>`)
 *   otakiage  (Aftermath ↺)         by a person's hand: write the ash lines ahead, then burn the residue the last distill mark
 *                                   covers and no link still reaches; the card stays
 *
 * BUNREI: THE KAMI DIVIDES UNDIMINISHED. Many bodies may wear one pet at once, and none locks another out. What orders bodies
 * rides the card's sibling record (`sideOf`, outside the carrier's render, so no wake moves the card's base): each waking body
 * names itself in `bodies-awake` (`<pet>#<body> <iso>`, refreshed at wakes only, a stale entry dropping after `PRESENCE_STALE_MS`,
 * at most `PRESENCE_CAP`), and om names the siblings awake and each live body's last carry. Concurrent writes merge: `ah --add`
 * appends and re-reads past a conflict, so a sibling's line survives; a whole-slot replace names the slot digest it read
 * (`--base`, required of an AI seat; om hands each slot's back) and, where the slot moved since, lands both versions in a
 * marked conflict stanza naming this writer and the slot's last writer, for hum to settle; hum's fold finds its line by content
 * and burns it only once the patch lands. Each body's hoʻoili chain runs its own lineage. The crossing runs per body and stays
 * advisory: between a body's PreCompact mark and its own next wake, that body's ah and hum (`--body`) refuse `spirit-crossing`.
 *
 * THE WAKING CAPS REFUSE GROWTH, THE BODY CHOOSES WHAT FOLDS; THE REST ADVISES. Budgets and the true-up cadence read from the record's own fields
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
import { CARRIER_TYPE } from "@lararium/mesh/carrier-type";
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
/** How long a body's `bodies-awake` entry stands without a wake refreshing it before it drops as stale. */
export const PRESENCE_STALE_MS = 30 * 60_000;
/** At most this many bodies stand in a card's presence; the newest wakes keep their places. */
export const PRESENCE_CAP = 16;
/** How long a crossing mark holds ah and hum before it reads stale. */
export const CROSSING_MS = 10 * 60_000;
/** The card's #/open and #/kulana, read to the outgoing body at PreCompact, cut here so the carry ask still lands inside 10,000 chars. */
export const PRECOMPACT_CARD_CHARS = 4000;
/** How many titles #/attention names the wake unfolds. */
export const ATTENTION_TITLES = 12;
const RECIPE = "default";
const PET = /^[a-z0-9][a-z0-9-]{0,62}$/;
/** A body names itself by its session id. */
const BODY = /^[A-Za-z0-9_-]{1,128}$/;
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
/** One shell word, single-quoted: what every suggested command wraps a title or a line in. */
export const shq = (word: string): string => `'${word.replace(/'/g, `'\\''`)}'`;
const sha256 = (text: string): string => createHash("sha256").update(text, "utf8").digest("hex");
/** A slot's digest: the first 16 hex of the sha256 of its body, the grain a whole-slot write names as `--base`. */
export const slotDigest = (body: string): string => sha256(body).slice(0, 16);
const SLOT_DIGEST = /^[0-9a-f]{16}$/;
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
  readonly budgets: { readonly slot: number | null; readonly record: number }; readonly every: number;
  readonly id: string | null; readonly lease: Lease | null; readonly distilled: string | null; readonly crossing: string | null;
  /** The sibling record's address and fields (see `sideOf`). */
  readonly side: string; readonly sideFields: Readonly<Record<string, string>>;
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

/** A record's fields and its live hash (the base a put names), read on the record lens. */
async function recordOf(args: ParsedArgs, label: string, title: string): Promise<{ fields: Record<string, string>; hash: string | null }> {
  const out = await door(args, label, "tiddler-get", { recipe: RECIPE, title });
  const t = out["tiddler"] as { fields?: Record<string, string>; hash?: string } | null | undefined;
  return { fields: t?.fields ?? {}, hash: typeof t?.hash === "string" && !t.hash.startsWith("skinny:") ? t.hash : null };
}
const fieldsOf = async (args: ParsedArgs, label: string, title: string): Promise<Record<string, string>> => (await recordOf(args, label, title)).fields;

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
  const side = sideOf(pet);
  const sideFields = await fieldsOf(args, label, side);
  return {
    pet, uri: hit.uri, kind: hit.kind, has: String(hit.out["has"] ?? ""), base: String(meme.canonicalHash ?? ""), bytes: Number(meme.bytes ?? 0),
    slots: meme.slots ?? [], fields,
    budgets: { slot: fields["slot-budget"] === undefined ? null : countField(fields["slot-budget"], 0) || null, record: countField(fields["record-budget"], RECORD_BUDGET_BYTES) },
    every: countField(fields["true-up-every"], TRUE_UP_EVERY),
    id: PET.test(fields["spirit-id"] ?? "") ? fields["spirit-id"]! : null,
    lease: leaseOf(sideFields["lease"]), distilled: sideFields["distilled"] || fields["distilled"] || null, crossing: sideFields["crossing"] || null,
    side, sideFields,
  };
}

/** How many times a fold's ash write tries before the line returns to its slot. */
const ASH_ROUNDS = 3;
/** How many times a field write reads again over a record that moved under it before it refuses. */
const CAS_ROUNDS = 4;

/**
 * A COMPARE-AND-SWAP ON THE RECORD'S FIELDS. Each round reads the fields and their live hash, asks `change` what to write over
 * them (null writes nothing), and puts under that hash as its base; a record that moved meanwhile answers `conflict`, and the
 * round reads again, bounded. Answers the fields the write landed over.
 */
async function casFields(args: ParsedArgs, label: string, uri: string, change: (fields: Record<string, string>) => { patch?: Record<string, string>; unset?: readonly string[] } | null): Promise<Record<string, string>> {
  for (let round = 0; round < CAS_ROUNDS; round++) {
    const { fields, hash } = await recordOf(args, label, uri);
    const wants = change(fields);
    if (wants === null) return fields;
    const receipt = await door(args, label, "tiddler-put", {
      recipe: RECIPE, title: uri, ...(hash !== null ? { base: hash } : {}),
      ...(wants.patch && Object.keys(wants.patch).length > 0 ? { fields: wants.patch } : {}), ...(wants.unset && wants.unset.length > 0 ? { unset: [...wants.unset] } : {}),
    });
    const decision = String(receipt["decision"] ?? "");
    if (decision === "put" || decision === "noop") return fields;
    if (decision !== "conflict") throw new SpiritRefusal("spirit-write-refused", `spirit-write-refused: the tiddler door answered ${decision || "nothing"} for ${uri}'s fields; read it: \`lares tiddler get ${shq(uri)} --recipe default --skinny\``, 4);
  }
  throw new SpiritRefusal("spirit-write-refused", `spirit-write-refused: ${uri} kept moving under ${CAS_ROUNDS} reads, so its fields took nothing; run the act again once the record settles`, 4);
}

/** Patch the record's own fields (and unset some), under its live hash. */
async function writeFields(args: ParsedArgs, label: string, rec: Record_, patch: Record<string, string>, unset: readonly string[] = []): Promise<void> {
  await casFields(args, label, rec.uri, () => ({ patch, unset }));
}

/** Patch the card's sibling record (presence, epoch, crossing, distill mark, last writers), under its live hash; never the card. */
async function writeSide(args: ParsedArgs, label: string, rec: Record_, patch: Record<string, string>, unset: readonly string[] = []): Promise<void> {
  await casFields(args, label, rec.side, () => ({ patch, unset }));
}

/** The side field naming a slot's last writer (`#/open` -> `writer-open`). */
const writerField = (slot: string): string => `writer-${slot.replace(/^#\//, "").replace(/[^A-Za-z0-9-]+/g, "-")}`;

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

// ── the crossing ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** The seams a suite names: the hand reading, the clock, and whether an AI seat asks. */
export interface SpiritSeams { readonly hand?: HandRead; readonly now?: () => Date; readonly seat?: () => boolean }
interface Ctx { readonly now: () => Date; readonly seat: () => boolean; readonly hand: HandRead }

/** The `crossing` field read: one `<body> <iso>` per line, keyed on the full body id; a bare iso (a mark naming no body) reads as expired and drops. */
export function crossingsOf(raw: string | null | undefined): Array<{ who: string; at: string }> {
  return String(raw ?? "").split("\n").flatMap((line) => {
    const m = /^([A-Za-z0-9_-]{1,128}) (\S+)$/.exec(line.trim());
    return m ? [{ who: m[1]!, at: m[2]! }] : [];
  });
}
const crossingLive = (c: { at: string }, now: number): boolean => { const t = Date.parse(c.at); return Number.isFinite(t) && now - t <= CROSSING_MS; };

/**
 * THE CROSSING RUNS PER BODY, AND STAYS ADVISORY. Only the PreCompact hook marks it (`om --source precompact --body <id>`), and
 * between that mark and the same body's next wake (or the mark lapsing) a write naming that body (`--body`) refuses; a sibling,
 * or a write naming no body, writes freely. It guards a body from writing over its own folding, never a card from its siblings.
 */
function crossingHolds(rec: Record_, ctx: Ctx, body: string | null): void {
  if (body === null) return;
  if (!BODY.test(body)) throw new DoorUsage("--body names a session id (letters, digits, '-' and '_')");
  const mark = crossingsOf(rec.crossing).find((c) => c.who === body && crossingLive(c, ctx.now().getTime()));
  if (mark === undefined) return;
  throw new SpiritRefusal("spirit-crossing", `spirit-crossing: body #${body.slice(0, 8)} stands in the crossing of its own compaction on ${rec.uri}, marked at ${mark.at}; nothing landed. The mark advises only and holds this body alone (advisory); sibling bodies write on. This body's next wake clears it (\`lares spirit om ${rec.pet} --body ${body}\`), or it lapses ${CROSSING_MS / 60_000} minutes on`, 4);
}

/** Mark (or clear) the crossing one body holds on the sibling record, keeping each live mark a sibling holds; CAS, re-read past a conflict. */
async function markCrossing(args: ParsedArgs, rec: Record_, body: string, ctx: Ctx, mark: boolean): Promise<void> {
  const now = ctx.now();
  await casFields(args, "om", rec.side, (fields) => {
    const was = crossingsOf(fields["crossing"]);
    const kept = was.filter((c) => c.who !== body && crossingLive(c, now.getTime()));
    const next = mark ? [...kept, { who: body, at: now.toISOString() }] : kept;
    if (!mark && next.length === was.length && (fields["crossing"] ?? "").split("\n").filter((l) => l.trim() !== "").length === was.length) return null;
    return next.length > 0 ? { patch: { crossing: next.map((c) => `${c.who} ${c.at}`).join("\n") } } : { unset: ["crossing"] };
  });
}

// ── the starter shrine ─────────────────────────────────────────────────────────────────────────────────────────────

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

/** A shrine's carrier at `familiar/<pet>`: a whole carrier given, or the slot blocks wrapped in the house frame; resealed. */
export function shrineCarrier(pet: string, words: string): string {
  const uri = `${MEMORY_PREFIX}familiar/${pet}`;
  const source = words.trimStart().startsWith("<<!DOCTYPE") ? words : [
    "<<!DOCTYPE type=`memetic-wikitext+tiddlywiki` spec=`lar:///ha.ka.ba/lares/api/pono/memetic-wikitext`>>", "",
    `<<^ code=\`&#x0001;\` from=\`?\` to=\`${uri}\`>>`, "<<^ code=`&#x0002;`>>", "",
    "```toml meta", "cacheable = false", 'l-space   = "adjacent"', `role      = "the familiar spirit ${pet}'s record; a waking body reads this first"`, 'status    = "live"',
    `title     = "${uri}"`, `type      = "${CARRIER_TYPE}"`, `uri-path  = "${uri.slice("lar:///".length)}"`, "```", "",
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
interface Row { readonly title: string; readonly fields: Readonly<Record<string, string>> }
/** The lineage a carry's listing reads in one filter call, no read per carry. */
const LINEAGE_FIELDS = ["title", "landed", "parent", "depth", "body", "record-base"] as const;

/** Rows a filter answers with fields: each title beside the fields it asked. */
function rowsOf(out: Record<string, unknown>): Row[] {
  const rows = Array.isArray(out["rows"]) ? (out["rows"] as Array<{ title?: string; fields?: Record<string, string> }>) : [];
  return rows.map((r) => ({ title: String(r.title ?? r.fields?.["title"] ?? ""), fields: r.fields ?? {} }));
}

/** Every carry under a spirit's keys with its lineage, newest first (one filter read); the carry named reads the body's own last one where a body asks, and its words where asked. */
async function latestCarry(args: ParsedArgs, label: string, keys: readonly string[], words = false, body: string | null = null): Promise<{ carry: Carry | null; rows: Row[] }> {
  const filter = keys.map((key) => `[prefix[${MEMORY_PREFIX}${COMPACTION_WORD}/${key}-]]`).join(" ") + " +[!sort[landed]]";
  const listed = await door(args, label, "wiki-filter", { recipe: RECIPE, filter, fields: [...LINEAGE_FIELDS] });
  const keep = new Set(residueOf(keys, rowsOf(listed).map((r) => r.title)).filter(isCarry));
  const rows = rowsOf(listed).filter((r) => keep.has(r.title));
  // A body reads its own chain first: its own last carry, else the newest any body landed.
  const top = (body ? rows.find((r) => r.fields["body"] === body) : undefined) ?? rows[0];
  if (top === undefined) return { carry: null, rows };
  const text = words ? (await fieldsOf(args, label, top.title))["text"] ?? "" : "";
  return { carry: { title: top.title, fields: top.fields, text }, rows };
}

/** The carry read as testimony: what it names, and each joint where it breaks against the card. */
export function testimonyLines(rec: Pick<Record_, "base">, carry: Carry | null, siblings: number): string[] {
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

/** One body awake on a card: its tag (`<pet>#<body>`), its full body id, and when it last woke. */
interface Awake { readonly tag: string; readonly body: string; readonly at: string }
/** The `bodies-awake` field read: one `<pet>#<body> <iso>` per line, keyed on the full body id; a line that parses not drops. */
export function presenceOf(raw: string | undefined): Awake[] {
  return String(raw ?? "").split("\n").flatMap((line) => {
    const m = /^(\S+#([A-Za-z0-9_-]{1,128})) (\S+)$/.exec(line.trim());
    return m ? [{ tag: m[1]!, body: m[2]!, at: m[3]! }] : [];
  });
}
const live = (a: Awake, now: number): boolean => { const t = Date.parse(a.at); return Number.isFinite(t) && now - t <= PRESENCE_STALE_MS; };

/**
 * A waking body joins the card's presence on its sibling record (CAS, re-read past a conflict): it refreshes its own entry, drops
 * the stale, and keeps at most `PRESENCE_CAP`, the newest. Presence refreshes only at wakes: a body that works long without
 * waking reads stale to its siblings after `PRESENCE_STALE_MS`, though it still writes. Answers who stands awake, this body first.
 */
async function joinPresence(args: ParsedArgs, rec: Record_, body: string, ctx: Ctx): Promise<Awake[]> {
  const now = ctx.now();
  const me: Awake = { tag: `${rec.pet}#${body}`, body, at: now.toISOString() };
  let awake: Awake[] = [];
  await casFields(args, "om", rec.side, (fields) => {
    const others = presenceOf(fields["bodies-awake"]).filter((a) => a.body !== body && live(a, now.getTime())).sort((x, y) => y.at.localeCompare(x.at));
    awake = [me, ...others].slice(0, PRESENCE_CAP);
    return { patch: { "bodies-awake": awake.map((a) => `${a.tag} ${a.at}`).join("\n") } };
  });
  return awake;
}

/** The presence line: how many bodies wear the pet, this one first. */
export const presenceLine = (pet: string, awake: readonly Awake[]): string =>
  `${awake.length} ${awake.length === 1 ? "body wears" : "bodies wear"} ${pet}: ${awake.map((a, i) => (i === 0 ? `#${a.body.slice(0, 8)} (you)` : `#${a.body.slice(0, 8)} since ${a.at.slice(11, 16)}`)).join(", ")}`;

/**
 * Stamp the card's wake epoch for a body (an ordering stamp, never a fence): the body that holds it keeps its epoch; another body raises it. The claim reads and writes
 * under the record's live hash, so two bodies claiming at once never both take one epoch: the later one reads again and raises.
 */
async function claimLease(args: ParsedArgs, rec: Record_, body: string, ctx: Ctx): Promise<number> {
  let epoch = 0;
  await casFields(args, "om", rec.side, (fields) => {
    const held = leaseOf(fields["lease"]);
    epoch = held !== null && held.body === body ? held.epoch : (held?.epoch ?? 0) + 1;
    return held !== null && held.body === body ? null : { patch: { lease: `${body} ${epoch} ${ctx.now().toISOString()}` } };
  });
  return epoch;
}

/** The longest slug a pet name holds. */
const SLUG_CHARS = 62;
/** A title's whole slug, uncut: a slug past `SLUG_CHARS` would collide once cut, so it names no familiar. */
const rawSlug = (title: string): string => title.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
/** A slug of a title, as a pet name reads; null where none forms, or where it runs past a pet name's length. */
const titleSlug = (title: string): string | null => {
  const slug = rawSlug(title);
  return slug.length <= SLUG_CHARS && PET.test(slug) ? slug : null;
};

/** Does a record name this title as its own: its `aliases` field, or a recognition line in its #/entry (`named by`, `renames`, `alias`)? */
async function namesTitle(args: ParsedArgs, rec: Record_, title: string): Promise<boolean> {
  const want = title.trim().toLowerCase();
  if ((rec.fields["aliases"] ?? "").split(/[,;\n]/).some((a) => a.trim().toLowerCase() === want)) return true;
  const entry = await readSlot(args, "om", rec, "#/entry");
  return (entry?.body ?? "").split("\n").some((line) => /named by|renames?|alias/i.test(line) && line.toLowerCase().includes(want));
}

/**
 * A TITLE ONLY PROPOSES, AND EACH FAMILIAR WAKES ITS OWN. A HELD session (`--held`: its own counter names this pet, from an
 * earlier wake of this session) never switches: a title naming another familiar reads as an offer (that familiar's own act
 * records the alias), and a title no record answers reads as this familiar's rename. A FRESH body (`--body`, not held) reads
 * the title's slug as its own familiar: a record standing there wakes, another body joining any already awake; where none
 * stands, a startup or clear prints that familiar's starter as an offer, never the seated card, and a fork's (or any other
 * source's) inherited title names nothing new. A wake naming no body reads the title as a proposal: it turns only where the
 * title's record names it as its own, else reads as an offer or as this familiar's rename. A title extending the pet's own
 * name (`<pet>-…`) reads as that pet, and a slug past a pet name's length names no familiar.
 */
async function readTitle(args: ParsedArgs, rec: Record_ | null, pet: string, title: string | null, body: "held" | "fresh" | null, source: Source): Promise<{ to: Record_ | null; starter: string | null; line: string | null }> {
  const none = { to: null, starter: null, line: null };
  if (title === null || title.trim() === "") return none;
  const named = title.trim().slice(0, 80);
  const raw = rawSlug(title);
  if (raw.length > SLUG_CHARS) return { ...none, line: `This session's title "${named}" names no familiar: its slug runs ${raw.length} chars, past the ${SLUG_CHARS} a pet name holds, and a cut slug could collide with another's. Rename the session shorter to name one.` };
  const slug = titleSlug(title);
  if (slug === null || slug === pet || slug.startsWith(`${pet}-`)) return none;
  let other: Record_ | null = null;
  try { other = await resolveRecord(args, "om", slug, true); } catch (e) { if (!(e instanceof SpiritRefusal)) throw e; }
  const fresh = body === "fresh";
  if (fresh && other === null) {
    if (source !== "startup" && source !== "clear") return none;
    return { to: null, starter: slug, line: `An offer, never a seat: this session's title "${named}" names ${slug}, and no record stands under it yet. If the operator named this session so, the shrine below makes it ${slug}'s own; if the title came by itself, wake the seated familiar instead: lares spirit om ${pet}` };
  }
  if (other !== null && body !== "held" && (fresh || (await namesTitle(args, other, title)))) {
    return { to: other, starter: null, line: `This session's title "${named}" names ${other.uri} as its own; this wake turns to ${slug}.` };
  }
  if (other !== null) {
    return { to: null, starter: null, line: `This session's title "${named}" names ${other.uri}, whose record stands; a title only proposes, so this wake stays ${pet}. To wear ${slug} under this title, ${slug}'s own act records the alias: lares spirit ah ${slug} --slot '#/entry' --add ${shq(`''renames:'' -> ${named}`)}` };
  }
  return { to: null, starter: null, line: rec === null ? null : `This session's title reads "${named}"; the seated familiar reads "${pet}". A rename renames, never retargets: this body stays ${pet}. To keep the title as an alias, record it: lares spirit ah ${pet} --slot '#/entry' --add ${shq(`''renames:'' ${pet} -> ${named}`)}` };
}

async function om(args: ParsedArgs, ctx: Ctx): Promise<number> {
  const given = petOf(args, "om");
  const sourceWord = wordOf(args.options["source"]) ?? "startup";
  if (!(SOURCES as readonly string[]).includes(sourceWord)) throw new DoorUsage(`--source names one of ${SOURCES.join(", ")}; got "${sourceWord}"`);
  const source = sourceWord as Source;
  const body = wordOf(args.options["body"]);
  if (body !== null && !BODY.test(body)) throw new DoorUsage("--body names a session id (letters, digits, '-' and '_')");
  const title = typeof args.options["title"] === "string" ? args.options["title"] : null;
  const seated = await resolveRecord(args, "om", given, true);
  // The session's own counter decides held (`--held`); the card's lease orders bodies and decides nothing here.
  const held = args.flags["held"] === true ? "held" : body === null ? null : "fresh";
  const turn = source === "precompact" ? { to: null, starter: null, line: null } : await readTitle(args, seated, given, title, held, source);
  const found = turn.starter !== null ? null : turn.to ?? seated;
  const pet = turn.starter ?? turn.to?.pet ?? given;
  if (found === null) {
    // A first wake: no record yet. The body reads the skeleton and lands its own shrine; a precompact hands back no shape.
    const text = source === "precompact" ? "" : [turn.line, starterText(pet)].flatMap((l) => (l === null ? [] : [l])).join("\n\n");
    emit(args, { ok: true, data: { pet, starter: true, ...(turn.starter !== null ? { offer: true } : {}), source, every: TRUE_UP_EVERY, carryShape: null, chars: text.length, text }, human: () => console.log(text) });
    return 0;
  }
  const rec = found;
  const key = await keyOf(args, "om", rec);
  const epoch = body !== null ? await claimLease(args, rec, body, ctx) : rec.lease?.epoch ?? null;
  const awake = body !== null ? await joinPresence(args, rec, body, ctx) : presenceOf(rec.sideFields["bodies-awake"]).filter((a) => live(a, ctx.now().getTime()));
  const leaseLine = epoch === null ? null : `Lares spirit wake epoch ${epoch}: an ordering stamp; no write needs it, and no body locks another out.`;
  const presence = body !== null ? presenceLine(pet, awake) : awake.length > 0 ? `${awake.length} ${awake.length === 1 ? "body wears" : "bodies wear"} ${pet}: ${awake.map((a) => `#${a.body.slice(0, 8)} since ${a.at.slice(11, 16)}`).join(", ")}` : null;
  const data = { pet, uri: rec.uri, kind: rec.kind, base: rec.base, spiritId: key, epoch, every: rec.every, budgets: rec.budgets, source, ...(turn.to !== null ? { turnedFrom: given } : {}) };
  if (source === "resume") {
    const text = `Lares spirit om · ${pet}: this body resumes; the card reads ${digestOf(rec.base).slice(7, 19)} now${epoch !== null ? ` (wake epoch ${epoch})` : ""}, and an earlier wake may read stale: lares spirit om ${pet}`;
    emit(args, { ok: true, data: { ...data, chars: text.length, text }, human: () => console.log(text) });
    return 0;
  }
  if (source === "precompact") {
    // The crossing: the card's #/open and #/kulana, read to the outgoing body, and the mark that holds slot writes until a body wakes.
    if (body !== null) await markCrossing(args, rec, body, ctx, true);
    const shape = await readSlot(args, "om", rec, "#/carry-shape");
    const open = await readSlot(args, "om", rec, "#/open");
    const voice = await readSlot(args, "om", rec, "#/kulana");
    const { carry } = await latestCarry(args, "om", [key, pet], false, body);
    const text = [open?.body, voice?.body].filter(Boolean).join("\n\n").slice(0, PRECOMPACT_CARD_CHARS);
    emit(args, { ok: true, data: { ...data, carryShape: shape?.body ?? null, inherits: carry === null ? null : carry.title.slice(-12), chars: text.length, text }, human: () => console.log(text) });
    return 0;
  }
  // A waking body ends its own crossing: the compaction it marked has turned; a sibling's mark stands.
  if (rec.crossing !== null && body !== null) await markCrossing(args, rec, body, ctx, false);
  const { carry, rows } = await latestCarry(args, "om", [key, pet], source === "compact", body);
  const parent = carry?.fields["parent"];
  const siblings = parent ? rows.filter((r) => r.fields["parent"] === parent).length : 0;
  // Each live sibling's chain: its own last carry.
  const chains = awake.filter((a) => a.body !== body).flatMap((a) => {
    const tip = rows.find((r) => (r.fields["body"] ?? "") === a.body);
    return tip === undefined ? [] : [`#${a.body.slice(0, 8)}'s chain: ${tip.title} (depth ${tip.fields["depth"] ?? "?"})`];
  });
  const testimony = [...(presence === null ? [] : [presence]), ...testimonyLines(rec, carry, siblings), ...chains, ...(leaseLine === null ? [] : [leaseLine])];
  if (source === "compact" && carry !== null) {
    testimony.push(`This body inherits ${carry.title} (hash ${carry.title.slice(-12)}): "${carry.text.replace(/\s+/g, " ").trim().slice(0, 120)}"`);
  }
  const lead = [
    turn.line,
    source === "fork"
      ? `You wake as a fork: another body may still wear ${pet}, and both write the one card${epoch !== null ? ` (wake epoch ${epoch})` : ""}: additions merge, and a whole-slot clash lands both versions for hum to settle.`
      : null,
  ].flatMap((l) => (l === null ? [] : [l])).join("\n") || null;
  const open = await readSlot(args, "om", rec, "#/open");
  const attention = await attentionUnfold(args, rec);
  // Each slot's digest, the view this body woke on: a whole-slot write names its slot's as --base, so a sibling's write since reads.
  const digests: Record<string, string> = {};
  for (const s of rec.slots) {
    const read = s.slot === "#/open" ? open : await readSlot(args, "om", rec, s.slot);
    if (read !== null) digests[s.slot] = slotDigest(read.body);
  }
  testimony.push(`Slot digests (a whole-slot ah names its slot's as --base; --add needs none): ${Object.entries(digests).map(([k, v]) => `${k}=${v}`).join(" ")}`);
  const advisory = advisoryLine(rec);
  if (advisory !== null) testimony.push(advisory);
  const text = omText(rec, { open: open?.text ?? null, testimony, attention, lead });
  emit(args, {
    ok: true, data: { ...data, latest: carry?.title ?? null, digests, chars: text.length, cap: OM_CAP_CHARS, text },
    human: () => console.log(text),
  });
  return 0;
}

// ── ah ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The cap a slot's body answers to: a waking slot's, else null (the slot never refuses). */
export const wakingCap = (budgets: Record_["budgets"] | undefined, slot: string): number | null => {
  const base = WAKING_SLOT_BUDGETS[slot];
  return base === undefined ? null : budgets?.slot ?? base;
};

/** What a slot write would leave, measured against its cap: the refusal where a waking slot grows past it, else null. Every other slot and the record's total only advise (`advisoryLine`). */
export function budgetRefusal(rec: Pick<Record_, "pet" | "uri" | "slots"> & { budgets?: Record_["budgets"] }, slot: string, oldBody: string, newBody: string, factor = 1): SpiritRefusal | null {
  const cap = wakingCap(rec.budgets, slot);
  if (cap === null) return null;
  const was = bytesOf(oldBody);
  const now = bytesOf(newBody);
  if (now <= was) return null;
  const fold = `\`lares spirit hum ${rec.pet} --fold '${slot}'\` lists its lines with their digests; \`--line <n> --expect <digest>\` moves one to the ash ledger`;
  if (now > cap * factor) return new SpiritRefusal("spirit-slot-over-budget", `spirit-slot-over-budget: ${slot} would hold ${now} bytes, past its ${cap * factor}-byte waking cap (om prints it into the wake; it holds ${was}); nothing landed. Fold first: ${fold}, then true it again`);
  return null;
}

/** The advisory line for a record's weight: its total and its heaviest slots; null where the record stands under its advisory weight (unless `always`). */
export function advisoryLine(rec: Pick<Record_, "slots"> & { budgets?: Record_["budgets"] }, always = false): string | null {
  const m = measure(rec);
  if (!always && !m.over) return null;
  const heavy = [...rec.slots].sort((a, b) => b.bytes - a.bytes).slice(0, 3).map((s) => `${s.slot} ${s.bytes}`);
  return `advisory: the record holds ${m.total} bytes${m.over ? `, past ${m.budget}` : ""}; heaviest ${heavy.join(", ")}`;
}

async function sourceText(flag: "file", source: string): Promise<string> {
  if (source !== "-") {
    try { return readFileSync(source, "utf8"); } catch { throw new DoorUsage(`cannot read --${flag} ${source}`); }
  }
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks).toString("utf8");
}

/** The guards every slot write passes: the secret-shape guard over the lines it brings, and (unless a conflict stanza lands) both budgets. */
function guardWords(rec: Pick<Record_, "pet" | "uri" | "slots" | "budgets">, slot: string, was: string, body: string, budget: boolean, factor = 1): void {
  // The guard reads the lines this write brings, never the ones already standing: a standing line answers to its own fold.
  const standing = new Set(was.split("\n"));
  const brought = body.split("\n").map((line, i) => ({ line, n: i + 1 })).filter(({ line }) => !standing.has(line));
  const shaped = brought.find(({ line }) => secretCount(line) > 0);
  if (shaped !== undefined) {
    throw new SpiritRefusal("spirit-secret-shaped", `spirit-secret-shaped: line ${shaped.n} of the words for ${rec.uri}${slot} holds a secret-shaped string (${redacted(shaped.line).slice(0, 120)}), so nothing landed; clear it, then true the slot again: \`lares spirit ah ${rec.pet} --slot '${slot}' --file <scrubbed path>\``, 4);
  }
  if (!budget) return;
  const over = budgetRefusal(rec, slot, was, body, factor);
  if (over) throw over;
}

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

/**
 * A SIBLING'S WORDS SURVIVE. `--add` appends one line over the slot as it stands, re-reading past a conflict, so additions from
 * many bodies commute. A whole-slot replace compares at SLOT grain: it names the digest of the slot it read (`--base`, as om or
 * the last ah handed it back); where the slot still reads that digest it writes, re-reading past a conflict elsewhere on the
 * card; where the slot moved since, both versions land in a conflict stanza naming this writer and the slot's last writer. A
 * stanza holds at most twice the slot's budget and the record's own. Only a record that keeps moving past the rounds refuses.
 */
async function mergeSlot(args: ParsedArgs, rec: Record_, slot: string, write: { add: string } | { words: string; base: string | null; who: string }): Promise<Record<string, unknown>> {
  const first = await readSlot(args, "ah", rec, slot);
  if (first === null) throw slotMissing(rec, slot);
  let read = first;
  const seen = "words" in write ? (write.base ?? slotDigest(first.body)) : null;
  for (let round = 0; round < CAS_ROUNDS; round++) {
    const clash = seen !== null && slotDigest(read.body) !== seen;
    let body: string;
    if ("add" in write) body = `${read.body}\n${write.add}`;
    else if (!clash) body = write.words;
    else {
      const last = (await fieldsOf(args, "ah", rec.side))[writerField(slot)] || `the words standing at ${slotDigest(read.body)}`;
      body = conflictStanza(slot, [{ who: write.who, words: write.words }, { who: last, words: read.body }]);
    }
    body = body.replace(/^\n+/, "").replace(/\s+$/, "");
    guardWords(rec, slot, read.body, body, true, clash ? 2 : 1);
    const receipt = await door(args, "ah", "meme-patch", { recipe: RECIPE, uri: rec.uri, slot, replace: body, base: read.base });
    const decision = String(receipt["decision"] ?? "");
    if (decision === "ingest" || decision === "noop") return { ...receipt, bytes: bytesOf(body), was: bytesOf(first.body), digest: slotDigest(body), ...(clash ? { conflict: true } : {}) };
    if (decision !== "conflict") {
      const warnings = Array.isArray(receipt["warnings"]) ? (receipt["warnings"] as string[]) : [];
      throw new SpiritRefusal("spirit-write-refused", `spirit-write-refused: the meme door answered ${decision || "nothing"} for ${rec.uri}${slot}${warnings[0] ? ` (${warnings[0]})` : ""}; read the record (\`lares tiddler get ${rec.uri} --recipe default --meme --all\`) before you true it again`, 4);
    }
    const again = await readSlot(args, "ah", rec, slot);
    if (again === null) throw slotMissing(rec, slot);
    read = again;
  }
  throw new SpiritRefusal("spirit-write-refused", `spirit-write-refused: ${rec.uri}${slot} kept moving under ${CAS_ROUNDS} reads, so nothing landed; run the act again once the record settles`, 4);
}

/** Fold one line out of a slot at slot grain: re-read past a conflict and find the line by its content; a line a sibling already folded refuses by name. */
async function foldLine(args: ParsedArgs, rec: Record_, slot: string, line: string): Promise<Record<string, unknown>> {
  for (let round = 0; round < CAS_ROUNDS; round++) {
    const read = await readSlot(args, "hum", rec, slot);
    if (read === null) throw slotMissing(rec, slot);
    const lines = read.body.split("\n");
    const at = lines.indexOf(line);
    if (at < 0) throw new SpiritRefusal("spirit-fold-gone", `spirit-fold-gone: the line "${redacted(line.trim()).slice(0, 120)}" no longer stands in ${rec.uri}${slot} (a sibling body folded or rewrote it); nothing landed. Number the lines again: \`lares spirit hum ${rec.pet} --fold '${slot}'\``, 4);
    const body = lines.filter((_, i) => i !== at).join("\n").replace(/^\n+/, "").replace(/\s+$/, "");
    const receipt = await door(args, "hum", "meme-patch", { recipe: RECIPE, uri: rec.uri, slot, replace: body, base: read.base });
    const decision = String(receipt["decision"] ?? "");
    if (decision === "ingest" || decision === "noop") return { ...receipt, bytes: bytesOf(body), was: bytesOf(read.body), digest: slotDigest(body) };
    if (decision !== "conflict") throw new SpiritRefusal("spirit-write-refused", `spirit-write-refused: the meme door answered ${decision || "nothing"} for ${rec.uri}${slot}; read the record (\`lares tiddler get ${rec.uri} --recipe default --meme --all\`) before you fold again`, 4);
  }
  throw new SpiritRefusal("spirit-write-refused", `spirit-write-refused: ${rec.uri}${slot} kept moving under ${CAS_ROUNDS} reads, so nothing folded; run the fold again once the record settles`, 4);
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
  crossingHolds(rec, ctx, wordOf(args.options["body"]));
  const words = file !== null ? await sourceText("file", file) : text;
  const line = add?.replace(/\s+/g, " ").trim() ?? null;
  if (line === "") throw new DoorUsage("--add names one non-empty line");
  const self = wordOf(args.options["body"]);
  const base = line !== null ? null : wordOf(args.options["base"]);
  if (base !== null && !SLOT_DIGEST.test(base)) throw new DoorUsage(`--base names the slot digest this body read (16 hex; \`lares spirit om ${pet}\` or the last ah hands it back)`);
  if (line === null && base === null && ctx.seat()) {
    throw new SpiritRefusal("spirit-base-needed", `spirit-base-needed: a whole-slot write from an AI seat names the slot digest it read, so a sibling's write since never drops: --base <slot digest> (om's wake lists each slot's; the last ah hands back its own). Nothing landed. To add one line, --add needs none`, 2);
  }
  const who = self !== null ? `${pet}#${self}` : "a hand at the terminal";
  const receipt = await mergeSlot(args, rec, slot, line !== null ? { add: line } : { words: words!, base, who });
  if (receipt["decision"] === "ingest") {
    // The slot's last writer names a later clash's other side; a tell distilled into #/kulana sets the distill mark (otakiage burns
    // only residue that landed before it). Both ride the sibling record, so the card's base holds.
    await writeSide(args, "ah", rec, { [writerField(slot)]: who, ...(slot === "#/kulana" ? { distilled: ctx.now().toISOString() } : {}) });
  }
  emit(args, {
    ok: true, data: { pet, uri: rec.uri, slot, ...receipt },
    human: () => console.log(`${String(receipt["decision"])}: ${rec.uri}${slot} (${String(receipt["bytes"])} bytes${wakingCap(rec.budgets, slot) === null ? "" : ` of ${wakingCap(rec.budgets, slot)}`})\n  base: ${String(receipt["canonicalHash"] ?? "")}`),
  });
  return 0;
}

// ── hum ────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Each waking slot against its cap (others carry none), and the record's total against its advisory weight. */
export function measure(rec: Pick<Record_, "slots"> & { budgets?: Record_["budgets"] }): { slots: Array<Slot & { budget: number | null; over: boolean }>; total: number; budget: number; over: boolean } {
  const budgets = rec.budgets ?? { slot: null, record: RECORD_BUDGET_BYTES };
  const slots = rec.slots.map((s) => { const budget = wakingCap(budgets, s.slot); return { ...s, budget, over: budget !== null && s.bytes > budget }; });
  const total = rec.slots.reduce((n, s) => n + s.bytes, 0);
  return { slots, total, budget: budgets.record, over: total > budgets.record };
}

/**
 * Append lines to the month's ash ledger, each redacted under the strict reading. The append rides alone (the tiddler door
 * refuses `append-alone` where a field patch rides with it); `create` opens the month's ledger where none stands, and a ledger
 * the append just opened takes its description in a put of its own.
 */
async function burnToAshes(args: ParsedArgs, label: string, lines: readonly string[], now: Date): Promise<string> {
  const ledger = ashLedgerOf(now);
  const refused = (decision: string): SpiritRefusal => new SpiritRefusal("spirit-ashes-refused", `spirit-ashes-refused: the ash ledger ${ledger} answered ${decision || "nothing"}; read it: \`lares tiddler get ${ledger} --recipe default\`, then run \`lares spirit ${label} …\` again`, 4);
  const receipt = await door(args, label, "tiddler-put", { recipe: RECIPE, title: ledger, append: lines.map(redacted).join("\n"), create: true });
  const decision = String(receipt["decision"] ?? "");
  if (decision !== "put" && decision !== "noop") throw refused(decision);
  if (receipt["created"] === true) {
    const named = await door(args, label, "tiddler-put", {
      recipe: RECIPE, title: ledger,
      fields: { description: `The ash ledger of the ${now.toISOString().slice(0, 7)} o-takiage sittings: each burned stage item with what landed it and the date.` },
    });
    if (!["put", "noop"].includes(String(named["decision"] ?? ""))) throw refused(String(named["decision"] ?? ""));
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
      ok: true, data: { pet, uri: rec.uri, ...m, advisory: advisoryLine(rec), every: rec.every, oversize: over.map((s) => s.slot) },
      human: () => {
        console.log(`lares spirit hum ${pet} · ${rec.uri}`);
        for (const s of m.slots) console.log(`  ${s.over ? "⚠" : " "} ${s.slot.padEnd(14)} ${String(s.bytes).padStart(5)}${s.budget === null ? "" : ` / ${s.budget}`}`);
        console.log(`  ${advisoryLine(rec, true)}`);
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
      ok: true, data: { pet, uri: rec.uri, slot: fold, lines: lines.map((text, i) => ({ n: i + 1, text, digest: slotDigest(text) })) },
      human: () => {
        console.log(`${rec.uri}${fold}: pick the line to fold with --line <n> --expect <its digest>`);
        lines.forEach((text, i) => console.log(`  ${String(i + 1).padStart(3)}  ${slotDigest(text)}  ${text}`));
      },
    });
    return 0;
  }
  crossingHolds(rec, ctx, wordOf(args.options["body"]));
  // THE LISTED LINE, BY ITS DIGEST. The number reads the listing this body saw; `--expect` names that line's digest, so a sibling's
  // write between the listing and the fold folds the line this body chose (wherever it moved), or nothing.
  const expect = wordOf(args.options["expect"]);
  if (expect === null || !SLOT_DIGEST.test(expect)) throw new DoorUsage(`--line <n> rides beside --expect <the line's digest> (16 hex), as \`lares spirit hum ${pet} --fold '${fold}'\` lists each line's`);
  const n = /^[1-9][0-9]*$/.test(lineWord) ? Number(lineWord) : NaN;
  const at = Number.isInteger(n) && lines[n - 1] !== undefined && slotDigest(lines[n - 1]!) === expect ? n - 1 : lines.findIndex((l) => slotDigest(l) === expect);
  if (at < 0) {
    throw new SpiritRefusal("spirit-fold-gone", `spirit-fold-gone: no line in ${rec.uri}${fold} reads the digest ${expect} (a sibling body folded or rewrote it since the listing); nothing landed. List the lines again: \`lares spirit hum ${pet} --fold '${fold}'\``, 4);
  }
  const picked = lines[at]!;
  if (picked.trim() === "") {
    throw new DoorUsage(`--line ${lineWord} names no line holding words in ${fold} (it holds ${lines.length}); \`lares spirit hum ${pet} --fold '${fold}'\` numbers them`);
  }
  // The fold lands first, at slot grain: past a sibling's write it re-reads and finds its line by content, so a shifted slot folds
  // the line this body chose and never another. Only once the patch lands does the line burn to the ledger.
  const stamp = ctx.now();
  const receipt = await foldLine(args, rec, fold, picked);
  const ashLine = `* ${stamp.toISOString().slice(0, 10)} · hum ${pet} folded from ${rec.uri}${fold}: ${picked.trim()}`;
  // The ash write retries a bounded number of times; a ledger that keeps refusing gets the line back in the slot, never lost.
  let ledger: string | null = null;
  let last: unknown = null;
  for (let round = 0; round < ASH_ROUNDS && ledger === null; round++) {
    try { ledger = await burnToAshes(args, "hum", [ashLine], stamp); } catch (e) { last = e; }
  }
  if (ledger === null) {
    await mergeSlot(args, rec, fold, { add: picked });
    const why = last instanceof SpiritRefusal ? last.message : last instanceof Printed ? `the ledger's door refused (exit ${last.exit})` : String(last);
    throw new SpiritRefusal("spirit-ashes-refused", `spirit-ashes-refused: the ash ledger refused the folded line ${ASH_ROUNDS} times (${why.slice(0, 300)}), so the line returned to the slot's end: ${redacted(picked.trim()).slice(0, 300)}. Fold it again once the ledger answers: \`lares spirit hum ${pet} --fold '${fold}'\``, 4);
  }
  await writeSide(args, "hum", rec, { distilled: stamp.toISOString() });
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
 * HOOKS NEVER WRITE THE CARD'S SLOTS. The carry lands as its own record, with its lineage, and touches the card not at all: no
 * #/bodies line, no field. The answer hands back the line for the next body to file through `ah` (the true-up names it). (A
 * hook's `om` does write the card's fields that order bodies: the wake epoch, the presence, the crossing, the spirit-id; never a slot.)
 */
async function landCarry(args: ParsedArgs, ctx: Ctx): Promise<number> {
  const pet = petOf(args, COMPACTION_WORD);
  const body = wordOf(args.options["body"]) ?? "";
  if (body !== "" && !BODY.test(body)) throw new DoorUsage("--body names a session id (letters, digits, '-' and '_')");
  // The carry writes nothing to the card; its lineage runs per body, so each body keeps its own chain.
  const rec = (await resolveRecord(args, COMPACTION_WORD, pet))!;
  const { text, cut } = await residueWords(args, COMPACTION_WORD);
  const key = rec.id ?? pet;
  const { rows: chain } = await latestCarry(args, COMPACTION_WORD, [...new Set([key, pet])]);
  // Each body keeps its own chain; a body with none yet takes the newest carry any body landed.
  const own = (body === "" ? undefined : chain.find((r) => (r.fields["body"] ?? "") === body)) ?? chain[0];
  const parent = own === undefined ? null : { title: own.title, fields: own.fields };
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
  const fileIt = `lares spirit ah ${pet} --slot '#/bodies' --add ${shq(line)}${body !== "" ? ` --body ${body}` : ""}`;
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
  // A handback lands under its own pet name alone: a mask tag never reaches a familiar's record, nor mints its spirit-id.
  const key = pet;
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
  const listed = await door(args, "otakiage", "wiki-filter", { recipe: RECIPE, filter, fields: [...LINEAGE_FIELDS] });
  const titles = residueOf(keys, rowsOf(listed).map((r) => r.title));
  // A carry a standing carry names as its parent holds the chain: the child burns first.
  const parents = new Set(rowsOf(listed).filter((r) => titles.includes(r.title)).map((r) => r.fields["parent"] ?? "").filter((p) => p !== ""));
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
    if (isCarry(title) && parents.has(title.slice(-12))) { held.push({ title, why: `a standing ${COMPACTION_DISPLAY} names it as its parent` }); continue; }
    const links = titlesOf(await door(args, "otakiage", "wiki-filter", { recipe: RECIPE, filter: `[[${title}]backlinks[]]` }));
    if (links.length > 0) { held.push({ title, why: `${links.length} link(s) still reach it (${links.slice(0, 3).join(", ")})` }); continue; }
    const mentions = titlesOf(await door(args, "otakiage", "wiki-filter", { recipe: RECIPE, filter: `[search[${title}]] -[[${title}]]` }));
    if (mentions.length > 0) { held.push({ title, why: `${mentions.length} record(s) still name it (${mentions.slice(0, 3).join(", ")})` }); continue; }
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
      console.log(`  distill what the residue taught into #/kulana (it sets the distill mark): lares spirit ah ${pet} --slot '#/kulana' --add '<tell>'`);
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
