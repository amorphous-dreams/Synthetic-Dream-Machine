/**
 * share-apply — THE SHARE CONFIG LANDS, by reference and delegation, never a copy (sealed-store#/the-share-config).
 *
 * For every grant the rows owe (`owedGrants` over the one resolver), where the owner face and the grantee face both stand lit
 * here: the bag's catalog row (its document's url, which the owner's catalog half holds) lifts into the grantee's catalog half,
 * so the grantee resolves the ONE document, and the owner's hive delegates the bag to the grantee's. A grant whose owner or
 * grantee stands shut waits behind an opaque flag in the control document (`sharePendingTitle`: no face, no bag, no access),
 * and the next light that runs this lands it and clears the flag. A name no face carries waits, named, in the answer.
 *
 * A FACE'S CATALOG HALF OPENS ONLY WHILE THAT FACE STANDS WORN: it rests sealed under the face's own content key, and the
 * island's one holder carries the worn face's. So a lit grantee that stands beside the worn owner takes its grant in two
 * acts, each by an event and none by a clock: the owner's hive delegates NOW and the row CARRIES in the control document
 * (`carry`, a vessel-held row no face reads); the grantee's own wear LIFTS the carried row into its own half and the carry
 * leaves. The landing never asks for a half it cannot open.
 *
 * A WIKI'S ROW ALSO SEATS ITS WORKBENCH (cabal-realm#/the-workbench): beside the canon's grants, the owner face stands the
 * wiki's realm (founded at the wiki's first stand, else now) and seats every lit face the row names in its Document, revoking
 * each face the row stopped naming (`workbench`, the composer's port over `landWorkbench`). A named face that stands shut seats
 * at its next light. THE WORKBENCH'S OWNER reads off the vessel's ledger (`workbenchOwner`: the face whose realm binds the slug),
 * else the face whose catalog half names the wiki's canon; a HOUSE CANON wiki, whose canon no catalog row names, founds under
 * the face that lands the share where no face stood it yet. A house canon wiki's row seats its workbench and grants no canon:
 * every face reads house canon from the floor, and the Kahu steward alone writes it live.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-share-config
 */
import {
  isHouseCanonBag, owedGrants, ownEntry, plainRecordOrNull, recipeUri, resolveShare, sharePendingTitle, shareRowBag, storedRecord,
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
  /**
   * The rows that wait for a face's wear, in the control document: `put` keeps one catalog row for (grantee group, row title:
   * a bag's row, or a shared wiki's recipe row), `list` reads
   * a group's, `clear` drops one. Absent: a grantee whose half does not open here waits behind its flag (a composer with no
   * control document).
   */
  readonly carry?: {
    put(granteeGroup: string, bag: string, row: StoredLarRecord): Promise<void>;
    list(granteeGroup: string): Promise<ReadonlyArray<{ readonly bag: string; readonly row: StoredLarRecord }>>;
    clear(granteeGroup: string, bag: string): Promise<void>;
  };
  /**
   * Delegate `bag` from the owner face's hive to the grantee's (both lit). It MAY answer `fresh`: false where the owner's roster
   * already held that delegation (the roster's own read), so a replay counts as no move; a port that answers nothing reads fresh.
   */
  readonly grant: (g: OwedGrant & { readonly ownerGroup: string; readonly granteeGroup: string }) => Promise<void | { readonly fresh?: boolean }>;
  /** `has` (optional) reads whether a grant's flag stood before this landing: a grant that waited counts as a move when it lands. */
  readonly flag: { set(title: string): Promise<void>; clear(title: string): Promise<void>; has?(title: string): Promise<boolean> };
  /** A vessel-own salt, so the opaque flag reads alike on no other vessel. */
  readonly salt: string;
  /**
   * Land one wiki row's workbench under its lit owner, seating the lit member faces (`landWorkbench`). Absent: wiki rows land
   * their canon's grants alone (a composer with no ledger, a test of the grants).
   */
  /** One line per landing phase, with the milliseconds it took: a slow landing names the phase that held it. */
  readonly log?: (line: string) => void;
  /**
   * The face that OWNS a wiki's workbench on this vessel: the lit face whose realm the vessel's ledger binds the slug under
   * (`bound`), else the face that would found it for a wiki no catalog half names (`founder`: the face that lands the share).
   * Absent: the canon bag's owner alone.
   */
  readonly workbenchOwner?: (slug: string) => Promise<{ readonly bound: number | null; readonly founder: number | null; readonly boundElsewhere: boolean }>;
  readonly workbench?: (row: ShareRow, owner: { readonly handleIndex: number; readonly group: string }, members: ReadonlyArray<{ readonly handleIndex: number; readonly group: string; readonly access: "read" | "write" }>) => Promise<ShareWorkbenchLanded>;
}

/** One wiki row's workbench as the landing reports it. */
export interface ShareWorkbenchLanded {
  readonly slug: string; readonly realmId: string; readonly founded: boolean; readonly members: number;
  readonly removed: readonly string[];
  /** How many member faces this landing seated that the roster did not already hold (a replay seats none). */
  readonly seated?: number;
  /** The handle index of the face that owns the workbench on this vessel: a vessel-local answer for the operator's own door. */
  readonly owner?: number;
  /** The vessel seals this workbench's document under its owner face's key (the wiki it mounts): a seat another face holds writes `personal` on this vessel. */
  readonly restsUnderOwner?: boolean;
}

export interface ShareApplied {
  readonly granted: number;
  /**
   * Of the granted, how many MOVED something this landing: a delegation the owner's roster did not hold yet, a row written into
   * a grantee's open half, or a grant that had waited behind its flag. A replay over a landed share moves none, so a door that
   * reports a landing (the seed) says nothing for it.
   */
  readonly moved: number;
  /** How many grants wait behind a shut face (a count; the flags name nothing). */
  readonly pending: number;
  /** Of the granted, how many rows carry in the control document until their grantee stands worn (its half opens then). */
  readonly carried: number;
  /** How many carried rows this landing lifted into a half that opens here (the worn face's). */
  readonly lifted: number;
  /** Each pet-name a row names that no face here carries. */
  readonly waiting: readonly string[];
  /** Each wiki row's workbench the landing reached. */
  readonly workbenches: readonly ShareWorkbenchLanded[];
  /**
   * Each row whose bag no catalog half open here names (its owner stands shut, or stands lit and unworn, or the bag was never
   * stood on this vessel): the row owes nothing this landing can read, and the door says so by slug.
   */
  readonly unowned: readonly string[];
}

/**
 * THE WEAR LIFTS WHAT CARRIED: each row the control document carries for `group` lands in that face's own catalog half (by
 * reference: the row names the owner's ONE document) and the carry leaves. The face's stand runs it once its half opens, and
 * every share landing runs it for the half it holds open. A row the half already names writes nothing; a replay lifts none.
 * Answers how many carries left.
 */
export async function liftCarriedShares(input: {
  readonly group: string; readonly handleIndex?: number;
  readonly half: { doc(): LarDoc | undefined; change(fn: (d: LarDoc) => void): void };
  readonly carry: NonNullable<ShareApplyDeps["carry"]>;
  readonly log?: (line: string) => void;
}): Promise<number> {
  let lifted = 0;
  for (const waitingRow of await input.carry.list(input.group)) {
    if (ownEntry(input.half.doc()?.tiddlers, waitingRow.bag) === undefined) input.half.change((d) => { d.tiddlers[waitingRow.bag] = storedRecord(waitingRow.row as never) as never; });
    await input.carry.clear(input.group, waitingRow.bag);
    lifted++;
    input.log?.(`[share-apply] a carried row landed in ${input.handleIndex === undefined ? "the worn face" : `h${input.handleIndex}`}'s catalog half`);
  }
  return lifted;
}

export async function applyShares(deps: ShareApplyDeps): Promise<ShareApplied> {
  const rows = await deps.rows();
  const halves = new Map<number, Awaited<ReturnType<ShareLitFace["catalog"]>>>();
  for (const face of deps.faces) {
    const tc = performance.now();
    halves.set(face.handleIndex, await face.catalog().catch(() => null));
    if (face.group) deps.log?.(`[share-apply] h${face.handleIndex}'s catalog half ${halves.get(face.handleIndex) ? "read" : "opens at that face's own wear"} (${Math.round(performance.now() - tc)}ms)`);
  }
  const rowIn = (doc: LarDoc | undefined, bag: string): StoredLarRecord | undefined => ownEntry(doc?.tiddlers, bag) as StoredLarRecord | undefined;
  // THE WEAR LIFTS WHAT CARRIED, here as at the worn face's own stand (`liftCarriedShares`).
  let lifted = 0;
  for (const face of deps.faces) {
    const own = halves.get(face.handleIndex);
    if (face.group && own && deps.carry) lifted += await liftCarriedShares({ group: face.group, handleIndex: face.handleIndex, half: own, carry: deps.carry, ...(deps.log ? { log: deps.log } : {}) });
  }
  // THE ROW'S OWN OWNER WINS: a grantee's half names a shared bag too (by reference), so under the grantee's wear its half
  // alone opens and would read as the owner's. Where a row names its owner by pet-name, only that face owns the bag here: a
  // reader never delegates the bag onward, and the grant waits for its owner's wear, unnamed and unflagged.
  const namedOwner = (bag: string): number | null | undefined => {
    const pet = rows.find((r) => shareRowBag(r) === bag && typeof r.owner === "string" && r.owner !== "")?.owner;
    if (pet === undefined) return undefined;
    const named = deps.faces.filter((f) => f.petname === pet);
    return named.length === 1 ? named[0]!.handleIndex : null;
  };
  const ownerOf = (bag: string): number | null => {
    const named = namedOwner(bag);
    for (const face of deps.faces) {
      if (rowIn(halves.get(face.handleIndex)?.doc(), bag) === undefined) continue;
      if (named !== undefined && named !== face.handleIndex) continue;
      return face.handleIndex;
    }
    return null;
  };
  const grants = owedGrants({ rows, faces: deps.faces, ownerOf, houseCanon: isHouseCanonBag });
  const t0 = performance.now();
  deps.log?.(`[share-apply] ${rows.length} row(s), ${deps.faces.filter((f) => f.group).length} lit face(s), ${grants.length} grant(s) owed`);
  let granted = 0, pending = 0, carried = 0, moved = 0;
  for (const g of grants) {
    const tg = performance.now();
    const flag = sharePendingTitle(g, deps.salt);
    const waited = deps.flag.has ? await deps.flag.has(flag).catch(() => false) : false;
    const owner = deps.faces.find((f) => f.handleIndex === g.owner), grantee = deps.faces.find((f) => f.handleIndex === g.grantee);
    const ownerHalf = halves.get(g.owner), granteeHalf = halves.get(g.grantee);
    // The owner's half names the row (`ownerOf` read it there), so it opens here; a lit grantee's half opens only where the
    // grantee stands worn, and with no carry to hold its row the grant waits as a shut face's does.
    if (!owner?.group || !grantee?.group || !ownerHalf || (!granteeHalf && !deps.carry)) { await deps.flag.set(flag); pending++; continue; }
    // BY REFERENCE: the grantee's catalog half names the owner's ONE document; nothing copies its content. A WIKI row hands
    // over the wiki's own recipe row beside its canon's, so the grantee mounts the wiki and never only holds its bag.
    const titles = [g.bag, ...rows.filter((r) => r.kind === "wiki" && shareRowBag(r) === g.bag).map((r) => recipeUri("catalog", r.slug))];
    const owned = titles.map((title) => ({ title, row: plainRecordOrNull(rowIn(ownerHalf.doc(), title) as never) })).filter((t) => t.row !== null);
    let wrote = false;
    if (granteeHalf) {
      const owed = owned.filter((t) => rowIn(granteeHalf.doc(), t.title) === undefined);
      if (owed.length > 0) { granteeHalf.change((d) => { for (const t of owed) d.tiddlers[t.title] = storedRecord(t.row!) as never; }); wrote = true; }
    }
    try {
      const delegated = await deps.grant({ ...g, ownerGroup: owner.group, granteeGroup: grantee.group });
      const fresh = !(delegated && delegated.fresh === false);
      // THE ROWS CARRY where the grantee's half stays shut to this island: its own wear lifts them (above).
      if (!granteeHalf && owned.length > 0) { for (const t of owned) await deps.carry!.put(grantee.group, t.title, storedRecord(t.row!) as never); carried++; }
      await deps.flag.clear(flag);
      granted++;
      // WHAT MOVED: a delegation the roster did not hold, a row this landing wrote, or a grant that had waited behind its flag.
      if (fresh || wrote || waited) moved++;
      deps.log?.(`[share-apply] grant ${g.bag} h${g.owner} -> h${g.grantee} landed in ${Math.round(performance.now() - tg)}ms`);
    } catch { await deps.flag.set(flag); pending++; deps.log?.(`[share-apply] grant ${g.bag} h${g.owner} -> h${g.grantee} waits (${Math.round(performance.now() - tg)}ms)`); }
  }
  const workbenches: ShareWorkbenchLanded[] = [];
  if (deps.workbench) {
    for (const row of rows) {
      if (row.kind !== "wiki") continue;
      const bag = shareRowBag(row);
      // THE OWNER: the face whose realm the ledger binds the slug under; a slug bound under a face that stands shut waits for
      // its light. Where no face stood the wiki yet, the canon's owner founds it, and a house canon wiki's lander does.
      const seat = await deps.workbenchOwner?.(row.slug) ?? null;
      if (seat?.boundElsewhere && seat.bound === null) continue;
      const ownerIndex = seat?.bound ?? (isHouseCanonBag(bag) ? seat?.founder ?? null : ownerOf(bag));
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
      const tw = performance.now();
      workbenches.push({ ...(await deps.workbench(row, { handleIndex: owner.handleIndex, group: owner.group }, members)), owner: owner.handleIndex });
      deps.log?.(`[share-apply] workbench ${row.slug} (${members.length} member face(s)) landed in ${Math.round(performance.now() - tw)}ms`);
    }
  }
  const waiting = new Set<string>();
  for (const row of rows) for (const name of resolveShare({ bag: shareRowBag(row), rows, faces: deps.faces }).waiting) waiting.add(name);
  deps.log?.(`[share-apply] done in ${Math.round(performance.now() - t0)}ms: ${granted} granted (${carried} carried to a face's next wear), ${lifted} lifted, ${pending} pending, ${workbenches.length} workbench(es)`);
  const unowned = rows.filter((row) => !isHouseCanonBag(shareRowBag(row)) && ownerOf(shareRowBag(row)) === null).map((row) => row.slug).sort();
  return { granted, moved, pending, carried, lifted, waiting: [...waiting].sort(), workbenches, unowned };
}
