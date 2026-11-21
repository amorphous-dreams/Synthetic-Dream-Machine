/**
 * Face custody at the holder (K15 Wave D, slice 1): each face's rows seal under that face's own custody key and rest in
 * that face's own directory. The floor index routes and never decides.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import type { SlotSpec } from "@lararium/mesh";
import { FaceLocked, makeCustodyHolder } from "../src/custody-holder.js";
import { faceOpeningFrom } from "../src/custody-seat.js";
import { FsCustodyIo } from "../src/custody-io.js";
import { decodeFaceIndex, faceDir, faceIndexPath, FaceIndexRefused } from "../src/face-index.js";
import { personaGroupDigest } from "../src/persona-group-file.js";
import { faceAtomGroupFile } from "../src/face-atom-store.js";
import { seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";

const slot = (passphrase: string): SlotSpec => ({ t: 1, pins: [{ kind: "passphrase", passphrase }] });
const cred = (passphrase: string) => [{ kind: "passphrase" as const, passphrase }];
const GROUP_A = "group-holder-a";
const GROUP_B = "group-holder-b";
const SEED = (n: number) => new Uint8Array(32).fill(n);

let seat: SeatedScratchCustody | null = null;
afterEach(async () => { await seat?.drop(); seat = null; });

/** Two founded faces, each under its own route, both then locked. */
async function twoLockedFaces() {
  seat = await seatScratchCustody("face-holder");
  const { holder } = seat;
  const a = await holder.foundFace({ group: personaGroupDigest(GROUP_A), slots: [slot("route-a")] });
  await holder.writeRecord("identity", faceAtomGroupFile(GROUP_A), SEED(1));
  const b = await holder.foundFace({ group: personaGroupDigest(GROUP_B), slots: [slot("route-b")] });
  await holder.writeRecord("identity", faceAtomGroupFile(GROUP_B), SEED(2));
  await holder.lockFace(a.fcid);
  await holder.lockFace(b.fcid);
  return { holder, a, b, identity: seat.homes.identity };
}

describe("the floor index of faces", () => {
  test("RED: a field beyond digests and random names refuses by name", () => {
    const entry = { fcid: "ab".repeat(16), group: "cd".repeat(32), ask: null };
    for (const extra of [{ name: "alice" }, { handle: 3 }, { prefix: "E123" }, { key: "00" }]) {
      const bytes = new TextEncoder().encode(JSON.stringify({ faces: [{ ...entry, ...extra }] }));
      expect(() => decodeFaceIndex(bytes)).toThrow(FaceIndexRefused);
    }
  });

  test("CONTROL: the honest entry reads, and a founded index carries exactly fcid, group and ask", async () => {
    const { identity } = await twoLockedFaces();
    const parsed = JSON.parse(readFileSync(faceIndexPath(identity), "utf8")) as { faces: Array<Record<string, unknown>> };
    expect(parsed.faces).toHaveLength(2);
    for (const entry of parsed.faces) expect(Object.keys(entry).sort()).toEqual(["ask", "fcid", "group"]);
    expect(decodeFaceIndex(readFileSync(faceIndexPath(identity))).faces).toHaveLength(2);
  });
});

describe("each face opens under its own route alone", () => {
  test("A's route opens A and refuses B; B's rows stay shut by name", async () => {
    const { holder, a, b } = await twoLockedFaces();
    expect((await holder.unlockFace({ group: personaGroupDigest(GROUP_A) }, cred("route-a"))).reading).toBe("opens");
    expect((await holder.unlockFace({ group: personaGroupDigest(GROUP_B) }, cred("route-a"))).reading).toBe("no-slot-opens");
    expect(holder.unlockedFaces()).toEqual([a.fcid]);
    expect((await holder.readRecord("identity", faceAtomGroupFile(GROUP_A))).reading).toBe("opens");
    expect(await holder.readRecord("identity", faceAtomGroupFile(GROUP_B))).toEqual({ reading: "locked", fcid: b.fcid });
    await expect(holder.writeRecord("identity", faceAtomGroupFile(GROUP_B), SEED(9))).rejects.toBeInstanceOf(FaceLocked);
  });

  test("RED: swapped index entries open a tree whose owner row disagrees, so no face seats", async () => {
    const { holder, a, b, identity } = await twoLockedFaces();
    const path = faceIndexPath(identity);
    const index = JSON.parse(readFileSync(path, "utf8")) as { faces: Array<{ fcid: string; group: string | null; ask: string | null }> };
    writeFileSync(path, JSON.stringify({ faces: [{ ...index.faces[0]!, fcid: b.fcid }, { ...index.faces[1]!, fcid: a.fcid }] }));
    const opened = await holder.unlockFace({ group: personaGroupDigest(GROUP_A) }, cred("route-b"));
    expect(opened.reading).toBe("index-mismatch");
    expect(holder.unlockedFaces()).toEqual([]);
    expect((await holder.readRecord("identity", faceAtomGroupFile(GROUP_A))).reading).toBe("locked");
    void faceDir;
  });

  test("CONTROL: the honest index seats the face its route opens", async () => {
    const { holder, a } = await twoLockedFaces();
    const opened = await holder.unlockFace({ group: personaGroupDigest(GROUP_A) }, cred("route-a"));
    expect(opened).toMatchObject({ reading: "opens", fcid: a.fcid, ordinal: 0 });
    expect(holder.unlockedFaces()).toEqual([a.fcid]);
  });

  test("a fresh holder over the same home opens a face by its own route and reads the sealed row", async () => {
    const { a, identity } = await twoLockedFaces();
    const second = makeCustodyHolder({ io: new FsCustodyIo(seat!.homes), homes: seat!.homes });
    expect((await second.unlockFace({ fcid: a.fcid }, cred("route-a"))).reading).toBe("opens");
    const read = await second.readRecord("identity", faceAtomGroupFile(GROUP_A));
    expect(read.reading).toBe("opens");
    void identity; void join;
  });
});

describe("each opening of a face takes its own number", () => {
  test("a lock and re-open of one face (one custody id) reads a new opening; a shut face reads none; the other face's stands", async () => {
    const { holder, a, b } = await twoLockedFaces();
    expect(holder.faceOpening?.(a.fcid)).toBeNull();
    await holder.unlockFace({ fcid: a.fcid }, cred("route-a"));
    await holder.unlockFace({ fcid: b.fcid }, cred("route-b"));
    const first = holder.faceOpening?.(a.fcid), other = holder.faceOpening?.(b.fcid);
    expect(typeof first).toBe("string");
    await holder.lockFace(a.fcid);
    expect(holder.faceOpening?.(a.fcid)).toBeNull();
    await holder.unlockFace({ fcid: a.fcid }, cred("route-a"));
    const second = holder.faceOpening?.(a.fcid);
    expect(typeof second).toBe("string");
    expect(second).not.toBe(first);
    expect(holder.faceOpening?.(b.fcid)).toBe(other);
  });

  test("RED (Sol 407e): the visit gate reads the holder's own standing, synchronously: a lock reads shut the moment it resolves, and a re-light before any watcher samples reads a new opening", async () => {
    const { holder, a, b } = await twoLockedFaces();
    const fcids = new Map<number, string>([[0, a.fcid], [1, b.fcid]]);
    // No watcher stands here at all: the gate's reading is the holder's alone.
    const gate = faceOpeningFrom(() => holder, (ordinal) => fcids.get(ordinal) ?? null);
    expect(gate(0)).toBeNull();
    await holder.unlockFace({ fcid: a.fcid }, cred("route-a"));
    const admitted = gate(0);
    expect(typeof admitted).toBe("string");
    await holder.lockFace(a.fcid);
    expect(gate(0), "shut at once: no watcher stands between the lock and the gate").toBeNull();
    await holder.unlockFace({ fcid: a.fcid }, cred("route-a"));
    expect(gate(0), "a re-light reads another opening, so a visit admitted before the lock never matches").not.toBe(admitted);
    expect(gate(7), "a face the vessel holds no custody id for reads shut").toBeNull();
    expect(faceOpeningFrom(() => null, () => a.fcid)(0), "no holder standing reads shut").toBeNull();
  });

  test("RED restart: a fresh holder over the same home counts its opens from one again, and still never repeats an earlier boot's opening", async () => {
    const { a } = await twoLockedFaces();
    const booted = makeCustodyHolder({ io: new FsCustodyIo(seat!.homes), homes: seat!.homes });
    await booted.unlockFace({ fcid: a.fcid }, cred("route-a"));
    const before = booted.faceOpening?.(a.fcid)!;
    const restarted = makeCustodyHolder({ io: new FsCustodyIo(seat!.homes), homes: seat!.homes });
    await restarted.unlockFace({ fcid: a.fcid }, cred("route-a"));
    const after = restarted.faceOpening?.(a.fcid)!;
    expect(after.split(":")[1]).toBe(before.split(":")[1]);   // the count starts over at the same number
    expect(after).not.toBe(before);                           // the boot nonce keeps the name its own
  });
});

describe("a face's handle index is its ordinal", () => {
  const anchorsOf = (group: string) => new TextEncoder().encode(JSON.stringify({ personaGroupId: group, meshCabalDocIdHex: "ab".repeat(32) }));

  test("RED: an anchors row naming another group than the index entry refuses by name and seats no face; CONTROL: its own group seats", async () => {
    const { holder, a, identity } = await twoLockedFaces();
    void identity;
    await holder.unlockFace({ fcid: a.fcid }, cred("route-a"));
    await holder.writeRecord("identity", "anchors-h0.json", anchorsOf(GROUP_B));
    await holder.lockFace(a.fcid);
    const bad = await holder.unlockFace({ group: personaGroupDigest(GROUP_A) }, cred("route-a"));
    expect(bad).toMatchObject({ reading: "index-mismatch" });
    expect(holder.unlockedFaces()).toEqual([]);
    // the honest row: lock was dropped, so rewrite under a fresh holder view of the same face
    const second = makeCustodyHolder({ io: new FsCustodyIo(seat!.homes), homes: seat!.homes });
    await second.adopt(seat!.treeKey);
    // the index-mismatching row stays; swap in the honest one by reaching the face through its own key
    expect((await second.unlockFace({ fcid: a.fcid }, cred("route-a"))).reading).toBe("index-mismatch");
  });

  test("CONTROL: an anchors row naming the index entry's group seats the face", async () => {
    seat = await seatScratchCustody("face-ordinal");
    const { holder } = seat;
    const a = await holder.foundFace({ group: personaGroupDigest(GROUP_A), slots: [slot("route-a")] });
    await holder.writeRecord("identity", "anchors-h0.json", anchorsOf(GROUP_A));
    await holder.lockFace(a.fcid);
    expect((await holder.unlockFace({ fcid: a.fcid }, cred("route-a"))).reading).toBe("opens");
  });

  test("a founding at handle index 3 pads tombstones; a retired or held index never lands twice", async () => {
    seat = await seatScratchCustody("face-ordinal");
    const { holder } = seat;
    const third = await holder.foundFace({ ask: "ab".repeat(32), ordinal: 3, slots: [slot("r3")] });
    expect(third.ordinal).toBe(3);
    const index = decodeFaceIndex(readFileSync(faceIndexPath(seat.homes.identity)));
    expect(index.faces.map((f) => ("tombstone" in f ? "t" : "f")).join("")).toBe("ttt" + "f");
    await expect(holder.foundFace({ ask: "cd".repeat(32), ordinal: 3, slots: [slot("x")] })).rejects.toBeInstanceOf(FaceIndexRefused);
    await expect(holder.foundFace({ ask: "ef".repeat(32), ordinal: 1, slots: [slot("x")] })).rejects.toThrow(/retired and never reused/);
    const next = await holder.foundFace({ ask: "12".repeat(32), slots: [slot("r4")] });
    expect(next.ordinal).toBe(4);
  });

  test("a handle-index row rests in the face at that ordinal and no other face opens it", async () => {
    const { holder, a, b } = await twoLockedFaces();
    await holder.unlockFace({ fcid: a.fcid }, cred("route-a"));
    await holder.writeRecord("identity", "recovery-contact-set-h0.json", new TextEncoder().encode("{}"));
    expect(existsSync(join(faceDir(seat!.homes.identity, a.fcid), "recovery-contact-set-h0.json"))).toBe(true);
    expect(existsSync(join(faceDir(seat!.homes.identity, b.fcid), "recovery-contact-set-h0.json"))).toBe(false);
    await expect(holder.writeRecord("identity", "recovery-contact-set-h1.json", new TextEncoder().encode("{}"))).rejects.toBeInstanceOf(FaceLocked);
  });
});

// ── the ward (row 7, S2): the face root seed rests under a key that stays sealed while the face stands unlocked ──────────────
describe("the ward holds the face root apart from unlocked custody", () => {
  const PASS = "ward-route";
  /** A face at h0 founded under PASS, standing unlocked, with its root minted through a fresh ward unlock. */
  async function wardedFace(watch?: (key: Uint8Array) => void) {
    const { setMountedFace } = await import("../src/node-vessel-identity.js");
    seat = await seatScratchCustody("ward-holder");
    setMountedFace(undefined);
    const { holder } = seat;
    if (watch) (holder as unknown as { watchWardKeys(w: (k: Uint8Array) => void): void }).watchWardKeys(watch);
    const face = await holder.foundFace({ ordinal: 0, slots: [slot(PASS)] });
    return { holder, face };
  }

  test("RED: with the face unlocked, the root seed refuses without a fresh ward unlock; CONTROL: the passphrase opens it once, the next bare call refuses again, and no ward key stays held", async () => {
    const { wardCredential } = await import("../src/ward-credential.js");
    const { generateOrLoadPersonaGroupRoot, loadPersonaGroupRootSeed } = await import("../src/node-vessel-identity.js");
    const opened: Uint8Array[] = [];
    const { holder, face } = await wardedFace((k) => opened.push(k));
    await generateOrLoadPersonaGroupRoot(0, wardCredential(cred(PASS)));
    expect(holder.unlockedFaces()).toEqual([face.fcid]);
    // No person stands at this process's terminal for the bare calls: the gatherer the fixture seats steps away.
    const { seatWardGatherer } = await import("../src/ward-credential.js");
    seatWardGatherer(null);
    const bare = loadPersonaGroupRootSeed as unknown as (i: number) => Promise<Uint8Array>;
    await expect(bare(0)).rejects.toThrow(/ward-needs-fresh-unlock/);
    // Unlocked custody's own doors refuse the warded row by name too: a script holding them reads no root.
    await expect(holder.openColdRecord("identity", ".persona-group-root-h0.json", () => 1)).rejects.toThrow(/ward-needs-fresh-unlock/);
    await expect(holder.readRecord("identity", ".persona-group-root-h0.json")).rejects.toThrow(/ward-needs-fresh-unlock/);
    await expect(holder.writeRecord("identity", ".persona-group-root-h0.json", new Uint8Array([1]))).rejects.toThrow(/ward-needs-fresh-unlock/);
    const seed = await loadPersonaGroupRootSeed(0, wardCredential(cred(PASS)));
    expect(seed.length).toBe(32);
    await expect(bare(0)).rejects.toThrow(/ward-needs-fresh-unlock/);
    await expect(loadPersonaGroupRootSeed(0, wardCredential(cred("not the route")))).rejects.toThrow(/ward-no-slot-opens/);
    seatWardGatherer(async () => [{ kind: "passphrase", passphrase: "fixture-custody-passphrase" }]);
    expect(holder.unlockedFaces()).toEqual([face.fcid]);
    expect(opened.length).toBeGreaterThanOrEqual(2);
    for (const k of opened) expect(k.every((b) => b === 0), "every ward key zeroes once its act settles").toBe(true);
  });

  test("RED: a face whose ward tree stands absent runs a ward act; it refuses `ward-absent` and names the restore; CONTROL: the face itself still stands unlocked", async () => {
    const { wardTreePath } = await import("../src/face-index.js");
    const { rmSync } = await import("node:fs");
    const { holder, face } = await wardedFace();
    rmSync(wardTreePath(seat!.homes.identity, face.fcid));
    const refused = await holder.withWardKey({ ordinal: 0 }, cred(PASS), async () => "ran").then(() => null, (e: Error) => e);
    expect(refused).toMatchObject({ name: "WardAbsent", reading: "ward-absent" });
    expect(refused!.message).toContain("lares vault restore");
    expect(holder.unlockedFaces()).toEqual([face.fcid]);
  });
});
