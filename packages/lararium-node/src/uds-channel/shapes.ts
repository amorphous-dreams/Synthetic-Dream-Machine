/**
 * THE VERB DOOR'S SHAPES: the options a seat stands on, the session's supply and signer, the anchor a session binds, the
 * invocation a line carries, the gate a call meets at dispatch, and what a receipt answers.
 * Heleuma ha: see lararium/mesh/uds-channel-shapes.
 */

import type { Socket } from "node:net";
import type { DocHandle, Repo } from "@automerge/automerge-repo";
import type { CompositeStore } from "@lararium/mesh/composite-store";
import type { LarDoc } from "@lararium/mesh/base-doc";
import type { CapabilityProfile, Hand, Session, SessionBinding, SessionFace, SessionTable } from "@lararium/mesh/session-contract";
import type { ChoreReceiptMark } from "@lararium/mesh/chore-ask";
import type { CallTouches } from "@lararium/mesh/call-touches";
import type { PeerKind } from "../uds-peer.js";
import type { HearthPlanes } from "../hearth-roster-read.js";
import type { StoreClaim } from "../owned-store.js";
import type { FaceLives, VisitTicket, WorkTicket } from "../face-lifecycle.js";
import type { SessionSignBook } from "../session-sign-door.js";
import type { EngineWatch } from "../engine-watch.js";
import type { SwitchActLog } from "../switch-act-log.js";

/** The band a write door's answer carries where a document its call wrote still waits unsealed (`RestOwed`, sealed-rest). */
export interface RestOwedBand {
  readonly band: "owed";
  readonly documents: ReadonlyArray<{ readonly documentId: string; readonly refusal: string; readonly error?: string; readonly cause?: string }>;
}

export interface UdsChannelOptions {
  readonly sessions?: UdsSessionDoor;
  /**
   * THE HEARTH ROSTER'S PLANE READ (`hearth-roster`): each named face's intent plane as the roster reads it (far seats, lanes,
   * vota), and each face whose plane did not read with its cause. Absent: no plane reads, and the roster names each face unread.
   */
  readonly hearthPlanes?: HearthPlanes;
  /** THE WORN FACE's ordinal (the mounted face), or null at the floor: an AI seat naming no face acts as it, and where no lent set reads, as it alone (`seat-hand`). */
  readonly mountOrdinal?: () => number | null;
  /** THE LENT SET: the faces the holder names open (under a pūlama, the set it lends). An AI seat names a face inside it (`seat-hand`). */
  readonly lentOrdinals?: () => Promise<readonly number[]>;
  /** EACH HAT REACHED BY NAME: the sibling faces lit beside the mount (their ordinals). A session wearing one carries its own
   *  lane's chores (`FACE_LANE_CHORES`) as itself; every other chore still refuses `chore-face-not-mounted`. Absent: none lit. */
  readonly litOrdinals?: () => readonly number[];
  /** The bare atom key of the lit SIBLING a session's verified presenter names, or undefined (the mount, or a face not lit):
   *  the session's signer books under that key, so the island reads that face's own chain and seals through its own holder. */
  readonly siblingFaceOf?: (presenter: string) => string | undefined;
  /**
   * EACH FACE LIVES ONE LIFE (`face-lifecycle`): the face actors this door admits work and visits through. A session verb or act
   * on a face the vessel knows dispatches only on its actor's yes, read in the same turn as the dispatch, after arbitration; a
   * face closing refuses `face-closing`, a shut one `face-not-open`. A visit's reply delivers through the target's actor. Absent:
   * no face gate (a vessel at its floor).
   */
  readonly faceLife?: Pick<FaceLives, "admitWork" | "admitVisit" | "state" | "known">;
  /**
   * A face its custody serves that stands dark here because its light refused, or that holds closing after the island's open
   * refused it: the census's own line for it (the cause and the act that clears it), or null. The door's `face-not-open` or
   * `face-closing` carries it, so a verb or act aimed at such a face answers at once with its cure. Absent: a shut face reads
   * shut, and no more.
   */
  readonly faceDark?: (face: number) => string | null;
  /**
   * The verbs that VISIT another face when a session call names it as a numeric `target` (the cross-face reads). A visit admits
   * on the target's actor, its reply rides its own request id (the session reads its next frame meanwhile), and the actor
   * delivers it or refuses it. Absent: no call visits.
   */
  readonly visitVerbs?: ReadonlySet<string>;
  /** A LIT FACE RECEIVES VISITS (`seat-hand` `crossFaceTargetAtDoor`): the pet names this vessel holds for its faces, read when a
   *  call names its `target` face by name. Absent: a target names a face by its handle index alone. */
  readonly petnames?: () => Promise<ReadonlyArray<readonly [number, string]>>;
  /** Where a session switch's acts rest: the vessel's sealed row (`nodeSwitchActLog`). No log, no switch. */
  readonly switchActs?: SwitchActLog;
  /**
   * The acts that act as a face and what runs one: the sealed acts (`SESSION_ACTS`, on the custody door's chain) and the
   * store door's face rows (`STORE_DOOR_FACE_VERBS`, main's handler wearing the session's face). A `session:act` frame
   * binds the session's face to the act, hands `run` the face it wears (its ordinal and the presenter the door
   * verified), answers on this socket and leaves a receipt naming the act and the face alone.
   */
  readonly sessionActs?: {
    readonly names: ReadonlySet<string>;
    readonly run: (act: string, args: Record<string, unknown>, worn: { readonly ordinal: number; readonly presenter: string }) => Promise<Record<string, unknown>>;
    /** Fires once per RUN act after its reply left (or failed to), with the very `args` object `run` took; a refused act fires nothing. */
    readonly settled?: (act: string, args: Record<string, unknown>) => void;
  };
  /** Verbs that act as a face (`STORE_DOOR_FACE_VERBS`): the maintenance frame refuses one `face-row-rides-a-session`. */
  readonly sessionVerbs?: ReadonlySet<string>;
  /**
   * Acts a person's hand alone runs (`KAHUA_OPERATOR_VERBS`: the kahua pin, lift and withdraw). A session whose door
   * seated the `seat` profile (a spirit's hand: an agent, the MCP surface) refuses one `beyond-profile` before it runs.
   */
  readonly handOnlyActs?: ReadonlySet<string>;
  /**
   * How the door reads a connection's peer (`uds-peer`'s `peerKindOf`, the hand gate's own reader; a suite names another). Only a
   * peer that reads `hand` books the `cli` asker; one that reads `unknown` books none, and a hand-only act from it refuses
   * `hand-unattested`. The booking stands as the hand gate's CACHED reading (`hand-act-gate`): read once per line or session,
   * carried downstream as `ctx.asker`, never re-read. The frame's own words only NARROW it: a seat mark (`seat: "ai"`) or a
   * session's `seat` hand books the seat without a peer read, and a peer that reads `hand` keeps the hand kind the session frame
   * names (`cli`, `tab`, `watcher`); no word of the frame lifts a peer the reading refused, or books a hand where it read nothing.
   */
  readonly peerKind?: (sock: Socket) => Promise<PeerKind>;
  /** Per-act refusal codes for the hand-only gate; other rows use beyond-profile. */
  readonly handOnlyCodes?: ReadonlyMap<string, string>;
  /**
   * A verb whose hand-only reach turns on its arguments (the shore's settling ops, `shoreHandCode`): the code a seat's call reads,
   * or null where this call settles nothing. It gates exactly as `handOnlyActs` does, on a session and on a one-shot line.
   */
  readonly handOnlyOp?: (verb: string, args: unknown) => string | null;
  /** The args an INGEST no person asked places with (`stampUnattendedIngest`): a seat's, or an unread peer's. */
  readonly unattendedIngest?: (verb: string, args: unknown) => unknown;
  /**
   * Verbs whose answer on a session rides its socket alone (`session:act`): the face rows and the realm verbs that name a
   * face's key at a realm's Nexus (`REALM_KEY_VERBS`). A `session:call`, whose outcome body rests in the daemon wiki's
   * control document beside the session's face, refuses one `answers-on-the-socket`, as it refuses every `sessionVerbs` row.
   */
  readonly socketVerbs?: ReadonlySet<string>;
  /**
   * The session sign door's book (`session-sign-door.ts`): each `session:call` books its request id, its verb and the
   * session that placed it for the call's life, so the daemon island signs through THAT session's signer and no other.
   * Absent → no call books, and every sealed act the island answers refuses `signer-unavailable`.
   */
  readonly signers?: SessionSignBook;
  /** The lock ritual's first move, before a session's signer drops (sealed-store#/owed, R2): the vessel flushes its Repo
   *  and its sealed rest, so every save the session booked lands sealed under it. Absent → the signer drops at once. */
  readonly beforeSignerDrops?: (signer: UdsSessionSigner) => Promise<void>;
  /** NO SILENT LOSS (sealed-store#/owed): a write verb's answer reads, after the Repo's flush, which documents held a save
   *  since its call began and still wait unsealed; a `done` answer then carries `rest: { band: "owed", … }`. */
  readonly restOwed?: { mark(): number; owed(since: number, touches: CallTouches | null): Promise<RestOwedBand | null> };
  /** The vessel's control document (`standControlHome`): its heads name a receipt's durability. */
  readonly controlHandle: DocHandle<LarDoc>;
  /** The verbs a one-shot runs while the control document stands as a stand-in (`floor-verbs`); every other refuses by its name. */
  readonly floorVerbs?: ReadonlySet<string>;
  /** The control document as a store (result.daemon.control): the verdict rows a write leaves and the effect rows rest here. */
  readonly control: CompositeStore;
  /**
   * The DIRECT worker channel (result.daemon.placeVerb) — posts the invocation
   * (verb + `args` CONTENT) straight to the daemon worker over the MessageChannel,
   * so the carriers reach the dispatcher WITHOUT riding the daemon Automerge doc.
   * The worker still writes the durable outcome to `bags/control/outcomes/<id>` in the control
   * document, which this channel awaits through `control`. For a session call, the seat supplies
   * `requestedBy` from the verified presenter and `face` from the verified proof subject.
   */
  readonly placeVerb: (o: { origin: "channel"; verb: string; args: Record<string, unknown>; requestedBy: string; requestId: string; face?: string; ordinal?: number; asker?: Hand; chore?: ChoreReceiptMark; effectKey?: string }) => void;
  /** The ask under this id concluded here (its outcome read, or its wait ended): main's booking for it retires. */
  readonly retireAsk?: (requestId: string) => void;
  /**
   * THE CALLER LEFT A HELD ASK (`heldAsk`: a watch, a waiting events read): its socket closed while the ask held, or a session of
   * its face sent `session:cancel` under its id. The island withdraws the ask's invocation and the dispatcher aborts the handler's
   * signal, so the held handler stops and drops what it held. Every other ask, a write above all, never meets a
   * withdrawal: its signal never aborts, and its outcome lands as its dispatch promised. A raw `{op:"cancel"}` rides its
   * own socket, which placed no ask, so it withdraws nothing.
   */
  readonly withdrawAsk?: (requestId: string) => void;
  /** The vessel's claim on its store — the rendezvous socket (`/tmp/lares-<uid>/<digest>.sock`) both sides derive. */
  readonly claim: StoreClaim & { readonly holder: "vessel" };
  /** The vessel's Automerge Repo: a durability receipt flushes the control document before it names its heads. */
  readonly repo: Pick<Repo, "flush">;
  /** Per-verb await budget (default 30s — recall cold-starts chromadb). */
  readonly timeoutMs?: number;
  /**
   * WHETHER THIS ISOLATE'S AUTOMERGE ENGINE STILL STANDS (`engine-watch`). A control-document fault that carries the engine's fatal
   * signature sets the fall and answers `engine-terminated`; from the fall on, every verb, act and cancel refuses
   * `engine-terminated` before any handler runs, and a receipt answers from the door's memory alone or refuses by name.
   * Each write whose answer lands marks the last settled wave. Absent: no watch.
   */
  readonly engine?: EngineWatch;
  readonly onLog?: (line: string) => void;
}

/** The one signer a session holds; the seat drops it at a close and at a switch's fence. Its certificate is public;
 *  it signs on this thread alone, asking its owner's table first (`SessionSigner`, `PlaceSessionSigner`). */
export interface UdsSessionSigner {
  readonly dropped: boolean;
  drop(): void;
  readonly certificate: unknown;
  sign(purpose: "act", payload: Uint8Array): Promise<{ readonly signature: string } | { readonly refusal: string }>;
}
/**
 * The face supplier verifies the hint at each open and at each switch's preflight, and answers an immutable
 * description: the face, the hand's profile, the worker's presenter, the facet labels, and the mint of the signer.
 * Answering mounts nothing and mints no key; `mint` runs once the owner's table holds the session live at the
 * generation it signs for.
 */
export interface UdsSessionSupply {
  readonly face: SessionFace;
  /** The face's ordinal on this vessel (the hint's `N`): a face row's `face` or `handleIndex` names this face or refuses. */
  readonly ordinal: number;
  readonly profile: CapabilityProfile;
  readonly presenter: string;
  readonly caps?: readonly string[];
  /** Where the supply's proof was made: the Nexus it stands at, or the vessel's own place. One session binds one (face, anchor). */
  readonly anchor: SessionAnchor;
  readonly mint: (at: { readonly table: SessionTable; readonly binding: SessionBinding; readonly session: Session }) =>
    Promise<{ readonly ok: true; readonly signer: UdsSessionSigner } | { readonly ok: false; readonly refusal: string }>;
}
/**
 * Where a session's proof stands: the Nexus the vessel dials (its AID), or, for a vessel standing with no Nexus, the
 * vessel's own place (its W29 place KEL prefix). A session is a meeting between a face and an anchor, held by neither's
 * registry; the vessel's state names the anchor, never its config.
 */
export type SessionAnchor =
  | { readonly kind: "nexus"; readonly aid: string }
  /** A place anchor binds the place KEL's head as well as its prefix: a rotation of the place ends its sessions. */
  | { readonly kind: "place"; readonly aid: string; readonly head: string };
export const sameAnchor = (a: SessionAnchor | undefined, b: SessionAnchor | undefined): boolean =>
  a !== undefined && b !== undefined && a.kind === b.kind && a.aid === b.aid &&
  (a.kind === "nexus" || (b.kind === "place" && a.head === b.head));

export interface UdsSessionDoor {
  open(ask: { faceRef: string; hand: Hand }): Promise<{ ok: true; supply: UdsSessionSupply } | { ok: false; refusal: string }>;
  /** Where the vessel stands now. A session whose anchor the vessel left refuses `anchor-moved` at its next frame. */
  anchorNow(): Promise<SessionAnchor>;
}

export interface Invocation {
  verb: string;
  args?: Record<string, unknown>;
  requestedBy: string;
  requestId?: string;
  /** The caller's own budget, raising the servo's wait within this side's ceiling. Read, never trusted. */
  timeoutMs?: number;
  /**
   * The effect this attempt would produce — a caller-side CONTENT-ADDRESSED key, distinct from `requestId` (a fresh
   * nonce per attempt). Forwarded verbatim to `placeVerb` → the dispatcher's effect index, which answers a repeat
   * attempt with the prior `done` outcome rather than running the handler twice. The door reads it only inside the
   * input digest a same-id re-ask must match.
   */
  effectKey?: string;
  face?: string;
  /** The session's face on this vessel (its ordinal); set by the session door alone, never read off a frame. */
  ordinal?: number;
  /** The asker's hand as this door read it (the session's own hand, or `seat`/`cli` off the one-shot line's seat kind); set
   *  by the door alone, never read off a frame, and handed to the placed ask so the reactor's context names it. */
  asker?: Hand;
  /** The chore's receipt mark this door built; set by the door alone, it rides the placed ask into the durable outcome. */
  chore?: ChoreReceiptMark;
}

/** A session call's face gate, read at its dispatch (`gateFor`): a visit's ticket or the worn face's work ticket, or a refusal. */
export interface DoorGate {
  readonly visit: boolean;
  admit(refuse: (reason: string) => void):
    | { readonly ok: true; readonly work?: WorkTicket; readonly visit?: VisitTicket }
    | { readonly ok: false; readonly refusal: string; readonly message: string };
}

/** What a `{op:"receipt"}` query answers — a READ, never a dispatch. */
export interface ReceiptAnswer {
  readonly requestId: string;
  /**
   * `abandoned`  — this vessel refused the request before dispatch (an EOF-drop or an explicit `cancel`), in this
   *                life's memory; re-run to try again, never read back as a verdict on the act.
   * `committed`  — dispatched in this life, and no answer has landed yet (still running; re-query).
   * `done`/`error` — the answer the ring holds, or the verdict row a write left (its body released).
   * `unknown`    — nothing this vessel holds names this id (another life dispatched it, or its answer left the ring
   *                and it left no row): the honest "no idea", never told as `error`.
   */
  readonly state: "abandoned" | "committed" | "done" | "error" | "unknown";
  readonly results?: Record<string, unknown>;
  readonly errorMessage?: string;
  /** Additive, mirroring the socket's own direct-refusal shape — a terminal outcome's own
   *  machine-readable reason, when it carried one (D1 commit 1, mesh). */
  readonly refusal?: { readonly reason: string };
  /** The chore's receipt mark the outcome carries (the acting face, the asker's hand, its session), where the act was a
   *  chore the door marked; read back through `choreReceiptMarkOf`, so a malformed mark reads as none. */
  readonly chore?: ChoreReceiptMark;
  /** A VISIT's outcome (a read of another lit face, `seat-hand`): its body answered its caller once, and a receipt withholds it. */
  readonly visit?: { readonly withheld: true };
  /** A body the answer ring let go (its bound, or a restart): the verdict stands, with the measure of the body and the cure. */
  readonly body?: { readonly released: true; readonly sha256?: string; readonly bytes?: number; readonly cure: string };
  /** The engine's fall (`engine-watch`), where the answer came from the door's memory after the engine stopped. */
  readonly engine?: Record<string, unknown>;
}

/** A door call slower than this, read to outcome, logs one line naming its two spans (`noteSlowCall`). */
export const SLOW_DOOR_CALL_MS = 2_000;

export interface UdsChannel { close: () => void; }

/** One composition's seat on the verb socket: the ask book, the outcome reads and the dispatch bound to its daemon. */
export interface UdsSeat {
  readonly handle: (parsed: unknown, sock: Socket) => void;
  readonly handleSessionFrame?: (parsed: unknown, sock: Socket) => void;
  /**
   * Leave the socket. Resolves once every frame this seat was handed has its answer written (or its caller gone),
   * so the composition beneath it tears down under no request still reading its book or awaiting its worker.
   */
  readonly close: () => void | Promise<void>;
}

/** The floor's hold on the verb socket: it serves the claim once and outlives every composition. */
export interface UdsFront {
  /** Seat a composition; held callers are handed over in arrival order without another seat reading them first. */
  readonly attach: (seat: UdsSeat) => void;
  /**
   * Unseat it. New callers remain held until the next attach. Resolves once the seat's own `close` settles: every
   * frame already handed to it has answered, so nothing of the retiring composition still serves a caller.
   */
  readonly detach: () => Promise<void>;
  /** Refuse every caller and stop serving. Resolves once the seat's own `close` settles (T3): each standing session's
   *  flush landed before its signer dropped, so a stand-down awaits it before it goes on. */
  readonly close: () => Promise<void>;
}
