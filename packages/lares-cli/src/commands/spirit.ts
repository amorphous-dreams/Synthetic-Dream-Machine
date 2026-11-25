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
 * names itself in `bodies-awake` (`<pet>#<body> <iso>`, refreshed at every write the body names, ordered by a door-minted seq and capped by count,
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
import { readFileSync } from "node:fs";
import { stdin } from "node:process";
import { readOwnHand, type HandReading } from "@lararium/node";
import { CARRIER_TYPE } from "@lararium/mesh/carrier-type";
import {
  ASH_ROUNDS, BODY_ID, CAS_ROUNDS, DISTILL_SLOT, LINEAGE_FIELDS, MEMORY_PREFIX, PET_NAME, PRECOMPACT_CARD_CHARS, RECORD_KINDS,
  RESIDUE_CAP_CHARS, SLOT_DIGEST, SLUG_CHARS, SPIRIT_RECIPE, SPIRIT_SOURCES, SpiritRefusal, TRUE_UP_EVERY, OM_CAP_CHARS,
  advisoryLine, ashLedgerOf, attentionLines, attentionTitles, bodiesLine, burnLine, burnTally, bytesOf, carryFields, carryFilter,
  carryDepth, carryParent, carryParents, carryRows, compactionTitle, crossingRefusal, crossingWrite, digestOf, distillHold,
  fieldsAndHashOf, foldAshLine, foldOut, guardWords, handRefusal, isCarry, leaseClaim, ledgerDescription, measure, namesTitleIn,
  omText, pickLine, presenceJoin, presenceLine, presenceOf, presenceSeenLine, rawSlug, redactedText, residueCut,
  residueFields, residueFilter, residueHash, residueOf, residueTitle, rowsOf, secretCount, shq, shrineSource, sideOf, slotBody,
  slotDigest, slotMissing, slotWriteBody, spiritAmbiguous, spiritHash, spiritIdOf, spiritRecordOf, spiritUnknown, starterText,
  testimonyLines, titleSlug, titlesOf, wakingCap, writerField,
  type SideWrite, type SlotWrite, type SpiritAwake, type SpiritCarry, type SpiritRecord, type SpiritRow, type SpiritSource,
} from "@lararium/mesh/spirit-shrine";
import { normalizeMemeSource } from "@lararium/tw5/meme-normalize";
import { stampCarrier } from "@lararium/memetic-frame";
import { COMPACTION_DISPLAY, COMPACTION_WORD } from "../spirit-words.js";
import { harnessSeatMarked } from "../local-connector.js";
import { emit, refuseUsage } from "../render.js";
import { helpLines } from "../command-help.js";
import { DoorUsage, guardDoor, runDoor, wordOf } from "./door-call.js";
import { tableCovers } from "../verb-table.js";
import type { ParsedArgs } from "../parse-args.js";

// THE PURE CORE STANDS IN `@lararium/mesh/spirit-shrine`: the addresses and defaults, the slot parse and digest, the card's text,
// the caps, the guard, the conflict stanza, the presence, epoch and crossing merges. This door keeps the door calls, the file and
// stdin reads, the clock and the hand gate, and carries the core's names on for its suites.
export {
  ATTENTION_TITLES, DEEP_CARRY, MEMORY_PREFIX, OM_CAP_CHARS, PRECOMPACT_CARD_CHARS, PRESENCE_CAP,
  RECORD_BUDGET_BYTES, RECORD_KINDS, RESIDUE_CAP_CHARS, SHRINE_SLOTS, TRUE_UP_EVERY, WAKING_SLOT_BUDGETS,
  advisoryLine, ashLedgerOf, bodiesLine, budgetRefusal, compactionTitle, conflictStanza, crossingsOf, leaseOf, measure, omText,
  presenceLine, presenceOf, residueOf, residueTitle, secretCount, shq, sideOf, slotBody, slotDigest, stanzaVersions, starterText,
  testimonyLines, wakingCap,
} from "@lararium/mesh/spirit-shrine";

/** Every verb the spirit door answers. */
export const SPIRIT_VERBS = ["help", "om", "ah", "hum", "otakiage", COMPACTION_WORD, "residue"] as const;
type Verb = (typeof SPIRIT_VERBS)[number];

const RECIPE = SPIRIT_RECIPE;
const PET = PET_NAME;
const BODY = BODY_ID;
const SOURCES = SPIRIT_SOURCES;
type Source = SpiritSource;
type Record_ = SpiritRecord;
type Carry = SpiritCarry;
type Row = SpiritRow;
type Awake = SpiritAwake;

/** How otakiage reads the hand behind this command: the house gate over the command's own branch. A suite names its reading. */
export type HandRead = () => HandReading;

/**
 * Release by the hand: the gate's reading (`ctx.hand`, the house gate over this command's own branch) stands, or refuses by its
 * own code, an AI seat on the branch `hand-act-only` and a branch nothing attests `hand-unattested`.
 */
function releaseByHand(hand: HandRead, line: string): void {
  const read = hand();
  if ("refusal" in read) throw handRefusal(read.refusal, line);
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

/** A record's fields and its live hash (the base a put names), read on the record lens. */
async function recordOf(args: ParsedArgs, label: string, title: string): Promise<{ fields: Record<string, string>; hash: string | null }> {
  return fieldsAndHashOf(await door(args, label, "tiddler-get", { recipe: RECIPE, title }));
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
  if (hits.length > 1) throw spiritAmbiguous(pet, hits.map((h) => h.uri));
  const hit = hits[0];
  if (!hit) {
    if (soft) return null;
    throw spiritUnknown(pet);
  }
  const fields = await fieldsOf(args, label, hit.uri);
  const sideFields = await fieldsOf(args, label, sideOf(pet));
  return spiritRecordOf({ pet, ...hit }, fields, sideFields);
}

/**
 * A COMPARE-AND-SWAP ON THE RECORD'S FIELDS. Each round reads the fields and their live hash, asks `change` what to write over
 * them (null writes nothing), and puts under that hash as its base; a record that moved meanwhile answers `conflict`, and the
 * round reads again, bounded. Answers the fields the write landed over.
 */
async function casFields(args: ParsedArgs, label: string, uri: string, change: (fields: Record<string, string>) => SideWrite): Promise<Record<string, string>> {
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

/** The record's stable key: its `spirit-id`, minted once from its address and the base it first answered. */
async function keyOf(args: ParsedArgs, label: string, rec: Record_): Promise<string> {
  if (rec.id !== null) return rec.id;
  const id = spiritIdOf(rec.uri, rec.base);
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

// ── the crossing ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** The seams a suite names: the hand reading, the clock, and whether an AI seat asks. */
export interface SpiritSeams { readonly hand?: HandRead; readonly now?: () => Date; readonly seat?: () => boolean }
interface Ctx { readonly now: () => Date; readonly seat: () => boolean; readonly hand: HandRead }

/**
 * THE CROSSING RUNS PER BODY, AND STAYS ADVISORY. Only the PreCompact hook marks it (`om --source precompact --body <id>`), and
 * between that mark and the same body's next wake (the one event that lifts it) a write naming that body (`--body`) refuses; a sibling,
 * or a write naming no body, writes freely. It guards a body from writing over its own folding, never a card from its siblings.
 */
function crossingHolds(rec: Record_, body: string | null): void {
  if (body === null) return;
  if (!BODY.test(body)) throw new DoorUsage("--body names a session id (letters, digits, '-' and '_')");
  const refused = crossingRefusal(rec, body);
  if (refused !== null) throw refused;
}

/** Mark (or clear) the crossing one body holds on the sibling record, keeping each mark a sibling holds; CAS, re-read past a conflict. */
async function markCrossing(args: ParsedArgs, rec: Record_, body: string, ctx: Ctx, mark: boolean): Promise<void> {
  const now = ctx.now();
  await casFields(args, "om", rec.side, (fields) => crossingWrite(fields, body, now, mark));
}

// ── the starter shrine ─────────────────────────────────────────────────────────────────────────────────────────────

/** A shrine's carrier at `familiar/<pet>`: a whole carrier given, or the slot blocks wrapped in the house frame; resealed. */
export function shrineCarrier(pet: string, words: string): string {
  // The house normalize, then the block check minted over the body it follows (as `lares meme normalize` writes it).
  return stampCarrier(normalizeMemeSource(shrineSource(pet, words, CARRIER_TYPE)).text);
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

/** Every carry under a spirit's keys with its lineage, newest first (one filter read); the carry named reads the body's own last one where a body asks, and its words where asked. */
async function latestCarry(args: ParsedArgs, label: string, keys: readonly string[], words = false, body: string | null = null): Promise<{ carry: Carry | null; rows: Row[] }> {
  const listed = await door(args, label, "wiki-filter", { recipe: RECIPE, filter: carryFilter(keys), fields: [...LINEAGE_FIELDS] });
  const { top, rows } = carryRows(keys, listed, body);
  if (top === undefined) return { carry: null, rows };
  const text = words ? (await fieldsOf(args, label, top.title))["text"] ?? "" : "";
  return { carry: { title: top.title, fields: top.fields, text }, rows };
}

/** The titles a record's #/attention names, unfolded with their descriptions in one filter read. */
async function attentionUnfold(args: ParsedArgs, rec: Record_): Promise<string | null> {
  const slot = await readSlot(args, "om", rec, "#/attention");
  if (slot === null) return null;
  const titles = attentionTitles(slot.body);
  if (titles.length === 0) return null;
  const out = await door(args, "om", "wiki-filter", { recipe: RECIPE, filter: titles.map((t) => `[[${t}]]`).join(" "), fields: ["title", "description"] });
  return attentionLines(titles, out);
}

/**
 * A waking body joins the card's presence on its sibling record (CAS, re-read past a conflict): it refreshes its own entry, drops
 * and keeps at most `PRESENCE_CAP`. Presence refreshes at every write the body names (a wake, ah, hum): the stamp annotates; the minted seq orders siblings
 * and no age drops one. Answers who stands awake, this body first.
 */
async function joinPresence(args: ParsedArgs, rec: Record_, body: string, ctx: Ctx): Promise<Awake[]> {
  const now = ctx.now();
  let awake: Awake[] = [];
  await casFields(args, "om", rec.side, (fields) => {
    const joined = presenceJoin(fields, rec.pet, body, now);
    awake = joined.awake;
    return joined.write;
  });
  return awake;
}

/**
 * Stamp the card's wake epoch for a body (an ordering stamp, never a fence): the body that holds it keeps its epoch; another body raises it. The claim reads and writes
 * under the record's live hash, so two bodies claiming at once never both take one epoch: the later one reads again and raises.
 */
async function claimLease(args: ParsedArgs, rec: Record_, body: string, ctx: Ctx): Promise<number> {
  let epoch = 0;
  await casFields(args, "om", rec.side, (fields) => {
    const claim = leaseClaim(fields, body, ctx.now());
    epoch = claim.epoch;
    return claim.write;
  });
  return epoch;
}

/** Does a record name this title as its own: its `aliases` field, or a recognition line in its #/entry (`named by`, `renames`, `alias`)? */
async function namesTitle(args: ParsedArgs, rec: Record_, title: string): Promise<boolean> {
  if (namesTitleIn(rec.fields, "", title)) return true;
  const entry = await readSlot(args, "om", rec, "#/entry");
  return namesTitleIn({}, entry?.body ?? "", title);
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
  const awake = body !== null ? await joinPresence(args, rec, body, ctx) : presenceOf(rec.sideFields["bodies-awake"]);
  const leaseLine = epoch === null ? null : `Lares spirit wake epoch ${epoch}: an ordering stamp; no write needs it, and no body locks another out.`;
  const presence = body !== null ? presenceLine(pet, awake) : presenceSeenLine(pet, awake);
  const data = { pet, uri: rec.uri, kind: rec.kind, base: rec.base, spiritId: key, epoch, every: rec.every, budgets: rec.budgets, source, ...(turn.to !== null ? { turnedFrom: given } : {}) };
  // A resumed body ends its own crossing too: it never reaches the wake's clear below, and no timer lifts a mark.
  if (source === "resume" && rec.crossing !== null && body !== null) await markCrossing(args, rec, body, ctx, false);
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
    const kulana = await readSlot(args, "om", rec, "#/kulana");
    const { carry } = await latestCarry(args, "om", [key, pet], false, body);
    const text = [open?.body, kulana?.body].filter(Boolean).join("\n\n").slice(0, PRECOMPACT_CARD_CHARS);
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

async function sourceText(flag: "file", source: string): Promise<string> {
  if (source !== "-") {
    try { return readFileSync(source, "utf8"); } catch { throw new DoorUsage(`cannot read --${flag} ${source}`); }
  }
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks).toString("utf8");
}
/**
 * A SIBLING'S WORDS SURVIVE. `--add` appends one line over the slot as it stands, re-reading past a conflict, so additions from
 * many bodies commute. A whole-slot replace compares at SLOT grain: it names the digest of the slot it read (`--base`, as om or
 * the last ah handed it back); where the slot still reads that digest it writes, re-reading past a conflict elsewhere on the
 * card; where the slot moved since, both versions land in a conflict stanza naming this writer and the slot's last writer. A
 * stanza holds at most twice the slot's budget and the record's own. Only a record that keeps moving past the rounds refuses.
 */
async function mergeSlot(args: ParsedArgs, rec: Record_, slot: string, write: SlotWrite): Promise<Record<string, unknown>> {
  const first = await readSlot(args, "ah", rec, slot);
  if (first === null) throw slotMissing(rec, slot);
  let read = first;
  const seen = "words" in write ? (write.base ?? slotDigest(first.body)) : null;
  for (let round = 0; round < CAS_ROUNDS; round++) {
    const clash = seen !== null && slotDigest(read.body) !== seen;
    const last = clash ? (await fieldsOf(args, "ah", rec.side))[writerField(slot)] || `the words standing at ${slotDigest(read.body)}` : "";
    const body = slotWriteBody(slot, read.body, write, clash, last);
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
    const body = foldOut(read.body, line);
    if (body === null) throw new SpiritRefusal("spirit-fold-gone", `spirit-fold-gone: the line "${redactedText(line.trim()).slice(0, 120)}" no longer stands in ${rec.uri}${slot} (a sibling body folded or rewrote it); nothing landed. Number the lines again: \`lares spirit hum ${rec.pet} --fold '${slot}'\``, 4);
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
  crossingHolds(rec, wordOf(args.options["body"]));
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
    await writeSide(args, "ah", rec, { [writerField(slot)]: who, ...(slot === DISTILL_SLOT ? { distilled: ctx.now().toISOString() } : {}) });
  }
  if (self !== null) await joinPresence(args, rec, self, ctx);
  emit(args, {
    ok: true, data: { pet, uri: rec.uri, slot, ...receipt },
    human: () => console.log(`${String(receipt["decision"])}: ${rec.uri}${slot} (${String(receipt["bytes"])} bytes${wakingCap(rec.budgets, slot) === null ? "" : ` of ${wakingCap(rec.budgets, slot)}`})\n  base: ${String(receipt["canonicalHash"] ?? "")}`),
  });
  return 0;
}

// ── hum ────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Append lines to the month's ash ledger, each redacted under the strict reading. The append rides alone (the tiddler door
 * refuses `append-alone` where a field patch rides with it); `create` opens the month's ledger where none stands, and a ledger
 * the append just opened takes its description in a put of its own.
 */
async function burnToAshes(args: ParsedArgs, label: string, lines: readonly string[], now: Date): Promise<string> {
  const ledger = ashLedgerOf(now);
  const refused = (decision: string): SpiritRefusal => new SpiritRefusal("spirit-ashes-refused", `spirit-ashes-refused: the ash ledger ${ledger} answered ${decision || "nothing"}; read it: \`lares tiddler get ${ledger} --recipe default\`, then run \`lares spirit ${label} …\` again`, 4);
  const receipt = await door(args, label, "tiddler-put", { recipe: RECIPE, title: ledger, append: lines.map(redactedText).join("\n"), create: true });
  const decision = String(receipt["decision"] ?? "");
  if (decision !== "put" && decision !== "noop") throw refused(decision);
  if (receipt["created"] === true) {
    const named = await door(args, label, "tiddler-put", {
      recipe: RECIPE, title: ledger,
      fields: { description: ledgerDescription(now) },
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
  crossingHolds(rec, wordOf(args.options["body"]));
  // THE LISTED LINE, BY ITS DIGEST. The number reads the listing this body saw; `--expect` names that line's digest, so a sibling's
  // write between the listing and the fold folds the line this body chose (wherever it moved), or nothing.
  const expect = wordOf(args.options["expect"]);
  if (expect === null || !SLOT_DIGEST.test(expect)) throw new DoorUsage(`--line <n> rides beside --expect <the line's digest> (16 hex), as \`lares spirit hum ${pet} --fold '${fold}'\` lists each line's`);
  const n = /^[1-9][0-9]*$/.test(lineWord) ? Number(lineWord) : NaN;
  const at = pickLine(lines, lineWord, expect);
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
  const ashLine = foldAshLine(stamp, pet, rec.uri, fold, picked);
  // The ash write retries a bounded number of times; a ledger that keeps refusing gets the line back in the slot, never lost.
  let ledger: string | null = null;
  let last: unknown = null;
  for (let round = 0; round < ASH_ROUNDS && ledger === null; round++) {
    try { ledger = await burnToAshes(args, "hum", [ashLine], stamp); } catch (e) { last = e; }
  }
  if (ledger === null) {
    await mergeSlot(args, rec, fold, { add: picked });
    const why = last instanceof SpiritRefusal ? last.message : last instanceof Printed ? `the ledger's door refused (exit ${last.exit})` : String(last);
    throw new SpiritRefusal("spirit-ashes-refused", `spirit-ashes-refused: the ash ledger refused the folded line ${ASH_ROUNDS} times (${why.slice(0, 300)}), so the line returned to the slot's end: ${redactedText(picked.trim()).slice(0, 300)}. Fold it again once the ledger answers: \`lares spirit hum ${pet} --fold '${fold}'\``, 4);
  }
  await writeSide(args, "hum", rec, { distilled: stamp.toISOString() });
  const foldSelf = wordOf(args.options["body"]);
  if (foldSelf !== null) await joinPresence(args, rec, foldSelf, ctx);
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
  return residueCut(raw);
}

/** Land one residue record, already guarded; a record already standing at the address lands nothing. */
async function landResidue(args: ParsedArgs, label: string, title: string, text: string, fields: Record<string, string>): Promise<"put" | "exists"> {
  const receipt = await door(args, label, "tiddler-put", { recipe: RECIPE, title, text, create: true, fields });
  const decision = String(receipt["decision"] ?? "");
  if (decision === "put") return "put";
  if (decision === "exists") return "exists";
  throw new SpiritRefusal("spirit-write-refused", `spirit-write-refused: the tiddler door answered ${decision || "nothing"} for ${title}; read it: \`lares tiddler get ${title} --recipe default\``, 4);
}

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
  const parent = carryParent(chain, body);
  const hash = spiritHash(text);
  const title = compactionTitle(key, hash);
  const stamp = ctx.now();
  const day = stamp.toISOString().slice(0, 10);
  const depth = carryDepth(parent);
  const landed = await landResidue(args, COMPACTION_WORD, title, text, carryFields({ pet, key, body, base: rec.base, parent, now: stamp }));
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
  const hash = residueHash(text, salt);
  const title = residueTitle(key, hash);
  const landed = await landResidue(args, "residue", title, text, residueFields(pet, ctx.now()));
  emit(args, {
    ok: true, data: { pet, title, hash, landed, cut },
    human: () => console.log(`${landed === "put" ? "landed" : "already stands"}: ${title}${cut ? ` (cut at ${RESIDUE_CAP_CHARS} chars)` : ""}`),
  });
  return 0;
}

// ── otakiage ───────────────────────────────────────────────────────────────────────────────────────────────────────

async function otakiage(args: ParsedArgs, ctx: Ctx): Promise<number> {
  const pet = petOf(args, "otakiage");
  releaseByHand(ctx.hand, `lares spirit otakiage ${pet}`);
  const rec = (await resolveRecord(args, "otakiage", pet))!;
  const key = await keyOf(args, "otakiage", rec);
  const keys = [...new Set([key, pet])];
  const listed = await door(args, "otakiage", "wiki-filter", { recipe: RECIPE, filter: residueFilter(keys), fields: [...LINEAGE_FIELDS] });
  const titles = residueOf(keys, rowsOf(listed).map((r) => r.title));
  // A carry a standing carry names as its parent holds the chain: the child burns first.
  const parents = carryParents(rowsOf(listed), titles);
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
    const undistilled = distillHold(rec.distilled, landed);
    if (undistilled !== null) { held.push({ title, why: undistilled }); continue; }
    if (isCarry(title) && parents.has(title.slice(-12))) { held.push({ title, why: `a standing ${COMPACTION_DISPLAY} names it as its parent` }); continue; }
    const links = titlesOf(await door(args, "otakiage", "wiki-filter", { recipe: RECIPE, filter: `[[${title}]backlinks[]]` }));
    if (links.length > 0) { held.push({ title, why: `${links.length} link(s) still reach it (${links.slice(0, 3).join(", ")})` }); continue; }
    const mentions = titlesOf(await door(args, "otakiage", "wiki-filter", { recipe: RECIPE, filter: `[search[${title}]] -[[${title}]]` }));
    if (mentions.length > 0) { held.push({ title, why: `${mentions.length} record(s) still name it (${mentions.slice(0, 3).join(", ")})` }); continue; }
    burnable.push({ title, line: burnLine(day, pet, title, fields["text"] ?? "", t?.textHash) });
  }
  // Write ahead: the ash lines land first, so a burn that stops halfway reads its own intent; a re-run completes it.
  const ledger = burnable.length > 0 ? await burnToAshes(args, "otakiage", burnable.map((b) => b.line), stamp) : null;
  const burned: string[] = [];
  for (const { title } of burnable) {
    const gone = await door(args, "otakiage", "tiddler-delete", { recipe: RECIPE, title });
    if (String(gone["decision"] ?? "") === "removed") burned.push(title);
  }
  if (ledger !== null) await burnToAshes(args, "otakiage", [burnTally(day, pet, burned, burnable.map((b) => b.title))], stamp);
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
