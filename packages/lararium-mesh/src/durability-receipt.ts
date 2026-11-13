export interface DurabilityReceipt {
  readonly docUrl: string;
  readonly heads: readonly string[];
  readonly ownerEpoch: string;
}

/** Read a disk fence without invoking untrusted getters more than once. */
export function validateDurabilityReceipt(value: unknown): DurabilityReceipt | null {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const keys = Object.keys(value);
    if (keys.length !== 3 || !keys.includes("docUrl") || !keys.includes("heads") || !keys.includes("ownerEpoch")) return null;
    const { docUrl, heads, ownerEpoch } = value as Record<string, unknown>;
    if (typeof docUrl !== "string" || !docUrl || typeof ownerEpoch !== "string" || !ownerEpoch ||
        !Array.isArray(heads) || heads.length === 0 || !heads.every((h) => typeof h === "string" && h.length > 0)) return null;
    return Object.freeze({ docUrl, heads: Object.freeze([...heads]), ownerEpoch });
  } catch { return null; }
}

export function durabilityCovers(receipt: DurabilityReceipt, heads: readonly string[]): boolean {
  const stored = new Set(receipt.heads);
  return heads.every((head) => stored.has(head));
}
