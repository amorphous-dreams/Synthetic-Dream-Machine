/**
 * vault-backup — the command's half of ONE FACE'S BACKUP CUT: draw the bundle key, bind its routes, ask the
 * standing vessel for the sealed body, and write the bundle file.
 *
 * The routes arrive as values: `lares vault backup` reads them on a terminal (`custody-prompt`), and the test door
 * for marked scratch roots hands in the published test route. This module reads no terminal, no flag and no
 * environment variable.
 *
 * WHAT CROSSES THE SOCKET. One `backup` frame on the owner-only custody door: the vessel's own route, the face's
 * handle-index and the bundle key. The vessel answers the body SEALED under that key. No row's plaintext leaves the
 * vessel, and the slot tree never reaches it: the command binds the routes in its own process.
 *
 * A CUT THAT REFUSES WRITES NO FILE, and a file that already stands at the path refuses before any frame leaves.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/custody#/the-cut
 */
import { existsSync, writeFileSync } from "node:fs";
import {
  bindBundleRoutes, encodeFaceBundle, hex, mintBundleKey,
  type Credential, type FaceBundleHolding, type SlotSpec,
} from "@lararium/mesh";
import type { CustodyDoorAnswer, CustodyFrame } from "./custody-door.js";

/** What a cut that landed answers: the file, its length, the face and what the bundle holds. Nothing secret. */
export interface BackupLanded {
  readonly ok:      true;
  readonly out:     string;
  readonly bytes:   number;
  readonly face:    { readonly handleIndex: number; readonly verifyingKey: string };
  readonly slots:   number;
  readonly holds:   readonly FaceBundleHolding[];
  readonly carries: { readonly keyEvents: number; readonly faceProofKeys: number; readonly handleBookRecords: number; readonly petname: boolean; readonly handle: boolean; readonly guardians: number };
}
/** A cut that refused, under the name the vessel or this command gave it. No file was written. */
export interface BackupRefusal { readonly ok: false; readonly reason: string; readonly message: string; readonly attemptsLeft?: number }

/** What the house says at every cut and again at every restore (custody#/the-bundle). */
export const SEALED_BYTES_LINE =
  "Memory needs BOTH halves, and this bundle holds one: the keys ride the bundle, and the sealed BYTES must survive " +
  "elsewhere (a carrier that held them blind, another seat, or a copy of this vessel's `sealed/` and `cad/` rests).";

/**
 * Cut face `face`'s bundle through the standing vessel's custody door and write it to `out`. `send` carries the
 * one frame; it answers null when no vessel answers.
 */
export async function cutBundleToFile(args: {
  readonly face:              number;
  readonly out:               string;
  readonly vesselCredentials: readonly Credential[];
  readonly bundleRoutes:      readonly SlotSpec[];
  readonly send:              (frame: CustodyFrame) => Promise<CustodyDoorAnswer | null>;
}): Promise<BackupLanded | BackupRefusal> {
  if (existsSync(args.out)) return { ok: false, reason: "out-exists", message: `a file already stands at ${args.out}; a cut never writes over one. Name a fresh path.` };
  const bundleKey = mintBundleKey();
  try {
    const tree = bindBundleRoutes(bundleKey, args.bundleRoutes);
    const a = await args.send({ op: "backup", credentials: args.vesselCredentials, face: args.face, key: hex(bundleKey) });
    if (a === null) return { ok: false, reason: "daemon-unreachable", message: "the vessel stopped answering before the cut landed; no file was written" };
    if (typeof a["sealedBody"] !== "string") {
      const refusal = a["refusal"] as { reason?: string; attemptsLeft?: number } | undefined;
      return {
        ok: false, reason: refusal?.reason ?? "refused",
        message: typeof a["errorMessage"] === "string" ? a["errorMessage"] : "the vessel refused the cut; no file was written",
        ...(typeof refusal?.attemptsLeft === "number" ? { attemptsLeft: refusal.attemptsLeft } : {}),
      };
    }
    const bytes = encodeFaceBundle(tree, Uint8Array.from(Buffer.from(a["sealedBody"], "base64")));
    // Owner-only, and never over a file that appeared since the check above.
    writeFileSync(args.out, bytes, { mode: 0o600, flag: "wx" });
    return {
      ok: true, out: args.out, bytes: bytes.length, slots: tree.slots.length,
      face: a["face"] as BackupLanded["face"], holds: (a["holds"] ?? []) as FaceBundleHolding[], carries: a["carries"] as BackupLanded["carries"],
    };
  } finally { bundleKey.fill(0); }
}

/** The lines a landed cut prints: the file, the face, each bag and version the bundle holds, and the half it lacks. */
export function backupLines(landed: BackupLanded): string[] {
  const lines = [
    `cut: face h${landed.face.handleIndex} (root ${landed.face.verifyingKey.slice(0, 16)}…) rests sealed in ${landed.out} (${landed.bytes} bytes, ${landed.slots} route(s)).`,
    `  standing: the root, its roster line, ${landed.carries.keyEvents} key event(s), ${landed.carries.faceProofKeys} face proof key(s), ${landed.carries.handleBookRecords} handle-book record(s)` +
      `${landed.carries.petname ? ", its pet-name" : ""}${landed.carries.handle ? ", its declared Handle" : ""}` +
      `${landed.carries.guardians > 0 ? `, the guardian set its key history commits (${landed.carries.guardians} guardian key(s))` : ""}.`,
    "  never in a bundle: a veil key, a vessel key, a seat, or a row of another face. A restore takes a NEW seat.",
  ];
  if (landed.holds.length === 0) {
    lines.push("  memory: no content key. This vessel counted and held none for this face at the cut.");
  } else {
    lines.push(`  memory: ${landed.holds.length} key version(s). The bundle opens every surviving value sealed under each, values written after this cut included:`);
    for (const h of landed.holds) lines.push(`    ${h.bagId}  version ${h.keyVersion.slice(0, 16)}…  (founding ${h.founding.slice(0, 16)}…)`);
    lines.push("  it opens no version minted after this cut: cut again after a key roll to cover the newer span.");
  }
  lines.push(`  ${SEALED_BYTES_LINE}`);
  lines.push("  whoever holds this file AND one of its routes restores this face onto a vessel of their own. Keep the two apart.");
  return lines;
}
