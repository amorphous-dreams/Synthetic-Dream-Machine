/**
 * pulama-worn-ordinal — the pūlama remembers, in its own memory alone, the face a vessel's wear door last wore, and hands that
 * ordinal back in the standing of the next session it serves. A vessel Docker restarts (it re-dials the pūlama, and no shim
 * runs) wears that face again where it stands lit inside the lent set; otherwise the daemon mount falls to the lowest face
 * served, as a pūlama that never heard a wear leaves it. The one op that writes the ordinal carries the ordinal and nothing
 * beside it, and only the wear door sends it.
 */
import { EventEmitter } from "node:events";
import { readdirSync, readFileSync } from "node:fs";
import type { Socket } from "node:net";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { afterEach, describe, expect, test, vi } from "vitest";
import { custodyFrameHandler } from "../src/custody-frames.js";
import { seatCustody, unseatCustody } from "../src/custody-seat.js";
import { faceAtomGroupFile } from "../src/face-atom-store.js";
import { daemonMountOrdinal, mountedFaceOrdinal, setMountedFace } from "../src/node-vessel-identity.js";
import { personaGroupDigest } from "../src/persona-group-file.js";
import type { PulamaHolder } from "../src/pulama-holder.js";
import { pulamaStandBy } from "../src/pulama-seat.js";
import { fixtureSlots, lend, standPulama, type PulamaFixture } from "./pulama-fixture.js";

vi.setConfig({ testTimeout: 180_000 });

const GROUPS = ["group-worn-steward", "group-worn-engineer", "group-worn-referee"] as const;
const SRC = join(import.meta.dirname, "..", "src");

let fx: PulamaFixture | null = null;
let seated: PulamaHolder | null = null;
afterEach(async () => {
  setMountedFace(undefined);
  if (seated) { unseatCustody(seated); await seated.lock(); seated = null; }
  if (fx) seatCustody(fx.local);
  await fx?.drop(); fx = null;
});

/** Three faces lit at the pūlama; the gate lends whatever `lent.now` names when each hello arrives. */
async function standThree(lent: { now: number[] }, dark: number[] = []) {
  fx = await standPulama("pulama-worn-ordinal", () => ({ admit: async () => ({ ok: true, scope: { faces: lend(...lent.now), coldReads: [] } }) }));
  const faces = [];
  for (const [i, group] of GROUPS.entries()) faces.push(await fx.kept.foundFace({ group: personaGroupDigest(group), ordinal: i, slots: fixtureSlots }));
  for (const group of GROUPS) await fx.kept.writeRecord("identity", faceAtomGroupFile(group), randomBytes(32));
  for (const o of dark) await fx.kept.lockFace(faces[o]!.fcid);
  return faces;
}

/** One vessel boot: a fresh process (no mount named), a holder seated over a new channel, the stand-by's one boot dial. */
async function boot(refuseOn?: number) {
  setMountedFace(undefined);
  const vessel = fx!.vessel();
  seatCustody(vessel);
  seated = vessel;
  const lines: string[] = [];
  const recompose = async (sovereign: boolean) => (sovereign && refuseOn !== undefined && mountedFaceOrdinal() === refuseOn
    ? { standing: "herm", refused: `h${refuseOn} would not stand` } : { standing: sovereign ? "hearth" : "herm" });
  const by = pulamaStandBy({ holder: vessel, recompose, onLog: (l) => lines.push(l) });
  expect(await by.dial()).toEqual({ session: true, waits: null });
  const door = custodyFrameHandler({
    holder: vessel, testScratch: false, standing: () => "hearth", recompose, onLog: (l) => lines.push(l),
    pulama: { standing: () => ({ session: vessel.isUnlocked(), waits: null }), dial: () => by.dial(), lent: () => vessel.lends(), tellWorn: (o) => vessel.tellWorn(o) },
  });
  const send = (frame: unknown): Promise<Record<string, unknown>> => new Promise((resolve) => {
    const sock = Object.assign(new EventEmitter(), { end: (line: string) => resolve(JSON.parse(line) as Record<string, unknown>) }) as unknown as Socket;
    expect(door(frame, sock)).toBe(true);
  });
  return { vessel, lines, send };
}

/** Docker restarts the vessel: its process ends (the channel closes), and a new one boots. */
async function restart(refuseOn?: number) {
  if (seated) { unseatCustody(seated); await seated.lock(); seated = null; }
  return boot(refuseOn);
}

/** Every line the vessels sent that names the worn op. */
const wornLines = (): string[] => fx!.lines.fromVessel.filter((l) => l.includes("face.worn"));

describe("RED pulama-remembers-the-worn-face: a Docker-driven restart wears the face the operator last wore", () => {
  test("face 1 worn, the vessel restarts and re-dials the pūlama: the daemon mount reads h1, never h0", async () => {
    await standThree({ now: [0, 1, 2] });
    const first = await boot();
    expect(await daemonMountOrdinal()).toBe(0);
    expect(await first.send({ op: "wear", face: 1 })).toMatchObject({ op: "wear", face: 1, held: true });
    const again = await restart();
    expect(mountedFaceOrdinal()).toBe(1);
    expect(await daemonMountOrdinal()).toBe(1);
    expect(again.lines.join("\n")).toMatch(/h1/);
  });

  test("CONTROL: a pūlama that never heard a wear leaves the mount unnamed, and the daemon mount reads the lowest face served", async () => {
    await standThree({ now: [0, 1, 2] });
    await boot();
    await restart();
    expect(mountedFaceOrdinal()).toBeUndefined();
    expect(await daemonMountOrdinal()).toBe(0);
    expect(wornLines()).toEqual([]);
  });

  test("CONTROL: a remembered ordinal the next lend no longer holds falls back to the lowest face served, and the boot stands", async () => {
    const lent = { now: [0, 1, 2] };
    await standThree(lent);
    const first = await boot();
    expect(await first.send({ op: "wear", face: 2 })).toMatchObject({ op: "wear", face: 2, held: true });
    lent.now = [0, 1];
    await restart();
    expect(mountedFaceOrdinal()).toBeUndefined();
    expect(await daemonMountOrdinal()).toBe(0);
  });

  test("the fallback names itself: the session hands back the remembered h2, and the boot's line says the lend no longer holds it", async () => {
    const lent = { now: [0, 1, 2] };
    await standThree(lent);
    const first = await boot();
    expect(await first.send({ op: "wear", face: 2 })).toMatchObject({ op: "wear", face: 2, held: true });
    lent.now = [0, 1];
    const again = await restart();
    expect(again.vessel.worn()).toBe(2);
    expect(again.lines.join("\n")).toMatch(/remembers h2 worn.*(outside|not).*lent/i);
  });

  test("CONTROL: a remembered face lent but dark at the pūlama falls back too", async () => {
    const faces = await standThree({ now: [0, 1, 2] });
    const first = await boot();
    expect(await first.send({ op: "wear", face: 1 })).toMatchObject({ op: "wear", face: 1, held: true });
    await fx!.kept.lockFace(faces[1]!.fcid);
    await restart();
    expect(mountedFaceOrdinal()).toBeUndefined();
    expect(await daemonMountOrdinal()).toBe(0);
  });

  test("a remembered face whose composition refuses never refuses the boot: the vessel composes once more on the lowest face served", async () => {
    await standThree({ now: [0, 1, 2] });
    const first = await boot();
    expect(await first.send({ op: "wear", face: 1 })).toMatchObject({ op: "wear", face: 1, held: true });
    const again = await restart(1);
    expect(again.vessel.isUnlocked()).toBe(true);
    expect(mountedFaceOrdinal()).toBeUndefined();
    expect(await daemonMountOrdinal()).toBe(0);
    expect(again.lines.join("\n")).toMatch(/remembered face did not stand/);
  });

  test("a pūlama that never answers the tell holds no custody act: the wear answers, and the next frame answers too", async () => {
    setMountedFace(0);
    const holder = {
      isUnlocked: () => true, attemptsLeft: () => 0, openedSlot: () => "pulama", unlockedFaces: () => ["fcid-0", "fcid-1"],
      faceStanding: async ({ ordinal }: { ordinal: number }) => ({ ordinal, fcid: `fcid-${ordinal}`, unlocked: true }),
    } as unknown as PulamaHolder;
    const door = custodyFrameHandler({
      holder, testScratch: false, standing: () => "hearth", onLog: () => {}, recompose: async () => ({ standing: "hearth" }),
      pulama: { standing: () => ({ session: true, waits: null }), dial: async () => ({ session: true, waits: null }), lent: () => [0, 1], tellWorn: () => new Promise<void>(() => {}) },
    });
    const send = (frame: unknown): Promise<Record<string, unknown>> => new Promise((resolve) => {
      const sock = Object.assign(new EventEmitter(), { end: (line: string) => resolve(JSON.parse(line) as Record<string, unknown>) }) as unknown as Socket;
      expect(door(frame, sock)).toBe(true);
    });
    expect(await send({ op: "wear", face: 1 })).toMatchObject({ op: "wear", face: 1, held: true });
    expect(await send({ op: "wear", face: 0 })).toMatchObject({ op: "wear", face: 0, held: true });
  });

  test("the worn op carries the ordinal and nothing else; the pūlama refuses an ordinal outside the session's lend, and a lock forgets", async () => {
    await standThree({ now: [0, 1] });
    const first = await boot();
    expect(await first.send({ op: "wear", face: 1 })).toMatchObject({ op: "wear", face: 1, held: true });
    const sent = wornLines().map((l) => JSON.parse(l) as Record<string, unknown>);
    expect(sent).toHaveLength(1);
    expect(Object.keys(sent[0]!).sort()).toEqual(["a", "id", "op", "t"]);
    expect(sent[0]!["a"]).toEqual({ ordinal: 1 });
    await expect(first.vessel.tellWorn(2)).rejects.toMatchObject({ reading: "outside-the-lei" });
    // The pūlama locks (its hand door, or its process ends): every key and the remembered ordinal go with it.
    if (seated) { unseatCustody(seated); seated = null; }
    await fx!.server.lock();
    await fx!.kept.adopt(fx!.treeKey);
    const after = await boot();
    expect(after.vessel.worn()).toBeUndefined();
    expect(mountedFaceOrdinal()).toBeUndefined();
  });

  test("an unlock that names a face writes no worn op: only the wear door tells the pūlama", async () => {
    await standThree({ now: [0, 1, 2] });
    const first = await boot();
    await first.send({ op: "unlock", all: true, face: 2 });
    expect(wornLines()).toEqual([]);
  });

  test("WELD: in the vessel's source, the worn op's name rides only the two ends of the channel, and its sender is called only inside the wear door", () => {
    const files = readdirSync(SRC).filter((f) => f.endsWith(".ts"));
    const naming = files.filter((f) => readFileSync(join(SRC, f), "utf8").includes('"face.worn"'));
    expect(naming.sort()).toEqual(["pulama-holder.ts", "pulama-server.ts"]);
    const calling = files.filter((f) => /\.tellWorn\(/.test(readFileSync(join(SRC, f), "utf8")));
    expect(calling.sort()).toEqual(["custody-frames.ts", "main.ts"]);
    const frames = readFileSync(join(SRC, "custody-frames.ts"), "utf8");
    const wear = frames.slice(frames.indexOf("const wear = composing("), frames.indexOf("`lock --face N`"));
    expect(frames.split(".tellWorn(").length - 1).toBe(wear.split(".tellWorn(").length - 1);
    expect(wear.includes(".tellWorn(")).toBe(true);
    const main = readFileSync(join(SRC, "main.ts"), "utf8");
    expect(main.match(/\.tellWorn\(/g)).toHaveLength(1);
    expect(main.includes("tellWorn: (o) => pulama.tellWorn(o)")).toBe(true);
  });
});
