/**
 * archive-unreadable-refuses — an Archive this build cannot decode REFUSES the stand.
 *
 * The vessel keeps one keyhive Archive per identity, and a group's creator seats nobody without the state inside
 * it. A provider that met an undecodable Archive and stood a fresh identity in its place would strand every group
 * the kept one created while the boot read green. So the decode fault surfaces, on the provider and on the daemon
 * boot alike, and nothing mints over it.
 *
 *   U1  the provider refuses an undecodable Archive and holds no identity afterwards.
 *   U2  the daemon boot refuses the same bytes.                       control (U3): a readable Archive restores
 *   U3  a readable Archive restores the identity that exported it.     the very identity that wrote it
 */
import { describe, test, expect } from "vitest";
import { KeyhiveProvider, InMemoryEventStore, bootDaemonKeyhive } from "../src/index.js";

const undecodable = new Uint8Array(4096);
for (let i = 0; i < undecodable.length; i++) undecodable[i] = (i * 131 + 7) & 0xff;
const seed = (n: number): Uint8Array => new Uint8Array(32).fill(n);

describe("an Archive this build cannot decode", () => {
  test("U1 the provider refuses it and holds no identity", async () => {
    const p = new KeyhiveProvider();
    await expect(p.init({ seed: seed(9), eventStore: new InMemoryEventStore(), archiveBytes: undecodable })).rejects.toThrow();
    await expect(p.whoami()).rejects.toThrow(/not initialized/);
  });

  test("U2 the daemon boot refuses it: no fresh identity stands in its place", async () => {
    await expect(bootDaemonKeyhive({
      seed: seed(9), eventStore: new InMemoryEventStore(), vesselVerifyingKey: "00".repeat(32),
      registerBags: [], archiveBytes: undecodable,
    } as Parameters<typeof bootDaemonKeyhive>[0])).rejects.toThrow();
  });

  test("U3 control: a readable Archive restores the identity that exported it", async () => {
    const a = new KeyhiveProvider();
    await a.init({ seed: seed(5), eventStore: new InMemoryEventStore() });
    const archived = await a.whoami();
    const bytes = await a.exportArchive();
    const b = new KeyhiveProvider();
    await b.init({ seed: seed(5), eventStore: new InMemoryEventStore(), archiveBytes: bytes });
    expect(await b.whoami()).toBe(archived);
  });
});
