/** Refuse workspace dist imports whose bytes or package link do not belong to this checkout. */
import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { globalStampFresh, packageFreshness } from "./corpus-read.mjs";
import { workspacePackageDirs } from "./stamp-build.mjs";

function sourceAlias(name, aliases) {
  return aliases.some(({ find, replacement }) => {
    const matches = typeof find === "string" ? find === name : find instanceof RegExp && find.test(name);
    return matches && typeof replacement === "string" && /[\\/]src[\\/]/.test(replacement);
  });
}

function packageManifest(repo, dir) {
  return JSON.parse(readFileSync(join(repo, "packages", dir, "package.json"), "utf8"));
}

function inside(repo, path) {
  const rel = relative(repo, path);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

/** Find a quoted path through dist in an owner's tests, ignoring source comments. */
export function ownDistTestLiteral(repo, dir) {
  const tests = join(repo, "packages", dir, "tests");
  if (!existsSync(tests)) return null;
  const pending = [tests];
  while (pending.length) {
    const directory = pending.pop();
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = join(directory, entry.name);
      if (entry.isDirectory()) { pending.push(file); continue; }
      if (!entry.isFile() || !/\.(?:ts|mts|js|mjs)$/.test(entry.name)) continue;
      const source = readFileSync(file, "utf8");
      for (let i = 0; i < source.length;) {
        if (source.startsWith("//", i)) {
          i = source.indexOf("\n", i + 2);
          if (i < 0) break;
          continue;
        }
        if (source.startsWith("/*", i)) {
          const end = source.indexOf("*/", i + 2);
          if (end < 0) break;
          i = end + 2;
          continue;
        }
        const quote = source[i];
        if (quote !== '"' && quote !== "'" && quote !== "`") { i++; continue; }
        const start = i++;
        while (i < source.length && source[i] !== quote) {
          if (source[i] === "\\") i++;
          i++;
        }
        if (i >= source.length) break;
        const literal = source.slice(start, ++i);
        if (/(?:^|[/\\])dist[/\\]/.test(literal.slice(1, -1))) return { file, literal };
      }
    }
  }
  return null;
}

/** Check built output read by the owner, then each workspace dependency reached from it. */
export function checkDistDependencies(repo, dir, aliases = [], requireOwnerDist = false) {
  const root = resolve(repo);
  const names = new Map(workspacePackageDirs(root).map((d) => [packageManifest(root, d).name, d]));
  const seen = new Set();
  const checked = new Set();
  const errors = [];
  const globalFresh = globalStampFresh(root);
  const owner = packageManifest(root, dir);
  const ownerDist = join(root, "packages", dir, "dist");
  // The tests/ harness explicitly runs the CLI's built bin; package suites declare reads in tests/.
  const needsOwnerDist = requireOwnerDist || ownDistTestLiteral(root, dir) !== null;
  if (needsOwnerDist && !existsSync(ownerDist)) {
    errors.push(`[vitest-dist-guard] ${owner.name} stale build: dist is missing\n  cure: pnpm --filter ${owner.name} build && node tools/stamp-build.mjs . --pkg ${dir}`);
  } else if (needsOwnerDist) {
    const actual = realpathSync(ownerDist);
    if (!inside(root, actual)) {
      errors.push(`[vitest-dist-guard] foreign build: ${owner.name} dist resolves to ${actual}; this checkout expects ${ownerDist}\n  cure: relink node_modules into ${root} or provision one with node tools/provision-worktree.mjs <empty-dir>`);
    } else if (!globalFresh && packageFreshness(root, dir).stale) {
      errors.push(`[vitest-dist-guard] ${owner.name} stale build: dist was not built from the current source\n  cure: pnpm --filter ${owner.name} build && node tools/stamp-build.mjs . --pkg ${dir}`);
    }
  }
  function visit(owner) {
    if (seen.has(owner)) return;
    seen.add(owner);
    const manifest = packageManifest(root, owner);
    for (const [name, version] of Object.entries({ ...manifest.dependencies, ...manifest.devDependencies })) {
      if (typeof version !== "string" || !version.startsWith("workspace:")) continue;
      const dep = names.get(name);
      if (!dep) continue;
      if (!checked.has(dep) && !sourceAlias(name, aliases)) {
        checked.add(dep);
        const localLink = join(root, "packages", owner, "node_modules", name);
        const rootLink = join(root, "node_modules", name);
        const link = existsSync(localLink) ? localLink : rootLink;
        let actual;
        try { actual = realpathSync(link); }
        catch { errors.push(`[vitest-dist-guard] ${name} cannot resolve at ${link}\n  cure: relink node_modules into ${root} or provision one with node tools/provision-worktree.mjs <empty-dir>`); }
        const expected = join(root, "packages", dep);
        if (actual && (!inside(root, actual) || actual !== realpathSync(expected))) {
          errors.push(`[vitest-dist-guard] foreign build: ${name} resolves to ${actual}; this checkout expects ${expected}\n  cure: relink node_modules into ${root} or provision one with node tools/provision-worktree.mjs <empty-dir>`);
        } else if (actual && (!existsSync(join(actual, "dist")) || (!globalFresh && packageFreshness(root, dep).stale))) {
          errors.push(`[vitest-dist-guard] ${name} stale build: dist was not built from the current source\n  cure: pnpm --filter ${name} build && node tools/stamp-build.mjs . --pkg ${dep}`);
        }
      }
      visit(dep);
    }
  }
  visit(dir);
  if (errors.length) throw new Error(errors.join("\n"));
}

/** Vitest calls setup once for each running project, before it starts test workers. */
export function setup(context) {
  const root = resolve(context.config.root);
  let repo = root;
  while (!existsSync(join(repo, "pnpm-workspace.yaml"))) {
    const parent = dirname(repo);
    if (parent === repo) throw new Error(`[vitest-dist-guard] no pnpm-workspace.yaml above ${root}`);
    repo = parent;
  }
  const dir = relative(join(repo, "packages"), root);
  const testsRoot = root === join(repo, "tests");
  checkDistDependencies(repo, testsRoot ? "lares-cli" : dir, context.viteConfig.resolve.alias ?? [], testsRoot);
}
