/**
 * stop-receipt-fence — past the stop's first step, a receipt whose document holds a save in memory refuses `held-in-memory`.
 *
 *   F1  stopping, a held document's receipt refuses by name after the inner receipt ran (its flush resolved).
 *   F2  CONTROL: before the stop, and past it for a document that holds nothing, the receipt lands as the inner one does.
 */
import { describe, expect, test } from "vitest";
import type { HeldSaves } from "@lararium/mesh/sealed-doc-store";
import { fenceReceiptAtStop } from "../src/stop-receipt-fence.js";

describe("the stop's receipt fence", () => {
  const held: HeldSaves[] = [{ documentId: "doc-held", refusal: "save-unbooked", saves: 1, bagId: "bag-sibling" }];
  test("F1 stopping, a held document's receipt refuses held-in-memory once its flush resolved", async () => {
    let flushed = 0;
    const fenced = fenceReceiptAtStop(async () => { flushed++; }, { stopping: () => true, held: () => held });
    await expect(fenced(["doc-held"])).rejects.toThrow(/^held-in-memory: .*doc-held \(save-unbooked\)/);
    expect(flushed, "the inner receipt ran whole first").toBe(1);
  });
  test("F2 CONTROL: before the stop, or for a document holding nothing, the receipt lands", async () => {
    let stopping = false;
    const fenced = fenceReceiptAtStop(async () => {}, { stopping: () => stopping, held: () => held });
    await expect(fenced(["doc-held"])).resolves.toBeUndefined();
    stopping = true;
    await expect(fenced(["doc-clean"])).resolves.toBeUndefined();
  });
});
