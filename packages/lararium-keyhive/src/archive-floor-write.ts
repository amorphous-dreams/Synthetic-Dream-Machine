/**
 * archive-floor-write — rest the selected face's Keyhive archive through the island's custody door.
 * A faceless or locked composition exports no identity bytes. The door reports write failures
 * so the island can surface them without pretending an archive landed.
 */

export type ArchiveFloorCarrier = "veil";

/**
 * The shore-injected writers. Absent → that carrier simply never persists.
 *
 * ── WHY THE BROWSER SHORE INJECTS NEITHER ─────────────────────────────────────────────────────────
 * The browser shore keeps a face's veil archive in its own custody row at founding or admit.
 * It injects no per-boot writer until that row has a custody door.
 */
export interface ArchiveFloorWriters {
  readonly persistVeilArchive?: (bytes: Uint8Array) => void | Promise<void>;
}

/** A write that was attempted and FAILED — decided here, surfaced by the caller (Rail B). */
export interface ArchiveFloorRefusal {
  readonly carrier: ArchiveFloorCarrier;
  readonly message: string;
}

export interface ArchiveFloorOutcome {
  /** Which carriers actually landed. */
  readonly wrote: readonly ArchiveFloorCarrier[];
  /** The standing gate barred every write — a locked vessel signing nothing. */
  readonly barred: boolean;
  /** Attempted writes that failed. The caller surfaces these; this door never raises. */
  readonly refusals: readonly ArchiveFloorRefusal[];
}

export interface ArchiveFloorInput {
  /**
   * Whether the selected face's archive opens — true only for a composition that holds the face key, carried
   * across the worker boundary on `daemonAuth`. Typed `unknown` deliberately: the door reads
   * `=== true` and bars everything else, so an omitted or drifted answer fails CLOSED rather than
   * relying on a caller's good manners.
   */
  readonly archiveOpens: unknown;
  readonly writers: ArchiveFloorWriters;
  /** Materialise the veil keyhive's archive bytes. NOT called on a barred boot. */
  readonly exportVeilArchive?: () => Promise<Uint8Array>;
}

/**
 * Land the archive floor, or bar it. The ONE site that performs the sovereign write.
 *
 * On a barred boot NOTHING runs — not the writer, and not the EXPORT either: `exportArchive()`
 * materialises prekey secrets in the heap, and a boot with no right to write them has no business
 * holding them.
 */
export async function persistArchiveFloor(input: ArchiveFloorInput): Promise<ArchiveFloorOutcome> {
  // THE DOOR'S OWN READING. `=== true` and nothing else — the whole point of standing here rather
  // than at the injection site is that this check cannot be skipped by a caller who says nothing.
  if (input.archiveOpens !== true) {
    return { wrote: [], barred: true, refusals: [] };
  }

  const wrote: ArchiveFloorCarrier[] = [];
  const refusals: ArchiveFloorRefusal[] = [];

  const land = async (
    carrier: ArchiveFloorCarrier,
    write: ((bytes: Uint8Array) => void | Promise<void>) | undefined,
    exportBytes: (() => Promise<Uint8Array>) | undefined,
  ): Promise<void> => {
    if (!write || !exportBytes) return;   // never injected → never persists; not a refusal
    try {
      await write(await exportBytes());
      wrote.push(carrier);
    } catch (err) {
      // DECIDED here, SURFACED by the caller. A failed export never blocks the boot.
      refusals.push({ carrier, message: (err as Error)?.message ?? String(err) });
    }
  };

  await land("veil",    input.writers.persistVeilArchive, input.exportVeilArchive);

  return { wrote, barred: false, refusals };
}
