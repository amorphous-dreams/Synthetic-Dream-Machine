import { describe, expect, it } from "vitest";
import { carrierTable } from "../src/vault-carriers.js";
import { faceAtomGroupFile } from "../src/face-atom-store.js";
import { faceAnchorGroupFile } from "../src/face-anchor-store.js";

describe("the face atom carrier", () => {
  it("rests as a hot, local D row named by a group digest", () => {
    const row = carrierTable().find((candidate) => candidate.row === "face-atom");
    expect(row).toBeDefined();
    expect(row).toMatchObject({
      home: "identity", custody: "hot", keyClass: "device-minted",
      writer: "face-atom-store", bundle: "stays",
      target: { classes: ["D"], lead: false, joint: null },
    });
    const match = row!.match.exec(`face-atom-g${"a".repeat(64)}.bin`);
    expect(match).not.toBeNull();
    expect(row!.name(match!)).toBe(`face-atom-g${"a".repeat(64)}`);
    expect(row!.face(match!)).toBe(`group:${"a".repeat(64)}`);
    const named = faceAtomGroupFile("clear-persona-group");
    expect(named).toMatch(/^face-atom-g[0-9a-f]{64}\.bin$/);
    expect(named).not.toContain("clear-persona-group");
    expect(row!.match.test(named)).toBe(true);
  });
});

describe("the face anchor carrier", () => {
  it("CONTROL: rests as a local D row named by the PersonaGroup digest", () => {
    const row = carrierTable().find((candidate) => candidate.row === "face-anchor");
    const file = faceAnchorGroupFile("clear-persona-group");
    expect(file).toMatch(/^face-anchor-g[0-9a-f]{64}\.json$/);
    expect(file).not.toContain("clear-persona-group");
    expect(row).toMatchObject({ home: "identity", custody: "hot", keyClass: "device-minted", writer: "face-anchor-store", bundle: "stays" });
    expect(row!.match.test(file)).toBe(true);
  });
});
