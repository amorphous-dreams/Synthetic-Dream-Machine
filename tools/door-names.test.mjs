// door-names self-test: the readers over text in memory and a stand-in registry, each red planted beside its control.
import test from 'node:test';
import assert from 'node:assert/strict';
import { branchWords, deadDoorOver, handlerModules, namedCommands } from './door-names.mjs';

// A stand-in registry: a flat table, a tree, an argument door, a pass-through door, and a door with a leading argument.
const deadDoor = deadDoorOver({
  rows: [
    { name: 'vessel', verbs: ['request', 'lay'] },
    { name: 'meme', verbs: { check: null, offer: ['show', 'promote'] } },
    { name: 'wear', verbs: null },
    { name: 'mempalace', verbs: ['setup'], passes: true },
    { name: 'sense', verbs: ['search', 'pour'], leads: '<sensorium>' },
  ],
  shim: ['up'],
});

test('a live line answers: a table word, a tree three words deep, an argument door, a shim verb, an interpolated word', () => {
  for (const line of ['lares vessel request <id>', 'lares meme offer promote <cid>', 'lares wear 2', 'lares wear some-face',
    'lares up', 'lares vessel request ${requestId}', 'lares meme offer <lar:uri>', 'lares help'])
    assert.equal(deadDoor(line), null, line);
});

test('RED: an unknown door, a word outside its table, and a dead third word each read dead at their path', () => {
  assert.match(deadDoor('lares receipt req-1'), /no door "receipt"/);
  assert.match(deadDoor('lares vessel zz-no-such-name'), /"vessel" declares no verb "zz-no-such-name"/);
  assert.match(deadDoor('lares meme offer zz-no-such-name'), /"meme offer" declares no verb/);
});

test('a pass-through door hands its words on; a leading argument reads through only where a verb follows it', () => {
  assert.equal(deadDoor('lares mempalace search <q>'), null);
  assert.equal(deadDoor('lares sense memory pour all=true'), null);
  assert.notEqual(deadDoor('lares sense memory zz-no-such-name'), null);
  assert.notEqual(deadDoor('lares sense zz-no-such-name'), null);
});

test('the collector reads backtick spans (escaped or plain, doc comments too) and whole-string constants', () => {
  assert.deepEqual(namedCommands('x = `run \\`lares vessel request ${id}\\` now`'), ['lares vessel request ${id}']);
  assert.deepEqual(namedCommands('/**\n * `lares zz-no-such-name` in a doc comment\n */'), ['lares zz-no-such-name']);
  assert.deepEqual(namedCommands('export const HAND_ACT = "lares rite kukulu";'), ['lares rite kukulu']);
});

test('CONTROL: a message prefix and a verb written without the `lares ` prefix name no command', () => {
  assert.deepEqual(namedCommands('`lares wiki: request abandoned`'), []);
  assert.deepEqual(namedCommands('a `kairos` verb, not yet a door'), []);
});

test('the branch scan reads a first-positional word compared, switched or destructured', () => {
  assert.deepEqual(branchWords('const sub = args.positional[0];\nif (sub === "roll") return 1;'), ['roll']);
  assert.deepEqual(branchWords('switch (args.positional[0]) {\n  case "join": return 1;\n}'), ['join']);
  assert.deepEqual(branchWords('const [act, file] = args.positional;\nif (act !== "land") return 2;'), ['land']);
});

test('CONTROL: an argument read and a typeof check branch on no word', () => {
  assert.deepEqual(branchWords('const dest = args.positional[0];\nif (!dest) return 2;'), []);
  assert.deepEqual(branchWords('const raw = args.positional[0];\nif (typeof raw === "string") return 2;'), []);
});

test('the handler map reads the CLI table\'s own imports, aliases included', () => {
  const m = handlerModules('import { cmdWear }   from "../commands/wear.js";\nimport { a as cmdFlow, b } from "../commands/flow-run.js";\n');
  assert.equal(m.get('cmdWear'), 'wear');
  assert.equal(m.get('cmdFlow'), 'flow-run');
  assert.equal(m.get('b'), 'flow-run');
});

test('a keyword line answers where a keyword names a door, an act keyword, or the bare door alone; a line naming no act keyword reads red', () => {
  for (const line of ['lares vessel=request mu=!0', 'lares get=<title> aperture=arc', 'lares mu=_0 aperture=beat', 'lares aperture=measure meme=check']) {
    assert.equal(deadDoor(line), null, line);
  }
  assert.match(deadDoor('lares title=x mu=00'), /no act keyword/);
});

test('an address rides the call door by itself; the `act` word names no door', () => {
  for (const line of ['lares lar:///carriage.bag.moves title=<uri> from=<bag> to=<bag>', 'lares lar:///carriage.draft.pulls uri=<uri>', 'lares lar:///<address> … yes=true']) {
    assert.equal(deadDoor(line), null, line);
  }
  for (const line of ['lares act lar:///carriage.bag.moves', 'lares act MOVE title=x from=a to=b', 'lares act']) {
    assert.match(deadDoor(line) ?? '', /no door "act"/, line);
  }
});

test('the help door reads the door words it names', () => {
  for (const line of ['lares help', 'lares help json=true', 'lares help vessel request', 'lares help <door>', 'lares help lar:///carriage.bag.moves']) assert.equal(deadDoor(line), null, line);
  assert.match(deadDoor('lares help vessel zz-no-such-name') ?? '', /declares no verb/);
  assert.match(deadDoor('lares help zz-no-such-name') ?? '', /no door/);
});

test('every dash spelling reads red on every door line; the shim keeps its own, and a token past `--` rides whole', () => {
  for (const line of ['lares vessel request <id> --cancel', 'lares wear 2 --face 1', 'lares mu=_0 --all', 'lares sense pour [--all]', 'lares vessel request <id> --json', 'lares wear 2 --yes', 'lares help --json']) {
    assert.match(deadDoor(line) ?? '', /dash flags burned; params ride as name=value/, line);
  }
  for (const line of ['lares vessel request <id> cancel=true json=true', 'lares wear 2 yes=true', 'lares mempalace setup -- --raw', 'lares up --capture <dir>']) {
    assert.equal(deadDoor(line), null, line);
  }
});
