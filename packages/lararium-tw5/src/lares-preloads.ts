/**
 * lares-preloads — runtime tiddler loading from lares/ source files.
 *
 * Replaces the build-time generated-ui-preloads.ts and generated-vendor-plugins.ts.
 * Browser: Vite bundles the raw file content via import.meta.glob at build time.
 * Node:    fs.readFileSync reads the files at runtime from the monorepo root.
 */

// ---------------------------------------------------------------------------
// Shared parsing helpers (mirrors scripts/write-ui-preloads.ts)
// ---------------------------------------------------------------------------

const STX_RE     = /<<~[^>]*&#x0002;[^>]*>>/;
const ETX_RE     = /<<~[^>]*&#x0003;[^>]*>>/;
const TOML_RE    = /```toml(?:[ \t]+[A-Za-z0-9_-]+)?[ \t]*\n([\s\S]*?)```/;
const SOH_URI_RE = /<<~[^>]*&#x0001;[^>]*\?\s*->\s*([^\s>]+)\s*>>/;

function parseToml(block: string): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const line of block.split("\n")) {
    const m = line.match(/^([\w-]+)\s*=\s*(.+)$/);
    if (!m) continue;
    const [, key, rawVal] = m;
    const val = rawVal!.trim();
    if (val.startsWith("[")) {
      out[key!] = [...val.matchAll(/"([^"]*)"/g)].map((x) => x[1]!);
    } else {
      out[key!] = val.replace(/^"|"$/g, "");
    }
  }
  return out;
}

type TiddlerFields = Record<string, string | string[]>;

function parseMdToTiddler(content: string): TiddlerFields | null {
  const uriMatch = SOH_URI_RE.exec(content);
  if (!uriMatch) return null;
  const rawUri = uriMatch[1]!;
  const title  = rawUri.startsWith("lar:///") ? rawUri : `lar:///${rawUri}`;

  const tomlMatch = TOML_RE.exec(content);
  if (!tomlMatch) return null;
  const fields = parseToml(tomlMatch[1]!);

  const bodyType = (fields["type"] ?? fields["content-type"]) as string | undefined;
  if (bodyType !== "text/vnd.tiddlywiki") return null;

  const stxMatch = STX_RE.exec(content);
  const etxMatch = ETX_RE.exec(content);
  if (!stxMatch || !etxMatch) return null;

  const stxEnd   = stxMatch.index + stxMatch[0].length;
  const etxStart = etxMatch.index;
  let body = content.slice(stxEnd, etxStart).trim();
  const ahuOpen = body.indexOf("<<~ ahu ");
  if (ahuOpen > 0) body = body.slice(0, ahuOpen).trim();

  return {
    title,
    text: body,
    type: "text/vnd.tiddlywiki",
    tags: fields["tags"] ?? [],
    ...(fields["list-after"]  ? { "list-after":  fields["list-after"]  as string } : {}),
    ...(fields["list-before"] ? { "list-before": fields["list-before"] as string } : {}),
  };
}

// ---------------------------------------------------------------------------
// loadUiTiddlers — returns tiddler fields for all TW5 UI source memes.
// On Node this re-reads the files from disk; on browser Vite has pre-bundled them.
// ---------------------------------------------------------------------------

export async function loadUiTiddlers(): Promise<TiddlerFields[]> {
  const isBrowser = typeof window !== "undefined";

  if (isBrowser) {
    // import.meta.glob is resolved by Vite at build time; never reached in Jest/Node.
    // Path: packages/lararium-tw5/src/ → ../../../ → monorepo root → lares/...
    const mods = import.meta.glob(
      ["../../../lares/ha-ka-ba/api/v0.1/lararium/ui/*.md",
       "../../../lares/ha-ka-ba/api/v0.1/lararium/templates/*.md"],
      { query: "?raw", import: "default", eager: true },
    ) as Record<string, string>;
    const result: TiddlerFields[] = [];
    for (const raw of Object.values(mods)) {
      const t = parseMdToTiddler(raw);
      if (t) result.push(t);
    }
    return result;
  }

  // Node path — read files from disk at runtime
  /* eslint-disable @typescript-eslint/ban-ts-comment */
  // @ts-ignore — dynamic Node-only imports; never reached in browser
  const { readFileSync, readdirSync } = await /* @vite-ignore */ import("fs");
  // @ts-ignore
  const { join: pathJoin }            = await /* @vite-ignore */ import("path");
  // @ts-ignore
  const { laresRoot: lr }             = await /* @vite-ignore */ import("@lararium/lares");
  /* eslint-enable */

  const laraRoot = pathJoin(lr, "ha-ka-ba/api/v0.1/lararium");
  const dirs     = ["ui", "templates"].map((d: string) => pathJoin(laraRoot, d));

  const result: TiddlerFields[] = [];
  for (const dir of dirs) {
    let files: string[];
    try { files = readdirSync(dir).filter((f: string) => f.endsWith(".md")); }
    catch { continue; }
    for (const file of files) {
      const content = readFileSync(pathJoin(dir, file), "utf8");
      const t = parseMdToTiddler(content);
      if (t) result.push(t);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// loadVendorTiddlers — returns tiddler fields for all vendored TW5 plugins.
// ---------------------------------------------------------------------------

export async function loadVendorTiddlers(): Promise<Array<Record<string, string>>> {
  const isBrowser = typeof window !== "undefined";

  if (isBrowser) {
    const mods = import.meta.glob(
      ["../../../lares/ha-ka-ba/api/v0.1/tw5-plugins/*.json"],
      { eager: true },
    ) as Record<string, unknown>;
    const result: Array<Record<string, string>> = [];
    for (const mod of Object.values(mods)) {
      normalisePluginEntries(mod as Record<string, unknown>, result);
    }
    return result;
  }

  // @ts-ignore
  const { readFileSync, readdirSync } = await /* @vite-ignore */ import("fs");
  // @ts-ignore
  const { join: pathJoin }            = await /* @vite-ignore */ import("path");
  // @ts-ignore
  const { laresRoot: lr }             = await /* @vite-ignore */ import("@lararium/lares");

  const vendorDir = pathJoin(lr, "ha-ka-ba/api/v0.1/tw5-plugins");

  const result: Array<Record<string, string>> = [];
  let files: string[];
  try { files = readdirSync(vendorDir).filter((f: string) => f.endsWith(".json")); }
  catch { return result; }
  for (const file of files) {
    const raw    = readFileSync(pathJoin(vendorDir, file), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    normalisePluginEntries(parsed, result);
  }
  return result;
}

// JSON files may be a single tiddler object or an array of tiddler objects.
// Normalise both into a flat list; re-stringify any object-valued `text` field.
function normalisePluginEntries(parsed: unknown, out: Array<Record<string, string>>): void {
  const entries: Array<Record<string, unknown>> = Array.isArray(parsed)
    ? (parsed as Array<Record<string, unknown>>)
    : [parsed as Record<string, unknown>];
  for (const entry of entries) {
    if (!entry["title"]) continue;
    if (typeof entry["text"] === "object") {
      entry["text"] = JSON.stringify(entry["text"]);
    }
    out.push(entry as Record<string, string>);
  }
}
