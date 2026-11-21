/**
 * surface-worn-face — `lares surface open` and `surface face` act as the WORN face when no `--face` names one.
 *
 * Several faces may stand open while one stands worn (the daemon mount, `lares wear N`); the door reads the worn face
 * (`face.resolve` with `worn`), never the bare one-open-face resolution that refuses whenever several stand open. A
 * named face keeps riding as named.
 */
import { afterEach, describe, expect, test, vi } from "vitest";

const seam = vi.hoisted(() => ({ calls: [] as Array<[string, Record<string, unknown>]> }));
vi.mock("../src/sealed-act-door.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/sealed-act-door.js")>();
  return { ...actual, sealedAct: vi.fn(async (act: string, args: Record<string, unknown>) => { seam.calls.push([act, args]); return { face: 0 }; }) };
});
vi.mock("@lararium/mesh", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@lararium/mesh")>();
  return { ...actual, ownPersonaPetname: vi.fn(async () => "Heron Lantern") };
});

import { LIVE_SURFACE_DOORS } from "../src/commands/surface.js";
import type { ParsedArgs } from "../src/parse-args.js";

const argsOf = (options: Record<string, string> = {}): ParsedArgs => ({ command: "surface", positional: ["open"], options, flags: {} }) as ParsedArgs;

afterEach(() => { seam.calls.length = 0; });

describe("the face `lares surface` acts as", () => {
  test("★ no --face: the door asks the vessel for the WORN face ★", async () => {
    expect(await LIVE_SURFACE_DOORS.face(argsOf())).toEqual({ index: 0, petname: "Heron Lantern" });
    expect(seam.calls).toEqual([["face.resolve", { worn: true }]]);
  });

  test("--face N rides as named and asks no resolution", async () => {
    expect((await LIVE_SURFACE_DOORS.face(argsOf({ face: "2" }))).index).toBe(2);
    expect(seam.calls).toEqual([]);
  });
});
