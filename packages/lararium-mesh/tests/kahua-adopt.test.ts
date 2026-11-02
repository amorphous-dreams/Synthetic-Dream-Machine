/**
 * kahua-adopt — the stage a device mounts reads off the face's verified pin; a catalog row stays a mount hint only.
 *
 * SECURITY CLASS (authority input: the catalog row, the projection's pin). Reds: a pinned face mounts its pin, with or
 * without an agreeing row. Controls: a row naming another document refuses by name and mounts nothing; a row with no
 * pin behind it refuses the same; a face with no pin and no row stands the layer absent, by name.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { describe, expect, test } from "vitest";
import { adoptKahuaPlane, adoptedKahuaUrl, KAHUA_PLANE } from "../src/index.js";

const PIN = "automerge:kahuaPinned";
const pinned = { planes: { intents: "automerge:intents", [KAHUA_PLANE]: PIN } };
const unpinned = { planes: { intents: "automerge:intents" } };

describe("a device adopts the face's kahua stage from its verified pin", () => {
  test("RED: the pin mounts, with no row and with an agreeing row", () => {
    expect(adoptKahuaPlane(pinned, null)).toEqual({ mount: PIN });
    expect(adoptKahuaPlane(pinned, undefined)).toEqual({ mount: PIN });
    expect(adoptKahuaPlane(pinned, PIN)).toEqual({ mount: PIN });
    expect(adoptedKahuaUrl(adoptKahuaPlane(pinned, PIN))).toBe(PIN);
  });

  test("CONTROL: a catalog row naming another document than the pin refuses by name and mounts nothing", () => {
    const r = adoptKahuaPlane(pinned, "automerge:forged");
    expect(r).toEqual({ refused: "kahua-catalog-mismatch", catalog: "automerge:forged", pinned: PIN });
    expect(adoptedKahuaUrl(r)).toBeNull();
  });

  test("CONTROL: a catalog row with no pin behind it refuses by name and mounts nothing", () => {
    const r = adoptKahuaPlane(unpinned, "automerge:forged");
    expect(r).toEqual({ refused: "kahua-catalog-mismatch", catalog: "automerge:forged", pinned: null });
    expect(adoptedKahuaUrl(r)).toBeNull();
  });

  test("CONTROL: a face with no pinned kahua stands the layer absent, by name, never a throw", () => {
    expect(adoptKahuaPlane(unpinned, null)).toEqual({ absent: "kahua-unpinned" });
    expect(adoptKahuaPlane(unpinned, "")).toEqual({ absent: "kahua-unpinned" });
    expect(adoptedKahuaUrl(adoptKahuaPlane(unpinned, null))).toBeNull();
  });
});
