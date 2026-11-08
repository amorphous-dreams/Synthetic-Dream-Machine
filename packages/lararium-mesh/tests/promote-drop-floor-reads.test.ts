/**
 * promote-drop-floor-reads — the blind read of the drop floor (road `L23`, PR #201 at 9d528aa52) measured each finding before its cure:
 * F1 a drop on one device braked another device's live row and a ward row copied across ledgers stood; F2 a far-seq drop wedged the
 * ledger; F3 a drop lifted when its signer left the device set; F4 a delete on the board lifted a drop; F5 one failed board write made
 * every later verb throw after its ledger write; F6 boot never landed an owed tombstone. Each red pairs with a CONTROL.
 *
 * The reds run the production door (`promotions`) and board door (`promoteBoardDoor`); F4 runs a real Automerge board.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness#/the-ward
 */
import { describe, expect, test } from "vitest";
import * as A from "@automerge/automerge";
import * as mesh from "../src/index.js";
import {
  EMPTY_KAPAE_LOCAL, EMPTY_LEDGER, decodeLedger, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, encodeLedger, promoteActRecords,
  promoteDigest, readPromoteBoard, signPromoteDrop, writePromoteAct, type KapaeLocal, type LarDoc, type PromoteWho, type PromotionLedger,
} from "../src/index.js";
import { promotions, type PromoteItem, type PromotionPorts } from "../src/promote-door.js";
import { promoteBoardDoor } from "../src/promote-board-door.js";

const GROUP = "face-group", USER = "lar:///ha.ka.ba/wikis/field-notes";
const HAND: PromoteWho = { kind: "hand", id: "hand-1" };
const RITE = { title: "rites/daemon", text: "exports.startup = function(){}", fields: { "module-type": "startup" } };
const D = promoteDigest(RITE);
const itemOf = (i: typeof RITE): PromoteItem => ({ ...i, revision: "r1", origin: { seat: "s", device: "d", session: "s-1" } });
const seed = (n: number) => new Uint8Array(32).fill(n);
type Signer = { key: string; sign: (b: Uint8Array) => Promise<string> };
const signer = async (n: number): Promise<Signer> => ({ key: await ed25519VerifyingKeyFromSeed(seed(n)), sign: ed25519SignerFromSeed(seed(n)) });

/** The face's board, shared by every device: plain records, or a real Automerge document (F4). */
function memoryBoard() {
  const acts: unknown[] = [];
  return { records: async () => acts, land: async (act: unknown) => { acts.push(act); }, acts };
}
function automergeBoard() {
  let doc = A.from<LarDoc>({ tiddlers: {} } as unknown as LarDoc);
  // The history read the cure adds; absent on the base, so the base reads the current map alone.
  const history = (mesh as unknown as { promoteDropHistory?: (d: unknown, g: string) => unknown[] }).promoteDropHistory;
  return {
    records: async () => [...promoteActRecords(doc, GROUP), ...(history ? history(doc, GROUP) : [])],
    land: async (act: unknown) => { doc = A.change(doc, (d) => writePromoteAct(d, act as Parameters<typeof writePromoteAct>[1])); },
    /** A writer of the board's storage deletes every record: an ordinary change, synced like any other. */
    wipe: () => { doc = A.change(doc, (d) => { for (const k of Object.keys(d.tiddlers)) delete d.tiddlers[k]; }); },
  };
}

async function device(board: { records(): Promise<readonly unknown[]>; land(act: unknown): Promise<void> }, atom: Signer, root: Signer, enrolled: Set<string>) {
  const face = { group: GROUP, grant: (k: string) => k === root.key, device: (k: string) => enrolled.has(k) };
  const state = { ledger: EMPTY_LEDGER as PromotionLedger, local: EMPTY_KAPAE_LOCAL as KapaeLocal, landFails: false };
  const items = new Map<string, PromoteItem[]>([["daemon", [itemOf(RITE)]], [USER, [itemOf(RITE)]]]);
  const boardDoor = promoteBoardDoor({
    group: GROUP, face, atom, epoch: () => 0, rootSigner: async () => root,
    board: { records: board.records, land: async (act) => { if (state.landFails) throw new Error("land-failed"); await board.land(act); } },
    projection: () => ({ planes: {} }), cosign: () => { throw new Error("no co-sign rides these reds"); },
  });
  const ports = (wiki: string): PromotionPorts => ({
    wiki, owner: atom.key,
    // The ledger rests encoded, as a custody row does: a value the codec refuses never reads back.
    ledger: { read: async () => state.ledger, write: async (l) => { state.ledger = decodeLedger(encodeLedger(l)); } },
    local: { read: async () => state.local, write: async (l) => { state.local = l; } },
    items: async () => items.get(wiki) ?? [],
    board: async () => readPromoteBoard(await board.records(), { ...face, ward: { accepts: () => true } }),
    cas: { put: () => {}, pin: () => {} }, who: HAND, wardSigner: async () => root, face: { grant: face.grant },
    landDrops: (t) => boardDoor.drop(t),
  } as PromotionPorts);
  return { state, ports, door: (wiki: string) => promotions(ports(wiki)) };
}

describe("F1: a drop names only its own device's row", () => {
  test("RED: device A drops its row; device B's own live row at the same (wiki, digest, seq) keeps running; a ward row copied from A's ledger into B's voids. CONTROL: A's own replay still voids `ward-dropped`", async () => {
    const root = await signer(1), a = await signer(2), b = await signer(3), board = memoryBoard();
    const enrolled = new Set([a.key, b.key]);
    const A1 = await device(board, a, root, enrolled), B1 = await device(board, b, root, enrolled);
    const aRow = await A1.door("daemon").promote({ digest: D });
    const bRow = await B1.door("daemon").promote({ digest: D });
    expect([aRow.seq, bRow.seq]).toEqual([1, 1]);
    await A1.door("daemon").unpromote({ digest: D });
    expect((await B1.door("daemon").boot()).pluginCids).toEqual([D]);
    // A ward row lifted out of A's ledger into B's (B never committed it) stands nowhere but A.
    const B2 = await device(board, b, root, enrolled);
    B2.state.ledger = { seq: 1, rows: [aRow] };
    expect((await B2.door("daemon").boot()).voided).toEqual([{ digest: D, reason: "ward-unsigned" }]);
    A1.state.ledger = { seq: A1.state.ledger.seq, rows: [aRow] };
    expect((await A1.door("daemon").boot()).voided).toEqual([{ digest: D, reason: "ward-dropped" }]);
  });
});

describe("F2: a far-seq drop wedges nothing", () => {
  test("RED: the device's own drop at MAX_SAFE_INTEGER (another digest, and this one) leaves the next commit at a small seq and the ledger readable; the codec refuses a seq past safe. CONTROL: the commit runs", async () => {
    const root = await signer(1), a = await signer(2), board = memoryBoard();
    const A1 = await device(board, a, root, new Set([a.key]));
    await A1.door(USER).promote({ digest: D });
    board.acts.push(await signPromoteDrop({ group: GROUP, epoch: 0, wiki: "kahua", digest: "f".repeat(64), seq: Number.MAX_SAFE_INTEGER }, a));
    board.acts.push(await signPromoteDrop({ group: GROUP, epoch: 0, wiki: "daemon", digest: D, seq: Number.MAX_SAFE_INTEGER }, a));
    const row = await A1.door("daemon").promote({ digest: D });
    expect(row.seq).toBe(2);
    expect((await A1.door("daemon").boot()).pluginCids).toEqual([D]);
    expect((await A1.door(USER).boot()).pluginCids).toEqual([D]);
    expect(() => encodeLedger({ seq: 2 ** 53, rows: [] })).toThrow(/ledger-malformed/);
  });

  test("RED: a commit whose next seq a drop of the same (wiki, digest) names steps past it alone. CONTROL: a drop of another digest at that seq moves nothing", async () => {
    const root = await signer(1), a = await signer(2), board = memoryBoard();
    const A1 = await device(board, a, root, new Set([a.key]));
    board.acts.push(await signPromoteDrop({ group: GROUP, epoch: 0, wiki: "daemon", digest: "e".repeat(64), seq: 1 }, a));
    board.acts.push(await signPromoteDrop({ group: GROUP, epoch: 0, wiki: "daemon", digest: D, seq: 2 }, a));
    // seq 1 stays free for D (another digest's drop names it); a reset ledger at seq 1 steps past D's drop at 2.
    expect((await A1.door("daemon").promote({ digest: D })).seq).toBe(1);
    A1.state.ledger = { seq: 1, rows: [] };
    expect((await A1.door("daemon").promote({ digest: D })).seq).toBe(3);
  });
});

describe("F3: a drop outlives its signer's enrolment", () => {
  test("RED: the device that signed the drop leaves the face's device set; a stripped tombstone and the old row back still void `ward-dropped`. CONTROL: a stranger's drop floors nothing here", async () => {
    const root = await signer(1), a = await signer(2), stranger = await signer(9), board = memoryBoard();
    const enrolled = new Set([a.key]);
    const A1 = await device(board, a, root, enrolled);
    const old = await A1.door("daemon").promote({ digest: D });
    await A1.door("daemon").unpromote({ digest: D });
    enrolled.clear();
    A1.state.ledger = { seq: A1.state.ledger.seq, rows: [old] };
    expect((await A1.door("daemon").boot()).voided).toEqual([{ digest: D, reason: "ward-dropped" }]);
    // CONTROL: a stranger's drop naming this device's live row brakes nothing here.
    const other = memoryBoard(), S = await device(other, a, root, new Set([a.key]));
    const row = await S.door("daemon").promote({ digest: D });
    other.acts.push(await signPromoteDrop({ group: GROUP, epoch: 0, wiki: "daemon", digest: D, seq: row.seq }, stranger));
    expect((await S.door("daemon").boot()).pluginCids).toEqual([D]);
  });
});

describe("F4: a delete on the board lifts no drop", () => {
  test("RED: the board's storage writer deletes the drop record and a custody write strips the tombstone; the drop read from the board's history keeps the row void. CONTROL: an undeleted board voids the same way", async () => {
    const root = await signer(1), a = await signer(2), board = automergeBoard();
    const A1 = await device(board, a, root, new Set([a.key]));
    const old = await A1.door("daemon").promote({ digest: D });
    await A1.door("daemon").unpromote({ digest: D });
    A1.state.ledger = { seq: A1.state.ledger.seq, rows: [old] };
    expect((await A1.door("daemon").boot()).voided).toEqual([{ digest: D, reason: "ward-dropped" }]);
    board.wipe();
    expect((await A1.door("daemon").boot()).voided).toEqual([{ digest: D, reason: "ward-dropped" }]);
  });
});

describe("F5 and F6: an owed floor never blocks an unrelated verb, and boot lands it", () => {
  test("RED: a board write fails during a drop (the drop refuses by name after its ledger write); a later user-wiki commit lands without throwing, and boot lands the owed drop. CONTROL: the drop's own verb still refused `promote-floor-unlanded`", async () => {
    const root = await signer(1), a = await signer(2), board = memoryBoard();
    const A1 = await device(board, a, root, new Set([a.key]));
    const old = await A1.door("daemon").promote({ digest: D });
    A1.state.landFails = true;
    await expect(A1.door("daemon").unpromote({ digest: D })).rejects.toMatchObject({ code: "promote-floor-unlanded" });
    expect(A1.state.ledger.dropped).toEqual([{ wiki: "daemon", digest: D, seq: old.seq }]);
    await expect(A1.door(USER).promote({ digest: D })).resolves.toMatchObject({ wiki: USER });
    A1.state.landFails = false;
    const booted = await A1.door("daemon").boot() as { floorLanded?: Promise<unknown> };
    await booted.floorLanded;
    expect(readPromoteBoard(board.acts, { group: GROUP, grant: () => false, device: () => true, ward: { accepts: () => true } }).droppedBy?.(a.key) ?? new Set())
      .toEqual(new Set([`daemon\n${D}\n${old.seq}`]));
  });
});

describe("F4 re-read: an overwrite lifts no drop, and the history read stays bounded (R1, R2)", () => {
  const history = (doc: unknown) => (mesh as unknown as { promoteDropHistory: (d: unknown, g: string) => unknown[] }).promoteDropHistory(doc, GROUP);
  const countedBy = (records: readonly unknown[], owner: string) =>
    readPromoteBoard(records, { group: GROUP, grant: () => false, device: () => false, ward: { accepts: () => true } }).droppedBy(owner);

  test("RED: on the repo's own board handle, a put over a drop's key, an edit of its text, and an overwrite followed by a delete each keep the drop through promoteBoardRecords. CONTROL: an honest second drop stands beside the first", async () => {
    const a = await signer(2);
    const repo = mesh.makeIslandRepo({ syncPort: new MessageChannel().port1 });
    const keyOf = (act: Parameters<typeof writePromoteAct>[1]) => mesh.promoteActKey(GROUP, mesh.promoteActCid(act));
    for (const lift of ["overwrite", "text-edit", "overwrite-then-delete"] as const) {
      const handle = await mesh.materializeSharedLarDoc(repo, mesh.promoteBoardDocUrl(`${GROUP}-${lift}`), "promote:board");
      const drop = await signPromoteDrop({ group: GROUP, epoch: 0, wiki: "daemon", digest: D, seq: 1 }, a);
      const honest = await signPromoteDrop({ group: GROUP, epoch: 0, wiki: "daemon", digest: D, seq: 2 }, a);
      handle.change((d: LarDoc) => writePromoteAct(d, drop));
      handle.change((d: LarDoc) => writePromoteAct(d, honest));
      const key = keyOf(drop);
      if (lift === "text-edit") handle.change((d: LarDoc) => { (d.tiddlers as Record<string, { fields: Record<string, unknown> }>)[key]!.fields["text"] = "{}"; });
      else handle.change((d: LarDoc) => { (d.tiddlers as Record<string, unknown>)[key] = { fields: { title: key, text: "{}" } }; });
      if (lift === "overwrite-then-delete") handle.change((d: LarDoc) => { delete (d.tiddlers as Record<string, unknown>)[key]; });
      const records = mesh.promoteBoardRecords(handle.doc() as LarDoc, GROUP);
      expect([...countedBy(records, a.key)], lift).toEqual([`daemon\n${D}\n1`, `daemon\n${D}\n2`]);
    }
  });

  test("RED: 40 drops under 30 one-key deletes hand back each lifted drop once, and none the current map still holds. CONTROL: the deleted drops all still count", async () => {
    const a = await signer(2);
    let doc = A.from<LarDoc>({ tiddlers: {} } as unknown as LarDoc);
    const acts = await Promise.all(Array.from({ length: 40 }, (_, i) => signPromoteDrop({ group: GROUP, epoch: 0, wiki: "daemon", digest: D, seq: i + 1 }, a)));
    for (const act of acts) doc = A.change(doc, (d) => writePromoteAct(d, act));
    for (let i = 0; i < 30; i++) doc = A.change(doc, (d) => { delete d.tiddlers[mesh.promoteActKey(GROUP, mesh.promoteActCid(acts[i]!))]; });
    const lifted = history(doc);
    expect(lifted.length).toBe(30);
    expect(countedBy(mesh.promoteBoardRecords(doc, GROUP), a.key).size).toBe(40);
  });
});
