/**
 * face-selector — which face a command acts as. Never a silent `h0`.
 *
 * A command that signs or reads as one face resolves it in this order: the face the caller NAMED; else the face the
 * vessel WEARS (an explicit `persona wear`); else the vessel's ONE face, when it holds exactly one. With several faces
 * and none named or worn it refuses by name and lists them, so an act never lands on whichever face stands first.
 */
import { loadActivePersonaIndex } from "./node-vessel-identity.js";
import { listAnchoredPersonas } from "./identity-anchors.js";

export class FaceNotNamed extends Error {}

export async function resolveFace(named?: number): Promise<number> {
  if (named !== undefined) return named;
  const worn = await loadActivePersonaIndex();
  if (worn !== undefined) return worn;
  const held = await listAnchoredPersonas();
  if (held.length === 1) return held[0]!;
  if (held.length === 0) throw new FaceNotNamed("this vessel holds no face: found one with `lares persona new`");
  throw new FaceNotNamed(`this vessel holds faces ${held.map((i) => `h${i}`).join(", ")} and wears none: name one (--as N) or wear one (\`lares persona wear N\`)`);
}
