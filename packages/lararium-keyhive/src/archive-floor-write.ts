/**
 * archive-floor-write — THE ONE DOOR that lands the sovereign identity archive on disk, and the
 * standing gate that stands ON that door.
 *
 * ══ WHY A DOOR AT ALL ═══════════════════════════════════════════════════════════════════════════
 *
 * The M3 boot re-seal exported the identity archive on EVERY boot, and its own comment named the
 * seam: "seed the on-disk archive FLOOR every boot" — written when only one boot shape existed.
 * A vessel whose archive holds SHUT boots too now (`standAs`, `readArchiveOpening`), and canon rules
 * what it may do there:
 *
 *   waking-floor #/the-shape:
 *     <<~ has Wake Hold "closed/every-sovereign-act ~ a locked vessel signs nothing">>
 *   waking-floor #/the-breaks:
 *     "The vessel's at-rest state never changes, so a stolen disk still yields nothing of anybody's
 *      person. Storage stays barred; presence stays welcome."
 *
 * Writing a fresh faceless keyhive export over a sealed sovereign archive is the highest-cost write
 * this vessel can perform: the bytes carry the founding DAG, the hydrated membership/capability ring
 * and the PREKEY SECRETS. A floor boot holds none of that and exports an empty one.
 *
 * ══ WHERE THE GATE STANDS — the worker, not the injection site ═══════════════════════════════════
 *
 * `waking-floor` #/the-breaks ① rules the placement:
 *   "A model that fences at the grant and not at the door has moved the check somewhere nobody
 *    performs it."
 *
 * The GRANT is where `node-daemon-island.ts` hands the worker its writers. The DOOR is where the
 * write is performed. So the gate stands HERE, in the worker, and it refuses on its OWN reading:
 * `archiveOpens === true` and nothing else passes, so an absent, undefined, mistyped or
 * class-string standing BARS. A caller cannot buy the write by forgetting to answer.
 *
 * This keeps `operator-daemon-behavior`'s own rule intact — "keyhive stays fs-blind". The gate reads
 * a BOOLEAN FACT the node computed, never a path, never a stat, never the config. It declines to
 * CALL the injected writer; it never learns where the writer writes.
 *
 * ══ WHAT THE GATE READS — the archive fact, not the class ════════════════════════════════════════
 *
 * `standAs(asked, archiveOpens)` renders a shut archive as `"herm"`, so class and archive-fact agree
 * wherever the SEAL decides the class. They part on two boots that MUST keep writing:
 *   · a FOUNDING — no face lit yet, so the class reads `"herm"` while the archive opens freely;
 *   · an operator-declared `--recipe herm` crossroads — a real vessel holding its own place identity.
 * A class gate would stop both from ever persisting their own identity, and the founding is this
 * cure's own CONTROL. What canon bars is a LOCKED vessel signing. `personaSlotCeiling("herm") === 0`
 * bars a SEATED persona root, never an archive. So the door reads the fact the ruling fences.
 *
 * ══ A READING, NEVER A THROW ═════════════════════════════════════════════════════════════════════
 *
 * A barred boot is not an error. It stands, serves the public shelf, holds every sovereign act
 * closed, and says so — `main.ts` already prints the reading's own `why`. This function returns
 * `barred: true` and writes nothing.
 *
 * ══ RAIL B — DECIDE IN THE READING, SURFACE OUT OF IT ════════════════════════════════════════════
 *
 * `graceful-parsing` #/rails: a reading never raises from inside itself. A writer that THROWS (the
 * write guard refusing over an unopenable seal, a full disk, a torn rename) is DECIDED here and
 * returned in `refusals`; the caller surfaces it on the rail it owns. A green boot is not a written
 * archive, so a refusal that reached only `console.warn` reached nobody at 3am.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/waking-floor
 */

/** The carriers this door lands. Two files, two writers — a gate proven on one proves nothing of the other. */
export type ArchiveFloorCarrier = "archive" | "veil";

/**
 * The shore-injected writers. Absent → that carrier simply never persists.
 *
 * ── WHY THE BROWSER SHORE INJECTS NEITHER, on the ground that actually holds ─────────────────────
 * Not "a browser vessel holds no fs" — measured, that reason reads FALSE. OPFS *is* a filesystem and
 * the browser shore already writes it (`browser-genesis.ts` lands CAS blobs by CID through
 * `navigator.storage.getDirectory()`, and the sovereign island resolves reads back out of it), with
 * IndexedDB beside it declaring itself the node-fs twin. The multi-writer hazard is solved too
 * (`vessel-lock.ts` Web Locks, one SharedWorker holder per origin).
 *
 * The ground that holds is CUSTODY, not substrate: the browser shore holds NO AT-REST SEAL for
 * self-sovereign secrets. `exportArchive()` materialises the founding DAG, the hydrated
 * membership/capability ring and the PREKEY SECRETS; landing those in OPFS or IDB today would write
 * them CLEARTEXT, with strictly LESS protection than node's sealed store — the same downgrade
 * `browser-vessel-identity.ts` already refuses by returning `recovery: null` rather than persisting
 * share material unsealed. So the omission is a RULED custody refusal that retires the day the
 * WebCrypto seal leg lands, never a claim about what the platform can write.
 *
 * ⚠ THE LATENT EDGE, named where the writer would be injected: the browser entry hard-codes
 * `archiveOpens: true` (its archive is `no-seal-expected`, so the reading is vacuously open), and this
 * door gates on THAT BOOLEAN ALONE. The pairing is inert only while the writers stay absent — inject
 * one before the seal leg exists and it writes unconditionally, unsealed. The seal leg comes FIRST.
 */
export interface ArchiveFloorWriters {
  readonly persistArchive?: (bytes: Uint8Array) => void | Promise<void>;
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
   * Whether THIS vessel's identity archive opens — the node's `readArchiveOpening().opens`, carried
   * across the worker boundary on `daemonAuth`. Typed `unknown` deliberately: the door reads
   * `=== true` and bars everything else, so an omitted or drifted answer fails CLOSED rather than
   * relying on a caller's good manners.
   */
  readonly archiveOpens: unknown;
  readonly writers: ArchiveFloorWriters;
  /** Materialise the vessel keyhive's archive bytes. NOT called on a barred boot. */
  readonly exportArchive?: () => Promise<Uint8Array>;
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
  await land("archive", input.writers.persistArchive,     input.exportArchive);

  return { wrote, barred: false, refusals };
}
