/**
 * kahua-adopt — which stage document a device of the face mounts, read off the face's VERIFIED projection alone.
 *
 * The face's `@persona` log pins the stage with one signed `plane` act (`kahuaPlaneUrl`); a boot hands this reader the
 * projection its face proof returned (the admit bundle's acts fold there too). A catalog row any holder may rewrite
 * rides beside it as a mount hint and decides nothing: the mount reads the pin alone, so a row naming another document
 * reads STALE by name (a joinee's floor face leaves one before the join) and the pin still mounts. A face with no pin
 * stands the layer absent, by name, never a throw.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */

import { kahuaPlaneUrl } from "./kahua-stage.js";
import { KAHUA_BAG } from "./wiki-recipe.js";
import { tiddlerText, type LarDoc } from "./base-doc.js";
import { ownEntry } from "./stored-value.js";

export type KahuaAdoption =
  | { readonly mount: string; readonly staleRow?: string }
  | { readonly absent: "kahua-unpinned"; readonly staleRow?: string };

export function adoptKahuaPlane(projection: { readonly planes: Readonly<Record<string, string | undefined>> }, group: string, catalogRow: string | null | undefined): KahuaAdoption {
  const pinned = kahuaPlaneUrl(projection, group);
  const stale = catalogRow && catalogRow !== pinned ? { staleRow: catalogRow } : {};
  return pinned ? { mount: pinned, ...stale } : { absent: "kahua-unpinned", ...stale };
}

/** The url a mounted adoption carries, else null: an absence mounts nothing. */
export function adoptedKahuaUrl(adoption: KahuaAdoption): string | null {
  return "mount" in adoption ? adoption.mount : null;
}

/** The catalog's `bags/kahua` row: a mount hint, read as text, never an authority. */
export function kahuaCatalogRow(catalog: LarDoc | null | undefined): string | null {
  const text = tiddlerText(ownEntry(catalog?.tiddlers, KAHUA_BAG));
  return typeof text === "string" && text.length > 0 ? text : null;
}
