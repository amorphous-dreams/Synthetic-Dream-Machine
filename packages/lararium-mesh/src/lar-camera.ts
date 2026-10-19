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
/** The global shortcut chords the engine declares from `$:/tags/KeyboardShortcut`: the set the page's document leg listens for. */
export const LAR_KEY_SHORTCUTS  = "lar:shortcuts";
/** The story's order and the history's tail: the page composes `#` from it and scrolls to the navigated tiddler. */
export const LAR_KEY_STORY_ORDER = "lar:story-order";

/** The page's document leg, named as a control: a global shortcut or a route act carries it as its `controlId`. */
export const LAR_CONTROL_DOCUMENT = "lar:document";

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
  /** The shortcut chords of `lar:shortcuts`, each parsed by the engine's own keyboard manager. */
  readonly chords?: readonly LarShortcutChord[];
  /** The story order and history tail of `lar:story-order`. */
  readonly story?: LarStoryOrder;
}

/** One declared chord: the descriptor as the wiki wrote it, and the key code and modifiers it parses to. */
export interface LarShortcutChord {
  readonly descriptor: string;
  readonly keyCode: number;
  readonly ctrl: boolean; readonly shift: boolean; readonly alt: boolean; readonly meta: boolean;
}

/** The story list in order, the title the history list ends on, and how deep that list runs (a navigation raises it). */
export interface LarStoryOrder {
  readonly order: readonly string[];
  readonly tail: string | null;
  readonly depth: number;
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
  /** The DOM type of a declared `$eventcatcher` act. */
  readonly eventType?: string;
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
  /** The field a text operation edits, by its control id or render id, where the page knows it (page-controls#/the-wire). */
  readonly fieldId?: string;
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
  /** The file an import offer's bytes came from: its name and media type, as the page read them. */
  readonly file?: { readonly name: string; readonly type: string };
}

// ── The answer ──────────────────────────────────────────────────────────────────────────────────

/** The refusal words a person reads beside the control (page-controls#/refusals), plus the engine's own. */
export type LarRefusal =
  | "invalid-integer" | "input-too-long" | "stale-target" | "selection-unavailable" | "geometry-unavailable"
  | "route-unresolved" | "unsupported-control" | "binding-unavailable" | "page-action-unavailable"
  | "continuous-event-refused" | "pointer-capture-refused" | "reserved-chord"
  | "activation-required" | "unknown-request"
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

/** Surface → engine: paint me whole. The engine mints a new mount epoch and emits every key. A surface that
 *  opens (or attaches) names its manifest here; a resend without one keeps the manifest the camera holds. */
export interface LarMsg_Resend {
  readonly type: typeof LAR_RESEND;
  readonly cameraId: string;
  readonly manifest?: LarSurfaceManifest;
}

/** The host doors a surface may carry; its manifest at surface-open names the ones it does. */
export type LarServiceKind = "clipboard" | "download" | "route" | "open-surface" | "print" | "fullscreen" | "open-external";

/** What a surface carries, named at surface-open: the host doors it opens. A kind outside `services` answers
 *  `page-action-unavailable` at once on both sides (the engine raises `$:/temp/lares/alert/refused/<kind>`). */
export interface LarSurfaceManifest {
  readonly services: readonly LarServiceKind[];
}

/** The doors a surface carries when it names none: the three a page opens under a person's click alone. */
export const LAR_SURFACE_DEFAULT_SERVICES: readonly LarServiceKind[] = ["clipboard", "download", "route"];

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

// ── Declared at mount: the binding stamps ───────────────────────────────────────────────────────

/**
 * The stamps a node carries beside its render id, declared where the engine made the binding and never decided
 * at handling (dreamdom#/the-crossings, "Declared at mount, never decided at handling"):
 *
 *   - `data-lar-on`      the event types the node binds; the page relays only these.
 *   - `data-lar-cancel`  what the page cancels synchronously: `type` (always), `type:ordinary` (an unmodified
 *                        primary-button act on a non-external target), `type:declared` (a key chord the node's
 *                        `data-lar-keys` names).
 *   - `data-lar-keys`    the crossing set: the key chords the node declares, each named by `larKeyChordName`.
 *   - `data-lar-bubble`  `yes` where the node's own handler lets the act climb to an ancestor's binding, `no` where
 *                        it ends the climb; the page reads an ancestor's cancellation only past a `yes`.
 *   - `data-lar-live`    the property the page owns on a live control (`value`, `checked`, `selected`).
 */
export const LAR_STAMP_ON     = "data-lar-on";
export const LAR_STAMP_CANCEL = "data-lar-cancel";
export const LAR_STAMP_KEYS   = "data-lar-keys";
export const LAR_STAMP_BUBBLE = "data-lar-bubble";
export const LAR_STAMP_LIVE   = "data-lar-live";

/** How the page cancels one event type a node declares. */
export type LarCancelRule = "always" | "ordinary" | "declared";

/** The tokens of a space-separated stamp, or the empty set for an absent one. */
export function readLarStampTokens(stamp: string | null | undefined): ReadonlySet<string> {
  return new Set((stamp ?? "").split(/\s+/).filter((t) => t.length > 0));
}

/** Read a `data-lar-cancel` stamp, failing closed: a token with a qualifier the contract never named cancels nothing. */
export function readLarCancel(stamp: string | null | undefined): ReadonlyMap<string, LarCancelRule> {
  const rules = new Map<string, LarCancelRule>();
  for (const token of readLarStampTokens(stamp)) {
    const [type, qualifier, ...rest] = token.split(":");
    if (!type || rest.length) continue;
    const rule: LarCancelRule | undefined = qualifier === undefined ? "always" : qualifier === "ordinary" ? "ordinary" : qualifier === "declared" ? "declared" : undefined;
    if (rule) rules.set(type, rule);
  }
  return rules;
}

/** Key names for the codes a chord most often carries; a letter or digit names itself, any other code its number. */
const LAR_KEY_NAMES: Readonly<Record<number, string>> = {
  8: "backspace", 9: "tab", 13: "enter", 19: "pause", 27: "escape", 32: "space", 33: "page_up", 34: "page_down",
  35: "end", 36: "home", 37: "left", 38: "up", 39: "right", 40: "down", 45: "insert", 46: "delete",
  112: "f1", 113: "f2", 114: "f3", 115: "f4", 116: "f5", 117: "f6", 118: "f7", 119: "f8", 120: "f9", 121: "f10", 122: "f11", 123: "f12",
};

/**
 * The one name a key chord carries on both shores: modifiers in the order `ctrl alt shift meta`, then the key by its
 * code, the way TiddlyWiki matches a descriptor (`alt-shift-N`, `ctrl-enter`, `escape`).
 */
export function larKeyChordName(chord: { readonly keyCode: number; readonly ctrl?: boolean; readonly alt?: boolean; readonly shift?: boolean; readonly meta?: boolean }): string {
  const code = chord.keyCode;
  const name = LAR_KEY_NAMES[code] ?? ((code >= 48 && code <= 57) || (code >= 65 && code <= 90) ? String.fromCharCode(code) : String(code));
  return `${chord.ctrl ? "ctrl-" : ""}${chord.alt ? "alt-" : ""}${chord.shift ? "shift-" : ""}${chord.meta ? "meta-" : ""}${name}`;
}

/** TW5 compares key codes; letter descriptors follow the produced key across keyboard layouts. */
export function larLogicalKeyCode(key: string, keyCode: number): number {
  return /^[a-z]$/i.test(key) ? key.toUpperCase().charCodeAt(0)
    : /^[0-9]$/.test(key) ? key.charCodeAt(0) : keyCode;
}

/** Browser, OS and assistive technology chords stay on the glass. */
export function larReservedChord(key: string, mods: { readonly ctrl: boolean; readonly alt: boolean; readonly shift: boolean; readonly meta: boolean }): boolean {
  const k = key.toLowerCase();
  if (mods.alt && k === "f4" || mods.ctrl && mods.alt && k === "delete") return true;
  if (mods.meta && ["q", "w", "t", "n", "r", "l", "tab", " ", "space", "spacebar"].includes(k)) return true;
  if (mods.ctrl && !mods.alt && !mods.meta && ["w", "t", "n", "r", "l", "tab"].includes(k)) return true;
  return false;
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
  if (v["checked"] !== undefined && typeof v["checked"] !== "boolean") return null;
  if (v["controlType"] !== undefined && !isName(v["controlType"])) return null;
  if (v["eventType"] !== undefined && !isName(v["eventType"])) return null;
  if (v["fieldId"] !== undefined && !isName(v["fieldId"])) return null;
  if (v["selection"] !== undefined && !isSelection(v["selection"])) return null;
  if (v["wholeValue"] !== undefined && boundedWholeValue(v["wholeValue"]) === null) return null;
  if (v["basis"] !== undefined && !(Array.isArray(v["basis"]) && v["basis"].every(isName))) return null;
  if (v["records"] !== undefined && !(Array.isArray(v["records"]) && v["records"].every(isWriteRecord))) return null;
  if (v["file"] !== undefined && !(isRecord(v["file"]) && isName(v["file"]["name"]) && typeof v["file"]["type"] === "string" && v["file"]["type"].length <= 1024)) return null;
  // A service answer names the request it closes and its status, or it answers nothing.
  if (v["kind"] === "lar:service-result" && (!isName(v["requestId"]) || !isName(v["status"]))) return null;
  return v as unknown as LarMsg_ControlEvent;
}

/** A selection reads as two revisions-shaped offsets, start never past end. */
const isSelection = (s: unknown): boolean => isRecord(s) && isRev(s["start"]) && isRev(s["end"]) && (s["start"] as number) <= (s["end"] as number);

const isWriteRecord = (r: unknown): r is LarWriteRecord =>
  isRecord(r) && isName(r["title"]) && isRecord(r["fields"]) && (r["tombstone"] === undefined || r["tombstone"] === true);


const isChord = (c: unknown): boolean =>
  isRecord(c) && isName(c["descriptor"]) && typeof c["keyCode"] === "number" && Number.isSafeInteger(c["keyCode"]) && c["keyCode"] > 0
  && ["ctrl", "shift", "alt", "meta"].every((m) => typeof c[m] === "boolean");
const isStoryOrder = (o: unknown): boolean =>
  isRecord(o) && Array.isArray(o["order"]) && o["order"].every((t) => typeof t === "string")
  && (o["tail"] === null || typeof o["tail"] === "string") && isRev(o["depth"]);

/** Each payload reads by its own type: a string for html and css, a list of names for members, chords and a story
 *  order by their shapes, the literal true for a tombstone. */
const readsAsPayload = (k: Record<string, unknown>, p: string): boolean => {
  const v = k[p];
  if (p === "html" || p === "css") return typeof v === "string";
  if (p === "members") return Array.isArray(v) && v.every((m) => typeof m === "string");
  if (p === "chords") return Array.isArray(v) && v.every(isChord);
  if (p === "story") return isStoryOrder(v);
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
    const payloads = ["html", "css", "members", "chords", "story", "tombstone"].filter((p) => k[p] !== undefined);
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
  const want = v["want"];
  if (want !== undefined && !(isRecord(want) && typeof want["value"] === "string" && isSelection({ start: want["selStart"], end: want["selEnd"] }))) return null;
  return v as unknown as LarMsg_ControlResult;
}

export const LAR_SERVICE_KINDS: ReadonlySet<string> = new Set<LarServiceKind>([
  "clipboard", "download", "route", "open-surface", "print", "fullscreen", "open-external",
]);

/** Read a surface manifest, or null: a list of door kinds the house names, each once. */
export function readLarSurfaceManifest(v: unknown): LarSurfaceManifest | null {
  if (!isRecord(v) || !Array.isArray(v["services"])) return null;
  const services = v["services"] as unknown[];
  if (!services.every((k) => typeof k === "string" && LAR_SERVICE_KINDS.has(k))) return null;
  if (new Set(services).size !== services.length) return null;
  return v as unknown as LarSurfaceManifest;
}

/** Read a resend off the wire, or null: it names its camera, and a manifest it carries reads whole. */
export function readLarResend(v: unknown): LarMsg_Resend | null {
  if (!isRecord(v) || v["type"] !== LAR_RESEND || !isName(v["cameraId"])) return null;
  if (v["manifest"] !== undefined && readLarSurfaceManifest(v["manifest"]) === null) return null;
  return v as unknown as LarMsg_Resend;
}

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
export function mkLarResend(cameraId: string = LAR_CAMERA_STORY, manifest?: LarSurfaceManifest): LarMsg_Resend {
  return manifest === undefined ? { type: LAR_RESEND, cameraId } : { type: LAR_RESEND, cameraId, manifest };
}
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
