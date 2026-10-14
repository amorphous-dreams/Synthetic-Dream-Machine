/**
 * delete-gate — which vanished carriers of a wave name a RENAME, and nothing else.
 * PURE: it compares, it never writes.
 *
 * A file that vanished from disk may name a delete, a branch switch, a checkout or a slip, and its bytes
 * cannot say which. So no wave tombstones a carrier: a vanished file stands as a PENDING REMOVAL at the
 * vessel's shore until a person answers (`lares shore remove | restore`,
 * `lar:///ha.ka.ba/lararium/api/disk-projection#/projection-law`). The one thing a wave may carry for a
 * vanished address is its RE-LINK: the same bytes arrived at another address, so the records move there
 * and keep their identity.
 *
 *   - RENAMES  — a vanished address whose base hash UNIQUELY matches an arrived file's disk hash
 *                (git/rclone exact-rename discipline); the record re-links, it never tombstones.
 *   - DECLINED — every other vanished address the wave named. Its records stand as they stood.
 *
 * Ambiguity never guesses: a hash shared by more than one vanished address OR more than one arrived
 * file re-links none of them (rclone's decline-on-ambiguity), and each such address reads declined.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/handoff (#watcher-talk-story)
 */

export interface PendingDelete {
  /** The carrier-root lar: URI gone from disk but present in the Synced tree. */
  readonly uri: string;
  /** Its last-projected canonical hash (the Synced tree value). */
  readonly syncedHash: string;
}

export interface FreshAdd {
  /** A new/changed carrier URI in the same settled wave. */
  readonly uri: string;
  /** Its disk hash. */
  readonly diskHash: string;
}

export interface RenameLink {
  readonly fromUri: string;
  readonly toUri: string;
}

export interface RenameWaveInput {
  readonly deletes: readonly PendingDelete[];
  readonly adds: readonly FreshAdd[];
}

export interface RenameWaveDecision {
  /** Each vanished address that re-links to the one arrived file holding its bytes. */
  readonly renames: readonly RenameLink[];
  /** Each vanished address that pairs with no arrival: nothing moves and nothing tombstones. */
  readonly declined: readonly string[];
}

/** Group a list by a key, preserving order within each bucket. */
function groupBy<T>(xs: readonly T[], key: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of xs) {
    const k = key(x);
    const bucket = m.get(k);
    if (bucket) bucket.push(x);
    else m.set(k, [x]);
  }
  return m;
}

export function pairRenames(input: RenameWaveInput): RenameWaveDecision {
  const { deletes, adds } = input;

  const deletesByHash = groupBy(deletes, (d) => d.syncedHash);
  const addsByHash = groupBy(adds, (a) => a.diskHash);

  const renames: RenameLink[] = [];
  const renamedUris = new Set<string>();

  // A rename re-link fires ONLY on a unique hash match: exactly one vanished address and exactly one
  // arrived file sharing that hash. Any collision declines.
  for (const [hash, dels] of deletesByHash) {
    const matchedAdds = addsByHash.get(hash);
    if (dels.length === 1 && matchedAdds && matchedAdds.length === 1) {
      renames.push({ fromUri: dels[0]!.uri, toUri: matchedAdds[0]!.uri });
      renamedUris.add(dels[0]!.uri);
    }
  }

  return { renames, declined: deletes.map((d) => d.uri).filter((uri) => !renamedUris.has(uri)) };
}
