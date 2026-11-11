/**
 * share-apply — THE SHARE CONFIG LANDS, by reference and delegation, never a copy (sealed-store#/the-share-config).
 *
 * For every grant the rows owe (`owedGrants` over the one resolver), where the owner face and the grantee face both stand lit
 * here: the bag's catalog row (its document's url, which the owner's catalog half holds) lifts into the grantee's catalog half,
 * so the grantee resolves the ONE document, and the owner's hive delegates the bag to the grantee's. A grant whose owner or
 * grantee stands shut waits behind an opaque flag in the control document (`sharePendingTitle`: no face, no bag, no access),
 * and the next light that runs this lands it and clears the flag. A name no face carries waits, named, in the answer.
 *
 * A WIKI'S ROW ALSO SEATS ITS WORKBENCH (cabal-realm#/the-workbench): beside the canon's grants, the owner face stands the
 * wiki's realm (founded at the wiki's first stand, else now) and seats every lit face the row names in its Document, revoking
 * each face the row stopped naming (`workbench`, the composer's port over `landWorkbench`). A named face that stands shut seats
 * at its next light.
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
  /**
   * Land one wiki row's workbench under its lit owner, seating the lit member faces (`landWorkbench`). Absent: wiki rows land
   * their canon's grants alone (a composer with no ledger, a test of the grants).
   */
  readonly workbench?: (row: ShareRow, owner: { readonly handleIndex: number; readonly group: string }, members: ReadonlyArray<{ readonly handleIndex: number; readonly group: string; readonly access: "read" | "write" }>) => Promise<ShareWorkbenchLanded>;
}

/** One wiki row's workbench as the landing reports it. */
export interface ShareWorkbenchLanded {
  readonly slug: string; readonly realmId: string; readonly founded: boolean; readonly members: number;
  readonly removed: readonly string[];
}

export interface ShareApplied {
  readonly granted: number;
  /** How many grants wait behind a shut face (a count; the flags name nothing). */
  readonly pending: number;
  /** Each pet-name a row names that no face here carries. */
  readonly waiting: readonly string[];
  /** Each wiki row's workbench the landing reached. */
  readonly workbenches: readonly ShareWorkbenchLanded[];
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
  const workbenches: ShareWorkbenchLanded[] = [];
  if (deps.workbench) {
    for (const row of rows) {
      if (row.kind !== "wiki") continue;
      const bag = shareRowBag(row);
      if (isHouseCanonBag(bag)) continue;
      const ownerIndex = ownerOf(bag);
      const owner = ownerIndex === null ? undefined : deps.faces.find((f) => f.handleIndex === ownerIndex);
      if (!owner?.group) continue;
      const answer = resolveShare({ bag, rows, faces: deps.faces, owner: owner.handleIndex });
      const members: Array<{ handleIndex: number; group: string; access: "read" | "write" }> = [];
      for (const index of answer.read) {
        if (index === owner.handleIndex) continue;
        const face = deps.faces.find((f) => f.handleIndex === index);
        if (!face?.group) continue;   // a shut face seats at its next light: its canon grant already waits behind a flag
        members.push({ handleIndex: index, group: face.group, access: answer.write.includes(index) ? "write" : "read" });
      }
      workbenches.push(await deps.workbench(row, { handleIndex: owner.handleIndex, group: owner.group }, members));
    }
  }
  const waiting = new Set<string>();
  for (const row of rows) for (const name of resolveShare({ bag: shareRowBag(row), rows, faces: deps.faces }).waiting) waiting.add(name);
  return { granted, pending, waiting: [...waiting].sort(), workbenches };
}
