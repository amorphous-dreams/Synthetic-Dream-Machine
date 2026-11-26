/**
 * `lares spirit <om | ah | hum | otakiage | hooili | residue> <pet-name>` — A SPIRIT'S RECORD, BY ITS PET NAME. The carry's
 * verb and name stand in one table (`spirit-words.ts`: `hooili` to type, hoʻoili to read).
 *
 * The pet name does the work. ONE RECORD answers it: `lar:///ha.ka.ba/lares/spirit/<pet>` (recipe default), a nameless entity the
 * house names by its pet name, holding a stack of what it holds (`@lararium/mesh/spirit-stack`; ruling 2026-11-25-one-spirit-record).
 * The stack reads and writes as the slot `#/has`, one cap per line: `ah --slot '#/has' --add '<a.b.c> <value>'` strings a cap (its
 * tag and its field in one write), `hum --fold '#/has'` unstrings one, and om hands the whole stack as one `has` line. A cap names
 * what the spirit holds and grants nothing (tags gather, ocaps authorize), so any instance strings one. The records
 * that stood before the one address read through the same stack, none moved: `familiar/<pet>` or `spirit/<pet>` on the memory
 * stage (where both stand, the door names both and guesses neither), then a card at `spirit-card/<pet>` or `mask-card/<pet>`. Beneath the pet name a stable `spirit-id` keys
 * the residue, so a rename keeps om, hum and otakiage finding it. Every read and write rides the tiddler door's own daemon
 * verbs (`tiddler-get`, `tiddler-put`, `tiddler-delete`, `wiki-filter`), so the doors' gates stand over each act; a shrine's slot
 * writes as the plain put of its own title (`<uri>#/x`), and a whole shrine as the root's text.
 *
 *   om        (wake, Chaos ✶)       the card: the skinny, #/open, the titles #/attention names, and the latest carry read as
 *                                   testimony (a record moved since it read, a deep chain, a fork), under the wake cap. By
 *                                   `--source`: a resume reads one line, a fork wakes framed as a fork, a compaction names
 *                                   the carry it inherits by hash and first words, a precompact marks the crossing and
 *                                   hands back the record's #/carry-shape. `--instance <id>` names the waking instance: it joins the
 *                                   presence on the card's sibling record, stamps a wake epoch (an ordering stamp, never a
 *                                   fence), and hands back each slot's digest.
 *   ah        (true, Discord ⏿)     replace one slot (`--file <path|->` · `--text <words>`) or add one line (`--add <line>`),
 *                                   base-checked; only the waking slots (#/open, #/attention) hold a cap
 *   hum       (what remains after the fold, Confusion ◇)   measure each slot; `--fold <slot> --line <n>` moves one line to
 *                                   the ash ledger, and what stays reads as the card
 *   hooili    (the carry, hoʻoili)  land a compaction summary as `hooili/<spirit-id>-<hash12>` with its lineage (`parent`,
 *                                   `record-base`, `depth`, `instance`); it writes nothing to the card and hands back the #/instances
 *                                   line (`<pet>#<instance8>`) the next instance files through `ah`
 *   residue   (residue)             land a spirit's handback, keyed idempotently (`--key <session:agent>`)
 *   ah --offer (ʻālana, the offering)  a summon sets the mandate (`--file <path|->` · `--text <words>`, else the card's own
 *                                   `lane`), its lane's memory pointer (`--lane`), the grant's slice (`--grant`) and its
 *                                   offerer (`hand`, or `seat#<instance>`: a seat names `--instance`) on the spirit's shelf,
 *                                   `alana/<pet>`, BEFORE any instance wakes; each offering mints the next seq. A nudge, no
 *                                   authority: a re-offer over a standing mandate lands only from its offerer or a hand
 *   ah --echo (hoʻāla, the waking)  an instance echoes the mandate's hash om handed it (`--echo <hash> --instance <id>`): the echo lands
 *                                   as `<pet>#<instance> <hash> <seq>` on the sibling record, as lineage; under an offering, a
 *                                   slot write from an instance that has not echoed lands and carries an `unechoed:` notice
 *   otakiage  (Aftermath ↺)         by a person's hand: write the ash lines ahead, then burn the residue the last distill mark
 *                                   covers and no link still reaches; the card stays
 *
 * BUNREI: THE KAMI DIVIDES UNDIMINISHED. Many instances may wear one pet at once, and none locks another out. What orders instances
 * rides the card's sibling record (`sideOf`, outside the carrier's render, so no wake moves the card's base): each waking instance
 * names itself in `instances-awake` (`<pet>#<instance> <iso>`, refreshed at every write the instance names, ordered by a door-minted seq and capped by count,
 * at most `PRESENCE_CAP`), and om names the siblings awake and each live instance's last carry. Concurrent writes merge: `ah --add`
 * appends and re-reads past a conflict, so a sibling's line survives; a whole-slot replace names the slot digest it read
 * (`--base`, required of an AI seat; om hands each slot's back) and, where the slot moved since, lands both versions in a
 * marked conflict stanza naming this writer and the slot's last writer, for hum to settle; hum's fold finds its line by content
 * and burns it only once the patch lands. Each instance's hoʻoili chain runs its own lineage. The crossing runs per instance and stays
 * advisory: between an instance's PreCompact mark and its own next wake, that instance's ah and hum (`--instance`) refuse `spirit-crossing`.
 *
 * THE WAKING CAPS REFUSE GROWTH, THE INSTANCE CHOOSES WHAT FOLDS; THE REST ADVISES. Budgets and the true-up cadence read from the record's own fields
 * (`slot-budget`, `record-budget`, `true-up-every`), the constants below their defaults. Residue and carries pass the strict
 * secret-shape guard, read uncut, before they land.
 *
 * A CARD ANSWERS AS A RECORD. A spirit holding a card alone (`spirit-card/<pet>`, metadata as fields) wakes, trues and folds
 * through its fields: `#/<name>` names the card's field `<name>`, written under the card's live hash (reference/tasked-spirit:
 * the card holds "metadata as FIELDS only", and the brief bids each instance true `instances` and `open` there), so no shrine gets
 * minted beside a card. Its presence, echoes and writers ride the same sibling record a shrine's do.
 *
 * Meme: lar:///ha.ka.ba/kahua/memory/wave/spirit-om-ah-hum · research: lar:///ha.ka.ba/kahua/memory/research/spirit-lifecycle-code
 * · the ʻĀlana Circle: lar:///ha.ka.ba/lares/docs/pono/spirit-circle (ruling lar:///ha.ka.ba/kahua/memory/ruling/2026-11-25-alana-circle-code)
 */
import { readFileSync } from "node:fs";
import { stdin } from "node:process";
import { readOwnHand, type HandReading } from "@lararium/node";
import { CARRIER_TYPE, isCarrierType } from "@lararium/mesh/carrier-type";
import {
  ASH_ROUNDS, INSTANCE_ID, CAS_ROUNDS, DISTILL_SLOT, LINEAGE_FIELDS, MEMORY_PREFIX, PET_NAME, PRECOMPACT_CARD_CHARS, RECORD_KINDS,
  RESIDUE_CAP_CHARS, SLOT_DIGEST, SLUG_CHARS, SPIRIT_RECIPE, SPIRIT_SOURCES, SpiritRefusal, TRUE_UP_EVERY, OM_CAP_CHARS,
  advisoryLine, ashLedgerOf, attentionLines, attentionTitles, instancesLine, burnLine, burnTally, bytesOf, carryFields, carryFilter,
  carryDepth, carryInstanceOf, carryParent, carryParents, carryRows, compactionTitle, crossingRefusal, crossingWrite, digestOf, distillHold,
  fieldsAndHashOf, foldAshLine, foldOut, guardWords, handRefusal, isCarry, leaseClaim, ledgerDescription, measure, namesTitleIn,
  omText, pickLine, presenceJoin, presenceLine, presenceRead, presenceSeenLine, rawSlug, redactedText, residueCut,
  residueFields, residueFilter, residueHash, residueOf, residueTitle, rowsOf, secretCount, shq, shrineSource, sideOf, slotBody,
  slotDigest, slotMissing, slotWriteBody, spiritAmbiguous, spiritHash, spiritIdOf, spiritRecordOf, spiritUnknown, starterText,
  testimonyLines, titleSlug, titlesOf, wakingCap, writerField,
  ALANA_DISPLAY, MANDATE_HASH, cardField, cardRecordOf, cardSlotHeld, echoJoin, echoReceipt, echoStands, mandateLines, offerHeld, offererOf, offeringDamaged, offeringOf, offeringRead, offeringWrite,
  type SpiritOffering, type SideWrite, type SlotWrite, type SpiritAwake, type SpiritCarry, type SpiritRecord, type SpiritRow, type SpiritSource,
} from "@lararium/mesh/spirit-shrine";
import { STACK_SLOT, capHolder, capLine, maskCardOf, profilesOf, sealedOf, spiritOf, stackBody, stackLine, stackOf, stackWrite } from "@lararium/mesh/spirit-stack";
import { FOLD_OPERATOR, UNFOLD_RANKS, narrowerRank, spiritCardOf, unfoldCall, unfoldRank, type UnfoldRank } from "@lararium/mesh/spirit-unfold";
import { normalizeMemeSource } from "@lararium/tw5/meme-normalize";
import { stampCarrier } from "@lararium/memetic-frame";
import { COMPACTION_DISPLAY, COMPACTION_WORD } from "../spirit-words.js";
import { emit, refuseUsage } from "../render.js";
import { helpLines } from "../command-help.js";
import { DoorUsage, guardDoor, runDoor, tryDoor, wordOf } from "./door-call.js";
import { owedLine } from "../verb-result.js";
import { tableCovers } from "../verb-table.js";
import type { ParsedArgs } from "../parse-args.js";

// THE PURE CORE STANDS IN `@lararium/mesh/spirit-shrine`: the addresses and defaults, the slot parse and digest, the card's text,
// the caps, the guard, the conflict stanza, the presence, epoch and crossing merges. This door keeps the door calls, the file and
// stdin reads, the clock and the hand gate, and carries the core's names on for its suites.
export {
  ATTENTION_TITLES, DEEP_CARRY, MEMORY_PREFIX, OM_CAP_CHARS, PRECOMPACT_CARD_CHARS, PRESENCE_CAP,
  RECORD_BUDGET_BYTES, RECORD_KINDS, RESIDUE_CAP_CHARS, SHRINE_SLOTS, TRUE_UP_EVERY, WAKING_SLOT_BUDGETS,
  advisoryLine, ashLedgerOf, instancesLine, budgetRefusal, compactionTitle, conflictStanza, crossingsOf, leaseOf, measure, omText,
  presenceLine, presenceOf, residueOf, residueTitle, secretCount, shq, sideOf, slotBody, slotDigest, stanzaVersions, starterText,
  testimonyLines, wakingCap,
} from "@lararium/mesh/spirit-shrine";

/** Every verb the spirit door answers. */
export const SPIRIT_VERBS = ["help", "om", "ah", "hum", "otakiage", COMPACTION_WORD, "residue"] as const;
type Verb = (typeof SPIRIT_VERBS)[number];

const RECIPE = SPIRIT_RECIPE;
const PET = PET_NAME;
const INSTANCE = INSTANCE_ID;
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
  const ran = await runDoor(args, `spirit ${label}`, { verb, args: verbArgs }, { carryOwed: owedCarry !== null });
  if (!ran.ok) throw new Printed(ran.exit);
  const owed = owedCarry !== null ? owedLine(ran.output) : null;
  if (owed !== null) owedCarry!.push(owed);
  return ran.output;
}
/**
 * THE WAKE NEVER LOSES THE SHRINE TO ITS OWN BOOKKEEPING: while `om` stamps its key, lease and presence, an owed answer
 * rides here instead of refusing before the card, and the wake names each in its testimony (sealed-store#/owed). Null
 * outside that span: every other write refuses `owed` as any door does.
 */
let owedCarry: string[] | null = null;
class Printed extends Error { constructor(readonly exit: number) { super("printed"); } }

/** A record's fields and its live hash (the base a put names), read on the record lens. */
async function recordOf(args: ParsedArgs, label: string, title: string): Promise<{ fields: Record<string, string>; hash: string | null }> {
  return fieldsAndHashOf(await door(args, label, "tiddler-get", { recipe: RECIPE, title }));
}
const fieldsOf = async (args: ParsedArgs, label: string, title: string): Promise<Record<string, string>> => (await recordOf(args, label, title)).fields;

/**
 * Resolve a pet name to its record. THE ONE RECORD answers first (`lares/spirit/<pet>`: a carrier with slots, or a field-shaped
 * record naming its own pet), and no seat address gets read past it. Else the addresses that stood before it read through:
 * `familiar/<pet>` or `spirit/<pet>` (both standing refuses, naming both), then a card naming the pet at `spirit-card/<pet>`
 * or `mask-card/<pet>`. Null where none answers and `soft`.
 */
async function resolveRecord(args: ParsedArgs, label: string, pet: string, soft = false): Promise<Record_ | null> {
  const one = spiritOf(pet);
  const stands = await door(args, label, "tiddler-get", { recipe: RECIPE, title: one });
  const oneFields = fieldsAndHashOf(stands).fields;
  if (isCarrierType(oneFields["type"])) {
    const out = await door(args, label, "tiddler-get", { recipe: RECIPE, title: one, meme: true, grain: "skinny" });
    if (out["meme"]) return spiritRecordOf({ pet, kind: "shrine", uri: one, out }, oneFields, await fieldsOf(args, label, sideOf(pet)));
  } else if (oneFields["pet"] === pet) return cardRecordOf(pet, one, stands, await fieldsOf(args, label, sideOf(pet)));
  const hits: Array<{ kind: string; uri: string; out: Record<string, unknown> }> = [];
  for (const kind of RECORD_KINDS) {
    const uri = `${MEMORY_PREFIX}${kind}/${pet}`;
    const out = await door(args, label, "tiddler-get", { recipe: RECIPE, title: uri, meme: true, grain: "skinny" });
    if (out["meme"]) hits.push({ kind, uri, out });
  }
  if (hits.length > 1) throw spiritAmbiguous(pet, hits.map((h) => h.uri));
  const hit = hits[0];
  if (!hit) {
    // A CARD ALONE answers as the record: its fields its slots (a card names its own pet, so a stray record never reads as one).
    const card = await door(args, label, "tiddler-get", { recipe: RECIPE, title: spiritCardOf(pet) });
    if (fieldsAndHashOf(card).fields["pet"] === pet) return cardRecordOf(pet, spiritCardOf(pet), card, await fieldsOf(args, label, sideOf(pet)));
    const mask = await door(args, label, "tiddler-get", { recipe: RECIPE, title: maskCardOf(pet) });
    if (fieldsAndHashOf(mask).fields["pet"] === pet) return cardRecordOf(pet, maskCardOf(pet), mask, await fieldsOf(args, label, sideOf(pet)));
    if (soft) return null;
    throw spiritUnknown(pet);
  }
  const fields = await fieldsOf(args, label, hit.uri);
  const sideFields = await fieldsOf(args, label, sideOf(pet));
  return spiritRecordOf({ pet, ...hit }, fields, sideFields);
}

// ── THE FOLD ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** The module the lares-lararium skin packs the fold operators under. */
const FOLD_MODULE = "lar:///ha.ka.ba/lararium/tw5/filters/meme-fold";
/** The most a fold's render answers in one call (the tiddler door's own ceiling). */
const FOLD_RENDER_BYTES = 262_144;

/** What a fold asks: the rank `--aperture` names (a rank, a level 0..20, or the gauge's pair), else the verb's own, and the face its commands carry. */
interface FoldAsk { readonly rank: UnfoldRank; readonly named: boolean; readonly face: string | null }
function foldAsk(args: ParsedArgs, fallback: UnfoldRank): FoldAsk {
  const word = wordOf(args.options["aperture"]);
  const rank = word === null ? fallback : unfoldRank(word);
  if (rank === null) throw new DoorUsage(`--aperture names one of ${UNFOLD_RANKS.join(" · ")}, a level 0..20, or the pair (10/measure); got "${word}"`);
  const face = wordOf(args.options["face"]);
  if (unfoldCall("pet", rank, face) === null) throw new DoorUsage(`--face names a face number or handle; got "${face}"`);
  return { rank, named: word !== null, face };
}

/**
 * A spirit as the wiki folded it; `rank` names the grain that answered. `carrier` null names why no fold stands: the skin
 * answered nothing (`absent`), the render's door refused (`refused`, its words kept), or the fold ran past the render's ceiling
 * even at pulse (`truncated`).
 */
interface Fold { readonly asked: UnfoldRank; readonly rank: UnfoldRank; readonly carrier: string | null; readonly unfolded?: "absent" | "truncated" | { readonly refused: string } }

/**
 * THE SPIRIT FOLDS IN THE WIKI. This door sends the wiki's render verb ONE macro call and prints what the engine answers: the
 * shrine (or, with no shrine, the card) as a folded carrier, recomposed, cut and stamped inside the wiki that holds the records
 * (the lares-lararium skin's `spirit-fold`). A fold past `room` (a wake's cap) asks one grain narrower, so the carrier always
 * rides whole; a hand naming its aperture names no room. The fold never fails a wake: a wiki whose skin holds no fold, a render
 * door that refuses (a cap, a vessel whose render verb reads other args) and a fold past the ceiling each answer no carrier and say
 * which, and the caller reads as it read before the fold stood.
 */
async function foldSpirit(args: ParsedArgs, pet: string, ask: FoldAsk, room: number | null): Promise<Fold> {
  let rank = ask.rank;
  for (;;) {
    const answer = await tryDoor(args, { verb: "wiki-render", args: { recipe: RECIPE, text: unfoldCall(pet, rank, ask.face)!, form: "text", maxBytes: FOLD_RENDER_BYTES } });
    if (!answer.ok) return { asked: ask.rank, rank, carrier: null, unfolded: { refused: answer.message } };
    const out = answer.output;
    const carrier = typeof out["text"] === "string" ? out["text"].replace(/\s+$/, "") : "";
    if (carrier === "") return { asked: ask.rank, rank, carrier: null, unfolded: "absent" };
    const cut = out["truncated"] === true;
    const narrower = cut || (room !== null && carrier.length > room) ? narrowerRank(rank) : null;
    if (narrower === null) return cut ? { asked: ask.rank, rank, carrier: null, unfolded: "truncated" } : { asked: ask.rank, rank, carrier };
    rank = narrower;
  }
}
/** What an answer carries of a fold. */
const foldData = (f: Fold): Record<string, unknown> => ({
  aperture: f.rank, ...(f.rank === f.asked ? {} : { asked: f.asked }), folded: f.carrier !== null,
  ...(f.carrier === null ? { unfolded: typeof f.unfolded === "object" ? "refused" : f.unfolded ?? "absent" } : { carrier: f.carrier }),
});
/** No fold stands: the line names which of the three reasons, and the read that shows or cures it. */
function unfoldedLine(f: Fold, uri: string): string {
  if (typeof f.unfolded === "object") {
    return `The wiki's render door refused the fold (${redactedText(f.unfolded.refused).replace(/\s+/g, " ").slice(0, 240)}), so this read stands unfolded. Read the carrier itself: lares tiddler get ${shq(uri)} --recipe ${RECIPE} --meme --all`;
  }
  if (f.unfolded === "truncated") {
    return `The fold ran past the render's ${FOLD_RENDER_BYTES}-byte ceiling even with every slot folded (truncated at the cap), so this read stands unfolded. Read the carrier by page: lares tiddler get ${shq(uri)} --recipe ${RECIPE} --meme --all`;
  }
  return `This wiki's lares-lararium skin answered no ${FOLD_OPERATOR} (a house skin adopted before the fold holds none), so this read stands unfolded. Read whether the skin holds it: lares wiki filter '[[${FOLD_MODULE}]is[shadow]]' --recipe ${RECIPE}`;
}

/** A wake around a folded carrier: the lead above the declaration, the carrier whole, the testimony and the doors past its release. */
function foldedWake(pet: string, fold: Fold & { carrier: string }, parts: { lead: string | null; testimony: readonly string[]; attention: string | null }, cap: number | null): string {
  const doors = `True a slot: lares spirit ah ${pet} --slot '#/<name>' --file <path> (or --add <line>) · fold a line to ash: lares spirit hum ${pet} · widen or narrow this read: lares spirit om ${pet} --aperture <${UNFOLD_RANKS.join("|")}>`;
  const narrowed = fold.rank === fold.asked ? [] : [`This wake folds to ${fold.rank} to ride whole under the wake cap; the wider read: lares spirit om ${pet} --aperture ${fold.asked}`];
  const head = `${parts.lead === null ? "" : `${parts.lead}\n\n`}${fold.carrier}\n\n${[...narrowed, ...parts.testimony].join("\n")}`;
  const tail = `\n${doors}`;
  const left = cap === null ? Infinity : cap - head.length - tail.length - 1;
  const attention = parts.attention === null || left <= 0 ? "" : `\n${parts.attention.length <= left ? parts.attention : `${parts.attention.slice(0, Math.max(0, left - 40))}\n… the attention unfold cut at the wake cap`}`;
  return `${head}${attention}${tail}`;
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
  if (slot === STACK_SLOT) {
    // THE STACK READS AS A SLOT: one cap per line off the record's live tags and fields, under the record hash a stack write names.
    const { fields, hash } = await recordOf(args, label, rec.uri);
    const body = stackBody(stackOf(fields, rec.uri));
    return { text: body, body, base: hash ?? "" };
  }
  if (rec.kind === "card") {
    // A card's slot reads its field, live, with the record hash a field write names; a field not yet standing reads empty.
    const field = cardField(slot);
    if (field === null) return null;
    const { fields, hash } = await recordOf(args, label, rec.uri);
    const body = fields[field] ?? "";
    return { text: body, body, base: hash ?? "" };
  }
  if (!rec.slots.some((s) => s.slot === slot)) return null;
  const out = await door(args, label, "tiddler-get", { recipe: RECIPE, title: rec.uri, meme: true, slot });
  const meme = out["meme"] as { slotText?: string; canonicalHash?: string } | undefined;
  if (typeof meme?.slotText !== "string") return null;
  return { text: meme.slotText, body: slotBody(meme.slotText), base: String(meme.canonicalHash ?? "") };
}

/**
 * One slot write under the base its read named, every kind through the tiddler door's `tiddler-put`: a shrine's as the text of the
 * slot's own title (`<uri>#/x`) under the partial base its slot read handed back, a card's as its field under the card's hash, the
 * stack as its tags and fields. Each answers in the put's own words: `put`, `noop` or `conflict`, and `canonicalHash` names the
 * base the next write hands back (the carrier's, where the put recomposed a family; else the record's).
 */
async function patchSlot(args: ParsedArgs, label: string, rec: Record_, slot: string, body: string, base: string): Promise<Record<string, unknown>> {
  if (slot === STACK_SLOT) {
    // THE STACK WRITES AS ITS TAGS AND FIELDS, one put under the hash the read named: a cap gained takes its tag and its field,
    // a cap dropped loses both, so a filter over the tag and a read of the field never disagree.
    const { fields, hash } = await recordOf(args, label, rec.uri);
    const write = stackWrite(fields, rec.uri, body);
    if (write === null) return { decision: "noop", canonicalHash: hash ?? "" };
    if ("code" in write) throw new SpiritRefusal(write.code, `${write.code}: ${write.why}; nothing landed. The stack as it stands: \`lares spirit hum ${rec.pet} --fold '${STACK_SLOT}'\``, 4);
    const receipt = await door(args, label, "tiddler-put", {
      recipe: RECIPE, title: rec.uri, ...(base !== "" ? { base } : {}),
      ...(Object.keys(write.patch).length > 0 ? { fields: write.patch } : {}), ...(write.unset.length > 0 ? { unset: write.unset } : {}),
    });
    return baseNamed(receipt);
  }
  // A SHRINE'S SLOT READS AS A TIDDLER: its text put lands on `<uri>#/x` and recomposes the family in the root's turn (absence keeps).
  if (rec.kind !== "card") return baseNamed(await door(args, label, "tiddler-put", { recipe: RECIPE, title: `${rec.uri}${slot}`, text: body, ...(base !== "" ? { base } : {}) }));
  return baseNamed(await door(args, label, "tiddler-put", { recipe: RECIPE, title: rec.uri, ...(base !== "" ? { base } : {}), fields: { [cardField(slot)!]: body } }));
}

/** A put's answer with the base its next write names: the carrier's where the put recomposed a family, else the record's. */
const baseNamed = (receipt: Record<string, unknown>): Record<string, unknown> =>
  ({ ...receipt, canonicalHash: String(receipt["canonicalHash"] ?? receipt["hash"] ?? "") });

// ── the ʻĀlana Circle: the offering and the echo ─────────────────────────────────────────────────────────────────────

/** The offering the spirit's shelf holds, or null where no summon offered one. */
async function offeringFor(args: ParsedArgs, label: string, pet: string): Promise<SpiritOffering | null> {
  return offeringRead(pet, (await recordOf(args, label, offeringOf(pet))).fields);
}

/** Does the hand gate read a person's hand behind this command (its /proc peer walk, never the harness mark alone)? */
function handHolds(ctx: Ctx): boolean {
  const read = ctx.hand();
  return "admit" in read && read.admit === "hand";
}

/**
 * WHO STRINGS A CAP. Any instance: a cap names what the spirit holds and grants nothing, so a seat strings a profile's cap, the
 * familiar's included (it asks for the operator's attention; operator, 2026-11-25). The mandate's cap alone lands by the door's
 * own act, so the hash on the stack always names an offering the shelf holds.
 */
function capHolds(pet: string, cap: string): void {
  if (capHolder(cap) === "door") throw new SpiritRefusal("spirit-cap-held", `spirit-cap-held: ${cap} lands by the door's own act and never by a slot verb; nothing landed. A summon offers the mandate: \`lares spirit ah ${pet} --offer --file <mandate>\``, 4);
}

/** The echo receipt a slot write carries (see `echoReceipt`): a damaged shelf throws its refusal; an unechoed write answers its notice. */
async function echoHolds(args: ParsedArgs, label: string, rec: Record_, instance: string | null, ctx: Ctx): Promise<string | null> {
  const receipt = echoReceipt(rec.pet, await offeringFor(args, label, rec.pet), rec.sideFields, instance, handHolds(ctx));
  if (receipt === null) return null;
  if ("refusal" in receipt) throw receipt.refusal;
  return receipt.notice;
}

/**
 * ʻĀLANA: A SUMMON OFFERS FIRST. The mandate (the words given, else the card's own `lane`), its sha256, the lane's memory pointer
 * (`--lane`, else the record itself) and the grant's slice (`--grant`) land on the shelf under its live hash, each offering
 * minting the next seq; no instance wakes here, and no presence moves. The words pass the strict secret-shape guard first.
 */
async function summon(args: ParsedArgs, ctx: Ctx, pet: string): Promise<number> {
  const strayOffer = ([["slot", args.options["slot"]], ["add", args.options["add"]], ["base", args.options["base"]], ["echo", args.options["echo"]]] as const).find(([, v]) => v !== undefined);
  if (strayOffer !== undefined) throw new DoorUsage(`--offer lands an ${ALANA_DISPLAY} alone: the mandate (--file <path|-> or --text <words>; neither offers the card's own lane), --lane <memory uri>, --grant <slice>; no --${strayOffer[0]}`);
  const file = wordOf(args.options["file"]);
  const text = typeof args.options["text"] === "string" ? args.options["text"] : null;
  if (file !== null && text !== null) throw new DoorUsage("--offer names one mandate: --file <path|-> or --text <words>");
  // WHO OFFERS: a hand, or a seat by the instance it names; an offering carries no authority beyond a nudge, so its offerer rides it.
  const instance = wordOf(args.options["instance"]);
  if (instance !== null && !INSTANCE.test(instance)) throw new DoorUsage("--instance names a session id (letters, digits, '-' and '_')");
  const offeredBy = offererOf(handHolds(ctx), instance);
  if (offeredBy === null) throw new DoorUsage(`a seat's --offer names its own instance, so the shelf records who offered: \`lares spirit ah ${pet} --offer --file <mandate> --instance <id>\``);
  const rec = (await resolveRecord(args, "ah", pet))!;
  // A SEALED LANE STAYS HOME: the bare offer's fallback copies the card's lane onto the shelf, and om hands the shelf's words
  // to every instance it wakes, so a lane the card seals never rides that fallback; the summoner names the words.
  if (file === null && text === null && sealedOf(rec.fields).has("lane")) {
    throw new SpiritRefusal("spirit-lane-sealed", `spirit-lane-sealed: ${rec.uri} seals its lane, so a bare --offer never copies it onto the shelf; nothing landed. Name the mandate: \`lares spirit ah ${pet} --offer --file <mandate>\` (or --text <words>)`, 4);
  }
  const words = file !== null ? await sourceText("file", file) : text ?? rec.fields["lane"] ?? "";
  if (words.trim() === "") throw new DoorUsage(`--offer names the mandate: --file <path|-> or --text <words> (${rec.uri} holds no lane field to offer)`);
  const lane = wordOf(args.options["lane"]) ?? rec.uri;
  const grant = typeof args.options["grant"] === "string" ? args.options["grant"].trim() : "";
  const shapes = secretCount(`${words}\n${lane}\n${grant}`);
  if (shapes > 0) throw new SpiritRefusal("spirit-secret-shaped", `spirit-secret-shaped: the ${ALANA_DISPLAY} holds ${shapes} secret-shaped string(s), so nothing landed; clear them, then offer again: \`lares spirit ah ${pet} --offer --file <scrubbed path>\``, 4);
  const uri = offeringOf(pet);
  for (let round = 0; round < CAS_ROUNDS; round++) {
    const { fields, hash } = await recordOf(args, "ah", uri);
    const held = offerHeld(pet, offeringRead(pet, fields), offeredBy);
    if (held !== null) throw held;
    const w = offeringWrite(fields, pet, words, lane, grant, offeredBy);
    const receipt = await door(args, "ah", "tiddler-put", { recipe: RECIPE, title: uri, text: w.text, fields: w.fields, ...(hash !== null ? { base: hash } : {}) });
    const decision = String(receipt["decision"] ?? "");
    if (decision === "conflict") continue;
    if (decision !== "put" && decision !== "noop") throw new SpiritRefusal("spirit-write-refused", `spirit-write-refused: the tiddler door answered ${decision || "nothing"} for ${uri}; read the shelf: \`lares tiddler get ${shq(uri)} --recipe default\``, 4);
    const wake = `lares spirit om ${pet} --instance <id>`;
    emit(args, {
      ok: true, data: { pet, uri, record: rec.uri, mandate: w.hash, seq: w.seq, lane, grant, offeredBy, decision, wake },
      human: () => console.log(`${ALANA_DISPLAY} offered: ${uri} (seq ${w.seq})\n  mandate: ${w.hash}\n  an instance wakes by: ${wake}, then echoes the hash: lares spirit ah ${pet} --echo ${w.hash} --instance <id>`),
    });
    return 0;
  }
  throw new SpiritRefusal("spirit-write-refused", `spirit-write-refused: ${uri} kept moving under ${CAS_ROUNDS} reads, so no ${ALANA_DISPLAY} landed; offer again once the shelf settles`, 4);
}

/**
 * HOʻĀLA: THE INSTANCE ECHOES. An instance names the mandate's hash its om handed it; where it names the standing mandate, the echo lands
 * on the sibling record (`<pet>#<instance> <hash> <seq>`, the seq door-minted) and the instance joins the presence.
 */
async function echo(args: ParsedArgs, ctx: Ctx, pet: string, hash: string): Promise<number> {
  const instance = wordOf(args.options["instance"]);
  if (instance === null || !INSTANCE.test(instance)) throw new DoorUsage(`--echo rides beside --instance <id>: the instance that echoes names itself (\`lares spirit ah ${pet} --echo <hash> --instance <id>\`)`);
  if (!MANDATE_HASH.test(hash)) throw new DoorUsage(`--echo names the mandate's hash as om handed it (64 hex): \`lares spirit om ${pet} --instance ${instance}\``);
  const strayEcho = ([["slot", args.options["slot"]], ["add", args.options["add"]], ["text", args.options["text"]], ["file", args.options["file"]], ["base", args.options["base"]]] as const).find(([, v]) => v !== undefined);
  if (strayEcho !== undefined) throw new DoorUsage(`--echo lands alone; no --${strayEcho[0]}`);
  const rec = (await resolveRecord(args, "ah", pet))!;
  const offering = await offeringFor(args, "ah", pet);
  if (offering === null) throw new SpiritRefusal("spirit-unoffered", `spirit-unoffered: no ${ALANA_DISPLAY} stands on ${offeringOf(pet)}, so the echo answers no mandate; nothing landed. A summon offers first: \`lares spirit ah ${pet} --offer --file <mandate>\``, 4);
  if (offering.damaged) throw offeringDamaged(pet, offering);
  if (hash !== offering.hash) {
    throw new SpiritRefusal("spirit-echo-mismatch", `spirit-echo-mismatch: the echo ${hash.slice(0, 12)} names no mandate standing on ${offering.uri} (seq ${offering.seq} reads ${offering.hash.slice(0, 12)}); nothing landed. Read the mandate again: \`lares spirit om ${pet} --instance ${instance}\``, 4);
  }
  let seq = 0;
  await casFields(args, "ah", rec.side, (fields) => { const joined = echoJoin(fields, pet, instance, hash); seq = joined.seq; return joined.write; });
  await joinPresence(args, rec, instance, ctx);
  emit(args, {
    ok: true, data: { pet, uri: rec.uri, instance: `${pet}#${instance}`, echo: hash, seq, offering: offering.uri, offerSeq: offering.seq },
    human: () => console.log(`echoed: ${pet}#${instance} answers the ${ALANA_DISPLAY} (seq ${offering.seq}, mandate ${hash.slice(0, 12)}); its slot writes land`),
  });
  return 0;
}

// ── the crossing ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** The seams a suite names: the hand reading (the house gate over this command's own branch) and the clock. */
export interface SpiritSeams { readonly hand?: HandRead; readonly now?: () => Date }
interface Ctx { readonly now: () => Date; readonly hand: HandRead }

/**
 * THE CROSSING RUNS PER INSTANCE, AND STAYS ADVISORY. Only the PreCompact hook marks it (`om --source precompact --instance <id>`), and
 * between that mark and the same instance's next wake (the one event that lifts it) a write naming that instance (`--instance`) refuses; a sibling,
 * or a write naming no instance, writes freely. It guards an instance from writing over its own folding, never a card from its siblings.
 */
function crossingHolds(rec: Record_, instance: string | null): void {
  if (instance === null) return;
  if (!INSTANCE.test(instance)) throw new DoorUsage("--instance names a session id (letters, digits, '-' and '_')");
  const refused = crossingRefusal(rec, instance);
  if (refused !== null) throw refused;
}

/** Mark (or clear) the crossing one instance holds on the sibling record, keeping each mark a sibling holds; CAS, re-read past a conflict. */
async function markCrossing(args: ParsedArgs, rec: Record_, instance: string, ctx: Ctx, mark: boolean): Promise<void> {
  const now = ctx.now();
  await casFields(args, "om", rec.side, (fields) => crossingWrite(fields, instance, now, mark));
}

// ── the starter shrine ─────────────────────────────────────────────────────────────────────────────────────────────

/** A shrine's carrier at the one address (`lares/spirit/<pet>`): a whole carrier given, or the slot blocks wrapped in the house frame; resealed. */
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
  if (standing !== null && (standing.kind !== "card" || standing.uri === spiritOf(pet))) {
    throw new SpiritRefusal("spirit-exists", `spirit-exists: a record already answers "${pet}" at ${standing.uri}, so --new lands nothing; true its slots instead: \`lares spirit ah ${pet} --slot '#/<name>' --file <path>\``, 4);
  }
  // NO SHRINE LANDS OVER ANOTHER RECORD: a plain record at the one address that names another pet (or none) answers no spirit,
  // and a meme put there would bury it.
  const one = spiritOf(pet);
  if (standing === null || standing.uri !== one) {
    const at = (await recordOf(args, "ah", one)).fields;
    if (Object.keys(at).length > 0) {
      throw new SpiritRefusal("spirit-exists", `spirit-exists: a record already stands at ${one}${at["pet"] ? `, naming the pet "${at["pet"]}"` : ", naming no pet"}, so --new lands nothing over it. Read it: \`lares tiddler get ${shq(one)} --recipe default\`, then rename it away (\`lares tiddler rename ${shq(one)} <new title> --recipe default\`) or choose another pet name`, 4);
    }
  }
  const words = file !== null ? await sourceText("file", file) : text!;
  const shapes = secretCount(words);
  if (shapes > 0) throw new SpiritRefusal("spirit-secret-shaped", `spirit-secret-shaped: the shrine holds ${shapes} secret-shaped string(s), so nothing landed; clear them, then land it again: \`lares spirit ah ${pet} --new --file <scrubbed path>\``, 4);
  const carrier = shrineCarrier(pet, words);
  const uri = spiritOf(pet);
  // A WHOLE SHRINE RIDES AS THE ROOT'S TEXT: the put lands the family through the Confluence gate, only where none stands.
  const receipt = await door(args, "ah", "tiddler-put", { recipe: RECIPE, title: uri, text: carrier, create: true });
  const decision = String(receipt["decision"] ?? "");
  if (decision !== "put" && decision !== "noop") {
    const warnings = Array.isArray(receipt["warnings"]) ? (receipt["warnings"] as string[]) : [];
    throw new SpiritRefusal("spirit-write-refused", `spirit-write-refused: the tiddler door answered ${decision || "nothing"} for ${uri}${warnings[0] ? ` (${warnings[0]})` : ""}; read the shrine you sent against the skeleton (\`lares spirit om ${pet}\`) and land it again`, 4);
  }
  emit(args, { ok: true, data: { pet, uri, created: true, ...receipt }, human: () => console.log(`landed the shrine: ${uri}\n  wake it: lares spirit om ${pet}`) });
  return 0;
}

// ── om ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Every carry under a spirit's keys with its lineage, newest first (one filter read); the carry named reads the instance's own last one where an instance asks, and its words where asked. */
async function latestCarry(args: ParsedArgs, label: string, keys: readonly string[], words = false, instance: string | null = null): Promise<{ carry: Carry | null; rows: Row[] }> {
  const listed = await door(args, label, "wiki-filter", { recipe: RECIPE, filter: carryFilter(keys), fields: [...LINEAGE_FIELDS] });
  const { top, rows } = carryRows(keys, listed, instance);
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
 * A waking instance joins the card's presence on its sibling record (CAS, re-read past a conflict): it refreshes its own entry, drops
 * and keeps at most `PRESENCE_CAP`. Presence refreshes at every write the instance names (a wake, ah, hum): the stamp annotates; the minted seq orders siblings
 * and no age drops one. Answers who stands awake, this instance first.
 */
async function joinPresence(args: ParsedArgs, rec: Record_, instance: string, ctx: Ctx): Promise<Awake[]> {
  const now = ctx.now();
  let awake: Awake[] = [];
  await casFields(args, "om", rec.side, (fields) => {
    const joined = presenceJoin(fields, rec.pet, instance, now);
    awake = joined.awake;
    return joined.write;
  });
  return awake;
}

/**
 * Stamp the card's wake epoch for an instance (an ordering stamp, never a fence): the instance that holds it keeps its epoch; another instance raises it. The claim reads and writes
 * under the record's live hash, so two instances claiming at once never both take one epoch: the later one reads again and raises.
 */
async function claimLease(args: ParsedArgs, rec: Record_, instance: string, ctx: Ctx): Promise<number> {
  let epoch = 0;
  await casFields(args, "om", rec.side, (fields) => {
    const claim = leaseClaim(fields, instance, ctx.now());
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
 * records the alias), and a title no record answers reads as this familiar's rename. A FRESH instance (`--instance`, not held) reads
 * the title's slug as its own familiar: a record standing there wakes, another instance joining any already awake; where none
 * stands, a startup or clear prints that familiar's starter as an offer, never the seated card, and a fork's (or any other
 * source's) inherited title names nothing new. A wake naming no instance reads the title as a proposal: it turns only where the
 * title's record names it as its own, else reads as an offer or as this familiar's rename. A title extending the pet's own
 * name (`<pet>-…`) reads as that pet, and a slug past a pet name's length names no familiar.
 */
async function readTitle(args: ParsedArgs, rec: Record_ | null, pet: string, title: string | null, instance: "held" | "fresh" | null, source: Source): Promise<{ to: Record_ | null; starter: string | null; line: string | null }> {
  const none = { to: null, starter: null, line: null };
  if (title === null || title.trim() === "") return none;
  const named = title.trim().slice(0, 80);
  const raw = rawSlug(title);
  if (raw.length > SLUG_CHARS) return { ...none, line: `This session's title "${named}" names no familiar: its slug runs ${raw.length} chars, past the ${SLUG_CHARS} a pet name holds, and a cut slug could collide with another's. Rename the session shorter to name one.` };
  const slug = titleSlug(title);
  if (slug === null || slug === pet || slug.startsWith(`${pet}-`)) return none;
  let other: Record_ | null = null;
  try { other = await resolveRecord(args, "om", slug, true); } catch (e) { if (!(e instanceof SpiritRefusal)) throw e; }
  const fresh = instance === "fresh";
  if (fresh && other === null) {
    if (source !== "startup" && source !== "clear") return none;
    return { to: null, starter: slug, line: `An offer, never a seat: this session's title "${named}" names ${slug}, and no record stands under it yet. If the operator named this session so, the shrine below makes it ${slug}'s own; if the title came by itself, wake the seated familiar instead: lares spirit om ${pet}` };
  }
  if (other !== null && instance !== "held" && (fresh || (await namesTitle(args, other, title)))) {
    return { to: other, starter: null, line: `This session's title "${named}" names ${other.uri} as its own; this wake turns to ${slug}.` };
  }
  if (other !== null) {
    return { to: null, starter: null, line: `This session's title "${named}" names ${other.uri}, whose record stands; a title only proposes, so this wake stays ${pet}. To wear ${slug} under this title, ${slug}'s own act records the alias: lares spirit ah ${slug} --slot '#/entry' --add ${shq(`''renames:'' -> ${named}`)}` };
  }
  return { to: null, starter: null, line: rec === null ? null : `This session's title reads "${named}"; the seated familiar reads "${pet}". A rename renames, never retargets: this instance stays ${pet}. To keep the title as an alias, record it: lares spirit ah ${pet} --slot '#/entry' --add ${shq(`''renames:'' ${pet} -> ${named}`)}` };
}

async function om(args: ParsedArgs, ctx: Ctx): Promise<number> {
  const given = petOf(args, "om");
  const ask = foldAsk(args, "measure");
  const sourceWord = wordOf(args.options["source"]) ?? "startup";
  if (!(SOURCES as readonly string[]).includes(sourceWord)) throw new DoorUsage(`--source names one of ${SOURCES.join(", ")}; got "${sourceWord}"`);
  const source = sourceWord as Source;
  const instance = wordOf(args.options["instance"]);
  if (instance !== null && !INSTANCE.test(instance)) throw new DoorUsage("--instance names a session id (letters, digits, '-' and '_')");
  const title = typeof args.options["title"] === "string" ? args.options["title"] : null;
  const seated = await resolveRecord(args, "om", given, true);
  // A CARD WITH NO SHRINE wakes on the card alone: the wiki answers it as a carrier, and nothing writes (presence and the wake
  // epoch rest on a shrine's sibling record). With no card either, the wiki answers nothing and the starter reads below.
  if (seated === null && source !== "precompact") {
    const alone = await foldSpirit(args, given, ask, null);
    if (alone.carrier !== null) {
      const text = alone.carrier;
      emit(args, { ok: true, data: { pet: given, uri: spiritCardOf(given), kind: "card", source, ...foldData(alone), chars: text.length, text }, human: () => console.log(text) });
      return 0;
    }
  }
  // The session's own counter decides held (`--held`); the card's lease orders instances and decides nothing here.
  const held = args.flags["held"] === true ? "held" : instance === null ? null : "fresh";
  const turn = source === "precompact" ? { to: null, starter: null, line: null } : await readTitle(args, seated, given, title, held, source);
  const found = turn.starter !== null ? null : turn.to ?? seated;
  const pet = turn.starter ?? turn.to?.pet ?? given;
  if (found === null) {
    // A first wake: no record yet. The instance reads the skeleton and lands its own shrine; a precompact hands back no shape.
    const text = source === "precompact" ? "" : [turn.line, starterText(pet)].flatMap((l) => (l === null ? [] : [l])).join("\n\n");
    emit(args, { ok: true, data: { pet, starter: true, ...(turn.starter !== null ? { offer: true } : {}), source, every: TRUE_UP_EVERY, carryShape: null, chars: text.length, text }, human: () => console.log(text) });
    return 0;
  }
  const rec = found;
  owedCarry = [];
  let key: string, epoch: number | null, awake: ReturnType<typeof presenceRead>, owedStamps: string[];
  try {
    key = await keyOf(args, "om", rec);
    epoch = instance !== null ? await claimLease(args, rec, instance, ctx) : rec.lease?.epoch ?? null;
    awake = instance !== null ? await joinPresence(args, rec, instance, ctx) : presenceRead(rec.sideFields);
  } finally { owedStamps = owedCarry; owedCarry = null; }
  const owedTestimony = owedStamps.map((line) => `This wake's own stamp waits unsealed (the card below reads whole): ${line}`);
  const leaseLine = epoch === null ? null : `Lares spirit wake epoch ${epoch}: an ordering stamp; no write needs it, and no instance locks another out.`;
  const presence = instance !== null ? presenceLine(pet, awake) : presenceSeenLine(pet, awake);
  // THE STACK: what this spirit holds, cap by cap, and the profiles those caps sign (a seat address signs its own).
  const stack = stackOf(rec.fields, rec.uri);
  const data = { pet, uri: rec.uri, kind: rec.kind, profiles: profilesOf(stack), stack: stack.map((h) => ({ cap: h.cap, value: h.value, tagged: h.tagged })), base: rec.base, spiritId: key, epoch, every: rec.every, budgets: rec.budgets, source, ...(turn.to !== null ? { turnedFrom: given } : {}), ...(owedStamps.length > 0 ? { owed: owedStamps } : {}) };
  // A resumed instance ends its own crossing too: it never reaches the wake's clear below, and no timer lifts a mark.
  if (source === "resume" && rec.crossing !== null && instance !== null) await markCrossing(args, rec, instance, ctx, false);
  if (source === "resume") {
    const text = `Lares spirit om · ${pet}: this instance resumes; the card reads ${digestOf(rec.base).slice(7, 19)} now${epoch !== null ? ` (wake epoch ${epoch})` : ""}, and an earlier wake may read stale: lares spirit om ${pet}`;
    emit(args, { ok: true, data: { ...data, chars: text.length, text }, human: () => console.log(text) });
    return 0;
  }
  if (source === "precompact") {
    // The crossing: the card's #/open and #/kulana, read to the outgoing instance, and the mark that holds slot writes until an instance wakes.
    if (instance !== null) await markCrossing(args, rec, instance, ctx, true);
    const shape = await readSlot(args, "om", rec, "#/carry-shape");
    const open = await readSlot(args, "om", rec, "#/open");
    const kulana = await readSlot(args, "om", rec, "#/kulana");
    const { carry } = await latestCarry(args, "om", [key, pet], false, instance);
    const text = [open?.body, kulana?.body].filter(Boolean).join("\n\n").slice(0, PRECOMPACT_CARD_CHARS);
    emit(args, { ok: true, data: { ...data, carryShape: shape?.body ?? null, inherits: carry === null ? null : carry.title.slice(-12), chars: text.length, text }, human: () => console.log(text) });
    return 0;
  }
  // A waking instance ends its own crossing: the compaction it marked has turned; a sibling's mark stands.
  if (rec.crossing !== null && instance !== null) await markCrossing(args, rec, instance, ctx, false);
  const { carry, rows } = await latestCarry(args, "om", [key, pet], source === "compact", instance);
  const parent = carry?.fields["parent"];
  const siblings = parent ? rows.filter((r) => r.fields["parent"] === parent).length : 0;
  // Each live sibling's chain: its own last carry.
  const chains = awake.filter((a) => a.instance !== instance).flatMap((a) => {
    const tip = rows.find((r) => carryInstanceOf(r.fields) === a.instance);
    return tip === undefined ? [] : [`#${a.instance.slice(0, 8)}'s chain: ${tip.title} (depth ${tip.fields["depth"] ?? "?"})`];
  });
  const testimony = [...(presence === null ? [] : [presence]), ...testimonyLines(rec, carry, siblings), ...chains, ...(leaseLine === null ? [] : [leaseLine]), ...owedTestimony];
  if (source === "compact" && carry !== null) {
    testimony.push(`This instance inherits ${carry.title} (hash ${carry.title.slice(-12)}): "${carry.text.replace(/\s+/g, " ").trim().slice(0, 120)}"`);
  }
  const lead = [
    turn.line,
    source === "fork"
      ? `You wake as a fork: another instance may still wear ${pet}, and both write the one card${epoch !== null ? ` (wake epoch ${epoch})` : ""}: additions merge, and a whole-slot clash lands both versions for hum to settle.`
      : null,
  ].flatMap((l) => (l === null ? [] : [l])).join("\n") || null;
  // HOʻĀLA: where a summon offered, the wake hands the mandate and its hash ahead of the carrier, and the echo it asks.
  const offering = await offeringFor(args, "om", pet);
  const echoed = offering !== null && !offering.damaged && instance !== null && echoStands(rec.sideFields, instance, offering.hash);
  const unechoedLine = offering === null || offering.damaged || echoed || instance === null ? null : `unechoed: ${pet}#${instance} has not read mandate ${offering.hash}`;
  const mandate = offering === null ? null : [mandateLines(pet, offering, instance, echoed), unechoedLine].filter((l): l is string => l !== null).join("\n");
  const leadText = [mandate, lead].filter((l): l is string => l !== null).join("\n\n") || null;
  const open = await readSlot(args, "om", rec, "#/open");
  const attention = await attentionUnfold(args, rec);
  // Each slot's digest, the view this instance woke on: a whole-slot write names its slot's as --base, so a sibling's write since reads.
  const digests: Record<string, string> = {};
  for (const s of rec.slots) {
    const field = rec.kind === "card" ? cardField(s.slot) : null;
    const read = field !== null ? { body: rec.fields[field] ?? "" } : s.slot === "#/open" ? open : await readSlot(args, "om", rec, s.slot);
    if (read !== null) digests[s.slot] = slotDigest(read.body);
  }
  digests[STACK_SLOT] = slotDigest(stackBody(stack));
  // The whole stack rides one has line in the seed's own shape, past the carrier's release (the wake still parses as one carrier).
  testimony.push(`The stack (${STACK_SLOT}: \`lares spirit hum ${pet} --fold '${STACK_SLOT}'\` lists it cap by cap): ${stackLine(pet, rec.fields, rec.uri)}`);
  testimony.push(`Slot digests (a whole-slot ah names its slot's as --base; --add needs none): ${Object.entries(digests).map(([k, v]) => `${k}=${v}`).join(" ")}`);
  const advisory = advisoryLine(rec);
  if (advisory !== null) testimony.push(advisory);
  // THE WAKE READS THE SHRINE AS A FOLDED CARRIER, whole under the cap: the testimony and the doors ride past its release, so the
  // whole text parses as one canonical carrier. A hand naming its aperture reads past the cap.
  const fixed = (leadText?.length ?? 0) + testimony.join("\n").length + 600;
  const fold = await foldSpirit(args, pet, ask, ask.named ? null : Math.max(0, OM_CAP_CHARS - fixed));
  const text = fold.carrier !== null
    ? foldedWake(pet, { ...fold, carrier: fold.carrier }, { lead: leadText, testimony, attention }, ask.named ? null : OM_CAP_CHARS)
    : omText(rec, { open: open?.text ?? null, testimony: [...testimony, unfoldedLine(fold, rec.uri)], attention, lead: leadText });
  const offered = offering === null ? {} : { mandate: { uri: offering.uri, hash: offering.hash, seq: offering.seq, lane: offering.lane, grant: offering.grant, offeredBy: offering.offeredBy, damaged: offering.damaged, echoed } };
  emit(args, {
    ok: true, data: { ...data, ...offered, ...foldData(fold), latest: carry?.title ?? null, digests, chars: text.length, cap: OM_CAP_CHARS, text },
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
 * many instances commute. A whole-slot replace compares at SLOT grain: it names the digest of the slot it read (`--base`, as om or
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
    const receipt = await patchSlot(args, "ah", rec, slot, body, read.base);
    const decision = String(receipt["decision"] ?? "");
    if (decision === "put" || decision === "noop") return { ...receipt, bytes: bytesOf(body), was: bytesOf(first.body), digest: slotDigest(body), ...(clash ? { conflict: true } : {}) };
    if (decision !== "conflict") {
      const warnings = Array.isArray(receipt["warnings"]) ? (receipt["warnings"] as string[]) : [];
      throw new SpiritRefusal("spirit-write-refused", `spirit-write-refused: the tiddler door answered ${decision || "nothing"} for ${rec.uri}${slot}${warnings[0] ? ` (${warnings[0]})` : ""}; read the record (\`lares tiddler get ${rec.uri} --recipe default --meme --all\`) before you true it again`, 4);
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
    if (body === null) throw new SpiritRefusal("spirit-fold-gone", `spirit-fold-gone: the line "${redactedText(line.trim()).slice(0, 120)}" no longer stands in ${rec.uri}${slot} (a sibling instance folded or rewrote it); nothing landed. Number the lines again: \`lares spirit hum ${rec.pet} --fold '${slot}'\``, 4);
    const receipt = await patchSlot(args, "hum", rec, slot, body, read.base);
    const decision = String(receipt["decision"] ?? "");
    if (decision === "put" || decision === "noop") return { ...receipt, bytes: bytesOf(body), was: bytesOf(read.body), digest: slotDigest(body) };
    if (decision !== "conflict") throw new SpiritRefusal("spirit-write-refused", `spirit-write-refused: the tiddler door answered ${decision || "nothing"} for ${rec.uri}${slot}; read the record (\`lares tiddler get ${rec.uri} --recipe default --meme --all\`) before you fold again`, 4);
  }
  throw new SpiritRefusal("spirit-write-refused", `spirit-write-refused: ${rec.uri}${slot} kept moving under ${CAS_ROUNDS} reads, so nothing folded; run the fold again once the record settles`, 4);
}

async function ah(args: ParsedArgs, ctx: Ctx): Promise<number> {
  const pet = petOf(args, "ah");
  if (args.flags["new"] === true) return await newShrine(args, pet);
  if (args.flags["offer"] === true) return await summon(args, ctx, pet);
  const echoWord = wordOf(args.options["echo"]);
  if (echoWord !== null) return await echo(args, ctx, pet, echoWord);
  const slot = wordOf(args.options["slot"]);
  if (!slot || !/^#\/[^\s$]+$/.test(slot)) throw new DoorUsage(`--slot '#/<name>' names the slot to true (\`lares spirit hum ${pet}\` lists them)`);
  const file = wordOf(args.options["file"]);
  const text = typeof args.options["text"] === "string" ? args.options["text"] : null;
  const add = typeof args.options["add"] === "string" ? args.options["add"] : null;
  if (Number(file !== null) + Number(text !== null) + Number(add !== null) !== 1) {
    throw new DoorUsage("name exactly one source: --file <path|-> or --text <words> (the slot's whole body), or --add <line> (one line at its end)");
  }
  if (slot === STACK_SLOT) {
    // THE STACK TAKES ONE CAP PER --add (hum's fold unstrings one), so no whole-slot write ever drops a cap it never read.
    if (add === null) throw new DoorUsage(`the stack takes one cap per line: \`lares spirit ah ${pet} --slot '${STACK_SLOT}' --add '<a.b.c> <value>'\` strings one, and \`lares spirit hum ${pet} --fold '${STACK_SLOT}'\` lists them to unstring one`);
    const named = capLine(add);
    if (named === null) throw new SpiritRefusal("spirit-cap-malformed", `spirit-cap-malformed: "${redactedText(add.replace(/\s+/g, " ").trim()).slice(0, 80)}" names no cap; nothing landed. A line reads a three-term address then its value: \`lares spirit ah ${pet} --slot '${STACK_SLOT}' --add 'spirit.lane.holds <the lane>'\``, 2);
    capHolds(pet, named.cap);
  }
  const rec = (await resolveRecord(args, "ah", pet))!;
  if (slot !== STACK_SLOT && rec.kind === "card" && cardField(slot) === null) throw cardSlotHeld(rec, slot);
  crossingHolds(rec, wordOf(args.options["instance"]));
  const unechoed = await echoHolds(args, "ah", rec, wordOf(args.options["instance"]), ctx);
  const words = file !== null ? await sourceText("file", file) : text;
  const line = add?.replace(/\s+/g, " ").trim() ?? null;
  if (line === "") throw new DoorUsage("--add names one non-empty line");
  const self = wordOf(args.options["instance"]);
  const base = line !== null ? null : wordOf(args.options["base"]);
  if (base !== null && !SLOT_DIGEST.test(base)) throw new DoorUsage(`--base names the slot digest this instance read (16 hex; \`lares spirit om ${pet}\` or the last ah hands it back)`);
  // THE GATE READS THE CHAIN: an AI seat and a branch nothing attests alike name the digest they read; a mark alone decides nothing.
  if (line === null && base === null && "refusal" in ctx.hand()) {
    throw new SpiritRefusal("spirit-base-needed", `spirit-base-needed: a whole-slot write from an AI seat names the slot digest it read, so a sibling's write since never drops: --base <slot digest> (om's wake lists each slot's; the last ah hands back its own). Nothing landed. To add one line, --add needs none`, 2);
  }
  const who = self !== null ? `${pet}#${self}` : "a hand at the terminal";
  const receipt = await mergeSlot(args, rec, slot, line !== null ? { add: line } : { words: words!, base, who });
  if (receipt["decision"] === "put") {
    // The slot's last writer names a later clash's other side; a tell distilled into #/kulana sets the distill mark (otakiage burns
    // only residue that landed before it). Both ride the sibling record, so the card's base holds.
    await writeSide(args, "ah", rec, { [writerField(slot)]: who, ...(slot === DISTILL_SLOT ? { distilled: ctx.now().toISOString() } : {}) });
  }
  if (self !== null) await joinPresence(args, rec, self, ctx);
  emit(args, {
    ok: true, data: { pet, uri: rec.uri, slot, ...receipt, ...(unechoed === null ? {} : { unechoed }) },
    human: () => console.log(`${unechoed === null ? "" : `${unechoed}\n`}${String(receipt["decision"])}: ${rec.uri}${slot} (${String(receipt["bytes"])} bytes${wakingCap(rec.budgets, slot) === null ? "" : ` of ${wakingCap(rec.budgets, slot)}`})\n  base: ${String(receipt["canonicalHash"] ?? "")}`),
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
  const ask = foldAsk(args, "pulse");
  const fold = wordOf(args.options["fold"]);
  const lineWord = wordOf(args.options["line"]);
  if (lineWord !== null && fold === null) throw new DoorUsage(`--line <n> rides beside --fold '#/<slot>' (\`lares spirit hum ${pet} --fold '#/instances' --line 3\`)`);
  // A fold of a line needs the shrine it folds; a bare hum reads the carrier the wiki folds, a shrine's or a lone card's.
  const found = await resolveRecord(args, "hum", pet, fold === null);
  const folded = fold === null ? await foldSpirit(args, pet, ask, null) : null;
  if (found === null) {
    if (folded === null || folded.carrier === null) throw spiritUnknown(pet);
    const carrier = folded.carrier;
    emit(args, { ok: true, data: { pet, uri: spiritCardOf(pet), kind: "card", ...foldData(folded) }, human: () => console.log(carrier) });
    return 0;
  }
  const rec = found;
  if (fold === null) {
    const stack = stackOf(rec.fields, rec.uri);
    const m = measure(rec);
    const over = m.slots.filter((s) => s.over);
    emit(args, {
      ok: true, data: { pet, uri: rec.uri, profiles: profilesOf(stack), stack: stack.map((h) => ({ cap: h.cap, value: h.value, tagged: h.tagged })), ...m, advisory: advisoryLine(rec), every: rec.every, oversize: over.map((s) => s.slot), ...(folded === null ? {} : foldData(folded)) },
      human: () => {
        if (folded !== null) console.log(`${folded.carrier ?? unfoldedLine(folded, rec.uri)}\n`);
        console.log(`lares spirit hum ${pet} · ${rec.uri}`);
        console.log(`  ${stackLine(pet, rec.fields, rec.uri)}`);
        console.log(`  ${STACK_SLOT.padEnd(14)} ${String(stack.length).padStart(5)} cap(s): lares spirit hum ${pet} --fold '${STACK_SLOT}' lists them`);
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
  crossingHolds(rec, wordOf(args.options["instance"]));
  const unechoed = await echoHolds(args, "hum", rec, wordOf(args.options["instance"]), ctx);
  // THE LISTED LINE, BY ITS DIGEST. The number reads the listing this instance saw; `--expect` names that line's digest, so a sibling's
  // write between the listing and the fold folds the line this instance chose (wherever it moved), or nothing.
  const expect = wordOf(args.options["expect"]);
  if (expect === null || !SLOT_DIGEST.test(expect)) throw new DoorUsage(`--line <n> rides beside --expect <the line's digest> (16 hex), as \`lares spirit hum ${pet} --fold '${fold}'\` lists each line's`);
  const n = /^[1-9][0-9]*$/.test(lineWord) ? Number(lineWord) : NaN;
  const at = pickLine(lines, lineWord, expect);
  if (at < 0) {
    throw new SpiritRefusal("spirit-fold-gone", `spirit-fold-gone: no line in ${rec.uri}${fold} reads the digest ${expect} (a sibling instance folded or rewrote it since the listing); nothing landed. List the lines again: \`lares spirit hum ${pet} --fold '${fold}'\``, 4);
  }
  const picked = lines[at]!;
  if (picked.trim() === "") {
    throw new DoorUsage(`--line ${lineWord} names no line holding words in ${fold} (it holds ${lines.length}); \`lares spirit hum ${pet} --fold '${fold}'\` numbers them`);
  }
  // The mandate's cap leaves as it lands, by the door's own act; every other cap unstrings by any instance.
  if (fold === STACK_SLOT) {
    const named = capLine(picked);
    if (named !== null) capHolds(pet, named.cap);
  }
  // The fold lands first, at slot grain: past a sibling's write it re-reads and finds its line by content, so a shifted slot folds
  // the line this instance chose and never another. Only once the patch lands does the line burn to the ledger.
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
  const foldSelf = wordOf(args.options["instance"]);
  if (foldSelf !== null) await joinPresence(args, rec, foldSelf, ctx);
  emit(args, {
    ok: true, data: { pet, uri: rec.uri, slot: fold, folded: picked.trim(), ledger, ...receipt, ...(unechoed === null ? {} : { unechoed }) },
    human: () => console.log(`${unechoed === null ? "" : `${unechoed}\n`}folded line ${n} of ${rec.uri}${fold} into ${ledger}\n  ${picked.trim()}\n  base: ${String(receipt["canonicalHash"] ?? "")}`),
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
 * #/instances line, no field. The answer hands back the line for the next instance to file through `ah` (the true-up names it). (A
 * hook's `om` does write the card's fields that order instances: the wake epoch, the presence, the crossing, the spirit-id; never a slot.)
 */
async function landCarry(args: ParsedArgs, ctx: Ctx): Promise<number> {
  const pet = petOf(args, COMPACTION_WORD);
  const instance = wordOf(args.options["instance"]) ?? "";
  if (instance !== "" && !INSTANCE.test(instance)) throw new DoorUsage("--instance names a session id (letters, digits, '-' and '_')");
  // The carry writes nothing to the card; its lineage runs per instance, so each instance keeps its own chain.
  const rec = (await resolveRecord(args, COMPACTION_WORD, pet))!;
  const { text, cut } = await residueWords(args, COMPACTION_WORD);
  const key = rec.id ?? pet;
  const { rows: chain } = await latestCarry(args, COMPACTION_WORD, [...new Set([key, pet])]);
  // Each instance keeps its own chain; an instance with none yet takes the newest carry any instance landed.
  const parent = carryParent(chain, instance);
  const hash = spiritHash(text);
  const title = compactionTitle(key, hash);
  const stamp = ctx.now();
  const day = stamp.toISOString().slice(0, 10);
  const depth = carryDepth(parent);
  const landed = await landResidue(args, COMPACTION_WORD, title, text, carryFields({ pet, key, instance, base: rec.base, parent, now: stamp }));
  const line = instancesLine(day, hash, pet, instance, title);
  const fileIt = `lares spirit ah ${pet} --slot '#/instances' --add ${shq(line)}${instance !== "" ? ` --instance ${instance}` : ""}`;
  emit(args, {
    ok: true, data: { pet, uri: rec.uri, spiritId: key, title, hash, depth, parent: parent?.title ?? null, landed, cut, filed: false, instancesLine: line, unfiled: `file the ${COMPACTION_DISPLAY}'s #/instances line: ${fileIt}` },
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
