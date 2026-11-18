// A lane's module farms share no inode with another tree. A regular file under node_modules carrying a second link (a
// hardlink import from the pnpm store, the main checkout or another lane) lets a write in one tree reach every tree that
// links it, past any wall that fences only paths. Provision refuses one; the test door and the lead and build launch refuse
// one too, so the wall never rests on how a tree was installed. One walk, lstat only, no link followed.
import { existsSync, lstatSync, readdirSync, openSync, closeSync, constants as FS } from 'node:fs';
import { join } from 'node:path';

/** Module farms a workspace install writes, relative to `root`: the root, every top-level workspace dir, every package. */
export function moduleFarms(root) {
  const dirs = base => existsSync(base) ? readdirSync(base, { withFileTypes: true }).filter(e => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules').map(e => e.name) : [];
  return ['node_modules', ...dirs(root).filter(d => d !== 'packages').map(d => `${d}/node_modules`), ...dirs(join(root, 'packages')).map(d => `packages/${d}/node_modules`)]
    .filter(rel => existsSync(join(root, rel)) && lstatSync(join(root, rel)).isDirectory());
}

/**
 * Walk each farm once (`farms`: `{ rel, dir }`, where `dir` is any readable path to it, a `/proc/self/fd/N` handle included)
 * and return `{ count, sample }`: the regular files with nlink > 1, named relative to the tree.
 */
export function sharedModuleFiles(farms, sampleSize = 5, { beforeDescend = () => {} } = {}) {
  let count = 0; const sample = [];
  const directoryFlags = FS.O_RDONLY | FS.O_DIRECTORY | FS.O_NOFOLLOW;
  const walk = (dir, rel) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) { beforeDescend(path); const fd = openSync(path, directoryFlags); try { walk(`/proc/self/fd/${fd}`, `${rel}/${entry.name}`); } finally { closeSync(fd); } }
      else if (entry.isFile() && lstatSync(path).nlink > 1) { count++; if (sample.length < sampleSize) sample.push(`${rel}/${entry.name}`); }
    }
  };
  for (const { rel, dir } of farms) walk(dir, rel);
  return { count, sample };
}

/** The refusal a tree's shared module inodes earn, by name; null when every module file holds its own inode. */
export function sharedInodeRefusal({ count, sample }) {
  if (count === 0) return null;
  return `${count} node_modules file(s) share an inode with another tree (a hardlink import): ${sample.join(', ')}${count > sample.length ? ', ...' : ''}; re-provision the tree (copy install) before any seat enters it`;
}

/** The whole question for a tree on disk: null, or the refusal naming its shared module files. */
export function treeSharedInodes(root) {
  return sharedInodeRefusal(sharedModuleFiles(moduleFarms(root).map(rel => ({ rel, dir: join(root, rel) }))));
}
