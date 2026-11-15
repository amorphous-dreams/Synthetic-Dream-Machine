/**
 * swarm-go-rite — the powers a go may carry, one per go.
 *
 * A go names its rite, and the rite rides everything that identifies the go: its signed body, the head its co-sign names
 * (`swarmGoHead`), the title it rests at (`go/<rite>/<branch>/<cid>`) and the ward verb a second device answers under
 * (`ward-<rite>-go`). So a go issued for one power never reads, co-signs or spends as another.
 *
 * THE LIST STAYS CAPPED at the acts the boot core verifies. It names powers, never conditions: a rite carries no argument,
 * and the field grows into no policy language.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
export const SWARM_GO_RITES = ["push", "restart"] as const;
export type SwarmGoRite = typeof SWARM_GO_RITES[number];
export type WardGoVerb = `ward-${SwarmGoRite}-go`;

export const isSwarmGoRite = (x: unknown): x is SwarmGoRite => typeof x === "string" && (SWARM_GO_RITES as readonly string[]).includes(x);

/** The ward verb a go of this rite asks its co-sign under. */
export const wardGoVerb = (rite: SwarmGoRite): WardGoVerb => `ward-${rite}-go`;
