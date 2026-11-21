/**
 * pulama-rehive — the pūlama's hand door rehives a SHUT face: the house that runs under a pūlama rehives where its keys rest.
 *
 *   P1  a face lit at the pūlama refuses `face-open` (the answer names `pulama lock`), and nothing moves.
 *   P2  after `lock` (every face shut, the pūlama unlit), the face's own route rehives it: the foreign row's bytes rest aside, the
 *       marker replaces the row, nothing lights, and the answer's lines name the pūlama-path wear (`pulama light`, `vault unlock`,
 *       `wear N`). A route that opens no slot of the face refuses `face-refused` and spends the face's own attempt.
 *   P3  `light` and `rehive` ride the hand door's one chain: a light sent while a rehive runs answers only after it.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { InMemoryEventStore, KeyhiveProvider } from "@lararium/keyhive";
import { FsCustodyIo } from "../src/custody-io.js";
import { makeCustodyHolder } from "../src/custody-holder.js";
import { rehiveShutFace } from "../src/face-rehive.js";
import { rehiveMarkerAside, veilArchiveFile } from "../src/identity-anchors.js";
import { pulamaHandDoor } from "../src/pulama-hand.js";
import { servePulama } from "../src/pulama-server.js";
import { pulamaImage, pulamaRecords } from "../src/pulama-state.js";
import { personaGroupDigest } from "../src/persona-group-file.js";
import { FIXTURE_PASSPHRASE } from "./custody-seat-fixture.js";
import { SESSION_DERIVES, fixtureSlots, lend, openGate, standPulama, type PulamaFixture } from "./pulama-fixture.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

vi.setConfig({ testTimeout: 180_000 });

let fx: PulamaFixture | null = null;
const dirs: string[] = [];
afterEach(async () => { await fx?.drop(); fx = null; for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

const GROUP = "group-rehive-at-the-pulama";
const ROUTE = [{ kind: "passphrase" as const, passphrase: FIXTURE_PASSPHRASE }];

async function archiveOf(seed: Uint8Array): Promise<Uint8Array> {
  const p = new KeyhiveProvider();
  try { await p.init({ seed, eventStore: new InMemoryEventStore() }); return await p.exportArchiveAfterTheCard(); } finally { await p.dispose(); }
}

/** A pūlama over a hearth whose face h0 keeps its atom while its veil-archive row holds another identity's Archive (h1's shape). */
async function misroutedPulama(rehive?: (o: number, c: readonly { kind: "passphrase"; passphrase: string }[]) => Promise<never>) {
  fx = await standPulama("pulama-rehive", () => openGate({ faces: lend(0), coldReads: [] }));
  const digest = personaGroupDigest(GROUP);
  await fx.kept.foundFace({ group: digest, ordinal: 0, slots: fixtureSlots });
  const seed = new Uint8Array(32).fill(0x31);
  await fx.kept.writeRecord("identity", `face-atom-g${digest}.bin`, seed);
  await fx.kept.writeRecord("identity", "anchors-h0.json", new TextEncoder().encode(JSON.stringify({ personaGroupId: GROUP, meshCabalDocIdHex: "ab" })));
  const foreign = await archiveOf(new Uint8Array(32).fill(0x77));
  await fx.kept.writeRecord("identity", veilArchiveFile(GROUP), foreign);
  // The pūlama's own start: a fresh holder over the hearth, as `pulama-main serve` stands it.
  const holder = makeCustodyHolder({ io: new FsCustodyIo(fx.seat.homes), homes: fx.seat.homes });
  const server = servePulama({ holder, gate: openGate({ faces: lend(0), coldReads: [] }), derives: SESSION_DERIVES });
  const dir = mkdtempSync(join(tmpdir(), "lar-pulama-rehive-")); dirs.push(dir);
  const lines: string[] = [];
  const door = pulamaHandDoor({
    holder, server, image: pulamaImage(dir), records: pulamaRecords(dir), onLog: (l) => lines.push(l),
    rehive: rehive ?? ((ordinal, credentials) => rehiveShutFace({ holder, io: new FsCustodyIo(fx!.seat.homes), ordinal, credentials })),
  });
  return { holder, door, foreign, lines };
}
const rowOf = async (): Promise<Uint8Array | null> => {
  const r = await fx!.kept.readRecord("identity", veilArchiveFile(GROUP));
  return r.reading === "opens" ? r.plaintext : null;
};

describe("the pūlama's hand door rehives a shut face", () => {
  test("P1 a face lit at the pūlama refuses face-open, naming pulama lock; nothing moves", async () => {
    const p = await misroutedPulama();
    expect(await p.door({ op: "light", credentials: ROUTE })).toMatchObject({ op: "light", reading: "opens" });
    const a = await p.door({ op: "rehive", face: 0, credentials: ROUTE });
    expect(a).toMatchObject({ op: "rehive", reading: "face-open", face: 0 });
    expect(String(a["detail"])).toContain("tools/lares-container.sh pulama lock");
    expect(Buffer.from((await rowOf())!).equals(Buffer.from(p.foreign))).toBe(true);
  });

  test("P2 after lock the face's own route rehives it, nothing lights, and the lines name the pūlama-path wear", async () => {
    const p = await misroutedPulama();
    await p.door({ op: "light", credentials: ROUTE });
    expect(await p.door({ op: "lock" })).toMatchObject({ op: "lock", lit: false });
    const wrong = await p.door({ op: "rehive", face: 0, credentials: [{ kind: "passphrase", passphrase: "not-this-face's-route" }] });
    expect(wrong).toMatchObject({ op: "rehive", reading: "face-refused" });
    expect(String(wrong["detail"])).toMatch(/attempt\(s\) left this boot for this face/);
    const a = await p.door({ op: "rehive", face: 0, credentials: ROUTE });
    expect(a).toMatchObject({ op: "rehive", reading: "rehived", face: 0, outcome: "stood-from-seed", personaGroup: GROUP });
    expect(p.holder.isUnlocked(), "a rehive lights nothing").toBe(false);
    expect(p.holder.unlockedFaces()).toEqual([]);
    const row = (await rowOf())!;
    expect(rehiveMarkerAside(row), "the marker stands in the row").toBe(a["aside"]);
    const lines = (a["lines"] as string[]).join("\n");
    expect(lines).toContain("tools/lares-container.sh pulama light");
    expect(lines).toContain("tools/lares-container.sh vault unlock");
    expect(lines).toContain("tools/lares-container.sh wear 0");
    expect(lines).not.toContain("lares vault unlock --all --face");
    expect(JSON.stringify([a, p.lines])).not.toContain(FIXTURE_PASSPHRASE);
  });

  test("P3 a light sent while a rehive runs answers only after it: one chain", async () => {
    let release!: () => void;
    const held = new Promise<void>((r) => { release = r; });
    const order: string[] = [];
    const p = await misroutedPulama(async () => { await held; order.push("rehive"); throw Object.assign(new Error("stopped for the probe"), { reason: "probe" }); });
    const rehiving = p.door({ op: "rehive", face: 0, credentials: ROUTE }).then((a) => { order.push(`rehive-answered:${String(a["reading"])}`); });
    const lighting = p.door({ op: "light", credentials: ROUTE }).then(() => { order.push("light-answered"); });
    await new Promise((r) => setTimeout(r, 50));
    expect(order, "the light waits behind the rehive").toEqual([]);
    release();
    await Promise.all([rehiving, lighting]);
    expect(order).toEqual(["rehive", "rehive-answered:probe", "light-answered"]);
  });
});
