/** Storm witnesses pair each refusal or zero count with a known positive control, guarding silent-zero. */
import { createServer } from 'node:http';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import { dialIntentRelay, deriveGateBundle, sovereignGateRoot, sovereignRoute, utf8Bytes, INTENT_RELAY_ROUTE } from '@lararium/mesh';
import { wsDialSocket, type WsLike } from '../../lararium-mesh/src/ws-dial-socket.js';
import { handDeadlines } from '../../lararium-mesh/tests/face-gate-fixture.js';
import { faceGateServer, gatePath } from '../src/face-gate-server.js';
import { custodyGateDoor } from '../src/custody-seat.js';
import { standIntentRelay } from '../src/intent-relay.js';
import { INTENT_RELAY_FACES_FILE } from '../src/intent-relay-ring.js';
import { Repo } from '@automerge/automerge-repo';
import { afterEach, expect, test, vi } from 'vitest';
import { actCid, buildAgentIntent, buildDelegation, buildDelegationRevoke, deriveSelfRecoveryKey, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, fixtureIntentVerbs, intentEntryCid, intentEntryRecordsOfGroup, mayAct, mintPersonaInception, sealKeySetHash, signPersonaAct, writeIntentEntry, type LarDoc } from '@lararium/mesh';
import { intentAdmissionCid, intentAdmissionRecordsOfGroup, signIntentAdmission, writeIntentAdmission } from '../../lararium-mesh/src/intent-admission.js';
import { admitAgentEntry, makeFaceIntentDoor, makeFaceIntentReader } from '../../lararium-keyhive/src/face-intent-door.js';
import { intentRelayKeyOrMint, signAsIntentRelay } from '../src/intent-relay-key-store.js';
import { seatScratchCustody } from './custody-seat-fixture.js';

const who = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(n)) });
async function fixture() {
  const seat = await seatScratchCustody('storm');
  const relay = { key: (await intentRelayKeyOrMint()).key, sign: signAsIntentRelay };
  const root = await who(9), device = await who(1), agent = await who(3), relay2 = await who(5), group = 'face-a';
  const recovery = await deriveSelfRecoveryKey(new Uint8Array(32).fill(9));
  const inception = mintPersonaInception(`0x${root.key}`, sealKeySetHash([recovery.verifyingKey], 1));
  const log = [] as Awaited<ReturnType<typeof signPersonaAct>>[];
  for (const [act, fields] of [['founding', { personaKelPrefix: inception.prefix, rootCommitment: 'root' }], ['admission', { deviceKey: device.key }]] as const) {
    const head = log.at(-1);
    log.push(await signPersonaAct(head ? { seq: head.body.seq, cid: actCid(head.body) } : null, { group, act, epoch: 0, fields }, root));
  }
  const repo = new Repo({ network: [] });
  const plane = repo.create<LarDoc>({ tiddlers: {} } as LarDoc);
  const verbs = fixtureIntentVerbs({ MOVE: 'idempotent', LOOK: 'idempotent' });
  const ports = { group, plane, personaRecords: () => log, kelChain: [inception], standing: () => 'stands' as const, verbs };
  const grant = await buildDelegation({ group, signer: root, epoch: 0, agent: agent.key, prefix: 'MOVE', policy: { kind: 'closed-args', args: { x: { type: 'integer' } } }, bound: { until: { roster: 'a'.repeat(64) } }, nonce: 'grant' });
  const entry = await buildAgentIntent({ group, signer: agent, delegation: intentEntryCid(grant), verb: 'MOVE', args: { x: 1 }, nonce: '', audience: { mode: 'every' }, verbs });
  plane.change(d => writeIntentEntry(d, grant));
  const effect = vi.fn(async () => ({ result: 'done' }));
  const door = makeFaceIntentDoor({ ...ports, atom: device, effects: new Map([['MOVE', effect]]), log: () => {} });
  return { seat, repo, plane, ports, relay, relay2, entry, effect, door, group, root, grant, agent, device, verbs, log };
}
afterEach(() => vi.restoreAllMocks());
// Admission, the door and the reader take no clock. Automerge and ws stamp their own times, so only the IMMEDIATE caller of Date.now decides: a caller inside automerge-repo, ws or node internals reads the real clock; any other caller (the code under test, a plane.change callback) throws.
function clockless() {
  const real = Date.now.bind(Date);
  vi.spyOn(Date, 'now').mockImplementation(() => {
    const caller = String(new Error().stack).split('\n').slice(1).find(l => !/tinyspy|@vitest|spy\.|clockless|mockImplementation|Date\.(<anonymous>|now)/.test(l)) ?? '';
    if (/automerge|\/ws\/|node:internal|node:net|node:http|node:timers/.test(caller)) return real();
    throw Error('clock');
  });
}

test('RED: a failed append leaves the plane unchanged and a repeated submission after a delivered receipt duplicates nothing; CONTROL: the retry admits and a replay returns its prior receipt', async () => {
  const f = await fixture();
  clockless();
  try {
    const before = JSON.stringify(f.plane.doc());
    const change = vi.spyOn(f.plane, 'change').mockImplementationOnce(() => { throw Error('append failed'); });
    expect(await admitAgentEntry(f.ports, f.entry, f.relay)).toEqual({ status: 'refused', refusal: 'fault' });
    expect(JSON.stringify(f.plane.doc())).toBe(before);
    change.mockRestore();
    const landed = await admitAgentEntry(f.ports, f.entry, f.relay);
    expect(landed.status).toBe('admitted');
    const retry = await admitAgentEntry(f.ports, f.entry, f.relay);
    expect(retry.status).toBe('duplicate');
    if (landed.status !== 'admitted' || retry.status !== 'duplicate') throw Error('admission failed');
    expect(intentAdmissionCid(retry.receipt as Parameters<typeof intentAdmissionCid>[0])).toBe(intentAdmissionCid(landed.receipt as Parameters<typeof intentAdmissionCid>[0]));
    expect(intentEntryRecordsOfGroup(f.plane.doc(), f.group)).toHaveLength(2);
    expect(intentAdmissionRecordsOfGroup(f.plane.doc(), f.group)).toHaveLength(1);
    await f.door.heed(); await f.door.heed(); expect(f.effect).toHaveBeenCalledTimes(1);
  } finally { vi.restoreAllMocks(); await f.seat.drop(); }
});

test('RED: two racing relays cannot cause two effects; CONTROL: both receipts remain visible', async () => {
  const f = await fixture();
  clockless();
  try {
    const results = await Promise.all([admitAgentEntry(f.ports, f.entry, f.relay), admitAgentEntry(f.ports, f.entry, f.relay2)]);
    expect(results.map(r => r.status).sort()).toEqual(['admitted', 'duplicate']);
    expect(intentEntryRecordsOfGroup(f.plane.doc(), f.group)).toHaveLength(2);
    expect(intentAdmissionRecordsOfGroup(f.plane.doc(), f.group)).toHaveLength(2);
    await f.door.heed(); await f.door.heed(); expect(f.effect).toHaveBeenCalledTimes(1);
  } finally { vi.restoreAllMocks(); await f.seat.drop(); }
});


async function live(f: Awaited<ReturnType<typeof fixture>>) {
  const gate = faceGateServer(), http = createServer();
  http.on('upgrade', (req, socket, head) => { if (!gate.handleUpgrade(req, socket, head)) socket.destroy(); });
  await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve));
  const port = (http.address() as { port: number }).port;
  const stand = () => standIntentRelay({ gateServer: gate, rootDoor: custodyGateDoor(), deadlines: handDeadlines(), faces: async g => g === f.group ? { group: g, admit: entry => admitAgentEntry(f.ports, entry, f.relay) } : null, log: () => {} });
  const submit = (pin: NonNullable<ReturnType<Awaited<ReturnType<typeof stand>>['pinOf']>>, entry: typeof f.entry) => dialIntentRelay({ pin, entry, socket: wsDialSocket(`ws://127.0.0.1:${port}${pin.route}`, (url, protocols) => new WebSocket(url, protocols, { perMessageDeflate: false }) as unknown as WsLike) });
  const close = async () => { gate.close(); await new Promise<void>(resolve => http.close(() => resolve())); };
  return { gate, stand, submit, port, close };
}

test('RED: revoke refuses a fresh submission and pending sibling; CONTROL: a prior effect remains revoked-after-acting over a live relay', async () => {
  const f = await fixture(), l = await live(f), service = await l.stand();
  const pin = await service.enable(f.group);
  clockless();
  try {
    const sibling = await buildAgentIntent({ group: f.group, signer: f.agent, delegation: intentEntryCid(f.grant), verb: 'MOVE', args: { x: 2 }, nonce: '', audience: { mode: 'every' }, verbs: f.verbs });
    const fresh = await buildAgentIntent({ group: f.group, signer: f.agent, delegation: intentEntryCid(f.grant), verb: 'MOVE', args: { x: 3 }, nonce: '', audience: { mode: 'every' }, verbs: f.verbs });
    expect((await l.submit(pin, f.entry)).status).toBe('admitted');
    await f.door.heed(); expect(f.effect).toHaveBeenCalledTimes(1);
    expect((await l.submit(pin, sibling)).status).toBe('admitted');
    const revoke = await buildDelegationRevoke({ group: f.group, signer: f.root, epoch: 0, delegation: intentEntryCid(f.grant) });
    f.plane.change(d => writeIntentEntry(d, revoke));
    expect(await l.submit(pin, fresh)).toEqual({ status: 'refused', refusal: 'delegation-revoked' });
    await f.door.heed(); expect(f.effect).toHaveBeenCalledTimes(1);
    const view = (await makeFaceIntentReader(f.ports).read()).view;
    expect(view.intents.filter(i => i.voidAfterAct.length)).toHaveLength(1);
    expect(view.intents.filter(i => !i.voidAfterAct.length)).toHaveLength(1);
    for (const state of view.intents) { expect(state.voidCause).toBe('delegation-revoked'); expect(mayAct(view, state.id, f.device.key)).toEqual({ act: false, reason: 'void' }); }
  } finally { vi.restoreAllMocks(); service.close(); await l.close(); await f.seat.drop(); }
});

test('RED: a revoke on the plane before any submission refuses it over a live relay; CONTROL: an unrevoked twin delegation admits the same bytes', async () => {
  const f = await fixture(), l = await live(f), service = await l.stand();
  const pin = await service.enable(f.group);
  clockless();
  try {
    const revoke = await buildDelegationRevoke({ group: f.group, signer: f.root, epoch: 0, delegation: intentEntryCid(f.grant) });
    f.plane.change(d => writeIntentEntry(d, revoke));
    expect(await l.submit(pin, f.entry)).toEqual({ status: 'refused', refusal: 'delegation-revoked' });
    expect(intentEntryRecordsOfGroup(f.plane.doc(), f.group).some(r => (r as { body: { entry?: string } }).body.entry === 'intent')).toBe(false);
    await f.door.heed(); expect(f.effect).not.toHaveBeenCalled();
  } finally { vi.restoreAllMocks(); service.close(); await l.close(); await f.seat.drop(); }
  const g = await fixture(), m = await live(g), s2 = await m.stand();
  try { expect((await m.submit(await s2.enable(g.group), g.entry)).status).toBe('admitted'); } finally { s2.close(); await m.close(); await g.seat.drop(); }
});

test('RED: changed argument refuses; CONTROL: equivalent JSON spelling returns the prior receipt', async () => {
  const f = await fixture();
  clockless();
  try {
    const first = await admitAgentEntry(f.ports, f.entry, f.relay);
    expect(first.status).toBe('admitted');
    const reserialized = JSON.parse(JSON.stringify(f.entry, null, 2).replace('"x": 1', '"x": 1e0'));
    expect(intentEntryCid(reserialized)).toBe(intentEntryCid(f.entry));
    const replay = await admitAgentEntry(f.ports, reserialized, f.relay);
    expect(replay.status).toBe('duplicate');
    if (first.status !== 'admitted' || replay.status !== 'duplicate') throw Error('admission failed');
    expect(replay.receipt).toEqual(first.receipt);
    expect(await admitAgentEntry(f.ports, { ...f.entry, body: { ...f.entry.body, args: { x: 2 } } }, f.relay)).toEqual({ status: 'refused', refusal: 'entry-refused' });
  } finally { vi.restoreAllMocks(); await f.seat.drop(); }
});

test('RED: a sleeper that receives a revoke declines; CONTROL: an isolated stale reader still acts', async () => {
  const f = await fixture();
  clockless();
  try {
    expect((await admitAgentEntry(f.ports, f.entry, f.relay)).status).toBe('admitted');
    const stale = f.repo.clone(f.plane);
    const sleeper = f.repo.clone(f.plane);
    const revoke = await buildDelegationRevoke({ group: f.group, signer: f.root, epoch: 0, delegation: intentEntryCid(f.grant) });
    f.plane.change(d => writeIntentEntry(d, revoke));
    sleeper.merge(f.plane);
    const staleEffect = vi.fn(async () => ({})), sleepingEffect = vi.fn(async () => ({}));
    const door = (plane: typeof f.plane, effect: typeof staleEffect) => makeFaceIntentDoor({ ...f.ports, plane, atom: f.device, effects: new Map([['MOVE', effect]]), log: () => {} });
    await door(sleeper, sleepingEffect).heed(); expect(sleepingEffect).not.toHaveBeenCalled();
    await door(stale, staleEffect).heed(); expect(staleEffect).toHaveBeenCalledTimes(1);
  } finally { vi.restoreAllMocks(); await f.seat.drop(); }
});

test('RED: a valid relay receipt cannot authorize an absent or revoked entry; CONTROL: the genuine entry acts with its receipt', async () => {
  const f = await fixture();
  clockless();
  try {
    const receipt = await signIntentAdmission({ group: f.group, entry: intentEntryCid(f.entry), delegation: intentEntryCid(f.grant), heads: [] }, f.relay);
    f.plane.change(d => writeIntentAdmission(d, receipt));
    await f.door.heed(); expect(f.effect).not.toHaveBeenCalled();
    expect((await makeFaceIntentReader(f.ports).read()).view.intents).toHaveLength(0);
    const outside = await buildAgentIntent({ group: f.group, signer: f.agent, delegation: intentEntryCid(f.grant), verb: 'LOOK', args: { x: 1 }, nonce: '', audience: { mode: 'every' }, verbs: f.ports.verbs });
    const outsideReceipt = await signIntentAdmission({ group: f.group, entry: intentEntryCid(outside), delegation: intentEntryCid(f.grant), heads: [] }, f.relay);
    const lookEffect = vi.fn(async () => ({}));
    const lookDoor = makeFaceIntentDoor({ ...f.ports, atom: f.device, effects: new Map([['LOOK', lookEffect]]), log: () => {} });
    f.plane.change(d => { writeIntentEntry(d, outside); writeIntentAdmission(d, outsideReceipt); });
    await lookDoor.heed(); expect(lookEffect).not.toHaveBeenCalled();
    const outsideView = (await makeFaceIntentReader(f.ports).read()).view;
    expect(outsideView.refused.map(r => r.refusal)).toContain('verb-outside-prefix');
    expect(outsideView.intents).toHaveLength(0);
    f.plane.change(d => writeIntentEntry(d, f.entry));
    await f.door.heed(); expect(f.effect).toHaveBeenCalledTimes(1);
    const revoke = await buildDelegationRevoke({ group: f.group, signer: f.root, epoch: 0, delegation: intentEntryCid(f.grant) });
    f.plane.change(d => writeIntentEntry(d, revoke));
    const state = (await makeFaceIntentReader(f.ports).read()).view.intents[0]!;
    expect(state.admissions).toHaveLength(1); expect(state.voidCause).toBe('delegation-revoked');
    await f.door.heed(); expect(f.effect).toHaveBeenCalledTimes(1);
  } finally { vi.restoreAllMocks(); await f.seat.drop(); }
});

test('RED: a valid relay receipt cannot authorize a pending entry under a revoked delegation; CONTROL: the same receipt on an unrevoked twin acts once', async () => {
  const [f, twin] = [await fixture(), await fixture()];
  clockless();
  try {
    const revoke = await buildDelegationRevoke({ group: f.group, signer: f.root, epoch: 0, delegation: intentEntryCid(f.grant) });
    f.plane.change(d => writeIntentEntry(d, revoke));
    const hostile = await signIntentAdmission({ group: f.group, entry: intentEntryCid(f.entry), delegation: intentEntryCid(f.grant), heads: [] }, f.relay);
    f.plane.change(d => { writeIntentEntry(d, f.entry); writeIntentAdmission(d, hostile); });
    await f.door.heed(); expect(f.effect).not.toHaveBeenCalled();
    const state = (await makeFaceIntentReader(f.ports).read()).view.intents[0]!;
    expect(state.voidCause).toBe('delegation-revoked');
    const receipt = await signIntentAdmission({ group: twin.group, entry: intentEntryCid(twin.entry), delegation: intentEntryCid(twin.grant), heads: [] }, twin.relay);
    twin.plane.change(d => { writeIntentEntry(d, twin.entry); writeIntentAdmission(d, receipt); });
    await twin.door.heed(); expect(twin.effect).toHaveBeenCalledTimes(1);
  } finally { vi.restoreAllMocks(); await f.seat.drop(); await twin.seat.drop(); }
});

test('RED: unknown roster frontier waits; CONTROL: its arriving roster act permits one effect', async () => {
  const f = await fixture();
  clockless();
  try {
    const head = f.log.at(-1)!;
    const next = await signPersonaAct({ seq: head.body.seq, cid: actCid(head.body) }, { group: f.group, act: 'admission', epoch: 0, fields: { deviceKey: (await who(2)).key } }, f.root);
    const grant = await buildDelegation({ group: f.group, signer: f.root, epoch: 0, agent: f.agent.key, prefix: 'MOVE', policy: { kind: 'closed-args', args: { x: { type: 'integer' } } }, bound: { asOf: { roster: actCid(next.body) } }, nonce: 'future' });
    const entry = await buildAgentIntent({ group: f.group, signer: f.agent, delegation: intentEntryCid(grant), verb: 'MOVE', args: { x: 1 }, nonce: '', audience: { mode: 'every' }, verbs: f.verbs });
    f.plane.change(d => { writeIntentEntry(d, grant); writeIntentEntry(d, entry); });
    expect((await makeFaceIntentReader(f.ports).read()).view.intents[0]!.status).toBe('unknown-frontier');
    await f.door.heed(); expect(f.effect).not.toHaveBeenCalled();
    f.log.push(next);
    await f.door.heed(); await f.door.heed(); expect(f.effect).toHaveBeenCalledTimes(1);
  } finally { vi.restoreAllMocks(); await f.seat.drop(); }
});

test('RED: an entry for another face refuses group; CONTROL: each face admits its own entry from the shared agent', async () => {
  const f = await fixture();
  clockless();
  try {
    const group = 'face-b', log: typeof f.log = [];
    for (const act of f.log) log.push(await signPersonaAct(log.length ? { seq: log.at(-1)!.body.seq, cid: actCid(log.at(-1)!.body) } : null, { group, act: act.body.act, epoch: act.body.epoch, fields: act.body.fields }, f.root));
    const plane = f.repo.create<LarDoc>({ tiddlers: {} } as LarDoc), ports = { ...f.ports, group, plane, personaRecords: () => log };
    const grant = await buildDelegation({ group, signer: f.root, epoch: 0, agent: f.agent.key, prefix: 'MOVE', policy: { kind: 'closed-args', args: { x: { type: 'integer' } } }, bound: { until: { roster: 'a'.repeat(64) } }, nonce: 'other' });
    const entry = await buildAgentIntent({ group, signer: f.agent, delegation: intentEntryCid(grant), verb: 'MOVE', args: { x: 1 }, nonce: '', audience: { mode: 'every' }, verbs: f.verbs });
    plane.change(d => writeIntentEntry(d, grant));
    expect(await admitAgentEntry(ports, f.entry, f.relay)).toEqual({ status: 'refused', refusal: 'group' });
    expect((await admitAgentEntry(f.ports, f.entry, f.relay)).status).toBe('admitted');
    expect((await admitAgentEntry(ports, entry, f.relay)).status).toBe('admitted');
  } finally { vi.restoreAllMocks(); await f.seat.drop(); }
});

test('RED: Unicode substitutions break the signature; CONTROL: reordered escaped JSON and numeric spellings duplicate', async () => {
  const f = await fixture();
  clockless();
  try {
    const grant = await buildDelegation({ group: f.group, signer: f.root, epoch: 0, agent: f.agent.key, prefix: 'MOVE', policy: { kind: 'closed-args', args: { text: { type: 'string' }, x: { type: 'integer' } } }, bound: { until: { roster: 'a'.repeat(64) } }, nonce: 'unicode' });
    const entry = await buildAgentIntent({ group: f.group, signer: f.agent, delegation: intentEntryCid(grant), verb: 'MOVE', args: { text: 'é', x: 1 }, nonce: '', audience: { mode: 'every' }, verbs: f.verbs });
    f.plane.change(d => writeIntentEntry(d, grant));
    const first = await admitAgentEntry(f.ports, entry, f.relay); expect(first.status).toBe('admitted');
    for (const number of ['1.0', '1e0']) {
      const raw = JSON.stringify({ sig: entry.sig, signer: entry.signer, body: entry.body }, null, 2).replace('é', '\\u00e9').replace('"x": 1', `"x": ${number}`);
      const reverse = (o: unknown): unknown => Array.isArray(o) ? o.map(reverse) : o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).reverse().map(([k, v]) => [k, reverse(v)])) : o;
      const parsed = reverse(JSON.parse(raw)) as typeof entry;
      expect(intentEntryCid(parsed)).toBe(intentEntryCid(entry));
      const replay = await admitAgentEntry(f.ports, parsed, f.relay);
      expect(replay.status).toBe('duplicate');
      if (first.status === 'admitted' && replay.status === 'duplicate') expect(replay.receipt).toEqual(first.receipt);
    }
    for (const text of ['e\u0301', 'е', 'é\u200b']) expect(await admitAgentEntry(f.ports, { ...entry, body: { ...entry.body, args: { text, x: 1 } } }, f.relay)).toEqual({ status: 'refused', refusal: 'entry-refused' });
    expect(await admitAgentEntry(f.ports, { ...entry, body: { ...entry.body, args: { text: 'é', x: 2 } } }, f.relay)).toEqual({ status: 'refused', refusal: 'entry-refused' });
  } finally { vi.restoreAllMocks(); await f.seat.drop(); }
});

test('RED: absent enablement after removal or never enabled destroys the dial; CONTROL: enabled restart stands', async () => {
  const f = await fixture(), l = await live(f);
  const bundle = deriveGateBundle(sovereignGateRoot(custodyGateDoor()), utf8Bytes(f.group), sovereignRoute(INTENT_RELAY_ROUTE));
  clockless();
  try {
    const refused = (pin: Parameters<typeof l.submit>[0]) => l.submit(pin, f.entry).then(r => `answered:${r.status}`, () => 'destroyed');
    const first = await l.stand(); const pin = await first.enable(f.group); first.close();
    rmSync(join(f.seat.homes.identity, INTENT_RELAY_FACES_FILE));
    const never = await l.stand(); expect(never.standing()).toEqual([]); expect(['destroyed', 'answered:silence']).toContain(await refused(pin)); never.close();
    const enabled = await l.stand(); await enabled.enable(f.group); enabled.close();
    const restarted = await l.stand(); expect(restarted.standing()).toHaveLength(1);
    expect((await l.submit(restarted.pinOf(f.group)!, f.entry)).status).toBe('admitted'); restarted.close();
    rmSync(join(f.seat.homes.identity, INTENT_RELAY_FACES_FILE));
    const removed = await l.stand(); expect(removed.standing()).toEqual([]); expect(['destroyed', 'answered:silence']).toContain(await refused(pin)); removed.close();
  } finally { vi.restoreAllMocks(); bundle.drop(); await l.close(); await f.seat.drop(); }
});
