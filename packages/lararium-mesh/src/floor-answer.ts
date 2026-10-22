/**
 * floor-answer — the Nexus's floor, read by a vessel that holds no charter: the porch's answer, verified whole.
 *
 * A Nexus answers a stranger with ONE public document at the porch (`/floor/<Nexus AID>`): the release rows its crossroads
 * board carries, each with the charter's epoch lineage riding its record (`floor-release`). The reader holds the AID on
 * its own trust line (the hearth floor card) and nothing else, and refuses at each step BEFORE the floor is used:
 *
 *   1. the answer's shape, and its Nexus, which must be the AID the reader holds;
 *   2. each release's lineage: the genesis epoch RE-DERIVES the AID, every step verifies under the prior roster's
 *      threshold, and the lineage ends at the epoch the release names;
 *   3. each release: its CID re-derives, its steward seals as a seat of ITS epoch's roster, and the cabal's approval
 *      counts over the manifest's exact bytes at that roster's threshold;
 *   4. the chain: a release counts through an unbroken chain to the Nexus's first, and two heads read `unsettled`;
 *   5. the floor: the head's manifest and its two snapshots, each fetched by CID and re-hashed.
 *
 * It signs nothing and keeps no pin: the reader records no acceptance (a face accepts a release by a person's own act).
 * It is isomorphic: the caller supplies `fetchCas`, and both a browser and a node read the floor through it.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/w26-floor-lane#/the-slices
 */
import { foldFloorReleases, type FloorRelease, type FloorReleaseRefused } from "./floor-release.js";
import { resolveFloor, type FloorManifest } from "./floor-manifest.js";
import type { LarTiddlerRecord } from "./tiddler-store.js";

export const FLOOR_ANSWER_FORMAT = "lararium-floor-answer" as const;

/** The porch's answer: the Nexus and the release rows its board carries (each row's record carries its own lineage). */
export interface FloorAnswer {
  readonly format:   typeof FLOOR_ANSWER_FORMAT;
  readonly nexus:    string;
  readonly releases: ReadonlyArray<{ readonly keyCid: string; readonly record: unknown }>;
}

/** The answer a porch hands a stranger, from the rows its board carries. */
export function floorAnswerOf(nexus: string, releases: FloorAnswer["releases"]): FloorAnswer {
  return { format: FLOOR_ANSWER_FORMAT, nexus, releases };
}

export type FloorReadRefusal =
  | "answer-malformed"
  | "foreign-nexus"
  | "no-release"
  | "release-unsettled"
  | "floor-absent" | "floor-manifest-format" | "floor-manifest-malformed" | "floor-snapshot-cid-mismatch" | "floor-snapshot-malformed"
  | FloorReleaseRefused["reason"];

export type FloorRead =
  | {
      readonly ok: true;
      readonly nexus: string;
      readonly head: FloorRelease;
      readonly manifest: FloorManifest;
      readonly lares: Readonly<Record<string, LarTiddlerRecord>>;
      readonly lararium: Readonly<Record<string, LarTiddlerRecord>>;
      /** The rows the fold set aside, each with its reason: a reader names them and never reads one as an absence. */
      readonly refused: readonly FloorReleaseRefused[];
    }
  | { readonly ok: false; readonly reason: FloorReadRefusal; readonly detail?: string; readonly refused: readonly FloorReleaseRefused[] };

const HEX64 = /^[0-9a-f]{64}$/;

/** Read the Nexus's floor off a porch answer, verifying every step; `fetchCas` fetches bytes by CID (the reader re-hashes). */
export async function readFloorAnswer(args: {
  readonly nexus:    string;
  readonly answer:   unknown;
  readonly fetchCas: (cid: string) => Promise<Uint8Array | null>;
}): Promise<FloorRead> {
  const none: readonly FloorReleaseRefused[] = [];
  const a = args.answer as Partial<FloorAnswer> | null;
  if (a === null || typeof a !== "object" || a.format !== FLOOR_ANSWER_FORMAT || typeof a.nexus !== "string" || !Array.isArray(a.releases)) {
    return { ok: false, reason: "answer-malformed", refused: none };
  }
  if (a.nexus !== args.nexus) return { ok: false, reason: "foreign-nexus", refused: none };
  const rows: Array<{ keyCid: string; record: unknown }> = [];
  for (const row of a.releases) {
    if (row === null || typeof row !== "object") return { ok: false, reason: "answer-malformed", refused: none };
    const r = row as { keyCid?: unknown; record?: unknown };
    if (typeof r.keyCid !== "string" || !HEX64.test(r.keyCid)) return { ok: false, reason: "answer-malformed", refused: none };
    rows.push({ keyCid: r.keyCid, record: r.record });
  }
  const fetched = new Map<string, Uint8Array | null>();
  const manifestBytesOf = async (cid: string): Promise<Uint8Array | null> => {
    if (!fetched.has(cid)) fetched.set(cid, await args.fetchCas(cid).catch(() => null));
    return fetched.get(cid) ?? null;
  };
  const standing = await foldFloorReleases({ rows, nexus: args.nexus, manifestBytesOf });
  if (standing.standing === "unsettled") return { ok: false, reason: "release-unsettled", refused: standing.refused };
  if (standing.standing === "absent") {
    const first = standing.refused[0];
    return first
      ? { ok: false, reason: first.reason, ...(first.detail ? { detail: first.detail } : {}), refused: standing.refused }
      : { ok: false, reason: "no-release", refused: standing.refused };
  }
  const floor = await resolveFloor(standing.head.body.manifest, manifestBytesOf);
  if ("refusal" in floor) return { ok: false, reason: floor.refusal, detail: floor.reason, refused: standing.refused };
  return { ok: true, nexus: args.nexus, head: standing.head, manifest: floor.manifest, lares: floor.lares, lararium: floor.lararium, refused: standing.refused };
}
