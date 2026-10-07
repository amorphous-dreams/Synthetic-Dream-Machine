/**
 * ingest-gate — THE CONFLUENCE: the pure three-way decision at the heart of
 * disk→records ingest, where three streams (disk · last-synced · records) meet
 * and reconcile — a conflict SURFACES rather than one stream drowning another
 * (Unison's law: surface, never overwrite). The human-facing name for this flow
 * is "the Confluence" (the Nucleus triangle; handoff #pattern-integrities §6).
 *
 * ONE gate, parameterized by a semantic congruence `≈` (Unison + SafeMerge: a
 * merge stays conflict-free BECAUSE it reads through a congruence, never raw
 * bytes). The `IngestOps` bundle carries that congruence for a carrier family:
 * how the family deserializes disk bytes, renders records to the canonical text
 * the gate hashes (`render(parse(disk)) ≈ current` names "framing only"), which
 * structural surface a round-trip MUST preserve, and how it grades a fault. The
 * DEFAULT ops read the memetic-wikitext family; a native filetype passes its own
 * `IngestOps`, so BOTH carrier families run this one triangle — one decision path,
 * each family reading it through its own congruence.
 *
 * Three states meet per carrier:
 *   - the DISK bytes (what the operator's hands left),
 *   - the SYNCED hash (last-projected canonical bytes — the merge base),
 *   - the RECORDS' current canonical render (the merge seat's view).
 *
 * The gate decides; it never writes. Callers (the `lares ingest` gesture,
 * later the watcher daemon) own I/O. Hashes arrive as opaque strings — the
 * gate compares, never computes, so it stays isomorphic and hash-agnostic.
 *
 * Decision law (in order):
 *   0. a fragment address        → REFUSE (a slot never founds a meme; framed families only)
 *   1. disk == synced            → NOOP (nothing happened on disk)
 *   1½. the frame reads BARE     → hold the bytes verbatim as ONE record, flagged UNSTABLE — bare
 *      data found on the internet is not a meme, so it is never parsed as one and never refused as
 *      a broken one (a family that declares no `frame` never reaches this leg)
 *   1¾. THE QUOTEBLOCK FLOOR, whole-chunk grain (`ahu.mem#/quoteblock-floor`): a frame that reads
 *      sound decomposes, and a carrier whose family split leaves an ERROR (a closer that closes
 *      nothing) or a MISSING (an opener whose closer never arrives) fences its WHOLE body as one
 *      quoteblock — a one-way demotion, never a drop — and carries a `quoteblocked` warning that the
 *      placement surfaces on the alert rail. A torn frame never reaches the floor: it refuses at 2.
 *      The deserializer lays the floor (`quoteblockFloor`, inside `memeticWikitextDeserializer`), so
 *      every door that reads a carrier — this gate, `canonicalizeCarrierText` on the projecting leg,
 *      and TW5's own import doors through the registered deserializer — reads one fence.
 *   2. the parse grades error    → REFUSE (the carrier stopped round-tripping)
 *      anything milder            → carry the diagnostics forward, never drop the bytes
 *      (native ops never grade error — a native deserialize throws — so the refuse
 *       leg rides dormant for that family, present in the shared shape, unfired)
 *   3. render(parse(disk)) == current render → NOOP canonical-equivalent
 *      (the edit changed framing only; the gofmt-loop guard), UNLESS the round-trip
 *      drops a declared structural slot (the ahu-fidelity guard; native declares
 *       ∅ structure, so the guard is a no-op for it)
 *   4. current render == synced  → INGEST (records unmoved since last
 *      projection; the disk edit applies cleanly)
 *   5. both moved                → CONFLICT (surface, never overwrite —
 *      Unison's law; the CRDT diff-splice path refines this later)
 */

// PURE subpath (no Automerge) — the barrel drags wasm the plugin build cannot bundle.
import { digestsEqual } from "@lararium/mesh/agile-digest";
import type { TiddlerFields } from "./deserializer.js";
import { deserializeCarrier, expandMemeRefs, quoteblockFloor, QUOTEBLOCKED_CODE, BARE_DATA_TYPE } from "./deserializer.js";
import { collectAhuSlots } from "./meme-ast/ahu-scan.js";
import { parseMemeText } from "./meme-ast/parse.js";
import { failuresToDiagnostics, gradeOf, MEMETIC_SOURCE } from "./meme-ast/diagnostics.js";
import type { MemeDiagnostic, DiagnosticSeverity } from "./meme-ast/diagnostics.js";
import { getGrammar } from "./grammar-cache.js";
import { headUriOf, verdict, type FrameFault, type FrameVerdict } from "@lararium/memetic-frame";
import { checkCarrier } from "./carrier-check.js";
import { metaKeyRedefinitions } from "./root-meta.js";

export type IngestDecision<R = TiddlerFields> =
  | { readonly kind: "noop"; readonly reason: "disk-matches-synced" | "canonical-equivalent" }
  | { readonly kind: "ingest"; readonly records: readonly R[]; readonly canonicalText: string; readonly diagnostics: readonly MemeDiagnostic[] }
  | { readonly kind: "conflict"; readonly records: readonly R[]; readonly canonicalText: string; readonly diagnostics: readonly MemeDiagnostic[] }
  | { readonly kind: "refuse"; readonly warnings: readonly string[]; readonly diagnostics: readonly MemeDiagnostic[] };

/**
 * The per-family congruence the gate reads through — the `≈` that decides what
 * counts as "the same carrier." A family (memetic-wikitext by default, a native
 * filetype otherwise) supplies:
 *   - `deserialize` — disk bytes → records + the fault diagnostics,
 *   - `render`      — records → the canonical text the gate hashes (the `≈` seat:
 *                     two disks that render equal read as framing-only),
 *   - `declaredStructure` — the structural surface a faithful round-trip preserves
 *                     (ahu slots for memetic; ∅ for native, opting out of the guard),
 *   - `grade`       — the fault severity; `error` refuses.
 *   - `frame`       — the frame verdict, for a family that frames its carriers (memetic). The gate
 *                     reads it itself, so no caller of the family's default ops can skip it.
 * The hash itself rides `IngestGateInput.hash` — the gate compares, never digests.
 */
export interface IngestOps<R = TiddlerFields> {
  deserialize(uri: string, text: string): { records: readonly R[]; diagnostics: readonly MemeDiagnostic[] };
  render(uri: string, records: readonly R[]): string;
  declaredStructure(text: string): ReadonlySet<string>;
  grade(diagnostics: readonly MemeDiagnostic[]): DiagnosticSeverity | "clean";
  frame?(text: string): FrameVerdict;
}

/** Bare data, held: one record carrying the bytes verbatim — no meta lifted, no slot split. */
function bareRecord(uri: string, text: string): TiddlerFields {
  return { title: uri, type: BARE_DATA_TYPE, text };
}

function diagnostic(severity: DiagnosticSeverity, code: string, message: string, length: number): MemeDiagnostic {
  return { from: 0, to: length, severity, source: MEMETIC_SOURCE, code, message };
}

/** Each tear's code on the diagnostics channel: a missing close and a fault of the frame's own spelling keep their names. */
const TORN_CODE: Readonly<Record<FrameFault["kind"], string>> = {
  "no-etx":            "block-check-torn",
  "meta-before-stx":   "meta-before-stx",
  "torn-spelling":     "torn-spelling",
  "second-stx":        "frame-malformed",
  "second-etx":        "frame-malformed",
  "etx-before-stx":    "frame-malformed",
  "eot-out-of-order":  "frame-malformed",
  "soh-inside-frame":  "frame-malformed",
};

/**
 * The gate's POLICY over the frame verdict, on the shared diagnostics channel.
 *
 *   · torn  → ERROR, each fault named: a frame the reader cannot divide without choosing never names
 *             an honest edit. A missing close keeps its own code (`block-check-torn`), a meta fence
 *             above STX its own (`meta-before-stx`); a mark the rule passed over reads `frame-malformed`.
 *   · stale → WARNING, both digests in the message. A stale check on a human's disk edit is an EDIT,
 *             never tampering: the check is a trailer the writer re-stamps on every emit, so the gate
 *             still owes the edit a real decision (noop/ingest/conflict), never a blanket refuse. The
 *             pre-commit hook (`tools/meme-check-staged.sh` via `lares meme check`) still refuses a
 *             staged stale check.
 *   · bare  → WARNING, UNSTABLE: the bytes hold, unread.
 *   · match, absent → nothing to say.
 */
export function frameDiagnostics(uri: string, v: FrameVerdict, length: number): MemeDiagnostic[] {
  switch (v.kind) {
    case "torn":
      return v.faults.map((f) => diagnostic("error", TORN_CODE[f.kind], f.message, length));
    case "stale":
      return [diagnostic("warning", "block-check-mismatch",
        `ni:/// block check does not match the STX–ETX body, including root TOML metadata — stored ${v.stored} · computed ${v.computed}`, length)];
    case "bare":
      return [diagnostic("warning", "bare-data",
        `${uri}: bare data — no frame stands (no head, no STX/ETX, no release); held verbatim, never read as a meme. WARNING: UNSTABLE`, length)];
    default:
      return [];
  }
}

/** The floor's vocabulary is the deserializer's own (the floor is laid there); the gate speaks it. */
export { QUOTEBLOCKED_CODE, quoteblockFence } from "./deserializer.js";

/**
 * The memetic-wikitext ops — the DEFAULT congruence. `decideIngest` reads these
 * when a caller passes no `ops`, so the memetic callers (and their vectors) run
 * unchanged: deserialize through the parser + shore on the shared diagnostics
 * channel, render through `expandMemeRefs`, guard fidelity on the ahu slot-set.
 */
export const memeticIngestOps: IngestOps<TiddlerFields> = {
  deserialize(uri, text) {
    const frame = verdict(text);
    if (frame.kind === "bare") return { records: [bareRecord(uri, text)], diagnostics: frameDiagnostics(uri, frame, text.length) };
    // The deserializer lays the floor right behind the frame verdict, and never under a torn one: a
    // tear refuses below, and a fence over it would hide the tear inside a span that reads sound. The
    // reads below stand on the text the records were split from — the fenced one, where a fence stands.
    const { records, floor } = deserializeCarrier(text, { title: uri });
    const read = floor?.text ?? text;
    const failures = parseMemeText(uri, read, getGrammar() ?? undefined).failures;
    return {
      records,
      diagnostics: [
        ...failuresToDiagnostics(failures, read.length),
        // The frame the bytes ARRIVED in is the one graded; the fence re-stamps a check that matched.
        ...frameDiagnostics(uri, frame, text.length),
        ...checkCarrier(uri, read),
        // A meta fence defining a key twice states no fields at all (TOML refuses the whole body), so the
        // carrier refuses at error grade rather than ingesting with its identity silently emptied.
        ...metaKeyRedefinitions(read).map((r) => diagnostic("error", "duplicate-meta-key", `${uri}: ${r.message}`, read.length)),
        ...(floor ? [diagnostic("warning", QUOTEBLOCKED_CODE, floor.message, text.length)] : []),
      ],
    };
  },
  render(uri, records) {
    const map = new Map(records.map((r) => [String(r.title), r] as const));
    return expandMemeRefs((t) => map.get(t), uri) ?? "";
  },
  // The structure a carrier declares is the structure its decomposition HOLDS: a fenced chunk declares
  // zero slots (fence-mask), so the ahu-fidelity guard passes by construction and the fence can never
  // mint a phantom slot or a false conflict.
  declaredStructure(text) {
    return collectAhuSlots(quoteblockFloor("", text, false)?.text ?? text);
  },
  grade(diagnostics) {
    return gradeOf(diagnostics);
  },
  frame: verdict,
};

export interface IngestGateInput {
  /** The carrier-root lar: URI this disk path projects. */
  readonly uri: string;
  /** Raw bytes read from disk (settled: quiet + stat-stable + hash-confirmed). */
  readonly diskText: string;
  /** Hash of diskText, computed by the caller. */
  readonly diskHash: string;
  /** Hash of the last-projected canonical bytes (the Synced tree); null = never projected. */
  readonly syncedHash: string | null;
  /** Hash of render(current records) — the merge seat's present canonical view. */
  readonly currentRenderHash: string;
  /** The caller's hash function — applied to the candidate canonical render. */
  readonly hash: (text: string) => string;
}

export function decideIngest<R = TiddlerFields>(
  input: IngestGateInput,
  ops?: IngestOps<R>,
): IngestDecision<R> {
  const { uri, diskText, diskHash, syncedHash, currentRenderHash, hash } = input;
  // Default to the memetic congruence — a caller that names none reads the memetic
  // family, so the memetic gate + its vectors stay byte-identical to the single-family era.
  const congruence = ops ?? (memeticIngestOps as unknown as IngestOps<R>);

  // 0 — A FRAGMENT ADDRESS NEVER FOUNDS A MEME. `#` may not repeat in a lar address, so a placement at
  // `uri#/slot` (or under a head naming one) could mint only `uri#/slot#/z` — a title the group law
  // admits and the address grammar has no name for. Every door that places through this gate refuses
  // it here; the `/memes/` PUT route answers the same wall before it reaches the gate.
  if (congruence.frame && (uri.includes("#") || (headUriOf(diskText) ?? "").includes("#"))) {
    const wall = diagnostic("error", "fragment-address",
      `${uri}: a fragment address never founds a meme — \`#\` may not repeat; place the ROOT and let the slot ride its body`,
      diskText.length);
    return { kind: "refuse", warnings: [wall.message], diagnostics: [wall] };
  }

  // 1 — echo gate: the disk holds exactly what the projector last wrote. Both sides
  // compare through `digestsEqual`, which reads only TAGGED digests: an anchor stored
  // bare names no algorithm and never echoes, so the carrier falls through to the
  // gates below (canonical equivalence, then the merge base, where it reads conflict).
  if (syncedHash !== null && digestsEqual(diskHash, syncedHash)) {
    return { kind: "noop", reason: "disk-matches-synced" };
  }

  // 2 — the gradient gate. The family's deserialize reports the parse + shore
  // faults on one diagnostics channel; the gate reads a grade rather than sniffing a
  // synthesised tiddler title. It refuses at `error`, the one fault that costs the
  // operator their bytes: a carrier that stopped round-tripping. Every recovery grades
  // below that, keeps its text, rides forward with its receipt. A family whose deserialize
  // THROWS on malformed input (the native filetypes) never grades error here — the refuse
  // leg rides dormant in the shared shape, present but unfired for that family.
  // 1½ — bare data: the frame verdict reads no frame at all. The bytes are held as they stand —
  // never parsed as a meme (a toml fence in bare data lifts into no field), never refused as a broken
  // one — and the hold IS the canonical text, flagged UNSTABLE.
  const frame = congruence.frame?.(diskText);
  if (frame?.kind === "bare") {
    if (hash(diskText) === currentRenderHash) return { kind: "noop", reason: "canonical-equivalent" };
    const held = [bareRecord(uri, diskText)] as unknown as readonly R[];
    return settle(input, held, diskText, frameDiagnostics(uri, frame, diskText.length));
  }

  const { records, diagnostics } = congruence.deserialize(uri, diskText);
  if (congruence.grade(diagnostics) === "error") {
    return {
      kind: "refuse",
      warnings: diagnostics.filter((d) => d.severity === "error").map((d) => d.message),
      diagnostics,
    };
  }
  const canonicalText = congruence.render(uri, records);
  if (canonicalText === "") {
    return { kind: "refuse", warnings: [`${uri}: shore produced no canonical render`], diagnostics };
  }

  // 3 — canonical-equivalence gate: the edit changed framing only.
  // The NOOP rests on ONE trust — that render(parse(disk)) faithfully carries
  // every byte the disk holds. A LOSSY shore breaks that trust: a structural
  // slot the disk declares that the render drops (the ahu-drop — a slash-path kahea
  // ref the recompose once clipped) makes render(parse(disk)) collapse toward the
  // stale current render, so an edit INSIDE the dropped slot reads as "framing
  // only" and never lands. The fidelity guard forbids the NOOP whenever the
  // round-trip loses a declared structural slot; a genuinely cosmetic edit keeps its
  // slot-set intact and still converges here. A family that declares ∅ structure
  // (the native filetypes) skips the guard by construction — nothing to drop.
  const candidateHash = hash(canonicalText);
  if (candidateHash === currentRenderHash) {
    const declared = congruence.declaredStructure(diskText);
    const rendered = congruence.declaredStructure(canonicalText);
    const dropped = [...declared].filter((s) => !rendered.has(s));
    if (dropped.length === 0) {
      return { kind: "noop", reason: "canonical-equivalent" };
    }
    // A lossy round-trip surfaces, never swallows: the disk carries slots the
    // render cannot reproduce, so the records have not caught up — treat it as
    // a clean ingest (never-projected or records-unmoved) or a conflict below.
  }

  return settle(input, records, canonicalText, diagnostics);
}

/** Rules 4–5: the records against the merge base, once the candidate stands. */
function settle<R>(
  input: IngestGateInput,
  records: readonly R[],
  canonicalText: string,
  diagnostics: readonly MemeDiagnostic[],
): IngestDecision<R> {
  const { syncedHash, currentRenderHash } = input;
  // 4 — clean ingest: the records stand where the last projection left them. A bare
  // anchor never reads as that base (`digestsEqual` refuses it), so it lands in 5.
  if (syncedHash !== null && digestsEqual(currentRenderHash, syncedHash)) {
    return { kind: "ingest", records, canonicalText, diagnostics };
  }
  // Never-projected carriers (syncedHash null) with no current-render match
  // read as fresh adoptions — clean ingest by definition.
  if (syncedHash === null) {
    return { kind: "ingest", records, canonicalText, diagnostics };
  }

  // 5 — both moved since the merge base: surface, never overwrite.
  return { kind: "conflict", records, canonicalText, diagnostics };
}
