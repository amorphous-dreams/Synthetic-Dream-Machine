/**
 * pack-highlight-offering.ts — packs TiddlyWiki5's own `tiddlywiki/highlight` plugin into a signed
 * `PluginOffering` under `offerings/highlight/`: the PoC signed offering (golden-path-p2-recipe.md
 * OPERATOR RULING 2026-10-10, "R2c"), chosen in place of the deferred Streams plugin because it ships
 * inside the TW5 submodule this tree already vendors, under the SAME licence as the TW5 core blob
 * genesis already carries.
 *
 * ── WHAT THIS IS, AND WHAT IT IS NOT ────────────────────────────────────────────────────────────
 * This offering never touches `genesis/`. Highlight does not boot by default in any island; a wiki
 * that wants it names its blob id in its recipe (R1's selector), and the CAS holds the bytes either
 * way. Packing it here is the one-time PUBLISHER act; nothing downstream re-packs it.
 *
 * ── PUBLISHER PROVENANCE, NEVER AUTHORSHIP ──────────────────────────────────────────────────────
 * This Nexus signs that it offers exactly these bytes, fetched from the TW5 submodule at the pinned,
 * immutable commit this repo already carries as a submodule pointer — never "latest", never a tag.
 * `author` rides as a bare CLAIM inside the signed preimage ("Jeremy Ruston and contributors wrote
 * this"), never that author's own signature standing in for it (`plugin-offering.ts`'s own law).
 *
 * Run via: tsx packages/lararium-tw5/scripts/pack-highlight-offering.ts
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import {
  sha256HexBytesSync,
  ed25519SignerFromSeed,
  ed25519VerifyingKeyFromSeed,
  signPluginOffering,
  verifyPluginOffering,
  pluginOfferingCid,
  computePluginsCid,
} from "@lararium/mesh";

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

/** A DETERMINISTIC PoC Nexus signing seed: this script's whole point is a reproducible PoC offering
 *  anyone can re-mint byte-for-byte from the pinned commit, never a secret one operator alone holds.
 *  A real operator's publish (`nexus publish`) signs with the active persona's own root key instead. */
function pocNexusSigningSeed(): Uint8Array {
  return Buffer.from(sha256HexBytesSync(Buffer.from("lares-offerings/poc-nexus/highlight/v1", "utf8")), "hex");
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
  };
  const pluginsCid = computePluginsCid([blob]);

  const seed = pocNexusSigningSeed();
  const offeror = await ed25519VerifyingKeyFromSeed(seed);
  const offering = await signPluginOffering(
    { offeror, pluginsCid, blobs: [blob] },
    ed25519SignerFromSeed(seed),
  );

  const verdict = await verifyPluginOffering(offering);
  if (!verdict.ok) throw new Error(`[highlight-offering] minted offering does not self-verify: ${verdict.reason}`);

  writeFileSync(path.join(OUT_DIR, "offering.json"), JSON.stringify(offering, null, 2) + "\n", "utf8");

  console.log(`[highlight-offering] ✓ offeror=${offeror.slice(0, 16)}…  pluginsCid=${pluginsCid}`);
  console.log(`[highlight-offering] ✓ offeringCid=${pluginOfferingCid(offering)}`);
  console.log(`[highlight-offering] ✓ wrote ${path.relative(REPO_ROOT, OUT_DIR)}/{highlight-plugin.json,offering.json,NOTICES.txt}`);
}

main().catch((err: unknown) => {
  console.error("[highlight-offering] FATAL:", err);
  process.exit(1);
});
