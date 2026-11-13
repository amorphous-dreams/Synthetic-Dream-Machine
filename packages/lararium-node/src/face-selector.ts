/**
 * face-selector — which face a command acts as. Never a silent `h0`, and never a face the vessel "wears" between commands.
 *
 * A command that signs or reads as one face resolves it in this order: the face the caller NAMED (`--face N`); else the ONE face
 * standing open on this vessel's custody. With several faces open and none named it refuses by name and lists them, whichever
 * of them holds its anchors, so an act never lands on whichever face stands first or rests most complete. The face the composition mounts
 * (the unlock's choice) is the composition's own state, and a command reads it only through the seat's reading below.
 *
 * THE SEAT'S READING (`worn`): an AI seat (the `lares` MCP server) acts as the face the operator WEARS. With several faces open
 * and none named, it resolves to the MOUNTED face (`lares vault unlock --face N`), never a refusal; a face it names is honoured
 * only while that face stands open, else it refuses by name. So the seat writes where the operator stands, and a sibling face
 * the operator never opened stays out of its reach.
 */
import { unlockedFaceOrdinals } from "./custody-seat.js";
import { mountedFaceOrdinal } from "./node-vessel-identity.js";

export class FaceNotNamed extends Error {}

/** A seat named a face that stands shut on this vessel. */
export class FaceNotOpen extends FaceNotNamed {}

export async function resolveFace(named?: number, opts: { readonly worn?: boolean } = {}): Promise<number> {
  if (named !== undefined && opts.worn !== true) return named;
  const open = await unlockedFaceOrdinals();   // a locked custody refuses here, by its own name
  if (named !== undefined) {
    if (open.includes(named)) return named;
    throw new FaceNotOpen(`face-not-open: the face h${named} does not stand open on this vessel${open.length > 0 ? ` (open: ${open.map((i) => `h${i}`).join(", ")})` : ""}: open it with \`lares vault unlock --face ${named}\`, or name an open face`);
  }
  if (open.length === 1) return open[0]!;
  if (open.length === 0) throw new FaceNotNamed("this vessel holds no face: found one with `lares persona new`");
  if (opts.worn === true) {
    const mounted = mountedFaceOrdinal();
    if (mounted !== undefined && open.includes(mounted)) return mounted;
    throw new FaceNotNamed(`this vessel stands faces ${open.map((i) => `h${i}`).join(", ")} open and wears none of them: wear one (\`lares vault unlock --face N\`), or name the face the seat acts as`);
  }
  throw new FaceNotNamed(`this vessel stands faces ${open.map((i) => `h${i}`).join(", ")} open: name the face the command acts as (--face N)`);
}

/**
 * A face row's arguments bound to the session's face: every face-naming key (`face`, `handleIndex`) set to `ordinal`, or
 * null where a key names another face. A row reads its face by whichever key it takes, so both name the one face.
 */
export function faceRowArgs(args: Readonly<Record<string, unknown>>, ordinal: number): Record<string, unknown> | null {
  for (const key of ["face", "handleIndex"] as const) if (args[key] !== undefined && args[key] !== ordinal) return null;
  return { ...args, face: ordinal, handleIndex: ordinal };
}
