import type { LarServiceKind } from "@lararium/mesh";
import type { LarHostDoor } from "./projection-sink.js";

/**
 * The host doors a page opens by itself, one implementation for both of the page's surfaces: the worker-rendered floor asks them
 * through `lar:service` (`projection-sink.ts`), the mirror asks them straight from its own engine (`glass/doors.ts`). The browser's
 * own transient activation gates each (clipboard, fullscreen, a new window).
 */
export const PAGE_DOORS: Partial<Record<LarServiceKind, LarHostDoor>> = {
  clipboard: async (args) => { await navigator.clipboard.writeText(String(args["text"] ?? "")); },
  download: (args) => {
    const url = URL.createObjectURL(new Blob([String(args["text"] ?? "")], { type: String(args["type"] ?? "text/plain") }));
    const a = document.createElement("a");
    a.href = url;
    a.download = String(args["filename"] ?? "download.txt");
    a.click();
    // PACING: defer URL cleanup to the next task so the download can start.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  },
  print: () => { window.print(); },
  fullscreen: async (args, at) => {
    const mode = String(args["mode"] ?? "toggle");
    if (mode === "exit" || (mode === "toggle" && document.fullscreenElement)) await document.exitFullscreen();
    else await at.requestFullscreen();
  },
  "open-external": (args) => {
    if (!window.open(String(args["url"] ?? ""), String(args["windowName"] ?? "_blank"), "noopener,noreferrer")) throw new Error("the browser opened no window");
  },
};
