/**
 * lar-camera — the camera contract at the engine↔projection waist, in the `lar:` namespace.
 *
 * One headless engine renders a root template into a document sink; the sink's surface divides into KEYS,
 * each carrying its WHOLE rendered state and its own monotone revision (dreamdom#/the-ruling). Frames travel
 * DOWN as `lar:frame`; a person's acts travel UP as `lar:control-event` in one of four kinds, and every reliable
 * act gets an answer on `lar:control-result` (dreamdom#/the-crossings, page-controls#/the-wire,
 * session-contract#/the-holder-protocol). A surface switch or a late attach asks `lar:resend`, and the engine
 * answers with a fresh mount epoch and a whole snapshot. The engine asks the surface for a host door with
 * `lar:service`, answered by a control event of kind `lar:service-result`.
 *
 * Three laws every reader keeps:
 *   - A KEY PAINTS FROM NOTHING. No delta enters a frame; a key whose payload reads as an operation counts as a
 *     delta wearing a key. Any frame may drop and the next one heals it.
 *   - ONE WRITER PER KEY. The engine writes rendered keys, the page writes sensed keys. A revision compares only
 *     against its own key's earlier revisions within one mount epoch; newest wins by that single writer's number,
 *     never by arrival order and never by a clock.
 *   - EVERY RELIABLE ACT GETS AN ANSWER. `lar:act`, `lar:write` and `lar:service-result` carry an id and answer
 *     `applied`, `stale-target` or a named refusal; `lar:sense` coalesces newest-wins and answers only through
 *     `sensedRevision` in a later frame. A stale target never drops in silence.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/lar-camera
 */

// ── Kinds on the wire ───────────────────────────────────────────────────────────────────────────

export const LAR_FRAME          = "lar:frame";
export const LAR_CONTROL_EVENT  = "lar:control-event";
export const LAR_CONTROL_RESULT = "lar:control-result";
export const LAR_RESEND         = "lar:resend";
export const LAR_SERVICE        = "lar:service";

/** The keys the browser DOM sink's story camera declares at mount. A camera may declare others. */
export const LAR_KEY_SURFACE    = "lar:surface";
export const LAR_KEY_STYLE      = "lar:style";
export const LAR_KEY_MEMBERSHIP = "lar:membership";

/** The story camera every wiki island mounts over its root template. */
export const LAR_CAMERA_STORY   = "lar:story";

/** The bound a whole value carries: characters, counted, refused above the line (one number, one site). */
export const LAR_WHOLE_VALUE_MAX_CHARS = 65_536;
/** The bound a bounded-bytes payload (an import offer, a drop) carries. */
export const LAR_WHOLE_BYTES_MAX = 8 * 1024 * 1024;

// ── Down: the frame ─────────────────────────────────────────────────────────────────────────────

/** One key of a frame: whole rendered state under one monotone revision. Exactly one of the payload fields stands. */
export interface LarFrameKey {
  readonly key: string;
  readonly rev: number;
  /** Whole HTML of a rendered key (the surface, a river frame). */
  readonly html?: string;
  /** Whole CSS of a stylesheet key. */
  readonly css?: string;
  /** The complete visible set, for the membership key. Omission never means deletion. */
  readonly members?: readonly string[];
  /** A deleted key, named: the only way a key leaves. */
  readonly tombstone?: true;
}

/** Engine → surface: the keyed absolute frame of one camera on one surface, under one mount epoch. */
export interface LarMsg_Frame {
  readonly type: typeof LAR_FRAME;
  readonly wikiUri: string;
  readonly cameraId: string;
  /** Minted at mount and on every `lar:resend`; an act carrying another epoch answers `stale-target`. */
  readonly mountEpoch: number;
  readonly keys: readonly LarFrameKey[];
  /** Per control id, the page revision the engine had taken in when it rendered. */
  readonly sensedRevision: Readonly<Record<string, number>>;
}

// ── Up: the control event ───────────────────────────────────────────────────────────────────────

/** The four crossings up. */
export type LarControlKind = "lar:act" | "lar:sense" | "lar:write" | "lar:service-result";

/** The modifier set an act carries, read as of the act. */
export interface LarModifiers {
  readonly ctrl: boolean; readonly meta: boolean; readonly alt: boolean; readonly shift: boolean;
  /** The pointer button, where a pointer made the act. */
  readonly button?: number;
}

/** A key chord, read as of the act, with the real key and code. */
export interface LarKeyChord {
  readonly key: string; readonly code: string; readonly keyCode: number; readonly repeat: boolean;
}

/** Geometry measured on the page at the moment of an act: it answers that act's handler and no other. */
export interface LarGeometry {
  readonly top: number; readonly left: number; readonly right: number; readonly bottom: number;
  readonly width: number; readonly height: number;
}

/** A whole record a `lar:write` carries. */
export interface LarWriteRecord {
  readonly title: string;
  readonly fields: Readonly<Record<string, string | readonly string[]>>;
  /** A deleted record, named. */
  readonly tombstone?: true;
}

/** The whole value an event carries: a whole string, a whole key set, a whole ordered id list, or bounded bytes. */
export type LarWholeValue = string | readonly string[] | Uint8Array;

/** Surface → engine: one act, sense, write or service answer, addressed to one control of one camera under one mount epoch. */
export interface LarMsg_ControlEvent {
  readonly type: typeof LAR_CONTROL_EVENT;
  /** Idempotence key within `mountEpoch`: a resend after a lost answer carries the same id. */
  readonly eventId: string;
  readonly cameraId: string;
  readonly mountEpoch: number;
  readonly kind: LarControlKind;
  /** The target, by exactly one of: a declared control id, a render id the frame carried, an affordance id a blocks key carried. */
  readonly controlId?: string;
  readonly renderId?: string;
  readonly affordanceId?: string;
  /** The control's declared type (`lar-field`, `lar-popover`, …) where the template named one. */
  readonly controlType?: string;
  /** What the person did: `lar:click`, `lar:key`, `lar:commit`, `lar:toggle`, `lar:choice`, `lar:drop`, `lar:import-offer`, `lar:order`, `lar:confirm`, `lar:route`, `lar:sense`, `lar:write`, a service kind. */
  readonly action: string;
  /** The revision of the surface key the page showed when the person acted. */
  readonly seenFrameRev: number;
  /** The membership key's revision the page showed. */
  readonly seenMembershipRev?: number;
  /** The page's own revision of this control's value, carried by a sense and by a commit. */
  readonly localRev?: number;
  /** A whole string, a whole key set, a whole ordered id list, or bounded bytes. Never a diff, never a keystroke. */
  readonly wholeValue?: LarWholeValue;
  /** `checked` for a toggle, read as of the act. */
  readonly checked?: boolean;
  /** The selection a toolbar act carries beside its whole value. */
  readonly selection?: { readonly start: number; readonly end: number };
  readonly modifiers?: LarModifiers;
  readonly key?: LarKeyChord;
  readonly geometry?: LarGeometry;
  /** The records a `lar:write` carries, with its transaction id and the basis it builds on. */
  readonly records?: readonly LarWriteRecord[];
  readonly txId?: string;
  /** The heads the write builds on, one per bag it read; the engine answers `stale-target` when a head moved. */
  readonly basis?: readonly string[];
  /** The `lar:service` request a `lar:service-result` answers, with its status. */
  readonly requestId?: string;
  readonly status?: "ok" | LarRefusal;
}

// ── The answer ──────────────────────────────────────────────────────────────────────────────────

/** The refusal words a person reads beside the control (page-controls#/refusals), plus the engine's own. */
export type LarRefusal =
  | "invalid-integer" | "input-too-long" | "stale-target" | "selection-unavailable" | "geometry-unavailable"
  | "route-unresolved" | "unsupported-control" | "binding-unavailable" | "page-action-unavailable"
  | "unclaimed" | "actor-not-spawned" | "superseded" | "cap-refused";

export type LarResultStatus = "applied" | "stale-target" | "refused";

/** Engine → surface: the answer to one reliable control event. Frames never answer events. */
export interface LarMsg_ControlResult {
  readonly type: typeof LAR_CONTROL_RESULT;
  readonly eventId: string;
  readonly cameraId: string;
  readonly mountEpoch: number;
  readonly controlId?: string;
  readonly renderId?: string;
  readonly status: LarResultStatus;
  readonly reason?: LarRefusal;
  /** What the engine wants the control to hold after a text operation; the page applies it only while its revision still matches. */
  readonly want?: { readonly value: string; readonly selStart: number; readonly selEnd: number };
}

// ── Resend and services ─────────────────────────────────────────────────────────────────────────

/** Surface → engine: paint me whole. The engine mints a new mount epoch and emits every key. */
export interface LarMsg_Resend {
  readonly type: typeof LAR_RESEND;
  readonly cameraId: string;
}

/** The host doors a surface may carry; its manifest at surface-open names the ones it does. */
export type LarServiceKind = "clipboard" | "download" | "route" | "open-surface" | "print" | "fullscreen" | "open-external";

/** Engine → surface: a host door the engine asks the surface to open, answered by a `lar:service-result` control event. */
export interface LarMsg_Service {
  readonly type: typeof LAR_SERVICE;
  readonly wikiUri: string;
  readonly requestId: string;
  readonly kind: LarServiceKind;
  readonly args: Readonly<Record<string, string | number | boolean>>;
  /** A door opens only under a person's activation; the engine says so, the surface checks. */
  readonly userActivation: true;
}

// ── Readers (fail closed) ───────────────────────────────────────────────────────────────────────

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isRev = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const isName = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 1024;

/** A whole value within its bounds, or null: a value past the line never crosses. */
export function boundedWholeValue(v: unknown): LarWholeValue | null {
  if (typeof v === "string") return v.length <= LAR_WHOLE_VALUE_MAX_CHARS ? v : null;
  if (v instanceof Uint8Array) return v.byteLength <= LAR_WHOLE_BYTES_MAX ? v : null;
  if (Array.isArray(v)) return v.length <= 4096 && v.every((s) => typeof s === "string" && s.length <= 1024) ? (v as readonly string[]) : null;
  return null;
}

const CONTROL_KINDS: ReadonlySet<string> = new Set<LarControlKind>(["lar:act", "lar:sense", "lar:write", "lar:service-result"]);

/** Read a control event off the wire, or null. Exactly one target stands; the kind and the revisions read whole. */
export function readLarControlEvent(v: unknown): LarMsg_ControlEvent | null {
  if (!isRecord(v) || v["type"] !== LAR_CONTROL_EVENT) return null;
  if (!isName(v["eventId"]) || !isName(v["cameraId"]) || !isRev(v["mountEpoch"]) || !isName(v["action"])) return null;
  if (typeof v["kind"] !== "string" || !CONTROL_KINDS.has(v["kind"])) return null;
  const targets = [v["controlId"], v["renderId"], v["affordanceId"]].filter((t) => t !== undefined);
  if (targets.length !== 1 || !isName(targets[0])) return null;
  if (!isRev(v["seenFrameRev"])) return null;
  if (v["localRev"] !== undefined && !isRev(v["localRev"])) return null;
  if (v["kind"] === "lar:sense" && v["localRev"] === undefined) return null;   // a sense without its revision cannot be ordered
  if (v["wholeValue"] !== undefined && boundedWholeValue(v["wholeValue"]) === null) return null;
  if (v["basis"] !== undefined && !(Array.isArray(v["basis"]) && v["basis"].every(isName))) return null;
  if (v["records"] !== undefined && !(Array.isArray(v["records"]) && v["records"].every(isWriteRecord))) return null;
  return v as unknown as LarMsg_ControlEvent;
}

const isWriteRecord = (r: unknown): r is LarWriteRecord =>
  isRecord(r) && isName(r["title"]) && isRecord(r["fields"]) && (r["tombstone"] === undefined || r["tombstone"] === true);


/** Each payload reads by its own type: a string for html and css, a list of names for members, the literal true for a tombstone. */
const readsAsPayload = (k: Record<string, unknown>, p: string): boolean => {
  const v = k[p];
  if (p === "html" || p === "css") return typeof v === "string";
  if (p === "members") return Array.isArray(v) && v.every((m) => typeof m === "string");
  return v === true;
};

/** Read a frame off the wire, or null: every key named, revisioned, and carrying exactly one payload. */
export function readLarFrame(v: unknown): LarMsg_Frame | null {
  if (!isRecord(v) || v["type"] !== LAR_FRAME) return null;
  if (!isName(v["wikiUri"]) || !isName(v["cameraId"]) || !isRev(v["mountEpoch"]) || !Array.isArray(v["keys"]) || !isRecord(v["sensedRevision"])) return null;
  const seen = new Set<string>();
  for (const k of v["keys"] as unknown[]) {
    if (!isRecord(k) || !isName(k["key"]) || !isRev(k["rev"])) return null;
    if (seen.has(k["key"])) return null;   // one key, one payload, one revision per frame
    seen.add(k["key"]);
    const payloads = ["html", "css", "members", "tombstone"].filter((p) => k[p] !== undefined);
    if (payloads.length !== 1 || !readsAsPayload(k, payloads[0]!)) return null;
  }
  for (const rev of Object.values(v["sensedRevision"] as Record<string, unknown>)) if (!isRev(rev)) return null;
  return v as unknown as LarMsg_Frame;
}

/** Read a control result off the wire, or null. */
export function readLarControlResult(v: unknown): LarMsg_ControlResult | null {
  if (!isRecord(v) || v["type"] !== LAR_CONTROL_RESULT) return null;
  if (!isName(v["eventId"]) || !isName(v["cameraId"]) || !isRev(v["mountEpoch"])) return null;
  if (v["status"] !== "applied" && v["status"] !== "stale-target" && v["status"] !== "refused") return null;
  if (v["status"] === "refused" && !isName(v["reason"])) return null;
  return v as unknown as LarMsg_ControlResult;
}

/** Read a resend off the wire, or null: it names its camera. */
export function readLarResend(v: unknown): LarMsg_Resend | null {
  if (!isRecord(v) || v["type"] !== LAR_RESEND || !isName(v["cameraId"])) return null;
  return v as unknown as LarMsg_Resend;
}

export const LAR_SERVICE_KINDS: ReadonlySet<string> = new Set<LarServiceKind>([
  "clipboard", "download", "route", "open-surface", "print", "fullscreen", "open-external",
]);

/** Read a host-door ask off the wire, or null: its wiki and request named, a door the house names, primitive args, a person's activation. */
export function readLarService(v: unknown): LarMsg_Service | null {
  if (!isRecord(v) || v["type"] !== LAR_SERVICE) return null;
  if (!isName(v["wikiUri"]) || !isName(v["requestId"])) return null;
  if (typeof v["kind"] !== "string" || !LAR_SERVICE_KINDS.has(v["kind"])) return null;
  if (v["userActivation"] !== true) return null;
  const args = v["args"];
  if (!isRecord(args)) return null;
  if (!Object.values(args).every((a) => typeof a === "string" || typeof a === "number" || typeof a === "boolean")) return null;
  return v as unknown as LarMsg_Service;
}

// ── Builders ────────────────────────────────────────────────────────────────────────────────────

export function mkLarFrame(f: Omit<LarMsg_Frame, "type">): LarMsg_Frame { return { type: LAR_FRAME, ...f }; }
export function mkLarControlResult(r: Omit<LarMsg_ControlResult, "type">): LarMsg_ControlResult { return { type: LAR_CONTROL_RESULT, ...r }; }
export function mkLarResend(cameraId: string = LAR_CAMERA_STORY): LarMsg_Resend { return { type: LAR_RESEND, cameraId }; }
export function mkLarService(s: Omit<LarMsg_Service, "type" | "userActivation">): LarMsg_Service { return { type: LAR_SERVICE, userActivation: true, ...s }; }

/** Build a control event, refusing a whole value past its bound at the sending shore (an over-long send names a caller bug). */
export function mkLarControlEvent(e: Omit<LarMsg_ControlEvent, "type">): LarMsg_ControlEvent {
  if (e.wholeValue !== undefined && boundedWholeValue(e.wholeValue) === null) {
    throw new Error(`lar:control-event: wholeValue exceeds its bound (${LAR_WHOLE_VALUE_MAX_CHARS} characters, ${LAR_WHOLE_BYTES_MAX} bytes)`);
  }
  return { type: LAR_CONTROL_EVENT, ...e };
}

/** The two classes of traffic up: reliable (retried until answered) and droppable (newest wins, no answer). */
export function isReliableKind(kind: LarControlKind): boolean { return kind !== "lar:sense"; }
