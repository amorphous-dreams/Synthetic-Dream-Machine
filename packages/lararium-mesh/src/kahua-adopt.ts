/**
 * kahua-adopt — which stage document a device of the face mounts, read off the face's VERIFIED projection alone.
 *
 * The face's `@persona` log pins the stage with one signed `plane` act (`kahuaPlaneUrl`); a boot hands this reader the
 * projection its face proof returned (the admit bundle's acts fold there too). A catalog row any holder may rewrite
 * rides beside it as a mount hint: a row that names another document than the pin refuses by name and mounts nothing,
 * and a row with no pin behind it refuses the same way. A face with no pin stands the layer absent, by name, never a throw.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */

import { kahuaPlaneUrl } from "./kahua-stage.js";
import { KAHUA_BAG } from "./wiki-recipe.js";
import { tiddlerText } from "./base-doc.js";

export type KahuaAdoption =
  | { readonly mount: string }
  | { readonly absent: "kahua-unpinned" }
  | { readonly refused: "kahua-catalog-mismatch"; readonly catalog: string; readonly pinned: string | null };

export function adoptKahuaPlane(projection: { readonly planes: Readonly<Record<string, string | undefined>> }, group: string, catalogRow: string | null | undefined): KahuaAdoption {
  const pinned = kahuaPlaneUrl(projection, group);
  if (catalogRow && catalogRow !== pinned) return { refused: "kahua-catalog-mismatch", catalog: catalogRow, pinned };
  return pinned ? { mount: pinned } : { absent: "kahua-unpinned" };
}

/** The url a mounted adoption carries, else null: every refusal and every absence mounts nothing. */
export function adoptedKahuaUrl(adoption: KahuaAdoption): string | null {
  return "mount" in adoption ? adoption.mount : null;
}

/** The catalog's `bags/kahua` row: a mount hint, read as text, never an authority. */
export function kahuaCatalogRow(catalog: { readonly tiddlers?: Readonly<Record<string, unknown>> } | null | undefined): string | null {
  const text = tiddlerText(catalog?.tiddlers?.[KAHUA_BAG] as never);
  return typeof text === "string" && text.length > 0 ? text : null;
}
