#!/usr/bin/env node
/**
 * fake-mcp-child — a small surface that speaks MCP over stdio (one JSON-RPC message per line), for the aho's binding test.
 *
 *   node fake-mcp-child.mjs <dir>
 *
 * `<dir>/tools.json` names the tools it lists, read at each `tools/list`. `<dir>/sleep` standing makes it exit at once, so no
 * child stands. It writes its pid to `<dir>/pid` and appends every method it reads to `<dir>/seen.jsonl` beside that pid.
 * `<dir>/stubborn` standing makes it ignore SIGTERM and outlive its stdin, so only a hard kill ends it; `<dir>/refuse`
 * standing makes it refuse the handshake.
 * Tools: `echo` answers its own pid and arguments; `hang` never answers; `die` exits the process with the call in flight.
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
if (existsSync(join(dir, "sleep"))) process.exit(7);
// `<dir>/stubborn` standing at spawn: this child ignores the polite stop and lives on after its stdin ends.
// `<dir>/refuse` standing at spawn: it answers `initialize` with an error.
const stubborn = existsSync(join(dir, "stubborn")), refuse = existsSync(join(dir, "refuse"));
if (stubborn) process.on("SIGTERM", () => {});
writeFileSync(join(dir, "pid"), String(process.pid));
const say = (frame) => process.stdout.write(`${JSON.stringify(frame)}\n`);
const tools = () => JSON.parse(readFileSync(join(dir, "tools.json"), "utf8")).map((name) => ({ name, description: `the ${name} door`, inputSchema: { type: "object" } }));

let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  for (let at = buffer.indexOf("\n"); at !== -1; at = buffer.indexOf("\n")) {
    const line = buffer.slice(0, at); buffer = buffer.slice(at + 1);
    if (line.trim() === "") continue;
    const frame = JSON.parse(line);
    appendFileSync(join(dir, "seen.jsonl"), `${JSON.stringify({ pid: process.pid, method: frame.method ?? null, params: frame.params ?? null })}\n`);
    if (refuse && frame.method === "initialize") say({ jsonrpc: "2.0", id: frame.id, error: { code: -32603, message: "stubborn" } });
    else if (frame.method === "initialize") say({ jsonrpc: "2.0", id: frame.id, result: { protocolVersion: frame.params.protocolVersion, capabilities: { tools: { listChanged: false } }, serverInfo: { name: "fake-surface", version: "1" } } });
    else if (frame.method === "tools/list") say({ jsonrpc: "2.0", id: frame.id, result: { tools: tools() } });
    else if (frame.method === "tools/call") {
      const name = frame.params?.name;
      if (name === "die") process.exit(9);
      if (name === "echo") say({ jsonrpc: "2.0", id: frame.id, result: { content: [{ type: "text", text: JSON.stringify({ pid: process.pid, arguments: frame.params.arguments ?? null }) }] } });
    }
  }
});
process.stdin.on("end", () => { if (stubborn) setInterval(() => {}, 1000); else process.exit(0); });
