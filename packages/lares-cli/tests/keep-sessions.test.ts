/**
 * keep-sessions — the device's Claude Code sessions as the keep mirrors them under `devices/<name>-<id8>/`: the port of the
 * operator's claude-backup `bin/sync`, read against that script's own mirror half (`fixtures/claude-backup-sync-mirror.sh`,
 * copied line for line).
 *
 *   KS1  the device id: a UUIDv5 over the machine-id (the URL namespace, `claude-backup:<seed>`), minted once into
 *        `<config>/claude-backup/device.json` in the bytes python's `json.dump(indent=2)` writes, and read back after;
 *   KS2  a device dir whose DEVICE.json names another uuid refuses, and nothing writes there;
 *   KS3  the sanitize: account identity and every `cached*` key leave, each MCP server's env and headers read `<redacted>`,
 *        and the bytes match python's `json.dump(indent=2, sort_keys=True)` (ASCII escapes, floats, whole numbers);
 *   KS4  THE MIRROR, against a written expectation: the allow-list lands, and nothing outside it does;
 *   KS5  PARITY: the same scratch home through the script's mirror half and through the keep's mirror reads byte-equal, tree
 *        for tree, over a first run and over a second one after the home moved (a file changed, one removed, a job's state
 *        gone, a transcript grown).
 *
 * Every source stands under a scratch directory; no test reads a real home.
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, rmSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { hostname, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  SessionsRefused, mirrorSessions, readOrMintDevice, sanitizeClaudeJson, sessionSources, uuid5Url, type SessionSources,
} from "../src/keep-sessions.js";

let scratch: string;
beforeEach(() => { scratch = mkdtempSync(join(tmpdir(), "lar-keep-sessions-")); });
afterEach(() => { rmSync(scratch, { recursive: true, force: true }); });

const HOUR = 3600;
/** One file under `root`, its bytes, an optional mode, and a modification time `ageSec` seconds back (an hour where unnamed). */
function put(root: string, rel: string, text: string, opts: { mode?: number; ageSec?: number } = {}): void {
  const abs = join(root, ...rel.split("/"));
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, text);
  if (opts.mode !== undefined) chmodSync(abs, opts.mode);
  const at = Date.now() / 1000 - (opts.ageSec ?? HOUR);
  utimesSync(abs, at, at);
}

const CLAUDE_JSON = `{
  "userID": "u-123",
  "oauthAccount": {"emailAddress": "someone@example.invalid"},
  "cachedGrowthBookFeatures": {"x": true},
  "cachedChangelog": "…",
  "rcLongTurnNudgeSeenKey": "k1",
  "remoteControlReadyPushKey": "k2",
  "numStartups": 42,
  "ratio": 1.0,
  "tiny": 2.5e-5,
  "big": 123456789012345678901234567890,
  "theme": "caf\u00e9 \ud83d\ude00",
  "empty": {},
  "list": [],
  "mcpServers": {
    "lares": {"type": "stdio", "command": "python3", "args": ["x.py"], "env": {"LAR_ROOT": "/lar", "TOKEN": "t0p"}},
    "web": {"type": "http", "url": "https://example.invalid", "headers": {"Authorization": "Bearer abc"}}
  },
  "projects": {
    "/home/me/proj": {"allowedTools": [], "mcpServers": {"p": {"command": "x", "env": {"K": "v"}}}},
    "/home/me/bare": {"hasTrustDialogAccepted": true}
  }
}
`;
const CLAUDE_JSON_SANITIZED = `{
  "big": 123456789012345678901234567890,
  "empty": {},
  "list": [],
  "mcpServers": {
    "lares": {
      "args": [
        "x.py"
      ],
      "command": "python3",
      "env": {
        "LAR_ROOT": "<redacted>",
        "TOKEN": "<redacted>"
      },
      "type": "stdio"
    },
    "web": {
      "headers": {
        "Authorization": "<redacted>"
      },
      "type": "http",
      "url": "https://example.invalid"
    }
  },
  "numStartups": 42,
  "projects": {
    "/home/me/bare": {
      "hasTrustDialogAccepted": true
    },
    "/home/me/proj": {
      "allowedTools": [],
      "mcpServers": {
        "p": {
          "command": "x",
          "env": {
            "K": "<redacted>"
          }
        }
      }
    }
  },
  "ratio": 1.0,
  "theme": "caf\\u00e9 \\ud83d\\ude00",
  "tiny": 2.5e-05
}`;

/** A scratch home: a `~/.claude` holding what the mirror takes beside what it never takes, a `~/.claude.json`, a machine-id. */
function fakeHome(): { home: string; claude: string; env: Record<string, string> } {
  const home = join(scratch, "home"), claude = join(home, ".claude");
  // config: the allow-list
  put(claude, "CLAUDE.md", "# the operator's rule\n");
  put(claude, "settings.json", '{"cleanupPeriodDays": 99999}\n');
  put(claude, "settings.local.json", '{"local": true}\n');
  put(claude, "settings.json.bak", '{"old": 1}\n');
  put(claude, "settings.json.bak.2", '{"old": 2}\n');
  put(claude, "rules/a.md", "rule a\n");
  put(claude, "rules/sub/b.md", "rule b\n");
  put(claude, "skills/x/SKILL.md", "---\nname: x\n---\n");
  put(claude, "skills/x/run.sh", "#!/bin/sh\necho x\n", { mode: 0o755 });
  symlinkSync("x/SKILL.md", join(claude, "skills", "link.md"));
  mkdirSync(join(claude, "skills", "hollow"));
  put(claude, "plans/p.md", "a plan\n");
  put(claude, "agents/scout.md", "an agent\n");
  put(claude, "plugins/installed_plugins.json", '{"plugins": {}}\n');
  put(claude, "plugins/known_marketplaces.json", '{"m": {}}\n');
  put(claude, "plugins/data/lares/state.json", '{"n": 1}\n');
  // state
  put(claude, "history.jsonl", '{"display": "hello"}\n');
  put(claude, "stats-cache.json", '{"s": 1}\n');
  put(claude, "tasks/t1/1.json", '{"task": 1}\n');
  put(claude, "feedback/draft.md", "a draft\n");
  put(claude, "state/s.json", '{"state": 1}\n');
  put(claude, "jobs/j1/state.json", '{"job": 1}\n');
  put(claude, "jobs/j1/tmp/scratch.bin", "scratch\n");
  put(claude, "jobs/j2/other.txt", "no state here\n");
  put(claude, "jobs/j3/deep/state.json", '{"job": 3}\n');
  // never taken
  put(claude, ".credentials.json", '{"claudeAiOauth": "never"}\n');
  put(claude, "plugins/config.json", "outside the two named files\n");
  put(claude, "plugins/cache/big.bin", "a plugin cache\n");
  for (const rel of ["session-env/e", "paste-cache/p", "shell-snapshots/s", "file-history/f", "cache/c", "telemetry/t", "sessions/a.key", "daemon/d", "backups/.claude.json.backup", "todos/x.json", "notes.txt"]) put(claude, rel, "never\n");
  // projects: memory as plain files, transcripts once idle
  put(claude, "projects/-home-me-proj/memory/MEMORY.md", "# Memory Index\n");
  put(claude, "projects/-home-me-proj/memory/sub/note.md", "a note\n");
  put(claude, "projects/-home-me-proj/aaaa.jsonl", `${'{"type":"user","text":"an idle transcript"}\n'.repeat(40)}`);
  put(claude, "projects/-home-me-proj/aaaa/subagents/agent-1.jsonl", '{"type":"assistant"}\n');
  put(claude, "projects/-home-me-proj/live.jsonl", '{"type":"user","text":"mid-write"}\n', { ageSec: 5 });
  put(claude, "projects/-home-me-proj/aaaa/tool-results/out.txt", "not a transcript\n");
  put(claude, "projects/-other/bbbb.jsonl", '{"type":"user"}\n');
  put(claude, "projects/.hidden/memory/x.md", "a dotted project the glob never reads\n");
  put(home, ".claude.json", CLAUDE_JSON);
  put(scratch, "machine-id", "0123456789abcdef0123456789abcdef\n");
  return { home, claude, env: { HOME: home, LARES_MACHINE_ID_FILE: join(scratch, "machine-id") } };
}

/** Every entry under `root`, by relative path: a file's bytes and exec bit, a link's target, a directory's own name. */
function tree(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (dir: string, rel: string): void => {
    for (const name of readdirSync(dir).sort()) {
      const abs = join(dir, name), at = rel === "" ? name : `${rel}/${name}`, st = lstatSync(abs);
      if (st.isSymbolicLink()) out[at] = `link -> ${readlinkSync(abs)}`;
      else if (st.isDirectory()) { out[`${at}/`] = "dir"; walk(abs, at); }
      else out[at] = `file ${(st.mode & 0o111) !== 0 ? "x" : "-"} ${readFileSync(abs).toString("base64")}`;
    }
  };
  walk(root, "");
  return out;
}

const sources = (env: Record<string, string>): SessionSources => sessionSources(env);

describe("the keep's session mirror", () => {
  test("KS1 RED: the device id reads a UUIDv5 over the machine-id, mints once in python's own bytes, and reads back after", () => {
    expect(uuid5Url("claude-backup:0123456789abcdef0123456789abcdef")).toBe("f92e1983-3c4e-5d99-b8ec-c4919a4cc287");
    const { env } = fakeHome();
    const src: SessionSources = { ...sources(env), hostname: () => "Hale-Box", osName: () => "Linux 6.1.0" };
    expect(src.deviceFile).toBe(join(env["HOME"]!, ".config", "claude-backup", "device.json"));
    expect(sources({ ...env, XDG_CONFIG_HOME: join(scratch, "xdg") }).deviceFile).toBe(join(scratch, "xdg", "claude-backup", "device.json"));
    const dev = readOrMintDevice(src);
    expect(dev).toMatchObject({ uuid: "f92e1983-3c4e-5d99-b8ec-c4919a4cc287", name: "hale-box", dir: "hale-box-f92e1983" });
    expect(readFileSync(src.deviceFile, "utf8")).toBe('{\n  "uuid": "f92e1983-3c4e-5d99-b8ec-c4919a4cc287",\n  "name": "hale-box",\n  "hostname": "Hale-Box",\n  "os": "Linux 6.1.0"\n}');
    // A second read mints nothing: another hostname, another machine-id, and the kept identity still answers.
    writeFileSync(env["LARES_MACHINE_ID_FILE"]!, "ffffffffffffffffffffffffffffffff\n");
    expect(readOrMintDevice({ ...src, hostname: () => "renamed" }).dir).toBe("hale-box-f92e1983");
    // No machine-id: a random identity, still a uuid.
    const bare: SessionSources = { ...sources({ HOME: join(scratch, "bare-home"), LARES_MACHINE_ID_FILE: join(scratch, "absent") }), randomUuid: () => "11111111-2222-4333-8444-555555555555" };
    expect(readOrMintDevice(bare).uuid).toBe(uuid5Url("claude-backup:11111111-2222-4333-8444-555555555555"));
    // A kept identity whose name could step outside `devices/` refuses.
    const bent = sources({ HOME: join(scratch, "bent-home") });
    mkdirSync(dirname(bent.deviceFile), { recursive: true });
    writeFileSync(bent.deviceFile, '{"uuid": "f92e1983-3c4e-5d99-b8ec-c4919a4cc287", "name": "../elsewhere"}');
    expect(() => readOrMintDevice(bent)).toThrow(SessionsRefused);
  });

  test("KS2 RED: a device dir whose DEVICE.json names another uuid refuses, and nothing writes there", () => {
    const { env } = fakeHome();
    const src = sources(env), dev = readOrMintDevice(src), ws = join(scratch, "ws");
    put(ws, `devices/${dev.dir}/DEVICE.json`, '{"uuid": "00000000-0000-5000-8000-000000000000", "name": "another"}');
    const before = tree(ws);
    let refusal: unknown = null;
    try { mirrorSessions(src, ws, dev); } catch (e) { refusal = e; }
    expect(refusal).toBeInstanceOf(SessionsRefused);
    expect((refusal as SessionsRefused).code).toBe("keep-device-foreign");
    expect(tree(ws)).toEqual(before);
    // CONTROL: the same uuid passes.
    writeFileSync(join(ws, "devices", dev.dir, "DEVICE.json"), readFileSync(src.deviceFile));
    expect(mirrorSessions(src, ws, dev).rel).toBe(`devices/${dev.dir}`);
  });

  test("KS3 RED: the sanitize drops account identity and every cached key, redacts each MCP env and header, in python's bytes", () => {
    const out = sanitizeClaudeJson(CLAUDE_JSON);
    expect(out).toBe(CLAUDE_JSON_SANITIZED);
    for (const gone of ["oauthAccount", "userID", "u-123", "someone@example.invalid", "cached", "rcLongTurnNudgeSeenKey", "remoteControlReadyPushKey", "t0p", "Bearer abc", '"v"', "/lar"]) expect(out, gone).not.toContain(gone);
    // python's number and string bytes: floats keep a point, an exponent takes two digits, a whole number keeps every digit.
    expect(sanitizeClaudeJson('{"z": 1.0, "a": "caf\\u00e9 \\ud83d\\ude00 \\u007f", "n": [1e-7, 1.5e16, 123456789012345678901234567890, -0, 0.1, 1E2, 2.5e-5, 1e22, 12345.678], "e": {}, "l": []}'))
      .toBe('{\n  "a": "caf\\u00e9 \\ud83d\\ude00 \\u007f",\n  "e": {},\n  "l": [],\n  "n": [\n    1e-07,\n    1.5e+16,\n    123456789012345678901234567890,\n    0,\n    0.1,\n    100.0,\n    2.5e-05,\n    1e+22,\n    12345.678\n  ],\n  "z": 1.0\n}');
    expect(() => sanitizeClaudeJson("{ not json")).toThrow(SessionsRefused);
    expect(() => sanitizeClaudeJson("[1, 2]")).toThrow(SessionsRefused);
  });

  test("KS4 RED: the mirror lands the allow-list under devices/<name>-<id8>/, and nothing outside it", () => {
    const { env, claude } = fakeHome();
    const src = sources(env), dev = readOrMintDevice(src), ws = join(scratch, "ws");
    const out = mirrorSessions(src, ws, dev);
    const dest = join(ws, "devices", dev.dir);
    expect(out).toMatchObject({ device: dev.dir, rel: `devices/${dev.dir}`, unpacked: [] });
    expect(Object.keys(tree(dest)).sort()).toEqual([
      "DEVICE.json",
      "config/", "config/CLAUDE.md", "config/agents/", "config/agents/scout.md", "config/claude.json",
      "config/plans/", "config/plans/p.md",
      "config/plugins/", "config/plugins/data/", "config/plugins/data/lares/", "config/plugins/data/lares/state.json",
      "config/plugins/installed_plugins.json", "config/plugins/known_marketplaces.json",
      "config/rules/", "config/rules/a.md", "config/rules/sub/", "config/rules/sub/b.md",
      "config/settings.json", "config/settings.json.bak", "config/settings.json.bak.2", "config/settings.local.json",
      "config/skills/", "config/skills/hollow/", "config/skills/link.md", "config/skills/x/", "config/skills/x/SKILL.md", "config/skills/x/run.sh",
      "projects/", "projects/-home-me-proj/", "projects/-home-me-proj/memory/", "projects/-home-me-proj/memory/MEMORY.md",
      "projects/-home-me-proj/memory/sub/", "projects/-home-me-proj/memory/sub/note.md",
      "projects/-home-me-proj/sessions/", "projects/-home-me-proj/sessions/aaaa.jsonl.zst",
      "projects/-home-me-proj/sessions/aaaa/", "projects/-home-me-proj/sessions/aaaa/subagents/", "projects/-home-me-proj/sessions/aaaa/subagents/agent-1.jsonl.zst",
      "projects/-other/", "projects/-other/sessions/", "projects/-other/sessions/bbbb.jsonl.zst",
      "state/", "state/feedback/", "state/feedback/draft.md", "state/history.jsonl",
      "state/jobs/", "state/jobs/j1/", "state/jobs/j1/state.json", "state/jobs/j3/", "state/jobs/j3/deep/", "state/jobs/j3/deep/state.json",
      "state/state/", "state/state/s.json", "state/stats-cache.json", "state/tasks/", "state/tasks/t1/", "state/tasks/t1/1.json",
    ].sort());
    const t = tree(dest);
    expect(t["config/skills/link.md"]).toBe("link -> x/SKILL.md");
    expect(t["config/skills/x/run.sh"]!.startsWith("file x ")).toBe(true);
    expect(readFileSync(join(dest, "DEVICE.json"), "utf8")).toBe(readFileSync(src.deviceFile, "utf8"));
    expect(readFileSync(join(dest, "config", "claude.json"), "utf8")).toBe(CLAUDE_JSON_SANITIZED);
    expect(readFileSync(join(dest, "projects/-home-me-proj/memory/MEMORY.md"), "utf8")).toBe("# Memory Index\n");
    // A transcript rests zstd-compressed, and reads back whole.
    expect(src.unzstd(join(dest, "projects/-home-me-proj/sessions/aaaa.jsonl.zst")).toString("utf8")).toBe(readFileSync(join(claude, "projects/-home-me-proj/aaaa.jsonl"), "utf8"));
    // A second mirror over an unmoved home changes nothing.
    mirrorSessions(src, ws, dev);
    expect(tree(dest)).toEqual(t);
  });

  // KS5 needs bash, python3, rsync and zstd. CI's cli-mesh cell runs in the Playwright image as uid 1001, with no rsync and no apt,
  // so it names the bare-runner cell that runs KS5 instead (LARES_KS5_RUNS_IN), and that cell installs the four and runs it.
  // Anywhere else a missing tool fails loudly.
  const ks5Elsewhere = process.env["LARES_KS5_RUNS_IN"];
  (ks5Elsewhere ? test.skip : test)(`KS5 RED · PARITY: the script's mirror half and the keep's mirror write byte-equal trees, on a first run and after the home moves${ks5Elsewhere ? ` (runs in ${ks5Elsewhere})` : ""}`, () => {
    for (const tool of ["bash", "python3", "rsync", "zstd"]) expect(spawnSync(tool, ["--version"], { encoding: "utf8" }).status, `${tool} stands on this machine (bin/sync runs on all four)`).toBe(0);
    const { env, claude, home } = fakeHome();
    // The script reads the machine's own id and names; the keep's mirror reads the same sources here.
    const live = { HOME: home };
    const src = sources(live);
    const theirs = join(scratch, "theirs"), ours = join(scratch, "ours");
    const script = join(import.meta.dirname, "fixtures", "claude-backup-sync-mirror.sh");
    const runScript = (): void => {
      const r = spawnSync("bash", [script, theirs], { encoding: "utf8", env: { PATH: process.env["PATH"] ?? "", HOME: home } });
      expect(r.status, `${r.stdout}${r.stderr}`).toBe(0);
    };
    void env;
    // THE MINT: the script mints the identity; the keep's own mint, over the same machine, writes the same bytes.
    runScript();
    const minted = readFileSync(src.deviceFile, "utf8");
    const again = sources({ HOME: home, XDG_CONFIG_HOME: join(scratch, "xdg-ours") });
    readOrMintDevice(again);
    expect(readFileSync(again.deviceFile, "utf8")).toBe(minted);
    expect(JSON.parse(minted).hostname).toBe(hostname());
    const dev = readOrMintDevice(src);
    expect(existsSync(join(theirs, "devices", dev.dir, "DEVICE.json"))).toBe(true);

    mirrorSessions(src, ours, dev);
    const first = tree(theirs);
    expect(tree(ours)).toEqual(first);
    expect(Object.keys(first).length).toBeGreaterThan(50);

    // THE HOME MOVES: a rule changes, a memory file leaves, a plan arrives, a job's state goes, a settings backup goes (the
    // script never clears one), the sanitized store changes, and a transcript grows after both mirrors last took it.
    put(claude, "rules/a.md", "rule a, reworded and longer\n", { ageSec: 120 });
    rmSync(join(claude, "projects/-home-me-proj/memory/sub"), { recursive: true });
    put(claude, "plans/q.md", "a second plan\n", { ageSec: 120 });
    rmSync(join(claude, "jobs/j1/state.json"));
    rmSync(join(claude, "settings.json.bak.2"));
    rmSync(join(claude, "skills/link.md"));
    symlinkSync("x/run.sh", join(claude, "skills", "link.md"));
    put(home, ".claude.json", CLAUDE_JSON.replace('"numStartups": 42', '"numStartups": 43'));
    for (const root of [theirs, ours]) {
      const kept = join(root, "devices", dev.dir, "projects/-home-me-proj/sessions/aaaa.jsonl.zst");
      const then = Date.now() / 1000 - 2 * HOUR;
      utimesSync(kept, then, then);
    }
    put(claude, "projects/-home-me-proj/aaaa.jsonl", `${'{"type":"user","text":"an idle transcript, grown"}\n'.repeat(60)}`, { ageSec: HOUR / 2 });
    put(claude, "projects/-home-me-proj/live.jsonl", '{"type":"user","text":"now idle"}\n', { ageSec: HOUR / 2 });
    runScript();
    mirrorSessions(src, ours, dev);
    const second = tree(theirs);
    expect(second).not.toEqual(first);
    expect(tree(ours)).toEqual(second);
    expect(Object.keys(second)).toContain(`devices/${dev.dir}/projects/-home-me-proj/sessions/live.jsonl.zst`);
    expect(Object.keys(second)).not.toContain(`devices/${dev.dir}/state/jobs/j1/state.json`);
    expect(Object.keys(second)).toContain(`devices/${dev.dir}/config/settings.json.bak.2`);
  });
});
