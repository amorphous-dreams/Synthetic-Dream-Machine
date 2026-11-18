/**
 * pulama-keep-seat — THE KEEP SEAT AT THE PŪLAMA'S HAND DOOR.
 *
 * A house a pūlama keeps never reads a route on the vessel's side, so `lares vault unlock` there seats no keep pair, and a keep
 * would refuse `keep-seat-absent`. The pūlama's hand door gains the keep-seat act: the route rides the pūlama's own terminal,
 * proves against its lit custody, and the pair mints there (public half, the slot tree wrapping the secret, the signing seed).
 * The verb writes the house's seat file; the line it prints carries no secret and no tree.
 *
 *   PK1  RED: a lit pūlama seats a keep pair under the route it proves: the seat opens under that route, and its verify key
 *        answers the signing seed handed back. A wrong route refuses by name and mints nothing; an unlit one refuses before it.
 *   PK2  RED: `pulama-main.js keep-seat` reads the door, reads the route, hands one keep-seat frame, writes the seat through its
 *        writer, and prints no signing seed and no slot tree. CONTROL: an unlit pūlama asks no route.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { decodeKeepSeat, keepVerifyKeyOf, nobleKdf, openKeepSecret } from "@lararium/mesh";
import { FsCustodyIo } from "../src/custody-io.js";
import { makeCustodyHolder } from "../src/custody-holder.js";
import { pulamaHandDoor } from "../src/pulama-hand.js";
import { servePulama } from "../src/pulama-server.js";
import { pulamaImage, pulamaRecords } from "../src/pulama-state.js";
import { runHandVerb } from "../src/pulama-verbs.js";
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

  test("PK2 RED: the verb writes the seat through its writer and prints no secret; CONTROL: an unlit pūlama asks no route", async () => {
    const frames: Array<Record<string, unknown>> = [], asked: string[] = [], written: string[] = [];
    const ports = (lit: boolean) => ({
      ask: async (frame: Readonly<Record<string, unknown>>) => {
        frames.push({ ...frame });
        if (frame["op"] === "status") return { op: "status", lit };
        return { op: "keep-seat", reading: "seated", seat: JSON.stringify({ publicKey: "a".repeat(64), stretchSalt: "b".repeat(32), slots: { keyCheck: "c", slots: [] } }), signingSeed: "d".repeat(64) };
      },
      route: async (label: string) => { asked.push(label); return "the-route"; },
      keepSeat: (answer: Readonly<Record<string, unknown>>) => { written.push(JSON.stringify(answer)); return "/lar/config/keep-seat.json"; },
    });
    expect(await runHandVerb("keep-seat", undefined, ports(false)), "CONTROL: an unlit pūlama asks no route").toMatchObject({ op: "keep-seat", reading: "pulama-locked" });
    expect(asked).toEqual([]);
    const printed = await runHandVerb("keep-seat", undefined, ports(true));
    expect(printed).toMatchObject({ op: "keep-seat", reading: "seated", path: "/lar/config/keep-seat.json", publicKey: "a".repeat(64) });
    expect(JSON.stringify(printed)).not.toContain("d".repeat(64));
    expect(JSON.stringify(printed)).not.toContain("keyCheck");
    expect(written[0]).toContain("d".repeat(64));
    expect(frames.at(-1)).toEqual({ op: "keep-seat", credentials: [{ kind: "passphrase", passphrase: "the-route" }] });
  });
});
