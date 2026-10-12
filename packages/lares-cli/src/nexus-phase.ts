/**
 * nexus-phase — one charter shape, two readings. A Lararium one operator founds stands as a SEED: a
 * household island with its own charter, herm, leaves and hosted guests. A NEXUS stands when two operators
 * each seat their own key in one fresh charter. A carriage contract moves no phase, and a household seed
 * never takes a foreign seat.
 *
 * ONE VESSEL READS ONLY ITS OWN VAULT. `ownSeats` counts seated keys this vault can produce; `foreignSeats`
 * counts seated keys it cannot. Two keys never prove two humans: the founders' in-person fingerprint check
 * carries that, and no reading here claims it.
 *
 * The chairs counted here belong to one Nexus's seal (admit, kapae, roll). The corpus-kahu's chairs sit at
 * DreamNet scale and enter no phase.
 * Meme: lar:///ha.ka.ba/lararium/mesh/kahu#/seed-and-nexus
 */

export type NexusPhaseName = "seed" | "nexus";
export interface NexusPhase { readonly phase: NexusPhaseName; readonly isNexus: boolean; readonly reading: string; }

export function nexusPhase(at: { ownSeats: number; foreignSeats: number }): NexusPhase {
  if (at.foreignSeats >= 1 && at.ownSeats >= 1) {
    return {
      phase: "nexus", isNexus: true,
      reading: `a NEXUS — ${at.ownSeats} seat(s) from this vault beside ${at.foreignSeats} seat(s) this vault cannot produce; `
        + "two keys never prove two humans; the founders' in-person fingerprint check carries that.",
    };
  }
  if (at.foreignSeats >= 1) {
    return {
      phase: "nexus", isNexus: true,
      reading: `a NEXUS — this vessel holds NO seat in it; it reads another's charter with ${at.foreignSeats} foreign seat(s). `
        + "Its founders' in-person fingerprint check stays outside what this vessel can read.",
    };
  }
  return {
    phase: "seed", isNexus: false,
    reading: at.ownSeats > 0
      ? `a SEED — ${at.ownSeats} chair(s) seated from this vault. A Nexus stands when a second operator seats their own key in a fresh charter; a carriage contract moves no phase.`
      : "a SEED with no chair seated. A Nexus stands when a second operator seats their own key in a fresh charter; a carriage contract moves no phase.",
  };
}
