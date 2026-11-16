/**
 * swarm-lei-rite — the powers a lei may carry, one per lei.
 *
 * A lei names its rite, and the rite rides everything that identifies the lei: its signed body, the head its co-sign names
 * (`swarmLeiHead`), the title it rests at (`lei/<rite>/<branch>/<cid>`) and the ward verb a second device answers under
 * (`ward-<rite>-lei`, for a rite that co-signs). So a lei issued for one power never reads, co-signs or spends as another.
 *
 * `push` sends a branch out; `kukulu` raises the vessel again around its hearth (a re-stand); `keep` lays the house's authored
 * memory, cut as a carry bundle, into one of the operator's bound workspaces (its `branch` names that workspace, its head and
 * tree the bundle's id).
 *
 * THE LIST STAYS CAPPED at the acts the boot core verifies. It names powers, never conditions: a rite carries no argument,
 * and the field grows into no policy language.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
export const SWARM_LEI_RITES = ["push", "kukulu", "keep"] as const;
export type SwarmLeiRite = typeof SWARM_LEI_RITES[number];
export type WardLeiVerb = `ward-${SwarmLeiRite}-lei`;

export const isSwarmLeiRite = (x: unknown): x is SwarmLeiRite => typeof x === "string" && (SWARM_LEI_RITES as readonly string[]).includes(x);

/**
 * THE CO-SIGN WEIGHS REACH. A second device of the face co-signs an act whose effect leaves the device: a `push` sends a
 * branch out, so a push lei waits on its co-sign; a `kukulu` raises the vessel again where it stands, so a kukulu lei waits on
 * none; a `keep` writes into a workspace on this device, a directory the operator bound by hand, so a keep lei waits on none.
 * The ward guards the stringing of every lei, whatever its rite.
 */
export const SWARM_LEI_COSIGNED_RITES: readonly SwarmLeiRite[] = ["push"];
export const leiRiteCosigns = (rite: SwarmLeiRite): boolean => SWARM_LEI_COSIGNED_RITES.includes(rite);

/** The ward verb a lei of this rite asks its co-sign under, where its rite co-signs (`leiRiteCosigns`). */
export const wardLeiVerb = (rite: SwarmLeiRite): WardLeiVerb => `ward-${rite}-lei`;
