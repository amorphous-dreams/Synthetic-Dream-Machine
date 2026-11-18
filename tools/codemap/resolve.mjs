/**
 * Import specifiers to repo paths, from the tracked tree alone.
 *
 * A relative specifier resolves against the importing file, trying the TypeScript output-extension swap
 * (`./x.js` to `./x.ts`), appended extensions and index files. A bare specifier resolves through the
 * workspace package that names it: its `exports` map first, its `main` next, then a subpath inside it;
 * a target under `dist/` maps to the same file under `src/`. A specifier that resolves to no tracked
 * file stays external and rides as the specifier.
 */
import { posix } from "node:path";

const SCRIPT_EXTS = [".ts", ".tsx", ".mjs", ".js", ".cjs"];
const SWAPS = { ".js": [".ts", ".tsx", ".js"], ".mjs": [".mts", ".mjs", ".ts"], ".cjs": [".cts", ".cjs"], ".jsx": [".tsx", ".jsx"] };

/** `packages`: Map<package dir, { name, exports, main }> read from tracked package.json files. */
export function makeResolver(fileSet, packages) {
  const byName = new Map();
  for (const [dir, p] of packages) if (p.name) byName.set(p.name, { dir, ...p });

  const firstTracked = (cands) => cands.find((c) => fileSet.has(c));

  function fileCandidates(base) {
    const ext = posix.extname(base);
    const cands = [];
    if (SWAPS[ext]) for (const e of SWAPS[ext]) cands.push(base.slice(0, -ext.length) + e);
    cands.push(base);
    for (const e of SCRIPT_EXTS) cands.push(base + e);
    for (const e of SCRIPT_EXTS) cands.push(posix.join(base, `index${e}`));
    return cands;
  }

  const resolveFile = (base) => firstTracked(fileCandidates(base));

  function distToSrc(target) {
    const m = /^(.*?)\/dist\/(.*)$/.exec(target);
    return m ? `${m[1]}/src/${m[2]}` : null;
  }

  function resolveTarget(pkgDir, target) {
    const rel = posix.normalize(posix.join(pkgDir, target));
    const src = distToSrc(rel);
    return (src && resolveFile(src)) || resolveFile(rel);
  }

  function pickCondition(entry) {
    if (typeof entry === "string") return entry;
    if (Array.isArray(entry)) {
      for (const e of entry) {
        const r = pickCondition(e);
        if (r) return r;
      }
      return null;
    }
    if (entry && typeof entry === "object") {
      for (const c of ["import", "node", "default", "require", "types"]) {
        if (c in entry) {
          const r = pickCondition(entry[c]);
          if (r) return r;
        }
      }
    }
    return null;
  }

  function resolveBare(spec) {
    const m = /^((?:@[^/]+\/)?[^/]+)(?:\/(.*))?$/.exec(spec);
    if (!m) return null;
    const pkg = byName.get(m[1]);
    if (!pkg) return null;
    const key = m[2] ? `./${m[2]}` : ".";
    if (pkg.exports && typeof pkg.exports === "object" && !Array.isArray(pkg.exports)) {
      const exps = pkg.exports;
      const isMap = Object.keys(exps).some((k) => k.startsWith("."));
      const table = isMap ? exps : { ".": exps };
      let entry = table[key];
      if (entry === undefined) {
        for (const [pat, val] of Object.entries(table)) {
          const star = pat.indexOf("*");
          if (star < 0) continue;
          const pre = pat.slice(0, star);
          const post = pat.slice(star + 1);
          if (key.startsWith(pre) && key.endsWith(post) && key.length >= pat.length - 1) {
            const mid = key.slice(pre.length, key.length - post.length);
            const t = pickCondition(val);
            if (t) {
              entry = t.replace("*", mid);
              break;
            }
          }
        }
      }
      const t = pickCondition(entry);
      return t ? resolveTarget(pkg.dir, t) : null;
    }
    if (!m[2]) return (pkg.main && resolveTarget(pkg.dir, pkg.main)) || resolveFile(posix.join(pkg.dir, "src/index")) || resolveFile(posix.join(pkg.dir, "index"));
    return resolveFile(posix.join(pkg.dir, "src", m[2])) || resolveFile(posix.join(pkg.dir, m[2]));
  }

  /** Script specifier from `from`: `{ path }` or `{ external }`. */
  function resolveScript(from, spec) {
    if (spec.startsWith(".") || spec.startsWith("/")) {
      const base = spec.startsWith("/") ? spec.slice(1) : posix.normalize(posix.join(posix.dirname(from), spec));
      const hit = resolveFile(base);
      return hit ? { path: hit } : { external: spec };
    }
    const hit = resolveBare(spec);
    return hit ? { path: hit } : { external: spec };
  }

  /** Python import `{ module, level, names, stdlib }` from `from`: `{ paths, external }`. */
  function resolvePython(from, imp) {
    const paths = [];
    const modPath = imp.module ? imp.module.replace(/\./g, "/") : "";
    const anchors = [];
    if (imp.level > 0) {
      let d = posix.dirname(from);
      for (let i = 1; i < imp.level; i++) d = posix.dirname(d);
      anchors.push(d === "." ? "" : d);
    } else {
      let d = posix.dirname(from);
      for (;;) {
        anchors.push(d === "." ? "" : d);
        if (d === "." || d === "/" || d === "") break;
        d = posix.dirname(d);
      }
    }
    const tryModule = (rel) => {
      for (const a of anchors) {
        const base = posix.join(a, rel);
        const hit = firstTracked([`${base}.py`, posix.join(base, "__init__.py")]);
        if (hit) return hit;
      }
      return null;
    };
    if (modPath) {
      const hit = tryModule(modPath);
      if (hit) paths.push(hit);
    }
    for (const n of imp.names ?? []) {
      const hit = tryModule(posix.join(modPath, n));
      if (hit) paths.push(hit);
    }
    const external = !paths.length && imp.level === 0 && !imp.stdlib && imp.module ? imp.module : null;
    return { paths: [...new Set(paths)], external };
  }

  return { resolveScript, resolvePython };
}
