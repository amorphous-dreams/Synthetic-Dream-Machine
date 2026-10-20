/** Chromium's production holder declares its nested Worker floor before admission. */
import { describe, expect, test } from "vitest";
import { attachSharedHolder } from "../src/shared-holder.js";
import openVesselSource from "../src/open-browser-vessel.ts?raw";

describe("the production holder's Chromium floor", () => {
  test("the holder refuses by name and attach returns the dedicated-worker floor", async () => {
    const holderUrl = new URL("../src/shared-holder.worker.ts", import.meta.url);
    holderUrl.searchParams.set("island", new URL("./fixtures/stub-island.worker.ts", import.meta.url).href);
    holderUrl.searchParams.set("lock", `lares:vessel:chromium-floor:${crypto.randomUUID()}`);
    const attached = await attachSharedHolder({ holderUrl });
    expect(attached.kind, "the production holder announces a floor before the peer path").toBe("floor");
    if (attached.kind === "floor") expect(attached.why).toMatch(/^holder-unavailable: no nested Worker in this engine/);
  }, 20_000);

  test("the vessel supplies a dedicated daemon spawn for a holder that refuses after greeting", () => {
    expect(openVesselSource, "a late holder refusal needs the same dedicated daemon as the early floor").toMatch(/holderWorkerHandle\(holder\.port,\s*faceSession,\s*\{[^}]*floor:\s*\(\)\s*=>\s*browserSpawnWorker\(url\)/s);
  });
});
