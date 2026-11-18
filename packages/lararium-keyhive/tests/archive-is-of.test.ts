import { describe, expect, test } from "vitest";
import { archiveIsOf, InMemoryEventStore, KeyhiveProvider } from "../src/index.js";

async function archiveOf(seed: Uint8Array): Promise<Uint8Array> {
  const provider = new KeyhiveProvider();
  await provider.init({ seed, eventStore: new InMemoryEventStore() });
  const archive = await provider.exportArchiveAfterTheCard();
  await provider.dispose();
  return archive;
}

describe("archiveIsOf", () => {
  test("G2 — a seed's own Archive reads as its own, another seed's reads false", async () => {
    const a = new Uint8Array(32).fill(0x11);
    const b = new Uint8Array(32).fill(0x22);
    const archiveA = await archiveOf(a);
    expect(await archiveIsOf(a, archiveA)).toBe(true);
    expect(await archiveIsOf(b, archiveA)).toBe(false);
  });
});
