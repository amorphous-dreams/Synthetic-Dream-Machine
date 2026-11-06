/**
 * promote-board — the ONE face-private board that carries promote-prepare and kāpae acts, keyed by (wiki, digest).
 *
 * The address derives from the face and equals no wiki's doc and not the kahua stage. A device atom signs a prepare; the face's grant
 * signs a raise or a lower. The fold reuses the edge causal-heads rule: remove-wins, no clock. A kāpae over W1 leaves W2 alone.
 * Every red pairs with a CONTROL. Meme: lar:///ha.ka.ba/lares/api/pono/kapae
 */
import { describe, expect, test } from "vitest";
import type { LarDoc } from "../src/base-doc.js";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "../src/ed25519-door.js";
import { kahuaActRecords, kahuaStageDocUrl, readKahuaAct, signKahuaLift } from "../src/kahua-stage.js";
import {
  promoteActCid, promoteActRecords, promoteBoardDocUrl, promoteEdgeKey, readPromoteAct, readPromoteBoard, signPromoteKapae, signPromotePrepare, writePromoteAct,
} from "../src/promote-board.js";

const GROUP = "face-group", W1 = "lar:///ha.ka.ba/wikis/field-notes", W2 = "lar:///ha.ka.ba/wikis/garden";
const D = "d".repeat(64);
const signer = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(n)) });

async function fixture() {
  const root = await signer(1), atom = await signer(2), outsider = await signer(3);
  const face = { group: GROUP, grant: (k: string) => k === root.key, device: (k: string) => k === atom.key };
  const kapae = (wiki: string, digest: string, raised: boolean, parents: string[], by = root) => signPromoteKapae({ group: GROUP, epoch: 0, wiki, digest, raised, parents }, by);
  const prepare = (wiki: string, digest: string, why = "opens the field-notes macro", by = atom) =>
    signPromotePrepare({ group: GROUP, epoch: 0, wiki, digest, title: "rites/a", classes: ["module-type"], why }, by);
  return { root, atom, outsider, face, kapae, prepare, read: (acts: unknown[]) => readPromoteBoard(acts, face) };
}

describe("the board address", () => {
  test("RED: the board url derives from the group alone, differs per group and from the kahua stage; CONTROL: the same group derives the same url", () => {
    expect(promoteBoardDocUrl(GROUP)).toBe(promoteBoardDocUrl(GROUP));
    expect(promoteBoardDocUrl(GROUP)).not.toBe(promoteBoardDocUrl("other-group"));
    expect(promoteBoardDocUrl(GROUP)).not.toBe(kahuaStageDocUrl(GROUP));
  });

  test("RED: a kāpae act written to the board never appears in the kahua stage's act records, and a kāpae body on the stage refuses `shape`; CONTROL: a lift on the stage still reads", async () => {
    const { kapae, root, face } = await fixture();
    const board = { tiddlers: {} } as LarDoc, stage = { tiddlers: {} } as LarDoc;
    writePromoteAct(board, await kapae(W1, D, true, []));
    expect(promoteActRecords(board, GROUP)).toHaveLength(1);
    expect(kahuaActRecords(stage, GROUP)).toEqual([]);
    expect(promoteActRecords(stage, GROUP)).toEqual([]);
    const lift = await signKahuaLift({ group: GROUP, epoch: 0, title: "t", text: "x", fields: {}, parent: null, origin: { seat: root.key, device: root.key, session: "s" }, taint: [], sources: [{ title: "d", revision: "r" }] }, root);
    expect(readKahuaAct(lift, { group: GROUP, grant: face.grant }).ok).toBe(true);
    const forged = { ...lift, body: { ...lift.body, act: "kapae", digest: D, raised: true, parents: [] } };
    expect(readKahuaAct(forged, { group: GROUP, grant: face.grant })).toMatchObject({ ok: false });
  });

  test("RED: a plain tiddler written into the board doc reads as nothing; CONTROL: a signed act reads", async () => {
    const { kapae, read } = await fixture();
    const board = { tiddlers: { "lar:///x/plain": { fields: { title: "x", text: "y" } } } } as unknown as LarDoc;
    expect(read(promoteActRecords(board, GROUP)).edges().size).toBe(0);
    writePromoteAct(board, await kapae(W1, D, true, []));
    expect(read(promoteActRecords(board, GROUP)).edges().size).toBe(1);
  });
});

describe("the kāpae over (wiki, digest)", () => {
  test("RED: a raise over W1 shadows (W1, D) and leaves W2's promotion of D running; CONTROL: an edge no act names reads absent", async () => {
    const { kapae, read } = await fixture();
    const raise = await kapae(W1, D, true, []);
    const board = read([raise]);
    expect(board.kapae(W1, D)).toBe("held");
    expect(board.kapae(W2, D)).toBeUndefined();
    expect([...board.shadowed(W1)]).toEqual([D]);
    expect(board.shadowed(W2).size).toBe(0);
    expect([...board.edges()]).toEqual([promoteEdgeKey(W1, D)]);
  });

  test("RED: a lower citing every raise lifts; a racing lower leaves the shadow UP in either arrival order; CONTROL: a later act citing both heads settles it", async () => {
    const { kapae, read } = await fixture();
    const raise = await kapae(W1, D, true, []);
    const lower = await kapae(W1, D, false, [promoteActCid(raise)]);
    expect(read([raise, lower]).kapae(W1, D)).toBe("withdrawn");
    expect(read([lower, raise]).shadowed(W1).size).toBe(0);
    expect(read([raise, lower]).kapaeHeads(W1, D)).toEqual([promoteActCid(lower)]);
    const racing = await kapae(W1, D, false, []);
    for (const acts of [[raise, racing], [racing, raise]]) {
      expect(read(acts).kapae(W1, D)).toBe("unsettled");
      expect(read(acts).shadowed(W1).has(D)).toBe(true);
    }
    expect(read([raise, racing, await kapae(W1, D, false, [promoteActCid(raise), promoteActCid(racing)])]).shadowed(W1).size).toBe(0);
  });

  test("RED: a lower citing a parent the reader lacks proves no lift; CONTROL: with its parent present it lifts", async () => {
    const { kapae, read } = await fixture();
    const raise = await kapae(W1, D, true, []);
    const lower = await kapae(W1, D, false, [promoteActCid(raise)]);
    expect(read([lower]).shadowed(W1).has(D)).toBe(true);
    expect(read([raise, lower]).shadowed(W1).has(D)).toBe(false);
  });

  test("RED: a lower by a device atom refuses `grant` (a raise by one reads: it only adds a brake), a prepare by the root refuses `device`, an outsider refuses both; CONTROL: each rightful hand reads", async () => {
    const { kapae, prepare, atom, root, outsider, face } = await fixture();
    expect(readPromoteAct(await kapae(W1, D, false, [], atom), face)).toEqual({ ok: false, refusal: "grant" });
    expect(readPromoteAct(await kapae(W1, D, true, [], atom), face).ok).toBe(true);
    expect(readPromoteAct(await kapae(W1, D, true, [], outsider), face)).toEqual({ ok: false, refusal: "grant" });
    expect(readPromoteAct(await prepare(W1, D, "why", root), face)).toEqual({ ok: false, refusal: "device" });
    expect(readPromoteAct(await prepare(W1, D, "why", outsider), face)).toEqual({ ok: false, refusal: "device" });
    expect(readPromoteAct(await kapae(W1, D, true, []), face).ok).toBe(true);
    expect(readPromoteAct(await prepare(W1, D), face).ok).toBe(true);
  });

  test("RED: a malformed wiki, digest or blank reason refuses `shape` at the signer; CONTROL: a well-formed act signs", async () => {
    const { kapae, prepare } = await fixture();
    await expect(kapae("", D, true, [])).rejects.toThrow(/shape/);
    await expect(kapae(W1, "nope", true, [])).rejects.toThrow(/shape/);
    await expect(prepare(W1, D, "  ")).rejects.toThrow(/shape/);
    await expect(kapae(W1, D, true, [])).resolves.toBeTruthy();
  });
});

describe("the prepared queue", () => {
  test("RED: a device atom's prepare rides the board keyed by wiki with its reason and seat key; CONTROL: another wiki's queue stays empty", async () => {
    const { prepare, read, atom } = await fixture();
    const board = read([await prepare(W1, D, "opens the field-notes macro")]);
    expect(board.prepared(W1)).toEqual([{ wiki: W1, digest: D, title: "rites/a", classes: ["module-type"], why: "opens the field-notes macro", seat: atom.key }]);
    expect(board.prepared(W2)).toEqual([]);
    expect(read([await prepare(W1, D, "again"), await prepare(W1, D, "once more")]).prepared(W1)).toHaveLength(1);
  });
});

describe("the flagged queue (a kapae the seat asks for)", () => {
  test("RED: a prepare carrying intent `kapae` lands in `flagged(wiki)` and not in `prepared(wiki)`; CONTROL: a promote prepare stays in `prepared`", async () => {
    const { read, atom } = await fixture();
    const flag = await signPromotePrepare({ group: GROUP, epoch: 0, wiki: W1, digest: D, title: "rites/a", classes: ["module-type"], why: "the macro leaks the field notes", intent: "kapae" }, atom);
    const board = read([flag, await signPromotePrepare({ group: GROUP, epoch: 0, wiki: W1, digest: "e".repeat(64), title: "rites/b", classes: [], why: "x" }, atom)]);
    expect(board.flagged(W1)).toEqual([{ wiki: W1, digest: D, title: "rites/a", classes: ["module-type"], why: "the macro leaks the field notes", seat: atom.key }]);
    expect(board.prepared(W1).map((p) => p.digest)).toEqual(["e".repeat(64)]);
    expect(board.flagged(W2)).toEqual([]);
  });
});
