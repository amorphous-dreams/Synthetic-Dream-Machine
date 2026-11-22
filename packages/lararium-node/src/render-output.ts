/** Custody of native wiki render bytes. The workbench's rendered/ top never enters an ingest wave. */
import { createHash, randomUUID } from "node:crypto";
import { existsSync, linkSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

export interface RenderFile { readonly name: string; readonly text: string; readonly source: string }
export interface RenderManifest {
  readonly has: string;
  readonly directory: "rendered";
  readonly outcome: "written" | "partial";
  readonly files: readonly { readonly name: string; readonly bytes: number; readonly digest: string }[];
  readonly skipped: readonly string[];
  readonly receipt: string;
  readonly refusal?: string;
}
const digest = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");
const within = (child: string, parent: string): boolean => child === parent || child.startsWith(`${parent}${sep}`);
const fault = (name: string, detail: string): Error => new Error(`${name}: ${detail}`);

/** Check every path and budget before the first output byte, then publish each file by atomic rename. */
export function publishWikiRender(opts: {
  readonly workbench: string;
  readonly hearth: string;
  readonly files: readonly RenderFile[];
  readonly skipped: readonly string[];
  readonly overwrite?: boolean;
  /** Test seam that interrupts one publication after all preflight checks. */
  readonly beforeWrite?: (name: string) => void;
}): RenderManifest {
  let workbench: string, hearth: string;
  try { workbench = realpathSync(opts.workbench); hearth = realpathSync(opts.hearth); }
  catch { throw fault("render-workbench-unbound", "the selected wiki holds no bound disk workbench"); }
  if (within(workbench, hearth)) throw fault("render-workbench-in-hearth", "the workbench resolves inside the hearth");
  if (opts.files.length > 128) throw fault("render-count-budget", "the selection exceeds 128 files");
  const root = join(workbench, "rendered");
  if (existsSync(root) && (!lstatSync(root).isDirectory() || lstatSync(root).isSymbolicLink())) throw fault("render-path-symlink", "rendered/ must hold a real directory");
  const rows: Array<{ name: string; bytes: number; digest: string; path: string; text: string; exists: boolean }> = [];
  const names = new Set<string>();
  let total = 0;
  for (const file of opts.files) {
    const name = file.name;
    if (!name || isAbsolute(name) || /^[A-Za-z]:/.test(name) || name.includes("\\") || name.includes("\0") || name.split("/").some((part) => !part || part === "." || part === ".."))
      throw fault("render-path-refused", JSON.stringify(name));
    if (names.has(name.toLowerCase())) throw fault("render-name-duplicate", JSON.stringify(name));
    names.add(name.toLowerCase());
    const path = resolve(root, name);
    if (!within(path, root) || within(path, hearth)) throw fault("render-path-refused", JSON.stringify(name));
    const parts = relative(workbench, path).split(sep);
    let walk = workbench;
    for (const part of parts) {
      walk = join(walk, part);
      if (!existsSync(walk)) continue;
      const stat = lstatSync(walk);
      if (stat.isSymbolicLink()) throw fault("render-path-symlink", JSON.stringify(name));
      if (walk !== path && !stat.isDirectory()) throw fault("render-path-refused", JSON.stringify(name));
      if (walk === path && !stat.isFile()) throw fault("render-path-refused", JSON.stringify(name));
    }
    const bytes = Buffer.byteLength(file.text, "utf8");
    total += bytes;
    if (total > 4_194_304) throw fault("render-byte-budget", "the selection exceeds four MiB");
    const hash = `sha256-${digest(file.text)}`;
    const exists = existsSync(path);
    rows.push({ name, bytes, digest: hash, path, text: file.text, exists });
  }
  const receipt = digest(JSON.stringify({ rows: rows.map(({ name, digest }) => [name, digest]), skipped: opts.skipped }));
  const manifestPath = join(root, `.manifest-${receipt}.json`);
  if (existsSync(manifestPath)) {
    if (!lstatSync(manifestPath).isFile() || lstatSync(manifestPath).isSymbolicLink()) throw fault("render-path-symlink", "the retry manifest moved");
    const prior = JSON.parse(readFileSync(manifestPath, "utf8")) as RenderManifest;
    if (prior.receipt !== receipt || prior.outcome !== "written" || !Array.isArray(prior.files)
      || JSON.stringify(prior.files) !== JSON.stringify(rows.map(({ name, bytes, digest }) => ({ name, bytes, digest }))))
      throw fault("render-retry-manifest-invalid", "the standing manifest does not match the prepared bytes");
    return prior;
  }
  for (const row of rows) {
    if (row.exists && !opts.overwrite && digest(readFileSync(row.path, "utf8")) !== row.digest.slice(7))
      throw fault("render-overwrite-refused", JSON.stringify(row.name));
  }
  const emitted: Array<{ name: string; bytes: number; digest: string }> = [];
  const answer = (outcome: "written" | "partial", refusal?: string): RenderManifest => ({
    has: `<<~ has name=\`wiki-render-out\` params=\`directory/rendered outcome/${outcome} files/${emitted.length} skipped/${opts.skipped.length} receipt/${receipt}\`>>`,
    directory: "rendered", outcome, files: emitted, skipped: [...opts.skipped], receipt, ...(refusal ? { refusal } : {}),
  });
  try {
    mkdirSync(root, { recursive: true });
    if (lstatSync(root).isSymbolicLink() || !within(realpathSync(root), workbench)) throw fault("render-path-symlink", "rendered/ moved outside its workbench");
    for (const row of rows) {
      if (row.exists && !opts.overwrite) {
        if (digest(readFileSync(row.path, "utf8")) !== row.digest.slice(7)) throw fault("render-overwrite-refused", JSON.stringify(row.name));
        emitted.push({ name: row.name, bytes: row.bytes, digest: row.digest }); continue;
      }
      opts.beforeWrite?.(row.name);
      mkdirSync(resolve(row.path, ".."), { recursive: true });
      if (lstatSync(root).isSymbolicLink() || !within(realpathSync(root), workbench)) throw fault("render-path-symlink", row.name);
      // Recheck every parent after mkdir: a replaced directory may never redirect a file outside the grant.
      let parent = root;
      for (const segment of relative(root, resolve(row.path, "..")).split(sep).filter(Boolean)) {
        parent = join(parent, segment);
        if (lstatSync(parent).isSymbolicLink() || !within(realpathSync(parent), workbench)) throw fault("render-path-symlink", row.name);
      }
      const temp = `${row.path}.${process.pid}.${randomUUID()}.tmp`;
      try {
        writeFileSync(temp, row.text, { encoding: "utf8", flag: "wx" });
        // A no-overwrite grant must also hold if another writer creates the name after preflight.
        if (opts.overwrite) renameSync(temp, row.path);
        else linkSync(temp, row.path);
      }
      finally { rmSync(temp, { force: true }); }
      emitted.push({ name: row.name, bytes: row.bytes, digest: row.digest });
    }
    const complete = answer("written");
    writeFileSync(manifestPath, JSON.stringify(complete), { encoding: "utf8", flag: "wx" });
    return complete;
  } catch (error) { return answer("partial", error instanceof Error ? error.message : String(error)); }
}
