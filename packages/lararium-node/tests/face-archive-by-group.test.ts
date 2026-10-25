/** A veil archive follows its PersonaGroup when a compartment index lands another face. */
import { cpSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { personaScopedBagIds } from "@lararium/mesh";
import { withLarRoot } from "../../../tests/harness/with-lar-root.js";
import { runFoundTheFace } from "../src/commands/init.js";
import { seatedCustody, unseatCustody } from "../src/custody-seat.js";
import { loadIdentityAnchors, loadVeilArchive, veilArchivePath, type IdentityAnchors } from "../src/identity-anchors.js";
import { larBootstrapPath, larDataDir, larIdentityDir } from "../src/vessel-paths.js";
import { direct } from "./direct-store.js";
import { handleRowPath } from "./face-paths.js";
import { foundDirect, seatSeedCharter } from "./found-route.js";

const foundFace = direct(runFoundTheFace);
const genesisSource = join(import.meta.dirname, "..", "..", "..", "genesis");
const roots: string[] = [];

async function rig() {
  const root = mkdtempSync(join(tmpdir(), "lar-archive-group-"));
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

// The inventory holds anchors read while each group still occupies its compartment.
// It resolves a group's archive through that group's anchors, never through the currently worn index.
async function archiveOfGroup(group: string, inventory: ReadonlyMap<string, { index: number; anchors: IdentityAnchors }>): Promise<Uint8Array | null> {
  const stood = inventory.get(group);
  if (!stood || stood.anchors.personaGroupId !== group) return null;
  return loadVeilArchive(stood.anchors.personaGroupId);
}

async function remember(index: number, inventory: Map<string, { index: number; anchors: IdentityAnchors }>) {
  const anchors = await loadIdentityAnchors(index);
  if (!anchors) throw new Error(`h${index} holds no anchors`);
  inventory.set(anchors.personaGroupId, { index, anchors });
  return anchors.personaGroupId;
}

function removePlaneEntry(group: string) {
  const plugin = JSON.parse(readFileSync(larBootstrapPath(), "utf8")) as { text: string };
  const packed = JSON.parse(plugin.text) as { tiddlers: Record<string, unknown> };
  const planes = personaScopedBagIds(group);
  for (const title of [planes.identities, planes.circles, planes.sessions, planes.persona]) delete packed.tiddlers[title];
  writeFileSync(larBootstrapPath(), JSON.stringify({ ...plugin, text: JSON.stringify(packed) }, null, 2));
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

describe("the veil archive follows its group", () => {
  test("reusing h1 keeps A's bytes and gives C its own archive", async () => {
    const { root, genesisDir } = await rig();
    await withLarRoot(root, async () => {
      const inventory = new Map<string, { index: number; anchors: IdentityAnchors }>();
      await foundFace({ genesisDir, handleIndex: 1 });
      const a = await remember(1, inventory);
      const aBytes = Buffer.from((await archiveOfGroup(a, inventory))!);
      expect(aBytes.length).toBeGreaterThan(0);
      // The old compartment leaves the roster's anchor row and bootstrap plane before a new ask lands there.
      unlinkSync(handleRowPath("anchors-h1.json"));
      removePlaneEntry(a);
      const cFace = await foundFace({ genesisDir, handleIndex: 1 });
      const c = await remember(1, inventory);
      expect(c).not.toBe(a);
      expect(cFace.personaGroupId).toBe(c);
      const cBytes = await archiveOfGroup(c, inventory);
      expect(cBytes?.length).toBeGreaterThan(0);
      expect(Buffer.from(cBytes!).equals(aBytes)).toBe(false);
      expect(Buffer.from((await archiveOfGroup(a, inventory))!).equals(aBytes), "A's group still opens its original archive").toBe(true);
    });
  }, 180_000);

  test("control: groups founded at separate indexes keep both archives", async () => {
    const { root, genesisDir } = await rig();
    await withLarRoot(root, async () => {
      const inventory = new Map<string, { index: number; anchors: IdentityAnchors }>();
      await foundFace({ genesisDir, handleIndex: 1 });
      const a = await remember(1, inventory);
      const aBytes = Buffer.from((await archiveOfGroup(a, inventory))!);
      await foundFace({ genesisDir, handleIndex: 2 });
      const c = await remember(2, inventory);
      expect(c).not.toBe(a);
      expect(Buffer.from((await archiveOfGroup(a, inventory))!).equals(aBytes)).toBe(true);
      expect((await archiveOfGroup(c, inventory))?.length).toBeGreaterThan(0);
      expect(readFileSync(veilArchivePath(a)).equals(readFileSync(veilArchivePath(c)))).toBe(false);
    });
  }, 180_000);
});
