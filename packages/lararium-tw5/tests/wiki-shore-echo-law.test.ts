/**
 * THE WIKI SHORE'S ECHO LAW, VERIFIED (road row G10): every leaked change routes as a save.
 *
 * A change the wiki raises either echoes what the shore landed (foam: the title equals the landed value) or
 * leaks past it (a hand: the title differs, or the title left). Foam routes nothing; every leaked change
 * routes: a present title as a save into the layer the cascade names, a vanished title as a tombstone. The
 * law reads what STANDS in the landed ledger, never a flag, so one rule serves a live wave, a seed and a restart.
 *
 * The instrument proves its zero with a known positive: the same rig that reads no store call for the
 * echoing title reads one save per leaked title in the same dispatch. The zero comes after a barrier (the
 * dispatch, the gate's fire and the landing queue's idle), never before it.
 */
import { describe, expect, test } from "vitest";
import { wikiSkip, skipNote } from "./test-wiki.js";
import { afterDispatch, ManualTimers, remote, shoreRig, storeDeleted, storeText, turns, workingBag, type Rig } from "./wiki-shore-rig.js";

/** The dispatch, the gate's fire, the landing queue's idle: the barrier a zero reads behind. */
const barrier = async (r: Rig, timers: ManualTimers): Promise<void> => {
  await afterDispatch();
  timers.fireAll(400);
  await turns(48);
  await r.adaptor.landingIdle();
};

describe.skipIf(wikiSkip)(`the wiki shore's echo law${skipNote}`, () => {
  test("an inbound landing routes nothing; every leaked change in one dispatch routes as a save, a vanished title as a tombstone", async () => {
    const timers = new ManualTimers();
    const r = await shoreRig({ timers });
    try {
      const echo = "lar:///t/echo-law/inbound";
      await r.working.put({ tiddler: { title: echo, text: "landed by sync" } }, remote);
      await turns();
      await r.adaptor.armSeedCheckpoint();
      await r.adaptor.landingIdle();
      const mark = r.calls.length;

      // THE ZERO, behind its barrier: the landing raised its change, the dispatch ran and the gate fired.
      await barrier(r, timers);
      expect(r.calls.slice(mark).filter((c) => c.puts.includes(echo) || c.deletes.includes(echo)), "the echo of an inbound landing routes nothing").toEqual([]);
      expect(r.wiki.getTiddler(echo)?.fields.text).toBe("landed by sync");

      // THE KNOWN POSITIVE: five leaked changes in one dispatch, one of them over the inbound title.
      const leaked = Array.from({ length: 4 }, (_, i) => `lar:///t/echo-law/leaked-${i}`);
      for (const title of leaked) r.wiki.addTiddler(new r.Tiddler({ title, text: `hand ${title}` }));
      r.wiki.addTiddler(new r.Tiddler(r.wiki.getTiddler(echo)!.fields, { text: "edited by hand" }));
      await barrier(r, timers);
      const routed = new Set(r.calls.slice(mark).flatMap((c) => c.puts));
      for (const title of [...leaked, echo]) expect(routed.has(title), `${title} routes as a save`).toBe(true);
      for (const title of leaked) expect(storeText(r, workingBag, title), `${title} rests in the working layer`).toBe(`hand ${title}`);
      expect(storeText(r, workingBag, echo)).toBe("edited by hand");

      // A VANISHED TITLE routes too: the deletion lands as a tombstone, never as silence.
      r.wiki.deleteTiddler(leaked[0]!);
      await barrier(r, timers);
      expect(storeDeleted(r, workingBag, leaked[0]!), "the deletion rests as a tombstone").toBe(true);
      expect(storeText(r, workingBag, leaked[1]!), "its siblings stand").toBe(`hand ${leaked[1]}`);
    } finally { await r.stop(); }
  }, 120_000);
});
