/**
 * device-admit-kind — the ONE name the signed device edge carries, read by every host (node, browser) through this
 * constant alone. The shape reads by its name and fields; no counter rides it, and any other kind reads as no admit.
 */
export const DEVICE_ADMIT_KIND = "device-admit" as const;
