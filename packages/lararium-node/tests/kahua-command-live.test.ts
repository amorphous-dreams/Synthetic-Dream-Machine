/**
 * kahua-command-live — the `lares kahua` store-door rows over a really founded face: the mint pins once in the face's
 * signed log and registers `bags/kahua`; a direct act stands no island, so a lift refuses `lokahi-cap-unread`; on a
 * standing vessel's reactor the island's cap answer gates apart from the grant; the root's grant lifts and withdraws.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KAHUA_BAG, personaBagIdFor, personaSiblingBagIds, PERSONA_GROUP_ID_TIDDLER, type LarDoc } from "@lararium/mesh";
import { runFoundTheFace } from "../src/index.js";
import { ownedStore } from "../src/owned-store.js";
import { storeDoorDirect, storeDoorReactors } from "../src/store-door-verbs.js";
import { larBootstrapPath, larSealHome } from "../src/vessel-paths.js";
import { withLarRoot } from "../../../tests/harness/with-lar-root.js";
import { direct } from "./direct-store.js";
import { foundDirect, openTestCustody, seatSeedCharter } from "./found-route.js";

const ROOT = join(tmpdir(), `lar-kahua-live-${Date.now()}`);
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
  await withLarRoot(ROOT, () => seatSeedCharter({ name: "vessel-kahua" }));
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


/** A standing vessel's face row: its island answers the cap; the session wears face h0. */
const standing = (verb: Parameters<typeof storeDoorDirect>[0], args: Record<string, unknown>, held: boolean) =>
  withLarRoot(ROOT, async () => {
    await openTestCustody();
    return ownedStore(storage, async (repo) => {
      const catalogUrl = readFileSync(join(storage, "catalog-url"), "utf8").trim();
      const reactors = storeDoorReactors({ storageDir: storage, sealHome: larSealHome(), repo, catalogUrl,
        askIsland: async (asked) => (asked === "kahua-cap" ? { verb: asked, held, ...(held ? {} : { reason: "not a member" }) } : {}) });
      return reactors[verb](args, { worn: { ordinal: 0 } } as never) as Promise<Record<string, unknown>>;
    });
  });
const src = [{ title: "daemon/note", revision: "r1" }];

describe("lares kahua over a founded face", () => {
  test("RED: a second mint no-ops; CONTROL: the first mint pins the stage and registers bags/kahua", async () => {
    const first = await row("kahua-mint", {}) as { url: string; minted: boolean };
    expect(first).toMatchObject({ minted: true, url: expect.stringMatching(/^automerge:/) });
    expect(await row("kahua-mint", {})).toMatchObject({ url: first.url, minted: false });
    const registered = await ownedStore(storage, async (repo) => {
      const catalog = (await repo.find<LarDoc>(readFileSync(join(storage, "catalog-url"), "utf8").trim() as never)).doc()!;
      return (catalog.tiddlers[KAHUA_BAG] as { tiddler?: { text?: string } } | undefined)?.tiddler?.text ?? null;
    });
    expect(registered).toBe(first.url);
  }, 240_000);

  test("RED: a direct lift reads no cap and refuses; a standing vessel whose face holds no cap refuses; CONTROL: held, the root lifts, lists and withdraws", async () => {
    expect(JSON.stringify(await row("kahua-lift", { title: "note", text: "x", taint: [], sources: src }))).toMatch(/lokahi-cap-unread/);
    expect(JSON.stringify(await standing("kahua-lift", { title: "note", text: "x", taint: [], sources: src }, false))).toMatch(/lokahi-cap-absent/);
    expect(JSON.stringify(await standing("kahua-lift", { title: "note", text: "x", sources: src }, true))).toMatch(/taint/);
    const lifted = await standing("kahua-lift", { title: "note", text: "x", taint: [], sources: src }, true) as { cid: string };
    expect(lifted.cid).toMatch(/^[0-9a-f]{64}$/);
    const listed = await row("kahua-read", {}) as { items: Array<{ title: string }> };
    expect(listed.items.map((i) => i.title)).toEqual(["note"]);
    await standing("kahua-withdraw", { target: lifted.cid }, true);
    expect(((await row("kahua-read", {})) as { items: unknown[] }).items).toEqual([]);
    const got = await row("kahua-read", { action: "get", title: "note", history: true }) as { item: unknown; history: Array<{ withdrawn: boolean }> };
    expect(got.item).toBeNull();
    expect(got.history).toMatchObject([{ withdrawn: true }]);
  }, 240_000);

  test("CONTROL: a proposal issues under the atom with no grant in play", async () => {
    const proposed = await row("kahua-propose", { proposals: [{ title: "idea", revision: "r1", text: "body", taint: [] }] }) as { id: string };
    expect(proposed.id).toMatch(/^[0-9a-f]{64}$/);
  }, 240_000);
});
