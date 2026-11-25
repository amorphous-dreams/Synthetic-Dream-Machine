/**
 * pack-relink-offering.ts — packs flibbles' Relink plugin (`$:/plugins/flibbles/relink`) into an
 * UNSIGNED source descriptor under `offerings/relink/`, on the shape `pack-highlight-offering.ts`
 * proved: `{ blobs: [{ id, version, sha256, provenance, file }] }`, no `sig`, no `offeror`, no
 * `pluginsCid`. The operator signs it as PUBLISHER through `lares nexus publish plugins --source`;
 * this script claims custody of nothing.
 *
 * ── PINNED TO ONE COMMIT ────────────────────────────────────────────────────────────────────────
 * The upstream (github.com/flibbles/tw5-relink, BSD-3-Clause, Copyright (c) 2019-2020 Cameron
 * Fischer) is fetched at COMMIT_PIN and checked out detached; the script refuses a HEAD that
 * differs from the pin. A tag or "latest" never names the bytes. `author` rides as a bare claim.
 *
 * ── THE ADD-ON STAYS OUT ────────────────────────────────────────────────────────────────────────
 * Only `plugins/relink` packs. The sibling `relink-titles` add-on rewrites derived titles through
 * `wiki.deleteTiddler`, which escapes the rename door's dry-run capture, so it never rides here.
 *
 * Run via: tsx packages/lararium-tw5/scripts/pack-relink-offering.ts [--out <dir>] [--verify]
 *   --out <dir>  write the pack there instead of `offerings/relink/`.
 *   --verify     pack into a scratch directory and diff it byte-for-byte against the committed
 *                artifacts; exit 1 on any difference. It fetches the public upstream, so it needs the
 *                network: run it by hand when re-pinning, never from the vitest suite.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { sha256HexBytesSync } from "@lararium/mesh/crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT     = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(ROOT, "../..");
const COMMITTED_DIR = path.join(ROOT, "offerings", "relink");
const ARGV = process.argv.slice(2);
const VERIFY = ARGV.includes("--verify");
const OUT_FLAG = ARGV.indexOf("--out");
if (OUT_FLAG >= 0 && !ARGV[OUT_FLAG + 1]) throw new Error("[relink-offering] --out takes a directory");
const OUT_DIR  = VERIFY
  ? mkdtempSync(path.join(tmpdir(), "relink-offering-verify-"))
  : OUT_FLAG >= 0 ? path.resolve(ARGV[OUT_FLAG + 1]!) : COMMITTED_DIR;

const UPSTREAM_URL = "https://github.com/flibbles/tw5-relink.git";
const COMMIT_PIN   = "51266a1e853c616c5f0b401a9c881d518dddb9bc";
const PLUGIN_PATH  = "plugins/relink";
const PLUGIN_TITLE = "$:/plugins/flibbles/relink";
const PLUGIN_VERSION = "2.6.2";
const sha256       = sha256HexBytesSync;

const TW5_BIN = createRequire(import.meta.url).resolve("tiddlywiki/tiddlywiki.js");

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });
  console.log(`[relink-offering] packing ${PLUGIN_TITLE} from tw5-relink@${COMMIT_PIN.slice(0, 12)}…`);

  const tmp = mkdtempSync(path.join(tmpdir(), "tw5-pack-relink-"));
  const clone = path.join(tmp, "upstream");
  const pluginCopy = path.join(tmp, "plugin");
  let outputJson: string;
  let licence: string;
  try {
    execFileSync("git", ["init", "-q", clone], { stdio: "pipe" });
    execFileSync("git", ["-C", clone, "fetch", "-q", "--depth=1", UPSTREAM_URL, COMMIT_PIN], { stdio: "pipe" });
    execFileSync("git", ["-C", clone, "checkout", "-q", "--detach", "FETCH_HEAD"], { stdio: "pipe" });
    const head = execFileSync("git", ["-C", clone, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    if (head !== COMMIT_PIN) throw new Error(`[relink-offering] fetched ${head} != pinned ${COMMIT_PIN}`);

    licence = readFileSync(path.join(clone, "LICENSE"), "utf8");
    cpSync(path.join(clone, PLUGIN_PATH), pluginCopy, { recursive: true });
    const packArgs = [
      `++${pluginCopy}`,
      "--render", "$:/core/templates/exporters/JsonFile", "plugin.json", "text/plain", "",
      "exportFilter", `[[${PLUGIN_TITLE}]]`,
    ];
    execFileSync(TW5_BIN, packArgs, { cwd: tmp, stdio: "inherit" });
    outputJson = readFileSync(path.join(tmp, "output", "plugin.json"), "utf8");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  const tiddlerArray = JSON.parse(outputJson) as Record<string, unknown>[];
  if (!tiddlerArray.length) throw new Error("[relink-offering] TW5 exported 0 tiddlers — check plugin title");
  const pluginTiddler = tiddlerArray[0]!;
  if (pluginTiddler["title"] !== PLUGIN_TITLE) {
    throw new Error(`[relink-offering] packed title ${String(pluginTiddler["title"])} != ${PLUGIN_TITLE}`);
  }
  if (pluginTiddler["version"] !== PLUGIN_VERSION) {
    throw new Error(`[relink-offering] packed version ${String(pluginTiddler["version"])} != ${PLUGIN_VERSION}`);
  }

  const pluginJson = JSON.stringify(pluginTiddler, null, 2) + "\n";
  writeFileSync(path.join(OUT_DIR, "relink-plugin.json"), pluginJson, "utf8");
  writeFileSync(
    path.join(OUT_DIR, "NOTICES.txt"),
    "Bundled licence notice, carried unmodified from the upstream repository (LICENSE) at the pinned commit:\n\n" + licence,
    "utf8",
  );

  const blobSha256 = sha256(Buffer.from(pluginJson, "utf8"));
  const blob = {
    id: PLUGIN_TITLE,
    version: PLUGIN_VERSION,
    sha256: blobSha256,
    provenance: {
      source:  "https://github.com/flibbles/tw5-relink",
      commit:  COMMIT_PIN,
      path:    PLUGIN_PATH,
      licence: "BSD-3-Clause",
      author:  "Cameron Fischer (Flibbles)",
    },
    file: "relink-plugin.json",
  };
  writeFileSync(path.join(OUT_DIR, "offering.json"), JSON.stringify({ blobs: [blob] }, null, 2) + "\n", "utf8");

  console.log(`[relink-offering] ✓ blob ${PLUGIN_TITLE}  sha256=${blobSha256.slice(0, 16)}…`);
  if (VERIFY) {
    try {
      const drift = ["relink-plugin.json", "offering.json", "NOTICES.txt"].filter(
        (f) => readFileSync(path.join(OUT_DIR, f), "utf8") !== readFileSync(path.join(COMMITTED_DIR, f), "utf8"),
      );
      if (drift.length) throw new Error(`[relink-offering] re-pack differs from the committed bytes: ${drift.join(", ")}`);
      console.log("[relink-offering] ✓ verify: the re-pack matches the committed artifacts byte-for-byte");
    } finally {
      rmSync(OUT_DIR, { recursive: true, force: true });
    }
    return;
  }
  console.log(`[relink-offering] ✓ wrote ${path.relative(REPO_ROOT, OUT_DIR)}/{relink-plugin.json,offering.json,NOTICES.txt} (UNSIGNED — \`nexus publish --source\` signs it)`);
}

main().catch((err: unknown) => {
  console.error("[relink-offering] FATAL:", err);
  process.exit(1);
});
