/**
 * nexus-doc — the DISK adapter for the Nexus SEAL FILE, which carries THREE joints at three cadences.
 *
 * THE JOINTS, and why they ride separate blocks. One word once covered six entities, separated not by
 * content but by different ceremony, threshold, RATE and authority (canon `cabal-realm#six-joints`). Three
 * of them live here, and their amendment costs differ by orders:
 *
 *   · SEAL     — the pre-rotated key-epoch lineage. A rotation ceremony over a k-of-n of current keys. Rare.
 *   · KAHU     — the founding roster + its threshold. Moves when a steward seat moves.
 *   · PRACTICE — federation posture · join policy · admission dials. An ordinary governance act, fast and
 *                reversible, and the one a single hand may turn.
 *
 * WHY THREE BLOCKS RATHER THAN ONE. A single block forced every writer through a whole-doc rewrite, so a
 * posture flip re-emitted the seal lineage's bytes on its way past, and two hands touching different joints
 * clobbered each other last-writer-wins. Each narrow writer below re-reads the carrier at write time and
 * swaps ONLY its own fence, carrying the other joints through as OPAQUE TEXT it never deserializes. That
 * makes the corruption inexpressible rather than merely discouraged: a practice write holds no parsed seal
 * to get wrong.
 *
 * The composed `readNexusDoc` still folds all three into one `NexusDoc`, because a reader legitimately wants
 * the whole view — the WRITE must stay narrow, never the read.
 *
 * FAILS CLOSED on the read: an absent file, a missing seal or kahu block, torn JSON, or a wrong-kind payload
 * all read `null` — the roster then folds empty and the antigen stays inert. The parser never guesses a
 * partial doc into authority. A torn PRACTICE block never closes the doc, so the fastest-cadence joint can
 * never take the slower ones down with it.
 *
 * The seal home rides in as a parameter (the CLI supplies `larSealHome()`), so this module keeps no env
 * coupling and tests against any temp tree.
 */

import { atomicWriteFileSync } from "./fs-atomic.js";
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import { CARRIER_TYPE } from "@lararium/mesh/carrier-type";
import { join, dirname } from "node:path";
import {
  NEXUS_DOC_DOMAIN, NEXUS_CHARTER_URI, parseNexusDoc as parseNexusText, readNexusDocFence,
  type NexusDoc, type NexusCharterKahu, type SealEpoch,
  type FederationPosture, type CabalJoinPolicy, type AdmissionDials,
} from "@lararium/mesh";
import { stampCarrier } from "@lararium/memetic-frame";
import { renderCarrier } from "./carrier-render.js";

/** The seal file's name inside the seal home — one file, read by an operator's own eyes. */
export function nexusCharterDocRelPath(): string {
  return "founding-roster.mem";
}

/**
 * The seal file's absolute path under a SEAL HOME (`larSealHome()` — `<lares>/nexus`, per-operator).
 *
 * It takes a home rather than reading one, so this module keeps no env dependency and a test stands the
 * seal wherever it likes. The home rides per-operator state rather than the corpus tree: a Nexus belongs
 * to the operators who founded it, never to whoever cloned the code.
 */
export function nexusCharterDocPath(sealHome: string): string {
  // FAIL LOUD on an absent home. The alternative is `join(undefined, …)` dying as a TypeError about a "path
  // argument" — an error that names the filesystem primitive and hides the wiring fault, costing a reader the
  // whole trail back to the caller that forgot to designate a home. One guard here covers every read and
  // write path, so no caller has to remember its own.
  if (typeof sealHome !== "string" || sealHome.length === 0) {
    throw new Error("nexusCharterDocPath: no seal home supplied — a caller must NAME one (the CLI passes `larSealHome()`).");
  }
  return join(sealHome, nexusCharterDocRelPath());
}

// ── the three fences ──────────────────────────────────────────────────────────────────────────────

/** One joint per fence — a narrow writer swaps its own and never parses its neighbours. */
export const SEAL_BLOCK     = "nexus-seal"     as const;
export const KAHU_BLOCK     = "nexus-kahu"     as const;
export const PRACTICE_BLOCK = "nexus-practice" as const;

/** The SEAL joint on disk — the epoch head plus the pre-rotated lineage behind it. */
export interface NexusSealBlock {
  readonly kind:         typeof NEXUS_DOC_DOMAIN;
  readonly sealEpochCid: string | null;
  readonly sealLineage?: readonly SealEpoch[];
}

/** The KAHU joint on disk — the founding roster and the quorum it answers at. */
export interface NexusKahuBlock {
  readonly threshold: number;
  readonly kahu:      readonly NexusCharterKahu[];
}

/** The PRACTICE joint on disk — the dials one steward hand may turn, at their own fast cadence. */
export interface NexusPracticeBlock {
  readonly federationPosture?: FederationPosture;
  readonly joinPolicy?:        CabalJoinPolicy;
  readonly admissionDials?:    AdmissionDials;
}

function fenceRe(name: string): RegExp {
  return new RegExp("```json " + name + "\\r?\\n([\\s\\S]*?)\\r?\\n```");
}

/**
 * Swap ONE fence's payload inside a body, leaving every other byte untouched.
 *
 * The neighbours ride through as opaque text — this never parses them, so a writer cannot corrupt a joint it
 * does not own. A body missing the named fence gains it, so a carrier written before a joint existed grows
 * that joint rather than failing.
 */
function swapFence(body: string, name: string, payload: unknown): string {
  const block = "```json " + name + "\n" + JSON.stringify(payload, null, 2) + "\n```";
  return fenceRe(name).test(body) ? body.replace(fenceRe(name), block) : `${body.trimEnd()}\n\n${block}\n`;
}

// ── read ──────────────────────────────────────────────────────────────────────────────────────────

/** The raw carrier body, or null when nothing stands on disk. */
function readBody(bagsDir: string): string | null {
  const path = nexusCharterDocPath(bagsDir);
  if (!existsSync(path)) return null;
  try { return readFileSync(path, "utf8"); } catch { return null; }
}

/**
 * Does a charter doc STAND at this home, whatever it reads as?
 *
 * `readNexusDoc` answers null for two unlike facts — no charter here, and a charter here that reads torn —
 * and folding them together suits every caller that wants an inert roster. A caller that would otherwise
 * treat null as "nothing founded yet" needs them apart: seating over a torn charter re-genesises a chain
 * that may already have rotated, stranding every antigen entry rooted on the head it replaces.
 *
 * Presence answers that, and only that. A caller pairs it with the read: stands + reads null = REFUSE.
 */
export function nexusCharterStands(bagsDir: string): boolean {
  return existsSync(nexusCharterDocPath(bagsDir));
}

/** What stands at a charter path: nothing, a whole charter, a torn one, or one written in the earlier charter shape. */
export type NexusCharterShape = "absent" | "whole" | "torn" | "earlier-shape";

/** Classify the charter at the same path used by `readNexusDoc`. */
export function nexusCharterShape(bagsDir: string): NexusCharterShape {
  const body = readBody(bagsDir);
  if (body === null) return existsSync(nexusCharterDocPath(bagsDir)) ? "torn" : "absent";
  // THE EARLIER SHAPES, each by its own mark: one `nextKeyCommit` per epoch, one `prevEpochCid` link where a seal
  // record names its predecessors, and a seat that carries `displayName`
  // where a chair carries `chairLabel`. Every charter written before the Nexus AID took its `nexus-` name carries the
  // second mark, so no reader needs the earlier name itself.
  const own = (e: unknown, key: string): boolean => typeof e === "object" && e !== null && Object.prototype.hasOwnProperty.call(e, key);
  const seal = readNexusDocFence(body, SEAL_BLOCK);
  if (typeof seal === "object" && seal !== null) {
    const lineage = (seal as Record<string, unknown>)["sealLineage"];
    if (Array.isArray(lineage) && lineage.some((e) => own(e, "nextKeyCommit") || own(e, "prevEpochCid"))) return "earlier-shape";
  }
  const kahu = readNexusDocFence(body, KAHU_BLOCK);
  const seats = typeof kahu === "object" && kahu !== null ? (kahu as Record<string, unknown>)["kahu"] : undefined;
  if (Array.isArray(seats) && seats.some((s) => own(s, "displayName") && !own(s, "chairLabel"))) return "earlier-shape";
  return parseNexusDoc(body) === null ? "torn" : "whole";
}

/**
 * Parse charter BYTES into a composed `NexusDoc`, or null (FAIL CLOSED) when they carry no seal or kahu
 * block, or either reads torn. The one parser stands in the mesh (`nexus-doc-text`), platform-blind: the disk
 * read below, every door holding bytes in hand (an import, a carry) and a browser leaf's landed fleet-join
 * answer read through it, so a decision on incoming bytes and every later read of the file agree on what it says.
 */
export function parseNexusDoc(body: string): NexusDoc | null {
  return parseNexusText(body);
}

/**
 * Read the `nexus` doc into a composed `NexusDoc`, or null (FAIL CLOSED) when it stands absent or its
 * bytes fail `parseNexusDoc`. The caller folds a null through `foundingRoster(null)` to the empty (inert)
 * roster — never a guess.
 */
export function readNexusDoc(bagsDir: string): NexusDoc | null {
  const body = readBody(bagsDir);
  return body === null ? null : parseNexusDoc(body);
}

// ── render ────────────────────────────────────────────────────────────────────────────────────────

/** Render the whole carrier in house form — through tw5's own canonical render (`carrier-render.ts`),
 *  never a hand-spelled frame. The meta fence, the prose, and one fenced block per joint are this
 *  module's BODY; the DOCTYPE/head/STX·ETX+check/EOT frame around them is `renderCarrier`'s alone. */
export function renderNexusDoc(doc: NexusDoc): string {
  const seated = doc.kahu.filter((k) => k.verifyingKey).length;
  const depth  = doc.sealLineage?.length ?? 0;
  const lineageLine = depth > 0 ? ` · pre-rotated lineage: ${depth} epoch(s), head at seq ${depth - 1}` : "";
  const seal: NexusSealBlock = doc.sealLineage === undefined
    ? { kind: NEXUS_DOC_DOMAIN, sealEpochCid: doc.sealEpochCid }
    : { kind: NEXUS_DOC_DOMAIN, sealEpochCid: doc.sealEpochCid, sealLineage: doc.sealLineage };
  const kahu: NexusKahuBlock = { threshold: doc.threshold, kahu: doc.kahu };
  const practice: NexusPracticeBlock =
    doc.federationPosture === undefined ? {} : { federationPosture: doc.federationPosture };

  const body = [
    "```toml meta",
    // The root TOML `uri-path` field is checked against the head's own SOH target path (tw5's
    // deserializer: `uri.slice("lar:///".length)`, dots and all — never a slash-converted or
    // otherwise-derived spelling), so it rides straight off NEXUS_CHARTER_URI rather than the
    // unrelated NEXUS_CHARTER_URI_PATH constant (a display-only path nothing else validates against).
    `uri-path  = "${NEXUS_CHARTER_URI.slice("lar:///".length)}"`,
    `file-path = "<lares>/nexus/${nexusCharterDocRelPath()}"`,
    `type      = ${JSON.stringify(CARRIER_TYPE)}`,
    `register  = "Canon"`,
    `mana      = 19`,
    `cacheable = true`,
    `retain    = true`,
    `role      = "the nexus doc — three joints at three cadences: the SEAL lineage (rare, a rotation ceremony), the KAHU roster (steward seats), and the PRACTICE dials (fast, one hand). Each rides its own block and its own narrow writer."`,
    "```",
    "",
    "<<~ ahu #/the-three-joints>>",
    "",
    "! The nexus Doc — seal · kahu · practice",
    "",
    "Three joints ride here at three cadences, each in its own block, because a single block forced every writer through a whole-doc rewrite: a posture flip re-emitted the seal lineage on its way past, and two hands touching different joints clobbered each other. Each narrow writer swaps ONLY its own fence and carries the rest through as opaque text.",
    "",
    `The KAHU block holds the APPROVED roster the Kapae immune antigen reads. A ban/lift act carries ${doc.threshold}-of-${doc.kahu.length} founding-kahu signatures, rooted on the seal epoch below. Each kahu's key reads that PersonaGroup's own root-derived verifying key, seated from the vault by \`lares nexus seal seat\` — never invented. An unseated key reads null, and the antigen stays inert until a quorum stands.`,
    "",
    `Seated: ${seated}/${doc.kahu.length} · threshold ${doc.threshold} · epoch ${doc.sealEpochCid ?? "(unestablished — seat a quorum)"}${lineageLine}`,
    "",
    `\`\`\`json ${SEAL_BLOCK}`,
    JSON.stringify(seal, null, 2),
    "```",
    "",
    `\`\`\`json ${KAHU_BLOCK}`,
    JSON.stringify(kahu, null, 2),
    "```",
    "",
    `\`\`\`json ${PRACTICE_BLOCK}`,
    JSON.stringify(practice, null, 2),
    "```",
    "",
    "<<~/ahu>>",
  ].join("\n");

  return renderCarrier(NEXUS_CHARTER_URI, body);
}

// ── write ─────────────────────────────────────────────────────────────────────────────────────────

/** A reader sees the charter that stood or the one written, never a torn file: a synced sibling renames over it. */
function writeBody(bagsDir: string, body: string): string {
  const path = nexusCharterDocPath(bagsDir);
  mkdirSync(dirname(path), { recursive: true });
  atomicWriteFileSync(path, body);
  return path;
}

/**
 * Write the WHOLE carrier — the founding act's own writer, and the only one that legitimately touches every
 * joint at once. A field-level change MUST route through a narrow writer below instead.
 */
export function writeNexusDoc(bagsDir: string, doc: NexusDoc): string {
  return writeBody(bagsDir, renderNexusDoc(doc));
}

/**
 * Swap ONE joint's block, re-reading the carrier at write time so a concurrent write to a DIFFERENT joint
 * survives. The neighbours never get parsed, so this cannot corrupt them; `seed` renders a fresh carrier when
 * nothing stands on disk yet.
 */
function writeJoint(bagsDir: string, block: string, payload: unknown, seed: NexusDoc): string {
  const body = readBody(bagsDir) ?? renderNexusDoc(seed);
  // The swap moves the span the check covers (the payload's byte length rarely matches the fence it
  // replaces), so the check must move with it — `stampCarrier` re-stamps over the CURRENT span, never
  // a blind carry of the old check forward.
  return writeBody(bagsDir, stampCarrier(swapFence(body, block, payload)));
}

/** Write the SEAL joint alone — a rotation ceremony's reach, touching no roster and no dial. */
export function writeNexusSeal(bagsDir: string, seal: NexusSealBlock, seed: NexusDoc): string {
  return writeJoint(bagsDir, SEAL_BLOCK, seal, seed);
}

/** Write the KAHU joint alone — a steward seat's reach, touching no lineage and no dial. */
export function writeNexusKahu(bagsDir: string, kahu: NexusKahuBlock, seed: NexusDoc): string {
  return writeJoint(bagsDir, KAHU_BLOCK, kahu, seed);
}

/**
 * Write the PRACTICE joint alone — the fast-cadence dials one hand may turn.
 *
 * This one carries the sharpest reason for the split: the cheapest act in the house MUST NOT reach the
 * dearest joint. A posture flip that re-emitted the seal lineage's bytes would rewrite it; this writer
 * cannot reach it.
 */
export function writeNexusPractice(bagsDir: string, practice: NexusPracticeBlock, seed: NexusDoc): string {
  return writeJoint(bagsDir, PRACTICE_BLOCK, practice, seed);
}
