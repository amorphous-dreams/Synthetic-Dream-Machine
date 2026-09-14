/**
 * persona-kel-climb — the ONE board of the climb that REFUSES rather than degrades, carried for EVERY shore.
 *
 * ── WHY THIS SITS IN MESH AND NOT ON A SHORE ─────────────────────────────────────────────────────
 * `nexus-board-climb` states the platform-blindness vow for the boards it moves: "a browser leaf climbing
 * from its own island to the anchor it dials composes the identical call." This carry held that same
 * property from the day it was written — it reaches nothing but a Repo and the mesh board reader — and it
 * sat on the NODE shore anyway, where no leaf could import it. A vow stated in one module and housed in
 * another's package is not a vow; measured, the leaf shore composed neither carry, and the Binding Gate
 * halts on a leaf byte-identically to the way it halted on a node. So the carry moves to the package both
 * shores already depend on, beside the climb it belongs to.
 *
 * ── CARRY THE PINNED CHAIN UP THE GRADIENT — the climb's cure ────────────────────────────────────
 * `nexusScopeMoved` names the shape: connecting MOVES every per-Nexus board and nothing migrates. Most of
 * those boards degrade when they move — an empty antigen bans nobody. The persona-KEL board does not: the
 * Binding Gate REFUSES a boot whose pinned identifier reaches no head, so an ordinary walk leaves a vessel
 * that never boots again.
 *
 *   · on a NODE: `vessel found` → use → `nexus rite cabal` → restart (measured live: island
 *     `079da8bf0e1efce59d…` (own) at founding, `epoch0-0790f04d937…` (charter) after, and the halt every
 *     boot thereafter).
 *   · on a LEAF: found offline at a PRIVATE NEXUS OF ONE → the operator configures the hearth it dials →
 *     restart. `nexusIdentity` resolves the ANCHOR, the KEL board re-keys to it, and the leaf's own gate
 *     (`open-browser-vessel`: "a chain the replica does not carry HALTS the boot") throws. A leaf is the
 *     WORSE case: the node operator holds `--force` and a re-found, while the leaf's anchor key arrives
 *     from the page's own configuration, so the operator has no knob at all — the vessel simply stops
 *     opening.
 *
 * So the boot CARRIES the chain onto the island it is about to walk, before the gate reads.
 *
 * ── AT BOOT, NOT AT THE RITE ─────────────────────────────────────────────────────────────────────
 * A rite-time carry would have to fire at every act that can move the island — seating a charter,
 * importing a partner's, rotating the chain, dialling an anchor, naming a scope outright — and the one
 * path nobody thought of is precisely the one that bricks a vessel. Worse, it cures nothing for a vessel
 * ALREADY climbed. Read at BOOT the climb is DERIVED from the state rather than enumerated from the acts,
 * and an already-bricked vessel cures itself on its next start.
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
 *
 * Platform-blind: rides ./deterministic-doc + ./persona-kel-board only. NO node: imports.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/nexus-identity
 */

import type { DocHandle, Repo } from "@automerge/automerge-repo";
import type { LarDoc } from "./base-doc.js";
import type { PersonaKelEvent } from "./persona-kel.js";
import { materializeSharedLarDoc, personaKelBoardDocUrl } from "./deterministic-doc.js";
import { personaKelChainForPrefix, writePersonaKelEvent } from "./persona-kel-board.js";

/** What one carry did: how many events landed, and the island they were read off (null when none did). */
export interface PersonaKelCarry {
  readonly carried: number;
  readonly from:    string | null;
}

/**
 * Carry the PINNED chain onto the island this boot resolved, reading only the islands BELOW it.
 *
 * The docblock above carries the whole ruling — read it before changing an argument here.
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
