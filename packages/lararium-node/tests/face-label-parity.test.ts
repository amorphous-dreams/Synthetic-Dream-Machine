/**
 * face-label-parity — a face founded on a node and one founded in a browser leave the SAME label record (operator ruling
 * 2026-11-11, "faces name themselves at creation"): one shape and one decision (`@lararium/mesh` `face-label.ts`), bound to
 * the node's projections root and to the browser's origin-private file system under the same relative path.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FACE_LABELS_DIR, faceLabelBytes, faceLabelOf } from "@lararium/mesh";
import { writeFaceLabel, readFaceLabel, faceLabelPath } from "../src/face-labels.js";
import { writeBrowserFaceLabel, readBrowserFaceLabel, BROWSER_LABEL_NO_OPFS, type OpfsDirectoryLike } from "../../lararium-browser/src/browser-face-labels.js";

const F = "1b4e28ba-2fa1-41d2-883f-0016d3cca427";

/** An in-memory origin-private file system: directories of named text files. */
function memoryOpfs(): { root: OpfsDirectoryLike; files: Map<string, string> } {
  const files = new Map<string, string>();
  const dir = (path: string): OpfsDirectoryLike => ({
    async getDirectoryHandle(name, opts) {
      const at = `${path}${name}/`;
      if (!opts?.create && ![...files.keys()].some((k) => k.startsWith(at))) throw new DOMException("absent", "NotFoundError");
      return dir(at);
    },
    async getFileHandle(name, opts) {
      const at = `${path}${name}`;
      if (!opts?.create && !files.has(at)) throw new DOMException("absent", "NotFoundError");
      return {
        getFile: async () => ({ text: async () => files.get(at) ?? "" }),
        createWritable: async () => { let buf = ""; return { write: async (d: string) => { buf += d; }, close: async () => { files.set(at, buf); } }; },
      };
    },
  });
  return { root: dir(""), files };
}

let root: string;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "lar-face-label-parity-")); });
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

describe("a face names itself the same on a node and in a browser", () => {
  test("RED->GREEN: node and browser founding write byte-identical labels at the same relative path, each the shared seam's record", async () => {
    const face = { relation: F, petname: "hearth-one", handleIndex: 0 };
    expect(writeFaceLabel(face, root)).toBe(true);
    const opfs = memoryOpfs();
    expect(await writeBrowserFaceLabel(face, opfs.root)).toEqual({ wrote: true });

    const nodeBytes = readFileSync(faceLabelPath(F, root), "utf8");
    const browserBytes = opfs.files.get(`${FACE_LABELS_DIR}/${F}.json`);
    expect(browserBytes).toBe(nodeBytes);
    expect(nodeBytes).toBe(faceLabelBytes(faceLabelOf(face)!));
    expect(await readBrowserFaceLabel(F, opfs.root)).toEqual(readFaceLabel(F, root));
  });

  test("a replay lands nothing on either substrate; a rename moves both alike", async () => {
    const opfs = memoryOpfs();
    const face = { relation: F, petname: "hearth-one", handleIndex: 0 };
    writeFaceLabel(face, root);
    await writeBrowserFaceLabel(face, opfs.root);
    expect(writeFaceLabel(face, root)).toBe(false);
    expect(await writeBrowserFaceLabel(face, opfs.root)).toEqual({ wrote: false });
    const renamed = { ...face, petname: "renamed" };
    expect(writeFaceLabel(renamed, root)).toBe(true);
    expect(await writeBrowserFaceLabel(renamed, opfs.root)).toEqual({ wrote: true });
    expect(opfs.files.get(`${FACE_LABELS_DIR}/${F}.json`)).toBe(readFileSync(faceLabelPath(F, root), "utf8"));
  });

  test("CONTROL: an unnamed face or a face with no relation writes no label on either; a browser with no OPFS names the capability it lacks", async () => {
    const opfs = memoryOpfs();
    for (const face of [{ relation: null, petname: "x", handleIndex: 0 }, { relation: F, petname: undefined, handleIndex: 0 }, { relation: "not-a-relation", petname: "x", handleIndex: 0 }]) {
      expect(writeFaceLabel(face, root)).toBe(false);
      expect(await writeBrowserFaceLabel(face, opfs.root)).toEqual({ wrote: false });
    }
    expect(opfs.files.size).toBe(0);
    expect(await writeBrowserFaceLabel({ relation: F, petname: "x", handleIndex: 0 }, null)).toEqual({ refused: BROWSER_LABEL_NO_OPFS });
  });
});
