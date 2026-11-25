/** A completed face's orphan keeps its atom and archive; an interrupted founding keeps its checkpoint. */
import { seatSuiteWard } from "./support/scratch-custody-setup.js";
// This suite stands as the person at the terminal: its root acts carry no ward route, and the suite's person answers (seat-harness#/the-ward).
seatSuiteWard();
import { askRecordPath, faceRecordNames, groupRecordPath } from "./face-paths.js";
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { createHash } from "node:crypto";
import { afterAll, describe, expect, test, vi } from "vitest";
import { hex } from "@lararium/mesh/crypto";
import { personaScopedBagIds } from "@lararium/mesh/persona-scope";
import { withLarRoot } from "../../../tests/harness/with-lar-root.js";

const fault = vi.hoisted(() => ({ afterGroup: false, afterAnchors: false, group: "" }));
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
    // A STOP AFTER THE ANCHORS LAND: the row rests, and the founding stops before its bootstrap entry commits.
    persistIdentityAnchors: async (...args: Parameters<typeof actual.persistIdentityAnchors>) => {
      await actual.persistIdentityAnchors(...args);
      if (fault.afterAnchors) {
        fault.afterAnchors = false;
        fault.group = args[0].personaGroupId;
        throw new Error("planted after the anchors");
      }
    },
  };
});

import { runFoundTheFace } from "../src/commands/init.js";
import { readCustodyRecord, seatedCustody, unseatCustody } from "../src/custody-seat.js";
import { faceAtomGroupFile, loadFaceAtomOfGroup } from "../src/face-atom-store.js";
import { loadIdentityAnchors, veilArchivePath } from "../src/identity-anchors.js";
import { larBootstrapPath, larDataDir, larIdentityDir } from "../src/vessel-paths.js";
import { direct } from "./direct-store.js";
import { TEST_PASSPHRASE, foundDirect, seatSeedCharter } from "./found-route.js";

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

/** Every file under `dir`, by path relative to it, and the digest of its bytes. */
function treeDigests(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (at: string): void => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const path = join(at, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) out.set(relative(dir, path), createHash("sha256").update(readFileSync(path)).digest("hex"));
    }
  };
  walk(dir);
  return out;
}

function removePlaneEntry(group: string): void {
  const plugin = JSON.parse(readFileSync(larBootstrapPath(), "utf8")) as { text: string };
  const packed = JSON.parse(plugin.text) as { tiddlers: Record<string, unknown> };
  const planes = personaScopedBagIds(group);
  for (const title of [planes.identities, planes.circles, planes.sessions, planes.persona]) delete packed.tiddlers[title];
  writeFileSync(larBootstrapPath(), JSON.stringify({ ...plugin, text: JSON.stringify(packed) }, null, 2));
}

async function groupRows(): Promise<Array<{ file: string; seed: Uint8Array }>> {
  const files = faceRecordNames().filter((name) => /^face-atom-g[0-9a-f]{64}\.bin$/.test(name));
  return Promise.all(files.map(async (file) => {
    const seed = await readCustodyRecord("identity", file);
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
      const atomBytes = readFileSync(groupRecordPath(orphan, faceAtomGroupFile(orphan)));
      const archiveBytes = readFileSync(veilArchivePath(orphan));
      removePlaneEntry(orphan);

      // EACH ANCHORS ROW NAMES ITS FACE: handle 1 still stands under the orphan's PersonaGroup, so a re-seed that mints a new group
      // there refuses (`anchors-face-mismatch`) before it writes any row of that group.
      // NOTHING MOVES ON THE REFUSAL: every file under the root (custody rows, the store's plane documents and secret home with its
      // checkpoints, genesis, the bootstrap) reads byte for byte as it stood before the founding asked.
      const before = treeDigests(root);
      const refusal = await foundFace({ genesisDir, handleIndex: 1 }).catch((e: unknown) => e);
      expect(String(refusal)).toMatch(/anchors-face-mismatch/);
      const after = treeDigests(root);
      const moved = [...new Set([...before.keys(), ...after.keys()])].filter((f) => before.get(f) !== after.get(f));
      expect(moved, "the refused founding wrote nothing").toEqual([]);
      expect((await loadIdentityAnchors(1))?.personaGroupId, "handle 1 keeps the orphan's own anchors").toBe(orphan);
      expect(readFileSync(groupRecordPath(orphan, faceAtomGroupFile(orphan))).equals(atomBytes), "the orphan's group atom row keeps its bytes").toBe(true);
      expect(readFileSync(veilArchivePath(orphan)).equals(archiveBytes), "the orphan's archive keeps its bytes").toBe(true);
      // NEVER HALF-WRITTEN: the refusal reads before the new group's first row, so no group atom and no veil archive of another
      // group stands beside the orphan's.
      const rows = await groupRows();
      const zero = (await loadIdentityAnchors(0))!.personaGroupId;
      expect(rows.map(({ file }) => file).sort(), "only persona zero's and the orphan's group atoms stand").toEqual([faceAtomGroupFile(zero), faceAtomGroupFile(orphan)].sort());
      expect(faceRecordNames().filter((name) => /^veil-archive-g[0-9a-f]{64}\.bin$/.test(name)).length, "only the faces' own archives stand").toBe(faceRecordNames().filter((name) => /^face-atom-g[0-9a-f]{64}\.bin$/.test(name)).length);
      // WHY THE ANCHORS REFUSE: the state an unguarded re-seed left (handle 1's own face under the orphan's group, its anchors
      // naming the new group) never opens again. The holder reads the face's anchors against its floor index entry at unlock.
      const holder = seatedCustody()!;
      const h1 = (await holder.faceStanding({ ordinal: 1 }))!;
      await holder.writeRecord("identity", "anchors-h1.json", new TextEncoder().encode(JSON.stringify({ personaGroupId: "a-fresh-group", meshCabalDocIdHex: "ab".repeat(32) })));
      await holder.lockFace(h1.fcid);
      const reopened = await holder.unlockFace({ ordinal: 1 }, [{ kind: "passphrase", passphrase: TEST_PASSPHRASE }]);
      expect(reopened.reading, JSON.stringify(reopened)).not.toBe("opens");
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

  test("control: a persona new stopped after its anchors land resumes on retry: the same group, and the face stands", async () => {
    const { root, genesisDir } = await rig();
    await withLarRoot(root, async () => {
      fault.afterAnchors = true;
      await expect(foundFace({ genesisDir, handleIndex: 1 })).rejects.toThrow("planted after the anchors");
      const stoppedGroup = fault.group;
      expect((await loadIdentityAnchors(1))?.personaGroupId, "the anchors landed before the stop").toBe(stoppedGroup);
      const resumed = await foundFace({ genesisDir, handleIndex: 1 });
      expect(resumed.alreadyStood).toBe(false);
      expect(resumed.personaGroupId, "the retry finishes the same group").toBe(stoppedGroup);
      const packed = JSON.parse((JSON.parse(readFileSync(larBootstrapPath(), "utf8")) as { text: string }).text) as { tiddlers: Record<string, { text?: string }> };
      expect(packed.tiddlers[personaScopedBagIds(stoppedGroup).identities]?.text, "the bootstrap entry commits the face").toBeTruthy();
      // and a third run reads it stood
      expect((await foundFace({ genesisDir, handleIndex: 1 })).alreadyStood).toBe(true);
    });
  }, 180_000);
});
