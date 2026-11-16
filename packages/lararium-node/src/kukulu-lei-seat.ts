/**
 * kukulu-lei-seat — THE SEAM where the swarm's lei family seats behind the kūkulu gate's port.
 *
 * The gate asks two things of a lei (`KukuluLeiPort`): read an offered `kukulu` lei the face's hand strung, and claim its
 * return once. The lei family (`@lararium/mesh`: the lei's record, its chain, `readLei`, `returnLei`, the `lei-returned`
 * row) owns both. This module holds the adapter between them, over the pūlama's own record store, so the offered lei
 * lands in that store, the family reads it there, and the return's claim rests where no vessel writes.
 *
 * Until the family's `kukulu` rite seats here, the port refuses every lei `unseated`, so a pūlama serves no kūkulu on a
 * reading nobody verified: the gate fails closed.
 */
import type { SwarmWikiPort } from "@lararium/mesh";
import type { KukuluLeiPort } from "./kukulu-gate.js";

/** The lei port over the pūlama's record store. */
export function kukuluLeiOver(_records: SwarmWikiPort): KukuluLeiPort {
  return {
    async readLei() { return { ok: false, refusal: "unseated" }; },
    async returnLei() { return false; },
  };
}
