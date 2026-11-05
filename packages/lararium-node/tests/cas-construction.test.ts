/**
 * The vessel's CAS dirs are fixed at CONSTRUCTION: no content read touches process.env afterward, and the corpus store
 * rides inside the record's `cas` as its second tier.
 *
 *   C1  a pool's content reader reads the one `cidDir` the vessel handed it; setting LAR_CAS after construction changes
 *       nothing (control: the same blob in the handed dir answers).
 *   C2  the island worker's CAS path and the pool read no env (source witness over the two files).
 *   C3  the corpus tier: a record's `cas` resolver (the vessel's `makeNodeCasResolver`) answers a blob from the corpus
 *       dir after the runtime dir misses (control: with no corpus dir the same cid misses).
 */
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { nodeContentReader } from "../src/vessel-island-pool.js";
import { createHash } from "node:crypto";
import { corpusCasDirFromEnv, makeNodeCasResolver } from "../src/node-cas.js";

const made: string[] = [];
const tmp = (): string => { const d = mkdtempSync(join(tmpdir(), "cas-construction-")); made.push(d); return d; };
afterEach(() => { for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true }); delete process.env["LAR_CAS"]; });

const CID = "sha256:" + "ab".repeat(32);
const BYTES = new Uint8Array([1, 2, 3]);

describe("the CAS dirs are fixed at construction", () => {
  test("C1 — LAR_CAS set after the reader was built changes nothing", async () => {
    const handed = tmp(), late = tmp();
    mkdirSync(handed, { recursive: true });
    writeFileSync(join(late, CID), BYTES);
    const read = nodeContentReader(handed, {});
    process.env["LAR_CAS"] = late;
    expect(await read(CID)).toBeNull();
    // control: the blob in the handed dir answers
    writeFileSync(join(handed, CID), BYTES);
    expect(await read(CID)).toEqual(BYTES);
  });

  test("C2 — the pool and the island worker's CAS path read no env", () => {
    for (const f of ["vessel-island-pool.ts", "sovereign-island-model.ts"]) {
      const src = readFileSync(join(import.meta.dirname, "..", "src", f), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      expect(src.includes("process" + ".env"), f).toBe(false);
    }
  });

  test("C3 — the record's cas answers from the corpus dir as its second tier", async () => {
    const cid = "sha256:" + createHash("sha256").update(BYTES).digest("hex");
    const runtime = tmp(), corpus = tmp();
    writeFileSync(join(corpus, cid), BYTES);
    expect(await makeNodeCasResolver({ cidDir: runtime, corpusCasDir: corpus, shore: null })(cid)).toEqual(BYTES);
    // control: with no corpus dir handed, the same cid misses
    expect(await makeNodeCasResolver({ cidDir: runtime, corpusCasDir: null, shore: null })(cid)).toBeNull();
  });

  test("C4 — corpusCasDirFromEnv is the one env read, made by the vessel at construction", () => {
    const d = tmp();
    process.env["LAR_CAS"] = d;
    expect(corpusCasDirFromEnv()).toBe(d);
  });
});
