/**
 * ward-cosign-face-fold — the node's co-sign port at the act reads the face's signed admission fold first and its intents plane
 * second (row 7, S3b). A face whose intents plane cannot load still lowers on the unlock alone where its fold reads one device; a
 * fold that cannot be read refuses `ward-cosign-fold-unread` by name and runs nothing.
 *
 * The persona plane reads off the catalog row where one stands, else off the bootstrap the founding wrote (sealed-store#/owed,
 * U1); either url only locates the plane, whose records verify against the face's KEL lineage. So a catalog with no persona row
 * still reads the fold through the bootstrap, and the fold reads unreadable only where neither names the plane, or where the
 * named doc holds no signed log.
 *
 * Reds: a one-device face with no intents plane in its catalog runs the act; a catalog and a bootstrap that name no persona plane
 * refuse `ward-cosign-fold-unread`; a bootstrap whose persona entry names a doc with no signed log refuses the same and runs
 * nothing. Controls: the whole catalog lowers one device on the unlock alone, and its plane takes no entry; a catalog with no
 * persona row lowers through the bootstrap's entry.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness#/the-swarm-slices
 */
import { seatSuiteWard } from "./support/scratch-custody-setup.js";
seatSuiteWard();
import { Repo } from "@automerge/automerge-repo";
import { afterAll, beforeAll, expect, test } from "vitest";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { intentEntryRecordsOfGroup, personaBagIdFor, personaSiblingBagIds, wardCosignGate, PERSONA_GROUP_ID_TIDDLER, type LarDoc } from "@lararium/mesh";
import { runFoundTheFace } from "../src/index.js";
import { DurableNodeFSStorageAdapter } from "../src/durable-storage-adapter.js";
import { ownedStore } from "../src/owned-store.js";
import { larBootstrapPath } from "../src/vessel-paths.js";
import { loadIntentFace, loadNodeWardCosignPort } from "../src/commands/intent.js";
import { withLarRoot } from "../../../tests/harness/with-lar-root.js";
import { direct } from "./direct-store.js";
import { foundDirect, openTestCustody, seatSeedCharter } from "./found-route.js";

const ROOT = mkdtempSync(join(tmpdir(), "lar-cosign-fold-"));
const storage = join(ROOT, "data", "lares", "vessel"), genesis = join(ROOT, "genesis");
const builtGenesis = join(new URL("../", import.meta.url).pathname, "..", "..", "genesis");
let group = "", personaBag = "", unsignedUrl = "";
const catalogs: Record<"whole" | "no-intents" | "no-persona", string> = { "whole": "", "no-intents": "", "no-persona": "" };

beforeAll(async () => {
  mkdirSync(storage, { recursive: true }); mkdirSync(genesis, { recursive: true });
  cpSync(builtGenesis, genesis, { recursive: true, filter: (src) => !src.endsWith("social-bootstrap.json") });
  await withLarRoot(ROOT, () => foundDirect({ storageDir: storage, genesisDir: genesis }));
  await withLarRoot(ROOT, () => seatSeedCharter({ name: "cosign-fold" }));
  await withLarRoot(ROOT, () => direct(runFoundTheFace)({ storageDir: storage, genesisDir: genesis }));
  await withLarRoot(ROOT, async () => {
    const packed = JSON.parse((JSON.parse(readFileSync(larBootstrapPath(), "utf8")) as { text: string }).text) as { tiddlers: Record<string, { text?: string }> };
    group = packed.tiddlers[PERSONA_GROUP_ID_TIDDLER]!.text!;
    const bags = personaSiblingBagIds(personaBagIdFor(group))!;
    personaBag = bags.persona;
    const entry = (bag: string) => ({ [bag]: { tiddler: { title: bag, text: packed.tiddlers[bag]!.text } } });
    await ownedStore(storage, async (repo) => {
      const make = async (tiddlers: Record<string, unknown>) => {
        const catalog = repo.create<LarDoc>({ schemaVersion: "lar/1", tiddlers } as unknown as LarDoc);
        await repo.flush([catalog.documentId]); return catalog.url as string;
      };
      catalogs["whole"] = await make({ ...entry(bags.persona), ...entry(bags.intents) });
      catalogs["no-intents"] = await make({ ...entry(bags.persona) });
      catalogs["no-persona"] = await make({ ...entry(bags.intents) });
      // A doc that holds no signed log: a persona entry naming it locates nothing the face's KEL lineage verifies.
      unsignedUrl = await make({});
    });
  });
}, 240_000);
afterAll(() => rmSync(ROOT, { recursive: true, force: true }));

const lower = { verb: "ward-kapae-lower" as const, wiki: "daemon", head: "a".repeat(64) };

/** The bootstrap's persona entry for one act: kept, dropped, or pointed at another doc; restored after. */
type PersonaEntry = "kept" | "dropped" | "unsigned";
const withPersonaEntry = async <T>(how: PersonaEntry, run: () => Promise<T>): Promise<T> => {
  if (how === "kept") return run();
  const path = larBootstrapPath(), original = readFileSync(path, "utf8");
  const plugin = JSON.parse(original) as { text: string }, packed = JSON.parse(plugin.text) as { tiddlers: Record<string, { title?: string; text?: string }> };
  if (how === "dropped") delete packed.tiddlers[personaBag];
  else packed.tiddlers[personaBag] = { ...packed.tiddlers[personaBag], text: unsignedUrl };
  writeFileSync(path, JSON.stringify({ ...plugin, text: JSON.stringify(packed) }));
  try { return await run(); } finally { writeFileSync(path, original); }
};

/** Run one gated act over the port the node loads at the act, under one catalog and one bootstrap persona entry. */
const gated = (which: keyof typeof catalogs, entry: PersonaEntry = "kept") => withLarRoot(ROOT, () => withPersonaEntry(entry, async () => {
  await openTestCustody();
  const adapter = new DurableNodeFSStorageAdapter(storage), repo = new Repo({ storage: adapter, network: [] });
  try {
    let ran = 0;
    // The port loads at the act, inside the gated call: a fold that cannot be read refuses there, as the door's own call would.
    const code = await (async () => wardCosignGate(await loadNodeWardCosignPort(repo, catalogs[which], { group }), lower, async () => { ran += 1; }))()
      .then(() => null, (e: { reading?: string; message: string }) => e.reading ?? e.message);
    return { ran, code, repo };
  } finally { await repo.shutdown(); await adapter.close(); }
}));

test("CONTROL: the whole catalog lowers the one-device face on the unlock alone, and its intents plane takes no entry", async () => {
  const r = await gated("whole");
  expect(r).toMatchObject({ ran: 1, code: null });
  await withLarRoot(ROOT, async () => {
    await openTestCustody();
    const adapter = new DurableNodeFSStorageAdapter(storage), repo = new Repo({ storage: adapter, network: [] });
    try {
      const loaded = await loadIntentFace(repo, catalogs["whole"], { group });
      expect(loaded.projection.devices).toHaveLength(1);
      expect(intentEntryRecordsOfGroup(loaded.plane.doc(), group)).toHaveLength(0);
    } finally { await repo.shutdown(); await adapter.close(); }
  });
}, 240_000);

test("RED: a face whose intents plane cannot load still lowers on the unlock alone where its signed admission fold reads one device", async () => {
  expect(await gated("no-intents")).toMatchObject({ ran: 1, code: null });
}, 240_000);

test("CONTROL: a catalog with no persona row reads the fold through the bootstrap's entry and lowers on the unlock alone", async () => {
  expect(await gated("no-persona")).toMatchObject({ ran: 1, code: null });
}, 240_000);

test("RED: a fold that cannot be read (neither the catalog nor the bootstrap names a persona plane) refuses `ward-cosign-fold-unread` and runs nothing", async () => {
  expect(await gated("no-persona", "dropped")).toMatchObject({ ran: 0, code: "ward-cosign-fold-unread" });
}, 240_000);

test("RED: a bootstrap persona entry naming a doc with no signed log reads no fold, refuses `ward-cosign-fold-unread` and runs nothing", async () => {
  expect(await gated("no-persona", "unsigned")).toMatchObject({ ran: 0, code: "ward-cosign-fold-unread" });
}, 240_000);
