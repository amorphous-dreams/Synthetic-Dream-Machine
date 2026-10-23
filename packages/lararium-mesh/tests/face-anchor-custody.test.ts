import { describe, expect, it } from "vitest";
import { keepFaceAnchor, loadFaceAnchor, requireFaceAnchor, mintFaceAnchor, type FaceAnchorRows } from "../src/index.js";

describe("face anchor custody", () => {
  const rows = (): FaceAnchorRows => {
    const held = new Map<string, Uint8Array>();
    return { read: async (group) => held.get(group), write: async (group, bytes) => { held.set(group, bytes); } };
  };
  const anchor = mintFaceAnchor({ personaGroup: "group-a", personaKelPrefix: "kel-a", personaRootDid: "0xabc", edge: { id: "edge-a" }, leaseEpoch: 2 });

  it("RED: a malformed held row refuses by name, while an absent row stays absent", async () => {
    const custody = rows();
    expect(await loadFaceAnchor(custody, "group-a")).toBeNull();
    await custody.write("group-a", new TextEncoder().encode("{"));
    await expect(loadFaceAnchor(custody, "group-a")).rejects.toThrow(/malformed row for group-a/);
  });

  it("CONTROL: a valid anchor returns from its PersonaGroup row", async () => {
    const custody = rows();
    await keepFaceAnchor(custody, anchor);
    expect(await requireFaceAnchor(custody, "group-a")).toEqual(anchor);
    await expect(requireFaceAnchor(custody, "group-b")).rejects.toThrow(/anchor-missing/);
  });
});
