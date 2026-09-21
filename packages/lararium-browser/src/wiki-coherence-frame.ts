/**
 * The browser vessel's coherence return frame.
 *
 * This is an emitted, platform-neutral value.  A web surface may render it;
 * the vessel never accepts an HTMLElement or otherwise owns page DOM.
 *
 * Meme: lar:///ha.ka.ba/lares/api/wiki-coherence-projection
 */

import type { CoherenceIndicatorFrame } from "@lararium/tw5";

export type CoherenceFrameWithRev = CoherenceIndicatorFrame & { rev: number };
