import type { GlassDoor } from "@lararium/tw5/glass";
import type { LarServiceKind } from "@lararium/mesh";
import { PAGE_DOORS } from "../page-doors.js";

/** What the mirror's `route` door moves: the surface owns the address and the mirror's own life, never TW5's hash handling. */
export interface MirrorRoute {
  /** Boot the mirror afresh from a new handoff (stock's "refresh the page"): the page stays, the engine goes and comes back. */
  reload(): void | Promise<void>;
}

/** Stock's permalink fragment: the target, and for a permaview the whole story. */
export function routeFragment(title: string, story: readonly string[] | null): string {
  const list = (titles: readonly string[]): string => titles.map(item => (/\s/.test(item) ? `[[${item}]]` : item)).join(" ");
  return `#${encodeURIComponent(title)}${story ? `:${encodeURIComponent(list(story))}` : ""}`;
}

/**
 * THE MIRROR'S HOST DOORS (`d3-glass-lane#/the-doors`). The mirror's engine runs on the page, so an ask reaches the page's own
 * door in the task of the person's act and the browser's transient activation gates it; no token crosses a thread. One act asks
 * one door, and every ask settles once: `ok`, or the named refusal the engine paints on the alert rail.
 *
 *   clipboard · download · print · fullscreen · open-external   the page's own doors (`page-doors.ts`), shared with the floor.
 *   route   `reload` boots the mirror afresh; `permalink` and `permaview` hand the link to the clipboard (the address bar belongs to
 *           the surface, and its fragment already carries the floor's own words).
 *   open-surface   no second surface opens from this page yet: `page-action-unavailable`.
 */
export function makeMirrorDoor(opts: { host: HTMLElement; route: MirrorRoute; story: () => readonly string[];
  doors?: Partial<Record<LarServiceKind, (args: Record<string, string | number | boolean>, host: HTMLElement) => void | Promise<void>>> }): GlassDoor {
  const doors = { ...PAGE_DOORS, ...(opts.doors ?? {}) };
  const link = (fragment: string): string => `${location.href.split("#")[0]}${fragment}`;
  return {
    ask(kind, args, settle) {
      let settled = false;
      const once = (status: string): void => { if (!settled) { settled = true; settle(status); } };
      const run = async (): Promise<void> => {
        if (kind === "route") {
          const action = String(args["action"] ?? "");
          if (action === "reload") { await opts.route.reload(); return; }
          if (action === "permalink" || action === "permaview") {
            const title = String(args["title"] ?? "");
            await doors.clipboard!({ text: link(routeFragment(title, action === "permaview" ? opts.story() : null)) }, opts.host);
            return;
          }
          throw new Error(`route names no action: ${action}`);
        }
        const door = doors[kind as LarServiceKind];
        if (!door || kind === "open-surface") throw new Error("no door");
        await door(args, opts.host);
      };
      run().then(() => once("ok"), () => once("page-action-unavailable"));
    },
  };
}
