// floor-guard's table: a sub-agent's heavy verb refuses with its cure; reads, data words and the main thread pass.
// RED-FIRST: written by floor-warden#2 (mandate/floor-gate-1), run by the familiar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { heavyVerb, decide, isSubAgent, REASON_HEAD } from './floor-guard.mjs';

const REFUSE = [
  ['pnpm install', 'pnpm install --offline --frozen-lockfile'],
  ['pnpm build', 'pnpm build'],
  ['pnpm -r build', 'pnpm -r build'],
  ['a filtered package test', 'pnpm --filter @lararium/node test'],
  ['a filtered vitest exec', 'pnpm --filter @lararium/node exec vitest run tests/x.test.ts'],
  ['a focused tsc exec', 'pnpm -C packages/lares-cli exec tsc -p tsconfig.json --noEmit'],
  ['a build script with a colon', 'pnpm --filter @lararium/tw5 build:plugin'],
  ['npm run build', 'npm run build'],
  ['npm ci', 'npm ci'],
  ['npx vitest', 'npx vitest run'],
  ['bare vitest', 'vitest run tests/a.test.ts'],
  ['bare tsc', 'tsc -p tsconfig.build.json'],
  ['node --test (a focused tool file counts: Q2)', 'node --test tools/stash-guard.test.mjs'],
  ['a built provision', 'node tools/provision-worktree.mjs /tmp/wt'],
  ['provision --existing', 'node tools/provision-worktree.mjs --existing .worktrees/x'],
  ['the bench gate', 'node tools/bench-gate.mjs'],
  ['the battery legs', 'node tools/battery-legs.mjs --legs build'],
  ['the floor runner itself', 'node tools/floor-run.mjs -- pnpm build'],
  ['the battery', 'bash tools/battery.sh pnpm -r build'],
  ['witness-all by path', './tools/witness-all.sh --fast'],
  ['typecheck-witness through sh', 'sh tools/typecheck-witness.sh'],
  ['docker build', 'docker build -t x .'],
  ['docker buildx', 'docker buildx bake'],
  ['docker compose build', 'docker compose -f docker-compose.surface.yml build lares'],
  ['compose up --build', 'docker compose up --build -d'],
  ['the shim build', 'tools/lares-container.sh build'],
  ['a kukulu', 'lares rite kukulu --branch develop'],
  ['chained after reads', 'git status; cd packages/lares-cli && pnpm test'],
  ['under env and nice', 'LAR_ROOT=/tmp/x env nice pnpm test'],
  ['under timeout', 'timeout 600 node --test tools/x.test.mjs'],
  ['under flock', 'flock /tmp/l pnpm build'],
  ['through xargs', 'echo a | xargs -I{} pnpm --filter {} test'],
  ['through find -exec', 'find . -name package.json -exec npm test \\;'],
  ['inside bash -c', "bash -c 'cd x && pnpm build'"],
  ['inside a substitution', 'out=$(pnpm test 2>&1)'],
  ['through eval', 'eval pnpm build'],
  ['a heredoc fed to bash', 'bash <<EOF\npnpm -r build\nEOF'],
  ['unreadable naming pnpm', "pnpm test 'unterminated"],
];

const PASS = [
  ['git status', 'git status --short'],
  ['a grep for the word', 'grep -rn vitest packages/'],
  ['a quoted search', "rg 'pnpm test' docs/"],
  ['a log grep (data word in a flag value)', 'git log --grep vitest --oneline'],
  ['a cat of a bin path', 'cat node_modules/.bin/tsc'],
  ['a commit message naming a build', 'git commit -m "pnpm build now refuses for spirits"'],
  ['pnpm --version', 'pnpm --version'],
  ['tsc --version', 'tsc --version'],
  ['a source-only provision', 'node tools/provision-worktree.mjs --source-only .worktrees/x --branch spirit/x'],
  ['provision --help', 'node tools/provision-worktree.mjs --help'],
  ['bench-gate --list', 'node tools/bench-gate.mjs --list'],
  ['battery-legs --list', 'node tools/battery-legs.mjs --list'],
  ['battery --lock-path', 'bash tools/battery.sh --lock-path'],
  ['witness-all --list', 'bash tools/witness-all.sh --fast --list'],
  ['the disk guard', 'node tools/disk-guard.mjs'],
  ['a node one-liner', "node -e 'console.log(1)'"],
  ['a syntax check', 'node --check tools/floor-guard.mjs'],
  ['a docker read', 'docker ps -a'],
  ['kukulu receipts', 'lares rite receipts --rite kukulu'],
  ['a heredoc that stays data', 'cat > note.md <<EOF\npnpm -r build\nEOF'],
  ['an unreadable line naming no heavy program', "echo 'unterminated"],
];

for (const [name, cmd] of REFUSE) test(`heavy: ${name}`, () => assert.ok(heavyVerb(cmd), cmd));
for (const [name, cmd] of PASS) test(`light: ${name}`, () => assert.equal(heavyVerb(cmd), null, cmd));

const SUB = { agent_id: 'a1b2', agent_type: 'general-purpose', cwd: '/w', tool_input: { command: 'pnpm test' } };
const MAIN = { session_id: 's', cwd: '/w', tool_input: { command: 'pnpm test' } };

test('RED: the harness marks a sub-agent by agent_id alone; agent_type without agent_id reads as the main thread', () => {
  assert.equal(isSubAgent(SUB), true);
  assert.equal(isSubAgent(MAIN), false);
  assert.equal(isSubAgent({ agent_type: 'x' }), false);
  assert.equal(isSubAgent({ agent_id: '' }), false);
});

test('RED: decide refuses a sub-agent heavy verb with the cure (a floor ticket naming the command and cwd); the familiar passes', () => {
  const out = decide(SUB);
  assert.equal(out.refuse, true);
  assert.ok(out.reason.startsWith(REASON_HEAD));
  assert.match(out.reason, /pono: .*FLOOR TICKET .*run: pnpm test · in: \/w/s);
  assert.equal(decide(MAIN).refuse, false);
  assert.equal(decide({ ...SUB, tool_input: { command: 'git status' } }).refuse, false);
});

test('RED: the hook process exits 2 for a sub-agent heavy verb, 0 for the main thread, and fails closed only for a sub-agent', () => {
  const script = fileURLToPath(new URL('./floor-guard.mjs', import.meta.url));
  const run = (stdin) => spawnSync(process.execPath, [script], { input: stdin, encoding: 'utf8' });
  const refused = run(JSON.stringify(SUB));
  assert.equal(refused.status, 2);
  assert.ok(refused.stderr.startsWith(REASON_HEAD));
  assert.equal(run(JSON.stringify(MAIN)).status, 0);
  assert.equal(run('{ "agent_id": "x", not json, pnpm test').status, 2);
  assert.equal(run('{ not json, pnpm test').status, 0);
});

test('RED: settings.json wires floor-guard beside stash-guard on PreToolUse(Bash)', async () => {
  const { readFileSync } = await import('node:fs');
  const settings = JSON.parse(readFileSync(fileURLToPath(new URL('../.claude/settings.json', import.meta.url)), 'utf8'));
  const commands = settings.hooks.PreToolUse.filter((h) => h.matcher === 'Bash').flatMap((h) => h.hooks.map((x) => x.command));
  assert.ok(commands.some((c) => c.includes('tools/stash-guard.mjs')));
  assert.ok(commands.some((c) => c.includes('tools/floor-guard.mjs')));
});
