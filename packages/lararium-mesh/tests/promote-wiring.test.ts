/**
 * promote-wiring — the glue a vessel hands `promoteBoot`: the board and the stage read off the repo's documents, a watcher that calls
 * `arrive` when the board changes, and the fail-closed rule for a face that pins no board.
 *
 * Platform-blind: node and browser run this one module over their own stores. Every red pairs with a CONTROL.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { describe, expect, test } from "vitest";
import {
  EMPTY_KAPAE_LOCAL, EMPTY_LEDGER, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, kahuaStageDocUrl, ledgerCommit, makeIslandRepo,
  materializeSharedLarDoc, promoteBoardDocUrl, promoteDigest, signKahuaLift, signPromoteKapae, writeKahuaAct, writePromoteAct,
  type KapaeLocal, type LarDoc, type PromotionLedger,
} from "../src/index.js";
import { promoteWiring } from "../src/promote-wiring.js";

const GROUP = "face-group", GARDEN = "garden";
const RITE = { title: "rites/a", text: "exports.startup = function(){}", fields: { "module-type": "startup" } };
const D = promoteDigest(RITE);
const HAND = { kind: "hand", id: "hand-1" } as const;

async function world(opts: { boardPinned?: boolean } = {}) {
  const root = { key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(1)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(1)) };
  const repo = makeIslandRepo({ syncPort: new MessageChannel().port1 });
  const board = await materializeSharedLarDoc(repo, promoteBoardDocUrl(GROUP), "promote:board");
  const stage = await materializeSharedLarDoc(repo, kahuaStageDocUrl(GROUP), "kahua:stage");
  const lift = await signKahuaLift({ group: GROUP, epoch: 0, title: RITE.title, text: RITE.text, fields: { ...RITE.fields }, parent: null, origin: { seat: root.key, device: root.key, session: "s" }, taint: [], sources: [{ title: "d", revision: "r" }] }, root);
  stage.change((d: LarDoc) => writeKahuaAct(d, lift));
  const st = {
    ledger: [["daemon", RITE], [GARDEN, RITE]].reduce((l, [wiki, item]) => ledgerCommit(l as PromotionLedger, { wiki: wiki as string, digest: promoteDigest(item as typeof RITE), item: item as typeof RITE, revision: "r1" }, HAND), EMPTY_LEDGER) as PromotionLedger,
    local: EMPTY_KAPAE_LOCAL as KapaeLocal, cas: new Map<string, Uint8Array>(), restarts: [] as string[],
  };
  const wiring = promoteWiring({
    repo, group: GROUP, boardUrl: opts.boardPinned === false ? null : promoteBoardDocUrl(GROUP), stageUrl: kahuaStageDocUrl(GROUP),
    foldFace: () => ({ group: GROUP, grant: (k: string) => k === root.key }),
    boardFace: () => ({ group: GROUP, grant: (k: string) => k === root.key, device: () => false }),
    stores: { ledger: { read: async () => st.ledger, write: async (l) => { st.ledger = l; } }, local: { read: async () => st.local, write: async (l) => { st.local = l; } } },
    cas: { put: (d, b) => { st.cas.set(d, b); }, pin: () => {} },
    wikiItems: async () => [],
    restart: async (wiki) => { st.restarts.push(wiki); },
  });
  const raise = (wiki: string) => signPromoteKapae({ group: GROUP, epoch: 0, wiki, digest: D, raised: true, parents: [] }, root);
  return { wiring, st, board, raise, stage };
}

describe("the daemon wiki reads the kahua stage, other wikis their own items", () => {
  test("RED: promotedFor(daemon) finds the rite on the stage and loads it; a wiki with no items of its own loads nothing though its row exists; CONTROL: the stage read stays the fold's (a plain tiddler written to the stage doc counts for nothing)", async () => {
    const w = await world();
    expect(await w.wiring.boot.promotedFor("daemon")).toEqual([D]);
    expect([...w.st.cas.keys()]).toEqual([D]);
    w.stage.change((d: LarDoc) => { (d.tiddlers as Record<string, unknown>)["rites/forged"] = { fields: { title: "rites/forged", text: "evil" } }; });
    expect(await w.wiring.boot.promotedFor("daemon")).toEqual([D]);
    expect((await w.wiring.boot.promotedFor(GARDEN)).length).toBe(1);
  });

  test("RED: a face that pins no board loads NO promoted code and names the fault; CONTROL: the pinned face loads", async () => {
    const w = await world({ boardPinned: false });
    expect(await w.wiring.boot.promotedFor("daemon")).toEqual([]);
    expect(w.st.cas.size).toBe(0);
  });
});

describe("the board watcher", () => {
  test("RED: a raise written to the board doc restarts the wiki it names once, through the watcher; CONTROL: a raise over a wiki that loaded nothing restarts nothing", async () => {
    const w = await world();
    await w.wiring.boot.promotedFor("daemon");
    const stop = w.wiring.watch();
    const restarted = new Promise<void>((resolve) => { const t = setInterval(() => { if (w.st.restarts.length) { clearInterval(t); resolve(); } }, 5); });
    const other = await w.raise("not-loaded");
    w.board.change((d: LarDoc) => writePromoteAct(d, other));
    await w.wiring.settle();
    expect(w.st.restarts).toEqual([]);
    const act = await w.raise("daemon");
    w.board.change((d: LarDoc) => writePromoteAct(d, act));
    await restarted;
    await w.wiring.settle();
    expect(w.st.restarts).toEqual(["daemon"]);
    stop();
  });
});
