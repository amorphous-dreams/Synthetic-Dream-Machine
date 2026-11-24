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
  /** The ordinal whose kept custody id names `fcid`, or undefined. */
  readonly ordinalOf?: (fcid: string) => number | undefined;
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

/**
 * THE ISLAND'S FIRST OPEN ADOPTS A FACE IT LIT before any await: a pūlama's close landing in the custody read's gap finds the
 * actor (and closes it); the custody opening lands as its read does.
 */
export async function adoptFirstLit(faceLife: Pick<FaceLives, "adopt" | "noteCustody">, ordinal: number, atomKey: string | null, noteCustody: (ordinal: number) => Promise<string | null>): Promise<void> {
  faceLife.adopt(ordinal, { atomKey, custody: null });
  faceLife.noteCustody(ordinal, await noteCustody(ordinal));
}

/** One face an open of the island composed with: its ordinal, its atom key and the opening it stood lit under. */
export interface ComposedFace { readonly ordinal: number; readonly atomKey: string; readonly opening: string }

/**
 * THE ISLAND'S REFUSAL OF A MANIFEST FACE REACHES THAT FACE'S OWN LIFE (`daemon:face-settled`, op `composed`): the island
 * names the face by its atom key, and this maps it to the ordinal that open composed, under the opening it composed. A key the
 * open never carried changes nothing; a face that closed and lit again since lives under another opening, and its actor
 * hears nothing (`composeRefused`).
 */
export function composeRefusalHearing(manifest: readonly ComposedFace[], faceLife: Pick<FaceLives, "composeRefused">): (atomKey: string, reason: string) => void {
  const bare = (key: string): string => key.toLowerCase().replace(/^0x/, "");
  return (atomKey, reason) => {
    for (const face of manifest) if (bare(face.atomKey) === bare(atomKey)) faceLife.composeRefused(face.ordinal, reason, { opening: face.opening });
  };
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

/**
 * Whether the custody opening a face lives under came AFTER `asked` (the opening a pūlama's close names): both read
 * `<boot nonce>:<n>` from one holder, so the same nonce orders them by `n`. Anything else reads not-newer.
 */
export function openingNewer(lives: string, asked: string): boolean {
  const at = (o: string): { nonce: string; n: number } | null => {
    const cut = o.lastIndexOf(":");
    const n = Number(o.slice(cut + 1));
    return cut > 0 && Number.isSafeInteger(n) ? { nonce: o.slice(0, cut), n } : null;
  };
  const a = at(lives), b = at(asked);
  return a !== null && b !== null && a.nonce === b.nonce && a.n > b.n;
}

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
      // THE FACE BY ITS KEPT CUSTODY ID FIRST, then the custody's read. A read that faults answers nothing: no `face.closed`
      // lands for a face this vessel could not name, so the key never locks over a life it may still hold.
      const ordinal = ports.ordinalOf?.(fcid) ?? (await ports.faceStanding({ fcid }))?.ordinal ?? null;
      if (ordinal !== null) {
        // A LIFE UNDER A LATER OPENING answers nothing: the close names a life other than the one this vessel holds, and its answer could
        // lock the key under the life it does. A life under the named opening, an earlier one or one unread closes whole.
        const lives = faceLife.custodyOf(ordinal);
        if (lives !== null && opening !== null && openingNewer(lives, opening)) {
          ports.log(`[lit-set] the pūlama's close of h${ordinal} names an opening before the one it lives under; no face.closed answers`);
          return;
        }
        // A drain that faults rejects here: the vessel answers no `face.closed`, so the key never locks over unsealed saves.
        await faceLife.close(ordinal, "the pūlama closes it");
      }
      await ports.faceClosed?.(fcid, opening);
      // THE MOUNT CLOSED AT ITS PŪLAMA'S WORD: its saves drained under its own session, and the vessel stands again.
      if (ordinal !== null && ordinal === mount) ports.mountClosed();
    },
    async release(ordinal) {
      if (ordinal !== mount) return;
      const at = faceLife.state(mount);
      if (at.kind !== "dark" || at.held) return;
      // Only while its key stands open: a lock that landed leaves the mount dark, and the vessel stands again by its own road.
      const standing = await ports.faceStanding({ ordinal: mount }).catch(() => null);
      if (standing?.unlocked !== true) return;
      // The read awaited: a close, a hold or another adoption may have landed meanwhile, so the mount must still read dark, unheld.
      const now = faceLife.state(mount);
      if (now.kind !== "dark" || now.held) return;
      ports.log(`[lit-set] the lock of the mount h${mount} did not lock its key; the mount reads lit again`);
      adoptMount();
    },
  };
}
