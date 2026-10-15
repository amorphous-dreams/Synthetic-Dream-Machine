/**
 * host-globals — the lent web globals reach a plain server's module sandbox WITHOUT reading as leaks.
 *
 * A plain TiddlyWiki server evaluates every module inside ONE `vm.createContext({})` and, after each
 * module body, runs `globalCheck`: it enumerates the sandbox's own keys and warns
 * `Global assignment detected` for any it finds. `host-globals` lends `TextEncoder`, `TextDecoder` and
 * `crypto` into that sandbox — as ENUMERABLE properties, so every module evaluated afterwards tripped
 * the check: 47 warning lines on a stock `--render`, one per module, each naming the three globals.
 *
 * Measured beside it: a `.mem` in a plain server's `tiddlers/` never reaches the plugin's deserializer
 * at boot — the folder loads in `loadStartup`, the plugin's modules define in `execStartup` after it —
 * so no deserialize-before-startup window stands on the fork today. The deserializer lends the globals
 * at its own entry regardless, so a reader reached by any path before startup holds.
 */
import { describe, expect, test } from "vitest";
import vm from "node:vm";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

import { lendHostGlobals } from "../src/host-globals-lend.js";

const PKG = new URL("..", import.meta.url).pathname;
const REPO = path.resolve(PKG, "../..");
const TW5_JS = path.join(REPO, "TiddlyWiki5/tiddlywiki.js");
const PLUGIN_TID = path.join(PKG, "dist-plugin/lares-memetic-wikitext.tid");
const forkPresent = existsSync(TW5_JS) && existsSync(PLUGIN_TID);

describe("the lend lands the globals where the sandbox lacks them, invisibly to globalCheck", () => {
  test("a bare vm context gains TextEncoder/TextDecoder/crypto as NON-enumerable properties", () => {
    const ctx = vm.createContext({});
    const g = ctx as Record<string, unknown>;
    expect(g["TextEncoder"]).toBeUndefined();
    lendHostGlobals(g, process);
    expect(typeof g["TextEncoder"]).toBe("function");
    expect(typeof g["TextDecoder"]).toBe("function");
    expect(typeof (g["crypto"] as { subtle?: unknown } | undefined)?.subtle).toBe("object");
    // The exact read the fork's globalCheck makes — the lent names must stay out of it.
    expect(Object.keys(g)).not.toContain("TextEncoder");
    expect(Object.keys(g)).not.toContain("TextDecoder");
    expect(Object.keys(g)).not.toContain("crypto");
    // And the lent encoder hashes the way the host's own does.
    const enc = new (g["TextEncoder"] as typeof TextEncoder)();
    expect(Array.from(enc.encode("hé"))).toEqual([104, 195, 169]);
  });

  test("CONTROL — a host already holding the globals keeps its own (same identity, nothing redefined)", () => {
    const own = { TextEncoder, TextDecoder, crypto };
    const g: Record<string, unknown> = { ...own };
    lendHostGlobals(g, process);
    expect(g["TextEncoder"]).toBe(own.TextEncoder);
    expect(g["TextDecoder"]).toBe(own.TextDecoder);
    expect(g["crypto"]).toBe(own.crypto);
  });

  test("CONTROL — no `process` in reach (a browser, a worker): the lend does nothing and throws nothing", () => {
    const g: Record<string, unknown> = {};
    expect(() => lendHostGlobals(g, undefined)).not.toThrow();
    expect(g["TextEncoder"]).toBeUndefined();
  });
});

describe.skipIf(!forkPresent)("a stock server with the plugin evaluates every module without a leak warning", () => {
  test("`tiddlywiki --render` prints ZERO `Global assignment detected` lines", () => {
    const root = mkdtempSync(path.join(tmpdir(), "lar-host-globals-"));
    try {
      const wiki = path.join(root, "wiki");
      mkdirSync(path.join(wiki, "tiddlers"), { recursive: true });
      writeFileSync(path.join(wiki, "tiddlywiki.info"), JSON.stringify({ description: "host-globals witness", plugins: [], themes: [], build: {} }));
      copyFileSync(PLUGIN_TID, path.join(wiki, "tiddlers/lares-memetic-wikitext.tid"));
      writeFileSync(path.join(wiki, "tiddlers/hello.tid"), "title: hello\n\nhello");
      const ran = spawnSync(process.execPath, [TW5_JS, wiki, "--output", path.join(root, "out"), "--render", "[[hello]]", "hello.txt", "text/plain"], { encoding: "utf8" });
      expect(ran.status, ran.stderr).toBe(0);
      const leaks = `${ran.stdout}\n${ran.stderr}`.split("\n").filter((l) => /Global assignment detected/.test(l));
      expect(leaks, leaks.slice(0, 3).join("\n")).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 60_000);
});
