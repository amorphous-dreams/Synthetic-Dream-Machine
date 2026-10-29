/** Durable, per-PersonaGroup admission enablement; an absent row closes every face. */
import { readCustodyRow, updateCustodyRow } from "./custody-seat.js";

export const INTENT_RELAY_FACES_FILE = "intent-relay-faces.json";
export class IntentRelayRingMalformed extends Error { override name = "IntentRelayRingMalformed"; }
const groupReads = (group: string): boolean => /^[\x21-\x7e]{1,256}$/.test(group);
function read(bytes: Uint8Array | null): string[] {
  if (bytes === null) return [];
  const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).join() !== "faces" || !Array.isArray((value as { faces: unknown }).faces)) throw new IntentRelayRingMalformed("intent-relay-ring: malformed row");
  const faces = (value as { faces: unknown[] }).faces;
  if (!faces.every((x) => typeof x === "string" && groupReads(x)) || faces.join("\n") !== [...new Set(faces)].sort().join("\n")) throw new IntentRelayRingMalformed("intent-relay-ring: malformed face list");
  if (!Buffer.from(bytes).equals(Buffer.from(bytesOf(faces as string[])))) throw new IntentRelayRingMalformed("intent-relay-ring: noncanonical row");
  return faces as string[];
}
const bytesOf = (faces: readonly string[]): Uint8Array => new TextEncoder().encode(JSON.stringify({ faces }));
export async function enabledIntentRelayFaces(): Promise<readonly string[]> {
  try { return read(await readCustodyRow("identity", INTENT_RELAY_FACES_FILE)); }
  catch (error) { if (error instanceof IntentRelayRingMalformed) throw error; if (error instanceof SyntaxError || error instanceof TypeError) throw new IntentRelayRingMalformed("intent-relay-ring: malformed row", { cause: error }); throw error; }
}
async function set(group: string, enabled: boolean): Promise<void> {
  if (!groupReads(group)) throw new RangeError("intent-relay-ring: PersonaGroup must read as one printable token");
  await updateCustodyRow("identity", INTENT_RELAY_FACES_FILE, (prior) => {
    const faces = new Set(read(prior));
    if (enabled) faces.add(group); else faces.delete(group);
    return { plaintext: bytesOf([...faces].sort()), value: undefined };
  });
}
export const enableIntentRelayFace = (group: string): Promise<void> => set(group, true);
export const disableIntentRelayFace = (group: string): Promise<void> => set(group, false);
export function intentRelayRing(readers: { enabledFaces(): Promise<readonly string[]> } = { enabledFaces: enabledIntentRelayFaces }): { admits(group: string): Promise<boolean> } {
  return { async admits(group) { try { return (await readers.enabledFaces()).includes(group); } catch { return false; } } };
}
