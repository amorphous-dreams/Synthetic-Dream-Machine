/**
 * K15 Wave D, slice 2: the roster family and the recognition book rest one row per face. A locked face lists by its public
 * index alone; the worn face is session state; each face's handle-book sits in its own row.
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { HandleBook } from "@lararium/mesh";
import { generateOrLoadPersonaGroupRoot, listPersonaRoots, loadActivePersonaIndex, makeNodePersonaPetnameStore, setWornFaceInSession, wearPersona } from "../src/node-vessel-identity.js";
import { loadNodeHandleBook, saveNodeHandleBook, handleBookFile } from "../src/node-circle-store.js";
import { listFaceOrdinals } from "../src/identity-anchors.js";
import { faceDir } from "../src/face-index.js";
import { seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";

let seat: SeatedScratchCustody | null = null;
afterEach(async () => { setWornFaceInSession(undefined); await seat?.drop(); seat = null; });

async function twoFaces() {
  seat = await seatScratchCustody("per-face");
  await generateOrLoadPersonaGroupRoot(0);
  await generateOrLoadPersonaGroupRoot(1);
  const petnames = await makeNodePersonaPetnameStore();
  await petnames.set(0, "first");
  await petnames.set(1, "second");
  const index = (await seat.holder.faceStanding({ ordinal: 1 }))!;
  return { seat, petnames, second: index.fcid };
}

describe("the roster family rests one row per face", () => {
  test("RED: a locked face lists by its public index alone, and its name stays shut; CONTROL: unlocked, both show", async () => {
    const { seat: s, petnames, second } = await twoFaces();
    expect(listFaceOrdinals()).toEqual([0, 1]);
    await s.holder.lockFace(second);
    expect(await listPersonaRoots()).toEqual([0]);
    expect(await petnames.entries()).toEqual([[0, "first"]]);
    await expect(petnames.get(1)).rejects.toThrow(/rests unopened/);
    expect(listFaceOrdinals()).toEqual([0, 1]);              // the public list still names both
    await s.holder.unlockFace({ fcid: second }, [{ kind: "passphrase", passphrase: "fixture-custody-passphrase" }]);
    expect(await listPersonaRoots()).toEqual([0, 1]);
  });

  test("no shared roster, pet-name map or anchor roster stands at the identity home", async () => {
    const { seat: s } = await twoFaces();
    const flat = readdirSync(s.homes.identity);
    expect(flat.filter((n) => /persona-(roster|petnames|declarations|public-handles)|anchor-roster|active-persona|handle-book/.test(n))).toEqual([]);
    expect(existsSync(join(faceDir(s.homes.identity, (await s.holder.faceStanding({ ordinal: 0 }))!.fcid), ".persona-roster-h0.json"))).toBe(true);
  });
});

describe("the worn face is session state", () => {
  test("wearing writes no file; with two faces open and no choice nothing is worn; one open face is worn", async () => {
    const { seat: s, second } = await twoFaces();
    expect(await loadActivePersonaIndex()).toBeUndefined();
    await wearPersona(1);
    expect(await loadActivePersonaIndex()).toBe(1);
    expect(readdirSync(s.homes.identity).some((n) => n.startsWith(".active-persona"))).toBe(false);
    setWornFaceInSession(undefined);
    await s.holder.lockFace(second);
    expect(await loadActivePersonaIndex()).toBe(0);           // exactly one face stands open
  });
});

describe("each face keeps its own recognition book", () => {
  test("a book saved for face 0 reads in face 0 and is absent in face 1; its row rests in face 0's directory", async () => {
    const { seat: s } = await twoFaces();
    const book = new HandleBook();
    await saveNodeHandleBook(0, book);
    expect(existsSync(join(faceDir(s.homes.identity, (await s.holder.faceStanding({ ordinal: 0 }))!.fcid), handleBookFile(0)))).toBe(true);
    expect(existsSync(join(faceDir(s.homes.identity, (await s.holder.faceStanding({ ordinal: 1 }))!.fcid), handleBookFile(0)))).toBe(false);
    expect((await loadNodeHandleBook(1)).snapshot().records).toEqual([]);
  });
});
