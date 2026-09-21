import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { repoRoot } from "@lararium/mesh/node";
import {
  loadLaresConfig, originDeclaration, daemonCorpusRoot, daemonGenesisDir, daemonBagsDir, daemonCasDir,
  type LaresConfig,
} from "../src/lares-config.js";

// The env vars the resolvers read — saved + restored so one test never leaks into the next.
const ENV_KEYS = ["LAR_ROOT", "LAR_GENESIS", "LAR_BAGS", "LAR_PUBLIC_URL", "LAR_WEB_ORIGIN", "LAR_ORACLE_ORIGIN", "LAR_SAME_ORIGIN"] as const;

describe("lares-config — the per-daemon resource-override reader", () => {
  let dir: string;
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "lares-config-"));
    saved = {};
    for (const k of ENV_KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    rmSync(dir, { recursive: true, force: true });
  });

  const writeConfig = (obj: unknown): string => {
    const p = join(dir, "config.json");
    writeFileSync(p, JSON.stringify(obj), "utf8");
    return p;
  };

  // ── The reader: missing → empty, malformed → clear throw ────────────────────────────────────────

  test("a missing config file reads as empty — the defaults stand, never a throw", () => {
    expect(loadLaresConfig(join(dir, "does-not-exist.json"))).toEqual({});
  });

  test("malformed JSON throws a clear error naming the path — a typo SURFACES", () => {
    const p = join(dir, "config.json");
    writeFileSync(p, "{ not json", "utf8");
    expect(() => loadLaresConfig(p)).toThrow(/malformed JSON/);
    expect(() => loadLaresConfig(p)).toThrow(p);
  });

  test("a non-object top-level (array / scalar) throws — config must hold an object", () => {
    expect(() => loadLaresConfig(writeConfig([1, 2]))).toThrow(/must hold a JSON object/);
    expect(() => loadLaresConfig(writeConfig(42))).toThrow(/must hold a JSON object/);
  });

  test("a well-formed override parses back the sited resource roots", () => {
    const cfg = loadLaresConfig(writeConfig({ resources: { bags: "/srv/bags", genesis: "/srv/gen" } }));
    expect(cfg.resources?.bags).toBe("/srv/bags");
    expect(cfg.resources?.genesis).toBe("/srv/gen");
  });

  test("origin declaration reads explicit config values and leaves relay reach separate", () => {
    const cfg: LaresConfig = {
      origins: { web: "https://web.home", oracle: "https://oracle.home" },
    };
    expect(originDeclaration(cfg)).toEqual({ webOrigin: "https://web.home", oracleOrigin: "https://oracle.home" });
  });

  test("same-origin config is explicit and does not need Web/oracle copies", () => {
    expect(originDeclaration({ origins: { sameOrigin: true } })).toEqual({ sameOrigin: true });
  });

  test("origin env values override config, while LAR_PUBLIC_URL has no role in Web/oracle declaration", () => {
    process.env["LAR_PUBLIC_URL"] = "https://relay.home";
    process.env["LAR_WEB_ORIGIN"] = "https://web.env";
    process.env["LAR_ORACLE_ORIGIN"] = "https://oracle.env";
    const declaration = originDeclaration({ origins: { web: "https://web.config", oracle: "https://oracle.config" } });
    expect(declaration).toEqual({ webOrigin: "https://web.env", oracleOrigin: "https://oracle.env" });
  });

  test("invalid same-origin env/config values refuse instead of degrading", () => {
    process.env["LAR_SAME_ORIGIN"] = "maybe";
    expect(() => originDeclaration({})).toThrow(/LAR_SAME_ORIGIN must be true or false/);
    delete process.env["LAR_SAME_ORIGIN"];
    expect(() => originDeclaration({ origins: { sameOrigin: "yes" as unknown as boolean } })).toThrow(/origins\.sameOrigin must be true or false/);
  });

  // ── The composable caps: no-config → repo-relative; config → sited; env wins ─────────────────────

  test("with NO config sited, every resource derives off the repo checkout (boot-safe)", () => {
    const empty: LaresConfig = {};
    expect(daemonCorpusRoot()).toBe(repoRoot);
    expect(daemonGenesisDir(empty)).toBe(join(repoRoot, "genesis"));
    expect(daemonBagsDir(empty)).toBe(join(repoRoot, "bags"));
    expect(daemonCasDir(empty)).toBe(join(repoRoot, "genesis", "cas"));
  });

  test("a config override sites genesis + bags away from the repo default", () => {
    const cfg: LaresConfig = { resources: { genesis: "/home/op/.lares/genesis", bags: "/home/op/.lares/bags" } };
    expect(daemonGenesisDir(cfg)).toBe("/home/op/.lares/genesis");
    expect(daemonBagsDir(cfg)).toBe("/home/op/.lares/bags");
    // cas rides genesis by default → follows the genesis override
    expect(daemonCasDir(cfg)).toBe(join("/home/op/.lares/genesis", "cas"));
  });

  test("a standalone cas override splits cas out of the genesis dir", () => {
    const cfg: LaresConfig = { resources: { cas: "/mnt/blobs/cas" } };
    expect(daemonCasDir(cfg)).toBe("/mnt/blobs/cas");
  });

  test("the env var WINS over a config override (env > config > repo-default)", () => {
    const cfg: LaresConfig = { resources: { genesis: "/from/config", bags: "/from/config-bags" } };
    process.env["LAR_GENESIS"] = "/from/env";
    process.env["LAR_BAGS"] = "/from/env-bags";
    expect(daemonGenesisDir(cfg)).toBe("/from/env");
    expect(daemonBagsDir(cfg)).toBe("/from/env-bags");
  });

  test("LAR_ROOT re-bases the corpus root, and derived dirs follow it", () => {
    process.env["LAR_ROOT"] = "/isolated/instance";
    expect(daemonCorpusRoot()).toBe("/isolated/instance");
    expect(daemonGenesisDir({})).toBe(join("/isolated/instance", "genesis"));
    expect(daemonBagsDir({})).toBe(join("/isolated/instance", "bags"));
  });
});
