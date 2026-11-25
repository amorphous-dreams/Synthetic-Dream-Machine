/**
 * sibling-seat-cleans-on-throw — Hearth-Reader-II's F5 (course held-saves-edges): `standSiblingSeat` lit the face's entry, then
 * seated its holder, and only then registered the cleanup that drops the entry when the identity leaves. A `seatOfFace` that threw
 * left the half-made entry standing: the light's catch disposes the provider and clears its own maps, yet `faces` kept the entry,
 * whose `seat` never stood. The cleanup registers BEFORE the seat stands, so a throw there drops the entry with the identity.
 * The island composes this inside its behaviour (no port reaches it alone), so the weld reads the source order, as SH4 does.
 */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("a sibling's half-made seat leaves with its identity", () => {
  test("RED: standSiblingSeat registers the entry's cleanup before seatOfFace runs", () => {
    const src = readFileSync(join(import.meta.dirname, "..", "src", "operator-daemon-behavior.ts"), "utf8");
    const at = src.indexOf("const standSiblingSeat = ");
    expect(at, "standSiblingSeat stands").toBeGreaterThan(0);
    const body = src.slice(at, src.indexOf("\n  };", at));
    const cleanup = body.indexOf("keyhive.whenDisposed(() => { if (faces.lit(key) === entry) faces.drop(key); });");
    const seat = body.indexOf("entry.seat = seatOfFace(");
    expect(cleanup, "the cleanup registers").toBeGreaterThan(0);
    expect(seat, "the seat stands").toBeGreaterThan(0);
    expect(cleanup, "the cleanup registers before the seat can throw").toBeLessThan(seat);
  });
});
