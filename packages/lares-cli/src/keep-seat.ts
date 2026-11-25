/**
 * keep-seat — the house's KEEP PAIR at rest: the public half a cut seals the roster to, and the slot tree its secret half opens
 * from (`@lararium/mesh` keep-seat), under the human's own routes. No loose key: nothing secret rests here without a route.
 *
 * WHERE IT RESTS. `<config>/keep-seat.json`: the config home survives a re-founding, the hearth's reset never reaches it, and the
 * container binds it to the host. Every cut copies the seat into the bundle beside the roster, so a restore onto a brand-new
 * house root opens it with a passphrase or a paper sheet, and no file crosses by hand; that restore seats the bundle's pair here
 * where none rests, so the next keep seals to the same pair.
 *
 * WHEN IT SEATS. A pair seats at the moment the human's passphrase stands in hand: the unlock (`lares vault unlock`, the act that
 * offers the keep lei) mints it under that passphrase where none rests. A paper slot joins at a paper read-back (`lares vault
 * bind --paper`), opened by the route that bind already took. A cut asks for nothing: it seals to the public half, so `rite keep
 * --if-due` and the session-end hook cut where nobody stands; a house with no seat refuses the cut by name. A root a harness
 * staged (`.lar-test-scratch`) with no terminal seats under the published test route, and only where its custody tree itself
 * opens under that route or stands absent: a house a person founded never takes a keep the world's test passphrase opens. A
 * seat the test route made says so, and the first real proved unlock replaces it.
 *
 * THE CUT SIGNS ITS ROSTER. Whoever writes the remote reads the public half and could seal a roster of their own to it, so the
 * mint derives a signing seed from the same key the slot tree wraps: the seed rests here beside the seat (0600, local alone,
 * never in a bundle), each cut signs its bundle id and sealed roster, and a restore derives the verify key from the slot it
 * opened and refuses a roster the house never signed (`keep-roster-unsigned`). A house that holds no seed (an adopted seat)
 * takes it at the next proved unlock, which opens the seat anyway.
 *
 * AN UNMOVED HOUSE CUTS THE SAME BUNDLE. A seal to a public half draws fresh randomness, so the seat keeps its last seal beside a
 * digest of the roster it covers and a vouch over both, each keyed by the house's signing seed (ciphertext and keyed digests,
 * never the roster): a re-cut of the same roster hands back the same bytes only where the vouch answers, and an unmoved keep
 * spends nothing. THE VOUCH GUARDS ACCIDENTAL AND WRITE-ONLY SWAPS: a corrupted cache, or a hand that writes the config home but
 * cannot read it. A vouch that fails refuses the cut by name (`keep-roster-cache-unvouched`), so a swap leaves a trace; a cache
 * with no vouch re-seals. A hand that READS the config home holds the signing seed itself, and no vouch
 * stands against it.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  bindKeepSlot,
  decodeKeepSeat,
  encodeKeepSeat,
  keepVerifyKeyOf,
  mintKeepSeat,
  openKeepSecret,
  signKeepCut,
  type KeepSeat,
  type KeepSecretOpening,
} from "@lararium/mesh/keep-seat";
import {
  confirmHeldPaper,
  decodeSlotTree,
  openTreeKey,
  type ConfirmedPaperPin,
  type Credential,
  type PinSpec,
  type SlotSpec,
} from "@lararium/mesh/keyslot-door";
import { nativeKdf } from "@lararium/mesh/node";
import { FsCustodyIo, atomicWriteFileSync, larConfigHome, sSlotsPath, vesselCustodyHomes } from "@lararium/node";
import { KEEP_SEAT_FILE, REDECLARE_FILE, redeclareBytes, sealRedeclare, type BundleRedeclare } from "./bundle-manifest.js";
import { gatherCredentials } from "./custody-prompt.js";
import { TEST_ROUTE_PASSPHRASE, testScratchRoot } from "./offline-custody.js";
import { canPromptSecret } from "./prompt-secret.js";
import { pulamaStands } from "./house-config.js";

/** A keep seat act that refused, under its name. */
export class KeepSeatRefused extends Error {
  override readonly name = "KeepSeatRefused";
  constructor(readonly code: string, readonly detail: string) { super(`${code}: ${detail}`); }
}

/** The last roster seal the seat keeps: a digest of the roster under the public half, and the sealed bytes. */
interface LastRosterSeal { readonly digest: string; readonly sealed: string; readonly vouch?: string }

/** Where the house's keep seat rests. */
export function keepSeatPath(): string {
  return join(larConfigHome(), KEEP_SEAT_FILE);
}

/** The seat as it rests here: the pair, the last roster seal, and the signing seed its cuts sign under (null where none rests). */
interface RestingSeat { readonly seat: KeepSeat; readonly lastRoster: LastRosterSeal | null; readonly signingSeed: Uint8Array | null; readonly testRoute: boolean }

/**
 * THE PŪLAMA'S LINE, as the host's shim writes it verbatim (`pulama-main.js keep-seat`): the seat (public half, stretch salt,
 * tree, verify key) and its signer. It reads as the house's seat in the local form, and a verify key that answers no signer
 * reads as no seat at all. Any other text passes as it stands.
 */
function fromPulamaLine(text: string): string {
  let raw: { op?: unknown; reading?: unknown; seat?: { publicKey?: unknown; stretchSalt?: unknown; tree?: unknown; verifyKey?: unknown }; signer?: unknown };
  try { raw = JSON.parse(text) as typeof raw; } catch { return text; }
  if (raw.op !== "keep-seat") return text;
  const seat = raw.seat;
  if (raw.reading !== "seated" || typeof seat !== "object" || seat === null || typeof raw.signer !== "string" || !/^[0-9a-f]{64}$/.test(raw.signer)) {
    throw new KeepSeatRefused("keep-seat-unreadable", `${keepSeatPath()} holds a pūlama keep-seat line that seated nothing; run \`pulama-main.js keep-seat\` through the shim again`);
  }
  const verifyKey = Buffer.from(keepVerifyKeyOf(Uint8Array.from(Buffer.from(raw.signer, "hex")))).toString("hex");
  if (seat.verifyKey !== verifyKey) throw new KeepSeatRefused("keep-seat-unreadable", `${keepSeatPath()} holds a pūlama keep-seat line whose verify key answers no signer it carries`);
  return JSON.stringify({ publicKey: seat.publicKey, stretchSalt: seat.stretchSalt, slots: seat.tree, signingSeed: raw.signer });
}

function readResting(): RestingSeat | null {
  let text: string;
  try { text = fromPulamaLine(readFileSync(keepSeatPath(), "utf8")); } catch (e) { if (e instanceof KeepSeatRefused) throw e; return null; }
  const read = decodeKeepSeat(text);
  if (read.reading !== "readable") throw new KeepSeatRefused("keep-seat-unreadable", `${keepSeatPath()} reads no keep pair (${read.why}); the bundle a keep cut before carries the seat whole: restore it from there`);
  let lastRoster: LastRosterSeal | null = null;
  let signingSeed: Uint8Array | null = null;
  let testRoute = false;
  try {
    const raw = JSON.parse(text) as { lastRoster?: { digest?: unknown; sealed?: unknown }; signingSeed?: unknown; route?: unknown };
    testRoute = raw.route === "test";
    if (typeof raw.lastRoster?.digest === "string" && typeof raw.lastRoster.sealed === "string") {
      lastRoster = { digest: raw.lastRoster.digest, sealed: raw.lastRoster.sealed, ...(typeof (raw.lastRoster as { vouch?: unknown }).vouch === "string" ? { vouch: (raw.lastRoster as { vouch: string }).vouch } : {}) };
    }
    if (typeof raw.signingSeed === "string" && /^[0-9a-f]{64}$/.test(raw.signingSeed)) signingSeed = Uint8Array.from(Buffer.from(raw.signingSeed, "hex"));
  } catch { /* the seat read whole above */ }
  return { seat: read.seat, lastRoster, signingSeed, testRoute };
}

function writeResting(seat: KeepSeat, lastRoster: LastRosterSeal | null, signingSeed: Uint8Array | null, testRoute = false): void {
  const body = JSON.parse(encodeKeepSeat(seat)) as Record<string, unknown>;
  const local = { ...body, ...(testRoute ? { route: "test" } : {}), ...(signingSeed !== null ? { signingSeed: Buffer.from(signingSeed).toString("hex") } : {}), ...(lastRoster !== null ? { lastRoster } : {}) };
  mkdirSync(larConfigHome(), { recursive: true });
  atomicWriteFileSync(keepSeatPath(), `${JSON.stringify(local, null, 2)}\n`, undefined, { mode: 0o600 });
}

/** The house's keep seat, or null where none rests. */
export function readKeepSeat(): KeepSeat | null {
  return readResting()?.seat ?? null;
}

/** The seat as a bundle carries it: the public half and the slot tree, never the last seal and never the signing seed. */
export function bundleSeatText(seat: KeepSeat): string {
  return encodeKeepSeat(seat);
}

/** A credential as a pin of the keep's own slot: a passphrase as typed, a paper sheet as read back (it recovered its secret). */
function pinOf(c: Credential): PinSpec | null {
  if (c.kind === "passphrase") return c.passphrase === "" ? null : { kind: "passphrase", passphrase: c.passphrase };
  if (c.kind === "paper") return { kind: "paper", confirmed: confirmHeldPaper(c.sheets) };
  return null;
}

/**
 * A passphrase too weak to stand on a remote anyone may copy: under 12 characters, or under 16 drawn from two kinds or fewer
 * (letters, digits, other). A WARNING, never a refusal: the keep binds the custody's own route, and the steward chose it.
 */
function weakPassphrase(p: string): boolean {
  const s = p.normalize("NFKC");
  const kinds = [/[a-z]/i, /[0-9]/, /[^a-z0-9]/i].filter((re) => re.test(s)).length;
  return s.length < 12 || (s.length < 16 && kinds <= 2);
}

const WEAK_LINE = "keep: keep-passphrase-weak: the keep's wrapped secret rides its remote, where anyone who copies it may guess offline; this passphrase reads short. The keep seats anyway; a longer custody passphrase (`lares vault bind --passphrase`, then `lares vault unbind` the old slot) re-seats it stronger";

/** One route an act proved: the credentials of one custody slot, and that slot's threshold and pin count. */
export interface ProvedRoute { readonly creds: readonly Credential[]; readonly t: number; readonly pins: number }

const kindsOf = (creds: readonly Credential[]): string => creds.map((c) => c.kind).join(" + ");
const routeOf = (creds: readonly Credential[]): ProvedRoute => ({ creds, t: creds.length, pins: creds.length });

/**
 * Mint a fresh pair under EVERY route the act proved, one keep slot per route at the pins the act typed, and prove each opens
 * before anything rests. A custody slot of t-of-n whose act typed only its t pins seats t-of-t over them, and says so: the act
 * holds no other pin to bind. `replace` writes over a seat that rests.
 */
async function mintUnder(routes: readonly ProvedRoute[], say: (line: string) => void, testRoute = false): Promise<KeepSeat | null> {
  const specs: SlotSpec[] = [];
  for (const r of routes) {
    const pins = r.creds.map(pinOf);
    if (pins.length === 0 || pins.some((p) => p === null)) continue;
    specs.push({ t: pins.length, pins: pins as PinSpec[] });
  }
  const bound = routes.filter((r) => r.creds.map(pinOf).every((p) => p !== null) && r.creds.length > 0);
  if (specs.length === 0) return null;
  let { seat, signingSeed } = await mintKeepSeat(specs[0]!, nativeKdf);
  for (const spec of specs.slice(1)) {
    const b = await bindKeepSlot(seat, bound[0]!.creds, spec, nativeKdf);
    if (b.reading !== "bound") throw new KeepSeatRefused("keep-seat-unchecked", `a second proved route would not join the fresh pair (${b.reading}); nothing rests`);
    seat = b.seat;
  }
  // THE SELF-CHECK: the seat opens under every route it seated under before it rests, so no mint locks a restore out, and the
  // verify key it opens to answers the seed the house keeps.
  for (const r of bound) {
    const check = await openKeepSecret(seat, r.creds, nativeKdf);
    if (check.reading !== "opens") throw new KeepSeatRefused("keep-seat-unchecked", `the keep pair minted under this route did not open under it (${check.reading}); nothing rests`);
    const answers = Buffer.from(check.verifyKey).equals(Buffer.from(keepVerifyKeyOf(signingSeed)));
    check.secret.fill(0); check.signingSeed.fill(0);
    if (!answers) throw new KeepSeatRefused("keep-seat-unchecked", "the keep pair minted under this route opened to another signing key; nothing rests");
  }
  writeResting(seat, null, signingSeed, testRoute);
  for (const r of bound) if (r.pins > r.t) say(`keep: a custody slot of ${r.t}-of-${r.pins} opened under the ${r.t} pin(s) this act typed (${kindsOf(r.creds)}); the keep binds those ${r.t} as ${r.t}-of-${r.t}, since the act holds no other pin of that slot to bind`);
  if (bound.some((r) => r.creds.some((c) => c.kind === "passphrase" && weakPassphrase(c.passphrase)))) say(WEAK_LINE);
  return seat;
}

/**
 * RE-SEAT: a fresh pair under the PROVED route, over whatever rests (`lares vault reseat`, and every custody unbind, where the
 * route that opens the house changes). A bundle carries the seat it sealed under and opens under that seat's route; every keep
 * cut after the re-seat seals to the fresh pair. A paper slot the replaced seat held joins again at the next `vault bind --paper`.
 */
export async function reseatKeepPair(routes: ReadonlyArray<readonly Credential[]>, say: (line: string) => void, shapes?: readonly ProvedRoute[]): Promise<boolean> {
  const before = readResting();
  const proved = shapes ?? routes.map(routeOf);
  const seat = await mintUnder(proved, say);
  if (seat === null) return false;
  say(`keep: a fresh keep pair seats under ${proved.length === 1 ? "the route" : `the ${proved.length} routes`} just proved (${proved.map((r) => kindsOf(r.creds)).join("; ")}) at ${keepSeatPath()}; every later keep seals to it`);
  if (before !== null) {
    const left = before.seat.slots.slots.map((sl) => sl.pins.map((p) => p.kind).join(" + "));
    say(`keep: the old keep's routes leave every later keep: ${left.length} slot(s) (${left.join("; ")}); a keep cut before still opens under them`);
  }
  return true;
}

/**
 * Seat the house's keep pair under the PROVED route alone (`opener`: the credentials the custody open named), where none rests:
 * one slot holding every pin of the opener, at its threshold, so a custody slot of two pins seats a keep slot of the same two,
 * never the passphrase alone. Right after the mint the seat opens under that route, or nothing rests and the refusal names it.
 */
export async function seatKeepPair(opener: readonly Credential[], say: (line: string) => void = () => {}, testRoute = false): Promise<{ readonly seated: boolean; readonly seat: KeepSeat | null }> {
  const resting = readResting();
  if (resting !== null) return { seated: false, seat: resting.seat };
  const seat = await mintUnder([routeOf(opener)], say, testRoute);
  return { seated: seat !== null, seat };
}

/** What the custody open answered an unlock: `opens` with its opener and every slot the act proved, or a reading that proved nothing. */
export interface CustodyOpenAnswer {
  readonly reading: string;
  readonly opener?: readonly number[];
  readonly proved?: ReadonlyArray<{ readonly t: number; readonly pins: number; readonly opener: readonly number[] }>;
}

/** The routes an answer proved, as credentials; null where an index names no credential presented. */
export function provedRoutes(answer: CustodyOpenAnswer, route: readonly Credential[]): ProvedRoute[] | null {
  type Group = { readonly t: number; readonly pins: number; readonly opener: readonly number[] };
  const groups: readonly Group[] = Array.isArray(answer.proved) && answer.proved.length > 0 ? answer.proved : Array.isArray(answer.opener) && answer.opener.length > 0 ? [{ t: answer.opener.length, pins: answer.opener.length, opener: answer.opener }] : [];
  const out: ProvedRoute[] = [];
  for (const g of groups) {
    const creds = g.opener.map((i: number) => route[i]);
    if (creds.length === 0 || creds.some((c: Credential | undefined) => c === undefined)) return null;
    out.push({ creds: creds as Credential[], t: g.t, pins: g.pins });
  }
  return out.length > 0 ? out : null;
}

/**
 * THE UNLOCK'S MOMENT. Only an answer that OPENED proves a route: `already-unlocked` tested nothing, so it seats nothing and checks
 * nothing. From an opening, EVERY route the act proved counts (a passphrase and a paper sheet, each a slot of its own): where no
 * seat rests they all seat; where one rests, a proved route that opens it lets each other proved route JOIN it as a slot of its
 * own, so two custody routes stop flip-flopping the keep; where none opens it, the house warns by name (`keep-seat-unopened`): the
 * resting seat seals to a route this unlock never proved, so run `lares vault reseat`. A passkey seats nothing.
 */
export async function seatKeepAtUnlock(answer: CustodyOpenAnswer, route: readonly Credential[], say: (line: string) => void): Promise<"seated" | "joined" | "resting" | "resting-unopened" | "unproved" | "unseatable" | "unseated"> {
  if (answer.reading !== "opens") return "unproved";
  const proved = provedRoutes(answer, route);
  if (proved === null) return "unproved";
  try {
    const resting = readResting();
    // A SEAT THE TEST ROUTE MADE gives way to the first real proved route: the world reads the test passphrase.
    const real = proved.some((r) => r.creds.some((c) => !(c.kind === "passphrase" && c.passphrase === TEST_ROUTE_PASSPHRASE)));
    if (resting !== null && resting.testRoute && real) {
      if (await mintUnder(proved, say) === null) return "unseatable";
      say(`keep: the keep pair the test route seated gives way to one under the route this unlock proved (${keepSeatPath()})`);
      return "seated";
    }
    if (resting !== null) {
      const opens: ProvedRoute[] = [], lacks: ProvedRoute[] = [];
      let seed: Uint8Array | null = null;
      for (const r of proved) {
        const o = await openKeepSecret(resting.seat, r.creds, nativeKdf);
        if (o.reading === "opens") { opens.push(r); o.secret.fill(0); if (seed === null) seed = o.signingSeed; else o.signingSeed.fill(0); }
        else lacks.push(r);
      }
      if (opens.length === 0) {
        say(`keep: keep-seat-unopened: the route this unlock proved opens no slot of the keep pair at ${keepSeatPath()}, so a restore would ask for a route the steward may no longer hold; run \`lares vault reseat\` to seat a fresh pair under this route`);
        return "resting-unopened";
      }
      // A SEAT THAT LOST ITS SIGNING SEED takes it back here: the proved route opened the very key it derives from.
      let seat = resting.seat;
      const joined: string[] = [];
      for (const r of lacks) {
        const pins = r.creds.map(pinOf);
        if (pins.some((p) => p === null)) continue;
        const b = await bindKeepSlot(seat, opens[0]!.creds, { t: pins.length, pins: pins as PinSpec[] }, nativeKdf);
        if (b.reading === "bound") { seat = b.seat; joined.push(kindsOf(r.creds)); }
      }
      if (joined.length > 0 || resting.signingSeed === null) writeResting(seat, resting.lastRoster, resting.signingSeed ?? seed, resting.testRoute);
      seed?.fill(0);
      if (joined.length === 0) return "resting";
      say(`keep: ${joined.length === 1 ? "a route" : `${joined.length} routes`} this unlock proved (${joined.join("; ")}) join the keep pair at ${keepSeatPath()}: a restore opens it under any proved route`);
      return "joined";
    }
    const seat = await mintUnder(proved, say);
    if (seat === null) return "unseatable";
    say(`keep: the keep pair seats under the route${proved.length === 1 ? "" : "s"} this unlock proved (${proved.map((r) => kindsOf(r.creds)).join("; ")}) at ${keepSeatPath()}; a keep's roster seals to it, and a restore opens it with any of them`);
    return "seated";
  } catch (e) {
    say(`keep: the keep pair did not seat (${e instanceof Error ? e.message : String(e)}); the next proved unlock seats it`);
    return "unseated";
  }
}

/** Adopt a pair a bundle carried, where this house rests none, with the signing seed its opening derived: the next keep seals to
 *  the pair the restore opened and signs as the house that minted it. */
export function adoptKeepSeat(seat: KeepSeat, signingSeed: Uint8Array, testRoute = false): boolean {
  if (readResting() !== null) return false;
  writeResting(seat, null, signingSeed, testRoute);
  return true;
}

/** Whether a route is the published test route alone: a seat it opened stays marked so a real route replaces it. */
export function isTestRoute(route: readonly Credential[]): boolean {
  return route.length > 0 && route.every((c) => c.kind === "passphrase" && c.passphrase === TEST_ROUTE_PASSPHRASE);
}

/**
 * Bind a paper slot beside the seat's passphrase, at a paper read-back: `openWith` (the route the read-back's own act took)
 * opens the seat's key, and the read-back's confirmed sheet wraps it again. No seat, or a route that opens none: nothing binds.
 */
export async function bindKeepPaper(openWith: readonly Credential[], confirmed: ConfirmedPaperPin): Promise<"bound" | "no-seat" | "no-slot-opens" | "seat-torn"> {
  const resting = readResting();
  if (resting === null) return "no-seat";
  const b = await bindKeepSlot(resting.seat, openWith, { t: 1, pins: [{ kind: "paper", confirmed }] }, nativeKdf);
  if (b.reading !== "bound") return b.reading;
  writeResting(b.seat, resting.lastRoster, resting.signingSeed, resting.testRoute);
  return "bound";
}

/**
 * THE READ-BACK'S MOMENT: a bind whose new slot holds a paper sheet just read back word for word (`vault bind --paper`) binds a
 * paper slot beside the keep seat's passphrase, opened by the route the bind already took, and says so. A bind of any other
 * route, no seat, or a route that opens no keep slot binds nothing; the keep stands as it stood.
 */
export async function keepSlotAtBind(openWith: readonly Credential[], spec: SlotSpec, say: (line: string) => void): Promise<"bound" | "no-paper" | "no-seat" | "no-slot-opens" | "seat-torn" | "unbound"> {
  const paper = spec.pins.find((p): p is Extract<PinSpec, { kind: "paper" }> => p.kind === "paper");
  if (paper === undefined) return "no-paper";
  try {
    const b = await bindKeepPaper(openWith, paper.confirmed);
    if (b === "bound") say("keep: this paper sheet now opens the keep pair too; a restore opens the keep's roster with it or the passphrase");
    else if (b === "no-slot-opens") say("keep: the route this bind took opens no slot of the keep pair, so the sheet joins no keep slot; bind it again under the passphrase the keep seated with");
    else if (b === "seat-torn") say("keep: the keep pair's seat stands torn; the sheet joins no keep slot");
    return b;
  } catch (e) {
    say(`keep: the sheet joined no keep slot (${e instanceof Error ? e.message : String(e)})`);
    return "unbound";
  }
}

/** Open the keep secret under what the human presents. */
export function openKeepSeat(seat: KeepSeat, credentials: readonly Credential[]): Promise<KeepSecretOpening> {
  return openKeepSecret(seat, credentials, nativeKdf);
}

/**
 * Whether the house's custody tree takes the published test route: it stands absent (a harness's bare scratch root), or the test
 * passphrase opens it (a harness founded it so). A tree a person founded answers no.
 */
async function custodyTakesTestRoute(): Promise<boolean> {
  const homes = vesselCustodyHomes();
  const tree = decodeSlotTree(await new FsCustodyIo(homes).read(sSlotsPath(homes.identity)));
  if (tree.reading === "absent") return true;
  if (tree.reading !== "readable") return false;
  const u = await openTreeKey(tree.tree, [{ kind: "passphrase", passphrase: TEST_ROUTE_PASSPHRASE }], nativeKdf);
  if (u.reading !== "opens") return false;
  u.treeKey.fill(0);
  return true;
}

/** What decides a house's road to a seat: whether a pūlama keeps its custody, and whether a vessel stands holding its key. */
export interface HouseSeatFacts { readonly pulama: boolean; readonly vesselUnlocked: boolean }

/**
 * THE ROAD THIS HOUSE TAKES to seat its keep pair: a pūlama house seats at the pūlama's hand door (`pulama-main.js keep-seat`,
 * through its shim, which writes the line); beside a vessel already holding its key an unlock asks nothing, so `lares vault reseat`
 * proves the route; else `lares vault unlock`, whose proved route seats it.
 */
export function keepSeatRoad(facts: HouseSeatFacts): string {
  if (facts.pulama) return "a pūlama keeps this house's custody, so its route rides the pūlama: run `pulama-main.js keep-seat` through the house's shim, which writes keep-seat.json from the line it prints";
  if (facts.vesselUnlocked) return "the vessel already holds its key, so an unlock asks no route: run `lares vault reseat` with the steward's route, which proves it and seats the pair";
  return "run `lares vault unlock` with the steward's route, whose proof seats the pair";
}

/** This house's facts, read without asking anything: the house's own pūlama signal, and the custody door's standing. */
async function houseFacts(): Promise<HouseSeatFacts> {
  if (pulamaStands()) return { pulama: true, vesselUnlocked: false };
  try {
    const { vesselStanding } = await import("./custody-door.js");
    const s = await vesselStanding(null, 1_000);
    return { pulama: false, vesselUnlocked: s.reading === "vessel" && s.unlocked };
  } catch { return { pulama: false, vesselUnlocked: false }; }
}

/** What a cut seals to and signs under. */
export interface CutSeat { readonly seat: KeepSeat; readonly signingSeed: Uint8Array }

/**
 * The seat a cut seals to, and the seed it signs under. A cut asks for no credential, so a house that rests none refuses by name,
 * and so does one whose seed rests nowhere (a proved unlock restores it); a root a harness staged with no terminal seats under the
 * published test route.
 */
export async function keepSeatForCut(): Promise<CutSeat> {
  let resting = readResting();
  if (resting === null && testScratchRoot() && !canPromptSecret() && await custodyTakesTestRoute()) {
    await seatKeepPair([{ kind: "passphrase", passphrase: TEST_ROUTE_PASSPHRASE }], () => {}, true);
    resting = readResting();
  }
  if (resting !== null) {
    // A TEST-ROUTE SEAT on a root whose custody takes no test route (a person founded it) seals to a pair the world's
    // test passphrase opens: refuse it by name, and name this house's road to a real seat.
    if (resting.testRoute && !(testScratchRoot() && await custodyTakesTestRoute())) {
      throw new KeepSeatRefused("keep-seat-test-route", `the keep pair at ${keepSeatPath()} rests under the published test route, and this house's custody takes no test route: ${keepSeatRoad(await houseFacts())}, which replaces it, then cut again`);
    }
    if (resting.signingSeed === null) throw new KeepSeatRefused("keep-seat-unsigned", `the keep pair at ${keepSeatPath()} rests with no signing seed, so a cut would carry a roster no restore accepts: ${keepSeatRoad(await houseFacts())}, then cut again`);
    return { seat: resting.seat, signingSeed: resting.signingSeed };
  }
  throw new KeepSeatRefused("keep-seat-absent", `this house rests no keep pair at ${keepSeatPath()}, and a cut seals the roster to one: ${keepSeatRoad(await houseFacts())}, then cut again`);
}

/**
 * Seal the roster for a cut: the last seal again where the roster and the pair stand unmoved AND the house's own vouch answers the
 * cached bytes, else a fresh seal kept (and vouched) for next time.
 */
export function sealRosterForCut(cut: CutSeat, redeclare: BundleRedeclare): Buffer {
  const { seat, signingSeed } = cut;
  const digest = createHmac("sha256", signingSeed).update("lar-keep-roster").update(REDECLARE_FILE).update(redeclareBytes(redeclare)).digest("hex");
  const vouchOf = (sealed: Buffer): string => createHmac("sha256", signingSeed).update("lar-keep-roster-seal").update(digest).update(sealed).digest("hex");
  const resting = readResting();
  const samePair = resting !== null && Buffer.from(resting.seat.publicKey).equals(Buffer.from(seat.publicKey));
  if (samePair && resting.lastRoster?.digest === digest && typeof resting.lastRoster.vouch === "string") {
    const cached = Buffer.from(resting.lastRoster.sealed, "base64");
    const expected = Buffer.from(vouchOf(cached), "hex"), held = Buffer.from(resting.lastRoster.vouch, "hex");
    if (held.length === expected.length && timingSafeEqual(held, expected)) return cached;
    throw new KeepSeatRefused("keep-roster-cache-unvouched", `the last roster seal cached in ${keepSeatPath()} answers no vouch of this house's signing seed: something changed the config home's cache. Nothing shipped; remove the seat file's "lastRoster" entry to re-seal from the house's own roster, and look at who wrote the file`);
  }
  const sealed = sealRedeclare(seat.publicKey, redeclare);
  if (samePair) writeResting(resting.seat, { digest, sealed: sealed.toString("base64"), vouch: vouchOf(sealed) }, resting.signingSeed, resting.testRoute);
  return sealed;
}

/** Sign a cut: the bundle id, the sealed roster and the manifest's digest, under the seed the house keeps. Answers it in hex. */
export function signCut(signingSeed: Uint8Array, bundleId: string, sealedRoster: Uint8Array, manifestDigest: Uint8Array): string {
  return Buffer.from(signKeepCut(signingSeed, bundleId, sealedRoster, manifestDigest)).toString("hex");
}

/**
 * The route a restore opens the bundle's seat with: the terminal asks (a passphrase or a paper sheet); a root a harness staged
 * with no terminal offers the published test route; with neither, the restore refuses by name.
 */
export async function liveKeepRoute(): Promise<readonly Credential[]> {
  if (testScratchRoot() && !canPromptSecret()) return [{ kind: "passphrase", passphrase: TEST_ROUTE_PASSPHRASE }];
  if (!canPromptSecret()) throw new KeepSeatRefused("keep-route-absent", "the bundle's roster opens under the keep's passphrase or paper sheet, and no terminal stands to ask for one: run the import on a terminal");
  process.stdout.write("The keep's roster opens under the steward's passphrase or paper sheet.\n");
  return gatherCredentials("lares import", { kind: "bundle" });
}
