/**
 * device-removal — the SECOND act of removing one vessel: a certificate withdrawal for each face key the
 * device holds a certificate under (face-proof#/the-withdrawal-proof · kapae#/reach).
 *
 * TWO ACTS, TWO READER SETS. The dyad marker sets a device aside inside its fleet. It closes nothing at a
 * Nexus gate: a gate reads the face's withdrawal history and never the dyad. So a removal that signs the
 * marker alone leaves the vessel shut out of its fleet and still accepted at a gate. A removal door therefore
 * signs BOTH, or REPORTS BY NAME each withdrawal it could not sign. This module signs the second act and
 * builds that report; it holds no key and reads no board.
 *
 * ONE WITHDRAWAL FOR EACH (PersonaGroup, Nexus). A face proof key stands per scope, so a device that holds
 * three certificates takes three withdrawals, each one event past its own history's frontier (`withdrawKey`).
 * A scope whose face key rests cold on another vessel gets no signature here, and the report says so.
 *
 * Platform-blind: rides ./face-authority. NO node: imports.
 * Meme: lar:///ha.ka.ba/lares/api/pono/kapae#/reach
 */
import { withdrawKey, type FaceKeyCustody, type WithdrawalMemory } from "./face-authority.js";
import type { FaceScope, FaceWithdrawal } from "./face-proof-subjects.js";

/** One certificate the device holds, as the removing vessel reads its own private state. */
export interface DeviceCertificateHeld {
  /** The device's face-scoped key under this scope: the key the withdrawal denies. */
  readonly vesselFaceKey: string;
  /** This vessel's own withdrawal memory for the scope's face key. The scope reads off it. */
  readonly history:       WithdrawalMemory;
  /** The custody door for that scope's face proof key, or null where the key rests on another vessel. */
  readonly custody:       FaceKeyCustody | null;
}

export interface DeviceWithdrawalReport {
  /** Each withdrawal signed in this call: the event, and the history that now holds it. */
  readonly signed:   readonly { readonly scope: FaceScope; readonly event: FaceWithdrawal; readonly history: WithdrawalMemory }[];
  /** Each scope whose history already denied the key: the denial stands, and nothing new got signed. */
  readonly standing: readonly FaceScope[];
  /** Each scope this vessel could NOT sign a withdrawal for, with the reason by name. */
  readonly unsigned: readonly { readonly scope: FaceScope; readonly why: string }[];
}

/** The reason a scope reads unsigned where the face key rests elsewhere. */
export const FACE_KEY_RESTS_ELSEWHERE = "face-key-rests-elsewhere" as const;

/** Sign one withdrawal for each certificate the device holds, and report every one this vessel could not sign. */
export async function withdrawForRemoval(held: readonly DeviceCertificateHeld[]): Promise<DeviceWithdrawalReport> {
  const signed: { scope: FaceScope; event: FaceWithdrawal; history: WithdrawalMemory }[] = [];
  const standing: FaceScope[] = [];
  const unsigned: { scope: FaceScope; why: string }[] = [];
  // ONE HISTORY PER FACE KEY, WALKED IN ORDER. Two certificates under one scope take two events, the second one
  // position past the first: each withdrawal signs onto the history the one before it left, never onto the
  // frontier both started from, which would fork the face's own line.
  const latest = new Map<string, WithdrawalMemory>();
  const keyOf = (scope: FaceScope): string => `${scope.faceKey}@${scope.nexus}`;
  for (const cert of held) {
    const scope = cert.history.scope;
    if (cert.custody === null) { unsigned.push({ scope, why: FACE_KEY_RESTS_ELSEWHERE }); continue; }
    const history = latest.get(keyOf(scope)) ?? cert.history;
    let out: Awaited<ReturnType<typeof withdrawKey>>;
    try { out = await withdrawKey({ history, vesselFaceKey: cert.vesselFaceKey, custody: cert.custody }); }
    catch (err) { unsigned.push({ scope, why: `custody-refused: ${err instanceof Error ? err.message : String(err)}` }); continue; }
    if ("refusal" in out) {
      if (out.refusal === "already-withdrawn") standing.push(scope);
      else unsigned.push({ scope, why: out.refusal });
      continue;
    }
    latest.set(keyOf(scope), out.history);
    signed.push({ scope, event: out.event, history: out.history });
  }
  return { signed, standing, unsigned };
}
