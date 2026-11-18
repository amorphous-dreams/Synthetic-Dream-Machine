/**
 * browser-face-labels — the browser vessel's binding of the face LABEL (`@lararium/mesh` `face-label.ts`; operator ruling
 * 2026-11-11, "faces name themselves at creation"): the pet-name a face relation wears, in plaintext beside the face.
 *
 * The node rests each label at `<projections>/face-labels/<F>.json`. The browser holds no disk projections root; its one
 * plaintext file substrate stands in the origin-private file system (OPFS), so the label rests there under the same
 * relative path, `face-labels/<F>.json`, with the same bytes the shared seam decides (`writeFaceLabelTo`). A face founded
 * in this browser thus leaves the same label record a node founding leaves.
 *
 * WHAT THE BROWSER LACKS (named, not papered): OPFS clears with the origin's site data, the same act that re-founds a
 * browser vessel, so a browser label survives no re-founding, where the node's projections root does by design; and no
 * browser door yet reads a label back (no seed, no export, no adoption by pet-name runs here). The label stands so those
 * doors read one record when they land, and a browser with no OPFS writes none and says so.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { FACE_LABELS_DIR, readFaceLabelFrom, writeFaceLabelTo, type FaceLabel, type FaceLabelInput, type FaceLabelShelf } from "@lararium/mesh";

/** The slice of an OPFS directory handle the shelf drives. */
export interface OpfsDirectoryLike {
  getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<OpfsDirectoryLike>;
  getFileHandle(name: string, opts?: { create?: boolean }): Promise<{
    getFile(): Promise<{ text(): Promise<string> }>;
    createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>;
  }>;
}

/** The capability a browser lacks when it holds no OPFS: the label refuses by this name and writes nothing. */
export const BROWSER_LABEL_NO_OPFS = "face-label-no-opfs" as const;

/** The origin's OPFS root, or null where this browser holds none (no `navigator.storage.getDirectory`). */
export async function browserOpfsRoot(): Promise<OpfsDirectoryLike | null> {
  const storage = (globalThis as { navigator?: { storage?: { getDirectory?: () => Promise<unknown> } } }).navigator?.storage;
  if (typeof storage?.getDirectory !== "function") return null;
  try { return (await storage.getDirectory()) as OpfsDirectoryLike; } catch { return null; }
}

/** The labels shelf over an OPFS root: `face-labels/<name>`, the node's relative path. */
export function opfsFaceLabelShelf(root: OpfsDirectoryLike): FaceLabelShelf {
  const dir = (create: boolean) => root.getDirectoryHandle(FACE_LABELS_DIR, { create });
  return {
    async read(name) {
      try { return await (await (await (await dir(false)).getFileHandle(name)).getFile()).text(); } catch { return null; }
    },
    async write(name, bytes) {
      const writable = await (await (await dir(true)).getFileHandle(name, { create: true })).createWritable();
      try { await writable.write(bytes); } finally { await writable.close(); }
    },
  };
}

/**
 * Write the worn face's label in this browser's OPFS. Answers `wrote` (true where the record moved), or the capability
 * this browser lacks; never throws, since a label serves as an aid and no standing face fails over it.
 */
export async function writeBrowserFaceLabel(face: FaceLabelInput, root?: OpfsDirectoryLike | null): Promise<{ readonly wrote: boolean } | { readonly refused: typeof BROWSER_LABEL_NO_OPFS }> {
  const opfs = root === undefined ? await browserOpfsRoot() : root;
  if (opfs === null) return { refused: BROWSER_LABEL_NO_OPFS };
  return { wrote: await writeFaceLabelTo(opfsFaceLabelShelf(opfs), face) };
}

/** The label this browser's OPFS holds for `relation`, or null. */
export async function readBrowserFaceLabel(relation: string, root?: OpfsDirectoryLike | null): Promise<FaceLabel | null> {
  const opfs = root === undefined ? await browserOpfsRoot() : root;
  return opfs === null ? null : readFaceLabelFrom(opfsFaceLabelShelf(opfs), relation);
}
