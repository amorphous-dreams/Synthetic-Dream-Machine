/**
 * island-session-proof — what the daemon island reads of the session that placed one ask.
 *
 * THE ISLAND HOLDS NO SESSION KEY. A session's signer lives on the vessel's main thread, beside the owner's table that
 * decides whether its session still stands, and holds the only copy of its secret (face-proof#/the-key-hierarchy). The
 * island names the invocation a session placed, and the vessel answers from THAT session: its certificate, its proof
 * subject and the vessel's own verified face chain, then each signature on ask. A lock, a close or a switch drops the
 * signer on the main thread, and the next signature refuses there; the island learns nothing it must forget.
 *
 * The law the island applies to a reading (sealed-store#/the-store):
 *   · THE SEALER READS THE SESSION'S (FACE, ANCHOR), WHATEVER THE ANCHOR. A Nexus session's record carries its session
 *     certificate beneath the vessel's face-scoped key; a place session's carries the certificate the face's atom
 *     signed at the vessel's own place. The vessel's chain names a standing at each anchor its face meets.
 *   · THE SESSION WEARS THIS ISLAND'S OWN FACE. Its proof subject equals the subject of the vessel's own chain at the
 *     session's anchor, or every sealed verb refuses `session-face-foreign`: another face's session opens nothing this
 *     face sealed.
 *   · A WRITER STANDS ONLY UNDER THE VESSEL'S OWN CHAIN. `holdsWrite` reads true for a certificate whose scope and
 *     face-scoped key are the chain's, over a bag this face registers. Every other writer reads not capable until
 *     the grant ring reads by face key (face-proof#/owed): the reading fails closed.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store
 */
import type { IslandMsg_SessionSign, IslandMsg_SessionSigned, RecordSigner, WriterStanding } from "@lararium/mesh";
import type { Signature } from "@lararium/mesh/face-proof-subjects";
import { faceProofSubjectRef, placeProofSubjectRef } from "@lararium/mesh/face-proof-subjects";
import type { SessionOwnChain } from "@lararium/mesh";

/** The invocation a session placed, as the island names it: its request id and the verb it placed. */
export interface SessionAsk {
  readonly requestId: string;
  readonly verb: string;
}

/** The vessel's answer for one ask: the session's signer (its certificate, its signatures on the main thread), its
 *  proof subject and this vessel's own verified chain; or one refusal by name. */
export type SessionReading =
  | {
    readonly signer: RecordSigner; readonly subject: string; readonly chain: SessionOwnChain;
    /** Did the vessel read its fold of the face's fleet board? False where it wears no face or serves no fleet under
     *  the root it wears (a joinee): the counted and unanswered lists then say nothing, and a seat that rolled refuses. */
    readonly foldRead: boolean;
    /** The raises the vessel counts on its face's fleet board (its own fold): the evidence a removal version counts by. */
    readonly counted: readonly string[];
    /** The counted raises no subscriber has taken yet (no mark in the vessel's ledger): owed, a restart included. */
    readonly unanswered: readonly string[];
  }
  | { readonly refusal: string };

/** The island's port onto the session that placed an ask. `null` names an ask no session placed (a summons, a
 *  maintenance frame): it reads `signer-unavailable`, and no vessel key or daemon key signs in its place. */
export interface IslandSessionProof {
  signer(ask: SessionAsk | null): Promise<SessionReading>;
  /** The vessel's own chain and fold with no session behind the ask (a backup's cut, a restore's import): the island
   *  counts records by them and signs nothing. Absent, or a refusal: the island reads as before. */
  own?(): Promise<{ readonly chain: SessionOwnChain; readonly foldRead: boolean; readonly counted: readonly string[]; readonly unanswered: readonly string[] } | { readonly refusal: string }>;
}

const bare = (s: string): string => s.trim().toLowerCase().replace(/^0x/, "");

/** The certificate's anchor, read without trusting its shape: a Nexus scope and face-scoped key, or an atom at a place. */
function chainOf(certificate: unknown):
  | { readonly anchor: "nexus"; readonly faceKey: string; readonly nexus: string; readonly vesselFaceKey: string }
  | { readonly anchor: "place"; readonly atomKey: string; readonly place: string }
  | null {
  if (typeof certificate !== "object" || certificate === null) return null;
  const { scope, vesselFaceKey } = certificate as { scope?: unknown; vesselFaceKey?: unknown };
  if (typeof scope !== "object" || scope === null) return null;
  if (vesselFaceKey === undefined) {
    const { atomKey, place } = scope as { atomKey?: unknown; place?: unknown };
    return typeof atomKey === "string" && typeof place === "string" ? { anchor: "place", atomKey, place } : null;
  }
  if (typeof vesselFaceKey !== "string") return null;
  const { faceKey, nexus } = scope as { faceKey?: unknown; nexus?: unknown };
  return typeof faceKey === "string" && typeof nexus === "string" ? { anchor: "nexus", faceKey, nexus, vesselFaceKey } : null;
}

/** Does `certificate` stand under `chain` at its own anchor: at a Nexus the same face, Nexus and face-scoped key; at
 *  a place the same atom at the same place? */
export function certificateUnderChain(certificate: unknown, chain: SessionOwnChain | null): boolean {
  if (chain === null) return false;
  const read = chainOf(certificate);
  if (read === null) return false;
  if (read.anchor === "place") return chain.place !== undefined && bare(read.atomKey) === bare(chain.place.atomKey) && read.place === chain.place.place;
  return "scope" in chain && bare(read.faceKey) === bare(chain.scope.faceKey) && read.nexus === chain.scope.nexus && bare(read.vesselFaceKey) === bare(chain.vesselFaceKey);
}

/** The proof subject the vessel's own chain names at `certificate`'s anchor, or null where it names no standing there. */
export function chainSubjectAt(certificate: unknown, chain: SessionOwnChain): string | null {
  const read = chainOf(certificate);
  if (read === null) return null;
  if (read.anchor === "place") return chain.place ? placeProofSubjectRef(chain.place as never) : null;
  return "scope" in chain ? faceProofSubjectRef(chain.scope as never) : null;
}

/**
 * The writer standing an island reads under its own chain: `chain()` answers the vessel's verified own-face chain as
 * the last session reading carried it (null before any), and `bags()` the bags this face registers.
 */
export function ownChainStanding(chain: () => SessionOwnChain | null, bags: () => readonly string[]): WriterStanding {
  return {
    holdsWrite: ({ certificate, bagId }) => certificateUnderChain(certificate, chain()) && bags().includes(bagId),
    // No chain before a session asked: the holder takes no reading and settles no roll until one stands.
    chainOf: () => {
      const c = chain();
      if (c === null) return null;
      const nexus = "scope" in c ? `${bare(c.scope.faceKey)}|${c.scope.nexus}|${bare(c.vesselFaceKey)}` : "";
      const place = c.place ? `${bare(c.place.atomKey)}@${c.place.place}` : "";
      return `${nexus}|${place}`;
    },
  };
}

/**
 * THE SESSION SIGN DOOR, island side, over any port onto the vessel's thread (a `worker_threads` port, a Web Worker's
 * own scope). The island names the invocation a session placed; the vessel answers from that session: its certificate,
 * its proof subject and the vessel's own verified chain, and each signature on ask, signed on the vessel's thread
 * behind the owner's table. The ask waits on the vessel's answer, and no clock reads silence as one: the vessel
 * answers every ask (a missing door or a fault refuses by name), and the island dies with its vessel. A post that
 * fails refuses at once by name, never as a signer: the island holds no key to fall back on.
 */
export function islandSessionDoor(
  port: { post(msg: IslandMsg_SessionSign): void; listen(cb: (msg: unknown) => void): void },
  opts: { readonly idPrefix: string },
): IslandSessionProof {
  const pending = new Map<string, (answer: IslandMsg_SessionSigned | null) => void>();
  port.listen((raw: unknown) => {
    const m = raw as Partial<IslandMsg_SessionSigned> | null;
    if (!m || m.type !== "session:signed" || typeof m.requestId !== "string") return;
    const settle = pending.get(m.requestId);
    if (!settle) return;
    pending.delete(m.requestId);
    settle(m as IslandMsg_SessionSigned);
  });
  let seq = 0;
  const askVessel = (op: "read" | "sign" | "own", ask: SessionAsk, payload?: Uint8Array): Promise<IslandMsg_SessionSigned | null> => new Promise((resolve) => {
    const requestId = `${opts.idPrefix}-${++seq}`;
    pending.set(requestId, resolve);
    const msg: IslandMsg_SessionSign = { type: "session:sign", requestId, op, ask: ask.requestId, verb: ask.verb, ...(payload ? { payload } : {}) };
    try { port.post(msg); } catch { pending.delete(requestId); resolve(null); }
  });
  const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((c): c is string => typeof c === "string") : []);
  return {
    async own() {
      const read = await askVessel("own", { requestId: "", verb: "" });
      if (read === null || !("own" in read)) return { refusal: read !== null && "refusal" in read ? read.refusal : "chain-absent" };
      return { chain: read.chain, foldRead: read.foldRead === true, counted: strings(read.counted), unanswered: strings(read.unanswered) };
    },
    async signer(ask): Promise<SessionReading> {
      if (ask === null) return { refusal: "signer-unavailable" };
      const read = await askVessel("read", ask);
      if (read === null) return { refusal: "signer-unavailable" };
      if ("refusal" in read) return { refusal: read.refusal };
      if (!("certificate" in read)) return { refusal: "signer-unavailable" };
      const certificate = read.certificate as never;
      return {
        subject: read.subject, chain: read.chain, foldRead: read.foldRead === true,
        counted: strings(read.counted), unanswered: strings(read.unanswered),
        signer: {
          certificate,
          async sign(purpose, payload) {
            if (purpose !== "act") return { refusal: "signer-refused" };
            const signed = await askVessel("sign", ask, payload);
            if (signed === null) return { refusal: "signer-refused" };
            if ("signature" in signed) return { signature: signed.signature as Signature };
            return { refusal: "refusal" in signed ? signed.refusal : "signer-refused" };
          },
        },
      };
    },
  };
}
