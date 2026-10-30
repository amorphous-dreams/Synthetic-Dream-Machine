/**
 * L4 · An act writes its radius alone, and an observing verb writes nothing.
 *
 * Every observing verb the live tables declare (`TUNNEL_VERBS` read and verify, over `repoItems` and
 * `homeItems`; the vessel door's `read`) leaves every file tree it can reach unchanged: paths, bytes,
 * modes and link targets, snapshotted before and after. `tend` on the repo radius writes the checkout
 * alone and on the home radius writes the homes alone (the ledger beside them). Workspace imports
 * resolve to this checkout. Every root stands a mkdtemp dir; nothing touches the real home or the tree.
 *
 * Law: lar:///ha.ka.ba/lares/docs/pono/cli-test-laws#/the-laws
 */
import { afterEach, beforeEach, describe, expect, test as plain } from "vitest";
import { execFileSync } from "node:child_process";
import {
  lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, rmSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { Ledger, read, tend, type Item } from "../../src/reality-tunnel/engine.js";
import { CARRIER, declared, homeItems, repoItems } from "../../src/reality-tunnel/catalog.js";
import { loadLogPath, readLoads, verifyLoads } from "../../src/reality-tunnel/verify.js";
import { VESSEL_SUBS } from "../../src/commands/vessel.js";
import { TUNNEL_VERBS } from "../../src/commands/tunnel-door.js";
import { door } from "./harness.js";

const REPO = join(import.meta.dirname, "..", "..", "..", "..");
const MCP = { command: "/usr/bin/python3", args: ["/clone/lares_mcp.py"], env: { PYTHONPATH: "/clone/mp" } };

// The load log and the home ledger resolve under XDG_STATE_HOME first, so it points into the sandbox:
// an observer reads only the world the law built, and a write anywhere it can reach shows in the snapshot.
let sandbox: string;
let priorState: string | undefined;
beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), "law-l4-"));
  priorState = process.env["XDG_STATE_HOME"];
  process.env["XDG_STATE_HOME"] = join(sandbox, "state");
});
afterEach(() => {
  if (priorState === undefined) delete process.env["XDG_STATE_HOME"]; else process.env["XDG_STATE_HOME"] = priorState;
  rmSync(sandbox, { recursive: true, force: true });
});

/** Every entry under a tree as `path -> kind, mode, bytes or link target`: a change anywhere shows. */
function snapshot(root: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (p: string): void => {
    const st = lstatSync(p);
    const rel = relative(root, p) || ".";
    if (st.isSymbolicLink()) out.set(rel, `link ${readlinkSync(p)}`);
    else if (st.isDirectory()) {
      out.set(rel, `dir ${(st.mode & 0o777).toString(8)}`);
      for (const n of readdirSync(p).sort()) { if (n !== ".git") walk(join(p, n)); }
    } else out.set(rel, `file ${(st.mode & 0o777).toString(8)} ${readFileSync(p).toString("base64")}`);
  };
  walk(root);
  return out;
}

/** The paths whose entry differs, appears or vanishes between two snapshots. */
function changed(a: Map<string, string>, b: Map<string, string>): string[] {
  const keys = new Set([...a.keys(), ...b.keys()]);
  return [...keys].filter((k) => a.get(k) !== b.get(k)).sort();
}

/** A git clone carrying the carrier, the seed and the hook scripts the home items aim at. */
function clone(): string {
  const root = mkdtempSync(join(sandbox, "clone-"));
  for (const rel of [CARRIER, declared(REPO).seed]) {
    mkdirSync(join(root, dirname(rel)), { recursive: true });
    writeFileSync(join(root, rel), readFileSync(join(REPO, rel), "utf8"));
  }
  for (const s of declared(REPO).home) {
    const script = s["script"] ?? s["target"];
    if (typeof script === "string") { mkdirSync(join(root, dirname(script)), { recursive: true }); writeFileSync(join(root, script), "#\n"); }
  }
  execFileSync("git", ["init", "-q", root]);
  return root;
}

function homes(): { native: string; windows: string } {
  const native = mkdtempSync(join(sandbox, "home-"));
  const windows = mkdtempSync(join(sandbox, "win-"));
  for (const d of [".claude", ".codex", ".copilot", ".local/bin"]) mkdirSync(join(native, d), { recursive: true });
  mkdirSync(join(windows, ".claude"));
  return { native, windows };
}

interface World { repo: string; h: { native: string; windows: string }; ledgerDir: string; items: Item[] }

/** The scenes an observer must leave alone: bare, tended, drifted after a hand edit, foreign bytes in place. */
const SCENES: Array<[string, (w: World) => Promise<void>]> = [
  ["bare", async () => {}],
  ["tended", async (w) => { await tend(w.items, new Ledger(w.ledgerDir)); }],
  ["drifted", async (w) => {
    await tend(w.items, new Ledger(w.ledgerDir));
    writeFileSync(join(w.h.native, ".claude/settings.json"), '{"cleanupPeriodDays": 1, "mine": true}\n');
    writeFileSync(join(w.repo, "CLAUDE.md"), "my own file\n");
  }],
  ["foreign", async (w) => {
    writeFileSync(join(w.h.native, ".claude/settings.json"), "{not json");
    writeFileSync(join(w.h.native, ".codex/config.toml"), "[[[");
    writeFileSync(join(w.repo, ".claude/agents-foreign"), "x");
  }],
];

async function world(scene: (w: World) => Promise<void>): Promise<World> {
  const repo = clone();
  const h = homes();
  mkdirSync(join(repo, ".claude"), { recursive: true });
  const w: World = { repo, h, ledgerDir: mkdtempSync(join(sandbox, "ledger-")), items: [] };
  w.items = [...repoItems(repo), ...homeItems({ repo, homes: h, mcp: MCP, claudeCli: false })];
  await scene(w);
  return w;
}

/** The observing verbs the live tables declare, each run against a world and nothing else. */
const OBSERVERS: Array<[string, (w: World) => unknown]> = [
  ...TUNNEL_VERBS.filter((v) => v === "read").map((v): [string, (w: World) => unknown] => [
    `repo ${v}`, (w) => read(repoItems(w.repo), new Ledger(w.ledgerDir)),
  ]),
  ...TUNNEL_VERBS.filter((v) => v === "read").map((v): [string, (w: World) => unknown] => [
    `home ${v}`, (w) => read(homeItems({ repo: w.repo, homes: w.h, mcp: MCP, claudeCli: false }), new Ledger(w.ledgerDir)),
  ]),
  ...TUNNEL_VERBS.filter((v) => v === "verify").flatMap((v): Array<[string, (w: World) => unknown]> => [
    [`repo ${v}`, (w) => verifyLoads({ door: "repo", repo: w.repo, home: w.h.native, probe: false })],
    [`home ${v}`, (w) => verifyLoads({ door: "home", repo: w.repo, home: w.h.native, probe: false })],
  ]),
];

describe("L4 · an observing verb leaves every tree it can reach unchanged", () => {
  for (const [name, run] of OBSERVERS) {
    for (const [scene, make] of SCENES) {
      plain(`${name} over a ${scene} world`, async () => {
        const w = await world(make);
        const before = snapshot(sandbox);
        run(w);
        run(w);
        expect(changed(before, snapshot(sandbox))).toEqual([]);
      });
    }
  }

  plain("CONTROL: verify reads the load log under the sandbox's state, never the operator's", async () => {
    const w = await world(async () => {});
    const log = loadLogPath(w.h.native);
    expect(log.startsWith(sandbox)).toBe(true);
    mkdirSync(dirname(log), { recursive: true });
    writeFileSync(log, `${JSON.stringify({ session_id: "s", file_path: join(w.repo, "AGENTS.md"), load_reason: "session_start", cwd: w.repo })}\n`);
    expect(readLoads(w.h.native)).toHaveLength(1);
  });

  plain("the table names the observers this law runs: read and verify each cover both radii", () => {
    expect(OBSERVERS.map(([n]) => n).sort()).toEqual(["home read", "home verify", "repo read", "repo verify"]);
    expect(TUNNEL_VERBS).toEqual(expect.arrayContaining(["read", "verify"]));
  });

  plain("the vessel door's read leaves its store and its LAR_ROOT unchanged", async () => {
    expect(VESSEL_SUBS).toContain("read");
    const root = mkdtempSync(join(sandbox, "lar-root-"));
    const store = join(root, "data", "lares", "vessel");
    mkdirSync(store, { recursive: true });
    writeFileSync(join(store, "marker.txt"), "kept");
    const prior = process.env["LAR_ROOT"];
    process.env["LAR_ROOT"] = root;
    try {
      const before = snapshot(root);
      const r = await door(["vessel", "read", "--root", root, "--json", "--skip-build"]);
      expect(r.code).toBe(0);
      expect(changed(before, snapshot(root))).toEqual([]);
    } finally {
      if (prior === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = prior;
    }
  });

  plain("CONTROL: a verb that writes reads red against the snapshot", async () => {
    const w = await world(async () => {});
    const before = snapshot(sandbox);
    await tend(repoItems(w.repo), new Ledger(w.ledgerDir));
    expect(changed(before, snapshot(sandbox)).length).toBeGreaterThan(0);
    writeFileSync(join(w.h.native, ".claude", "touched"), "x");
    expect(changed(before, snapshot(sandbox))).toContain(join(relative(sandbox, w.h.native), ".claude", "touched"));
  });

  plain("CONTROL: the snapshot sees a mode change and a byte change alone", () => {
    const f = join(sandbox, "f");
    writeFileSync(f, "a", { mode: 0o644 });
    const a = snapshot(sandbox);
    writeFileSync(f, "b", { mode: 0o644 });
    expect(changed(a, snapshot(sandbox))).toEqual(["f"]);
    const b = snapshot(sandbox);
    execFileSync("chmod", ["600", f]);
    expect(changed(b, snapshot(sandbox))).toEqual(["f"]);
  });
});

describe("L4 · tend writes its radius alone", () => {
  plain("the repo radius writes the checkout and its ledger; no home and no sibling clone moves", async () => {
    const w = await world(async () => {});
    const sibling = clone();
    const before = snapshot(sandbox);
    const r = await tend(repoItems(w.repo), new Ledger(w.ledgerDir));
    expect(r.wrote.length).toBeGreaterThan(0);
    const rels = changed(before, snapshot(sandbox));
    const allowed = [relative(sandbox, w.repo), relative(sandbox, w.ledgerDir)];
    expect(rels.filter((p) => !allowed.some((a) => p === a || p.startsWith(`${a}/`)))).toEqual([]);
    expect(rels.some((p) => p.startsWith(`${relative(sandbox, w.repo)}/`))).toBe(true);
    expect(rels.filter((p) => p.startsWith(relative(sandbox, sibling)))).toEqual([]);
  });

  plain("the home radius writes the homes and its ledger; the checkout stays as it stood", async () => {
    const w = await world(async () => {});
    const before = snapshot(sandbox);
    const r = await tend(homeItems({ repo: w.repo, homes: w.h, mcp: MCP, claudeCli: false }), new Ledger(w.ledgerDir));
    expect(r.wrote.length).toBeGreaterThan(0);
    const rels = changed(before, snapshot(sandbox));
    const allowed = [w.h.native, w.h.windows, w.ledgerDir].map((p) => relative(sandbox, p));
    expect(rels.filter((p) => !allowed.some((a) => p === a || p.startsWith(`${a}/`)))).toEqual([]);
    expect(rels.filter((p) => p.startsWith(relative(sandbox, w.repo)))).toEqual([]);
  });

  plain("every item a radius declares aims inside that radius's root", async () => {
    const w = await world(async () => {});
    for (const it of repoItems(w.repo)) expect(it.path.startsWith(`${w.repo}/`)).toBe(true);
    for (const it of homeItems({ repo: w.repo, homes: w.h, mcp: MCP, claudeCli: false })) {
      expect([w.h.native, w.h.windows].some((h) => it.path.startsWith(`${h}/`))).toBe(true);
    }
  });

  plain("CONTROL: an item aimed outside its root reads as an escape", async () => {
    const w = await world(async () => {});
    const outside = join(sandbox, "outside.txt");
    const escape: Item = { id: "x", radius: "repo", host: "t", path: outside, what: "x", transform: () => "x\n" };
    const before = snapshot(sandbox);
    await tend([escape], new Ledger(w.ledgerDir));
    const rels = changed(before, snapshot(sandbox));
    expect(rels).toContain("outside.txt");
    expect(rels.filter((p) => !(p === relative(sandbox, w.ledgerDir) || p.startsWith(`${relative(sandbox, w.ledgerDir)}/`)))).toEqual(["outside.txt"]);
  });
});

describe("L4 · workspace imports resolve to this checkout", () => {
  plain("the mesh package import returns this worktree's source export", async () => {
    const own = await import("../../../lararium-mesh/src/promotion-approval.js");
    const { openPromotionApproval } = await import("@lararium/mesh");
    expect(typeof own.openPromotionApproval).toBe("function");
    expect(openPromotionApproval).toBe(own.openPromotionApproval);
  });
});
