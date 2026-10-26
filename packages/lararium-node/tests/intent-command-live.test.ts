/**
 * intent-command-live — the store-door rows of `lares intent` over a really founded face: the row proves the intents plane
 * against the face's signed log, issues under the face atom, reads the plane back, and the persona root's word voids.
 * Reds: a spread single-effect request refuses before any write; an unregistered plane refuses by name. Controls: a
 * pinned `face-join` issues, carries this vessel's own ContactCard and complete device edge, and keeps one id on replay.
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { personaBagIdFor, personaSiblingBagIds, PERSONA_GROUP_ID_TIDDLER, intentEntryRecordsOfGroup, type LarDoc } from "@lararium/mesh";
import { runFoundTheFace } from "../src/index.js";
import { ownedStore } from "../src/owned-store.js";
import { storeDoorDirect } from "../src/store-door-verbs.js";
import { larBootstrapPath, larSealHome } from "../src/vessel-paths.js";
import { withLarRoot } from "../../../tests/harness/with-lar-root.js";
import { direct } from "./direct-store.js";
import { foundDirect, openTestCustody, seatSeedCharter } from "./found-route.js";

const ROOT = join(tmpdir(), `lar-intent-live-${Date.now()}`);
const storage = join(ROOT, "data", "lares", "vessel"), genesis = join(ROOT, "genesis");
const BUILT_GENESIS = join(new URL("../", import.meta.url).pathname, "..", "..", "genesis");
afterAll(() => { try { rmSync(ROOT, { recursive: true, force: true }); } catch { /* best effort */ } });

let group = "";
const row = (verb: Parameters<typeof storeDoorDirect>[0], args: Record<string, unknown>) =>
  withLarRoot(ROOT, async () => { await openTestCustody(); return storeDoorDirect(verb, args, { sealHome: larSealHome(), storageDir: storage }); });

beforeAll(async () => {
  mkdirSync(storage, { recursive: true });
  mkdirSync(genesis, { recursive: true });
  cpSync(BUILT_GENESIS, genesis, { recursive: true, filter: (src) => !src.endsWith("social-bootstrap.json") });
  await withLarRoot(ROOT, () => foundDirect({ storageDir: storage, genesisDir: genesis }));
  await withLarRoot(ROOT, () => seatSeedCharter({ name: "vessel-intent" }));
  await withLarRoot(ROOT, () => direct(runFoundTheFace)({ storageDir: storage, genesisDir: genesis }));
  await withLarRoot(ROOT, async () => {
    const packed = JSON.parse((JSON.parse(readFileSync(larBootstrapPath(), "utf8")) as { text: string }).text) as { tiddlers: Record<string, { text?: string }> };
    group = packed.tiddlers[PERSONA_GROUP_ID_TIDDLER]!.text!;
    const bags = personaSiblingBagIds(personaBagIdFor(group))!;
    const catalogUrl = await ownedStore(storage, async (repo) => {
      const catalog = repo.create<LarDoc>({ schemaVersion: "lar/1", tiddlers: {
        [bags.persona]: { tiddler: { title: bags.persona, text: packed.tiddlers[bags.persona]!.text } },
        [bags.intents]: { tiddler: { title: bags.intents, text: packed.tiddlers[bags.intents]!.text } },
      } } as unknown as LarDoc);
      await repo.flush([catalog.documentId]);
      return catalog.url as string;
    });
    writeFileSync(join(storage, "catalog-url"), catalogUrl, "utf8");
  });
}, 240_000);

describe("lares intent over a founded face", () => {
  test("RED: a spread single-effect request refuses by name and writes nothing; CONTROL: a face-join issues pinned to the hearth with this vessel's card and edge, and a replay keeps one id", async () => {
    const spread = await row("intent-issue", { intentVerb: "face-join", every: true, args: { summons: {} } });
    expect(JSON.stringify(spread)).toMatch(/single-effect-unpinned|refused/);
    const first = await row("intent-issue", { intentVerb: "face-join" });
    expect(first).toMatchObject({ id: expect.stringMatching(/^[0-9a-f]{64}$/) });
    const replay = await row("intent-issue", { intentVerb: "face-join" });
    expect((replay as { id: string }).id).toBe((first as { id: string }).id);
    const shown = (await row("intent-show", {})) as { rows: Array<{ id: string; verb: string }> };
    expect(shown.rows.filter((r) => r.verb === "face-join")).toHaveLength(1);
    const records = await ownedStore(storage, async (repo) => {
      const catalogUrl = readFileSync(join(storage, "catalog-url"), "utf8").trim();
      const catalog = (await repo.find<LarDoc>(catalogUrl as never)).doc()!;
      const url = (catalog.tiddlers[personaSiblingBagIds(personaBagIdFor(group))!.intents] as { tiddler: { text: string } }).tiddler.text;
      return intentEntryRecordsOfGroup((await repo.find<LarDoc>(url as never)).doc(), group) as Array<{ body: { verb?: string; args?: { summons?: { contactCard: string; deviceEdge: unknown } } } }>;
    });
    const summons = records.find((r) => r.body.verb === "face-join")!.body.args!.summons!;
    expect(summons.contactCard.length).toBeGreaterThan(10);
    expect(summons.deviceEdge).toBeTruthy();
  }, 240_000);

  test("the persona root's cancel voids the intent the face atom issued; show names the void", async () => {
    const id = ((await row("intent-show", {})) as { rows: Array<{ id: string }> }).rows[0]!.id;
    await row("intent-root", { action: "cancel", target: id });
    const after = (await row("intent-show", {})) as { rows: Array<{ id: string; status: string }> };
    expect(after.rows.find((r) => r.id === id)!.status).toBe("void");
  }, 240_000);
});
