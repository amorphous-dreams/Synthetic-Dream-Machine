/**
 * seat-hand — THE AI SEAT ACTS INSIDE THE LENT SET (the lit set's custody rule, sealed-store#/the-lit-set).
 *
 * Every call the MCP seat sends over the UDS (`lares_mcp.py` -> `lares_uds.py`) carries the seat kind `seat: "ai"` on its
 * request line, and every session it opens rides the `seat` hand. The vessel reads that MARK, never the absence of a session.
 * EACH SESSION WEARS ONE FACE INSIDE THE LENT SET (the faces the holder names open: under a pūlama, the set it lends this
 * vessel): a call so marked (or a `seat` session) may name any lent face, and one naming a face outside the set refuses
 * `face-not-lent`, naming the set (`wearInside`, `@lararium/mesh/lent-faces`), and a set that reads empty or doubled refuses
 * by its own reading. Where custody names no set (it rests shut, or the door holds no reader), the worn face alone passes
 * and another refuses `face-hand-refused`. A call that names none acts as the worn face, as `face.resolve` answers it. The
 * operator's own hand (the CLI's seed, import, share and vault doors) carries no seat kind and may name any open face.
 *
 * READING ANOTHER FACE STANDS APART FROM ACTING AS IT (operator ruling 2026-11-20, state/decisions "the cross-face reach"). A
 * face named by `face`, `handleIndex` or a session's ref names the face a call ACTS AS, and the rule above holds it. A tiddler
 * door or meme verb naming another face as its `target` VISITS that face while the call keeps the face it wears
 * (`crossFaceTargetAtDoor`): a read or render reaches a LIT target with no lei, a pet name resolving to its ordinal here; a bag
 * naming a PRIVATE layer refuses first (`cross-face-private`); a write naming another face refuses (`cross-face-write-refused`:
 * the cross-face write rite rides a lei, in a later lane); a shut target refuses `face-not-open`. The rule binds every hand, the
 * operator's included: a target names a visit, never a wear.
 *
 * F7'S STANDING RULING HOLDS: on one machine, for the dogfood, authority rides BY DESIGNATION. The seat kind is a designation
 * the seat's own client writes, not a proof: a process that writes the operator's line instead reads as the operator's hand.
 * It keeps an honest seat inside its lane; it does not stand against a hostile process on the same machine.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-lit-set
 */

import { lentFacesOf, wearInside } from "@lararium/mesh/lent-faces";
import { bagUri } from "@lararium/mesh/lar-uris";
import { CROSS_FACE_PRIVATE, CROSS_FACE_READ_VERBS, CROSS_FACE_TARGET_VERBS, crossFacePrivateRefusal } from "@lararium/mesh/cross-face-reach";

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
 * refuses `face-not-lent`, naming the set; a set that reads empty or doubled refuses by its own reading (`lent-faces-empty`,
 * `lent-faces-duplicate`). Where custody names no set (`lent` null), naming a face other than the worn one refuses
 * `face-hand-refused`. A call naming no face passes (it acts as the worn face), and so does the operator's hand.
 */
export function seatFaceRefusal(input: { readonly seat: SeatKind | null; readonly named: number | null; readonly worn: number | null; readonly lent?: readonly number[] | null }): string | null {
  if (input.seat === null || input.named === null) return null;
  if (input.lent !== null && input.lent !== undefined) {
    const lent = lentFacesOf(input.lent);
    if (!lent.ok) return lent.message;
    const wear = wearInside(lent.faces, input.named, input.worn);
    return wear.ok ? null : wear.message;
  }
  if (input.worn !== null && input.named === input.worn) return null;
  return `face-hand-refused: the AI seat acts as the worn face${input.worn !== null ? ` (h${input.worn})` : ""} alone, and this call names h${input.named}; only the operator's own hand (\`lares vessel lay\`, \`lares import\`, \`lares bag share\`) names another face. To READ another lit face, name it as the call's \`target\``;
}

/** The class a seat refusal names (`face-not-lent`, `lent-faces-empty`, `face-hand-refused`): the text before its first colon. */
export function seatRefusalClass(refusal: string): string {
  const at = refusal.indexOf(":");
  return at < 0 ? refusal : refusal.slice(0, at);
}

/** A visit's answer at the door: the args the call carries on (the target resolved to its ordinal), or the refusal. */
export type CrossFaceAtDoor =
  | { readonly ok: true; readonly args: Record<string, unknown> | undefined }
  | { readonly ok: false; readonly refusal: string; readonly message: string };

/**
 * THE DOOR RESOLVES A VISIT. A tiddler door or meme verb (`CROSS_FACE_TARGET_VERBS`) naming a `target` face, by ordinal
 * (`1`, `"h1"`) or by the pet name the vessel holds for it: a bag naming a PRIVATE layer refuses `cross-face-private` first; a
 * target naming the face the call wears reads as none (the target leaves the args); a write naming another face refuses
 * `cross-face-write-refused`; a target outside the lit set (`lit`, the mount and every lit sibling) refuses `face-not-open`;
 * a pet name no face holds refuses `target-unknown`, and one two faces hold `target-ambiguous`. A read to a lit face passes
 * with `target` as its ordinal; any other verb passes untouched. `worn` names the face the call wears: the mount on the
 * one-shot line, the session's face on a session.
 */
export async function crossFaceTargetAtDoor(input: {
  readonly verb: string;
  readonly args: Record<string, unknown> | undefined;
  readonly worn: number | null;
  readonly lit: readonly number[];
  readonly petnames?: () => Promise<ReadonlyArray<readonly [number, string]>>;
}): Promise<CrossFaceAtDoor> {
  const { verb } = input;
  const raw = input.args?.["target"];
  if (input.args === undefined || raw === undefined || !CROSS_FACE_TARGET_VERBS.has(verb)) return { ok: true, args: input.args };
  const args: Record<string, unknown> = input.args;
  const refuse = (refusal: string, why: string): CrossFaceAtDoor => ({ ok: false, refusal, message: `${refusal}: ${verb} — ${why}` });
  let target: number | null = null;
  if (typeof raw === "number" && Number.isSafeInteger(raw) && raw >= 0) target = raw;
  else if (typeof raw === "string" && /^h?(0|[1-9]\d*)$/.test(raw.trim())) target = Number(raw.trim().replace(/^h/, ""));
  else if (typeof raw === "string" && raw.trim() !== "") {
    const named = (await input.petnames?.().catch(() => []) ?? []).filter(([, name]) => name === raw.trim()).map(([face]) => face);
    if (named.length === 0) return refuse("target-unknown", `no face of this vessel answers to the pet name ${JSON.stringify(raw)}; name it by its handle index (\`h<N>\`)`);
    if (named.length > 1) return refuse("target-ambiguous", `${named.length} faces answer to the pet name ${JSON.stringify(raw)} (${named.map((f) => `h${f}`).join(", ")}); name one by its handle index`);
    target = named[0]!;
  } else return refuse("target-unknown", `the target ${JSON.stringify(raw)} names no face`);
  if (target === input.worn) {
    const { target: _worn, ...rest } = args;
    return { ok: true, args: rest };
  }
  if (typeof args["bag"] === "string") {
    const bag = args["bag"].startsWith("lar:") ? args["bag"] : bagUri(args["bag"]);
    const refusal = crossFacePrivateRefusal(bag);
    if (refusal !== null) return { ok: false, refusal: CROSS_FACE_PRIVATE, message: `${refusal}; ${verb} moved nothing` };
  }
  if (!CROSS_FACE_READ_VERBS.has(verb)) {
    return refuse("cross-face-write-refused", `it names face h${target} while the call wears ${input.worn === null ? "no face" : `h${input.worn}`}; a seat reads and renders another lit face, and a write to another face waits on the cross-face write rite, so nothing moved`);
  }
  if (!input.lit.includes(target)) return refuse("face-not-open", `face h${target} stands shut; a visit reads a lit face alone, and nothing ran`);
  return { ok: true, args: { ...args, target } };
}
