/**
 * persona-kel-ring — the node holder that stands the per-Nexus persona-KEL BOARD live on the main thread.
 *
 * It materializes the always-carried KEL board (mesh deterministic-doc `personaKelBoardDocUrl`) under its
 * deterministic id, folds every persona's events through the ONE reader (`foldPersonaContests`, as
 * `personaKelFoldForPrefix` reads a board) and RE-FOLDS on every board-doc change — so a rotation propagated
 * across the mesh takes on the next sync (the identifier→head mapping saturates by carry-contract, bounded by
 * sync-latency, NEVER a global now). The board reads a LOCAL replica: a prefix the replica has not yet synced
 * surfaces a null head, and the Binding-Gate walk denies.
 *
 * The holder serves TWO reads:
 *   · chainForPrefix(prefix) — EVERY event the board holds under one persona, the verified inception first, then
 *     seq ascending: the transport read the boot threads to the gate doors (daemonAuth.personaKel.chain). Each door
 *     folds it again through the one reader, so the events that reader sets aside reach the door and it NAMES them
 *     (`unreadable`) rather than meet a chain the holder already cleaned. Transport, not trust.
 *   · headOpKeyForPrefix(prefix) — the head op-key of the lineage that verifies (structural + every rotation
 *     quorum), or null where nothing verifies, the replica holds nothing, or the KEL forks (fail-closed).
 *
 * FAILS CLOSED: a board that never resolves (cold boot, sync not yet landed) leaves the fold map empty, so every
 * prefix resolves to a null head — a KEL that cannot reach a head DENIES, it never opens an allow path. Junk on
 * the board moves no head: only an event that verifies competes for a seat.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/persona-kel-ring
 */

import type { DocHandle, Repo } from "@automerge/automerge-repo";
import {
  type LarDoc,
  type PersonaKelEvent,
  type PersonaKelFold,
  foldPersonaContests,
  headOpKey,
  materializeSharedLarDoc,
  personaKelBoardDocUrl,
  personaKelEventsFromBoard,
} from "@lararium/mesh";

/**
 * ── THE CLIMB'S CARRY MOVED TO MESH, and the reason reads as a MEASUREMENT rather than tidying ────
 *
 * The carry reaches nothing but a Repo and mesh's own board reader, so it was platform-blind from the day
 * it was written — and housing it on THIS shore is what kept the browser leaf from composing it. Measured:
 * `open-browser-vessel` stands the SAME fail-closed Binding Gate ("a chain the replica does not carry HALTS
 * the boot") and could not import this function, so a whole vessel class stood brickable on the walk this
 * function exists to cure. The body now lives at `@lararium/mesh` → `persona-kel-climb`, beside
 * `climbNexusBoards`, whose header already vowed that both shores compose the identical call.
 *
 * Re-exported HERE so the node boot's import and its vectors keep naming one door. The ruling, the
 * refusals and the at-boot-not-at-the-rite reasoning live in the mesh module's header — read it there.
 */
export { carryPersonaKelUpTheGradient, type PersonaKelCarry } from "@lararium/mesh";

export interface PersonaKelRingHolder {
  /** Resolves once the board has materialized + the first fold has run — boot AWAITS this before it reads a chain. */
  readonly ready: Promise<void>;
  /** Every event the board holds under one persona prefix — the verified inception first, then seq ascending —
   *  or null when the local replica carries none. UNVERIFIED: each gate door folds it again through the one reader
   *  and names what that reader sets aside. This is the transport read the boot path threads into daemonAuth. */
  chainForPrefix(prefix: string): readonly PersonaKelEvent[] | null;
  /** The head op-key of the lineage that verifies for one prefix (structural + every rotation quorum), or null
   *  fail-closed where nothing verifies, the replica carries nothing, or the KEL forks. */
  headOpKeyForPrefix(prefix: string): Promise<string | null>;
  /** Re-read the board entries and re-fold the chain map. Idempotent; safe to call any time. */
  refold(): void;
  /** Detach the board-doc change listener (graceful shutdown). */
  dispose(): void;
}

/**
 * Stand the persona-KEL ring holder. `nexusPubkey` is the node's own gate key (its Nexus key — the same key
 * browsers pass as relayGatePubKey), so the board id is a pure function of the Nexus and every island member
 * resolves the identical board with no mint-race. The board resolves asynchronously; `ready` gates the first
 * read (a cold board folds to an empty map — every prefix denies, correctly).
 */
export function makePersonaKelRingHolder(opts: { repo: Repo; nexusPubkey: string }): PersonaKelRingHolder {
  const { repo, nexusPubkey } = opts;

  // Per prefix, the board's events and the one reader's fold of them — swapped whole on each refold (no
  // partial-map window a walk could read).
  let reads: Map<string, { readonly events: readonly PersonaKelEvent[]; readonly fold: PersonaKelFold }> = new Map();

  let boardHandle: DocHandle<LarDoc> | null = null;
  let onChange: (() => void) | null = null;

  const refold = (): void => {
    // Grouped per prefix and folded through the one reader exactly as `personaKelFoldsFromBoard` folds a board; the
    // holder keeps the heap beside the fold so the doors meet what the reader set aside.
    const byPrefix = new Map<string, PersonaKelEvent[]>();
    for (const e of personaKelEventsFromBoard(boardHandle?.doc())) byPrefix.set(e.prefix, [...(byPrefix.get(e.prefix) ?? []), e]);
    const next = new Map<string, { events: PersonaKelEvent[]; fold: PersonaKelFold }>();
    for (const [prefix, heap] of byPrefix) {
      const fold = foldPersonaContests([...heap].sort((a, b) => a.seq - b.seq));
      // The verified lineage leads its own seats, so a door that reads the inception off `chain[0]` reads the one
      // that verifies, never a junk copy the board holds beside it. The sort is stable, so that order holds.
      const lineage = new Set(fold.kel);
      const events = [...fold.kel, ...heap.filter((e) => !lineage.has(e))].sort((a, b) => a.seq - b.seq);
      next.set(prefix, { events, fold });
    }
    reads = next;
  };

  const ready = (async (): Promise<void> => {
    try {
      const handle = await materializeSharedLarDoc(repo, personaKelBoardDocUrl(nexusPubkey), "board:persona-kel");
      boardHandle = handle;
      onChange = () => refold();
      handle.on("change", onChange);
      refold();
    } catch (err) {
      // Fail-closed: a resolve fault leaves the empty map standing (every prefix denies — a KEL that cannot
      // reach a head never opens an allow path). The boot path re-checks the chain it needs and halts on absence.
      console.warn(`[persona-kel-ring] board resolve skipped — the KEL reads no heads (deny): ${(err as Error)?.message ?? err}`);
    }
  })();

  return {
    ready,
    chainForPrefix(prefix: string): readonly PersonaKelEvent[] | null {
      const events = reads.get(prefix)?.events;
      return events && events.length > 0 ? events : null;
    },
    async headOpKeyForPrefix(prefix: string): Promise<string | null> {
      const fold = reads.get(prefix)?.fold;
      // No lineage on the local replica, or two verified events at one seat: no head (fail-closed). A fork leaves
      // the head in doubt, and no reader settles it by order.
      if (!fold || fold.kel.length === 0 || fold.fork) return null;
      // Verify structure AND every rotation quorum before returning a head — a gate trusts a head only when the
      // whole lineage stands. Also bind the lineage to the asked prefix (a mis-filed event never speaks for it).
      if (fold.kel[0]!.prefix !== prefix) return null;
      return headOpKey(fold.kel, { verifyQuorums: true });
    },
    refold,
    dispose(): void {
      if (boardHandle && onChange) boardHandle.off("change", onChange);
      boardHandle = null;
      onChange = null;
    },
  };
}
