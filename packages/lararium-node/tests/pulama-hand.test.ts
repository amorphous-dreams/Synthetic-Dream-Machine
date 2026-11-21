/**
 * pulama-hand — the pūlama's hand door, its state, and the vessel's seat: only the hand door's `light` opens a key, the host
 * reports the image there, the record store claims a row once, and a vessel names its pūlama by one environment name.
 */
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { FsCustodyIo } from "../src/custody-io.js";
import { makeCustodyHolder } from "../src/custody-holder.js";
import { pulamaHandDoor } from "../src/pulama-hand.js";
import { KUKULU_OFFER_ENV, PULAMA_SOCKET_ENV, pulamaStandBy, readKukuluOffer, standByPulama, vesselPulamaHolder } from "../src/pulama-seat.js";
import { servePulama } from "../src/pulama-server.js";
import { swarmTesseraTitle } from "@lararium/mesh";
import { pulamaImage, pulamaRecords } from "../src/pulama-state.js";
import { personaGroupDigest } from "../src/persona-group-file.js";
import { FIXTURE_PASSPHRASE } from "./custody-seat-fixture.js";
import { SESSION_DERIVES, fixtureSlots, lend, openGate, standPulama, type PulamaFixture } from "./pulama-fixture.js";

vi.setConfig({ testTimeout: 180_000 });

let fx: PulamaFixture | null = null;
const dirs: string[] = [];
const scratch = (): string => { const d = mkdtempSync(join(tmpdir(), "lar-pulama-state-")); dirs.push(d); return d; };
afterEach(async () => { await fx?.drop(); fx = null; for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

describe("the pūlama's state holds signed rows and a public digest", () => {
  test("a row claims once, lists under its prefix, and the image report reads back only as a digest", async () => {
    const dir = scratch();
    const records = pulamaRecords(dir), image = pulamaImage(dir), guest = swarmTesseraTitle("ab".repeat(32), "guest");
    expect(await records.writeNew(guest, "half-1")).toBe(true);
    expect(await records.writeNew(guest, "half-other")).toBe(false);
    expect(await records.read(guest)).toBe("half-1");
    await records.write("$:/lares/swarm/other", "x");
    expect(await records.list("$:/lares/swarm/tessera/")).toEqual([guest]);
    await records.write("$:/lares/swarm/other", "y");
    expect(await records.read("$:/lares/swarm/other")).toBe("y");
    expect(await records.read("$:/lares/swarm/absent")).toBeNull();
    expect(image.raised()).toBeNull();
    expect(() => image.report("not a digest")).toThrow(RangeError);
    image.report("sha256:" + "ab".repeat(32));
    expect(pulamaImage(dir).raised()).toBe("sha256:" + "ab".repeat(32));
    expect(readdirSync(dir).sort()).toEqual(["image", "records"]);
  });
});

describe("only the hand door lights the pūlama", () => {
  test("light opens the vessel key and its faces; a wrong route spends an attempt; image, tessera, status and lock answer no secret", async () => {
    fx = await standPulama("pulama-hand", () => openGate({ faces: lend(0), coldReads: [] }));
    await fx.kept.foundFace({ group: personaGroupDigest("group-hand"), ordinal: 0, slots: fixtureSlots });
    // A pūlama's own start: a fresh holder over the hearth, holding nothing.
    const holder = makeCustodyHolder({ io: new FsCustodyIo(fx.seat.homes), homes: fx.seat.homes });
    const server = servePulama({ holder, gate: openGate({ faces: lend(0), coldReads: [] }), derives: SESSION_DERIVES });
    const dir = scratch(), records = pulamaRecords(dir);
    const lines: string[] = [];
    const door = pulamaHandDoor({ holder, server, image: pulamaImage(dir), records, onLog: (l) => lines.push(l) });
    expect(await door({ op: "status" })).toEqual({ op: "status", lit: false, faces: 0, sessions: 0, attemptsLeft: 3, image: null });
    expect(await door({ op: "light", credentials: [{ kind: "passphrase", passphrase: "a-wrong-route" }] })).toMatchObject({ reading: "no-slot-opens", lit: false, attemptsLeft: 2 });
    expect(await door({ op: "light" })).toEqual({ op: "light", reading: "malformed" });
    const lit = await door({ op: "light", credentials: [{ kind: "passphrase", passphrase: FIXTURE_PASSPHRASE }] });
    expect(lit).toMatchObject({ op: "light", reading: "opens", faceReadings: ["opens"], lit: true, faces: 1 });
    expect(await door({ op: "image", digest: "sha256:" + "cd".repeat(32) })).toEqual({ op: "image", reading: "reported", image: "sha256:" + "cd".repeat(32) });
    expect(await door({ op: "image", digest: "../../etc" })).toEqual({ op: "image", reading: "malformed" });
    await records.writeNew(swarmTesseraTitle("cd".repeat(32), "guest"), JSON.stringify({ body: { act: "rite-begun" } }));
    expect(await door({ op: "tessera" })).toEqual({ op: "tessera", halves: [{ body: { act: "rite-begun" } }], admitted: [] });
    expect(await door({ op: "unlock-everything" })).toEqual({ op: "unlock-everything", reading: "unknown-act" });
    expect(await door({ op: "lock" })).toMatchObject({ op: "lock", lit: false, faces: 0 });
    // No answer and no log line carried the route.
    expect(JSON.stringify([lit, lines])).not.toContain(FIXTURE_PASSPHRASE);
    expect(JSON.stringify(lines)).not.toContain("a-wrong-route");
  });

  test("THE OPERATOR'S HAND CLOSES ONE FACE: `close` tells the lending vessel and answers closing, `status` names the face its vessel has not answered, and `force` locks it", async () => {
    fx = await standPulama("pulama-hand-close", () => openGate({ faces: lend(0), coldReads: [] }));
    const face = await fx.kept.foundFace({ group: personaGroupDigest("group-hand-close"), ordinal: 0, slots: fixtureSlots });
    const vessel = fx.vessel();
    await vessel.unlock([]);
    const dir = scratch();
    const door = pulamaHandDoor({ holder: fx.kept, server: fx.server, image: pulamaImage(dir), records: pulamaRecords(dir) });
    expect(await door({ op: "close", face: "h0" })).toMatchObject({ op: "close", reading: "malformed" });
    expect(await door({ op: "close", face: 0 })).toMatchObject({ op: "close", reading: "closing", face: 0, unanswered: 1 });
    expect(await door({ op: "status" })).toMatchObject({ closing: [{ face: 0, unanswered: 1, note: "face h0: the vessel has not answered its close" }] });
    expect(fx.kept.unlockedFaces()).toContain(face.fcid);
    expect(await door({ op: "close", face: 0, force: true })).toMatchObject({ op: "close", reading: "locked", forced: true });
    expect(fx.kept.unlockedFaces()).not.toContain(face.fcid);
    expect(await door({ op: "status" })).not.toHaveProperty("closing");
  });
});

describe("a vessel finds its pūlama by one name and stands by it", () => {
  test("no name seats no pūlama holder; a named socket seats one; the offer file reads as an object or as nothing", () => {
    fx = null;
    const homes = { identity: "/x/identity", storage: "/x/vessel", seal: "/x/nexus" };
    expect(vesselPulamaHolder(homes, {})).toBeNull();
    expect(vesselPulamaHolder(homes, { [PULAMA_SOCKET_ENV]: "  " })).toBeNull();
    expect(vesselPulamaHolder(homes, { [PULAMA_SOCKET_ENV]: "/run/pulama/pulama.sock", [KUKULU_OFFER_ENV]: "/nowhere" })?.isUnlocked()).toBe(false);
    const dir = scratch(), path = join(dir, "offer.json");
    expect(readKukuluOffer(undefined)).toEqual({});
    expect(readKukuluOffer(path)).toEqual({});
    writeFileSync(path, JSON.stringify({ lei: { a: 1 }, vouch: { b: 2 } }));
    expect(readKukuluOffer(path)).toEqual({ lei: { a: 1 }, vouch: { b: 2 } });
    writeFileSync(path, "[1,2]");
    expect(readKukuluOffer(path)).toEqual({});
  });

  test("a session composes sovereign over its lend and sets no vessel-wide face; its drop composes at the floor; a refused hello keeps the floor", async () => {
    let admit = true;
    fx = await standPulama("pulama-stand-by", () => ({ admit: async () => admit ? { ok: true, scope: { faces: lend(0), coldReads: [] } } : { ok: false, reading: "kukulu-unvouched" } }));
    await fx.kept.foundFace({ group: personaGroupDigest("group-stand-by"), ordinal: 0, slots: fixtureSlots });
    const composed: boolean[] = [], lines: string[] = [];
    const deps = { recompose: async (sovereign: boolean) => { composed.push(sovereign); return { standing: sovereign ? "hearth" : "floor" }; }, onLog: (l: string) => { lines.push(l); } };
    const vessel = fx.vessel();
    expect(await standByPulama({ holder: vessel, ...deps })).toBe(true);
    expect(lines.some((l) => l.includes("lends h0"))).toBe(true);
    expect(composed).toEqual([true]);
    await fx.server.lock();
    await vi.waitFor(() => expect(composed).toEqual([true, false]));
    // TWO CALLERS, ONE DIAL: a second dial waits on the first, and neither reads a session before the composition stands.
    await fx.kept.adopt(fx.treeKey);
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const slow: boolean[] = [];
    const together = pulamaStandBy({ holder: fx.vessel(), onLog: () => {}, recompose: async (sovereign) => { slow.push(sovereign); await held; return { standing: "hearth" }; } });
    const one = together.dial(), two = together.dial();
    await vi.waitFor(() => expect(slow).toEqual([true]));
    let settled = false;
    void two.then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);
    release();
    expect(await Promise.all([one, two])).toEqual([{ session: true, waits: null }, { session: true, waits: null }]);
    expect(slow).toEqual([true]);
    // A composition that throws leaves no session behind it, and the offer stays for the next dial.
    let consumed = 0;
    const thrown = fx.vessel();
    const falls = pulamaStandBy({ holder: thrown, onLog: () => {}, consumeOffer: () => { consumed += 1; return true; }, recompose: async (sovereign) => { if (sovereign) throw new Error("the composition fell over"); return { standing: "floor" }; } });
    expect(await falls.dial()).toEqual({ session: false, waits: "composition-refused", refused: "the composition fell over" });
    expect(thrown.isUnlocked()).toBe(false);
    expect(consumed).toBe(0);
    await fx.server.lock();
    // A hello the gate refuses names its reading once and composes nothing.
    await fx.kept.adopt(fx.treeKey);
    admit = false;
    expect(await standByPulama({ holder: fx.vessel(), ...deps })).toBe(false);
    expect(composed).toEqual([true, false]);
    expect(lines.some((l) => l.includes("kukulu-unvouched"))).toBe(true);
  });
});
