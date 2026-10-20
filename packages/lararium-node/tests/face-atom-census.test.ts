import { describe, expect, it } from "vitest";
import { carrierTable } from "../src/vault-carriers.js";

describe("the face atom carrier", () => {
  it("rests as a hot, local D row owned by one handle", () => {
    const row = carrierTable().find((candidate) => candidate.row === "face-atom");
    expect(row).toBeDefined();
    expect(row).toMatchObject({
      home: "identity", custody: "hot", keyClass: "device-minted",
      writer: "face-atom-store", bundle: "stays",
      target: { classes: ["D"], lead: false, joint: null },
    });
    const match = row!.match.exec("face-atom-h0.bin");
    expect(match).not.toBeNull();
    expect(row!.name(match!)).toBe("face-atom-h0");
    expect(row!.face(match!)).toBe(0);
  });
});
