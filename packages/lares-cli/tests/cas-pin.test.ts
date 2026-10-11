/**
 * cas-pin.test.ts — `lares bag cas`'s pinned-blob reflection reads a pin by PRESENCE in the `.pins.json`
 * sidecar (basket-one #/grace-and-pin, retired to NO GLOBAL NOW 2026-10-10). `PinCap` carries NO
 * `expiry` field at all (M7) — only an OPTIONAL causal `fence`, which this CLI door never sets, so
 * every pin it writes holds by PRESENCE alone, forever, until an explicit `--release`. The proofs:
 *   · a freshly pinned cid reads `pinned` with no fence at all — nothing a wall clock could call "expired";
 *   · `--release` (here, `releaseCas` directly) drops it from `pinned` immediately, with no clock involved;
 *   · CONTROL: a SET-BACK and a SET-FORWARD wall clock (mocked `Date.now`) change neither verdict.
 */
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { pinCas, releaseCas } from "@lararium/node";
import { readCas } from "../src/commands/cas.js";

const cidOf = (s: string): string => createHash("sha256").update(Buffer.from(s, "utf8")).digest("hex");

let root = "";
let casDir = "";
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "lr-cas-pin-"));
  casDir = join(root, "cas");
  mkdirSync(casDir, { recursive: true });
});
afterEach(() => { rmSync(root, { recursive: true, force: true }); vi.restoreAllMocks(); });

function emptyDirs(): { casDir: string; bagsDir: string; wikisDir: string; genesisDir: string } {
  return { casDir, bagsDir: join(root, "bags"), wikisDir: join(root, "wikis"), genesisDir: join(root, "genesis") };
}

describe("readCas — pinned reflects PRESENCE in the sidecar, never a wall clock", () => {
  test("a pin with no `fence` at all stands — nothing a clock-shaped reading could call expired", () => {
    const b = "a blob the operator means to keep";
    const cid = cidOf(b);
    writeFileSync(join(casDir, cid), b);
    pinCas(casDir, { cid, tier: "veil", holder: "operator" });
    const r = readCas(emptyDirs());
    expect(r.pinned).toEqual([cid]);
  });

  test("`releaseCas` drops the pin immediately — no clock, no wait", () => {
    const b = "a blob released right away";
    const cid = cidOf(b);
    writeFileSync(join(casDir, cid), b);
    pinCas(casDir, { cid, tier: "veil", holder: "operator" });
    expect(readCas(emptyDirs()).pinned).toEqual([cid]);
    releaseCas(casDir, cid);
    expect(readCas(emptyDirs()).pinned).toEqual([]);
  });

  test("CONTROL — SET-BACK and SET-FORWARD: a mocked `Date.now` ten years either way changes neither verdict", () => {
    const standing = "a pin a far-forward clock would call expired";
    const released = "a blob a far-back clock cannot un-release";
    const sCid = cidOf(standing), rCid = cidOf(released);
    writeFileSync(join(casDir, sCid), standing);
    writeFileSync(join(casDir, rCid), released);
    pinCas(casDir, { cid: sCid, tier: "veil", holder: "operator" });
    pinCas(casDir, { cid: rCid, tier: "veil", holder: "operator" });
    releaseCas(casDir, rCid);   // released before any clock skew — it must stay released under either skew

    const realNow = Date.now();
    for (const skew of [-10 * 365 * 86_400_000, 10 * 365 * 86_400_000]) {
      vi.spyOn(Date, "now").mockReturnValue(realNow + skew);
      try {
        const r = readCas(emptyDirs());
        expect(r.pinned, `skew ${skew}`).toEqual([sCid]);
        expect(r.pinned, `skew ${skew}`).not.toContain(rCid);
      } finally { vi.restoreAllMocks(); }
    }
  });
});
