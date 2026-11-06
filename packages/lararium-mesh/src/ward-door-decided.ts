/**
 * ward-door-decided — the doors' own check of an act their gate just decided (a replay's search, the act a door lands): it accepts
 * every ward act. Never a reader's witness, and never exported from the package: every reader takes its witness from the vessel's
 * port (`cosignPortWitness`), which holds each act to its spent co-sign.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness#/the-swarm-slices
 */
import type { WardActWitness } from "./ward-cosign.js";

export const WARD_GATE_DECIDED: WardActWitness = { accepts: () => true };
