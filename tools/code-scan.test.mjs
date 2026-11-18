import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const tools = dirname(fileURLToPath(import.meta.url));

// Each case feeds tools/code_scan.py one source and reads back the masked text.
const mask = src => {
  const r = spawnSync('python3', ['-c', 'import sys; from code_scan import mask_non_code; sys.stdout.write(mask_non_code(sys.stdin.read()))'],
    { cwd: tools, input: src, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
};

test('comments and strings blank to spaces, offsets and newlines kept', () => {
  const src = 'const a = "x"; // case "k":\n/* y */ b';
  const out = mask(src);
  assert.equal(out.length, src.length);
  assert.equal(out, 'const a =    ;' + ' '.repeat(13) + '\n        b');
});

test('a template interpolation stays code, a nested template inside it and all', () => {
  assert.equal(mask('a = `x ${b ? `c` : "d"} y`; case "k":'), 'a =    ${b ?     :        ; case    :');
});

test('a regex literal holding quotes never opens a string', () => {
  const out = mask('t = `${/^p\\s*=\\s*"([^"]+)"/m.exec(s)?.[1]}`;\nswitch (v) { case "k": go(); }');
  assert.match(out, /\nswitch \(v\) \{ case\s+: go\(\); \}$/);
});

test('a division stays code', () => {
  assert.equal(mask('x = a / b / c; "s"'), 'x = a / b / c;    ');
});

test('an unbalanced quote blanks its own line alone', () => {
  assert.equal(mask('q = "open\nnext = 1'), 'q =      \nnext = 1');
});
