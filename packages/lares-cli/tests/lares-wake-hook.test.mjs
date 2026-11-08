import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const source = resolve("packages/lares-cli/.claude-plugin/hooks/lares-wake-hook.mjs");

test("wake observes the checkout shim and bounds failures", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "wake-hook-"));
  const hooks = join(root, "packages/lares-cli/.claude-plugin/hooks");
  const bin = join(root, "packages/lares-cli/bin");
  const tools = join(root, "tools");
  mkdirSync(hooks, { recursive: true });
  mkdirSync(bin, { recursive: true });
  mkdirSync(tools, { recursive: true });
  copyFileSync(source, join(hooks, "lares-wake-hook.mjs"));
  writeFileSync(join(bin, "lares.mjs"), 'console.log("home reading");\n');
  const shim = join(tools, "lares-container.sh");
  const run = () => {
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const r = spawnSync(process.execPath, [join(hooks, "lares-wake-hook.mjs")], { env, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", timeout: 14000 });
    assert.equal(r.status, 0, r.error?.message);
    return JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
  };
  try {
    await t.test("reports the vessel's port and cap", () => {
      writeFileSync(shim, '#!/bin/sh\n[ "$*" = "vessel stand --observe --json" ] || exit 2\nprintf \'%s\\n\' \'{"data":{"node":{"up":true,"port":4321,"cap":"observe"}}}\'\n', { mode: 0o755 });
      const context = run();
      assert.match(context, /"up":true/);
      assert.match(context, /"port":4321/);
      assert.match(context, /"cap":"observe"/);
      assert.match(context, /Lares homes: home reading/);
    });
    await t.test("reports down when docker or compose fails", () => {
      writeFileSync(shim, '#!/bin/sh\nexit 127\n');
      assert.match(run(), /vessel down; stand it with tools\/lares-container\.sh up/);
    });
    await t.test("reports down when the vessel answers down", () => {
      writeFileSync(shim, '#!/bin/sh\nprintf \'%s\\n\' \'{"data":{"node":{"up":false,"port":8080}}}\'\n');
      assert.match(run(), /vessel down; stand it with tools\/lares-container\.sh up/);
    });
    await t.test("names a hung shim timeout", () => {
      writeFileSync(shim, '#!/bin/sh\nsleep 30\n');
      assert.match(run(), /vessel observation timed out/);
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
