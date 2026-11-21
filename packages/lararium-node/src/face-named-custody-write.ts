/**
 * face-named-custody-write — the vessel's answer to an island's veil-archive write: the bytes land in the row of the face
 * the island names, or nowhere.
 *
 * ── EACH ARCHIVE NAMES ITS FACE ─────────────────────────────────────────────────────────────────────
 * The island alone knows whose hive exported the bytes (the mounted face's or a lit sibling's), so it names that face's
 * PersonaGroup on every ask. The vessel never chooses a row for a faceless ask: a "current face" it holds moves with every
 * composition, while the island's seats and their rolls outlive the moment it was read. A face that stands shut takes no
 * write. The seal beneath (`persistVeilArchive`) proves the bytes restore that face's own identity, so a misnamed ask
 * writes nothing either; this door names the refusal and the would-be writer in the log.
 */
import { ArchiveIdentityMismatch } from "@lararium/keyhive";
import type { CustodyWriter } from "@lararium/mesh";

export interface FaceNamedCustodyWriteDeps {
  /** Whether a face (by PersonaGroup) stands open to take its own Archive now: the mounted face, or a lit sibling with a session. */
  readonly opens: (face: string) => boolean;
  /** The sealed writer of one face's veil-archive row. */
  readonly write: (bytes: Uint8Array, face: string) => Promise<void>;
  /** Where a refused seal names itself; defaults to the console. */
  readonly warn?: (line: string) => void;
}

/** The lift's custody writer over `deps`: a faceless ask refuses `face-not-named`, a shut face `face-not-open`. */
export function faceNamedCustodyWrite(deps: FaceNamedCustodyWriteDeps): CustodyWriter {
  const warn = deps.warn ?? ((line: string) => console.warn(line));
  return async (_carrier, bytes, face) => {
    if (typeof face !== "string" || face.trim() === "") throw new Error("face-not-named: the custody write names no face, so its Archive rests nowhere");
    if (!deps.opens(face)) throw new Error(`face-not-open: face ${face.slice(0, 8)}… stands shut, so its Archive rests nowhere`);
    try {
      await deps.write(bytes, face);
    } catch (error) {
      if (error instanceof ArchiveIdentityMismatch) {
        warn(`[custody] the veil archive for face ${face.slice(0, 8)}… refused: its bytes restore identity ${error.restored}…, not the face's own ${error.seed}…; the row stands unchanged`);
      }
      throw error;
    }
  };
}
