/**
 * pack-highlight-offering.ts — packs TiddlyWiki5's own `tiddlywiki/highlight` plugin into an UNSIGNED
 * source descriptor under `offerings/highlight/`: the PoC offering (golden-path-p2-recipe.md OPERATOR
 * RULING 2026-10-10, "R2c"), chosen in place of the deferred Streams plugin because it ships inside the
 * TW5 submodule this tree already vendors, under the SAME licence as the TW5 core blob genesis already
 * carries.
 *
 * ── WHAT THIS IS, AND WHAT IT IS NOT ────────────────────────────────────────────────────────────
 * This offering never touches `genesis/`. Highlight does not boot by default in any island; a wiki
 * that wants it names its blob id in its recipe (R1's selector), and the CAS holds the bytes either
 * way. Packing it here is the one-time PUBLISHER act; nothing downstream re-packs it.
 *
 * ── UNSIGNED ON PURPOSE (M5) ────────────────────────────────────────────────────────────────────
 * This script used to mint its OWN signature, from a seed derived by hashing a public string
 * (`sha256("lares-offerings/poc-nexus/highlight/v1")`) — a key anyone can derive, so its "signature"
 * attested nothing: any party could mint a conflicting offering under the same offeror and a mesh
 * peer would read a VALID signature from a key that proves no custody at all. So this script now
 * ships a bare SOURCE DESCRIPTOR — `{ blobs: [{ id, version, sha256, provenance, file }] }`, no
 * `sig`, no `offeror`, no `pluginsCid` — and signing moves to where custody actually lives: the
 * operator's own `lares nexus publish plugins --source offerings/highlight` signs it as PUBLISHER,
 * with their own persona's root key, at the moment they choose to offer it.
 *
 * ── PUBLISHER PROVENANCE, NEVER AUTHORSHIP ──────────────────────────────────────────────────────
 * The eventual signer attests that THEY offer exactly these bytes, fetched from the TW5 submodule at
 * the pinned, immutable commit this repo already carries as a submodule pointer — never "latest",
 * never a tag. `author` rides as a bare CLAIM inside that signed preimage ("Jeremy Ruston and
 * contributors wrote this"), never that author's own signature standing in for it
 * (`plugin-offering.ts`'s own law).
 *
 * Run via: tsx packages/lararium-tw5/scripts/pack-highlight-offering.ts
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { sha256HexBytesSync } from "@lararium/mesh";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT        = path.resolve(__dirname, "..");
const REPO_ROOT    = path.resolve(ROOT, "../..");
const TW5_ROOT     = path.join(REPO_ROOT, "TiddlyWiki5");
const PLUGIN_SRC   = path.join(TW5_ROOT, "plugins", "tiddlywiki", "highlight");
// A reproducibility test runs this same script against a SCRATCH output dir (never the committed
// one), so it can diff a fresh pack against what stands without clobbering it mid-run.
const OUT_DIR      = process.env["HIGHLIGHT_OFFERING_OUT_DIR"] ?? path.join(ROOT, "offerings", "highlight");

const PLUGIN_TITLE = "$:/plugins/tiddlywiki/highlight";
const sha256       = sha256HexBytesSync;

const TW5_BIN = createRequire(import.meta.url).resolve("tiddlywiki/tiddlywiki.js");

/** The TW5 submodule's pinned, immutable commit this repo carries — read from the submodule's own
 *  HEAD, never a tag or "latest" (the PUBLISHER provenance's `commit` field). */
function pinnedSubmoduleCommit(): string {
  return execFileSync("git", ["-C", TW5_ROOT, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
}


async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });
  const commit = pinnedSubmoduleCommit();
  console.log(`[highlight-offering] packing ${PLUGIN_TITLE} from TiddlyWiki5@${commit.slice(0, 12)}…`);

  const tw5Tmp = mkdtempSync(path.join(tmpdir(), "tw5-pack-highlight-"));
  const pluginCopy = path.join(tw5Tmp, "plugin");
  let outputJson: string;
  try {
    cpSync(PLUGIN_SRC, pluginCopy, { recursive: true });
    const packArgs = [
      `++${pluginCopy}`,
      "--render", "$:/core/templates/exporters/JsonFile", "plugin.json", "text/plain", "",
      "exportFilter", `[[${PLUGIN_TITLE}]]`,
    ];
    execFileSync(TW5_BIN, packArgs, { cwd: tw5Tmp, stdio: "inherit" });
    outputJson = readFileSync(path.join(tw5Tmp, "output", "plugin.json"), "utf8");
  } finally {
    rmSync(tw5Tmp, { recursive: true, force: true });
  }

  const tiddlerArray = JSON.parse(outputJson) as Record<string, unknown>[];
  if (!tiddlerArray.length) throw new Error("[highlight-offering] TW5 exported 0 tiddlers — check plugin title");
  const pluginTiddler = tiddlerArray[0]!;
  if (pluginTiddler["title"] !== PLUGIN_TITLE) {
    throw new Error(`[highlight-offering] packed title ${String(pluginTiddler["title"])} != ${PLUGIN_TITLE}`);
  }
  // `plugin.info` for this plugin carries no `version` field — this offering's own version names the
  // pinned commit it was packed from, so a reader can tell two packings of different commits apart.
  Object.assign(pluginTiddler, { version: `develop@${commit.slice(0, 9)}` });

  const pluginJson = JSON.stringify(pluginTiddler, null, 2) + "\n";
  writeFileSync(path.join(OUT_DIR, "highlight-plugin.json"), pluginJson, "utf8");

  const licenceNotice = readFileSync(path.join(PLUGIN_SRC, "license.tid"), "utf8");
  writeFileSync(
    path.join(OUT_DIR, "NOTICES.txt"),
    "Bundled licence notice, carried unmodified from the packed plugin (plugins/tiddlywiki/highlight/license.tid):\n\n" +
      licenceNotice,
    "utf8",
  );

  const blobBytes = Buffer.from(pluginJson, "utf8");
  const blobSha256 = sha256(blobBytes);
  const blob = {
    id: PLUGIN_TITLE,
    version: pluginTiddler["version"] as string,
    sha256: blobSha256,
    provenance: {
      source:  "https://github.com/TiddlyWiki/TiddlyWiki5",
      commit,
      path:    "plugins/tiddlywiki/highlight",
      licence: "BSD-3-Clause",
      author:  "Jeremy Ruston and contributors",
    },
    // Where THIS source dir keeps the blob's bytes, relative to itself — `nexus publish --source`
    // reads this to hash-check and stage them; it rides unsigned here because it names a LOCAL file
    // layout, never a cryptographic claim (M5: the eventual signature covers id/version/sha256/
    // provenance only, exactly as `pluginOfferingBytes` canonicalizes them).
    file: "highlight-plugin.json",
  };

  // UNSIGNED SOURCE DESCRIPTOR (M5) — no `sig`, no `offeror`, no `pluginsCid`. The operator's own
  // `nexus publish plugins --source offerings/highlight` derives `pluginsCid` and signs this as
  // PUBLISHER with their own persona's root key; nothing here claims custody of anything.
  const descriptor = { blobs: [blob] };
  writeFileSync(path.join(OUT_DIR, "offering.json"), JSON.stringify(descriptor, null, 2) + "\n", "utf8");

  console.log(`[highlight-offering] ✓ blob ${PLUGIN_TITLE}  sha256=${blobSha256.slice(0, 16)}…`);
  console.log(`[highlight-offering] ✓ wrote ${path.relative(REPO_ROOT, OUT_DIR)}/{highlight-plugin.json,offering.json,NOTICES.txt} (UNSIGNED — \`nexus publish --source\` signs it)`);
}

main().catch((err: unknown) => {
  console.error("[highlight-offering] FATAL:", err);
  process.exit(1);
});
