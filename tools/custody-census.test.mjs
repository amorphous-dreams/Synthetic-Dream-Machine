// custody-census — the census reader names each breach of the carrier table's law, and the route door acts on a
// marked scratch root alone.
//
//   C1  a clean reading names nothing.                          control for every case below
//   C2  a hot or cold row that reads anything but sealed reads `unsealed`.
//   C3  a row outside the vessel key with no law reads `no law`; so does a hot row that claims one.
//   C4  an unsealed row with no fault mark reads `fault misread`; a faulted file outside the vessel key reads `fault`.
//   C5  each file outside the table reads `outside`, with its reason.
//   C6  a root that holds no vessel answers a reading all the same: no tree, no row, nothing outside.
//   D1  the route door refuses an unmarked root (rc 2) before it reads a tree, for a bind and for an unbind.
//   D2  the route door refuses a call that names both acts, or neither (rc 2).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { custodyBreaches, custodyReading } from "./custody-census.mjs";

const repo = fileURLToPath(new URL("../", import.meta.url));
const door = join(repo, "tools/unbind-test-custody.mjs");

const LAW = "the floor reads it before any key opens";
const row = (over) => ({ row: "custody-root", home: "identity", file: "custody-root.bin", custody: "hot", reading: "sealed", bare: null, fault: false, ...over });
const clean = () => ({
  rows: [row({}), row({ row: "vessel-key", file: ".vessel-key.json", custody: "floor", reading: "bare", bare: LAW })],
  outside: [],
});

test("C1 — a clean reading names nothing", () => {
  assert.deepEqual(custodyBreaches(clean()), []);
});

test("C2 — a hot or cold row that reads anything but sealed reads unsealed", () => {
  for (const reading of ["bare", "torn", "old-shape", "unopenable"]) {
    for (const custody of ["hot", "cold"]) {
      const c = clean();
      c.rows[0] = row({ custody, reading, fault: true });
      assert.deepEqual(custodyBreaches(c), [`unsealed: identity/custody-root.bin (${custody}) reads ${reading}`]);
    }
  }
});

test("C3 — a row outside the vessel key names its law, and a row under it names none", () => {
  const c = clean();
  c.rows[1] = { ...c.rows[1], bare: null };
  assert.deepEqual(custodyBreaches(c), ["no law: identity/.vessel-key.json (floor) rests outside the vessel key and names no law"]);
  const d = clean();
  d.rows[0] = row({ bare: LAW });
  assert.deepEqual(custodyBreaches(d), ["no law: identity/custody-root.bin (hot) names a law for resting bare"]);
});

test("C4 — a fault mark that disagrees with its row reads as misread", () => {
  const c = clean();
  c.rows[0] = row({ reading: "bare", fault: false });
  assert.deepEqual(custodyBreaches(c), ["unsealed: identity/custody-root.bin (hot) reads bare", "fault misread: identity/custody-root.bin (hot, bare) reads fault=false"]);
  const d = clean();
  d.rows[1] = { ...d.rows[1], fault: true };
  assert.deepEqual(custodyBreaches(d), ["fault: identity/.vessel-key.json (floor) reads bare and breaks its row's law"]);
});

test("C5 — each file outside the table reads outside, with its reason", () => {
  const c = clean();
  c.outside = [
    { home: "identity", file: "side-key.json", why: "owner-only" },
    { home: "storage", file: "stray.bin", why: "vk-seal" },
    { home: "seal", file: "transitions.json.vk-sealing", why: "sidecar" },
  ];
  assert.deepEqual(custodyBreaches(c), [
    "outside: identity/side-key.json (owner-only)",
    "outside: storage/stray.bin (vk-seal)",
    "outside: seal/transitions.json.vk-sealing (sidecar)",
  ]);
});

test("C6 — a root that holds no vessel still answers a reading: no tree, no row, nothing outside", () => {
  const bare = mkdtempSync(join(tmpdir(), "lares-custody-census-bare-"));
  try {
    const custody = custodyReading(bare);
    assert.equal(custody.tree.reading, "absent");
    assert.deepEqual({ rows: custody.rows, outside: custody.outside }, { rows: [], outside: [] });
  } finally { rmSync(bare, { recursive: true, force: true }); }
});

test("D1 — the route door refuses an unmarked root before it reads a tree", () => {
  const bare = mkdtempSync(join(tmpdir(), "lares-unbind-door-bare-"));
  try {
    for (const args of [["--bind"], ["--unbind", "abc"], ["--unbind", "abc", "--rotate"]]) {
      const r = spawnSync(process.execPath, [door, bare, ...args], { encoding: "utf8" });
      assert.equal(r.status, 2, `${args.join(" ")}: ${r.stdout}${r.stderr}`);
      assert.match(r.stderr, /TestDoorRefusal/);
    }
    assert.deepEqual(readdirSync(bare), [], "a refused door writes nothing under the root");
    assert.equal(existsSync(join(bare, "data")), false);
  } finally { rmSync(bare, { recursive: true, force: true }); }
});

test("D2 — the route door refuses a call that names both acts, or neither", () => {
  const bare = mkdtempSync(join(tmpdir(), "lares-unbind-door-usage-"));
  try {
    for (const args of [[], ["--bind", "--unbind", "abc"], ["--unbind"], ["--unbind", "--rotate"]]) {
      const r = spawnSync(process.execPath, [door, bare, ...args], { encoding: "utf8" });
      assert.equal(r.status, 2, `${args.join(" ")}: ${r.stdout}${r.stderr}`);
      assert.match(r.stderr, /usage:/);
    }
  } finally { rmSync(bare, { recursive: true, force: true }); }
});
