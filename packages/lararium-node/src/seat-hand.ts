/**
 * seat-hand — THE AI SEAT ACTS INSIDE THE LENT SET (the lit set's custody rule, sealed-store#/the-lit-set).
 *
 * Every call the MCP seat sends over the UDS (`lares_mcp.py` -> `lares_uds.py`) carries the seat kind `seat: "ai"` on its
 * request line, and every session it opens rides the `seat` hand. The vessel reads that MARK, never the absence of a session.
 * EACH SESSION WEARS ONE FACE INSIDE THE LENT SET (the faces the holder names open: under a pūlama, the set it lends this
 * vessel): a call so marked (or a `seat` session) may name any lent face, and one naming a face outside the set refuses
 * `face-not-lent`, naming the set (`wearInside`, `@lararium/mesh/lent-faces`). Where no set reads, the worn face alone passes
 * and another refuses `face-hand-refused`. A call that names none acts as the worn face, as `face.resolve` answers it. The
 * operator's own hand (the CLI's seed, import, share and vault doors) carries no seat kind and may name any open face.
 *
 * F7'S STANDING RULING HOLDS: on one machine, for the dogfood, authority rides BY DESIGNATION. The seat kind is a designation
 * the seat's own client writes, not a proof: a process that writes the operator's line instead reads as the operator's hand.
 * It keeps an honest seat inside its lane; it does not stand against a hostile process on the same machine.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-lit-set
 */

import { lentFacesOf, wearInside } from "@lararium/mesh/lent-faces";

/** The seat kinds a request line names. */
export type SeatKind = "ai";

/** The seat kind a UDS request line names, or null (the operator's hand). Only the exact designation reads as one. */
export function seatKindOf(frame: unknown): SeatKind | null {
  return frame !== null && typeof frame === "object" && (frame as Record<string, unknown>)["seat"] === "ai" ? "ai" : null;
}

/** The face an argument bag names (`face` or `handleIndex`, a whole number or `h<N>`), or null where it names none. */
export function namedFaceOf(args: unknown): number | null {
  if (args === null || typeof args !== "object") return null;
  for (const key of ["face", "handleIndex"]) {
    const v = (args as Record<string, unknown>)[key];
    if (typeof v === "number" && Number.isSafeInteger(v) && v >= 0) return v;
    if (typeof v === "string" && /^h?(0|[1-9]\d*)$/.test(v)) return Number(v.replace(/^h/, ""));
  }
  return null;
}

/** The face a session's `faceRef` names by ordinal (`h<N>`), or null for a ref that names none that way. */
export function faceRefOrdinal(faceRef: unknown): number | null {
  return typeof faceRef === "string" && /^h(0|[1-9]\d*)$/.test(faceRef) ? Number(faceRef.slice(1)) : null;
}

/**
 * The refusal an AI seat's call meets, or null. A seat (by its kind, or by the `seat` hand) naming a face outside the lent set
 * refuses `face-not-lent`, naming the set; with no set (null or empty), naming a face other than the worn one refuses
 * `face-hand-refused`. A call naming no face passes (it acts as the worn face), and so does the operator's hand.
 */
export function seatFaceRefusal(input: { readonly seat: SeatKind | null; readonly named: number | null; readonly worn: number | null; readonly lent?: readonly number[] | null }): string | null {
  if (input.seat === null || input.named === null) return null;
  const lent = input.lent ? lentFacesOf(input.lent) : null;
  if (lent?.ok) {
    const wear = wearInside(lent.faces, input.named, input.worn);
    return wear.ok ? null : wear.message;
  }
  if (input.worn !== null && input.named === input.worn) return null;
  return `face-hand-refused: the AI seat acts as the worn face${input.worn !== null ? ` (h${input.worn})` : ""} alone, and this call names h${input.named}; only the operator's own hand (\`lares vessel seed\`, \`lares vessel import\`, \`lares bag share\`) names another face`;
}

/** The class a seat refusal names (`face-not-lent`, `face-hand-refused`): the text before its first colon. */
export function seatRefusalClass(refusal: string): string {
  const at = refusal.indexOf(":");
  return at < 0 ? refusal : refusal.slice(0, at);
}
