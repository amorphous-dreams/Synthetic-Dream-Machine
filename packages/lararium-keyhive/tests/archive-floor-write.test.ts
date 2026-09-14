/**
 * archive-floor-write — CURE 1. THE FLOOR MUST NOT WRITE.
 *
 * The M3 boot re-seal exported the sovereign identity archive on EVERY boot. Its own comment named
 * the seam out loud — "seed the on-disk archive FLOOR every boot" — written when only one boot shape
 * existed. A vessel whose archive holds SHUT now boots too, and canon rules what it may do there:
 *
 *   waking-floor #/the-shape:
 *     <<~ has Wake Hold "closed/every-sovereign-act ~ a locked vessel signs nothing">>
 *   waking-floor #/the-breaks:
 *     "The vessel's at-rest state never changes, so a stolen disk still yields nothing of anybody's
 *      person. Storage stays barred; presence stays welcome."
 *
 * WHERE THE GATE STANDS, and why HERE. `waking-floor` #/the-breaks ① rules it:
 *   "A model that fences at the grant and not at the door has moved the check somewhere nobody
 *    performs it."
 * The DOOR is the site that performs the write. `persistArchiveFloor` IS that site, inside the
 * worker, and it refuses on its OWN reading rather than by trusting the caller not to ask: the
 * reading is `=== true`, so an absent, undefined or non-boolean standing BARS. A gate at
 * `node-daemon-island.ts` (where the writers are injected) would fence at the grant — every other
 * route into the worker would reach the write unchecked.
 *
 * WHAT THE GATE READS, and why the ARCHIVE fact rather than the CLASS. `standAs(asked, archiveOpens)`
 * renders a shut archive as `"herm"`, so the two agree wherever the SEAL decides the class. They part
 * on two boots that must keep writing: a FOUNDING (no face lit yet → class `"herm"`, archive opens)
 * and an operator-declared `--recipe herm` crossroads. A class gate would stop both from ever
 * persisting their own place's identity — and the founding is this cure's own CONTROL. What canon
 * bars is a LOCKED vessel signing; `personaSlotCeiling("herm") === 0` bars a SEATED persona, never an
 * archive. So the door reads the archive fact, which is the fact the ruling fences.
 *
 * TWO WRITERS, TWO REDS. `seal-and-seat-handoff` records the lesson: "`carriers()` named two
 * carriers; the boot opens four." The vessel archive and the veil archive are separate writers with
 * separate files, and a gate proven on one proves nothing about the other.
 *
 * THE REDS ASSERT ON THE INJECTED WRITER, NEVER ON DISK. A disk assertion passes for the wrong reason
 * the moment the guard throws: `refuseWriteOverUnopenableSeal` also leaves the bytes unchanged, so
 * "the file did not move" cannot tell a barred call from a refused one. Counting calls can.
 */
import { describe, expect, test } from "vitest";

import { persistArchiveFloor } from "../src/archive-floor-write.js";

const VESSEL_BYTES = Uint8Array.from([0xa0, 0xa1, 0xa2]);
const VEIL_BYTES   = Uint8Array.from([0xb0, 0xb1, 0xb2]);

/** A counting writer — the thing the reds assert on. */
function spy(): { calls: Uint8Array[]; write: (b: Uint8Array) => void } {
  const calls: Uint8Array[] = [];
  return { calls, write: (b) => { calls.push(b); } };
}

function exporters(): {
  exportArchive: () => Promise<Uint8Array>;
  exportVeilArchive: () => Promise<Uint8Array>;
  exported: string[];
} {
  const exported: string[] = [];
  return {
    exported,
    exportArchive:     async () => { exported.push("archive"); return VESSEL_BYTES; },
    exportVeilArchive: async () => { exported.push("veil");    return VEIL_BYTES; },
  };
}

describe("CURE 1 — the floor must not write", () => {
  // ── RED 1 · the vessel archive ──────────────────────────────────────────────────────────────────
  test("RED — a boot whose archive stands SHUT calls persistArchive ZERO times", async () => {
    const archive = spy();
    const veil    = spy();
    const ex      = exporters();

    const out = await persistArchiveFloor({
      archiveOpens: false,                                  // `standAs` renders this vessel `"herm"`
      writers: { persistArchive: archive.write, persistVeilArchive: veil.write },
      exportArchive: ex.exportArchive, exportVeilArchive: ex.exportVeilArchive,
    });

    expect(archive.calls.length, "a locked vessel signs nothing").toBe(0);
    expect(out.barred).toBe(true);
    expect(out.wrote).toEqual([]);
  });

  // ── RED 2 · the veil archive — the SECOND writer, its own red ────────────────────────────────────
  test("RED — the same boot calls persistVeilArchive ZERO times", async () => {
    const archive = spy();
    const veil    = spy();
    const ex      = exporters();

    await persistArchiveFloor({
      archiveOpens: false,
      writers: { persistArchive: archive.write, persistVeilArchive: veil.write },
      exportArchive: ex.exportArchive, exportVeilArchive: ex.exportVeilArchive,
    });

    expect(veil.calls.length, "two writers, two files, two reds").toBe(0);
  });

  // ── RED 3 · the EXPORT never even runs ──────────────────────────────────────────────────────────
  // `exportArchive()` materialises the founding DAG plus PREKEY SECRETS in memory. A barred boot that
  // still exported would hold the sovereign secret in a heap it has no business holding.
  test("RED — a barred boot never calls exportArchive at all", async () => {
    const ex = exporters();
    await persistArchiveFloor({
      archiveOpens: false,
      writers: { persistArchive: spy().write, persistVeilArchive: spy().write },
      exportArchive: ex.exportArchive, exportVeilArchive: ex.exportVeilArchive,
    });
    expect(ex.exported, "nothing is exported into a heap that may not write it").toEqual([]);
  });

  // ── RED 4 · FAIL-CLOSED ON ITS OWN READING, never on the caller's good manners ───────────────────
  // The door reads `=== true`. An omitted standing — a caller that forgot, an older manifest, a
  // route nobody audited — bars. This is what makes the gate the DOOR rather than the grant.
  test("RED — an ABSENT standing bars both writers (the door reads it itself)", async () => {
    for (const standing of [undefined, null, "hearth", 1, {}] as unknown[]) {
      const archive = spy();
      const veil    = spy();
      const out = await persistArchiveFloor({
        archiveOpens: standing,
        writers: { persistArchive: archive.write, persistVeilArchive: veil.write },
        exportArchive: async () => VESSEL_BYTES, exportVeilArchive: async () => VEIL_BYTES,
      });
      expect(archive.calls.length, `standing ${JSON.stringify(standing)} must bar`).toBe(0);
      expect(veil.calls.length).toBe(0);
      expect(out.barred).toBe(true);
    }
  });

  // ── CONTROL · A HEARTH WHOSE KEY OPENS STILL WRITES ─────────────────────────────────────────────
  // WITHOUT THIS CONTROL THE REFACTOR KILLS M3 OUTRIGHT.
  test("CONTROL — an OPEN archive writes both carriers, with the exported bytes", async () => {
    const archive = spy();
    const veil    = spy();
    const ex      = exporters();

    const out = await persistArchiveFloor({
      archiveOpens: true,
      writers: { persistArchive: archive.write, persistVeilArchive: veil.write },
      exportArchive: ex.exportArchive, exportVeilArchive: ex.exportVeilArchive,
    });

    expect(archive.calls.length).toBe(1);
    expect(archive.calls[0]).toEqual(VESSEL_BYTES);
    expect(veil.calls.length).toBe(1);
    expect(veil.calls[0]).toEqual(VEIL_BYTES);
    expect(out.barred).toBe(false);
    expect([...out.wrote].sort()).toEqual(["archive", "veil"]);
    expect(out.refusals).toEqual([]);
  });

  // ── CONTROL · A FOUNDING STILL WRITES ───────────────────────────────────────────────────────────
  // `archive-write-guard-attacks.test.ts` already pins "the guard never blocks a founding"; the
  // standing gate must not either. A founding reads `no-seal-expected` → `archiveOpens: true`,
  // while its CLASS is still `"herm"` (no face lit) — which is exactly why the door reads the
  // archive fact rather than the class.
  test("CONTROL — a founding (no carrier, no sealExpected → archive opens) still writes", async () => {
    const archive = spy();
    const out = await persistArchiveFloor({
      archiveOpens: true,
      writers: { persistArchive: archive.write },          // no veil at a first founding
      exportArchive: async () => VESSEL_BYTES,
    });
    expect(archive.calls.length).toBe(1);
    expect(out.wrote).toEqual(["archive"]);
  });

  // ── CONTROL · AN ABSENT WRITER IS NOT A REFUSAL ─────────────────────────────────────────────────
  // A browser vessel injects no writer at all. That is "the archive floor simply never persists",
  // not a refusal to surface (`operator-daemon-behavior`'s own DaemonExtra doc).
  test("CONTROL — no writers injected: nothing wrote, nothing refused, nothing barred", async () => {
    const out = await persistArchiveFloor({
      archiveOpens: true, writers: {},
      exportArchive: async () => VESSEL_BYTES,
    });
    expect(out.wrote).toEqual([]);
    expect(out.refusals).toEqual([]);
    expect(out.barred).toBe(false);
  });
});
