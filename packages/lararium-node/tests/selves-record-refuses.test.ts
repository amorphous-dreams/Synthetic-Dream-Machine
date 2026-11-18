/**
 * selves-record-refuses — W4 (persona-selves-sealed#/witnesses): before the lift, or while the record maps clear, the
 * write refuses by name.
 *
 *   R1  the record maps `shut` (its face stands unlifted): a name and a clear both refuse, naming the lift, and the record's
 *       document never opens; the read answers no name.
 *   R2  the record maps `clear`: a name refuses, naming the clear rest; a clear runs, since it moves no name onto the rest.
 *   R3  CONTROL: the record maps `sealed`: the name lands and reads back.
 */
import { describe, expect, test } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { emptyLarDoc, selvesRecordOf, type LarDoc } from "@lararium/mesh";
import { repoPersonaSelvesPlane } from "../src/persona-selves-plane.js";
import type { PlaneRest } from "../src/sealed-acts.js";

const G = "f6".repeat(16);
const RECORD = selvesRecordOf(G);

function standing(first: PlaneRest) {
  const repo = new Repo({});
  const plane = repo.create<LarDoc>(emptyLarDoc());
  const cell = { rest: first };
  const selves = repoPersonaSelvesPlane(repo, [{ personaGroupId: G, url: plane.url }], async () => [{ handleIndex: 0, personaGroupId: G }], { restOf: () => cell.rest });
  const recordOpened = (): boolean => (repo.handles as Record<string, unknown>)[RECORD.url.slice("automerge:".length)] !== undefined;
  return { repo, plane, selves, cell, recordOpened };
}

describe("W4 — the selves record takes no name before the lift or on a clear rest", () => {
  test("R1 — shut: a name and a clear refuse by the lift, and the record never opens", async () => {
    const { selves, recordOpened } = standing("shut");
    expect(selves.rest).toBe("shut");
    await expect(selves.write(0, "petname", "a-name-before-the-lift")).rejects.toThrow(/h0's selves record stays sealed until its face lifts/);
    await expect(selves.write(0, "petname", "")).rejects.toThrow(/until its face lifts/);
    expect(await selves.read()).toEqual([]);
    expect(recordOpened(), "the shut record's document opened").toBe(false);
  });

  test("R2 — clear: a name refuses by the clear rest; a clear still runs", async () => {
    // A name the record took while it sealed, and the map then names it clear (an older vessel's rest).
    const { repo, selves, cell } = standing("sealed");
    expect(await selves.write(0, "petname", "an-older-vessels-name")).toEqual({ written: true, plane: true });
    cell.rest = "clear";
    expect(selves.rest).toBe("clear");
    await expect(selves.write(0, "petname", "a-name-onto-a-clear-rest")).rejects.toThrow(/h0's selves record rests in the clear/);
    expect(await selves.read(), "a clear record's names answer nobody").toEqual([]);
    // The clear runs: it moves no name onto the rest, and removes the one standing there.
    expect(await selves.write(0, "petname", "")).toEqual({ written: true, plane: true });
    const record = await repo.find<LarDoc>(RECORD.url as never);
    expect(JSON.stringify(record.doc()).includes("an-older-vessels-name")).toBe(false);
    expect(JSON.stringify(record.doc()).includes("a-name-onto-a-clear-rest")).toBe(false);
  });

  test("R3 — CONTROL: sealed: the name lands and reads back", async () => {
    const { selves } = standing("sealed");
    expect(selves.rest).toBe("sealed");
    expect(await selves.write(0, "petname", "a-sealed-name")).toEqual({ written: true, plane: true });
    expect(await selves.read()).toEqual([{ handleIndex: 0, petname: "a-sealed-name" }]);
  });
});
