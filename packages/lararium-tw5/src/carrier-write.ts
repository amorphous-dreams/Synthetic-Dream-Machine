/**
 * carrier-write — write-side carrier helpers for LarariumCrdtSyncAdaptor.
 *
 * Companion to carrier-split.ts (the read/parse side). These free functions
 * handle the TW5→store write path for ahu child slot tiddlers: inferring the
 * parent carrier URI, collecting sibling children, and reconstructing the
 * serialized carrier text before putting it to the store.
 *
 * All functions take explicit (tw5, store, ...) parameters rather than closing
 * over class state, making them independently testable.
 */

import type { LarTiddlerStore, LarTiddlerRecord, ChangeOrigin } from "@lararium/core";
import type { TW5TiddlerFields } from "./types/tiddlywiki.js";
import type { LarariumTW5 } from "./lararium-tw5.js";
import { serializeCarrier, replaceCarrierSlot, removeCarrierSlot, composeCarrierSlotBody } from "./carrier-split.js";

// ---------------------------------------------------------------------------
// Carrier child inference
// ---------------------------------------------------------------------------

/**
 * Given a child tiddler title, infer the parent carrier URI and slot name.
 *
 * Returns null if the title is not a recognisable child-carrier title.
 * Two routes:
 *   1. Explicit `ahu-parent` / `ahu-slot` fields on the live tiddler.
 *   2. Fragment convention: `lar:///parent#slot` — only accepted when the
 *      parent tiddler still exists in the wiki.
 */
export function inferChildCarrierTitle(
  tw5: LarariumTW5,
  title: string,
): { parentUri: string; slot: string } | null {
  const wiki = tw5.wiki;
  const tiddler = wiki.getTiddler?.(title);
  const fields: TW5TiddlerFields = tiddler?.fields ?? ({} as TW5TiddlerFields);

  const explicitParent = fields["ahu-parent"];
  if (typeof explicitParent === "string" && explicitParent) {
    const explicitSlot = fields["ahu-slot"];
    const slot =
      typeof explicitSlot === "string" && explicitSlot
        ? explicitSlot
        : title.startsWith(explicitParent)
          ? title.slice(explicitParent.length)
          : "";
    if (slot) return { parentUri: explicitParent, slot };
  }

  // If TW5 has already removed the child tiddler, infer from the fragment
  // title only when the parent tiddler is still present locally.
  const hash = title.lastIndexOf("#");
  if (!title.startsWith("lar:") || hash < 0) return null;
  const parentUri = title.slice(0, hash);
  const slot = title.slice(hash);
  if (!parentUri || !slot) return null;
  if (!wiki.getTiddler?.(parentUri)) return null;
  return { parentUri, slot };
}

// ---------------------------------------------------------------------------
// Carrier children collection
// ---------------------------------------------------------------------------

/**
 * Collect all ahu slot child tiddlers for a given parent carrier URI,
 * optionally excluding one title (used when a child is being deleted).
 */
export function buildCarrierChildren(
  tw5: LarariumTW5,
  parentUri: string,
  excludeTitle?: string,
): Array<{ title: string; fields: Record<string, string | string[]>; text: string }> {
  const wiki = tw5.wiki;
  const childTitles: string[] = tw5.filterTiddlers(`[tag[${parentUri}]has[ahu-slot]]`);
  return childTitles
    .filter((ct) => ct !== excludeTitle)
    .map((ct) => {
      const ct5 = wiki.getTiddler?.(ct);
      const cf: TW5TiddlerFields = ct5?.fields ?? ({} as TW5TiddlerFields);
      return {
        title: ct,
        fields: {
          ...(cf as Record<string, string | string[]>),
          "ahu-slot":   String(cf["ahu-slot"] ?? ""),
          "ahu-parent": parentUri,
          tags:         [parentUri],
        },
        text: String(cf["text"] ?? ""),
      };
    });
}

// ---------------------------------------------------------------------------
// Direct record construction
// ---------------------------------------------------------------------------

/** Build a `LarTiddlerRecord` for the `direct` save strategy. */
export function buildDirectRecord(
  title: string,
  fields: Record<string, string>,
  revision: string,
): LarTiddlerRecord {
  const textVal = fields["text"];
  return {
    title,
    fields: Object.fromEntries(
      Object.entries(fields)
        .filter(([k]) => k !== "text" && k !== "title")
        .map(([k, v]) => [k, String(v)]),
    ),
    ...(textVal !== undefined ? { text: textVal } : {}),
    revision,
    bag: "room",
  };
}

// ---------------------------------------------------------------------------
// Child-carrier record construction + write
// ---------------------------------------------------------------------------

/**
 * Reconstruct and write the parent carrier after one of its ahu slot children
 * was updated. Uses surgical slot replacement when possible; falls back to
 * full reconstruction from sibling children.
 */
export async function saveChildCarrierRecord(
  tw5: LarariumTW5,
  store: LarTiddlerStore,
  revisions: Map<string, string>,
  title: string,
  fields: Record<string, string>,
  revision: string,
  origin: ChangeOrigin,
): Promise<void> {
  const inferred = inferChildCarrierTitle(tw5, title);
  const parentUri = fields["ahu-parent"] ?? inferred?.parentUri ?? "";
  if (!parentUri) return;

  const wiki = tw5.wiki;
  const parentTiddler = wiki.getTiddler?.(parentUri);
  const parentFields: TW5TiddlerFields = parentTiddler?.fields ?? ({} as TW5TiddlerFields);
  const rawCarrierText = String(parentFields["text"] ?? "");

  const slot = title.startsWith(parentUri)
    ? title.slice(parentUri.length)
    : (inferred?.slot ?? null);
  const newSlotBody = composeCarrierSlotBody(fields, fields["text"] ?? "");

  let reconstructed: string;
  if (slot && rawCarrierText) {
    const spliced = replaceCarrierSlot(rawCarrierText, slot, newSlotBody);
    reconstructed =
      spliced !== null
        ? spliced
        : serializeCarrier(
            { title: parentUri, fields: parentFields as Record<string, string | string[]>, text: "" },
            buildCarrierChildren(tw5, parentUri),
          );
  } else {
    reconstructed = serializeCarrier(
      { title: parentUri, fields: parentFields as Record<string, string | string[]>, text: "" },
      buildCarrierChildren(tw5, parentUri),
    );
  }

  revisions.set(parentUri, revision);
  const record: LarTiddlerRecord = {
    title: parentUri,
    fields: Object.fromEntries(
      Object.entries(parentFields)
        .filter(([k]) => k !== "text" && k !== "title")
        .map(([k, v]) => [k, Array.isArray(v) ? v.join(" ") : String(v)]),
    ),
    text: reconstructed,
    revision,
    bag: "room",
  };
  await store.put(record, origin);
}

// ---------------------------------------------------------------------------
// Parent reconstruction after child delete
// ---------------------------------------------------------------------------

/**
 * After a child slot tiddler is deleted, reconstruct the parent carrier
 * excluding the deleted slot and write it to the store.
 */
export async function saveParentAfterChildDelete(
  tw5: LarariumTW5,
  store: LarTiddlerStore,
  revisions: Map<string, string>,
  childTitle: string,
  parentUri: string,
  slot: string,
  revision: string,
  origin: ChangeOrigin,
): Promise<void> {
  const wiki = tw5.wiki;
  const parentTiddler = wiki.getTiddler?.(parentUri);
  const parentFields: TW5TiddlerFields = parentTiddler?.fields ?? ({} as TW5TiddlerFields);
  const rawCarrierText = String(parentFields["text"] ?? "");

  let reconstructed = rawCarrierText ? removeCarrierSlot(rawCarrierText, slot) : null;
  if (reconstructed === null) {
    reconstructed = serializeCarrier(
      { title: parentUri, fields: parentFields as Record<string, string | string[]>, text: "" },
      buildCarrierChildren(tw5, parentUri, childTitle),
    );
  }

  revisions.set(parentUri, revision);
  await store.put(
    {
      title: parentUri,
      fields: Object.fromEntries(
        Object.entries(parentFields)
          .filter(([k]) => k !== "text" && k !== "title")
          .map(([k, v]) => [k, Array.isArray(v) ? v.join(" ") : String(v)]),
      ),
      text: reconstructed,
      revision,
      bag: "room",
    },
    origin,
  );
}
