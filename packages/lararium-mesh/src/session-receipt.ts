import { validateDurabilityReceipt, type DurabilityReceipt } from "./durability-receipt.js";

export type SessionReceiptState = "pending" | "done" | "error" | "unknown" | "interrupted" | "abandoned" | "evicted";
export interface SessionReceipt {
  readonly requestId: string;
  readonly action: string;
  readonly face: string;
  readonly state: SessionReceiptState;
  readonly outcome?: Readonly<Record<string, unknown>>;
  readonly position: {
    /** The vessel life the request belongs to: the life that committed it where the ledger names one, else the life
     *  that answers (the session contract's `ownerEpoch`, which reads the vessel's life id). */
    readonly ownerEpoch: string;
    readonly seq?: number;
    readonly durable?: DurabilityReceipt;
  };
}

const states = new Set<SessionReceiptState>(["pending", "done", "error", "unknown", "interrupted", "abandoned", "evicted"]);
export function validateSessionReceipt(value: unknown): SessionReceipt | null {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const v = value as Record<string, unknown>;
    if (Object.keys(v).some((key) => !["requestId", "action", "face", "state", "outcome", "position"].includes(key))) return null;
    if (typeof v.requestId !== "string" || !v.requestId || typeof v.action !== "string" || !v.action ||
        typeof v.face !== "string" || !v.face || !states.has(v.state as SessionReceiptState)) return null;
    if (!v.position || typeof v.position !== "object" || Array.isArray(v.position)) return null;
    const p = v.position as Record<string, unknown>;
    if (Object.keys(p).some((key) => !["ownerEpoch", "seq", "durable"].includes(key))) return null;
    if (typeof p.ownerEpoch !== "string" || !p.ownerEpoch ||
        (p.seq !== undefined && (!Number.isSafeInteger(p.seq) || (p.seq as number) < 0))) return null;
    const durable = p.durable === undefined ? undefined : validateDurabilityReceipt(p.durable);
    if (p.durable !== undefined && !durable) return null;
    if (durable && v.state !== "done" && v.state !== "error" && v.state !== "interrupted" && v.state !== "evicted") return null;
    if (v.outcome !== undefined && (!v.outcome || typeof v.outcome !== "object" || Array.isArray(v.outcome))) return null;
    return Object.freeze({ requestId: v.requestId, action: v.action, face: v.face, state: v.state as SessionReceiptState,
      ...(v.outcome !== undefined && { outcome: Object.freeze({ ...(v.outcome as Record<string, unknown>) }) }),
      position: Object.freeze({ ownerEpoch: p.ownerEpoch,
        ...(p.seq !== undefined && { seq: p.seq as number }), ...(durable && { durable }) }) });
  } catch { return null; }
}

export function renderSessionReceipt(receipt: SessionReceipt): string[] {
  const outcome = receipt.outcome === undefined ? receipt.state : JSON.stringify(receipt.outcome);
  const p = receipt.position;
  return [
    `Request id: ${receipt.requestId}`,
    `Action: ${receipt.action}`,
    `Face: ${receipt.face}`,
    `Outcome: ${outcome}`,
    `Position: owner epoch ${p.ownerEpoch}${p.seq === undefined ? "" : `; fence ${p.seq}`}${p.durable ? `; durable heads ${p.durable.heads.join(", ")}` : ""}`,
  ];
}
