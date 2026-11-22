/**
 * THE DOOR READS THE PEER, NOT THE MARK ALONE (seat-canon-reach, wave R's follow-up). The CLI marks its line `seat: "ai"`
 * when an AI harness's own mark stands in its environment (`CLAUDECODE=1`, Codex's sandbox marks); a client that omits
 * the mark asks as the operator's `cli`. The UDS door binds the asker to the peer instead: it reads the connected peer's
 * process off the kernel's socket table, walks that process's ancestry under `/proc`, and reads `seat` wherever a harness
 * stands on the peer's own branch (a process whose launch environment carries a harness mark, or a harness by name),
 * below the line the vessel itself descends from.
 *
 * The witness spawns real clients. A HARNESS shell (its environment carries `CLAUDECODE=1`) runs a client with the mark
 * stripped (`env -u CLAUDECODE`): the line carries no seat mark, and the door still reads `seat`. CONTROL: the same client
 * under a plain shell (no mark anywhere on its branch) reads `cli`, so the operator's own terminal keeps its hand, and a
 * run of this suite inside a harness reads as CI does (the harness stands above the vessel too, so the door never judges it).
 */
import { controlStoreOf } from "@lararium/mesh";
import { afterEach, expect, test } from "vitest";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConnection, type Socket } from "node:net";
import { Repo } from "@automerge/automerge-repo";
import { AutomergeDocStore, CompositeStore, DAEMON_BAG_ID, emptyLarDoc, concludeVerb, wikiSlotUri, type LarDoc } from "@lararium/mesh";
import { HAND_PROFILES, type SessionFace } from "@lararium/mesh/session-contract";
import { makeUdsSeat, serveUdsFront, type UdsSessionDoor, type UdsSessionSigner } from "../src/uds-channel.js";
import { claimStore } from "../src/owned-store.js";
import { harnessOnBranch, peerPidsIn, statOf, type PeerKind, type ProcReader } from "../src/uds-peer.js";
import { STORE_DOOR_HAND_CODES, STORE_DOOR_HAND_ONLY_ACTS } from "../src/store-door-verbs.js";

const HARNESS_MARKS = ["CLAUDECODE", "CODEX_SANDBOX", "CODEX_SANDBOX_NETWORK_DISABLED"] as const;

const face = (name: string): SessionFace => ({
  personaGroup: `group-${name}`, proofSubject: `proof-${name}`, admitRef: `admit-${name}`, causalRevision: `revision-${name}`,
  planes: { persona: `persona-${name}`, circles: `circles-${name}`, identities: `identities-${name}`, sessions: `sessions-${name}`, intents: `intents-${name}` },
});

const cleanups: Array<() => Promise<void> | void> = [];
afterEach(async () => { for (const c of cleanups.splice(0).reverse()) await c(); });

async function stand(opts: { peerKind?: (sock: Socket) => Promise<PeerKind> } = {}) {
  const repo = new Repo({ sharePolicy: async () => true });
  const daemonHandle = repo.create<LarDoc>(emptyLarDoc());
  const workingHandle = repo.create<LarDoc>(emptyLarDoc());
  const composite = new CompositeStore();
  composite.addLayer({ bagId: DAEMON_BAG_ID, store: new AutomergeDocStore(daemonHandle as never, DAEMON_BAG_ID), writable: true, defaultWritable: false });
  composite.addLayer({ bagId: wikiSlotUri("daemon", "working"), store: new AutomergeDocStore(workingHandle, wikiSlotUri("daemon", "working")), writable: true });
  const dir = mkdtempSync(join(tmpdir(), "uds-peer-bind-"));
  const claim = await claimStore(dir, { holder: "vessel" });
  const door: UdsSessionDoor = { anchorNow: async () => ({ kind: "nexus", aid: "nexus-one.synthetic" }), open: async ({ faceRef, hand }) => ({ ok: true, supply: {
    face: face(faceRef), ordinal: Number(faceRef.slice(1)), profile: HAND_PROFILES[hand], presenter: `verified-${faceRef}`,
    anchor: { kind: "nexus", aid: "nexus-one.synthetic" }, mint: async () => ({ ok: true, signer: { drop() {} } as unknown as UdsSessionSigner }) } }) };
  const placed: Array<{ verb: string; requestId: string; asker?: string }> = [];
  const front = serveUdsFront({ claim });
  front.attach(makeUdsSeat({ controlHandle: daemonHandle, control: controlStoreOf(daemonHandle), claim, repo: { flush: (ids) => repo.flush(ids) }, sessions: door,
    handOnlyActs: STORE_DOOR_HAND_ONLY_ACTS, handOnlyCodes: STORE_DOOR_HAND_CODES, ...(opts.peerKind ? { peerKind: opts.peerKind } : {}),
    switchActs: { write: async () => {} },
    mountOrdinal: () => 0,
    lentOrdinals: async () => [0],
    placeVerb: (o) => {
      placed.push(o);
      const outcome = concludeVerb({ requestId: o.requestId, verb: o.verb, status: "done", cause: "test-worker",
        batchMode: "best-effort", results: { summary: { ok: true, output: { landed: true } } } });
      daemonHandle.change((doc) => { doc.tiddlers[outcome.tiddler.title] = outcome as unknown as LarDoc["tiddlers"][string]; });
    } }));
  cleanups.push(async () => { await front.close(); await claim.release(); await repo.shutdown(); rmSync(dir, { recursive: true, force: true }); });
  return { socketPath: claim.socketPath, placed };
}

/** A client that writes the given lines in turn (each answered before the next) and exits; it never carries a seat mark. */
const CLIENT = `
const net = require("node:net");
const [path, linesJson] = process.argv.slice(1);
const lines = JSON.parse(linesJson);
const sock = net.createConnection(path);
let buf = "";
const next = () => { const l = lines.shift(); if (!l) { sock.end(); return; } sock.write(JSON.stringify(l) + "\\n"); };
sock.setEncoding("utf8");
sock.on("connect", next);
sock.on("data", (c) => { buf += c; let nl; while ((nl = buf.indexOf("\\n")) !== -1) { const r = JSON.parse(buf.slice(0, nl)); buf = buf.slice(nl + 1);
  if (r.kind === "session:opened") { const env = { ownerEpoch: r.ownerEpoch, sessionId: r.sessionId, generation: r.generation, faceRef: r.faceRef };
    for (const l of lines) Object.assign(l, env); }
  process.stdout.write(JSON.stringify(r) + "\\n"); next(); } });
sock.on("error", (e) => { process.stderr.write(String(e)); process.exit(2); });
`;

/**
 * Run the client under a shell that stays its parent (the trailing `; true` keeps `sh` from exec-ing into it). `harness`
 * gives the SHELL a harness mark and strips it from the client, so only the branch, never the line, carries the harness.
 */
function runClient(socketPath: string, lines: unknown[], harness: boolean): Promise<string> {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const m of HARNESS_MARKS) delete env[m];
  if (harness) env["CLAUDECODE"] = "1";
  const script = `env -u CLAUDECODE -u CODEX_SANDBOX -u CODEX_SANDBOX_NETWORK_DISABLED "$0" -e "$1" "$2" "$3"; true`;
  return new Promise((resolve, reject) => {
    const child = spawn("sh", ["-c", script, process.execPath, CLIENT, socketPath, JSON.stringify(lines)], { env, stdio: ["ignore", "pipe", "pipe"] });
    let out = ""; let err = "";
    child.stdout.on("data", (c) => { out += String(c); });
    child.stderr.on("data", (c) => { err += String(c); });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve(out) : reject(new Error(`client exited ${code}: ${err}`)));
  });
}

const MEME = { recipe: "default", uri: "lar:///ha.ka.ba/kahua/memory/project/steward", text: "x" };
const askerOf = (p: unknown): unknown => (p as { asker?: unknown }).asker;

test("RED: a one-shot line with no seat mark, from a client a harness shell launched, places with asker seat", async () => {
  const v = await stand();
  await runClient(v.socketPath, [{ verb: "meme-get", args: MEME, requestedBy: "0xunmarked", requestId: "harness-line" }], true);
  expect(v.placed.map(askerOf)).toEqual(["seat"]);
}, 20_000);

test("CONTROL: the same unmarked line from a plain shell (the operator's terminal) places with asker cli", async () => {
  const v = await stand();
  await runClient(v.socketPath, [{ verb: "meme-get", args: MEME, requestedBy: "0xop", requestId: "plain-line" }], false);
  expect(v.placed.map(askerOf)).toEqual(["cli"]);
}, 20_000);

test("RED: a session opened with hand cli from a harness-launched client wears the seat's hand; its call places with asker seat", async () => {
  const v = await stand();
  const out = await runClient(v.socketPath, [
    { op: "session:open", requestId: "open-h0", faceRef: "h0", hand: "cli" },
    { op: "session:call", requestId: "get-h0", verb: "meme-get", args: MEME },
  ], true);
  expect(out).toMatch(/"session:opened"/);
  expect(v.placed.map(askerOf)).toEqual(["seat"]);
}, 20_000);

test("CONTROL: the same session from a plain shell keeps hand cli; its call places with asker cli", async () => {
  const v = await stand();
  await runClient(v.socketPath, [
    { op: "session:open", requestId: "open-h0", faceRef: "h0", hand: "cli" },
    { op: "session:call", requestId: "get-h0", verb: "meme-get", args: MEME },
  ], false);
  expect(v.placed.map(askerOf)).toEqual(["cli"]);
}, 20_000);

test("CONTROL: an in-process client (the vessel's own process) keeps the line's own reading: unmarked reads cli", async () => {
  const v = await stand();
  const sock: Socket = createConnection(v.socketPath);
  await new Promise<void>((resolve, reject) => { sock.once("connect", resolve); sock.once("error", reject); });
  cleanups.push(() => { sock.destroy(); });
  const answered = new Promise<void>((resolve) => sock.once("data", () => resolve()));
  sock.write(JSON.stringify({ verb: "meme-get", args: MEME, requestedBy: "0xop", requestId: "in-process" }) + "\n");
  await answered;
  expect(v.placed.map(askerOf)).toEqual(["cli"]);
});

// AN UNREAD PEER BOOKS NO HAND (hitl-reads-a-hand): `cli` rides only a peer that reads `hand`. A peer the socket table cannot
// read (no `ss`, a peer gone, an unreadable link) places its ask with no asker, and a hand-only verb refuses `hand-unattested`.
const UNREAD = async (): Promise<PeerKind> => "unknown";

test("RED: an unread peer's one-shot line places with no asker; CONTROL: a peer that reads hand places cli", async () => {
  const v = await stand({ peerKind: UNREAD });
  await runClient(v.socketPath, [{ verb: "meme-get", args: MEME, requestedBy: "0xop", requestId: "unread-line" }], false);
  expect(v.placed.map(askerOf)).toEqual([undefined]);
  const c = await stand({ peerKind: async () => "hand" });
  await runClient(c.socketPath, [{ verb: "meme-get", args: MEME, requestedBy: "0xop", requestId: "read-line" }], false);
  expect(c.placed.map(askerOf)).toEqual(["cli"]);
}, 20_000);

test("RED: an unread peer's session refuses a hand-only call (retire-wiki, purge) hand-unattested and places a plain call with no asker", async () => {
  const v = await stand({ peerKind: UNREAD });
  const out = await runClient(v.socketPath, [
    { op: "session:open", requestId: "open-h0", faceRef: "h0", hand: "cli" },
    { op: "session:call", requestId: "retire-h0", verb: "retire-wiki", args: { slug: "x" } },
    { op: "session:call", requestId: "purge-h0", verb: "purge", args: { name: "x" } },
    { op: "session:call", requestId: "get-h0", verb: "meme-get", args: MEME },
  ], false);
  expect(out.match(/hand-unattested/g)?.length).toBe(2);
  expect(v.placed.map((p) => [(p as { verb: string }).verb, askerOf(p)])).toEqual([["meme-get", undefined]]);
}, 20_000);

test("CONTROL: a session whose peer reads hand places its hand-only call with asker cli", async () => {
  const v = await stand({ peerKind: async () => "hand" });
  await runClient(v.socketPath, [
    { op: "session:open", requestId: "open-h0", faceRef: "h0", hand: "cli" },
    { op: "session:call", requestId: "retire-h0", verb: "retire-wiki", args: { slug: "x" } },
  ], false);
  expect(v.placed.map((p) => [(p as { verb: string }).verb, askerOf(p)])).toEqual([["retire-wiki", "cli"]]);
}, 20_000);

// THE READING ITSELF, over a vector `/proc`: the branch walk, the cut at the vessel's line, and the socket-table read.
const procOf = (rows: Record<number, { comm: string; ppid: number; env?: string[]; argv?: string[] }>): ProcReader => ({
  stat:    (pid) => rows[pid] ? `${pid} (${rows[pid]!.comm}) S ${rows[pid]!.ppid} ${pid} ${pid}` : null,
  environ: (pid) => rows[pid] ? (rows[pid]!.env ?? []).join("\0") : null,
  cmdline: (pid) => rows[pid] ? (rows[pid]!.argv ?? [rows[pid]!.comm]).join("\0") : null,
});

test("UNIT: a harness mark on any process of the peer's branch reads harness; a mark only above the vessel's line reads none", () => {
  const proc = procOf({
    1:  { comm: "init", ppid: 0 },
    10: { comm: "zsh", ppid: 1, env: ["CLAUDECODE=1"] },      // above both: the vessel descends from it too
    20: { comm: "node", ppid: 10 },                           // the vessel
    30: { comm: "bash", ppid: 10, env: ["CODEX_SANDBOX=seatbelt"] },
    31: { comm: "node", ppid: 30, env: [] },                  // a peer that cleared its own marks
    40: { comm: "zsh", ppid: 1 },
    41: { comm: "node", ppid: 40 },                           // the operator's terminal
    50: { comm: "claude", ppid: 1 },
    51: { comm: "sh", ppid: 50, env: ["CLAUDECODE=0"] },
    52: { comm: "node", ppid: 51 },                           // under a harness by name
  });
  expect(harnessOnBranch(31, 20, proc)).toBe(true);
  expect(harnessOnBranch(41, 20, proc)).toBe(false);
  expect(harnessOnBranch(52, 20, proc)).toBe(true);
  expect(harnessOnBranch(20, 20, proc)).toBe(false);          // in-process
  expect(harnessOnBranch(10, 20, proc)).toBe(false);          // the vessel's own ancestor
  expect(harnessOnBranch(99, 20, proc)).toBe(false);          // unreadable: no reading
});

test("UNIT: stat lines with spaces and parens in comm read their parent; the socket table names the peer's pids", () => {
  expect(statOf("77 (a (b) c) S 5 77 77 0")).toEqual({ comm: "a (b) c", ppid: 5 });
  const table = [
    "u_str ESTAB 0 0 /run/lar/verbs.sock 1001 * 1000",
    `u_str ESTAB 0 0 * 1000 * 1001 users:(("node",pid=4242,fd=21))`,
    "u_str ESTAB 0 0 * 2000 * 2001",
  ].join("\n");
  expect(peerPidsIn(table, "1001")).toEqual([4242]);
  expect(peerPidsIn(table, "2000")).toBeNull();
  expect(peerPidsIn(table, "3000")).toBeNull();
});

test("RED: a session opened with hand tab or watcher from a harness-launched client wears the seat's hand too; its call places with asker seat", async () => {
  for (const hand of ["tab", "watcher"]) {
    const v = await stand();
    await runClient(v.socketPath, [
      { op: "session:open", requestId: `open-${hand}`, faceRef: "h0", hand },
      { op: "session:call", requestId: `get-${hand}`, verb: "meme-get", args: MEME },
    ], true);
    expect(v.placed.map(askerOf), hand).toEqual(["seat"]);
  }
}, 30_000);

test("CONTROL: a tab session from a plain shell keeps its own hand", async () => {
  const v = await stand();
  await runClient(v.socketPath, [
    { op: "session:open", requestId: "open-tab", faceRef: "h0", hand: "tab" },
    { op: "session:call", requestId: "get-tab", verb: "meme-get", args: MEME },
  ], false);
  expect(v.placed.map(askerOf)).toEqual(["tab"]);
}, 20_000);
