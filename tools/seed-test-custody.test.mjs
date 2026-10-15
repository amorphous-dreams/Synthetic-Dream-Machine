// The custody test door acts only on a root a harness STAGED: the scratch marker is the one proof, and nothing the
// caller asserts from its environment (TMPDIR, LAR_STAGE_DIR, a `.mesh-test` path) stands in for it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MARKER_NAME } from "./test-scratch-marker.mjs";

const DOOR = new URL("./seed-test-custody.mjs", import.meta.url).pathname;
const STAGER = new URL("./test-scratch-marker.mjs", import.meta.url).pathname;
const run = (script, root, env = {}) => spawnSync(process.execPath, [script, root], { encoding: "utf8", env: { ...process.env, ...env } });
const fresh = () => mkdtempSync(join(tmpdir(), "seed-door-"));

test("CONTROL: a staged root passes the door and founds custody", () => {
  const root = fresh();
  try {
    assert.equal(run(STAGER, root).status, 0);
    assert.ok(existsSync(join(root, MARKER_NAME)));
    const r = run(DOOR, root);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(run(DOOR, root).status, 0, "a standing tree is left alone");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("MUTATION: a root without the marker refuses by name and creates nothing, whatever the environment declares", () => {
  const root = fresh();
  try {
    // The caller declares the root scratch three ways at once; none of them counts.
    const r = run(DOOR, root, { TMPDIR: tmpdir(), LAR_STAGE_DIR: root });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /TestDoorRefusal/);
    assert.deepEqual(readdirSync(root), [], "a refusal writes nothing");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a root named by a .mesh-test path segment still refuses without the marker", () => {
  const base = fresh();
  const root = join(base, ".mesh-test", "x");
  try {
    const r = run(DOOR, root);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /TestDoorRefusal/);
    assert.equal(existsSync(root), false);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test("the stager refuses to mark a root that already holds a custody tree", () => {
  const root = fresh();
  try {
    assert.equal(run(STAGER, root).status, 0);
    assert.equal(run(DOOR, root).status, 0);
    rmSync(join(root, MARKER_NAME));
    const r = run(STAGER, root);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /custody tree already stands/);
    assert.equal(existsSync(join(root, MARKER_NAME)), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("no argument refuses with usage", () => {
  assert.equal(spawnSync(process.execPath, [DOOR], { encoding: "utf8" }).status, 2);
});

// A root that holds identity carriers and no tree belongs to a vessel, never to a harness. The shape: a founded
// custody whose slot tree went missing, so the sealed custody root stands with nothing committing to it.
const orphanCarrierRoot = () => {
  const root = fresh();
  assert.equal(run(STAGER, root).status, 0);
  assert.equal(run(DOOR, root).status, 0);
  rmSync(join(root, "data", "lares", "identity", "vk-slots.bin"));
  return root;
};

test("CONTROL: an empty root stages", () => {
  const root = fresh();
  try { assert.equal(run(STAGER, root).status, 0); } finally { rmSync(root, { recursive: true, force: true }); }
});

test("the stager refuses a root that holds identity carriers and no tree", () => {
  const root = orphanCarrierRoot();
  try {
    rmSync(join(root, MARKER_NAME));
    const r = run(STAGER, root);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /identity carriers already stand/);
    assert.equal(existsSync(join(root, MARKER_NAME)), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("the door names OldShapeRefusal on one line over a marked root with carriers and no tree, and writes nothing", () => {
  const root = orphanCarrierRoot();
  const identity = join(root, "data", "lares", "identity");
  try {
    const before = readdirSync(identity).sort();
    const r = run(DOOR, root);
    assert.equal(r.status, 2, r.stderr);
    assert.match(r.stderr, /^OldShapeRefusal: /);
    assert.equal(r.stderr.trim().split("\n").length, 1, r.stderr);
    assert.deepEqual(readdirSync(identity).sort(), before);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
