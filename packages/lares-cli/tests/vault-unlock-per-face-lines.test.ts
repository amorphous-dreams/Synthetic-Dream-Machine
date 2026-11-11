/**
 * THE UNLOCK ANSWERS HONESTLY, PER FACE. `lares vault unlock --all` names the faces the route opened and those that stayed shut,
 * each shut face with the act that opens it; a switch whose composition refused names the face worn again and the key held.
 */
import { describe, expect, test } from "vitest";
import { unlockFaceLines } from "../src/commands/vault.js";

describe("vault unlock's per-face lines", () => {
  test("`--all`: opened h0; h1, h2 did not open under this route — run `lares vault unlock --face N` for each", () => {
    const line = unlockFaceLines({ op: "unlock", reading: "opens", faceReadings: [
      { face: 0, reading: "opened" }, { face: 1, reading: "stayed-shut:no-slot-opens" }, { face: 2, reading: "stayed-shut:no-slot-opens" },
    ] });
    expect(line).toBe(" opened h0; h1, h2 did not open under this route — run `lares vault unlock --face N` for each.");
  });

  test("a refused switch names the face it named, the face worn again, and the key held", () => {
    const line = unlockFaceLines({ op: "unlock", reading: "already-unlocked", switchRefused: "h1 would not stand", face: 1, wornAgain: 0 });
    expect(line).toMatch(/h1 did not stand \(h1 would not stand\); h0 stands worn again, and the vessel key stays held/);
  });

  test("CONTROL: a plain unlock adds nothing", () => {
    expect(unlockFaceLines({ op: "unlock", reading: "opens" })).toBe("");
  });
});
