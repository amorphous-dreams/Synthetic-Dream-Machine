/**
 * face-lend — THE LEND WATCH and THE MOUNT'S ONE LIFE, the vessel's half of each face's lifecycle over its custody.
 *
 * The watch sends messages to the face actors (`face-lifecycle`) and never waits on a face's work. On every custody event it reads
 * the served set: a lit sibling the lend left out closes; one whose custody opening moved closes and lights again (one mailbox, so
 * the relight always lands under a fresh opening); a served face neither mounted, lit nor named closing by its pūlama lights.
 *
 * THE MOUNT LIVES ITS ONE LIFE TOO. Its actor reads lit for the composition from the composition's own turn (its island entry is
 * the composition's, so no worker drop): the door gates its work and its visits through it, and a close (a whole lock, a pūlama's)
 * reaches it from the first frame on. Its custody opening lands as its read does. The mount closes at its custody's word, and the
 * vessel stands again (`mountClosed`):
 *   - a pūlama's `closing` closes it (its saves drain under its standing session) before the vessel answers `face.closed`;
 *   - a forced lock the mount never heard asked (the lend leaves it out) closes it at the next standing.
 * A lock whose close took the mount dark and then did not lock its key releases it: while its key still stands open, the mount
 * reads lit again (no lend relights a mount).
 * Meme: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-lit-set
 */
import type { FaceLives } from "./face-lifecycle.js";
import { unlitServedFaces } from "./joined-face-auth.js";

/** What the watch reads and asks of the vessel and its custody. */
export interface FaceLendPorts {
  readonly faceLife: Pick<FaceLives, "lit" | "close" | "custodyOf" | "state" | "adopt" | "noteCustody">;
  /** The face this composition mounts lit, or null at the floor (no lend watch runs there). */
  readonly mount: number | null;
  /** The ordinals the custody serves now (the lend); a fault skips this sweep. */
  readonly served: () => Promise<number[]>;
  /** The custody ids the pūlama names closing now. */
  readonly closingAtSource: () => readonly string[];
  /** A face's custody id, kept from its light past its dark. */
  readonly custodyIdOf: (ordinal: number) => string | undefined;
  /** The custody opening a face stands under now, or null. */
  readonly custodyOpeningNow: (ordinal: number) => string | null;
  /** Read and keep a face's custody id; its custody opening now. */
  readonly noteCustody: (ordinal: number) => Promise<string | null>;
  /** One face's standing at its custody, by ordinal or custody id; null where none reads. */
  readonly faceStanding: (face: { readonly ordinal: number } | { readonly fcid: string }) => Promise<{ readonly ordinal: number; readonly fcid: string; readonly unlocked: boolean } | null>;
  /** The second phase: this vessel's face actor reached closed; the pūlama locks once every session it told answered. */
  readonly faceClosed?: (fcid: string, opening: string | null) => Promise<void>;
  readonly lightFace: (ordinal: number) => Promise<void>;
  /** The mount closed at its custody's word: the vessel stands again (main recomposes, once). */
  readonly mountClosed: () => void;
  readonly log: (line: string) => void;
}

export interface FaceLend {
  /** Read the served set once and send each face its message. */
  sweep(): Promise<void>;
  /** A pūlama asks a lent face to close: close it through its actor, then answer `face.closed`. */
  closing(fcid: string, opening: string | null): Promise<void>;
  /** A lock's hold lifted: a mount its close took dark reads lit again while its key stands open. */
  release(ordinal: number): Promise<void>;
}

const why = (e: unknown): string => e instanceof Error ? e.message : String(e);

export function faceLend(ports: FaceLendPorts): FaceLend {
  const { faceLife, mount } = ports;
  const adoptMount = (): void => {
    if (mount === null) return;
    faceLife.adopt(mount, { atomKey: null, custody: null });
    void ports.noteCustody(mount).then((custody) => faceLife.noteCustody(mount, custody), () => {});
  };
  // The adoption lands in the composition's own turn.
  adoptMount();

  return {
    async sweep() {
      if (mount === null) return;
      let served: number[];
      try { served = await ports.served(); } catch { return; }
      const closingAtSource = new Set(ports.closingAtSource());
      for (const ordinal of faceLife.lit()) {
        if (ordinal === mount) {
          // THE MOUNT HEARS A LOCK IT NEVER WAS ASKED TO CLOSE FOR (a forced lock): it closes through its actor, and the vessel stands again.
          if (!served.includes(ordinal)) void faceLife.close(ordinal, "its custody locked it").then(ports.mountClosed, (e: unknown) => ports.log(`[lit-set] the mount did not close whole: ${why(e)}`));
          continue;
        }
        if (!served.includes(ordinal)) { void faceLife.close(ordinal, "the lend left it").catch(() => {}); continue; }
        const at = faceLife.custodyOf(ordinal), now = ports.custodyOpeningNow(ordinal);
        if (at !== null && now !== null && now !== at) {
          void faceLife.close(ordinal, "its custody opening moved").catch(() => {});
          void ports.lightFace(ordinal);
        }
      }
      for (const ordinal of unlitServedFaces(served, mount, new Set(faceLife.lit()))) {
        const fcid = ports.custodyIdOf(ordinal);
        if (fcid !== undefined && closingAtSource.has(fcid)) continue;
        if (faceLife.state(ordinal).kind !== "dark") continue;
        void ports.lightFace(ordinal).catch((e: unknown) => ports.log(`[lit-set] the served face h${ordinal} did not light: ${why(e)}`));
      }
    },
    async closing(fcid, opening) {
      const standing = await ports.faceStanding({ fcid }).catch(() => null);
      // A drain that faults rejects here: the vessel answers no `face.closed`, so the key never locks over unsealed saves.
      if (standing !== null) await faceLife.close(standing.ordinal, "the pūlama closes it", { custody: opening });
      await ports.faceClosed?.(fcid, opening);
      // THE MOUNT CLOSED AT ITS PŪLAMA'S WORD: its saves drained under its own session, and the vessel stands again.
      if (standing !== null && standing.ordinal === mount) ports.mountClosed();
    },
    async release(ordinal) {
      if (ordinal !== mount) return;
      const at = faceLife.state(mount);
      if (at.kind !== "dark" || at.held) return;
      // Only while its key stands open: a lock that landed leaves the mount dark, and the vessel stands again by its own road.
      const standing = await ports.faceStanding({ ordinal: mount }).catch(() => null);
      if (standing?.unlocked !== true) return;
      ports.log(`[lit-set] the lock of the mount h${mount} did not lock its key; the mount reads lit again`);
      adoptMount();
    },
  };
}
