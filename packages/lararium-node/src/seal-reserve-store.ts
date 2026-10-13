/**
 * seal-reserve-store — the charter reserve's two rows, both sealed under the vessel key.
 *
 * The reserve SEED never reaches this store and never reaches disk: the vessel keeps ONE share of it, so a read
 * of the vessel at rest reveals a single share and therefore nothing.
 *
 *   · `seal-reserve-mine-share.bin`  COLD. The operator's own share of the reserve seed, opened for one act.
 *   · `seal-reserve-state.json`      HOT. The pre-rotation commit, the guardian labels and the share's flag. It
 *                                    carries no seed and no share bytes.
 *
 * THE STATE COMMITS THE PAIR, IN THREE WRITES. A provision first records its state with `mineShareSealed: false`
 * (a reserve in flight), then seals the share, then records the same state with `mineShareSealed: true`. So a
 * state that reads sealed names the share that rests, and a provision or a refresh that stops anywhere leaves a
 * state that reads in flight: no reader takes an in-flight reserve as armed, the earlier reserve's commit no
 * longer stands in the state, and the same provision run again lands all three.
 *
 * A ROW READS WHOLE OR REFUSES. Nothing at a path reads as nothing landed. A row that stands and does not open
 * under the key the seat holds (another key's seal, a torn file, bare bytes, another shape) refuses by name at
 * the read and at the write, so a refresh under a wrong key lands no share over the standing one.
 */

import { join } from "node:path";
import type { RecoveryShare, CustodianTag } from "@lararium/mesh";
import { CustodyRowUnavailable } from "./custody-holder.js";
import { readCustodyRow, updateColdCustodyRow, updateCustodyRow } from "./custody-seat.js";
import { larIdentityDir } from "./vessel-paths.js";

/** The share row's file, as the carrier table spells it. */
export const RESERVE_SHARE_FILE = "seal-reserve-mine-share.bin";
/** The state row's file, as the carrier table spells it. */
export const RESERVE_STATE_FILE = "seal-reserve-state.json";

/** The sealed "mine" share's path: the ONE share of the reserve seed the vessel holds at rest. */
export function reserveMineSharePath(): string {
  return join(larIdentityDir(), RESERVE_SHARE_FILE);
}

/** The reserve state's path. */
export function reserveStatePath(): string {
  return join(larIdentityDir(), RESERVE_STATE_FILE);
}

interface StoredShare {
  readonly x:             number;
  readonly ys:            number[];
  readonly custodian:     CustodianTag;
  readonly recoveryEpoch: number;
}

const utf8 = new TextEncoder();
const CUSTODIANS: ReadonlySet<string> = new Set(["device", "recorded-code", "escrow-peer", "guardian"]);
const malformed = (file: string): CustodyRowUnavailable => new CustodyRowUnavailable("identity", file, "malformed");
function parseJson(bytes: Uint8Array, file: string): unknown {
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { throw malformed(file); }
}

/** A share's own shape, or null: one x, a byte list, a custodian tag and a generation. */
export function readReserveShare(value: unknown): RecoveryShare | null {
  const j = value as Partial<StoredShare> | null;
  if (!j || typeof j !== "object" || !Number.isSafeInteger(j.x) || !Array.isArray(j.ys) || j.ys.length === 0 || j.ys.length > 4096
      || !j.ys.every((y) => Number.isInteger(y) && y >= 0 && y <= 255)
      || typeof j.custodian !== "string" || !CUSTODIANS.has(j.custodian) || !Number.isSafeInteger(j.recoveryEpoch)) return null;
  return { bytes: { x: j.x as number, ys: new Uint8Array(j.ys) }, custodian: j.custodian as CustodianTag, recoveryEpoch: j.recoveryEpoch as number };
}

function parseShare(bytes: Uint8Array): RecoveryShare {
  const share = readReserveShare(parseJson(bytes, RESERVE_SHARE_FILE));
  if (!share) throw malformed(RESERVE_SHARE_FILE);
  return share;
}

/**
 * Seal the operator's "mine" share. The write reads the standing row first, under one custody holder: a row that
 * stands and does not open refuses before anything lands, and so does one of another shape.
 */
export async function sealReserveMineShare(share: RecoveryShare): Promise<void> {
  const stored: StoredShare = { x: share.bytes.x, ys: [...share.bytes.ys], custodian: share.custodian, recoveryEpoch: share.recoveryEpoch };
  await updateColdCustodyRow("identity", RESERVE_SHARE_FILE, (standing) => {
    if (standing !== null) parseShare(standing);
    return { plaintext: utf8.encode(JSON.stringify(stored)), value: undefined };
  });
}

/** The sealed "mine" share, or null when none has landed. A row that stands and does not open refuses by name. */
export async function loadReserveMineShare(): Promise<RecoveryShare | null> {
  return updateColdCustodyRow("identity", RESERVE_SHARE_FILE, (standing) => ({ plaintext: null, value: standing === null ? null : parseShare(standing) }));
}

/** The reserve state: the pre-rotation commit and the guardian labels. It carries no seed and no share bytes. */
export interface SealReserveState {
  readonly reserveEpoch:    number;
  readonly nextKeyCommit:   string;
  readonly threshold:       number;
  readonly kahuCount:       number;
  readonly guardianA:       string | null;
  readonly guardianB:       string | null;
  readonly mineShareSealed: boolean;
  readonly issuedAt:        string;
}

const HEX64 = /^[0-9a-f]{64}$/;
const labelOrNull = (v: unknown): v is string | null => v === null || (typeof v === "string" && v.length <= 512);

/** A state's own shape, or null. */
export function readReserveState(value: unknown): SealReserveState | null {
  const s = value as Partial<SealReserveState> | null;
  if (!s || typeof s !== "object" || Array.isArray(s)) return null;
  if (!Number.isSafeInteger(s.reserveEpoch) || (s.reserveEpoch as number) < 1) return null;
  if (typeof s.nextKeyCommit !== "string" || !HEX64.test(s.nextKeyCommit)) return null;
  if (!Number.isSafeInteger(s.threshold) || !Number.isSafeInteger(s.kahuCount)) return null;
  if (!labelOrNull(s.guardianA) || !labelOrNull(s.guardianB)) return null;
  if (typeof s.mineShareSealed !== "boolean" || typeof s.issuedAt !== "string" || s.issuedAt.length > 64) return null;
  return {
    reserveEpoch: s.reserveEpoch as number, nextKeyCommit: s.nextKeyCommit, threshold: s.threshold as number, kahuCount: s.kahuCount as number,
    guardianA: s.guardianA, guardianB: s.guardianB, mineShareSealed: s.mineShareSealed, issuedAt: s.issuedAt,
  };
}

function parseState(bytes: Uint8Array): SealReserveState {
  const state = readReserveState(parseJson(bytes, RESERVE_STATE_FILE));
  if (!state) throw malformed(RESERVE_STATE_FILE);
  return state;
}

/** Record the reserve state, over nothing or over a state that reads whole. */
export async function writeCharterReserveState(state: SealReserveState): Promise<void> {
  await updateCustodyRow("identity", RESERVE_STATE_FILE, (standing) => {
    if (standing !== null) parseState(standing);
    return { plaintext: utf8.encode(JSON.stringify(state, null, 2)), value: undefined };
  });
}

/** The reserve state, or null when none has landed. A row that stands and does not open refuses by name. */
export async function readCharterReserveState(): Promise<SealReserveState | null> {
  const bytes = await readCustodyRow("identity", RESERVE_STATE_FILE);
  return bytes === null ? null : parseState(bytes);
}

/**
 * PROVISION: record the state as in flight, seal the operator's share, then record the state as sealed. The one
 * node function a command's reserve rite writes through; the seed and the other shares never reach it.
 */
export async function provisionCharterReserve(share: RecoveryShare, state: SealReserveState): Promise<void> {
  if (share.recoveryEpoch !== state.reserveEpoch) {
    throw new Error("the reserve share and the reserve state name two generations; a provision seals one generation");
  }
  await writeCharterReserveState({ ...state, mineShareSealed: false });
  await sealReserveMineShare(share);
  await writeCharterReserveState({ ...state, mineShareSealed: true });
}

/** Whether a state names a reserve whose share rests: a state in flight (`mineShareSealed: false`) arms nothing. */
export function reserveStands(state: SealReserveState | null): state is SealReserveState {
  return state !== null && state.mineShareSealed === true;
}
