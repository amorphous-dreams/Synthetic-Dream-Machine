/**
 * promote-drop-floor — a dropped daemon or kahua promotion stays dropped against a writer of the face's custody (road `L23`,
 * seat-harness#/the-ward). The ledger rests in one device-local custody row, so a writer holding unlocked custody can edit its
 * plaintext: strip the tombstone a drop left and put the old ward-signed row back. The door therefore lands every bound drop on the
 * face-private board as well, where no custody write reaches, and boot voids a bound row that either the board or the ledger names.
 *
 * The reds run the production door (`promotions`) and the production board door (`promoteBoardDoor`) on memory ports: the ledger and
 * the kāpae cache stand for the custody rows, `acts` for the board's records. Every red pairs with a CONTROL.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness#/the-ward
 */
import { describe, expect, test } from "vitest";
import {
  EMPTY_KAPAE_LOCAL, EMPTY_LEDGER, decodeLedger, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, encodeLedger, promoteDigest,
  readPromoteBoard, type KapaeLocal, type PromoteWho, type PromotionLedger,
} from "../src/index.js";
import { promotions, type PromoteItem, type PromotionPorts } from "../src/promote-door.js";
import { promoteBoardDoor } from "../src/promote-board-door.js";

const GROUP = "face-group", USER = "lar:///ha.ka.ba/wikis/field-notes";
const HAND: PromoteWho = { kind: "hand", id: "hand-1" };
const RITE = { title: "rites/daemon", text: "exports.startup = function(){}", fields: { "module-type": "startup" } };
const RITE2 = { ...RITE, text: "exports.startup = function(){ return 2; }" };
const D = promoteDigest(RITE), D2 = promoteDigest(RITE2);
const itemOf = (i: typeof RITE): PromoteItem => ({ ...i, revision: "r1", origin: { seat: "s", device: "d", session: "s-1" } });
const seed = (n: number) => new Uint8Array(32).fill(n);

async function world() {
  const root = { key: await ed25519VerifyingKeyFromSeed(seed(1)), sign: ed25519SignerFromSeed(seed(1)) };
  const atom = { key: await ed25519VerifyingKeyFromSeed(seed(2)), sign: ed25519SignerFromSeed(seed(2)) };
  const face = { group: GROUP, grant: (k: string) => k === root.key, device: (k: string) => k === atom.key };
  const state = {
    ledger: EMPTY_LEDGER as PromotionLedger, local: EMPTY_KAPAE_LOCAL as KapaeLocal, items: new Map<string, PromoteItem[]>(),
    acts: [] as unknown[], boardReadable: true,
  };
  const boardDoor = promoteBoardDoor({
    group: GROUP, face, atom, epoch: () => 0, rootSigner: async () => root,
    board: { records: async () => state.acts, land: async (act) => { state.acts.push(act); } },
    projection: () => ({ planes: {} }), cosign: () => { throw new Error("no co-sign rides these reds"); },
  });
  const ports = (wiki: string): PromotionPorts => ({
    wiki,
    ledger: { read: async () => state.ledger, write: async (l) => { state.ledger = l; } },
    local: { read: async () => state.local, write: async (l) => { state.local = l; } },
    items: async () => state.items.get(wiki) ?? [],
    board: async () => { if (!state.boardReadable) throw new Error("board-unreadable"); return readPromoteBoard(state.acts, { ...face, ward: { accepts: () => true } }); },
    cas: { put: () => {}, pin: () => {} },
    who: HAND,
    wardSigner: async () => root,
    face: { grant: face.grant },
    landDrops: (tombstones) => boardDoor.drop(tombstones),
  });
  /** A writer holding unlocked custody rewrites the ledger's plaintext: it never reaches the board. */
  const custodyWrite = (fn: (l: PromotionLedger) => PromotionLedger) => { state.ledger = decodeLedger(encodeLedger(fn(state.ledger))); };
  return { state, ports, custodyWrite, root, atom };
}

describe("a stripped tombstone replays a dropped bound row (road L23)", () => {
  test("RED: drop a ward-signed daemon promotion, strip its tombstone with a plain custody write and put the old signed row back; boot voids it `ward-dropped`. CONTROL: a fresh ward-signed commit of the same bytes stands", async () => {
    const w = await world();
    w.state.items.set("daemon", [itemOf(RITE)]);
    const old = await promotions(w.ports("daemon")).promote({ digest: D });
    expect((await promotions(w.ports("daemon")).boot()).pluginCids).toEqual([D]);
    await promotions(w.ports("daemon")).unpromote({ digest: D });
    expect((await promotions(w.ports("daemon")).boot()).pluginCids).toEqual([]);
    // THE EXPLOIT: the custody writer drops the tombstone and re-inserts the old row, ward signature and all.
    w.custodyWrite((l) => ({ seq: l.seq, rows: [...l.rows, old] }));
    const replay = await promotions(w.ports("daemon")).boot();
    expect(replay.pluginCids).toEqual([]);
    expect(replay.voided).toEqual([{ digest: D, reason: "ward-dropped" }]);
    // CONTROL: the hand commits the same bytes again under a fresh ward signature; that row stands, and the replayed one still voids.
    w.custodyWrite((l) => ({ ...l, rows: l.rows.filter((r) => r !== old && r.seq !== old.seq) }));
    const again = await promotions(w.ports("daemon")).promote({ digest: D });
    expect(again.seq).toBeGreaterThan(old.seq);
    expect((await promotions(w.ports("daemon")).boot()).pluginCids).toEqual([D]);
  });

  test("RED: a bound row a newer commit replaced replays the same way once its tombstone is stripped; CONTROL: the newer row stands", async () => {
    const w = await world();
    w.state.items.set("daemon", [itemOf(RITE)]);
    const old = await promotions(w.ports("daemon")).promote({ digest: D });
    w.state.items.set("daemon", [itemOf(RITE2)]);
    await promotions(w.ports("daemon")).promote({ digest: D2 });
    w.custodyWrite((l) => ({ seq: l.seq, rows: [...l.rows, old] }));
    const boot = await promotions(w.ports("daemon")).boot();
    expect(boot.voided).toEqual([{ digest: D, reason: "ward-dropped" }]);
    expect(boot.pluginCids).toEqual([D2]);
  });
});

describe("the floor itself against a custody writer", () => {
  test("RED: the custody writer strips the ledger tombstone, empties the kāpae cache and even deletes the whole ledger, then writes the old row back; the board's drop keeps it void. CONTROL: a hand's fresh commit after the reset lands past the board's drop and stands", async () => {
    const w = await world();
    w.state.items.set("daemon", [itemOf(RITE)]);
    const old = await promotions(w.ports("daemon")).promote({ digest: D });
    await promotions(w.ports("daemon")).unpromote({ digest: D });
    w.state.local = EMPTY_KAPAE_LOCAL;
    w.custodyWrite(() => ({ seq: old.seq, rows: [old] }));
    expect((await promotions(w.ports("daemon")).boot()).voided).toEqual([{ digest: D, reason: "ward-dropped" }]);
    // The ledger row gone entire: the next commit would land at the very seq the drop names, so the door lands it past the board's floor.
    w.custodyWrite(() => EMPTY_LEDGER);
    const fresh = await promotions(w.ports("daemon")).promote({ digest: D });
    expect(fresh.seq).toBeGreaterThan(old.seq);
    expect((await promotions(w.ports("daemon")).boot()).pluginCids).toEqual([D]);
  });

  test("RED: a board copy that lost the drop still voids the row while the ledger's tombstone stands; a board that cannot be read voids every bound row `ward-floor-unread`. CONTROL: a user wiki's row stands with no board", async () => {
    const w = await world();
    w.state.items.set("daemon", [itemOf(RITE)]);
    w.state.items.set(USER, [itemOf(RITE)]);
    const old = await promotions(w.ports("daemon")).promote({ digest: D });
    await promotions(w.ports(USER)).promote({ digest: D });
    await promotions(w.ports("daemon")).unpromote({ digest: D });
    w.state.acts = [];
    w.state.ledger = { ...w.state.ledger, rows: [...w.state.ledger.rows, old] };
    expect((await promotions(w.ports("daemon")).boot()).voided).toEqual([{ digest: D, reason: "ward-dropped" }]);
    w.state.ledger = { ...w.state.ledger, rows: w.state.ledger.rows.filter((r) => r !== old) };
    const signed = await promotions(w.ports("daemon")).promote({ digest: D });
    w.state.boardReadable = false;
    expect((await promotions(w.ports("daemon")).boot()).voided).toEqual([{ digest: signed.digest, reason: "ward-floor-unread" }]);
    expect((await promotions(w.ports(USER)).boot()).pluginCids).toEqual([D]);
  });

  test("RED: a drop signed by a key the face neither grants nor enrolls reads refused on the board and floors nothing; CONTROL: the device's own drop reads", async () => {
    const w = await world();
    const { signPromoteDrop } = await import("../src/promote-board.js");
    const stranger = { key: await ed25519VerifyingKeyFromSeed(seed(9)), sign: ed25519SignerFromSeed(seed(9)) };
    const face = { group: GROUP, grant: (k: string) => k === w.root.key, device: (k: string) => k === w.atom.key, ward: { accepts: () => true } };
    const forged = await signPromoteDrop({ group: GROUP, epoch: 0, wiki: "daemon", digest: D, seq: 1 }, stranger);
    const own = await signPromoteDrop({ group: GROUP, epoch: 0, wiki: "daemon", digest: D, seq: 2 }, w.atom);
    const reading = readPromoteBoard([forged, own], face);
    expect(reading.refused.map((r) => r.refusal)).toEqual(["grant"]);
    expect([...reading.dropped()]).toEqual([`daemon\n${D}\n2`]);
    expect(reading.dropFloor()).toBe(2);
  });
});
