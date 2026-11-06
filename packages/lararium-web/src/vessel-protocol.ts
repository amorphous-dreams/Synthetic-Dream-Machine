/**
 * vessel-protocol — the typed messages between the page's main thread and the vessel worker's thread
 * (lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift#/the-shape).
 *
 * The vessel worker runs `openBrowserVessel` unchanged; each `BrowserVesselOptions` callback maps one to one onto a message
 * here, and each result member the page reads maps onto a request with its reply. Types alone: this module loads nothing.
 *
 *   option / result member            message
 *   ───────────────────────────────── ─────────────────────────────────────────────
 *   onPhase                           vessel → page  `phase`
 *   onFrame                           vessel → page  `frame`
 *   onControlResult                   vessel → page  `control-result`
 *   onCoherence                       vessel → page  `coherence`
 *   onPortMessage                     vessel → page  `port-msg` (a placement the vessel refused: `port:refused`)
 *   onRest                            vessel → page  `status{rest}`
 *   askCustody / askWardRoute         vessel → page  `ask{askId, kind, act, words}` and `ask:settled{askId}`; page → vessel
 *                                     `ceremony:port{askId, port}` (one end of the ceremony's channel, transferred, never read)
 *                                     or `ceremony:refused{askId, refusal}`
 *   pageLife                          page → vessel  `page:life`
 *   sendControlEvent                  page → vessel  `control-event`
 *   setActiveSurface                  page → vessel  `set-surface`
 *   ports.place / ports.close         page → vessel  `port:place` / `port:close` (the mirror's port road)
 *   mirrorInputs / readFloor          page → vessel  `read:mirror-inputs` / `read:floor`, answered by `reply`
 *   identity, wiki, connectionState   vessel → page  `status{vessel, connection}`
 *   the fleet-join door               page → vessel  `join:offer{text}` / `join:answer{text}`, answered by `reply`
 *   the holder's SharedWorker         vessel → page  `spawn{role}`; page → vessel `spawned{port}` (transferred, never read)
 *   a boot that stops                 vessel → page  `ended{why, refusal?}` (`store-owned`: another worker owns the store)
 *
 * THE SESSION (`@lararium/browser` vessel-sessions.ts). The port opens one session at `hello`; the vessel answers
 * `greeting{ownerEpoch, sessionId, lifetimeLock}` (an earlier greeting the hello names and this vessel did not mint reads
 * `refused` by name, and the session opens afresh). The page holds `lifetimeLock` for its life and says `session:armed`, so
 * the vessel hears a lost tab when the platform hands it that lock. The vessel pings (`ping`) on its own clock, and the
 * page answers `pong`. The session admits only by its own unlock; `status{floor}` names the vessel's floor state.
 * The hello names the face the tab selected (`face`, a PersonaGroup); the session wears it and admits by THAT face's own
 * unlock, and `status{face}` hands the admitted face back for the tab to keep as its selection.
 *
 * THIS PORT CARRIES NO ANSWER BYTES. The answer to a custody or ward ask travels from the ceremony document down its own
 * brokered port (`ceremony-protocol.ts`) straight to this vessel worker; the page mints that port's channel and keeps neither end.
 */
import type {
  BootCustodyVerdict, BrowserConnectionSnapshot, CoherenceFrameWithRev, PageLife, ProjectionSurfaceFrame,
} from "@lararium/browser/page";
import type { CeremonyAskKind } from "./ceremony-protocol.js";
import type { FloorAnchor, GenesisSeed, LarMsg_ControlEvent, LarMsg_ControlResult, VesselRestState } from "@lararium/mesh";

/** What the page hands the vessel worker to boot on: public inputs alone (URLs, the served seed, the arrival's carriage). */
export interface VesselBoot {
  readonly idbName: string;
  readonly hostId: string;
  readonly wikiId: string;
  readonly genesisSeed: GenesisSeed;
  readonly genesisCasBaseUrl: string;
  /** The island workers' built URLs: the vessel worker spawns them nested from its own thread. */
  readonly daemonWorkerUrl: string;
  readonly workerScriptUrl: string;
  /** The shared holder's built URL (`?holder`); the page builds the SharedWorker when the vessel asks (`spawn`). */
  readonly sharedHolderUrl?: string;
  readonly relayUrl?: string;
  readonly floorCard?: string;
  readonly floorAnchor?: FloorAnchor;
  /** The fleet-join landing's admit carriage (`toAdmitCarriage`), taken once off this tab's stash. */
  readonly admitCarriage?: string;
  /** The `?mesh=` carry-in: the leaf's coordinate seed and the raw peer list the vessel worker reads (`parseMeshPeer`). */
  readonly meshLeaf?: { readonly coordSeed: string; readonly peers: string };
}

/** The vessel's floor state, a public enum: `floor` (locked: public readings alone, `signer-unavailable` on asks), `lighting`, `lit`. */
export type VesselFloor = "floor" | "lighting" | "lit";

/** The seed's resting state, named and never its bytes. */
export type SeedRest = "absent" | "wrapped-prf" | "wrapped-passphrase" | "open";

/** Public readings alone. */
export interface VesselStatus {
  readonly custody?: BootCustodyVerdict["reading"];
  /** The face (PersonaGroup) the session wears once admitted, public: the tab keeps it as its own selection. */
  readonly face?: string;
  readonly floor?: VesselFloor;
  readonly seedRest?: SeedRest;
  /** The key class of a passkey wrap, where `seedRest` reads `wrapped-prf`. */
  readonly seedWrapClass?: string;
  readonly connection?: BrowserConnectionSnapshot;
  readonly rest?: VesselRestState;
  readonly vessel?: {
    readonly verifyingKey: string;
    readonly did: string;
    readonly activeWikiId: string;
    readonly wikiDocUrl: string;
    readonly oracleDocUrl: string | null;
  };
}

/** A refusal as it crosses: its name, its words and, for a fleet join, its named refusal. */
export interface VesselError { readonly name: string; readonly message: string; readonly refusal?: string }

export type JoinOfferReply = { readonly kind: "request"; readonly text: string };
/** `face` names the PersonaGroup the landed join joins: the tab selects it, so its next hello wears it. */
export type JoinAnswerReply = { readonly kind: "landed"; readonly carriage: string; readonly signerDid: string; readonly face: string };

export type PageToVessel =
  /** `face` names the PersonaGroup the tab selected for this session (absent: the one face the store names, or none). A hint
   *  grants nothing: that face's own unlock admits the session. */
  | { readonly t: "hello"; readonly tabSession: string; readonly boot: VesselBoot; readonly face?: string | null; readonly resume?: { readonly ownerEpoch: string; readonly sessionId: string } }
  | { readonly t: "session:armed"; readonly sessionId: string }
  | { readonly t: "pong"; readonly n: number }
  | { readonly t: "ceremony:port"; readonly askId: string; readonly port: MessagePort }
  | { readonly t: "ceremony:refused"; readonly askId: string; readonly refusal: string }
  | { readonly t: "control-event"; readonly surface: string; readonly ev: LarMsg_ControlEvent }
  | { readonly t: "set-surface"; readonly surface: string }
  | { readonly t: "port:want"; readonly wantId: string; readonly tabSession: string }
  | { readonly t: "port:place"; readonly surface: string; readonly binding: string; readonly msg: unknown }
  | { readonly t: "port:close"; readonly binding: string }
  | { readonly t: "page:life"; readonly life: PageLife }
  | { readonly t: "read:mirror-inputs"; readonly callId: string; readonly surface: string }
  | { readonly t: "read:floor"; readonly callId: string; readonly baseUrl: string }
  | { readonly t: "join:offer"; readonly callId: string; readonly text: string; readonly abandonPending: boolean }
  | { readonly t: "join:answer"; readonly callId: string; readonly text: string }
  | { readonly t: "spawned"; readonly spawnId: string; readonly port?: MessagePort; readonly refused?: string }
  | { readonly t: "walk:restart"; readonly callId: string; readonly reason: string }
  | { readonly t: "walk:ward"; readonly callId: string; readonly bytes: Uint8Array };

export type VesselToPage =
  | { readonly t: "greeting"; readonly ownerEpoch: string; readonly sessionId: string; readonly lifetimeLock: string; readonly refused?: string }
  | { readonly t: "ping"; readonly n: number }
  | { readonly t: "phase"; readonly phase: string }
  | { readonly t: "frame"; readonly frame: ProjectionSurfaceFrame }
  | { readonly t: "control-result"; readonly surface: string; readonly result: LarMsg_ControlResult }
  | { readonly t: "coherence"; readonly frame: CoherenceFrameWithRev }
  | { readonly t: "port-msg"; readonly binding: string; readonly islandKey: string; readonly msg: unknown }
  | { readonly t: "port:minted"; readonly wantId: string; readonly port?: MessagePort; readonly refused?: string }
  | { readonly t: "port:refused"; readonly binding: string; readonly reason: string; readonly opening: boolean; readonly portId?: string }
  /** `face` names the PersonaGroup the ask speaks for (null: this browser itself); a public name, never a key. */
  | { readonly t: "ask"; readonly askId: string; readonly kind: CeremonyAskKind; readonly act: string; readonly words: string; readonly face: string | null }
  | { readonly t: "ask:settled"; readonly askId: string }
  | { readonly t: "status"; readonly status: VesselStatus }
  | { readonly t: "reply"; readonly callId: string; readonly ok: true; readonly value: unknown }
  | { readonly t: "reply"; readonly callId: string; readonly ok: false; readonly error: VesselError }
  | { readonly t: "spawn"; readonly spawnId: string; readonly role: "holder"; readonly url: string; readonly name: string }
  | { readonly t: "ended"; readonly why: string; readonly stage: "custody" | "open"; readonly refusal?: string };
