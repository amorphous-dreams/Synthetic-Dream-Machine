/**
 * outbound-bridge — ROAD B (basket-one #/the-bridge, ruled 2026-09-11): ONE direct listener carries a live
 * `$tw.wiki` change to the island adaptor's `saveTiddler` / `deleteTiddler`, and the echo law is spelled as a
 * SET of inbound-applied titles, consumed on sight and cleared per burst. No `module-type: syncadaptor`, no
 * `$tw.syncer`, no poll timer — the cascade alone says what leaves.
 *
 * THE FIVE-CLAUSE CONTRACT both roads must pass (outbound-bridge.mem #/back-parity):
 *   1 SAVE — a changed tiddler the filter admits reaches `saveTiddler` once per settled burst, with the tiddler
 *     as the wiki holds it now (the adaptor's 400 ms capture debounce coalesces; nothing drops);
 *   2 DELETE — a gone tiddler reaches `deleteTiddler(title)` and the adaptor routes it by the LAST-KNOWN slot
 *     (`_slotOf`), the tiddler being unreadable then;
 *   3 THE ECHO LAW — an inbound apply MUST NOT re-save. `change` dispatches on `nextTick`, after the nalu drain
 *     lowered `isApplyingNalu` (MEASURED, CONTROL 5b), so a flag cannot serve; this bridge reads the SET the
 *     adaptor fills at every inbound enqueue (`consumeInbound`) and skips a title it names — once;
 *   4 THE FILTER — total minus named exclusions: the cascade's withholding rules, read by the adaptor's own
 *     `_destination`; the bridge filters nothing itself, so a rule the cascade names is the only thing that
 *     stops a write;
 *   5 THE ANCHOR — a placement through the in-VM face (`$tw.lares.meme.place`) is a wiki write like any other,
 *     so its records leave by the same listener (no second door for the anchor).
 *
 * Held by the kernel's live handles and cancelled at teardown; a test stands it over a bare adaptor the same way.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/outbound-bridge
 */

import type { TW5Engine } from "./tw5-vm.js";
import type { IslandAdaptor } from "./island-adaptor.js";
import type { LaresTw5Extension } from "./types/lares-globals.js";
import type { LarTiddlerChange } from "@lararium/mesh";

/** The shape of one `change` dispatch: title → modified | deleted. */
type WikiChanges = Record<string, { modified?: boolean; deleted?: boolean }>;

interface BridgeWiki {
  addEventListener(type: "change", fn: (changes: WikiChanges) => void): void;
  removeEventListener(type: "change", fn: (changes: WikiChanges) => void): void;
  getTiddler(title: string): unknown;
}

/**
 * Stand the bridge: subscribe the wiki's `change` bus to the adaptor. Returns the unsubscribe the holder
 * calls at teardown. Idempotent per (wiki, adaptor) pair is the CALLER's discipline — the kernel stands one.
 */
export function bridgeWikiToAdaptor(tw5: TW5Engine, adaptor: IslandAdaptor): () => void {
  const wiki = tw5.$tw.wiki as unknown as BridgeWiki;
  // CLAUSE 3, the SET's fill: wrap the in-wiki `enqueueNalu` so EVERY inbound enqueue — the adaptor's, the
  // lazy resolver's body splice, any direct caller's — names its title before the drain applies it. Restored
  // at unsubscribe, so a torn-down bridge leaves the engine's own door as it found it.
  const { lares } = tw5.$tw as unknown as LaresTw5Extension;
  const enqueue = lares?.enqueueNalu;
  if (lares && typeof enqueue === "function") {
    lares.enqueueNalu = (change: LarTiddlerChange): void => { adaptor.noteInbound(change.title); enqueue(change); };
  }
  const onChange = (changes: WikiChanges): void => {
    for (const [title, change] of Object.entries(changes ?? {})) {
      // CLAUSE 3 — the echo law: a title the inbound drain applied leaves nothing; consumed once.
      if (adaptor.consumeInbound(title)) continue;
      if (change?.deleted) {
        void adaptor.deleteTiddler(title).catch((err: unknown) => console.warn(`[outbound-bridge] delete "${title}" faulted: ${String(err)}`));
        continue;
      }
      const tiddler = wiki.getTiddler(title);
      if (!tiddler) continue;   // modified-then-gone inside one tick — the delete follows
      void adaptor.saveTiddler(tiddler).catch((err: unknown) => console.warn(`[outbound-bridge] save "${title}" faulted: ${String(err)}`));
    }
    adaptor.endInboundBurst();   // per burst: entries older than the grace fall out (an apply that fired no change)
  };
  wiki.addEventListener("change", onChange);
  return () => {
    wiki.removeEventListener("change", onChange);
    if (lares && typeof enqueue === "function") lares.enqueueNalu = enqueue;
  };
}
