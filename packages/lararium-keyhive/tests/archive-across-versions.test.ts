/**
 * archive-across-versions — what a vessel meets when its at-rest keyhive bytes were written by another
 * keyhive version. An Archive and an event carry no format tag, so the answer is measured, never assumed:
 * `probes/fixtures/alpha8-archive.fixture.json` holds bytes the published 0.1.0-alpha.8 wrote, and the pinned
 * build is asked to open them, raw and through the provider's boot doors.
 *
 * The readings pin a consequence, not a preference: bytes from another version do not open, the provider's
 * default refuses loudly, the daemon's re-mint door stands the SAME seed-named identity holding none of the
 * old keys, and a hydrate over the old events rebuilds no membership. The day an upstream build opens these bytes,
 * these alarms say so, and a version move stops being a re-founding.
 */
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { KeyhiveProvider, InMemoryEventStore } from "../src/index.js";
import { ALPHA8_ARCHIVE_FIXTURE, readArchiveAcrossVersions } from "../probes/archive-across-versions.js";

const fx = JSON.parse(readFileSync(ALPHA8_ARCHIVE_FIXTURE, "utf8")) as {
  joineeSeedFill: number; joineeId: string; docIdHex: string; encryptedB64: string;
  joineeArchiveB64: string; publicEventsB64: string[];
};
const seed = (fill: number): Uint8Array => Uint8Array.from({ length: 32 }, (_, i) => (fill + i) & 0xff);
const unb64 = (s: string): Uint8Array => new Uint8Array(Buffer.from(s, "base64"));

describe("at-rest keyhive bytes from another keyhive version", () => {
  test("the pinned build opens neither the archive nor the events; its own archive restores (control)", async () => {
    const r = await readArchiveAcrossVersions(ALPHA8_ARCHIVE_FIXTURE);
    expect(r.control).toBe("restores-and-decrypts");
    expect(r.archive.joinee).toMatch(/^REFUSED: /);
    expect(r.archive.founder).toMatch(/^REFUSED: /);
    expect(r.events).toMatch(/^REFUSED: /);
    expect(r.compatible).toBe(false);
  });

  test("the provider refuses the archive loudly by default", async () => {
    const p = new KeyhiveProvider();
    await expect(p.init({ seed: seed(fx.joineeSeedFill), eventStore: new InMemoryEventStore(), archiveBytes: unb64(fx.joineeArchiveB64) }))
      .rejects.toThrow();
  });

  test("the re-mint door stands the same seed-named identity with none of the old keys, and the old events rebuild no membership", async () => {
    const eventStore = new InMemoryEventStore();
    for (const [i, b64] of fx.publicEventsB64.entries()) await eventStore.put({ hash: `prior-${i}`, variant: "PRIOR", bytes: unb64(b64) });
    const p = new KeyhiveProvider();
    await p.init({ seed: seed(fx.joineeSeedFill), eventStore, archiveBytes: unb64(fx.joineeArchiveB64), reMintOnUnreadableArchive: true });
    // The name survives: an identity IS its seed's verifying key.
    expect(await p.whoami()).toBe(`0x${fx.joineeId}`);
    const replay = await p.hydrateFromEventStore();
    // The batch refuses whole; record by record some events still decode and wait on dependencies that never
    // arrive, and the rest refuse. Every event is accounted for, and at least one membership event is lost.
    expect(replay.ingested + replay.skipped).toBe(fx.publicEventsB64.length);
    expect(replay.skipped).toBeGreaterThan(0);
    // The membership does not: the document the old archive reached is unknown here, and its chunk stays sealed.
    p.adoptBag("lar:///probe.prior.bag", `0x${fx.docIdHex}`);
    await expect(p.decryptContent("lar:///probe.prior.bag", unb64(fx.encryptedB64))).rejects.toThrow();
    await p.dispose();
  });
});
