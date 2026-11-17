/**
 * chore-ask — the face a chore acts for, and the mark its receipt carries (place-and-face-islands#/the-isomorphic-core).
 *
 * A chore (a projection, a sweep, a promote, a kahua stage, a session's write through the daemon: anything a vessel writes or
 * signs under a face's authority) DESIGNATES its face. The lend decides which faces a chore may name (`wearInside`); what this
 * process CARRIES decides which it may act as. Before the islands split, a vessel carries its daemon mount alone, so a chore
 * named under another lent face refuses `chore-face-not-mounted` rather than run as the mount (no silent steward); after the
 * split it carries one face island per lent face. Pure: no Repo, no key, no clock, no IO. The node binds it at its chore
 * doors, and a browser binds it over its tab's face islands.
 *
 *   actingFaceOf(ask, lent, carried)  the face the chore acts for, or its refusal by class
 *   choreReceiptMark(ask, face)       the field set an existing receipt carries: the acting face, the asker's hand, its session
 *   choreReceiptMarkOf(raw)           a mark read back, or null for one carrying any other field
 *
 * Meme: lar:///ha.ka.ba/kahua/memory/project/place-and-face-islands
 */
import { renderLentFaces, wearInside, type LentFaces, type WearRefusal } from "./lent-faces.js";
import type { Hand } from "./session-contract.js";

/** One chore as its door asks it: the chore's name, the face it designates (null where it names none), and who asks. */
export interface ChoreAsk {
  readonly chore: string;
  readonly face: number | null;
  readonly asker: { readonly hand: Hand; readonly session: string | null; readonly generation: number | null };
}

/** The classes a chore's acting face refuses by. */
export type ChoreRefusal = "chore-face-not-mounted" | WearRefusal;
export type ActingFace = { readonly ok: true; readonly face: number } | { readonly ok: false; readonly refusal: ChoreRefusal; readonly message: string };

/**
 * The face a chore acts for. The lend reads first: a named face outside it refuses `face-not-lent`, and no face named over a
 * lend of more than one refuses `face-not-named`. Then the carry: a lent face this process does not carry refuses
 * `chore-face-not-mounted`, naming the face asked and the faces carried. Each refusal names the set it read.
 */
export function actingFaceOf(ask: ChoreAsk, lent: LentFaces, carried: readonly number[]): ActingFace {
  const wear = wearInside(lent, ask.face, null);
  if (!wear.ok) return wear;
  const face = wear.face.ordinal;
  if (carried.includes(face)) return { ok: true, face };
  const held = carried.length === 0 ? "no face" : `${renderLentFaces(carried.map((ordinal) => ({ ordinal })))} alone`;
  return { ok: false, refusal: "chore-face-not-mounted",
    message: `chore-face-not-mounted: "${ask.chore}" acts for h${face}, and this vessel carries ${held} (the daemon mount); the chore refuses rather than run as another face` };
}

/** The acting face on an existing receipt (a verb's answer, a swarm receipt, an effect record): house-local, never a key, id or signature. */
export interface ChoreReceiptMark { readonly acting: number; readonly asker: Hand; readonly session: string | null }

const HANDS: ReadonlySet<string> = new Set<Hand>(["tab", "cli", "watcher", "seat"]);

/** The mark a receipt carries for a chore that acted for `face`. */
export function choreReceiptMark(ask: ChoreAsk, face: number): ChoreReceiptMark {
  return { acting: face, asker: ask.asker.hand, session: ask.asker.session };
}

/** A mark read back off a receipt, or null where it reads malformed or carries any field beyond its three. */
export function choreReceiptMarkOf(raw: unknown): ChoreReceiptMark | null {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const keys = Object.keys(raw);
  if (keys.length !== 3 || !keys.every((k) => k === "acting" || k === "asker" || k === "session")) return null;
  const { acting, asker, session } = raw as Record<string, unknown>;
  if (typeof acting !== "number" || !Number.isSafeInteger(acting) || acting < 0) return null;
  if (typeof asker !== "string" || !HANDS.has(asker)) return null;
  if (session !== null && typeof session !== "string") return null;
  return { acting, asker: asker as Hand, session };
}
