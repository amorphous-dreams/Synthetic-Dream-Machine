/**
 * mirror-rest-verdict — whether the vessel's answer for a mirror's boot set carries `sealedRest`, the word the mirror's census reads
 * before it lets a code plugin evaluate (`censusPreloads`, `censusRecords`: otherwise `plugin-gate`).
 *
 * A VEIL FLOOR'S MIRROR RUNS NO PERSON-AUTHORED CODE: with no face lit, the answer carries no `sealedRest` even where the store rests
 * sealed under the vessel's own key, since a floor's content carries no person's custody to vouch for the code it holds. A lit face
 * over a store that rests sealed carries it. Every host that answers a mirror's inputs passes its answer through here, so the first
 * wiring of a true sealed-rest reading meets the floor's law in the same act.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/the-veil-ladder#/the-base-model
 */

export interface MirrorRestAt {
  /** The face lit over this vessel, or null at the veil floor. */
  readonly face: string | null;
  /** Whether the vessel's store rests sealed for the surface's documents. */
  readonly restsSealed: boolean;
}

export function mirrorInputsAt<T extends { readonly coreCid: string; readonly pluginCids: readonly string[] }>(
  inputs: T | null, at: MirrorRestAt,
): (T & { readonly sealedRest?: true }) | null {
  if (inputs === null) return null;
  return at.face !== null && at.restsSealed ? { ...inputs, sealedRest: true } : inputs;
}
