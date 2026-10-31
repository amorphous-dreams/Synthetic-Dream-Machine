import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildIntent, buildOutcome, countPlaneEntries, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed,
  faceIntentVerbs, intentId, mintPersonaInception, signPersonaAct, actCid, writeIntentEntry, storedLarRecord,
  personaScopedBagIds, wikiSlotUri, type DocHandle, type LarDoc } from "@lararium/mesh";
import { makeFaceIntentDoor } from "@lararium/keyhive";
import { LarDiskProjector } from "../src/disk-projector.js";
import { TW5Engine } from "../../lararium-tw5/src/tw5-vm.js";
import { TW5_CORE_DIR, TW5_CORE_SCRIPT_FILENAME } from "../../lararium-tw5/src/generated-tw5-version.js";

let engine: TW5Engine;
beforeAll(async () => { engine = new TW5Engine(); await engine.boot(new Uint8Array(readFileSync(join(TW5_CORE_DIR, TW5_CORE_SCRIPT_FILENAME)))); }, 60_000);

const signer = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(n)) });
const plane = () => {
  const doc = { tiddlers: {} } as LarDoc, listeners = new Set<() => void>();
  let writes = 0;
  const handle = { doc: () => doc, change: (edit: (draft: LarDoc) => void) => { writes++; edit(doc); for (const listener of listeners) listener(); },
    on: (_event: string, listener: () => void) => listeners.add(listener), off: (_event: string, listener: () => void) => listeners.delete(listener) } as unknown as DocHandle<LarDoc>;
  return { doc, handle, writes: () => writes };
};

let larRoot = "";
afterEach(() => { if (larRoot) { rmSync(larRoot, { recursive: true, force: true }); larRoot = ""; } });

describe("intent rubric witness", () => {
  test("RED: a seeded duplicate reads one before zero traffic can count; CONTROL: a real issue increments the plane", async () => {
    const group = "synthetic-face", issuer = await signer(1), executor = await signer(2), shared = plane(), verbs = faceIntentVerbs();
    const issued = await buildIntent({ group, signer: issuer, verb: "MOVE", args: { title: "lar:///test/carrier", "from-bag": "source", "to-bag": "target", "change-id": "one" },
      nonce: "", audience: { mode: "pinned", atom: executor.key }, verbs });
    const id = intentId(issued.body as unknown as { issuer: string; verb: string; args: unknown; nonce: string });
    const first = await buildOutcome({ group, signer: executor, cause: id, result: { status: "done", n: 1 } });
    const second = await buildOutcome({ group, signer: executor, cause: id, result: { status: "done", n: 2 } });
    shared.handle.change((doc) => { writeIntentEntry(doc, issued); writeIntentEntry(doc, first); writeIntentEntry(doc, second); });
    expect(countPlaneEntries(shared.doc, group)).toEqual({ intents: 1, outcomes: 2, duplicates: 1, other: 0 });
    expect(shared.writes()).toBe(1);
  });

  test("RED: one hundred wiki text replacements and one save write zero face-plane entries; CONTROL: issue writes one and the wiki mirror writes a file", async () => {
    larRoot = mkdtempSync(join(tmpdir(), "lar-intent-rubric-"));
    const group = "synthetic-face", shared = plane(), wikiDoc = { tiddlers: {} } as LarDoc;
    const title = "lar:///test/carrier";
    const edited = { title, text: "" };
    for (let n = 0; n < 100; n++) edited.text = `edit ${n}`;
    wikiDoc.tiddlers[title] = storedLarRecord(title, { text: edited.text }, "wiki");
    const intentsBag = personaScopedBagIds(group).intents, wikiBag = wikiSlotUri("synthetic", "working");
    const tw = engine.$tw;
    for (const [bag, name] of [[intentsBag, "intents-carrier"], [wikiBag, "wiki-carrier"]] as const) {
      tw.wiki.addTiddler(new tw.Tiddler({ title: `lar:///ha.ka.ba/t/daemon/${name}`, text: edited.text, "$origin-bag": bag }));
    }
    const projector = new LarDiskProjector({ mirrors: [
      { bagId: intentsBag, mirrorRoot: join(larRoot, "intents") },
      { bagId: wikiBag, mirrorRoot: join(larRoot, "wiki") },
    ], carrierFileFn: async (uri) => ({ ext: ".mem", body: `title: ${uri}\n\n${edited.text}`, defaultRelPath: `${uri.slice("lar:///ha.ka.ba/t/daemon/".length)}.mem` }) });
    const stop = projector.start(engine);
    await projector.idle();
    await stop();
    expect(shared.writes()).toBe(0);
    expect(countPlaneEntries(shared.doc, group)).toEqual({ intents: 0, outcomes: 0, duplicates: 0, other: 0 });
    expect(existsSync(join(larRoot, "intents"))).toBe(false);
    expect(existsSync(join(larRoot, "wiki", "ha.ka.ba", "t", "daemon", "wiki-carrier.mem"))).toBe(true);
    const issuer = await signer(1), executor = await signer(2);
    const issue = await buildIntent({ group, signer: issuer, verb: "MOVE", args: { title, "from-bag": "source", "to-bag": "target", "change-id": "one" },
      nonce: "", audience: { mode: "pinned", atom: executor.key }, verbs: faceIntentVerbs() });
    shared.handle.change((doc) => writeIntentEntry(doc, issue));
    expect(shared.writes()).toBe(1);
    expect(countPlaneEntries(shared.doc, group).intents).toBe(1);
  });

  test("POSITIVE: one addressed cross-device MOVE runs through the declared effect and a second heed writes nothing", async () => {
    const group = "synthetic-face", root = await signer(9), issuer = await signer(1), executor = await signer(2), shared = plane();
    const inception = mintPersonaInception(`0x${root.key}`, "recovery");
    const records = [] as Awaited<ReturnType<typeof signPersonaAct>>[];
    for (const [act, fields] of [["founding", { personaKelPrefix: inception.prefix, rootCommitment: "root" }],
      ["admission", { deviceKey: issuer.key }], ["admission", { deviceKey: executor.key }]] as const) {
      const last = records.at(-1);
      records.push(await signPersonaAct(last ? { seq: last.body.seq, cid: actCid(last.body) } : null, { group, act, epoch: 0, fields }, root));
    }
    const effect = vi.fn(async () => ({ moved: 1 }));
    const door = makeFaceIntentDoor({ group, atom: executor, plane: shared.handle, personaRecords: () => records, kelChain: () => [inception],
      standing: () => "stands", verbs: faceIntentVerbs(), runDeclaredEffect: (verb, args) => { expect(verb).toBe("MOVE"); expect(args).toMatchObject({ "change-id": "move-one" }); return effect(); }, log: () => {} });
    const issue = await buildIntent({ group, signer: issuer, verb: "MOVE", args: { title: "lar:///test/carrier", "from-bag": "source", "to-bag": "target", "change-id": "move-one" },
      nonce: "", audience: { mode: "pinned", atom: executor.key }, verbs: faceIntentVerbs() });
    shared.handle.change((doc) => writeIntentEntry(doc, issue));
    await door.heed();
    expect(countPlaneEntries(shared.doc, group)).toMatchObject({ intents: 1, outcomes: 1, duplicates: 0 });
    const writes = shared.writes();
    await door.heed();
    expect(shared.writes()).toBe(writes);
    expect(effect).toHaveBeenCalledTimes(1);
  });
});
