/**
 * pulama-config-reader-matches-the-shim — the CLI reads whether a pūlama keeps this house from the house's own signal, the
 * way `tools/lares-container.sh` reads it: inside the vessel `LAR_PULAMA_SOCKET` (compose sets it, empty when off); on the
 * host the shim's `value_of LARES_PULAMA`, the environment first, else the surface env file's last plain `KEY=VALUE` line.
 *
 * Each fixture runs through BOTH readers: the shim's own `value_of`, lifted from the shim's text and run in bash, and
 * `surfaceEnvValue`. Every HOME here stands under a scratch directory; nothing reads a real `~/.lares`.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pulamaStands, surfaceEnvValue } from "../src/house-config.js";

const REPO = join(import.meta.dirname, "..", "..", "..");
/** The shim's `value_of`, exactly as the shim spells it. */
const VALUE_OF = (() => {
  const m = /^value_of\(\) \{[^\n]*\n[\s\S]*?\n\}\n/m.exec(readFileSync(join(REPO, "tools", "lares-container.sh"), "utf8"));
  if (m === null) throw new Error("the shim carries no value_of");
  return m[0];
})();

const KEYS = ["HOME", "LARES_PULAMA", "LAR_PULAMA_SOCKET"] as const;
let dir: string;
let prior: Record<string, string | undefined>;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "house-config-"));
  prior = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  process.env["HOME"] = join(dir, "operator");
  delete process.env["LARES_PULAMA"];
  delete process.env["LAR_PULAMA_SOCKET"];
});
afterEach(() => {
  for (const k of KEYS) { if (prior[k] === undefined) delete process.env[k]; else process.env[k] = prior[k]; }
  rmSync(dir, { recursive: true, force: true });
});

function envFile(text: string | null): void {
  const home = join(process.env["HOME"]!, ".lares");
  rmSync(home, { recursive: true, force: true });
  if (text === null) return;
  mkdirSync(home, { recursive: true });
  writeFileSync(join(home, "lares-surface.env"), text);
}

/** What the shim's own `value_of LARES_PULAMA` prints under this HOME and this env value. */
function shimReads(envValue: string | undefined): string {
  const env: Record<string, string> = { PATH: process.env["PATH"] ?? "/usr/bin:/bin", HOME: process.env["HOME"]! };
  if (envValue !== undefined) env["LARES_PULAMA"] = envValue;
  const script = `ENV_FILE="$HOME/.lares/lares-surface.env"\n${VALUE_OF}value_of LARES_PULAMA`;
  return execFileSync("bash", ["-c", script], { env, encoding: "utf8" });
}

describe("pulama-config-reader-matches-the-shim", () => {
  const fixtures: Array<[string, string | undefined, string | null]> = [
    ["no env, no file", undefined, null],
    ["env alone", "1", null],
    ["env beats the file", "0", "LARES_PULAMA=1\n"],
    ["an empty env reads the file", "", "LARES_PULAMA=1\n"],
    ["the file alone", undefined, "LARES_HOUSE=/nowhere\nLARES_PULAMA=1\n"],
    ["the last line wins", undefined, "LARES_PULAMA=1\nLARES_PULAMA=0\n"],
    ["the last line wins, on", undefined, "LARES_PULAMA=0\nLARES_PULAMA=1"],
    ["a blank last line reads off", undefined, "LARES_PULAMA=1\nLARES_PULAMA=\n"],
    ["leading whitespace counts", undefined, "  \tLARES_PULAMA=1\n"],
    ["a comment never counts", undefined, "# LARES_PULAMA=1\n"],
    ["an export prefix never counts", undefined, "export LARES_PULAMA=1\n"],
    ["a longer name never counts", undefined, "LARES_PULAMA_X=1\n"],
    ["trailing space stays in the value", undefined, "LARES_PULAMA=1 \n"],
    ["a quoted value stays quoted", undefined, "LARES_PULAMA=\"1\"\n"],
    ["a carriage return stays in the value", undefined, "LARES_PULAMA=1\r\n"],
  ];
  for (const [name, envValue, file] of fixtures) {
    it(name, () => {
      envFile(file);
      if (envValue === undefined) delete process.env["LARES_PULAMA"];
      else process.env["LARES_PULAMA"] = envValue;
      const shim = shimReads(envValue);
      expect(surfaceEnvValue("LARES_PULAMA")).toBe(shim);
      expect(pulamaStands()).toBe(shim === "1");
    });
  }

  it("inside the vessel the compose-set socket names the pūlama; empty, it names none", () => {
    envFile(null);
    process.env["LAR_PULAMA_SOCKET"] = "/pulama/socket/pulama.sock";
    expect(pulamaStands()).toBe(true);
    process.env["LAR_PULAMA_SOCKET"] = "";
    expect(pulamaStands()).toBe(false);
  });
});
