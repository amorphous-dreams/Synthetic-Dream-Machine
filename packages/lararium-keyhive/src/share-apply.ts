/**
 * share-apply — THE SHARE CONFIG LANDS, by reference and delegation, never a copy (sealed-store#/the-share-config).
 *
 * For every grant the rows owe (`owedGrants` over the one resolver), where the owner face and the grantee face both stand lit
 * here: the bag's catalog row (its document's url, which the owner's catalog half holds) lifts into the grantee's catalog half,
 * so the grantee resolves the ONE document, and the owner's hive delegates the bag to the grantee's. A grant whose owner or
 * grantee stands shut waits behind an opaque flag in the control document (`sharePendingTitle`: no face, no bag, no access),
 * and the next light that runs this lands it and clears the flag. A name no face carries waits, named, in the answer.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-share-config
 */
import {
  isHouseCanonBag, owedGrants, ownEntry, plainRecordOrNull, resolveShare, sharePendingTitle, shareRowBag, storedRecord,
  type LarDoc, type OwedGrant, type ShareFace, type ShareRow, type StoredLarRecord,
} from "@lararium/mesh";

/** A face of the vessel as the share door reads it: its handle index, its pet-name, and, while lit, its group and catalog half. */
export interface ShareLitFace extends ShareFace {
  readonly group: string | null;
  /** The face's own catalog half, or null while it stands shut. */
  readonly catalog: () => Promise<{ doc(): LarDoc | undefined; change(fn: (d: LarDoc) => void): void } | null>;
}

export interface ShareApplyDeps {
  readonly rows: () => Promise<readonly ShareRow[]>;
  readonly faces: readonly ShareLitFace[];
  /** Delegate `bag` from the owner face's hive to the grantee's (both lit). */
  readonly grant: (g: OwedGrant & { readonly ownerGroup: string; readonly granteeGroup: string }) => Promise<void>;
  readonly flag: { set(title: string): Promise<void>; clear(title: string): Promise<void> };
  /** A vessel-own salt, so the opaque flag reads alike on no other vessel. */
  readonly salt: string;
}

export interface ShareApplied {
  readonly granted: number;
  /** How many grants wait behind a shut face (a count; the flags name nothing). */
  readonly pending: number;
  /** Each pet-name a row names that no face here carries. */
  readonly waiting: readonly string[];
}

export async function applyShares(deps: ShareApplyDeps): Promise<ShareApplied> {
  const rows = await deps.rows();
  const halves = new Map<number, Awaited<ReturnType<ShareLitFace["catalog"]>>>();
  for (const face of deps.faces) halves.set(face.handleIndex, await face.catalog().catch(() => null));
  const rowIn = (doc: LarDoc | undefined, bag: string): StoredLarRecord | undefined => ownEntry(doc?.tiddlers, bag) as StoredLarRecord | undefined;
  const ownerOf = (bag: string): number | null => {
    for (const face of deps.faces) if (rowIn(halves.get(face.handleIndex)?.doc(), bag) !== undefined) return face.handleIndex;
    return null;
  };
  const grants = owedGrants({ rows, faces: deps.faces, ownerOf, houseCanon: isHouseCanonBag });
  let granted = 0, pending = 0;
  for (const g of grants) {
    const flag = sharePendingTitle(g, deps.salt);
    const owner = deps.faces.find((f) => f.handleIndex === g.owner), grantee = deps.faces.find((f) => f.handleIndex === g.grantee);
    const ownerHalf = halves.get(g.owner), granteeHalf = halves.get(g.grantee);
    if (!owner?.group || !grantee?.group || !ownerHalf || !granteeHalf) { await deps.flag.set(flag); pending++; continue; }
    // BY REFERENCE: the grantee's catalog half names the owner's ONE document; nothing copies its content.
    const row = plainRecordOrNull(rowIn(ownerHalf.doc(), g.bag) as never);
    if (row !== null && rowIn(granteeHalf.doc(), g.bag) === undefined) granteeHalf.change((d) => { d.tiddlers[g.bag] = storedRecord(row) as never; });
    try {
      await deps.grant({ ...g, ownerGroup: owner.group, granteeGroup: grantee.group });
      await deps.flag.clear(flag);
      granted++;
    } catch { await deps.flag.set(flag); pending++; }
  }
  const waiting = new Set<string>();
  for (const row of rows) for (const name of resolveShare({ bag: shareRowBag(row), rows, faces: deps.faces }).waiting) waiting.add(name);
  return { granted, pending, waiting: [...waiting].sort() };
}
