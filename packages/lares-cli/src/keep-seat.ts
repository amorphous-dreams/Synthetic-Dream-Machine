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
  bindKeepSlot, decodeKeepSeat, encodeKeepSeat, mintKeepSeat, openKeepSecret,
  type ConfirmedPaperPin, type Credential, type KeepSeat, type KeepSecretOpening,
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

function readResting(): { readonly seat: KeepSeat; readonly lastRoster: LastRosterSeal | null } | null {
  let text: string;
  try { text = readFileSync(keepSeatPath(), "utf8"); } catch { return null; }
  const read = decodeKeepSeat(text);
  if (read.reading !== "readable") throw new KeepSeatRefused("keep-seat-unreadable", `${keepSeatPath()} reads no keep pair (${read.why}); the bundle a keep cut before carries the seat whole: restore it from there`);
  let lastRoster: LastRosterSeal | null = null;
  try {
    const raw = JSON.parse(text) as { lastRoster?: { digest?: unknown; sealed?: unknown } };
    if (typeof raw.lastRoster?.digest === "string" && typeof raw.lastRoster.sealed === "string") lastRoster = { digest: raw.lastRoster.digest, sealed: raw.lastRoster.sealed };
  } catch { /* the seat read whole above */ }
  return { seat: read.seat, lastRoster };
}

function writeResting(seat: KeepSeat, lastRoster: LastRosterSeal | null): void {
  const body = JSON.parse(encodeKeepSeat(seat)) as Record<string, unknown>;
  mkdirSync(larConfigHome(), { recursive: true });
  atomicWriteFileSync(keepSeatPath(), `${JSON.stringify(lastRoster === null ? body : { ...body, lastRoster }, null, 2)}\n`, undefined, { mode: 0o600 });
}

/** The house's keep seat, or null where none rests. */
export function readKeepSeat(): KeepSeat | null {
  return readResting()?.seat ?? null;
}

/** The seat as a bundle carries it: the public half and the slot tree, never the last seal. */
export function bundleSeatText(seat: KeepSeat): string {
  return encodeKeepSeat(seat);
}

/**
 * Seat the house's keep pair under the passphrase in hand, where none rests. A seat that rests stays (its pair already sealed
 * keeps a restore opens); a route that carries no passphrase seats nothing.
 */
export async function seatKeepPair(credentials: readonly Credential[]): Promise<{ readonly seated: boolean; readonly seat: KeepSeat | null }> {
  const resting = readResting();
  if (resting !== null) return { seated: false, seat: resting.seat };
  const passphrase = credentials.find((c): c is Extract<Credential, { kind: "passphrase" }> => c.kind === "passphrase" && c.passphrase !== "");
  if (passphrase === undefined) return { seated: false, seat: null };
  const seat = await mintKeepSeat({ t: 1, pins: [{ kind: "passphrase", passphrase: passphrase.passphrase }] }, nativeKdf);
  writeResting(seat, null);
  return { seated: true, seat };
}

/**
 * THE UNLOCK'S MOMENT: an unlock that opened under a passphrase seats the keep pair under it where none rests, and says so. A
 * route with no passphrase, or a seat that rests, leaves the house as it stood; a seat that would not write warns and waits.
 */
export async function seatKeepAtUnlock(route: readonly Credential[], say: (line: string) => void): Promise<"seated" | "resting" | "no-passphrase" | "unseated"> {
  try {
    if (readResting() !== null) return "resting";
    const { seated } = await seatKeepPair(route);
    if (!seated) return "no-passphrase";
    say(`keep: the keep pair seats under this passphrase (${keepSeatPath()}); a keep's roster seals to it, and a restore opens it with this passphrase`);
    return "seated";
  } catch (e) {
    say(`keep: the keep pair did not seat (${e instanceof Error ? e.message : String(e)}); the next unlock seats it`);
    return "unseated";
  }
}

/** Adopt a pair a bundle carried, where this house rests none: the next keep seals to the pair the restore opened. */
export function adoptKeepSeat(seat: KeepSeat): boolean {
  if (readResting() !== null) return false;
  writeResting(seat, null);
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
  writeResting(b.seat, resting.lastRoster);
  return "bound";
}

/** Open the keep secret under what the human presents. */
export function openKeepSeat(seat: KeepSeat, credentials: readonly Credential[]): Promise<KeepSecretOpening> {
  return openKeepSecret(seat, credentials, nativeKdf);
}

/**
 * The seat a cut seals to. A cut asks for no credential, so a house that rests none refuses by name; a root a harness staged
 * with no terminal seats under the published test route.
 */
export async function keepSeatForCut(): Promise<KeepSeat> {
  const resting = readResting();
  if (resting !== null) return resting.seat;
  if (testScratchRoot() && !canPromptSecret()) {
    const { seat } = await seatKeepPair([{ kind: "passphrase", passphrase: TEST_ROUTE_PASSPHRASE }]);
    if (seat !== null) return seat;
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
  if (resting !== null && Buffer.from(resting.seat.publicKey).equals(Buffer.from(seat.publicKey))) writeResting(resting.seat, { digest, sealed: sealed.toString("base64") });
  return sealed;
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
