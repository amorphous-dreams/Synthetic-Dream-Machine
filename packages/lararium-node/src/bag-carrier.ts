/**
 * bag-carrier — the node-fs shore's own frame writer for the two self-describing carriers it mints:
 * a bag's `meta.mem` declaration and a library collection's INDEX.
 *
 * WHY HERE AND NOT IN MESH. `@lararium/mesh` holds the pure data these two render (`BagManifest`,
 * `LibraryEntryMeta`) and nothing about the memetic-wikitext FRAME — mesh has no tw5 dependency and
 * never should. Both renderers have exactly one caller each, and both callers (`bag-declare.ts`,
 * `library-store.ts`) already live in `@lararium/node`, which already depends on `@lararium/tw5`. So
 * the renderer sits beside the writer that calls it, and mints its block check with tw5's OWN
 * `bccOf` rather than a second hash rule living beside the first.
 *
 * ── THE SHAPE ─────────────────────────────────────────────────────────────────────────────────────
 * `DOCTYPE → SOH(from="?" -> to=uri) → STX → toml-meta fence → prose/table → ETX+check → EOT(-> to="?")`
 * — the exact frame every hand-authored bag's `meta.mem` carries. `bccOf` reads the STX..ETX span off
 * the text as assembled (before the check is glued on, so the check never covers itself) and the check
 * rides glued directly onto ETX's closing bracket, with no byte between.
 *
 * Frame-Wright's shared frame writer (`@lararium/memetic-frame`) supersedes this once it lands; until
 * then this is the one place either carrier's frame gets assembled.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/memetic-wikitext
 */

import { bccOf } from "@lararium/memetic-frame";
import { CARRIER_TYPE, DECLARATION } from "@lararium/mesh/carrier-type";
import { bagManifestUri, libraryRef, type BagManifest, type LibraryEntryMeta } from "@lararium/mesh";

/** Key-aligned to the longest key (`repository`) — the column every hand-authored `meta.mem` lines up on. */
const kv = (key: string, value: string): string => `${key.padEnd(10)} = "${value}"`;

/**
 * Assemble a carrier's full frame around an inner body (the toml-meta fence plus the prose/table that
 * follows it — no leading or trailing blank line of its own) and mint its block check with tw5's own
 * `bccOf`, never a second hash rule.
 */
function wrapCarrier(uri: string, inner: string): string {
  const frameNoCheck = [
    DECLARATION,
    "",
    `<<^ code="&#x0001;" from="?" -> to="${uri}">>`,
    '<<^ code="&#x0002;">>',
    "",
    inner,
    "",
    '<<^ code="&#x0003;">>',
  ].join("\n");
  const check = bccOf(frameNoCheck);
  if (!check) {
    // A renderer bug, never an operator's: the frame this function just assembled carries no STX/ETX
    // of its own making, which only happens if this module's own template above has drifted.
    throw new Error("bag-carrier: assembled frame carries no checkable span — a renderer bug.");
  }
  return `${frameNoCheck}${check}\n\n<<^ code="&#x0004;" -> to="?">>\n`;
}

/** Render a bag's declaration back to the `meta.mem` carrier its own root holds. Stable key order — a diff reads. */
export function renderBagManifest(m: BagManifest): string {
  const uri = bagManifestUri(m.bag);
  const inner = [
    "```toml meta",
    kv("bag", m.bag),
    kv("cap-tier", m.tier),
    kv("home", m.home),
    ...(m.repository ? [kv("repository", m.repository)] : []),
    ...(m.role ? [kv("role", m.role.replace(/"/g, "'"))] : []),
    kv("title", uri),
    kv("type", CARRIER_TYPE),
    "```",
    "",
    `! @${m.bag}`,
    "",
    "This bag declares its own caps and its own home. ''cap-tier'' names WHO may read it — and only ever",
    "TIGHTENS against the structural floor, so a declaration cannot open what the crypto keeps shut.",
    "''home'' names WHERE its bytes rest: `repository` (a clone carries it) · `hearth` (per-operator, no",
    "clone carries it) · `ley` (nowhere durable — it lives while the mesh carries it).",
    "",
    "A repository home names a REGISTERED id, never a path: the bag names WHAT, each vessel resolves WHERE.",
  ].join("\n");
  return wrapCarrier(uri, inner);
}

/**
 * Render a library collection's INDEX — the tracked, human-readable carrier that says what a collection
 * holds and how to verify it, with no path riding in it anywhere.
 */
export function renderLibraryIndex(collection: string, entries: readonly LibraryEntryMeta[]): string {
  const rows = [...entries].sort((a, b) => a.name.localeCompare(b.name));
  const total = rows.reduce((n, e) => n + e.size, 0);
  const uri = `lar:///ha.ka.ba/library/${collection}`;
  const inner = [
    "```toml meta",
    kv("collection", collection),
    kv("entries", String(rows.length)),
    kv("bytes", String(total)),
    kv("type", CARRIER_TYPE),
    "```",
    "",
    `! Library — ${collection}`,
    "",
    "The ACQUIRED bodies this collection holds. ''The bytes rest outside every tracked tree'' —",
    "in the vessel's own library tier — so a shelf may grow without a repository growing with it.",
    "''This index travels instead'': a reader learns what the shelf holds, and how to verify it,",
    "without holding it.",
    "",
    "Each row carries the RFC-6920 anchor a stranger checks with no tooling of ours.",
    "",
    "| Name | Bytes | Anchor | Origin |",
    "|---|---|---|---|",
    ...rows.map((e) => `| ${e.name} | ${e.size} | \`${e.integrity}\` | ${e.origin ?? "//(unrecorded)//"} |`),
    "",
    `Reference this collection as \`${libraryRef(collection)}\` — a name that travels, never a path.`,
  ].join("\n");
  return wrapCarrier(uri, inner);
}
