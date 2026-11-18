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
 * staged (`.lar-test-scratch`) with no terminal seats under the published test route, as its custody opens under it.
 *
 * THE CUT SIGNS ITS ROSTER. Whoever writes the remote reads the public half and could seal a roster of their own to it, so the
 * mint derives a signing seed from the same key the slot tree wraps: the seed rests here beside the seat (0600, local alone,
 * never in a bundle), each cut signs its bundle id and sealed roster, and a restore derives the verify key from the slot it
 * opened and refuses a roster the house never signed (`keep-roster-unsigned`). A house that lost its seed (a seat from before
 * the signature, an adopted seat) takes it back at the next proved unlock, which opens the seat anyway.
 *
 * AN UNMOVED HOUSE CUTS THE SAME BUNDLE. A seal to a public half draws fresh randomness, so the seat keeps its last seal beside a
 * digest of the roster it covers (keyed by the public half; ciphertext and a digest, never the roster): a re-cut of the same
 * roster to the same pair hands back the same bytes, and an unmoved keep spends nothing.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { createHmac } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  bindKeepSlot, confirmHeldPaper, decodeKeepSeat, encodeKeepSeat, keepVerifyKeyOf, mintKeepSeat, openKeepSecret, signKeepCut,
  type ConfirmedPaperPin, type Credential, type KeepSeat, type KeepSecretOpening, type PinSpec, type SlotSpec,
} from "@lararium/mesh";
import { nativeKdf } from "@lararium/mesh/node";
import { atomicWriteFileSync, larConfigHome } from "@lararium/node";
import { KEEP_SEAT_FILE, REDECLARE_FILE, redeclareBytes, sealRedeclare, type BundleRedeclare } from "./bundle-manifest.js";
import { gatherCredentials } from "./custody-prompt.js";
import { TEST_ROUTE_PASSPHRASE, testScratchRoot } from "./offline-custody.js";
import { canPromptSecret } from "./prompt-secret.js";

/** A keep seat act that refused, under its name. */
export class KeepSeatRefused extends Error {
  override readonly name = "KeepSeatRefused";
  constructor(readonly code: string, readonly detail: string) { super(`${code}: ${detail}`); }
}

/** The last roster seal the seat keeps: a digest of the roster under the public half, and the sealed bytes. */
interface LastRosterSeal { readonly digest: string; readonly sealed: string }

/** Where the house's keep seat rests. */
export function keepSeatPath(): string {
  return join(larConfigHome(), KEEP_SEAT_FILE);
}

/** The seat as it rests here: the pair, the last roster seal, and the signing seed its cuts sign under (null where none rests). */
interface RestingSeat { readonly seat: KeepSeat; readonly lastRoster: LastRosterSeal | null; readonly signingSeed: Uint8Array | null }

function readResting(): RestingSeat | null {
  let text: string;
  try { text = readFileSync(keepSeatPath(), "utf8"); } catch { return null; }
  const read = decodeKeepSeat(text);
  if (read.reading !== "readable") throw new KeepSeatRefused("keep-seat-unreadable", `${keepSeatPath()} reads no keep pair (${read.why}); the bundle a keep cut before carries the seat whole: restore it from there`);
  let lastRoster: LastRosterSeal | null = null;
  let signingSeed: Uint8Array | null = null;
  try {
    const raw = JSON.parse(text) as { lastRoster?: { digest?: unknown; sealed?: unknown }; signingSeed?: unknown };
    if (typeof raw.lastRoster?.digest === "string" && typeof raw.lastRoster.sealed === "string") lastRoster = { digest: raw.lastRoster.digest, sealed: raw.lastRoster.sealed };
    if (typeof raw.signingSeed === "string" && /^[0-9a-f]{64}$/.test(raw.signingSeed)) signingSeed = Uint8Array.from(Buffer.from(raw.signingSeed, "hex"));
  } catch { /* the seat read whole above */ }
  return { seat: read.seat, lastRoster, signingSeed };
}

function writeResting(seat: KeepSeat, lastRoster: LastRosterSeal | null, signingSeed: Uint8Array | null): void {
  const body = JSON.parse(encodeKeepSeat(seat)) as Record<string, unknown>;
  const local = { ...body, ...(signingSeed !== null ? { signingSeed: Buffer.from(signingSeed).toString("hex") } : {}), ...(lastRoster !== null ? { lastRoster } : {}) };
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
 * Seat the house's keep pair under the PROVED route alone (`opener`: the credentials the custody open named), where none rests:
 * one slot holding every pin of the opener, at its threshold, so a custody slot of two pins seats a keep slot of the same two,
 * never the passphrase alone. Right after the mint the seat opens under that route, or nothing rests and the refusal names it.
 */
export async function seatKeepPair(opener: readonly Credential[]): Promise<{ readonly seated: boolean; readonly seat: KeepSeat | null }> {
  const resting = readResting();
  if (resting !== null) return { seated: false, seat: resting.seat };
  const pins = opener.map(pinOf);
  if (pins.length === 0 || pins.some((p) => p === null)) return { seated: false, seat: null };
  const { seat, signingSeed } = await mintKeepSeat({ t: pins.length, pins: pins as PinSpec[] }, nativeKdf);
  // THE SELF-CHECK: the seat opens under the very route it seated under before it rests, so no mint locks a restore out, and the
  // verify key it opens to answers the seed the house keeps.
  const check = await openKeepSecret(seat, opener, nativeKdf);
  if (check.reading !== "opens") throw new KeepSeatRefused("keep-seat-unchecked", `the keep pair minted under this route did not open under it (${check.reading}); nothing rests`);
  const answers = Buffer.from(check.verifyKey).equals(Buffer.from(keepVerifyKeyOf(signingSeed)));
  check.secret.fill(0); check.signingSeed.fill(0);
  if (!answers) throw new KeepSeatRefused("keep-seat-unchecked", "the keep pair minted under this route opened to another signing key; nothing rests");
  writeResting(seat, null, signingSeed);
  return { seated: true, seat };
}

/** What the custody open answered an unlock: `opens` with its opener, or a reading that proved nothing. */
export interface CustodyOpenAnswer { readonly reading: string; readonly opener?: readonly number[] }

/**
 * THE UNLOCK'S MOMENT. Only an answer that OPENED proves a route: `already-unlocked` tested nothing, so it seats nothing and checks
 * nothing. From an opening, the credentials it names as its opener seat the keep pair where none rests (a passkey among them seats
 * nothing: the keep binds human routes alone); where a seat rests, the opener must open it, and a seat it does not open warns by
 * name (`keep-seat-unopened`): the house's custody route moved and the keep still seals to the old one, so run `lares vault reseat`.
 */
export async function seatKeepAtUnlock(answer: CustodyOpenAnswer, route: readonly Credential[], say: (line: string) => void): Promise<"seated" | "resting" | "resting-unopened" | "unproved" | "unseatable" | "unseated"> {
  if (answer.reading !== "opens" || !Array.isArray(answer.opener) || answer.opener.length === 0) return "unproved";
  const opener = answer.opener.map((i) => route[i]).filter((c): c is Credential => c !== undefined);
  if (opener.length !== answer.opener.length) return "unproved";
  try {
    const resting = readResting();
    if (resting !== null) {
      const o = await openKeepSecret(resting.seat, opener, nativeKdf);
      if (o.reading === "opens") {
        // A SEAT THAT LOST ITS SIGNING SEED takes it back here: the proved route opened the very key it derives from.
        if (resting.signingSeed === null) writeResting(resting.seat, resting.lastRoster, o.signingSeed);
        o.secret.fill(0); o.signingSeed.fill(0);
        return "resting";
      }
      say(`keep: keep-seat-unopened: the route this unlock proved opens no slot of the keep pair at ${keepSeatPath()}, so a restore would ask for a route the steward may no longer hold; run \`lares vault reseat\` to seat a fresh pair under this route`);
      return "resting-unopened";
    }
    const { seated } = await seatKeepPair(opener);
    if (!seated) return "unseatable";
    say(`keep: the keep pair seats under the route this unlock proved (${keepSeatPath()}); a keep's roster seals to it, and a restore opens it with that same route`);
    return "seated";
  } catch (e) {
    say(`keep: the keep pair did not seat (${e instanceof Error ? e.message : String(e)}); the next proved unlock seats it`);
    return "unseated";
  }
}

/** Adopt a pair a bundle carried, where this house rests none, with the signing seed its opening derived: the next keep seals to
 *  the pair the restore opened and signs as the house that minted it. */
export function adoptKeepSeat(seat: KeepSeat, signingSeed: Uint8Array): boolean {
  if (readResting() !== null) return false;
  writeResting(seat, null, signingSeed);
  return true;
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
  writeResting(b.seat, resting.lastRoster, resting.signingSeed);
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

/** What a cut seals to and signs under. */
export interface CutSeat { readonly seat: KeepSeat; readonly signingSeed: Uint8Array }

/**
 * The seat a cut seals to, and the seed it signs under. A cut asks for no credential, so a house that rests none refuses by name,
 * and so does one whose seed rests nowhere (a proved unlock restores it); a root a harness staged with no terminal seats under the
 * published test route.
 */
export async function keepSeatForCut(): Promise<CutSeat> {
  let resting = readResting();
  if (resting === null && testScratchRoot() && !canPromptSecret()) {
    await seatKeepPair([{ kind: "passphrase", passphrase: TEST_ROUTE_PASSPHRASE }]);
    resting = readResting();
  }
  if (resting !== null) {
    if (resting.signingSeed === null) throw new KeepSeatRefused("keep-seat-unsigned", `the keep pair at ${keepSeatPath()} rests with no signing seed, so a cut would carry a roster no restore accepts: run \`lares vault unlock\` with the steward's route, which opens the seat and restores it, then cut again`);
    return { seat: resting.seat, signingSeed: resting.signingSeed };
  }
  throw new KeepSeatRefused("keep-seat-absent", `this house rests no keep pair at ${keepSeatPath()}, and a cut seals the roster to one: run \`lares vault unlock\` with the steward's passphrase, which seats it, then cut again`);
}

/** Seal the roster for a cut: the last seal again where the roster and the pair stand unmoved, else a fresh seal kept for next time. */
export function sealRosterForCut(seat: KeepSeat, redeclare: BundleRedeclare): Buffer {
  const digest = createHmac("sha256", seat.publicKey).update(REDECLARE_FILE).update(redeclareBytes(redeclare)).digest("hex");
  const resting = readResting();
  if (resting !== null && resting.lastRoster?.digest === digest && Buffer.from(resting.seat.publicKey).equals(Buffer.from(seat.publicKey))) {
    return Buffer.from(resting.lastRoster.sealed, "base64");
  }
  const sealed = sealRedeclare(seat.publicKey, redeclare);
  if (resting !== null && Buffer.from(resting.seat.publicKey).equals(Buffer.from(seat.publicKey))) writeResting(resting.seat, { digest, sealed: sealed.toString("base64") }, resting.signingSeed);
  return sealed;
}

/** Sign a cut: the bundle id and the sealed roster, under the seed the house keeps. Answers the signature in hex. */
export function signCut(signingSeed: Uint8Array, bundleId: string, sealedRoster: Uint8Array): string {
  return Buffer.from(signKeepCut(signingSeed, bundleId, sealedRoster)).toString("hex");
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
