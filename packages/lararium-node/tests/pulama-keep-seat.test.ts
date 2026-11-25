/**
 * pulama-keep-seat — THE KEEP SEAT AT THE PŪLAMA'S HAND DOOR.
 *
 * A house a pūlama keeps never reads a route on the vessel's side, so `lares vault unlock` there seats no keep pair, and a keep
 * would refuse `keep-seat-absent`. The pūlama's hand door gains the keep-seat act: the route rides the pūlama's own terminal,
 * proves against its lit custody, and the pair mints there (public half, the slot tree wrapping the secret, the signing seed).
 * The pūlama's container stands read-only with no config home, so the verb writes NOTHING: it prints exactly one stdout line the
 * host's shim writes to `keep-seat.json` (0600), or one refusal line and a nonzero exit.
 *
 *   PK1  RED: a lit pūlama seats a keep pair under the route it proves: the seat opens under that route, and its verify key
 *        answers the signing seed handed back. A wrong route refuses by name and mints nothing; an unlit one refuses before it.
 *   PK2  RED: `keep-seat` over the real hand door prints ONE line: `{"op","reading":"seated","seat":{"publicKey","stretchSalt",
 *        "tree","verifyKey"},"signer"}` and exit 0, the tree as keep-seat.json holds it and opening under the route; a wrong
 *        route prints one `{"op","reading":"refused","code","message"}` line and a nonzero exit; no route reads no route at all.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { decodeKeepSeat, keepVerifyKeyOf, openKeepSecret } from "@lararium/mesh/keep-seat-door";
import { nobleKdf } from "@lararium/mesh/keyslot-door";
import { FsCustodyIo } from "../src/custody-io.js";
import { makeCustodyHolder } from "../src/custody-holder.js";
import { pulamaHandDoor } from "../src/pulama-hand.js";
import { servePulama } from "../src/pulama-server.js";
import { pulamaImage, pulamaRecords } from "../src/pulama-state.js";
import { RouteNotGiven, keepSeatLine } from "../src/pulama-verbs.js";
import { FIXTURE_PASSPHRASE } from "./custody-seat-fixture.js";
import { SESSION_DERIVES, lend, openGate, standPulama, type PulamaFixture } from "./pulama-fixture.js";

vi.setConfig({ testTimeout: 180_000 });

const route = [{ kind: "passphrase" as const, passphrase: FIXTURE_PASSPHRASE }];
let fx: PulamaFixture | null = null;
const dirs: string[] = [];
afterEach(async () => { await fx?.drop(); fx = null; for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

async function stand() {
  fx = await standPulama("pulama-keep-seat", () => openGate({ faces: lend(0), coldReads: [] }));
  const holder = makeCustodyHolder({ io: new FsCustodyIo(fx.seat.homes), homes: fx.seat.homes });
  const server = servePulama({ holder, gate: openGate({ faces: lend(0), coldReads: [] }), derives: SESSION_DERIVES });
  const dir = mkdtempSync(join(tmpdir(), "lar-pulama-keep-")); dirs.push(dir);
  const door = pulamaHandDoor({ holder, server, image: pulamaImage(dir), records: pulamaRecords(dir) } as Parameters<typeof pulamaHandDoor>[0]);
  return { door, light: () => door({ op: "light", credentials: route }) };
}

describe("the keep seat at the pūlama's hand door", () => {
  test("PK1 RED: a lit pūlama seats a keep pair under the route it proves; a wrong route and an unlit one refuse", async () => {
    const s = await stand();
    expect(await s.door({ op: "keep-seat", credentials: route }), "an unlit pūlama refuses before any route").toMatchObject({ op: "keep-seat", reading: "pulama-locked" });
    await s.light();
    const wrong = await s.door({ op: "keep-seat", credentials: [{ kind: "passphrase", passphrase: "not the route" }] });
    expect(wrong).toMatchObject({ op: "keep-seat", reading: "no-slot-opens" });
    expect(wrong["seat"]).toBeUndefined();
    const seated = await s.door({ op: "keep-seat", credentials: route });
    expect(seated).toMatchObject({ op: "keep-seat", reading: "seated" });
    const read = decodeKeepSeat(String(seated["seat"]));
    expect(read.reading).toBe("readable");
    const seat = (read as { seat: Parameters<typeof openKeepSecret>[0] }).seat;
    const opened = await openKeepSecret(seat, route, nobleKdf);
    expect(opened.reading).toBe("opens");
    const seed = Uint8Array.from(Buffer.from(String(seated["signingSeed"]), "hex"));
    expect(Buffer.from((opened as { verifyKey: Uint8Array }).verifyKey).equals(Buffer.from(keepVerifyKeyOf(seed)))).toBe(true);
    expect(JSON.stringify(seated)).not.toContain(FIXTURE_PASSPHRASE);
  });

  test("PK2 RED: the verb prints one seated line over the real door, one refusal line and a nonzero exit on a miss", async () => {
    const s = await stand();
    await s.light();
    const ask = (frame: Readonly<Record<string, unknown>>) => s.door(frame);
    const ok = await keepSeatLine({ ask, route: async () => FIXTURE_PASSPHRASE });
    expect(ok.code).toBe(0);
    expect(ok.line.includes("\n"), "exactly one line").toBe(false);
    const line = JSON.parse(ok.line) as { op: string; reading: string; seat: Record<string, unknown>; signer: string };
    expect(Object.keys(line).sort()).toEqual(["op", "reading", "seat", "signer"]);
    expect({ op: line.op, reading: line.reading }).toEqual({ op: "keep-seat", reading: "seated" });
    expect(Object.keys(line.seat).sort()).toEqual(["publicKey", "stretchSalt", "tree", "verifyKey"]);
    const read = decodeKeepSeat(JSON.stringify({ publicKey: line.seat["publicKey"], stretchSalt: line.seat["stretchSalt"], slots: line.seat["tree"] }));
    expect(read.reading, "the tree reads as keep-seat.json holds it").toBe("readable");
    const opened = await openKeepSecret((read as { seat: Parameters<typeof openKeepSecret>[0] }).seat, route, nobleKdf);
    expect(opened.reading).toBe("opens");
    expect(Buffer.from((opened as { verifyKey: Uint8Array }).verifyKey).toString("hex")).toBe(line.seat["verifyKey"]);
    expect(Buffer.from(keepVerifyKeyOf(Uint8Array.from(Buffer.from(line.signer, "hex")))).toString("hex")).toBe(line.seat["verifyKey"]);
    const miss = await keepSeatLine({ ask, route: async () => "not the route" });
    expect(miss.code).not.toBe(0);
    expect(JSON.parse(miss.line)).toMatchObject({ op: "keep-seat", reading: "refused", code: "no-slot-opens" });
    expect(Object.keys(JSON.parse(miss.line)).sort()).toEqual(["code", "message", "op", "reading"]);
    const none = await keepSeatLine({ ask, route: async () => { throw new RouteNotGiven(false); } });
    expect(none.code).not.toBe(0);
    expect(JSON.parse(none.line)).toMatchObject({ op: "keep-seat", reading: "refused", code: "route-not-given" });
  });
});
