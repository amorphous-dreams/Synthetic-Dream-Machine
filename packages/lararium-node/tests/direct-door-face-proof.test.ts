import { seatSuiteWard } from "./support/scratch-custody-setup.js";
// This suite stands as the person at the terminal: its root acts carry no ward route, and the suite's person answers (seat-harness#/the-ward).
seatSuiteWard();
/**
 * direct-door-face-proof — a direct store door (no vessel standing) that reads a face plane reads the face's own proof,
 * never a plane row (sealed-store#/owed, U1): a face's plane rows rest in its own catalog, sealed, which no door opens
 * without the vessel's daemon island; the floor's catalog names public rows alone.
 *
 *   D1 — RED: over a floor catalog naming no face row, the intent door loads the face: its intents plane is the one the
 *        face's signed plane act names, and the persona plane the founding's bootstrap names projects the face's log
 *   D2 — the direct `intent show` row answers over that floor
 *   CONTROL — a catalog row that names another intents plane than the face's signed act refuses `intent-plane-unproved`
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { personaBagIdFor, personaSiblingBagIds, PERSONA_GROUP_ID_TIDDLER, type LarDoc } from "@lararium/mesh";
import { runFoundTheFace } from "../src/index.js";
import { ownedStore } from "../src/owned-store.js";
import { storeDoorDirect } from "../src/store-door-verbs.js";
import { larBootstrapPath, larSealHome } from "../src/vessel-paths.js";
import { loadIntentFace } from "../src/commands/intent.js";
import { withLarRoot } from "../../../tests/harness/with-lar-root.js";
import { direct } from "./direct-store.js";
import { foundDirect, openTestCustody, seatSeedCharter } from "./found-route.js";

const ROOT = mkdtempSync(join(tmpdir(), "lar-direct-face-proof-"));
const storage = join(ROOT, "data", "lares", "vessel"), genesis = join(ROOT, "genesis");
const builtGenesis = join(new URL("../", import.meta.url).pathname, "..", "..", "genesis");
let group = "", floorUrl = "", forgedUrl = "", intentsUrl = "";
afterAll(() => rmSync(ROOT, { recursive: true, force: true }));
beforeAll(async () => {
  mkdirSync(storage, { recursive: true }); mkdirSync(genesis, { recursive: true });
  cpSync(builtGenesis, genesis, { recursive: true, filter: (src) => !src.endsWith("social-bootstrap.json") });
  await withLarRoot(ROOT, () => foundDirect({ storageDir: storage, genesisDir: genesis }));
  await withLarRoot(ROOT, () => seatSeedCharter({ name: "direct-face-proof" }));
  await withLarRoot(ROOT, () => direct(runFoundTheFace)({ storageDir: storage, genesisDir: genesis }));
  await withLarRoot(ROOT, async () => {
    const packed = JSON.parse((JSON.parse(readFileSync(larBootstrapPath(), "utf8")) as { text: string }).text) as { tiddlers: Record<string, { text?: string }> };
    group = packed.tiddlers[PERSONA_GROUP_ID_TIDDLER]!.text!;
    const bags = personaSiblingBagIds(personaBagIdFor(group))!;
    intentsUrl = packed.tiddlers[bags.intents]!.text!;
    [floorUrl, forgedUrl] = await ownedStore(storage, async (repo) => {
      // THE FLOOR AS THE SPLIT LEAVES IT: no face row.
      const floor = repo.create<LarDoc>({ schemaVersion: "lar/1", tiddlers: {} } as unknown as LarDoc);
      const stray = repo.create<LarDoc>({ schemaVersion: "lar/1", tiddlers: {} } as unknown as LarDoc);
      const forged = repo.create<LarDoc>({ schemaVersion: "lar/1", tiddlers: {
        [bags.intents]: { tiddler: { title: bags.intents, text: stray.url } },
      } } as unknown as LarDoc);
      await repo.flush([floor.documentId, stray.documentId, forged.documentId]);
      return [floor.url as string, forged.url as string];
    });
    writeFileSync(join(storage, "catalog-url"), floorUrl, "utf8");
  });
}, 240_000);

describe("a direct store door reads the face's proof, never a plane row", () => {
  test("D1 — RED: over a floor naming no face row, the intent door loads the face's signed intents plane", async () => {
    await withLarRoot(ROOT, async () => {
      await openTestCustody();
      await ownedStore(storage, async (repo) => {
        const loaded = await loadIntentFace(repo, floorUrl, { group });
        expect(loaded.group).toBe(group);
        expect(loaded.plane.url, "the plane the face's signed act names").toBe(intentsUrl);
        expect(loaded.projection.planes["intents"]).toBe(intentsUrl);
      });
    });
  }, 120_000);

  test("D2 — the direct intent show row answers over the floor", async () => {
    const shown = await withLarRoot(ROOT, async () => { await openTestCustody(); return storeDoorDirect("intent-show", {}, { sealHome: larSealHome(), storageDir: storage }); }) as { delegations?: unknown[] };
    expect(Array.isArray(shown.delegations)).toBe(true);
  }, 120_000);

  test("CONTROL — a catalog row naming another intents plane than the face's signed act refuses intent-plane-unproved", async () => {
    await withLarRoot(ROOT, async () => {
      await openTestCustody();
      await ownedStore(storage, async (repo) => {
        await expect(loadIntentFace(repo, forgedUrl, { group })).rejects.toThrow(/intent-plane-unproved/);
      });
    });
  }, 120_000);
});
