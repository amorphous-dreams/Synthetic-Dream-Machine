/** Platform-neutral custody shore for a face's sealed anchor. Sync never writes these rows. */
import { readFaceAnchor, type FaceAnchor } from "./face-anchor.js";

export interface FaceAnchorRows {
  read(personaGroup: string): Promise<Uint8Array | undefined>;
  write(personaGroup: string, bytes: Uint8Array): Promise<void>;
}

function groupOf(personaGroup: string): void {
  if (!personaGroup) throw new Error("face-anchor: a row names its PersonaGroup");
}

export async function loadFaceAnchor(rows: FaceAnchorRows, personaGroup: string): Promise<FaceAnchor | null> {
  groupOf(personaGroup);
  const bytes = await rows.read(personaGroup);
  if (bytes === undefined) return null;
  let raw: unknown;
  try { raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new Error(`face-anchor: malformed row for ${personaGroup}`); }
  const anchor = readFaceAnchor(raw);
  if (!anchor || anchor.personaGroup !== personaGroup) throw new Error(`face-anchor: malformed row for ${personaGroup}`);
  return anchor;
}

export async function requireFaceAnchor(rows: FaceAnchorRows, personaGroup: string): Promise<FaceAnchor> {
  const anchor = await loadFaceAnchor(rows, personaGroup);
  if (!anchor) throw new Error(`face-anchor: anchor-missing for ${personaGroup}; re-found the face`);
  return anchor;
}

/** Only founding, admission, recovery, or a verified frontier raise calls this writer. */
export async function keepFaceAnchor(rows: FaceAnchorRows, anchor: FaceAnchor): Promise<void> {
  groupOf(anchor.personaGroup);
  if (!readFaceAnchor(anchor)) throw new Error(`face-anchor: malformed anchor for ${anchor.personaGroup}`);
  await rows.write(anchor.personaGroup, new TextEncoder().encode(JSON.stringify(anchor)));
}
