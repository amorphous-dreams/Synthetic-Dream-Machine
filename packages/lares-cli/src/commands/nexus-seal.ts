/**
 * nexus-seal — the CHARTER SEAL door: the founding kahu quorum's seats, its PRE-ROTATED hash-linked epoch
 * chain, the reserve that custodies the next key-set, and the growth rite that records a crossing.
 *
 * ── WHY THE CHAIN IS PRE-ROTATED ────────────────────────────────────────────────────────────────
 * Every epoch commits to the digest of the key-set that will REPLACE it, before that key-set is ever
 * used (TUF ≈ KERI). A rotate reveals the pre-committed set and must match, so no seat moves without
 * notice: a kahu steps down by no longer standing, a new one takes a chair by standing, and either
 * way the reveal is checked against a commitment made an epoch earlier. A genesis seated with no
 * commitment is a chain that can never rotate, which is why seating refuses to arm itself blind.
 *
 * ── WHAT LIVES HERE AND WHY IT IS ONE DOOR ──────────────────────────────────────────────────────
 * The roster, the chain, the reserve and the growth rite are not four subjects that happen to share a
 * file: each one reads or writes the SAME charter state under `larSealHome()`, and the invariants
 * that hold them together (a commitment precedes its reveal; a quorum is a majority of chairs that
 * STOOD; a crossing binds one epoch to the next) are stated across them rather than inside any one.
 * Splitting them further would put an invariant on one side of an import and its enforcement on the
 * other.
 *
 * ── THE QUORUM RITE SITS HERE, NOT WITH THE RITES ───────────────────────────────────────────────
 * `runQuorumRite` is registered in the parent's `NEXUS_RITES` table but composes three functions that
 * live here — reserve, seat, show — and nothing else. Leaving it in the parent would force this
 * module to export its seat/show/reserve internals just to be called back into, widening the surface
 * from two symbols to five and pointing the dependency both ways. It travels with the code it drives,
 * and the parent imports one more name.
 *
 * `UsageError` travels for the same reason: every one of its throw sites is in this file, and leaving
 * the class behind would have made this module import from its own parent — the one shape that turns
 * a clean parent-to-child split into a cycle.
 */
import {
  readNexusDoc, parseNexusDoc, nexusCharterStands, writeNexusSeal, writeNexusKahu, nexusCharterDocPath,
  importCarriedCharter, CarriedCharterError,
  sealReserveMineShare, writeCharterReserveState, readCharterReserveState, atomicWriteFileSync,
  NexusContractError, type NexusRollAnchorResult,
} from "@lararium/node";
import {
  emptyFoundingCharterDoc, foundingRoster, foundingQuorumSeated, sealLineageHead, charterSealState,
  personasStandingForSeat, majorityThreshold, genesisCharterEpoch, rotateSealEpoch, sealKeySetHash,
  defaultCryptoProvider, federationPostureFromDoc,
  GUARDIAN_SLOT_CUSTODIAN, assembleQuorum, reconstructFromQuorum,
  type NexusDoc, type NexusCharterKahu, type SealEpoch, type KahuQuorumSeats,
  type QuorumSignature, type CharterSealState, seatFingerprint,
} from "@lararium/mesh";
import {
  generateReserveSeed, deriveReserveKeySet, reserveNextKeyCommit, splitReserveSeed,
  reserveShareFromCard, RESERVE_THRESHOLD, RESERVE_KAHU_COUNT, type ReserveCard,
} from "../seal-reserve.js";
import { rosterStanding } from "../roster-standing.js";
import { nexusPhase } from "../nexus-phase.js";
import { sealImportVerdict, foreignSeats } from "../seal-import.js";
import {
  reserveTransitionCidOf, verifyReserveTransition,
  reserveTransitionBytes,
  type ReserveTransition, type ReserveTransitionCore, type TransitionWitness,
} from "../reserve-transition.js";
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { larSealHome } from "../env.js";
import { storeVerb, pokeSealHomeRefold } from "../store-door.js";
import { makeFleetDeclarationStore, fleetPeerDid } from "../daemon-persona-store.js";
import { emit, exitFor, refuseUsage } from "../render.js";
import type { ParsedArgs } from "../parse-args.js";
import { stampCarrier } from "@lararium/memetic-frame";
import { sealedAct } from "../sealed-act-door.js";
import { readPersonaRoots, sealedDeclarationStore, sealHand } from "../sealed-rows.js";

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
             "Seat the epoch once a quorum stands: `lares nexus seal seat --next-key-commit <digest>`";
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
  "usage: lares nexus seal <seat | reserve | rotate | commit | show | export | import>",
  "",
  "  seat    form the roster from the personas that STOOD for a chair, then",
  "          establish the GENESIS epoch over their verifying keys:",
  "          --next-key-commit <digest>   the pre-rotation commitment",
  "          [--threshold <k>]            the quorum rule (default: majority of those that stood)",
  "  rotate  reveal the pre-committed next key-set (now in the vault) + advance the chain.",
  "          The roster becomes exactly what STANDS — the succession door: a kahu steps down by",
  "          no longer standing, a new one takes a chair by standing. Either way the reveal must",
  "          match the prior epoch's pre-commitment, so no seat moves without notice.",
  "          --next-key-commit <digest-of-the-FOLLOWING-key-set>",
  "          [--threshold <k>]  the quorum rule for the new roster (default: majority)",
  "  commit  compute a key-set commitment digest:  --keys <k1,k2,...> --threshold <k>",
  "  show    read the kahu quorum's seats + chain head + quorum verdict + the carried set",
  "  import <file>          land a charter at the primary path — only where none stands, or the same one",
  "  import --carry <file>  land a PARTNER's charter beside yours, under its Nexus AID; a re-import for",
  "                         that AID lands only when its seal lineage extends the held head",
  "  reserve [refresh|show|rehearse]            custody the pre-rotation's NEXT key-set:",
  "          reserve         forge one reserve seed, derive the 3 next keys HARDENED, print the",
  "                          --next-key-commit + the 3 recovery cards   [--guardian-a --guardian-b]",
  "                          no verb rolls the charter from that seed",
  "          reserve refresh re-seed + re-derive + re-issue the cards + print a NEW commit",
  "          reserve show    the reserve state (commit present, guardians, share sealed)",
  "          reserve rehearse --card-a <code> --card-b <code> [--slot-a <slot> --slot-b <slot>] [--generation <n>]",
  "                          read two SYNTHETIC cards back under a SCRATCH root, prove the rebuilt",
  "                          key-set against the charter head, write nothing, roll nothing",
];

/**
 * The quorum rite — forge the pre-rotation, seat the kahu quorum it arms, and read the verdict.
 *
 * ── WHY IT DOES NOT MINT THE PERSONAS ───────────────────────────────────────────────────────────
 * A chair joins on a private chair label. A rite that invented three labels would make the SOURCE decide who the founding kahu are, leaving the operator to
 * confirm a legitimacy call somebody else made. So the three `persona new` acts stay outside this rite,
 * deliberately, and the seat refuses when nobody stands — which is the correct refusal, not a gap.
 *
 * ── WHAT IT ACTUALLY REMOVES ────────────────────────────────────────────────────────────────────
 * The pre-rotation digest. `reserve` forges it and `seat` requires it, and between them an operator
 * transcribes a 64-character hex by hand — the only place in the whole founding where a value crosses on
 * a clipboard. The reserve WRITES that digest into its own state, so the rite reads it back and threads
 * it. A digest copied by hand is a digest that can be copied wrong, and a wrong one seats a pre-commitment
 * no future rotate can ever satisfy.
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
  const reserved = await sealReserveProvision(rest, "provision");
  if (reserved !== 0) {
    console.error("lares nexus rite quorum: halted at `seal reserve` — nothing seated, nothing written.");
    return reserved;
  }

  // The digest crosses in memory rather than through a human. Absent state here names a reserve that
  // reported success and persisted nothing, which is worth refusing loudly rather than seating unarmed.
  const state = readCharterReserveState();
  const commit = state?.nextKeyCommit;
  if (!commit) {
    console.error("lares nexus rite quorum: the reserve wrote no next-key commit — refusing to seat unarmed.");
    console.error("  an unarmed genesis epoch cannot pre-commit its successor, so the chain could never rotate.");
    return 1;
  }

  const seated = await sealSeat({ ...rest, options: { ...rest.options, "next-key-commit": commit } });
  if (seated !== 0) {
    console.error("lares nexus rite quorum: halted at `seal seat`. The reserve stands; re-run after seating");
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
      case "commit":  return sealCommit(args);
      case "show":    return await sealShow(args);
      case "export":  return sealExport(args);
      case "import":  return await sealImport(args);
      case "reserve": return await cmdCharterReserve(args);
      case "grow":    return await sealGrow(args);
      default:
        return refuseUsage(args, "nexus seal", SEAL_USAGE, sub ? `unknown sub-verb "${sub}"` : undefined);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const code = err instanceof UsageError ? "usage" : "error";
    emit(args, { ok: false, error: { code, message: msg }, human: () => console.error(`lares nexus seal ${sub ?? ""}: ${msg}`) });
    return exitFor(code);
  }
}

/** Normalize a chair label for matching — trimmed and case-folded. */
const norm = (s: string): string => s.trim().toLowerCase();

/** normalize a commitment/key hex — trimmed, lower-cased (the digest surface stays canonical lowercase hex). */
const normHex = (s: string | undefined): string => (s ?? "").trim().toLowerCase();

/** A HEAD READS RESERVE-ARMED when its commitment names this vessel's reserve key-set. */
export function isReserveArmed(
  headNextKeyCommit: string | null | undefined,
  reserveNextKeyCommit: string | null | undefined,
): boolean {
  const headCommit = normHex(headNextKeyCommit ?? undefined);
  const reserveCommit = normHex(reserveNextKeyCommit ?? undefined);
  return headCommit.length > 0 && reserveCommit.length > 0 && headCommit === reserveCommit;
}

/** RESERVE-ARMED READINGS NAME the recovery boundary: the depth determines whether genesis can be re-seated. */
function reserveArmedReading(chainDepth: number): string {
  return `ARMED to the RESERVE key-set — no lares verb reveals it; ${chainDepth === 1 ? "re-seat remains open at genesis" : "the chain stands frozen at this head"}`;
}

function reserveArmedRotateMessage(chainDepth: number): string {
  const invariant = "the head pre-commits the reserve key-set; no lares verb carries a recovery card or a reserve key into a rotation, so this reveal cannot match.";
  return chainDepth === 1
    ? `${invariant} Re-seat with lares nexus seal commit --keys <a key-set this vault can reveal> --threshold <k>, then lares nexus seal seat --next-key-commit <digest>. A re-seat re-mints the genesis epoch, so the epoch CID moves.`
    : `${invariant} The chain stands frozen at this head.`;
}

/**
 * Seat each kahu's verifying key from the vault by its private chair label. FAIL CLOSED: no match keeps the
 * doc's existing key (never invents, never unseats). A verifying key that is not in the vault can never be
 * seated — only vault reads flow in. Returns the updated kahu + the seated verifying keys (the CURRENT
 * key-set: at genesis the founding keys, at rotate the revealed next key-set the operator provisioned).
 */
/**
 * How a roster treats a chair NOBODY stands for.
 *
 *   · "keep" (seat)   — the chair stays, unseated. Before genesis a doc may already carry chairs the operator
 *                       wrote in a prior pass, and a persona that happens to sit unavailable this minute must
 *                       not lose its seat to a re-run.
 *   · "drop" (rotate) — the chair GOES. A rotation is how a Nexus changes who holds it, so the roster becomes
 *                       exactly what stands. This is the succession door, and it needs no admin verb: the
 *                       reveal must still match the head's pre-commitment, so an operator cannot quietly drop
 *                       a kahu — they must have PRE-COMMITTED the successor key-set an epoch earlier, in the
 *                       open, under the standing quorum.
 */
type UnstoodChairs = "keep" | "drop";

/** A persona this vessel holds that stood and took a chair — the hand that signs for its seat. */
interface SeatedHand {
  readonly handleIndex:  number;
  readonly verifyingKey: string;
}

async function seatKahuFromVault(
  doc: NexusDoc, unstood: UnstoodChairs = "keep",
): Promise<{ kahu: NexusCharterKahu[]; seatedKeys: string[]; hands: SeatedHand[] }> {
  // THE ROSTER FORMS FROM WHAT STOOD, never from a list this build shipped. A persona reaches a chair by
  // carrying its private chair label with a seat claim — an independent act from any Handle —
  // vessel — and the roster reads back exactly those. A scaffold carrying names would make the SOURCE decide
  // who the founding kahu are, leaving the operator to confirm a legitimacy call somebody else made.
  //
  // The chair name reads the local private chair label; exports replace it with a fingerprint.
  const roots = await readPersonaRoots();
  const held = new Set(roots.roots.map((r) => r.handleIndex));
  // The seat claim and private chair label stay local to this node.
  const localDeclarations = sealedDeclarationStore();
  const fleetDid = await fleetPeerDid();
  const declarations = fleetDid === null
    ? localDeclarations                                                  // no vessel key = no fleet to read
    : makeFleetDeclarationStore(localDeclarations, fleetDid);
  const standing = await personasStandingForSeat(declarations);

  // A doc already carrying chairs keeps them under "keep" — a re-seat before genesis fills keys rather than
  // re-writing who sits. Under "drop" (rotation) the roster becomes exactly what stands, which is how a kahu
  // steps down. Either way, a face standing under a name no chair carries ADDS one.
  const kahu: NexusCharterKahu[] = unstood === "drop" ? [] : doc.kahu.map((k) => ({ ...k }));
  const chairAt = new Map<string, number>(kahu.map((k, i) => [norm(k.displayName), i]));
  const hands: SeatedHand[] = [];

  for (const [index, chair] of standing) {
    if (!held.has(index)) continue;             // a declaration without a held root seats nothing here
    const verifyingKey = roots.roots.find((r) => r.handleIndex === index)?.verifyingKey;
    if (!verifyingKey) continue;
    hands.push({ handleIndex: index, verifyingKey });
    const at = chairAt.get(norm(chair));
    if (at === undefined) {
      chairAt.set(norm(chair), kahu.length);
      kahu.push({ displayName: chair, verifyingKey });
    } else {
      kahu[at] = { displayName: kahu[at]!.displayName, verifyingKey };
    }
  }
  const seatedKeys = kahu.map((k) => k.verifyingKey).filter((v): v is string => typeof v === "string" && v.length > 0);
  return { kahu, seatedKeys, hands };
}

/**
 * The quorum rule this seat writes: the operator's `--threshold`, else the doc's own if it carries a live one,
 * else MAJORITY over the roster that stood. A threshold past the roster size would seat a Nexus no quorum can
 * ever satisfy, so it refuses rather than writing an unreachable rule.
 */
function resolveSeatThreshold(args: ParsedArgs, doc: NexusDoc, rosterSize: number): number {
  const raw = args.options["threshold"];
  if (raw !== undefined) {
    const t = Number(raw);
    if (!Number.isInteger(t) || t < 1) throw new UsageError(`--threshold expects a whole number ≥ 1, got "${raw}"`);
    if (t > rosterSize) {
      throw new UsageError(`--threshold ${t} sits past the ${rosterSize} chair${rosterSize === 1 ? "" : "s"} that stood — no quorum could ever reach it`);
    }
    return t;
  }
  if (Number.isInteger(doc.threshold) && doc.threshold >= 1 && doc.threshold <= rosterSize) return doc.threshold;
  return majorityThreshold(rosterSize);
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

  // A SEAT NEVER BUILDS ON A CHARTER THIS VESSEL DID NOT FOUND. A joining operator holds her partner's
  // charter in her own seal home — she cannot consent to one she has never seen — and seats her own
  // there too. Seating onto his MERGES the quorums: measured, six seated kahu at threshold two, so the
  // partner holds quorum over her Nexus using his own keys with no further act by her.
  const roots = await readPersonaRoots();
  const heldKeys = roots.roots.map((r) => r.verifyingKey);
  const foreign = foreignSeats(doc.kahu ?? [], heldKeys);
  if (!foreign.ok) throw new UsageError(foreign.why);

  const { kahu, seatedKeys } = await seatKahuFromVault(doc);
  const nextKeyCommit = normHex(args.options["next-key-commit"]);
  if (kahu.length === 0) {
    throw new UsageError(
      "no persona stands for a chair — stand one first:\n" +
      "  lares persona new <index> --name '<label>' --seat [--chair '<chair label>']",
    );
  }

  // A seed turns to a Nexus when a second operator seats their own key in a fresh charter. A contract moves no phase.

  // THE THRESHOLD, and where it comes from. A doc that already carries one keeps it; otherwise the seat
  // derives MAJORITY over the roster that stood. Neither a constant in the source nor a silent guess: majority
  // refuses a single hand without handing any one kahu a veto, and `--threshold` takes the operator's own call
  // for a realm that wants a different rule.
  const threshold = resolveSeatThreshold(args, doc, kahu.length);

  // Establish the genesis epoch only once a quorum is seatable — below threshold, no epoch roots (inert).
  let sealLineage: SealEpoch[] | undefined;
  let sealEpochCid: string | null = null;
  if (seatedKeys.length >= threshold) {
    const genesis = genesisCharterEpoch(seatedKeys, threshold, nextKeyCommit);
    sealLineage = [genesis];
    sealEpochCid = genesis.epochCid;
  }

  const next: NexusDoc = sealLineage
    ? { kind: doc.kind, threshold, sealEpochCid, sealLineage, kahu }
    : { kind: doc.kind, threshold, sealEpochCid, kahu };
  // A seat moves TWO joints — the roster it seats and the genesis epoch it establishes — so it writes both
  // narrowly rather than re-emitting the practice dials it never touched.
  writeNexusKahu(sealHome, { threshold: next.threshold, kahu: next.kahu }, next);
  const path = writeNexusSeal(sealHome,
    sealLineage ? { kind: next.kind, sealEpochCid, sealLineage } : { kind: next.kind, sealEpochCid }, next);
  const quorum = foundingQuorumSeated(next);
  const armed = Boolean(sealLineage) && nextKeyCommit.length > 0;
  const reserveState = readCharterReserveState();
  const reserveArmed = Boolean(sealLineage) && isReserveArmed(nextKeyCommit, reserveState?.nextKeyCommit);

  emit(args, {
    ok: true,
    data: {
      path, threshold: next.threshold, sealEpochCid, quorumSeated: quorum,
      rotationArmed: armed, reserveArmed, nextKeyCommit: nextKeyCommit || null,
      kahu: kahu.map((k) => ({ displayName: k.displayName, seated: Boolean(k.verifyingKey), verifyingKey: k.verifyingKey,
        fingerprint: k.verifyingKey ? seatFingerprint(k.verifyingKey) : null })),
    },
    human: () => {
      // The headline names what STOOD. It once read "(genesis epoch)" unconditionally, three lines
      // above `epoch0: (unestablished)` — a confident claim over an honest correction, which is the
      // order an operator skims in reverse.
      console.log(sealLineage
        ? `nexus seal seated — GENESIS EPOCH established → ${path}`
        : `nexus seal seated — roster written, NO epoch (quorum short) → ${path}`);
      for (const k of kahu) {
        console.log(`  ${k.verifyingKey ? "seated  " : "UNSEATED"} ${k.displayName}${k.verifyingKey ? `  ${seatFingerprint(k.verifyingKey)}` : ""}`);
      }
      console.log(`  threshold:  ${next.threshold} of ${kahu.length}`);
      // WHAT IT SURVIVES, AT THE MOMENT IT IS WRITTEN. A seat NAMES a fragile quorum and refuses none —
      // the keeper ladder starts at one, so a floor here would forbid its own first step. An operator
      // who has lost a kahu must be able to re-seat, and that is the case most likely to land fragile,
      // so the reading rides at the moment of writing as well as at `show`.
      const seatStanding = rosterStanding({ seated: seatedKeys.length, threshold: next.threshold });
      if (seatStanding.fragile) console.log(`  ⚠ survives:  ${seatStanding.reading}`);
      console.log(`  epoch0:     ${sealEpochCid ?? "(unestablished — seat a quorum first)"}`);
      if (quorum) {
        console.log(`  quorum STANDS — the antigen now reads a live roster rooted on the genesis epoch.`);
        console.log(`  rotation:   ${reserveArmed ? reserveArmedReading(1) : armed ? "ARMED (next key-set pre-committed)" : "UNARMED — supply --next-key-commit <digest> to arm pre-rotation"}`);
      } else {
        const missing = kahu.filter((k) => !k.verifyingKey).map((k) => `"${k.displayName}"`);
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

const TRANSITION_PENDING_FILE = "transition-pending.json";
const TRANSITIONS_FILE        = "transitions.json";
const GROWTH_RITE_URI         = "lar:///ha.ka.ba/lararium/mesh/founding-runbook#/the-growth-rite";

interface PendingTransition {
  fromEpochCid:  string;
  oldKeys:       string[];
  oldThreshold:  number;
  toEpochCid?:   string;
  newKeys?:      string[];
  newThreshold?: number;
  rite:          string;
  oldSigs:       QuorumSignature[];
  newSigs:       QuorumSignature[];
  witnesses:     TransitionWitness[];
}

function pendingPath(): string { return join(larSealHome(), TRANSITION_PENDING_FILE); }
function transitionsPath(): string { return join(larSealHome(), TRANSITIONS_FILE); }

function readPending(): PendingTransition | null {
  if (!existsSync(pendingPath())) return null;
  try { return JSON.parse(readFileSync(pendingPath(), "utf8")) as PendingTransition; } catch { return null; }
}
function writePending(p: PendingTransition): void {
  mkdirSync(larSealHome(), { recursive: true });
  writeFileSync(pendingPath(), JSON.stringify(p, null, 2));
}
function boundCoreOf(p: PendingTransition): ReserveTransitionCore | null {
  if (!p.toEpochCid || !p.newKeys || p.newThreshold === undefined) return null;
  return {
    fromEpochCid:  p.fromEpochCid,
    toEpochCid:    p.toEpochCid,
    oldKeySetHash: sealKeySetHash(p.oldKeys, p.oldThreshold),
    newKeySetHash: sealKeySetHash(p.newKeys, p.newThreshold),
    rite:          p.rite,
  };
}
function seatedKeysOf(doc: { kahu: readonly { verifyingKey: string | null }[] }): string[] {
  return doc.kahu.map((k) => k.verifyingKey).filter((k): k is string => k !== null);
}

async function sealGrow(args: ParsedArgs): Promise<number> {
  const step = args.positional[2];
  const sealHome = larSealHome();

  switch (step) {
    case "open": {
      const { doc, head } = sealedCharterOrRefuse(sealHome, "open a crossing from");
      if (readPending()) throw new UsageError("a crossing already stands open — seal it or remove transition-pending.json deliberately");
      writePending({
        fromEpochCid: head.epochCid,
        oldKeys: seatedKeysOf(doc), oldThreshold: doc.threshold,
        rite: GROWTH_RITE_URI, oldSigs: [], newSigs: [], witnesses: [],
      });
      emit(args, { ok: true, data: { open: { fromEpochCid: head.epochCid, oldHands: seatedKeysOf(doc).length } },
        human: () => console.log(`crossing OPEN from epoch ${head.epochCid.slice(0, 16)}… — now pre-commit the successor, rotate, then \`grow bind\`.`) });
      return 0;
    }
    case "bind": {
      const p = readPending();
      if (!p) throw new UsageError("no crossing stands open — `grow open` before the rotate");
      const { doc, head } = sealedCharterOrRefuse(sealHome, "bind a crossing to");
      if (head.epochCid === p.fromEpochCid) throw new UsageError("the chain has not moved — rotate the succession in before binding the far side");
      if (p.toEpochCid) throw new UsageError("the crossing is already bound — sign, witness, and seal it");
      writePending({ ...p, toEpochCid: head.epochCid, newKeys: seatedKeysOf(doc), newThreshold: doc.threshold });
      emit(args, { ok: true, data: { bound: { toEpochCid: head.epochCid } },
        human: () => console.log(`crossing BOUND to epoch ${head.epochCid.slice(0, 16)}… — the byte-image is closed; gather signatures and a witness.`) });
      return 0;
    }
    case "sign": {
      const p = readPending();
      const core = p && boundCoreOf(p);
      if (!p || !core) throw new UsageError("no bound crossing stands — `grow open`, rotate, `grow bind` first");
      const idx = Number(args.options["index"] ?? "0");
      const hand = await sealHand(idx);
      const inOld = p.oldKeys.some((k) => k.toLowerCase() === hand.signer.toLowerCase());
      const inNew = (p.newKeys ?? []).some((k) => k.toLowerCase() === hand.signer.toLowerCase());
      if (!inOld && !inNew) throw new UsageError("this hand sits in neither set — it may `grow witness`, never sign");
      const sig: QuorumSignature = { signer: hand.signer, sig: await hand.sign(reserveTransitionBytes(core)) };
      const dedupe = (list: QuorumSignature[]): QuorumSignature[] =>
        [...list.filter((x) => x.signer.toLowerCase() !== sig.signer.toLowerCase()), sig];
      writePending({ ...p, oldSigs: inOld ? dedupe(p.oldSigs) : p.oldSigs, newSigs: inNew ? dedupe(p.newSigs) : p.newSigs });
      emit(args, { ok: true, data: { signed: { as: hand.signer, old: inOld, new: inNew } },
        human: () => console.log(`signed${inOld ? " [handoff]" : ""}${inNew ? " [receipt]" : ""} as ${hand.signer.slice(0, 16)}…`) });
      return 0;
    }
    case "witness": {
      const p = readPending();
      const core = p && boundCoreOf(p);
      if (!p || !core) throw new UsageError("no bound crossing stands — a witness attests a closed byte-image");
      const idx = Number(args.options["index"] ?? "0");
      const note = args.options["note"];
      if (!note) throw new UsageError("a witness mark carries a note — what stood observed (--note)");
      const hand = await sealHand(idx);
      const holders = new Set([...p.oldKeys, ...(p.newKeys ?? [])].map((k) => k.toLowerCase()));
      if (holders.has(hand.signer.toLowerCase())) throw new UsageError("a keyholder attests as a party — `grow sign`, never witness");
      const mark: TransitionWitness = { witness: hand.signer, note, sig: await hand.signWitness(reserveTransitionBytes(core), note) };
      writePending({ ...p, witnesses: [...p.witnesses.filter((w) => w.witness.toLowerCase() !== mark.witness.toLowerCase()), mark] });
      emit(args, { ok: true, data: { witnessed: { by: hand.signer } }, human: () => console.log(`witnessed by ${hand.signer.slice(0, 16)}… — "${note}"`) });
      return 0;
    }
    case "seal": {
      const p = readPending();
      const core = p && boundCoreOf(p);
      if (!p || !core) throw new UsageError("no bound crossing stands — nothing to seal");
      const rec: ReserveTransition = {
        ...core, transitionCid: reserveTransitionCidOf(core),
        oldSigs: p.oldSigs, newSigs: p.newSigs, witnesses: p.witnesses,
      };
      const v = await verifyReserveTransition(rec, {
        oldKeys: p.oldKeys, oldThreshold: p.oldThreshold,
        newKeys: p.newKeys!, newThreshold: p.newThreshold!,
      });
      if (!v.ok) {
        emit(args, { ok: false, error: { code: "error", message: `crossing REFUSED (fail-closed): ${v.reason}` },
          human: () => console.error(`seal grow REFUSED (fail-closed): ${v.reason} — the pending crossing stands; nothing written.`) });
        return exitFor("error");
      }
      const kept: ReserveTransition[] = existsSync(transitionsPath())
        ? (JSON.parse(readFileSync(transitionsPath(), "utf8")) as ReserveTransition[])
        : [];
      writeFileSync(transitionsPath(), JSON.stringify([...kept, rec], null, 2));
      rmSync(pendingPath(), { force: true });
      emit(args, { ok: true, data: { sealed: { transitionCid: rec.transitionCid, independentWitnesses: v.independentWitnesses } },
        human: () => console.log(`crossing SEALED — ${rec.transitionCid.slice(0, 20)}… · independent witnesses: ${v.independentWitnesses}. The record rides with the charter.`) });
      return 0;
    }
    default:
      console.error("lares nexus seal grow <open | bind | sign --index N | witness --index N --note '…' | seal>");
      return 2;
  }
}

async function sealRotate(args: ParsedArgs): Promise<number> {
  const sealHome = larSealHome();
  const { doc, head } = sealedCharterOrRefuse(sealHome, "rotate");
  const depth = doc.sealLineage?.length ?? 0;
  const nextKeyCommit = normHex(args.options["next-key-commit"]);
  const reserveState = readCharterReserveState();

  // A RESERVE COMMIT CANNOT ARM A ROLL: no verb reveals a reserve key-set, so a rotated head would freeze.
  if (isReserveArmed(nextKeyCommit, reserveState?.nextKeyCommit)) {
    const message = "arming a rotated head with the reserve's commit would freeze the chain, because no verb reveals a reserve key-set and a chain past genesis never re-seats.";
    emit(args, {
      ok: false,
      error: { code: "reserve-commit-unrevealable", message },
      human: () => console.error(`nexus seal rotate REFUSED: ${message}`),
    });
    return exitFor("reserve-commit-unrevealable");
  }

  // REVEAL: the operator has provisioned the pre-committed next key-set into the vault; seating from the
  // vault reads it back. The revealed key-set becomes the new head's authorized quorum.
  // THE ROSTER BECOMES EXACTLY WHAT STANDS — the succession door. A kahu steps down by no longer standing;
  // a new one takes a chair by standing under its private label. Neither needs an admin verb, because the
  // reveal below must still match the head's PRE-COMMITMENT: a roster change only lands if the operator
  // pre-committed the successor key-set an epoch earlier, under the quorum that stood then.
  const { kahu, seatedKeys, hands } = await seatKahuFromVault(doc, "drop");
  if (kahu.length === 0) {
    throw new UsageError(
      "no persona stands for a chair — a rotation seats the roster that STANDS, and none does. " +
      "Stand them first: lares persona new <index> --name '<label>' --seat [--chair '<chair label>']",
    );
  }
  const threshold = resolveSeatThreshold(args, doc, kahu.length);
  if (seatedKeys.length < threshold) {
    throw new UsageError(`the revealed key-set is short of the ${threshold}-of-${kahu.length} quorum (seated ${seatedKeys.length}) — provision the next personas before rotating`);
  }
  const standingKeySetHash = sealKeySetHash(seatedKeys, threshold);
  if (isReserveArmed(head.nextKeyCommit, reserveState?.nextKeyCommit) && standingKeySetHash !== normHex(head.nextKeyCommit)) {
    const message = reserveArmedRotateMessage(depth);
    emit(args, {
      ok: false,
      error: { code: "reserve-armed", message },
      data: { chainDepth: depth, reserveEpoch: reserveState?.reserveEpoch ?? null, reseatOpen: depth === 1 },
      human: () => console.error(`nexus seal rotate REFUSED: ${message}`),
    });
    return exitFor("reserve-armed");
  }

  // FAIL CLOSED: a revealed key-set whose digest does not match the head's pre-commitment REFUSES, and
  // writes nothing. A stolen current key-set cannot forge a successor it never pre-committed.
  // THE REVEALED HANDS SIGN THE ROLL. Every seated key here is a root this vessel holds, so each signs the
  // step with its own seed; a roll short of the revealed quorum refuses inside `rotateSealEpoch`.
  const seatedSet = new Set(seatedKeys.map((k) => k.toLowerCase()));
  const signers = await Promise.all(hands
    .filter((h) => seatedSet.has(h.verifyingKey.toLowerCase()))
    .map(async (h) => ({ signer: h.verifyingKey, sign: (await sealHand(h.handleIndex)).sign })));
  const result = await rotateSealEpoch(head, { keys: seatedKeys, threshold }, nextKeyCommit, signers);
  if (!result.ok) {
    // A CHANGED ROSTER lands here too, and reads as the same refusal for the same reason: the reveal must
    // match what the prior epoch pre-committed, so adding or dropping a kahu requires having pre-committed
    // that exact successor set. Naming the possibility turns an opaque digest mismatch into a next step.
    const rosterMoved = kahu.length !== doc.kahu.length || threshold !== doc.threshold;
    emit(args, {
      ok: false,
      error: { code: result.code, message: `rotation REFUSED (fail-closed): ${result.reason}` },
      human: () => {
        console.error(`nexus seal rotate REFUSED (fail-closed): ${result.reason}`);
        console.error(`  the chain stays at depth ${depth}; nothing written.`);
        if (rosterMoved) {
          console.error(`  the roster MOVED (${doc.kahu.length} chairs @ ${doc.threshold} → ${kahu.length} @ ${threshold}).`);
          console.error(`  a succession lands only if THIS key-set was pre-committed an epoch ago:`);
          console.error(`    lares nexus seal commit --keys <the new set> --threshold <k>   → arm it on the PRIOR rotation`);
        }
      },
    });
    return exitFor(result.code);
  }

  const sealLineage: SealEpoch[] = [...(doc.sealLineage ?? []), result.epoch];
  const sealEpochCid = result.epoch.epochCid;
  const next: NexusDoc = { kind: doc.kind, threshold, sealEpochCid, sealLineage, kahu };

  // THE ROLL ANCHOR LANDS FIRST. The new quorum signs the closing head, its key-set and the board's causal
  // heads, so an admit already in those heads carries across the roll; one the closing keys mint afterwards
  // does not. It lands BEFORE the charter moves: a roll whose anchor cannot land writes nothing, and an anchor
  // whose head never lands names an epoch no lineage holds. A closing head that roots no roster (an inert
  // charter) counted no act, so it has nothing to carry and writes no anchor.
  const closing = foundingRoster(doc);
  const opened: KahuQuorumSeats = { keys: seatedKeys, threshold, sealEpochCid };
  let anchored: NexusRollAnchorResult | null = null;
  if (closing.sealEpochCid.length > 0) {
    try {
      const { output } = await storeVerb("nexus-roll-anchor", { closing, opened }, NexusContractError);
      anchored = output as unknown as NexusRollAnchorResult;
    } catch (err) {
      if (!(err instanceof NexusContractError)) throw err;
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
  // A rotation reaches the SEAL joint always, and the KAHU joint only when the roster actually moved — so an
  // ordinary re-key never rewrites a roster it did not touch.
  const path = writeNexusSeal(sealHome, { kind: next.kind, sealEpochCid, sealLineage }, next);
  if (kahu.length !== doc.kahu.length || threshold !== doc.threshold) {
    writeNexusKahu(sealHome, { threshold, kahu }, next);
  }
  const armed = nextKeyCommit.length > 0;

  emit(args, {
    ok: true,
    data: {
      path, sealEpochCid, prevEpochCid: result.epoch.prevEpochCid,
      chainDepth: sealLineage.length, rotationArmed: armed, nextKeyCommit: nextKeyCommit || null,
      quorumSeated: foundingQuorumSeated(next),
      rollAnchor: anchored ? { cid: anchored.anchorCid, parents: anchored.parents.length } : null,
    },
    human: () => {
      console.log(`nexus seal ROTATED → chain depth ${sealLineage.length} → ${path}`);
      console.log(`  reveal VERIFIED against the prior epoch's pre-commitment; the revealed hands SIGNED the roll.`);
      console.log(`  head epoch: ${sealEpochCid}`);
      console.log(`  prev link:  ${result.epoch.prevEpochCid}`);
      console.log(anchored
        ? `  anchor:     ${anchored.anchorCid.slice(0, 16)}… over ${anchored.parents.length} board head(s) — admits in its past carry to the new head`
        : `  anchor:     none — the closing head rooted no roster, so no admit stood to carry`);
      console.log(`  rotation:   ${armed ? "ARMED (next key-set pre-committed)" : "UNARMED — the next rotate refuses until you supply --next-key-commit"}`);
    },
  });
  return 0;
}

function sealCommit(args: ParsedArgs): number {
  const raw = args.options["keys"];
  if (!raw) throw new UsageError("provide the next epoch's verifying keys: --keys <k1,k2,...> [--threshold <k>]");
  const keys = raw.split(",").map((k) => k.trim().toLowerCase()).filter((k) => k.length > 0);
  if (keys.length === 0) throw new UsageError("no keys supplied to --keys");
  const thRaw = args.options["threshold"];
  const threshold = thRaw !== undefined ? Number.parseInt(thRaw, 10) : keys.length;
  if (!Number.isInteger(threshold) || threshold < 1) throw new UsageError(`--threshold must be a positive integer (got "${thRaw}")`);
  const digest = sealKeySetHash(keys, threshold);

  emit(args, {
    ok: true,
    data: { digest, keys: keys.length, threshold },
    human: () => {
      console.log(`key-set commitment digest (${keys.length} keys, ${threshold}-of-${keys.length}):`);
      console.log(`  ${digest}`);
      console.log(`  supply it as:  lares nexus seal {seat|rotate} --next-key-commit ${digest}`);
      console.log(`  hold the matching SIGNING seeds in offline custody until the rotate ceremony reveals them.`);
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
  const payload = { ...parsed, kahu: parsed.kahu.map((k) => ({ ...k, displayName: k.verifyingKey ? seatFingerprint(k.verifyingKey) : "unseated" })) };
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
  const reserve = readCharterReserveState();
  const reserveArmed = isReserveArmed(head?.nextKeyCommit, reserve?.nextKeyCommit);
  const roots = await readPersonaRoots();
  const heldKeys = roots.roots.map((r) => r.verifyingKey);
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
      rotationArmed: head ? head.nextKeyCommit.length > 0 : false,
      reserveArmed,
      seatedKeys: roster.keys.length,
      quorumSeated: quorum,
      // WHAT THE QUORUM SURVIVES, beside what it is. A threshold met by every seated chair passes
      // every gate and locks the Nexus the day one seat goes dark — including for the rotation that
      // would repair it. The reading rides the payload so a harness can assert it, and the human
      // path prints it where the numbers already are.
      standing: rosterStanding({ seated: roster.keys.length, threshold: roster.threshold }),
      phase: nexusPhase({ ownSeats, foreignSeats: foreign }),
      kahu: (doc?.kahu ?? []).map((k) => ({ displayName: k.displayName, seated: Boolean(k.verifyingKey), fingerprint: k.verifyingKey ? seatFingerprint(k.verifyingKey) : null })),
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
      for (const k of doc.kahu) console.log(`  ${k.verifyingKey ? "seated  " : "UNSEATED"} ${k.displayName}${k.verifyingKey ? `  ${seatFingerprint(k.verifyingKey)}` : ""}`);
      console.log(`  threshold:  ${roster.threshold} · seated keys: ${roster.keys.length}`);
      console.log(`  seal:       ${seal === "sealed" ? "SEALED" : "UNSEALED — the roster stands and no seal epoch is seated; seat one once a quorum stands"}`);
      console.log(`  chain:      ${chainDepth > 0 ? `${chainDepth} epoch(s), head at seq ${chainDepth - 1}` : "(none — no epoch established)"}`);
      console.log(`  head epoch: ${roster.sealEpochCid || "(unestablished)"}`);
      console.log(`  rotation:   ${reserveArmed ? reserveArmedReading(chainDepth) : head && head.nextKeyCommit.length > 0 ? "ARMED" : "UNARMED"}`);
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
      console.log(`  reserve:    ${reserve ? `commit ${reserve.nextKeyCommit.slice(0, 16)}… (epoch ${reserve.reserveEpoch}, guardians ${reserve.guardianA ?? "unassigned"}/${reserve.guardianB ?? "unassigned"})` : "(none — run `lares nexus seal reserve` to custody the pre-rotation)"}`);
    },
  });
  return 0;
}

// ── The charter reserve keel — custody the pre-rotation's NEXT key-set ────────────────────────────────
//
// The reserve seed is forged IN MEMORY, derives the three next-epoch kahu keys HARDENED (SLIP-0010, off a
// SEPARATE seed — never the live signing seed), and Shamir-splits 2-of-3 into three cards. The vessel keeps
// only Share 1 ("mine"), SEALED; the seed NEVER lands on disk (zeroized the instant the split returns).

async function cmdCharterReserve(args: ParsedArgs): Promise<number> {
  const op = args.positional[2];
  switch (op) {
    case undefined:
    case "provision": return await sealReserveProvision(args, "provision");
    case "refresh":   return await sealReserveProvision(args, "refresh");
    case "show":      return await sealReserveShow(args);
    case "rehearse":  return await sealReserveRehearse(args);
    default:
      console.error(`lares nexus seal reserve: unknown op "${op}" (expected refresh | show | rehearse | <none>)`);
      return 2;
  }
}

/** Emit the three cards + the seat instruction — shared by provision and refresh. */
function reserveCardsEmission(
  args: ParsedArgs,
  data: Record<string, unknown>,
  cards: readonly ReserveCard[],
  nextKeyCommit: string,
  humanHead: () => void,
): void {
  emit(args, {
    ok: true,
    data,
    human: () => {
      humanHead();
      console.log(``);
      console.log(`  Place these THREE cards by hand (web3-pure — no cloud/email/API coupling):`);
      for (const c of cards) {
        console.log(`    ── ${c.label} ──`);
        console.log(`       share code:   ${c.shareCode}`);
        console.log(`       confirm:      ${c.confirmPhrase}   (read out-of-band to verify the card)`);
        console.log(`       generation:   ${String(data["reserveEpoch"])}   (cards of two generations never combine)`);
        console.log(`       quorum:       any ${RESERVE_THRESHOLD} of ${RESERVE_KAHU_COUNT} cards of this generation`);
      }
      console.log(``);
      console.log(`  "mine" seals on THIS vessel; a printed/emailed copy of "mine" carries the SAME share —`);
      console.log(`  an operator-full-compromise reveals ONE share → nothing. Any TWO cards rebuild the reserve SEED.`);
      console.log(`  \`lares nexus seal reserve rehearse\` reads two cards back under a scratch root and proves the`);
      console.log(`  rebuilt key-set against the charter head. No verb rolls the charter from that seed.`);
      console.log(``);
      console.log(`  Arm the pre-rotation:  lares nexus seal seat --next-key-commit ${nextKeyCommit}`);
    },
  });
}

async function sealReserveProvision(args: ParsedArgs, mode: "provision" | "refresh"): Promise<number> {
  const guardianA = args.options["guardian-a"] ?? null;
  const guardianB = args.options["guardian-b"] ?? null;

  // The reserve epoch advances on refresh; founding provision seats epoch 1. A refresh with no prior state
  // still seats epoch 1 (nothing to advance) — surfaced in the human head below.
  const prior = readCharterReserveState();
  const reserveEpoch = mode === "refresh" ? (prior?.reserveEpoch ?? 0) + 1 : 1;

  // Read the charter chain to name the reconciliation route (below) — this command NEVER mutates the charter.
  const doc = readNexusDoc(larSealHome());
  const chainDepth = doc?.sealLineage?.length ?? 0;

  const rng = defaultCryptoProvider;
  const reserveSeed = generateReserveSeed(rng);
  try {
    const { verifyingKeys } = await deriveReserveKeySet(reserveSeed, reserveEpoch);
    const nextKeyCommit = reserveNextKeyCommit(verifyingKeys);      // sealKeySetHash(3 keys, threshold 2)
    const { cards, mineShare } = splitReserveSeed(reserveSeed, guardianA, guardianB, reserveEpoch, rng);

    // Seal ONLY the "mine" share; record the PUBLIC state (commit + guardians). The seed reaches neither.
    sealReserveMineShare(mineShare);
    writeCharterReserveState({
      reserveEpoch, nextKeyCommit, threshold: RESERVE_THRESHOLD, kahuCount: RESERVE_KAHU_COUNT,
      guardianA, guardianB, mineShareSealed: true, issuedAt: new Date().toISOString(),
    });

    // The refresh reconciliation FORK — named, never auto-resolved (the seated pre-commitment is frozen
    // into its epochCid; no verb reveals a reserve key-set to satisfy that commitment).
    const reconcile = mode === "provision"
      ? null
      : chainDepth <= 1
        ? "re-commit-before-seal"   // genesis-only (unrotated): re-run `seat --next-key-commit` to re-mint genesis
        : "full-rotation";          // rotated: no reserve key-set can reveal; this commit cannot arm a roll

    reserveCardsEmission(
      args,
      {
        mode, reserveEpoch, nextKeyCommit, threshold: RESERVE_THRESHOLD, kahuCount: RESERVE_KAHU_COUNT,
        cardReader: "nexus seal reserve rehearse",
        guardianA, guardianB, chainDepth, reconcile,
        cards: cards.map((c) => ({ slot: c.slot, label: c.label, custodian: c.custodian, shareCode: c.shareCode, confirmPhrase: c.confirmPhrase, generation: reserveEpoch, threshold: RESERVE_THRESHOLD, shares: RESERVE_KAHU_COUNT })),
      },
      cards,
      nextKeyCommit,
      () => {
        if (mode === "provision") {
          console.log(`nexus seal reserve — forged the pre-rotation's next key-set (reserve epoch ${reserveEpoch}).`);
          console.log(`  the reserve seed lived IN MEMORY only; the vessel keeps one SEALED share, never the seed.`);
        } else {
          console.log(`nexus seal reserve REFRESH — re-seeded + re-derived (reserve epoch ${reserveEpoch}).`);
          console.log(`  new --next-key-commit: ${nextKeyCommit}`);
          if (reconcile === "re-commit-before-seal") {
            console.log(`  RECONCILE (chain depth ${chainDepth}, genesis-only/unrotated): re-run`);
            console.log(`    lares nexus seal seat --next-key-commit ${nextKeyCommit}`);
            console.log(`  — a genesis re-mint is permitted BEFORE the first rotate (the pre-committed keys never signed yet).`);
          } else {
            console.log(`  RECONCILE (chain depth ${chainDepth}, ALREADY rotated): no verb reveals a reserve key-set,`);
            console.log(`  so this commit arms no roll; a rotated head armed with it would freeze.`);
          }
        }
      },
    );
    return 0;
  } finally {
    reserveSeed.fill(0);   // the reserve seed never lands on disk, and never lingers past the split
  }
}

async function sealReserveShow(args: ParsedArgs): Promise<number> {
  const state = readCharterReserveState();
  emit(args, {
    ok: true,
    data: state
      ? {
          present: true, reserveEpoch: state.reserveEpoch, nextKeyCommit: state.nextKeyCommit,
          threshold: state.threshold, kahuCount: state.kahuCount,
          guardianA: state.guardianA, guardianB: state.guardianB,
          mineShareSealed: state.mineShareSealed, issuedAt: state.issuedAt,
        }
      : { present: false },
    human: () => {
      if (!state) {
        console.log(`no charter reserve — run \`lares nexus seal reserve\` to custody the pre-rotation's next key-set.`);
        return;
      }
      console.log(`nexus seal reserve:`);
      console.log(`  commit:     ${state.nextKeyCommit}   (${state.threshold}-of-${state.kahuCount})`);
      console.log(`  epoch:      ${state.reserveEpoch}   (issued ${state.issuedAt})`);
      console.log(`  guardians:  A=${state.guardianA ?? "unassigned"}  B=${state.guardianB ?? "unassigned"}`);
      console.log(`  mine share: ${state.mineShareSealed ? "SEALED on this vessel" : "NOT sealed"}`);
      console.log(`  (the seed and the full share-set are NEVER shown — only the public commit + labels)`);
    },
  });
  return 0;
}

// ── The rehearsal — the reserve card's one reader ────────────────────────────────────────────────────
//
// A rehearsal decodes two cards, rebuilds the reserve seed IN MEMORY, derives the key-set and proves its
// commit against the charter head. It speaks public digests alone, writes nothing, and rolls nothing: no
// verb seats a reserve-derived key. A rebuilt seed stands whole in this process, so the verb runs only
// under a root a harness staged; a real card meeting a live vessel waits on an operator ruling.

/** The marker a harness writes at stage time (`tools/test-scratch-marker.mjs`); nothing else makes a root scratch. */
const SCRATCH_MARKER = ".lar-test-scratch";

/** A REHEARSAL ROOT STANDS when `LAR_ROOT` names a root that carries the harness's scratch marker. */
export function rehearsalRootStands(larRootEnv: string | undefined): boolean {
  return !!larRootEnv && existsSync(join(larRootEnv, SCRATCH_MARKER));
}

const RESERVE_SLOTS: readonly ReserveCard["slot"][] = ["mine", "guardian-a", "guardian-b"];
const reserveSlot = (s: string): ReserveCard["slot"] | null =>
  (RESERVE_SLOTS as readonly string[]).includes(s) ? (s as ReserveCard["slot"]) : null;

async function sealReserveRehearse(args: ParsedArgs): Promise<number> {
  const refuse = (code: string, message: string, data?: Record<string, unknown>): number => {
    emit(args, {
      ok: false, error: { code, message }, ...(data ? { data } : {}),
      human: () => console.error(`nexus seal reserve rehearse REFUSED (${code}): ${message}`),
    });
    return exitFor(code);
  };

  // THE SCRATCH GATE READS FIRST: no card decodes, and no state reads, outside a staged root.
  if (!rehearsalRootStands(process.env["LAR_ROOT"])) {
    return refuse("rehearsal-needs-scratch-root",
      "a rehearsal rebuilds a whole reserve seed in this process, so it runs only under a root a harness staged " +
      "(node tools/test-scratch-marker.mjs <root>, then LAR_ROOT=<root>); whether a real card ever meets a live vessel waits on an operator ruling.");
  }

  const codeA = args.options["card-a"];
  const codeB = args.options["card-b"];
  if (!codeA || !codeB) throw new UsageError("reserve rehearse reads two cards: --card-a <share code> --card-b <share code>");
  const slotA = reserveSlot(args.options["slot-a"] ?? "guardian-a");
  const slotB = reserveSlot(args.options["slot-b"] ?? "guardian-b");
  if (!slotA || !slotB) throw new UsageError(`a slot names one of ${RESERVE_SLOTS.join(" | ")}`);
  if (slotA === slotB) {
    return refuse("rehearsal-same-custodian", "two cards of one custodian slot form no quorum; a rehearsal reads two DISTINCT slots.");
  }

  // THE GENERATION RIDES THE CARD'S LABEL, never its share code: the reader types it, or the vessel's reserve state names it.
  const typed = args.options["generation"];
  const generation = typed === undefined ? readCharterReserveState()?.reserveEpoch : Number(typed);
  if (generation === undefined || !Number.isInteger(generation) || generation < 0) {
    return refuse("rehearsal-no-generation", "no generation stands for these cards — type the one each card prints: --generation <n>.");
  }

  const read = (which: "a" | "b", slot: ReserveCard["slot"], shareCode: string): ReturnType<typeof reserveShareFromCard> | string => {
    try {
      return reserveShareFromCard({ slot, label: "", custodian: GUARDIAN_SLOT_CUSTODIAN[slot], shareCode, confirmPhrase: "" }, generation);
    } catch (err) {
      return `card ${which} reads false: ${err instanceof Error ? err.message : String(err)}`;
    }
  };
  const shareA = read("a", slotA, codeA);
  if (typeof shareA === "string") return refuse("rehearsal-card-unreadable", shareA);
  const shareB = read("b", slotB, codeB);
  if (typeof shareB === "string") return refuse("rehearsal-card-unreadable", shareB);

  let quorum: ReturnType<typeof assembleQuorum>;
  try { quorum = assembleQuorum([shareA, shareB], RESERVE_THRESHOLD); }
  catch (err) { return refuse("rehearsal-no-quorum", err instanceof Error ? err.message : String(err)); }

  // THE SEED LIVES INSIDE THIS BLOCK ALONE. Only the public commit leaves it.
  const seed = reconstructFromQuorum(quorum);
  let derivedCommit: string;
  try {
    const { verifyingKeys } = await deriveReserveKeySet(seed, generation);
    derivedCommit = normHex(reserveNextKeyCommit(verifyingKeys));
  } finally {
    seed.fill(0);
  }

  const headCommit = normHex(sealLineageHead(readNexusDoc(larSealHome()))?.nextKeyCommit) || null;
  const reserveCommit = normHex(readCharterReserveState()?.nextKeyCommit);
  const matchesHead = headCommit !== null && derivedCommit === headCommit;
  const matchesReserveState = reserveCommit.length > 0 && derivedCommit === reserveCommit;
  const data = { rehearsed: true, generation, derivedCommit, headCommit, matchesHead, matchesReserveState, wrote: null, rolls: false };

  if (headCommit === null) {
    return refuse("rehearsal-no-head", "no charter head pre-commits a next key-set here, so the rebuilt key-set proves against nothing — seat the charter first.", data);
  }
  if (!matchesHead) {
    return refuse("rehearsal-commit-mismatch",
      "the two cards rebuild a key-set the charter head never pre-committed. Three causes read the same: a card of another generation, " +
      "a card of another Nexus, or a mis-copied or substituted share (plain Shamir rebuilds a value from any two shares and vouches for nothing).", data);
  }
  emit(args, {
    ok: true, data,
    human: () => {
      console.log(`nexus seal reserve rehearse — the two cards rebuild the key-set the charter head pre-commits (generation ${generation}).`);
      console.log(`  commit:  ${derivedCommit}`);
      console.log(`  nothing written; the seed buffer stands zeroed. No verb rolls the charter from it.`);
    },
  });
  return 0;
}
