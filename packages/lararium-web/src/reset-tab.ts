/**
 * reset-tab — one tab's part in the reset ceremony (lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift#/the-reset).
 *
 * The reset ceremony speaks to every tab of the origin on one BroadcastChannel (`RESET_CHANNEL`), the asking tab and every
 * other alike: no tab holds a road of its own to the ceremony, and none answers it.
 *
 *   `reset:stand-down`  the confirmation landed. This tab stands its vessel worker down, so it holds no store the burn deletes,
 *                       and says so on the page. It keeps standing as a page: it reloads only once the place burned.
 *   `reset:burned`      the place burned. This tab removes its own session keys (the ceremony's window reaches no other
 *                       tab's sessionStorage) and boots afresh at the anon floor.
 *   `reset:declined`    the person declined. The ask's notice leaves the page; nothing else moves.
 *
 * A SECOND TAB NEVER REFUSES THE RESET, and the reset never waits on its word: a tab that stands down lets go at once, and a
 * tab that does not hear (frozen, or an older page) holds its store until it closes, which the ceremony names to the person.
 */
import type { ResetSignal } from "./ceremony-protocol.js";
import { clearOwnedKeys } from "./ceremony/reset-core.js";

export interface ResetTabEnv {
  /** The origin's reset channel as this tab hears it. */
  readonly listen: (listener: (msg: unknown) => void) => void;
  /** Stand this tab's vessel worker down: terminate it and drop the page's road to it. */
  readonly standDown: () => void;
  /** Boot the page afresh. */
  readonly reload: () => void;
  /** This tab's own sessionStorage, or null where the browser withholds it. */
  readonly session: Pick<Storage, "length" | "key" | "removeItem"> | null;
  /** Take the reset ask's notice down. */
  readonly settle: (askId: string) => void;
  /** Tell the person where this tab stands. */
  readonly say: (words: string) => void;
}

const signalOf = (msg: unknown): ResetSignal | null => {
  const m = msg as { t?: unknown; askId?: unknown } | null;
  return m !== null && typeof m === "object" && typeof m.askId === "string" && (m.t === "reset:stand-down" || m.t === "reset:burned" || m.t === "reset:declined")
    ? { t: m.t, askId: m.askId } : null;
};

/** Stand this tab's listener on the reset channel. Answers whether this tab stood down. */
export function standResetTab(env: ResetTabEnv): { readonly stoodDown: () => boolean } {
  let stoodDown = false;
  env.listen((msg) => {
    const signal = signalOf(msg);
    if (!signal) return;
    if (signal.t === "reset:declined") { env.settle(signal.askId); return; }
    if (signal.t === "reset:stand-down") {
      if (stoodDown) return;
      stoodDown = true;
      env.standDown();
      env.say("This browser's vessel resets from its ceremony: this tab stood its vessel down, and boots afresh once the reset lands. If the ceremony closed before it finished, reload this tab.");
      return;
    }
    if (env.session) { try { clearOwnedKeys(env.session); } catch { /* a withheld storage holds nothing to clear */ } }
    env.reload();
  });
  return { stoodDown: () => stoodDown };
}
