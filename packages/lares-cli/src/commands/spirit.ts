/**
 * `lares spirit <om | ah | hum | otakiage | round | residue> <pet-name>` — A SPIRIT'S RECORD, BY ITS PET NAME.
 *
 * The pet name does the work: it resolves the record on the worn face's memory stage (recipe default), `familiar/<pet>` first,
 * then `spirit/<pet>`. Every read and write rides the tiddler door's own daemon verbs (`tiddler-get`, `meme-patch`,
 * `tiddler-put`, `tiddler-delete`, `wiki-filter`), so the doors' gates stand over each act; this door adds the seasons and
 * the budgets, nothing more.
 *
 *   om        (wake, Chaos ✶)       the record's skinny plus #/open, one text under the wake cap, ready to inject
 *   ah        (true, Discord ⏿)     replace one slot (`--file <path|->` · `--text <words>`) or add one line (`--add <line>`),
 *                                   base-checked, the slot's budget and the record's budget checked
 *   hum       (fold, Confusion ◇)   measure each slot against its budget; `--fold <slot> --line <n>` moves one line to the ash
 *                                   ledger and out of the record
 *   round     (residue)             land a compaction summary as `round/<pet>-<hash12>` and file one #/bodies line
 *   residue   (residue)             land a spirit's handback as `spirit/<pet>-handback-<hash12>`
 *   otakiage  (Aftermath ↺)         burn the residue under the pet name to the ash ledger; the card stays
 *
 * THE BUDGET REFUSES GROWTH, THE BODY CHOOSES WHAT FOLDS. A write that grows a slot past its budget, or the record past its
 * total, refuses by name and names `hum --fold`; a write that shrinks or holds a slot's size always lands. Residue and rounds
 * pass the keep's secret-shape guard before they land. `otakiage` runs on a person's hand alone (release by the hand); an
 * AI seat runs om, ah, hum, round and residue.
 *
 * Meme: lar:///ha.ka.ba/kahua/memory/wave/spirit-om-ah-hum
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { stdin } from "node:process";
import { readOwnHand } from "@lararium/node";
import { secretShapes } from "@lararium/mesh";
import { emit, exitFor, refuseUsage } from "../render.js";
import { helpLines } from "../command-help.js";
import { DoorUsage, guardDoor, runDoor, wordOf } from "./door-call.js";
import { handFor, HandActRefused, type HandRead } from "./sense-lifecycle.js";
import { tableCovers } from "../verb-table.js";
import type { ParsedArgs } from "../parse-args.js";

/** Every verb the spirit door answers. */
export const SPIRIT_VERBS = ["help", "om", "ah", "hum", "otakiage", "round", "residue"] as const;
type Verb = (typeof SPIRIT_VERBS)[number];

// ── THE BUDGETS AND THE ADDRESSES, IN ONE SPOT ───────────────────────────────────────────────────────────────────
/** The memory stage every record and residue rests on. */
export const MEMORY_PREFIX = "lar:///ha.ka.ba/kahua/memory/";
/** Where a pet name resolves, in order. */
export const RECORD_KINDS = ["familiar", "spirit"] as const;
/** The wake's hard cap: SessionStart shows the model a preview past 10,000 chars, so `om` stays under this. */
export const OM_CAP_CHARS = 9000;
/** One slot's body budget, in bytes. */
export const SLOT_BUDGET_BYTES = 1024;
/** The record's budget: the sum of its slots' bytes. */
export const RECORD_BUDGET_BYTES = 6144;
/** The longest residue a round or a handback lands; a longer text lands cut, and the answer says so. */
export const RESIDUE_CAP_CHARS = 60_000;
const RECIPE = "default";
const PET = /^[a-z0-9][a-z0-9-]{0,62}$/;

/** The ash ledger of the month a burn lands in (`state/ashes-YYYY-MM`). */
export function ashLedgerOf(now: Date): string {
  return `${MEMORY_PREFIX}state/ashes-${now.toISOString().slice(0, 7)}`;
}
/** A round's address: two segments under the stage, the pet name and the summary's hash. */
export const roundTitle = (pet: string, hash: string): string => `${MEMORY_PREFIX}round/${pet}-${hash.slice(0, 12)}`;
/** A handback's address. */
export const residueTitle = (pet: string, hash: string): string => `${MEMORY_PREFIX}spirit/${pet}-handback-${hash.slice(0, 12)}`;
const sha256 = (text: string): string => createHash("sha256").update(text, "utf8").digest("hex");
const bytesOf = (text: string): number => Buffer.byteLength(text, "utf8");
const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** The residue under one pet name, by address alone (a pet `a` never reaches pet `a-b`'s rounds). */
export function residueOf(pet: string, titles: readonly string[]): string[] {
  const round = new RegExp(`^${escapeRe(`${MEMORY_PREFIX}round/${pet}-`)}[0-9a-f]{12}$`);
  const handback = new RegExp(`^${escapeRe(`${MEMORY_PREFIX}spirit/${pet}-handback-`)}[0-9a-f]{12}$`);
  return titles.filter((t) => round.test(t) || handback.test(t));
}

/** A slot's body as `meme-patch` reads it: the slot text without its `<<~ ahu …>>` frame. */
export function slotBody(slotText: string): string {
  const lines = slotText.replace(/\s+$/, "").split("\n");
  if (/^<<~ ahu\b/.test(lines[0] ?? "")) lines.shift();
  if (/^<<~\/ahu>>$/.test(lines.at(-1) ?? "")) lines.pop();
  return lines.join("\n").replace(/^\n+/, "").replace(/\s+$/, "");
}
/** The digest a base names, whatever its grain prefix (`skinny:`, `partial:#/x:`). */
const digestOf = (base: string): string => /sha256[:-][0-9a-f]{64}$/.exec(base)?.[0]?.replace("-", ":") ?? base;

class SpiritRefusal extends Error {
  constructor(readonly code: string, message: string, readonly exit = 4) { super(message); }
}

interface Slot { readonly slot: string; readonly bytes: number; readonly first: string | null }
interface Record_ { readonly pet: string; readonly uri: string; readonly kind: string; readonly has: string; readonly base: string; readonly bytes: number; readonly slots: readonly Slot[] }

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

/** Resolve a pet name to its record: `familiar/<pet>`, then `spirit/<pet>`, read skinny on the meme lens. */
async function resolveRecord(args: ParsedArgs, label: string, pet: string): Promise<Record_> {
  for (const kind of RECORD_KINDS) {
    const uri = `${MEMORY_PREFIX}${kind}/${pet}`;
    const out = await door(args, label, "tiddler-get", { recipe: RECIPE, title: uri, meme: true, grain: "skinny" });
    const meme = out["meme"] as { canonicalHash?: string; bytes?: number; slots?: Slot[] } | undefined;
    if (!meme) continue;
    return { pet, uri, kind, has: String(out["has"] ?? ""), base: String(meme.canonicalHash ?? ""), bytes: Number(meme.bytes ?? 0), slots: meme.slots ?? [] };
  }
  throw new SpiritRefusal("spirit-unknown", `spirit-unknown: no record answers the pet name "${pet}" at ${MEMORY_PREFIX}familiar/${pet} or ${MEMORY_PREFIX}spirit/${pet}; list the records: \`lares wiki filter '[prefix[${MEMORY_PREFIX}familiar/]!regexp[#]] [prefix[${MEMORY_PREFIX}spirit/]!regexp[#]]' --recipe default\``, 3);
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

// ── om ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The wake text: the skinny, then #/open, then the doors that read and true the rest; cut under `cap` chars. */
export function omText(rec: Record_, open: string | null, cap = OM_CAP_CHARS): string {
  const head = `Lares spirit om · ${rec.pet} (${rec.uri}): the record a waking body reads first, before any summary.`;
  const doors = `Read a slot whole: lares tiddler get ${rec.uri} --recipe default --meme --slot '#/<name>' · true one: lares spirit ah ${rec.pet} --slot '#/<name>' --file <path> (or --add <line>) · fold: lares spirit hum ${rec.pet}`;
  const fixed = [head, rec.has, "", doors].join("\n");
  if (open === null) return fixed.length <= cap ? fixed : `${fixed.slice(0, cap - 1)}…`;
  const room = cap - fixed.length - 2;
  const cut = `\n… #/open cut at the ${cap}-char wake cap; read it whole: lares tiddler get ${rec.uri} --recipe default --meme --slot '#/open'`;
  const body = open.length <= room ? open : `${open.slice(0, Math.max(0, room - cut.length))}${cut}`;
  return [head, rec.has, "", body, doors].join("\n").slice(0, cap);
}

async function om(args: ParsedArgs): Promise<number> {
  const pet = petOf(args, "om");
  const rec = await resolveRecord(args, "om", pet);
  const open = await readSlot(args, "om", rec, "#/open");
  const text = omText(rec, open?.text ?? null);
  emit(args, {
    ok: true, data: { pet, uri: rec.uri, kind: rec.kind, base: rec.base, chars: text.length, cap: OM_CAP_CHARS, text },
    human: () => console.log(text),
  });
  return 0;
}

// ── ah ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** What a slot write would leave, measured against both budgets: the refusal where it grows past one, else null. */
export function budgetRefusal(rec: Pick<Record_, "pet" | "uri" | "slots">, slot: string, oldBody: string, newBody: string): SpiritRefusal | null {
  const was = bytesOf(oldBody);
  const now = bytesOf(newBody);
  if (now <= was) return null;
  const fold = `\`lares spirit hum ${rec.pet} --fold '${slot}'\` lists its lines; \`--line <n>\` moves one to the ash ledger`;
  if (now > SLOT_BUDGET_BYTES) return new SpiritRefusal("spirit-slot-over-budget", `spirit-slot-over-budget: ${slot} would hold ${now} bytes, past its ${SLOT_BUDGET_BYTES}-byte budget (it holds ${was}); nothing landed. Fold first: ${fold}, then true it again`);
  const total = rec.slots.reduce((n, s) => n + s.bytes, 0) + (now - was);
  if (total > RECORD_BUDGET_BYTES) return new SpiritRefusal("spirit-record-over-budget", `spirit-record-over-budget: ${rec.uri} would hold ${total} bytes across its slots, past its ${RECORD_BUDGET_BYTES}-byte budget; nothing landed. \`lares spirit hum ${rec.pet}\` names the heaviest slots; ${fold}`);
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

async function ah(args: ParsedArgs): Promise<number> {
  const pet = petOf(args, "ah");
  const slot = wordOf(args.options["slot"]);
  if (!slot || !/^#\/[^\s$]+$/.test(slot)) throw new DoorUsage(`--slot '#/<name>' names the slot to true (\`lares spirit hum ${pet}\` lists them)`);
  const file = wordOf(args.options["file"]);
  const text = typeof args.options["text"] === "string" ? args.options["text"] : null;
  const add = typeof args.options["add"] === "string" ? args.options["add"] : null;
  if (Number(file !== null) + Number(text !== null) + Number(add !== null) !== 1) {
    throw new DoorUsage("name exactly one source: --file <path|-> or --text <words> (the slot's whole body), or --add <line> (one line at its end)");
  }
  const rec = await resolveRecord(args, "ah", pet);
  const words = file !== null ? await sourceText("file", file) : text;
  const line = add?.replace(/\s+/g, " ").trim() ?? null;
  if (line === "") throw new DoorUsage("--add names one non-empty line");
  const receipt = await trueSlot(args, "ah", rec, slot, (body) => (line !== null ? `${body}\n${line}` : words!), wordOf(args.options["base"]));
  emit(args, {
    ok: true, data: { pet, uri: rec.uri, slot, ...receipt },
    human: () => console.log(`${String(receipt["decision"])}: ${rec.uri}${slot} (${String(receipt["bytes"])} of ${SLOT_BUDGET_BYTES} bytes)\n  base: ${String(receipt["canonicalHash"] ?? "")}`),
  });
  return 0;
}

// ── hum ────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Each slot against its budget, and the record's total against its own. */
export function measure(rec: Pick<Record_, "slots">): { slots: Array<Slot & { budget: number; over: boolean }>; total: number; budget: number; over: boolean } {
  const slots = rec.slots.map((s) => ({ ...s, budget: SLOT_BUDGET_BYTES, over: s.bytes > SLOT_BUDGET_BYTES }));
  const total = rec.slots.reduce((n, s) => n + s.bytes, 0);
  return { slots, total, budget: RECORD_BUDGET_BYTES, over: total > RECORD_BUDGET_BYTES };
}

/** Append lines to the month's ash ledger, opening it where the month holds none yet. */
async function burnToAshes(args: ParsedArgs, label: string, lines: readonly string[], now: Date): Promise<string> {
  const ledger = ashLedgerOf(now);
  const words = lines.join("\n");
  const appended = await door(args, label, "tiddler-put", { recipe: RECIPE, title: ledger, append: `\n${words}` });
  const decision = String(appended["decision"] ?? "");
  if (decision === "put" || decision === "noop") return ledger;
  const opened = await door(args, label, "tiddler-put", {
    recipe: RECIPE, title: ledger, create: true, text: `${words}\n`,
    fields: { description: `The ash ledger of the ${now.toISOString().slice(0, 7)} o-takiage sittings: each burned stage item with what landed it and the date.` },
  });
  if (String(opened["decision"] ?? "") !== "put") {
    throw new SpiritRefusal("spirit-ashes-refused", `spirit-ashes-refused: the ash ledger ${ledger} took nothing (${decision}, then ${String(opened["decision"] ?? "?")}); nothing left the record. Read it: \`lares tiddler get ${ledger} --recipe default\``, 4);
  }
  return ledger;
}

async function hum(args: ParsedArgs, now: () => Date): Promise<number> {
  const pet = petOf(args, "hum");
  const rec = await resolveRecord(args, "hum", pet);
  const fold = wordOf(args.options["fold"]);
  const lineWord = wordOf(args.options["line"]);
  if (lineWord !== null && fold === null) throw new DoorUsage(`--line <n> rides beside --fold '#/<slot>' (\`lares spirit hum ${pet} --fold '#/bodies' --line 3\`)`);
  if (fold === null) {
    const m = measure(rec);
    const over = m.slots.filter((s) => s.over);
    emit(args, {
      ok: true, data: { pet, uri: rec.uri, ...m, oversize: over.map((s) => s.slot) },
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
  const n = /^[1-9][0-9]*$/.test(lineWord) ? Number(lineWord) : NaN;
  const picked = Number.isInteger(n) ? lines[n - 1] : undefined;
  if (picked === undefined || picked.trim() === "") {
    throw new DoorUsage(`--line ${lineWord} names no line holding words in ${fold} (it holds ${lines.length}); \`lares spirit hum ${pet} --fold '${fold}'\` numbers them`);
  }
  // The words reach the ledger first, so a write that refuses after leaves them in two places, never in none.
  const stamp = now();
  const ledger = await burnToAshes(args, "hum", [`* ${stamp.toISOString().slice(0, 10)} · hum ${pet} folded from ${rec.uri}${fold}: ${picked.trim()}`], stamp);
  const kept = lines.filter((_, i) => i !== n - 1).join("\n");
  const receipt = await trueSlot(args, "hum", rec, fold, () => kept, read.base);
  emit(args, {
    ok: true, data: { pet, uri: rec.uri, slot: fold, folded: picked.trim(), ledger, ...receipt },
    human: () => console.log(`folded line ${n} of ${rec.uri}${fold} into ${ledger}\n  ${picked.trim()}\n  base: ${String(receipt["canonicalHash"] ?? "")}`),
  });
  return 0;
}

// ── round · residue ─────────────────────────────────────────────────────────────────────────────────────────────────

async function residueWords(args: ParsedArgs): Promise<{ text: string; cut: boolean }> {
  const file = wordOf(args.options["file"]);
  const inline = typeof args.options["text"] === "string" ? args.options["text"] : null;
  if (Number(file !== null) + Number(inline !== null) !== 1) throw new DoorUsage("name exactly one source: --text <words> or --file <path|->");
  const raw = file !== null ? await sourceText("file", file) : inline!;
  if (raw.trim() === "") throw new DoorUsage("the residue holds no words; nothing lands");
  return raw.length > RESIDUE_CAP_CHARS ? { text: raw.slice(0, RESIDUE_CAP_CHARS), cut: true } : { text: raw, cut: false };
}

/** Land one residue record after the keep's secret-shape guard; a record already standing at the address lands nothing. */
async function landResidue(args: ParsedArgs, label: string, title: string, text: string, description: string): Promise<"put" | "exists"> {
  const shapes = secretShapes(text);
  if (shapes.length > 0) {
    throw new SpiritRefusal("spirit-secret-shaped", `spirit-secret-shaped: the ${label} holds ${shapes.length} secret-shaped string(s), so nothing landed at ${title}; clear them at the source, then land it by hand: \`lares spirit ${label} <pet> --file <scrubbed path>\``, 4);
  }
  const receipt = await door(args, label, "tiddler-put", { recipe: RECIPE, title, text, create: true, fields: { description } });
  const decision = String(receipt["decision"] ?? "");
  if (decision === "put") return "put";
  if (decision === "exists") return "exists";
  throw new SpiritRefusal("spirit-write-refused", `spirit-write-refused: the tiddler door answered ${decision || "nothing"} for ${title}; read it: \`lares tiddler get ${title} --recipe default\``, 4);
}

async function round(args: ParsedArgs, now: () => Date): Promise<number> {
  const pet = petOf(args, "round");
  const rec = await resolveRecord(args, "round", pet);
  const { text, cut } = await residueWords(args);
  const hash = sha256(text);
  const title = roundTitle(pet, hash);
  const day = now().toISOString().slice(0, 10);
  const landed = await landResidue(args, "round", title, text, `a compaction round of ${pet}, ${day}: the summary one body's context turned on`);
  // One #/bodies line names the round; a budget that refuses leaves it unfiled, and the answer says which fold files it.
  const line = `* ''${day} (round ${hash.slice(0, 12)}):'' ${title}`;
  let filed: true | string = true;
  if (landed === "put") {
    try { await trueSlot(args, "round", rec, "#/bodies", (body) => `${body}\n${line}`, null); }
    catch (e) { if (e instanceof SpiritRefusal) filed = e.message; else throw e; }
  }
  emit(args, {
    ok: true, data: { pet, uri: rec.uri, title, hash, landed, cut, filed: filed === true, ...(filed === true ? {} : { unfiled: filed }) },
    human: () => {
      console.log(`${landed === "put" ? "landed" : "already stands"}: ${title}${cut ? ` (cut at ${RESIDUE_CAP_CHARS} chars)` : ""}`);
      console.log(filed === true ? `  #/bodies: ${line}` : `  unfiled: ${filed}`);
    },
  });
  return 0;
}

/** A pet name read off a handback: its mask tag (`Name: Lares (Tasked Spirit)`), else the fallback, slugged. */
export function handbackPet(message: string, fallback: string): string {
  const tag = /^\W*([A-Za-z][\w-]{0,40}):\s*Lares\s*\(Tasked Spirit\)/m.exec(message)?.[1] ?? fallback;
  const slug = tag.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 62);
  return PET.test(slug) ? slug : "spirit";
}

async function residue(args: ParsedArgs, now: () => Date): Promise<number> {
  const pet = petOf(args, "residue");
  const { text, cut } = await residueWords(args);
  const hash = sha256(text);
  const title = residueTitle(pet, hash);
  const landed = await landResidue(args, "residue", title, text, `a handback of the spirit ${pet}, ${now().toISOString().slice(0, 10)}`);
  emit(args, {
    ok: true, data: { pet, title, hash, landed, cut },
    human: () => console.log(`${landed === "put" ? "landed" : "already stands"}: ${title}${cut ? ` (cut at ${RESIDUE_CAP_CHARS} chars)` : ""}`),
  });
  return 0;
}

// ── otakiage ───────────────────────────────────────────────────────────────────────────────────────────────────────

async function otakiage(args: ParsedArgs, hand: HandRead, now: () => Date): Promise<number> {
  const pet = petOf(args, "otakiage");
  handFor("lares spirit otakiage", `lares spirit otakiage ${pet}`, hand);
  const rec = await resolveRecord(args, "otakiage", pet);
  const filter = `[prefix[${MEMORY_PREFIX}round/${pet}-]] [prefix[${MEMORY_PREFIX}spirit/${pet}-handback-]]`;
  const listed = await door(args, "otakiage", "wiki-filter", { recipe: RECIPE, filter });
  const titles = residueOf(pet, Array.isArray(listed["titles"]) ? (listed["titles"] as string[]) : []);
  const stamp = now();
  const day = stamp.toISOString().slice(0, 10);
  const lines: string[] = [];
  for (const title of titles) {
    const got = await door(args, "otakiage", "tiddler-get", { recipe: RECIPE, title });
    const t = got["tiddler"] as { fields?: Record<string, string>; textHash?: string | null } | null | undefined;
    const text = t?.fields?.["text"] ?? "";
    const first = text.split("\n").find((l) => l.trim() !== "")?.trim().slice(0, 200) ?? "";
    lines.push(`* ${day} · otakiage ${pet} burned ${title} (${bytesOf(text)} bytes, ${t?.textHash ?? "?"})${first ? `: ${first}` : ""}`);
  }
  const ledger = titles.length > 0 ? await burnToAshes(args, "otakiage", lines, stamp) : null;
  const burned: string[] = [];
  for (const title of titles) {
    const gone = await door(args, "otakiage", "tiddler-delete", { recipe: RECIPE, title });
    if (String(gone["decision"] ?? "") === "removed") burned.push(title);
  }
  emit(args, {
    ok: true, data: { pet, uri: rec.uri, kept: rec.uri, burned, ledger },
    human: () => {
      console.log(`lares spirit otakiage ${pet}: the card stays at ${rec.uri}`);
      if (burned.length === 0) console.log("  no residue stands under this pet name");
      for (const title of burned) console.log(`  burned ${title}`);
      if (ledger) console.log(`  ashes: ${ledger}`);
      console.log(`  distill what the residue taught into #/voice: lares spirit ah ${pet} --slot '#/voice' --add '<tell>'`);
    },
  });
  return 0;
}

// ── the door ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** The seams a suite names: the hand reading and the clock. */
export interface SpiritSeams { readonly hand?: HandRead; readonly now?: () => Date }

export async function cmdSpirit(args: ParsedArgs, seams: SpiritSeams = {}): Promise<number> {
  const verb = args.positional[0];
  if (!verb || verb === "help" || !(SPIRIT_VERBS as readonly string[]).includes(verb)) {
    return refuseUsage(args, "spirit", helpLines("spirit"), verb === undefined || verb === "help" ? undefined : `unknown verb "${verb}"`);
  }
  const hand = seams.hand ?? (() => readOwnHand({ proveRoute: false }));
  const now = seams.now ?? (() => new Date());
  return guardDoor(args, `spirit ${verb}`, async () => {
    try {
      const v = verb as Exclude<Verb, "help">;
      switch (v) {
        case "om":       return await om(args);
        case "ah":       return await ah(args);
        case "hum":      return await hum(args, now);
        case "round":    return await round(args, now);
        case "residue":  return await residue(args, now);
        case "otakiage": return await otakiage(args, hand, now);
        default:         return refuseUsage(args, "spirit", helpLines("spirit"), `unknown verb "${tableCovers(v)}"`);
      }
    } catch (e) {
      if (e instanceof Printed) return e.exit;
      if (e instanceof SpiritRefusal || e instanceof HandActRefused) {
        const code = e instanceof HandActRefused ? e.code : e.code;
        const exit = e instanceof HandActRefused ? exitFor("cap-denied") : e.exit;
        emit(args, { ok: false, error: { code, message: e.message }, human: () => console.error(`lares spirit ${verb}: ${e.message}`) });
        return exit;
      }
      throw e;
    }
  });
}
