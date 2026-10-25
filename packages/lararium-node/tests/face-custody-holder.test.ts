/**
 * Face custody at the holder (K15 Wave D, slice 1): each face's rows seal under that face's own custody key and rest in
 * that face's own directory. The floor index routes and never decides.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import type { SlotSpec } from "@lararium/mesh";
import { FaceLocked, makeCustodyHolder } from "../src/custody-holder.js";
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
  await holder.writeRow("identity", faceAtomGroupFile(GROUP_A), SEED(1));
  const b = await holder.foundFace({ group: personaGroupDigest(GROUP_B), slots: [slot("route-b")] });
  await holder.writeRow("identity", faceAtomGroupFile(GROUP_B), SEED(2));
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
    expect((await holder.readRow("identity", faceAtomGroupFile(GROUP_A))).reading).toBe("opens");
    expect(await holder.readRow("identity", faceAtomGroupFile(GROUP_B))).toEqual({ reading: "locked", fcid: b.fcid });
    await expect(holder.writeRow("identity", faceAtomGroupFile(GROUP_B), SEED(9))).rejects.toBeInstanceOf(FaceLocked);
  });

  test("RED: swapped index entries open a tree whose owner row disagrees, so no face seats", async () => {
    const { holder, a, b, identity } = await twoLockedFaces();
    const path = faceIndexPath(identity);
    const index = JSON.parse(readFileSync(path, "utf8")) as { faces: Array<{ fcid: string; group: string | null; ask: string | null }> };
    writeFileSync(path, JSON.stringify({ faces: [{ ...index.faces[0]!, fcid: b.fcid }, { ...index.faces[1]!, fcid: a.fcid }] }));
    const opened = await holder.unlockFace({ group: personaGroupDigest(GROUP_A) }, cred("route-b"));
    expect(opened.reading).toBe("index-mismatch");
    expect(holder.unlockedFaces()).toEqual([]);
    expect((await holder.readRow("identity", faceAtomGroupFile(GROUP_A))).reading).toBe("locked");
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
    const read = await second.readRow("identity", faceAtomGroupFile(GROUP_A));
    expect(read.reading).toBe("opens");
    void identity; void join;
  });
});
