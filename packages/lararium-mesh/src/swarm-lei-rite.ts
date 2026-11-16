/**
 * swarm-lei-rite — the powers a lei may carry, one per lei.
 *
 * A lei names its rite, and the rite rides everything that identifies the lei: its signed body, the head its co-sign names
 * (`swarmLeiHead`), the title it rests at (`lei/<rite>/<branch>/<cid>`) and the ward verb a second device answers under
 * (`ward-<rite>-lei`). So a lei issued for one power never reads, co-signs or spends as another.
 *
 * `push` sends a branch out; `kukulu` raises the vessel again around its hearth (a re-stand).
 *
 * THE LIST STAYS CAPPED at the acts the boot core verifies. It names powers, never conditions: a rite carries no argument,
 * and the field grows into no policy language.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
export const SWARM_LEI_RITES = ["push", "kukulu"] as const;
export type SwarmLeiRite = typeof SWARM_LEI_RITES[number];
export type WardLeiVerb = `ward-${SwarmLeiRite}-lei`;

export const isSwarmLeiRite = (x: unknown): x is SwarmLeiRite => typeof x === "string" && (SWARM_LEI_RITES as readonly string[]).includes(x);

/** The ward verb a lei of this rite asks its co-sign under. */
export const wardLeiVerb = (rite: SwarmLeiRite): WardLeiVerb => `ward-${rite}-lei`;
