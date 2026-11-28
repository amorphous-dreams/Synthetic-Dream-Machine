/**
 * vessel-protocol — the typed messages between the page's main thread and the vessel worker's thread
 * (lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift#/the-shape).
 *
 * The vessel worker runs `openBrowserVessel` unchanged; each `BrowserVesselOptions` callback maps one to one onto a message
 * here, and each result member the page reads maps onto a request with its reply. This module imports types alone; what it
 * holds at run time: the declared message table, the protocol's content address and the skew refusal (see THE PROTOCOL NAMES
 * ITSELF below).
 *
 *   option / result member            message
 *   ───────────────────────────────── ─────────────────────────────────────────────
 *   onPhase                           vessel → page  `phase`
 *   onFrame                           vessel → page  `frame`
 *   onControlResult                   vessel → page  `control-result`
 *   onControlPending                  vessel → page  `control-pending`
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
 *   the console door                  page → vessel  `verb{argv}`, answered by `reply` (`console-door.ts`: a held verb's exact
 *                                     path alone crosses, never a word past it, so no secret rides this message)
 *
 * THE SESSION (`@lararium/browser` vessel-sessions.ts). The port opens one session at `hello`; the vessel answers
 * `greeting{ownerEpoch, sessionId, lifetimeLock}` (an earlier greeting the hello names and this vessel did not mint reads
 * `refused` by name, and the session opens afresh). The page holds `lifetimeLock` for its life and says `session:armed`, so
 * the vessel hears a lost tab when the platform hands it that lock. The vessel pings (`ping`) on its own clock, and the
 * page answers `pong`. The session admits only by its own unlock; `status{floor}` names the vessel's floor state.
 * The hello names the face the tab selected (`face`, a PersonaGroup); the session wears it and admits by THAT face's own
 * unlock, and `status{face}` hands the admitted face back for the tab to keep as its selection.
 *
 * THE PROTOCOL NAMES ITSELF BY ITS CONTENT, NEVER BY A COUNT. Two tabs can run different builds after a deploy, and a
 * follower tab's port reaches the owner tab's vessel worker. So the hello carries `protocol` and the greeting
 * answers with its own: the SHA-256 of the declared message table (`VESSEL_PROTOCOL_TABLE`), every tag with every field it
 * carries. Two builds whose tables hash alike speak; two that differ refuse `protocol-skew` on whichever side reads the other's
 * name first, and the refusal names a cure a person can act on in the moment (reload or close the other tabs, so every tab
 * runs one build). Tabs that carry different lands of this table refuse each other BY DESIGN: each land that adds or removes
 * a field moves the hash. A hash orders nothing, so neither side ranks its build above the other's; no clock and no
 * counter enters. `VESSEL_PROTOCOL` pins that hash in source, so a moved table shows in the diff, and
 * `tests/vessel-protocol-version.test.ts` holds the pin to the table.
 *
 * THIS PORT CARRIES NO ANSWER BYTES. The answer to a custody or ward ask travels from the ceremony document down its own
 * brokered port (`ceremony-protocol.ts`) straight to this vessel worker; the page mints that port's channel and keeps neither end.
 */
import type {
  BootCustodyVerdict, BrowserConnectionSnapshot, CoherenceFrameWithRev, PageLife, ProjectionSurfaceFrame,
} from "@lararium/browser/page";
import type { CeremonyAskKind } from "./ceremony-protocol.js";
import type { FloorAnchor } from "@lararium/mesh/hearth-floor-pins";
import type { GenesisSeed } from "@lararium/mesh/genesis-doc";
import type { LarMsg_ControlEvent, LarMsg_ControlResult } from "@lararium/mesh/lar-camera";
import type { VesselRestState } from "@lararium/mesh/vessel-island-pool-core-door";

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
  /** THE FOUNDING ACT (the page's founding door, an act on its own surface, never a URL): this person asks the vessel to found a face of its own over its veil floor. Absent, the
   *  vessel stays at its floor until a fleet join overlays a face. */
  readonly foundFace?: true;
}

/** The vessel's floor state, a public enum: `floor` (locked: public readings alone, `signer-unavailable` on asks), `lighting`, `lit`. */
export type VesselFloor = "floor" | "lighting" | "lit";

/** The seed's resting state, named and never its bytes. */
/** `open-veil`: an unbound veil floor: no face worn and no slot bound, so the vessel's key and its floor's own key rest in
 *  the open pre-bind window (the-veil-ladder#/the-base-model, the throwaway rung). */
export type SeedRest = "absent" | "wrapped-prf" | "wrapped-passphrase" | "open" | "open-veil";

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
    /** The wiki the vessel stands in for on its floor wiki, waiting on a face: its own line (`wiki-awaits-face`), or absent. */
    readonly wikiAwaits?: string;
    readonly wikiDocUrl: string | null;
    readonly oracleDocUrl: string | null;
  };
}

/** A refusal as it crosses: its name, its words and, for a fleet join, its named refusal. */
export interface VesselError { readonly name: string; readonly message: string; readonly refusal?: string }

export type JoinOfferReply = { readonly kind: "request"; readonly text: string };
/** `face` names the PersonaGroup the landed join joins: the tab selects it, so its next hello wears it. */
/** leaf-fleet (Leaf-Wright): the root holder's replies. `faces` lists the faces this browser holds a root for; a file reply carries one file's text. */
export type FleetRootFacesReply = { readonly kind: "faces"; readonly faces: readonly { readonly personaGroup: string; readonly label: string }[] };
export type FleetRootFileReply = { readonly kind: "offer" | "answer" | "seat-request" | "seat-grant"; readonly text: string };
export type FleetSeatLandReply = { readonly kind: "seat-kept"; readonly face: string };
/** The active wiki's working layer as this vessel mounted it: the slug, and the document the vessel's composite reads it from. */
export type WorkbenchReadingReply = { readonly kind: "workbench"; readonly slug: string; readonly bagId: string; readonly documentUrl: string | null };
export type JoinAnswerReply = { readonly kind: "landed"; readonly carriage: string; readonly signerDid: string; readonly face: string };

export type PageToVessel =
  /** `protocol` names the build's message table by its hash (`VESSEL_PROTOCOL`); a vessel that holds another refuses `protocol-skew`.
   *  `face` names the PersonaGroup the tab selected for this session (absent: the one face the store names, or none). A hint
   *  grants nothing: that face's own unlock admits the session. */
  | { readonly t: "hello"; readonly protocol: string; readonly tabSession: string; readonly boot: VesselBoot; readonly face?: string | null; readonly resume?: { readonly ownerEpoch: string; readonly sessionId: string } }
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
  // ── leaf-fleet (Leaf-Wright): the fleet-join door's ROOT-HOLDER half. Files in, files out; the vessel asks the face's ward by the ceremony door. ──
  | { readonly t: "fleet-root:faces"; readonly callId: string }
  | { readonly t: "fleet-root:offer"; readonly callId: string; readonly personaGroup: string }
  | { readonly t: "fleet-root:answer"; readonly callId: string; readonly personaGroup: string; readonly text: string }
  // THE CARRIED SEAT (a second round of two files): the root holder grants a carried seat request; the joined leaf asks and lands.
  | { readonly t: "fleet-root:seat"; readonly callId: string; readonly text: string }
  | { readonly t: "fleet-seat:faces"; readonly callId: string }
  | { readonly t: "fleet-seat:request"; readonly callId: string; readonly personaGroup: string }
  | { readonly t: "fleet-seat:land"; readonly callId: string; readonly text: string }
  // A read-only instrument: the active wiki's working layer, so two leaves of one face read one workbench address.
  | { readonly t: "fleet-seat:workbench"; readonly callId: string }
  // ── /leaf-fleet ──
  | { readonly t: "spawned"; readonly spawnId: string; readonly port?: MessagePort; readonly refused?: string }
  /** THE CONSOLE DOOR: one verb by the CLI's own argv path (`["vessel", "read"]`, `["help"]`). The vessel answers it from its own
   *  table before any unlock; `readFace` names the origin the page reads its hearth's porch at, for a row that reads the floor. */
  | { readonly t: "verb"; readonly callId: string; readonly argv: readonly string[]; readonly readFace: string }
  | { readonly t: "walk:restart"; readonly callId: string; readonly reason: string }
  | { readonly t: "walk:ward"; readonly callId: string; readonly bytes: Uint8Array };

export type VesselToPage =
  | { readonly t: "greeting"; readonly protocol: string; readonly ownerEpoch: string; readonly sessionId: string; readonly lifetimeLock: string; readonly refused?: string }
  | { readonly t: "ping"; readonly n: number }
  | { readonly t: "phase"; readonly phase: string }
  | { readonly t: "frame"; readonly frame: ProjectionSurfaceFrame }
  | { readonly t: "control-result"; readonly surface: string; readonly result: LarMsg_ControlResult }
  /** A resend that met its act still waiting at the vessel (`control-event-pending`): the act stands held, its result to come. */
  | { readonly t: "control-pending"; readonly surface: string; readonly eventId: string }
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

// ── the protocol names itself ────────────────────────────────────────────────────────────────────

type KeysOf<T> = T extends unknown ? keyof T : never;
/** `1` where every member carrying the field needs it, `0` where it rides optional; a field only some members of one tag carry reads either. */
type Need<T, F extends PropertyKey> = T extends unknown ? (F extends keyof T ? (Record<never, never> extends Pick<T, F> ? 0 : 1) : 0) : never;
/** Every tag of a message union, each with every field it carries beside `t`. The compiler holds the table to the union: a
 *  tag or field the union lacks refuses as an excess key, one the table lacks refuses as a missing key, and a flag that
 *  disagrees with the field's optionality refuses by type. */
type MessageTable<U extends { readonly t: string }> = {
  readonly [K in U["t"]]: { readonly [F in Exclude<KeysOf<Extract<U, { readonly t: K }>>, "t">]: Need<Extract<U, { readonly t: K }>, F> };
};
type StructTable<S> = { readonly [F in keyof S]-?: Record<never, never> extends Pick<S, F> ? 0 : 1 };

/**
 * THE DECLARED MESSAGE TABLE: what crosses the port, as data. `1` marks a needed field, `0` an optional one. The table reaches
 * one level into the three records a message carries whole (`VesselBoot`, `VesselStatus`, `VesselError`); a change deeper than
 * that, or a change of meaning under an unchanged shape, moves no key here, so its author adds a line to `laws` and the hash
 * moves with the words.
 */
export const VESSEL_PROTOCOL_TABLE = {
  pageToVessel: {
    "hello": { protocol: 1, tabSession: 1, boot: 1, face: 0, resume: 0 },
    "session:armed": { sessionId: 1 },
    "pong": { n: 1 },
    "ceremony:port": { askId: 1, port: 1 },
    "ceremony:refused": { askId: 1, refusal: 1 },
    "control-event": { surface: 1, ev: 1 },
    "set-surface": { surface: 1 },
    "port:want": { wantId: 1, tabSession: 1 },
    "port:place": { surface: 1, binding: 1, msg: 1 },
    "port:close": { binding: 1 },
    "page:life": { life: 1 },
    "read:mirror-inputs": { callId: 1, surface: 1 },
    "read:floor": { callId: 1, baseUrl: 1 },
    "join:offer": { callId: 1, text: 1, abandonPending: 1 },
    "join:answer": { callId: 1, text: 1 },
    "fleet-root:faces": { callId: 1 },
    "fleet-root:offer": { callId: 1, personaGroup: 1 },
    "fleet-root:answer": { callId: 1, personaGroup: 1, text: 1 },
    "fleet-root:seat": { callId: 1, text: 1 },
    "fleet-seat:faces": { callId: 1 },
    "fleet-seat:request": { callId: 1, personaGroup: 1 },
    "fleet-seat:land": { callId: 1, text: 1 },
    "fleet-seat:workbench": { callId: 1 },
    "spawned": { spawnId: 1, port: 0, refused: 0 },
    "verb": { callId: 1, argv: 1, readFace: 1 },
    "walk:restart": { callId: 1, reason: 1 },
    "walk:ward": { callId: 1, bytes: 1 },
  } satisfies MessageTable<PageToVessel>,
  vesselToPage: {
    "greeting": { protocol: 1, ownerEpoch: 1, sessionId: 1, lifetimeLock: 1, refused: 0 },
    "ping": { n: 1 },
    "phase": { phase: 1 },
    "frame": { frame: 1 },
    "control-result": { surface: 1, result: 1 },
    "control-pending": { surface: 1, eventId: 1 },
    "coherence": { frame: 1 },
    "port-msg": { binding: 1, islandKey: 1, msg: 1 },
    "port:minted": { wantId: 1, port: 0, refused: 0 },
    "port:refused": { binding: 1, reason: 1, opening: 1, portId: 0 },
    "ask": { askId: 1, kind: 1, act: 1, words: 1, face: 1 },
    "ask:settled": { askId: 1 },
    "status": { status: 1 },
    "reply": { callId: 1, ok: 1, value: 0, error: 0 },
    "spawn": { spawnId: 1, role: 1, url: 1, name: 1 },
    "ended": { why: 1, stage: 1, refusal: 0 },
  } satisfies MessageTable<VesselToPage>,
  records: {
    VesselBoot: {
      idbName: 1, hostId: 1, wikiId: 1, genesisSeed: 1, genesisCasBaseUrl: 1, daemonWorkerUrl: 1, workerScriptUrl: 1,
      sharedHolderUrl: 0, relayUrl: 0, floorCard: 0, floorAnchor: 0, admitCarriage: 0, foundFace: 0,
    } satisfies StructTable<VesselBoot>,
    VesselStatus: { custody: 0, face: 0, floor: 0, seedRest: 0, seedWrapClass: 0, connection: 0, rest: 0, vessel: 0 } satisfies StructTable<VesselStatus>,
    VesselError: { name: 1, message: 1, refusal: 0 } satisfies StructTable<VesselError>,
  },
  laws: [
    "the hello opens one session and the greeting answers it; each names its protocol, and a differing name refuses protocol-skew",
  ] as readonly string[],
};

/** One byte order for any table: keys sorted at every depth, arrays in their own order. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/** A table's content address: `sha256-<hex>` over its canonical bytes. */
export async function protocolAddressOf(table: unknown): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(table)));
  return `sha256-${[...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * THIS BUILD'S PROTOCOL: `protocolAddressOf(VESSEL_PROTOCOL_TABLE)`, pinned. A change to the table above moves the hash, the
 * witness (`tests/vessel-protocol-version.test.ts`) goes red and prints the address to pin here.
 */
export const VESSEL_PROTOCOL = "sha256-a1e3a584b0b3979f980d74e9d4d9127e7592f93f113bef6f33c795160f7fbcdc";

/** The refusal two builds with differing tables give each other. */
export const PROTOCOL_SKEW = "protocol-skew";

const short = (address: string): string => address.slice(0, 15);

/**
 * Read the other side's protocol name against this build's. Null where they agree. A differing or absent name refuses, with
 * both names and the cure in its words; `mine` stands open for the witness alone.
 */
export function protocolSkew(theirs: unknown, mine: string = VESSEL_PROTOCOL): { readonly refusal: typeof PROTOCOL_SKEW; readonly why: string } | null {
  if (theirs === mine) return null;
  const named = typeof theirs === "string" && theirs.length > 0 ? `names ${short(theirs)}` : "names no protocol";
  return {
    refusal: PROTOCOL_SKEW,
    why: `this tab and this browser's vessel come from two builds of this site: this side speaks ${short(mine)} and the other ${named}. Reload or close the other tabs of this site, then reload this one, so every tab runs one build`,
  };
}
