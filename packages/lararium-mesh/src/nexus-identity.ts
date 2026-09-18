/**
 * nexus-identity — the scope a SHARED plane resolves under.
 *
 * PRIOR ART: this is a KERI Autonomic Identifier. An AID is "cryptographically derived from its very
 * first key event, called an inception event", and that event "MUST include the list of controlling
 * public keys and a signature threshold" — the same inputs `genesisSealEpochCid` hashes. The charter
 * chain already cites KERI for pre-rotation; the identifier it mints at genesis is the island's name.
 *
 * ── A NEXUS HOLDS NO KEY, SO NO VESSEL'S KEY NAMES IT ───────────────────────────────────────────
 * Three boards derive their address from one parameter spelled `nexusPubkey`, and each is documented
 * as per-island: "every island member resolves the one board with no mint-race". Passing a vessel's
 * own key satisfies that within one operator's fleet and splits the island across two contracted
 * operators, because each resolves a board only it can see.
 *
 * Choosing some operator's key instead would make the others read a vessel where they meant to read
 * their shared island. The island needs a name that belongs to none of them.
 *
 * ── AN ANCHOR NAMES ITS CONFEDERATION; A PEER RELATION HAS NO ANCHOR ────────────────────────────
 * A browser vessel is a LEAF-NODE lararium — a herm carrying operator/user CRDT caps — and it already
 * resolves `explicit ?? the gate key it dials ?? its own DID`, because "a node anchors its
 * confederation, so its gate key IS the Nexus key its leaves pass back". Composing a shared plane
 * under a FOREIGN key is therefore a witnessed shape, not a new one.
 *
 * That model covers a fleet and stops at a peer relation: when two sovereign operators contract,
 * neither dials the other, so neither gate key names their island. The charter does.
 *
 * ── AND A CHARTER CANNOT OUTRANK AN ANCHOR WHERE IT CANNOT EXIST ────────────────────────────────
 * A charter term ahead of an anchor term looks like it could move a leaf off the board its anchor
 * stands. It cannot, and the reason is structural rather than chosen: seating a charter, contracting
 * an operator, accepting carriage and flipping a posture all reach the SEAL HOME on disk, and a leaf
 * has none. A leaf supplies an anchor and no genesis, so the anchor term wins by construction — the
 * ordering only ever decides for a vessel that could hold both, which is a vessel that keeps a hearth.
 *
 * That is the operator/user seam in one line: an operator KEEPS a hearth and may declare where it
 * stands; a user WALKS the road and is told which shrine they arrived at. The household lararium
 * answers to its operator; the crossroads answers to whoever walks the road.
 *
 * ── THE GENESIS EPOCH IS THAT NAME ──────────────────────────────────────────────────────────────
 * `genesisSealEpochCid` content-addresses the seated key-set and the threshold, so every vessel
 * holding the charter derives the same value from public material, it names no vessel, and it
 * survives rotation because the genesis sits at the HEAD of the lineage rather than at its end.
 *
 * ── AND SHARING IS SAFE ONLY WHERE IT CANNOT WIDEN ──────────────────────────────────────────────
 * A shared scope belongs to a plane whose contents cannot enlarge a vessel's own authority:
 *   · WHO board       — carries no write-ACL, and a handle-card is valid only if signed by its own
 *                       nym, so an openly-appendable board stays forgery-proof and reading grants
 *                       nothing.
 *   · antigen (DENY)  — quorum-signed against the charter roster, and an entry whose signature does
 *                       not verify is ignored. A foreign ban can only TIGHTEN this vessel.
 *   · members (SHARED) — a stamp is a public contract into the Cabal, quorum-countersigned, so the
 *                       board records who stamped in. The record shares; the DECISION does not. Whether
 *                       this vessel carries for a given member is its own reading OVER that record, and
 *                       fusing the two is what would conscript it — an admit only ever WIDENS whom a
 *                       vessel carries for, and an operator consents at ONE epoch. ⚠ A stamp must be
 *                       signed by the PUBLIC HANDLE: a PersonaGroup root on a shared board correlates
 *                       one human's memberships by a key that also names their device-group.
 * The asymmetry carries the rule — a deny may be shared, an allow wants a fresh consent. A deny list
 * carries the anti-flickering property: once disallowed, never allowed again, so the set is MONOTONE and
 * replicates without total consistency. An allow set has no such property. Independently: CRDTs cannot
 * enforce global invariants, and a roster of who belongs IS one.
 *
 * ⚠ AND THE FIELD DISPUTES THE COMFORT IN THAT. Shared moderation lists are measured to carry no
 * selection criteria, to be binary, to grow only, and to make inclusion effectively permanent — a
 * ratchet that cannot un-ratchet is safe to ADD to and impossible to correct. They also sever third
 * parties who never joined the operator's threat model, and a widely-imported list becomes the global
 * registry the architecture removed. Sharing a deny wants EXPIRY, PROVENANCE, and defined MERGE
 * semantics; a quorum signature answers forgery and never legitimacy.
 */

/** `epoch0-` plus 64 hex — the shape `genesisSealEpochCid` mints. Anything else names no island. */
const GENESIS_RE = /^epoch0-[0-9a-f]{64}$/;

/** A gate key names an island only as hex — anything else addresses a board no peer resolves. */
const KEY_RE = /^[0-9a-f]{16,64}$/;

/**
 * ── AND THE TWO NULLS ANSWER UNDER DIFFERENT NAMES ──────────────────────────────────────────────
 * "This vessel stands in no Nexus" and "this vessel's Nexus reads TORN" are UNLIKE FACTS, and a
 * result that folds them together hands every caller one `scope` and lets a single `??` invert
 * fail-closed into fail-open (the pin-reader law: a default must STATE a fact, never LOSE one).
 *
 * So the result discriminates on `kind`, and only a `torn` reading withholds the scope outright:
 *   · `own`     — a STATED FACT. A vessel alone IS a Nexus of one, and its own key names it. Plausible.
 *   · `torn`    — a LOST FACT. Material that should name an island reads as no island at all. A vessel
 *                 that quietly kept its own board here would announce into a private room and call it
 *                 the crossroads: a split that reports as agreement. It carries NO scope, and
 *                 `nexusScopeOrThrow` refuses.
 */
export type NexusIdentity =
  | {
      /** How this vessel came by its island — an explicit call, a charter, an anchor, or standing alone. */
      readonly kind:    "explicit" | "charter" | "anchor" | "own";
      /** The value a shared plane addresses its board under. */
      readonly scope:   string;
      /** Whether that scope is an island shared with other operators, or this vessel standing alone. */
      readonly shared:  boolean;
      /** Whose island this is, so a caller never reads a private board as the shared one. */
      readonly reading: string;
    }
  | {
      /** Material that should name an island reads as none — the caller REFUSES rather than addressing. */
      readonly kind:    "torn";
      readonly scope?:  undefined;
      readonly shared?: undefined;
      readonly reading: string;
    };

/** Everything the island resolution reads — one shape, so a caller may narrow it term by term. */
export interface NexusIdentityAt {
    /** An island this caller already knows — never second-guessed. */
    explicitScope?:  string | null;
    /** The genesis epoch of a charter this vessel holds — a relation it CONSENTED to. */
    genesisEpochCid?: string | null;
    /**
     * Does a charter RECORD stand at this vessel's home, whatever it reads as? PRESENCE ⊥ READABILITY,
     * and the shore that owns the disk supplies it (`nexusCharterStands` on a node; structurally false on
     * a leaf, which keeps no seal home). TRUE beside an unreadable `genesisEpochCid` reads TORN — the
     * exact conflation `hearths.mem` #/crossings records as //the torn charter//, where one reader
     * answering null for both "no charter stands" and "a charter stands and reads torn" let a re-seat
     * re-genesis a rotated chain. A vessel that WAS serving an island must never descend to its own
     * board on a partition, a torn fence or a sync gap.
     */
    charterStands?:  boolean;
    /** The gate key of an anchor this vessel dials — a relay it happens to reach. */
    anchorGateKey?:  string | null;
    /** Does an admission/dial RECORD stand, whatever its key reads as? The anchor's PRESENCE ⊥ READABILITY. */
    anchorStands?:   boolean;
    ownVesselKey:    string;
}

/**
 * The island scope this vessel resolves shared planes under.
 *
 * An unreadable genesis is REFUSED rather than addressed: a board keyed by garbage mints cleanly and
 * stays empty, so the vessel would read a quiet private island as though it were the shared one — a
 * split that reports as agreement.
 */
export function nexusIdentity(at: NexusIdentityAt): NexusIdentity {
  const own      = at.ownVesselKey.trim().toLowerCase();
  const explicit = (at.explicitScope ?? "").trim().toLowerCase();
  const genesis  = (at.genesisEpochCid ?? "").trim().toLowerCase();
  const anchor   = (at.anchorGateKey ?? "").trim().toLowerCase();

  if (explicit.length > 0) {
    return { kind: "explicit", scope: explicit, shared: explicit !== own,
             reading: "this caller named its island outright, so nothing here infers one. A vessel that "
                    + "knows which Nexus it is composing for is the most reliable source there is." };
  }
  if (genesis.length > 0 && GENESIS_RE.test(genesis)) {
    return { kind: "charter", scope: genesis, shared: true,
             reading: `this vessel holds a charter, so its island is the genesis epoch that charter names `
                    + `(${genesis.slice(0, 18)}…) — derived alike by every holder and belonging to no operator. `
                    + "A charter OUTRANKS an anchor: it names a relation this vessel consented to, where an "
                    + "anchor names only a relay it reaches." };
  }
  // ── STATE 3, held apart: a Nexus this vessel KNOWS and cannot READ ─────────────────────────────
  if (genesis.length > 0 || at.charterStands === true) {
    return { kind: "torn",
             reading: "a charter STANDS at this vessel and its genesis epoch reads as no island — a torn fence, a "
                    + "half-written seat, a chain rotated past what this replica carries. This vessel therefore "
                    + "names NO scope. Keeping its own key here would descend a serving vessel to a private "
                    + "board on an accident: it would believe it published while every peer watched it vanish, "
                    + "and the announce plane would fail in silence. The gradient ratchets on INTENT — a vessel "
                    + "CLIMBS it by connecting and never DESCENDS it by a failure." };
  }
  if (anchor.length > 0 && KEY_RE.test(anchor)) {
    return { kind: "anchor", scope: anchor, shared: anchor !== own,
             reading: "this vessel holds no charter and dials an anchor, so it joins the island it crosses "
                    + "into: an anchor names its confederation by its gate key, and a leaf passes that key "
                    + "back to resolve the one board its anchor stands." };
  }
  if (anchor.length > 0 || at.anchorStands === true) {
    return { kind: "torn",
             reading: "an admission RECORD stands at this vessel and the anchor key it names reads as no key at "
                    + "all, so it names no island. This vessel names NO scope rather than falling to its own: a "
                    + "board addressed by a malformed scope mints clean and empty, and a vessel alone on one "
                    + "cannot tell that from agreement." };
  }
  // ── STATE 1: a PRIVATE NEXUS OF ONE — a stated fact, and stage one of a normal lifecycle ───────
  return { kind: "own", scope: own, shared: false,
           reading: "this vessel holds no charter and dials no anchor, so it stands as a PRIVATE NEXUS OF ONE "
                  + "and resolves its shared planes under its own key. Nothing failed here — standing a hearth "
                  + "up and connecting it to a Nexus LATER is a first-class flow, so this reads as stage one of "
                  + "an ordinary lifecycle. It serves nobody and nobody reads its board, which is coherent. The "
                  + "scope widens by an ACT — a charter seated, an anchor dialled." };
}

/**
 * The scope, or a REFUSAL — the one door a caller that must address a board walks through.
 *
 * A `torn` standing carries no scope, so this throws rather than handing back anything a `??` could
 * absorb. That refusal IS the cure: the caller stops loudly at the boot it cannot key, instead of
 * quietly composing a private board and calling it the crossroads.
 */
export function nexusScopeOrThrow(id: NexusIdentity): string {
  if (id.kind === "torn") throw new Error(`[nexus] the island reads TORN, so no board may be addressed — ${id.reading}`);
  return id.scope;
}

/**
 * The island an ADMITTED JOINEE resolves for its inception, from the payload its admit carried — the
 * founder's RESOLVED `NexusIdentity` at mint time (`kind`/`scope`, a SNAPSHOT), fed through this SAME
 * `nexusIdentity` ruling: a `charter` kind re-enters as a genesis epoch (every charter holder derives
 * the identical scope, by construction); any other kind — today `own`/`anchor`, and an absent kind on
 * an older payload — resolves through the anchor branch exactly as before, keyed on the founder's own
 * gate key. That is not a fallback of convenience: at every point on the gradient below a charter, the
 * founder's device IS the anchor its joinee dials (the fleet model), so the gate key already names the
 * right board there.
 *
 * PURE and PLATFORM-BLIND — every shore that mints or applies a carried admit composes it identically,
 * whether the joinee reads its admit off a node CLI payload file or a browser's `#admit=` carriage. It
 * lives here (not in a node-only module) precisely so the browser leaf can import it with no node
 * dependency, the same reason `DeviceAdmitPayload` itself lives in `@lararium/keyhive` rather than
 * `@lararium/node`.
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

/**
 * ── CONNECTING MOVES THE BOARD, so a connect is a MIGRATION and never a field assignment ────────
 *
 * A vessel that climbs from a private nexus of one to a seated charter re-keys every per-Nexus board
 * it stands on — crossroads, WHO, persona-KEL, antigen, carriage, vouch, edge-kāpae. Nothing carries
 * across on its own: the old board keeps every announce it ever held and the new one mints blank, so
 * books announced before the connect stay invisible to the island, and any peer still dialling the old
 * address reads a silence that looks exactly like a vessel going dark.
 *
 * DESCENDING wants the same act for the opposite reason. Leaving a Nexus, or a Nexus dissolving, is
 * LEGITIMATE — and unless it arrives as an explicit act it reads on the wire byte-identically to state
 * 3, a partition. An explicit departure is what makes "I left" distinguishable from "I cannot read my
 * island", which is the whole reason state 3 refuses instead of falling.
 *
 * THE CLIMB STANDS BUILT, and it took THREE acts rather than one (`nexus-board-climb`; `nexusIslandsBelow`
 * names every source). "Degrades gracefully" was the wrong reading for two of the seven boards:
 *   · CARRY, verbatim — persona-KEL (`carryPersonaKelUpTheGradient`, `persona-kel-climb`: the gate REFUSES
 *     rather than degrades, so a moved board took the vessel down rather than thinning it) · antigen (an
 *     empty deny set RE-ADMITS a Kapae'd presenter; the quorum epoch check
 *     makes the carry self-limiting) · edge-kāpae (an empty shadow board LOWERS EVERY SHADOW, and the board
 *     sits outside the federation gate, so no peer replica heals it).
 *   · RE-ANNOUNCE, re-derived — the crossroads realm-bag announce. It carries no signature a reader could
 *     re-check, so a copied row would launder a lapsed, equivocated or FOREIGN-REALM registration; the
 *     projection is recomputed from the realm doc's counted registrations instead.
 *   · DELIBERATELY NEITHER — WHO (a boot-time announce would DISCLOSE a face the operator published only to
 *     a private nexus of one; disclosure stays an act) · carriage (an allow wants a fresh consent at the new
 *     epoch, and a roster of who belongs is the one register the laws forbid) · vouch (unfederated, so a
 *     carried PARTIAL replica would become the whole board and price crossings off one vessel's view — the
 *     honest cure is federating it). `nexus-board-climb`'s header carries each reason in full.
 * BOTH SHORES NOW COMPOSE IT. The node boot wired it first; the browser leaf composed neither carry for as
 * long as the platform-blindness vow stood unmeasured, and a leaf halts at the SAME fail-closed gate on a
 * walk no less ordinary (found offline at a private nexus of one → configure the hearth the page dials →
 * reload). The leaf is the worse half: a node operator holds a re-found, a leaf's anchor key arrives from
 * the page's configuration. A leaf's gradient runs THREE rungs (own → anchor → explicit) and its crossroads
 * re-announce stands structurally inert, holding no charter and therefore no realm.
 * The explicit DEPARTURE stands UNBUILT — the sibling half, and the one that makes "I left" legible against
 * state 3. This names the remaining debt so a caller does not read the resolver as one.
 */
export function nexusScopeMoved(before: NexusIdentity, after: NexusIdentity): boolean {
  return before.kind !== "torn" && after.kind !== "torn" && before.scope !== after.scope;
}

/**
 * ── THE ISLANDS BELOW THIS ONE — a climb's migration SOURCES, ordered high to low ────────────────
 *
 * A vessel that climbs needs to know which LOWER board its material rode on, and the answer is not a
 * list: it is the SAME ranking `nexusIdentity` already states. So this re-runs the resolver with each
 * higher term WITHHELD and reads the lower islands back out of it. A term added to the ranking later
 * joins these sources by construction — a hand-written enumeration would escape it silently.
 *
 * ── CLIMB-ONLY, because the gradient ratchets on INTENT ──────────────────────────────────────────
 * A vessel standing at a SHARED island reads the private board beneath it; a vessel standing at its
 * OWN island reads NOTHING, and a TORN standing reads nothing either. That asymmetry IS the gradient
 * law in code. Were these sources bidirectional, a charter that merely VANISHED — a failure, never an
 * act — would carry a serving vessel's chain back onto its private board and let the boot report
 * success while every peer watched it go dark. Withheld instead, that vessel HALTS, which is the
 * honest answer: a vessel must climb by an act and never descend by an accident.
 *
 * The current island never appears among its own sources, and a collapsed reading (an anchor key that
 * IS the vessel's own key) names one island rather than two.
 */
export function nexusIslandsBelow(at: NexusIdentityAt): readonly string[] {
  const here = nexusIdentity(at);
  if (here.kind === "torn") return [];   // ③ names no island: nothing to carry, and nowhere to carry it

  // Withhold the terms from the top down. Each narrowing names the island this vessel would have stood
  // at with that term absent — which is exactly the island it DID stand at before the act that added it.
  const narrowings: readonly NexusIdentityAt[] = [
    { ...at, explicitScope: null },
    { ...at, explicitScope: null, genesisEpochCid: null, charterStands: false },
    { ...at, explicitScope: null, genesisEpochCid: null, charterStands: false, anchorGateKey: null, anchorStands: false },
  ];

  const below: string[] = [];
  const seen = new Set<string>([here.scope]);
  for (const narrowed of narrowings) {
    const lower = nexusIdentity(narrowed);
    if (lower.kind === "torn") continue;      // a narrowing that reads torn names no source
    if (seen.has(lower.scope)) continue;      // the current island, or a reading that collapsed onto one already named
    seen.add(lower.scope);
    below.push(lower.scope);
  }
  return below;
}
