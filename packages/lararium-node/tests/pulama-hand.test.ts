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
import { kukuluLeiOver } from "../src/kukulu-lei-seat.js";
import { pulamaHandDoor } from "../src/pulama-hand.js";
import { KUKULU_OFFER_ENV, PULAMA_SOCKET_ENV, readKukuluOffer, standByPulama, vesselPulamaHolder } from "../src/pulama-seat.js";
import { servePulama } from "../src/pulama-server.js";
import { pulamaImage, pulamaRecords, pulamaTessera, pulamaTesseraTitle } from "../src/pulama-state.js";
import { personaGroupDigest } from "../src/persona-group-file.js";
import { FIXTURE_PASSPHRASE } from "./custody-seat-fixture.js";
import { SESSION_DERIVES, fixtureSlots, openGate, standPulama, type PulamaFixture } from "./pulama-fixture.js";

vi.setConfig({ testTimeout: 180_000 });

let fx: PulamaFixture | null = null;
const dirs: string[] = [];
const scratch = (): string => { const d = mkdtempSync(join(tmpdir(), "lar-pulama-state-")); dirs.push(d); return d; };
afterEach(async () => { await fx?.drop(); fx = null; for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

describe("the pūlama's state holds signed rows and a public digest", () => {
  test("a row claims once, lists under its prefix, and the image report reads back only as a digest", async () => {
    const dir = scratch();
    const records = pulamaRecords(dir), tessera = pulamaTessera(records), image = pulamaImage(dir);
    expect(await tessera.land("lei-1", "half-1")).toBe(true);
    expect(await tessera.land("lei-1", "half-other")).toBe(false);
    expect(await records.read(pulamaTesseraTitle("lei-1"))).toBe("half-1");
    await records.write("$:/lares/swarm/other", "x");
    expect(await records.list("$:/lares/pulama/")).toEqual([pulamaTesseraTitle("lei-1")]);
    expect(await records.read("$:/lares/swarm/absent")).toBeNull();
    expect(image.raised()).toBeNull();
    expect(() => image.report("not a digest")).toThrow(RangeError);
    image.report("sha256:" + "ab".repeat(32));
    expect(pulamaImage(dir).raised()).toBe("sha256:" + "ab".repeat(32));
    expect(readdirSync(dir).sort()).toEqual(["image", "records"]);
    // The lei family's seat refuses until its kūkulu rite sits there: nothing verifies a lei, so nothing returns one.
    expect(await kukuluLeiOver(records).readLei({}, "g", () => true)).toEqual({ ok: false, refusal: "unseated" });
  });
});

describe("only the hand door lights the pūlama", () => {
  test("light opens the vessel key and its faces; a wrong route spends an attempt; image, tessera, status and lock answer no secret", async () => {
    fx = await standPulama("pulama-hand", () => openGate({ face: null, coldReads: [] }));
    await fx.kept.foundFace({ group: personaGroupDigest("group-hand"), ordinal: 0, slots: fixtureSlots });
    // A pūlama's own start: a fresh holder over the hearth, holding nothing.
    const holder = makeCustodyHolder({ io: new FsCustodyIo(fx.seat.homes), homes: fx.seat.homes });
    const server = servePulama({ holder, gate: openGate({ face: null, coldReads: [] }), derives: SESSION_DERIVES });
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
    await pulamaTessera(records).land("lei-9", JSON.stringify({ body: { act: "rite-begun" } }));
    expect(await door({ op: "tessera" })).toEqual({ op: "tessera", halves: [{ body: { act: "rite-begun" } }] });
    expect(await door({ op: "unlock-everything" })).toEqual({ op: "unlock-everything", reading: "unknown-act" });
    expect(await door({ op: "lock" })).toMatchObject({ op: "lock", lit: false, faces: 0 });
    // No answer and no log line carried the route.
    expect(JSON.stringify([lit, lines])).not.toContain(FIXTURE_PASSPHRASE);
    expect(JSON.stringify(lines)).not.toContain("a-wrong-route");
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

  test("a session mounts the lei's face and composes sovereign; its drop composes at the floor; a refused hello keeps the floor", async () => {
    let scope: { fcid: string; ordinal: number } | null = null;
    let admit = true;
    fx = await standPulama("pulama-stand-by", () => ({ admit: async () => admit ? { ok: true, scope: { face: scope, coldReads: [] } } : { ok: false, reading: "kukulu-unvouched" } }));
    const face = await fx.kept.foundFace({ group: personaGroupDigest("group-stand-by"), ordinal: 0, slots: fixtureSlots });
    scope = { fcid: face.fcid, ordinal: 0 };
    const composed: boolean[] = [], mounted: number[] = [], lines: string[] = [];
    const deps = { recompose: async (sovereign: boolean) => { composed.push(sovereign); return { standing: sovereign ? "hearth" : "floor" }; }, mount: (o: number) => { mounted.push(o); }, onLog: (l: string) => { lines.push(l); } };
    const vessel = fx.vessel();
    expect(await standByPulama({ holder: vessel, ...deps })).toBe(true);
    expect(mounted).toEqual([0]);
    expect(composed).toEqual([true]);
    await fx.server.lock();
    await vi.waitFor(() => expect(composed).toEqual([true, false]));
    // A hello the gate refuses names its reading once and composes nothing.
    await fx.kept.adopt(fx.treeKey);
    admit = false;
    expect(await standByPulama({ holder: fx.vessel(), ...deps })).toBe(false);
    expect(composed).toEqual([true, false]);
    expect(lines.some((l) => l.includes("kukulu-unvouched"))).toBe(true);
  });
});
