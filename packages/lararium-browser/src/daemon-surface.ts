/** The surface id the daemon owns in the uniform pin-selector — distinct from any pool wiki slug. Pass it to
 *  `setActiveSurface` to summon the daemon; pass a wiki slug to surface that wiki. It's all the same VM. */
// THE SENTINEL IS THE SLUG — one string, no decoding at any boundary, so no call site can decode it
// wrongly. A sentinel that differs from the slug buys a translation everywhere the two must meet.
export const DAEMON_SURFACE_ID = "daemon";
