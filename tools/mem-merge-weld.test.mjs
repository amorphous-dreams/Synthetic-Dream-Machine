// mem-merge-weld.test — the git driver and the one meme-merge module write the same merge
// (lar:///ha.ka.ba/lares/api/pono/working-procedures#/the-seal-merge).
//
// The seal merge lives in ONE module, `@lararium/mesh/meme-merge` (its git line merge at `@lararium/mesh/meme-merge-git`):
// `tools/mem-merge-driver.mjs` shells over it for git, and the vessel's `mergeCarrier` calls it where a disk edit and a
// house write meet. This weld runs the driver as git runs it (three files, the result written over ours, the exit code)
// and calls the module in process over the same three sides, and holds the two to one byte string and one verdict over a
// corpus of carrier triples: a clean merge, disjoint slots both re-sealed, a same-slot conflict, a seal-only difference,
// and two slots added at one place.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { distModule } from './corpus-read.mjs';
import { loadSealer } from './mem-merge-driver.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DRIVER = join(REPO, 'tools/mem-merge-driver.mjs');
const ME = 'mem-merge-weld.test';
const MESH = 'pnpm --filter @lararium/mesh build';
const { stampCarrier, verifyBcc } = await distModule(REPO, 'packages/lararium-memetic-frame/dist/index.js', ME, 'pnpm --filter @lararium/memetic-frame build');
const { CARRIER_TYPE } = await distModule(REPO, 'packages/lararium-mesh/dist/carrier-type.js', ME, MESH);
const { mergeCarrier } = await distModule(REPO, 'packages/lararium-mesh/dist/meme-merge.js', ME, MESH);
const { mergeTexts } = await distModule(REPO, 'packages/lararium-mesh/dist/meme-merge-git.js', ME, MESH);
const seal = await loadSealer(REPO);

const TITLE = 'lar:///ha.ka.ba/lares/test/meme-merge-weld';
const slot = (name, ...lines) => [`<<~ ahu slot=\`#/${name}\`>>`, '', ...lines, '', '<<~/ahu>>', ''];
const carrier = (slots, { sealed = true } = {}) => {
  const text = [
    '<<!DOCTYPE type=`memetic-wikitext+tiddlywiki` spec=`lar:///ha.ka.ba/lares/api/pono/memetic-wikitext`>>',
    '',
    `<<^ code=\`&#x0001;\` from=\`?\` to=\`${TITLE}\`>>`,
    '<<^ code=`&#x0002;`>>',
    '',
    '```toml meta',
    `title = "${TITLE}"`,
    `type  = "${CARRIER_TYPE}"`,
    '```',
    '',
    ...slots.flat(),
    '<<^ code=`&#x0003;`>>',
    '',
    '<<^ code=`&#x0004;` to=`?`>>',
    '',
  ].join('\n');
  return sealed ? stampCarrier(text) : text;
};

const A = (line = 'The first slot holds.') => slot('first', '! First', '', line);
const B = (line = 'The second slot holds.') => slot('second', '! Second', '', line);
const C = (line = 'The third slot holds.') => slot('third', '! Third', '', line);
const BASE = carrier([A(), B(), C()]);

const CORPUS = [
  { name: 'a clean merge: one side moved, the other stands at base', base: BASE, ours: carrier([A('The first slot turns.'), B(), C()]), theirs: BASE, resolved: true },
  { name: 'disjoint slots, both re-sealed', base: BASE, ours: carrier([A('The first slot turns.'), B(), C()]), theirs: carrier([A(), B(), C('The third slot turns.')]), resolved: true },
  { name: 'a same-slot conflict', base: BASE, ours: carrier([A(), B('The second slot turns one way.'), C()]), theirs: carrier([A(), B('The second slot turns the other way.'), C()]), resolved: false },
  { name: 'a seal-only difference: one side carries its seal bare', base: BASE, ours: carrier([A(), B(), C()], { sealed: false }), theirs: carrier([A('The first slot turns.'), B(), C()]), resolved: true },
  {
    name: 'two slots added at one place',
    base: carrier([A(), C()]),
    ours: carrier([A(), slot('ours', 'Ours lands here.'), C()]),
    theirs: carrier([A(), slot('theirs', 'Theirs lands here.'), C()]),
    resolved: true,
  },
];

/** The driver as git runs it: %O %A %B %P %L, the merge written over ours, exit 0 for resolved. */
function runDriver(t, { base, ours, theirs }) {
  const dir = mkdtempSync(join(tmpdir(), 'mem-merge-weld-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, 'O'), base);
  writeFileSync(join(dir, 'A'), ours);
  writeFileSync(join(dir, 'B'), theirs);
  const r = spawnSync('node', [DRIVER, join(dir, 'O'), join(dir, 'A'), join(dir, 'B'), 'c.mem', '7'], { encoding: 'utf8' });
  assert.ok(r.status === 0 || r.status === 1, `the driver answers 0 or 1, not ${r.status}: ${r.stderr}`);
  return { resolved: r.status === 0, text: readFileSync(join(dir, 'A'), 'utf8') };
}

for (const triple of CORPUS) {
  test(`weld: ${triple.name}`, (t) => {
    const driver = runDriver(t, triple);
    const module = mergeCarrier({ base: triple.base, ours: triple.ours, theirs: triple.theirs, path: 'c.mem', markerSize: 7, lineMerge: mergeTexts, seal });
    assert.equal(module.text, driver.text, 'the driver and the module write one byte string');
    assert.equal(module.resolved, driver.resolved, 'the driver and the module give one verdict');
    assert.equal(driver.resolved, triple.resolved, `the corpus names this triple ${triple.resolved ? 'resolved' : 'conflicted'}`);
    if (triple.resolved) assert.equal(verifyBcc(driver.text), 'ok', 'a resolved merge carries a seal over its merged body');
    else assert.match(driver.text, /^<<<<<<< /m, 'a conflict stands with git\'s markers');
  });
}
