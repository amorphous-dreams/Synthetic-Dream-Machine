/**
 * Web surface sink for the browser vessel's coherence projection.
 *
 * The vessel emits a CoherenceFrameWithRev; this web-only adapter is the
 * named DOM shore that renders it.  No browser-vessel authority crosses back
 * through this sink.
 *
 * Meme: lar:///ha.ka.ba/lares/api/wiki-coherence-projection
 */

import type { CoherenceFrameWithRev } from "@lararium/browser";

export interface CoherenceIndicatorSink {
  apply(frame: CoherenceFrameWithRev): void;
  dispose(): void;
}

export function mountCoherenceIndicator(host: HTMLElement): CoherenceIndicatorSink {
  let lastRev = 0;
  return {
    apply(frame): void {
      if (frame.rev === 1) lastRev = 0;
      if (frame.rev < lastRev) return;
      lastRev = frame.rev;
      host.setAttribute("data-coherence", frame.status);
      host.setAttribute("data-radius", String(frame.radius));
      if (frame.obstructing.length > 0) host.setAttribute("title", frame.obstructing.join(", "));
      else host.removeAttribute("title");
      host.textContent = frame.label;
    },
    dispose(): void {
      /* The host owns its DOM lifetime; the sink holds no worker resources. */
    },
  };
}
