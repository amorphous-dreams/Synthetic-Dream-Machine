/**
 * intent/kinds — the transforms an item names. Each is a pure function of a target's current bytes,
 * and each returns the current bytes unchanged once they already hold the intent, so a second
 * `tend` writes nothing (f(f(x)) = f(x)).
 *
 * Law: lar:///ha.ka.ba/lares/cli/intent.
 */
import { parse as parseToml } from "smol-toml";

type Json = Record<string, unknown>;
type Transform = (cur: string | null) => string | null;

// ── JSON ────────────────────────────────────────────────────────────────────────────────────────

/** A JSON target the house shares: bytes that do not parse as an object stand outside its ownership. */
export const jsonForeign = (cur: string | null): string | null => {
  if (cur === null || cur.trim() === "") return null;
  try {
    const v = JSON.parse(cur) as unknown;
    return v !== null && typeof v === "object" && !Array.isArray(v) ? null : "holds JSON that is not an object";
  } catch {
    return "holds bytes that do not parse as JSON; the house changes none of them";
  }
};

/** Edit a JSON object in place; the bytes change only when the object does. */
export function jsonEdit(edit: (o: Json) => void): Transform {
  return (cur) => {
    if (jsonForeign(cur)) return cur;
    const before: Json = cur === null || cur.trim() === "" ? {} : (JSON.parse(cur) as Json);
    const after = structuredClone(before);
    edit(after);
    if (cur !== null && JSON.stringify(after) === JSON.stringify(before)) return cur;
    return `${JSON.stringify(after, null, 2)}\n`;
  };
}

const at = (o: Json, path: readonly string[]): Json => {
  let node = o;
  for (const k of path) {
    const next = node[k];
    if (next === null || typeof next !== "object" || Array.isArray(next)) node[k] = {};
    node = node[k] as Json;
  }
  return node;
};

/** A number that rises to `floor` and never falls: a value at or above it stands. */
export const jsonFloor = (key: string, floor: number): Transform =>
  jsonEdit((o) => { const v = o[key]; if (!(typeof v === "number" && v >= floor)) o[key] = floor; });

/** One value at a key path, whole. */
export const jsonSet = (path: readonly string[], value: unknown): Transform =>
  jsonEdit((o) => { at(o, path.slice(0, -1))[path.at(-1)!] = structuredClone(value); });

/** An array at `key` that holds `value`, keeping every other member. */
export const jsonIncludes = (key: string, value: string): Transform =>
  jsonEdit((o) => {
    const list = Array.isArray(o[key]) ? (o[key] as unknown[]) : [];
    if (!list.includes(value)) o[key] = [...list, value];
  });

/**
 * A list converged on one entry: every member that `mentions` the entry's script yields to the
 * entry at the first such member's place, so a moved checkout re-aims the hook rather than adding
 * a second one beside the stale path.
 */
function converge<T>(list: readonly T[], mentions: (m: T) => boolean, entry: T): T[] {
  const first = list.findIndex(mentions);
  const kept = list.filter((m) => !mentions(m));
  kept.splice(first === -1 ? kept.length : first, 0, entry);
  return kept;
}

const mentionsScript = (base: string) => (v: unknown): boolean => JSON.stringify(v ?? null).includes(base);

/**
 * Claude's `hooks.<event>`: the house's command for `base` stands once, at the resolved path. The
 * convergence runs at the COMMAND, never the group: a stale house command re-aims in its own place,
 * under its own group's matcher, and every command that is not the house's stands untouched.
 */
export const claudeHook = (event: string, base: string, command: Json): Transform =>
  jsonEdit((o) => {
    const hooks = at(o, ["hooks"]);
    const groups = (Array.isArray(hooks[event]) ? (hooks[event] as unknown[]) : []) as Array<Json & { hooks?: unknown[] }>;
    const mentions = mentionsScript(base);
    const want = JSON.stringify(command);
    const held = groups.some((g) => (g.hooks ?? []).some((c) => JSON.stringify(c) === want));
    let placed = held;
    const next: Array<Json & { hooks?: unknown[] }> = [];
    for (const g of groups) {
      const cmds = Array.isArray(g.hooks) ? g.hooks : [];
      if (!cmds.some(mentions)) { next.push(g); continue; }
      const kept: unknown[] = [];
      for (const c of cmds) {
        if (!mentions(c)) { kept.push(c); continue; }
        if (JSON.stringify(c) === want) { if (!kept.some((k) => JSON.stringify(k) === want)) kept.push(c); continue; }
        if (!placed) { kept.push(command); placed = true; }
      }
      if (kept.length > 0) next.push({ ...g, hooks: kept });
    }
    if (!placed) next.push({ hooks: [command] });
    hooks[event] = next;
  });

/** Copilot's `hooks/lares.json`: the event list carries the house's hook for `base`. */
export const copilotHook = (event: string, base: string, command: Json): Transform =>
  jsonEdit((o) => {
    if (o["version"] === undefined) o["version"] = 1;
    const hooks = at(o, ["hooks"]);
    const list = Array.isArray(hooks[event]) ? (hooks[event] as unknown[]) : [];
    hooks[event] = converge(list, mentionsScript(base), command);
  });

// ── Text ────────────────────────────────────────────────────────────────────────────────────────

/**
 * A pointer line: a markdown link to the seed's file, an import of a seed name, or the seed's path
 * standing alone. Prose that mentions the file by name stays the operator's.
 */
export const namesSeed = (line: string): boolean =>
  line.includes("[noosphere-boot.mem](") || /^\s*@\S*noosphere-boot\S*\s*$/.test(line) || /^\s*\S*noosphere-boot\.mem\s*$/.test(line);

/** A file headed by `line`, with every other pointer line lifted; an absent file takes `render`. */
export const headLine = (line: string, render: string): Transform => (cur) => {
  if (cur === null) return render;
  const lines = cur.split("\n");
  if (lines[0] === line && !lines.slice(1).some(namesSeed)) return cur;
  const body = lines.filter((l) => !namesSeed(l)).join("\n").replace(/^\n+/, "");
  return `${line}\n\n${body}`;
};

/**
 * A file carrying no pointer line. A file left holding nothing past its frontmatter takes `render`,
 * or goes whole when none is given; an absent file takes `render` the same way.
 */
export const seedless = (render?: string): Transform => (cur) => {
  if (cur === null) return render ?? null;
  if (!cur.split("\n").some(namesSeed)) return cur;
  const kept = cur.split("\n").filter((l) => !namesSeed(l)).join("\n");
  if (kept.replace(/^---\n[\s\S]*?\n---\n?/, "").trim() === "") return render ?? null;
  return kept.replace(/^\n+/, "");
};

/** A file the house owns whole: its bytes are `content`, and a file lacking `marker` is someone else's. */
export const owned = (content: string, marker: string) => ({
  transform: (() => content) as Transform,
  foreign: (cur: string | null): string | null =>
    cur !== null && !cur.includes(marker) ? "carries bytes the house never wrote; it stays as it stands" : null,
});

// ── TOML (text edits; the parse reads alignment, so a held intent never moves a byte) ──────────

const tomlTryParse = (cur: string): Json | null => { try { return parseToml(cur) as Json; } catch { return null; } };

export const tomlForeign = (cur: string | null): string | null =>
  cur === null || cur.trim() === "" || tomlTryParse(cur) ? null : "holds bytes that do not parse as TOML; the house changes none of them";

/** The span of the table `header` (its header line through the line before the next header). */
function tableSpan(lines: readonly string[], header: string): [number, number] | null {
  const start = lines.findIndex((l) => l.trim() === header);
  if (start < 0) return null;
  let end = start + 1;
  while (end < lines.length && !lines[end]!.trimStart().startsWith("[")) end++;
  return [start, end];
}

const tidy = (s: string): string => s.replace(/\n{3,}/g, "\n\n");

/** A top-level number that rises to `floor` and never falls. */
export const tomlTopFloor = (key: string, floor: number): Transform => (cur) => {
  const text = cur ?? "";
  if (tomlForeign(cur)) return cur;
  const held = (tomlTryParse(text) ?? {})[key];
  if (typeof held === "number" && held >= floor) return cur;
  const line = `${key} = ${floor}`;
  const re = new RegExp(`^\\s*${key}\\s*=.*$`, "m");
  return re.test(text) ? text.replace(re, line) : `${line}\n${text.length ? `\n${text}` : ""}`;
};

/** `[table] key = value`, with every other line of the table standing. */
export const tomlTableKey = (table: string, key: string, value: string | number): Transform => (cur) => {
  const text = cur ?? "";
  if (tomlForeign(cur)) return cur;
  const t = (tomlTryParse(text) ?? {})[table] as Json | undefined;
  if (t && t[key] === value) return cur;
  const lit = typeof value === "string" ? JSON.stringify(value) : String(value);
  const lines = text.split("\n");
  const span = tableSpan(lines, `[${table}]`);
  if (!span) return tidy(`${text.replace(/\n*$/, "")}${text.length ? "\n\n" : ""}[${table}]\n${key} = ${lit}\n`);
  const [s, e] = span;
  const i = lines.slice(s + 1, e).findIndex((l) => new RegExp(`^\\s*${key}\\s*=`).test(l));
  if (i >= 0) lines[s + 1 + i] = `${key} = ${lit}`;
  else lines.splice(s + 1, 0, `${key} = ${lit}`);
  return lines.join("\n");
};

/** `[table]` carries no `key`: a cap the house's retention cannot keep beside. */
export const tomlTableUnset = (table: string, key: string): Transform => (cur) => {
  if (cur === null || tomlForeign(cur)) return cur;
  const t = (tomlTryParse(cur) ?? {})[table] as Json | undefined;
  if (!t || !(key in t)) return cur;
  const lines = cur.split("\n");
  const [s, e] = tableSpan(lines, `[${table}]`)!;
  const i = lines.slice(s + 1, e).findIndex((l) => new RegExp(`^\\s*${key}\\s*=`).test(l));
  lines.splice(s + 1 + i, 1);
  return lines.join("\n");
};

/** Codex's `[mcp_servers.<name>]`, held whole; a drifted table strips and the held one appends. */
export const tomlMcpServer = (name: string, server: { command: string; args: readonly string[]; env: Record<string, string> }): Transform => (cur) => {
  const text = cur ?? "";
  if (tomlForeign(cur)) return cur;
  const held = ((tomlTryParse(text) ?? {})["mcp_servers"] as Json | undefined)?.[name];
  if (JSON.stringify(held) === JSON.stringify({ command: server.command, args: server.args, env: server.env })) return cur;
  let lines = text.split("\n");
  for (const h of [`[mcp_servers.${name}]`, `[mcp_servers.${name}.env]`]) {
    const span = tableSpan(lines, h);
    if (span) lines = [...lines.slice(0, span[0]), ...lines.slice(span[1])];
  }
  const env = Object.entries(server.env).map(([k, v]) => `${k} = ${JSON.stringify(v)}`).join(", ");
  const block = `[mcp_servers.${name}]\ncommand = ${JSON.stringify(server.command)}\nargs = [${server.args.map((a) => JSON.stringify(a)).join(", ")}]\nenv = { ${env} }\n`;
  const body = lines.join("\n").replace(/\n*$/, "");
  return tidy(`${body}${body.length ? "\n\n" : ""}${block}`);
};

/** A Codex hook block that carries the house's hook beside another stands outside the house's ownership. */
export const tomlHookForeign = (event: string, base: string) => (cur: string | null): string | null => {
  if (cur === null) return null;
  const groups = (((tomlTryParse(cur) ?? {})["hooks"] as Json | undefined)?.[event] ?? []) as Array<{ hooks?: Array<Json> }>;
  return groups.some((g) => JSON.stringify(g).includes(base) && (g.hooks ?? []).some((h) => !JSON.stringify(h).includes(base)))
    ? `a [[hooks.${event}]] block shares the house's hook with another; the house rewrites none of it`
    : null;
};

/** Codex's `[[hooks.<event>]]`: one block carries the house's hook for `script`, at the resolved path. */
export const tomlHook = (event: string, base: string, script: string, timeout: number): Transform => (cur) => {
  const text = cur ?? "";
  if (tomlForeign(cur)) return cur;
  const groups = (((tomlTryParse(text) ?? {})["hooks"] as Json | undefined)?.[event] ?? []) as Array<{ hooks?: Array<Json> }>;
  const ours = groups.filter((g) => JSON.stringify(g).includes(base));
  const want = { type: "command", command: script, timeout };
  if (ours.length === 1 && JSON.stringify(ours[0]!.hooks) === JSON.stringify([want])) return cur;
  const lines = text.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.trim() === `[[hooks.${event}]]`) {
      let j = i + 1;
      while (j < lines.length && (!lines[j]!.trimStart().startsWith("[") || lines[j]!.trim() === `[[hooks.${event}.hooks]]`)) j++;
      if (lines.slice(i, j).join("\n").includes(base)) { i = j - 1; continue; }
    }
    out.push(lines[i]!);
  }
  const body = out.join("\n").replace(/\n*$/, "");
  const block = `[[hooks.${event}]]\n\n[[hooks.${event}.hooks]]\ntype = "command"\ncommand = ${JSON.stringify(script)}\ntimeout = ${timeout}\n`;
  return tidy(`${body}${body.length ? "\n\n" : ""}${block}`);
};
