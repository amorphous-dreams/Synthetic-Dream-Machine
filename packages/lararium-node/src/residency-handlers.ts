/**
 * residency-handlers — command-tiddler handlers for operator-driven
 * residency control: pin, unpin, residency (stats).
 *
 * Operators invoke these via `lares pin <url>` / `lares unpin <url>` /
 * `lares residency`. Each handler closes over the BagResidencyManager
 * the daemon constructs at boot.
 */

import type { CommandHandler } from "./command-dispatcher.js";
import type { BagResidencyManager } from "@lararium/core";

export interface ResidencyHandlerOptions {
  readonly residency: BagResidencyManager;
}

export function createPinHandler(opts: ResidencyHandlerOptions): CommandHandler {
  return async (args) => {
    const url    = typeof args["url"]    === "string" ? args["url"]    : "";
    const reason = typeof args["reason"] === "string" ? args["reason"] : undefined;
    if (!url) throw new Error("args.url is required");
    if (reason !== undefined) {
      await opts.residency.pin(url, reason);
    } else {
      await opts.residency.pin(url);
    }
    const result: Record<string, unknown> = { url, tier: opts.residency.tier(url) };
    if (reason !== undefined) result["reason"] = reason;
    return result;
  };
}

export function createUnpinHandler(opts: ResidencyHandlerOptions): CommandHandler {
  return async (args) => {
    const url = typeof args["url"] === "string" ? args["url"] : "";
    if (!url) throw new Error("args.url is required");
    opts.residency.unpin(url);
    return { url, tier: opts.residency.tier(url) };
  };
}

export function createResidencyStatsHandler(opts: ResidencyHandlerOptions): CommandHandler {
  return async () => {
    const stats = opts.residency.stats();
    return {
      pinned:    [...stats.pinned],
      hot:       stats.hot.map((e) => ({
        url:         e.url,
        lastTouched: e.lastTouched,
        ...(e.syncActive !== undefined && { syncActive: e.syncActive }),
      })),
      coldCount: stats.coldCount,
      hotCap:    stats.hotCap,
    };
  };
}
