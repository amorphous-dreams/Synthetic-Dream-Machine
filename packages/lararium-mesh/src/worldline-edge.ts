/**
 * worldline-edge — the PURE edge-DAG triple builders. The reified happened-before the
 * in-memory ITC registry (worldline-clock.ts) carries live, projected as durable
 * bi-temporal triples for the mempalace knowledge graph (the chat-session store).
 *
 * The edge-DAG carries the worldline's happened-before (agent-worldline #attribution): a
 * `prov:Delegation` edge (parent → child) records the SPAWN; a `prov:Communication` edge
 * (sender → recipient) records a MESSAGE (the rhizome leg, merge-where-messages-land); a
 * HANDBACK rides a Communication edge (child → parent) marked `round: "close"`, so the round
 * closes while the spirit persists; RETIREMENT closes the spawn edge's valid-interval. Each triple
 * carries the TURN-DAG key (the C-cut: handoffs key to the turn-DAG node, so the edge
 * survives rewind/fork), a causal parent turn when known, and display valid_from.
 *
 * These functions build the triple DESCRIPTORS only — pure, bundle-able, no IO. The node-side
 * shore (lararium-mempalace/worldline-kg.ts) writes them through the mempalace KG API
 * (`kg_add` / `kg_invalidate`). The in-memory ITC verdict stays the live causal read; the KG
 * is the durable, re-derivable projection (nuke-and-pave + re-harvest, #time).
 *
 * Meme: lar:///ha.ka.ba/lararium/api/agent-worldline#/attribution
 */

/** The spawn edge — `actedOnBehalfOf` ⇄ prov:Delegation (PROV-AGENT, arXiv 2508.02866). */
export const PRED_DELEGATION = "prov:Delegation";

/** The mid-flight injection edge — `wasInformedBy` ⇄ prov:Communication (the rhizome leg). */
export const PRED_COMMUNICATION = "prov:Communication";

/** The round mark a handback's Communication edge carries — the child closed a round, and persists. */
export const ROUND_CLOSE = "close";

/** The adapter identity stamped on every worldline edge (declared, not smuggled). */
export const WORLDLINE_ADAPTER = "lares-worldline";

/**
 * One edge-DAG triple descriptor — the row a `kg_add` writes. `turnKey` rides the KG's
 * `source_drawer_id` provenance slot (the turn-DAG node the edge keys to); kapae (rewind)
 * closes every triple sharing a `turnKey` (worldline-kg.ts).
 */
export interface WorldlineEdgeTriple {
  /** The source worldline HANDLE (the parent on a Delegation, the sender on a Communication). */
  readonly subject: string;
  /** prov:Delegation | prov:Communication. */
  readonly predicate: string;
  /** The target worldline HANDLE (the child / the message's recipient). */
  readonly object: string;
  /** When the edge became true (ISO) — the worldline's epistemic "as of" point. */
  readonly valid_from?: string;
  /** The turn-DAG key this edge keys to (→ KG source_drawer_id; the kapae filter). */
  readonly turnKey?: string;
  /** The turnKey of the event this edge causally follows. */
  readonly parentKey?: string;
  /** `"close"` on a handback's Communication edge: the sender closed a round and persists. */
  readonly round?: typeof ROUND_CLOSE;
}

/** A descriptor for closing an edge's valid-interval (the retirement / kapae move). */
export interface WorldlineEdgeClose {
  readonly subject: string;
  readonly predicate: string;
  readonly object: string;
  /** When the edge stopped being true (ISO); the KG defaults to today when omitted. */
  readonly ended?: string;
  /** The turnKey of the event this retirement causally follows. */
  readonly parentKey?: string;
  /** The turn-DAG key of the retirement itself, so a later event can link after it. */
  readonly turnKey?: string;
}

export interface EdgeOpts {
  /** ISO valid_from; defaults applied by the caller/shore, never fabricated here. */
  readonly validFrom?: string;
  /** The turn-DAG key (the C-cut handoff key). */
  readonly turnKey?: string;
  /** The turnKey of the event this edge causally follows. */
  readonly parentKey?: string;
}

/** SPAWN → the prov:Delegation triple (parent happened-before child). */
export function delegationEdge(parent: string, child: string, opts: EdgeOpts = {}): WorldlineEdgeTriple {
  if (!parent || !child) throw new Error("delegationEdge: parent and child handles required");
  return {
    subject: parent,
    predicate: PRED_DELEGATION,
    object: child,
    ...(opts.validFrom !== undefined ? { valid_from: opts.validFrom } : {}),
    ...(opts.turnKey !== undefined ? { turnKey: opts.turnKey } : {}),
    ...(opts.parentKey !== undefined ? { parentKey: opts.parentKey } : {}),
  };
}

/** MESSAGE → the prov:Communication triple (a sender reached a live recipient). */
export function communicationEdge(sender: string, recipient: string, opts: EdgeOpts = {}): WorldlineEdgeTriple {
  if (!sender || !recipient) throw new Error("communicationEdge: sender and recipient handles required");
  return {
    subject: sender,
    predicate: PRED_COMMUNICATION,
    object: recipient,
    ...(opts.validFrom !== undefined ? { valid_from: opts.validFrom } : {}),
    ...(opts.turnKey !== undefined ? { turnKey: opts.turnKey } : {}),
    ...(opts.parentKey !== undefined ? { parentKey: opts.parentKey } : {}),
  };
}

/** HANDBACK → the round-close Communication triple (child → parent); the spawn edge stays open. */
export function handbackEdge(child: string, parent: string, opts: EdgeOpts = {}): WorldlineEdgeTriple {
  if (!child || !parent) throw new Error("handbackEdge: child and parent handles required");
  return { ...communicationEdge(child, parent, opts), round: ROUND_CLOSE };
}

/** RETIRE → the close descriptor for the spawn edge (the continuing spirit's explicit end). */
export function retireClose(parent: string, child: string, ended?: string, parentKey?: string, turnKey?: string): WorldlineEdgeClose {
  if (!parent || !child) throw new Error("retireClose: parent and child handles required");
  return {
    subject: parent,
    predicate: PRED_DELEGATION,
    object: child,
    ...(ended !== undefined ? { ended } : {}),
    ...(parentKey !== undefined ? { parentKey } : {}),
    ...(turnKey !== undefined ? { turnKey } : {}),
  };
}
