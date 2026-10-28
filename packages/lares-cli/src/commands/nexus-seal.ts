/**
 * nexus-seal — the CHARTER SEAL door: the founding kahu quorum's seats, its PRE-ROTATED hash-linked epoch
 * chain, and the growth rite that records a crossing.
 *
 * ── A SEAT HOLDS ITS OWN KEY, AND THE RITE ARMS ITSELF ──────────────────────────────────────────
 * A chair's key mints behind the custody door (`seat.arm-genesis`), apart from every persona root and every
 * dialing leaf. A chair's NEXT key mints here, in this process, as a COLD key on a card: the charter commits one
 * digest per seat, the card prints once, the person reads it back before the charter moves, and no next key rests
 * on the vessel. A roll takes the cards back (`seat.arm-roll` adopts each revealed key as its chair's seat key).
 * Two inner functions, `armGenesis` and `armRoll`, hold every line that says how a head commits its successors.
 *
 * ── WHY THE CHAIN IS PRE-ROTATED ────────────────────────────────────────────────────────────────
 * Every epoch commits to the digest of the key-set that will REPLACE it, before that key-set is ever
 * used (TUF ≈ KERI). A rotate reveals the pre-committed set and must match, so no seat moves without
 * notice: a kahu steps down by no longer standing, a new one takes a chair by standing, and either
 * way the reveal is checked against a commitment made an epoch earlier. A genesis seated with no
 * commitment is a chain that can never rotate, which is why seating refuses to arm itself blind.
 *
 * ── WHAT LIVES HERE AND WHY IT IS ONE DOOR ──────────────────────────────────────────────────────
 * The roster, the chain and the growth rite are not three subjects that happen to share a
 * file: each one reads or writes the SAME charter state under `larSealHome()`, and the invariants
 * that hold them together (a commitment precedes its reveal; a quorum is a majority of chairs that
 * STOOD; a crossing binds one epoch to the next) are stated across them rather than inside any one.
 * Splitting them further would put an invariant on one side of an import and its enforcement on the
 * other.
 *
 * ── THE QUORUM RITE SITS HERE, NOT WITH THE RITES ───────────────────────────────────────────────
 * `runQuorumRite` is registered in the parent's `NEXUS_RITES` table but composes two functions that
 * live here — seat, show — and nothing else. Leaving it in the parent would force this
 * module to export its seat/show internals just to be called back into, widening the surface
 * and pointing the dependency both ways. It travels with the code it drives,
 * and the parent imports one more name.
 *
 * `UsageError` travels for the same reason: every one of its throw sites is in this file, and leaving
 * the class behind would have made this module import from its own parent — the one shape that turns
 * a clean parent-to-child split into a cycle.
 */
import {
  readNexusDoc, parseNexusDoc, nexusCharterStands, writeNexusDoc, nexusCharterDocPath,
  importCarriedCharter, CarriedCharterError,
  atomicWriteFileSync,
  NexusContractError, SealedActRefused, type NexusRollAnchorResult,
} from "@lararium/node";
import {
  emptyFoundingCharterDoc, foundingRoster, foundingQuorumSeated, sealLineageHead, charterSealState,
  charterInceptionImage, genesisOfInception, inceptCharterEpoch, rotateSealEpoch, seatedKahuKeys, type CharterInceptionImage,
  mintColdKey, coldKeyFromSeed, coldKeySeedFromCode, ColdKeyCardError, type SealNext,
  federationPostureFromDoc,
  type NexusDoc, type NexusCharterKahu, type SealEpoch, type KahuQuorumSeats, type RotateResult,
  type CharterSealState, seatFingerprint,
  CHARTER_INCEPTION_KIND, COFOUND_JOIN_KIND, cidV1Sha256FromHex, cofoundReadBack, composeCharterInception, fingerprintGroups,
  inceptionAid, offerFingerprint, readCofoundInception, readCofoundJoin, readCofoundOffer,
  type CofoundInception, type CofoundJoin, type CofoundOffer, type ReleaseManifestAddresses,
  hex, readRollCircle, type RollCircle, type RollCircleVerdict,
} from "@lararium/mesh";
import { rosterStanding } from "../roster-standing.js";
import { nexusPhase } from "../nexus-phase.js";
import { sealImportVerdict, foreignSeats } from "../seal-import.js";
import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { larSealHome } from "../env.js";
import { storeVerb, pokeSealHomeRefold, storeFailure } from "../store-door.js";
import { cmdSealAnchor } from "./nexus-anchor-cmd.js";
import { emit, exitFor, refuseUsage } from "../render.js";
import type { ParsedArgs } from "../parse-args.js";
import { stampCarrier } from "@lararium/memetic-frame";
import { sealedAct } from "../sealed-act-door.js";
import { actingFace, FaceOptionMalformed } from "../face-option.js";
import { sealHand, inceptHand, heldSeats, armGenesisSeats, armRollSeats, retireSeats, readBackStandsIn } from "../sealed-rows.js";
import { canPromptSecret, promptLine, promptSecret } from "../prompt-secret.js";
import { CardReadBackRefused, readBack as printAndReadBack, type ColdCard } from "../cold-card-readback.js";

/** A refusal the operator can fix by retyping — rendered as `usage`, never as an internal error. */
class UsageError extends Error {}

/**
 * The charter's seal reading off disk — the mesh reading plus the one only the disk can name: `torn`, a
 * charter that STANDS and will not parse. Each reading takes its own path, so none folds into another.
 */
export type CharterSealReading = CharterSealState | "torn";
export function readCharterSeal(sealHome: string): { doc: NexusDoc | null; state: CharterSealReading } {
  const doc = readNexusDoc(sealHome);
  if (doc === null && nexusCharterStands(sealHome)) return { doc, state: "torn" };
  return { doc, state: charterSealState(doc) };
}

/** What the operator does next from a charter that holds no seal head — said per reading, never as one. */
function noSealHeadWhy(state: Exclude<CharterSealReading, "sealed">, act: string): string {
  switch (state) {
    case "absent":
      return `no charter stands here — nothing to ${act}. Found one first: \`lares nexus rite quorum\``;
    case "torn":
      return `the charter stands but reads TORN — nothing can ${act} until it is repaired or moved aside.`;
    case "unsealed":
      return `the charter stands UNSEALED — its roster is written and no seal epoch is seated, so there is nothing to ${act} yet. ` +
             "Seat the epoch once a quorum stands: `lares nexus seal seat`";
  }
}

/** The sealed charter and its head, or a refusal naming WHICH empty reading stood in the way. */
function sealedCharterOrRefuse(sealHome: string, act: string): { doc: NexusDoc; head: SealEpoch } {
  const { doc, state } = readCharterSeal(sealHome);
  const head = sealLineageHead(doc);
  if (state !== "sealed" || !doc || !head) throw new UsageError(noSealHeadWhy(state === "sealed" ? "unsealed" : state, act));
  return { doc, head };
}

const SEAL_USAGE: readonly string[] = [
  "usage: lares nexus seal <seat | rotate | show | export | import | grow | cold rehearse | cofound | roll | anchor>",
  "",
  "  seat    form the roster from the personas that STOOD for a chair, give each chair a seat key",
  "          of its own, and establish the GENESIS epoch over those keys. Each chair's NEXT key mints",
  "          as a cold key on a card: the card prints once, you type it back, and the genesis commits",
  "          one digest per chair. No next key rests on this machine.",
  "          [--threshold <k>]            the quorum rule (default: majority of those that stood)",
  "  rotate  type back each chair's card: each revealed key becomes its chair's seat key, and the",
  "          chain advances. The roster becomes exactly what STANDS — the succession door: a kahu",
  "          steps down by no longer standing, a new one takes a chair by standing and signs with a",
  "          fresh key. Fresh cards print for the rolled head, and you type them back.",
  "          [--threshold <k>]  the quorum rule for the new roster (default: majority)",
  "  show    read the kahu quorum's seats + chain head + quorum verdict + the carried set",
  "  cold rehearse  type back one or more chairs' cards: each reads against the digests the head",
  "          committed and names the chair it would roll. Nothing moves: no key, row or charter.",
  "  import <file>          land a charter at the primary path — only where none stands, or the same one",
  "  import --carry <file>  land a PARTNER's charter beside yours, under its Nexus AID; a re-import for",
  "                         that AID lands only when its seal lineage extends the held head",
  "  cofound open --release <manifest> --out <offer>   found a Nexus with a second operator, two of two:",
  "          a seat key for your face and your hearth's cadence key mint here, your chair's next key prints",
  "          on a card you type back, and the offer file goes to the other founder. [--face <i>] [--charter-law <lar:>]",
  "  cofound join <offer> --out <join>   answer an offer: type the offer seat's fingerprint as you heard it",
  "          (--heard <fp>), and your own seat, cadence key and card mint; the join half-signs the inception",
  "  cofound seal <join> --out <inception>   the offering founder: type the joining seat's fingerprint as you",
  "          heard it (--heard <fp>); both signatures land, and the joint charter files under its own AID",
  "  cofound seal <inception>   the joining founder: the inception reads against the image you joined, and",
  "          the joint charter files under its own AID. Neither household seed moves.",
  "  roll open --nexus <aid> --threshold <n> --out <circle>   roll a joint Nexus across its vaults: type this",
  "          chair's revealed cold card, a fresh successor card prints, and the circle file goes to the next holder",
  "          [--face <i>] [--added]  --added = a chair the head never committed (a new holder): no card reads",
  "  roll join <circle> --out <circle>   contribute this vault's chair to a carried circle (same flags)",
  "  roll sign <circle> --out <circle>   sign the circle with the seats this vault contributed, once you type what you",
  "          heard from the other holders: the rule and every other chair's fingerprint [--heard-threshold <n> --heard <fp,…>]",
  "  roll file <circle>   file the rolled charter once the circle reads complete; the roll anchor crosses next",
  "  roll abandon --nexus <aid>   drop this vault's open circle and retire the seats it contributed",
  "  anchor [--nexus <aid>] --out <partial>   once both vaults filed the roll, sign its anchor with the seats held here",
  "  anchor --from <partial> [--out <file>]   judge the other vault's anchor partial, cosign it, land it once complete",
];

/**
 * The quorum rite — seat the kahu quorum, which arms its own pre-rotation, and read the verdict.
 *
 * ── WHY IT DOES NOT MINT THE PERSONAS ───────────────────────────────────────────────────────────
 * A chair joins on a private chair label. A rite that invented three labels would make the SOURCE decide who the founding kahu are, leaving the operator to
 * confirm a legitimacy call somebody else made. So the three `persona new` acts stay outside this rite,
 * deliberately, and the seat refuses when nobody stands — which is the correct refusal, not a gap.
 *
 * ── WHAT IT ACTUALLY REMOVES ────────────────────────────────────────────────────────────────────
 * Every value a person would carry by hand. The seat mints each chair's key and its next key behind the custody
 * door and commits the next set itself, so no digest crosses on a clipboard and no head seats unarmed.
 */
export async function runQuorumRite(args: ParsedArgs): Promise<number> {
  const rest = { ...args, positional: args.positional.slice(2) };
  try {
    return await quorumRiteSteps(rest);
  } catch (err) {
    // A DOOR RETURNS A CODE. `cmdSeal` renders these as refusals, and this rite calls the very same seal
    // steps WITHOUT going through it — so a `UsageError` (an unseatable charter, a threshold past the
    // roster) threw straight out of `cmdNexus` to the caller. The exit-code vocabulary exists so a caller
    // never has to catch; a door that throws past its own dispatcher hands the operator a stack trace
    // where a reading belongs. Same shape and same verdicts as `cmdSeal`, so the two cannot diverge.
    const msg  = err instanceof Error ? err.message : String(err);
    const code = err instanceof UsageError ? "usage" : "error";
    emit(args, { ok: false, error: { code, message: msg }, human: () => console.error(`lares nexus rite quorum: ${msg}`) });
    return exitFor(code);
  }
}

async function quorumRiteSteps(rest: ParsedArgs): Promise<number> {
  const seated = await sealSeat(rest);
  if (seated !== 0) {
    console.error("lares nexus rite quorum: halted at `seal seat`. Re-run after seating");
    console.error("  personas that stood for a chair (`persona new <i> --name '<label>' --seat [--chair '<chair label>']`).");
    return seated;
  }
  return await sealShow(rest);
}

export async function cmdSeal(args: ParsedArgs): Promise<number> {
  const sub = args.positional[1];
  try {
    switch (sub) {
      case "seat":    return await sealSeat(args);
      case "rotate":  return await sealRotate(args);
      case "show":    return await sealShow(args);
      case "export":  return sealExport(args);
      case "import":  return await sealImport(args);
      case "grow":    return await sealGrow(args);
      case "cold":    return await sealCold(args);
      case "cofound": return await sealCofoundVerb(args);
      case "roll":    return await sealRollVerb(args);
      case "anchor":  return await cmdSealAnchor(args);
      default:
        return refuseUsage(args, "nexus seal", SEAL_USAGE, sub ? `unknown sub-verb "${sub}"` : undefined);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const failure = err instanceof UsageError ? { code: "usage", message: msg } : storeFailure(err);
    emit(args, { ok: false, error: failure, human: () => console.error(`lares nexus seal ${sub ?? ""}: ${msg}`) });
    return exitFor(failure.code);
  }
}

/** A rite step on the custody door; the ceremony's own refusal reads as a usage refusal here. */
async function riteStep<T>(run: () => Promise<T>): Promise<T> {
  try { return await run(); }
  catch (err) {
    if (err instanceof SealedActRefused && err.reason === "act-refused") throw new UsageError(err.message);
    throw err;
  }
}

/** The quorum rule the operator typed, or undefined: the arming then keeps the charter's own, else a majority. */
function askedThreshold(args: ParsedArgs): number | undefined {
  const raw = args.options["threshold"];
  if (raw === undefined) return undefined;
  const t = Number(raw);
  if (!Number.isInteger(t) || t < 1) throw new UsageError(`--threshold expects a whole number ≥ 1, got "${raw}"`);
  return t;
}

// ── THE RITE'S SEAM — two inner functions hold every line that says how a head commits its successors ──
//
// `armGenesis` and `armRoll` ask the custody door to arm a head and turn its answer into an epoch. Nothing
// outside them names a commitment, so a change to how a head commits edits these bodies and no line beside them.

/** Whether a head commits successors at all. */
const headArmed = (head: SealEpoch | null | undefined): boolean => Boolean(head) && head!.nextKeyDigests.length > 0;


/** What an arming hands the rite: the roster to write, and the cards of the next keys its epoch commits. */
interface ArmedSeat {
  readonly kahu:       NexusCharterKahu[];
  readonly seatedKeys: string[];
  readonly threshold:  number;
  readonly cards:      readonly ColdCard[];
  /** Seat keys the rite asks the door to retire once the charter it wrote stands. */
  readonly spent:      readonly string[];
  /** Seat keys this arming minted or adopted: a rite that writes nothing after all asks the door to retire them. */
  readonly minted:     readonly string[];
}

/**
 * Mint one cold key per seated key, in the SORTED order of the seated keys, and the commitment they make: digest i
 * commits the successor of the i-th sorted seated key, under the roster's own threshold.
 */
async function mintColdCards(kahu: readonly NexusCharterKahu[], seatedKeys: readonly string[], threshold: number): Promise<{ cards: ColdCard[]; next: SealNext }> {
  const chairOf = new Map(kahu.filter((k) => k.verifyingKey).map((k) => [k.verifyingKey!.toLowerCase(), k.chairLabel]));
  const cards: ColdCard[] = [];
  for (const key of [...new Set(seatedKeys.map((k) => k.toLowerCase()))].sort()) {
    const cold = await mintColdKey();
    cards.push({ chair: chairOf.get(key) ?? "a chair", seed: cold.seed, digest: cold.digest });
  }
  return { cards, next: { digests: cards.map((c) => c.digest), threshold } };
}

/**
 * ARM A GENESIS. The door gives each standing chair a seat key minted behind it and answers the roster; this
 * process mints each seated chair's cold next key, and the genesis commits their digests. Below the quorum rule no
 * epoch roots, and no card mints.
 */
async function armGenesis(args: ParsedArgs): Promise<ArmedSeat & { readonly image: CharterInceptionImage | null }> {
  const armed = await riteStep(() => armGenesisSeats(askedThreshold(args)));
  const seatedKeys = [...armed.seatedKeys];
  const kahu = armed.kahu.map((k) => ({ ...k }));
  if (seatedKeys.length < armed.threshold) return { kahu, seatedKeys, threshold: armed.threshold, image: null, cards: [], spent: armed.superseded, minted: armed.minted };
  const { cards, next } = await mintColdCards(kahu, seatedKeys, armed.threshold);
  const image = charterInceptionImage(seatedKeys, armed.threshold, next);
  return { kahu, seatedKeys, threshold: armed.threshold, image, cards, spent: armed.superseded, minted: armed.minted };
}

/** Every seated hand signs the inception through the door, each as its own seat; the genesis reads only so. */
async function incept(image: CharterInceptionImage): Promise<SealEpoch> {
  return riteStep(() => inceptCharterEpoch(image, image.keys.map(inceptHand)));
}

/**
 * ARM A ROLL. The person's cards cross the custody door, where each revealed key that answers a digest the head
 * committed becomes its chair's seat key; the door answers the roster that stands. This process mints the rolled
 * head's cold cards, and the seated hands sign the step through the door, each as its own seat.
 */
async function armRoll(args: ParsedArgs, doc: NexusDoc, head: SealEpoch): Promise<ArmedSeat & { readonly result: RotateResult }> {
  // A head that committed nothing licenses no roll: it refuses under the roll law's own name, before any card reads.
  if (!headArmed(head)) {
    return { kahu: [], seatedKeys: [], threshold: 0, cards: [], spent: [], minted: [],
      result: { ok: false, code: "rotation-unarmed", reason: "rotation unarmed — the head epoch pre-committed no next keys" } };
  }
  const seeds = await gatherCards(args, head.nextKeyDigests.length);
  let armed: Awaited<ReturnType<typeof armRollSeats>>;
  try { armed = await riteStep(() => armRollSeats(seeds, askedThreshold(args))); }
  finally { for (const seed of seeds) seed.fill(0); }
  const seatedKeys = [...armed.seatedKeys];
  const kahu = armed.kahu.map((k) => ({ ...k }));
  const { cards, next } = await mintColdCards(kahu, seatedKeys, armed.threshold);
  // A roll off the genesis reveals the genesis seats (the head roster), so no key the genesis seated returns.
  const closing = foundingRoster(doc);
  const result = await riteStep(() => rotateSealEpoch(head, { keys: seatedKeys, threshold: armed.threshold }, next,
    armed.signers.map(sealHand), (doc.sealLineage ?? []).slice(0, -1), { keys: closing.keys, threshold: closing.threshold }));
  return { kahu, seatedKeys, threshold: armed.threshold, result, cards, spent: armed.spent, minted: armed.minted };
}

/**
 * The cards a roll reveals. On a terminal the rite asks for each chair's card in turn, and a blank line skips one.
 * The `--cold-key <code,code,…>` flag stands in for the terminal on a staged test root alone: a card typed into a
 * flag on a live machine rests in the shell's history.
 */
async function gatherCards(args: ParsedArgs, chairs: number): Promise<Uint8Array[]> {
  const read = (code: string): Uint8Array => {
    try { return coldKeySeedFromCode(code); }
    catch (err) { if (err instanceof ColdKeyCardError) throw new UsageError(err.message); throw err; }
  };
  const flagged = args.options["cold-key"];
  if (flagged !== undefined && !(await readBackStandsIn())) throw new UsageError("--cold-key stands in for the terminal on a staged test root alone: type each card when the rite asks for it");
  if (flagged === undefined && !canPromptSecret()) throw new UsageError("a roll reads each chair's cold-key card on a terminal; run it on one");
  // A CARD THAT FAILS TO READ LEAVES NO SEED BEHIND: every seed read before it zero-fills before the refusal leaves.
  const seeds: Uint8Array[] = [];
  try {
    if (flagged !== undefined) {
      for (const code of flagged.split(",").map((c) => c.trim()).filter((c) => c.length > 0)) seeds.push(read(code));
      return seeds;
    }
    for (let i = 0; i < chairs; i++) {
      const code = (await promptSecret(`cold-key card ${i + 1} of ${chairs} (blank to skip)`)).trim();
      if (code.length > 0) seeds.push(read(code));
    }
    return seeds;
  } catch (err) {
    for (const seed of seeds) seed.fill(0);
    throw err;
  }
}

/** The cold-key card printer, its refusal read as a usage refusal here (`cold-card-readback`). */
async function readBack(args: ParsedArgs, cards: readonly ColdCard[], generation: number, charterFingerprint: string): Promise<Array<Record<string, string>>> {
  try { return await printAndReadBack(args, cards, generation, charterFingerprint); }
  catch (err) { if (err instanceof CardReadBackRefused) throw new UsageError(err.message); throw err; }
}

/** Ask the door to retire seat keys the rite left behind; answers how many left and how many an open crossing keeps. */
async function retireSpent(keys: readonly string[]): Promise<{ readonly retired: number; readonly keptForCrossing: number }> {
  const said = await riteStep(() => retireSeats(keys));
  return { retired: said.retired.length, keptForCrossing: said.kept.filter((k) => k.why === "crossing-open").length };
}

async function sealSeat(args: ParsedArgs): Promise<number> {
  const sealHome = larSealHome();
  // A TORN CHARTER MUST NOT READ AS AN ABSENT ONE. `readNexusDoc` answers null for both, which suits every
  // caller that folds null to an inert roster; this one folds it to a founding SCAFFOLD instead, and that
  // scaffold carries no `sealLineage` at all — so the guard below, reading `doc.sealLineage && …`, short
  // circuits on undefined and lets a rotated-but-unreadable chain re-genesis itself. Presence tells the two
  // apart: a charter that stands and will not read is the one case where seating guesses.
  if (nexusCharterStands(sealHome) && readNexusDoc(sealHome) === null) {
    throw new UsageError("the charter doc stands here but reads TORN — refusing to seat over it (a re-seat would re-genesis a chain that may already have rotated). Repair or move it, then seat.");
  }
  const doc = readNexusDoc(sealHome) ?? emptyFoundingCharterDoc();

  // FAIL CLOSED: a chain already advanced PAST genesis is never silently re-genesied — a re-seat would
  // strand every antigen entry rooted on a rotated head. The operator advances a live chain via `rotate`.
  if (doc.sealLineage && doc.sealLineage.length > 1) {
    throw new UsageError("the charter chain has already ROTATED past genesis — advance it with `lares nexus seal rotate`, never re-seat");
  }

  // THE ARMING HOLDS THE REST OF THE LAW, behind the door and before any key mints: a seat never builds on a
  // charter this vessel did not found (a seated key no row here holds refuses by fingerprint), a chair never
  // holds a persona root or a dialing leaf as its key, and a roster nobody stands for refuses. The roster forms
  // from what STOOD, never from a list this build shipped; the threshold comes from the operator's `--threshold`,
  // else the charter's own, else a MAJORITY of the chairs.
  // A seed turns to a Nexus when a second operator seats their own key in a fresh charter. A contract moves no phase.
  const { kahu, seatedKeys, threshold, image, spent, minted, cards } = await armGenesis(args);
  // THE CARDS READ BACK BEFORE THE CHARTER MOVES: a refusal here writes nothing, and the keys the arming minted retire.
  // The seats sign the inception only after the cards read back.
  let printed: Array<Record<string, string>>;
  let genesis: SealEpoch | null = null;
  try {
    printed = await readBack(args, cards, 1, image ? genesisOfInception(image).epochCid.slice(-16) : "");
    if (image) genesis = await incept(image);
  } catch (err) { await retireSpent(minted); throw err; }

  // Establish the genesis epoch only once a quorum is seatable — below threshold, no epoch roots (inert).
  const sealLineage: SealEpoch[] | undefined = genesis ? [genesis] : undefined;
  const sealEpochCid: string | null = genesis ? genesis.epochCid : null;

  const next: NexusDoc = sealLineage
    ? { kind: doc.kind, threshold, sealEpochCid, sealLineage, kahu }
    : { kind: doc.kind, threshold, sealEpochCid, kahu };
  // A seat moves TWO joints — the roster it seats and the genesis epoch it establishes — and writes them as ONE
  // file, carrying the practice dials it never touched: a stop between two writes would leave a head that binds
  // no roster.
  const { sealLineage: _priorLineage, ...dials } = doc;
  const path = writeNexusDoc(sealHome, { ...dials, ...next });
  // THE CHARTER STANDS; the seat keys an earlier seat left behind retire now, and never before the write.
  const left = await retireSpent(spent);
  const quorum = foundingQuorumSeated(next);
  const armed = headArmed(genesis);

  emit(args, {
    ok: true,
    data: {
      path, threshold: next.threshold, sealEpochCid, quorumSeated: quorum,
      rotationArmed: armed, retiredSeatKeys: left.retired, cards: printed,
      kahu: kahu.map((k) => ({ chairLabel: k.chairLabel, seated: Boolean(k.verifyingKey), verifyingKey: k.verifyingKey,
        fingerprint: k.verifyingKey ? seatFingerprint(k.verifyingKey) : null })),
    },
    human: () => {
      // The headline names what STOOD: an epoch, or a roster with none.
      console.log(sealLineage
        ? `nexus seal seated — GENESIS EPOCH established → ${path}`
        : `nexus seal seated — roster written, NO epoch (quorum short) → ${path}`);
      for (const k of kahu) {
        console.log(`  ${k.verifyingKey ? "seated  " : "UNSEATED"} ${k.chairLabel}${k.verifyingKey ? `  ${seatFingerprint(k.verifyingKey)}` : ""}`);
      }
      console.log(`  threshold:  ${next.threshold} of ${kahu.length}`);
      // WHAT IT SURVIVES, AT THE MOMENT IT IS WRITTEN. A seat NAMES a fragile quorum and refuses none —
      // the keeper ladder starts at one, so a floor here would forbid its own first step. An operator
      // who has lost a kahu must be able to re-seat, and that is the case most likely to land fragile,
      // so the reading rides at the moment of writing as well as at `show`.
      const seatStanding = rosterStanding({ seated: seatedKeys.length, threshold: next.threshold });
      if (seatStanding.fragile) console.log(`  ⚠ survives:  ${seatStanding.reading}`);
      console.log(`  nexus:      ${sealEpochCid ?? "(unestablished — seat a quorum first)"}`);
      if (quorum) {
        console.log(`  quorum STANDS — the antigen now reads a live roster rooted on the genesis epoch.`);
        console.log(`  seat keys:  each chair holds its own key, sealed on this vessel, apart from every persona root.`);
        console.log(`  rotation:   ${armed ? "ARMED (each chair's next key rests on its card alone, and the genesis commits one digest per chair)" : "UNARMED"}`);
      } else {
        const missing = kahu.filter((k) => !k.verifyingKey).map((k) => `"${k.chairLabel}"`);
        console.log(`  quorum SHORT (fail-closed; the antigen stays inert). Unseated: ${missing.join(", ") || "(none)"}`);
        console.log(`  seat them: lares persona new <index> --name '<label>' --seat [--chair '<chair label>']  →  lares nexus seal seat`);
      }
    },
  });
  return 0;
}

// ── THE GROWTH RITE — the crossing record ceremony (`seal grow open|bind|sign|witness|seal`) ──────
//
// The rite SPANS the rotate: `open` captures the standing hands before anything moves; the operator
// pre-commits the successor and rotates (the succession door above); `bind` fixes the record's far
// side to the new head, closing the byte-image; hands SIGN (a key seated in both sets counts in both
// quorums); a WITNESS — a key seated in NEITHER — attests with a note; `seal` verifies the crossing
// whole (`verifyReserveTransition`) and keeps the record beside the charter. The record is CARRIAGE:
// it travels with the charter's own artifacts, self-announced by the charter — never a registry.

/** Run one step of the growth rite on the custody door; the ceremony's own refusal reads as a usage refusal here. */
async function crossingStep<T>(act: "crossing.open" | "crossing.bind" | "crossing.sign" | "crossing.witness" | "crossing.seal", args: Record<string, unknown> = {}): Promise<T> {
  try { return await sealedAct<T>(act, args); }
  catch (err) {
    if (err instanceof SealedActRefused && err.reason === "act-refused") throw new UsageError(err.message);
    throw err;
  }
}

/** A step's `--index`: the handle-index of the face whose hand marks the crossing (its seat keys sign; its root witnesses). */
function handIndex(args: ParsedArgs): number {
  const idx = Number(args.options["index"] ?? "0");
  if (!Number.isSafeInteger(idx) || idx < 0) throw new UsageError(`--index takes a handle-index (a whole number from 0), got "${String(args.options["index"])}"`);
  return idx;
}

/**
 * THE RITE'S ROWS REST SEALED, AND ITS HANDS SIGN BEHIND THE DOOR. Each step sends one act frame and prints what
 * the door answered. The command holds no row and no record: the node side reads the charter that stands and the
 * crossing that stands open, and a hand names itself by index and never by an image to sign.
 */
async function sealGrow(args: ParsedArgs): Promise<number> {
  const step = args.positional[2];

  switch (step) {
    case "open": {
      const open = await crossingStep<{ fromEpochCid: string; oldHands: number }>("crossing.open");
      emit(args, { ok: true, data: { open },
        human: () => console.log(`crossing OPEN from epoch ${open.fromEpochCid.slice(0, 16)}… — now pre-commit the successor, rotate, then \`grow bind\`.`) });
      return 0;
    }
    case "bind": {
      const bound = await crossingStep<{ toEpochCid: string }>("crossing.bind");
      emit(args, { ok: true, data: { bound },
        human: () => console.log(`crossing BOUND to epoch ${bound.toEpochCid.slice(0, 16)}… — the byte-image is closed; gather signatures and a witness.`) });
      return 0;
    }
    case "sign": {
      const signed = await crossingStep<{ as: string[]; old: boolean; new: boolean }>("crossing.sign", { handleIndex: handIndex(args) });
      emit(args, { ok: true, data: { signed },
        human: () => console.log(`signed${signed.old ? " [handoff]" : ""}${signed.new ? " [receipt]" : ""} as ${signed.as.map((key) => `${key.slice(0, 16)}…`).join(" and ")}`) });
      return 0;
    }
    case "witness": {
      const note = args.options["note"];
      if (!note) throw new UsageError("a witness mark carries a note — what stood observed (--note)");
      const witnessed = await crossingStep<{ by: string }>("crossing.witness", { handleIndex: handIndex(args), note });
      emit(args, { ok: true, data: { witnessed }, human: () => console.log(`witnessed by ${witnessed.by.slice(0, 16)}… — "${note}"`) });
      return 0;
    }
    case "seal": {
      let sealed: { transitionCid: string; independentWitnesses: number; resumed: boolean; retired: number | null };
      try { sealed = await crossingStep("crossing.seal"); }
      catch (err) {
        // A crossing that does not verify refuses fail-closed: an error, never a retyping fault.
        if (err instanceof UsageError && err.message.startsWith("crossing REFUSED (fail-closed)")) {
          emit(args, { ok: false, error: { code: "error", message: err.message }, human: () => console.error(`seal grow ${err.message}`) });
          return exitFor("error");
        }
        throw err;
      }
      emit(args, { ok: true, data: { sealed: { transitionCid: sealed.transitionCid, independentWitnesses: sealed.independentWitnesses } },
        human: () => console.log(`crossing SEALED — ${sealed.transitionCid.slice(0, 20)}… · independent witnesses: ${sealed.independentWitnesses}. The record rests sealed beside the charter.${sealed.resumed ? " (a seal that had committed and stopped: resumed)" : ""}${sealed.retired === null ? " The outgoing seat keys still stand: their retirement refused." : ` ${sealed.retired} outgoing seat key(s) retired.`}`) });
      return 0;
    }
    default:
      console.error("lares nexus seal grow <open | bind | sign --index N | witness --index N --note '…' | seal>");
      return 2;
  }
}

// ── THE CARD'S REHEARSAL — `seal cold rehearse` ────────────────────────────────────────────────────
//
// One mis-copied card freezes a chair at its next roll, and the roll itself spends the cards it reads. The rehearsal
// reads a card back the way a roll would, against the digests the head committed, and moves nothing: it asks the
// custody door for no act beyond the stand-in reading, writes no row and no charter, and every seed zero-fills
// before it answers. It needs no unlocked vessel on a terminal: a card's digest reads off public bytes alone.

const COLD_USAGE: readonly string[] = [
  "usage: lares nexus seal cold rehearse",
  "",
  "  rehearse  type back one or more chairs' cold-key cards (a blank line skips a chair). Each card",
  "            reads against the digests the head committed and names the chair it would roll.",
  "            Nothing moves: no key, row or charter changes.",
];

async function sealCold(args: ParsedArgs): Promise<number> {
  const step = args.positional[2];
  if (step !== "rehearse") return refuseUsage(args, "nexus seal cold", COLD_USAGE, step ? `unknown step "${step}"` : undefined);
  const { doc, head } = sealedCharterOrRefuse(larSealHome(), "rehearse");
  const refuse = (code: string, message: string): number => {
    emit(args, { ok: false, error: { code, message }, human: () => console.error(`lares nexus seal cold rehearse: ${message}`) });
    return exitFor(code);
  };
  if (!headArmed(head)) return refuse("rotation-unarmed", "the head commits no next key, so no card answers it");
  // Digest i commits the successor of the i-th SORTED seated key, so position i names that key's chair.
  const chairOf = new Map(doc.kahu.filter((k) => k.verifyingKey).map((k) => [k.verifyingKey!.toLowerCase(), k.chairLabel]));
  const sorted = seatedKahuKeys(doc);
  const positions = head.nextKeyDigests.length;
  const seeds = await gatherCards(args, positions);
  try {
    if (seeds.length === 0) throw new UsageError("no card typed — type at least one chair's card");
    const answered: Array<{ card: number; position: number; chair: string; digest: string }> = [];
    for (const [i, seed] of seeds.entries()) {
      const cold = await coldKeyFromSeed(seed);
      cold.seed.fill(0);
      const digest = cold.digest;
      const position = head.nextKeyDigests.indexOf(digest);
      // A REFUSAL CARRIES NO SECRET: it names the card by its place in the typing, never by a byte of its code.
      if (position < 0) return refuse("cold-card-answers-no-digest", `card ${i + 1} answers no digest the head committed — it would roll nothing; check it against the paper. Nothing moved.`);
      // A roll refuses two cards for one chair, so the rehearsal names the repeat rather than counting it twice.
      const earlier = answered.find((a) => a.position === position + 1);
      if (earlier) return refuse("cold-card-repeated", `card ${i + 1} answers the same chair as card ${earlier.card} — a roll takes one card per chair. Nothing moved.`);
      answered.push({ card: i + 1, position: position + 1, chair: chairOf.get(sorted[position] ?? "") ?? "a chair", digest });
    }
    const rehearsed = new Set(answered.map((a) => a.position));
    const unrehearsed = head.nextKeyDigests.map((_, p) => p + 1).filter((p) => !rehearsed.has(p));
    emit(args, {
      ok: true,
      data: { head: head.epochCid, positions, nextThreshold: head.nextThreshold, answered, unrehearsed, moved: false },
      human: () => {
        console.log(`nexus seal cold rehearse — head ${head.epochCid.slice(0, 24)}…`);
        for (const a of answered) console.log(`  card ${a.card} answers chair ${a.position} of ${positions} (${a.chair}): it would roll this head`);
        if (unrehearsed.length > 0) console.log(`  not rehearsed: chair(s) ${unrehearsed.join(", ")}`);
        console.log(`  a roll needs ${head.nextThreshold} of ${positions} cards. Nothing moved.`);
      },
    });
    return 0;
  } finally {
    for (const seed of seeds) seed.fill(0);
  }
}

async function sealRotate(args: ParsedArgs): Promise<number> {
  const sealHome = larSealHome();
  const { doc, head } = sealedCharterOrRefuse(sealHome, "rotate");
  const depth = doc.sealLineage?.length ?? 0;

  // A ROLL WAITS ON ITS PRIOR ANCHOR (operator ruling 2026-10-15): the head's own roll stands anchored before any
  // card reads, so no roll stacks over a step its readers cannot carry across a removal.
  try { await storeVerb("nexus-roll-prior-anchor", {}, NexusContractError); }
  catch (err) {
    if (!(err instanceof NexusContractError)) throw err;
    emit(args, {
      ok: false,
      error: { code: "prior-roll-unanchored", message: `rotation REFUSED (fail-closed): ${err.message}` },
      human: () => {
        console.error(`nexus seal rotate REFUSED (fail-closed): ${err.message}`);
        console.error(`  the chain stays at depth ${depth}; nothing written.`);
      },
    });
    return exitFor("prior-roll-unanchored");
  }

  // REVEAL, behind the door: the next key-set the head committed rests on this vessel as sealed seat keys, and
  // the arming finds it by its digest. THE ROSTER BECOMES EXACTLY WHAT STANDS — the succession door. A kahu
  // steps down by no longer standing; a new one takes a chair by standing and signs with a fresh key of its own.
  // Neither needs an admin verb, because the hands the head COMMITTED sign every roll: a seat moves only under
  // the quorum the prior epoch named.
  // FAIL CLOSED: a roll the law refuses writes nothing, and the keys its arming minted retire.
  const { kahu, seatedKeys, threshold, result, spent, minted, cards } = await armRoll(args, doc, head);
  if (!result.ok) {
    for (const card of cards) card.seed.fill(0);
    await retireSpent(minted);
    emit(args, {
      ok: false,
      error: { code: result.code, message: `rotation REFUSED (fail-closed): ${result.reason}` },
      human: () => {
        console.error(`nexus seal rotate REFUSED (fail-closed): ${result.reason}`);
        console.error(`  the chain stays at depth ${depth}; nothing written.`);
      },
    });
    return exitFor(result.code);
  }

  const sealLineage: SealEpoch[] = [...(doc.sealLineage ?? []), result.epoch];
  const sealEpochCid = result.epoch.epochCid;
  const next: NexusDoc = { kind: doc.kind, threshold, sealEpochCid, sealLineage, kahu };

  // THE ROLLED HEAD'S CARDS READ BACK BEFORE ANYTHING LANDS: the anchor and the charter wait on every card.
  let printed: Array<Record<string, string>>;
  try { printed = await readBack(args, cards, sealLineage.length, doc.sealLineage![0]!.epochCid.slice(-16)); }
  catch (err) { await retireSpent(minted); throw err; }
  // THE ROLL ANCHOR LANDS FIRST. The new quorum signs the closing head, its key-set and the board's causal
  // heads, so an admit already in those heads carries across the roll; one the closing keys mint afterwards
  // does not. It lands BEFORE the charter moves: a roll whose anchor cannot land writes nothing, and an anchor
  // whose head never lands names an epoch no lineage holds. A closing head that roots no roster (an inert
  // charter) counted no act, so it has nothing to carry and writes no anchor.
  // THE ANCHOR'S SIGNERS HOLD NO SEAT UNTIL THE CHARTER MOVES, so the anchor's door reads the seats the roll
  // opens off its own argument (`opened`), and finds their keys among this vessel's rows.
  const closing = foundingRoster(doc);
  const opened: KahuQuorumSeats = { keys: seatedKeys, threshold, sealEpochCid };
  let anchored: NexusRollAnchorResult | null = null;
  if (closing.sealEpochCid.length > 0) {
    try {
      const { output } = await storeVerb("nexus-roll-anchor", { closing, opened, epoch: result.epoch }, NexusContractError);
      anchored = output as unknown as NexusRollAnchorResult;
    } catch (err) {
      if (!(err instanceof NexusContractError)) throw err;
      for (const card of cards) card.seed.fill(0);
      await retireSpent(minted);
      emit(args, {
        ok: false,
        error: { code: "roll-anchor-refused", message: `rotation REFUSED (fail-closed): ${err.message}` },
        human: () => {
          console.error(`nexus seal rotate REFUSED (fail-closed): ${err.message}`);
          console.error(`  the chain stays at depth ${depth}; nothing written.`);
        },
      });
      return exitFor("roll-anchor-refused");
    }
  }
  // Every roll seats fresh keys, so it moves BOTH joints, the seal and the roster, and writes them as ONE file
  // carrying the practice dials: a stop between two writes would leave a head that binds no roster.
  const path = writeNexusDoc(sealHome, { ...doc, ...next });
  // THE ROLLED CHARTER STANDS; the closing head's seat keys retire now, and never before the write. A crossing
  // that stands open keeps them until its seal: the outgoing hands still owe it their marks.
  const left = await retireSpent(spent);
  const armed = headArmed(result.epoch);

  emit(args, {
    ok: true,
    data: {
      path, sealEpochCid, predecessors: result.epoch.predecessors,
      chainDepth: sealLineage.length, rotationArmed: armed,
      quorumSeated: foundingQuorumSeated(next),
      rollAnchor: anchored ? { cid: anchored.anchorCid, parents: anchored.parents.length } : null,
      retiredSeatKeys: left.retired, seatKeysKeptForCrossing: left.keptForCrossing, cards: printed,
    },
    human: () => {
      console.log(`nexus seal ROTATED → chain depth ${sealLineage.length} → ${path}`);
      console.log(`  each card's key VERIFIED against the digest the prior epoch committed; the seated hands SIGNED the roll.`);
      console.log(`  head epoch: ${sealEpochCid}`);
      console.log(`  prev link:  ${result.epoch.predecessors.join(", ")}`);
      console.log(anchored
        ? `  anchor:     ${anchored.anchorCid.slice(0, 16)}… over ${anchored.parents.length} board head(s) — admits in its past carry to the new head`
        : `  anchor:     none — the closing head rooted no roster, so no admit stood to carry`);
      console.log(`  seat keys:  ${left.retired} of the closing head retired${left.keptForCrossing > 0 ? `; ${left.keptForCrossing} kept until the open crossing seals` : ""}`);
      console.log(`  rotation:   ${armed ? "ARMED (each chair's next key rests on its card alone)" : "UNARMED"}`);
    },
  });
  return 0;
}

/**
 * `lares nexus seal export` — the public charter material, for a partner who must consent to it.
 *
 * An operator cannot consent to a charter she has never seen, so this is what travels FIRST. Seated
 * keys, threshold and epoch lineage are public by construction — the material a joiner verifies a
 * quorum signature against — so the channel needs INTEGRITY and no secrecy. Nothing here is a key
 * this vessel holds; the charter grants its reader no quorum, which the crossing witness asserts.
 */
function sealExport(args: ParsedArgs): number {
  const sealHome = larSealHome();
  const path = nexusCharterDocPath(sealHome);
  const raw = existsSync(path) ? readFileSync(path, "utf8") : null;
  if (raw === null) {
    emit(args, { ok: false, error: { code: "not-found", message: `no charter at ${path} — seat one first: \`lares nexus rite quorum\`` },
                 human: () => console.error(`lares nexus seal export: no charter at ${path} — seat one first: \`lares nexus rite quorum\``) });
    return 4;
  }
  const parsed = parseNexusDoc(raw);
  if (!parsed) {
    const message = "the standing charter reads torn";
    emit(args, { ok: false, error: { code: "refused", message }, human: () => console.error(`lares nexus seal export: ${message}`) });
    return 3;
  }
  const chairs = parsed.kahu.map((k) => ({ fingerprint: k.verifyingKey ? seatFingerprint(k.verifyingKey) : null, seated: Boolean(k.verifyingKey) }));
  const payload = { ...parsed, kahu: parsed.kahu.map((k) => ({ ...k, chairLabel: k.verifyingKey ? seatFingerprint(k.verifyingKey) : "unseated" })) };
  const fence = /```json nexus-kahu\r?\n([\s\S]*?)\r?\n```/;
  const redacted = stampCarrier(raw.replace(fence, `\`\`\`json nexus-kahu\n${JSON.stringify(payload, null, 2)}\n\`\`\``));
  emit(args, {
    ok: true, data: { path, charter: redacted, chairs },
    human: () => {
      console.log(redacted);
      console.error(`\n  ${path}`);
      console.error("  public material — hand it over any channel that preserves INTEGRITY. It grants its");
      console.error("  reader no quorum; it carries keys and fingerprints, no chair label.");
    },
  });
  return 0;
}

/**
 * `lares nexus seal import <file>` — place a charter at the PRIMARY path, and refuse to destroy your own.
 * `lares nexus seal import --carry <file>` — place a PARTNER's charter BESIDE the primary.
 *
 * The primary path holds the one charter the realm plane and the board climb read, so a plain import lands
 * only where none stands or where the same charter already stands: dropping a partner's roster there would
 * REPLACE a founding. A partner charter takes `--carry`, which lands it at `carried/<aid>/` and leaves the
 * primary's bytes untouched; `accept-carriage --nexus <aid>` then consents to it.
 */
async function sealImport(args: ParsedArgs): Promise<number> {
  const carry = args.options["carry"];
  if (carry !== undefined) return await sealImportCarry(args, carry);
  const from = args.positional[2] ?? "";
  if (!from) {
    console.error("usage: lares nexus seal import <path-to-founding-roster.mem> | --carry <path>");
    return 2;
  }
  let incomingRaw: string;
  try { incomingRaw = readFileSync(from, "utf8"); }
  catch { console.error(`lares nexus seal import: cannot read ${from}`); return 4; }

  const sealHome = larSealHome();
  const dest = nexusCharterDocPath(sealHome);
  // READ THE INCOMING THROUGH THE CANONICAL PARSER, never a second one. A hand-rolled read of the
  // seal fence would drift from `readNexusDoc` exactly when the doc shape moves, and this decision
  // gates a destructive write.
  const incoming = foundingRoster(parseNexusDoc(incomingRaw)).sealEpochCid;
  // A charter that STANDS but reads torn is a founding to recover, never a vacancy: reading it as absent
  // would let any incoming charter replace the founding its bytes still name.
  const standingDoc = nexusCharterStands(sealHome) ? readNexusDoc(sealHome) : null;
  if (nexusCharterStands(sealHome) && standingDoc === null) {
    const why = `the standing charter at ${dest} reads torn — recover it before importing. Nothing was written.`;
    emit(args, { ok: false, error: { code: "refused", message: why },
                 data: { from, dest }, human: () => console.error(`lares nexus seal import: ${why}`) });
    return 3;
  }
  const standing = foundingRoster(standingDoc).sealEpochCid || null;

  const v = sealImportVerdict({ incoming, standing });
  if (!v.ok) {
    emit(args, { ok: false, error: { code: "refused", message: v.why },
                 data: { from, dest }, human: () => console.error(`lares nexus seal import: ${v.why}`) });
    return 3;
  }
  // A sibling temp, fsync, and a rename, so a reader sees the old charter or the new one and never a torn
  // file. A write that faults removes its temp and refuses; the standing bytes stay.
  try {
    mkdirSync(sealHome, { recursive: true });
    atomicWriteFileSync(dest, incomingRaw, `${dest}.incoming`);
  } catch (err) {
    const why = (err as NodeJS.ErrnoException).code ?? (err instanceof Error ? err.message : String(err));
    const message = `the charter could not be written to ${dest} (${why}) — nothing landed, and any standing charter is unchanged.`;
    emit(args, { ok: false, error: { code: "error", message }, data: { from, dest },
                 human: () => console.error(`lares nexus seal import: ${message}`) });
    return exitFor("error");
  }
  // H2: a charter landing AFTER boot is exactly realm-plane's own "arrives after boot" case — poke a
  // standing vessel to materialize/re-stand its realm doc at once rather than leave it inert until some
  // later board write happens to refold. L3: the answer rides the JSON rather than vanishing.
  const refold = await pokeSealHomeRefold();
  emit(args, { ok: true, data: { from, dest, epoch: incoming, refold },
               human: () => { console.log(`imported → ${dest}`); console.log(`  ${v.why}`); console.log(`  refold: ${refold}`); } });
  return 0;
}

/**
 * `seal import --carry <file>` — land a partner charter beside the primary, under its Nexus AID. Refuses,
 * writing nothing, when the charter carries no verified head, names this vessel's own Nexus, or — for an AID
 * already held — does not extend the held seal lineage.
 */
async function sealImportCarry(args: ParsedArgs, from: string): Promise<number> {
  let raw: string;
  try { raw = readFileSync(from, "utf8"); }
  catch { console.error(`lares nexus seal import --carry: cannot read ${from}`); return 4; }
  try {
    const r = importCarriedCharter(larSealHome(), raw);
    // H2: the carried set just grew beside the seal home, never on this vessel's Repo — poke a standing
    // vessel to refold its live readings (`readCarried`, the board/antigen folds a dial presents against) at
    // once, rather than leave them stale until some later board write happens to refold. L3: the answer
    // rides the JSON rather than vanishing.
    const refold = await pokeSealHomeRefold();
    emit(args, {
      ok: true, data: { from, dest: r.path, aid: r.aid, epoch: r.sealEpochCid, outcome: r.outcome, refold },
      human: () => {
        console.log(`carried → ${r.path}`);
        console.log(`  nexus:  ${r.aid}`);
        console.log(`  head:   ${r.sealEpochCid} (${r.outcome})`);
        console.log(`  refold: ${refold}`);
        console.log(`  your primary charter is untouched. Consent with: lares nexus accept-carriage --nexus ${r.aid}`);
      },
    });
    return 0;
  } catch (err) {
    if (!(err instanceof CarriedCharterError)) throw err;
    emit(args, { ok: false, error: { code: "refused", message: err.message },
                 data: { from }, human: () => console.error(`lares nexus seal import --carry: ${err.message}`) });
    return 3;
  }
}

async function sealShow(args: ParsedArgs): Promise<number> {
  const sealHome = larSealHome();
  const { doc, state: seal } = readCharterSeal(sealHome);
  const roster = foundingRoster(doc);
  const quorum = foundingQuorumSeated(doc);
  const head = sealLineageHead(doc);
  const chainDepth = doc?.sealLineage?.length ?? 0;
  // A chair counts as this vault's own where this vessel holds its seat key: a reading of row names.
  const heldKeys = await heldSeats(seatedKahuKeys(doc));
  const foreign = doc ? foreignSeats(doc.kahu, heldKeys).foreign.length : 0;
  const seatedInDoc = doc?.kahu.filter((k) => typeof k.verifyingKey === "string" && k.verifyingKey.length > 0).length ?? 0;
  const ownSeats = Math.max(0, seatedInDoc - foreign);
  // THE CARRIED SET. One reading per charter this vessel holds, primary first. A Nexus stands in the set by a
  // consent verified at its held head or by a seated chair; a consent behind the head counts for nothing.
  // A reading folds the held persona roots and their leaves, which rest sealed: it rides the custody door.
  const { readings: carried } = await sealedAct<{ readings: ReadonlyArray<{ aid: string; primary: boolean; sealEpochCid: string; consented: boolean; seated: boolean; carried: boolean }> }>("carriage.readings");

  emit(args, {
    ok: true,
    data: {
      path: nexusCharterDocPath(sealHome),
      present: doc !== null,
      // THE SEAL READING, named: an absent charter, a torn one, an UNSEALED one (roster written, no epoch
      // seated) and a sealed one each take a different next step.
      seal,
      threshold: roster.threshold,
      sealEpochCid: roster.sealEpochCid || null,
      chainDepth,
      rotationArmed: headArmed(head),
      seatedKeys: roster.keys.length,
      quorumSeated: quorum,
      // WHAT THE QUORUM SURVIVES, beside what it is. A threshold met by every seated chair passes
      // every gate and locks the Nexus the day one seat goes dark — including for the rotation that
      // would repair it. The reading rides the payload so a harness can assert it, and the human
      // path prints it where the numbers already are.
      standing: rosterStanding({ seated: roster.keys.length, threshold: roster.threshold }),
      phase: nexusPhase({ ownSeats, foreignSeats: foreign }),
      kahu: (doc?.kahu ?? []).map((k) => ({ chairLabel: k.chairLabel, seated: Boolean(k.verifyingKey), fingerprint: k.verifyingKey ? seatFingerprint(k.verifyingKey) : null })),
      carried: carried.map((c) => ({ aid: c.aid, primary: c.primary, sealEpochCid: c.sealEpochCid || null,
                                     consented: c.consented, seated: c.seated, carried: c.carried })),
    },
    human: () => {
      const printCarried = (): void => {
        const inSet = carried.filter((c) => c.carried);
        console.log(`  carried:    ${inSet.length} Nexus(es) of ${carried.length} charter(s) held`);
        for (const c of carried) {
          const why = c.seated && c.consented ? "seated + consented" : c.seated ? "seated chair" : c.consented ? "consented" : "NOT carried — no consent at the held head";
          console.log(`    ${c.carried ? "●" : "○"} ${c.aid.slice(0, 24)}…  ${c.primary ? "primary" : "carried"} · ${why}`);
        }
      };
      if (!doc) {
        console.log(seal === "torn"
          ? `the nexus doc stands but reads TORN — repair or move it aside; a seat refuses over it.`
          : `no nexus doc — run \`lares nexus seal seat\` (the antigen stays inert until a quorum stands).`);
        console.log(`  ${seal === "torn" ? "stands at:  " : "expected at:"} ${nexusCharterDocPath(sealHome)}`);
        if (carried.length > 0) printCarried();
        return;
      }
      console.log(`nexus seal (${nexusCharterDocPath(sealHome)}):`);
      for (const k of doc.kahu) console.log(`  ${k.verifyingKey ? "seated  " : "UNSEATED"} ${k.chairLabel}${k.verifyingKey ? `  ${seatFingerprint(k.verifyingKey)}` : ""}`);
      console.log(`  threshold:  ${roster.threshold} · seated keys: ${roster.keys.length}`);
      console.log(`  seal:       ${seal === "sealed" ? "SEALED" : "UNSEALED — the roster stands and no seal epoch is seated; seat one once a quorum stands"}`);
      console.log(`  chain:      ${chainDepth > 0 ? `${chainDepth} epoch(s), head at seq ${chainDepth - 1}` : "(none — no epoch established)"}`);
      console.log(`  head epoch: ${roster.sealEpochCid || "(unestablished)"}`);
      console.log(`  rotation:   ${headArmed(head) ? "ARMED" : "UNARMED"}`);
      console.log(`  quorum:     ${quorum ? "STANDS (roster live)" : "SHORT (fail-closed — antigen inert)"}`);
      // THE PHASE COMES BEFORE THE FRAGILITY. A seed has no quorum to be fragile about, and a reader
      // who meets "quorum: STANDS" without it mistakes three faces of one operator for three hands.
      const phase = nexusPhase({ ownSeats, foreignSeats: foreign });
      console.log(`  ${phase.isNexus ? "phase:     " : "⚠ phase:   "} ${phase.reading}`);
      const standing = rosterStanding({ seated: roster.keys.length, threshold: roster.threshold });
      // A FRAGILE ROSTER EARNS THE LINE; a sound one earns silence. The cure is only available before
      // the loss, so it prints while it is still worth something.
      if (standing.fragile) {
        console.log(`  ⚠ survives:  ${standing.reading}`);
      } else if (standing.seated) {
        console.log(`  survives:   ${standing.tolerance} seat(s) going dark`);
      }
      console.log(`  posture:    ${federationPostureFromDoc(doc)} (cross-Nexus federation — default private)`);
      printCarried();
    },
  });
  return 0;
}

// ── THE TWO-FOUNDER ACT — `seal cofound open|join|seal` ─────────────────────────────────────────────
//
// Two founders, each from their own vault, seat one key each in a FRESH joint genesis at two of two, and each hearth
// holds one cadence key in the cadence inception the genesis cites. Files are the only courier: the offer (A → B),
// the join (B → A) and the inception (A → B). Each person types the other seat's fingerprint as heard before their
// own seat signs; every signature and every key stays behind the custody door (`cofound.*`). Neither seed moves:
// the joint charter files under its own AID beside it.

const COFOUND_USAGE = "usage: lares nexus seal cofound <open --release <manifest> --out <offer> | join <offer> --out <join> | seal <join|inception> [--out <inception>]>";
const DEFAULT_CHARTER_LAW = "lar:///ha.ka.ba/lararium/mesh/kahu#/seed-and-nexus";

/** A founding step on the custody door; the ceremony's own refusal reads as a usage refusal here. */
async function cofoundStep<T>(act: "cofound.open" | "cofound.join" | "cofound.seal" | "cofound.accept", args: Record<string, unknown>): Promise<T> {
  try { return await sealedAct<T>(act, args); }
  catch (err) {
    if (err instanceof SealedActRefused && err.reason === "act-refused") throw new UsageError(err.message);
    throw err;
  }
}

/** Parse one founding file a person carried. */
function readFoundingFile(path: string | undefined, what: string): Record<string, unknown> {
  if (!path) throw new UsageError(`${what} file needed — ${COFOUND_USAGE}`);
  let parsed: unknown;
  try { parsed = JSON.parse(readFileSync(path, "utf8")); }
  catch { throw new UsageError(`cannot read ${path} as a founding file`); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new UsageError(`${path} holds no founding file`);
  return parsed as Record<string, unknown>;
}

/** Write one founding file the other founder carries; it holds public material alone. */
function writeFoundingFile(path: string | undefined, file: unknown): string {
  if (!path) throw new UsageError(`--out <file> names where the file for the other founder lands — ${COFOUND_USAGE}`);
  atomicWriteFileSync(path, `${JSON.stringify(file, null, 2)}\n`, `${path}.writing`);
  return path;
}

/**
 * The release a founding offer names, read off the house's release manifest record (`tools/release-manifest.mjs`):
 * the image digest, and the genesis seed, engine and grammar addresses. The seed's sha-256 digest spells as a raw
 * CIDv1, the encoding the offer reads every address in (house reading: the same digest, one spelling).
 */
function readReleaseAddresses(path: string | undefined): ReleaseManifestAddresses {
  if (!path) throw new UsageError("--release <manifest> names the release manifest record the Nexus adopts (tools/release-manifest.mjs emit)");
  let m: Record<string, any>;
  try { m = JSON.parse(readFileSync(path, "utf8")) as Record<string, any>; }
  catch { throw new UsageError(`cannot read ${path} as a release manifest`); }
  const seed = m?.["genesis"]?.["seedCid"];
  if (m?.["format"] !== "lararium-release-manifest/v1" || typeof seed !== "string" || !/^[0-9a-f]{64}$/.test(seed)) {
    throw new UsageError(`${path} reads as no release manifest record (lararium-release-manifest/v1)`);
  }
  return { image: String(m["image"]?.["digest"] ?? ""), genesis: cidV1Sha256FromHex(seed), engine: String(m["engine"]?.["cid"] ?? ""), grammar: String(m["grammar"]?.["cid"] ?? "") };
}

/** The face whose seat stands: `--face <i>`, else the one face standing open; several and none named refuse by name. */
async function foundingFace(args: ParsedArgs): Promise<number> {
  try { return await actingFace(args); }
  catch (err) {
    if (err instanceof FaceOptionMalformed || err instanceof SealedActRefused) throw new UsageError(err.message);
    throw err;
  }
}

/** A fingerprint typed as heard: `--heard <fp>`, else asked on the terminal. */
async function heardFingerprint(args: ParsedArgs, whose: string): Promise<string> {
  const flagged = args.options["heard"];
  if (flagged !== undefined) return flagged;
  if (!canPromptSecret()) throw new UsageError(`type ${whose} seat fingerprint as you heard it: --heard <fingerprint>, or run on a terminal`);
  return (await promptLine(`${whose} seat fingerprint, as you heard it: `)).trim();
}

/** Mint this chair's cold next key as a card, print it, and read it back before anything moves. */
async function cofoundCard(args: ParsedArgs, label: string): Promise<{ readonly digest: string; readonly printed: Array<Record<string, string>> }> {
  const cold = await mintColdKey();
  const card: ColdCard = { chair: label, seed: cold.seed, digest: cold.digest };
  const printed = await readBack(args, [card], 1, "");
  return { digest: cold.digest, printed };
}

async function sealCofoundVerb(args: ParsedArgs): Promise<number> {
  const step = args.positional[2];
  switch (step) {
    case "open": return await cofoundOpenVerb(args);
    case "join": return await cofoundJoinVerb(args);
    case "seal": return await cofoundSealVerb(args);
    default: throw new UsageError(step ? `unknown cofound step "${step}" — ${COFOUND_USAGE}` : COFOUND_USAGE);
  }
}

async function cofoundOpenVerb(args: ParsedArgs): Promise<number> {
  const manifest = readReleaseAddresses(args.options["release"]);
  const charterLaw = args.options["charter-law"] ?? DEFAULT_CHARTER_LAW;
  const out = args.options["out"];
  if (!out) throw new UsageError(`--out <file> names where the offer lands — ${COFOUND_USAGE}`);
  const face = await foundingFace(args);
  const { digest, printed } = await cofoundCard(args, "your seat in the joint Nexus");
  const { offer, fingerprint } = await cofoundStep<{ offer: CofoundOffer; fingerprint: string }>("cofound.open", { face, next: digest, charterLaw, manifest });
  const path = writeFoundingFile(out, offer);
  emit(args, {
    ok: true,
    data: { path, offerFingerprint: fingerprint, seat: offer.seat, seatFingerprint: seatFingerprint(offer.seat), cadence: offer.cadence.key, cards: printed },
    human: () => {
      console.log(`cofound offer → ${path}`);
      console.log(`  offer fingerprint: ${fingerprintGroups(fingerprint)}`);
      console.log(`  your seat:         ${seatFingerprint(offer.seat)}   ← read this aloud to the other founder`);
      console.log(`  your hearth's cadence key: ${offer.cadence.key}`);
      console.log("  carry the offer file to the other founder; they answer with `lares nexus seal cofound join`.");
    },
  });
  return 0;
}

async function cofoundJoinVerb(args: ParsedArgs): Promise<number> {
  const offerFile = readFoundingFile(args.positional[3], "the offer");
  const offer = readCofoundOffer(offerFile);
  if (!offer) throw new UsageError(`${args.positional[3]} reads as no cofound offer`);
  const out = args.options["out"];
  if (!out) throw new UsageError(`--out <file> names where the join lands — ${COFOUND_USAGE}`);
  if (!wantsQuiet(args)) {
    console.error(`  offer fingerprint: ${fingerprintGroups(offerFingerprint(offer))}`);
    console.error(`  charter law:       ${offer.charterLaw}`);
    console.error(`  release:           image ${offer.manifest.image} genesis ${offer.manifest.genesis} engine ${offer.manifest.engine} grammar ${offer.manifest.grammar}`);
  }
  const heard = await heardFingerprint(args, "the offering founder's");
  const face = await foundingFace(args);
  const { digest, printed } = await cofoundCard(args, "your seat in the joint Nexus");
  const { join } = await cofoundStep<{ join: CofoundJoin }>("cofound.join", { face, offer: offerFile, heard, next: digest });
  const path = writeFoundingFile(out, join);
  const image = composeCharterInception(offer, { seat: join.seat, next: join.next, cadence: join.cadence });
  const lines = cofoundReadBack(offer, image);
  emit(args, {
    ok: true,
    data: { path, offerFingerprint: offerFingerprint(offer), seat: join.seat, seatFingerprint: seatFingerprint(join.seat), aid: inceptionAid(image), readBack: lines, cards: printed },
    human: () => {
      console.log(`cofound join → ${path}`);
      for (const line of lines) console.log(`  ${line}`);
      console.log(`  your seat:  ${seatFingerprint(join.seat)}   ← read this aloud to the offering founder`);
      console.log("  carry the join file back; they seal with `lares nexus seal cofound seal <join>`.");
    },
  });
  return 0;
}

async function cofoundSealVerb(args: ParsedArgs): Promise<number> {
  const file = readFoundingFile(args.positional[3], "the join or inception");
  if (file["kind"] === CHARTER_INCEPTION_KIND) return await cofoundAcceptVerb(args, file);
  if (file["kind"] !== COFOUND_JOIN_KIND) throw new UsageError(`${args.positional[3]} reads as neither a cofound join nor a sealed inception`);
  const read = readCofoundJoin(file);
  if (!read) throw new UsageError(`${args.positional[3]} reads as no cofound join whose signatures hold`);
  const out = args.options["out"];
  if (!out) throw new UsageError(`--out <file> names where the inception lands — ${COFOUND_USAGE}`);
  if (!wantsQuiet(args)) for (const line of cofoundReadBack(read.join.offer, read.image)) console.error(`  ${line}`);
  const heard = await heardFingerprint(args, "the joining founder's");
  const sealed = await cofoundStep<{ inception: CofoundInception; charter: { aid: string; path: string; outcome: string } }>("cofound.seal", { join: file, heard });
  const path = writeFoundingFile(out, sealed.inception);
  const refold = await pokeSealHomeRefold();
  emit(args, {
    ok: true,
    data: { path, aid: sealed.charter.aid, charter: sealed.charter.path, outcome: sealed.charter.outcome, refold },
    human: () => {
      console.log(`cofound sealed → ${path}`);
      console.log(`  nexus:   ${sealed.charter.aid}`);
      console.log(`  charter: ${sealed.charter.path} (${sealed.charter.outcome}); your household seed stands untouched`);
      console.log("  carry the inception file back; the joining founder files it with `lares nexus seal cofound seal <inception>`.");
    },
  });
  return 0;
}

async function cofoundAcceptVerb(args: ParsedArgs, file: Record<string, unknown>): Promise<number> {
  if (!readCofoundInception(file)) throw new UsageError(`${args.positional[3]} reads as no sealed inception`);
  const accepted = await cofoundStep<{ charter: { aid: string; path: string; outcome: string } }>("cofound.accept", { inception: file });
  const refold = await pokeSealHomeRefold();
  emit(args, {
    ok: true,
    data: { aid: accepted.charter.aid, charter: accepted.charter.path, outcome: accepted.charter.outcome, refold },
    human: () => {
      console.log(`cofound accepted — nexus ${accepted.charter.aid}`);
      console.log(`  charter: ${accepted.charter.path} (${accepted.charter.outcome}); your household seed stands untouched`);
    },
  });
  return 0;
}

// ── THE ROLL CIRCLE — `seal roll open|join|sign|file` ───────────────────────────────────────────────
//
// A joint Nexus rolls across its vaults: each holder contributes its own chair (the revealed cold card, or none for a
// chair the head never committed), a fresh successor card mints and reads back, each vault signs the one image, and
// each files the rolled charter. The circle file is the only courier; every key and signature stays behind the
// custody door (`roll-circle.*`).

const ROLL_USAGE = "usage: lares nexus seal roll <open --nexus <aid> --threshold <n> --out <circle> | join <circle> --out <circle> | sign <circle> --out <circle> [--heard-threshold <n>] [--heard <fp,fp,…>] | file <circle> | abandon --nexus <aid>> [--face <i>] [--added]";

type RollStepAnswer = { circle: RollCircle; verdict: RollCircleVerdict; signed: readonly string[]; why?: string };

/** A circle step on the custody door; the ceremony's own refusal reads as a usage refusal here. */
async function rollStep<T>(act: "roll-circle.open" | "roll-circle.join" | "roll-circle.sign" | "roll-circle.file" | "roll-circle.abandon", args: Record<string, unknown>): Promise<T> {
  try { return await sealedAct<T>(act, args); }
  catch (err) {
    if (err instanceof SealedActRefused && err.reason === "act-refused") throw new UsageError(err.message);
    throw err;
  }
}

async function sealRollVerb(args: ParsedArgs): Promise<number> {
  const step = args.positional[2];
  switch (step) {
    case "open": return await rollContributeVerb(args, "open");
    case "join": return await rollContributeVerb(args, "join");
    case "sign": return await rollSignVerb(args);
    case "file": return await rollFileVerb(args);
    case "abandon": return await rollAbandonVerb(args);
    default: throw new UsageError(step ? `unknown roll step "${step}" — ${ROLL_USAGE}` : ROLL_USAGE);
  }
}

/** A carried circle file, read at its exact shape. */
function readCircleFile(path: string | undefined): { readonly file: Record<string, unknown>; readonly circle: RollCircle } {
  const file = readFoundingFile(path, "the circle");
  const circle = file["kind"] === "nexus-roll-circle" ? readRollCircle(file) : null;
  if (!circle) throw new UsageError(`${path} reads as no roll circle`);
  return { file, circle };
}

/** `--out <circle>` for a step that grows a carried circle: named, and never the input file itself. */
function rollOut(args: ParsedArgs, input: string | undefined): string {
  const out = args.options["out"];
  if (!out) throw new UsageError(`--out <circle> names where the circle lands — ${ROLL_USAGE}`);
  if (input !== undefined && resolve(out) === resolve(input)) throw new UsageError(`--out names the input file (${out}); write the grown circle to a new file`);
  return out;
}

/** This chair's contribution: the revealed cold card (exactly one) unless the chair is added. */
async function rollContribution(args: ParsedArgs): Promise<{ readonly face: number; readonly cards: string[] | undefined }> {
  const added = args.flags["added"] === true;
  if (added && args.options["cold-key"] !== undefined) throw new UsageError("--added names a chair the head never committed, so it reveals no card: drop --cold-key");
  const face = await foundingFace(args);
  if (added) return { face, cards: undefined };
  const seeds = await gatherCards(args, 1);
  try {
    if (seeds.length !== 1) throw new UsageError("a roll reveals exactly one chair's cold-key card per contribution (or --added for a chair the head never committed)");
    return { face, cards: [hex(seeds[0]!)] };
  } finally { for (const seed of seeds) seed.fill(0); }
}

async function rollContributeVerb(args: ParsedArgs, which: "open" | "join"): Promise<number> {
  let input: string | undefined;
  let nexusAid: string | undefined;
  let threshold = 0;
  if (which === "open") {
    nexusAid = args.options["nexus"];
    if (!nexusAid) throw new UsageError(`--nexus <aid> names the joint Nexus to roll — ${ROLL_USAGE}`);
    const raw = args.options["threshold"];
    threshold = Number(raw);
    if (raw === undefined || !Number.isSafeInteger(threshold) || threshold < 1) throw new UsageError(`--threshold <n> names the new rule, a count of seats of one or more — ${ROLL_USAGE}`);
  } else {
    input = args.positional[3];
    readCircleFile(input);
  }
  const out = rollOut(args, input);
  // A ROLL WAITS ON ITS PRIOR ANCHOR (operator ruling 2026-10-15): a circle opens over a head whose own roll stands
  // anchored on this vault's board, before any card reads. A join steps from the circle already open.
  if (which === "open") {
    try { await storeVerb("nexus-roll-prior-anchor", { aid: nexusAid }, NexusContractError); }
    catch (err) { if (err instanceof NexusContractError) throw new UsageError(err.message); throw err; }
  }
  const { face, cards } = await rollContribution(args);
  const { digest, printed } = await cofoundCard(args, "your chair in the rolled Nexus");
  const base = cards ? { face, cards, next: digest } : { face, next: digest };
  const step = which === "open"
    ? await rollStep<RollStepAnswer>("roll-circle.open", { aid: nexusAid, threshold, ...base })
    : await rollStep<RollStepAnswer>("roll-circle.join", { circle: readCircleFile(input).file, ...base });
  const path = writeFoundingFile(out, step.circle);
  emit(args, {
    ok: true,
    data: { path, aid: step.circle.aid, verdict: step.verdict, signed: step.signed, chairs: step.circle.chairs.length, threshold: step.circle.threshold, ...(step.why ? { why: step.why } : {}), cards: printed },
    human: () => {
      console.log(`roll circle ${which} → ${path}`);
      console.log(`  nexus:   ${step.circle.aid}`);
      console.log(`  chairs:  ${step.circle.chairs.length} contributed, rule ${step.circle.threshold}; verdict ${step.verdict}${step.why ? ` (${step.why})` : ""}`);
      console.log("  carry the circle file to the next holder: `lares nexus seal roll join <circle>`, or, once every chair has joined, `lares nexus seal roll sign <circle>`.");
    },
  });
  return 0;
}

/**
 * What the person heard from the other holders before any hand signs: the rule, and every other chair's seat
 * fingerprint. A signature consents to the whole image, so a chair a courier slipped in, or a rule it lowered,
 * refuses behind the door. The flags stand in for the terminal; on a terminal the rite asks.
 */
async function heardImage(args: ParsedArgs, circle: RollCircle): Promise<{ readonly heardThreshold: number; readonly heard: string[] }> {
  if (!wantsQuiet(args)) {
    console.error(`  the circle seats ${circle.chairs.length} chair(s) at rule ${circle.threshold}:`);
    for (const c of circle.chairs) console.error(`    ${seatFingerprint(c.seat)}`);
  }
  const rawRule = args.options["heard-threshold"];
  const flaggedSeats = args.options["heard"];
  if ((rawRule === undefined || flaggedSeats === undefined) && !canPromptSecret()) {
    throw new UsageError("type the rule and every other chair's seat fingerprint as you heard them from their holders: --heard-threshold <n> --heard <fp,fp,…>, or run on a terminal");
  }
  const ruleText = rawRule ?? (await promptLine("the rule (seats that must sign), as you heard it: ")).trim();
  const heardThreshold = Number(ruleText);
  if (!Number.isSafeInteger(heardThreshold) || heardThreshold < 1) throw new UsageError("the rule as heard reads as a count of seats of one or more");
  let heard: string[];
  if (flaggedSeats !== undefined) heard = flaggedSeats.split(",").map((h) => h.trim()).filter((h) => h.length > 0);
  else {
    heard = [];
    for (;;) {
      const line = (await promptLine("another chair's seat fingerprint, as heard (blank when done): ")).trim();
      if (line.length === 0) break;
      heard.push(line);
    }
  }
  return { heardThreshold, heard };
}

async function rollSignVerb(args: ParsedArgs): Promise<number> {
  const input = args.positional[3];
  const { file, circle } = readCircleFile(input);
  const out = rollOut(args, input);
  const step = await rollStep<RollStepAnswer>("roll-circle.sign", { circle: file, ...(await heardImage(args, circle)) });
  const path = writeFoundingFile(out, step.circle);
  emit(args, {
    ok: true,
    data: { path, aid: step.circle.aid, verdict: step.verdict, signed: step.signed, threshold: step.circle.threshold, ...(step.why ? { why: step.why } : {}) },
    human: () => {
      console.log(`roll circle signed → ${path}`);
      console.log(`  verdict: ${step.verdict}${step.why ? ` (${step.why})` : ""}; ${step.signed.length} seat${step.signed.length === 1 ? "" : "s"} signed, rule ${step.circle.threshold}`);
      console.log(step.verdict === "complete"
        ? "  the circle is complete: carry it to every holder to sign what remains, and each files it with `lares nexus seal roll file <circle>`."
        : "  carry the circle on to the next holder to sign; once it reads complete, each files it with `lares nexus seal roll file <circle>`.");
    },
  });
  return 0;
}

async function rollFileVerb(args: ParsedArgs): Promise<number> {
  const { file } = readCircleFile(args.positional[3]);
  const filed = await rollStep<{ aid: string; sealEpochCid: string; outcome: string; path: string; retired: readonly string[] }>("roll-circle.file", { circle: file });
  const refold = await pokeSealHomeRefold();
  emit(args, {
    ok: true,
    data: { aid: filed.aid, head: filed.sealEpochCid, outcome: filed.outcome, charter: filed.path, retired: filed.retired, refold },
    human: () => {
      console.log(`roll filed — nexus ${filed.aid}`);
      console.log(`  new head: ${filed.sealEpochCid} (${filed.outcome}); ${filed.retired.length} closed seat${filed.retired.length === 1 ? "" : "s"} retired`);
      console.log(`  charter:  ${filed.path}`);
      console.log("  the roll anchor crosses next: `nexus-roll-anchor-open` writes the partial the other vault carries on.");
    },
  });
  return 0;
}

async function rollAbandonVerb(args: ParsedArgs): Promise<number> {
  const aid = args.options["nexus"];
  if (!aid) throw new UsageError(`--nexus <aid> names the joint Nexus whose open circle this vault drops — ${ROLL_USAGE}`);
  const r = await rollStep<{ aid: string; abandoned: boolean; retired: readonly string[] }>("roll-circle.abandon", { aid });
  emit(args, {
    ok: true,
    data: { aid: r.aid, abandoned: r.abandoned, retired: r.retired },
    human: () => console.log(r.abandoned
      ? `roll circle abandoned — nexus ${r.aid}; ${r.retired.length} contributed seat${r.retired.length === 1 ? "" : "s"} retired. A new circle may open from the head.`
      : `no roll circle stands open here for nexus ${r.aid}; nothing moved.`),
  });
  return 0;
}

/** Whether the run answers in JSON alone: then the read-back lines ride the answer, not the terminal. */
function wantsQuiet(args: ParsedArgs): boolean {
  return args.flags["json"] === true;
}
