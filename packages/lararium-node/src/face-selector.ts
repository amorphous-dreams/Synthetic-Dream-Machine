/**
 * face-selector — which face a command acts as. Never a silent `h0`, and never a face the vessel "wears" between commands.
 *
 * A command that signs or reads as one face resolves it in this order: the face the caller NAMED (`--face N`); else the ONE face
 * standing open on this vessel's custody; else the ONE open face that holds its anchors. With several faces and none
 * named it refuses by name and lists them, so an act never lands on whichever face stands first. The face the composition mounts
 * (the unlock's choice) is the composition's own state, and no command reads it here.
 */
import { unlockedFaceOrdinals } from "./custody-seat.js";
import { listAnchoredPersonas } from "./identity-anchors.js";

export class FaceNotNamed extends Error {}

export async function resolveFace(named?: number): Promise<number> {
  if (named !== undefined) return named;
  const open = await unlockedFaceOrdinals();   // a locked custody refuses here, by its own name
  if (open.length === 1) return open[0]!;
  const held = await listAnchoredPersonas();
  if (held.length === 1) return held[0]!;
  if (held.length === 0 && open.length === 0) throw new FaceNotNamed("this vessel holds no face: found one with `lares persona new`");
  const among = open.length > 1 ? `stands faces ${open.map((i) => `h${i}`).join(", ")} open` : `holds faces ${held.map((i) => `h${i}`).join(", ")}`;
  throw new FaceNotNamed(`this vessel ${among}: name the face the command acts as (--face N)`);
}
