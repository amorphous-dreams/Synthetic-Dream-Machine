/**
 * recovery-share-store — the DEVICE recovery share, one COLD row per face, sealed under the vessel key.
 *
 * The device share holds one share of a persona root. It rests as its own row in the identity home
 * (`recovery-device-share-h<N>.bin`, one per handle-index, so one face's quorum never rebuilds another's root) and
 * opens for one act: the split that mints it, and the quorum that assembles it. Its plaintext zero-fills when the
 * act settles.
 *
 * WHY only the device share rests here: the recorded-code share leaves as words the person writes down, and the
 * escrow share leaves to a peer. Only the device share stays on THIS device, and it dies with the device, so it
 * never serves as the recovery path (recovery rides the recorded code and the escrow). This store serves
 * normal-life quorum assembly.
 *
 * A SHARE LANDS ONCE PER GENERATION. A write over a standing share of the same generation (`recoveryEpoch`) or a
 * later one refuses `RecoveryShareStands`: a second split would hand out two new off-device shares and orphan the
 * ones a person already holds. The same share written again changes nothing; a LATER generation replaces the row.
 *
 * A ROW READS WHOLE OR REFUSES. A share with nothing at its path reads as none landed. A row that stands and does
 * not open under the key the seat holds (another key's seal, a torn file, bare bytes, another shape) refuses by
 * name at the read AND at the write, so no split lands over a share it could not read: a wrong key seals nothing
 * here. The one sealed writer carries every write (sidecar, re-open, compare, rename).
 */

import { join } from "node:path";
import type { RecoveryShare, CustodianTag, RecoveryShareStore } from "@lararium/mesh";
import { CustodyRowUnavailable } from "./custody-holder.js";
import { updateColdCustodyRow } from "./custody-seat.js";
import { larIdentityDir } from "./vessel-paths.js";

/** The device share's row for one face, as the carrier table spells it. */
export function deviceShareFile(handleIndex = 0): string {
  return `recovery-device-share-h${handleIndex}.bin`;
}

/** The device share's path for one face. */
export function deviceSharePath(handleIndex = 0): string {
  return join(larIdentityDir(), deviceShareFile(handleIndex));
}

interface StoredShare {
  readonly x: number;
  readonly ys: number[];
  readonly custodian: CustodianTag;
  readonly recoveryEpoch: number;
}

const CUSTODIANS: ReadonlySet<string> = new Set(["device", "recorded-code", "escrow-peer", "custodian"]);

/** Read a share off a row's plaintext; any other shape refuses `malformed`. */
function parseShare(bytes: Uint8Array, file: string): RecoveryShare {
  const malformed = (): CustodyRowUnavailable => new CustodyRowUnavailable("identity", file, "malformed");
  let j: Partial<StoredShare>;
  try { j = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as Partial<StoredShare>; } catch { throw malformed(); }
  if (!j || typeof j !== "object" || !Number.isSafeInteger(j.x) || !Array.isArray(j.ys) || j.ys.length === 0
      || !j.ys.every((y) => Number.isInteger(y) && y >= 0 && y <= 255)
      || typeof j.custodian !== "string" || !CUSTODIANS.has(j.custodian) || !Number.isSafeInteger(j.recoveryEpoch)) {
    throw malformed();
  }
  return { bytes: { x: j.x as number, ys: new Uint8Array(j.ys) }, custodian: j.custodian as CustodianTag, recoveryEpoch: j.recoveryEpoch as number };
}

/** A device share that would land over a standing one of its own generation or a later one. */
export class RecoveryShareStands extends Error {
  override readonly name = "RecoveryShareStands";
  constructor(readonly handleIndex: number, readonly standing: number, readonly arriving: number) {
    super(`a device recovery share of generation ${standing} stands for h${handleIndex}; a share of generation ${arriving} replaces nothing — a second split would orphan the off-device shares already handed out`);
  }
}

/**
 * Seal the device share for one face. The write reads the standing row first, under one custody holder: a row
 * that stands and does not open refuses before anything lands, a standing share of this generation or a later
 * one refuses `RecoveryShareStands`, and the same share again writes nothing.
 */
export async function persistRecoveryDeviceShare(share: RecoveryShare, handleIndex = 0): Promise<void> {
  const file = deviceShareFile(handleIndex);
  const stored: StoredShare = { x: share.bytes.x, ys: [...share.bytes.ys], custodian: share.custodian, recoveryEpoch: share.recoveryEpoch };
  await updateColdCustodyRow("identity", file, (standing) => {
    if (standing !== null) {
      const held = parseShare(standing, file);                         // a row of another shape refuses the write too
      const same = held.bytes.x === share.bytes.x && held.custodian === share.custodian && held.recoveryEpoch === share.recoveryEpoch
        && held.bytes.ys.length === share.bytes.ys.length && held.bytes.ys.every((y, i) => y === share.bytes.ys[i]);
      held.bytes.ys.fill(0);
      if (same) return { plaintext: null, value: undefined };
      if (share.recoveryEpoch <= held.recoveryEpoch) throw new RecoveryShareStands(handleIndex, held.recoveryEpoch, share.recoveryEpoch);
    }
    return { plaintext: new TextEncoder().encode(JSON.stringify(stored)), value: undefined };
  });
}

/** The device share for one face, or null when none has landed. A row that stands and does not open refuses by name. */
export async function loadRecoveryDeviceShare(handleIndex = 0): Promise<RecoveryShare | null> {
  const file = deviceShareFile(handleIndex);
  return updateColdCustodyRow("identity", file, (standing) => ({ plaintext: null, value: standing === null ? null : parseShare(standing, file) }));
}

/** The node's device-share store, as the persona vault carries it. */
export const nodeRecoveryShareStore: RecoveryShareStore = {
  load: (handleIndex) => loadRecoveryDeviceShare(handleIndex),
  save: (handleIndex, share) => persistRecoveryDeviceShare(share, handleIndex),
};
