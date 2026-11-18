/** Platform-neutral custody shore for a face's sealed anchor. Sync never writes these records. */
import { readFaceAnchor, type FaceAnchor } from "./face-anchor.js";

export interface FaceAnchorRecords {
  read(personaGroup: string): Promise<Uint8Array | undefined>;
  write(personaGroup: string, bytes: Uint8Array): Promise<void>;
}

function groupOf(personaGroup: string): void {
  if (!personaGroup) throw new Error("face-anchor: a row names its PersonaGroup");
}

export async function loadFaceAnchor(records: FaceAnchorRecords, personaGroup: string): Promise<FaceAnchor | null> {
  groupOf(personaGroup);
  const bytes = await records.read(personaGroup);
  if (bytes === undefined) return null;
  let raw: unknown;
  try { raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new Error(`face-anchor: malformed row for ${personaGroup}`); }
  const anchor = readFaceAnchor(raw);
  if (!anchor || anchor.personaGroup !== personaGroup) throw new Error(`face-anchor: malformed row for ${personaGroup}`);
  return anchor;
}

export async function requireFaceAnchor(records: FaceAnchorRecords, personaGroup: string): Promise<FaceAnchor> {
  const anchor = await loadFaceAnchor(records, personaGroup);
  if (!anchor) throw new Error(`face-anchor: anchor-missing for ${personaGroup}; re-found the face`);
  return anchor;
}

/** Only founding, admission, recovery, or a verified frontier raise calls this writer. */
export async function keepFaceAnchor(records: FaceAnchorRecords, anchor: FaceAnchor): Promise<void> {
  groupOf(anchor.personaGroup);
  if (!readFaceAnchor(anchor)) throw new Error(`face-anchor: malformed anchor for ${anchor.personaGroup}`);
  await records.write(anchor.personaGroup, new TextEncoder().encode(JSON.stringify(anchor)));
}
