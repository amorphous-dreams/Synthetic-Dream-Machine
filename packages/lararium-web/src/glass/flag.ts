export type GlassWidth = "full" | "skinny" | "story";

/** Read the explicit URL switch; storage has no authority to enable glass. */
export function glassWanted(location: Pick<Location, "search">, _storage?: Pick<Storage, "getItem">): GlassWidth | null {
  const value = new URLSearchParams(location.search).get("glass");
  if (value === null || value === "none") return null;
  if (value === "full" || value === "skinny" || value === "story") return value;
  throw new Error(`glass-width-refused:${value}`);
}
