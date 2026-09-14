/**
 * persona-kel-ring — the node holder that stands the per-Nexus persona-KEL BOARD live on the main thread.
 *
 * It materializes the always-carried KEL board (mesh deterministic-doc `personaKelBoardDocUrl`) under its
 * deterministic id, keeps a per-prefix chain map folded from the board entries, and RE-FOLDS on every
 * board-doc change — so a rotation propagated across the mesh takes on the next sync (the identifier→head
 * mapping saturates by carry-contract, bounded by sync-latency, NEVER a global now). The board reads a LOCAL
 * replica: a prefix the replica has not yet synced surfaces a null head, and the Binding-Gate walk denies.
 *
 * The holder serves TWO reads:
 *   · chainForPrefix(prefix) — the RAW seq-sorted key-event-log for one persona, handed to the worker at boot
 *     (threaded via daemonAuth.personaKel.chain). The worker RE-VERIFIES it — this is transport, not trust.
 *   · headOpKeyForPrefix(prefix) — the fully-verified current head op-key (structural + every rotation quorum),
 *     or null on a broken / unreachable / unquorumed chain (fail-closed). The live read a gate wants.
 *
 * FAILS CLOSED: a board that never resolves (cold boot, sync not yet landed) leaves the chain map empty, so
 * every prefix resolves to a null head — a KEL that cannot reach a head DENIES, it never opens an allow path.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/persona-kel-ring
 */

import type { DocHandle, Repo } from "@automerge/automerge-repo";
import {
  type LarDoc,
  type PersonaKelEvent,
  headOpKey,
  materializeSharedLarDoc,
  personaKelBoardDocUrl,
  personaKelChainForPrefix,
  personaKelChainsFromBoard,
  writePersonaKelEvent,
} from "@lararium/mesh";

/** What one carry did: how many events landed, and the island they were read off (null when none did). */
export interface PersonaKelCarry {
  readonly carried: number;
  readonly from:    string | null;
}

/**
 * ── CARRY THE PINNED CHAIN UP THE GRADIENT — the climb's cure ────────────────────────────────────
 *
 * `nexusScopeMoved` names the shape: connecting MOVES every per-Nexus board and nothing migrates. Most
 * of those boards degrade gracefully when they move — an empty antigen bans nobody. The persona-KEL
 * board does not: the Binding Gate REFUSES a boot whose pinned identifier reaches no head, so an
 * ordinary `found` → use → `nexus rite cabal` → restart walk leaves a vessel that never boots again
 * (measured live: island `079da8bf0e1efce59d…` (own) at founding, `epoch0-0790f04d937…` (charter) after,
 * and the halt every boot thereafter).
 *
 * So the boot CARRIES the chain onto the island it is about to walk, before the gate reads.
 *
 * ── AT BOOT, NOT AT THE RITE ─────────────────────────────────────────────────────────────────────
 * A rite-time carry would have to fire at every act that can move the island — seating a charter,
 * importing a partner's, rotating the chain, dialling an anchor, naming a scope outright — and the one
 * path nobody thought of is precisely the one that bricks a vessel. Worse, it cures nothing for a vessel
 * ALREADY climbed: that operator's only remedy reads `lares vessel found --force`, a re-found against a
 * vessel that did nothing wrong. Read at BOOT the climb is DERIVED from the state rather than enumerated
 * from the acts, and an already-bricked vessel cures itself on its next start.
 *
 * ── WHAT IT REFUSES TO DO ────────────────────────────────────────────────────────────────────────
 * · NEVER DESCENDS. The sources come from `nexusIslandsBelow`, which is empty for a vessel standing at
 *   its own island and empty for a TORN one — so a charter that merely vanished, or one that stands and
 *   reads torn, moves nothing. A torn island never even reaches here: `nexusScopeOrThrow` refuses first.
 * · NEVER LOWERS THE GATE. The events land VERBATIM — their own cids, their own rotation signatures —
 *   and `verifyPersonaKel` / `headOpKey` judge them exactly as on the board they came off. This moves
 *   bytes; it mints nothing, re-signs nothing, and admits nobody.
 * · NEVER EMPTIES THE SOURCE. A carry copies. The board below keeps its chain, so a vessel whose island
 *   resolution later reads lower still finds what it seated.
 * · IDEMPOTENT. A destination that already carries the chain returns `{ carried: 0, from: null }` and
 *   writes nothing, so the every-boot run has no second effect. The board is an additive CRDT keyed by
 *   `{prefix}/{seq}/{cid}`, so even a re-write would land byte-identically.
 */
export async function carryPersonaKelUpTheGradient(opts: {
  repo:         Repo;
  /** The island the boot RESOLVED — the destination board the Binding Gate is about to walk. */
  nexusPubkey:  string;
  /** The islands beneath it, high to low (`nexusIslandsBelow`). Empty means: nothing to carry from. */
  priorIslands: readonly string[];
  /** The identifier the daemon doc pins — the only chain a carry ever moves. */
  prefix:       string;
}): Promise<PersonaKelCarry> {
  const { repo, nexusPubkey, priorIslands, prefix } = opts;
  const nothing: PersonaKelCarry = { carried: 0, from: null };
  if (priorIslands.length === 0) return nothing;   // standing at the bottom of the gradient, or torn

  const board = async (island: string): Promise<DocHandle<LarDoc>> =>
    materializeSharedLarDoc(repo, personaKelBoardDocUrl(island), "board:persona-kel");

  const destination = await board(nexusPubkey);
  // ALREADY THERE — the ordinary case on every boot after the first one that carried.
  if (personaKelChainForPrefix(destination.doc(), prefix)) return nothing;

  for (const island of priorIslands) {
    let chain: readonly PersonaKelEvent[] | null = null;
    try { chain = personaKelChainForPrefix((await board(island)).doc(), prefix); }
    catch (err) {
      // A lower board that will not resolve names no source. Say so and keep walking down — a read
      // fault on one island must not decide the boot for the others.
      console.warn(`[persona-kel] the island below (${island.slice(0, 18)}…) would not open: ${(err as Error)?.message ?? err}`);
      continue;
    }
    if (!chain || chain.length === 0) continue;
    destination.change((draft) => { for (const event of chain!) writePersonaKelEvent(draft, event); });
    console.log(`[persona-kel] carried ${chain.length} event(s) for ${prefix.slice(0, 20)}… up the gradient `
              + `— from the island below (${island.slice(0, 18)}…) onto ${nexusPubkey.slice(0, 18)}…. `
              + "The island CLIMBED and the Binding Gate walks the board it resolved.");
    return { carried: chain.length, from: island };
  }
  // Nothing below carries it either. The gate reads an absent chain and HALTS, which is correct: a
  // pinned identifier nobody ever seated is a face this vessel cannot prove.
  return nothing;
}

export interface PersonaKelRingHolder {
  /** Resolves once the board has materialized + the first fold has run — boot AWAITS this before it reads a chain. */
  readonly ready: Promise<void>;
  /** The RAW seq-sorted chain for one persona prefix, or null when the local replica carries none. UNVERIFIED
   *  (the worker re-verifies) — this is the transport read the boot path threads into daemonAuth. */
  chainForPrefix(prefix: string): readonly PersonaKelEvent[] | null;
  /** The fully-verified current head op-key for one prefix (structural + every rotation quorum), or null
   *  fail-closed on a broken / unreachable / below-quorum chain. */
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

  // The folded per-prefix chains — swapped whole on each refold (no partial-map window a walk could read).
  let chains: Map<string, PersonaKelEvent[]> = new Map();

  let boardHandle: DocHandle<LarDoc> | null = null;
  let onChange: (() => void) | null = null;

  const refold = (): void => {
    chains = personaKelChainsFromBoard(boardHandle?.doc());
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
      const chain = chains.get(prefix);
      return chain && chain.length > 0 ? chain : null;
    },
    async headOpKeyForPrefix(prefix: string): Promise<string | null> {
      const chain = chains.get(prefix);
      if (!chain || chain.length === 0) return null;   // no chain on the local replica → no head (fail-closed)
      // Verify structure AND every rotation quorum before returning a head — a gate trusts a head only when
      // the whole lineage stands. Also bind the chain to the asked prefix (a mis-filed event never speaks for it).
      if (chain[0]!.prefix !== prefix) return null;
      return headOpKey(chain, { verifyQuorums: true });
    },
    refold,
    dispose(): void {
      if (boardHandle && onChange) boardHandle.off("change", onChange);
      boardHandle = null;
      onChange = null;
    },
  };
}
