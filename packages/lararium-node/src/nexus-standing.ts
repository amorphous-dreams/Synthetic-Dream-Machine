/**
 * nexus-standing (node shore) — ONE statement of the inputs `nexusIdentity` reads on this shore.
 *
 * ══ WHY THIS FILE EXISTS ═════════════════════════════════════════════════════════════════════════
 *
 * `91ce09afb` ruled that EVERY per-Nexus board keys on the NEXUS, and wired it at the boot and at
 * the two founding/admit doors in `init.ts`. The boot's own comment beside that wiring names the
 * hazard the ruling leaves behind:
 *
 *   "ONE statement of the inputs … A second copy of this object would drift from the first the day
 *    a term is added, and the carry would then read a gradient the boot does not stand on."
 *
 * The CLI verbs were the second copy. They did not restate the object — they skipped it, reading
 * their per-Nexus boards at `loadVesselVerifyingKey` instead. That spelling is the vessel's OWN key,
 * which coincides with the resolved island at exactly ONE point on the gradient (`own`) and nowhere
 * above it. A vessel that CLIMBED reads the private board beneath its charter island, and it works
 * today only because `carryPersonaKelUpTheGradient` COPIES — it writes the destination and never
 * unlinks the source, so the lower board keeps its chain. A latent read at the wrong key, held alive
 * by copy semantics one refactor away.
 *
 * ══ WHAT A CALLER GETS, AND WHAT IT DOES NOT ═════════════════════════════════════════════════════
 *
 * `nodeNexusStandsAt` gathers the four disk/environment facts; `nodeNexusIsland` resolves them to the
 * island a per-Nexus board keys on. Both read the SAME sources in the SAME precedence the boot reads,
 * so a verb resolving through here lands on the board the boot landed on — by composition rather
 * than by a restated constant.
 *
 * IT GRANTS NOTHING. An island is a NAME a board keys on, never a capability: resolving one admits
 * nobody, signs nothing and moves no bytes. Standing ⊥ capability holds here exactly as at the face.
 *
 * IT DOES NOT SETTLE `anchorGateKey`'s OWN PRECEDENCE for a verb with a CLI override. The boot reads
 * `opts.joinGatePubKey` ahead of the environment; a verb with no such flag passes `null` and the
 * environment and the hearth pin decide, in the boot's order.
 */

import { nexusIdentity, nexusScopeOrThrow, realmIdOfCharter, type NexusIdentityAt, type NexusIdentity } from "@lararium/mesh";

import { readNexusDoc, nexusCharterStands } from "./nexus-doc.js";
import { readHearthDialPin } from "./hearth-dial-pin.js";
import { larSealHome, larBootstrapPath } from "./vessel-paths.js";

/**
 * The four facts, read off THIS vessel's disk and environment.
 *
 * `ownVesselKey` rides in rather than being read here, because the two shores that hold it hold it
 * differently — the boot has already loaded a vessel identity, a CLI verb loads a verifying key from
 * a storage dir — and a second loader here would be a second custody path over key material.
 */
export function nodeNexusStandsAt(opts: {
  readonly ownVesselKey: string;
  /** A CLI/boot override for the anchor gate, read AHEAD of the environment. Null at a verb with no flag. */
  readonly joinGatePubKey?: string | null;
  /** The seal home to read the charter from. Defaults to this vessel's own. */
  readonly sealHome?: string;
  /** The bootstrap the hearth dial pin rides in. Defaults to this vessel's own. */
  readonly bootstrapPath?: string;
}): NexusIdentityAt {
  const sealHome  = opts.sealHome ?? larSealHome();
  const hearthPin = readHearthDialPin(opts.bootstrapPath ?? larBootstrapPath());
  const ownGenesis       = realmIdOfCharter(readNexusDoc(sealHome));
  const ownCharterStands = nexusCharterStands(sealHome);
  // A vessel admitted onto a climbed founder holds no charter RECORD of its own (`ownGenesis`/
  // `ownCharterStands` both read empty/false) — its admit instead carried a SNAPSHOT of the founder's
  // resolved island (hearth-dial-pin.ts: `islandKind`/`islandScope`). Substitute the pinned genesis ONLY
  // when this vessel's own read is silent, and ONLY for a `charter` pin: an `own`/`anchor` pin's scope
  // already IS the gate key the `anchorGateKey` branch below carries, so nothing changes there. Gating on
  // "own read silent" preserves the torn-charter refusal — `ownCharterStands: true` with an unreadable
  // `ownGenesis` still reads torn, never falls back to a pin that could paper over a genuine tear.
  const pinnedGenesis = (!ownGenesis && !ownCharterStands && hearthPin?.islandKind === "charter")
    ? hearthPin.islandScope
    : null;
  return {
    genesisEpochCid: ownGenesis ?? pinnedGenesis ?? null,
    charterStands:   ownCharterStands,
    anchorGateKey:   opts.joinGatePubKey ?? process.env["LAR_JOIN_GATE"] ?? hearthPin?.gatePubKey ?? null,
    ownVesselKey:    opts.ownVesselKey,
  };
}

/**
 * The island an ADMITTED JOINEE resolves for its inception, from the payload its admit carried — the
 * founder's RESOLVED NexusIdentity at mint time (`kind`/`scope`, hearth-dial-pin.ts), fed through the
 * SAME `nexusIdentity` ruling the boot composes: a `charter` kind re-enters as a genesis epoch (every
 * charter holder derives the identical scope, by construction); any other kind — today `own`/`anchor`,
 * and an absent kind on an older payload — resolves through the anchor branch exactly as before, keyed
 * on the founder's own gate key. That is not a fallback of convenience: at every point on the gradient
 * below a charter, the founder's device IS the anchor its joinee dials (the fleet model), so the gate
 * key already names the right board there.
 */
export function admittedJoineeIsland(opts: {
  readonly hearthGatePubKey?:  string | null | undefined;
  readonly hearthIslandKind?:  string | null | undefined;
  readonly hearthIslandScope?: string | null | undefined;
  readonly ownVesselKey:       string;
}): string {
  return nexusScopeOrThrow(
    opts.hearthIslandKind === "charter" && opts.hearthIslandScope
      ? nexusIdentity({ genesisEpochCid: opts.hearthIslandScope, ownVesselKey: opts.ownVesselKey })
      : nexusIdentity({ anchorGateKey: opts.hearthGatePubKey ?? null, ownVesselKey: opts.ownVesselKey }),
  );
}

/** The resolved standing — the `kind`, the `scope`, and the `reading` an operator sees in a log line. */
export function nodeNexusStanding(opts: Parameters<typeof nodeNexusStandsAt>[0]): NexusIdentity {
  return nexusIdentity(nodeNexusStandsAt(opts));
}

/**
 * The island a per-Nexus board keys on, for THIS vessel, as the boot resolves it.
 *
 * FAIL-CLOSED: a charter that STANDS and reads TORN refuses here (`nexusScopeOrThrow`) rather than
 * silently falling back to the vessel key — a fallback would key a board on a name the boot never
 * stands on, which is the whole defect this module exists to close.
 */
export function nodeNexusIsland(opts: Parameters<typeof nodeNexusStandsAt>[0]): string {
  return nexusScopeOrThrow(nodeNexusStanding(opts));
}
