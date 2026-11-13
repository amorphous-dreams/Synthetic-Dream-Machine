import { afterEach, describe, expect, test } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeCustodyHolder } from "../src/custody-holder.js";
import { FsCustodyIo } from "../src/custody-io.js";
import { readCustodyRow, seatCustody } from "../src/custody-seat.js";
import { testScratchNotice } from "../src/test-scratch-notice.js";
import { vesselCustodyHomes } from "../src/vault-carriers.js";

const roots: string[] = [];
const priorRoot = process.env.LAR_ROOT;
afterEach(() => {
  seatCustody(null);
  if (priorRoot === undefined) delete process.env.LAR_ROOT;
  else process.env.LAR_ROOT = priorRoot;
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function scratch(): string {
  const root = mkdtempSync(join(tmpdir(), "test-scratch-admission-"));
  roots.push(root);
  return root;
}

describe("scratch marker admission at the node floor", () => {
  test("main seats a closed holder and then consumes the marker notice", () => {
    const main = readFileSync(new URL("../src/main.ts", import.meta.url), "utf8");
    expect(main).toMatch(/seatCustody\(holder\);\s*const scratchNotice = testScratchNotice\(rootDir\);/);
    expect(main).toMatch(/if \(scratchNotice\) console\.log\(scratchNotice\);/);
  });

  test("a marked root announces TEST SCRATCH and still holds sealed rows shut", async () => {
    const root = scratch();
    writeFileSync(join(root, ".lar-test-scratch"), "\n");
    process.env.LAR_ROOT = root;
    const homes = vesselCustodyHomes();
    const holder = makeCustodyHolder({ io: new FsCustodyIo(homes), homes });
    seatCustody(holder); // main seats the same locked holder before it emits the notice.

    expect(testScratchNotice(root)).toMatch(/TEST SCRATCH ROOT.*\.lar-test-scratch/);
    expect(holder.isUnlocked()).toBe(false);
    await expect(readCustodyRow("identity", "missing-sealed-row")).rejects.toThrow(/key rests unopened/);
    expect(holder.isUnlocked()).toBe(false);
  });

  test("CONTROL: an unmarked root emits no scratch notice", () => {
    expect(testScratchNotice(scratch())).toBeNull();
  });
});
