import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { larIdentityDir } from "./vessel-paths.js";

export class LegacyPlaceBytesRefused extends Error {
  constructor(readonly row: "place-archive" | "vessel-card") {
    super(`[vessel] ${row} holds retired Keyhive place identity bytes; re-found this vessel from a fresh store`);
    this.name = "LegacyPlaceBytesRefused";
  }
}

/** The old place Individual cannot enter a face boot or a faceless floor. */
export function refuseLegacyPlaceBytes(identityDir = larIdentityDir()): void {
  if (existsSync(join(identityDir, "place-archive.bin"))) throw new LegacyPlaceBytesRefused("place-archive");
  if (!existsSync(identityDir)) return;
  for (const name of readdirSync(identityDir)) {
    if (/^\.vessel-card(?:-.+)?\.json$/.test(name)) throw new LegacyPlaceBytesRefused("vessel-card");
  }
}
