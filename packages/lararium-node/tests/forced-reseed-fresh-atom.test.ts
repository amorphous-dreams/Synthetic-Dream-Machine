/** A completed face's orphan keeps its atom and archive; an interrupted founding keeps its checkpoint. */
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test, vi } from "vitest";
import { faceAtomKeyFromSeed, hex, personaScopedBagIds } from "@lararium/mesh";
import { withLarRoot } from "../../../tests/harness/with-lar-root.js";

const fault = vi.hoisted(() => ({ afterGroup: false, group: "" }));
vi.mock("../src/identity-anchors.js", async (importActual) => {
  const actual = await importActual<typeof import("../src/identity-anchors.js")>();
  return {
    ...actual,
    persistVeilArchive: async (...args: Parameters<typeof actual.persistVeilArchive>) => {
      if (fault.afterGroup) {
        fault.afterGroup = false;
        fault.group = args[1];
        throw new Error("planted after the group row");
      }
      return actual.persistVeilArchive(...args);
    },
  };
});

import { runFoundTheFace } from "../src/commands/init.js";
import { readCustodyRow, seatedCustody, unseatCustody } from "../src/custody-seat.js";
import { faceAtomGroupFile, loadFaceAtomOfGroup } from "../src/face-atom-store.js";
import { loadIdentityAnchors, veilArchivePath } from "../src/identity-anchors.js";
import { larBootstrapPath, larDataDir, larIdentityDir } from "../src/vessel-paths.js";
import { direct } from "./direct-store.js";
import { foundDirect, seatSeedCharter } from "./found-route.js";

const foundFace = direct(runFoundTheFace);
const genesisSource = join(import.meta.dirname, "..", "..", "..", "genesis");
const roots: string[] = [];

async function rig() {
  const root = mkdtempSync(join(tmpdir(), "lar-fresh-reseed-"));
  roots.push(root);
  return withLarRoot(root, async () => {
    const genesisDir = join(root, "genesis");
    cpSync(genesisSource, genesisDir, { recursive: true });
    await foundDirect({ storageDir: larDataDir(), genesisDir });
    await seatSeedCharter();
    await foundFace({ genesisDir, handleIndex: 0 });
    return { root, genesisDir };
  });
}

function removePlaneEntry(group: string): void {
  const plugin = JSON.parse(readFileSync(larBootstrapPath(), "utf8")) as { text: string };
  const packed = JSON.parse(plugin.text) as { tiddlers: Record<string, unknown> };
  const planes = personaScopedBagIds(group);
  for (const title of [planes.identities, planes.circles, planes.sessions, planes.persona]) delete packed.tiddlers[title];
  writeFileSync(larBootstrapPath(), JSON.stringify({ ...plugin, text: JSON.stringify(packed) }, null, 2));
}

async function groupRows(): Promise<Array<{ file: string; seed: Uint8Array }>> {
  const files = readdirSync(larIdentityDir()).filter((name) => /^face-atom-g[0-9a-f]{64}\.bin$/.test(name));
  return Promise.all(files.map(async (file) => {
    const seed = await readCustodyRow("identity", file);
    expect(seed, `${file} opens through custody`).toHaveLength(32);
    return { file, seed: seed! };
  }));
}

afterAll(async () => {
  for (const root of roots) {
    await withLarRoot(root, async () => {
      const holder = seatedCustody();
      if (holder) { await holder.lock(); unseatCustody(holder); }
    });
    rmSync(root, { recursive: true, force: true });
  }
});

describe("a forced re-seed mints a fresh atom", () => {
  test("a completed face leaves its group atom and veil archive with the orphan", async () => {
    const { root, genesisDir } = await rig();
    await withLarRoot(root, async () => {
      const first = await foundFace({ genesisDir, handleIndex: 1 });
      const orphan = first.personaGroupId;
      const orphanSeed = (await loadFaceAtomOfGroup(orphan))!;
      const orphanKey = faceAtomKeyFromSeed(orphanSeed, orphan).key;
      const atomBytes = readFileSync(join(larIdentityDir(), faceAtomGroupFile(orphan)));
      const archiveBytes = readFileSync(veilArchivePath(orphan));
      removePlaneEntry(orphan);

      const next = await foundFace({ genesisDir, handleIndex: 1 });
      const fresh = next.personaGroupId;
      expect(next.alreadyStood).toBe(false);
      expect(fresh, "a new founding stands a new PersonaGroup").not.toBe(orphan);
      const freshSeed = (await loadFaceAtomOfGroup(fresh))!;
      expect(faceAtomKeyFromSeed(freshSeed, fresh).key, "the new group mints a fresh atom key").not.toBe(orphanKey);
      expect((await loadIdentityAnchors(1))?.personaGroupId).toBe(fresh);
      expect(readFileSync(join(larIdentityDir(), faceAtomGroupFile(orphan))).equals(atomBytes), "the orphan's group atom row keeps its bytes").toBe(true);
      expect(readFileSync(veilArchivePath(orphan)).equals(archiveBytes), "the orphan's archive keeps its bytes").toBe(true);
      expect(readFileSync(veilArchivePath(fresh)).equals(archiveBytes), "the new archive belongs to its group").toBe(false);

      const rows = await groupRows();
      expect(rows.map(({ file }) => file)).toContain(faceAtomGroupFile(orphan));
      expect(rows.map(({ file }) => file)).toContain(faceAtomGroupFile(fresh));
      const seeds = rows.map(({ seed }) => hex(seed));
      // The public atom key derives from the seed alone; each row supplies its own custody label here.
      const keys = rows.map(({ seed, file }) => faceAtomKeyFromSeed(seed, file).key);
      expect(new Set(seeds).size, "no two group rows hold the same seed").toBe(rows.length);
      expect(new Set(keys).size, "no two group rows name the same atom key").toBe(rows.length);
    });
  }, 180_000);

  test("control: re-entering a founding stopped after the group row keeps its seed", async () => {
    const { root, genesisDir } = await rig();
    await withLarRoot(root, async () => {
      fault.afterGroup = true;
      await expect(foundFace({ genesisDir, handleIndex: 1 })).rejects.toThrow("planted after the group row");
      const stoppedGroup = fault.group;
      const stoppedSeed = (await loadFaceAtomOfGroup(stoppedGroup))!;
      expect(stoppedSeed).toHaveLength(32);
      const resumed = await foundFace({ genesisDir, handleIndex: 1 });
      expect(resumed.alreadyStood).toBe(false);
      expect(resumed.personaGroupId, "the checkpoint re-lands the same group").toBe(stoppedGroup);
      expect(hex((await loadFaceAtomOfGroup(resumed.personaGroupId))!), "the checkpoint keeps the same seed").toBe(hex(stoppedSeed));
      const rows = await groupRows();
      expect(rows.filter(({ seed }) => hex(seed) === hex(stoppedSeed)), "exactly one row holds the stopped seed").toHaveLength(1);
    });
  }, 180_000);
});
