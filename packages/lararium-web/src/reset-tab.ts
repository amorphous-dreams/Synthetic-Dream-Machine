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
 * A TAB HONOURS THE CHANNEL ONLY FOR A STANDING ASK. Any script of the origin can say these words on the channel, so a tab
 * checks each against the ask record (`reset-core.ts`): it stands down only for an id the origin's record
 * names; it boots afresh only for an id it stood down for (the burn removed the record by then); it takes a declined notice
 * down only where its own page shows that reset ask. A signal for any other id moves nothing. This binds the channel to the
 * record; it does not defend against script already running in a page of this origin, which writes that record as a page does.
 *
 * A SECOND TAB NEVER REFUSES THE RESET, and the reset never waits on its word: a tab that stands down lets go at once, and a
 * tab that does not hear (frozen, or an older page) holds its store until it closes, which the ceremony names to the person.
 */
import { standingAsks } from "./ceremony-page.js";
import type { ResetSignal } from "./ceremony-protocol.js";
import { clearOwnedKeys, originAskRecord, resetAskStands } from "./ceremony/reset-core.js";

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
  /** The origin's ask record as this tab reads it; the origin's own storage where none is named. */
  readonly record?: Pick<Storage, "getItem"> | null;
  /** Whether this tab's page shows this reset ask; read off the page's own notices where none is named. */
  readonly shows?: (askId: string) => boolean;
}

const signalOf = (msg: unknown): ResetSignal | null => {
  const m = msg as { t?: unknown; askId?: unknown } | null;
  return m !== null && typeof m === "object" && typeof m.askId === "string" && (m.t === "reset:stand-down" || m.t === "reset:burned" || m.t === "reset:declined")
    ? { t: m.t, askId: m.askId } : null;
};

/** Stand this tab's listener on the reset channel. Answers whether this tab stood down. */
export function standResetTab(env: ResetTabEnv): { readonly stoodDown: () => boolean } {
  let stoodDown = false;
  /** The asks this tab stood down for: the only ids whose `reset:burned` it honours. */
  const stoodFor = new Set<string>();
  const record = env.record !== undefined ? env.record : originAskRecord();
  const shows = env.shows ?? ((askId: string): boolean => standingAsks(document).some((ask) => ask.kind === "reset" && ask.askId === askId));
  env.listen((msg) => {
    const signal = signalOf(msg);
    if (!signal) return;
    if (signal.t === "reset:declined") { if (shows(signal.askId)) env.settle(signal.askId); return; }
    if (signal.t === "reset:stand-down") {
      if (!resetAskStands(record, signal.askId)) return;
      stoodFor.add(signal.askId);
      if (stoodDown) return;
      stoodDown = true;
      env.standDown();
      env.say("This browser's vessel resets from its ceremony: this tab stood its vessel down, and boots afresh once the reset lands. If the ceremony closed before it finished, reload this tab.");
      return;
    }
    if (!stoodFor.has(signal.askId)) return;
    if (env.session) { try { clearOwnedKeys(env.session); } catch { /* a withheld storage holds nothing to clear */ } }
    env.reload();
  });
  return { stoodDown: () => stoodDown };
}
