/** Resolve readership from the plane a host mounted, never from a worker's claim or the target's tier. */
import type { ShareAudience } from "./share-tighten.js";
import type { IslandAudienceContext } from "./vessel-host.js";
import type { RecipePlane } from "./recipe-planes.js";

export function makeIslandAudienceReader(readers: {
  /** The currently verified face's absolute persona plane, or null at a herm floor. */
  ownFacePlane(): string | null;
  /** The effective recipe's registry plane. Catalog belongs to this vessel; oracle carries public defaults. */
  recipePlane(wikiSlug: string): RecipePlane | null;
}): (island: IslandAudienceContext) => ShareAudience | undefined {
  return (island) => {
    try {
      if (island.facePlaneId !== null) {
        return island.facePlaneId === readers.ownFacePlane() ? "in-process" : undefined;
      }
      const plane = readers.recipePlane(island.wikiSlug);
      return plane === "catalog" ? "in-process" : plane === "oracle" ? "world" : undefined;
    } catch {
      // An unreadable relation reaches the boundary as unresolved, never as a public or house member.
      return undefined;
    }
  };
}
