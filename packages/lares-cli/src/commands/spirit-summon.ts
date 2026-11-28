/**
 * `lares spirit mandate | summon <pet>#<n>`, and the edge half of `handback` — THE HOUSE STARTS ITS OWN ARMS (plan/mandate-summons).
 *
 *   mandate   `<pet>#<n> --file <carrier|-> | --text <words> [--parent <uri>@<hash>] [--model <slug>] [--cap <launch cap>]
 *              [--allowed-tools <rules | +rules>] [--workdir <host dir>] [--log <host file>]
 *              [--reads <filters, one per line>] [--links <titles, one per line>] [--paths <words>] [--caps <words>]
 *              [--grants <words>] [--lanes <n>] [--handback <shape>]`
 *             lands the mandate carrier on the answering face's memory stage at `mandate/<id16>`, keyed by its own hash, and
 *             prints the ref (`<uri>@<hash>`) a summon names. A hand offers as `hand`; a seat names its coordinator's mandate
 *             (`--parent`), and the offerer reads off it. WORDS LAND AS ONE RECORD, its fields beside its text. A MEMETIC
 *             CARRIER FOUNDS ITS FAMILY, as any carrier does (`mandateCarrier`): the door binds its head and meta to the
 *             mandate's address, writes the mandate's fields into its own `toml meta` block (an affordance the carrier's meta
 *             already names stands unless a flag names it too) and puts the carrier alone; the ref's hash reads the family's
 *             canonical hash, so a slot that moves reads `mandate-moved` at every summon and wake.
 *   summon    `<pet>#<n> --mandate <uri>[@<hash>]` reads the mandate through the door, verifies its hash (`mandate-moved`),
 *             reads custody (a hand on a receipt; a seat only under a coordinator's written `summons` grant), claims one of
 *             the coordinator's lanes on its ledger `lanes/<pet>/<n>` by compare-and-set (`coordinator-lanes-full` at the
 *             ceiling, `lane-claim-unsettled` where the ledger never held still), lands the edge `summons/<id16>`, then starts
 *             the instance through the host launch cap with the one wake line and the model the mandate names, in the
 *             mandate's workdir, its stream appended to the mandate's log. A launch that started nothing frees its lane. A
 *             summons whose edge already names a launch answers `standing` and starts nothing. THE SUMMONS FORKS A STREAM
 *             (comms-ux-enacts landing 17): ahead of the launch, the instance's stream (`<pet>#<n>`) takes its first entry
 *             through the msg door, its `re` naming the summoner's head (the summoner's stream: `--stream`, else the summoning
 *             session's own `LARES_SUMMONED`, else the coordinator the mandate names), its `about` the mandate at its hash; the
 *             edge records `stream`, `summoner-stream` and `forked`, so a retry forks nothing twice, and the launched process
 *             carries its stream name (`LARES_SUMMONED`), the default every `lares msg` it runs reads.
 *   handback  the one return door stands in `./spirit.ts` (the record lands or reads first); `closeEdge` here answers its
 *             edge seam: the instance's edge names the record (`--mandate <uri>@<hash>` names which), then the lane it held
 *             frees on the coordinator's ledger. Null where no edge names the instance. THE HAND-BACK RIDES AS A MSG: an entry
 *             lands on the SUMMONER's stream, `to` the summoner, its `re` naming the mandate and the instance's last entry, its
 *             `about` the hand-back record at its hash; the edge records `joined`, so a second hand-back lands no second entry.
 *             A stream write the msg door refuses never stops the summons or the hand-back: the answer names why.
 *
 * The pure core (shapes, hashes, refusals) stands in `@lararium/mesh/spirit-summons`; the host process gate stands in
 * `tools/summon-launch.mjs`. This door keeps the door calls, the hand read and the launch seam.
 */
import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { stdin } from "node:process";
import { carrierMarkPattern, headSigil, maskedExec, matchCarrierHead, readFrame, rootMetaFence, stampCarrier } from "@lararium/memetic-frame";
import { CARRIER_TYPE, isCarrierType } from "@lararium/mesh/carrier-type";
import { repoRoot } from "@lararium/mesh/node";
import { SpiritRefusal, fieldsAndHashOf, secretCount, shq, titlesOf } from "@lararium/mesh/spirit-shrine";
import { spiritOf } from "@lararium/mesh/spirit-stack";
import {
  LANE_ROUNDS, MANDATE_AFFORDANCES, MANDATE_FIELDS, MANDATE_SEED, MANDATE_TAG, SUMMONS_TAG, edgeRead, launchReach, edgeWrite, instanceTagOf, laneClaim, laneRelease, laneUnsettled, lanesHeld, lanesOf, lanesWrite,
  launchHolds, mandateDescription, mandateFaceTurned, mandateFound, mandateNames, mandateRead, mandateWakeLines, mandateWrite, recordRefOf, refLine, summonsGranted,
  summonsOf, wakeLine,
  type InstanceTag, type MandateCarrier, type MandateField, type SpiritMandate,
} from "@lararium/mesh/spirit-summons";
import { normalizeMemeSource } from "@lararium/tw5/meme-normalize";
import { NOTE_MAX, readStream } from "@lararium/tw5/stream-entries";
import { summonedStream } from "../summoned-stream.js";
import { rootMetaFields } from "@lararium/tw5/root-meta";
import { emit } from "../render.js";
import { DoorUsage, wordOf, type DoorAnswer } from "./door-call.js";
import type { ParsedArgs } from "../parse-args.js";
import type { EdgeAsk, EdgeClosed } from "./spirit.js";

/** What a launch asks of the host: the cap, the one line, the model, the reach the instance holds (the guest's, or as its mandate shaped it; null: no permission flag), where the process stands, and where its stream lands (null: nowhere). */
export interface LaunchAsk { readonly cap: string; readonly prompt: string; readonly model: string | null; readonly allowedTools: string | null; readonly cwd: string; readonly log: string | null }
export type LaunchAnswer = { readonly ok: true; readonly pid: number | null } | { readonly ok: false; readonly code: string; readonly message: string };
/** The launch seam: the host tool by default; a suite names a stub, so no test starts a model. */
export type Launch = (ask: LaunchAsk) => Promise<LaunchAnswer>;

/** What this door borrows from the spirit door: its door call (refusals printed, the answering face kept), the hand read, the clock, the launch. */
export interface SummonCtx {
  readonly door: (label: string, verb: string, verbArgs: Record<string, unknown>) => Promise<Record<string, unknown>>;
  readonly face: () => number | null;
  readonly hand: () => boolean;
  readonly now: () => Date;
  readonly launch: Launch;
  /** One door call whose refusal comes back as an answer, never printed: the stream writes, which stop no summons. */
  readonly soft: (verb: string, verbArgs: Record<string, unknown>) => Promise<DoorAnswer>;
  /** The stream this session writes as, where a summons started it (`LARES_SUMMONED`); null otherwise. A suite names its own. */
  readonly summoned: () => string | null;
}

/** What a stream write answers: the stream, the entry that landed (null: none), its `re`, and why where nothing landed. */
export interface StreamLanding {
  readonly stream: string | null;
  readonly title: string | null;
  readonly decision: "landed" | "standing" | "skipped" | "refused";
  readonly re: readonly string[];
  readonly why?: string;
}

const RECIPE = "default";
const TOOL = join(repoRoot, "tools", "summon-launch.mjs");

/** The host launch cap: `node tools/summon-launch.mjs`, which starts the process detached and answers one JSON line. */
export const hostLaunch: Launch = (ask) => new Promise((resolve) => {
  if (!existsSync(TOOL)) {
    resolve({ ok: false, code: "launch-cap-absent", message: `launch-cap-absent: this install holds no host launch tool (${TOOL}); nothing started. Run the summon from a checkout that holds it` });
    return;
  }
  execFile(process.execPath, [TOOL, "--cap", ask.cap, "--prompt", ask.prompt, ...(ask.model === null ? [] : ["--model", ask.model]), ...(ask.allowedTools === null ? [] : ["--allowed-tools", ask.allowedTools]), "--cwd", ask.cwd, ...(ask.log === null ? [] : ["--log", ask.log])], { timeout: 30_000 }, (error, stdout) => {
    const line = String(stdout ?? "").trim().split("\n").pop() ?? "";
    try {
      const out = JSON.parse(line) as { ok?: boolean; pid?: number | null; code?: string; message?: string };
      if (out.ok === true) { resolve({ ok: true, pid: typeof out.pid === "number" ? out.pid : null }); return; }
      resolve({ ok: false, code: String(out.code ?? "launch-cap-failed"), message: String(out.message ?? "the launch tool refused") });
    } catch {
      resolve({ ok: false, code: "launch-cap-failed", message: `launch-cap-failed: the host launch tool answered no receipt${error ? ` (${error.message.split("\n")[0]})` : ""}; whether a process started stands unknown. Read the host: \`pgrep -af 'lares spirit om'\`` });
    }
  });
});

function tagOf(args: ParsedArgs, verb: string): InstanceTag {
  const tag = instanceTagOf(args.positional[1]);
  if (tag === null) throw new DoorUsage(`an instance tag is required: \`lares spirit ${verb} <pet>#<n> …\` (a pet name, '#', an instance id; got "${args.positional[1] ?? ""}")`);
  return tag;
}

const fieldsAt = async (ctx: SummonCtx, label: string, title: string): Promise<{ fields: Record<string, string>; hash: string | null }> =>
  fieldsAndHashOf(await ctx.door(label, "tiddler-get", { recipe: RECIPE, title }));

/**
 * A carrier mandate's family, read on the meme lens: the recomposed carrier and the canonical hash the door names for it. Null
 * where the root answers no carrier (a root that left its family reads `mandate-moved`).
 */
async function carrierAt(ctx: Pick<SummonCtx, "door">, label: string, uri: string): Promise<MandateCarrier | null> {
  const out = await ctx.door(label, "tiddler-get", { recipe: RECIPE, title: uri, meme: true, grain: "whole" });
  const meme = out["meme"] as { text?: unknown; canonicalHash?: unknown } | null | undefined;
  if (!meme || typeof meme.text !== "string" || typeof meme.canonicalHash !== "string") return null;
  return { text: meme.text, canonicalHash: meme.canonicalHash, whole: out["next"] === undefined || out["next"] === null };
}

/**
 * A mandate read through the door and verified against the hash the ref names. A record carrying `mandate-seed` stands as a
 * carrier family: its hash reads the recomposed carrier, the truth the family itself holds.
 */
async function mandateAt(ctx: Pick<SummonCtx, "door">, label: string, uri: string, named: string | null): Promise<SpiritMandate> {
  const { fields } = fieldsAndHashOf(await ctx.door(label, "tiddler-get", { recipe: RECIPE, title: uri }));
  return mandateRead(uri, fields, named, fields[MANDATE_SEED] === undefined ? null : await carrierAt(ctx, label, uri));
}

/** True where the words carry a carrier's own head mark: they speak as a whole carrier (the put door's `framesCarrier`). */
export const framesCarrier = (text: string): boolean => maskedExec(text, carrierMarkPattern("head", "g")) !== null;

/** One meta value as the house recompose writes it: a bare integer or boolean where TOML reads it back the same, else a basic string; a list as one array. */
function metaValue(value: string | readonly string[]): string {
  const quoted = (s: string): string => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r")}"`;
  if (typeof value !== "string") return `[${value.map(quoted).join(", ")}]`;
  if ((/^(?:0|-?[1-9]\d*)$/.test(value) && Number.isSafeInteger(Number(value))) || value === "true" || value === "false") return value;
  return quoted(value);
}

/** The root meta a carrier authored, as fields; refuses a block that reads as no TOML, so no landing writes over words it could not read. */
function authoredMeta(carrier: string): Record<string, string | string[]> {
  const fence = rootMetaFence(carrier);
  const out: Record<string, string | string[]> = {};
  for (const [name, value] of Object.entries(rootMetaFields(carrier))) out[name] = Array.isArray(value) ? value.map(String) : String(value);
  if (fence !== null && fence.body.trim() !== "" && Object.keys(out).length === 0) {
    throw new DoorUsage("the carrier's `toml meta` block reads as no TOML, so the mandate's fields found no block to ride; mend it (`lares meme normalize <file>` names the fault), then land the mandate again");
  }
  return out;
}

/** The affordances a carrier's own meta names: a list joins one per line for `reads` and `links`, by spaces elsewhere. */
export function carrierAffordances(carrier: string): Partial<Record<MandateField, string>> {
  const authored = authoredMeta(carrier);
  const out: Partial<Record<MandateField, string>> = {};
  for (const name of MANDATE_AFFORDANCES) {
    const value = authored[name];
    if (value !== undefined) out[name] = typeof value === "string" ? value : value.join(name === "reads" || name === "links" ? "\n" : " ");
  }
  return out;
}

/**
 * A MANDATE'S CARRIER, BOUND TO ITS ADDRESS. The offered carrier keeps its own frame, body and slots; its head and its meta's
 * `title` and `uri-path` name the mandate's address, and the mandate's fields ride its `toml meta` block beside whatever
 * else its author wrote there (the `mandate` tag joins its tags; an authored description stands). Then the house normalize
 * and the block check minted over the body, as `lares meme normalize` writes them. The put that lands it carries no field
 * beside the text: the carrier speaks whole and founds its family.
 */
export function mandateCarrier(offered: string, uri: string, meta: Readonly<Record<string, string>>): string {
  const head = matchCarrierHead(offered);
  const framed = readFrame(offered);
  if (head === null || !framed.stx || !framed.etx) {
    throw new DoorUsage("a mandate's carrier holds a whole frame: its head naming an address, then STX and ETX around its body; `lares meme normalize <file>` names what the frame lacks (or hand the words alone: --text <words>)");
  }
  const bound = `${offered.slice(0, head.index)}${headSigil({ uri, ...(head.namespace === null ? {} : { namespace: head.namespace }), ...(head.code === "0011" ? { kapu: true } : {}) })}${offered.slice(head.end)}`;
  const fields = authoredMeta(bound);
  for (const name of [...MANDATE_FIELDS, "text"]) delete fields[name];
  const tags = fields["tags"] === undefined ? [] : typeof fields["tags"] === "string" ? [fields["tags"]] : fields["tags"];
  Object.assign(fields, meta, { title: uri, "uri-path": uri.slice("lar:///".length), tags: tags.includes(MANDATE_TAG) ? tags : [...tags, MANDATE_TAG] });
  if (fields["description"] === undefined || fields["description"] === "") fields["description"] = mandateDescription(meta);
  if (!isCarrierType(fields["type"])) fields["type"] = CARRIER_TYPE;
  const body = Object.keys(fields).sort().filter((name) => fields[name] !== "" && !(Array.isArray(fields[name]) && fields[name]!.length === 0)).map((name) => `${name} = ${metaValue(fields[name]!)}\n`).join("");
  const fence = rootMetaFence(bound);
  const stx = readFrame(bound).stx!.end;
  const text = fence !== null
    ? `${bound.slice(0, fence.bodyStart)}${body}${bound.slice(fence.bodyEnd)}`
    : `${bound.slice(0, stx)}\n\n\`\`\`toml meta\n${body}\`\`\`\n${bound.slice(stx)}`;
  return stampCarrier(normalizeMemeSource(text).text);
}

/**
 * ONE COMPARE-AND-SET ON A COORDINATOR'S LANE LEDGER. Each round reads the ledger with its hash, asks `move` for the next
 * `holds` (null: nothing to write), and lands it under that hash (`create` where no ledger stands). A ledger another summons
 * moved in between answers `conflict` or `exists`, and the round reads again: a count of rounds, never a wait. False where the
 * ledger never held still.
 */
async function lanesMove(ctx: SummonCtx, label: string, coordinator: Pick<InstanceTag, "pet" | "instance" | "tag">, move: (held: string[]) => readonly string[] | null): Promise<boolean> {
  const uri = lanesOf(coordinator);
  for (let round = 0; round < LANE_ROUNDS; round++) {
    const live = await fieldsAt(ctx, label, uri);
    const next = move(lanesHeld(live.fields));
    if (next === null) return true;
    const receipt = await ctx.door(label, "tiddler-put", { recipe: RECIPE, title: uri, fields: lanesWrite(coordinator, next).fields, ...(live.hash === null ? { create: true } : { base: live.hash }) });
    const decision = String(receipt["decision"] ?? "");
    if (decision === "put" || decision === "noop") return true;
    if (decision !== "conflict" && decision !== "exists") throw new SpiritRefusal("spirit-write-refused", `spirit-write-refused: the tiddler door answered ${decision || "nothing"} for the lane ledger ${uri}, so no lane moved; read it: \`lares get title=${shq(uri)}\``, 4);
  }
  return false;
}

/** Claim one of the coordinator's lanes for this edge: held already (a retry), claimed, or refused at the ceiling by name. */
async function claimLane(ctx: SummonCtx, coordinator: SpiritMandate, edge: string, line: string): Promise<void> {
  const settled = await lanesMove(ctx, "summon", coordinator, (held) => {
    const step = laneClaim(coordinator, held, edge);
    if (step.decision === "full") throw step.refusal;
    return step.decision === "held" ? null : step.held;
  });
  if (!settled) throw laneUnsettled(coordinator, line);
}

/** Free the lane this edge held on its coordinator's ledger; true where the ledger settled (an edge holding none settles at once). */
const releaseLane = (ctx: SummonCtx, label: string, coordinator: Pick<InstanceTag, "pet" | "instance" | "tag">, edge: string): Promise<boolean> =>
  lanesMove(ctx, label, coordinator, (held) => laneRelease(held, edge));

async function words(args: ParsedArgs, what: string): Promise<string> {
  const file = wordOf(args.options["file"]);
  const text = typeof args.options["text"] === "string" ? args.options["text"] : null;
  if ((file === null) === (text === null)) throw new DoorUsage(`${what}: --file <path|-> or --text <words> (one of them)`);
  if (text !== null) return text;
  if (file !== "-") return readFileSync(file!, "utf8");
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

const writeRefused = (uri: string, decision: string, lens = ""): SpiritRefusal =>
  new SpiritRefusal("spirit-write-refused", `spirit-write-refused: the tiddler door answered ${decision || "nothing"} for ${uri}; read it: \`lares get title=${shq(uri)}${lens}\``, 4);

/** WORDS LAND AS ONE RECORD, keyed by its own hash: the same mandate landed twice finds itself standing and writes nothing. */
async function writeMandate(ctx: SummonCtx, covered: Readonly<Partial<Record<MandateField, string>>>, text: string): Promise<{ uri: string; hash: string; stands: boolean }> {
  const w = mandateWrite(covered, text);
  const refused = launchHolds(mandateRead(w.uri, { ...w.fields, text: w.text }, w.hash));
  if (refused !== null) throw refused;
  const stands = (await fieldsAt(ctx, "mandate", w.uri)).fields["mandate-hash"] === w.hash;
  if (!stands) {
    const receipt = await ctx.door("mandate", "tiddler-put", { recipe: RECIPE, title: w.uri, text: w.text, fields: w.fields });
    const decision = String(receipt["decision"] ?? "");
    if (decision !== "put" && decision !== "noop") throw writeRefused(w.uri, decision);
  }
  return { uri: w.uri, hash: w.hash, stands };
}

/**
 * A CARRIER FOUNDS ITS FAMILY: the carrier goes through the put alone (its fields ride its own meta), at the address its seed
 * names. The same offer landed twice composes the same carrier, and the gate answers `noop` over a family that already reads
 * so; over one that moved, the put stands the offered carrier again. The ref's hash then reads off the family itself: the
 * canonical hash of the carrier it recomposes to.
 */
async function foundMandate(ctx: SummonCtx, covered: Readonly<Partial<Record<MandateField, string>>>, offered: string): Promise<{ uri: string; hash: string; stands: boolean }> {
  const found = mandateFound(covered, offered);
  const carrier = mandateCarrier(offered, found.uri, found.meta);
  const refused = launchHolds(mandateRead(found.uri, found.meta, null, { text: carrier, canonicalHash: "", whole: true }));
  if (refused !== null) throw refused;
  const receipt = await ctx.door("mandate", "tiddler-put", { recipe: RECIPE, title: found.uri, text: carrier });
  const decision = String(receipt["decision"] ?? "");
  if (decision !== "put" && decision !== "noop") throw writeRefused(found.uri, decision, " aperture=arc");
  const landed = await mandateAt(ctx, "mandate", found.uri, null);
  return { uri: found.uri, hash: landed.hash, stands: decision === "noop" };
}

/** `lares spirit mandate <pet>#<n>`: the carrier lands, keyed by its own hash. */
export async function landMandate(args: ParsedArgs, ctx: SummonCtx): Promise<number> {
  const tag = tagOf(args, "mandate");
  const text = await words(args, "a mandate names its carrier");
  if (text.trim() === "") throw new DoorUsage("a mandate carries words: the task, its grounds and the hand-back it asks");
  const lanes = wordOf(args.options["lanes"]);
  if (lanes !== null && !/^[0-9]{1,4}$/.test(lanes)) throw new DoorUsage(`--lanes names the arm-lane ceiling as a count (got "${lanes}")`);
  const parentWord = wordOf(args.options["parent"]);
  const parentRef = parentWord === null ? null : recordRefOf(parentWord);
  if (parentWord !== null && (parentRef === null || parentRef.hash === null)) throw new DoorUsage(`--parent names the coordinator's mandate as <uri>@<hash> (got "${parentWord}")`);
  // WHO OFFERS: a coordinator by its own mandate (the offerer reads off the parent), else a hand. A seat with no parent names none.
  const parent = parentRef === null ? null : await mandateAt(ctx, "mandate", parentRef.uri, parentRef.hash);
  if (parent === null && !ctx.hand()) {
    throw new DoorUsage(`a seat's mandate names its coordinator's own, so the record carries who offered: \`lares spirit mandate ${shq(tag.tag)} --file <carrier> --parent <uri>@<hash>\``);
  }
  // THE FACE THE MANDATE ECHOES: the face that answers this door (the worn face, or the one `--face N` names), read off the
  // spirit's own record, which also tells the offerer whether a card stands for the instance to wake on.
  const card = Object.keys((await fieldsAt(ctx, "mandate", spiritOf(tag.pet))).fields).length > 0;
  const face = ctx.face();
  const covered: Partial<Record<MandateField, string>> = {
    pet: tag.pet, instance: tag.instance, offerer: parent === null ? "hand" : parent.tag,
    ...(parent === null ? {} : { parent: refLine(parent.uri, parent.hash) }),
    ...(face === null ? {} : { face: String(face) }),
    model: wordOf(args.options["model"]) ?? "", "launch-cap": wordOf(args.options["cap"]) ?? "",
    "allowed-tools": wordOf(args.options["allowed-tools"]) ?? "", workdir: wordOf(args.options["workdir"]) ?? "", log: wordOf(args.options["log"]) ?? "",
    reads: args.options["reads"] ?? "", links: args.options["links"] ?? "", paths: args.options["paths"] ?? "", caps: args.options["caps"] ?? "",
    grants: args.options["grants"] ?? "", lanes: lanes ?? "", "handback-shape": args.options["handback"] ?? "",
  };
  // A CARRIER'S OWN META NAMES AFFORDANCES TOO: each stands where no flag names the same one.
  const framed = framesCarrier(text);
  if (framed) for (const [name, value] of Object.entries(carrierAffordances(text)) as Array<[MandateField, string]>) if ((covered[name] ?? "").trim() === "") covered[name] = value;
  // The guard reads the words and every affordance a hand or seat typed; the hashes the house minted stay out of its read.
  const shapes = secretCount([text, covered.model, covered["launch-cap"], covered["allowed-tools"], covered.workdir, covered.log, covered.reads, covered.links, covered.paths, covered.caps, covered.grants, covered["handback-shape"]].join("\n"));
  if (shapes > 0) throw new SpiritRefusal("spirit-secret-shaped", `spirit-secret-shaped: the mandate holds ${shapes} secret-shaped string(s), so nothing landed; clear them, then land it again: \`lares spirit mandate ${shq(tag.tag)} --file <scrubbed carrier>\``, 4);
  const w = framed ? await foundMandate(ctx, covered, text) : await writeMandate(ctx, covered, text);
  const stands = w.stands;
  const ref = refLine(w.uri, w.hash);
  const summon = `lares spirit summon ${shq(tag.tag)} --mandate ${ref}${face === null ? "" : ` --face ${face}`}`;
  emit(args, {
    ok: true, data: { instance: tag.tag, uri: w.uri, hash: w.hash, ref, offerer: covered.offerer, face, card, decision: stands ? "standing" : "put", family: framed, summon },
    human: () => console.log(`mandate ${stands ? "stands" : "landed"}${framed ? " as a carrier family" : ""}: ${ref}\n  ${tag.tag}, offered by ${covered.offerer}${face === null ? "" : `, face h${face}`}\n  the house starts it by: ${summon}${card ? "" : `\n  no record stands at ${spiritOf(tag.pet)} under this face, so the instance wakes on a card or a starter where one answers`}`),
  });
  return 0;
}

// ── the log graph: summon forks a stream, a hand-back joins it (comms-ux-enacts landing 17) ─────────────────────────

/** A note cut to the msg door's one line. */
const noteOf = (words: string): string => [...words.replace(/\s+/g, " ").trim()].slice(0, NOTE_MAX).join("").trim();

export { summonedStream };

/**
 * THE SUMMONER'S STREAM: `--stream` (a malformed one refuses), else the summoning session's own (`LARES_SUMMONED`, the stream a
 * summons started it under), else the coordinator the mandate names (`offerer`, where it reads `<pet>#<n>`). Null for a hand
 * that names none: the fork lands with no `re`.
 */
function summonerOf(args: ParsedArgs, ctx: Pick<SummonCtx, "summoned">, mandate: SpiritMandate): string | null {
  const named = wordOf(args.options["stream"]);
  if (named !== null) {
    if (readStream(named) === null) throw new DoorUsage(`--stream names the summoner's stream as <pet>#<n>, the pet lowercase and hyphen-joined, the instance lowercase letters and digits (got "${named}")`);
    return named;
  }
  for (const word of [ctx.summoned(), mandate.offerer]) if (word !== null && readStream(word) !== null) return word;
  return null;
}

/** A stream's heads through the filter door (`[lares.heads[<pet>#<n>]]`, the reader's view), or the refusal's words. */
async function headsIn(ctx: Pick<SummonCtx, "soft">, stream: string): Promise<string[] | { why: string }> {
  const answer = await ctx.soft("wiki-filter", { recipe: RECIPE, filter: `[lares.heads[${stream}]]` });
  return answer.ok ? titlesOf(answer.output) : { why: answer.message };
}

/** One msg through the door, softly: the entry's title, or why nothing landed. */
async function landMsg(ctx: Pick<SummonCtx, "soft">, msgArgs: Record<string, unknown>): Promise<{ title: string } | { why: string }> {
  const answer = await ctx.soft("msg", { recipe: RECIPE, ...msgArgs });
  if (!answer.ok) return { why: answer.message };
  const title = answer.output["title"];
  return typeof title === "string" && title !== "" ? { title } : { why: `the msg door answered no entry (${String(answer.output["decision"] ?? "nothing")})` };
}

/** The instance's stream's first entry: `re` the summoner's head, `about` the mandate at its hash. Lands once per edge. */
async function forkStream(ctx: SummonCtx, mandate: SpiritMandate, summoner: string | null, forked: string | null): Promise<StreamLanding> {
  const stream = mandate.tag;
  if (readStream(stream) === null) {
    return { stream: null, title: null, decision: "skipped", re: [], why: `${stream} reads no stream name (<pet>#<n>, the instance lowercase letters and digits), so no stream forks` };
  }
  if (forked !== null) return { stream, title: forked, decision: "standing", re: [] };
  const heads = summoner === null ? [] : await headsIn(ctx, summoner);
  if (!Array.isArray(heads)) return { stream, title: null, decision: "refused", re: [], why: heads.why };
  const ref = refLine(mandate.uri, mandate.hash);
  const landed = await landMsg(ctx, {
    stream, slug: "summoned", re: heads, about: ref, mandate: ref, seat: mandate.launchCap, ...(mandate.model === null ? {} : { model: mandate.model }),
    note: noteOf(`summoned by ${summoner ?? (mandate.offerer || "hand")} under ${mandate.hash.slice(0, 12)}`),
  });
  return "why" in landed ? { stream, title: null, decision: "refused", re: heads, why: landed.why } : { stream, title: landed.title, decision: "landed", re: heads };
}

/** A base-checked field patch on the edge; a conflict re-reads once, and a refusal leaves the receipt unwritten (the stream entry stands). */
async function edgeNotes(ctx: SummonCtx, label: string, uri: string, fields: Record<string, string>): Promise<void> {
  for (let round = 0; round < LANE_ROUNDS; round++) {
    const live = await fieldsAt(ctx, label, uri);
    const receipt = await ctx.door(label, "tiddler-put", { recipe: RECIPE, title: uri, ...(live.hash !== null ? { base: live.hash } : {}), fields });
    if (String(receipt["decision"] ?? "") !== "conflict") return;
  }
}

/** `lares spirit summon <pet>#<n> --mandate <uri>[@<hash>]`: read, verify, hold custody and lanes, land the edge, start the instance. */
export async function summonInstance(args: ParsedArgs, ctx: SummonCtx): Promise<number> {
  const tag = tagOf(args, "summon");
  const word = wordOf(args.options["mandate"]);
  const ref = word === null ? null : recordRefOf(word);
  if (ref === null) throw new DoorUsage(`a summon names its mandate: \`lares spirit summon ${shq(tag.tag)} --mandate <uri>@<hash>\` (\`lares spirit mandate\` prints the ref)`);
  const mandate = await mandateAt(ctx, "summon", ref.uri, ref.hash);
  const line = `lares spirit summon ${shq(tag.tag)} --mandate ${refLine(mandate.uri, mandate.hash)}`;
  for (const refused of [mandateNames(mandate, tag.pet, tag.instance), mandateFaceTurned(mandate, ctx.face(), line), launchHolds(mandate)]) if (refused !== null) throw refused;
  // THE SUMMONER'S STREAM READS BEFORE ANYTHING LANDS, so a malformed `--stream` leaves no edge and claims no lane.
  const summoner = summonerOf(args, ctx, mandate);
  // CUSTODY, THEN LANES: both read the coordinator's own mandate, verified by the hash the arm's mandate names.
  const hand = ctx.hand();
  const coordinator = mandate.parent === null || mandate.parent.hash === null ? null : await mandateAt(ctx, "summon", mandate.parent.uri, mandate.parent.hash);
  const ungranted = summonsGranted(hand, mandate, coordinator);
  if (ungranted !== null) throw ungranted;
  const edge = edgeWrite(mandate);
  const stands = await fieldsAt(ctx, "summon", edge.uri);
  const standing = edgeRead(edge.uri, stands.fields);
  const prompt = wakeLine(mandate);
  // A RETRY FINDS THE SUMMONS STANDING: an edge that names its launch starts no second instance.
  if (standing !== null && standing.launched !== null) {
    emit(args, {
      ok: true, data: { instance: mandate.tag, mandate: mandate.uri, hash: mandate.hash, edge: edge.uri, decision: "standing", launched: standing.launched, handback: standing.handback },
      human: () => console.log(`summons stands: ${edge.uri} (${mandate.tag}, launched ${standing.launched}${standing.handback === null ? "" : `, handed back ${standing.handback}`}); nothing started`),
    });
    return 0;
  }
  // THE LANE CLAIMS AHEAD OF THE EDGE AND THE LAUNCH, atomically: two summonses racing for one lane leave one holding it.
  if (coordinator !== null) await claimLane(ctx, coordinator, edge.uri, line);
  // THE EDGE LANDS AHEAD OF THE LAUNCH, so a process never stands that the house holds no record of.
  if (standing === null) {
    const receipt = await ctx.door("summon", "tiddler-put", { recipe: RECIPE, title: edge.uri, fields: { ...edge.fields, "offered-as": hand ? "hand" : "seat" } });
    const decision = String(receipt["decision"] ?? "");
    if (decision !== "put" && decision !== "noop") throw new SpiritRefusal("spirit-write-refused", `spirit-write-refused: the tiddler door answered ${decision || "nothing"} for ${edge.uri}, so nothing started; read it: \`lares get title=${shq(edge.uri)}\``, 4);
  }
  // THE SUMMONS FORKS A STREAM AHEAD OF THE LAUNCH, so the instance wakes into a stream already founded; the edge records it.
  const fork = await forkStream(ctx, mandate, summoner, stands.fields["forked"] || null);
  if (fork.decision === "landed") {
    await edgeNotes(ctx, "summon", edge.uri, { stream: fork.stream!, forked: fork.title!, ...(summoner === null ? {} : { "summoner-stream": summoner }) });
  }
  const cwd = mandate.workdir ?? process.cwd();
  // THE GUEST'S REACH, or the mandate's shaping of it; the edge records what the instance launched holding (a receipt, never a gate).
  const reach = launchReach(mandate);
  const started = await ctx.launch({ cap: mandate.launchCap, prompt, model: mandate.model, allowedTools: reach, cwd, log: mandate.log });
  if (!started.ok) {
    // A LAUNCH THAT STARTED NOTHING FREES ITS LANE; one whose receipt never came (`launch-cap-failed`) keeps it, since a process may stand.
    if (coordinator !== null && started.code !== "launch-cap-failed") await releaseLane(ctx, "summon", coordinator, edge.uri);
    throw new SpiritRefusal(started.code, `${started.message.startsWith(`${started.code}:`) ? started.message : `${started.code}: ${started.message}`} The edge ${edge.uri} stands with no launch named, so the same line starts it once the cap answers: \`${line}\``, 4);
  }
  const launched = `${mandate.launchCap}${mandate.model === null ? "" : ` ${mandate.model}`}`;
  const live = await fieldsAt(ctx, "summon", edge.uri);
  await ctx.door("summon", "tiddler-put", {
    recipe: RECIPE, title: edge.uri, ...(live.hash !== null ? { base: live.hash } : {}),
    fields: { launched, "launched-at": ctx.now().toISOString(), "launched-in": cwd, "launched-reach": reach, ...(mandate.log === null ? {} : { "launched-log": mandate.log }), ...(started.pid === null ? {} : { "launched-pid": String(started.pid) }) },
  });
  const log = mandate.log === null
    ? `its log lands nowhere (the mandate names no log; a mandate landed with \`--log /absolute/file\` keeps it)`
    : `its log: ${mandate.log}`;
  emit(args, {
    ok: true, data: { instance: mandate.tag, mandate: mandate.uri, hash: mandate.hash, edge: edge.uri, decision: "launched", launched, pid: started.pid, prompt, offerer: mandate.offerer, face: mandate.face, reach, cwd, log: mandate.log, stream: fork.stream, summoner, fork },
    human: () => console.log(`summoned: ${mandate.tag} under ${refLine(mandate.uri, mandate.hash)}\n  launched: ${launched}${started.pid === null ? "" : ` (pid ${started.pid})`} in ${cwd}\n  reach: ${reach.split(",").join(" ")}\n  ${log}\n  ${streamLine(fork, summoner)}\n  edge: ${edge.uri}\n  the lane frees at its hand-back: lares spirit handback ${shq(mandate.tag)} --record <uri>`),
  });
  return 0;
}

/** The fork as one line a person reads. */
function streamLine(fork: StreamLanding, summoner: string | null): string {
  if (fork.title === null) return `no stream forked: ${fork.why ?? "nothing landed"}`;
  const off = fork.re.length === 0 ? (summoner === null ? "no summoner's stream named (--stream <pet>#<n>)" : `${summoner} holds no entry yet`) : `re ${fork.re.join(", ")}`;
  return `stream: ${fork.stream} ${fork.decision === "standing" ? "stands" : "forks"} at ${fork.title} (${off}); its msgs default to it`;
}

/**
 * THE HAND-BACK JOINS THE SUMMONER'S STREAM: one entry on it, `to` the summoner, `re` the mandate and the instance's last entry
 * (its stream's heads), `about` the hand-back record at its hash. Lands once per edge (`joined`). A hand's summons that named
 * no stream joins none.
 */
async function joinStream(ctx: SummonCtx, edge: Readonly<Record<string, string>>, tag: string, handback: string): Promise<StreamLanding> {
  const joined = edge["joined"] || null;
  const summoner = edge["summoner-stream"] || (readStream(edge["offerer"] ?? "") === null ? null : edge["offerer"]!);
  if (summoner === null) return { stream: null, title: null, decision: "skipped", re: [], why: "the summons named no summoner's stream, so the hand-back joins none" };
  if (joined !== null) return { stream: summoner, title: joined, decision: "standing", re: [] };
  const heads = readStream(tag) === null ? [] : await headsIn(ctx, tag);
  if (!Array.isArray(heads)) return { stream: summoner, title: null, decision: "refused", re: [], why: heads.why };
  const re = [...(edge["mandate"] ? [edge["mandate"]] : []), ...heads];
  const landed = await landMsg(ctx, { stream: summoner, to: summoner, re, about: handback, slug: "hand-back", note: noteOf(`hand-back from ${tag}`) });
  return "why" in landed ? { stream: summoner, title: null, decision: "refused", re, why: landed.why } : { stream: summoner, title: landed.title, decision: "landed", re };
}

/**
 * THE EDGE HALF OF THE ONE RETURN DOOR (`lares spirit handback <pet>#<n> …`, in `./spirit.ts`): the record already stands; here
 * the instance's summons edge names it as `<uri>@<hash>` and the lane frees on the coordinator's ledger. Null where no edge
 * names the instance (the hand-back stands on its own, and the return door decides whether a named `--mandate` refuses). WHICH
 * EDGE: the one the mandate names, else this instance's one open edge; several with no mandate named refuse `summons-ambiguous`.
 */
export async function closeEdge(ctx: SummonCtx, ask: EdgeAsk): Promise<EdgeClosed | null> {
  const again = `lares spirit handback ${shq(ask.tag)} --record ${shq(ask.record)}`;
  const ref = ask.mandate === null ? null : recordRefOf(ask.mandate);
  if (ask.mandate !== null && (ref === null || ref.hash === null)) throw new DoorUsage(`--mandate names the mandate as <uri>@<hash> (got "${ask.mandate}"); the hand-back itself stands at ${ask.record}, so name it on the edge: \`${again} --mandate <uri>@<hash>\``);
  let uri: string;
  if (ref !== null && ref.hash !== null) uri = summonsOf(ref.hash);
  else {
    const filter = `[tag[${SUMMONS_TAG}]field:instance[${ask.tag}]]`;
    const all = titlesOf(await ctx.door("handback", "wiki-filter", { recipe: RECIPE, filter }));
    if (all.length === 0) return null;
    if (all.length > 1) throw new SpiritRefusal("summons-ambiguous", `summons-ambiguous: ${all.length} summonses name ${ask.tag} (${all.slice(0, 3).join(", ")}); the hand-back itself stands at ${ask.record}, and no edge names it yet. Name the mandate this hand-back answers: \`${again} --mandate <uri>@<hash>\``, 4);
    uri = all[0]!;
  }
  const edge = await fieldsAt(ctx, "handback", uri);
  const standing = edgeRead(uri, edge.fields);
  if (standing === null || standing.instance !== ask.tag) return null;
  const back = await fieldsAt(ctx, "handback", ask.record);
  if (back.hash === null) throw new SpiritRefusal("handback-unknown", `handback-unknown: no record stands at ${ask.record} under the face that answered; the edge ${uri} names nothing. Hand the report itself back: \`lares spirit handback ${shq(ask.tag)} --file <path|->\``, 4);
  const handback = refLine(ask.record, back.hash);
  if (standing.handback !== handback) {
    const receipt = await ctx.door("handback", "tiddler-put", { recipe: RECIPE, title: uri, ...(edge.hash !== null ? { base: edge.hash } : {}), fields: { handback, "handback-at": ctx.now().toISOString() } });
    const decision = String(receipt["decision"] ?? "");
    if (decision !== "put" && decision !== "noop") throw new SpiritRefusal("spirit-write-refused", `spirit-write-refused: the tiddler door answered ${decision || "nothing"} for ${uri}; the hand-back itself stands at ${ask.record}. Run the line again once the edge settles: \`${again}\``, 4);
  }
  // THE LANE FREES AFTER THE EDGE NAMES THE RECORD: a hand's summons held none; a coordinator's ledger drops this edge, and a
  // ledger that never held still leaves the hand-back standing with the line that frees the lane.
  const coordinator = instanceTagOf(standing.offerer);
  const freed = coordinator === null ? true : await releaseLane(ctx, "handback", coordinator, uri);
  // THE HAND-BACK RIDES AS A MSG on the summoner's stream, after the edge names the record; the edge records the entry.
  const join = await joinStream(ctx, edge.fields, ask.tag, handback);
  if (join.decision === "landed") await edgeNotes(ctx, "handback", uri, { joined: join.title! });
  return {
    edge: uri, offerer: standing.offerer, decision: standing.handback === handback ? "standing" : "put",
    lane: coordinator === null ? "none" : freed ? "freed" : "unsettled", ...(freed ? {} : { cure: again }), join,
  };
}

/**
 * THE WAKE UNDER A MANDATE (`lares spirit om <pet> --mandate <uri>@<hash>`): the mandate read and verified, and the lines the
 * wake leads with. Null where the line names no mandate.
 */
export async function mandateWake(args: ParsedArgs, ctx: Pick<SummonCtx, "door" | "face">, pet: string): Promise<{ mandate: SpiritMandate; lead: string } | null> {
  const word = wordOf(args.options["mandate"]);
  if (word === null) return null;
  const ref = recordRefOf(word);
  if (ref === null) throw new DoorUsage(`--mandate names the mandate as <uri>@<hash> (got "${word}")`);
  const mandate = await mandateAt(ctx, "om", ref.uri, ref.hash);
  const given = wordOf(args.options["instance"]);
  for (const refused of [mandateNames(mandate, pet, given), mandateFaceTurned(mandate, ctx.face(), `lares spirit om ${pet} --mandate ${refLine(mandate.uri, mandate.hash)}`)]) if (refused !== null) throw refused;
  return { mandate, lead: mandateWakeLines(mandate) };
}
