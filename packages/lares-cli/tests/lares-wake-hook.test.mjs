import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, copyFileSync, existsSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const sourceDir = resolve("packages/lares-cli/.claude-plugin/hooks");

test("wake observes the checkout shim and bounds failures", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "wake-hook-"));
  const hooks = join(root, "packages/lares-cli/.claude-plugin/hooks");
  const bin = join(root, "packages/lares-cli/bin");
  const tools = join(root, "tools");
  mkdirSync(hooks, { recursive: true });
  mkdirSync(bin, { recursive: true });
  mkdirSync(tools, { recursive: true });
  for (const name of ["lares-wake-hook.mjs", "lares-wake-core.mjs", "lares-compact-hook.mjs", "lares-menu-read.mjs", "lares-spirit-core.mjs"]) {
    if (existsSync(join(sourceDir, name))) copyFileSync(join(sourceDir, name), join(hooks, name));
  }
  writeFileSync(join(bin, "lares.mjs"), `
if (process.argv[2] === "mcp") {
  let pending = "";
  process.stdin.on("data", chunk => { pending += chunk; let n; while ((n = pending.indexOf("\\n")) >= 0) {
    const msg = JSON.parse(pending.slice(0, n)); pending = pending.slice(n + 1);
    if (msg.id === 1) console.log(JSON.stringify({jsonrpc:"2.0", id:1, result:{}}));
    if (msg.id === 2) console.log(JSON.stringify({jsonrpc:"2.0", id:2, result:{tools:[{name:"read", description:"Read a record."}]}}));
  }});
} else console.log("home reading");
`);
  const shim = join(tools, "lares-container.sh");
  // The harness bounds a hook at 15 seconds (`hooks/hooks.json`); a run that outlasts it fails here as it would there.
  const spawnHook = (name, input = "") => {
    // A scratch HOME: the hook reads the keep workspace from ~/.lares/lares-surface.env, never the operator's own here.
    const env = { ...process.env, HOME: root };
    delete env.NODE_TEST_CONTEXT;
    delete env.LARES_KEEP_WORKSPACE;
    delete env.LARES_WORKSPACES;
    const r = spawnSync(process.execPath, [join(hooks, name)], { env, input, stdio: ["pipe", "pipe", "pipe"], encoding: "utf8", timeout: 15000 });
    assert.equal(r.status, 0, r.error?.message ?? r.stderr);
    return r.stdout;
  };
  const run = (input = "") => JSON.parse(spawnHook("lares-wake-hook.mjs", input)).hookSpecificOutput.additionalContext;
  // A shim that answers the observation and the index read, each by its own argv.
  const indexAnswer = JSON.stringify({ ok: true, requestId: "r", data: { recipe: "default", filter: "[tag[stage/index]]", total: 2, next: null, asOf: "90a1a6dbea5e1f15", rows: [
    { title: "lar:///ha.ka.ba/kahua/memory/project/house-laws", fields: { title: "lar:///ha.ka.ba/kahua/memory/project/house-laws", description: "The seven house laws." } },
    { title: "lar:///ha.ka.ba/kahua/memory/state/open-ledger", fields: { title: "lar:///ha.ka.ba/kahua/memory/state/open-ledger", description: "What stands open." } },
  ] } });
  const stateAnswer = JSON.stringify({ ok: true, requestId: "s", data: { recipe: "default", filter: "[lares.stage[state]!regexp[#]]", total: 2, next: null, asOf: "90a1a6dbea5e1f15", rows: [
    { title: "lar:///ha.ka.ba/kahua/memory/state/open-ledger", fields: { title: "lar:///ha.ka.ba/kahua/memory/state/open-ledger", description: "What stands open." } },
    { title: "lar:///ha.ka.ba/kahua/memory/state/handoff", fields: { title: "lar:///ha.ka.ba/kahua/memory/state/handoff", description: "Start here." } },
  ] } });
  // The law reads: the pin set's standing titles, then the index the pins head.
  const boot = "lar:///ha.ka.ba/lares/api/noosphere-boot";
  const addressLaw = "lar:///ha.ka.ba/lares/api/pono/lar-uri";
  const lawPinsAnswer = JSON.stringify({ ok: true, requestId: "p", data: { recipe: "default", titles: [boot], total: 1, next: null, asOf: "90a1a6dbea5e1f15" } });
  const lawAnswer = JSON.stringify({ ok: true, requestId: "l", data: { recipe: "default", total: 2, next: null, asOf: "90a1a6dbea5e1f15", rows: [
    { title: boot, fields: { title: boot } },
    { title: addressLaw, fields: { title: addressLaw, role: "the address law" } },
  ] } });
  const standingShim = [
    "#!/bin/sh",
    'case "$1 $2" in',
    `"vessel stand") printf '%s\\n' '{"data":{"node":{"up":true,"port":4321,"cap":"observe"}}}' ;;`,
    `"wiki filter") case "$3" in "[lares.stage"*) printf '%s\\n' '${stateAnswer}' ;; "[lares.law.pins"*) printf '%s\\n' '${lawPinsAnswer}' ;; "[lares.law"*) printf '%s\\n' '${lawAnswer}' ;; *) printf '%s\\n' '${indexAnswer}' ;; esac ;;`,
    "*) exit 2 ;;",
    "esac",
    "",
  ].join("\n");
  const lockedShim = [
    "#!/bin/sh",
    'case "$1 $2" in',
    `"vessel stand") printf '%s\\n' '{"data":{"node":{"up":true}}}' ;;`,
    `*) printf '%s\\n' '{"ok":false,"error":{"code":"vessel-locked","message":"the vessel stands locked"}}'; exit 4 ;;`,
    "esac",
    "",
  ].join("\n");
  try {
    await t.test("reports the vessel's port and cap", () => {
      writeFileSync(shim, '#!/bin/sh\n[ "$*" = "vessel stand --observe --json" ] || exit 2\nprintf \'%s\\n\' \'{"data":{"node":{"up":true,"port":4321,"cap":"observe"}}}\'\n', { mode: 0o755 });
      const context = run();
      assert.match(context, /"up":true/);
      assert.match(context, /"port":4321/);
      assert.match(context, /"cap":"observe"/);
      assert.match(context, /Lares homes: home reading/);
      assert.match(context, /Lares tool menu: sha256:[0-9a-f]{12}/);
    });
    await t.test("a staged hearth holding two index rows wakes with both in the context (L43)", () => {
      writeFileSync(shim, standingShim, { mode: 0o755 });
      const context = run(JSON.stringify({ hook_event_name: "SessionStart", source: "startup" }));
      assert.match(context, /"up":true/);
      assert.match(context, /Lares memory index: 2 rows\n/);
      assert.match(context, /lar:\/\/\/ha\.ka\.ba\/kahua\/memory\/project\/house-laws — The seven house laws\./);
      assert.match(context, /lar:\/\/\/ha\.ka\.ba\/kahua\/memory\/state\/open-ledger — What stands open\./);
      assert.match(context, /Lares homes: home reading/);
      assert.match(context, /Lares working memories on the stage \(start here\): 2 rows\nlar:\/\/\/ha\.ka\.ba\/kahua\/memory\/state\/handoff — Start here\.\n/);
      assert.match(context, /Lares law \(pinned first\): 1 pinned · 2 rows\nthese rows come from canon, the house's settled ground[^\n]*\n📌 lar:\/\/\/ha\.ka\.ba\/lares\/api\/noosphere-boot\n   lar:\/\/\/ha\.ka\.ba\/lares\/api\/pono\/lar-uri — the address law\nread the rest: law_index/);
    });
    await t.test("a wake after a compaction leads with the rows in play too", () => {
      writeFileSync(shim, standingShim, { mode: 0o755 });
      const context = run(JSON.stringify({ hook_event_name: "SessionStart", source: "compact" }));
      assert.match(context, /Lares memory index: 2 rows\n/);
      assert.ok(context.indexOf("Lares working memories on the stage") < context.indexOf("Lares memory index"));
    });
    await t.test("the compaction hook hands the summary the index and the rows in play as plain text", () => {
      writeFileSync(shim, standingShim, { mode: 0o755 });
      const text = spawnHook("lares-compact-hook.mjs", JSON.stringify({ hook_event_name: "PreCompact", trigger: "auto" }));
      assert.match(text, /^Lares compaction carry: keep every `lar:` address below verbatim in the summary/);
      assert.match(text, /Lares memory index: 2 rows\n/);
      assert.match(text, /Lares working memories on the stage \(start here\): 2 rows\nlar:\/\/\/ha\.ka\.ba\/kahua\/memory\/state\/handoff/);
      // A PreCompact hook's stdout rides as compact instructions, never as a JSON envelope.
      assert.throws(() => JSON.parse(text));
    });
    await t.test("a vessel that answers the observation and refuses the read names the read's cause", () => {
      writeFileSync(shim, lockedShim, { mode: 0o755 });
      const context = run();
      assert.match(context, /memory index unread: vessel-locked: the vessel stands locked/);
      assert.match(context, /"up":true/);
      assert.match(context, /Lares homes: home reading/);
    });
    await t.test("names a shim that failed with no answer, by its exit, and never calls that a vessel down", () => {
      writeFileSync(shim, '#!/bin/sh\nexit 127\n');
      const context = run();
      assert.match(context, /vessel unobserved: the shim exited 127 with no answer/);
      assert.doesNotMatch(context, /vessel down/);
      assert.match(context, /memory index skipped: no vessel answers/);
      assert.doesNotMatch(context, /memory index unread/);
    });
    await t.test("names an answer it could not read", () => {
      writeFileSync(shim, '#!/bin/sh\necho "compose: pulling"\n');
      const context = run();
      assert.match(context, /vessel unobserved: the shim's answer did not parse/);
      assert.doesNotMatch(context, /vessel down/);
    });
    await t.test("reports down only when the vessel itself answers down, and skips the index read", () => {
      writeFileSync(shim, '#!/bin/sh\nprintf \'%s\\n\' \'{"data":{"node":{"up":false,"port":8080}}}\'\n');
      const context = run();
      assert.match(context, /vessel down \(the observation answered node\.up false\); stand it with tools\/lares-container\.sh up/);
      assert.equal(context.match(/memory index/g)?.length, 1);
      assert.match(context, /memory index skipped: no vessel answers/);
      assert.doesNotMatch(context, /Lares tool menu:/);
    });
    await t.test("names a hung shim timeout, all three reads inside the harness's 15 seconds", () => {
      writeFileSync(shim, '#!/bin/sh\nsleep 30\n');
      writeFileSync(join(bin, "lares.mjs"), "setTimeout(() => {}, 30000);\n");
      const context = run();
      assert.match(context, /vessel observation timed out/);
      assert.match(context, /Lares homes: lares home read gave no answer inside the wake's budget/);
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
