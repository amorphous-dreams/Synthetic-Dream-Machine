/**
 * shore-votum — THE VOWER'S PROOF on a write the island shore hands the intent plane (comms-ux-enacts landing 13).
 *
 * A write into a layer another face holds rides as a votum on the HOLDER's plane, which the holder's own door drains. The plane
 * entry carries the holder's signature (its own atom on this vessel admits it to its own plane); so the votum also carries the
 * VOWER's own proof: the vower's atom signs one domain-bound digest of the holder, the door verb and its arguments. The drain
 * reads that proof (`readShoreVotum`) and checks the VOWER's grant on the bag before it pays the write, never the holder's
 * reach alone, so the plane can tell a vow from the holder's own word. A plane verb `tiddler-put` / `tiddler-delete` with no
 * proof, a proof another key signed, or arguments moved after signing refuses by name, and an agent's relayed intent never
 * pays one (an agent acts as itself under a delegation; it carries no face's vow).
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/face-intent-plane#/the-vow
 */
import { canonicalJsonBytes } from "./crypto.js";
import { verifyEd25519 } from "./ed25519-door.js";
import type { IntentSigner } from "./intent-issue.js";

/** The domain a vower's proof binds: a signature over this digest serves no other act. */
export const SHORE_VOTUM_DOMAIN = "lar:///ha.ka.ba/lares/api/pono/face-intent-plane#/shore-votum";

/** The plane verbs a shore votum carries: the holder's own door verbs. */
export const SHORE_VOTUM_VERBS: ReadonlySet<string> = new Set(["tiddler-put", "tiddler-delete"]);

/** The vower's proof riding a votum's arguments (`vower`): its face, the atom key that signed, the signature. */
export interface ShoreVowerProof { readonly face: string | null; readonly key: string; readonly sig: string }

/**
 * The bytes a vower signs: the domain, the holder, the verb, every argument but the proof itself, and the vower's own face and
 * key, so the face a proof names rides signed with the key (two vota differing only in the face named carry two signatures).
 */
export function shoreVotumBytes(holder: string, verb: string, args: Readonly<Record<string, unknown>>, vower: { readonly face: string | null; readonly key: string }): Uint8Array {
  const { vower: _proof, ...rest } = args;
  return canonicalJsonBytes({ domain: SHORE_VOTUM_DOMAIN, holder, verb, args: rest, vower: { face: vower.face, key: vower.key.toLowerCase() } });
}

/** The arguments a votum carries, the vower's proof joined: the vower's atom signs the holder, the verb and the arguments. */
export async function vowShoreVotum(signer: IntentSigner, face: string | null, holder: string, verb: string, args: Readonly<Record<string, unknown>>): Promise<Record<string, unknown>> {
  const { vower: _stale, ...rest } = args;
  const sig = await signer.sign(shoreVotumBytes(holder, verb, rest, { face, key: signer.key }));
  return { ...rest, vower: { face, key: signer.key.toLowerCase(), sig } satisfies ShoreVowerProof };
}

export type ShoreVotumRefusal = "votum-vower-missing" | "votum-vower-forged" | "votum-agent-relayed";

/**
 * Read a drained votum's vower: the proof verifies over the holder, the verb and the arguments as they stand, and no agent
 * relayed it. Answers the vower and the arguments the door verb takes (the proof left out), or the refusal by name.
 */
export function readShoreVotum(holder: string, verb: string, args: Readonly<Record<string, unknown>>, agent: unknown):
  { readonly ok: true; readonly vower: ShoreVowerProof; readonly args: Record<string, unknown> } | { readonly ok: false; readonly refusal: ShoreVotumRefusal } {
  if (agent !== null && agent !== undefined) return { ok: false, refusal: "votum-agent-relayed" };
  const proof = args["vower"] as Partial<ShoreVowerProof> | undefined;
  if (!proof || typeof proof !== "object" || typeof proof.key !== "string" || typeof proof.sig !== "string") return { ok: false, refusal: "votum-vower-missing" };
  let verified = false;
  const face = typeof proof.face === "string" ? proof.face : null;
  try { verified = verifyEd25519(proof.sig, shoreVotumBytes(holder, verb, args, { face, key: proof.key }), proof.key); } catch { verified = false; }
  if (!verified) return { ok: false, refusal: "votum-vower-forged" };
  const { vower: _proof, ...rest } = args;
  return { ok: true, vower: { face: typeof proof.face === "string" ? proof.face : null, key: proof.key, sig: proof.sig }, args: rest };
}
