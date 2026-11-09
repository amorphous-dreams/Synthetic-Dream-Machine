/**
 * daemon-observe — the daemon bag's one-way render under `<projections>/observe/daemon/`.
 *
 * A summons or an outcome lands as JSON; a cap event never does; a field named like a secret reads `<redacted>`, at the
 * top level and inside a JSON payload; the toggle off mints no render; and an edit to an observe file changes nothing
 * in the store (the record's next move writes over it).
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { DAEMON_BAG_ID } from "@lararium/mesh";
import { MemoryTiddlerStore } from "../../lararium-tw5/src/memory-store.js";
import { mountDaemonObserve, observeDaemonEnabled, observeFileOf, REDACTED } from "../src/daemon-observe.js";
import { daemonDiskMirrors, daemonObserveRoot, isObserveProjectionPath } from "../src/bag-paths.js";

const origin = { kind: "test" } as const;
const SUMMONS = `${DAEMON_BAG_ID}/summons/s-1`;
const OUTCOME = `${DAEMON_BAG_ID}/outcomes/o-1`;
const CAP = `${DAEMON_BAG_ID}/cap/0123456789abcdef01234567/deadbeef`;
let root = "";
afterEach(() => { if (root) rmSync(root, { recursive: true, force: true }); root = ""; });

async function rig() {
  root = mkdtempSync(join(tmpdir(), "daemon-observe-"));
  const observe = daemonObserveRoot(join(root, "projections"));
  const store = new MemoryTiddlerStore(DAEMON_BAG_ID);
  await store.put({ tiddler: { title: SUMMONS, text: "summon the face", verb: "kahua-read" } }, origin);
  await store.put({ tiddler: {
    title: OUTCOME, "seed-words": "alpha beta", status: "ok",
    text: JSON.stringify({ ok: true, passphrase: "hunter2", nested: { token: "t-1", keep: "me" }, list: [{ "private-key": "k" }] }),
  } }, origin);
  await store.put({ tiddler: { title: CAP, text: "AAECAw==", variant: "DELEGATED" } }, origin);
  const mounted = mountDaemonObserve(store, observe);
  await mounted.idle();
  return { store, observe, mounted };
}

test("a summons and an outcome land under projections/observe/daemon; a cap event never does", async () => {
  const { observe, mounted } = await rig();
  expect(observeFileOf(observe, SUMMONS)).toBe(join(observe, "summons", "s-1.json"));
  expect(JSON.parse(readFileSync(join(observe, "summons", "s-1.json"), "utf8")).verb).toBe("kahua-read");
  expect(existsSync(join(observe, "outcomes", "o-1.json"))).toBe(true);
  expect(observeFileOf(observe, CAP)).toBeNull();
  expect(existsSync(join(observe, "cap"))).toBe(false);
  mounted.stop();
});

test("a field named like a secret reads <redacted>, at the top level and inside the JSON payload", async () => {
  const { observe, mounted } = await rig();
  const row = JSON.parse(readFileSync(join(observe, "outcomes", "o-1.json"), "utf8")) as Record<string, string>;
  expect(row["seed-words"]).toBe(REDACTED);
  expect(row["status"]).toBe("ok");
  const payload = JSON.parse(row["text"]!) as { passphrase: string; nested: { token: string; keep: string }; list: Array<Record<string, string>> };
  expect(payload.passphrase).toBe(REDACTED);
  expect(payload.nested).toEqual({ token: REDACTED, keep: "me" });
  expect(payload.list[0]!["private-key"]).toBe(REDACTED);
  expect(readFileSync(join(observe, "outcomes", "o-1.json"), "utf8")).not.toContain("hunter2");
  mounted.stop();
});

test("editing an observe file changes nothing in the store, and the record's next move writes over it", async () => {
  const { store, observe, mounted } = await rig();
  const file = join(observe, "summons", "s-1.json");
  writeFileSync(file, JSON.stringify({ title: SUMMONS, text: "a hand's edit" }));
  await mounted.idle();
  expect((await store.get(SUMMONS))?.tiddler["text"]).toBe("summon the face");
  await store.put({ tiddler: { title: SUMMONS, text: "summoned again", verb: "kahua-read" } }, origin);
  await mounted.idle();
  expect(JSON.parse(readFileSync(file, "utf8")).text).toBe("summoned again");
  await store.tombstone(SUMMONS, origin);
  await mounted.idle();
  expect(existsSync(file)).toBe(false);
  mounted.stop();
});

test("the toggle: ON when absent, off mints no observe render", () => {
  expect(observeDaemonEnabled({})).toBe(true);
  expect(observeDaemonEnabled({ projection: {} })).toBe(true);
  expect(observeDaemonEnabled({ projection: { observeDaemon: false } })).toBe(false);
  expect(() => observeDaemonEnabled({ projection: { observeDaemon: "no" } })).toThrow(/boolean/);
  const off = daemonDiskMirrors({ projectionRoot: "/p", canonBags: "/absent", faceRelation: null });
  expect(off.some((m) => m.bagId === DAEMON_BAG_ID && m.mirrorClass === "observe")).toBe(false);
});

test("a swarm control lands under observe/daemon/swarm, redacted the same way", async () => {
  const { store, observe, mounted } = await rig();
  const control = "$:/lares/swarm/lanes/one-root";
  await store.put({ tiddler: { title: control, text: "go", "session-token": "t-9" } }, origin);
  await mounted.idle();
  const file = join(observe, "swarm", "lanes", "one-root.json");
  expect(observeFileOf(observe, control)).toBe(file);
  const row = JSON.parse(readFileSync(file, "utf8")) as Record<string, string>;
  expect(row["text"]).toBe("go");
  expect(row["session-token"]).toBe(REDACTED);
  expect(observeFileOf(observe, "$:/lares/swarm/../escape")).toBeNull();
  mounted.stop();
});

test("the observe plane names its subtree for the ingest refusal", () => {
  expect(isObserveProjectionPath("/house/projections", "/house/projections/observe/daemon/summons/s-1.json")).toBe(true);
  expect(isObserveProjectionPath("/house/projections", "/house/projections/wikis/notes/x.mem")).toBe(false);
});
