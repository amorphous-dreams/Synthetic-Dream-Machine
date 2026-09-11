/**
 * archive-remint-on-skew — a keyhive Archive written by an OLDER build is unreadable under a newer one
 * (a format skew: `new Archive(bytes)` throws "Invalid size …"). The seal (GCM) already validated the
 * bytes on unseal, so post-unseal an unreadable archive is format-incompatible, never wrong-key or
 * corrupt — so a daemon boot must RE-MINT a fresh identity rather than brick, when it opts in. The
 * default stays fail-loud (never boot fresh over a sealed archive on a wrong/absent key).
 */
import { describe, test, expect } from "vitest";
import { KeyhiveProvider, InMemoryEventStore } from "../src/index.js";

const stale = new Uint8Array(4096); // stands for an unreadable-format archive (GCM-valid bytes upstream)
for (let i = 0; i < stale.length; i++) stale[i] = (i * 131 + 7) & 0xff;

describe("archive re-mint on a format skew", () => {
  test("★ default: an unreadable archive THROWS (fail-loud, unchanged) ★", async () => {
    const p = new KeyhiveProvider();
    await expect(p.init({ seed: new Uint8Array(32).fill(9), eventStore: new InMemoryEventStore(), archiveBytes: stale }))
      .rejects.toThrow();
  });

  test("★ reMintOnUnreadableArchive: an unreadable archive stands a FRESH identity, boot survives ★", async () => {
    const p = new KeyhiveProvider();
    await p.init({ seed: new Uint8Array(32).fill(9), eventStore: new InMemoryEventStore(), archiveBytes: stale, reMintOnUnreadableArchive: true });
    const did = await p.whoami();
    expect(did.length, "a fresh identity stood").toBeGreaterThan(0);
  });

  test("★ a READABLE archive still restores under the flag (re-mint only on unreadable) ★", async () => {
    const a = new KeyhiveProvider();
    await a.init({ seed: new Uint8Array(32).fill(5), eventStore: new InMemoryEventStore() });
    const archived = await a.whoami();
    const bytes = await a.exportArchive();
    const b = new KeyhiveProvider();
    await b.init({ seed: new Uint8Array(32).fill(5), eventStore: new InMemoryEventStore(), archiveBytes: bytes, reMintOnUnreadableArchive: true });
    expect(await b.whoami(), "the flag does not discard a READABLE archive").toBe(archived);
  });
});
