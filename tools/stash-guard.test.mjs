// stash-guard's table: every shape that reaches `git stash` refuses; reads that only name the word pass.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { reachesStash, decide, REASON } from './stash-guard.mjs';

const none = new Map();

const REFUSE = [
  ['bare', 'git stash'],
  ['list', 'git stash list'],
  ['chained after reads', 'git status --short; git log -1; git stash list'],
  ['in an and-chain', 'cd x && git stash push -m wip'],
  ['under -C', 'git -C /tmp/wt stash list'],
  ['under -C with an attached value', 'git -C"$d" stash pop'],
  ['under -c', 'git -c core.pager=cat stash show'],
  ['under a flag with no value', 'git --literal-pathspecs --no-pager stash list'],
  ['by absolute path', '/usr/bin/git stash'],
  ['behind a backslash', '\\git stash list'],
  ['behind env and command', 'GIT_DIR=.git command git stash'],
  ['under sudo and nice', 'sudo nice git stash drop'],
  ['inside a substitution', 'echo $(git stash list | wc -l)'],
  ['inside backticks', 'n=`git stash list`'],
  ['inside bash -c', "bash -c 'git status; git stash list'"],
  ['inside sh -lc', 'sh -lc "git stash"'],
  ['through eval', 'eval git stash list'],
  ['through xargs', 'echo wt | xargs -I{} git -C {} stash list'],
  ['through find -exec', 'find . -name .git -exec git stash list \\;'],
  ['through process substitution', 'diff <(git stash list) /dev/null'],
  ['through a -c alias', 'git -c alias.sl="stash list" sl'],
  ['through a shell alias', "git -c 'alias.x=!git stash' x"],
  ['through a config env override', 'GIT_CONFIG_VALUE_0="stash list" git x'],
  ['in a heredoc fed to bash', 'bash <<EOF\ngit stash list\nEOF'],
  ['unreadable but naming both', "git stash list 'unterminated"],
];

const PASS = [
  ['status', 'git status --short'],
  ['a grep for the word', 'grep -rn stash packages/'],
  ['a log grep', 'git log --grep stash --oneline'],
  ['a quoted search', "rg 'git stash' docs/"],
  ['a quoted echo', "echo 'git stash'"],
  ['a commit message holding the word', 'git commit -m "the guard refuses git stash" --only -- tools/x.mjs'],
  ['a path holding the word', 'cat tools/stash-guard.mjs'],
  ['a show of a path named stash', 'git show HEAD:stash'],
  ['a heredoc that stays data', 'cat > note.md <<EOF\nnever run git stash\nEOF'],
  ['an unreadable line naming no stash', "echo 'unterminated"],
];

for (const [name, cmd] of REFUSE) test(`refuses: ${name}`, () => assert.equal(reachesStash(cmd, none), true, cmd));
for (const [name, cmd] of PASS) test(`passes: ${name}`, () => assert.equal(reachesStash(cmd, none), false, cmd));

test('a repository alias that resolves to stash refuses, and one that does not passes', () => {
  const aliases = new Map([['wip', 'stash push'], ['st', 'status']]);
  assert.equal(reachesStash('git wip', aliases), true);
  assert.equal(reachesStash('git st', aliases), false);
});

test('decide reads the hook JSON and lets a non-Bash shape pass', () => {
  assert.equal(decide({ tool_input: { command: 'git stash list' } }, none).refuse, true);
  assert.equal(decide({ tool_input: {} }, none).refuse, false);
});

test('the hook process exits 2 with the reason on a stash, 0 otherwise, and fails closed on bad JSON naming both', () => {
  const script = fileURLToPath(new URL('./stash-guard.mjs', import.meta.url));
  const run = (stdin) => spawnSync(process.execPath, [script], { input: stdin, encoding: 'utf8' });
  const refused = run(JSON.stringify({ tool_input: { command: 'git stash list' }, cwd: '/' }));
  assert.equal(refused.status, 2); assert.equal(refused.stderr.trim(), REASON);
  assert.equal(run(JSON.stringify({ tool_input: { command: 'git status' }, cwd: '/' })).status, 0);
  assert.equal(run('{ not json, git stash').status, 2);
  assert.equal(run('{ not json').status, 0);
});
