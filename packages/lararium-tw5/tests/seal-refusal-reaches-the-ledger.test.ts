/**
 * seal-refusal-reaches-the-ledger — CURE 4. THE REFUSAL REACHES A DURABLE AUDIENCE.
 *
 * The M3 archive export swallowed its own failure into `console.warn`:
 *   `catch (err) { console.warn("[daemon] keyhive archive export skipped: …") }`
 *
 * A GREEN BOOT IS NOT A WRITTEN ARCHIVE. `disk-projection` #/refusals rules the shape:
 *   "Refusals surface LOUDLY — a silent skip would hide it from the operator."
 * A seal refusal at 3am, on a daemon nobody is watching, left nothing behind at all: stdout on an
 * unattended vessel reaches no audience, and the next boot warns again over the same hole.
 *
 * REUSE RAIL A; MINT NO FOURTH. The rail already runs, end to end:
 *   island-behaviors `onRefusal` → IslandMsg_Event "ward-alert"
 *     → the reactor registered at `operator-daemon-behavior` (the SAME registry, three frames from
 *       the export)
 *     → a DURABLE `@daemon` audit record + a $:/tags/Alert into the operator's pinned VM
 *     → and, where a wiki is named but cold, `vessel-residency-wiring` parks the verb durably
 *       (`unmounted-no-mailbox`) rather than dropping it.
 *
 * ★ WHY IT WORKS ON A FLOOR BOOT — the objection that would otherwise sink it. The reactor writes
 * the `@daemon` audit FIRST and UNCONDITIONALLY, before it looks for a pinned VM at all. So the
 * refusal is RECORDED whether or not any wiki stands, whether or not anybody is watching.
 *
 * RAIL B'S DISCIPLINE HOLDS (`graceful-parsing` #/rails): DECIDE IN THE READING, SURFACE OUT OF IT.
 * `persistArchiveFloor` decides the refusal and returns it; the boot frame surfaces it here. Nothing
 * raises from inside the read.
 */
import { describe, expect, test } from "vitest";

import { CompositeStore, DAEMON_BAG_ID } from "@lararium/mesh";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { makeWardAlertReactor, ACTIVE_WIKI_URI } from "../src/index.js";
import type { DaemonMsg_WikiAlert } from "../src/index.js";

/** The daemon bag, in memory — the ledger this cure writes into is an ordinary bag write. */
async function daemonStore(): Promise<CompositeStore> {
  const composite = new CompositeStore();
  composite.addLayer({ bagId: DAEMON_BAG_ID, store: new MemoryTiddlerStore(DAEMON_BAG_ID), writable: true });
  return composite;
}

/** Every ward-ledger record standing in the daemon bag. */
async function wardLedger(composite: CompositeStore): Promise<Record<string, unknown>[]> {
  const titles = await composite.listVisible();
  const out: Record<string, unknown>[] = [];
  for (const t of titles) {
    if (!t.includes("/ledger/ward/")) continue;
    const rec = await composite.get(t);
    if (rec) out.push(rec.tiddler as unknown as Record<string, unknown>);
  }
  return out;
}

describe("CURE 4 — the refusal reaches a durable audience", () => {
  // ── RED 1 · A DURABLE RECORD, NOT ONLY A WARN ───────────────────────────────────────────────────
  test("RED — an archive-export refusal lands a durable @daemon ledger record", async () => {
    const composite = await daemonStore();
    const posted: DaemonMsg_WikiAlert[] = [];

    const react = makeWardAlertReactor(composite, (m) => posted.push(m));
    await react({
      bagId:    DAEMON_BAG_ID,
      uri:      "lar:///ha.ka.ba/identity/keyhive-archive.bin",
      reason:   "LARES_ARCHIVE_PASSPHRASE does not open it",
      wardKind: "archive-seal",
    });

    const ledger = await wardLedger(composite);
    expect(ledger.length, "a green boot is not a written archive").toBe(1);
    expect(ledger[0]?.["reason"]).toMatch(/does not open it/);
    expect(ledger[0]?.["uri"]).toMatch(/keyhive-archive\.bin/);
    // The record must NAME what refused. A seal refusal filed as a disk-ward refusal sends the
    // operator to the wrong mechanism.
    expect(ledger[0]?.["alert-kind"]).toBe("archive-seal");
  });

  // ── RED 2 · NEGATIVE — NO WIKI MOUNTED, AND THE AUDIT STILL LANDS ───────────────────────────────
  // This is the whole reason Rail A works at the floor: the audit is written FIRST and
  // UNCONDITIONALLY, before the reactor looks for a pinned VM. A floor boot mounts no wiki.
  test("RED — with NO wiki mounted the audit still lands, and nothing is posted", async () => {
    const composite = await daemonStore();
    const posted: DaemonMsg_WikiAlert[] = [];

    // No ACTIVE_WIKI_URI marker stands — a Herm/floor boot with no pinned VM.
    expect(await composite.get(ACTIVE_WIKI_URI)).toBeFalsy();

    const out = await react(composite, (m) => posted.push(m));
    expect((await wardLedger(composite)).length, "recorded even with nobody watching").toBe(1);
    expect(posted.length, "there is no mailbox to post into").toBe(0);
    expect(out["alerted"]).toBe("none");
  });

  // ── CONTROL · A PINNED VM STILL GETS ITS ALERT, AND THE WIRE KIND STAYS RAIL A'S ─────────────────
  // `wardKind` names the LEDGER record. The wire `kind`/`cause` stay "disk-ward" on purpose: that is
  // the transport Rail A's downstream already keys off (`hooks.alertArgs?.(kind)`, the browser drop
  // diagnostics). Minting a fourth kind here would be minting a fourth rail.
  test("CONTROL — a pinned VM receives the alert, on Rail A's own wire kind", async () => {
    const composite = await daemonStore();
    const posted: DaemonMsg_WikiAlert[] = [];
    await composite.put(
      { tiddler: { title: ACTIVE_WIKI_URI, text: "home" } },
      { kind: "lares-verb", requestId: "pin" },
    );

    await react(composite, (m) => posted.push(m));
    expect(posted.length).toBe(1);
    expect(posted[0]?.kind).toBe("disk-ward");
    expect(posted[0]?.message).toMatch(/does not open it/);
    expect((await wardLedger(composite)).length).toBe(1);
  });

  // ── CONTROL · THE DISK-WARD CALLER IS UNCHANGED ─────────────────────────────────────────────────
  // `island-behaviors.onRefusal` posts no `wardKind`. It must keep filing as "disk-ward" and
  // keep its own message wording, or this cure has moved a rail instead of reusing one.
  test("CONTROL — a call with NO wardKind still files as `disk-ward`", async () => {
    const composite = await daemonStore();
    const posted: DaemonMsg_WikiAlert[] = [];
    await composite.put(
      { tiddler: { title: ACTIVE_WIKI_URI, text: "home" } },
      { kind: "lares-verb", requestId: "pin" },
    );

    const reactor = makeWardAlertReactor(composite, (m) => posted.push(m));
    await reactor({ bagId: "bag:x", uri: "lar:///x", reason: "shadowed canon copy" });

    const ledger = await wardLedger(composite);
    expect(ledger[0]?.["alert-kind"]).toBe("disk-ward");
    expect(posted[0]?.message).toMatch(/^Disk ward refused a write/);
  });

  /**
   * The loop body that FOLLOWS `anchor` in `src`, delimited by BRACE MATCHING rather than by a
   * character count. Returns null when the anchor or its block cannot be found.
   *
   * WHY THIS REPLACED A 900-CHARACTER WINDOW. The window was measured once, against one body, and
   * both of its failure directions were live: grow the loop past 900 chars and the weld reds with
   * nothing broken, and — the one that mattered — MOVE the ledger call out of the loop while leaving
   * anything matching inside the slack, and the weld goes GREEN over a loop that only warns to
   * stdout. Measured, not feared: gutting the loop to `console.warn` alone and parking a dead
   * `if (false)` branch carrying the same call ~100 chars later read `5 passed`. The brace match has
   * no slack to hide in — the window IS the block, so a relocation leaves the block and reds.
   */
  function blockAfter(src: string, anchor: string): string | null {
    const at = src.indexOf(anchor);
    if (at < 0) return null;
    const open = src.indexOf("{", at);
    if (open < 0) return null;
    let depth = 0;
    for (let i = open; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") { depth--; if (depth === 0) return src.slice(open, i + 1); }
    }
    return null;   // unbalanced — the caller reds rather than guessing
  }

  // ── THE WELD · the boot frame must SURFACE the door's refusals on the rail ───────────────────────
  // `persistArchiveFloor` DECIDES the refusals (Rail B: never raise from inside a reading) and the
  // boot frame surfaces them. A frame that quietly went back to `console.warn` would leave every
  // test above green and the operator with nothing, so the source is read.
  //
  // ⚠ A SOURCE-READING WELD PINS TEXT, NEVER BEHAVIOUR. What it can honestly pin is a STRUCTURAL
  // fact — "the ledger call sits INSIDE the refusal loop" — and that is what the brace match buys.
  // It still cannot see `fileWardRefusal` stop posting from the inside; the reds above this weld own
  // that, and this weld owns only the composition they restate.
  test("WELD — `operator-daemon-behavior` surfaces floor refusals on the ward-alert rail", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(
      new URL("../../lararium-keyhive/src/operator-daemon-behavior.ts", import.meta.url), "utf8",
    );
    const ANCHOR = "for (const r of floor.refusals)";
    // THE RENAME PIN. A weld that reads a token alone cannot tell "the field was renamed" from "the
    // loop was deleted", so it names the field it depends on out loud: `refusals` must stand on the
    // floor reading's own TYPE, where a rename lands loudly instead of silently unhooking the anchor.
    const floorType = readFileSync(
      new URL("../../lararium-keyhive/src/archive-floor-write.ts", import.meta.url), "utf8",
    );
    expect(floorType, "the `refusals` field this weld anchors on stands on the floor reading itself")
      .toMatch(/\brefusals\b/);
    const loop = blockAfter(src, ANCHOR);
    expect(loop, `the refusal-surfacing loop stands (anchor: ${ANCHOR})`).not.toBeNull();
    // NOT ONLY A WARN. stdout may stay — an operator at a terminal should see it — but the refusal
    // must ALSO reach the durable `@daemon` ledger, which is the only audience a 3am boot has.
    expect(loop!, "the refusal rides Rail A, not stdout alone").toMatch(/fileWardRefusal\(ctx\.composite, ctx\.post,/);
    expect(loop!, "and it names the seal, not the disk ward").toMatch(/wardKind:\s*"archive-seal"/);
    // AND THE CALL IS THE LOOP'S OWN, not a dead sibling the old window reached: exactly one such
    // call stands in the whole file, so it cannot be both inside the loop and duplicated outside it.
    expect([...src.matchAll(/fileWardRefusal\(ctx\.composite, ctx\.post,[\s\S]{0,300}?wardKind:\s*"archive-seal"/g)].length,
      "exactly one archive-seal refusal call stands — a second would let one of them go dead unnoticed").toBe(1);
    // ONE BODY, TWO DOORS — the same act the registered "ward-alert" verb performs, never a second rail.
    expect(src).toMatch(/registry\.register\("ward-alert", makeWardAlertReactor\(ctx\.composite, ctx\.post\)\)/);
  });
});

/** The archive-seal refusal, as the boot frame files it. */
async function react(
  composite: CompositeStore,
  post: (m: DaemonMsg_WikiAlert) => void,
): Promise<Record<string, unknown>> {
  const reactor = makeWardAlertReactor(composite, post);
  return (await reactor({
    bagId:    DAEMON_BAG_ID,
    uri:      "lar:///ha.ka.ba/identity/keyhive-archive.bin",
    reason:   "LARES_ARCHIVE_PASSPHRASE does not open it",
    wardKind: "archive-seal",
  })) as Record<string, unknown>;
}
