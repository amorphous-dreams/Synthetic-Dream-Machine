/**
 * carriage-stand — a serve loop a vector may ask only once it STANDS.
 *
 * `startCarriageServeLoop` returns at once and dials in the background. The relay keeps no envelope for a key
 * no socket has proven yet: a want-block that reaches it before the holder's handshake lands goes to no one,
 * and the asker then waits out its whole window. A vector that starts a loop and a requester "together" and
 * asks at once therefore assumes the holder's dial finished first, which no runner promises.
 *
 * The handshake hangs on the loop's own word: the line it says through `onLog` when its first channel stands.
 */
import { startCarriageServeLoop, type CarriageServeLoop, type CarriageServeLoopConfig } from "../src/carriage-serve-loop.js";
import { arrival } from "../../lararium-mesh/tests/handshake.js";

/** The loop's own lines for "a channel of mine stands": the first dial that lands, or a later one after a failed dial. */
const STANDS = /^carriage serve-loop (up|RE-connected) over /;

/** Start a serve loop; `stands` resolves when a channel of it has proven its key to the relay. */
export function standServeLoop(cfg: CarriageServeLoopConfig): { readonly loop: CarriageServeLoop; readonly stands: Promise<void> } {
  const up = arrival<void>(`the serve loop of ${cfg.serverAddr.slice(0, 12)} standing on ${cfg.relayUrl.split("#")[0]} (its "carriage serve-loop up over" line)`);
  const loop = startCarriageServeLoop({
    ...cfg,
    onLog: (line) => { cfg.onLog?.(line); if (STANDS.test(line)) up.arrive(); },
  });
  return { loop, stands: up.arrived };
}
