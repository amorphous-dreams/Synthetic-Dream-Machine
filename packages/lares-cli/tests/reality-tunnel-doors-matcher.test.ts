/**
 * The doors' permission lists, read through a model of Claude's rule matcher: every spelling of the two hearth acts and the
 * home undo lands on a deny, every act the operator approved for a prompt lands on an ask, and the doors' everyday verbs
 * ride the allow.
 *
 * THE MODEL, stated so a reader can check it against the host: a rule names a tool and, for Bash, a pattern. A pattern
 * ending `:*` matches its prefix alone or followed by a space and anything; any other pattern reads as a glob over the
 * whole command, `*` standing for any run of characters. A command splits at `&&`, `||`, `;`, `|` and newlines, and each
 * piece trims and collapses its runs of whitespace to one space before it matches. Deny outranks ask, ask outranks allow,
 * and a compound command takes its most guarded piece. A spelling the model leaves outside every rule reads `none`: the
 * host asks, as it asks for any command no rule names.
 *
 * A permission list reads spellings and never acts; the house's own gates (the shim's terminal and typed word, the home
 * undo's and the founding's seat refusals) hold the acts themselves. This table keeps the lists honest about the
 * spellings an AI seat reaches for.
 *
 * Meme: lar:///ha.ka.ba/lares/cli/reality-tunnel
 */
import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { declared } from "../src/reality-tunnel/catalog.js";

const REPO = join(import.meta.dirname, "..", "..", "..");
type Verdict = "deny" | "ask" | "allow" | "none";

const listOf = (id: string): string[] => {
  const s = declared(REPO).home.find((x) => x.id === id);
  if (!s) throw new Error(`the carrier holds no item ${id}`);
  return s["values"] as string[];
};

const escape = (s: string): string => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&");

/** One rule against one tool use: the tool's name, and for Bash the command piece. */
export function ruleMatches(rule: string, tool: string, input = ""): boolean {
  const m = /^([^(]+)(?:\((.*)\))?$/s.exec(rule);
  if (!m) return false;
  const [, ruleTool, spec] = m;
  if (spec === undefined) return new RegExp(`^${escape(ruleTool!).replace(/\*/g, ".*")}$`).test(tool);
  if (ruleTool !== tool) return false;
  if (spec.endsWith(":*")) {
    const prefix = spec.slice(0, -2);
    return input === prefix || input.startsWith(`${prefix} `);
  }
  return new RegExp(`^${escape(spec).replace(/\*/g, ".*")}$`, "s").test(input);
}

const pieces = (command: string): string[] =>
  command.split(/&&|\|\||;|\||\n/).map((p) => p.trim().replace(/\s+/g, " ")).filter((p) => p !== "");

const RANK: Record<Verdict, number> = { allow: 0, none: 1, ask: 2, deny: 3 };

/** The verdict the lists give one tool use: deny, then ask, then allow; a compound command takes its most guarded piece. */
export function verdict(lists: { allow: readonly string[]; ask: readonly string[]; deny: readonly string[] }, tool: string, command = ""): Verdict {
  const one = (input: string): Verdict =>
    lists.deny.some((r) => ruleMatches(r, tool, input)) ? "deny"
      : lists.ask.some((r) => ruleMatches(r, tool, input)) ? "ask"
        : lists.allow.some((r) => ruleMatches(r, tool, input)) ? "allow" : "none";
  if (tool !== "Bash") return one("");
  return pieces(command).map(one).reduce<Verdict>((a, b) => (RANK[b] > RANK[a] ? b : a), "allow");
}

const LISTS = () => ({ allow: listOf("claude.doors-allow"), ask: listOf("claude.host-acts-ask"), deny: listOf("claude.host-acts-deny") });

/** Every spelling, and the verdict the lists owe it. */
const BASH: ReadonlyArray<readonly [string, Verdict]> = [
  // The hearth's reset: the CLI's word, its flag orders and quotes, every path to the same binary, and the shim.
  ["lares reset", "deny"],
  ["lares reset --json", "deny"],
  ["lares  reset", "deny"],
  ["lares 'reset'", "deny"],
  ['lares "reset"', "deny"],
  ["~/.local/bin/lares reset", "deny"],
  ["/home/op/.local/bin/lares reset", "deny"],
  ["node packages/lares-cli/bin/lares.mjs reset", "deny"],
  ["npx lares reset", "deny"],
  ["tools/lares-container.sh reset", "deny"],
  ["./tools/lares-container.sh reset", "deny"],
  ["bash tools/lares-container.sh reset", "deny"],
  ["/home/op/repo/tools/lares-container.sh  reset", "deny"],
  ["cd /tmp && lares reset", "deny"],
  // The founding, bare and through the vessel door, its flag orders, the rite that composes it, and the shims.
  ["lares found", "deny"],
  ["lares found --hearth --name x", "deny"],
  ["lares 'found'", "deny"],
  ["lares vessel found", "deny"],
  ["lares vessel found --force", "deny"],
  ["lares vessel --force found", "deny"],
  ["lares vessel --json found --force", "deny"],
  ["lares vessel 'found' --force", "deny"],
  ["lares vessel rite founding", "deny"],
  ["lares vessel rite founding --force", "deny"],
  ["lares vessel --force rite founding", "deny"],
  ["/usr/local/bin/lares found", "deny"],
  ["/usr/local/bin/lares vessel found --force", "deny"],
  ["node packages/lares-cli/bin/lares.mjs vessel found --force", "deny"],
  ["npx lares vessel rite founding --force", "deny"],
  ["tools/lares-container.sh found", "deny"],
  ["tools/lares-container.sh found --hearth --name x", "deny"],
  ["tools/lares-container.sh vessel found --force", "deny"],
  ["tools/lares-container.sh vessel rite founding --force", "deny"],
  ["pwsh tools/lares-container.ps1 found", "deny"],
  ["pwsh -File tools/lares-container.ps1 vessel found --force", "deny"],
  ["true; lares vessel found --force", "deny"],
  // The home undo, which would restore a settings file from before these lists stood.
  ["lares home undo", "deny"],
  ["lares home undo 3", "deny"],
  ["lares home --force undo", "deny"],
  ["lares home --json undo", "deny"],
  ["lares home --json --force undo 2", "deny"],
  ["lares home 'undo'", "deny"],
  ["lares  home  undo", "deny"],
  ["/home/op/.local/bin/lares home undo", "deny"],
  ["node packages/lares-cli/bin/lares.mjs home --force undo", "deny"],
  ["npx lares home --json undo", "deny"],
  ["lares home read && lares home --force undo", "deny"],
  // The acts the operator keeps a prompt on, however wide the allow.
  ["lares home tend --force", "ask"],
  ["lares home tend --force --yes", "ask"],
  ["lares home --force tend", "ask"],
  ["lares repo undo", "ask"],
  ["lares repo undo 2", "ask"],
  ["lares repo --json undo", "ask"],
  ["lares down", "ask"],
  ["lares down --volumes", "ask"],
  ["lares vessel stop", "ask"],
  ["lares vessel --json stop", "ask"],
  ["lares vessel release abc", "ask"],
  ["lares vessel read vessel --release abc", "ask"],
  ["lares rebuild", "ask"],
  ["lares rebuild --prior", "ask"],
  ["lares home read && lares down", "ask"],
  // The doors' everyday verbs ride the allow; the house's own gates answer them.
  ["lares home read", "allow"],
  ["lares home read --brief", "allow"],
  ["lares home tend", "allow"],
  ["lares home tend --yes", "allow"],
  ["lares repo tend", "allow"],
  ["lares repo read --staged", "allow"],
  ["lares vessel stand", "allow"],
  ["lares vessel stand --foreground", "allow"],
  ["lares vessel roster", "allow"],
  ["lares up", "allow"],
  ["lares get title=lar:///ha.ka.ba/lararium/mesh/founding-runbook aperture=arc", "allow"],
  ["lares meme check bags/lares/ha.ka.ba/lares/cli/reality-tunnel.mem", "allow"],
  // The CLI reads its command from the first word, so a flag there names an unknown command and runs nothing.
  ["lares --json reset", "allow"],
  // No rule names these: the host asks, as for any command.
  ["git status", "none"],
  ["docker ps", "none"],
];

describe("the doors' permission lists, through a model of Claude's matcher", () => {
  it("the model reads a prefix rule at a word's end, a glob over the whole command, and the guard order", () => {
    expect(ruleMatches("Bash(lares:*)", "Bash", "lares home read")).toBe(true);
    expect(ruleMatches("Bash(lares:*)", "Bash", "lares")).toBe(true);
    expect(ruleMatches("Bash(lares:*)", "Bash", "laresx home")).toBe(false);
    expect(ruleMatches("Bash(lares home *undo*)", "Bash", "lares home undo")).toBe(true);
    expect(ruleMatches("Bash(lares home *undo*)", "Bash", "lares repo undo")).toBe(false);
    expect(ruleMatches("mcp__lares__*", "mcp__lares__get")).toBe(true);
    expect(ruleMatches("mcp__lares__*", "mcp__other__x")).toBe(false);
    const lists = { allow: ["Bash(a:*)"], ask: ["Bash(a b*)"], deny: ["Bash(a b c*)"] };
    expect(verdict(lists, "Bash", "a")).toBe("allow");
    expect(verdict(lists, "Bash", "a b")).toBe("ask");
    expect(verdict(lists, "Bash", "a b c")).toBe("deny");
    expect(verdict(lists, "Bash", "a && a b c")).toBe("deny");
    expect(verdict(lists, "Bash", "z")).toBe("none");
  });

  it.each(BASH)("%s reads %s", (command, want) => {
    expect(verdict(LISTS(), "Bash", command)).toBe(want);
  });

  it("the MCP seat rides the allow, and no list reaches another server", () => {
    expect(verdict(LISTS(), "mcp__lares__get")).toBe("allow");
    expect(verdict(LISTS(), "mcp__lares__put")).toBe("allow");
    expect(verdict(LISTS(), "mcp__other__anything")).toBe("none");
  });

  it("the operator's own settings file stays out of an AI's edit and write", () => {
    const lists = LISTS();
    expect(verdict(lists, "Edit")).toBe("none");
    for (const rule of ["Edit(~/.claude/settings.json)", "Write(~/.claude/settings.json)"]) expect(lists.deny).toContain(rule);
  });
});
