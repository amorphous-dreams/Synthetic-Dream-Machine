/**
 * record-port — the record port's kinds on the wire, in the `port:` namespace.
 *
 * The port carries RECORDS across the engine↔projection waist: a projection opens a port at a width, receives a
 * chunked snapshot at a stable base cursor, then changes after it, writes under a `txId`, asks the engine for
 * filters, renders, loads and invokes, and shares presence. The contract stands at
 * lar:///ha.ka.ba/lares/docs/pono/dreamdom-port-contract; every reader below keeps its bounds, so a malformed
 * port message vanishes at the door before any handler sees it.
 *
 * Cursors read `<bootNonce>.<shapeId>.<seq>` and stay opaque to a projection; they never reuse the camera's
 * frame `rev` or `mountEpoch`.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/dreamdom-port-contract
 */

// ── Kinds on the wire ────────────────────────────────────────────

export const PORT_OPEN     = "port:open";
export const PORT_WRITE    = "port:write";
export const PORT_ASK      = "port:ask";
export const PORT_PRESENCE = "port:presence";
export const PORT_CLOSE    = "port:close";
export const PORT_ACK      = "port:ack";
export const PORT_SNAPSHOT = "port:snapshot";
export const PORT_CHANGES  = "port:changes";
export const PORT_RESET    = "port:reset";
export const PORT_WRITTEN  = "port:written";
export const PORT_ANSWER   = "port:answer";

export type PortVesselKind = typeof PORT_OPEN | typeof PORT_WRITE | typeof PORT_ASK | typeof PORT_PRESENCE | typeof PORT_CLOSE | typeof PORT_ACK;
export type PortIslandKind = typeof PORT_SNAPSHOT | typeof PORT_CHANGES | typeof PORT_RESET | typeof PORT_WRITTEN | typeof PORT_ANSWER | typeof PORT_PRESENCE;

export type PortWidthName = "full" | "skinny" | "story" | "none";
export type PortAskKind = "filter" | "render" | "load" | "verb" | "cas" | "invoke";
export type PortRenderForm = "html" | "text" | "blocks" | "label-html";

/** A record as the port carries it: fields at the width, the fields left unprojected named in `omitted`. */
export interface PortWireRecord {
  title: string;
  seq?: number;
  fields: Record<string, string>;
  omitted?: string[];
  deleted?: true;
}

export interface PortMsg_Open {
  type: typeof PORT_OPEN;
  portId: string;
  wikiUri: string;
  width: PortWidthName;
  /** The cursor a reconnecting projection holds; absent asks for a snapshot. */
  since?: string;
  actor: string;
  /** Extra title prefixes the projection keeps local, beside the tier list. */
  localFilter?: string[];
  /** The fields a `story` port wants beyond the skinny set. */
  fields?: string[];
  renders?: PortRenderForm[];
  edits?: boolean;
  presence?: boolean;
  maxRecordBytes: number;
  maxBatchBytes: number;
}

export interface PortMsg_Write {
  type: typeof PORT_WRITE;
  portId: string;
  txId: string;
  basis?: string;
  records: Array<{ title: string; fields: Record<string, string>; tombstone?: true; bag?: string }>;
}

export interface PortMsg_Ask {
  type: typeof PORT_ASK;
  portId: string;
  askId: string;
  kind: PortAskKind;
  /** filter: the filter string. render/load: the title. verb and cas: the named verb. */
  subject?: string;
  titles?: string[];
  fields?: string[];
  form?: PortRenderForm;
  renderCursor?: string;
  affordanceId?: string;
}

export interface PortMsg_Ack { type: typeof PORT_ACK; portId: string; cursor: string }

export interface PortMsg_Presence {
  type: typeof PORT_PRESENCE;
  portId: string;
  actorKey: string;
  beat?: number;
  state?: unknown;
  gone?: true;
}

export interface PortMsg_Close {
  type: typeof PORT_CLOSE;
  portId: string;
}

export interface PortMsg_Snapshot {
  type: typeof PORT_SNAPSHOT;
  portId: string;
  snapshotId: string;
  baseCursor: string;
  i: number;
  n: number;
  records: PortWireRecord[];
}

export interface PortMsg_Changes {
  type: typeof PORT_CHANGES;
  portId: string;
  cursor: string;
  entries: Array<PortWireRecord & { seq: number; causedBy: string[] }>;
}

export interface PortMsg_Reset {
  type: typeof PORT_RESET;
  portId: string;
  reason: "island-restarted" | "compacted" | "shape-changed" | "lagged";
  floorSeq: number;
  headSeq: number;
}

export interface PortMsg_Written {
  type: typeof PORT_WRITTEN;
  portId: string;
  txId: string;
  status: "applied" | "partial" | "refused";
  applied: string[];
  failed: string[];
  reason?: string;
  cursor?: string;
}

export interface PortMsg_Answer {
  type: typeof PORT_ANSWER;
  portId: string;
  askId: string;
  status: "answered" | "refused";
  reason?: string;
  result?: unknown;
}

export type PortVesselToIslandMsg = PortMsg_Open | PortMsg_Write | PortMsg_Ask | PortMsg_Presence | PortMsg_Close | PortMsg_Ack;
export type PortIslandToVesselMsg = PortMsg_Snapshot | PortMsg_Changes | PortMsg_Reset | PortMsg_Written | PortMsg_Answer | PortMsg_Presence;

// ── Readers ─────────────────────────────────────────────────────

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isCount = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const isName = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 1024;
const isNames = (v: unknown, max = 4096): v is string[] => Array.isArray(v) && v.length <= max && v.every(isName);
const boundedBytes = (v: unknown, max: number): boolean => {
  try { return new TextEncoder().encode(JSON.stringify(v)).length <= max; }
  catch { return false; }
};
const isFields = (v: unknown): v is Record<string, string> => isRecord(v) && Object.keys(v).length <= 256
  && Object.values(v).every((x) => typeof x === "string" && new TextEncoder().encode(x).length <= 1_048_576);
const PORT_BYTES_MAX = 16 * 1024 * 1024;
const WIDTHS: ReadonlySet<string> = new Set<PortWidthName>(["full", "skinny", "story", "none"]);
const ASKS: ReadonlySet<string> = new Set<PortAskKind>(["filter", "render", "load", "verb", "cas", "invoke"]);
const FORMS: ReadonlySet<string> = new Set<PortRenderForm>(["html", "text", "blocks", "label-html"]);
const RESETS: ReadonlySet<string> = new Set(["island-restarted", "compacted", "shape-changed", "lagged"]);

/** True for a kind the port owns, in either direction. */
export function isPortKind(type: string): boolean {
  return type.startsWith("port:");
}

const wireRecord = (r: unknown): boolean =>
  isRecord(r) && isName(r["title"]) && isFields(r["fields"]) && (r["seq"] === undefined || isCount(r["seq"]))
  && (r["omitted"] === undefined || isNames(r["omitted"])) && (r["deleted"] === undefined || r["deleted"] === true);

/** Read a vessel-to-island port message whole, or null. */
export function readPortVesselMsg(v: unknown): PortVesselToIslandMsg | null {
  if (!isRecord(v) || typeof v["type"] !== "string" || !isName(v["portId"])) return null;
  if (!boundedBytes(v, 17 * 1024 * 1024)) return null;
  switch (v["type"]) {
    case PORT_OPEN:
      if (!isName(v["wikiUri"]) || !isName(v["actor"]) || typeof v["width"] !== "string" || !WIDTHS.has(v["width"])) return null;
      if (v["since"] !== undefined && !isName(v["since"])) return null;
      if (v["localFilter"] !== undefined && !isNames(v["localFilter"], 256)) return null;
      if (v["fields"] !== undefined && !isNames(v["fields"], 256)) return null;
      if (v["renders"] !== undefined && !(Array.isArray(v["renders"]) && v["renders"].length <= 4 && v["renders"].every((f) => typeof f === "string" && FORMS.has(f)))) return null;
      if (v["edits"] !== undefined && typeof v["edits"] !== "boolean") return null;
      if (v["presence"] !== undefined && typeof v["presence"] !== "boolean") return null;
      if (!isCount(v["maxRecordBytes"]) || v["maxRecordBytes"] < 1 || v["maxRecordBytes"] > PORT_BYTES_MAX) return null;
      if (!isCount(v["maxBatchBytes"]) || v["maxBatchBytes"] < 1 || v["maxBatchBytes"] > PORT_BYTES_MAX) return null;
      return v as unknown as PortMsg_Open;
    case PORT_WRITE:
      if (!isName(v["txId"]) || (v["basis"] !== undefined && !isName(v["basis"]))) return null;
      if (!Array.isArray(v["records"]) || v["records"].length < 1 || v["records"].length > 4096) return null;
      if (!v["records"].every((r) => isRecord(r) && isName(r["title"]) && isFields(r["fields"])
        && (r["tombstone"] === undefined || r["tombstone"] === true) && (r["bag"] === undefined || isName(r["bag"])))) return null;
      return v as unknown as PortMsg_Write;
    case PORT_ASK:
      if (!isName(v["askId"]) || typeof v["kind"] !== "string" || !ASKS.has(v["kind"])) return null;
      if (v["subject"] !== undefined && typeof v["subject"] !== "string") return null;
      if ((v["subject"] as string | undefined)?.length! > 65536) return null;
      if (v["titles"] !== undefined && !isNames(v["titles"])) return null;
      if (v["fields"] !== undefined && !isNames(v["fields"], 256)) return null;
      if (v["form"] !== undefined && !(typeof v["form"] === "string" && FORMS.has(v["form"]))) return null;
      if (v["renderCursor"] !== undefined && !isName(v["renderCursor"])) return null;
      if (v["affordanceId"] !== undefined && !isName(v["affordanceId"])) return null;
      if (v["kind"] === "invoke" && (v["subject"] !== undefined || !isName(v["affordanceId"]) || !isName(v["renderCursor"]))) return null;
      return { type: PORT_ASK, portId: v["portId"], askId: v["askId"], kind: v["kind"],
        ...(v["subject"] === undefined ? {} : { subject: v["subject"] }),
        ...(v["titles"] === undefined ? {} : { titles: v["titles"] }),
        ...(v["fields"] === undefined ? {} : { fields: v["fields"] }),
        ...(v["form"] === undefined ? {} : { form: v["form"] }),
        ...(v["renderCursor"] === undefined ? {} : { renderCursor: v["renderCursor"] }),
        ...(v["affordanceId"] === undefined ? {} : { affordanceId: v["affordanceId"] }) } as PortMsg_Ask;
    case PORT_PRESENCE:
      if (!isName(v["actorKey"]) || (v["beat"] !== undefined && !isCount(v["beat"])) || (v["gone"] !== undefined && v["gone"] !== true)) return null;
      if (v["gone"] === undefined && v["beat"] === undefined) return null;   // a presence round carries its beat
      if (v["state"] !== undefined && !boundedBytes(v["state"], 4096)) return null;
      return v as unknown as PortMsg_Presence;
    case PORT_ACK:
      return isName(v["cursor"]) ? v as unknown as PortMsg_Ack : null;
    case PORT_CLOSE:
      return v as unknown as PortMsg_Close;
    default:
      return null;
  }
}

/** Read an island-to-vessel port message whole, or null. */
export function readPortIslandMsg(v: unknown): PortIslandToVesselMsg | null {
  if (!isRecord(v) || typeof v["type"] !== "string" || !isName(v["portId"])) return null;
  if (!boundedBytes(v, 17 * 1024 * 1024)) return null;
  switch (v["type"]) {
    case PORT_SNAPSHOT:
      if (!isName(v["snapshotId"]) || !isName(v["baseCursor"]) || !isCount(v["i"]) || !isCount(v["n"]) || v["i"] < 1 || v["i"] > v["n"]) return null;
      if (!Array.isArray(v["records"]) || v["records"].length > 4096 || !v["records"].every(wireRecord)) return null;
      return v as unknown as PortMsg_Snapshot;
    case PORT_CHANGES:
      if (!isName(v["cursor"]) || !Array.isArray(v["entries"]) || v["entries"].length > 4096) return null;
      // causedBy may stand empty: a foreign origin names no txId
      if (!v["entries"].every((e) => wireRecord(e) && isCount((e as Record<string, unknown>)["seq"]) && Array.isArray((e as Record<string, unknown>)["causedBy"]) && ((e as Record<string, unknown>)["causedBy"] as unknown[]).every(isName))) return null;
      return v as unknown as PortMsg_Changes;
    case PORT_RESET:
      if (typeof v["reason"] !== "string" || !RESETS.has(v["reason"]) || !isCount(v["floorSeq"]) || !isCount(v["headSeq"])) return null;
      return v as unknown as PortMsg_Reset;
    case PORT_WRITTEN:
      if (!isName(v["txId"]) || (v["status"] !== "applied" && v["status"] !== "partial" && v["status"] !== "refused")) return null;
      if (!isNames(v["applied"]) || !isNames(v["failed"])) return null;
      if (v["status"] === "refused" && !isName(v["reason"])) return null;
      return v as unknown as PortMsg_Written;
    case PORT_ANSWER:
      if (!isName(v["askId"]) || (v["status"] !== "answered" && v["status"] !== "refused")) return null;
      if (v["status"] === "refused" && !isName(v["reason"])) return null;
      if (v["result"] !== undefined && !boundedBytes(v["result"], 1_048_576)) return null;
      return v as unknown as PortMsg_Answer;
    case PORT_PRESENCE:
      return readPortVesselMsg(v) as PortMsg_Presence | null;
    default:
      return null;
  }
}

// ── Factories ───────────────────────────────────────────────────

export const mkPortSnapshot = (m: Omit<PortMsg_Snapshot, "type">): PortMsg_Snapshot => ({ type: PORT_SNAPSHOT, ...m });
export const mkPortChanges = (m: Omit<PortMsg_Changes, "type">): PortMsg_Changes => ({ type: PORT_CHANGES, ...m });
export const mkPortReset = (m: Omit<PortMsg_Reset, "type">): PortMsg_Reset => ({ type: PORT_RESET, ...m });
export const mkPortWritten = (m: Omit<PortMsg_Written, "type">): PortMsg_Written => ({ type: PORT_WRITTEN, ...m });
export const mkPortAnswer = (m: Omit<PortMsg_Answer, "type">): PortMsg_Answer => ({ type: PORT_ANSWER, ...m });
export const mkPortPresence = (m: Omit<PortMsg_Presence, "type">): PortMsg_Presence => ({ type: PORT_PRESENCE, ...m });
