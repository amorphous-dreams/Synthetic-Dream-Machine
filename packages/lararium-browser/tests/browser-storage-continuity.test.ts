import { afterEach, describe, expect, test } from "vitest";
import { generateOrLoadBrowserVesselIdentity, readBrowserIdentityContinuity } from "../src/browser-vessel-identity.js";

const stores = new Set<string>();

function deleteIdb(name: string): Promise<void> {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = request.onerror = request.onblocked = () => resolve();
  });
}

afterEach(async () => {
  for (const name of stores) {
    await deleteIdb(name);
  }
  stores.clear();
});

describe("browser identity continuity", () => {
  test("a cleared IndexedDB after founding refuses before minting a replacement identity", async () => {
    const name = `lares:test-continuity:${crypto.randomUUID()}`;
    stores.add(name);
    const founded = await generateOrLoadBrowserVesselIdentity(name, "Continuity test");
    expect(await readBrowserIdentityContinuity(name), "the continuity row reads founded").toBe("founded");

    await deleteIdb(name);

    await expect(generateOrLoadBrowserVesselIdentity(name, "Continuity test"))
      .rejects.toThrow(/continuity-lost/);
    expect(founded.verifyingKey).toMatch(/^[0-9a-f]+$/i);
  });

  test("CONTROL: a name never founded reads no continuity row and founds", async () => {
    const name = `lares:test-continuity:${crypto.randomUUID()}`;
    stores.add(name);
    expect(await readBrowserIdentityContinuity(name)).toBeNull();
    await expect(generateOrLoadBrowserVesselIdentity(name)).resolves.toMatchObject({ verifyingKey: expect.stringMatching(/^[0-9a-f]+$/i) });
  });

  test("a retained origin loads the same identity", async () => {
    const name = `lares:test-continuity:${crypto.randomUUID()}`;
    stores.add(name);
    const first = await generateOrLoadBrowserVesselIdentity(name, "Continuity test");
    const second = await generateOrLoadBrowserVesselIdentity(name, "Continuity test");
    expect(second.verifyingKey).toBe(first.verifyingKey);
  });
});
