/**
 * runEdgeKapae — set a relationship aside, or take the marker back down.
 *
 * THE WRITE ASSERTS NOTHING. It signs an act with a named persona root and lands it on the board; whether
 * that root HOLDS the edge gets decided at the fold, by whichever reader consults the shadow. That split runs
 * through this whole codebase for one reason — a write that adjudicated would let the hand doing the writing
 * grade its own authority. So a raise by a root holding no claim over an edge lands, verifies as a signature,
 * and gets dropped by every reader. It costs the writer a tiddler and buys them nothing.
 *
 * CAUSAL FRONTIER CLIMBS FROM THE BOARD, never from a scalar guess. The act cites locally admissible semantic
 * heads; a caller may only pin one of those heads deliberately, and contradictory heads remain unsettled.
 *
 * RAISING AND LOWERING STAY SYMMETRIC IN SHAPE AND ASYMMETRIC IN FORCE: both write one signed act, and only
 * the fold knows that a raise wins a tie. Nothing here special-cases the gesture, which keeps the asymmetry
 * in ONE place where it can be read.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/kapae
 */

import { Repo } from "@automerge/automerge-repo";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import * as ed from "@noble/ed25519";
import {
  signEdgeKapae, writeEdgeKapae, edgeKapaeActsFromBoard, edgeKapaeActCid, edgeKapaeBytes, shadowSetFromBoard,
  edgeKapaeBoardDocUrl, materializeSharedLarDoc, ed25519SignerFromSeed, hexToBytes,
} from "@lararium/mesh";
import { larDataDir } from "../vessel-paths.js";
import {
  listPersonaRoots, loadPersonaGroupRootSeed, loadPersonaGroupRootVerifyingKey, loadVesselVerifyingKey,
} from "../node-vessel-identity.js";
import { nodeNexusIsland } from "../nexus-standing.js";

export class EdgeKapaeError extends Error {}

export interface EdgeKapaeOptions {
  /** The relationship to act on — a dyad id, a vouch edge id, any content-addressed edge. */
  readonly edgeId:       string;
  /** true → raise the shadow (set aside); false → lower it (a deliberate re-admission). */
  readonly raised:       boolean;
  /** The epochCid this act roots on — an ORDER, never an instant. */
  readonly epochCid:        string;
  /** WHICH held persona root signs. Absent → the first held root. */
  readonly handleIndex?: number;
  /** Explicit causal parents; absent means the currently observed local frontier. */
  readonly parents?:     readonly string[];
  readonly storageDir?:  string;
}

export interface EdgeKapaeResult {
  readonly edgeId:    string;
  readonly raised:    boolean;
  readonly actCid:   string;
  readonly parents: readonly string[];
  readonly epochCid:     string;
  readonly signerDid: string;
  readonly boardUrl:  string;
  /** Whether the shadow STANDS after this act, read back through the verifying fold under this signer. */
  readonly shadowStands: boolean;
}

/** Land one kāpae act on the Nexus board. `now` never enters — an act roots on an epochCid, never a clock. */
export async function runEdgeKapae(opts: EdgeKapaeOptions): Promise<EdgeKapaeResult> {
  const storageDir = opts.storageDir ?? larDataDir();
  const edgeId     = opts.edgeId.trim();
  const epochCid      = opts.epochCid.trim();

  if (edgeId.length === 0) throw new EdgeKapaeError("an edge id names the relationship to act on — none given.");
  if (epochCid.length === 0)  throw new EdgeKapaeError("an epochCid roots the act — none given (an act carries an order, never an instant).");

  const held = await listPersonaRoots();
  if (held.length === 0) {
    throw new EdgeKapaeError("no persona root held on this vessel — an act carries a signature, and this vessel signs with none.");
  }
  const handleIndex = opts.handleIndex ?? held[0]!;
  if (!held.includes(handleIndex)) {
    throw new EdgeKapaeError(`persona root ${handleIndex} is not held here (held: ${held.join(", ")}).`);
  }

  const signerDid = await loadPersonaGroupRootVerifyingKey(handleIndex);
  if (!signerDid) {
    throw new EdgeKapaeError(`persona root ${handleIndex} surfaces no usable verifying key — nothing to sign with.`);
  }

  const nexusPubkey = await loadVesselVerifyingKey();
  const boardIsland = nodeNexusIsland({ ownVesselKey: nexusPubkey });
  const boardUrl    = edgeKapaeBoardDocUrl(boardIsland);
  const repo        = new Repo({ storage: new NodeFSStorageAdapter(storageDir) });
  const verify      = (bytes: Uint8Array, sigHex: string, did: string) =>
    ed.verifyAsync(hexToBytes(sigHex), bytes, hexToBytes(did)).catch(() => false);
  try {
    const handle = await materializeSharedLarDoc(repo, boardUrl, "board:edge-kapae");

    // Continue the observed frontier. No scalar counter can stand in for causality here.
    const raw = edgeKapaeActsFromBoard(handle.doc()).filter((a) => a.edgeId === edgeId && a.epochCid === epochCid);
    const verified = (await Promise.all(raw.map(async (a) => {
      if (a.actCid !== edgeKapaeActCid(a)) return null;
      const { sig: _sig, ...unsigned } = a;
      if (!(await verify(edgeKapaeBytes(unsigned), a.sig, signerDid))) return null;
      return a;
    }))).filter((a): a is NonNullable<typeof a> => a !== null);
    // Close the ancestry to a fixed point. A present parent with a missing grandparent is itself
    // unavailable and must not become the next command's frontier head.
    let admissible = verified;
    for (;;) {
      const ids = new Set(admissible.map((a) => a.actCid));
      const closed = admissible.filter((a) => a.parents.every((p) => ids.has(p)));
      if (closed.length === admissible.length) break;
      admissible = closed;
    }
    const covered = new Set(admissible.flatMap((a) => a.parents));
    const heads = admissible.filter((a) => !covered.has(a.actCid)).map((a) => a.actCid).sort();
    const parents = [...(opts.parents ?? heads)].sort();
    if (opts.parents && opts.parents.some((p) => !heads.includes(p))) {
      throw new EdgeKapaeError("refusing raw or non-frontier parent: parents must be locally admissible causal heads.");
    }

    const act = await signEdgeKapae(
      { edgeId, raised: opts.raised, parents, epochCid },
      ed25519SignerFromSeed(await loadPersonaGroupRootSeed(handleIndex)),
    );
    handle.change((d) => writeEdgeKapae(d, act));
    await repo.flush();

    // Read the act BACK through the verifying fold, under this signer as the edge's authority. A caller
    // learns whether the shadow now STANDS rather than merely whether a tiddler landed — and an act that
    // cannot survive its own extraction refuses loudly here instead of sitting on the board doing nothing.
    const shadowed = await shadowSetFromBoard(handle.doc(), () => signerDid, verify);
    return { edgeId, raised: opts.raised, actCid: act.actCid, parents, epochCid, signerDid, boardUrl, shadowStands: shadowed.has(edgeId) };
  } finally {
    await repo.flush().catch(() => { /* best-effort final flush */ });
  }
}
