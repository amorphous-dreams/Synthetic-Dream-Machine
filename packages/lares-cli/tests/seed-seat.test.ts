/**
 * seed-seat — the writes `lares wire` makes so every host seats the boot seed once, by reference.
 * The law: lar:///ha.ka.ba/lares/docs/pono/seed-seat.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import {
  existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  BOOT_CARRIER, CLAUDE_LINK, CODEX_DOC_CAP, CODEX_LINK, SEAT_RULE, SEAT_RULE_EXCLUDE, SEAT_RULE_OWNER,
  SEEDLESS_FILES, liftSeedLines, mainCloneOf, namesSeed, tendLink, tendRepoSeat, tendSeatRule,
} from "../src/seed-seat.js";
import { wireCodexHome } from "../src/codex-wire.js";

const REPO = join(import.meta.dirname, "..", "..", "..");
let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "seed-seat-")); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

/** A clone carrying the carrier and nothing else. */
function clone(): string {
  const root = mkdtempSync(join(dir, "clone-"));
  mkdirSync(join(root, dirname(BOOT_CARRIER)), { recursive: true });
  writeFileSync(join(root, BOOT_CARRIER), "the seed\n");
  return root;
}

describe("the repo seat", () => {
  it("CONTROL: seats a bare clone whole, and the tool's check reads it standing", () => {
    const root = clone();
    tendRepoSeat(root);
    execFileSync("node", [join(REPO, "tools/seed-seat.mjs"), "project", "--root", root]);
    const out = execFileSync("node", [join(REPO, "tools/seed-seat.mjs"), "check", "--root", root], { encoding: "utf8" });
    expect(out).toContain("the seat stands");
  });

  it("converges: a second pass writes nothing", () => {
    const root = clone();
    tendRepoSeat(root);
    expect(tendRepoSeat(root).every((s) => s.action === "present")).toBe(true);
  });

  it("links both names relative to the carrier", () => {
    const root = clone();
    tendRepoSeat(root);
    expect(readlinkSync(join(root, CLAUDE_LINK))).toBe(`../${BOOT_CARRIER}`);
    expect(readlinkSync(join(root, CODEX_LINK))).toBe(BOOT_CARRIER);
  });

  it("a link standing as a regular file yields to the link and keeps a backup", () => {
    const root = clone();
    writeFileSync(join(root, CODEX_LINK), BOOT_CARRIER);
    expect(tendLink(root, CODEX_LINK).action).toBe("wired");
    expect(lstatSync(join(root, CODEX_LINK)).isSymbolicLink()).toBe(true);
    expect(readFileSync(join(root, `${CODEX_LINK}.bak`), "utf8")).toBe(BOOT_CARRIER);
  });

  it("heads CLAUDE.md with the link's import, lifts a dead pointer, and keeps the operator's prose", () => {
    const root = clone();
    writeFileSync(join(root, "CLAUDE.md"), `@${BOOT_CARRIER}\n\n## Claude Adapter Surface\n\n- the link \`.claude/noosphere-boot\` stays mentioned\n`);
    tendRepoSeat(root);
    const text = readFileSync(join(root, "CLAUDE.md"), "utf8");
    expect(text.split("\n")[0]).toBe(`@${CLAUDE_LINK}`);
    expect(text).not.toContain(`@${BOOT_CARRIER}`);
    expect(text).toContain("stays mentioned");
  });

  it("lifts the dead pointer from every file Copilot reads beside CLAUDE.md, keeping its prose", () => {
    const root = clone();
    for (const f of ["AGENTS.md", "copilot-instructions.md", ".github/copilot-instructions.md"]) {
      mkdirSync(dirname(join(root, f)), { recursive: true });
      writeFileSync(join(root, f), `-> [noosphere-boot.mem](${BOOT_CARRIER})\n\n## Surface\n\n- keep me\n`);
    }
    tendRepoSeat(root);
    for (const f of ["AGENTS.md", "copilot-instructions.md", ".github/copilot-instructions.md"]) {
      const text = readFileSync(join(root, f), "utf8");
      expect(text).not.toContain("noosphere-boot.mem");
      expect(text).toContain("- keep me");
    }
  });

  it("lifts Codex's cap past the carrier and keeps the config's other lines", () => {
    const root = clone();
    mkdirSync(join(root, ".codex"));
    writeFileSync(join(root, ".codex/config.toml"), "project_doc_max_bytes = 32768\n[mcp_servers.x]\ncommand = \"node\"\n");
    tendRepoSeat(root);
    const toml = readFileSync(join(root, ".codex/config.toml"), "utf8");
    expect(toml).toContain(`project_doc_max_bytes = ${CODEX_DOC_CAP}`);
    expect(toml).toContain("[mcp_servers.x]");
  });

  it("excludes the operator's rule and keeps the settings' other keys", () => {
    const root = clone();
    mkdirSync(join(root, ".claude"));
    writeFileSync(join(root, ".claude/settings.json"), JSON.stringify({ hooks: { a: 1 } }));
    tendRepoSeat(root);
    const s = JSON.parse(readFileSync(join(root, ".claude/settings.json"), "utf8"));
    expect(s.claudeMdExcludes).toEqual([SEAT_RULE_EXCLUDE]);
    expect(s.hooks).toEqual({ a: 1 });
  });

  it("a clone with no carrier seats nothing", () => {
    expect(tendRepoSeat(mkdtempSync(join(dir, "bare-")))[0]!.action).toBe("missing-script");
  });

  it("the live repo's seat stands, read without a write", () => {
    const out = execFileSync("node", [join(REPO, "tools/seed-seat.mjs"), "check"], { encoding: "utf8" });
    expect(out).toContain("the seat stands");
  });
});

describe("the operator's home seat", () => {
  it("writes the owned rule importing the clone's link, and a second pass writes nothing", () => {
    const root = clone();
    tendRepoSeat(root);
    const home = mkdtempSync(join(dir, "home-"));
    expect(tendSeatRule(home, root).action).toBe("wired");
    const text = readFileSync(join(home, SEAT_RULE), "utf8");
    expect(text.startsWith(SEAT_RULE_OWNER)).toBe(true);
    expect(text).toContain(`/${CLAUDE_LINK}`);
    expect(tendSeatRule(home, root).action).toBe("present");
  });

  it("refuses a same-named rule it never wrote, and leaves it whole", () => {
    const root = clone();
    tendRepoSeat(root);
    const home = mkdtempSync(join(dir, "home-"));
    mkdirSync(dirname(join(home, SEAT_RULE)), { recursive: true });
    writeFileSync(join(home, SEAT_RULE), "the operator's own words\n");
    expect(tendSeatRule(home, root).action).toBe("missing-script");
    expect(readFileSync(join(home, SEAT_RULE), "utf8")).toBe("the operator's own words\n");
  });

  it("a clone with no link seats no rule", () => {
    const home = mkdtempSync(join(dir, "home-"));
    expect(tendSeatRule(home, clone()).action).toBe("missing-script");
    expect(existsSync(join(home, SEAT_RULE))).toBe(false);
  });

  it("lifts a file whose seed line was all it carried, frontmatter and all", () => {
    const f = join(dir, "lares-boot.md");
    writeFileSync(f, `---\npaths: ['**']\n---\n\n-> [noosphere-boot.mem](/x/${BOOT_CARRIER})\n`);
    expect(liftSeedLines(f, "rule").action).toBe("wired");
    expect(existsSync(f)).toBe(false);
    expect(existsSync(`${f}.bak`)).toBe(true);
  });

  it("a home with no seed file stays without one", () => {
    expect(liftSeedLines(join(dir, "absent.md"), "absent").action).toBe("present");
    expect(existsSync(join(dir, "absent.md"))).toBe(false);
  });

  it("the Codex home carries no seed: a dead pointer lifts, and the home file never gains one", () => {
    const home = mkdtempSync(join(dir, "home-"));
    mkdirSync(join(home, ".codex"));
    writeFileSync(join(home, ".codex", "AGENTS.md"), `-> [noosphere-boot.mem](/x/${BOOT_CARRIER})\n\n- my own codex note\n`);
    const r = wireCodexHome({ home });
    expect(r.steps.find((s) => s.item === "AGENTS.md")!.action).toBe("wired");
    const text = readFileSync(join(home, ".codex", "AGENTS.md"), "utf8");
    expect(text).not.toContain("noosphere-boot");
    expect(text).toContain("- my own codex note");
  });

  it("the main clone of a worktree names the clone that holds the git dir", () => {
    const root = clone();
    execFileSync("git", ["init", "-q", root]);
    expect(mainCloneOf(root)).toBe(root);
  });
});

describe("the weld with tools/seed-seat.mjs", () => {
  it("both name one carrier, one pair of links and one rule", async () => {
    const tool = await import(join(REPO, "tools/seed-seat.mjs"));
    expect(tool.SEED).toBe(BOOT_CARRIER);
    expect(tool.LINK).toBe(CLAUDE_LINK);
    expect(tool.CODEX_LINK).toBe(CODEX_LINK);
    expect(tool.RULE).toBe(SEAT_RULE);
    expect(tool.RULE_EXCLUDE).toBe(SEAT_RULE_EXCLUDE);
    expect(tool.SEEDLESS_SURFACES).toEqual(SEEDLESS_FILES);
  });

  it("both read one pointer predicate: links, imports and bare paths are pointers, prose is not", async () => {
    const tool = await import(join(REPO, "tools/seed-seat.mjs"));
    const samples = [
      "-> [noosphere-boot.mem](bags/x/noosphere-boot.mem)", "Always load -> [noosphere-boot.mem](/a/b)",
      "@bags/lares/ha.ka.ba/lares/api/noosphere-boot.mem", "@.claude/noosphere-boot", "bags/x/noosphere-boot.mem",
      "- never hand-edit noosphere-boot.mem; the memegraph writes it", "the link `.claude/noosphere-boot` stays mentioned",
    ];
    for (const s of samples) expect(namesSeed(s)).toBe(tool.isPointerLine(s));
    expect(samples.map(namesSeed)).toEqual([true, true, true, true, true, false, false]);
  });

  it("lifting a pointer keeps prose that mentions the carrier by name", () => {
    const f = join(dir, "CLAUDE.md");
    writeFileSync(f, "@old/noosphere-boot.mem\n\n- never hand-edit noosphere-boot.mem\n");
    liftSeedLines(f, "CLAUDE.md");
    expect(readFileSync(f, "utf8")).toBe("- never hand-edit noosphere-boot.mem\n");
  });

  it("a seed link the tool reads as a link stays one the wire leaves alone", () => {
    const root = clone();
    symlinkSync(`../${BOOT_CARRIER}`, (mkdirSync(join(root, ".claude")), join(root, CLAUDE_LINK)));
    expect(tendLink(root, CLAUDE_LINK).action).toBe("present");
  });
});
