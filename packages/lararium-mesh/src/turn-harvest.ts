/**
 * turn-harvest — the graceful-gradient harvester (island grammar over the boot HUD).
 * Meme: lar:///ha.ka.ba/lararium/mesh/turn-harvest
 *
 * The boot frame names a GRAMMAR, never a deterministic output. A grammar
 * manifests PROVISIONALLY in use — the juru in the fight rarely matches the
 * jurusan on the pancer; one never reads the Capital/lowercase chart aloud. So a
 * real turn carries degraded, partial, missing, or freshly-invented grammar:
 * frames that don't cleanly open/close, Voices and lenses in varied glyphs and
 * words, panels carrying whichever keys the turn needed.
 *
 * This harvester reads that gradient. It follows the ISLAND-GRAMMAR discipline
 * (Moonen): each sigil family forms an ISLAND, precisely matched; everything
 * between forms WATER, swallowed and COUNTED, never dropped. The `<<~` opener
 * serves as the panic-sync anchor. What reads clean harvests whole; what reads
 * degraded records gracefully at a lower standing; below the floor a turn
 * abstains on structure and keeps its RAW source (never-drop-the-source).
 *
 * FOUR ISLANDS, NOT SEVEN. A turn carries a bearing (`lares aim` / `lares yield`),
 * Voices surfacing in prose, ONE panel sigil whose named keys hold every gauge
 * (`set hud="aim" … focus= feedback= drift-ward= mode= mood= mu= stance=`), and
 * whatever other sigils it fires. The panel is why this reads as four families
 * rather than one per gauge: a reader that scans for a gauge SIGIL finds none
 * and reports a turn that gauged as a turn that did not.
 *
 * Pure + isomorphic: text in, a {@link TurnHarvest} out — no I/O, no store, no
 * holder, no LLM in the parse path. The expensive salvage tier (an LLM reading
 * the residue) lives downstream, behind a causal-island boundary, so harvested
 * signal enters the stack as deterministic facts.
 */

import { harvest, type Bearing } from "./bearing-harvest.js";

/** A single in-stream signal, anchored to where it sounded (offset into the turn). */
export interface OffsetSignal {
  /** Verbatim span, exactly as written. */
  readonly raw: string;
  /** Character offset of the signal's opener within the turn text. */
  readonly offset: number;
}

/** A Voice surfacing — `Lares (Council):`, `**Map-Wisp (Scryer):**`, `Mask: Name (Role):`. */
export interface VoiceSignal extends OffsetSignal {
  /** The surfaced name (`Lares`, `Map-Wisp`, …). */
  readonly name: string;
  /** The parenthesized role (`Council`, `Scryer`, …), or null when none rode along. */
  readonly role: string | null;
  /** A mask name when the form read `Mask: Name (Role)`, else null. */
  readonly mask: string | null;
}

/**
 * A `<<~ set hud="aim" … >>` panel — the turn's instruments in one firing.
 *
 * Every gauge rides as a NAMED KEY, so this carries the key map verbatim rather than a field per
 * gauge: a panel that fires a key this reader never heard of still harvests it, and a key that
 * retires costs no parse. `hud` reads `aim` at open and `yield` at close; a mid-turn `set` carries
 * none, which is the only thing distinguishing the three firings.
 */
export interface PanelSignal extends OffsetSignal {
  /** `aim` · `yield` · null for a mid-turn set. */
  readonly hud: string | null;
  /** Every `key="value"` the firing carried, in the order written. */
  readonly keys: Readonly<Record<string, string>>;
}

/**
 * A mid-turn phase marker — `->✶`, `->⏿`, `->◇`, `->▶`, `->↺`.
 *
 * These ride the PROSE, not a sigil, and they lead the phase they open. They form their own island
 * family because a reader that only walked `<<~ …>>` would see a turn's whole loop as water.
 */
export interface PhaseSignal extends OffsetSignal {
  /** The loop glyph, verbatim. */
  readonly glyph: string;
}

/** Any other closed sigil island — `oracle`, `mu`, `stance`, `kahea`, `persona`, … */
export interface SigilSignal extends OffsetSignal {
  /** The leading keyword that classified the island. */
  readonly head: string;
  /** Everything after the head, verbatim and untrimmed of its own grammar. */
  readonly body: string;
}

/** Everything one turn yielded, on the gradient. */
export interface TurnHarvest {
  /** The aim/yield bearing (reuses {@link harvest}); null when no frame appeared. */
  readonly bearing: Bearing | null;
  readonly voices: readonly VoiceSignal[];
  /** Panel firings — an open, a close and any mid-turn set all count. */
  readonly panels: readonly PanelSignal[];
  /** Every other recognized sigil island, in the order it sounded. */
  readonly sigils: readonly SigilSignal[];
  /** Mid-turn phase markers, in the order they sounded. */
  readonly phases: readonly PhaseSignal[];
  /** Count of recognized sigil islands (every classified `<<~ …>>`). */
  readonly sigilCount: number;
  /** Count of `<<~` openers that did NOT classify — the water, panic-synced. */
  readonly waterCount: number;
  /** Overall 0..20 gradient standing — the parse earns it BACKWARD (low = drifted / sparse structure). */
  readonly standing: number;
  readonly driftFlags: readonly string[];
  /** Below the floor: abstain on structure, but keep the raw source. */
  readonly recordRaw: boolean;
}

/**
 * Standing floor (0..20). At or above, a turn's structure harvests; below, the
 * turn abstains on structure (`recordRaw`) and the raw source is kept for a later
 * pass. The operator's rule: work the gradient down to here, no further.
 */
export const HARVEST_FLOOR = 4;

// --- Island regexes -------------------------------------------------------
// Each sigil opener `<<~` anchors an island; SIGIL_RE walks them in order. A
// body that fails to close (`>>`) before the next `<<~` reads as water.

const SIGIL_RE = /<<~\s*([\s\S]*?)>>/g;
const SIGIL_OPENER_RE = /<<~/g;

/** A panel's named keys: `key="value"`, the value taken whole and never re-parsed. */
const PANEL_KEY_RE = /([a-z][\w-]*)\s*=\s*"([^"]*)"/gi;

/** A mid-turn phase marker: the `->` arrow leading a loop glyph. */
const PHASE_RE = /->\s*([✶⏿◇▶↺])/gu;

// Voice headers ride the prose, not a sigil: `Name (Role):`, optionally bold,
// optionally `Mask: Name (Role):`. Names allow hyphen/apostrophe compounds.
const VOICE_RE =
  /(?:^|\n)\s*(?:\*\*\s*)?(?:(Mask|[A-Za-z][\w'-]*)\s*:\s*)?([A-Z][\w'’-]*(?:[ -][A-Z][\w'’-]*)*)\s*\(([^)\n]{1,40})\)\s*:/g;

// A bare `Name:` surfacing (degraded — no role parens). Accepted only when the
// name reads as a known house Voice, so prose `Note:` / `Thread:` stay water.
const BARE_VOICE_RE = /(?:^|\n)\s*(?:\*\*\s*)?([A-Z][\w'’-]*(?:[ -][A-Z][\w'’-]*)*)\s*:/g;
const KNOWN_VOICES = new Set([
  "lares",
  "ink-clerk",
  "lorekeeper",
  "map-wisp",
  "scryer",
  "council",
  "mischief-muse",
  "muse",
  "artificer",
  "advocate",
  "diplomat",
  "pedagogue",
  "tide-caller",
  "hierophant",
  "breach-watch",
  "triage",
  "stranger",
  "liminal",
  "gatekeeper",
]);

/**
 * Leading keywords a sigil island may carry.
 *
 * A CORPUS STATES ONE GRAMMAR; A READER TOLERATES EVERY GRAMMAR IT WILL MEET. `bags/` authors its
 * own contents and carries current pono alone. This harvester receives input it never authored — a
 * month of real turns, written under whatever the frame said that week — so a retired head stays
 * readable here. Refusing one would read those turns as turns that fired nothing, and that silence
 * is indistinguishable from a turn that skipped the instrument.
 */
const KNOWN_KINDS = new Set([
  "lares",
  "set",
  "oracle",
  "stance",
  "mu",
  "persona",
  "kahea",
  "ahu",
  "aka",
  "loulou",
  "aim",
  "yield",
  "ranks",
  "loops",
  "flows",
  "moves",
  "holds",
  // heads the frame has since retired, kept readable so an older turn still harvests
  "hud",
  "ward",
  "syad",
  "confidence",
]);

function leadingWord(body: string): string {
  const m = /^[\s~]*([A-Za-z][\w-]*)/.exec(body);
  return m ? (m[1] ?? "").toLowerCase() : "";
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Read a panel body's `key="value"` pairs. A key written twice keeps the last, as a reader would. */
function panelKeys(body: string): Record<string, string> {
  const keys: Record<string, string> = {};
  PANEL_KEY_RE.lastIndex = 0;
  for (const m of body.matchAll(PANEL_KEY_RE)) keys[(m[1] ?? "").toLowerCase()] = m[2] ?? "";
  return keys;
}

/**
 * Harvest one verbatim turn on the gradient. Always returns a record for any
 * non-empty text — an unframed, all-prose turn comes back at a low standing with
 * `recordRaw` set, never null (the silence is recorded, never fabricated into a
 * bearing). The widening signals corroborate: a clean bearing flanked by a panel
 * and named Voices reads high; a lone drifted frame, or bare water, falls.
 */
export function harvestTurnGradient(text: string): TurnHarvest {
  const empty: TurnHarvest = {
    bearing: null,
    voices: [],
    panels: [],
    sigils: [],
    phases: [],
    sigilCount: 0,
    waterCount: 0,
    standing: 0,
    driftFlags: ["empty"],
    recordRaw: true,
  };
  if (!text) return empty;

  const bearing = harvest(text);

  // --- island census: every closed `<<~ …>>` classifies once, here ---
  //
  // ONE PASS, NOT ONE PER FAMILY. The specialized passes this replaces each walked the whole text
  // for their own head, so a turn's islands were counted in two places and could disagree about
  // which of them a body belonged to.
  const panels: PanelSignal[] = [];
  const sigils: SigilSignal[] = [];
  let classifiedSigils = 0;
  let bearingSigils = 0;

  for (const m of text.matchAll(SIGIL_RE)) {
    const body = m[1] ?? "";
    const head = leadingWord(body);
    const offset = m.index ?? 0;
    const rest = body.replace(/^[\s~]*[A-Za-z][\w-]*/, "");

    if (head === "lares") {
      const sub = /^[\s~]*lares\s+([A-Za-z]+)/i.exec(body)?.[1]?.toLowerCase() ?? "";
      if (sub === "aim" || sub === "yield") bearingSigils += 1;
      else sigils.push({ raw: m[0], offset, head, body: rest });
      classifiedSigils += 1;
    } else if (head === "set") {
      const keys = panelKeys(rest);
      panels.push({ raw: m[0], offset, hud: keys["hud"] ?? null, keys });
      classifiedSigils += 1;
    } else if (KNOWN_KINDS.has(head)) {
      sigils.push({ raw: m[0], offset, head, body: rest });
      classifiedSigils += 1;
    }
    // unknown leading word → not classified here; counted as water below.
  }

  // --- mid-turn phase markers ---
  const phases: PhaseSignal[] = [];
  for (const m of text.matchAll(PHASE_RE)) {
    phases.push({ raw: m[0], offset: m.index ?? 0, glyph: m[1] ?? "" });
  }

  // --- Voices ---
  const voices: VoiceSignal[] = [];
  for (const m of text.matchAll(VOICE_RE)) {
    const prefix = m[1] ?? null; // "Mask" or a stray word
    const name = (m[2] ?? "").trim();
    const role = (m[3] ?? "").trim() || null;
    // Precision guard (tier-0 stays high-precision): a Voice header carries a
    // SHORT name and a SHORT role. A long verb-phrase in the parens — a prose
    // aside like "(end your reply with)" — reads as water, never a Voice.
    const words = (s: string): number => s.split(/\s+/).filter(Boolean).length;
    const knownish =
      KNOWN_VOICES.has(name.toLowerCase()) ||
      (role !== null && KNOWN_VOICES.has(role.toLowerCase()));
    if (!knownish && (words(name) > 3 || (role !== null && words(role) > 3))) continue;
    const isMask = prefix !== null && prefix.toLowerCase() === "mask";
    voices.push({
      raw: m[0].trim(),
      offset: m.index ?? 0,
      name,
      role,
      mask: isMask ? name : null,
    });
  }
  // Degraded surfacing: a bare `KnownVoice:` with no role parens.
  const claimedVoiceOffsets = new Set(voices.map((v) => v.offset));
  for (const m of text.matchAll(BARE_VOICE_RE)) {
    const name = (m[1] ?? "").trim();
    if (!KNOWN_VOICES.has(name.toLowerCase())) continue;
    const offset = m.index ?? 0;
    // Skip when the role-form already claimed this surfacing (overlapping span).
    if ([...claimedVoiceOffsets].some((o) => Math.abs(o - offset) <= 4)) continue;
    voices.push({ raw: m[0].trim(), offset, name, role: null, mask: null });
  }
  voices.sort((a, b) => a.offset - b.offset);

  // Water = `<<~` openers that no closed, recognized island claimed.
  const totalOpeners = (text.match(SIGIL_OPENER_RE) ?? []).length;
  const waterCount = Math.max(0, totalOpeners - classifiedSigils);
  const sigilCount = classifiedSigils;

  // --- overall standing on the gradient (the parse EARNS it backward) ---
  const driftFlags: string[] = [...(bearing?.driftFlags ?? [])];
  let standing: number;

  if (bearing) {
    // Start from the bearing's own drift standing, corroborate with the panel and the Voices.
    standing = bearing.standing;
    if (panels.length > 0) standing = clamp(standing + 1, 0, 18);
    if (voices.length > 0) standing = clamp(standing + 1, 0, 18);
    if (panels.length > 1) standing = clamp(standing + 1, 0, 20); // an open AND a close
  } else {
    driftFlags.push("frame:none");
    if (panels.length + sigils.length + bearingSigils > 0) {
      // Structure without an aim/yield frame — degraded but real.
      standing = 8;
      if (voices.length > 0) standing = clamp(standing + 1, 0, 12);
    } else if (voices.length > 0) {
      // A Voice surfaced in prose, no sigils — partial.
      standing = 6;
    } else {
      // All prose, no structure — below the floor; keep raw.
      standing = 2;
    }
  }

  // Water drags the gauge: mostly-unrecognized openers read as drift.
  if (waterCount > 0) {
    driftFlags.push(`water:${waterCount}`);
    if (sigilCount === 0) standing = Math.min(standing, HARVEST_FLOOR);
    else if (waterCount >= sigilCount) standing = clamp(standing - 2, 0, 20);
  }
  if (voices.length > 0) driftFlags.push(`voices:${voices.length}`);
  if (panels.length > 2) driftFlags.push(`panel-multi:${panels.length}`);

  return {
    bearing,
    voices,
    panels,
    sigils,
    phases,
    sigilCount,
    waterCount,
    standing,
    driftFlags,
    recordRaw: standing < HARVEST_FLOOR,
  };
}

/** The closing panel — `hud="yield"` — or null where the turn never closed one. */
export function closingPanel(h: TurnHarvest): PanelSignal | null {
  for (let i = h.panels.length - 1; i >= 0; i--) {
    const p = h.panels[i]!;
    if (p.hud === "yield") return p;
  }
  return null;
}

/**
 * Whether the turn closed a loop — the closing panel's `feedback` tally reads `closed N↺` with N ≥ 1.
 *
 * A suspension alone does not close: `closed 0↺ -> open 1φ @◇:reason` reports a turn that ran the loop
 * and hung it, which is the honest reading the tally exists to carry.
 */
export function aftermathClosed(h: TurnHarvest): boolean {
  const tally = closingPanel(h)?.keys["feedback"] ?? "";
  const m = /closed\s+(\d+)\s*[↺↻]/.exec(tally);
  return m !== null && Number(m[1]) >= 1;
}
